/**
 * Chromatic Aberration Effect
 *
 * RGB channel displacement with radial distortion.
 * Simulates lens defects and color fringing.
 *
 * Phase 3 Week 6 - Video Effect #4
 */

export const chromaticAberrationEffect = {
  id: "video.chromatic-aberration",
  name: "Chromatic Aberration",
  version: "1.0.0",
  category: "video",
  description: "Directional RGB channel displacement with optical edge-feather falloff",

  compositing: {
    primitive: "ChromaticAberration",
    layerZOrder: "in-front",
    blendMode: "normal",
  },

  schema: {
    parameters: {
      amount: {
        type: "number",
        default: 8.0,
        min: 0.0,
        max: 50.0,
        step: 0.5,
        label: "Amount (px)",
        description: "Separation distance in pixels",
      },
      angleDegrees: {
        type: "number",
        default: 0.0,
        min: 0.0,
        max: 360.0,
        step: 1.0,
        label: "Angle (°)",
        description: "Direction of separation (degrees)",
      },
      edgeFeather: {
        type: "number",
        default: 0.5,
        min: 0.0,
        max: 1.0,
        step: 0.05,
        label: "Edge Feather",
        description: "Optical lens falloff from center (0 = uniform across frame, 1 = perimeter only)",
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
      id: "aberration",
      type: "ShaderNode",
      params: {
        shader: `
          precision highp float;

          uniform sampler2D uSource;
          uniform float uAmount;
          uniform float uAngleDegrees;
          uniform float uEdgeFeather;
          uniform vec2 uResolution;

          varying vec2 vUv;

          void main() {
            vec2 uv = vUv;
            float rad = uAngleDegrees * 0.0174532925; // PI / 180.0
            vec2 dir = vec2(cos(rad), sin(rad));
            float distFromCenter = length(uv - vec2(0.5, 0.5)) * 2.0;
            float featherFactor = mix(1.0, smoothstep(0.0, 1.0, distFromCenter), clamp(uEdgeFeather, 0.0, 1.0));
            vec2 res = max(uResolution, vec2(1.0, 1.0));
            vec2 offset = (dir * uAmount * featherFactor) / res;

            float r = texture2D(uSource, clamp(uv + offset, vec2(0.0), vec2(1.0))).r;
            float g = texture2D(uSource, uv).g;
            float b = texture2D(uSource, clamp(uv - offset, vec2(0.0), vec2(1.0))).b;
            float a = texture2D(uSource, uv).a;

            gl_FragColor = vec4(r, g, b, a);
          }
        `,
        uniforms: {
          uSource: { type: "Texture", value: "@input.source" },
          uAmount: { type: "float", value: "@params.amount" },
          uAngleDegrees: { type: "float", value: "@params.angleDegrees" },
          uEdgeFeather: { type: "float", value: "@params.edgeFeather" },
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
    { from: "input", fromPin: "source", to: "aberration", toPin: "source" },
    { from: "aberration", fromPin: "result", to: "output", toPin: "result" },
  ],

  metadata: {
    author: "Clypra Studio",
    tags: ["video", "chromatic", "aberration", "color", "distortion", "lens", "optical"],
    thumbnail: "chromatic-aberration-thumb.png",
    previewVideo: "chromatic-aberration-preview.mp4",
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
      name: "Subtle Fringing",
      description: "Slight optical color fringing",
      parameters: {
        amount: 4.0,
        angleDegrees: 0.0,
        edgeFeather: 0.5,
      },
    },
    {
      id: "lens-fringing",
      name: "Lens Perimeter Aberration",
      description: "Aberration focused toward outer edges of frame",
      parameters: {
        amount: 8.0,
        angleDegrees: 0.0,
        edgeFeather: 0.8,
      },
    },
    {
      id: "heavy-shift",
      name: "Diagonal RGB Shift",
      description: "Prominent 45-degree prism shift",
      parameters: {
        amount: 20.0,
        angleDegrees: 45.0,
        edgeFeather: 0.2,
      },
    },
    {
      id: "vertical-split",
      name: "Vertical Glitch Split",
      description: "Vertical separation across entire frame",
      parameters: {
        amount: 12.0,
        angleDegrees: 90.0,
        edgeFeather: 0.0,
      },
    },
  ],
};
