import { describe, it, expect } from "vitest";
import { defaultConfig, createBlankTextEffectConfig } from "../presets";
import type { Preset } from "../types";
import { _buildConfig, textEffectConfigToScene, sceneToConfig } from "./migrate";
import { blendConfigs } from "./blend";
import { getPresetScene } from "./recipes";

const samplePreset: Preset = {
  id: "test-preset-1",
  name: "Test Preset",
  category: "Classic",
  config: defaultConfig,
};

describe("textEffectConfigToScene migration", () => {
  it("creates a fresh blank state with every decorative contributor explicitly disabled", () => {
    const blank = createBlankTextEffectConfig();
    const scene = textEffectConfigToScene(blank);

    expect(blank.glowLayers.every((layer) => layer.enabled === false)).toBe(true);
    expect(blank.strokeEnabled).toBe(false);
    expect(blank.shadowEnabled).toBe(false);
    expect(blank.bevelEnabled).toBe(false);
    expect(blank.stackEnabled).toBe(false);
    expect(blank.panelEnabled).toBe(false);
    expect(scene.effectLayers.filter((layer) => layer.type !== "fill").every((layer) => layer.enabled === false)).toBe(true);
  });

  it("round-trips default config without losing key fields", () => {
    const scene = textEffectConfigToScene(defaultConfig);
    const back = sceneToConfig(scene);

    expect(back.text).toBe(defaultConfig.text);
    expect(back.fontFamily).toBe(defaultConfig.fontFamily);
    expect(back.fillType).toBe(defaultConfig.fillType);
    expect(back.fillColor).toBe(defaultConfig.fillColor);
    expect(back.strokeEnabled).toBe(defaultConfig.strokeEnabled);
    expect(back.bevelEnabled).toBe(defaultConfig.bevelEnabled);
    expect(scene.version).toBe(1);
  });

  it("caches preset scenes", () => {
    const a = getPresetScene(samplePreset);
    const b = getPresetScene(samplePreset);
    expect(a).not.toBe(b);
    expect(a.effectName).toBe(b.effectName);
  });

  it("round-trips per-character fill colors", () => {
    const cfg = {
      ...defaultConfig,
      fillType: "solid" as const,
      perCharFillEnabled: true,
      charFillColors: ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff"],
    };
    const scene = textEffectConfigToScene(cfg);
    const back = sceneToConfig(scene);
    expect(back.perCharFillEnabled).toBe(true);
    expect(back.charFillColors?.slice(0, 3)).toEqual(["#ff0000", "#00ff00", "#0000ff"]);
  });

  it("preserves explicit disabled effect objects from canonical Studio definitions", () => {
    const definition = {
      id: "disabled-properties",
      name: "Disabled Properties",
      category: "outline",
      font: {
        family: "Poppins",
        weight: 700,
        style: "normal",
        letterSpacing: 0,
        lineHeight: 1.2,
      },
      fills: [{ type: "solid", color: "#ffffff" }],
      strokes: [],
      shadows: [{ enabled: false, color: "#000000", blur: 20, offsetX: 4, offsetY: 4 }],
      glows: [{ enabled: false, color: "#ffffff", blur: 95, opacity: 100, type: "outer" }],
      panel: {
        enabled: false,
        color: "#ffffff",
        opacity: 80,
        radius: 12,
        paddingX: 40,
        paddingY: 20,
      },
    } as any;

    const config = _buildConfig(definition, "CLYPRA", 100, 800, 200);

    expect(config.shadowEnabled).toBe(false);
    expect(config.panelEnabled).toBe(false);
    expect(config.glowLayers).toEqual([
      expect.objectContaining({ enabled: false, blur: 95 }),
    ]);
  });

  it("blends two configs", () => {
    const a = { ...defaultConfig, fontSize: 40 };
    const b = { ...defaultConfig, fontSize: 80 };
    const mid = blendConfigs(a, b, 0.5);
    expect(mid.fontSize).toBe(60);
  });
});
