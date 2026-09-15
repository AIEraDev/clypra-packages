/**
 * Effects Registry
 * Central registry for all available video effects
 */

import type { EffectRenderer as EffectRendererType, EffectParameters } from "./types";

/**
 * Effect metadata for UI and documentation
 */
export interface EffectMetadata {
  id: EffectRendererType;
  name: string;
  category: "essentials" | "glitch" | "retro" | "light" | "motion" | "color" | "body" | "cinematic" | "distortion";
  description: string;
  defaultParams: EffectParameters;
  parameterSchema: {
    [key: string]: {
      type: "number" | "string" | "boolean" | "color";
      label: string;
      min?: number;
      max?: number;
      default: any;
      step?: number;
    };
  };
  tags: string[];
  premium?: boolean;
}

/**
 * Registry of all available effects with their metadata
 */
export const EFFECTS_REGISTRY: Record<string, EffectMetadata> = {
  shockwave: {
    id: "shockwave",
    name: "Shockwave",
    category: "distortion",
    description: "Expanding shockwave wave refraction",
    defaultParams: {
      centerX: 0.5,
      centerY: 0.5,
      speed: 1.5,
      amplitude: 30,
      wavelength: 160,
      brightness: 1.0,
      radius: 600,
      animated: true,
    },
    parameterSchema: {
      centerX: { type: "number", label: "Center X", min: 0, max: 1, default: 0.5, step: 0.05 },
      centerY: { type: "number", label: "Center Y", min: 0, max: 1, default: 0.5, step: 0.05 },
      speed: { type: "number", label: "Speed", min: 0.1, max: 5, default: 1.5, step: 0.1 },
      amplitude: { type: "number", label: "Amplitude", min: 1, max: 100, default: 30, step: 1 },
      wavelength: { type: "number", label: "Wavelength", min: 10, max: 300, default: 160, step: 5 },
      brightness: { type: "number", label: "Brightness", min: 0.5, max: 2, default: 1.0, step: 0.05 },
      radius: { type: "number", label: "Max Radius", min: 100, max: 1000, default: 600, step: 10 },
    },
    tags: ["distortion", "ripple", "shockwave"],
  },
  ChromaticAberration: {
    id: "ChromaticAberration",
    name: "Chromatic Aberration",
    category: "glitch",
    description: "Directional RGB channel displacement with optical edge-feather falloff",
    defaultParams: {
      amount: 8.0,
      angleDegrees: 0.0,
      edgeFeather: 0.5,
    },
    parameterSchema: {
      amount: { type: "number", label: "Amount (px)", min: 0.0, max: 50.0, default: 8.0, step: 0.5 },
      angleDegrees: { type: "number", label: "Angle (°)", min: 0.0, max: 360.0, default: 0.0, step: 1.0 },
      edgeFeather: { type: "number", label: "Edge Feather", min: 0.0, max: 1.0, default: 0.5, step: 0.05 },
    },
    tags: ["glitch", "chromatic", "aberration", "color", "distortion", "lens", "optical"],
  },
  RgbSplit: {
    id: "RgbSplit",
    name: "RGB Split",
    category: "glitch",
    description: "Discrete horizontal and vertical color channel separation",
    defaultParams: {
      splitX: 8.0,
      splitY: 8.0,
    },
    parameterSchema: {
      splitX: { type: "number", label: "Split X (px)", min: 0.0, max: 50.0, default: 8.0, step: 0.5 },
      splitY: { type: "number", label: "Split Y (px)", min: 0.0, max: 50.0, default: 8.0, step: 0.5 },
    },
    tags: ["glitch", "rgb", "split", "color", "shift"],
  },
  FilmGrain: {
    id: "FilmGrain",
    name: "Film Grain",
    category: "retro",
    description: "Procedural cinematic film grain with adjustable size and intensity",
    defaultParams: {
      grainIntensity: 0.15,
      grainSize: 1.0,
      grainSeed: 0.0,
      animated: true,
    },
    parameterSchema: {
      grainIntensity: { type: "number", label: "Intensity", min: 0.0, max: 1.0, default: 0.15, step: 0.01 },
      grainSize: { type: "number", label: "Grain Size", min: 0.1, max: 5.0, default: 1.0, step: 0.1 },
      grainSeed: { type: "number", label: "Grain Seed", min: 0.0, max: 100.0, default: 0.0, step: 0.1 },
      animated: { type: "boolean", label: "Animated", default: true },
    },
    tags: ["retro", "film", "grain", "noise", "cinematic", "texture"],
  },
  Scanlines: {
    id: "Scanlines",
    name: "Scanlines",
    category: "retro",
    description: "CRT raster scanlines with controllable count and intensity",
    defaultParams: {
      scanlineCount: 120.0,
      scanlineIntensity: 0.5,
    },
    parameterSchema: {
      scanlineCount: { type: "number", label: "Line Count", min: 10.0, max: 1000.0, default: 120.0, step: 10.0 },
      scanlineIntensity: { type: "number", label: "Intensity", min: 0.0, max: 1.0, default: 0.5, step: 0.05 },
    },
    tags: ["retro", "crt", "scanlines", "tv", "vhs", "analog"],
  },
  Pixelate: {
    id: "Pixelate",
    name: "Pixelate",
    category: "retro",
    description: "Mosaic pixelation with adjustable block size",
    defaultParams: {
      pixelSize: 18.0,
    },
    parameterSchema: {
      pixelSize: { type: "number", label: "Block Size (px)", min: 1.0, max: 100.0, default: 18.0, step: 1.0 },
    },
    tags: ["retro", "pixelate", "mosaic", "8bit", "censorship"],
  },
};

/**
 * Get effect metadata by ID
 */
export function getEffectMetadata(id: EffectRendererType): EffectMetadata | undefined {
  return EFFECTS_REGISTRY[id];
}

/**
 * Get all effects by category
 */
export function getEffectsByCategory(category: EffectMetadata["category"]): EffectMetadata[] {
  return Object.values(EFFECTS_REGISTRY).filter((effect) => effect.category === category);
}

/**
 * Get effect renderer function by ID
 */
export function getEffectRenderer(
  id: EffectRendererType
): ((ctx: CanvasRenderingContext2D, params: EffectParameters, intensity: number, time: number, bodyMask?: ImageData) => void) | null {
  if (id === "shockwave") {
    return (ctx: CanvasRenderingContext2D, _params: EffectParameters, intensity: number, time: number) => {
      const width = ctx.canvas.width;
      const height = ctx.canvas.height;
      ctx.save();
      ctx.strokeStyle = `rgba(255, 255, 255, ${intensity * 0.25})`;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, (time * 160) % (width / 2 + 50), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    };
  }

  return null;
}

/**
 * Search effects by name or tag
 */
export function searchEffects(query: string): EffectMetadata[] {
  const lowerQuery = query.toLowerCase();
  return Object.values(EFFECTS_REGISTRY).filter(
    (effect) =>
      effect.name.toLowerCase().includes(lowerQuery) ||
      effect.description.toLowerCase().includes(lowerQuery) ||
      effect.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
  );
}
