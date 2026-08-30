import { evaluateConfig, evaluateScene } from "../engine/evaluate.js";
import { textEffectConfigToScene } from "../engine/migrate.js";
import { CANONICAL_RENDERER_VERSION } from "../contracts.js";
import type { TextEffectConfig } from "../types.js";
import type { TextEffectRenderInput, CanonicalRenderResult } from "./types.js";

type CanvasLike = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function isScene(value: unknown): value is import("../engine/schema.js").SceneDocument {
  return Boolean(value && typeof value === "object" && Array.isArray((value as any).effectLayers) && (value as any).canvas);
}

function isConfig(value: unknown): value is TextEffectConfig {
  return Boolean(value && typeof value === "object" && typeof (value as any).text === "string" && typeof (value as any).fontFamily === "string");
}

/** Shared effect renderer adapter used by source preview, timeline and export. */
export function renderTextEffectToCanvas(ctx: CanvasLike, input: TextEffectRenderInput): CanonicalRenderResult {
  const source = input.source as any;
  const scene = isScene(source)
    ? source
    : isScene(source?.scene)
      ? source.scene
      : isConfig(source?.config)
        ? textEffectConfigToScene(source.config)
        : isConfig(source)
          ? textEffectConfigToScene(source)
          : null;
  if (!scene) {
    return {
      capability: "text-effect",
      rendererVersion: CANONICAL_RENDERER_VERSION,
      diagnostics: [{ level: "error", code: "effect-source-invalid", message: "Text effect source is not a scene or supported configuration.", capability: "text-effect" }],
      usedDependencies: [],
    };
  }
  if (isConfig(source)) evaluateConfig(source, input.context.time, ctx);
  else evaluateScene(scene, input.context.time, ctx);
  return {
    capability: "text-effect",
    revisionId: source?.revisionId,
    contentHash: source?.contentHash,
    rendererVersion: source?.rendererVersion ?? CANONICAL_RENDERER_VERSION,
    diagnostics: [],
    usedDependencies: [],
  };
}
