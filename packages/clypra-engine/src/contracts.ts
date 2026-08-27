import type {
  EffectFullDefinition,
  TextEffectConfig,
  TemplateLayer,
  TemplateTextLayer,
  TextTemplate,
} from "./types";
import { _buildConfig, textEffectConfigToScene } from "./engine/migrate";
import {
  SCENE_SCHEMA_VERSION,
  type EffectLayer,
  type SceneDocument,
} from "./engine/schema";
import { applyTimelineAtTime } from "./engine/animation";
import { evaluateAnimatable } from "./templates/keyframes";

export const CANONICAL_SCHEMA_VERSION = 2 as const;
export const CANONICAL_RENDERER_VERSION = "1.3.0" as const;

export interface PublishedRevision {
  assetId: string;
  revisionId: string;
  schemaVersion: number;
  contentHash: string;
  rendererVersion: string;
  createdAt: string;
}

export interface SceneDocumentV2 extends SceneDocument {
  schemaVersion: typeof CANONICAL_SCHEMA_VERSION;
  revision?: PublishedRevision;
}

export interface TemplateStyleRef {
  effectId: string;
  revisionId: string;
  contentHash: string;
  /** Required for published templates; optional only for unresolved legacy input. */
  snapshot?: SceneDocumentV2;
  parameterOverrides?: Record<string, unknown>;
}

export type TemplateLayerV2 = TemplateLayer & {
  styleRef?: TemplateStyleRef;
};

export interface TextTemplateDocumentV2 {
  schemaVersion: typeof CANONICAL_SCHEMA_VERSION;
  id: string;
  label: string;
  category: TextTemplate["category"] | string;
  description: string;
  tags: string[];
  duration: number;
  fps: number;
  canvasWidth: number;
  canvasHeight: number;
  layers: TemplateLayerV2[];
  dependencies: TemplateStyleRef[];
  revision?: PublishedRevision;
  thumbnail?: string;
  preview?: string;
  published?: boolean;
  creatorName?: string;
  creatorLink?: string;
}

export type RenderTarget = "canvas2d" | "native" | "export";
export type CapabilityStatus = "exact" | "approximate" | "rasterized" | "unsupported";

export interface RenderDiagnostic {
  layerId: string;
  layerType: string;
  enabled: boolean;
  contribution: "active" | "disabled" | "unsupported";
  reason: string;
}

export interface CapabilityReport {
  target: RenderTarget;
  status: CapabilityStatus;
  unsupportedFeatures: string[];
  approximations: string[];
}

export interface RenderPlan {
  kind: "text-effect" | "text-template";
  width: number;
  height: number;
  duration: number;
  time: number;
  effect?: SceneDocumentV2;
  template?: TextTemplateDocumentV2;
  diagnostics: RenderDiagnostic[];
  capabilities: Record<RenderTarget, CapabilityReport>;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

export function canonicalContentHash(value: unknown): string {
  const input = stableStringify(value);
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function stableLayerId(layer: EffectLayer, index: number, counts: Map<string, number>): string {
  if (layer.id && !/^layer-[a-z0-9-]+$/i.test(layer.id)) return layer.id;
  const count = (counts.get(layer.type) ?? 0) + 1;
  counts.set(layer.type, count);
  return count === 1 ? layer.type : `${layer.type}-${count}`;
}

export function canonicalizeSceneDocument(input: SceneDocument): SceneDocumentV2 {
  const doc = clone(input);
  const idMap = new Map<string, string>();
  const counts = new Map<string, number>();
  const effectLayers = doc.effectLayers.map((layer) => {
    const id = stableLayerId(layer, 0, counts);
    idMap.set(layer.id, id);
    return {
      ...layer,
      id,
      enabled: layer.enabled !== false,
      opacity: Number.isFinite(layer.opacity) ? layer.opacity : 1,
    };
  });
  const timeline = {
    ...doc.timeline,
    tracks: doc.timeline.tracks.map((track) => ({
      ...track,
      layerId: idMap.get(track.layerId) ?? track.layerId,
    })),
  };
  return {
    ...doc,
    schemaVersion: SCENE_SCHEMA_VERSION,
    effectLayers,
    timeline,
  };
}

function effectDefinitionToConfig(input: EffectFullDefinition): TextEffectConfig & { width: number; height: number } {
  const raw = input as EffectFullDefinition & { text?: string; fontSize?: number; canvasWidth?: number; canvasHeight?: number };
  const fontSize = Number(raw.fontSize ?? 100);
  return {
    ..._buildConfig(
    input,
    raw.text ?? "CLYPRA",
    fontSize,
    Number(raw.canvasWidth ?? 800),
    Number(raw.canvasHeight ?? 200),
    ),
    effectName: input.name,
    textPosX: "center",
    textPosY: "middle",
  } as TextEffectConfig & { width: number; height: number };
}

export function normalizeTextEffect(
  input: unknown,
  metadata?: Partial<PublishedRevision>,
): SceneDocumentV2 {
  if (!input || typeof input !== "object") throw new Error("Invalid text effect document");
  const raw = input as Record<string, any>;
  const scene = Array.isArray(raw.effectLayers)
    ? canonicalizeSceneDocument(raw as SceneDocument)
    : canonicalizeSceneDocument(
        textEffectConfigToScene(
          raw.font && Array.isArray(raw.fills)
            ? effectDefinitionToConfig(raw as EffectFullDefinition)
            : raw as TextEffectConfig,
        ),
      );
  const content = { ...scene, revision: undefined };
  if (metadata?.assetId) {
    scene.revision = {
      assetId: metadata.assetId,
      revisionId: metadata.revisionId ?? "draft",
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      contentHash: metadata.contentHash ?? canonicalContentHash(content),
      rendererVersion: metadata.rendererVersion ?? CANONICAL_RENDERER_VERSION,
      createdAt: metadata.createdAt ?? new Date().toISOString(),
    };
  }
  return scene;
}

function normalizeTemplateLayer(layer: TemplateLayer, index: number): TemplateLayerV2 {
  const normalized = clone(layer) as TemplateLayerV2;
  normalized.id = normalized.id || `${normalized.kind}-${index + 1}`;
  if (normalized.kind === "text") {
    const text = normalized as TemplateTextLayer & { styleRef?: TemplateStyleRef; styleDefinition?: unknown; styleId?: string; styleVersion?: number };
    if (!text.styleRef && text.styleDefinition) {
      const snapshot = normalizeTextEffect(text.styleDefinition, { assetId: text.styleId ?? "legacy-effect" });
      text.styleRef = {
        effectId: text.styleId ?? snapshot.effectName,
        revisionId: String(text.styleVersion ?? "legacy"),
        contentHash: canonicalContentHash({ ...snapshot, revision: undefined }),
        snapshot,
      };
    }
  }
  return normalized;
}

function normalizeTemplateElement(element: any, index: number): TemplateLayer {
  const animation = element.animation ?? {
    in: "none",
    out: "none",
    inDuration: 0,
    outDuration: 0,
    hold: "full",
  };
  const base = {
    id: element.id || `${element.kind}-${index + 1}`,
    x: element.x ?? element.relativePosition?.x ?? 0,
    y: element.y ?? element.relativePosition?.y ?? 0,
    width: element.width ?? "auto",
    height: element.height ?? "auto",
    animation,
  };
  if (element.kind === "text") {
    const props = element.textProperties ?? element;
    return {
      kind: "text",
      ...base,
      content: props.text ?? props.content ?? "Text",
      fontFamily: props.fontFamily ?? "Inter Variable",
      fontSize: props.fontSize ?? 48,
      fontWeight: props.fontWeight ?? 400,
      color: props.color ?? "#FFFFFF",
      align: props.align ?? "center",
      role: props.role ?? "none",
      verticalAlign: props.verticalAlign ?? "middle",
      styleRef: props.styleRef,
    } as any;
  }
  if (element.kind === "solid" || element.kind === "shape") {
    const props = element.solidProperties ?? element;
    return {
      kind: "shape",
      ...base,
      shape: props.shape ?? "rect",
      fill: props.color ?? props.fill ?? "#000000",
      opacity: props.opacity ?? 1,
    } as any;
  }
  const props = element.imageProperties ?? element;
  return {
    kind: "image",
    ...base,
    url: props.url ?? "",
    opacity: props.opacity ?? 1,
  } as any;
}

export function normalizeTextTemplate(
  input: unknown,
  metadata?: Partial<PublishedRevision>,
): TextTemplateDocumentV2 {
  if (!input || typeof input !== "object") throw new Error("Invalid text template document");
  const raw = input as Record<string, any>;
  const sourceLayers = Array.isArray(raw.layers)
    ? raw.layers
    : Array.isArray(raw.elements)
      ? raw.elements.map(normalizeTemplateElement)
      : [];
  const layers = sourceLayers.map(normalizeTemplateLayer);
  const dependencies = layers
    .map((layer) => (layer.kind === "text" ? layer.styleRef : undefined))
    .filter((ref): ref is TemplateStyleRef => !!ref)
    .filter((ref, index, all) => all.findIndex((other) => other.effectId === ref.effectId && other.revisionId === ref.revisionId) === index);
  const document: TextTemplateDocumentV2 = {
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    id: String(raw.id),
    label: String(raw.label ?? raw.name ?? raw.displayName ?? raw.id),
    category: raw.category ?? "title-card",
    description: String(raw.description ?? ""),
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    duration: Number(raw.duration ?? raw.defaultDuration ?? 4),
    fps: Number(raw.fps ?? 30),
    canvasWidth: Number(raw.canvasWidth ?? raw.width ?? 1920),
    canvasHeight: Number(raw.canvasHeight ?? raw.height ?? 1080),
    layers,
    dependencies,
    thumbnail: raw.thumbnail ?? raw.thumbnailUrl,
    preview: raw.preview ?? raw.previewVideoUrl,
    published: raw.published,
    creatorName: raw.creatorName,
    creatorLink: raw.creatorLink,
  };
  if (!document.id || !Number.isFinite(document.duration) || document.duration <= 0) {
    throw new Error("Text template must have a valid id and positive duration");
  }
  if (metadata?.assetId) {
    document.revision = {
      assetId: metadata.assetId,
      revisionId: metadata.revisionId ?? "draft",
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      contentHash: metadata.contentHash ?? canonicalContentHash({ ...document, revision: undefined }),
      rendererVersion: metadata.rendererVersion ?? CANONICAL_RENDERER_VERSION,
      createdAt: metadata.createdAt ?? new Date().toISOString(),
    };
  }
  return document;
}

function activeEffectDiagnostics(scene: SceneDocumentV2): RenderDiagnostic[] {
  return scene.effectLayers.map((layer) => ({
    layerId: layer.id,
    layerType: layer.type,
    enabled: layer.enabled,
    contribution: layer.enabled ? "active" : "disabled",
    reason: layer.enabled ? `${layer.name} is enabled` : `${layer.name} is explicitly disabled`,
  }));
}

function capabilities(target: RenderTarget, unsupportedFeatures: string[] = []): CapabilityReport {
  const status: CapabilityStatus = unsupportedFeatures.length > 0
    ? target === "native" ? "rasterized" : "unsupported"
    : "exact";
  return { target, status, unsupportedFeatures, approximations: [] };
}

export function evaluateTextEffect(
  document: SceneDocumentV2 | unknown,
  time = 0,
  _overrides: Record<string, unknown> = {},
): RenderPlan {
  const scene = normalizeTextEffect(document);
  const evaluated = canonicalizeSceneDocument(applyTimelineAtTime(scene, time));
  const diagnostics = activeEffectDiagnostics(evaluated);
  const unsupported = evaluated.customEngineId ? [`custom-engine:${evaluated.customEngineId}`] : [];
  return {
    kind: "text-effect",
    width: evaluated.canvas.width,
    height: evaluated.canvas.height,
    duration: evaluated.timeline.duration,
    time,
    effect: evaluated,
    diagnostics,
    capabilities: {
      canvas2d: capabilities("canvas2d"),
      native: capabilities("native", unsupported),
      export: capabilities("export", unsupported),
    },
  };
}

export function evaluateTextTemplate(
  document: TextTemplateDocumentV2 | unknown,
  time = 0,
  overrides: Record<string, unknown> = {},
): RenderPlan {
  const template = normalizeTextTemplate(document);
  const diagnostics: RenderDiagnostic[] = template.layers.map((layer) => {
    const enabled = evaluateAnimatable((layer as any).opacity ?? 1, time, template.duration) > 0;
    return {
      layerId: layer.id,
      layerType: layer.kind,
      enabled,
      contribution: enabled ? "active" : "disabled",
      reason: enabled ? `${layer.kind} layer contributes at ${time.toFixed(3)}s` : "Layer opacity is zero",
    };
  });
  void overrides;
  return {
    kind: "text-template",
    width: template.canvasWidth,
    height: template.canvasHeight,
    duration: template.duration,
    time,
    template,
    diagnostics,
    capabilities: {
      canvas2d: capabilities("canvas2d"),
      native: capabilities("native"),
      export: capabilities("export"),
    },
  };
}

export function getRenderCapabilities(plan: RenderPlan, target: RenderTarget): CapabilityReport {
  return plan.capabilities[target];
}
