import { ResponsiveAnchorConfig, SpatialAnchorPoint } from "../types";

export interface ResolvedLayoutBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Computes resolved layer position based on 9-point spatial anchor config and canvas size.
 */
export function resolveAnchorPosition(
  anchor: ResponsiveAnchorConfig | undefined,
  currentBounds: { x: number; y: number; width: number; height: number },
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number; width: number; height: number } {
  if (!anchor) {
    return currentBounds;
  }

  let { width, height } = currentBounds;

  // Max width percentage constraint
  if (anchor.maxWidthPercentage && anchor.maxWidthPercentage > 0) {
    const maxW = (canvasWidth * anchor.maxWidthPercentage) / 100;
    if (width > maxW) {
      width = maxW;
    }
  }

  const point: SpatialAnchorPoint = anchor.anchorPoint || "center";
  const pctX = (anchor.offsetPercentageX ?? 0) / 100;
  const pctY = (anchor.offsetPercentageY ?? 0) / 100;
  const pxX = anchor.pixelOffsetX ?? 0;
  const pxY = anchor.pixelOffsetY ?? 0;

  let x = currentBounds.x;
  let y = currentBounds.y;

  switch (point) {
    case "top-left":
      x = canvasWidth * pctX + pxX;
      y = canvasHeight * pctY + pxY;
      break;
    case "top-center":
      x = canvasWidth / 2 - width / 2 + canvasWidth * pctX + pxX;
      y = canvasHeight * pctY + pxY;
      break;
    case "top-right":
      x = canvasWidth - width - canvasWidth * pctX + pxX;
      y = canvasHeight * pctY + pxY;
      break;
    case "middle-left":
      x = canvasWidth * pctX + pxX;
      y = canvasHeight / 2 - height / 2 + canvasHeight * pctY + pxY;
      break;
    case "center":
      x = canvasWidth / 2 - width / 2 + canvasWidth * pctX + pxX;
      y = canvasHeight / 2 - height / 2 + canvasHeight * pctY + pxY;
      break;
    case "middle-right":
      x = canvasWidth - width - canvasWidth * pctX + pxX;
      y = canvasHeight / 2 - height / 2 + canvasHeight * pctY + pxY;
      break;
    case "bottom-left":
      x = canvasWidth * pctX + pxX;
      y = canvasHeight - height - canvasHeight * pctY + pxY;
      break;
    case "bottom-center":
      x = canvasWidth / 2 - width / 2 + canvasWidth * pctX + pxX;
      y = canvasHeight - height - canvasHeight * pctY + pxY;
      break;
    case "bottom-right":
      x = canvasWidth - width - canvasWidth * pctX + pxX;
      y = canvasHeight - height - canvasHeight * pctY + pxY;
      break;
  }

  return { x, y, width, height };
}

/**
 * Standard aspect ratio dimensions preset
 */
export const ASPECT_RATIO_PRESETS = {
  "16:9": { width: 1920, height: 1080, label: "16:9 Widescreen (1920x1080)" },
  "9:16": { width: 1080, height: 1920, label: "9:16 Vertical (1080x1920)" },
  "1:1": { width: 1080, height: 1080, label: "1:1 Square (1080x1080)" },
  "4:5": { width: 1080, height: 1350, label: "4:5 Social (1080x1350)" },
} as const;
