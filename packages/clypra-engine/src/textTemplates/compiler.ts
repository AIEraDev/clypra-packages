import { evaluateOverlayDocument } from "../smartOverlays/runtime/evaluator.js";
import type { SceneNode } from "../smartOverlays/overlayDocumentSchema.js";
import { assertValidTextTemplateArtifact } from "./validator.js";
import { canonicalTemplateHash } from "./normalize.js";
import type { CompiledTextTemplate, TemplateControl, TemplateRenderContext, TextTemplateArtifact } from "./contract.js";

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }

function findNode(nodes: SceneNode[], id: string): any {
  for (const node of nodes as any[]) {
    if (node.id === id) return node;
    if (Array.isArray(node.children)) { const found = findNode(node.children, id); if (found) return found; }
  }
  return undefined;
}

function setPath(target: any, path: string, value: unknown): void {
  const parts = path.split(".").filter(Boolean);
  if (!parts.length || parts.some((part) => part === "__proto__" || part === "constructor" || part === "prototype")) return;
  let cursor = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index];
    if (!cursor[part] || typeof cursor[part] !== "object") cursor[part] = {};
    cursor = cursor[part];
  }
  cursor[parts[parts.length - 1]] = value;
}

function resolveControls(controls: TemplateControl[], values: Record<string, unknown> | undefined): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const control of controls) {
    const value = values && Object.prototype.hasOwnProperty.call(values, control.id) ? values[control.id] : control.defaultValue;
    if (control.type === "number") {
      const numeric = Number(value);
      resolved[control.id] = Number.isFinite(numeric) ? Math.min(control.constraints?.max ?? numeric, Math.max(control.constraints?.min ?? numeric, numeric)) : control.defaultValue;
    } else if (control.type === "boolean") resolved[control.id] = value === true;
    else resolved[control.id] = value;
  }
  return resolved;
}

function mapTime(time: number, artifact: TextTemplateArtifact, clipDuration?: number): number {
  const duration = artifact.timing.duration;
  let local = Math.max(0, Math.min(time, duration));
  if (artifact.timing.durationPolicy === "stretch" && clipDuration && clipDuration > 0 && clipDuration !== duration) {
    const intro = artifact.timing.intro;
    const outro = artifact.timing.outro;
    const protectedDuration = (intro?.end ?? 0) + (duration - (outro?.start ?? duration));
    const flexibleDuration = Math.max(0, duration - protectedDuration);
    const flexibleTarget = Math.max(0, clipDuration - protectedDuration);
    if (flexibleDuration > 0 && local > (intro?.end ?? 0) && local < (outro?.start ?? duration)) local = (intro?.end ?? 0) + ((local - (intro?.end ?? 0)) / flexibleDuration) * flexibleTarget;
  }
  const loop = artifact.timing.loop;
  if (artifact.timing.durationPolicy === "loop" && loop && local > loop.start && loop.end > loop.start) local = loop.start + ((local - loop.start) % (loop.end - loop.start));
  return Math.max(0, Math.min(local, duration));
}

export function compileTextTemplate(artifact: TextTemplateArtifact, context: TemplateRenderContext): CompiledTextTemplate {
  assertValidTextTemplateArtifact(artifact);
  const resolvedControls = resolveControls(artifact.controls, context.controlValues);
  const document = clone(artifact.document);
  for (const control of artifact.controls) {
    const node = findNode(document.nodes, control.target.nodeId);
    if (node) setPath(node, control.target.propertyPath, resolvedControls[control.id]);
  }
  const time = mapTime(context.time, artifact, context.clipDuration);
  const evaluatedScene = evaluateOverlayDocument(document, context.runtime || {}, time);
  const layers = evaluatedScene.nodes.flatMap((node: any) => {
    const flatten = (item: any, parentId?: string): any[] => [{ id: item.id, type: item.type, parentId, ...item.transform, opacity: item.style?.opacity ?? 1, visible: item.visible, text: item.content?.text, assetId: item.content?.assetId, mediaUrl: item.content?.mediaUrl, style: item.style, content: item.content }, ...(item.children || []).flatMap((child: any) => flatten(child, item.id))];
    return flatten(node);
  });
  const diagnostics = evaluatedScene.diagnostics.map((diagnostic) => ({ level: diagnostic.level, code: diagnostic.code, message: diagnostic.message, nodeId: diagnostic.nodeId }));
  const capabilities = {
    studio: { status: "exact" as const, unsupportedFeatures: [], warnings: [] },
    editor: { status: "exact" as const, unsupportedFeatures: [], warnings: [] },
    export: { status: "exact" as const, unsupportedFeatures: [], warnings: [] },
  };
  return { kind: "text-template", templateId: artifact.metadata.id, revisionId: artifact.revision.revisionId, contentHash: artifact.revision.contentHash || canonicalTemplateHash(artifact), width: artifact.document.canvas.width, height: artifact.document.canvas.height, duration: artifact.timing.duration, fps: artifact.timing.fps, time, evaluatedScene, resolvedControls, layers, dependencies: artifact.dependencies, capabilities, diagnostics };
}
