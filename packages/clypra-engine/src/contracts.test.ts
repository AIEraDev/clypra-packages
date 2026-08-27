import { describe, expect, it } from "vitest";
import { canonicalContentHash, evaluateTextEffect, normalizeTextEffect, normalizeTextTemplate } from "./contracts";

describe("canonical effect and template contracts", () => {
  it("normalizes legacy effects with stable layer ids and preserves disabled layers", () => {
    const scene = normalizeTextEffect({
      text: "CLYPRA",
      effectName: "Mango Pop",
      fontFamily: "Poppins",
      fontWeight: 700,
      fontStyle: "normal",
      fontSize: 100,
      letterSpacing: 0,
      lineHeight: 1.2,
      fillType: "solid",
      fillColor: "#ff9900",
      fillGradientAngle: 90,
      fillGradientStops: [],
      strokeEnabled: true,
      strokeColor: "#fff",
      strokeWidth: 10,
      strokePosition: "outside",
      strokeOpacity: 100,
      strokeLineJoin: "round",
      glowLayers: [{ enabled: false, color: "#fff", blur: 95, opacity: 100, type: "outer" }],
      shadowEnabled: false,
      shadowColor: "#000",
      shadowBlur: 14,
      shadowOffsetX: 6,
      shadowOffsetY: 8,
      shadowOpacity: 65,
      shadowType: "drop",
      bevelEnabled: false,
      bevelDepth: 0,
      bevelHighlight: "#fff",
      bevelShadow: "#000",
      bevelDirection: "bottom-right",
      panelEnabled: false,
      panelColor: "#000",
      panelOpacity: 80,
      panelRadius: 12,
      panelPaddingX: 20,
      panelPaddingY: 20,
      panelStrokeEnabled: false,
      panelStrokeColor: "#000",
      panelStrokeWidth: 1,
      canvasWidth: 800,
      canvasHeight: 200,
      textPosX: "center",
      textPosY: "middle",
    });

    expect(scene.schemaVersion).toBe(2);
    expect(scene.effectLayers.map((layer) => layer.id)).toEqual([
      "panel",
      "glow-1",
      "shadow",
      "extrusion",
      "duplicate-stack",
      "stroke",
      "fill",
      "mask",
      "compositor",
    ]);
    expect(scene.effectLayers.find((layer) => layer.id === "glow-1")?.enabled).toBe(false);
    expect(scene.effectLayers.find((layer) => layer.id === "panel")?.enabled).toBe(false);

    const plan = evaluateTextEffect(scene);
    expect(plan.diagnostics.find((item) => item.layerId === "glow-1")?.contribution).toBe("disabled");
  });

  it("normalizes templates and collects embedded effect dependencies", () => {
    const template = normalizeTextTemplate({
      id: "lower-third",
      label: "Lower Third",
      category: "lower-third",
      duration: 3,
      canvasWidth: 1920,
      canvasHeight: 1080,
      layers: [{
        kind: "text",
        id: "primary",
        content: "Clypra",
        fontFamily: "Poppins",
        fontSize: 48,
        fontWeight: 700,
        color: "#fff",
        align: "left",
        x: 20,
        y: 20,
        width: "auto",
        height: "auto",
        animation: { in: "fade", out: "fade", inDuration: 0.2, outDuration: 0.2, hold: "full" },
        styleId: "mango-pop",
        styleVersion: 4,
        styleDefinition: {
          id: "mango-pop",
          name: "Mango Pop",
          category: "outline",
          description: "",
          tags: [],
          font: { family: "Poppins", weight: 700, style: "normal", letterSpacing: 0, lineHeight: 1.2 },
          fills: [],
          strokes: [],
          shadows: [],
        },
      }],
    });

    expect(template.schemaVersion).toBe(2);
    expect(template.dependencies).toHaveLength(1);
    expect(template.dependencies[0].effectId).toBe("mango-pop");
    expect(template.dependencies[0].snapshot?.schemaVersion).toBe(2);
  });

  it("hashes equivalent objects deterministically", () => {
    expect(canonicalContentHash({ b: 2, a: 1 })).toBe(canonicalContentHash({ a: 1, b: 2 }));
  });
});
