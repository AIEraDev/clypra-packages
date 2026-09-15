/**
 * Scanlines Effect
 *
 * Simulates CRT monitor raster scanlines.
 * Strictly aligned with Desktop WGPU compositor (multi_track_blend.wgsl).
 */

export const scanlinesEffect = {
  id: "video.scanlines",
  name: "Scanlines",
  version: "1.0.0",
  category: "video",
  description: "CRT raster scanlines with controllable count and intensity",

  compositing: {
    primitive: "Scanlines",
    layerZOrder: "in-front",
    blendMode: "normal",
  },

  schema: {
    parameters: {
      scanlineCount: {
        type: "number",
        default: 120.0,
        min: 10.0,
        max: 1000.0,
        step: 10.0,
        label: "Line Count",
        description: "Number of scanlines across the vertical axis",
      },
      scanlineIntensity: {
        type: "number",
        default: 0.5,
        min: 0.0,
        max: 1.0,
        step: 0.05,
        label: "Intensity",
        description: "Darkness and visibility of scanline bands",
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
      id: "scanlines",
      type: "ShaderNode",
      params: {
        shader: `
          precision highp float;

          uniform sampler2D uSource;
          uniform float uScanlineCount;
          uniform float uScanlineIntensity;

          varying vec2 vUv;

          void main() {
            vec4 color = texture2D(uSource, vUv);
            float scanline = sin(vUv.y * uScanlineCount * 3.14159) * 0.5 + 0.5;
            vec3 dark = color.rgb * (1.0 - uScanlineIntensity * 0.5);
            vec3 rgb = mix(dark, color.rgb, scanline);
            gl_FragColor = vec4(rgb, color.a);
          }
        `,
        uniforms: {
          uSource: { type: "Texture", value: "@input.source" },
          uScanlineCount: { type: "float", value: "@params.scanlineCount" },
          uScanlineIntensity: { type: "float", value: "@params.scanlineIntensity" },
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
    { from: "input", fromPin: "source", to: "scanlines", toPin: "source" },
    { from: "scanlines", fromPin: "result", to: "output", toPin: "result" },
  ],

  metadata: {
    author: "Clypra Studio",
    tags: ["video", "scanlines", "retro", "crt", "tv", "analog"],
    thumbnail: "scanlines-thumb.png",
    previewVideo: "scanlines-preview.mp4",
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
      id: "subtle-crt",
      name: "Subtle CRT",
      description: "Fine raster lines for modern retro look",
      parameters: {
        scanlineCount: 240.0,
        scanlineIntensity: 0.3,
      },
    },
    {
      id: "heavy-tv",
      name: "Vintage TV",
      description: "Prominent coarse scanlines",
      parameters: {
        scanlineCount: 120.0,
        scanlineIntensity: 0.6,
      },
    },
  ],
};
