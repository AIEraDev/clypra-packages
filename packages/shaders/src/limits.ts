/**
 * Canonical GPU hardware limits baseline for Clypra WebGPU & wgpu pipelines.
 * Generated from gpu-limits.json (single source of truth).
 */

import rawLimits from "./gpu-limits.json";

export interface ClypraGpuLimits {
  readonly maxBindGroups: number;
  readonly maxTextureDimension2D: number;
  readonly maxSampledTexturesPerShaderStage: number;
  readonly maxSamplersPerShaderStage: number;
  readonly maxStorageBuffersPerShaderStage: number;
  readonly maxStorageBufferBindingSize: number;
  readonly maxUniformBuffersPerShaderStage: number;
  readonly maxUniformBufferBindingSize: number;
}

export const CLYPRA_CANONICAL_LIMITS: ClypraGpuLimits = Object.freeze({
  maxBindGroups: rawLimits.maxBindGroups,
  maxTextureDimension2D: rawLimits.maxTextureDimension2D,
  maxSampledTexturesPerShaderStage: rawLimits.maxSampledTexturesPerShaderStage,
  maxSamplersPerShaderStage: rawLimits.maxSamplersPerShaderStage,
  maxStorageBuffersPerShaderStage: rawLimits.maxStorageBuffersPerShaderStage,
  maxStorageBufferBindingSize: rawLimits.maxStorageBufferBindingSize,
  maxUniformBuffersPerShaderStage: rawLimits.maxUniformBuffersPerShaderStage,
  maxUniformBufferBindingSize: rawLimits.maxUniformBufferBindingSize,
});
