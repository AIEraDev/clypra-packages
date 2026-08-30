import { cubicBezier } from "../templates/keyframes.js";
import { assertValidTextTemplateArtifact } from "./validator.js";
import { canonicalTemplateHash } from "./normalize.js";
import type {
  CompiledTemplateRenderLayer,
  CompiledTextTemplate,
  TemplateControl,
  TemplateNode,
  TemplateRenderContext,
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
  let local = Math.max(0, Math.min(time, duration));
  if (
    artifact.timing.durationPolicy === "stretch" &&
    clipDuration &&
    clipDuration > 0 &&
    clipDuration !== duration
  ) {
    const intro = artifact.timing.intro;
    const outro = artifact.timing.outro;
    const protectedDuration = (intro?.end ?? 0) + (duration - (outro?.start ?? duration));
    const flexibleDuration = Math.max(0, duration - protectedDuration);
    const flexibleTarget = Math.max(0, clipDuration - protectedDuration);
    if (flexibleDuration > 0 && local > (intro?.end ?? 0) && local < (outro?.start ?? duration)) {
      local =
        (intro?.end ?? 0) +
        ((local - (intro?.end ?? 0)) / flexibleDuration) * flexibleTarget;
    }
  }
  const loop = artifact.timing.loop;
  if (artifact.timing.durationPolicy === "loop" && loop && local > loop.start && loop.end > loop.start) {
    local = loop.start + ((local - loop.start) % (loop.end - loop.start));
  }
  return Math.max(0, Math.min(local, duration));
}

function easeBezier(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return cubicBezier(0.4, 0, 0.2, 1)(clamped);
}

function applyAnimationPreset(
  preset: string,
  t: number,
  direction: "in" | "out",
): { opacity: number; x: number; y: number; scale: number; blur: number } {
  const ease = easeBezier(t);
  const p = direction === "in" ? ease : 1 - ease;
  let opacity = 1;
  let x = 0;
  let y = 0;
  let scale = 1;
  let blur = 0;

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
    case "none":
    default:
      break;
  }
  return { opacity, x, y, scale, blur };
}

function computeNodeAnimationState(
  animation: any,
  time: number,
  duration: number,
): { opacity: number; x: number; y: number; scale: number; blur: number } {
  if (!animation) return { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 };
  const inEnd = Number(animation.inDuration ?? 0);
  const outStart = duration - Number(animation.outDuration ?? 0);

  if (time < inEnd && inEnd > 0) {
    const t = time / inEnd;
    return applyAnimationPreset(animation.in || "fade", t, "in");
  } else if (time > outStart && Number(animation.outDuration ?? 0) > 0) {
    const t = (time - outStart) / Number(animation.outDuration ?? 0);
    return applyAnimationPreset(animation.out || "fade", t, "out");
  }

  return { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 };
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

  const layers: CompiledTemplateRenderLayer[] = (document.nodes || []).map((node) => {
    const animState = computeNodeAnimationState(node.animation, time, artifact.timing.duration);
    const resolvedWidth = node.width === "auto" ? 400 : Number(node.width);
    const resolvedHeight = node.height === "auto" ? 100 : Number(node.height);

    const baseOpacity =
      node.type === "shape"
        ? (node.style.fillOpacity ?? 1)
        : node.type === "media"
          ? (node.style?.opacity ?? 1)
          : 1;

    return {
      id: node.id,
      type: node.type,
      parentId: node.parentId,
      x: node.x + animState.x,
      y: node.y + animState.y,
      width: resolvedWidth * animState.scale,
      height: resolvedHeight * animState.scale,
      rotation: 0,
      opacity: animState.opacity * baseOpacity,
      visible: animState.opacity > 0,
      text: node.type === "text" ? node.text : undefined,
      assetId: node.type === "media" ? node.assetId : undefined,
      mediaUrl: node.type === "media" ? node.src : undefined,
      style: (node as any).style as Record<string, unknown>,
      content: node.type === "text" ? { text: node.text } : undefined,
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
