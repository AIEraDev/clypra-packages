/**
 * Body Effect Manifest Contract
 *
 * Declarative manifest schema for all body effects (cutout, aura, wings, outlines, blur).
 * Shared across clypra-api (registry), clypra-studio (builder), and clypra (desktop runtime).
 */

import type { MaskCategory } from "./subjectCapture";

export type CompositingPrimitive =
  | "PassThrough"
  | "AlphaCutout"
  | "MaskedGlow"
  | "MaskedStroke"
  | "MaskedDualBlur"
  | "SkeletalSpriteAnchor"
  | (string & {});

export type LayerZOrder = "behind-subject" | "in-front" | "isolate-only";

export interface BodyEffectRequirements {
  readonly minEngineVersion: string;
  readonly captureType: "silhouette_mask" | "skeletal_pose" | "hybrid_body";
  readonly maskCategory?: MaskCategory;
  readonly requiredLandmarks?: readonly string[];
  readonly minInferenceFps?: number;
  readonly supportsBake?: boolean;
}

export interface BodyEffectCompositing {
  readonly primitive: CompositingPrimitive;
  readonly layerZOrder: LayerZOrder;
  readonly blendMode: "normal" | "screen" | "multiply" | "overlay" | "add" | (string & {});
  readonly customWgslUri?: string;
}

export interface BodyEffectParameterSchema {
  readonly type: "float" | "color" | "boolean" | "vec2" | "vec3";
  readonly default: unknown;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly description?: string;
}

export interface BodyEffectManifest {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly category: "Cutout" | "Aura" | "Wings" | "Energy" | "Motion" | "Fun" | (string & {});
  readonly description: string;
  readonly thumbnail?: string;
  readonly previewWebm?: string;
  readonly requirements: BodyEffectRequirements;
  readonly compositing: BodyEffectCompositing;
  readonly parameterSchema: Record<string, BodyEffectParameterSchema>;
  readonly defaultParams: Record<string, unknown>;
  readonly tags: readonly string[];
}
