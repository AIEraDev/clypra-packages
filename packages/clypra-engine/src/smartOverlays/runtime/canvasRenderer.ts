import type { EvaluatedNode, EvaluatedScene } from "./evaluatedScene.js";
import { evaluateScene } from "../../engine/evaluate.js";

export type SceneCanvasContext =
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D;

function alpha(value: number | undefined, fallback = 1): number {
  if (value === undefined) return fallback;
  return value > 1 ? value / 100 : Math.max(0, Math.min(1, value));
}

function roundedRect(
  ctx: SceneCanvasContext,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, r);
    return;
  }
  ctx.beginPath();
  ctx.rect(x, y, width, height);
}

function drawText(
  ctx: SceneCanvasContext,
  node: EvaluatedNode,
  text: string,
): void {
  const style = node.style;
  const size = Math.max(1, style.fontSize ?? 20);
  const weight = style.fontWeight ?? "400";
  const family = style.fontFamily ?? "Inter, sans-serif";
  const lineHeight = (style.lineHeight ?? 1.2) * size;
  const maxWidth = Math.max(1, node.transform.width);
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line || !lines.length) lines.push(line);

  const maxLines = (style as typeof style & { maxLines?: number }).maxLines;
  const visibleLines = maxLines ? lines.slice(0, maxLines) : lines;
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.fillStyle = style.textColor ?? style.fillColor ?? "#ffffff";
  ctx.textAlign = style.textAlign ?? "left";
  ctx.textBaseline = "top";
  const x = style.textAlign === "center" ? maxWidth / 2 : style.textAlign === "right" ? maxWidth : 0;
  const progress = node.content?.typewriterProgress;
  visibleLines.forEach((value, index) => {
    const lineText = progress === undefined ? value : value.slice(0, Math.ceil(value.length * progress));
    ctx.fillText(lineText, x, index * lineHeight, maxWidth);
  });
}

function drawPinnedTextEffect(
  ctx: SceneCanvasContext,
  node: EvaluatedNode,
  text: string,
  time: number,
): boolean {
  const reference = node.metadata?.textEffectRef as {
    snapshot?: any;
  } | undefined;
  const snapshot = reference?.snapshot;
  if (!snapshot?.effectLayers || !snapshot.text || !snapshot.canvas) return false;

  const width = Math.max(1, Math.ceil(node.transform.width));
  const height = Math.max(1, Math.ceil(node.transform.height));
  const effectCanvas = typeof OffscreenCanvas !== "undefined"
    ? new OffscreenCanvas(width, height)
    : typeof document !== "undefined"
      ? Object.assign(document.createElement("canvas"), { width, height })
      : null;
  const effectCtx = effectCanvas?.getContext("2d") as SceneCanvasContext | null;
  if (!effectCtx) return false;

  const effectScene = JSON.parse(JSON.stringify(snapshot));
  effectScene.canvas.width = width;
  effectScene.canvas.height = height;
  effectScene.text.content = text;
  effectScene.text.fontFamily = node.style.fontFamily;
  effectScene.text.fontSize = node.style.fontSize;
  effectScene.text.fontWeight = node.style.fontWeight;
  effectScene.text.textPosX = "center";
  effectScene.text.textPosY = "middle";
  evaluateScene(effectScene, time, effectCtx as CanvasRenderingContext2D);
  ctx.drawImage(effectCanvas as CanvasImageSource, 0, 0, node.transform.width, node.transform.height);
  return true;
}

function drawNode(ctx: SceneCanvasContext, node: EvaluatedNode, time: number): void {
  if (!node.visible || node.style.opacity <= 0.001) return;
  const { x, y, width, height, rotation, scaleX, scaleY, translateX, translateY } = node.transform;
  const style = node.style;
  ctx.save();
  ctx.translate(x + width / 2 + translateX, y + height / 2 + translateY);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.scale(scaleX || 1, scaleY || 1);
  ctx.globalAlpha *= alpha(style.opacity);
  if (style.shadowColor || style.shadowBlur) {
    ctx.shadowColor = style.shadowColor ?? "rgba(0,0,0,0.5)";
    ctx.shadowBlur = style.shadowBlur ?? 0;
  }
  ctx.translate(-width / 2, -height / 2);

  if (style.fillGradient?.colors?.length) {
    const gradient = style.fillGradient.type === "radial"
      ? ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) / 2)
      : ctx.createLinearGradient(0, 0, width, height);
    style.fillGradient.colors.forEach((color, index) => gradient.addColorStop(index / Math.max(1, style.fillGradient!.colors.length - 1), color));
    ctx.fillStyle = gradient;
    ctx.globalAlpha *= alpha(style.fillOpacity);
    roundedRect(ctx, 0, 0, width, height, style.borderRadius ?? 0);
    ctx.fill();
  } else if (style.fillColor || node.type === "shape") {
    ctx.fillStyle = style.fillColor ?? "#334155";
    ctx.globalAlpha *= alpha(style.fillOpacity);
    roundedRect(ctx, 0, 0, width, height, style.borderRadius ?? 0);
    ctx.fill();
  }

  if (style.strokeColor && (style.strokeWidth ?? 0) > 0) {
    ctx.strokeStyle = style.strokeColor;
    ctx.lineWidth = style.strokeWidth ?? 1;
    roundedRect(ctx, 0, 0, width, height, style.borderRadius ?? 0);
    ctx.stroke();
  }

  if (node.type === "text" || node.type === "rich-text" || node.type === "metric" || node.type === "callout" || node.type === "annotation") {
    const text = node.content?.text ?? node.content?.formattedValue ?? node.content?.props?.body ?? node.content?.props?.label ?? "";
    if (text && !drawPinnedTextEffect(ctx, node, text, time)) drawText(ctx, node, text);
  } else if (node.type === "line" || node.type === "divider" || node.type === "connector") {
    ctx.strokeStyle = style.strokeColor ?? "#94a3b8";
    ctx.lineWidth = style.strokeWidth ?? 2;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
  } else if (node.type === "media" || node.type === "video" || node.type === "lottie") {
    ctx.fillStyle = "rgba(30,41,59,0.65)";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "rgba(148,163,184,0.65)";
    ctx.strokeRect(4, 4, Math.max(0, width - 8), Math.max(0, height - 8));
  }

  ctx.restore();
  node.children?.forEach((child) => drawNode(ctx, child, time));
}

/**
 * The renderer-neutral evaluated-scene raster contract used by overlays,
 * templates, thumbnails, and the native compositor bridge. It deliberately
 * accepts an already evaluated scene so playback never re-runs document
 * resolution or layout while pixels are being prepared.
 */
export function renderEvaluatedSceneToCanvas(
  scene: EvaluatedScene,
  ctx: SceneCanvasContext,
  options: { clear?: boolean; background?: boolean } = {},
): void {
  if (options.clear !== false) ctx.clearRect(0, 0, scene.canvas.width, scene.canvas.height);
  if (options.background !== false && scene.canvas.backgroundColor && scene.canvas.backgroundColor !== "transparent") {
    ctx.fillStyle = scene.canvas.backgroundColor;
    ctx.fillRect(0, 0, scene.canvas.width, scene.canvas.height);
  }
  scene.nodes.forEach((node) => drawNode(ctx, node, scene.time));
}
