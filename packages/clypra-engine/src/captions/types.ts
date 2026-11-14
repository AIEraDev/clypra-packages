/**
 * Caption Engine Types
 *
 * Canonical types for word-timed animated captions, shared identically
 * between desktop (wgpu compositor, worker rasterizer, main-thread fallback)
 * and @clypra-studio/engine.
 */

export interface CaptionWord {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
  /** Gap in milliseconds to the start of the next word (or 0 if end-of-segment) */
  gapToNextMs?: number;
}

export interface CaptionCue {
  id: string;
  words: CaptionWord[];
  text: string;
  startMs: number;
  endMs: number;
}

export type CaptionPresetId =
  | "classic-subtitle"
  | "karaoke-pop"
  | "bold-punch"
  | "clean-minimal"
  | "cinematic-gold"
  | "neon-glow";

export interface CaptionPresetDefinition {
  id: CaptionPresetId | string;
  name: string;
  fontFamily: string;
  fontWeight: number;
  fontStyle: "normal" | "italic";
  fontSize: number;
  letterSpacing: number;
  lineHeight: number;
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
  textAlign: "left" | "center" | "right";
  verticalAlign: "top" | "middle" | "bottom";

  // Inactive / base word styling
  inactiveColor: string;
  inactiveOpacity: number;

  // Active word highlight styling
  activeColor: string;
  activeScale?: number;
  activeWordAnim?: "none" | "pop" | "glow" | "bounce";

  // Stroke
  strokeEnabled: boolean;
  strokeColor?: string;
  strokeWidth?: number;
  activeStrokeColor?: string;
  activeStrokeWidth?: number;

  // Shadow
  shadowEnabled: boolean;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;

  // Background Box / Pill
  backgroundEnabled: boolean;
  backgroundColor?: string;
  backgroundPaddingX?: number;
  backgroundPaddingY?: number;
  backgroundBorderRadius?: number;

  // Glow / Bloom
  glowEnabled?: boolean;
  glowColor?: string;
  glowBlur?: number;
}

export interface CaptionBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CaptionWordBox {
  wordIndex: number;
  word: CaptionWord;
  x: number;
  y: number;
  width: number;
  height: number;
  baselineY: number;
  isActive: boolean;
}

export interface CaptionLineLayout {
  lineIndex: number;
  text: string;
  words: CaptionWordBox[];
  width: number;
  height: number;
  x: number;
  y: number;
}

export interface CaptionRenderOptions {
  cue: CaptionCue;
  activeWordIndex: number;
  preset: CaptionPresetDefinition;
  canvasWidth: number;
  canvasHeight: number;
  scale?: number;
  positionYRatio?: number;
}

export interface CaptionRenderResult {
  bounds: CaptionBounds;
  wordBoxes: CaptionWordBox[];
  lines: CaptionLineLayout[];
}
