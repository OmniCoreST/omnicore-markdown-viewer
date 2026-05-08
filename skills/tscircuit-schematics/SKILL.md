---
name: tscircuit-schematics
description: Author readable, well-laid-out tscircuit schematic drawings — for placement in Markdown documents, datasheets, or design specs (rather than full PCB design). Use when the user asks to draw/sketch/diagram/illustrate/render a schematic, redraw a circuit, fix a tscircuit drawing, lay out passives/MOSFETs/optocouplers/buttons/sensors, or work with board JSX inside tscircuit Markdown code blocks. Triggers include "schematic", "tscircuit", "circuit drawing", ".circuit.tsx", "schX/schY", "schPinArrangement". This skill is a layout-and-readability layer on top of the official tscircuit/skill (which covers CLI workflow and element catalog); load both when working on a real tscircuit project.
---

# tscircuit-schematics — drawing schematics that read cleanly

This skill is for **producing schematic drawings** with `tscircuit` — the kind that ship inside Markdown design docs, where the goal is "look at the picture, understand the circuit". It is **not** for full PCB layout (use the official [`tscircuit/skill`](https://github.com/tscircuit/skill) for that — its `WORKFLOW.md`/`SYNTAX.md`/element pages are the authoritative reference for CLI + props).

## When this skill matters

Reach for it when a user asks for any of:

- "Draw a schematic of …" / "Sketch the wiring for …" / "Make a circuit diagram of …"
- "The schematic in `foo.md` looks wrong — fix it"
- A `tscircuit` code block where components are scattered, vertical-when-they-should-be-horizontal, or where pieces aren't connected
- A `.circuit.tsx` file that needs to render legibly in a viewer

## The four problems this skill fixes

Almost every "ugly tscircuit schematic" is one of these:

1. **Disconnected components** — pin-to-net traces silently drop because the selector syntax is wrong.
2. **Components that don't render at all** — required props are missing on `<mosfet>`, `<chip>`, etc.
3. **Vertical-by-default layout** — auto-layout stacks everything in one column even when the topology is naturally horizontal.
4. **Synthetic net-label clutter** — anonymous pin-to-pin connections get auto-named (`R1_pin2/LED1_pin1`) and the renderer prints them as a vertical text blob jutting off the wire midpoint.

The rest of this skill is the rules that make those four go away.

---

## Rule 1 — Use the canonical pin selector: `.X > .pinN`

This is the single most common bug. tscircuit accepts two trace selector forms:

| Form | Status |
| --- | --- |
| `<trace from=".R1 > .pin1" to="net.VCC" />` | **Canonical** — works |
| `<trace from=".R1.pin1" to="net.VCC" />` | Works (no spaces) |
| `<trace from=".R1 .pin1" to="net.VCC" />` | **BROKEN** — silently drops the trace |

The space-without-`>` form passes parsing but produces no `schematic_trace`. A rendered drawing will show the components but no wires between them, and `runTscircuitCode` emits a `source_pin_missing_trace_warning` that is easy to miss.

**Always write `.RefDes > .pinName`.** Be consistent across the entire file — mixing forms is how half a circuit's traces disappear.

Pin-name lookup table for the components that actually trip people up:

| Element | Valid pin selectors |
| --- | --- |
| `<resistor>` | `.pin1`, `.pin2`, `.left`, `.right` |
| `<capacitor>` | `.pin1`, `.pin2`, `.left`, `.right` |
| `<led>` | `.pin1`, `.pin2`, `.pos`, `.neg`, `.anode`, `.cathode` |
| `<diode>` | `.pin1`, `.pin2`, `.anode`, `.cathode` |
| `<mosfet>` | `.pin1` (drain), `.pin2` (source), `.pin3` (gate), `.drain`, `.source`, `.gate` |
| `<pushbutton>` | `.pin1`, `.pin2`, `.pin3`, `.pin4` (pin1↔pin2 and pin3↔pin4 are internally bridged) |
| `<chip>` with `pinLabels={{...}}` | the labels you defined — `.LEDA`, `.COLL`, etc. |

Things that look plausible but are **not** valid pin labels:

- `<pushbutton>` does **not** have `.side1` / `.side2`. Use `.pin1` / `.pin2`.
- `<chip>` does not magically expose pins by their physical numbers if you used `pinLabels`. Use the labels you declared.

---

## Rule 2 — Required props that have no defaults

These elements ship with required-but-easy-to-forget props. Omitting them produces `source_failed_to_create_component_error` and a missing component on the rendered schematic:

```tsx
// WRONG — mosfetMode is missing, FET silently fails to create
<mosfet name="Q1" channelType="n" footprint="sot23" />

// RIGHT
<mosfet
  name="Q1"
  channelType="n"               // "n" | "p"
  mosfetMode="enhancement"      // "enhancement" | "depletion"
  footprint="sot23"
/>
```

Other commonly-forgotten declarations:

- **Always set a `footprint`** on every component, even if you only care about the schematic — missing footprints emit `pcb_missing_footprint_error` for every component, drowning real errors in noise. Safe defaults: `"0402"` for passives, `"sod123"` for diodes, `"sot23"` for MOSFETs, `"dip4"`/`"soic8"` for chips, `"pushbutton"` for pushbuttons.
- **`<chip>` with custom `pinLabels` needs `schPinArrangement`** — otherwise tscircuit doesn't know which side each pin sits on. Each side declares `direction` (`top-to-bottom` / `bottom-to-top`) and the ordered pin list.

---

## Rule 3 — Let auto-layout (PMARS) do the work; don't fight it

The strong default in tscircuit is `<board schAutoLayoutEnabled={true} ...>` — the **PMARS** (Partition / Match / Adapt / Refine / Stitch) packer reads the netlist and produces a clean schematic. **For nearly every drawing in a Markdown design doc, do nothing about layout.** Just declare components and traces:

```tsx
<board width="40mm" height="25mm">
  <resistor name="R1" resistance="10k" footprint="0402" />
  <pushbutton name="SW1" footprint="pushbutton" />
  <trace from="net.VCC_3V3"   to=".R1 > .pin1" />
  <trace from=".R1 > .pin2"   to="net.SIG" />
  <trace from=".SW1 > .pin1"  to="net.SIG" />
  <trace from=".SW1 > .pin2"  to="net.GND" />
</board>
```

Auto-layout produces compact, conventionally-correct schematics: pull-ups vertical between rail and signal, ground bus along the bottom, chips with their pins on the correct sides. The vendor's published examples (e.g. the [blinking-LED reference design](https://tscircuit.com/editor?template=blinking-led-board)) all use auto-layout exclusively.

### When you're handed a broken schematic to fix

The single most common failure mode in this codebase is a TSX block where someone planted `schX`/`schY` (and often `schRotation` and `schAutoLayoutEnabled={false}`) on every component, then routed traces with the broken `.X .pin` syntax. The temptation is to just patch the trace syntax and ship it — the user **will not be happy** with that. The placements were the problem; manual placement is what produced the "components scattered far apart" / "vertical-when-it-should-be-horizontal" complaint in the first place.

When fixing such a block, walk in with a strong prior: **delete every `schX`, `schY`, `schRotation`, and the `schAutoLayoutEnabled={false}` flag**, then patch the trace syntax. Re-render and look at the result before re-introducing any manual placement. Nine times out of ten the auto-layout output will be cleaner than whatever the original author was trying to coax into existence.

A debug-fix walkthrough on a typical broken block:

```tsx
// BEFORE — typical bug pattern
<board width="40mm" height="25mm">
  <resistor name="R_PU" resistance="10k" footprint="0402" schX={-5} schY={3} />
  <pushbutton name="SW1" footprint="pushbutton" schX={-5} schY={-2} />
  <mosfet name="Q1" channelType="n" footprint="sot23" schX={5} schY={0} />
  <trace from="net.VCC_3V3" to=".R_PU .pin1" />
  <trace from=".SW1 .side1" to="net.GPIO_BTN" />
  ...
</board>
```

The fix is **all of**:
1. Delete the `schX`/`schY` props on every component (Rule 3).
2. Add `mosfetMode="enhancement"` to the `<mosfet>` (Rule 2).
3. Replace `.X .pin` with `.X > .pin` everywhere (Rule 1).
4. Replace `.SW1 .side1`/`.side2` with `.SW1 > .pin1`/`.pin2` (Rule 1).

Don't do (2)+(3)+(4) and skip (1). The result will render — but not well.

### When to override auto-layout intentionally

You only need manual placement when auto-layout produces something genuinely worse than what you'd draw by hand. Symptoms:

- Components scattered across an empty canvas (auto-layout gave up)
- Two halves of a clearly-separable circuit packed into one tight blob
- Critical signal flow runs the wrong direction

If you must override, do **all-or-nothing**, not a half-measure:

```tsx
<board width="120mm" height="60mm" schAutoLayoutEnabled={false}>
  <resistor name="R1" schX={-3} schY={0} />
  ...
</board>
```

When you go manual, every component needs explicit `schX` / `schY`. Mixing manual placement with auto-layout produces erratic results — the packer rearranges everything when it sees one un-placed component.

### What manual placement does NOT solve

A common mistake (we made it ourselves the first time): trying to break up a long shared-rail bus by manually placing components on opposite sides of the canvas. **It doesn't work.** Whenever two pins sit on the same global net (`net.VCC_3V3`, `net.GND`), the schematic-trace solver draws a wire between them — even across an empty canvas. To scope nets locally use `<subcircuit>`, not manual placement.

---

## Rule 4 — Group naturally-related parts; let the packer place them

In auto-layout mode the packer mostly does the right thing. You influence its choices by **what you declare**, not by where you place things:

- Declare **all components for one channel** together, then **all components for the next**. The packer keeps declaration-adjacent components physically close.
- Use one `net.X` name per logical signal — don't invent local aliases that obscure structure.
- For repeated identical channels (six LED indicators, four DI inputs, etc.), the packer picks up the pattern and stacks them in a uniform grid.

For the rare case where two channels need physical isolation (e.g. an isolated DI front-end vs. a non-isolated DO driver) and the packer keeps merging their grounds, wrap each in a `<subcircuit name="X">` — that scopes the schematic-trace solver per subcircuit so global nets don't cross the boundary visually.

---

## Rule 5 — Don't add `<netlabel>` calls hoping they'll force layout

`<netlabel>` is for labeling a wire endpoint at a specific position, not for forcing the packer to do something. If you add a `<netlabel>` to "fix" a layout issue, you'll usually find the packer ignores it (in auto mode) or the schematic-trace solver still draws a long wire between every two pins on the same net (in manual mode).

If a rail looks ugly (e.g. a long horizontal `net.VCC_3V3` wire bridging two unrelated channels), the right fix is **subcircuit scoping** (Rule 4), not manual netlabel placement.

---

## Rule 6 — Avoid synthetic auto-net-labels

When two pins are connected by a `<trace>` that doesn't reference a named `net.X`, the solver invents a name like `R1_pin2/LED1_pin1` and renders it as a label on the wire. These labels are always ugly and never meaningful — they're a sign the schematic source under-named its intermediate nets.

Two ways to make them go away:

1. **Author-side**: name every multi-pin junction with a real net. Instead of three traces between three pins, declare a `net.SIGNAL_NAME` and route every pin to it.
   ```tsx
   <trace from=".R_PU1 > .pin2"  to="net.GPIO_BTN_UP" />
   <trace from=".SW_UP > .pin1"  to="net.GPIO_BTN_UP" />
   <trace from=".C_DB1 > .pin1"  to="net.GPIO_BTN_UP" />
   ```
2. **Viewer-side**: a renderer that filters `schematic_net_label` entries with no `source_net_id` and a name matching `^[A-Za-z0-9_]+_pin\d+(?:\/[A-Za-z0-9_]+_pin\d+)+$` will silently drop the synthetic ones. (The OmniCore Markdown Viewer ships this filter — see `libs/tscircuit/bundle-entry.tsx`.)

Prefer (1). It survives any viewer.

---

## Rule 7 — Verify by rendering, every time

tscircuit fails silently in many ways: bad pin selectors drop traces, missing required props remove components, wrong footprint strings raise warnings without aborting. The only reliable check is: **render the circuit-json, look at the SVG/PNG, and read the diagnostics**.

A minimal Node harness (works against the project's existing `node_modules`):

```js
import { runTscircuitCode } from '@tscircuit/eval';
import { convertCircuitJsonToSchematicSvg } from 'circuit-to-svg';

const cj = await runTscircuitCode(tsxSource);
console.log('source_traces:', cj.filter(e => e.type === 'source_trace').length);
console.log('schematic_traces:', cj.filter(e => e.type === 'schematic_trace').length);
const errors = cj.filter(e => typeof e.type === 'string' && e.type.includes('error'));
errors.forEach(e => console.log('ERROR:', e.type, e.message));
const svg = convertCircuitJsonToSchematicSvg(cj);
// rasterize svg → png with sharp/ImageMagick/rsvg-convert and inspect.
```

Diagnostic checklist after each render:

- **`source_traces` ≈ `schematic_traces`** — if schematic_traces is much lower, you have wrong pin selectors. Find the broken `<trace>` lines.
- **No `source_failed_to_create_component_error`** — if present, a required prop is missing on that component.
- **No `source_pin_missing_trace_warning`** — usually means a pin you wrote a trace for doesn't exist by that name on the component.
- **No labels of shape `X_pinN/Y_pinM[/...]`** — if any appear, introduce a named intermediate net (Rule 6).
- **`pcb_*_error`** entries are PCB-side and don't affect schematic rendering — safe to ignore for schematic-only documents.

---

## Worked example — six-channel LED indicator block

The right way to draw "six identical channels". Just declare each channel's components and traces — let the packer do the layout:

```tsx
export default () => (
  <board width="80mm" height="35mm">
    <resistor name="R_PWR" resistance="1k" footprint="0402" />
    <led      name="LED_PWR" color="green" footprint="0805" />
    <trace from="net.GPIO_LED_PWR" to=".R_PWR > .pin1" />
    <trace from=".R_PWR > .pin2"   to=".LED_PWR > .pin1" />
    <trace from=".LED_PWR > .pin2" to="net.GND" />

    <resistor name="R_HB" resistance="1k" footprint="0402" />
    <led      name="LED_HB" color="green" footprint="0805" />
    <trace from="net.GPIO_LED_HB" to=".R_HB > .pin1" />
    <trace from=".R_HB > .pin2"   to=".LED_HB > .pin1" />
    <trace from=".LED_HB > .pin2" to="net.GND" />

    {/* ...four more identical channels... */}
  </board>
);
```

The packer renders this as six clean horizontal rows, each reading left-to-right `GPIO_LED_X  → R → LED → GND`, with one shared GND bus down the right edge. No `schX/schY`, no `<netlabel>`, no `schAutoLayoutEnabled={false}` — the simpler the source, the better the output.
---

## Things that don't matter for schematic-doc drawings

To avoid wasting effort on the wrong layer:

- **`pcbX` / `pcbY` / `pcbRotation`**: only relevant if you're producing fabrication outputs. For a Markdown schematic, leave them off.
- **`<board width=...>` units**: only affect the PCB outline. Schematic uses its own coordinate system based on `schX` / `schY`.
- **DRC / autorouter settings**: not used by `convertCircuitJsonToSchematicSvg`. Ignore.

---

## Cross-references

- The vendor skill — full element catalog, CLI workflow, and project setup: <https://github.com/tscircuit/skill>
- AI-assisted circuit design guide: <https://docs.tscircuit.com/guides/circuit-generation/generating-circuit-boards-with-ai>
- Built-in elements category: <https://docs.tscircuit.com/category/built-in-elements>
- Configuring chips (`pinLabels` + `schPinArrangement`): <https://docs.tscircuit.com/guides/tscircuit-essentials/configuring-chips>
- Automatic schematic layout (PMARS, when to disable): <https://docs.tscircuit.com/guides/tscircuit-essentials/automatic-schematic-layout>

---

## Installing this skill globally

To make this skill available in every Claude Code / Cowork session (not just inside this repo), copy the folder to your user-skills directory:

```powershell
# Windows
Copy-Item -Recurse `
  "D:\projects\omnicore-markdown-viewer\skills\tscircuit-schematics" `
  "$env:APPDATA\Claude\local-agent-mode-sessions\skills-plugin\<plugin-id>\<session-id>\skills\user\tscircuit-schematics"
```

The exact destination path depends on your local Claude install. The repo-local copy stays the source of truth.
