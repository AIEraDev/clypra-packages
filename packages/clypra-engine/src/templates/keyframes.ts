import {
  TemplateKeyframe,
  AnimatableValue,
  TemplateEasingFunction,
  BezierControlPoints,
  SpringParams,
} from "../types";

/**
 * Newton-Raphson approximation solver for cubic bezier curve easing.
 * Computes exact y given x in [0, 1].
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  return function (t: number): number {
    if (t <= 0) return 0;
    if (t >= 1) return 1;

    let tApprox = t;
    for (let i = 0; i < 8; i++) {
      const currentX =
        3 * (1 - tApprox) * (1 - tApprox) * tApprox * x1 +
        3 * (1 - tApprox) * tApprox * tApprox * x2 +
        tApprox * tApprox * tApprox;
      const slope =
        3 * (1 - tApprox) * (1 - tApprox) * x1 +
        6 * (1 - tApprox) * tApprox * (x2 - x1) +
        3 * tApprox * tApprox * (1 - x2);
      if (Math.abs(slope) < 1e-6) break;
      tApprox -= (currentX - t) / slope;
    }

    tApprox = Math.max(0, Math.min(1, tApprox));
    return (
      3 * (1 - tApprox) * (1 - tApprox) * tApprox * y1 +
      3 * (1 - tApprox) * tApprox * tApprox * y2 +
      tApprox * tApprox * tApprox
    );
  };
}

/**
 * Physics-based damped spring oscillator solver.
 */
export function solveSpring(t: number, params?: SpringParams): number {
  const mass = params?.mass ?? 1;
  const stiffness = params?.stiffness ?? 100;
  const damping = params?.damping ?? 10;

  const omega0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));

  if (zeta < 1) {
    // Underdamped
    const omegaD = omega0 * Math.sqrt(1 - zeta * zeta);
    const envelope = Math.exp(-zeta * omega0 * t);
    return 1 - envelope * (Math.cos(omegaD * t) + (zeta / Math.sqrt(1 - zeta * zeta)) * Math.sin(omegaD * t));
  } else {
    // Critically damped or overdamped fallback
    return 1 - (1 + omega0 * t) * Math.exp(-omega0 * t);
  }
}

/**
 * Standard bounce easing out.
 */
function easeOutBounce(t: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;

  if (t < 1 / d1) {
    return n1 * t * t;
  } else if (t < 2 / d1) {
    let tVal = t - 1.5 / d1;
    return n1 * tVal * tVal + 0.75;
  } else if (t < 2.5 / d1) {
    let tVal = t - 2.25 / d1;
    return n1 * tVal * tVal + 0.9375;
  } else {
    let tVal = t - 2.625 / d1;
    return n1 * tVal * tVal + 0.984375;
  }
}

/**
 * Check if a value is keyframed
 */
export function isKeyframed<T>(value: AnimatableValue<T>): value is { keyframes: TemplateKeyframe<T>[] } {
  return typeof value === "object" && value !== null && "keyframes" in value && Array.isArray((value as any).keyframes);
}

/**
 * Get the static value or evaluate keyframes at a specific time
 */
export function evaluateAnimatable<T>(value: AnimatableValue<T>, time: number, templateDuration: number): T {
  if (!isKeyframed(value)) {
    return value;
  }

  const { keyframes } = value;

  if (keyframes.length === 0) {
    throw new Error("Keyframes array cannot be empty");
  }

  if (keyframes.length === 1) {
    return keyframes[0].value;
  }

  // Sort keyframes by time
  const sorted = [...keyframes].sort((a, b) => a.time - b.time);

  // Before first keyframe
  if (time <= sorted[0].time) {
    return sorted[0].value;
  }

  // After last keyframe
  if (time >= sorted[sorted.length - 1].time) {
    return sorted[sorted.length - 1].value;
  }

  // Find the two keyframes to interpolate between
  let leftIdx = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    if (time >= sorted[i].time && time <= sorted[i + 1].time) {
      leftIdx = i;
      break;
    }
  }

  const left = sorted[leftIdx];
  const right = sorted[leftIdx + 1];

  // Calculate interpolation factor
  const range = right.time - left.time;
  const t = range === 0 ? 0 : (time - left.time) / range;

  // Apply easing
  const easedT = applyEasing(t, right.easing || "linear", right.bezier, right.spring);

  // Interpolate based on value type
  return interpolateValue(left.value, right.value, easedT);
}

/**
 * Apply easing function to interpolation factor
 */
export function applyEasing(
  t: number,
  easing: TemplateEasingFunction,
  bezier?: BezierControlPoints,
  spring?: SpringParams
): number {
  switch (easing) {
    case "linear":
      return t;
    case "ease-in":
      return t * t;
    case "ease-out":
      return t * (2 - t);
    case "ease-in-out":
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    case "ease":
      return cubicBezier(0.25, 0.1, 0.25, 1.0)(t);
    case "cubic-bezier":
      if (bezier) {
        return cubicBezier(bezier.x1, bezier.y1, bezier.x2, bezier.y2)(t);
      }
      return cubicBezier(0.4, 0.0, 0.2, 1.0)(t);
    case "spring":
      return solveSpring(t, spring);
    case "bounce":
      return easeOutBounce(t);
    default:
      return t;
  }
}

/**
 * Interpolate between two values
 */
export function interpolateValue<T>(from: T, to: T, t: number): T {
  // Handle numbers
  if (typeof from === "number" && typeof to === "number") {
    return (from + (to - from) * t) as T;
  }

  // Handle colors
  if (typeof from === "string" && typeof to === "string") {
    const isFromColor = from.startsWith("#") || from.startsWith("rgb");
    const isToColor = to.startsWith("#") || to.startsWith("rgb");
    if (isFromColor && isToColor) {
      return interpolateColorString(from, to, t) as T;
    }
  }

  // For other types, snap to target at midpoint
  return t < 0.5 ? from : to;
}

interface ParsedColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

function parseColor(color: string): ParsedColor | null {
  if (!color) return null;
  const trimmed = color.trim().toLowerCase();

  // Hex format: #RGB, #RGBA, #RRGGBB, #RRGGBBAA
  if (trimmed.startsWith("#")) {
    const hex = trimmed.slice(1);
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
        a: 1,
      };
    }
    if (hex.length === 4) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
        a: parseInt(hex[3] + hex[3], 16) / 255,
      };
    }
    if (hex.length === 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: 1,
      };
    }
    if (hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: parseInt(hex.slice(6, 8), 16) / 255,
      };
    }
  }

  // rgb/rgba format: rgba(r, g, b, a) or rgb(r, g, b)
  const match = trimmed.match(/^rgba?\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/);
  if (match) {
    return {
      r: Math.min(255, Math.max(0, parseFloat(match[1]))),
      g: Math.min(255, Math.max(0, parseFloat(match[2]))),
      b: Math.min(255, Math.max(0, parseFloat(match[3]))),
      a: match[4] !== undefined ? Math.min(1, Math.max(0, parseFloat(match[4]))) : 1,
    };
  }

  return null;
}

/**
 * Interpolate between two color strings (hex or rgba)
 */
export function interpolateColorString(from: string, to: string, t: number): string {
  const c1 = parseColor(from);
  const c2 = parseColor(to);

  if (!c1 || !c2) {
    return t < 0.5 ? from : to;
  }

  const r = Math.round(c1.r + (c2.r - c1.r) * t);
  const g = Math.round(c1.g + (c2.g - c1.g) * t);
  const b = Math.round(c1.b + (c2.b - c1.b) * t);
  const a = Math.round((c1.a + (c2.a - c1.a) * t) * 100) / 100;

  if (a >= 1) {
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * Helper to create a keyframed value
 */
export function createKeyframed<T>(keyframes: TemplateKeyframe<T>[]): { keyframes: TemplateKeyframe<T>[] } {
  return { keyframes };
}

/**
 * Helper to add a keyframe to an animatable value
 */
export function addKeyframe<T>(
  value: AnimatableValue<T>,
  time: number,
  newValue: T,
  easing: TemplateEasingFunction = "ease-in-out",
  bezier?: BezierControlPoints,
  spring?: SpringParams
): { keyframes: TemplateKeyframe<T>[] } {
  const existing: TemplateKeyframe<T>[] = isKeyframed(value)
    ? value.keyframes
    : [{ time: 0, value: value as T, easing: "linear" as TemplateEasingFunction }];

  // Check if keyframe already exists at this time
  const existingIndex = existing.findIndex((kf) => Math.abs(kf.time - time) < 0.01);

  const newKf: TemplateKeyframe<T> = { time, value: newValue, easing, bezier, spring };

  if (existingIndex >= 0) {
    const updated = [...existing];
    updated[existingIndex] = newKf;
    return { keyframes: updated.sort((a, b) => a.time - b.time) };
  }

  return {
    keyframes: [...existing, newKf].sort((a, b) => a.time - b.time),
  };
}

/**
 * Helper to remove a keyframe at a specific time
 */
export function removeTemplateKeyframe<T>(value: AnimatableValue<T>, time: number): AnimatableValue<T> {
  if (!isKeyframed(value)) {
    return value;
  }

  const filtered = value.keyframes.filter((kf) => Math.abs(kf.time - time) >= 0.01);

  if (filtered.length === 0) {
    throw new Error("Cannot remove all keyframes");
  }

  if (filtered.length === 1) {
    return filtered[0].value;
  }

  return { keyframes: filtered };
}
