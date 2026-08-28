import { describe, it, expect } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import { builtInPresets, defaultConfig } from "../presets";
import { textEffectConfigToScene } from "./migrate";
import { evaluateScene } from "./evaluate";

(globalThis as typeof globalThis & { __clypraCreateCanvas?: typeof createCanvas }).__clypraCreateCanvas =
  createCanvas;

describe("evaluateScene render parity", () => {
  it("renders every built-in preset without throwing and produces visible pixels", () => {
    for (const preset of builtInPresets) {
      const scene = textEffectConfigToScene(preset.config);
      const w = scene.canvas.width || 800;
      const h = scene.canvas.height || 200;
      const canvas = createCanvas(w, h);
      const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;

      expect(() => evaluateScene(scene, 0, ctx)).not.toThrow();
      expect(() => evaluateScene(scene, 0.5, ctx)).not.toThrow();

      const data = ctx.getImageData(0, 0, w, h).data;
      let sum = 0;
      for (let i = 0; i < data.length; i += 4) {
        sum += data[i] + data[i + 1] + data[i + 2] + data[i + 3];
      }
      expect(sum).toBeGreaterThan(0);
    }
  });

  it("renders an enabled glow outside the text silhouette without a rectangular plate", () => {
    const base = {
      ...defaultConfig,
      text: "GLOW",
      canvasWidth: 800,
      canvasHeight: 200,
      fontSize: 100,
      fillColor: "#FFFFFF",
      glowLayers: [{ enabled: false, color: "#FFFFFF", blur: 40, opacity: 100, type: "outer" as const }],
    };
    const withoutGlow = createCanvas(800, 200);
    const withGlow = createCanvas(800, 200);

    evaluateScene(textEffectConfigToScene(base), 0, withoutGlow.getContext("2d") as any);
    evaluateScene(textEffectConfigToScene({ ...base, glowLayers: [{ ...base.glowLayers[0], enabled: true }] }), 0, withGlow.getContext("2d") as any);

    const noGlowPixels = (withoutGlow.getContext("2d") as any).getImageData(0, 0, 800, 200).data as Uint8ClampedArray;
    const glowPixels = (withGlow.getContext("2d") as any).getImageData(0, 0, 800, 200).data as Uint8ClampedArray;
    const alphaSum = (pixels: Uint8ClampedArray) => {
      let sum = 0;
      for (let i = 3; i < pixels.length; i += 4) sum += pixels[i];
      return sum;
    };

    expect(alphaSum(glowPixels)).toBeGreaterThan(alphaSum(noGlowPixels));
    // The glow is transparent outside the text; no opaque background plate is
    // allowed to be introduced by the effect layer.
    expect(glowPixels[3]).toBe(0);
    expect(glowPixels[(799 * 4) + 3]).toBe(0);
  });
});
