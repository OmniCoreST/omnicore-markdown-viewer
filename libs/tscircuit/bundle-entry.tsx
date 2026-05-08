// Entry point for the tscircuit schematic bundle.
//
// Bundled by scripts/build-tscircuit-bundle.js into libs/tscircuit/tscircuit-bundle.js
// as an IIFE that exposes window.Tscircuit. The renderer.js code calls
// window.Tscircuit.renderSchematic(rootEl, tsxCode, opts) to render a schematic
// from TSX source.
//
// Pipeline:
//   TSX source --[@tscircuit/eval runTscircuitCode]--> Circuit JSON
//   Circuit JSON --[circuit-to-svg convertCircuitJsonToSchematicSvg]--> SVG string
//
// No React, no DOM diffing — just raw SVG injected into the host element.

import { runTscircuitCode } from "@tscircuit/eval";
import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg";

interface RenderOptions {
  isDark?: boolean;
}

function darkSchematicColors() {
  return {
    schematic: {
      background: "#1a1a1a",
      wire: "#3DBDC6",
      component_outline: "#3DBDC6",
      component_body: "#1f3244",
      pin: "#e8e8e8",
      pin_name: "#aaaaaa",
      pin_number: "#aaaaaa",
      reference: "#3DBDC6",
      value: "#9aa6b2",
      label_global: "#e8e8e8",
      label_local: "#aaaaaa",
      label_hier: "#3DBDC6",
      net_name: "#9aa6b2",
      junction: "#e8e8e8",
      grid: "#2a2a2a",
      grid_axes: "#3a3a3a",
      no_connect: "#cc4444",
    },
  };
}

// Drop net-label entries that the trace solver synthesizes for unnamed
// pin-to-pin connections (e.g. `R1_pin2/LED1_pin1`). These are not nets the
// schematic author wrote — they're generated at solve time when a trace has
// no shared `net.NAME` identifier, and they always render as a vertical text
// blob jutting off the wire midpoint, which clutters every basic schematic.
//
// Heuristic: real, author-named labels carry a `source_net_id` linking them
// back to a `<net>` declaration; synthesized ones do not. We also defensively
// match the canonical synthetic name shape so we never accidentally drop a
// label the user actually wrote.
// Matches `X_pinN/Y_pinM` (2-way) or `X_pinN/Y_pinM/Z_pinK` (N-way) — the
// canonical synthesized name for an unnamed pin-to-pin connection.
const SYNTHETIC_LABEL_RE = /^[A-Za-z0-9_]+_pin\d+(?:\/[A-Za-z0-9_]+_pin\d+)+$/;
function stripSyntheticNetLabels(circuitJson: any[]): any[] {
  return circuitJson.filter((el) => {
    if (el?.type !== "schematic_net_label") return true;
    const hasSource = typeof el.source_net_id === "string" && el.source_net_id.length > 0;
    if (hasSource) return true;
    if (typeof el.text === "string" && SYNTHETIC_LABEL_RE.test(el.text)) return false;
    // No source_net_id and not the canonical synthetic shape — keep it to be safe.
    return true;
  });
}

async function renderSchematic(
  rootEl: HTMLElement,
  tsxCode: string,
  opts: RenderOptions = {}
): Promise<void> {
  const rawCircuitJson = (await runTscircuitCode(tsxCode)) as any[];
  const circuitJson = stripSyntheticNetLabels(rawCircuitJson);

  const svg = convertCircuitJsonToSchematicSvg(circuitJson, {
    colorOverrides: opts.isDark ? darkSchematicColors() : undefined,
  });

  // circuit-to-svg emits width="1200" height="600" with NO viewBox. To make the
  // SVG scale responsively in its container, convert the explicit dimensions
  // into a viewBox and set the CSS width to 100%.
  const cleaned = svg.replace(/<svg\b([^>]*)>/, (_m, attrs) => {
    const widthMatch = attrs.match(/\swidth="([^"]*)"/i);
    const heightMatch = attrs.match(/\sheight="([^"]*)"/i);
    const hasViewBox = /\sviewBox="/i.test(attrs);
    const w = widthMatch ? parseFloat(widthMatch[1]) : 0;
    const h = heightMatch ? parseFloat(heightMatch[1]) : 0;

    let stripped = attrs
      .replace(/\swidth="[^"]*"/i, "")
      .replace(/\sheight="[^"]*"/i, "");

    let viewBoxAttr = "";
    if (!hasViewBox && w > 0 && h > 0) {
      viewBoxAttr = ` viewBox="0 0 ${w} ${h}"`;
    }

    return `<svg${stripped}${viewBoxAttr} preserveAspectRatio="xMidYMid meet" style="width:100%;height:auto;display:block;">`;
  });

  rootEl.innerHTML = cleaned;
}

(window as any).Tscircuit = {
  renderSchematic,
  version: "1.0.0",
};
