import {
  TEXT_TEMPLATE_KIND,
  TEXT_TEMPLATE_RENDERER_VERSION,
  TEXT_TEMPLATE_SCHEMA_VERSION,
  type TemplateControl,
  type TemplateDependencyManifest,
  type TemplateMetadata,
  type TemplateNode,
  type TemplateRevision,
  type TemplateTiming,
  type TextTemplateArtifact,
  type TextTemplateDocument,
  type TemplatePropertyKeyframes,
} from "./contract.js";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`)
    .join(",")}}`;
}

export function canonicalTemplateHash(value: unknown): string {
  const input = stableStringify(value);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function now(): string {
  return new Date().toISOString();
}

function resolveAnimatableValue<T>(raw: unknown, fallback: T): T {
  if (raw == null) return fallback;
  if (
    typeof raw === "object" &&
    raw !== null &&
    "keyframes" in raw &&
    Array.isArray((raw as any).keyframes)
  ) {
    const kfs = (raw as any).keyframes;
    if (kfs.length > 0 && kfs[0]?.value !== undefined) {
      return kfs[0].value as T;
    }
  }
  return raw as T;
}

function resolveNumericProperty(raw: unknown, fallback: number): number {
  const unwrapped = resolveAnimatableValue(raw, fallback);
  const n = Number(unwrapped);
  return Number.isFinite(n) ? n : fallback;
}

function resolveStringProperty(raw: unknown, fallback: string): string {
  const unwrapped = resolveAnimatableValue(raw, fallback);
  return unwrapped != null ? String(unwrapped) : fallback;
}

function resolveDimension(raw: unknown, fallback: number): number | "auto" {
  if (raw === "auto") return "auto";
  const unwrapped = resolveAnimatableValue<unknown>(raw, fallback);
  if (unwrapped === "auto") return "auto";
  const n = Number(unwrapped);
  return Number.isFinite(n) ? n : fallback;
}

function propertyKeyframes(layer: any): TemplatePropertyKeyframes | undefined {
  const result: TemplatePropertyKeyframes = {};
  for (const property of ["x", "y", "width", "height", "opacity", "fontSize", "fontWeight", "letterSpacing"]) {
    const value = layer?.[property];
    if (value && typeof value === "object" && Array.isArray(value.keyframes) && value.keyframes.length > 0) {
      result[property] = { keyframes: clone(value.keyframes) };
    }
  }
  return Object.keys(result).length ? result : undefined;
}

function nodeAnimation(layer: any): any {
  const propertyFrames = propertyKeyframes(layer);
  if (!propertyFrames) return layer?.animation;
  return {
    ...(layer?.animation || { in: "none", out: "none", inDuration: 0, outDuration: 0, hold: "full" }),
    propertyKeyframes: propertyFrames,
  };
}

function legacyLayerToNode(layer: any, index: number): TemplateNode {
  const id = String(layer?.id || `${layer?.kind || "node"}-${index + 1}`);
  const x = resolveNumericProperty(layer?.x ?? layer?.relativePosition?.x, 0);
  const y = resolveNumericProperty(layer?.y ?? layer?.relativePosition?.y, 0);
  const width = resolveDimension(layer?.width, 400);
  const height = resolveDimension(layer?.height, 120);
  const animation = nodeAnimation(layer);
  const anchor = layer?.anchor;
  const parentId = layer?.parentId;
  const visible = layer?.visible !== false;
  if (layer?.kind === "container" || layer?.kind === "group") {
    const container = layer?.containerProperties || layer;
    const layout = container?.layout || {};
    return {
      id,
      name: String(layer?.name || id),
      type: "container",
      layout: {
        type: layout.type === "absolute" ? "absolute" : "flex",
        direction: layout.direction === "column" ? "column" : "row",
        gap: resolveNumericProperty(layout.gap, 0),
        alignItems: ["start", "center", "end", "stretch"].includes(
          layout.alignItems,
        )
          ? layout.alignItems
          : "center",
        justifyContent: [
          "start",
          "center",
          "end",
          "space-between",
          "space-around",
        ].includes(layout.justifyContent)
          ? layout.justifyContent
          : "start",
        paddingTop: resolveNumericProperty(
          layout.paddingTop ?? container.paddingTop,
          0,
        ),
        paddingRight: resolveNumericProperty(
          layout.paddingRight ?? container.paddingRight,
          0,
        ),
        paddingBottom: resolveNumericProperty(
          layout.paddingBottom ?? container.paddingBottom,
          0,
        ),
        paddingLeft: resolveNumericProperty(
          layout.paddingLeft ?? container.paddingLeft,
          0,
        ),
      },
      x,
      y,
      width,
      height,
      visible,
      style: {
        backgroundColor: container?.backgroundColor
          ? resolveStringProperty(container.backgroundColor, "")
          : undefined,
        backgroundOpacity: resolveNumericProperty(
          container?.backgroundOpacity,
          1,
        ),
        borderRadius: resolveNumericProperty(
          container?.backgroundRadius ?? container?.borderRadius,
          0,
        ),
        borderColor:
          container?.backgroundBorderColor ?? container?.borderColor
            ? resolveStringProperty(
                container.backgroundBorderColor ?? container.borderColor,
                "",
              )
            : undefined,
        borderWidth: resolveNumericProperty(
          container?.backgroundBorderWidth ?? container?.borderWidth,
          0,
        ),
        opacity: resolveNumericProperty(container?.opacity, 1),
      },
      animation,
      anchor,
      parentId,
    };
  }

  if (layer?.kind === "shape" || layer?.kind === "solid") {
    const shape = layer?.solidProperties || layer;
    return {
      id,
      name: String(layer?.name || id),
      type: "shape",
      shapeType:
        shape?.shape === "circle"
          ? "circle"
          : shape?.shape === "line"
          ? "line"
          : "rectangle",
      x,
      y,
      width: typeof width === "number" ? width : 400,
      height: typeof height === "number" ? height : 200,
      visible,
      style: {
        fillColor: resolveStringProperty(
          shape?.fill ?? shape?.color,
          "#000000",
        ),
        fillOpacity: resolveNumericProperty(
          shape?.opacity ?? shape?.fillOpacity,
          1,
        ),
        strokeColor: shape?.stroke?.color
          ? resolveStringProperty(shape.stroke.color, "#000000")
          : undefined,
        strokeWidth: shape?.stroke?.width
          ? resolveNumericProperty(shape.stroke.width, 0)
          : undefined,
      },
      animation,
      anchor,
      parentId,
    };
  }

  if (layer?.kind === "image") {
    const image = layer?.imageProperties || layer;
    return {
      id,
      name: String(layer?.name || id),
      type: "media",
      mediaType: "image",
      x,
      y,
      width: typeof width === "number" ? width : 400,
      height: typeof height === "number" ? height : 300,
      visible,
      assetId: image?.assetId,
      src: image?.url,
      style: { opacity: resolveNumericProperty(image?.opacity, 1) },
      animation,
      anchor,
      parentId,
    };
  }

  const text = layer?.textProperties || layer;
  return {
    id,
    name: String(layer?.name || id),
    type: "text",
    text: resolveStringProperty(text?.content ?? text?.text, "Text"),
    x,
    y,
    width,
    height,
    visible,
    animation,
    anchor,
    parentId,
    style: {
      fontFamily: resolveStringProperty(text?.fontFamily, "Inter Variable"),
      fontSize: resolveNumericProperty(text?.fontSize, 48),
      fontWeight: resolveStringProperty(text?.fontWeight, "400"),
      textColor: resolveStringProperty(
        text?.color ?? text?.textColor,
        "#FFFFFF",
      ),
      textAlign: text?.align || text?.textAlign || "center",
      lineHeight: resolveNumericProperty(text?.lineHeight, 1.2),
      letterSpacing: resolveNumericProperty(text?.letterSpacing, 0),
      overflow: text?.overflow,
      verticalAlign: text?.verticalAlign,
    },
    backgroundPanel:
      text?.backgroundColor || text?.backgroundPanel
        ? {
            color:
              text?.backgroundPanel?.color ?? text?.backgroundColor
                ? resolveStringProperty(
                    text?.backgroundPanel?.color ?? text?.backgroundColor,
                    "#000000",
                  )
                : undefined,
            opacity: resolveNumericProperty(
              text?.backgroundPanel?.opacity ?? text?.backgroundOpacity,
              1,
            ),
            paddingTop: resolveNumericProperty(
              text?.backgroundPanel?.paddingTop ?? text?.paddingTop,
              0,
            ),
            paddingRight: resolveNumericProperty(
              text?.backgroundPanel?.paddingRight ?? text?.paddingRight,
              0,
            ),
            paddingBottom: resolveNumericProperty(
              text?.backgroundPanel?.paddingBottom ?? text?.paddingBottom,
              0,
            ),
            paddingLeft: resolveNumericProperty(
              text?.backgroundPanel?.paddingLeft ?? text?.paddingLeft,
              0,
            ),
            borderRadius: resolveNumericProperty(
              text?.backgroundPanel?.borderRadius ?? text?.backgroundRadius,
              0,
            ),
            borderColor:
              text?.backgroundPanel?.borderColor ?? text?.backgroundBorderColor
                ? resolveStringProperty(
                    text?.backgroundPanel?.borderColor ??
                      text?.backgroundBorderColor,
                    "#000000",
                  )
                : undefined,
            borderWidth: resolveNumericProperty(
              text?.backgroundPanel?.borderWidth ?? text?.backgroundBorderWidth,
              0,
            ),
          }
        : undefined,
    spans: Array.isArray(text?.spans) ? clone(text.spans) : undefined,
    perCharFillEnabled: Boolean(text?.perCharFillEnabled),
    charFillColors: Array.isArray(text?.charFillColors)
      ? clone(text.charFillColors)
      : undefined,
    splitAnimator: text?.splitAnimator ? clone(text.splitAnimator) : undefined,
    textEffectRef: text?.styleRef ? clone(text.styleRef) : undefined,
    // Kept as optional metadata for compatibility with role-based editor
    // customizations. The canonical renderer does not depend on roles.
    ...(layer?.role ? { role: String(layer.role) } : {}),
  } as TemplateNode;
}

function inferControls(nodes: TemplateNode[]): TemplateControl[] {
  const controls: TemplateControl[] = [];
  for (const node of nodes) {
    if (node.type === "text") {
      controls.push({
        id: `text-${node.id}`,
        label: node.name || "Text",
        type: "text",
        defaultValue: node.text,
        constraints: { multiline: true, maxLength: 500 },
        target: { nodeId: node.id, propertyPath: "text" },
      });
    }
  }
  return controls;
}

function collectDependencies(
  nodes: TemplateNode[],
): TemplateDependencyManifest {
  const assets: any[] = [];
  const fonts: any[] = [];
  const textEffects: any[] = [];
  const seenAssets = new Set<string>();
  const seenFonts = new Set<string>();
  const seenEffects = new Set<string>();

  for (const node of nodes) {
    if (
      node.type === "media" &&
      node.assetId &&
      !seenAssets.has(node.assetId)
    ) {
      assets.push({
        id: node.assetId,
        type: "image",
        mimeType: "image/png",
        uri: node.src || "",
        contentHash: node.assetId,
      });
      seenAssets.add(node.assetId);
    }
    if (node.type === "text" && node.style?.fontFamily) {
      const key = `${node.style.fontFamily}:${node.style.fontWeight || 400}`;
      if (!seenFonts.has(key)) {
        fonts.push({
          family: node.style.fontFamily,
          weight: Number(node.style.fontWeight || 400),
          style: "normal",
        });
        seenFonts.add(key);
      }
      if (node.textEffectRef) {
        const effectKey = `${node.textEffectRef.effectId}:${node.textEffectRef.revisionId}`;
        if (!seenEffects.has(effectKey)) {
          textEffects.push(clone(node.textEffectRef));
          seenEffects.add(effectKey);
        }
      }
    }
  }
  return { assets, fonts, textEffects };
}

export function normalizeTextTemplateArtifact(
  input: unknown,
): TextTemplateArtifact {
  if (!input || typeof input !== "object")
    throw new Error("Invalid text template artifact");
  const raw = input as any;
  const source =
    raw.document && typeof raw.document === "object" ? raw.document : raw;
  const rawLayers = Array.isArray(source.layers)
    ? source.layers
    : Array.isArray(source.elements)
    ? source.elements
    : [];
  const nodes: TemplateNode[] = Array.isArray(source.nodes)
    ? clone(source.nodes)
    : rawLayers.map(legacyLayerToNode);
  const id = String(
    raw.metadata?.id ?? source.id ?? raw.id ?? "untitled-text-template",
  );
  const label = String(
    raw.metadata?.label ?? source.title ?? raw.label ?? raw.name ?? id,
  );
  const duration = Number(
    raw.timing?.duration ?? source.duration ?? raw.duration ?? 4,
  );
  const fps = Number(raw.timing?.fps ?? source.fps ?? raw.fps ?? 30);
  const width = Number(
    source.canvas?.width ??
      source.canvasWidth ??
      raw.canvasWidth ??
      raw.width ??
      1920,
  );
  const height = Number(
    source.canvas?.height ??
      source.canvasHeight ??
      raw.canvasHeight ??
      raw.height ??
      1080,
  );
  const createdAt = String(
    raw.revision?.createdAt ?? source.createdAt ?? now(),
  );

  const document: TextTemplateDocument = {
    id,
    kind: TEXT_TEMPLATE_KIND,
    schemaVersion: TEXT_TEMPLATE_SCHEMA_VERSION,
    templateVersion: 1,
    canvas: {
      width,
      height,
      fps,
      backgroundColor: source.canvas?.backgroundColor ?? raw.backgroundColor,
    },
    nodes,
    variables:
      source.variables && typeof source.variables === "object"
        ? clone(source.variables)
        : undefined,
  };

  const controls: TemplateControl[] = Array.isArray(raw.controls)
    ? clone(raw.controls)
    : inferControls(nodes);

  const timing: TemplateTiming = {
    duration,
    fps,
    durationPolicy: raw.timing?.durationPolicy || "stretch",
    intro: raw.timing?.intro ? clone(raw.timing.intro) : undefined,
    outro: raw.timing?.outro ? clone(raw.timing.outro) : undefined,
    loop: raw.timing?.loop ? clone(raw.timing.loop) : undefined,
    markers: Array.isArray(raw.timing?.markers)
      ? clone(raw.timing.markers)
      : undefined,
  };

  const dependencies = raw.dependencies?.assets
    ? clone(raw.dependencies)
    : collectDependencies(nodes);
  const content = { document, controls, timing, dependencies };
  const contentHash = String(
    raw.revision?.contentHash || canonicalTemplateHash(content),
  );

  const revision: TemplateRevision = {
    revisionId: String(
      raw.revision?.revisionId ?? raw.revisionId ?? `rev-${contentHash}`,
    ),
    contentHash,
    schemaVersion: TEXT_TEMPLATE_SCHEMA_VERSION,
    rendererVersion: String(
      raw.revision?.rendererVersion ??
        raw.rendererVersion ??
        TEXT_TEMPLATE_RENDERER_VERSION,
    ),
    createdAt,
    status: raw.revision?.status,
  };

  const metadata: TemplateMetadata = {
    id,
    label,
    category: String(
      raw.metadata?.category ?? source.category ?? raw.category ?? "title-card",
    ),
    description: String(
      raw.metadata?.description ?? source.description ?? raw.description ?? "",
    ),
    tags: Array.isArray(raw.metadata?.tags)
      ? clone(raw.metadata.tags)
      : Array.isArray(raw.tags)
      ? raw.tags.map(String)
      : [],
    creatorName: raw.metadata?.creatorName ?? raw.creatorName,
    creatorLink: raw.metadata?.creatorLink ?? raw.creatorLink,
    thumbnailUrl:
      raw.previews?.thumbnailUrl ?? raw.thumbnail ?? raw.thumbnailUrl,
    previewVideoUrl:
      raw.previews?.previewVideoUrl ?? raw.preview ?? raw.previewVideoUrl,
  };

  return {
    kind: TEXT_TEMPLATE_KIND,
    schemaVersion: TEXT_TEMPLATE_SCHEMA_VERSION,
    metadata,
    document,
    controls,
    timing,
    dependencies,
    revision,
    previews:
      raw.previews || metadata.thumbnailUrl || metadata.previewVideoUrl
        ? {
            thumbnailUrl: metadata.thumbnailUrl,
            previewVideoUrl: metadata.previewVideoUrl,
          }
        : undefined,
  };
}
