import type { BubbleAppearance, TextBubblePreset } from "./textBubbles.js";

/**
 * bubbleRenderer.ts
 *
 * Dedicated Canvas2D Bubble Renderer for Clypra's Text Appearance System.
 *
 * Renders decorative background shapes (torn paper, speech bubbles,
 * thought clouds, ribbons, comic bursts, receipts) behind live editable text.
 *
 * Invariants:
 * - Deterministic output based on preset ID and dimensions.
 * - Always restores canvas state (save/restore).
 * - Operates in unscaled layout coordinates matching text composition.
 */

export interface BubbleRenderOptions {
  color?: string;
  opacity?: number;
  borderRadius?: number;
}

/**
 * Procedural pseudo-random helper for deterministic edge irregularities
 */
export function pseudoNoise(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Draws a realistic torn paper strip with jagged top/bottom edges,
 * paper texture, and drop shadow. (Matches CapCut reference)
 */
export function drawTornPaper(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  fillColor = "#faf9f6",
  shadow = true,
) {
  ctx.save();

  if (shadow) {
    ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4;
  }

  ctx.fillStyle = fillColor;
  ctx.beginPath();

  const steps = Math.max(16, Math.floor(width / 14));
  const stepW = width / steps;

  // Start top-left
  ctx.moveTo(x, y + 6);

  // Top jagged edge (slight dips and peaks)
  for (let i = 0; i <= steps; i++) {
    const curX = x + i * stepW;
    const n = pseudoNoise(i * 1.37 + 10);
    const wave = Math.sin((i / steps) * Math.PI * 3) * 3;
    const curY = y + (n * 5 - 2.5) + wave;
    if (i === 0) ctx.lineTo(curX, curY);
    else ctx.lineTo(curX, curY);
  }

  // Right edge (mostly straight with subtle fiber wobble)
  ctx.lineTo(x + width, y + height - 6);

  // Bottom jagged edge (reverse direction)
  for (let i = steps; i >= 0; i--) {
    const curX = x + i * stepW;
    const n = pseudoNoise(i * 2.19 + 50);
    const wave = Math.sin((i / steps) * Math.PI * 2) * 4;
    const curY = y + height + (n * 6 - 3) + wave;
    ctx.lineTo(curX, curY);
  }

  // Left edge back to top-left
  ctx.lineTo(x, y + 6);
  ctx.closePath();
  ctx.fill();

  // Reset shadow for inner details
  if (shadow) {
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
  }

  // Subtle paper grain overlay: soft horizontal wash
  const paperGrad = ctx.createLinearGradient(x, y, x, y + height);
  paperGrad.addColorStop(0, "rgba(255, 255, 255, 0.4)");
  paperGrad.addColorStop(0.5, "rgba(0, 0, 0, 0.02)");
  paperGrad.addColorStop(1, "rgba(0, 0, 0, 0.06)");
  ctx.fillStyle = paperGrad;
  ctx.fill();

  ctx.restore();
}

/**
 * Draws a smooth speech bubble balloon with a curved tail.
 */
export function drawSpeechBubble(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  fillColor = "#ffffff",
  strokeColor = "#000000",
  strokeWidth = 2,
  radius = 16,
) {
  ctx.save();
  const tailH = Math.min(16, height * 0.25);
  const bodyH = height - tailH;

  ctx.fillStyle = fillColor;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = strokeWidth;

  ctx.beginPath();
  if (typeof (ctx as any).roundRect === "function") {
    (ctx as any).roundRect(x, y, width, bodyH, radius);
  } else {
    ctx.rect(x, y, width, bodyH);
  }
  ctx.fill();
  if (strokeWidth > 0) ctx.stroke();

  // Tail pointing down-left
  const tailBaseX = x + width * 0.25;
  const tailBaseW = Math.min(24, width * 0.2);
  const tailTipX = x + width * 0.15;
  const tailTipY = y + height;

  ctx.beginPath();
  ctx.moveTo(tailBaseX, y + bodyH - 2);
  ctx.quadraticCurveTo(tailBaseX + 2, y + bodyH + tailH * 0.6, tailTipX, tailTipY);
  ctx.quadraticCurveTo(tailBaseX + tailBaseW * 0.7, y + bodyH + tailH * 0.4, tailBaseX + tailBaseW, y + bodyH - 2);
  ctx.closePath();
  ctx.fill();
  if (strokeWidth > 0) ctx.stroke();

  // Re-fill body to clear overlapping tail stroke
  ctx.beginPath();
  if (typeof (ctx as any).roundRect === "function") {
    (ctx as any).roundRect(x + 1, y + 1, width - 2, bodyH - 2, radius);
  } else {
    ctx.rect(x + 1, y + 1, width - 2, bodyH - 2);
  }
  ctx.fill();

  ctx.restore();
}

function drawConfigurableSpeechBubble(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  appearance: BubbleAppearance,
) {
  const tailHeight = Math.min(appearance.tailSize, height * 0.38);
  const bodyHeight = height - tailHeight;
  const radius = Math.min(appearance.cornerRadius, bodyHeight / 2);
  const tailCenter =
    appearance.tailPosition === "bottom-left"
      ? x + width * 0.2
      : appearance.tailPosition === "bottom-right"
        ? x + width * 0.8
        : x + width * 0.5;
  const tailWidth = Math.min(Math.max(18, appearance.tailSize * 1.5), width * 0.28);

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, appearance.fillOpacity));
  ctx.fillStyle = appearance.fillColor;
  ctx.strokeStyle = appearance.strokeColor;
  ctx.lineWidth = Math.max(0, appearance.strokeWidth);
  ctx.beginPath();
  if (typeof (ctx as any).roundRect === "function") {
    (ctx as any).roundRect(x, y, width, bodyHeight, radius);
  } else {
    ctx.rect(x, y, width, bodyHeight);
  }
  ctx.fill();
  if (appearance.strokeWidth > 0) ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(tailCenter - tailWidth / 2, y + bodyHeight - 1);
  ctx.quadraticCurveTo(tailCenter - tailWidth * 0.15, y + bodyHeight + tailHeight * 0.7, tailCenter, y + height);
  ctx.quadraticCurveTo(tailCenter + tailWidth * 0.18, y + bodyHeight + tailHeight * 0.55, tailCenter + tailWidth / 2, y + bodyHeight - 1);
  ctx.closePath();
  ctx.fill();
  if (appearance.strokeWidth > 0) ctx.stroke();
  ctx.restore();
}

/** Renders a complete serialized preset, including Studio-authored appearance. */
export function renderBubblePresetBackground(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  preset: Pick<TextBubblePreset, "id" | "appearance">,
  x: number,
  y: number,
  width: number,
  height: number,
): boolean {
  const appearance = preset.appearance;
  if (!appearance) return renderBubbleBackground(ctx, preset.id, x, y, width, height);

  ctx.save();
  switch (appearance.shape) {
    case "chalk":
      drawChalkSpeechBubble(ctx, x, y, width, height);
      break;
    case "cloud":
      drawThoughtCloud(ctx, x, y, width, height, appearance.fillColor, appearance.strokeColor, appearance.strokeWidth);
      break;
    case "comic":
      drawComicBurst(ctx, x, y, width, height, appearance.fillColor, appearance.strokeColor, appearance.strokeWidth);
      break;
    case "paper":
      drawTornPaper(ctx, x, y, width, height, appearance.fillColor, true);
      break;
    case "ribbon":
      drawRibbonBanner(ctx, x, y, width, height, appearance.fillColor, appearance.strokeColor, appearance.strokeWidth);
      break;
    case "speech":
      drawConfigurableSpeechBubble(ctx, x, y, width, height, appearance);
      break;
    case "rounded": {
      ctx.globalAlpha = Math.max(0, Math.min(1, appearance.fillOpacity));
      ctx.fillStyle = appearance.fillColor;
      ctx.strokeStyle = appearance.strokeColor;
      ctx.lineWidth = Math.max(0, appearance.strokeWidth);
      ctx.beginPath();
      if (typeof (ctx as any).roundRect === "function") {
        (ctx as any).roundRect(x, y, width, height, Math.min(appearance.cornerRadius, height / 2));
      } else {
        ctx.rect(x, y, width, height);
      }
      ctx.fill();
      if (appearance.strokeWidth > 0) ctx.stroke();
      break;
    }
  }

  if (appearance.texture === "chalk") {
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = appearance.strokeColor;
    ctx.setLineDash([1, 3]);
    ctx.lineWidth = Math.max(1, appearance.strokeWidth * 0.7);
    ctx.strokeRect(x + 1, y + 1, width - 2, height - 2);
  } else if (appearance.texture === "hatch") {
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = appearance.strokeColor;
    ctx.lineWidth = 1;
    for (let offset = -height; offset < width; offset += 9) {
      ctx.beginPath();
      ctx.moveTo(x + offset, y + height);
      ctx.lineTo(x + offset + height, y);
      ctx.stroke();
    }
  }
  ctx.restore();
  return true;
}

/**
 * Draws a hand-drawn chalk dialogue bubble: a translucent rose balloon with a
 * rough white contour and a lime/yellow cross-hatched tail. The artwork is
 * deterministic so it can be rendered identically in Studio and the editor.
 */
export function drawChalkSpeechBubble(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  ctx.save();

  const tailHeight = Math.min(46, height * 0.3);
  const bodyHeight = height - tailHeight;
  const radius = Math.min(36, bodyHeight * 0.25);
  const tailLeft = x + width * 0.1;
  const tailRight = x + width * 0.19;
  const tailTipX = x + width * 0.14;
  const tailTipY = y + height;

  // One continuous outline: the tail is part of the balloon rather than a
  // separate drop shape. This follows the asymmetric silhouette in the
  // reference and deliberately leaves the bottom open for the pencil swash.
  const balloonPath = () => {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + bodyHeight - radius);
    ctx.quadraticCurveTo(x + width, y + bodyHeight, x + width - radius, y + bodyHeight);
    ctx.lineTo(tailRight, y + bodyHeight);
    ctx.quadraticCurveTo(tailRight - width * 0.02, y + bodyHeight + tailHeight * 0.35, tailTipX, tailTipY);
    ctx.quadraticCurveTo(tailLeft + width * 0.005, y + bodyHeight + tailHeight * 0.32, tailLeft, y + bodyHeight);
    ctx.lineTo(x + radius, y + bodyHeight);
    ctx.quadraticCurveTo(x, y + bodyHeight, x, y + bodyHeight - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  };

  // Semi-transparent pink lets underlying footage carry through the bubble.
  ctx.fillStyle = "rgba(184, 122, 132, 0.58)";
  balloonPath();
  ctx.fill();

  // The yellow-green element is loose pencil texture only—never a filled
  // ribbon. It is clipped to a shallow curved swash under the lower edge.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + width * 0.2, y + bodyHeight - tailHeight * 0.13);
  ctx.quadraticCurveTo(x + width * 0.48, y + bodyHeight + tailHeight * 0.37, x + width * 0.91, y + bodyHeight - tailHeight * 0.02);
  ctx.quadraticCurveTo(x + width * 0.66, y + bodyHeight + tailHeight * 0.72, x + width * 0.24, y + bodyHeight + tailHeight * 0.44);
  ctx.closePath();
  ctx.clip();
  ctx.shadowColor = "rgba(222, 228, 105, 0.32)";
  ctx.shadowBlur = 3;
  ctx.strokeStyle = "rgba(203, 211, 76, 0.52)";
  ctx.lineWidth = 1.25;
  for (let offset = -height; offset < width; offset += 9) {
    ctx.beginPath();
    ctx.moveTo(x + offset, y + height);
    ctx.lineTo(x + offset + height, y);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255, 250, 196, 0.48)";
  ctx.lineWidth = 0.8;
  for (let offset = 0; offset < width + height; offset += 12) {
    ctx.beginPath();
    ctx.moveTo(x + offset, y);
    ctx.lineTo(x + offset - height, y + height);
    ctx.stroke();
  }
  ctx.restore();

  // A restrained base contour plus irregular dry-chalk flecks. The previous
  // uniform dashes read as stitching; the reference is much softer.
  ctx.strokeStyle = "rgba(255, 253, 246, 0.82)";
  ctx.lineCap = "round";
  ctx.lineWidth = 1.35;
  balloonPath();
  ctx.stroke();
  const edgeSegments = 66;
  for (let index = 0; index < edgeSegments; index++) {
    const pointX = x + width * (index / edgeSegments);
    const topNoise = (pseudoNoise(index + 91) - 0.5) * 4;
    const strokeLength = 0.8 + pseudoNoise(index + 143) * 2.1;
    ctx.lineWidth = 0.6 + pseudoNoise(index + 211) * 1.1;
    ctx.beginPath();
    ctx.moveTo(pointX, y + topNoise);
    ctx.lineTo(pointX + strokeLength, y + topNoise + (pseudoNoise(index + 19) - 0.5) * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pointX, y + bodyHeight + topNoise);
    ctx.lineTo(pointX + strokeLength, y + bodyHeight + topNoise + (pseudoNoise(index + 37) - 0.5) * 2);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draws a fluffy thought cloud bubble.
 */
export function drawThoughtCloud(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  fillColor = "#ffffff",
  strokeColor = "#000000",
  strokeWidth = 2,
) {
  ctx.save();
  ctx.fillStyle = fillColor;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = strokeWidth;

  const cx = x + width / 2;
  const cy = y + height / 2;
  const rx = width * 0.44;
  const ry = height * 0.38;

  ctx.beginPath();
  const lobes = 8;
  for (let i = 0; i < lobes; i++) {
    const angle = (i / lobes) * Math.PI * 2;
    const lx = cx + Math.cos(angle) * rx;
    const ly = cy + Math.sin(angle) * ry;
    const lobeR = Math.min(width, height) * 0.28;
    ctx.moveTo(lx + lobeR, ly);
    ctx.arc(lx, ly, lobeR, 0, Math.PI * 2);
  }
  ctx.fill();
  if (strokeWidth > 0) ctx.stroke();

  ctx.restore();
}

/**
 * Draws an energetic comic starburst explosion.
 */
export function drawComicBurst(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  fillColor = "#ffffff",
  strokeColor = "#000000",
  strokeWidth = 3,
) {
  ctx.save();
  ctx.fillStyle = fillColor;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = strokeWidth;

  const cx = x + width / 2;
  const cy = y + height / 2;
  const points = 16;
  const outerRx = width / 2;
  const outerRy = height / 2;
  const innerRx = width * 0.32;
  const innerRy = height * 0.32;

  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const isOuter = i % 2 === 0;
    const rx = isOuter ? outerRx : innerRx;
    const ry = isOuter ? outerRy : innerRy;
    const px = cx + Math.cos(angle) * rx;
    const py = cy + Math.sin(angle) * ry;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  if (strokeWidth > 0) ctx.stroke();

  ctx.restore();
}

/**
 * Draws a folded ribbon / banner with chevron notch ends.
 */
export function drawRibbonBanner(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  fillColor = "#facc15",
  strokeColor = "#000000",
  strokeWidth = 2,
) {
  ctx.save();
  ctx.fillStyle = fillColor;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = strokeWidth;

  const notch = Math.min(18, width * 0.08);

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + width - notch, y);
  ctx.lineTo(x + width, y + height / 2);
  ctx.lineTo(x + width - notch, y + height);
  ctx.lineTo(x, y + height);
  ctx.lineTo(x + notch, y + height / 2);
  ctx.closePath();
  ctx.fill();
  if (strokeWidth > 0) ctx.stroke();

  ctx.restore();
}

/**
 * Main dispatcher: renders a bubble decoration based on its presetId.
 */
export function renderBubbleBackground(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  presetId: string,
  x: number,
  y: number,
  width: number,
  height: number,
  options?: BubbleRenderOptions,
): boolean {
  if (!presetId || presetId === "none") return false;

  const color = options?.color || "#ffffff";
  const opacity = options?.opacity ?? 1;

  ctx.save();
  if (opacity < 1) {
    ctx.globalAlpha *= opacity;
  }

  // 1. Torn Paper category (matches Screenshot 2 & Screenshot 4)
  if (
    presetId === "bubble-paper-torn" ||
    presetId === "bubble-paper-torn-beige" ||
    presetId === "bubble-paper-kraft" ||
    presetId === "bubble-paper-notebook"
  ) {
    const paperColor =
      presetId === "bubble-paper-kraft"
        ? "#d4a373"
        : presetId === "bubble-paper-torn-beige"
        ? "#f3eed9"
        : "#faf9f6";
    drawTornPaper(ctx, x, y, width, height, color || paperColor, true);
    ctx.restore();
    return true;
  }

  // 2. Speech Bubbles
  if (
    presetId === "bubble-speech-round" ||
    presetId === "bubble-speech-oval" ||
    presetId === "bubble-speech-tall"
  ) {
    drawSpeechBubble(ctx, x, y, width, height, color, "#000000", 2, 16);
    ctx.restore();
    return true;
  }

  // 2b. Hand-drawn chalk dialogue bubble
  if (presetId === "bubble-speech-chalk-rose") {
    drawChalkSpeechBubble(ctx, x, y, width, height);
    ctx.restore();
    return true;
  }

  // 3. Clouds
  if (
    presetId === "bubble-cloud-dotted" ||
    presetId === "bubble-cloud-morning" ||
    presetId === "bubble-cloud-yellow"
  ) {
    drawThoughtCloud(ctx, x, y, width, height, color, "#000000", 2);
    ctx.restore();
    return true;
  }

  // 4. Comic Bursts
  if (presetId === "bubble-comic-bam" || presetId === "bubble-comic-dark-hero") {
    const burstColor = presetId === "bubble-comic-dark-hero" ? "#18181b" : color;
    const strokeColor = presetId === "bubble-comic-dark-hero" ? "#ef4444" : "#000000";
    drawComicBurst(ctx, x, y, width, height, burstColor, strokeColor, 3);
    ctx.restore();
    return true;
  }

  // 5. Ribbons & Banners
  if (presetId === "bubble-ribbon-sunny" || presetId === "bubble-ribbon-yellow") {
    drawRibbonBanner(ctx, x, y, width, height, color || "#facc15", "#000000", 2);
    ctx.restore();
    return true;
  }

  // Default fallback: rounded rectangle card with shadow
  const radius = options?.borderRadius ?? 8;
  ctx.shadowColor = "rgba(0, 0, 0, 0.2)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = color;
  ctx.beginPath();
  if (typeof (ctx as any).roundRect === "function") {
    (ctx as any).roundRect(x, y, width, height, radius);
  } else {
    ctx.rect(x, y, width, height);
  }
  ctx.fill();

  ctx.restore();
  return true;
}
