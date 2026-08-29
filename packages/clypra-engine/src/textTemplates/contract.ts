import type {
  AssetRef,
  FontRef,
  OverlayDocument,
  SceneNode,
  TimelineMarker,
} from "../smartOverlays/overlayDocumentSchema.js";
import type { EvaluatedScene, RuntimeContext } from "../smartOverlays/runtime/evaluatedScene.js";

export const TEXT_TEMPLATE_KIND = "text-template" as const;
export const TEXT_TEMPLATE_SCHEMA_VERSION = 3 as const;
export const TEXT_TEMPLATE_RENDERER_VERSION = "1.5.0" as const;

export type TemplateControlType =
  | "text"
  | "color"
  | "number"
  | "boolean"
  | "enum"
  | "font"
  | "media";

export interface TemplateControlOption {
  value: string;
  label: string;
}

export interface TemplateControlConstraints {
  min?: number;
  max?: number;
  step?: number;
  maxLength?: number;
  multiline?: boolean;
  options?: TemplateControlOption[];
  allowedMimeTypes?: string[];
}

export interface TemplateControl {
  id: string;
  label: string;
  type: TemplateControlType;
  group?: string;
  description?: string;
  required?: boolean;
  defaultValue: string | number | boolean | null;
  constraints?: TemplateControlConstraints;
  target: {
    nodeId: string;
    propertyPath: string;
  };
}

export interface TemplateProtectedRegion {
  start: number;
  end: number;
}

export type TemplateDurationPolicy = "fixed" | "stretch" | "trim" | "loop";

export interface TemplateTiming {
  duration: number;
  fps: number;
  durationPolicy: TemplateDurationPolicy;
  intro?: TemplateProtectedRegion;
  outro?: TemplateProtectedRegion;
  loop?: TemplateProtectedRegion;
  markers?: TimelineMarker[];
}

export interface TemplateDependencyManifest {
  assets: AssetRef[];
  fonts: FontRef[];
  textEffects: Array<{
    effectId: string;
    revisionId: string;
    contentHash: string;
    snapshot?: unknown;
  }>;
}

export interface TemplateMetadata {
  id: string;
  label: string;
  category: string;
  description?: string;
  tags: string[];
  creatorName?: string;
  creatorLink?: string;
  thumbnailUrl?: string;
  previewVideoUrl?: string;
}

export interface TemplateRevision {
  revisionId: string;
  contentHash: string;
  schemaVersion: number;
  rendererVersion: string;
  createdAt: string;
  status?: "pending-review" | "approved" | "deprecated";
}

export interface TemplatePreviewArtifacts {
  thumbnailUrl?: string;
  previewVideoUrl?: string;
  generatedAt?: string;
}

export interface TextTemplateDocument extends OverlayDocument {
  kind: typeof TEXT_TEMPLATE_KIND;
  schemaVersion: typeof TEXT_TEMPLATE_SCHEMA_VERSION;
  templateVersion: 1;
}

export interface TextTemplateArtifact {
  kind: typeof TEXT_TEMPLATE_KIND;
  schemaVersion: typeof TEXT_TEMPLATE_SCHEMA_VERSION;
  metadata: TemplateMetadata;
  document: TextTemplateDocument;
  controls: TemplateControl[];
  timing: TemplateTiming;
  dependencies: TemplateDependencyManifest;
  revision: TemplateRevision;
  previews?: TemplatePreviewArtifacts;
}

export interface TextTemplateClip {
  kind: "text-template";
  templateId: string;
  revisionId: string;
  contentHash: string;
  templateSnapshot: TextTemplateArtifact;
  controlValues: Record<string, unknown>;
  dependencySnapshot: TemplateDependencyManifest;
}

export type TemplateRenderTarget = "studio" | "editor" | "export";

export interface TemplateRenderContext {
  time: number;
  target: TemplateRenderTarget;
  controlValues?: Record<string, unknown>;
  clipDuration?: number;
  runtime?: RuntimeContext;
}

export interface CompiledTemplateRenderLayer {
  id: string;
  type: string;
  parentId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  text?: string;
  assetId?: string;
  mediaUrl?: string;
  style?: Record<string, unknown>;
  content?: Record<string, unknown>;
}

export interface TemplateCapabilityReport {
  status: "exact" | "degraded" | "unsupported";
  unsupportedFeatures: string[];
  warnings: string[];
}

export interface CompiledTextTemplate {
  kind: typeof TEXT_TEMPLATE_KIND;
  templateId: string;
  revisionId: string;
  contentHash: string;
  width: number;
  height: number;
  duration: number;
  fps: number;
  time: number;
  evaluatedScene: EvaluatedScene;
  resolvedControls: Record<string, unknown>;
  layers: CompiledTemplateRenderLayer[];
  dependencies: TemplateDependencyManifest;
  capabilities: Record<TemplateRenderTarget, TemplateCapabilityReport>;
  diagnostics: Array<{ level: "error" | "warning" | "info"; code: string; message: string; nodeId?: string }>;
}

export type TemplateNode = SceneNode;
