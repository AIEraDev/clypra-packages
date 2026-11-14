/**
 * Caption Canvas Renderer
 *
 * Single source of truth for rendering word-timed animated captions.
 * Consumed identically by:
 * 1. Web Worker (templateRasterizer.worker.ts) for off-thread sub-canvas rasterization
 * 2. Main-thread fallback (nativeTextPreview.ts) when Web Workers are unavailable or during export
 * 3. @clypra-studio/engine in web and browser previews
 */

import type {
  CaptionRenderOptions,
  CaptionRenderResult,
  CaptionPresetDefinition,
} from "./types.js";
import { CaptionEngine } from "./engine.js";

export function renderCaptionToCanvas(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  options: CaptionRenderOptions,
): CaptionRenderResult {
  const {
    cue,
    activeWordIndex,
    preset,
    canvasWidth,
    canvasHeight,
    scale = 1.0,
    positionYRatio = 0.85,
  } = options;

  if (!cue.words || cue.words.length === 0) {
    return {
      bounds: { x: 0, y: 0, width: 0, height: 0 },
      wordBoxes: [],
      lines: [],
    };
  }

  // 1. Compute multi-line layout and geometry bounds
  const layout = CaptionEngine.computeLayout(
    ctx,
    cue,
    activeWordIndex,
    preset,
    canvasWidth,
    canvasHeight,
    scale,
    positionYRatio,
  );

  const fontSize = Math.round(preset.fontSize * scale);
  const fontStr = `${preset.fontStyle} ${preset.fontWeight} ${fontSize}px "${preset.fontFamily}", sans-serif`;
  ctx.font = fontStr;
  ctx.textBaseline = "alphabetic";

  // 2. Render background box/pill if enabled
  if (preset.backgroundEnabled && preset.backgroundColor) {
    ctx.save();
    ctx.fillStyle = preset.backgroundColor;
    const padX = (preset.backgroundPaddingX ?? 18) * scale;
    const padY = (preset.backgroundPaddingY ?? 8) * scale;
    const radius = (preset.backgroundBorderRadius ?? 12) * scale;

    for (const line of layout.lines) {
      const bgX = line.x - padX;
      const bgY = line.y - padY / 2;
      const bgW = line.width + padX * 2;
      const bgH = line.height + padY;

      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(bgX, bgY, bgW, bgH, radius);
      } else {
        ctx.rect(bgX, bgY, bgW, bgH);
      }
      ctx.fill();
    }
    ctx.restore();
  }

  // 3. Render words
  for (const box of layout.wordBoxes) {
    ctx.save();

    const displayText =
      preset.textTransform === "uppercase"
        ? box.word.text.toUpperCase()
        : preset.textTransform === "lowercase"
          ? box.word.text.toLowerCase()
          : box.word.text;

    const isActive = box.isActive;

    // Apply active-word scale animation (centered on word)
    if (isActive && preset.activeScale && preset.activeScale !== 1.0) {
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;
      ctx.translate(centerX, centerY);
      ctx.scale(preset.activeScale, preset.activeScale);
      ctx.translate(-centerX, -centerY);
    }

    // Configure glow if active and enabled
    if (isActive && preset.glowEnabled && preset.glowColor) {
      ctx.shadowColor = preset.glowColor;
      ctx.shadowBlur = (preset.glowBlur ?? 16) * scale;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    } else if (preset.shadowEnabled && preset.shadowColor) {
      ctx.shadowColor = preset.shadowColor;
      ctx.shadowBlur = (preset.shadowBlur ?? 6) * scale;
      ctx.shadowOffsetX = (preset.shadowOffsetX ?? 0) * scale;
      ctx.shadowOffsetY = (preset.shadowOffsetY ?? 2) * scale;
    } else {
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }

    // Configure stroke
    if (preset.strokeEnabled) {
      ctx.lineWidth = ((isActive && preset.activeStrokeWidth) || preset.strokeWidth || 4) * scale;
      ctx.strokeStyle = (isActive && preset.activeStrokeColor) || preset.strokeColor || "#000000";
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;
      ctx.strokeText(displayText, box.x, box.baselineY);
    }

    // Configure fill
    if (isActive) {
      ctx.fillStyle = preset.activeColor;
      ctx.globalAlpha = 1.0;
    } else {
      ctx.fillStyle = preset.inactiveColor;
      ctx.globalAlpha = preset.inactiveOpacity;
    }

    ctx.fillText(displayText, box.x, box.baselineY);

    ctx.restore();
  }

  return layout;
}
