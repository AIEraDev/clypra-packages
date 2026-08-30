import type { SceneDocument } from "../engine/schema.js";
import type { CompiledTextTemplate, TextTemplateArtifact } from "../textTemplates/contract.js";

/** Renderer identities are owned by the package so every host uses the same
 * compatibility contract when it builds cache keys or revision metadata. */
export { CANONICAL_RENDERER_VERSION } from "../contracts.js";
export { TEXT_TEMPLATE_RENDERER_VERSION } from "../textTemplates/contract.js";

export type RenderEnvironment = "studio" | "editor" | "export" | "thumbnail" | "preview";
export type RenderCapability = "text-effect" | "text-template";

export interface CanonicalRenderContext {
  environment: RenderEnvironment;
  time: number;
  width?: number;
  height?: number;
  clipDuration?: number;
  controlValues?: Record<string, unknown>;
  /** Runtime services are intentionally opaque to the package contract. */
  runtime?: Record<string, unknown>;
}

export interface RenderDiagnostics {
  level: "info" | "warning" | "error";
  code: string;
  message: string;
  capability?: RenderCapability;
  nodeId?: string;
}

export interface RenderIdentity {
  capability: RenderCapability;
  revisionId?: string;
  contentHash?: string;
  rendererVersion: string;
}

export interface CanonicalRenderResult extends RenderIdentity {
  diagnostics: RenderDiagnostics[];
  usedDependencies: string[];
  /** The compiled plan is present for templates and omitted for effects. */
  compiledTemplate?: CompiledTextTemplate;
}

export interface TextTemplateRenderInput {
  artifact: TextTemplateArtifact;
  context: CanonicalRenderContext;
}

export interface TextEffectRenderInput {
  /** A scene, a published definition containing scene, or a legacy config. */
  source: SceneDocument | { scene?: SceneDocument; config?: unknown } | unknown;
  context: CanonicalRenderContext;
}
