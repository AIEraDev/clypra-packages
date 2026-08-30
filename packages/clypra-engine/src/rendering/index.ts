import { CANONICAL_RENDERER_VERSION, TEXT_TEMPLATE_RENDERER_VERSION } from "./types.js";
import type { CanonicalRenderResult, CanonicalRenderContext } from "./types.js";
import { renderTextEffectToCanvas } from "./textEffectRenderer.js";
import { renderTextTemplateToCanvas, resolveTextTemplateArtifact } from "./textTemplateRenderer.js";

export * from "./types.js";
export * from "./textEffectRenderer.js";
export * from "./textTemplateRenderer.js";

export type CanonicalRenderInput =
  | { capability: "text-template"; artifact: unknown; context: CanonicalRenderContext }
  | { capability: "text-effect"; source: unknown; context: CanonicalRenderContext };

/** Extensible capability registry for all package-owned render semantics. */
export function renderCanonicalToCanvas(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  input: CanonicalRenderInput,
): CanonicalRenderResult {
  if (input.capability === "text-template") {
    const artifact = resolveTextTemplateArtifact(input.artifact);
    if (!artifact) {
      return {
        capability: "text-template",
        rendererVersion: TEXT_TEMPLATE_RENDERER_VERSION,
        diagnostics: [{ level: "error", code: "template-artifact-missing", message: "A full text-template artifact is required for rendering.", capability: "text-template" }],
        usedDependencies: [],
      };
    }
    return renderTextTemplateToCanvas(ctx, { artifact, context: input.context });
  }
  return renderTextEffectToCanvas(ctx, { source: input.source, context: input.context });
}
