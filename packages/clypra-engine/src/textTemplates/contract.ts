import type {
  LayerAnimation,
  ResponsiveAnchorConfig,
  TextStyleSpan,
  TextSplitAnimator,
  TemplateVariableDefinition,
  TemplateKeyframe,
} from "../types.js";

export const TEXT_TEMPLATE_KIND = "text-template" as const;
export const TEXT_TEMPLATE_SCHEMA_VERSION = 4 as const;
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

export interface TemplateTimelineMarker {
  id: string;
  label: string;
  time: number;
  color?: string;
}

export interface TemplateTiming {
  duration: number;
  fps: number;
  durationPolicy: TemplateDurationPolicy;
  intro?: TemplateProtectedRegion;
  outro?: TemplateProtectedRegion;
  loop?: TemplateProtectedRegion;
  markers?: TemplateTimelineMarker[];
}

export interface TemplateAssetRef {
  id: string;
  name?: string;
  type: "image" | "video" | "audio";
  mimeType: string;
  sizeBytes?: number;
  uri: string;
  contentHash: string;
}

export interface TemplateFontRef {
  family: string;
  postscriptName?: string;
  style?: string;
  weight?: string | number;
  sourceUrl?: string;
  format?: "woff2" | "ttf" | "otf";
}

export interface TemplateDependencyManifest {
  assets: TemplateAssetRef[];
  fonts: TemplateFontRef[];
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

// ---------------------------------------------------------------------------
// Native Text Template Layer Nodes (Isolated Clean Architecture Schema)
// ---------------------------------------------------------------------------

export interface TemplateTextNodeStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: string | number;
  fontStyle?: "normal" | "italic";
  textColor: string;
  textAlign?: "left" | "center" | "right";
  lineHeight?: number;
  letterSpacing?: number;
  overflow?: "wrap" | "shrink" | "expand-panel" | "clip";
  verticalAlign?: "top" | "middle" | "bottom";
}

export interface TemplateBackgroundPanel {
  color?: string;
  opacity?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  borderRadius?: number;
  borderColor?: string;
  borderWidth?: number;
}

export type TemplatePropertyKeyframes = Record<string, { keyframes: TemplateKeyframe<unknown>[] }>;

export type TemplateNodeAnimation = LayerAnimation & {
  /** Keyframes for geometry/style properties authored by Studio. */
  propertyKeyframes?: TemplatePropertyKeyframes;
};

export interface TemplateTextNode {
  id: string;
  name?: string;
  type: "text";
  text: string;
  x: number;
  y: number;
  width: number | "auto";
  height: number | "auto";
  visible?: boolean;
  style: TemplateTextNodeStyle;
  backgroundPanel?: TemplateBackgroundPanel;
  animation?: TemplateNodeAnimation;
  spans?: TextStyleSpan[];
  perCharFillEnabled?: boolean;
  charFillColors?: string[];
  splitAnimator?: TextSplitAnimator;
  anchor?: ResponsiveAnchorConfig;
  textEffectRef?: {
    effectId: string;
    revisionId: string;
    contentHash: string;
    snapshot?: unknown;
  };
  parentId?: string;
}

export interface TemplateShapeNodeStyle {
  fillColor: string;
  fillOpacity?: number;
  strokeColor?: string;
  strokeWidth?: number;
}

export interface TemplateShapeNode {
  id: string;
  name?: string;
  type: "shape";
  shapeType: "rectangle" | "circle" | "line";
  x: number;
  y: number;
  width: number;
  height: number;
  visible?: boolean;
  style: TemplateShapeNodeStyle;
  animation?: TemplateNodeAnimation;
  anchor?: ResponsiveAnchorConfig;
  parentId?: string;
}

export interface TemplateImageNode {
  id: string;
  name?: string;
  type: "media";
  mediaType: "image";
  x: number;
  y: number;
  width: number;
  height: number;
  visible?: boolean;
  assetId?: string;
  src?: string;
  style?: {
    opacity?: number;
  };
  animation?: TemplateNodeAnimation;
  anchor?: ResponsiveAnchorConfig;
  parentId?: string;
}

export interface TextTemplateFlexLayout {
  type: "flex" | "absolute";
  direction: "row" | "column";
  gap: number;
  alignItems: "start" | "center" | "end" | "stretch";
  justifyContent: "start" | "center" | "end" | "space-between" | "space-around";
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
}

export interface TemplateContainerNodeStyle {
  backgroundColor?: string;
  backgroundOpacity?: number;
  borderRadius?: number;
  borderColor?: string;
  borderWidth?: number;
  opacity?: number;
}

export interface TemplateContainerNode {
  id: string;
  name?: string;
  type: "container";
  layout: TextTemplateFlexLayout;
  x: number;
  y: number;
  width: number | "auto";
  height: number | "auto";
  visible?: boolean;
  style?: TemplateContainerNodeStyle;
  animation?: TemplateNodeAnimation;
  anchor?: ResponsiveAnchorConfig;
  parentId?: string;
}

export type TemplateNode =
  | TemplateTextNode
  | TemplateShapeNode
  | TemplateImageNode
  | TemplateContainerNode;

export interface TextTemplateCanvas {
  width: number;
  height: number;
  fps?: number;
  backgroundColor?: string;
}

export interface TextTemplateDocument {
  id: string;
  kind: typeof TEXT_TEMPLATE_KIND;
  schemaVersion: typeof TEXT_TEMPLATE_SCHEMA_VERSION;
  templateVersion: 1;
  canvas: TextTemplateCanvas;
  nodes: TemplateNode[];
  variables?: Record<string, TemplateVariableDefinition>;
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
  runtime?: Record<string, unknown> & {
    /** Host-provided font measurement used for deterministic auto layout. */
    measureText?: (text: string, style: TemplateTextNodeStyle) => { width: number; height?: number };
  };
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

export interface EvaluatedTemplateScene {
  nodes: CompiledTemplateRenderLayer[];
  diagnostics: Array<{ level: "error" | "warning" | "info"; code: string; message: string; nodeId?: string }>;
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
  evaluatedScene: EvaluatedTemplateScene;
  resolvedControls: Record<string, unknown>;
  layers: CompiledTemplateRenderLayer[];
  dependencies: TemplateDependencyManifest;
  capabilities: Record<TemplateRenderTarget, TemplateCapabilityReport>;
  diagnostics: Array<{ level: "error" | "warning" | "info"; code: string; message: string; nodeId?: string }>;
}
