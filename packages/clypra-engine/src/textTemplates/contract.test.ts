import { describe, expect, it } from "vitest";
import { compileTextTemplate } from "./compiler.js";
import { normalizeTextTemplateArtifact, resolveTemplateControlValues } from "./normalize.js";
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

  it("normalizes legacy layers with keyframed properties into valid numeric positions", () => {
    const artifact = normalizeTextTemplateArtifact({
      id: "keyframed-layer",
      label: "Keyframed Layer",
      duration: 3,
      layers: [
        {
          id: "anim-text",
          kind: "text",
          x: {
            keyframes: [
              { time: 0, value: 100, easing: "linear" },
              { time: 1.5, value: 300, easing: "ease-in-out" },
            ],
          },
          y: {
            keyframes: [
              { time: 0, value: 200, easing: "linear" },
              { time: 1.5, value: 400, easing: "ease-in-out" },
            ],
          },
          width: 500,
          height: 100,
          content: "Animated Heading",
        },
      ],
    });
    expect(artifact.document.nodes[0].x).toBe(100);
    expect(artifact.document.nodes[0].y).toBe(200);
    const diagnostics = validateTextTemplateArtifact(artifact);
    expect(diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
  });

  it("preserves visible: false on legacy layers through normalization and compiler", () => {
    const artifact = normalizeTextTemplateArtifact({
      id: "visibility-test",
      label: "Visibility Test",
      duration: 2,
      layers: [
        { id: "layer-visible", kind: "text", content: "Visible", visible: true },
        { id: "layer-hidden", kind: "text", content: "Hidden", visible: false },
      ],
    });
    expect(artifact.document.nodes[0].visible).toBe(true);
    expect(artifact.document.nodes[1].visible).toBe(false);

    const compiled = compileTextTemplate(artifact, { target: "studio", time: 1 });
    const visibleLayer = compiled.layers.find((l) => l.id === "layer-visible");
    const hiddenLayer = compiled.layers.find((l) => l.id === "layer-hidden");
    expect(visibleLayer?.visible).toBe(true);
    expect(hiddenLayer?.visible).toBe(false);
    expect(hiddenLayer?.opacity).toBe(0);
  });

  it("normalizes and compiles flex containers with vertical stack reflow", () => {
    const artifact = normalizeTextTemplateArtifact({
      id: "container-flex-test",
      label: "Container Flex Test",
      duration: 3,
      layers: [
        {
          id: "card-container",
          kind: "container",
          x: 100,
          y: 200,
          width: 500,
          height: "auto",
          layout: {
            type: "flex",
            direction: "column",
            gap: 20,
            alignItems: "start",
            paddingTop: 15,
            paddingBottom: 15,
            paddingLeft: 20,
            paddingRight: 20,
          },
          backgroundColor: "#111118",
          backgroundRadius: 12,
        },
        {
          id: "title-text",
          kind: "text",
          parentId: "card-container",
          content: "Main Heading",
          width: 400,
          height: 50,
        },
        {
          id: "subtitle-text",
          kind: "text",
          parentId: "card-container",
          content: "Supporting text",
          width: 400,
          height: 30,
        },
      ],
    });

    expect(artifact.document.nodes[0].type).toBe("container");
    expect(artifact.document.nodes[1].parentId).toBe("card-container");
    expect(artifact.document.nodes[2].parentId).toBe("card-container");

    const diagnostics = validateTextTemplateArtifact(artifact);
    expect(diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);

    const compiled = compileTextTemplate(artifact, { target: "studio", time: 0 });
    const containerLayer = compiled.layers.find((l) => l.id === "card-container");
    const titleLayer = compiled.layers.find((l) => l.id === "title-text");
    const subtitleLayer = compiled.layers.find((l) => l.id === "subtitle-text");

    // Container x: 100, y: 200
    expect(containerLayer?.x).toBe(100);
    expect(containerLayer?.y).toBe(200);

    // Title: y = container.y (200) + padTop (15) = 215, x = 100 + 20 = 120
    expect(titleLayer?.x).toBe(120);
    expect(titleLayer?.y).toBe(215);

    // Subtitle: y = 215 + title.height (50) + gap (20) = 285, x = 120
    expect(subtitleLayer?.x).toBe(120);
    expect(subtitleLayer?.y).toBe(285);
  });

  it("measures auto-sized text instead of using a fixed safe box", () => {
    const artifact = normalizeTextTemplateArtifact({
      id: "auto-size",
      label: "Auto Size",
      duration: 2,
      nodes: [{
        id: "headline",
        type: "text",
        x: 100,
        y: 200,
        width: "auto",
        height: "auto",
        text: "Measured headline",
        style: { fontFamily: "Poppins", fontSize: 48, fontWeight: 700, textColor: "#fff" },
      }],
    });

    const compiled = compileTextTemplate(artifact, {
      target: "studio",
      time: 0,
      runtime: {
        measureText: () => ({ width: 312 }),
      },
    });
    const layer = compiled.layers[0];
    expect(layer?.width).toBe(312);
    expect(layer?.height).toBeCloseTo(57.6);
    expect(layer?.width).not.toBe(400);
    expect(layer?.height).not.toBe(100);
  });

  it("resolves control values canonically from customization and fallbackText", () => {
    const artifact = normalizeTextTemplateArtifact({
      id: "cust-test",
      label: "Customization Test",
      duration: 2,
      layers: [
        {
          id: "primary-node",
          kind: "text",
          content: "Original Primary",
          role: "primary",
        },
        {
          id: "secondary-node",
          kind: "text",
          content: "Original Secondary",
          role: "secondary",
        },
      ],
    });

    // Test explicit layerTexts
    const values1 = resolveTemplateControlValues(artifact, {
      layerTexts: { "primary-node": "Explicit Name" },
      primaryText: "Ignored Name",
    });
    expect(values1["text-primary-node"]).toBe("Explicit Name");

    // Test role-based customization
    const values2 = resolveTemplateControlValues(artifact, {
      primaryText: "Role Primary",
      secondaryText: "Role Secondary",
    });
    expect(values2["text-primary-node"]).toBe("Role Primary");
    expect(values2["text-secondary-node"]).toBe("Role Secondary");

    // Test fallbackText on first node when no customization given
    const values3 = resolveTemplateControlValues(artifact, null, "Timeline Clip Text");
    expect(values3["text-primary-node"]).toBe("Timeline Clip Text");
    expect(values3["text-secondary-node"]).toBe("Original Secondary");
  });

  it("normalizes stroke and shadow from legacy text layers", () => {
    const artifact = normalizeTextTemplateArtifact({
      id: "stroke-shadow-test",
      label: "Stroke Shadow Test",
      duration: 2,
      layers: [
        {
          id: "styled-text",
          kind: "text",
          content: "Outlined",
          stroke: { color: "#ff0000", width: 4 },
          shadow: { color: "#000000", blur: 10, offsetX: 2, offsetY: 5 },
        },
      ],
    });

    const node = artifact.document.nodes[0] as any;
    expect(node.style.stroke).toEqual({ color: "#ff0000", width: 4 });
    expect(node.style.strokeColor).toBe("#ff0000");
    expect(node.style.strokeWidth).toBe(4);
    expect(node.style.shadow).toEqual({ color: "#000000", blur: 10, offsetX: 2, offsetY: 5 });
    expect(node.style.shadowColor).toBe("#000000");
    expect(node.style.shadowBlur).toBe(10);
    expect(node.style.shadowOffsetX).toBe(2);
    expect(node.style.shadowOffsetY).toBe(5);
  });
});
