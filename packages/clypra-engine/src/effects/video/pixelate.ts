/**
 * Pixelate Effect
 *
 * Mosaic downsampling with grid quantization.
 * Strictly aligned with Desktop WGPU compositor (multi_track_blend.wgsl).
 */

export const pixelateEffect = {
  id: "video.pixelate",
  name: "Pixelate",
  version: "1.0.0",
  category: "video",
  description: "Mosaic pixelation with adjustable block size",

  compositing: {
    primitive: "Pixelate",
    layerZOrder: "in-front",
    blendMode: "normal",
  },

  schema: {
    parameters: {
      pixelSize: {
        type: "number",
        default: 18.0,
        min: 1.0,
        max: 100.0,
        step: 1.0,
        label: "Block Size (px)",
        description: "Pixel block dimension in source pixels",
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
      id: "pixelate",
      type: "ShaderNode",
      params: {
        shader: `
          precision highp float;

          uniform sampler2D uSource;
          uniform float uPixelSize;
          uniform vec2 uResolution;

          varying vec2 vUv;

          void main() {
            vec2 res = max(uResolution, vec2(1.0, 1.0));
            vec2 cell = vec2(max(uPixelSize, 1.0)) / res;
            vec2 sampleUv = floor(vUv / cell) * cell + cell * 0.5;
            gl_FragColor = texture2D(uSource, clamp(sampleUv, vec2(0.0), vec2(1.0)));
          }
        `,
        uniforms: {
          uSource: { type: "Texture", value: "@input.source" },
          uPixelSize: { type: "float", value: "@params.pixelSize" },
          uResolution: { type: "vec2", value: "@input.source.resolution" },
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
    { from: "input", fromPin: "source", to: "pixelate", toPin: "source" },
    { from: "pixelate", fromPin: "result", to: "output", toPin: "result" },
  ],

  metadata: {
    author: "Clypra Studio",
    tags: ["video", "pixelate", "mosaic", "retro", "8bit", "censorship"],
    thumbnail: "pixelate-thumb.png",
    previewVideo: "pixelate-preview.mp4",
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
      id: "fine",
      name: "Fine Pixelation",
      description: "Mild 8-bit texture",
      parameters: {
        pixelSize: 8.0,
      },
    },
    {
      id: "medium",
      name: "Standard Mosaic",
      description: "Noticeable pixel blocks",
      parameters: {
        pixelSize: 18.0,
      },
    },
    {
      id: "coarse",
      name: "Chunky Censorship",
      description: "Large blocking mosaic",
      parameters: {
        pixelSize: 40.0,
      },
    },
  ],
};
