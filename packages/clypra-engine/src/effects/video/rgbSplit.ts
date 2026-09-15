/**
 * RGB Split Effect
 *
 * Channel separation along X and Y axes.
 * Strictly aligned with Desktop WGPU compositor (multi_track_blend.wgsl).
 */

export const rgbSplitEffect = {
  id: "video.rgb-split",
  name: "RGB Split",
  version: "1.0.0",
  category: "video",
  description: "Discrete horizontal and vertical color channel separation",

  compositing: {
    primitive: "RgbSplit",
    layerZOrder: "in-front",
    blendMode: "normal",
  },

  schema: {
    parameters: {
      splitX: {
        type: "number",
        default: 8.0,
        min: 0.0,
        max: 50.0,
        step: 0.5,
        label: "Split X (px)",
        description: "Horizontal channel offset in source pixels",
      },
      splitY: {
        type: "number",
        default: 8.0,
        min: 0.0,
        max: 50.0,
        step: 0.5,
        label: "Split Y (px)",
        description: "Vertical channel offset in source pixels",
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
      id: "split",
      type: "ShaderNode",
      params: {
        shader: `
          precision highp float;

          uniform sampler2D uSource;
          uniform float uSplitX;
          uniform float uSplitY;
          uniform vec2 uResolution;

          varying vec2 vUv;

          void main() {
            vec2 res = max(uResolution, vec2(1.0, 1.0));
            vec2 splitOffset = vec2(uSplitX, uSplitY) / res;

            vec4 center = texture2D(uSource, vUv);
            float red = texture2D(uSource, clamp(vUv - splitOffset, vec2(0.0), vec2(1.0))).r;
            float blue = texture2D(uSource, clamp(vUv + splitOffset, vec2(0.0), vec2(1.0))).b;

            gl_FragColor = vec4(red, center.g, blue, center.a);
          }
        `,
        uniforms: {
          uSource: { type: "Texture", value: "@input.source" },
          uSplitX: { type: "float", value: "@params.splitX" },
          uSplitY: { type: "float", value: "@params.splitY" },
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
    { from: "input", fromPin: "source", to: "split", toPin: "source" },
    { from: "split", fromPin: "result", to: "output", toPin: "result" },
  ],

  metadata: {
    author: "Clypra Studio",
    tags: ["video", "rgb", "split", "glitch", "color", "shift"],
    thumbnail: "rgb-split-thumb.png",
    previewVideo: "rgb-split-preview.mp4",
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
      id: "subtle-horizontal",
      name: "Subtle Horizontal Split",
      description: "Gentle horizontal color fringing",
      parameters: {
        splitX: 4.0,
        splitY: 0.0,
      },
    },
    {
      id: "standard-split",
      name: "Standard RGB Split",
      description: "Balanced diagonal channel displacement",
      parameters: {
        splitX: 8.0,
        splitY: 8.0,
      },
    },
    {
      id: "heavy-shift",
      name: "Heavy Glitch Shift",
      description: "Aggressive color separation",
      parameters: {
        splitX: 20.0,
        splitY: 12.0,
      },
    },
  ],
};
