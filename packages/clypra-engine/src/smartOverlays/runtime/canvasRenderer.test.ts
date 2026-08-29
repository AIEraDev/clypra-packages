import { describe, expect, it } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import { defaultConfig } from "../../presets.js";
import { textEffectConfigToScene } from "../../engine/migrate.js";
import type { EvaluatedScene } from "./evaluatedScene.js";
import { renderEvaluatedSceneToCanvas } from "./canvasRenderer.js";

function scene(nodes: EvaluatedScene["nodes"]): EvaluatedScene {
  return {
    version: "2.0",
    time: 0,
    canvas: { width: 800, height: 300, backgroundColor: "transparent" },
    nodes,
    nodeMap: {},
    diagnostics: [],
    metadata: { documentId: "test", evaluatedAtTime: 0, activeBreakpointId: null },
  };
}

function alphaSum(canvas: ReturnType<typeof createCanvas>): number {
  const pixels = canvas.getContext("2d").getImageData(0, 0, 800, 300).data;
  let sum = 0;
  for (let index = 3; index < pixels.length; index += 4) sum += pixels[index];
  return sum;
}

describe("renderEvaluatedSceneToCanvas", () => {
  it("renders the same evaluated scene primitives used by native overlay previews", () => {
    const canvas = createCanvas(800, 300);
    renderEvaluatedSceneToCanvas(scene([
      {
        id: "panel",
        name: "Panel",
        type: "shape",
        visible: true,
        transform: { x: 100, y: 90, width: 600, height: 120, rotation: 0, scaleX: 1, scaleY: 1, translateX: 0, translateY: 0, anchorX: 0, anchorY: 0 },
        style: { opacity: 1, fillColor: "#7c6fff", fillOpacity: 1, borderRadius: 12 },
      },
      {
        id: "title",
        name: "Title",
        type: "text",
        visible: true,
        transform: { x: 100, y: 90, width: 600, height: 120, rotation: 0, scaleX: 1, scaleY: 1, translateX: 0, translateY: 0, anchorX: 0, anchorY: 0 },
        style: { opacity: 1, fontFamily: "Inter", fontSize: 48, fontWeight: "700", textColor: "#ffffff", textAlign: "center", lineHeight: 1.2 },
        content: { text: "Template" },
      },
    ]), canvas.getContext("2d") as any);
    expect(alphaSum(canvas)).toBeGreaterThan(0);
  });

  it("routes pinned text-effect snapshots through the shared effect evaluator", () => {
    const effectSnapshot = textEffectConfigToScene({
      ...defaultConfig,
      text: "EFFECT",
      canvasWidth: 500,
      canvasHeight: 160,
      fontSize: 72,
    });
    const canvas = createCanvas(800, 300);
    renderEvaluatedSceneToCanvas(scene([{
      id: "effect-title",
      name: "Effect title",
      type: "text",
      visible: true,
      transform: { x: 150, y: 70, width: 500, height: 160, rotation: 0, scaleX: 1, scaleY: 1, translateX: 0, translateY: 0, anchorX: 0, anchorY: 0 },
      style: { opacity: 1, fontFamily: "Inter", fontSize: 72, fontWeight: "700", textColor: "#ffffff", textAlign: "center", lineHeight: 1.2 },
      content: { text: "EFFECT" },
      metadata: { textEffectRef: { effectId: "effect", revisionId: "rev-1", contentHash: "hash", snapshot: effectSnapshot } },
    }]), canvas.getContext("2d") as any);
    expect(alphaSum(canvas)).toBeGreaterThan(0);
  });
});
