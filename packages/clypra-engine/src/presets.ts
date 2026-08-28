import { TextEffectConfig, Preset } from "./types";
import {
  DEFAULT_CANVAS_WIDTH,
  DEFAULT_CANVAS_HEIGHT,
  DEFAULT_FONT_SIZE,
} from "./engine/schema";

/** Style recipes (layer graphs): see `builtInRecipes` in src/engine/recipes.ts */

export const defaultConfig: TextEffectConfig = {
  text: "CLYPRA STUDIO",
  effectName: "My Effect",
  fontFamily: "Poppins",
  fontWeight: 700,
  fontStyle: "normal",
  fontSize: DEFAULT_FONT_SIZE,
  letterSpacing: 4,
  lineHeight: 1.2,
  fillType: "solid",
  fillColor: "#FFFFFF",
  fillGradientAngle: 90,
  fillGradientStops: [
    { color: "#FFFFFF", offset: 0 },
    { color: "#E0E0E0", offset: 100 },
  ],
  strokeEnabled: false,
  strokeColor: "#7C6FFF",
  strokeWidth: 4,
  strokePosition: "outside",
  strokeOpacity: 100,
  strokeLineJoin: "round",
  glowLayers: [
    { enabled: false, color: "#7C6FFF", blur: 20, opacity: 80, type: "outer" },
    { enabled: false, color: "#FF007C", blur: 40, opacity: 60, type: "outer" },
    { enabled: false, color: "#00F0FF", blur: 60, opacity: 40, type: "outer" },
  ],
  shadowEnabled: false,
  shadowColor: "#000000",
  shadowBlur: 10,
  shadowOffsetX: 5,
  shadowOffsetY: 5,
  shadowOpacity: 80,
  shadowType: "drop",
  bevelEnabled: false,
  bevelDepth: 5,
  bevelHighlight: "#FFFFFF",
  bevelShadow: "#000000",
  bevelDirection: "bottom-right",
  bevelCoreColor: "#000000",
  bevelEdgeColor: "#2A2A38",
  bevelEdgeWidth: 0,
  bevelBlur: 0,
  bevelBlurColor: "#000000",
  bevelPerspectiveEnabled: false,
  bevelVanishingPointX: 40,
  bevelVanishingPointY: 80,
  bevelFocalLength: 400,
  stackEnabled: false,
  stackCount: 3,
  stackOffsetX: 10,
  stackOffsetY: -10,
  stackOpacityDecay: 20,
  stackColor1: "#FF7C00",
  stackColor2: "#00FFDD",
  stackColor3: "#FF00AA",
  stackColor4: "#AA00FF",
  panelEnabled: false,
  panelColor: "#1E1E26",
  panelOpacity: 80,
  panelRadius: 12,
  panelPaddingX: 40,
  panelPaddingY: 20,
  panelStrokeEnabled: false,
  panelStrokeColor: "#2A2A38",
  panelStrokeWidth: 2,
  canvasWidth: DEFAULT_CANVAS_WIDTH,
  canvasHeight: DEFAULT_CANVAS_HEIGHT,
  textPosX: "center",
  textPosY: "middle",
  wrapText: true,
  autoFitText: false,
};

/**
 * Return a fresh, explicit blank authoring state.
 *
 * A blank state is intentionally different from a loosely spread object:
 * every optional visual contributor is disabled while its parameters remain
 * present for the controls and the canonical scene migration. This prevents
 * object presence (panel/glow/shadow/etc.) from being interpreted as active.
 */
export function createBlankTextEffectConfig(): TextEffectConfig {
  return {
    ...defaultConfig,
    text: "MY TEXT",
    effectName: "Custom Effect",
    strokeEnabled: false,
    shadowEnabled: false,
    bevelEnabled: false,
    stackEnabled: false,
    panelEnabled: false,
    panelStrokeEnabled: false,
    perCharFillEnabled: false,
    glowLayers: defaultConfig.glowLayers.map((layer) => ({
      ...layer,
      enabled: false,
    })),
  };
}

export const builtInPresets: Preset[] = [];
