import {
  TextTemplate,
  TemplateLayer,
  TemplateTextLayer,
  TemplateShapeLayer,
  TemplateImageLayer,
  TemplateContainerLayer,
} from "../types";
import { evaluateAnimatable, cubicBezier } from "./keyframes";
import { wrapTextToWidth } from "../engine/textLayout";
import { resolveFontFamilyName } from "../engine/migrate";
import {
  evaluateTextTemplate,
  type RenderPlan,
  normalizeTextTemplate,
} from "../contracts";
import { evaluateScene } from "../engine/evaluate";
import {
  splitTextContent,
  evaluateSplitTextTransforms,
  getSpanForCharIndex,
  SplitUnit,
} from "./textSplitter";
import { resolveAnchorPosition } from "./responsiveLayout";

export { cubicBezier };

export interface AnimationState {
  opacity: number;
  x: number;
  y: number;
  scale: number;
  blur: number;
  typewriterProgress: number;
  letterSpacingOffset?: number;
}

export class TemplateRenderer {
  private template: TextTemplate;
  private editedValues: Map<string, Partial<TemplateLayer>>;
  private imageCache = new Map<string, any>(); // cache loaded images to prevent flickering
  private currentTime: number = 0; // Track current time for keyframe evaluation
  private lastLayerLayouts = new Map<
    string,
    { x: number; y: number; width: number; height: number }
  >();
  private computedFlexLayouts = new Map<
    string,
    { x: number; y: number; width: number; height: number }
  >();

  constructor(template: TextTemplate) {
    this.template = normalizeTextTemplate(template) as TextTemplate;
    this.editedValues = new Map();
  }

  /** Exposes the shared deterministic template evaluation contract. */
  getRenderPlan(time = this.currentTime): RenderPlan {
    return evaluateTextTemplate(this.template, time);
  }

  updateLayer(layerId: string, changes: Partial<TemplateLayer>): void {
    const existing = this.editedValues.get(layerId) ?? {};
    this.editedValues.set(layerId, {
      ...existing,
      ...changes,
    } as Partial<TemplateLayer>);
  }

  getLayerLayout(
    layerId: string,
  ): { x: number; y: number; width: number; height: number } | null {
    return this.lastLayerLayouts.get(layerId) ?? null;
  }

  // Merge default values with studio edits / customizations
  private resolveLayer(layer: TemplateLayer): TemplateLayer {
    const overrides = this.editedValues.get(layer.id) ?? {};
    return { ...layer, ...overrides } as TemplateLayer;
  }

  // Helper to evaluate animatable numeric-only properties (x, y) — always returns a number.
  private evaluateLayerProperty(layer: TemplateLayer, prop: "x" | "y"): number {
    const value = (layer as any)[prop];
    return evaluateAnimatable(value, this.currentTime, this.template.duration);
  }

  // For text layers: evaluate width or height, returning the raw value which may be "auto".
  private evaluateTextDimension(
    layer: TemplateTextLayer,
    prop: "width" | "height",
  ): number | "auto" {
    const value = layer[prop];
    if (value === "auto") return "auto";
    return evaluateAnimatable(
      value as any,
      this.currentTime,
      this.template.duration,
    );
  }

  // Compute animation parameters (transforms, opacity, scale, typewriter, etc.)
  private computeTransform(layer: TemplateLayer, time: number): AnimationState {
    const animation = layer.animation;
    const inEnd = animation.inDuration;
    const outStart = this.template.duration - animation.outDuration;

    if (time < inEnd && inEnd > 0) {
      const t = time / inEnd; // linear progress: 0 to 1
      return this.applyPreset(animation.in, t, "in");
    } else if (time > outStart && animation.outDuration > 0) {
      const t = (time - outStart) / animation.outDuration; // linear progress: 0 to 1
      return this.applyPreset(animation.out, t, "out");
    }

    // Default fully-held state
    return { opacity: 1, x: 0, y: 0, scale: 1, blur: 0, typewriterProgress: 1 };
  }

  private applyPreset(
    preset: string,
    t: number,
    direction: "in" | "out",
  ): AnimationState {
    // Material Standard Ease: cubicBezier(0.4, 0, 0.2, 1)
    const ease = cubicBezier(0.4, 0, 0.2, 1)(t);
    const p = direction === "in" ? ease : 1 - ease;

    let opacity = 1;
    let x = 0;
    let y = 0;
    let scale = 1;
    let blur = 0;
    let typewriterProgress = 1;

    switch (preset) {
      case "fade":
        opacity = p;
        break;
      case "slide-up":
        opacity = p;
        y = (1 - p) * 40;
        break;
      case "slide-down":
        opacity = p;
        y = (p - 1) * 40;
        break;
      case "slide-left":
        opacity = p;
        x = (1 - p) * 40;
        break;
      case "slide-right":
        opacity = p;
        x = (p - 1) * 40;
        break;
      case "scale-in":
        opacity = p;
        scale = 0.8 + p * 0.2;
        break;
      case "scale-out":
        opacity = p;
        scale = 1.2 - (1 - p) * 0.2;
        break;
      case "blur-in":
        opacity = p;
        blur = (1 - p) * 15;
        break;
      case "blur-out":
        opacity = p;
        blur = (1 - p) * 15;
        break;
      case "typewriter":
        typewriterProgress = p;
        break;
      case "3d-flip":
        opacity = p;
        scale = 0.6 + p * 0.4;
        y = (1 - p) * 25;
        break;
      case "scale-pop":
        opacity = p;
        scale = p < 0.7 ? (p / 0.7) * 1.15 : 1.15 - ((p - 0.7) / 0.3) * 0.15;
        break;
      case "track-in":
        opacity = p;
        blur = (1 - p) * 8;
        break;
      case "wave":
        opacity = p;
        y = Math.sin(p * Math.PI) * -15;
        break;
      case "glitch":
        opacity = p > 0.05 ? 1 : 0;
        x = Math.sin(p * 25) * 6 * (1 - p);
        break;
      case "none":
      default:
        break;
    }

    return { opacity, x, y, scale, blur, typewriterProgress };
  }

  /** Resolve dynamic {{variable}} tokens in string content */
  private resolveDynamicContent(rawContent: string): string {
    if (!rawContent || !rawContent.includes("{{")) return rawContent;
    const vars = this.template.variables || {};
    return rawContent.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
      const trimmed = key.trim();
      const override = (this.template as any).variableValues?.[trimmed];
      if (override !== undefined) return String(override);
      const def = vars[trimmed];
      if (def && def.defaultValue !== undefined)
        return String(def.defaultValue);
      return `{{${trimmed}}}`;
    });
  }

  drawFrame(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    time: number,
    fitToContentOrOpts:
      | boolean
      | { fitToContent?: boolean; skipClear?: boolean } = false,
  ): void {
    const fitToContent =
      typeof fitToContentOrOpts === "boolean"
        ? fitToContentOrOpts
        : !!fitToContentOrOpts?.fitToContent;
    const skipClear =
      typeof fitToContentOrOpts === "object"
        ? !!fitToContentOrOpts?.skipClear
        : false;

    this.currentTime = time; // Track current time for keyframe evaluation

    if (fitToContent) {
      // If we don't have layouts yet, draw once to populate them
      const hasLayouts = this.lastLayerLayouts.size > 0;
      if (!hasLayouts) {
        this.drawLayers(ctx, time);
      }

      const bounds = this.getContentBounds();
      if (bounds && bounds.width > 0 && bounds.height > 0) {
        if (!skipClear) {
          ctx.clearRect(
            0,
            0,
            this.template.canvasWidth,
            this.template.canvasHeight,
          );
        }
        ctx.save();

        const padding = 0.85; // 15% margin
        const scale =
          Math.min(
            this.template.canvasWidth / bounds.width,
            this.template.canvasHeight / bounds.height,
          ) * padding;

        // Limit maximum scale to 3.0 to prevent pixelation of very small text
        const finalScale = Math.min(3.0, scale);

        const cx = bounds.x + bounds.width / 2;
        const cy = bounds.y + bounds.height / 2;

        ctx.translate(
          this.template.canvasWidth / 2,
          this.template.canvasHeight / 2,
        );
        ctx.scale(finalScale, finalScale);
        ctx.translate(-cx, -cy);

        this.drawLayers(ctx, time);

        ctx.restore();
        return;
      }
    }

    // Default normal draw
    if (!skipClear) {
      ctx.clearRect(
        0,
        0,
        this.template.canvasWidth,
        this.template.canvasHeight,
      );
    }
    this.drawLayers(ctx, time);
  }

  getContentBounds(): {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null {
    if (this.lastLayerLayouts.size === 0) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    // Only include visible text layers for content bounds calculation
    // Shape and image layers are often decorative backgrounds that inflate the bounds
    let hasTextLayers = false;

    for (const [layerId, layout] of this.lastLayerLayouts.entries()) {
      // Find the layer to check its kind
      const layer = this.template?.layers?.find((l) => l.id === layerId);
      if (layer && layer.visible === false) continue;

      // Only include text layers in content bounds
      if (layer && layer.kind === "text") {
        hasTextLayers = true;
        minX = Math.min(minX, layout.x);
        minY = Math.min(minY, layout.y);
        maxX = Math.max(maxX, layout.x + layout.width);
        maxY = Math.max(maxY, layout.y + layout.height);
      }
    }

    // Fallback: if no text layers, include all layers
    if (!hasTextLayers) {
      for (const layout of this.lastLayerLayouts.values()) {
        minX = Math.min(minX, layout.x);
        minY = Math.min(minY, layout.y);
        maxX = Math.max(maxX, layout.x + layout.width);
        maxY = Math.max(maxY, layout.y + layout.height);
      }
    }

    if (minX === Infinity || minY === Infinity) return null;

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  private computeFlexLayouts(time: number): void {
    this.computedFlexLayouts.clear();
    if (!this.template || !Array.isArray(this.template.layers)) return;

    const layers = this.template.layers.map((l) => this.resolveLayer(l));
    const containers = layers.filter(
      (l) => l.kind === "container",
    ) as TemplateContainerLayer[];
    if (containers.length === 0) return;

    // Measure intrinsic bounds for non-container layers
    const measuredBounds = new Map<string, { width: number; height: number }>();

    for (const layer of layers) {
      if (layer.kind === "text") {
        const textLayer = layer as TemplateTextLayer;
        const rawW = this.evaluateTextDimension(textLayer, "width");
        const rawH = this.evaluateTextDimension(textLayer, "height");
        const fontSize =
          Number(
            evaluateAnimatable(
              textLayer.fontSize,
              this.currentTime,
              this.template.duration,
            ),
          ) || 48;
        const fontWeight =
          evaluateAnimatable(
            textLayer.fontWeight,
            this.currentTime,
            this.template.duration,
          ) || 400;
        const rawFontFamily = textLayer.fontFamily || "Space Grotesk";
        const fontFamily = resolveFontFamilyName(rawFontFamily);
        const legacyPad =
          Number(
            evaluateAnimatable(
              textLayer.padding ?? 0,
              this.currentTime,
              this.template.duration,
            ),
          ) || 0;
        const padL =
          Number(
            evaluateAnimatable(
              textLayer.paddingLeft ?? legacyPad,
              this.currentTime,
              this.template.duration,
            ),
          ) || 0;
        const padR =
          Number(
            evaluateAnimatable(
              textLayer.paddingRight ?? legacyPad,
              this.currentTime,
              this.template.duration,
            ),
          ) || 0;
        const padT =
          Number(
            evaluateAnimatable(
              textLayer.paddingTop ?? legacyPad,
              this.currentTime,
              this.template.duration,
            ),
          ) || 0;
        const padB =
          Number(
            evaluateAnimatable(
              textLayer.paddingBottom ?? legacyPad,
              this.currentTime,
              this.template.duration,
            ),
          ) || 0;
        const text = this.resolveDynamicContent(textLayer.content || "");
        const lines = text.split("\n");

        let textW = 0;
        if (typeof document !== "undefined") {
          const mCanvas = document.createElement("canvas");
          const mCtx = mCanvas.getContext("2d");
          if (mCtx) {
            mCtx.font = `${fontWeight} ${fontSize}px "${fontFamily}", "${rawFontFamily}", sans-serif`;
            textW = Math.max(
              ...lines.map((l) => mCtx.measureText(l || "Ag").width),
              20,
            );
          }
        }
        if (!textW) {
          const charFactor = Number(fontWeight) >= 600 ? 0.72 : 0.65;
          textW = Math.max(
            ...lines.map((l) => l.length * fontSize * charFactor),
            20,
          );
        }

        const lineHeightMultiplier =
          Number(
            evaluateAnimatable(
              textLayer.lineHeight,
              this.currentTime,
              this.template.duration,
            ),
          ) || 1.25;
        const lineAdvance = fontSize * lineHeightMultiplier;
        const textH =
          lines.length === 1
            ? fontSize * 1.2
            : fontSize * 1.0 + (lines.length - 1) * lineAdvance;
        const isAutoOrBox =
          rawW === "auto" ||
          textLayer.overflow === "expand-panel" ||
          (textLayer.backgroundColor !== undefined &&
            textLayer.backgroundColor !== null);

        const w = isAutoOrBox ? textW + padL + padR : Number(rawW);
        const h = rawH === "auto" ? textH + padT + padB : Number(rawH);
        measuredBounds.set(layer.id, { width: w, height: h });
      } else if (layer.kind === "shape" || layer.kind === "image") {
        const w =
          Number(
            evaluateAnimatable(
              (layer as any).width,
              this.currentTime,
              this.template.duration,
            ),
          ) || 100;
        const h =
          Number(
            evaluateAnimatable(
              (layer as any).height,
              this.currentTime,
              this.template.duration,
            ),
          ) || 100;
        measuredBounds.set(layer.id, { width: w, height: h });
      }
    }

    for (const container of containers) {
      const children = layers.filter(
        (l) => l.parentId === container.id && l.visible !== false,
      );
      const layout = container.layout || {
        type: "flex",
        direction: "column",
        gap: 0,
        alignItems: "start",
        justifyContent: "start",
      };
      const direction = layout.direction || "column";
      const gap =
        Number(
          evaluateAnimatable(
            layout.gap,
            this.currentTime,
            this.template.duration,
          ),
        ) || 0;
      const padTop =
        Number(
          evaluateAnimatable(
            layout.paddingTop,
            this.currentTime,
            this.template.duration,
          ),
        ) || 0;
      const padRight =
        Number(
          evaluateAnimatable(
            layout.paddingRight,
            this.currentTime,
            this.template.duration,
          ),
        ) || 0;
      const padBottom =
        Number(
          evaluateAnimatable(
            layout.paddingBottom,
            this.currentTime,
            this.template.duration,
          ),
        ) || 0;
      const padLeft =
        Number(
          evaluateAnimatable(
            layout.paddingLeft,
            this.currentTime,
            this.template.duration,
          ),
        ) || 0;
      const alignItems = layout.alignItems || "center";

      const containerX =
        Number(
          evaluateAnimatable(
            container.x,
            this.currentTime,
            this.template.duration,
          ),
        ) || 0;
      const containerY =
        Number(
          evaluateAnimatable(
            container.y,
            this.currentTime,
            this.template.duration,
          ),
        ) || 0;

      if (direction === "column") {
        let totalChildHeight = 0;
        let maxChildWidth = 0;
        const childSizes: { id: string; width: number; height: number }[] = [];

        for (const child of children) {
          const sz = measuredBounds.get(child.id) || { width: 100, height: 50 };
          childSizes.push({ id: child.id, width: sz.width, height: sz.height });
          totalChildHeight += sz.height;
          maxChildWidth = Math.max(maxChildWidth, sz.width);
        }
        if (children.length > 1) {
          totalChildHeight += (children.length - 1) * gap;
        }

        const rawContainerW = container.width;
        const rawContainerH = container.height;
        const declaredW =
          rawContainerW === "auto" || !rawContainerW
            ? 0
            : Number(
                evaluateAnimatable(
                  rawContainerW,
                  this.currentTime,
                  this.template.duration,
                ),
              ) || 0;
        const declaredH =
          rawContainerH === "auto" || !rawContainerH
            ? 0
            : Number(
                evaluateAnimatable(
                  rawContainerH,
                  this.currentTime,
                  this.template.duration,
                ),
              ) || 0;

        // Container dynamically hugs all child bounds with full padding (with declared size acting as minimum if set)
        const containerW = Math.max(
          declaredW,
          maxChildWidth + padLeft + padRight,
        );
        const containerH = Math.max(
          declaredH,
          totalChildHeight + padTop + padBottom,
        );

        this.computedFlexLayouts.set(container.id, {
          x: containerX,
          y: containerY,
          width: containerW,
          height: containerH,
        });

        let currentY = containerY + padTop;
        const innerW = Math.max(0, containerW - padLeft - padRight);

        for (const child of childSizes) {
          let childW = child.width;

          let childX = containerX + padLeft;
          if (alignItems === "center") {
            childX = containerX + padLeft + (innerW - childW) / 2;
          } else if (alignItems === "end") {
            childX = containerX + padLeft + (innerW - childW);
          } else if (alignItems === "stretch") {
            childW = innerW;
          }

          this.computedFlexLayouts.set(child.id, {
            x: childX,
            y: currentY,
            width: childW,
            height: child.height,
          });

          currentY += child.height + gap;
        }
      } else {
        // Row direction
        let totalChildWidth = 0;
        let maxChildHeight = 0;
        const childSizes: { id: string; width: number; height: number }[] = [];

        for (const child of children) {
          const sz = measuredBounds.get(child.id) || { width: 100, height: 50 };
          childSizes.push({ id: child.id, width: sz.width, height: sz.height });
          totalChildWidth += sz.width;
          maxChildHeight = Math.max(maxChildHeight, sz.height);
        }
        if (children.length > 1) {
          totalChildWidth += (children.length - 1) * gap;
        }

        const rawContainerW = container.width;
        const rawContainerH = container.height;
        const declaredW =
          rawContainerW === "auto" || !rawContainerW
            ? 0
            : Number(
                evaluateAnimatable(
                  rawContainerW,
                  this.currentTime,
                  this.template.duration,
                ),
              ) || 0;
        const declaredH =
          rawContainerH === "auto" || !rawContainerH
            ? 0
            : Number(
                evaluateAnimatable(
                  rawContainerH,
                  this.currentTime,
                  this.template.duration,
                ),
              ) || 0;

        const containerW = Math.max(
          declaredW,
          totalChildWidth + padLeft + padRight,
        );
        const containerH = Math.max(
          declaredH,
          maxChildHeight + padTop + padBottom,
        );

        this.computedFlexLayouts.set(container.id, {
          x: containerX,
          y: containerY,
          width: containerW,
          height: containerH,
        });

        let currentX = containerX + padLeft;
        const innerH = Math.max(0, containerH - padTop - padBottom);

        for (const child of childSizes) {
          let childH = child.height;
          let childY = containerY + padTop;
          if (alignItems === "center") {
            childY = containerY + padTop + (innerH - childH) / 2;
          } else if (alignItems === "end") {
            childY = containerY + padTop + (innerH - childH);
          } else if (alignItems === "stretch") {
            childH = innerH;
          }

          this.computedFlexLayouts.set(child.id, {
            x: currentX,
            y: childY,
            width: child.width,
            height: childH,
          });

          currentX += child.width + gap;
        }
      }
    }
  }

  private drawContainerLayer(
    ctx: CanvasRenderingContext2D,
    layer: TemplateContainerLayer,
  ): void {
    const resolved = layer;
    const layout = this.computedFlexLayouts.get(resolved.id);
    const x =
      layout?.x ??
      (Number(
        evaluateAnimatable(
          resolved.x,
          this.currentTime,
          this.template.duration,
        ),
      ) ||
        0);
    const y =
      layout?.y ??
      (Number(
        evaluateAnimatable(
          resolved.y,
          this.currentTime,
          this.template.duration,
        ),
      ) ||
        0);
    const width =
      layout?.width ??
      (resolved.width === "auto"
        ? 400
        : Number(
            evaluateAnimatable(
              resolved.width,
              this.currentTime,
              this.template.duration,
            ),
          ) || 400);
    const height =
      layout?.height ??
      (resolved.height === "auto"
        ? 200
        : Number(
            evaluateAnimatable(
              resolved.height,
              this.currentTime,
              this.template.duration,
            ),
          ) || 200);

    this.lastLayerLayouts.set(resolved.id, { x, y, width, height });

    const bgColor = resolved.backgroundColor
      ? evaluateAnimatable(
          resolved.backgroundColor,
          this.currentTime,
          this.template.duration,
        )
      : null;
    const bgOpacity =
      resolved.backgroundOpacity !== undefined
        ? Number(
            evaluateAnimatable(
              resolved.backgroundOpacity,
              this.currentTime,
              this.template.duration,
            ),
          )
        : 1;
    const bgRadius =
      resolved.backgroundRadius !== undefined
        ? Number(
            evaluateAnimatable(
              resolved.backgroundRadius,
              this.currentTime,
              this.template.duration,
            ),
          )
        : 0;
    const borderColor = resolved.backgroundBorderColor
      ? evaluateAnimatable(
          resolved.backgroundBorderColor,
          this.currentTime,
          this.template.duration,
        )
      : null;
    const borderWidth =
      resolved.backgroundBorderWidth !== undefined
        ? Number(
            evaluateAnimatable(
              resolved.backgroundBorderWidth,
              this.currentTime,
              this.template.duration,
            ),
          )
        : 0;

    if (bgColor || (borderColor && borderWidth > 0)) {
      const currentAlpha = ctx.globalAlpha;
      ctx.save();
      ctx.globalAlpha = currentAlpha * bgOpacity;

      ctx.beginPath();
      if (bgRadius > 0) {
        ctx.moveTo(x + bgRadius, y);
        ctx.lineTo(x + width - bgRadius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + bgRadius);
        ctx.lineTo(x + width, y + height - bgRadius);
        ctx.quadraticCurveTo(
          x + width,
          y + height,
          x + width - bgRadius,
          y + height,
        );
        ctx.lineTo(x + bgRadius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - bgRadius);
        ctx.lineTo(x, y + bgRadius);
        ctx.quadraticCurveTo(x, y, x + bgRadius, y);
      } else {
        ctx.rect(x, y, width, height);
      }
      ctx.closePath();

      if (bgColor) {
        ctx.fillStyle = bgColor;
        ctx.fill();
      }

      if (borderColor && borderWidth > 0) {
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = borderWidth;
        ctx.globalAlpha = currentAlpha;
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  private drawLayers(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    time: number,
  ): void {
    if (!this.template || !Array.isArray(this.template.layers)) return;
    this.lastLayerLayouts.clear();
    this.computeFlexLayouts(time);

    for (const layer of this.template.layers) {
      const resolved = this.resolveLayer(layer);
      if (resolved.visible === false) continue;
      const transform = this.computeTransform(resolved, time);

      // Evaluate layer opacity
      const layerOpacity =
        (resolved as any).opacity !== undefined
          ? evaluateAnimatable(
              (resolved as any).opacity,
              this.currentTime,
              this.template.duration,
            )
          : 1;

      ctx.save();
      ctx.globalAlpha = transform.opacity * layerOpacity; // Combine animation and layer opacity

      // Evaluate position and size for transform center calculation.
      const flexLayout = this.computedFlexLayouts.get(resolved.id);
      const x = flexLayout?.x ?? this.evaluateLayerProperty(resolved, "x");
      const y = flexLayout?.y ?? this.evaluateLayerProperty(resolved, "y");

      let cx: number;
      let cy: number;

      if (resolved.kind === "text") {
        const textLayer = resolved as TemplateTextLayer;
        const rawW =
          flexLayout?.width ?? this.evaluateTextDimension(textLayer, "width");
        const rawH =
          flexLayout?.height ?? this.evaluateTextDimension(textLayer, "height");
        // For auto dims use the layer origin as pivot (scale from top-left corner).
        cx = rawW === "auto" ? x : x + (rawW as number) / 2;
        cy = rawH === "auto" ? y : y + (rawH as number) / 2;
      } else {
        const width =
          flexLayout?.width ??
          (evaluateAnimatable(
            (resolved as any).width,
            this.currentTime,
            this.template.duration,
          ) as number);
        const height =
          flexLayout?.height ??
          (evaluateAnimatable(
            (resolved as any).height,
            this.currentTime,
            this.template.duration,
          ) as number);
        cx = x + width / 2;
        cy = y + height / 2;
      }

      // Apply transforms
      ctx.translate(cx + transform.x, cy + transform.y);
      ctx.scale(transform.scale, transform.scale);
      // Translate back to origin of layer
      ctx.translate(-cx, -cy);

      if (transform.blur > 0 && "filter" in ctx) {
        ctx.filter = `blur(${transform.blur}px)`;
      }

      if (resolved.kind === "text") {
        this.drawTextLayer(
          ctx as CanvasRenderingContext2D,
          resolved as TemplateTextLayer,
          transform,
        );
      } else if (resolved.kind === "shape") {
        this.drawShapeLayer(
          ctx as CanvasRenderingContext2D,
          resolved as TemplateShapeLayer,
        );
      } else if (resolved.kind === "image") {
        this.drawImageLayer(
          ctx as CanvasRenderingContext2D,
          resolved as TemplateImageLayer,
        );
      } else if (resolved.kind === "container") {
        this.drawContainerLayer(
          ctx as CanvasRenderingContext2D,
          resolved as TemplateContainerLayer,
        );
      }

      ctx.restore();
    }
  }

  private drawTextLayer(
    ctx: CanvasRenderingContext2D,
    layer: TemplateTextLayer,
    transform: AnimationState,
  ): void {
    const resolved = layer;
    // Resolve dynamic variables in text content
    const rawContent = resolved.content;
    const content = this.resolveDynamicContent(rawContent);

    const rawFontFamily = resolved.fontFamily;
    const fontFamily = resolveFontFamilyName(rawFontFamily);
    const fontSize = evaluateAnimatable(
      resolved.fontSize,
      this.currentTime,
      this.template.duration,
    );
    const fontWeight = evaluateAnimatable(
      resolved.fontWeight,
      this.currentTime,
      this.template.duration,
    );
    const color = evaluateAnimatable(
      resolved.color,
      this.currentTime,
      this.template.duration,
    );
    const align = resolved.align;
    const flexLayout = this.computedFlexLayouts.get(resolved.id);
    const x =
      flexLayout?.x ??
      evaluateAnimatable(resolved.x, this.currentTime, this.template.duration);
    const y =
      flexLayout?.y ??
      evaluateAnimatable(resolved.y, this.currentTime, this.template.duration);

    // width / height may be "auto" — defer resolution until after ctx.font is set.
    const rawWidth =
      flexLayout?.width ?? this.evaluateTextDimension(resolved, "width");
    const rawHeight =
      flexLayout?.height ?? this.evaluateTextDimension(resolved, "height");

    // Evaluate background properties if present
    const backgroundColor = resolved.backgroundColor
      ? evaluateAnimatable(
          resolved.backgroundColor,
          this.currentTime,
          this.template.duration,
        )
      : null;
    const backgroundOpacity =
      resolved.backgroundOpacity !== undefined
        ? evaluateAnimatable(
            resolved.backgroundOpacity,
            this.currentTime,
            this.template.duration,
          )
        : 1;
    const backgroundRadius =
      resolved.backgroundRadius !== undefined
        ? evaluateAnimatable(
            resolved.backgroundRadius,
            this.currentTime,
            this.template.duration,
          )
        : 0;
    const backgroundBorderColor = resolved.backgroundBorderColor
      ? evaluateAnimatable(
          resolved.backgroundBorderColor,
          this.currentTime,
          this.template.duration,
        )
      : null;
    const backgroundBorderWidth =
      resolved.backgroundBorderWidth !== undefined
        ? evaluateAnimatable(
            resolved.backgroundBorderWidth,
            this.currentTime,
            this.template.duration,
          )
        : 0;

    // Resolve per-side padding — individual sides take priority; fall back to legacy `padding`
    const legacyPadding =
      resolved.padding !== undefined
        ? evaluateAnimatable(
            resolved.padding,
            this.currentTime,
            this.template.duration,
          )
        : 0;
    const pt =
      resolved.paddingTop !== undefined
        ? evaluateAnimatable(
            resolved.paddingTop,
            this.currentTime,
            this.template.duration,
          )
        : legacyPadding;
    const pr =
      resolved.paddingRight !== undefined
        ? evaluateAnimatable(
            resolved.paddingRight,
            this.currentTime,
            this.template.duration,
          )
        : legacyPadding;
    const pb =
      resolved.paddingBottom !== undefined
        ? evaluateAnimatable(
            resolved.paddingBottom,
            this.currentTime,
            this.template.duration,
          )
        : legacyPadding;
    const pl =
      resolved.paddingLeft !== undefined
        ? evaluateAnimatable(
            resolved.paddingLeft,
            this.currentTime,
            this.template.duration,
          )
        : legacyPadding;

    const overflow = resolved.overflow;
    const verticalAlign = resolved.verticalAlign || "middle";

    // Slice characters for typewriter animations
    const visibleCharsCount = Math.floor(
      transform.typewriterProgress * content.length,
    );
    const textToDraw = content.slice(0, visibleCharsCount);

    ctx.save();
    ctx.font = `${fontWeight} ${fontSize}px "${fontFamily}", "${rawFontFamily}", sans-serif`;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = align;

    // ── Resolve "auto" dimensions after ctx.font is set so measureText is accurate ──
    let adjustedFontSize = fontSize;
    const lineHeightMultiplier =
      Number(
        evaluateAnimatable(
          resolved.lineHeight,
          this.currentTime,
          this.template.duration,
        ),
      ) || 1.25;
    const rawLines = textToDraw.split("\n");
    let lines = rawLines;

    const maxLineTextWidth = Math.max(
      ...rawLines.map((l) => ctx.measureText(l || "Ag").width),
      20,
    );
    let resolvedWidth: number;
    if (
      rawWidth === "auto" ||
      overflow === "expand-panel" ||
      (backgroundColor && !rawWidth)
    ) {
      resolvedWidth = maxLineTextWidth + pl + pr;
    } else if (flexLayout) {
      resolvedWidth =
        overflow === "shrink" || overflow === "wrap"
          ? flexLayout.width
          : Math.max(flexLayout.width, maxLineTextWidth + pl + pr);
    } else {
      resolvedWidth = rawWidth as number;
    }

    const contentW = Math.max(0, resolvedWidth - pl - pr);

    if (overflow === "shrink") {
      let scale =
        maxLineTextWidth > contentW && contentW > 0
          ? contentW / maxLineTextWidth
          : 1;
      if (rawHeight !== "auto") {
        const declaredContentH = Math.max(0, (rawHeight as number) - pt - pb);
        const singleLineH = fontSize * 1.0;
        if (singleLineH * scale > declaredContentH && declaredContentH > 0) {
          scale = Math.min(scale, declaredContentH / singleLineH);
        }
      }
      if (scale < 1) {
        adjustedFontSize = fontSize * scale;
        ctx.font = `${fontWeight} ${adjustedFontSize}px "${fontFamily}", "${rawFontFamily}", sans-serif`;
      }
    } else if (overflow === "wrap" && contentW > 0) {
      lines = [];
      for (const rLine of rawLines) {
        lines.push(...wrapTextToWidth(ctx, rLine, contentW, 0));
      }
    } else if (overflow === "expand-panel") {
      resolvedWidth = maxLineTextWidth + pl + pr;
    }

    const lineAdvance = adjustedFontSize * lineHeightMultiplier;
    const sampleMetrics = ctx.measureText(lines[0] || "Ag");
    const ascent =
      sampleMetrics.actualBoundingBoxAscent ?? adjustedFontSize * 0.8;
    const descent =
      sampleMetrics.actualBoundingBoxDescent ?? adjustedFontSize * 0.2;
    const inkLineH = ascent + descent;
    const totalInkH =
      lines.length === 1
        ? inkLineH
        : inkLineH + (lines.length - 1) * lineAdvance;

    let resolvedHeight: number;
    if (rawHeight === "auto") {
      resolvedHeight = totalInkH + pt + pb;
    } else {
      resolvedHeight = rawHeight as number;
    }

    let bgX = x;
    let bgY = y;
    let bgWidth = resolvedWidth;
    let bgHeight = resolvedHeight;

    if (overflow === "expand-panel" || rawWidth === "auto") {
      if (align === "center") {
        bgX =
          rawWidth === "auto" ? x : x + (rawWidth as number) / 2 - bgWidth / 2;
      } else if (align === "right") {
        bgX = rawWidth === "auto" ? x : x + (rawWidth as number) - bgWidth;
      } else {
        bgX = x;
      }
    }

    // Apply Responsive 9-point spatial anchor if configured
    if (resolved.anchor) {
      const anchored = resolveAnchorPosition(
        resolved.anchor,
        { x: bgX, y: bgY, width: bgWidth, height: bgHeight },
        this.template.canvasWidth,
        this.template.canvasHeight,
      );
      bgX = anchored.x;
      bgY = anchored.y;
      bgWidth = anchored.width;
      bgHeight = anchored.height;
    }

    this.lastLayerLayouts.set(resolved.id, {
      x: bgX,
      y: bgY,
      width: bgWidth,
      height: bgHeight,
    });

    // A pinned effect owns its own bleed (glow/shadow/stroke).
    const styleRef = (resolved as any).styleRef;
    if (styleRef?.snapshot?.effectLayers) {
      const effectCanvas =
        typeof OffscreenCanvas !== "undefined"
          ? new OffscreenCanvas(
              Math.max(1, Math.ceil(bgWidth)),
              Math.max(1, Math.ceil(bgHeight)),
            )
          : typeof document !== "undefined"
          ? Object.assign(document.createElement("canvas"), {
              width: Math.max(1, Math.ceil(bgWidth)),
              height: Math.max(1, Math.ceil(bgHeight)),
            })
          : null;
      const effectCtx = effectCanvas?.getContext("2d") as
        | CanvasRenderingContext2D
        | OffscreenCanvasRenderingContext2D
        | null;
      if (effectCtx) {
        const effectScene = JSON.parse(JSON.stringify(styleRef.snapshot));
        effectScene.canvas.width = Math.max(1, Math.ceil(bgWidth));
        effectScene.canvas.height = Math.max(1, Math.ceil(bgHeight));
        effectScene.text.content = textToDraw;
        effectScene.text.fontFamily = rawFontFamily;
        effectScene.text.fontSize = adjustedFontSize;
        effectScene.text.fontWeight = fontWeight;
        effectScene.text.textPosX = "center";
        effectScene.text.textPosY = "middle";
        evaluateScene(effectScene, this.currentTime, effectCtx);
        ctx.drawImage(
          effectCanvas as CanvasImageSource,
          bgX,
          bgY,
          bgWidth,
          bgHeight,
        );
        ctx.restore();
        return;
      }
    }

    // Content area (where text lives)
    let contentX = bgX + pl;
    let contentY = bgY + pt;
    let contentH = Math.max(0, bgHeight - pt - pb);

    ctx.save();

    // Explicit clip only if overflow === 'clip'
    if (overflow === "clip") {
      ctx.beginPath();
      if (backgroundRadius > 0) {
        ctx.moveTo(bgX + backgroundRadius, bgY);
        ctx.lineTo(bgX + bgWidth - backgroundRadius, bgY);
        ctx.quadraticCurveTo(
          bgX + bgWidth,
          bgY,
          bgX + bgWidth,
          bgY + backgroundRadius,
        );
        ctx.lineTo(bgX + bgWidth, bgY + bgHeight - backgroundRadius);
        ctx.quadraticCurveTo(
          bgX + bgWidth,
          bgY + bgHeight,
          bgX + bgWidth - backgroundRadius,
          bgY + bgHeight,
        );
        ctx.lineTo(bgX + backgroundRadius, bgY + bgHeight);
        ctx.quadraticCurveTo(
          bgX,
          bgY + bgHeight,
          bgX,
          bgY + bgHeight - backgroundRadius,
        );
        ctx.lineTo(bgX, bgY + backgroundRadius);
        ctx.quadraticCurveTo(bgX, bgY, bgX + backgroundRadius, bgY);
      } else {
        ctx.rect(bgX, bgY, bgWidth, bgHeight);
      }
      ctx.closePath();
      ctx.clip();
    }

    // Draw background panel
    if (backgroundColor) {
      const currentAlpha = ctx.globalAlpha;
      ctx.save();
      ctx.fillStyle = backgroundColor;
      ctx.globalAlpha = currentAlpha * backgroundOpacity;

      if (backgroundRadius > 0) {
        ctx.beginPath();
        ctx.moveTo(bgX + backgroundRadius, bgY);
        ctx.lineTo(bgX + bgWidth - backgroundRadius, bgY);
        ctx.quadraticCurveTo(
          bgX + bgWidth,
          bgY,
          bgX + bgWidth,
          bgY + backgroundRadius,
        );
        ctx.lineTo(bgX + bgWidth, bgY + bgHeight - backgroundRadius);
        ctx.quadraticCurveTo(
          bgX + bgWidth,
          bgY + bgHeight,
          bgX + bgWidth - backgroundRadius,
          bgY + bgHeight,
        );
        ctx.lineTo(bgX + backgroundRadius, bgY + bgHeight);
        ctx.quadraticCurveTo(
          bgX,
          bgY + bgHeight,
          bgX,
          bgY + bgHeight - backgroundRadius,
        );
        ctx.lineTo(bgX, bgY + backgroundRadius);
        ctx.quadraticCurveTo(bgX, bgY, bgX + backgroundRadius, bgY);
        ctx.closePath();
        ctx.fill();
        if (backgroundBorderColor && backgroundBorderWidth > 0) {
          ctx.strokeStyle = backgroundBorderColor;
          ctx.lineWidth = backgroundBorderWidth;
          ctx.globalAlpha = currentAlpha;
          ctx.stroke();
        }
      } else {
        ctx.fillRect(bgX, bgY, bgWidth, bgHeight);
        if (backgroundBorderColor && backgroundBorderWidth > 0) {
          ctx.strokeStyle = backgroundBorderColor;
          ctx.lineWidth = backgroundBorderWidth;
          ctx.globalAlpha = currentAlpha;
          ctx.strokeRect(bgX, bgY, bgWidth, bgHeight);
        }
      }

      ctx.restore();
      ctx.globalAlpha = currentAlpha;
    }

    // ── Render text inside the content area ────────────────────────────────
    ctx.fillStyle = color;

    let drawX: number;
    if (align === "center") {
      drawX = contentX + contentW / 2;
    } else if (align === "right") {
      drawX = contentX + contentW;
    } else {
      drawX = contentX;
    }

    // ── Check if Kinetic Text Splitting is active on this layer ─────────────
    if (resolved.splitAnimator) {
      const inEnd = resolved.animation.inDuration;
      const animProgress =
        inEnd > 0 ? Math.min(1, Math.max(0, this.currentTime / inEnd)) : 1;
      const splitUnits = splitTextContent(
        textToDraw,
        resolved.splitAnimator.splitBy,
      );
      const computedUnits = evaluateSplitTextTransforms(
        splitUnits,
        resolved.splitAnimator,
        animProgress,
        "in",
      );

      let currentX = drawX;
      if (align === "center") {
        const fullW = ctx.measureText(textToDraw).width;
        currentX = contentX + (contentW - fullW) / 2;
      } else if (align === "right") {
        const fullW = ctx.measureText(textToDraw).width;
        currentX = contentX + contentW - fullW;
      }

      const drawY =
        verticalAlign === "top"
          ? contentY + ascent
          : verticalAlign === "bottom"
          ? contentY + contentH - descent
          : contentY + (contentH - inkLineH) / 2 + ascent;

      computedUnits.forEach((item, unitIdx) => {
        const span = getSpanForCharIndex(
          resolved.spans,
          item.unit.charStartIndex,
        );
        const charColor =
          resolved.perCharFillEnabled && resolved.charFillColors?.[unitIdx]
            ? resolved.charFillColors[unitIdx]
            : span?.color || color;

        ctx.save();
        ctx.globalAlpha = ctx.globalAlpha * item.opacity;
        ctx.fillStyle = charColor;

        const uW = ctx.measureText(item.unit.text).width;
        const uCX = currentX + uW / 2 + item.x;
        const uCY = drawY - ascent / 2 + item.y;

        ctx.translate(uCX, uCY);
        ctx.scale(item.scale * item.scaleX, item.scale * item.scaleY);
        if (item.rotation !== 0) ctx.rotate((item.rotation * Math.PI) / 180);
        ctx.translate(-uCX, -uCY);

        if (item.blur > 0 && "filter" in ctx) {
          ctx.filter = `blur(${item.blur}px)`;
        }

        ctx.fillText(
          item.unit.text,
          currentX + item.x,
          drawY + item.y + (span?.baselineShift || 0),
        );
        ctx.restore();

        currentX += uW + (item.letterSpacingOffset || 0);
      });
    } else if (resolved.spans && resolved.spans.length > 0) {
      // ── Span-Level / Per-Character Rich Text Rendering ────────────────────
      const totalInkHeight =
        lines.length === 1
          ? inkLineH
          : inkLineH + (lines.length - 1) * lineAdvance;
      let firstBaselineY =
        verticalAlign === "top"
          ? contentY + ascent
          : verticalAlign === "bottom"
          ? contentY + contentH - totalInkHeight + ascent
          : contentY + (contentH - totalInkHeight) / 2 + ascent;

      let globalCharIndex = 0;
      ctx.textAlign = "left";
      lines.forEach((line, lineIndex) => {
        let curX = contentX;
        if (align === "center") {
          const lW = ctx.measureText(line).width;
          curX = contentX + (contentW - lW) / 2;
        } else if (align === "right") {
          const lW = ctx.measureText(line).width;
          curX = contentX + contentW - lW;
        }

        const chars = Array.from(line);
        chars.forEach((ch) => {
          const span = getSpanForCharIndex(resolved.spans, globalCharIndex);
          const chColor =
            resolved.perCharFillEnabled &&
            resolved.charFillColors?.[globalCharIndex]
              ? resolved.charFillColors[globalCharIndex]
              : span?.color || color;

          ctx.save();
          if (span?.fontFamily || span?.fontWeight || span?.fontSize) {
            ctx.font = `${span.fontWeight || fontWeight} ${
              span.fontSize || adjustedFontSize
            }px "${resolveFontFamilyName(
              span.fontFamily || rawFontFamily,
            )}", sans-serif`;
          }
          ctx.fillStyle = chColor;
          ctx.fillText(
            ch,
            curX,
            firstBaselineY +
              lineIndex * lineAdvance +
              (span?.baselineShift || 0),
          );
          ctx.restore();

          curX += ctx.measureText(ch).width + (span?.letterSpacing || 0);
          globalCharIndex += ch.length;
        });
        globalCharIndex += 1; // newline
      });
    } else {
      // ── Standard Text Rendering (Multi-line + Single line) ─────────────────
      const totalInkHeight =
        lines.length === 1
          ? inkLineH
          : inkLineH + (lines.length - 1) * lineAdvance;
      let firstBaselineY: number;
      if (verticalAlign === "top") {
        firstBaselineY = contentY + ascent;
      } else if (verticalAlign === "bottom") {
        firstBaselineY = contentY + contentH - totalInkHeight + ascent;
      } else {
        firstBaselineY = contentY + (contentH - totalInkHeight) / 2 + ascent;
      }

      ctx.textAlign = align;
      lines.forEach((line, index) => {
        ctx.fillText(line, drawX, firstBaselineY + index * lineAdvance);
      });
    }

    ctx.restore();
    ctx.restore();
  }

  private drawShapeLayer(
    ctx: CanvasRenderingContext2D,
    layer: TemplateShapeLayer,
  ): void {
    const resolved = layer;

    // Evaluate all animatable properties at current time
    const shape = resolved.shape;
    const fill = evaluateAnimatable(
      resolved.fill,
      this.currentTime,
      this.template.duration,
    );
    const flexLayout = this.computedFlexLayouts.get(resolved.id);
    const x =
      flexLayout?.x ??
      evaluateAnimatable(resolved.x, this.currentTime, this.template.duration);
    const y =
      flexLayout?.y ??
      evaluateAnimatable(resolved.y, this.currentTime, this.template.duration);
    const width =
      flexLayout?.width ??
      evaluateAnimatable(
        resolved.width,
        this.currentTime,
        this.template.duration,
      );
    const height =
      flexLayout?.height ??
      evaluateAnimatable(
        resolved.height,
        this.currentTime,
        this.template.duration,
      );
    const stroke = resolved.stroke;

    this.lastLayerLayouts.set(resolved.id, { x, y, width, height });

    ctx.fillStyle = fill;
    ctx.beginPath();

    if (shape === "rect") {
      ctx.rect(x, y, width, height);
    } else if (shape === "circle") {
      const rx = width / 2;
      const ry = height / 2;
      ctx.ellipse(x + rx, y + ry, rx, ry, 0, 0, Math.PI * 2);
    } else if (shape === "line") {
      ctx.moveTo(x, y);
      ctx.lineTo(x + width, y + height);
    }

    ctx.fill();

    if (stroke && stroke.width) {
      const strokeWidth = evaluateAnimatable(
        stroke.width,
        this.currentTime,
        this.template.duration,
      );
      const strokeColor = evaluateAnimatable(
        stroke.color,
        this.currentTime,
        this.template.duration,
      );

      if (strokeWidth > 0) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.stroke();
      }
    }
  }

  private drawImageLayer(
    ctx: CanvasRenderingContext2D,
    layer: TemplateImageLayer,
  ): void {
    const resolved = layer;

    // Evaluate animatable properties
    const url = resolved.url;
    const flexLayout = this.computedFlexLayouts.get(resolved.id);
    const x =
      flexLayout?.x ??
      evaluateAnimatable(resolved.x, this.currentTime, this.template.duration);
    const y =
      flexLayout?.y ??
      evaluateAnimatable(resolved.y, this.currentTime, this.template.duration);
    const width =
      flexLayout?.width ??
      evaluateAnimatable(
        resolved.width,
        this.currentTime,
        this.template.duration,
      );
    const height =
      flexLayout?.height ??
      evaluateAnimatable(
        resolved.height,
        this.currentTime,
        this.template.duration,
      );

    this.lastLayerLayouts.set(resolved.id, { x, y, width, height });

    if (!url) return;

    let img = this.imageCache.get(url);
    if (!img && typeof window !== "undefined") {
      img = new window.Image();
      img.src = url;
      this.imageCache.set(url, img);
    }

    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, x, y, width, height);
    }
  }

  /**
   * Renders multi-frame ghost/onion-skin frames onto the canvas for precision motion tuning.
   */
  drawOnionSkin(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    time: number,
    options: {
      frameCount?: number;
      frameDelta?: number;
      pastColor?: string;
      futureColor?: string;
    } = {},
  ): void {
    const frameCount = options.frameCount ?? 2;
    const delta = options.frameDelta ?? 0.066; // approx 2 frames at 30fps
    const duration = this.template.duration || 3.0;

    // Render Past ghost frames (reddish tint, lower alpha)
    for (let i = frameCount; i >= 1; i--) {
      const ghostTime = Math.max(0, time - i * delta);
      if (ghostTime !== time) {
        ctx.save();
        ctx.globalAlpha = 0.25 / i;
        this.drawLayers(ctx, ghostTime);
        ctx.restore();
      }
    }

    // Render Future ghost frames (greenish tint, lower alpha)
    for (let i = frameCount; i >= 1; i--) {
      const ghostTime = Math.min(duration, time + i * delta);
      if (ghostTime !== time) {
        ctx.save();
        ctx.globalAlpha = 0.25 / i;
        this.drawLayers(ctx, ghostTime);
        ctx.restore();
      }
    }

    // Render current active frame at full opacity
    this.drawFrame(ctx, time, { skipClear: true });
  }
}
