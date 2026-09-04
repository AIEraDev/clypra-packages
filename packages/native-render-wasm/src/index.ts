/**
 * @clypra-studio/native-render-wasm
 *
 * In-browser WASM compositor for Clypra Studio labs.
 * Replaces the local HTTP daemon (NativeLabClient) so contributors can use
 * all Studio labs without installing or running any native binary.
 *
 * Drop-in replacement for nativeLabClient.ts — exposes renderFrame() and
 * probeNativeLab() with the same return shapes as the HTTP client.
 */

// In-browser WebAssembly compositor initialized via CDN URL.
import init, {
  create_renderer,
  type WasmRenderer,
} from "./generated/clypra_render_wasm.js";

export const DEFAULT_CLYPRA_WASM_URL =
  "https://clypra-worker-api.abdulkabirmusa.com/media/wasm/clypra_render_wasm_v2_bg.wasm";

// The v2 WASM artifact validates the native-core v2 frame contract.
export const NATIVE_RENDER_CONTRACT_VERSION = 2;

let configuredWasmUrl = DEFAULT_CLYPRA_WASM_URL;

/**
 * Optionally configure the remote or local WASM binary URL.
 */
export function configureWasmRenderer(options: { wasmUrl?: string }) {
  if (options.wasmUrl) {
    configuredWasmUrl = options.wasmUrl;
  }
}

// ── Types (mirrored from @clypra-studio/native-lab-client) ─────────────────
// Re-exported here so callers can stop importing from native-lab-client.

export interface NativeLabFrameTime {
  frameIndex: number;
  ticks: number;
  timescale: number;
}

export interface NativeLabVideoLayer {
  layerId: string;
  assetId: string;
  videoPath: string;
  sourceTime: NativeLabFrameTime;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  zIndex: number;
  blendMode: string;
  colorGrade?: Record<string, unknown> | null;
  bodyEffect?: Record<string, unknown> | null;
}

export interface NativeLabRasterLayer {
  assetId: string;
  rgba?: number[] | null;
  width: number;
  height: number;
  x: number;
  y: number;
  rotation: number;
  opacity: number;
  zIndex: number;
  blendMode: string;
  colorGrade?: Record<string, unknown> | null;
  isMask?: boolean;
  isText?: boolean;
}

export interface NativeLabProjectSnapshot {
  schemaVersion: number;
  projectRevision: string;
  canvasWidth: number;
  canvasHeight: number;
  clearColor: [number, number, number, number];
  videoLayers: NativeLabVideoLayer[];
  rasterLayers?: NativeLabRasterLayer[];
  transition?: Record<string, unknown> | null;
}

export interface NativeLabFrameRequest {
  contractVersion: number;
  requestId: string;
  frameTime: NativeLabFrameTime;
  project: NativeLabProjectSnapshot;
  outputWidth: number;
  outputHeight: number;
  quality: "full" | "half" | "quarter" | "proxy";
  colorPolicy: {
    version: number;
    workingSpace: string;
    outputFormat: "rgba8Srgb" | "rgba16Float";
    toneMapHdrToSdr: boolean;
    displayProfile: string;
  };
  renderGraphVersion: number;
}

export interface NativeLabFrameResult {
  image: Blob;
  contentType: string;
  requestId: string;
  frameIndex: number;
  metrics: {
    decodeTimeUs: number | null;
    composeTimeUs: number | null;
    readbackTimeUs: number | null;
    totalTimeUs: number | null;
    cacheHit: boolean | null;
  };
}

export interface NativeLabHandshake {
  protocolVersion: number;
  contractVersion: number;
  coreVersion: string;
  renderGraphVersion: number;
  colorPolicyVersion: number;
  gpu: {
    state: "initializing" | "ready" | "failed";
    available: boolean;
    adapterName: string | null;
    backend: string | null;
    failureReason: string | null;
  };
}

/**
 * Custom error class for Clypra WebAssembly runtime and initialization errors.
 */
export class ClypraWasmError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "ClypraWasmError";
  }
}

// ── Renderer singleton ───────────────────────────────────────────────────────

let wasmInitialised = false;
let renderer: WasmRenderer | null = null;
let initPromise: Promise<WasmRenderer> | null = null;
// The WASM renderer owns a long-lived wgpu compositor. Its render method is
// intentionally mutable so the compositor can reuse pipelines and uniform
// storage between frames. Keep every caller (Studio, export, thumbnails) on a
// single queue so a second JS call can never overlap a mutable WASM borrow.
let renderQueue: Promise<void> = Promise.resolve();

async function getRenderer(): Promise<WasmRenderer> {
  if (renderer) return renderer;
  // Serialise concurrent calls — only one init() + create_renderer() runs.
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      if (!wasmInitialised) {
        await init({ module_or_path: configuredWasmUrl });
        wasmInitialised = true;
      }
      renderer = await create_renderer();
      return renderer;
    } catch (err) {
      // Reset state on failure so subsequent calls can retry
      wasmInitialised = false;
      renderer = null;
      throw new ClypraWasmError(
        `Failed to initialize Clypra WASM renderer from '${configuredWasmUrl}': ${
          err instanceof Error ? err.message : String(err)
        }`,
        err,
      );
    }
  })();

  try {
    return await initPromise;
  } finally {
    initPromise = null;
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Probe the WASM renderer and return a handshake-shaped object.
 * Drop-in replacement for `probeNativeLab()` in nativeLabClient.ts.
 */
export async function probeNativeRenderer(
  signal?: AbortSignal,
): Promise<NativeLabHandshake> {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  try {
    const r = await getRenderer();
    const info = JSON.parse(r.adapter_info()) as {
      name?: string;
      backend?: string;
      deviceType?: string;
    };
    return {
      protocolVersion: 1,
      contractVersion: NATIVE_RENDER_CONTRACT_VERSION,
      coreVersion: "wasm-0.1.0",
      renderGraphVersion: 1,
      colorPolicyVersion: 1,
      gpu: {
        state: "ready",
        available: true,
        adapterName: info.name ?? null,
        backend: info.backend ?? null,
        failureReason: null,
      },
    };
  } catch (err) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    return {
      protocolVersion: 1,
      contractVersion: NATIVE_RENDER_CONTRACT_VERSION,
      coreVersion: "wasm-0.1.0",
      renderGraphVersion: 1,
      colorPolicyVersion: 1,
      gpu: {
        state: "failed",
        available: false,
        adapterName: null,
        backend: null,
        failureReason:
          err instanceof Error ? err.message : `WASM initialization failed: ${String(err)}`,
      },
    };
  }
}

/**
 * Render a single frame in-browser using the WASM compositor.
 * Drop-in replacement for `getNativeLabClient().renderFrame()`.
 */
export async function renderFrame(
  request: NativeLabFrameRequest,
  signal?: AbortSignal,
): Promise<NativeLabFrameResult> {
  const run = renderQueue.then(async () => {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const r = await getRenderer();
    try {
      const pngBytes = await r.render_frame(JSON.stringify(request));
      return {
        image: new Blob([pngBytes], { type: "image/png" }),
        contentType: "image/png",
        requestId: request.requestId,
        frameIndex: request.frameTime.frameIndex,
        metrics: {
          decodeTimeUs: null,
          composeTimeUs: null,
          readbackTimeUs: null,
          totalTimeUs: null,
          cacheHit: null,
        },
      } satisfies NativeLabFrameResult;
    } catch (err) {
      throw new ClypraWasmError(
        `Failed to render frame '${request.requestId}' at index ${request.frameTime.frameIndex}: ${
          err instanceof Error ? err.message : String(err)
        }`,
        err,
      );
    }
  });
  // A failed frame must not poison the queue for all future frames.
  renderQueue = run.then(() => undefined, () => undefined);
  return run;
}

/**
 * Whether the WASM renderer has been successfully initialised.
 * Useful for showing a "GPU ready" indicator in Studio UI.
 */
export function isRendererReady(): boolean {
  return renderer !== null;
}

/**
 * Register a font with the WASM compositor's font registry.
 *
 * Must be called after `probeNativeRenderer()` or `renderFrame()` has resolved
 * (i.e. after WASM is initialised), or this call will trigger initialisation.
 *
 * @param fontId   Stable lowercase-kebab font identifier, e.g. `"inter-variable"`.
 * @param fontBytes Raw bytes of a TrueType (.ttf), OpenType (.otf), or TTC font file.
 * @returns The 64-bit FNV-1a content hash of the registered font as a `bigint`.
 */
export async function registerFont(
  fontId: string,
  fontBytes: Uint8Array,
): Promise<bigint> {
  const r = await getRenderer();
  // register_font returns a u64 — wasm-bindgen maps this to a JS BigInt.
  const hash = r.register_font(fontId, fontBytes);
  return BigInt(hash as unknown as string);
}

/**
 * List all font IDs currently registered in the WASM font registry.
 * Useful for debugging and pre-flight font checks.
 */
export async function listFonts(): Promise<string[]> {
  const r = await getRenderer();
  // list_fonts returns a js_sys::Array of JsValue strings.
  const arr = r.list_fonts() as unknown as string[];
  return Array.from(arr);
}
