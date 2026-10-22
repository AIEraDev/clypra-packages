/** Versioned, editable source of truth for authored text-bubble assets. */
export type BubbleTailSide = "bottom" | "top" | "left" | "right";

export interface ParametricBubbleDefinition {
  schemaVersion: 1;
  type: "clypra.textBubble";
  coordinateSpace: "normalized";
  geometry: {
    kind: "parametric-path";
    body: { cornerRadius: number };
    tail: { enabled: boolean; side: BubbleTailSide; anchor: number; width: number; depth: number; curvature: number };
  };
  layers: {
    fill: { color: string; opacity: number };
    outline: { color: string; width: number; roughness: number; seed: number };
    accent?: { color: string; opacity: number; texture: "none" | "hatch" | "chalk" };
  };
  textLayout: { padding: [number, number, number, number]; alignment: "left" | "center" | "right"; overflow: "grow" | "shrink-with-minimum" | "error" };
}

export type BubblePathCommand =
  | { kind: "move" | "line"; to: [number, number] }
  | { kind: "quadratic"; control: [number, number]; to: [number, number] }
  | { kind: "cubic"; control1: [number, number]; control2: [number, number]; to: [number, number] }
  | { kind: "close" };

/** A portable authored silhouette; all coordinates stay normalized for export parity. */
export interface FreeformBubbleDefinition {
  schemaVersion: 1;
  type: "clypra.textBubble";
  coordinateSpace: "normalized";
  geometry: { kind: "freeform-path"; closed: true; commands: BubblePathCommand[] };
  layers: ParametricBubbleDefinition["layers"];
  textLayout: ParametricBubbleDefinition["textLayout"];
}

export type BubbleAssetDefinition = ParametricBubbleDefinition | FreeformBubbleDefinition;

export const createBubbleAssetDefinition = (): ParametricBubbleDefinition => ({
  schemaVersion: 1, type: "clypra.textBubble", coordinateSpace: "normalized",
  geometry: { kind: "parametric-path", body: { cornerRadius: 0.12 }, tail: { enabled: true, side: "bottom", anchor: 0.22, width: 0.18, depth: 0.2, curvature: 0.55 } },
  layers: { fill: { color: "#7c3aed", opacity: 0.9 }, outline: { color: "#ffffff", width: 0.018, roughness: 0, seed: 1 } },
  textLayout: { padding: [0.1, 0.1, 0.18, 0.1], alignment: "center", overflow: "grow" },
});

/** Creates an editable starting silhouette, not a flattened preview image. */
export const createFreeformBubbleAssetDefinition = (): FreeformBubbleDefinition => ({
  ...createBubbleAssetDefinition(),
  geometry: {
    kind: "freeform-path",
    closed: true,
    commands: [
      { kind: "move", to: [0.12, 0.04] },
      { kind: "line", to: [0.88, 0.04] },
      { kind: "quadratic", control: [0.98, 0.04], to: [0.98, 0.16] },
      { kind: "line", to: [0.98, 0.7] },
      { kind: "quadratic", control: [0.98, 0.82], to: [0.86, 0.82] },
      { kind: "line", to: [0.38, 0.82] },
      { kind: "line", to: [0.22, 1] },
      { kind: "line", to: [0.27, 0.82] },
      { kind: "line", to: [0.12, 0.82] },
      { kind: "quadratic", control: [0.02, 0.82], to: [0.02, 0.7] },
      { kind: "line", to: [0.02, 0.16] },
      { kind: "quadratic", control: [0.02, 0.04], to: [0.12, 0.04] },
      { kind: "close" },
    ],
  },
});

const clamp = (value: number) => Math.max(0, Math.min(1, value));

/** Compiles normalized parametric geometry to a stable SVG path. */
export function compileBubblePath(definition: BubbleAssetDefinition): string {
  if (definition.geometry.kind === "freeform-path") {
    return definition.geometry.commands.map((command) => {
      if (command.kind === "close") return "Z";
      if (command.kind === "move") return `M ${command.to[0]} ${command.to[1]}`;
      if (command.kind === "line") return `L ${command.to[0]} ${command.to[1]}`;
      if (command.kind === "quadratic") return `Q ${command.control[0]} ${command.control[1]} ${command.to[0]} ${command.to[1]}`;
      if (command.kind === "cubic") return `C ${command.control1[0]} ${command.control1[1]} ${command.control2[0]} ${command.control2[1]} ${command.to[0]} ${command.to[1]}`;
      return "";
    }).join(" ");
  }
  const { body, tail } = definition.geometry;
  const r = clamp(body.cornerRadius) * 0.5;
  const anchor = clamp(tail.anchor);
  const tailWidth = clamp(tail.width) * 0.5;
  const depth = clamp(tail.depth);
  const left = clamp(anchor - tailWidth);
  const right = clamp(anchor + tailWidth);
  const bodyPath = `M ${r} 0 H ${1 - r} Q 1 0 1 ${r} V ${1 - r} Q 1 1 ${1 - r} 1 H ${r} Q 0 1 0 ${1 - r} V ${r} Q 0 0 ${r} 0 Z`;
  if (!tail.enabled) return bodyPath;

  if (tail.side === "bottom") {
    return `M ${r} 0 H ${1 - r} Q 1 0 1 ${r} V ${1 - r} Q 1 1 ${1 - r} 1 H ${right} Q ${anchor + tailWidth * 0.35} ${1 + depth * tail.curvature} ${anchor} ${1 + depth} Q ${anchor - tailWidth * 0.35} ${1 + depth * tail.curvature} ${left} 1 H ${r} Q 0 1 0 ${1 - r} V ${r} Q 0 0 ${r} 0 Z`;
  }
  if (tail.side === "top") {
    return `M ${r} 0 H ${left} Q ${anchor - tailWidth * 0.35} ${-depth * tail.curvature} ${anchor} ${-depth} Q ${anchor + tailWidth * 0.35} ${-depth * tail.curvature} ${right} 0 H ${1 - r} Q 1 0 1 ${r} V ${1 - r} Q 1 1 ${1 - r} 1 H ${r} Q 0 1 0 ${1 - r} V ${r} Q 0 0 ${r} 0 Z`;
  }
  if (tail.side === "left") {
    return `M ${r} 0 H ${1 - r} Q 1 0 1 ${r} V ${1 - r} Q 1 1 ${1 - r} 1 H ${r} Q 0 1 0 ${1 - r} V ${right} Q ${-depth * tail.curvature} ${anchor + tailWidth * 0.35} ${-depth} ${anchor} Q ${-depth * tail.curvature} ${anchor - tailWidth * 0.35} 0 ${left} V ${r} Q 0 0 ${r} 0 Z`;
  }
  return `M ${r} 0 H ${1 - r} Q 1 0 1 ${r} V ${left} Q ${1 + depth * tail.curvature} ${anchor - tailWidth * 0.35} ${1 + depth} ${anchor} Q ${1 + depth * tail.curvature} ${anchor + tailWidth * 0.35} 1 ${right} V ${1 - r} Q 1 1 ${1 - r} 1 H ${r} Q 0 1 0 ${1 - r} V ${r} Q 0 0 ${r} 0 Z`;
}

/** Produces a portable SVG artifact from the canonical editable definition. */
export function compileBubbleSvg(definition: BubbleAssetDefinition, width = 1000, height = 700): string {
  const { fill, outline, accent } = definition.layers;
  const texture = accent?.texture === "hatch"
    ? `<pattern id="hatch" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="24" stroke="${accent.color}" stroke-opacity="${accent.opacity}" stroke-width="3" /></pattern>`
    : "";
  const textureOverlay = accent?.texture === "hatch" ? `<path d="${compileBubblePath(definition)}" fill="url(#hatch)" />` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="-0.25 -0.25 1.5 1.5"><defs>${texture}</defs><path d="${compileBubblePath(definition)}" fill="${fill.color}" fill-opacity="${fill.opacity}" stroke="${outline.color}" stroke-width="${outline.width}" vector-effect="non-scaling-stroke" />${textureOverlay}</svg>`;
}

type BubbleCanvas = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function traceBubbleSilhouette(
  ctx: BubbleCanvas,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  tail: ParametricBubbleDefinition["geometry"]["tail"],
  tailDepth: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  const anchor = clamp(tail.anchor);
  const halfTail = clamp(tail.width) * (tail.side === "left" || tail.side === "right" ? height : width) / 2;
  const along = tail.side === "left" || tail.side === "right" ? y + height * anchor : x + width * anchor;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  if (tail.enabled && tail.side === "top") {
    ctx.lineTo(along - halfTail, y);
    ctx.quadraticCurveTo(along - halfTail * 0.35, y - tailDepth * tail.curvature, along, y - tailDepth);
    ctx.quadraticCurveTo(along + halfTail * 0.35, y - tailDepth * tail.curvature, along + halfTail, y);
  }
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  if (tail.enabled && tail.side === "right") {
    ctx.lineTo(x + width, along - halfTail);
    ctx.quadraticCurveTo(x + width + tailDepth * tail.curvature, along - halfTail * 0.35, x + width + tailDepth, along);
    ctx.quadraticCurveTo(x + width + tailDepth * tail.curvature, along + halfTail * 0.35, x + width, along + halfTail);
  }
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  if (tail.enabled && tail.side === "bottom") {
    ctx.lineTo(along + halfTail, y + height);
    ctx.quadraticCurveTo(along + halfTail * 0.35, y + height + tailDepth * tail.curvature, along, y + height + tailDepth);
    ctx.quadraticCurveTo(along - halfTail * 0.35, y + height + tailDepth * tail.curvature, along - halfTail, y + height);
  }
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  if (tail.enabled && tail.side === "left") {
    ctx.lineTo(x, along + halfTail);
    ctx.quadraticCurveTo(x - tailDepth * tail.curvature, along + halfTail * 0.35, x - tailDepth, along);
    ctx.quadraticCurveTo(x - tailDepth * tail.curvature, along - halfTail * 0.35, x, along - halfTail);
  }
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** Renders the editable definition directly, avoiding a separate Studio-only drawing model. */
export function renderBubbleAssetDefinition(
  ctx: BubbleCanvas,
  definition: BubbleAssetDefinition,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  if (definition.geometry.kind === "freeform-path") {
    renderFreeformBubbleAssetDefinition(ctx, definition as FreeformBubbleDefinition, x, y, width, height);
    return;
  }
  const { tail, body } = definition.geometry;
  const tailDepth = tail.enabled ? clamp(tail.depth) * (tail.side === "left" || tail.side === "right" ? width : height) : 0;
  const bodyX = x + (tail.side === "left" ? tailDepth : 0);
  const bodyY = y + (tail.side === "top" ? tailDepth : 0);
  const bodyWidth = width - (tail.side === "left" || tail.side === "right" ? tailDepth : 0);
  const bodyHeight = height - (tail.side === "top" || tail.side === "bottom" ? tailDepth : 0);
  const radius = clamp(body.cornerRadius) * Math.min(bodyWidth, bodyHeight) / 2;
  ctx.save();
  traceBubbleSilhouette(ctx, bodyX, bodyY, bodyWidth, bodyHeight, radius, tail, tailDepth);
  ctx.globalAlpha = definition.layers.fill.opacity;
  ctx.fillStyle = definition.layers.fill.color;
  ctx.fill();
  const accent = definition.layers.accent;
  if (accent && accent.texture !== "none") {
    ctx.save();
    ctx.clip();
    ctx.globalAlpha = accent.opacity;
    ctx.strokeStyle = accent.color;
    ctx.lineWidth = Math.max(1, Math.min(width, height) * 0.006);
    if (accent.texture === "hatch") {
      const spacing = Math.max(5, Math.min(width, height) * 0.09);
      for (let offset = -height; offset < width + height; offset += spacing) {
        ctx.beginPath();
        ctx.moveTo(x + offset, y + height);
        ctx.lineTo(x + offset + height, y);
        ctx.stroke();
      }
    } else {
      let state = definition.layers.outline.seed >>> 0;
      const nextRandom = () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 0x1_0000_0000;
      };
      const count = Math.max(18, Math.round((width * height) / 700));
      for (let index = 0; index < count; index += 1) {
        const px = x + nextRandom() * width;
        const py = y + nextRandom() * height;
        const length = 1 + nextRandom() * Math.min(width, height) * 0.025;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + length, py);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  if (definition.layers.outline.width > 0) {
    ctx.globalAlpha = 1;
    ctx.strokeStyle = definition.layers.outline.color;
    ctx.lineWidth = definition.layers.outline.width * Math.min(width, height);
    ctx.stroke();
  }
  ctx.restore();
}

function traceFreeformPath(ctx: BubbleCanvas, definition: FreeformBubbleDefinition, x: number, y: number, width: number, height: number): void {
  ctx.beginPath();
  for (const command of definition.geometry.commands) {
    if (command.kind === "close") ctx.closePath();
    else if (command.kind === "move") ctx.moveTo(x + command.to[0] * width, y + command.to[1] * height);
    else if (command.kind === "line") ctx.lineTo(x + command.to[0] * width, y + command.to[1] * height);
    else if (command.kind === "quadratic") ctx.quadraticCurveTo(x + command.control[0] * width, y + command.control[1] * height, x + command.to[0] * width, y + command.to[1] * height);
    else if (command.kind === "cubic") ctx.bezierCurveTo(x + command.control1[0] * width, y + command.control1[1] * height, x + command.control2[0] * width, y + command.control2[1] * height, x + command.to[0] * width, y + command.to[1] * height);
  }
}

function renderFreeformBubbleAssetDefinition(ctx: BubbleCanvas, definition: FreeformBubbleDefinition, x: number, y: number, width: number, height: number): void {
  ctx.save();
  traceFreeformPath(ctx, definition, x, y, width, height);
  ctx.globalAlpha = definition.layers.fill.opacity;
  ctx.fillStyle = definition.layers.fill.color;
  ctx.fill();
  if (definition.layers.outline.width > 0) {
    ctx.globalAlpha = 1;
    ctx.strokeStyle = definition.layers.outline.color;
    ctx.lineWidth = definition.layers.outline.width * Math.min(width, height);
    ctx.stroke();
  }
  ctx.restore();
}

export function validateBubbleAssetDefinition(definition: BubbleAssetDefinition): string[] {
  const errors: string[] = [];
  if (definition.schemaVersion !== 1 || definition.type !== "clypra.textBubble") errors.push("Unsupported bubble asset schema.");
  if (!/^#[0-9a-f]{6}$/i.test(definition.layers.fill.color)) errors.push("Fill color must be a six-digit hex value.");
  if (definition.layers.fill.opacity < 0 || definition.layers.fill.opacity > 1) errors.push("Fill opacity must be between 0 and 1.");
  if (!/^#[0-9a-f]{6}$/i.test(definition.layers.outline.color)) errors.push("Outline color must be a six-digit hex value.");
  if (definition.layers.outline.width < 0 || definition.layers.outline.width > 0.1) errors.push("Outline width must be normalized between 0 and 0.1.");
  if (definition.geometry.kind === "parametric-path") {
    if (definition.geometry.body.cornerRadius < 0 || definition.geometry.body.cornerRadius > 1) errors.push("Corner radius must be normalized.");
    if (definition.geometry.tail.anchor < 0 || definition.geometry.tail.anchor > 1) errors.push("Tail anchor must be normalized.");
    if (definition.geometry.tail.width < 0 || definition.geometry.tail.width > 1 || definition.geometry.tail.depth < 0 || definition.geometry.tail.depth > 1) errors.push("Tail width and depth must be normalized.");
  } else if (definition.geometry.commands.length < 4 || !definition.geometry.commands.some(command => command.kind === "close")) {
    errors.push("Freeform bubble paths must contain a closed silhouette.");
  }
  if (definition.textLayout.padding.some(value => value < 0 || value > 0.5)) errors.push("Text padding must be normalized between 0 and 0.5.");
  return errors;
}
