import {
  TextSplitAnimator,
  TextSplitTransform,
  SplitMode,
  StaggerDirection,
  TextStyleSpan,
} from "../types";
import { applyEasing } from "./keyframes";

export interface SplitUnit {
  text: string;
  index: number;
  totalUnits: number;
  charStartIndex: number;
  charEndIndex: number;
  isWhitespace: boolean;
}

export interface ComputedSplitUnitTransform {
  unit: SplitUnit;
  progress: number; // 0 to 1
  x: number;
  y: number;
  z: number;
  scale: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  rotateX: number;
  rotateY: number;
  opacity: number;
  blur: number;
  letterSpacingOffset: number;
}

/**
 * Tokenize string into SplitUnits by character, word, or line.
 */
export function splitTextContent(text: string, mode: SplitMode): SplitUnit[] {
  if (!text) return [];

  const units: SplitUnit[] = [];

  if (mode === "character") {
    const chars = Array.from(text);
    let charPos = 0;
    chars.forEach((char, idx) => {
      units.push({
        text: char,
        index: idx,
        totalUnits: chars.length,
        charStartIndex: charPos,
        charEndIndex: charPos + char.length,
        isWhitespace: char === " " || char === "\t" || char === "\n",
      });
      charPos += char.length;
    });
  } else if (mode === "word") {
    // Regex splits words while capturing whitespace tokens
    const tokens = text.match(/\S+|\s+/g) || [text];
    let wordIdx = 0;
    let charPos = 0;

    tokens.forEach((token) => {
      const isWhitespace = /^\s+$/.test(token);
      units.push({
        text: token,
        index: isWhitespace ? -1 : wordIdx++,
        totalUnits: 0, // Assigned below
        charStartIndex: charPos,
        charEndIndex: charPos + token.length,
        isWhitespace,
      });
      charPos += token.length;
    });

    const totalWords = wordIdx;
    units.forEach((u) => {
      u.totalUnits = totalWords;
    });
  } else if (mode === "line") {
    const lines = text.split("\n");
    let charPos = 0;
    lines.forEach((line, idx) => {
      units.push({
        text: line,
        index: idx,
        totalUnits: lines.length,
        charStartIndex: charPos,
        charEndIndex: charPos + line.length,
        isWhitespace: line.length === 0,
      });
      charPos += line.length + 1; // +1 for newline character
    });
  }

  return units;
}

/**
 * Simple pseudo-random permutation with seed for deterministic random stagger
 */
function getStaggerRank(
  index: number,
  totalUnits: number,
  direction: StaggerDirection,
  seed: number = 42
): number {
  if (totalUnits <= 1) return 0;

  switch (direction) {
    case "start-to-end":
      return index;
    case "end-to-start":
      return totalUnits - 1 - index;
    case "center-out": {
      const center = (totalUnits - 1) / 2;
      return Math.abs(index - center);
    }
    case "edges-in": {
      const center = (totalUnits - 1) / 2;
      return center - Math.abs(index - center);
    }
    case "random": {
      // Deterministic mulberry32 PRNG based on unit index + seed
      let t = (index + 1) * (seed + 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      const rand = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      return rand * totalUnits;
    }
    default:
      return index;
  }
}

/**
 * Evaluate kinetic transforms for all split units at animation progress t (0 to 1).
 */
export function evaluateSplitTextTransforms(
  units: SplitUnit[],
  animator: TextSplitAnimator,
  progress: number, // 0 to 1
  direction: "in" | "out" = "in"
): ComputedSplitUnitTransform[] {
  const {
    direction: staggerDir,
    delayPerUnit,
    overlap,
    randomSeed = 1234,
    initialTransform,
    easing = "ease",
    bezier,
    durationPerUnit = 0.4,
  } = animator;

  const validUnits = units.filter((u) => !u.isWhitespace || animator.splitBy === "character");
  const totalUnits = validUnits.length;
  if (totalUnits === 0) return [];

  // Effective stagger delay
  const maxRank = Math.max(
    ...validUnits.map((u) => getStaggerRank(u.index >= 0 ? u.index : 0, totalUnits, staggerDir, randomSeed))
  );

  return units.map((unit) => {
    if (unit.isWhitespace && animator.splitBy !== "character") {
      return {
        unit,
        progress: 1,
        x: 0,
        y: 0,
        z: 0,
        scale: 1,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        rotateX: 0,
        rotateY: 0,
        opacity: 1,
        blur: 0,
        letterSpacingOffset: 0,
      };
    }

    const rank = getStaggerRank(unit.index >= 0 ? unit.index : 0, totalUnits, staggerDir, randomSeed);
    const staggerNormalized = maxRank > 0 ? (rank / maxRank) * (1 - overlap) : 0;

    // Unit local progress in [0, 1]
    const unitTimeSpan = 1 - staggerNormalized;
    let unitProgress = unitTimeSpan > 0 ? Math.max(0, Math.min(1, (progress - staggerNormalized) / unitTimeSpan)) : 1;

    // Apply Easing
    const easedT = applyEasing(unitProgress, easing, bezier);
    const p = direction === "in" ? easedT : 1 - easedT;

    // Interpolate transform parameters from initialTransform -> rest (identity)
    const init = initialTransform;
    const x = (init.x ?? 0) * (1 - p);
    const y = (init.y ?? 0) * (1 - p);
    const z = (init.z ?? 0) * (1 - p);
    const scale = (init.scale ?? 1) * (1 - p) + 1.0 * p;
    const scaleX = (init.scaleX ?? 1) * (1 - p) + 1.0 * p;
    const scaleY = (init.scaleY ?? 1) * (1 - p) + 1.0 * p;
    const rotation = (init.rotation ?? 0) * (1 - p);
    const rotateX = (init.rotateX ?? 0) * (1 - p);
    const rotateY = (init.rotateY ?? 0) * (1 - p);
    const opacity = (init.opacity ?? 0) * (1 - p) + 1.0 * p;
    const blur = (init.blur ?? 0) * (1 - p);
    const letterSpacingOffset = (init.letterSpacingOffset ?? 0) * (1 - p);

    return {
      unit,
      progress: p,
      x,
      y,
      z,
      scale,
      scaleX,
      scaleY,
      rotation,
      rotateX,
      rotateY,
      opacity,
      blur,
      letterSpacingOffset,
    };
  });
}

/**
 * Finds span styling for a specific character index
 */
export function getSpanForCharIndex(spans: TextStyleSpan[] | undefined, charIndex: number): TextStyleSpan | undefined {
  if (!spans || spans.length === 0) return undefined;
  return spans.find((s) => charIndex >= s.start && charIndex < s.end);
}
