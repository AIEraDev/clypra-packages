import { describe, expect, it } from "vitest";
import { compileTextTemplate } from "./compiler.js";
import { normalizeTextTemplateArtifact } from "./normalize.js";
import { validateTextTemplateArtifact } from "./validator.js";
import { TEXT_TEMPLATE_SCHEMA_VERSION } from "./contract.js";

describe("canonical text templates", () => {
  it("normalizes the legacy layers payload into a canonical scene graph", () => {
    const artifact = normalizeTextTemplateArtifact({
      id: "lower-third",
      label: "Lower Third",
      category: "lower-third",
      duration: 5,
      canvasWidth: 1920,
      canvasHeight: 1080,
      layers: [{ id: "title", kind: "text", x: 100, y: 200, width: 800, height: 120, content: "Name" }],
    });
    expect(artifact.kind).toBe("text-template");
    expect(artifact.schemaVersion).toBe(TEXT_TEMPLATE_SCHEMA_VERSION);
    expect(artifact.document.nodes[0]).toMatchObject({ id: "title", type: "text", text: "Name" });
    expect(artifact.controls[0]).toMatchObject({ target: { nodeId: "title", propertyPath: "text" } });
  });

  it("applies typed control values through the compiler", () => {
    const artifact = normalizeTextTemplateArtifact({
      id: "title",
      label: "Title",
      category: "title-card",
      duration: 2,
      nodes: [
        {
          id: "title",
          name: "Title",
          type: "text",
          x: 0,
          y: 0,
          width: 500,
          height: 100,
          text: "Default",
          style: { fontFamily: "Inter", fontSize: 48, fontWeight: 400, textColor: "#ffffff" },
        },
      ],
      controls: [
        {
          id: "headline",
          label: "Headline",
          type: "text",
          defaultValue: "Default",
          target: { nodeId: "title", propertyPath: "text" },
        },
      ],
    });
    const compiled = compileTextTemplate(artifact, {
      target: "editor",
      time: 0,
      controlValues: { headline: "Updated" },
    });
    expect(compiled.layers.find((layer) => layer.id === "title")?.text).toBe("Updated");
  });

  it("rejects controls that target unknown nodes", () => {
    const artifact = normalizeTextTemplateArtifact({
      id: "broken",
      label: "Broken",
      category: "title-card",
      duration: 2,
      nodes: [],
      controls: [
        {
          id: "headline",
          label: "Headline",
          type: "text",
          defaultValue: "x",
          target: { nodeId: "missing", propertyPath: "text" },
        },
      ],
    });
    expect(validateTextTemplateArtifact(artifact).some((item) => item.code === "CONTROL_TARGET")).toBe(true);
  });
});
