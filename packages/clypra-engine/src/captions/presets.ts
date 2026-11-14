/**
 * Built-in Caption Presets (OFL Fonts Only)
 *
 * 6 production-grade typography presets for word-timed animated captions:
 * 1. Classic Subtitle (Inter Variable, subtle stroke, bottom centered)
 * 2. Karaoke Pop (Outfit Variable, active word highlight with scale 1.12x)
 * 3. Bold Punch (Montserrat Variable, uppercase, thick stroke, drop shadow)
 * 4. Clean Minimal (Inter Variable, rounded translucent pill box background)
 * 5. Cinematic Gold (Outfit Variable, gold active fill #FBBF24, tracked letters)
 * 6. Neon Glow (Montserrat Variable, vibrant cyan stroke #0891B2, glow blur)
 */

import type { CaptionPresetDefinition, CaptionPresetId } from "./types.js";

export const CAPTION_PRESET_CLASSIC_SUBTITLE: CaptionPresetDefinition = {
  id: "classic-subtitle",
  name: "Classic Subtitle",
  fontFamily: "Inter Variable",
  fontWeight: 600,
  fontStyle: "normal",
  fontSize: 48,
  letterSpacing: 0,
  lineHeight: 1.25,
  textTransform: "none",
  textAlign: "center",
  verticalAlign: "bottom",
  inactiveColor: "#FFFFFF",
  inactiveOpacity: 0.95,
  activeColor: "#FFFFFF",
  activeScale: 1.0,
  strokeEnabled: true,
  strokeColor: "#000000",
  strokeWidth: 4,
  shadowEnabled: true,
  shadowColor: "rgba(0, 0, 0, 0.75)",
  shadowBlur: 6,
  shadowOffsetX: 0,
  shadowOffsetY: 2,
  backgroundEnabled: false,
};

export const CAPTION_PRESET_KARAOKE_POP: CaptionPresetDefinition = {
  id: "karaoke-pop",
  name: "Karaoke Pop",
  fontFamily: "Outfit Variable",
  fontWeight: 700,
  fontStyle: "normal",
  fontSize: 54,
  letterSpacing: 0.5,
  lineHeight: 1.3,
  textTransform: "none",
  textAlign: "center",
  verticalAlign: "bottom",
  inactiveColor: "#FFFFFF",
  inactiveOpacity: 0.55,
  activeColor: "#38BDF8",
  activeScale: 1.12,
  activeWordAnim: "pop",
  strokeEnabled: true,
  strokeColor: "#000000",
  strokeWidth: 5,
  shadowEnabled: true,
  shadowColor: "rgba(0, 0, 0, 0.8)",
  shadowBlur: 8,
  shadowOffsetX: 0,
  shadowOffsetY: 3,
  backgroundEnabled: false,
};

export const CAPTION_PRESET_BOLD_PUNCH: CaptionPresetDefinition = {
  id: "bold-punch",
  name: "Bold Punch",
  fontFamily: "Montserrat Variable",
  fontWeight: 900,
  fontStyle: "normal",
  fontSize: 56,
  letterSpacing: 1.0,
  lineHeight: 1.2,
  textTransform: "uppercase",
  textAlign: "center",
  verticalAlign: "bottom",
  inactiveColor: "#FFFFFF",
  inactiveOpacity: 0.6,
  activeColor: "#E11D48",
  activeScale: 1.08,
  activeWordAnim: "pop",
  strokeEnabled: true,
  strokeColor: "#000000",
  strokeWidth: 6,
  shadowEnabled: true,
  shadowColor: "rgba(0, 0, 0, 0.9)",
  shadowBlur: 10,
  shadowOffsetX: 3,
  shadowOffsetY: 4,
  backgroundEnabled: false,
};

export const CAPTION_PRESET_CLEAN_MINIMAL: CaptionPresetDefinition = {
  id: "clean-minimal",
  name: "Clean Minimal",
  fontFamily: "Inter Variable",
  fontWeight: 500,
  fontStyle: "normal",
  fontSize: 42,
  letterSpacing: 0,
  lineHeight: 1.3,
  textTransform: "none",
  textAlign: "center",
  verticalAlign: "bottom",
  inactiveColor: "#E2E8F0",
  inactiveOpacity: 0.7,
  activeColor: "#FFFFFF",
  activeScale: 1.0,
  strokeEnabled: false,
  shadowEnabled: false,
  backgroundEnabled: true,
  backgroundColor: "rgba(15, 23, 42, 0.75)",
  backgroundPaddingX: 20,
  backgroundPaddingY: 10,
  backgroundBorderRadius: 14,
};

export const CAPTION_PRESET_CINEMATIC_GOLD: CaptionPresetDefinition = {
  id: "cinematic-gold",
  name: "Cinematic Gold",
  fontFamily: "Outfit Variable",
  fontWeight: 600,
  fontStyle: "normal",
  fontSize: 48,
  letterSpacing: 2.0,
  lineHeight: 1.35,
  textTransform: "none",
  textAlign: "center",
  verticalAlign: "bottom",
  inactiveColor: "#E2E8F0",
  inactiveOpacity: 0.55,
  activeColor: "#FBBF24",
  activeScale: 1.05,
  strokeEnabled: true,
  strokeColor: "#000000",
  strokeWidth: 3.5,
  shadowEnabled: true,
  shadowColor: "rgba(251, 191, 36, 0.35)",
  shadowBlur: 14,
  shadowOffsetX: 0,
  shadowOffsetY: 2,
  backgroundEnabled: false,
};

export const CAPTION_PRESET_NEON_GLOW: CaptionPresetDefinition = {
  id: "neon-glow",
  name: "Neon Glow",
  fontFamily: "Montserrat Variable",
  fontWeight: 800,
  fontStyle: "normal",
  fontSize: 52,
  letterSpacing: 1.0,
  lineHeight: 1.25,
  textTransform: "none",
  textAlign: "center",
  verticalAlign: "bottom",
  inactiveColor: "#94A3B8",
  inactiveOpacity: 0.5,
  activeColor: "#22D3EE",
  activeScale: 1.06,
  activeWordAnim: "glow",
  strokeEnabled: true,
  strokeColor: "#0891B2",
  strokeWidth: 4,
  glowEnabled: true,
  glowColor: "#06B6D4",
  glowBlur: 16,
  shadowEnabled: true,
  shadowColor: "rgba(0, 0, 0, 0.8)",
  shadowBlur: 8,
  shadowOffsetX: 0,
  shadowOffsetY: 2,
  backgroundEnabled: false,
};

export const BUILT_IN_CAPTION_PRESETS: Record<CaptionPresetId, CaptionPresetDefinition> = {
  "classic-subtitle": CAPTION_PRESET_CLASSIC_SUBTITLE,
  "karaoke-pop": CAPTION_PRESET_KARAOKE_POP,
  "bold-punch": CAPTION_PRESET_BOLD_PUNCH,
  "clean-minimal": CAPTION_PRESET_CLEAN_MINIMAL,
  "cinematic-gold": CAPTION_PRESET_CINEMATIC_GOLD,
  "neon-glow": CAPTION_PRESET_NEON_GLOW,
};

export function getCaptionPreset(idOrPreset: string | CaptionPresetDefinition | undefined): CaptionPresetDefinition {
  if (!idOrPreset) return CAPTION_PRESET_CLASSIC_SUBTITLE;
  if (typeof idOrPreset === "object") return idOrPreset;
  const match = BUILT_IN_CAPTION_PRESETS[idOrPreset as CaptionPresetId];
  return match ?? CAPTION_PRESET_CLASSIC_SUBTITLE;
}

/**
 * Computes a fast deterministic 32-bit hash of a resolved CaptionPresetDefinition
 * for use in sub-canvas bounding-box raster cache keys.
 */
export function hashCaptionPreset(preset: CaptionPresetDefinition): string {
  const str = `${preset.id}:${preset.fontFamily}:${preset.fontWeight}:${preset.fontSize}:${preset.activeColor}:${preset.inactiveColor}:${preset.activeScale ?? 1}:${preset.strokeEnabled ? preset.strokeWidth : 0}:${preset.shadowEnabled ? preset.shadowBlur : 0}:${preset.backgroundEnabled ? preset.backgroundColor : ""}:${preset.glowEnabled ? preset.glowBlur : 0}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}
