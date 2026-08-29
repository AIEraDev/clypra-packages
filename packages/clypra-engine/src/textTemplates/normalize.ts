import type { SceneNode } from "../smartOverlays/overlayDocumentSchema.js";
import {
  TEXT_TEMPLATE_KIND,
  TEXT_TEMPLATE_RENDERER_VERSION,
  TEXT_TEMPLATE_SCHEMA_VERSION,
  type TemplateControl,
  type TemplateDependencyManifest,
  type TemplateMetadata,
  type TemplateRevision,
  type TemplateTiming,
  type TextTemplateArtifact,
  type TextTemplateDocument,
} from "./contract.js";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`).join(",")}}`;
}

export function canonicalTemplateHash(value: unknown): string {
  const input = stableStringify(value);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function now(): string {
  return new Date().toISOString();
}

function legacyLayerToNode(layer: any, index: number): SceneNode {
  const id = String(layer?.id || `${layer?.kind || "node"}-${index + 1}`);
  const x = Number(layer?.x ?? layer?.relativePosition?.x ?? 0);
  const y = Number(layer?.y ?? layer?.relativePosition?.y ?? 0);
  const width = Number(layer?.width ?? 400);
  const height = Number(layer?.height ?? 120);
  const animation = layer?.animation;

  if (layer?.kind === "shape" || layer?.kind === "solid") {
    const shape = layer?.solidProperties || layer;
    return {
      id, name: String(layer?.name || id), type: "shape", x, y, width, height,
      shapeType: shape?.shape === "circle" ? "circle" : "rectangle",
      style: { fillColor: String(shape?.fill ?? shape?.color ?? "#000000"), fillOpacity: Number(shape?.opacity ?? 1) },
      animation,
    } as SceneNode;
  }

  if (layer?.kind === "image") {
    const image = layer?.imageProperties || layer;
    return {
      id, name: String(layer?.name || id), type: "media", mediaType: "image", x, y, width, height,
      assetId: image?.assetId, src: image?.url, style: { opacity: Number(image?.opacity ?? 1) }, animation,
    } as SceneNode;
  }

  const text = layer?.textProperties || layer;
  return {
    id, name: String(layer?.name || id), type: "text", text: String(text?.content ?? text?.text ?? "Text"), x, y, width, height,
    animation,
    style: {
      fontFamily: String(text?.fontFamily || "Inter Variable"),
      fontSize: Number(text?.fontSize ?? 48),
      fontWeight: String(text?.fontWeight ?? 400),
      textColor: String(text?.color || "#FFFFFF"),
      textAlign: text?.align || "center",
      lineHeight: Number(text?.lineHeight ?? 1.2),
      letterSpacing: Number(text?.letterSpacing ?? 0),
    },
    textEffectRef: text?.styleRef ? clone(text.styleRef) : undefined,
  } as SceneNode;
}

function inferControls(nodes: SceneNode[]): TemplateControl[] {
  const controls: TemplateControl[] = [];
  const visit = (node: any) => {
    if (node.type === "text") {
      controls.push({
        id: `text-${node.id}`,
        label: node.name || "Text",
        type: "text",
        defaultValue: node.text,
        constraints: { multiline: true, maxLength: 500 },
        target: { nodeId: node.id, propertyPath: "text" },
      });
    }
    if (Array.isArray(node.children)) node.children.forEach(visit);
  };
  nodes.forEach(visit);
  return controls;
}

function collectDependencies(nodes: SceneNode[]): TemplateDependencyManifest {
  const assets: any[] = [];
  const fonts: any[] = [];
  const textEffects: any[] = [];
  const seenAssets = new Set<string>();
  const seenFonts = new Set<string>();
  const seenEffects = new Set<string>();
  const visit = (node: any) => {
    if (node.assetId && !seenAssets.has(node.assetId)) {
      assets.push({ assetId: node.assetId, kind: node.type === "video" ? "video" : "image", source: "remote" });
      seenAssets.add(node.assetId);
    }
    if (node.type === "text" && node.style?.fontFamily) {
      const key = `${node.style.fontFamily}:${node.style.fontWeight || 400}`;
      if (!seenFonts.has(key)) {
        fonts.push({ family: node.style.fontFamily, source: "system", weight: Number(node.style.fontWeight || 400), style: "normal" });
        seenFonts.add(key);
      }
    }
    if (node.textEffectRef) {
      const key = `${node.textEffectRef.effectId}:${node.textEffectRef.revisionId}`;
      if (!seenEffects.has(key)) { textEffects.push(clone(node.textEffectRef)); seenEffects.add(key); }
    }
    if (Array.isArray(node.children)) node.children.forEach(visit);
  };
  nodes.forEach(visit);
  return { assets, fonts, textEffects };
}

export function normalizeTextTemplateArtifact(input: unknown): TextTemplateArtifact {
  if (!input || typeof input !== "object") throw new Error("Invalid text template artifact");
  const raw = input as any;
  const source = raw.document && typeof raw.document === "object" ? raw.document : raw;
  const rawLayers = Array.isArray(source.layers) ? source.layers : Array.isArray(source.elements) ? source.elements : [];
  const nodes: SceneNode[] = Array.isArray(source.nodes) ? clone(source.nodes) : rawLayers.map(legacyLayerToNode);
  const id = String(raw.metadata?.id ?? source.id ?? raw.id ?? "untitled-text-template");
  const label = String(raw.metadata?.label ?? source.title ?? raw.label ?? raw.name ?? id);
  const duration = Number(raw.timing?.duration ?? source.duration ?? raw.duration ?? 4);
  const fps = Number(raw.timing?.fps ?? source.fps ?? raw.fps ?? 30);
  const width = Number(source.canvas?.width ?? source.canvasWidth ?? raw.canvasWidth ?? raw.width ?? 1920);
  const height = Number(source.canvas?.height ?? source.canvasHeight ?? raw.canvasHeight ?? raw.height ?? 1080);
  const createdAt = String(raw.revision?.createdAt ?? source.createdAt ?? now());
  const document: TextTemplateDocument = {
    id,
    version: "2.0",
    kind: TEXT_TEMPLATE_KIND,
    schemaVersion: TEXT_TEMPLATE_SCHEMA_VERSION,
    templateVersion: 1,
    title: label,
    description: String(raw.metadata?.description ?? source.description ?? raw.description ?? ""),
    category: String(raw.metadata?.category ?? source.category ?? raw.category ?? "title-card"),
    canvas: { width, height, backgroundColor: source.canvas?.backgroundColor ?? raw.backgroundColor },
    variables: Array.isArray(source.variables) ? clone(source.variables) : [],
    nodes,
    duration,
    createdAt,
    updatedAt: String(source.updatedAt ?? now()),
    markers: Array.isArray(source.markers) ? clone(source.markers) : undefined,
    assetManifest: source.assetManifest ? clone(source.assetManifest) : undefined,
    breakpoints: source.breakpoints ? clone(source.breakpoints) : undefined,
  };
  const controls: TemplateControl[] = Array.isArray(raw.controls) ? clone(raw.controls) : inferControls(nodes);
  const timing: TemplateTiming = {
    duration, fps,
    durationPolicy: raw.timing?.durationPolicy || "stretch",
    intro: raw.timing?.intro ? clone(raw.timing.intro) : undefined,
    outro: raw.timing?.outro ? clone(raw.timing.outro) : undefined,
    loop: raw.timing?.loop ? clone(raw.timing.loop) : undefined,
    markers: Array.isArray(raw.timing?.markers) ? clone(raw.timing.markers) : document.markers,
  };
  const dependencies = raw.dependencies?.assets ? clone(raw.dependencies) : collectDependencies(nodes);
  const content = { document, controls, timing, dependencies };
  const contentHash = String(raw.revision?.contentHash || canonicalTemplateHash(content));
  const revision: TemplateRevision = {
    revisionId: String(raw.revision?.revisionId ?? raw.revisionId ?? `rev-${contentHash}`),
    contentHash,
    schemaVersion: TEXT_TEMPLATE_SCHEMA_VERSION,
    rendererVersion: String(raw.revision?.rendererVersion ?? raw.rendererVersion ?? TEXT_TEMPLATE_RENDERER_VERSION),
    createdAt,
    status: raw.revision?.status,
  };
  const metadata: TemplateMetadata = {
    id, label, category: document.category,
    description: document.description,
    tags: Array.isArray(raw.metadata?.tags) ? clone(raw.metadata.tags) : Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    creatorName: raw.metadata?.creatorName ?? raw.creatorName,
    creatorLink: raw.metadata?.creatorLink ?? raw.creatorLink,
    thumbnailUrl: raw.previews?.thumbnailUrl ?? raw.thumbnail ?? raw.thumbnailUrl,
    previewVideoUrl: raw.previews?.previewVideoUrl ?? raw.preview ?? raw.previewVideoUrl,
  };
  return { kind: TEXT_TEMPLATE_KIND, schemaVersion: TEXT_TEMPLATE_SCHEMA_VERSION, metadata, document, controls, timing, dependencies, revision,
    previews: raw.previews || metadata.thumbnailUrl || metadata.previewVideoUrl ? { thumbnailUrl: metadata.thumbnailUrl, previewVideoUrl: metadata.previewVideoUrl } : undefined };
}
