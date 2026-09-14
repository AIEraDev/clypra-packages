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
  | "ParticleEmitter"
  | (string & {});

export type LayerZOrder = "behind-subject" | "in-front" | "isolate-only";

export type SkeletalAnchorKeypoint =
  | "neck"
  | "spineCenter"
  | "leftShoulder"
  | "rightShoulder"
  | "hipCenter";

export type SkeletalDepthMode = "behind-subject" | "in-front" | "auto-yaw";

export interface SkeletalAnchorConfig {
  readonly anchorKeypoint: SkeletalAnchorKeypoint;
  readonly offsetX?: number;
  readonly offsetY?: number;
  readonly scaleX?: number;
  readonly scaleY?: number;
  readonly rotationDeg?: number;
  readonly followTorsoOrientation?: boolean;
  readonly depthMode?: SkeletalDepthMode;
  readonly spriteAssetUri?: string;
  readonly dualSprite?: {
    readonly leftSpriteUri: string;
    readonly rightSpriteUri: string;
    readonly leftAnchorKeypoint?: SkeletalAnchorKeypoint;
    readonly rightAnchorKeypoint?: SkeletalAnchorKeypoint;
  };
}

export type ParticleAnchorSource = "wrists" | "spine" | "neck" | "silhouette" | "root";

export interface ParticleEmitterConfig {
  readonly emitterType: "point" | "contour" | "bone_ribbon";
  readonly anchorSource: ParticleAnchorSource;
  readonly particleCount: number;
  readonly lifetimeSec: number;
  readonly speed?: number;
  readonly velocity?: readonly [number, number, number];
  readonly turbulence?: number;
  readonly gravity?: number;
  readonly sizeStart?: number;
  readonly sizeEnd?: number;
  readonly colorStart?: string;
  readonly colorEnd?: string;
  readonly blendMode?: "normal" | "screen" | "multiply" | "additive" | (string & {});
}

export interface BodyEffectRequirements {
  readonly minEngineVersion: string;
  readonly captureType: "silhouette_mask" | "skeletal_pose" | "hybrid_body";
  readonly maskCategory?: MaskCategory;
  readonly requiredLandmarks?: readonly string[];
  readonly minInferenceFps?: number;
  readonly supportsBake?: boolean;
  /** Minimum GPU 2D texture dimension requirement in pixels (e.g. 4096) */
  readonly minTextureDimension2D?: number;
  /** Whether this effect strictly requires the canonical baseline GPU profile without down-clamping */
  readonly requiresCanonicalLimits?: boolean;
}

export interface BodyEffectCompositing {
  readonly primitive: CompositingPrimitive;
  readonly layerZOrder: LayerZOrder;
  readonly blendMode: "normal" | "screen" | "multiply" | "overlay" | "add" | (string & {});
  readonly customWgslUri?: string;
  readonly skeletalAnchor?: SkeletalAnchorConfig;
  readonly particleEmitter?: ParticleEmitterConfig;
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
