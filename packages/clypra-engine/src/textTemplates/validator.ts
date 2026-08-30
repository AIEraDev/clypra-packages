import type { TemplateNode, TextTemplateArtifact } from "./contract.js";

export interface TextTemplateDiagnostic {
  severity: "error" | "warning";
  code: string;
  message: string;
  nodeId?: string;
}

const MAX_NODES = 500;
const MAX_CONTROLS = 100;

export function validateTextTemplateArtifact(artifact: TextTemplateArtifact): TextTemplateDiagnostic[] {
  const diagnostics: TextTemplateDiagnostic[] = [];
  if (!artifact || artifact.kind !== "text-template") {
    return [{ severity: "error", code: "TEMPLATE_KIND", message: "Artifact kind must be text-template" }];
  }
  const { document, timing, controls } = artifact;
  if (!document || !document.id) {
    diagnostics.push({ severity: "error", code: "TEMPLATE_ID", message: "Template ID is required" });
  }
  if (!Number.isFinite(document.canvas.width) || document.canvas.width <= 0 || !Number.isFinite(document.canvas.height) || document.canvas.height <= 0) {
    diagnostics.push({ severity: "error", code: "CANVAS_SIZE", message: "Canvas dimensions must be positive finite numbers" });
  }
  if (!Number.isFinite(timing.duration) || timing.duration <= 0) {
    diagnostics.push({ severity: "error", code: "DURATION", message: "Duration must be positive" });
  }
  if (!Number.isFinite(timing.fps) || timing.fps <= 0 || timing.fps > 240) {
    diagnostics.push({ severity: "error", code: "FPS", message: "FPS must be between 0 and 240" });
  }

  const ids = new Set<string>();
  let nodeCount = 0;

  const visit = (node: TemplateNode) => {
    nodeCount += 1;
    if (!node.id) {
      diagnostics.push({ severity: "error", code: "NODE_ID", message: "Every node needs a stable ID" });
    } else if (ids.has(node.id)) {
      diagnostics.push({ severity: "error", code: "DUPLICATE_NODE_ID", message: `Duplicate node ID: ${node.id}`, nodeId: node.id });
    } else {
      ids.add(node.id);
    }

    // x and y must always be finite numbers
    for (const value of [node.x, node.y]) {
      if (!Number.isFinite(value)) {
        diagnostics.push({ severity: "error", code: "NODE_GEOMETRY", message: `Node ${node.id} has non-finite position`, nodeId: node.id });
      }
    }

    // width and height: "auto" is valid on text and container nodes
    for (const [axis, value] of [["width", node.width], ["height", node.height]] as const) {
      if (value === "auto") {
        if (node.type !== "text" && node.type !== "container") {
          diagnostics.push({
            severity: "error",
            code: "NODE_GEOMETRY_AUTO_NOT_SUPPORTED",
            message: `Node ${node.id} (${node.type}) does not support auto ${axis} — only text and container nodes can use content-driven sizing`,
            nodeId: node.id,
          });
        }
      } else if (!Number.isFinite(value)) {
        diagnostics.push({ severity: "error", code: "NODE_GEOMETRY", message: `Node ${node.id} has non-finite geometry`, nodeId: node.id });
      }
    }

    if (node.type === "text" && !node.text) {
      diagnostics.push({ severity: "warning", code: "EMPTY_TEXT", message: `Text node ${node.id} is empty`, nodeId: node.id });
    }
  };

  (document.nodes || []).forEach(visit);

  if (nodeCount > MAX_NODES) {
    diagnostics.push({ severity: "error", code: "NODE_LIMIT", message: `Template exceeds the ${MAX_NODES}-node limit` });
  }
  if ((controls || []).length > MAX_CONTROLS) {
    diagnostics.push({ severity: "error", code: "CONTROL_LIMIT", message: `Template exceeds the ${MAX_CONTROLS}-control limit` });
  }

  const controlIds = new Set<string>();
  for (const control of controls || []) {
    if (controlIds.has(control.id)) {
      diagnostics.push({ severity: "error", code: "DUPLICATE_CONTROL_ID", message: `Duplicate control ID: ${control.id}` });
    }
    controlIds.add(control.id);
    if (!ids.has(control.target.nodeId)) {
      diagnostics.push({ severity: "error", code: "CONTROL_TARGET", message: `Control ${control.id} targets missing node ${control.target.nodeId}` });
    }
    if (control.target.propertyPath.includes("__proto__") || control.target.propertyPath.includes("constructor") || control.target.propertyPath.includes("prototype")) {
      diagnostics.push({ severity: "error", code: "UNSAFE_TARGET", message: `Control ${control.id} has an unsafe target path` });
    }
  }

  const regions = [timing.intro, timing.outro, timing.loop].filter(Boolean) as Array<{ start: number; end: number }>;
  regions.forEach((region) => {
    if (!Number.isFinite(region.start) || !Number.isFinite(region.end) || region.start < 0 || region.end <= region.start || region.end > timing.duration) {
      diagnostics.push({ severity: "error", code: "TIMING_REGION", message: "Timing regions must fit within the template duration" });
    }
  });

  return diagnostics;
}

export function assertValidTextTemplateArtifact(artifact: TextTemplateArtifact): void {
  const errors = validateTextTemplateArtifact(artifact).filter((diagnostic) => diagnostic.severity === "error");
  if (errors.length) {
    throw new Error(errors.map((diagnostic) => diagnostic.message).join("; "));
  }
}
