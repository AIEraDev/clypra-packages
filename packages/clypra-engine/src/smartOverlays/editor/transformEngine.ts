import type { SceneNode } from "../overlayDocumentSchema.js";

export type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export interface ResizeOptions {
  lockAspectRatio?: boolean;
  minWidth?: number;
  minHeight?: number;
}

export class TransformEngine {
  /**
   * Translate node coordinates by delta (dx, dy).
   */
  public static moveNode<T extends SceneNode>(node: T, dx: number, dy: number): T {
    return {
      ...node,
      x: Math.round(node.x + dx),
      y: Math.round(node.y + dy),
    };
  }

  /**
   * Keyboard directional nudge (1px step or 10px shift-step).
   */
  public static nudgeNode<T extends SceneNode>(
    node: T,
    direction: "up" | "down" | "left" | "right",
    amount = 1
  ): T {
    const dx = direction === "left" ? -amount : direction === "right" ? amount : 0;
    const dy = direction === "up" ? -amount : direction === "down" ? amount : 0;
    return this.moveNode(node, dx, dy);
  }

  /**
   * Resize a node from an 8-direction handle knob.
   */
  public static resizeNode<T extends SceneNode>(
    node: T,
    handle: ResizeHandle,
    dx: number,
    dy: number,
    options: ResizeOptions = {}
  ): T {
    const { lockAspectRatio = false, minWidth = 10, minHeight = 10 } = options;

    const initialW = typeof node.width === "number" ? node.width : 200;
    const initialH = typeof node.height === "number" ? node.height : 50;

    let newX = node.x;
    let newY = node.y;
    let newWidth = initialW;
    let newHeight = initialH;
    const initialAspect = initialW > 0 && initialH > 0 ? initialW / initialH : 1.0;

    switch (handle) {
      case "e":
        newWidth = Math.max(minWidth, initialW + dx);
        if (lockAspectRatio) newHeight = Math.max(minHeight, newWidth / initialAspect);
        break;

      case "w": {
        const potentialW = initialW - dx;
        if (potentialW >= minWidth) {
          newWidth = potentialW;
          newX = node.x + dx;
        } else {
          newWidth = minWidth;
          newX = node.x + (initialW - minWidth);
        }
        if (lockAspectRatio) newHeight = Math.max(minHeight, newWidth / initialAspect);
        break;
      }

      case "s":
        newHeight = Math.max(minHeight, initialH + dy);
        if (lockAspectRatio) newWidth = Math.max(minWidth, newHeight * initialAspect);
        break;

      case "n": {
        const potentialH = initialH - dy;
        if (potentialH >= minHeight) {
          newHeight = potentialH;
          newY = node.y + dy;
        } else {
          newHeight = minHeight;
          newY = node.y + (initialH - minHeight);
        }
        if (lockAspectRatio) newWidth = Math.max(minWidth, newHeight * initialAspect);
        break;
      }

      case "se":
        newWidth = Math.max(minWidth, initialW + dx);
        newHeight = Math.max(minHeight, initialH + dy);
        if (lockAspectRatio) {
          const scale = Math.max(newWidth / initialW, newHeight / initialH);
          newWidth = Math.max(minWidth, initialW * scale);
          newHeight = Math.max(minHeight, initialH * scale);
        }
        break;

      case "nw": {
        const potW = initialW - dx;
        const potH = initialH - dy;
        if (potW >= minWidth) {
          newWidth = potW;
          newX = node.x + dx;
        }
        if (potH >= minHeight) {
          newHeight = potH;
          newY = node.y + dy;
        }
        if (lockAspectRatio) {
          const scale = Math.max(newWidth / initialW, newHeight / initialH);
          newWidth = Math.max(minWidth, initialW * scale);
          newHeight = Math.max(minHeight, initialH * scale);
        }
        break;
      }

      case "ne": {
        newWidth = Math.max(minWidth, initialW + dx);
        const potH = initialH - dy;
        if (potH >= minHeight) {
          newHeight = potH;
          newY = node.y + dy;
        }
        if (lockAspectRatio) {
          newHeight = Math.max(minHeight, newWidth / initialAspect);
        }
        break;
      }

      case "sw": {
        const potW = initialW - dx;
        if (potW >= minWidth) {
          newWidth = potW;
          newX = node.x + dx;
        }
        newHeight = Math.max(minHeight, initialH + dy);
        if (lockAspectRatio) {
          newWidth = Math.max(minWidth, newHeight * initialAspect);
        }
        break;
      }
    }

    return {
      ...node,
      x: Math.round(newX),
      y: Math.round(newY),
      width: Math.round(newWidth),
      height: Math.round(newHeight),
    };
  }

  /**
   * Align multiple nodes relative to each other or canvas boundaries.
   */
  public static alignNodes(
    nodes: SceneNode[],
    alignment: "left" | "center" | "right" | "top" | "middle" | "bottom",
    canvasBounds?: { width: number; height: number }
  ): SceneNode[] {
    if (nodes.length === 0) return [];

    let targetCoord = 0;
    if (canvasBounds) {
      switch (alignment) {
        case "left": targetCoord = 0; break;
        case "center": targetCoord = canvasBounds.width / 2; break;
        case "right": targetCoord = canvasBounds.width; break;
        case "top": targetCoord = 0; break;
        case "middle": targetCoord = canvasBounds.height / 2; break;
        case "bottom": targetCoord = canvasBounds.height; break;
      }
    } else {
      // Relative to selection bounds
      const minX = Math.min(...nodes.map((n) => n.x));
      const maxX = Math.max(...nodes.map((n) => n.x + (typeof n.width === "number" ? n.width : 0)));
      const minY = Math.min(...nodes.map((n) => n.y));
      const maxY = Math.max(...nodes.map((n) => n.y + (typeof n.height === "number" ? n.height : 0)));

      switch (alignment) {
        case "left": targetCoord = minX; break;
        case "center": targetCoord = minX + (maxX - minX) / 2; break;
        case "right": targetCoord = maxX; break;
        case "top": targetCoord = minY; break;
        case "middle": targetCoord = minY + (maxY - minY) / 2; break;
        case "bottom": targetCoord = maxY; break;
      }
    }

    return nodes.map((node) => {
      let updatedX = node.x;
      let updatedY = node.y;
      const nW = typeof node.width === "number" ? node.width : 0;
      const nH = typeof node.height === "number" ? node.height : 0;

      switch (alignment) {
        case "left":
          updatedX = targetCoord;
          break;
        case "center":
          updatedX = Math.round(targetCoord - nW / 2);
          break;
        case "right":
          updatedX = Math.round(targetCoord - nW);
          break;
        case "top":
          updatedY = targetCoord;
          break;
        case "middle":
          updatedY = Math.round(targetCoord - nH / 2);
          break;
        case "bottom":
          updatedY = Math.round(targetCoord - nH);
          break;
      }

      return { ...node, x: updatedX, y: updatedY };
    });
  }

  /**
   * Distribute multiple nodes evenly along horizontal or vertical axis.
   */
  public static distributeNodes(nodes: SceneNode[], axis: "horizontal" | "vertical"): SceneNode[] {
    if (nodes.length <= 2) return nodes;

    const sorted = [...nodes].sort((a, b) => (axis === "horizontal" ? a.x - b.x : a.y - b.y));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    if (axis === "horizontal") {
      const lastW = typeof last.width === "number" ? last.width : 0;
      const totalSpan = last.x + lastW - first.x;
      const totalNodeWidths = sorted.reduce((sum, n) => sum + (typeof n.width === "number" ? n.width : 0), 0);
      const totalGapSpace = totalSpan - totalNodeWidths;
      const gap = totalGapSpace / (sorted.length - 1);

      let currentX = first.x;
      return sorted.map((node, i) => {
        const nW = typeof node.width === "number" ? node.width : 0;
        if (i === 0) {
          currentX += nW + gap;
          return node;
        }
        const updated = { ...node, x: Math.round(currentX) };
        currentX += nW + gap;
        return updated;
      });
    } else {
      const lastH = typeof last.height === "number" ? last.height : 0;
      const totalSpan = last.y + lastH - first.y;
      const totalNodeHeights = sorted.reduce((sum, n) => sum + (typeof n.height === "number" ? n.height : 0), 0);
      const totalGapSpace = totalSpan - totalNodeHeights;
      const gap = totalGapSpace / (sorted.length - 1);

      let currentY = first.y;
      return sorted.map((node, i) => {
        const nH = typeof node.height === "number" ? node.height : 0;
        if (i === 0) {
          currentY += nH + gap;
          return node;
        }
        const updated = { ...node, y: Math.round(currentY) };
        currentY += nH + gap;
        return updated;
      });
    }
  }
}
