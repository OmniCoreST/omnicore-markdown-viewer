# Desktop-only features (Omnicore Markdown Viewer app ≥ 2.3.0)

Everything on this page works **only in the desktop app**; the VS Code extension shows these blocks as plain code or text. Use them only when the user says the document is for the desktop app or a desktop export. Otherwise pick the portable alternative that each section names.

## Contents
1. D2 diagrams
2. tscircuit schematics
3. Raw HTML iframe blocks (`@@@html`)
4. Image slider
5. Notes (annotations stored in the .md)
6. Print, PDF and page breaks
7. Corporate letterhead

## 1. D2 diagrams

Use a fenced block with the info string `d2`. The engine is `@terrastruct/d2` 0.1.33 (WASM), loaded lazily, and a "Rendering D2 diagram…" placeholder shows until it finishes. **`.d2` files are not supported**; use blocks inside Markdown.

The options are fixed: `layout: dagre`, theme 0 (light) or 200 (dark), `pad: 20`, `sketch: false`. **In-source `vars: { d2-config: … }` is ignored**, so there is no ELK, no sketch mode and no custom theme.

| Works | Avoid |
|---|---|
| connections with labels, `direction: right` | `$` in any string: it starts a D2 substitution, so the compile fails |
| nested containers `a: { b; c }` | `layers` / `scenarios` / `steps`: only the root board shows |
| `shape: cylinder / sql_table / class / sequence_diagram` | `@import`: no filesystem is available |
| `classes` + `style.fill` / `style.font-color` | `icon: https://…`: needs network |
| `grid-rows` / `grid-columns`, `tooltip:`, `link:` (opens in the browser) | |
| Markdown labels `\|md … \|`, LaTeX `\|latex … \|` | |

Errors show in a red `.d2-error` box with D2's message. Word export drops D2 diagrams (only Mermaid is rasterised).

```d2
direction: right
saha: Saha {
  sayac: Sayaç
  reader: omni-reader
  sayac -> reader: DLMS
}
backend: Backend {
  worker: Hes.Worker
  db: PostgreSQL {shape: cylinder}
  worker -> db: COPY
}
saha.reader -> backend.worker: MQTT sonuç
```

Portable alternative: Mermaid `flowchart` with `subgraph` (see `mermaid.md`).

## 2. tscircuit schematics

Use a fenced block with the info string `tscircuit`, containing TSX that default-exports a `<board>`. `*.circuit.tsx` files are wrapped automatically. Only the schematic is drawn (no PCB, no 3D).

```tscircuit
export default () => (
  <board width="20mm" height="20mm">
    <resistor name="R1" resistance="1k" footprint="0402" />
    <capacitor name="C1" capacitance="1uF" footprint="0402" />
    <trace from=".R1 > .pin2" to=".C1 > .pin1" />
  </board>
)
```

- Selectors must use `>`: `.R1 > .pin1`. The space form `.R1 .pin1` silently drops the trace.
- The app works offline, so `@tsci/*` registry imports and part lookups cannot resolve. Don't import.
- Errors show in a `.tscircuit-error` box. The first render is slow (a 5 MB bundle).
- For layout quality, read the **tscircuit-schematics** skill: pin arrangement, net labels and required props.

## 3. Raw HTML iframe blocks

```text
@@@html(zoom:80%)
<div style="padding:1rem;font-family:sans-serif">Canlı HTML / JS demo</div>
@@@
```

- The body runs in a **sandboxed** `<iframe srcdoc>` (`allow-scripts allow-popups allow-forms`, no same-origin). Scripts run, but they cannot reach the app or the file system.
- The only parameter is `zoom:N` / `zoom:N%`. The closing `@@@` must be on its own line.
- Height follows the content, including content that grows later.
- A block inside a code fence stays code, as in the example above.
- CDN resources load only when online. Word export drops these blocks.

## 4. Image slider

```text
<!-- slider-start -->
![Birinci](img/1.png)
![İkinci](img/2.png)
<!-- slider-end -->
```

- Only `![alt](src)` lines are kept; any other text inside is dropped.
- The slider is 450 px tall, autoplays every 5 s and pauses on hover. The UI caps "Add to Slider" at 5 images.
- PDF prints only the current slide.
- In VS Code the comments vanish and the images appear one after another.

## 5. Notes (annotations stored in the .md)

The desktop app's right-click **Add Note** writes inline `<span>`s into the file:

```html
<span class="noted-text" data-note-id="3" data-note-title="Başlık" data-note-content="Açıklama" data-note-color="#e74c3c" style="background-color:rgba(231,76,60,0.25);text-decoration:underline;text-decoration-color:#e74c3c;text-decoration-thickness:2px">not düşülen metin</span>
<span class="noted-image" data-note-id="4" data-note-title="…" data-note-content="…" style="background-color:rgba(39,174,96,0.15)"><img src="…" alt="…"></span>
<span class="note-label" data-note-id="5" data-note-title="…" data-note-content="…" style="background-color:#2980b9;left:120px;top:340px">Etiket</span>
```

When editing a file that contains notes, keep them intact. When writing notes by hand:
- Keep the attribute order `class`, `data-note-id`, `data-note-title`, `data-note-content`. The app's edit/delete regex depends on it.
- Use numeric ids (the next id is the highest + 1).
- HTML-escape the title and content.
- Never nest spans inside a note.
- Colours: `#ff6600` (default), `#e74c3c`, `#27ae60`, `#2980b9`, `#8e44ad`, `#f39c12`.

Labels are absolutely positioned in pixels, so they are fragile. In VS Code notes render as plain text.

## 6. Print, PDF and page breaks

- PDF export is A4 portrait and always uses the light theme.
- The PDF metadata title is the file name. The printout drops the ▼ heading markers, prints collapsed sections, and resets zoom to 100%.
- Page break: `<div style="page-break-after: always"></div>`.
- `pre`, `img` and `.mermaid` have `page-break-inside: avoid`; tables and D2 do not.
- Wait for D2/tscircuit to finish rendering before exporting.

## 7. Corporate letterhead

- **Ctrl+Shift+O** toggles "corporate mode". It is off at every launch, and the Markdown cannot control it.
- **PDF export** then uses A4 with:
  - a header: the Omnicore logo plus the **file name** (for example `rapor.md`);
  - a footer: company name, address, registry numbers, www.omnicore.com.tr and large page numbers.
  - "CONFIDENTIAL — OMNICORE DOCUMENT" is appended after the content.
- **Word export** in corporate mode only adds an "OMNICORE" heading and the confidential line. It has no real letterhead.
- Name the file for its audience, because the name is printed on every page.
