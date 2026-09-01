import { cubicBezier, evaluateAnimatable } from "../templates/keyframes.js";
import { assertValidTextTemplateArtifact } from "./validator.js";
import { canonicalTemplateHash } from "./normalize.js";
import type {
  CompiledTemplateRenderLayer,
  CompiledTextTemplate,
  TemplateContainerNode,
  TemplateControl,
  TemplateNode,
  TemplateRenderContext,
  TemplateTextNode,
  TemplateTextNodeStyle,
  TextTemplateArtifact,
} from "./contract.js";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function findNode(nodes: TemplateNode[], id: string): TemplateNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
  }
  return undefined;
}

function setPath(target: any, path: string, value: unknown): void {
  const parts = path.split(".").filter(Boolean);
  if (
    !parts.length ||
    parts.some((part) => part === "__proto__" || part === "constructor" || part === "prototype")
  ) {
    return;
  }
  let cursor = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index];
    if (!cursor[part] || typeof cursor[part] !== "object") cursor[part] = {};
    cursor = cursor[part];
  }
  cursor[parts[parts.length - 1]] = value;
}

function finite(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function fallbackTextWidth(text: string, style: TemplateTextNodeStyle): number {
  // Used only when a host cannot provide Canvas/Native font metrics. This is
  // deterministic and intentionally conservative; real renderers provide
  // measureText through runtime after loading the authored font.
  const fontSize = Math.max(1, finite(style.fontSize, 48));
  const letterSpacing = finite(style.letterSpacing, 0);
  return Array.from(text).reduce((total) => total + fontSize * 0.55 + letterSpacing, 0);
}

function measureTextNode(node: TemplateTextNode, runtime: TemplateRenderContext["runtime"]): { width: number; height: number } {
  const style = node.style;
  const lines = String(node.text ?? "").split("\n");
  const measure = runtime?.measureText;
  const widths = lines.map((line) => {
    const measured = measure?.(line, style)?.width;
    return Number.isFinite(measured) ? Math.max(0, measured as number) : fallbackTextWidth(line, style);
  });
  const lineHeight = Math.max(1, finite(style.fontSize, 48) * finite(style.lineHeight, 1.2));
  return {
    width: Math.max(1, ...widths),
    height: Math.max(1, lines.length * lineHeight),
  };
}

function resolveNodeSize(node: TemplateNode, runtime: TemplateRenderContext["runtime"]): { width: number; height: number } {
  if (node.type === "text") {
    const measured = measureTextNode(node, runtime);
    return {
      width: node.width === "auto" ? measured.width : Math.max(1, finite(node.width, measured.width)),
      height: node.height === "auto" ? measured.height : Math.max(1, finite(node.height, measured.height)),
    };
  }
  return {
    width: node.width === "auto" ? 0 : Math.max(1, finite(node.width, 1)),
    height: node.height === "auto" ? 0 : Math.max(1, finite(node.height, 1)),
  };
}

function resolveControls(
  controls: TemplateControl[],
  values: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const control of controls || []) {
    const value =
      values && Object.prototype.hasOwnProperty.call(values, control.id)
        ? values[control.id]
        : control.defaultValue;
    if (control.type === "number") {
      const numeric = Number(value);
      resolved[control.id] = Number.isFinite(numeric)
        ? Math.min(
            control.constraints?.max ?? numeric,
            Math.max(control.constraints?.min ?? numeric, numeric),
          )
        : control.defaultValue;
    } else if (control.type === "boolean") {
      resolved[control.id] = value === true;
    } else {
      resolved[control.id] = value;
    }
  }
  return resolved;
}

function mapTime(time: number, artifact: TextTemplateArtifact, clipDuration?: number): number {
  const duration = artifact.timing.duration;
  const targetDuration = clipDuration && clipDuration > 0 ? clipDuration : duration;
  const localTime = Math.max(0, Math.min(time, targetDuration));

  if (
    artifact.timing.durationPolicy === "stretch" &&
    targetDuration !== duration
  ) {
    const introEnd = artifact.timing.intro?.end ?? 0;
    const outroDuration = duration - (artifact.timing.outro?.start ?? duration);
    const outroStartInTarget = targetDuration - outroDuration;

    if (localTime <= introEnd) {
      // Inside intro: 1-to-1 time mapping
      return localTime;
    } else if (localTime >= outroStartInTarget) {
      // Inside outro: mapped to the outro region of authored template
      const outroProgress = outroDuration > 0 ? (localTime - outroStartInTarget) / outroDuration : 1;
      return (artifact.timing.outro?.start ?? duration) + outroProgress * outroDuration;
    } else {
      // Inside flexible middle: map [introEnd, outroStartInTarget] -> [introEnd, outroStart]
      const flexibleTarget = Math.max(0.001, outroStartInTarget - introEnd);
      const flexibleAuthored = Math.max(0, (artifact.timing.outro?.start ?? duration) - introEnd);
      const progress = (localTime - introEnd) / flexibleTarget;
      return introEnd + progress * flexibleAuthored;
    }
  }

  if (artifact.timing.durationPolicy === "loop") {
    const loop = artifact.timing.loop;
    if (loop && loop.end > loop.start && localTime > loop.start) {
      return loop.start + ((localTime - loop.start) % (loop.end - loop.start));
    }
  }

  return Math.max(0, Math.min(localTime, duration));
}

function easeBezier(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return cubicBezier(0.4, 0, 0.2, 1)(clamped);
}

function applyAnimationPreset(
  preset: string,
  t: number,
  direction: "in" | "out",
): { opacity: number; x: number; y: number; scale: number; blur: number; typewriterProgress: number } {
  const ease = easeBezier(t);
  const clamped = Math.max(0, Math.min(1, t));
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
    case "typewriter":
      // Character reveals are authored as a linear count. Applying the
      // positional ease curve here makes the reveal jump ahead of the
      // timeline (and makes identical frame positions disagree with Studio's
      // frame labels).
      typewriterProgress = direction === "in" ? clamped : 1 - clamped;
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
    case "blur-out":
      opacity = p;
      blur = (1 - p) * 15;
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
    case "wave":
      opacity = p;
      y = Math.sin(p * Math.PI) * -15;
      break;
    case "track-in":
      opacity = p;
      blur = (1 - p) * 8;
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

function computeNodeAnimationState(
  animation: any,
  time: number,
  duration: number,
): { opacity: number; x: number; y: number; scale: number; blur: number; typewriterProgress: number } {
  if (!animation) return { opacity: 1, x: 0, y: 0, scale: 1, blur: 0, typewriterProgress: 1 };
  const inEnd = Number(animation.inDuration ?? 0);
  const outStart = duration - Number(animation.outDuration ?? 0);

  if (time < inEnd && inEnd > 0) {
    const t = time / inEnd;
    return applyAnimationPreset(animation.in || "fade", t, "in");
  } else if (time > outStart && Number(animation.outDuration ?? 0) > 0) {
    const t = (time - outStart) / Number(animation.outDuration ?? 0);
    return applyAnimationPreset(animation.out || "fade", t, "out");
  }

  return { opacity: 1, x: 0, y: 0, scale: 1, blur: 0, typewriterProgress: 1 };
}

function evaluateNodeProperty<T>(node: TemplateNode, property: string, fallback: T, time: number, duration: number): T {
  const frames = (node.animation as any)?.propertyKeyframes?.[property];
  if (!frames?.keyframes?.length) return fallback;
  return evaluateAnimatable(frames, time, duration) as T;
}

export function compileTextTemplate(
  artifact: TextTemplateArtifact,
  context: TemplateRenderContext,
): CompiledTextTemplate {
  assertValidTextTemplateArtifact(artifact);
  const resolvedControls = resolveControls(artifact.controls, context.controlValues);
  const document = clone(artifact.document);

  for (const control of artifact.controls || []) {
    const node = findNode(document.nodes, control.target.nodeId);
    if (node) setPath(node, control.target.propertyPath, resolvedControls[control.id]);
  }

  const time = mapTime(context.time, artifact, context.clipDuration);

  // Flex layout resolution for container nodes
  const flexPositions = new Map<string, { x: number; y: number; width: number; height: number }>();
  const containers = (document.nodes || []).filter((n): n is TemplateContainerNode => n.type === "container");

  for (const container of containers) {
    const children = (document.nodes || []).filter((n) => n.parentId === container.id && n.visible !== false);
    const layout = container.layout || { type: "flex", direction: "column", gap: 0, alignItems: "start", justifyContent: "start" };
    const direction = layout.direction || "column";
    const gap = layout.gap || 0;
    const padTop = layout.paddingTop || 0;
    const padRight = layout.paddingRight || 0;
    const padBottom = layout.paddingBottom || 0;
    const padLeft = layout.paddingLeft || 0;
    const alignItems = layout.alignItems || "center";

    const containerX = container.x;
    const containerY = container.y;

    if (direction === "column") {
      let totalChildHeight = 0;
      let maxChildWidth = 0;
      const childSizes: { id: string; width: number; height: number }[] = [];

      for (const child of children) {
        const measured = resolveNodeSize(child, context.runtime);
        const cw = measured.width;
        const ch = measured.height;
        childSizes.push({ id: child.id, width: cw, height: ch });
        totalChildHeight += ch;
        maxChildWidth = Math.max(maxChildWidth, cw);
      }
      if (children.length > 1) {
        totalChildHeight += (children.length - 1) * gap;
      }

      const containerW = container.width === "auto" ? maxChildWidth + padLeft + padRight : Number(container.width);
      const containerH = container.height === "auto" ? totalChildHeight + padTop + padBottom : Number(container.height);

      flexPositions.set(container.id, { x: containerX, y: containerY, width: containerW, height: containerH });

      let currentY = containerY + padTop;
      const innerW = Math.max(0, containerW - padLeft - padRight);

      for (const child of childSizes) {
        let childX = containerX + padLeft;
        if (alignItems === "center") {
          childX = containerX + padLeft + (innerW - child.width) / 2;
        } else if (alignItems === "end") {
          childX = containerX + padLeft + (innerW - child.width);
        } else if (alignItems === "stretch") {
          child.width = innerW;
        }

        flexPositions.set(child.id, { x: childX, y: currentY, width: child.width, height: child.height });
        currentY += child.height + gap;
      }
    } else {
      let totalChildWidth = 0;
      let maxChildHeight = 0;
      const childSizes: { id: string; width: number; height: number }[] = [];

      for (const child of children) {
        const measured = resolveNodeSize(child, context.runtime);
        const cw = measured.width;
        const ch = measured.height;
        childSizes.push({ id: child.id, width: cw, height: ch });
        totalChildWidth += cw;
        maxChildHeight = Math.max(maxChildHeight, ch);
      }
      if (children.length > 1) {
        totalChildWidth += (children.length - 1) * gap;
      }

      const containerW = container.width === "auto" ? totalChildWidth + padLeft + padRight : Number(container.width);
      const containerH = container.height === "auto" ? maxChildHeight + padTop + padBottom : Number(container.height);

      flexPositions.set(container.id, { x: containerX, y: containerY, width: containerW, height: containerH });

      let currentX = containerX + padLeft;
      const innerH = Math.max(0, containerH - padTop - padBottom);

      for (const child of childSizes) {
        let childY = containerY + padTop;
        if (alignItems === "center") {
          childY = containerY + padTop + (innerH - child.height) / 2;
        } else if (alignItems === "end") {
          childY = containerY + padTop + (innerH - child.height);
        } else if (alignItems === "stretch") {
          child.height = innerH;
        }

        flexPositions.set(child.id, { x: currentX, y: childY, width: child.width, height: child.height });
        currentX += child.width + gap;
      }
    }
  }

  const layers: CompiledTemplateRenderLayer[] = (document.nodes || []).map((node) => {
    const animState = computeNodeAnimationState(node.animation, time, artifact.timing.duration);
    const fullText = node.type === "text" ? node.text : undefined;
    const visibleText = fullText === undefined
      ? undefined
      : Array.from(fullText).slice(0, Math.floor(fullText.length * animState.typewriterProgress)).join("");
    const flexPos = flexPositions.get(node.id);
    const baseX = flexPos?.x ?? evaluateNodeProperty(node, "x", Number(node.x), time, artifact.timing.duration);
    const baseY = flexPos?.y ?? evaluateNodeProperty(node, "y", Number(node.y), time, artifact.timing.duration);
    const measuredSize = node.type === "text" ? measureTextNode(node, context.runtime) : undefined;
    const resolvedWidth = flexPos?.width ?? (node.width === "auto" ? measuredSize?.width ?? 1 : evaluateNodeProperty(node, "width", Number(node.width), time, artifact.timing.duration));
    const resolvedHeight = flexPos?.height ?? (node.height === "auto" ? measuredSize?.height ?? 1 : evaluateNodeProperty(node, "height", Number(node.height), time, artifact.timing.duration));

    const baseOpacity =
      node.type === "shape"
        ? (node.style.fillOpacity ?? 1)
        : node.type === "media"
          ? (node.style?.opacity ?? 1)
          : node.type === "container"
            ? (node.style?.opacity ?? 1)
            : 1;

    return {
      id: node.id,
      type: node.type,
      parentId: node.parentId,
      x: baseX + animState.x,
      y: baseY + animState.y,
      width: resolvedWidth * animState.scale,
      height: resolvedHeight * animState.scale,
      rotation: 0,
      opacity: node.visible === false ? 0 : animState.opacity * baseOpacity,
      visible: node.visible !== false && animState.opacity > 0,
      text: visibleText,
      assetId: node.type === "media" ? node.assetId : undefined,
      mediaUrl: node.type === "media" ? node.src : undefined,
      style: (node as any).style as Record<string, unknown>,
      content: node.type === "text"
        ? {
            text: node.text,
            backgroundPanel: (node as any).backgroundPanel,
            splitAnimator: (node as any).splitAnimator,
            typewriterProgress: animState.typewriterProgress,
            splitProgress: Number(node.animation?.inDuration ?? 0) > 0
              ? Math.max(0, Math.min(1, time / Number(node.animation?.inDuration)))
              : 1,
          }
        : undefined,
    };
  });

  const capabilities = {
    studio: { status: "exact" as const, unsupportedFeatures: [], warnings: [] },
    editor: { status: "exact" as const, unsupportedFeatures: [], warnings: [] },
    export: { status: "exact" as const, unsupportedFeatures: [], warnings: [] },
  };

  return {
    kind: "text-template",
    templateId: artifact.metadata.id,
    revisionId: artifact.revision.revisionId,
    contentHash: artifact.revision.contentHash || canonicalTemplateHash(artifact),
    width: artifact.document.canvas.width,
    height: artifact.document.canvas.height,
    duration: artifact.timing.duration,
    fps: artifact.timing.fps,
    time,
    evaluatedScene: { nodes: layers, diagnostics: [] },
    resolvedControls,
    layers,
    dependencies: artifact.dependencies,
    capabilities,
    diagnostics: [],
  };
}
