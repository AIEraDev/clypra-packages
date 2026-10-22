import { createCanvas } from "@napi-rs/canvas";
import { describe, expect, it } from "vitest";
import {
  compileBubblePath,
  compileBubbleSvg,
  createBubbleAssetDefinition,
  createFreeformBubbleAssetDefinition,
  renderBubbleAssetDefinition,
  validateBubbleAssetDefinition,
} from "../index.js";

describe("editable text-bubble asset definitions", () => {
  it("compiles a stable closed SVG path for every supported tail side", () => {
    const definition = createBubbleAssetDefinition();

    for (const side of ["bottom", "top", "left", "right"] as const) {
      definition.geometry.tail.side = side;
      const path = compileBubblePath(definition);
      expect(path).toMatch(/^M /);
      expect(path).toMatch(/ Z$/);
      expect(compileBubblePath(definition)).toBe(path);
    }
  });

  it("uses tail parameters to produce distinct portable geometry", () => {
    const definition = createBubbleAssetDefinition();
    const initial = compileBubblePath(definition);
    definition.geometry.tail.anchor = 0.72;

    expect(compileBubblePath(definition)).not.toBe(initial);
  });

  it("keeps freeform authored paths editable, closed, and renderable", () => {
    const definition = createFreeformBubbleAssetDefinition();
    const path = compileBubblePath(definition);
    const firstAnchor = definition.geometry.commands.find(command => command.kind === "move");

    expect(path).toMatch(/Z$/);
    expect(firstAnchor).toEqual({ kind: "move", to: [0.12, 0.04] });
    expect(validateBubbleAssetDefinition(definition)).toEqual([]);
    expect(compileBubbleSvg(definition)).toContain(`<path d="${path}"`);
  });

  it("renders an authored definition into the shared canvas renderer", () => {
    const canvas = createCanvas(220, 120);
    const ctx = canvas.getContext("2d");
    const definition = createBubbleAssetDefinition();
    definition.geometry.tail.side = "right";
    definition.layers.fill.color = "#e85d75";

    renderBubbleAssetDefinition(ctx as unknown as CanvasRenderingContext2D, definition, 20, 20, 160, 80);

    const pixel = ctx.getImageData(100, 60, 1, 1).data;
    expect(pixel[0]).toBeGreaterThan(pixel[2]);
    expect(pixel[3]).toBeGreaterThan(0);
  });

  it("rejects invalid normalized source data before publish", () => {
    const definition = createBubbleAssetDefinition();
    definition.layers.fill.color = "not-a-color";
    definition.geometry.tail.anchor = 1.1;

    expect(validateBubbleAssetDefinition(definition)).toEqual(expect.arrayContaining([
      "Fill color must be a six-digit hex value.",
      "Tail anchor must be normalized.",
    ]));
  });
});
