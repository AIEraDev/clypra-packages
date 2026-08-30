import { createCanvas } from "@napi-rs/canvas";
import { describe, expect, it } from "vitest";
import { renderCanonicalToCanvas, renderTextTemplateToCanvas, resolveTextTemplateArtifact } from "./index.js";
import { normalizeTextTemplateArtifact } from "../textTemplates/normalize.js";

describe("canonical capability renderers", () => {
  const legacyPayload = {
    id: "callout",
    label: "Callout",
    category: "callout",
    duration: 2,
    canvasWidth: 800,
    canvasHeight: 300,
    layers: [{ id: "title", kind: "text", x: 200, y: 90, width: 400, height: 100, content: "Default" }],
  };

  it("unwraps nested canonical payloads and does not render catalog summaries", () => {
    const artifact = resolveTextTemplateArtifact({ templateData: legacyPayload });
    expect(artifact?.kind).toBe("text-template");
    expect(resolveTextTemplateArtifact({ id: "summary-only", revisionId: "rev-1", thumbnailUrl: "thumb" })).toBeNull();
  });

  it("renders a canonical template through the dispatch facade", () => {
    const artifact = normalizeTextTemplateArtifact({
      ...legacyPayload,
      layers: [
        { id: "plate", kind: "shape", x: 100, y: 60, width: 600, height: 180, color: "#ff0000" },
        { id: "title", kind: "text", x: 200, y: 100, width: 400, height: 80, content: "Rendered", fontFamily: "Arial", fontSize: 42, color: "#ffffff" },
      ],
    });
    const canvas = createCanvas(800, 300);
    const context = canvas.getContext("2d");
    const result = renderCanonicalToCanvas(context as any, {
      capability: "text-template",
      artifact,
      context: { environment: "editor", time: 1, width: 800, height: 300 },
    });
    const alpha = context.getImageData(0, 0, 800, 300).data;
    expect(result.capability).toBe("text-template");
    expect(result.compiledTemplate?.layers).toHaveLength(2);
    expect(Array.from(alpha).some((value, index) => index % 4 === 3 && value > 0)).toBe(true);
  });

  it("applies control values in the same renderer used by preview and export", () => {
    const artifact = normalizeTextTemplateArtifact({
      ...legacyPayload,
      controls: [{ id: "headline", label: "Headline", type: "text", defaultValue: "Default", target: { nodeId: "title", propertyPath: "text" } }],
    });
    const canvas = createCanvas(800, 300);
    const result = renderTextTemplateToCanvas(canvas.getContext("2d") as any, {
      artifact,
      context: { environment: "export", time: 1, controlValues: { headline: "Updated" } },
    });
    expect(result.compiledTemplate?.layers.find((layer) => layer.id === "title")?.text).toBe("Updated");
  });

  it("preserves and evaluates legacy property keyframes", () => {
    const artifact = resolveTextTemplateArtifact({
      ...legacyPayload,
      duration: 2,
      layers: [{
        id: "moving-title",
        kind: "text",
        x: { keyframes: [{ time: 0, value: 100 }, { time: 2, value: 500 }] },
        y: 100,
        width: 200,
        height: 80,
        content: "Moving",
      }],
    });
    expect(artifact).not.toBeNull();
    const result = renderTextTemplateToCanvas(createCanvas(800, 300).getContext("2d") as any, {
      artifact: artifact!,
      context: { environment: "preview", time: 1 },
    });
    expect(result.compiledTemplate?.layers[0]?.x).toBe(300);
  });

  it("evaluates typewriter motion bundles into visible text at each frame", () => {
    const artifact = resolveTextTemplateArtifact({
      ...legacyPayload,
      duration: 2,
      layers: [{
        id: "typewriter-title",
        kind: "text",
        x: 100,
        y: 100,
        width: 600,
        height: 80,
        content: "TYPEWRITER",
        animation: { in: "typewriter", out: "none", inDuration: 1, outDuration: 0, hold: "full" },
      }],
    });
    const result = renderTextTemplateToCanvas(createCanvas(800, 300).getContext("2d") as any, {
      artifact: artifact!,
      context: { environment: "studio", time: 0.5 },
    });
    expect(result.compiledTemplate?.layers[0]?.text).toBe("TYPEW");
  });
});
