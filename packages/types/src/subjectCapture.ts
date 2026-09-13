/**
 * Subject Capture Asset Schema
 *
 * Unified contract for neural perception outputs (silhouettes, poses, hybrids).
 * Consumed by compositor primitives and bake pipelines.
 */

export type CaptureAssetType = "silhouette_mask" | "skeletal_pose" | "hybrid_body";

export type MaskCategory = "person" | "hair" | "face" | "clothing" | "background";

export interface SilhouetteMaskData {
  readonly type: "silhouette_mask";
  readonly category: MaskCategory;
  readonly width: number;
  readonly height: number;
  /** GPU texture reference handle (R8Unorm) or bitmap/canvas in web preview */
  readonly textureHandle: string | unknown;
  readonly minConfidence?: number;
}

export interface Landmark3D {
  readonly x: number; // Normalized [0, 1]
  readonly y: number; // Normalized [0, 1]
  readonly z: number; // Normalized relative depth
  readonly visibility: number; // Confidence score [0, 1]
}

export interface Quaternion {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
}

export interface TorsoAnchors {
  readonly leftShoulder: Landmark3D;
  readonly rightShoulder: Landmark3D;
  readonly neck: Landmark3D;
  readonly spineCenter: Landmark3D;
  readonly leftWrist: Landmark3D;
  readonly rightWrist: Landmark3D;
  /** Unit quaternion describing torso 3D orientation */
  readonly torsoOrientation: Quaternion;
}

export interface SkeletalPoseData {
  readonly type: "skeletal_pose";
  /** 33 normalized landmarks conforming to MediaPipe / BlazePose topology */
  readonly landmarks: readonly Landmark3D[];
  /** Derived structural anchor points for sprite and mesh binding */
  readonly anchors: TorsoAnchors;
}

export interface HybridBodyData {
  readonly type: "hybrid_body";
  readonly mask: SilhouetteMaskData;
  readonly pose: SkeletalPoseData;
}

export type SubjectCapturePayload = SilhouetteMaskData | SkeletalPoseData | HybridBodyData;

export interface SubjectCaptureAsset {
  readonly id: string;
  readonly sourceClipId: string;
  readonly timestampUs: number;
  readonly isBaked: boolean;
  readonly capture: SubjectCapturePayload;
}
