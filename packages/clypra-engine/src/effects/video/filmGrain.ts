/**
 * Film Grain Effect
 *
 * Procedural grain texture with adjustable size and intensity.
 * Strictly aligned with Desktop WGPU compositor (multi_track_blend.wgsl).
 */

export const filmGrainEffect = {
  id: "video.film-grain",
  name: "Film Grain",
  version: "1.0.0",
  category: "video",
  description: "Add cinematic film grain with procedural noise",

  compositing: {
    primitive: "FilmGrain",
    layerZOrder: "in-front",
    blendMode: "normal",
  },

  schema: {
    parameters: {
      grainIntensity: {
        type: "number",
        default: 0.15,
        min: 0.0,
        max: 1.0,
        step: 0.01,
        label: "Intensity",
        description: "Grain visibility strength",
      },
      grainSize: {
        type: "number",
        default: 1.0,
        min: 0.1,
        max: 5.0,
        step: 0.1,
        label: "Grain Size",
        description: "Size of grain particles",
      },
      grainSeed: {
        type: "number",
        default: 0.0,
        min: 0.0,
        max: 100.0,
        step: 0.1,
        label: "Grain Seed",
        description: "Seed offset for animation or pattern variation",
      },
      animated: {
        type: "boolean",
        default: true,
        label: "Animated",
        description: "Animate grain seed over time",
      },
    },
    inputs: {
      source: {
        type: "Texture",
        required: true,
        label: "Video Input",
      },
    },
    outputs: {
      result: {
        type: "Texture",
        label: "Output",
      },
    },
  },

  nodes: [
    {
      id: "input",
      type: "Input",
      params: {},
      outputs: {
        source: { type: "Texture" },
      },
    },
    {
      id: "grain",
      type: "ShaderNode",
      params: {
        shader: `
          precision highp float;

          uniform sampler2D uSource;
          uniform float uGrainIntensity;
          uniform float uGrainSize;
          uniform float uGrainSeed;

          varying vec2 vUv;

          float film_grain(vec2 uv, float size) {
            return fract(sin(dot(uv * size, vec2(12.9898, 78.233))) * 43758.5453);
          }

          void main() {
            vec4 color = texture2D(uSource, vUv);
            float grain = film_grain(vUv + vec2(uGrainSeed), max(uGrainSize, 0.1));
            vec3 rgb = color.rgb + (grain - 0.5) * uGrainIntensity;
            gl_FragColor = vec4(clamp(rgb, 0.0, 1.0), color.a);
          }
        `,
        uniforms: {
          uSource: { type: "Texture", value: "@input.source" },
          uGrainIntensity: { type: "float", value: "@params.grainIntensity" },
          uGrainSize: { type: "float", value: "@params.grainSize" },
          uGrainSeed: { type: "float", value: "@params.grainSeed" },
        },
      },
      inputs: {
        source: { type: "Texture" },
      },
      outputs: {
        result: { type: "Texture" },
      },
    },
    {
      id: "output",
      type: "Output",
      params: {},
      inputs: {
        result: { type: "Texture" },
      },
    },
  ],

  edges: [
    { from: "input", fromPin: "source", to: "grain", toPin: "source" },
    { from: "grain", fromPin: "result", to: "output", toPin: "result" },
  ],

  metadata: {
    author: "Clypra Studio",
    tags: ["video", "film", "grain", "retro", "noise", "cinematic"],
    thumbnail: "film-grain-thumb.png",
    previewVideo: "film-grain-preview.mp4",
  },

  capabilities: {
    temporal: false,
    stateful: false,
    spatial: false,
    geometry: false,
    inputsCount: 1,
  },

  requirements: {
    temporalRadius: 0,
    preferredPrecision: "fp16",
    multipass: false,
    supportsHalfResolution: false,
  },

  presets: [
    {
      id: "subtle",
      name: "Subtle 35mm Grain",
      description: "Delicate cinematic grain structure",
      parameters: {
        grainIntensity: 0.1,
        grainSize: 1.0,
      },
    },
    {
      id: "medium-16mm",
      name: "16mm Film Stock",
      description: "Noticeable organic film grain",
      parameters: {
        grainIntensity: 0.25,
        grainSize: 1.5,
      },
    },
    {
      id: "heavy-8mm",
      name: "Gritty 8mm Grain",
      description: "Pronounced vintage grain texture",
      parameters: {
        grainIntensity: 0.45,
        grainSize: 2.2,
      },
    },
  ],
};
