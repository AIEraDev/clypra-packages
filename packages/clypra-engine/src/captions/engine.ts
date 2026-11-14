/**
 * Caption Engine
 *
 * Handles layout geometry, pagination, word-timing evaluation, and
 * cache key computation for word-timed animated captions.
 */

import type {
  CaptionCue,
  CaptionWord,
  CaptionPresetDefinition,
  CaptionLineLayout,
  CaptionWordBox,
  CaptionBounds,
} from "./types.js";
import { hashCaptionPreset } from "./presets.js";

export const PAUSE_RELEASE_THRESHOLD_MS = 250;
export const DEFAULT_MAX_WORDS_PER_LINE = 5;
export const DEFAULT_MAX_LINES = 2;
export const DEFAULT_PAUSE_BREAK_MS = 350;

export interface CaptionPaginationConfig {
  maxWordsPerLine?: number;
  maxLines?: number;
  pauseBreakMs?: number;
}

export class CaptionEngine {
  /**
   * Paginates a flat stream of words into structured caption cues.
   * Enforces max words per line, max lines, pause thresholds, and punctuation breaks.
   */
  public static paginateWords(
    words: CaptionWord[],
    config: CaptionPaginationConfig = {},
  ): CaptionCue[] {
    if (!words.length) return [];

    const maxWordsPerLine = config.maxWordsPerLine ?? DEFAULT_MAX_WORDS_PER_LINE;
    const maxLines = config.maxLines ?? DEFAULT_MAX_LINES;
    const maxWordsPerCue = maxWordsPerLine * maxLines;
    const pauseBreakMs = config.pauseBreakMs ?? DEFAULT_PAUSE_BREAK_MS;

    const cues: CaptionCue[] = [];
    let currentCueWords: CaptionWord[] = [];

    for (let i = 0; i < words.length; i++) {
      const currentWord = words[i];
      const nextWord = words[i + 1];

      currentCueWords.push(currentWord);

      const hasReachedMaxWords = currentCueWords.length >= maxWordsPerCue;
      const isTerminalPunctuation = /[.!?]$/.test(currentWord.text.trim());
      const hasPauseBreak =
        nextWord && nextWord.startMs - currentWord.endMs >= pauseBreakMs;
      const isLastWord = i === words.length - 1;

      if (hasReachedMaxWords || isTerminalPunctuation || hasPauseBreak || isLastWord) {
        const text = currentCueWords.map((w) => w.text).join(" ");
        const startMs = currentCueWords[0].startMs;
        const endMs = currentCueWords[currentCueWords.length - 1].endMs;
        const id = `cue_${startMs}_${endMs}`;

        cues.push({
          id,
          words: [...currentCueWords],
          text,
          startMs,
          endMs,
        });

        currentCueWords = [];
      }
    }

    return cues;
  }

  /**
   * Resolves the active word index within a cue for a given playback time in milliseconds.
   * Returns -1 if no word is active or during the pause release window (> 250ms after speech ends).
   */
  public static resolveActiveWordIndex(cue: CaptionCue, currentTimeMs: number): number {
    if (!cue.words.length) return -1;
    if (currentTimeMs < cue.words[0].startMs) return -1;

    for (let i = 0; i < cue.words.length; i++) {
      const w = cue.words[i];
      const nextWord = cue.words[i + 1];

      // Currently speaking inside word boundary
      if (currentTimeMs >= w.startMs && currentTimeMs < w.endMs) {
        return i;
      }

      // Inside pause between this word and next word
      if (currentTimeMs >= w.endMs && nextWord && currentTimeMs < nextWord.startMs) {
        const gap = nextWord.startMs - w.endMs;
        if (gap <= PAUSE_RELEASE_THRESHOLD_MS) {
          // Short gap (sub-250ms coarticulation): maintain highlight on finished word
          return i;
        }
        // Longer gap: release highlight during pause
        if (currentTimeMs < w.endMs + PAUSE_RELEASE_THRESHOLD_MS) {
          return i;
        }
        return -1;
      }
    }

    // After the last word in the cue
    const lastWord = cue.words[cue.words.length - 1];
    if (currentTimeMs >= lastWord.endMs) {
      if (currentTimeMs < lastWord.endMs + PAUSE_RELEASE_THRESHOLD_MS) {
        return cue.words.length - 1;
      }
      return -1;
    }

    return -1;
  }

  /**
   * Builds the canonical raster cache key for a caption frame.
   * Format: `caption:${clipId}:${segmentId}:${activeWordIndex}:${presetHash}:${fontLoaded}`
   */
  public static buildCacheKey(
    clipId: string,
    segmentId: string,
    activeWordIndex: number,
    preset: CaptionPresetDefinition,
    fontLoaded: boolean,
  ): string {
    const presetHash = hashCaptionPreset(preset);
    return `caption:${clipId}:${segmentId}:${activeWordIndex}:${presetHash}:${fontLoaded ? 1 : 0}`;
  }

  /**
   * Computes multi-line word layout and bounding boxes for a cue.
   */
  public static computeLayout(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    cue: CaptionCue,
    activeWordIndex: number,
    preset: CaptionPresetDefinition,
    canvasWidth: number,
    canvasHeight: number,
    scale: number = 1.0,
    positionYRatio: number = 0.85,
  ): { bounds: CaptionBounds; wordBoxes: CaptionWordBox[]; lines: CaptionLineLayout[] } {
    const fontSize = Math.round(preset.fontSize * scale);
    const lineHeight = fontSize * preset.lineHeight;
    const fontStr = `${preset.fontStyle} ${preset.fontWeight} ${fontSize}px "${preset.fontFamily}", sans-serif`;
    ctx.font = fontStr;

    // Split words into lines based on max canvas width (80% of canvas width)
    const maxLineWidth = Math.max(200, canvasWidth * 0.85);
    const spaceWidth = ctx.measureText(" ").width;

    const lines: { words: CaptionWord[]; indices: number[]; widths: number[] }[] = [];
    let curLineWords: CaptionWord[] = [];
    let curLineIndices: number[] = [];
    let curLineWidths: number[] = [];
    let curLineWidth = 0;

    for (let i = 0; i < cue.words.length; i++) {
      const word = cue.words[i];
      const displayText =
        preset.textTransform === "uppercase"
          ? word.text.toUpperCase()
          : preset.textTransform === "lowercase"
            ? word.text.toLowerCase()
            : word.text;

      const wWidth = ctx.measureText(displayText).width;
      const neededWidth = curLineWidth === 0 ? wWidth : curLineWidth + spaceWidth + wWidth;

      if (curLineWords.length > 0 && (neededWidth > maxLineWidth || curLineWords.length >= DEFAULT_MAX_WORDS_PER_LINE)) {
        lines.push({
          words: curLineWords,
          indices: curLineIndices,
          widths: curLineWidths,
        });
        curLineWords = [word];
        curLineIndices = [i];
        curLineWidths = [wWidth];
        curLineWidth = wWidth;
      } else {
        curLineWords.push(word);
        curLineIndices.push(i);
        curLineWidths.push(wWidth);
        curLineWidth = neededWidth;
      }
    }

    if (curLineWords.length > 0) {
      lines.push({
        words: curLineWords,
        indices: curLineIndices,
        widths: curLineWidths,
      });
    }

    const totalHeight = lines.length * lineHeight;
    const anchorCenterY = canvasHeight * positionYRatio;
    const startY = anchorCenterY - totalHeight / 2;

    const allWordBoxes: CaptionWordBox[] = [];
    const lineLayouts: CaptionLineLayout[] = [];

    let overallMinX = Infinity;
    let overallMinY = Infinity;
    let overallMaxX = -Infinity;
    let overallMaxY = -Infinity;

    for (let l = 0; l < lines.length; l++) {
      const line = lines[l];
      const lineWidth =
        line.widths.reduce((a, b) => a + b, 0) + (line.words.length - 1) * spaceWidth;
      const lineY = startY + l * lineHeight;
      const baselineY = lineY + fontSize * 0.82;

      let startX = (canvasWidth - lineWidth) / 2;
      if (preset.textAlign === "left") {
        startX = canvasWidth * 0.08;
      } else if (preset.textAlign === "right") {
        startX = canvasWidth * 0.92 - lineWidth;
      }

      let curX = startX;
      const lineBoxes: CaptionWordBox[] = [];

      for (let w = 0; w < line.words.length; w++) {
        const word = line.words[w];
        const wordIdx = line.indices[w];
        const wWidth = line.widths[w];
        const isActive = wordIdx === activeWordIndex;

        const box: CaptionWordBox = {
          wordIndex: wordIdx,
          word,
          x: curX,
          y: lineY,
          width: wWidth,
          height: lineHeight,
          baselineY,
          isActive,
        };

        lineBoxes.push(box);
        allWordBoxes.push(box);

        overallMinX = Math.min(overallMinX, curX);
        overallMinY = Math.min(overallMinY, lineY);
        overallMaxX = Math.max(overallMaxX, curX + wWidth);
        overallMaxY = Math.max(overallMaxY, lineY + lineHeight);

        curX += wWidth + spaceWidth;
      }

      lineLayouts.push({
        lineIndex: l,
        text: line.words.map((w) => w.text).join(" "),
        words: lineBoxes,
        width: lineWidth,
        height: lineHeight,
        x: startX,
        y: lineY,
      });
    }

    // Add bleed padding for stroke, shadow, glow, and active-word scale
    const strokeBleed = preset.strokeEnabled ? (preset.strokeWidth ?? 4) * scale : 0;
    const shadowBleed = preset.shadowEnabled ? (preset.shadowBlur ?? 8) * scale : 0;
    const glowBleed = preset.glowEnabled ? (preset.glowBlur ?? 16) * scale : 0;
    const bgPadX = preset.backgroundEnabled ? (preset.backgroundPaddingX ?? 20) * scale : 0;
    const bgPadY = preset.backgroundEnabled ? (preset.backgroundPaddingY ?? 10) * scale : 0;
    const activeScaleBleed = fontSize * 0.25;

    const padX = Math.ceil(Math.max(strokeBleed + shadowBleed + glowBleed + activeScaleBleed, bgPadX));
    const padY = Math.ceil(Math.max(strokeBleed + shadowBleed + glowBleed + activeScaleBleed, bgPadY));

    const bounds: CaptionBounds = {
      x: Math.max(0, Math.floor(overallMinX - padX)),
      y: Math.max(0, Math.floor(overallMinY - padY)),
      width: Math.min(canvasWidth, Math.ceil(overallMaxX - overallMinX + padX * 2)),
      height: Math.min(canvasHeight, Math.ceil(overallMaxY - overallMinY + padY * 2)),
    };

    return { bounds, wordBoxes: allWordBoxes, lines: lineLayouts };
  }
}
