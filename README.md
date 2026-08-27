# Clypra Packages

Monorepo housing all shared libraries, core engines, and UI primitives powering the [Clypra](https://github.com/AIEraDev/clypra) video editor and [Clypra Studio](https://github.com/AIEraDev/clypra-studio).

## Packages

| Package | Version | Description |
| :--- | :--- | :--- |
| [`@clypra-studio/engine`](./packages/clypra-engine) | `1.3.0` | GPU-accelerated video & text effects engine (WebGL, WebGPU, GLSL) |
| [`@clypra/ui-color-picker`](./packages/ui-color-picker) | `0.1.0` | Professional color picker with Floating UI positioning & color harmonies |
| [`@clypra-studio/runtime`](./packages/runtime) | `0.2.2` | Shared execution graph, render planner, and state pipeline |
| [`@clypra-studio/types`](./packages/types) | `0.5.0` | Central type definitions & contracts across all Clypra subsystems |
| [`@clypra-studio/ui`](./packages/ui) | `0.3.0` | Shared UI controls, preview canvas, and keyframe editors |
| [`@clypra-studio/shaders`](./packages/shaders) | `0.1.5` | Reusable GLSL shader library for video transformations & noise |
| [`@clypra-studio/native-render-wasm`](./packages/native-render-wasm) | `0.1.2` | In-browser WebAssembly compositor core |
| [`@clypra-studio/feature-providers`](./packages/feature-providers) | `0.1.1` | Chroma key, body segmentation, and feature providers |

## Development

```bash
# Install all dependencies
pnpm install

# Build all packages
pnpm build

# Run unit tests across all packages
pnpm test

# Typecheck all packages
pnpm typecheck
```
