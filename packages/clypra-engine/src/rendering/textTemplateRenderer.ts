import { compileTextTemplate } from "../textTemplates/compiler.js";
import { normalizeTextTemplateArtifact } from "../textTemplates/normalize.js";
import { TEXT_TEMPLATE_RENDERER_VERSION } from "../textTemplates/contract.js";
import type {
  CompiledTemplateRenderLayer,
  TemplateBackgroundPanel,
  TemplateTextNodeStyle,
  TextTemplateArtifact,
} from "../textTemplates/contract.js";
import { evaluateSplitTextTransforms, splitTextContent } from "../templates/textSplitter.js";
import type { TextSplitAnimator } from "../types.js";
import type {
  CanonicalRenderContext,
  CanonicalRenderResult,
  TextTemplateRenderInput,
} from "./types.js";

type CanvasLike = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function isObject(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === "object");
}

function isCanonicalArtifact(value: unknown): value is TextTemplateArtifact {
  return isObject(value) && value.kind === "text-template" && isObject(value.document) && Array.isArray(value.document.nodes);
}

function hasLegacyLayers(value: unknown): boolean {
  return isObject(value) && (Array.isArray(value.layers) || Array.isArray(value.elements));
}

/**
 * Resolve a template from all transport envelopes used by the app. This is
 * the only place where legacy `lottieData`/`elements` compatibility belongs.
 * Summary records intentionally return null: they are not renderable assets.
 */
export function resolveTextTemplateArtifact(input: unknown, options: { allowLegacy?: boolean } = {}): TextTemplateArtifact | null {
  if (!isObject(input)) return null;
  if (isCanonicalArtifact(input)) return normalizeTextTemplateArtifact(input);

  for (const key of ["templateData", "injectedData", "templateDefinition", "lottieData", "artifact", "snapshot"]) {
    const nested: unknown = input[key];
    if (nested && nested !== input) {
      const resolved = resolveTextTemplateArtifact(nested, options);
      if (resolved) return resolved;
    }
  }

  if (options.allowLegacy !== false && hasLegacyLayers(input)) return normalizeTextTemplateArtifact(input);
  return null;
}

export function getTextTemplateControls(input: unknown): TextTemplateArtifact["controls"] {
  return resolveTextTemplateArtifact(input)?.controls ?? [];
}

function finite(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function cssColor(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function roundedRect(ctx: CanvasLike, x: number, y: number, width: number, height: number, radius: number): void {
  const r = Math.max(0, Math.min(radius, Math.min(Math.abs(width), Math.abs(height)) / 2));
  if (r <= 0) {
    ctx.rect(x, y, width, height);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawPanel(ctx: CanvasLike, panel: TemplateBackgroundPanel, x: number, y: number, width: number, height: number): void {
  ctx.save();
  const left = finite(panel.paddingLeft, 0);
  const right = finite(panel.paddingRight, left);
  const top = finite(panel.paddingTop, 0);
  const bottom = finite(panel.paddingBottom, top);
  const px = x - left;
  const py = y - top;
  const pw = width + left + right;
  const ph = height + top + bottom;

  ctx.beginPath();
  roundedRect(ctx, px, py, pw, ph, finite(panel.borderRadius, 0));
  ctx.fillStyle = cssColor(panel.color, "#000000");
  ctx.globalAlpha *= Math.max(0, Math.min(1, finite(panel.opacity, 1)));
  ctx.fill();
  if (finite(panel.borderWidth, 0) > 0 && panel.borderColor) {
    ctx.lineWidth = finite(panel.borderWidth, 1);
    ctx.strokeStyle = cssColor(panel.borderColor, "#000000");
    ctx.stroke();
  }
  ctx.restore();
}

function letterSpacedText(ctx: CanvasLike, text: string, x: number, y: number, maxWidth: number, letterSpacing: number): void {
  if (!letterSpacing) {
    ctx.fillText(text, x, y, maxWidth);
    return;
  }
  const glyphs = Array.from(text);
  const widths = glyphs.map((glyph) => ctx.measureText(glyph).width);
  const total = widths.reduce((sum, value) => sum + value, 0) + Math.max(0, glyphs.length - 1) * letterSpacing;
  const align = ctx.textAlign;
  let cursor = x;
  if (align === "center") cursor -= total / 2;
  if (align === "right") cursor -= total;
  ctx.textAlign = "left";
  for (let index = 0; index < glyphs.length; index += 1) {
    ctx.fillText(glyphs[index], cursor, y);
    cursor += widths[index] + letterSpacing;
  }
  ctx.textAlign = align;
}

function letterSpacedStrokeText(
  ctx: CanvasLike,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  letterSpacing: number,
): void {
  if (!letterSpacing) {
    ctx.strokeText(text, x, y, maxWidth);
    return;
  }
  const glyphs = Array.from(text);
  const widths = glyphs.map((glyph) => ctx.measureText(glyph).width);
  const total = widths.reduce((sum, value) => sum + value, 0) + Math.max(0, glyphs.length - 1) * letterSpacing;
  const align = ctx.textAlign;
  let cursor = x;
  if (align === "center") cursor -= total / 2;
  if (align === "right") cursor -= total;
  ctx.textAlign = "left";
  for (let index = 0; index < glyphs.length; index += 1) {
    ctx.strokeText(glyphs[index], cursor, y);
    cursor += widths[index] + letterSpacing;
  }
  ctx.textAlign = align;
}

const FONT_ALIAS_MAP: Record<string, string> = {
  "inter": "Inter Variable",
  "inter variable": "Inter Variable",
  "outfit": "Outfit Variable",
  "outfit variable": "Outfit Variable",
  "playfair display": "Playfair Display Variable",
  "playfair display variable": "Playfair Display Variable",
  "montserrat": "Montserrat Variable",
  "montserrat variable": "Montserrat Variable",
  "roboto": "Roboto Variable",
  "roboto variable": "Roboto Variable",
  "roboto condensed": "Roboto Condensed Variable",
  "roboto condensed variable": "Roboto Condensed Variable",
  "raleway": "Raleway Variable",
  "raleway variable": "Raleway Variable",
  "space grotesk": "Space Grotesk Variable",
  "space grotesk variable": "Space Grotesk Variable",
  "nunito": "Nunito Variable",
  "nunito variable": "Nunito Variable",
  "open sans": "Open Sans Variable",
  "open sans variable": "Open Sans Variable",
  "oswald": "Oswald Variable",
  "oswald variable": "Oswald Variable",
  "geist": "Geist Variable",
  "geist variable": "Geist Variable",
  "dancing script": "Dancing Script Variable",
  "dancing script variable": "Dancing Script Variable",
};

export function resolveTemplateFontFamily(family?: string): string {
  if (!family) return "sans-serif";
  const clean = String(family).trim().replace(/^["']|["']$/g, "");
  const lower = clean.toLowerCase();
  return FONT_ALIAS_MAP[lower] || clean;
}

function constructFontStack(fontStyle: string | undefined, fontWeight: number | string | undefined, fontSize: number, rawFamily: string): string {
  const canonical = resolveTemplateFontFamily(rawFamily);
  const cleanRaw = String(rawFamily || "").trim().replace(/^["']|["']$/g, "");
  const style = fontStyle === "italic" ? "italic" : "normal";
  const weight = fontWeight ?? 400;
  if (canonical && cleanRaw && canonical.toLowerCase() !== cleanRaw.toLowerCase()) {
    return `${style} ${weight} ${fontSize}px "${canonical}", "${cleanRaw}", sans-serif`;
  }
  return `${style} ${weight} ${fontSize}px "${canonical || cleanRaw || 'sans-serif'}", sans-serif`;
}

function drawTextLayer(ctx: CanvasLike, layer: CompiledTemplateRenderLayer, style: TemplateTextNodeStyle): void {
  const text = layer.text ?? "";
  const fontSize = finite(style.fontSize, 48);
  const fontWeight = style.fontWeight ?? 400;
  const fontStyle = style.fontStyle || "normal";
  const rawFamily = String(style.fontFamily || "sans-serif").replace(/"/g, "");
  ctx.font = constructFontStack(fontStyle, fontWeight, fontSize, rawFamily);
  ctx.fillStyle = cssColor(style.textColor, "#FFFFFF");
  ctx.textAlign = style.textAlign ?? "left";
  ctx.textBaseline = style.verticalAlign === "top" ? "top" : style.verticalAlign === "bottom" ? "bottom" : "middle";

  const shadowColor = style.shadow?.color ?? style.shadowColor;
  const shadowBlur = finite(style.shadow?.blur ?? style.shadowBlur, 0);
  const shadowOffsetX = finite(style.shadow?.offsetX ?? style.shadowOffsetX, 0);
  const shadowOffsetY = finite(style.shadow?.offsetY ?? style.shadowOffsetY, 0);
  const hasShadow = !!shadowColor && (shadowBlur > 0 || shadowOffsetX !== 0 || shadowOffsetY !== 0);

  if (hasShadow) {
    ctx.shadowColor = cssColor(shadowColor, "#000000");
    ctx.shadowBlur = shadowBlur;
    ctx.shadowOffsetX = shadowOffsetX;
    ctx.shadowOffsetY = shadowOffsetY;
  }

  const lineHeight = fontSize * finite(style.lineHeight, 1.2);
  const maxWidth = Math.max(1, layer.width);
  const lines = style.overflow === "wrap" ? wrapText(ctx, text, maxWidth) : [text];
  const blockHeight = lines.length * lineHeight;
  const startY = style.verticalAlign === "top"
    ? layer.y
    : style.verticalAlign === "bottom"
      ? layer.y + layer.height - blockHeight + lineHeight
      : layer.y + (layer.height - blockHeight) / 2 + lineHeight / 2;
  const anchorX = style.textAlign === "center" ? layer.x + layer.width / 2 : style.textAlign === "right" ? layer.x + layer.width : layer.x;
  for (let index = 0; index < lines.length; index += 1) {
    letterSpacedText(ctx, lines[index], anchorX, startY + index * lineHeight, maxWidth, finite(style.letterSpacing, 0));
  }

  if (hasShadow) {
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  const strokeColor = style.stroke?.color ?? style.strokeColor;
  const strokeWidth = finite(style.stroke?.width ?? style.strokeWidth, 0);
  if (strokeWidth > 0 && strokeColor) {
    ctx.strokeStyle = cssColor(strokeColor, "#000000");
    ctx.lineWidth = strokeWidth;
    ctx.lineJoin = "round";
    for (let index = 0; index < lines.length; index += 1) {
      letterSpacedStrokeText(ctx, lines[index], anchorX, startY + index * lineHeight, maxWidth, finite(style.letterSpacing, 0));
    }
  }
}

function drawSplitTextLayer(
  ctx: CanvasLike,
  layer: CompiledTemplateRenderLayer,
  style: TemplateTextNodeStyle,
  animator: TextSplitAnimator,
  progress: number,
): void {
  const text = layer.text ?? "";
  const fontSize = finite(style.fontSize, 48);
  const fontWeight = style.fontWeight ?? 400;
  const fontStyle = style.fontStyle || "normal";
  const rawFamily = String(style.fontFamily || "sans-serif").replace(/"/g, "");
  ctx.font = constructFontStack(fontStyle, fontWeight, fontSize, rawFamily);
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = cssColor(style.textColor, "#FFFFFF");
  const units = splitTextContent(text, animator.splitBy);
  const transforms = evaluateSplitTextTransforms(units, animator, progress, "in");
  const lineHeight = fontSize * finite(style.lineHeight, 1.2);
  const fullWidth = ctx.measureText(text.split("\n")[0] ?? "").width;
  let cursorX = style.textAlign === "center" ? layer.x + (layer.width - fullWidth) / 2 : style.textAlign === "right" ? layer.x + layer.width - fullWidth : layer.x;
  let cursorY = layer.y + layer.height / 2;
  for (const item of transforms) {
    if (item.unit.text.includes("\n")) {
      cursorX = layer.x;
      cursorY += lineHeight;
      continue;
    }
    const advance = ctx.measureText(item.unit.text).width;
    ctx.save();
    ctx.globalAlpha *= Math.max(0, Math.min(1, item.opacity));
    if (item.blur > 0) ctx.filter = `blur(${item.blur}px)`;
    ctx.translate(cursorX + item.x, cursorY + item.y);
    ctx.rotate((item.rotation * Math.PI) / 180);
    ctx.scale(item.scaleX, item.scaleY);
    ctx.fillText(item.unit.text, 0, 0);
    ctx.restore();
    cursorX += advance + item.letterSpacingOffset;
  }
}

function wrapText(ctx: CanvasLike, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line || !lines.length) lines.push(line);
  return lines;
}

function drawLayer(ctx: CanvasLike, layer: CompiledTemplateRenderLayer): void {
  if (!layer.visible || layer.opacity <= 0) return;
  ctx.save();
  ctx.globalAlpha *= Math.max(0, Math.min(1, layer.opacity));
  if (layer.type === "shape") {
    const style = (layer.style ?? {}) as Record<string, unknown>;
    ctx.beginPath();
    roundedRect(ctx, layer.x, layer.y, layer.width, layer.height, finite(style.borderRadius, 0));
    ctx.fillStyle = cssColor(style.fillColor, "#000000");
    ctx.globalAlpha *= Math.max(0, Math.min(1, finite(style.fillOpacity, 1)));
    ctx.fill();
    if (finite(style.strokeWidth, 0) > 0 && style.strokeColor) {
      ctx.lineWidth = finite(style.strokeWidth, 1);
      ctx.strokeStyle = cssColor(style.strokeColor, "#000000");
      ctx.stroke();
    }
  } else if (layer.type === "container") {
    const style = (layer.style ?? {}) as Record<string, unknown>;
    if (style.backgroundColor) {
      ctx.beginPath();
      roundedRect(ctx, layer.x, layer.y, layer.width, layer.height, finite(style.borderRadius, 0));
      ctx.fillStyle = cssColor(style.backgroundColor, "#000000");
      ctx.globalAlpha *= Math.max(0, Math.min(1, finite(style.backgroundOpacity, 1)));
      ctx.fill();
    }
  } else if (layer.type === "text" || layer.type === "rich-text") {
    const style = (layer.style ?? {}) as unknown as TemplateTextNodeStyle;
    if (style && (layer.content as any)?.backgroundPanel) {
      drawPanel(ctx, (layer.content as any).backgroundPanel, layer.x, layer.y, layer.width, layer.height);
    }
    const splitAnimator = (layer.content as any)?.splitAnimator as TextSplitAnimator | undefined;
    if (splitAnimator) {
      drawSplitTextLayer(ctx, layer, style, splitAnimator, finite((layer.content as any)?.splitProgress, 1));
    } else {
      drawTextLayer(ctx, layer, style);
    }
  }
  ctx.restore();
}

export function renderTextTemplateToCanvas(
  ctx: CanvasLike,
  input: TextTemplateRenderInput,
): CanonicalRenderResult {
  const artifact = input.artifact;
  const runtime = {
    ...(input.context.runtime || {}),
    // Measure with the exact Canvas context that will draw the layer. This
    // makes auto-sized nodes use loaded font metrics instead of a fixed box.
    measureText: (text: string, style: TemplateTextNodeStyle) => {
      const rawFamily = String(style.fontFamily || "sans-serif").replace(/"/g, "");
      ctx.save();
      ctx.font = constructFontStack(style.fontStyle, style.fontWeight, finite(style.fontSize, 48), rawFamily);
      const width = ctx.measureText(text).width + Math.max(0, text.length - 1) * finite(style.letterSpacing, 0);
      ctx.restore();
      return { width };
    },
  };
  const compiled = compileTextTemplate(artifact, {
    time: input.context.time,
    target: input.context.environment === "preview" || input.context.environment === "thumbnail"
      ? "editor"
      : input.context.environment,
    clipDuration: input.context.clipDuration,
    controlValues: input.context.controlValues,
    runtime,
  });
  const outputWidth = finite(input.context.width, compiled.width);
  const outputHeight = finite(input.context.height, compiled.height);
  const scaleX = outputWidth / compiled.width;
  const scaleY = outputHeight / compiled.height;
  ctx.save();
  ctx.scale(scaleX, scaleY);
  if (artifact.document.canvas.backgroundColor) {
    ctx.fillStyle = artifact.document.canvas.backgroundColor;
    ctx.fillRect(0, 0, compiled.width, compiled.height);
  }
  for (const layer of compiled.layers) drawLayer(ctx, layer);
  ctx.restore();

  return {
    capability: "text-template",
    revisionId: compiled.revisionId,
    contentHash: compiled.contentHash,
    rendererVersion: artifact.revision.rendererVersion || TEXT_TEMPLATE_RENDERER_VERSION,
    diagnostics: compiled.diagnostics.map((diagnostic) => ({ ...diagnostic, capability: "text-template" as const })),
    usedDependencies: [
      ...artifact.dependencies.fonts.map((font) => `font:${font.family}:${font.weight ?? "normal"}`),
      ...artifact.dependencies.assets.map((asset) => `asset:${asset.id}:${asset.contentHash}`),
      ...artifact.dependencies.textEffects.map((effect) => `text-effect:${effect.effectId}:${effect.revisionId}:${effect.contentHash}`),
    ],
    compiledTemplate: compiled,
  };
}
