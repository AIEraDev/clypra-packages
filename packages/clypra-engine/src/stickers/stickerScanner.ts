/**
 * Shared Sticker Scanner and Validator Module
 *
 * Single canonical implementation shared across:
 * - clypra-packages (@clypra-studio/engine)
 * - clypra-studio (Client-side Sticker Builder)
 * - clypra-api (Server-side validation & staging)
 * - clypra-api (CI validator script)
 */

export const MAX_LOTTIE_BYTES = 300 * 1024; // 300 KiB = 307,200 bytes
export const MAX_ASSET_BYTES = 2 * 1024 * 1024; // 2 MiB = 2,097,152 bytes

export interface LottieScanResult {
  valid: boolean;
  errors: string[];
  dimensions?: { width: number; height: number };
  animation?: {
    durationMs: number;
    fps: number;
    loop: boolean;
    lottie: {
      layerCount: number;
      hasExpressions: boolean;
    };
  };
}

export interface AssetScanResult {
  valid: boolean;
  errors: string[];
  bytes: number;
  mime: "application/json" | "image/webp" | "image/png" | "image/svg+xml" | "application/octet-stream";
  dimensions?: { width: number; height: number };
  animation?: LottieScanResult["animation"];
}

/**
 * Recursively scans Lottie node tree for expressions and external URLs.
 */
export function scanLottieNodes(node: any, found = { expressions: 0, remoteUrls: 0 }) {
  if (Array.isArray(node)) {
    for (const item of node) {
      scanLottieNodes(item, found);
    }
  } else if (node && typeof node === "object") {
    // In Lottie, a property object with string "x" next to "k" is an expression
    if (typeof node.x === "string" && node.x.trim() !== "" && "k" in node) {
      found.expressions++;
    }
    for (const value of Object.values(node)) {
      scanLottieNodes(value, found);
    }
  } else if (typeof node === "string" && /^https?:\/\//i.test(node)) {
    found.remoteUrls++;
  }
  return found;
}

/**
 * Inspects parsed or stringified Lottie JSON data.
 */
export function inspectLottieJson(jsonOrString: string | Record<string, any>): LottieScanResult {
  const errors: string[] = [];
  let json: any;

  if (typeof jsonOrString === "string") {
    try {
      json = JSON.parse(jsonOrString);
    } catch (err: any) {
      return { valid: false, errors: [`Lottie file is not valid JSON: ${err.message}`] };
    }
  } else {
    json = jsonOrString;
  }

  if (!json || typeof json !== "object") {
    return { valid: false, errors: ["Lottie data must be a JSON object"] };
  }

  // Header verification
  for (const field of ["v", "fr", "ip", "op", "w", "h", "layers"]) {
    if (!(field in json)) {
      errors.push(`Lottie header missing required field "${field}"`);
    }
  }

  const found = scanLottieNodes(json);
  if (found.expressions > 0) {
    errors.push(`Lottie contains ${found.expressions} expression(s); expressions are strictly forbidden`);
  }
  if (found.remoteUrls > 0) {
    errors.push(`Lottie references ${found.remoteUrls} remote URL(s); all assets must be embedded`);
  }

  const fps = typeof json.fr === "number" && json.fr > 0 ? json.fr : 30;
  const ip = typeof json.ip === "number" ? json.ip : 0;
  const op = typeof json.op === "number" ? json.op : ip;
  const durationMs = Math.round(((op - ip) / fps) * 1000);
  const layerCount = Array.isArray(json.layers) ? json.layers.length : 0;

  const width = Math.round(Number(json.w || 0));
  const height = Math.round(Number(json.h || 0));

  if (width < 16 || width > 2048) {
    errors.push(`Lottie width ${width} is outside permitted range [16, 2048]`);
  }
  if (height < 16 || height > 2048) {
    errors.push(`Lottie height ${height} is outside permitted range [16, 2048]`);
  }

  return {
    valid: errors.length === 0,
    errors,
    dimensions: { width, height },
    animation: {
      durationMs: Math.max(1, durationMs),
      fps,
      loop: true,
      lottie: {
        layerCount,
        hasExpressions: false,
      },
    },
  };
}

/**
 * Sniffs an asset buffer or string to detect MIME type, dimensions, and Lottie validity.
 */
export function inspectStickerAsset(
  data: Uint8Array | ArrayBuffer | string,
  filenameHint = ""
): AssetScanResult {
  const errors: string[] = [];
  let u8: Uint8Array;

  if (typeof data === "string") {
    u8 = new TextEncoder().encode(data);
  } else if (data instanceof Uint8Array) {
    u8 = data;
  } else {
    u8 = new Uint8Array(data);
  }

  const bytes = u8.length;

  // PNG magic bytes
  const isPng =
    u8.length >= 8 &&
    u8[0] === 0x89 &&
    u8[1] === 0x50 &&
    u8[2] === 0x4e &&
    u8[3] === 0x47 &&
    u8[4] === 0x0d &&
    u8[5] === 0x0a &&
    u8[6] === 0x1a &&
    u8[7] === 0x0a;

  // WebP magic bytes
  const isWebp =
    u8.length >= 12 &&
    u8[0] === 0x52 &&
    u8[1] === 0x49 &&
    u8[2] === 0x46 &&
    u8[3] === 0x46 &&
    u8[8] === 0x57 &&
    u8[9] === 0x45 &&
    u8[10] === 0x42 &&
    u8[11] === 0x50;

  // JSON
  const isJson =
    !isPng &&
    !isWebp &&
    (filenameHint.toLowerCase().endsWith(".json") || u8[0] === 0x7b);

  // SVG
  const isSvg =
    !isPng &&
    !isWebp &&
    !isJson &&
    (filenameHint.toLowerCase().endsWith(".svg") || u8[0] === 0x3c);

  if (isJson) {
    if (bytes > MAX_LOTTIE_BYTES) {
      errors.push(`Lottie file size (${bytes} bytes) exceeds maximum limit of ${MAX_LOTTIE_BYTES} bytes (300 KB)`);
    }
    const text = new TextDecoder("utf8").decode(u8);
    const lottieScan = inspectLottieJson(text);
    if (!lottieScan.valid) {
      errors.push(...lottieScan.errors);
    }
    return {
      valid: errors.length === 0,
      errors,
      bytes,
      mime: "application/json",
      dimensions: lottieScan.dimensions,
      animation: lottieScan.animation,
    };
  }

  if (bytes > MAX_ASSET_BYTES) {
    errors.push(`Asset file size (${bytes} bytes) exceeds maximum limit of ${MAX_ASSET_BYTES} bytes (2 MB)`);
  }

  if (isPng) {
    let width = 0;
    let height = 0;
    if (u8.length >= 24) {
      const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
      width = view.getUint32(16);
      height = view.getUint32(20);
    }
    return {
      valid: errors.length === 0,
      errors,
      bytes,
      mime: "image/png",
      dimensions: width > 0 && height > 0 ? { width, height } : undefined,
    };
  }

  if (isWebp) {
    return {
      valid: errors.length === 0,
      errors,
      bytes,
      mime: "image/webp",
    };
  }

  if (isSvg) {
    return {
      valid: errors.length === 0,
      errors,
      bytes,
      mime: "image/svg+xml",
    };
  }

  return {
    valid: false,
    errors: ["Unsupported file format; allowed formats are Lottie JSON, WebP, PNG, and SVG"],
    bytes,
    mime: "application/octet-stream",
  };
}

/**
 * Universal SHA-256 hash helper supporting both Web Crypto API (browser) and Node.js.
 */
export async function calculateSha256(data: Uint8Array | ArrayBuffer | string): Promise<string> {
  const u8 = typeof data === "string"
    ? new TextEncoder().encode(data)
    : data instanceof Uint8Array
      ? data
      : new Uint8Array(data);

  if (typeof crypto !== "undefined" && crypto.subtle) {
    const hashBuf = await crypto.subtle.digest("SHA-256", u8);
    return Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  // Node.js fallback
  try {
    // @ts-ignore - dynamic import in browser/DOM environments without @types/node
    const nodeCrypto: any = await import("node:crypto");
    return nodeCrypto.createHash("sha256").update(u8).digest("hex");
  } catch {
    throw new Error("No cryptographic hash implementation available");
  }
}
