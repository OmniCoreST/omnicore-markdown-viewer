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

async function renderSchematic(
  rootEl: HTMLElement,
  tsxCode: string,
  opts: RenderOptions = {}
): Promise<void> {
  const circuitJson = (await runTscircuitCode(tsxCode)) as any[];

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
