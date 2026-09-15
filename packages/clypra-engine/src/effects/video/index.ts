/**
 * Video Effects Library
 *
 * Collection of single-input video effects for the Video Lab.
 * Phase 3 Week 6 - 5 Production-Quality Effects
 */

export { identityEffect } from "./identity";
export { filmGrainEffect } from "./filmGrain";
export { vhsEffect } from "./vhs";
export { bloomEffect } from "./bloom";
export { chromaticAberrationEffect } from "./chromaticAberration";
export { heatDistortionEffect } from "./heatDistortion";
export { rgbSplitEffect } from "./rgbSplit";
export { scanlinesEffect } from "./scanlines";
export { pixelateEffect } from "./pixelate";

import { identityEffect } from "./identity";
import { filmGrainEffect } from "./filmGrain";
import { vhsEffect } from "./vhs";
import { bloomEffect } from "./bloom";
import { chromaticAberrationEffect } from "./chromaticAberration";
import { heatDistortionEffect } from "./heatDistortion";
import { rgbSplitEffect } from "./rgbSplit";
import { scanlinesEffect } from "./scanlines";
import { pixelateEffect } from "./pixelate";

/**
 * All video effects available in the Video Lab
 */
export const videoEffects = [
  identityEffect,
  filmGrainEffect,
  vhsEffect,
  bloomEffect,
  chromaticAberrationEffect,
  heatDistortionEffect,
  rgbSplitEffect,
  scanlinesEffect,
  pixelateEffect,
];

/**
 * Video effects registry by ID
 */
export const videoEffectsById = {
  "video.identity": identityEffect,
  "video.film-grain": filmGrainEffect,
  "video.vhs": vhsEffect,
  "video.bloom": bloomEffect,
  "video.chromatic-aberration": chromaticAberrationEffect,
  "video.heat-distortion": heatDistortionEffect,
  "video.rgb-split": rgbSplitEffect,
  "video.scanlines": scanlinesEffect,
  "video.pixelate": pixelateEffect,
};

/**
 * Get effect by ID
 */
export function getVideoEffect(id: string) {
  return videoEffectsById[id as keyof typeof videoEffectsById];
}
