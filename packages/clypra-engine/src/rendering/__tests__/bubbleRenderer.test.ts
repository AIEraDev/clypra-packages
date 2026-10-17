import { createCanvas } from "@napi-rs/canvas";
import { describe, expect, it } from "vitest";
import {
  renderBubbleBackground,
  resolveBubbleLayout,
  drawTornPaper,
  drawSpeechBubble,
  drawThoughtCloud,
  drawComicBurst,
  drawRibbonBanner,
} from "../index.js";

describe("shared bubbleRenderer in @clypra-studio/engine", () => {
  it("resolves auto-fit layout dimensions given text bounds and padding", () => {
    const layout = resolveBubbleLayout(100, 30, {
      contentBounds: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
      minWidth: 80,
      minHeight: 40,
      preserveAspectRatio: false,
      padding: { top: 10, right: 15, bottom: 10, left: 15 },
    });

    expect(layout.outerWidth).toBe(130);
    expect(layout.outerHeight).toBe(50);
    expect(layout.textOffsetX).toBe(0);
    expect(layout.textOffsetY).toBe(0);
  });

  it("enforces minimum bounds when text is smaller than min dimensions", () => {
    const layout = resolveBubbleLayout(20, 10, {
      contentBounds: { x: 0, y: 0, width: 1, height: 1 },
      minWidth: 100,
      minHeight: 60,
      preserveAspectRatio: false,
      padding: { top: 5, right: 5, bottom: 5, left: 5 },
    });

    expect(layout.outerWidth).toBe(100);
    expect(layout.outerHeight).toBe(60);
  });

  it("renders torn paper preset into canvas with positive pixel alpha", () => {
    const canvas = createCanvas(200, 80);
    const ctx = canvas.getContext("2d");
    const rendered = renderBubbleBackground(
      ctx as any,
      "bubble-paper-torn",
      10,
      10,
      180,
      60,
      { color: "#ffffff" },
    );

    expect(rendered).toBe(true);
    const imgData = ctx.getImageData(0, 0, 200, 80).data;
    const hasAlpha = Array.from(imgData).some((v, i) => i % 4 === 3 && v > 0);
    expect(hasAlpha).toBe(true);
  });

  it("renders speech, cloud, comic, and ribbon presets correctly", () => {
    const presets = [
      "bubble-speech-round",
      "bubble-cloud-dotted",
      "bubble-comic-bam",
      "bubble-ribbon-sunny",
    ];

    for (const presetId of presets) {
      const canvas = createCanvas(120, 60);
      const ctx = canvas.getContext("2d");
      const ok = renderBubbleBackground(ctx as any, presetId, 5, 5, 110, 50);
      expect(ok).toBe(true);
      const imgData = ctx.getImageData(0, 0, 120, 60).data;
      const hasAlpha = Array.from(imgData).some((v, i) => i % 4 === 3 && v > 0);
      expect(hasAlpha).toBe(true);
    }
  });

  it("returns false and does not draw when preset is 'none'", () => {
    const canvas = createCanvas(100, 50);
    const ctx = canvas.getContext("2d");
    const ok = renderBubbleBackground(ctx as any, "none", 0, 0, 100, 50);
    expect(ok).toBe(false);
  });
});
