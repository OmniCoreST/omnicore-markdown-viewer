---
name: omnicore-markdown
description: Write Markdown that renders correctly in the Omnicore Markdown Viewer — the user's default .md viewer in VS Code (extension `omnicore.markdownEditor`) and the Omnicore desktop app. Use this skill whenever you create or edit any .md, .markdown, .mmd or .ow file (README, design doc, module doc, spec, ADR, report, runbook, notes), draw a diagram in Markdown (Mermaid, OmniWare wireframe/UI mock-up, D2, tscircuit), add anchors, cross-links, images or tables to Markdown, prepare a document for PDF/Word export or the Omnicore letterhead, or when the user asks how to use the Omnicore viewer or its VS Code extension. Apply it even when the user does not mention Omnicore — every Markdown file you write will be read in this viewer.
---

# Omnicore Markdown

The user reads Markdown in the **Omnicore Markdown Viewer**. It comes in two forms that share one engine: marked 9.1.6 (GFM, CommonMark line breaks), DOMPurify, Mermaid 10.9.5, OmniWare, Prism and Tabulator.

| | VS Code extension ≥ 1.2.0 (daily reading) | Desktop app ≥ 2.3.0 (exports, extras) |
|---|---|---|
| How .md opens | default editor for `*.md/.markdown/.mmd/.mermaid/.ow` (read-only view) | `omnicore-markdown-viewer /abs/path.md` |
| Mermaid, OmniWare, tables, anchors, local images, emoji `:shortcodes:` | yes | yes |
| D2, tscircuit, notes, image sliders, `@@@html` | no (plain code/text) | yes |
| PDF / Word export | yes (PDF needs Chrome, Edge or Chromium installed) | yes, plus the Omnicore letterhead |

**Default target is what renders in both.** Use desktop-only features only when the user says the document is for the desktop app or a desktop export. Everything below also renders fine on GitHub, which is usually the third reader. The rules assume the versions above; if a user reports a rendering problem, first check that they have updated (see `references/viewer-usage.md`).

## Workflow

1. Write with the rules below.
2. Check the file:
   ```bash
   python3 ~/.claude/skills/omnicore-markdown/scripts/check_md.py FILE.md --render
   ```
   If the skill lives elsewhere, use this skill's base directory. For a file you are drafting somewhere else, add `--base <final-dir>` so relative links and images are checked from where the file will live.
   - Fix every ERROR. These include broken links, missing anchors or images, and diagrams that fail to render.
   - Fix WARNs unless they are intentional. INFO is context.
   - `--render` draws every Mermaid and OmniWare block with the viewer's own libraries in headless Chrome. Wrong diagrams fail silently in the viewer, so run it whenever the file has diagrams. It needs Chrome/Chromium and the VS Code extension; without them it reports "skipped".
3. When editing an existing file, fix what you touch and tell the user about other findings. Do not rewrite their whole document unasked.

## Text

Standard GFM works: headings, lists, task lists, tables, `~~strike~~`, autolinks and reference links. Paragraphs may be hard-wrapped; a single newline is a space, as on GitHub. For a line break, end the line with two spaces or `\`, or write `<br>`.

- YAML front matter at the top is shown as a small key/value table, the way GitHub does it. It does not enter the TOC.
- Emoji: `:rocket:` shortcodes and Unicode both work in prose. Shortcodes are not converted inside code.
- Put a blank line before a `---` rule; otherwise the text line above becomes an H2.
- Write ranges and "about" as `5–10 kV` and `≈ 5 kV`, never with `~`. Two single tildes on a line strike the text between them through.
- A line that starts with a year and a dot becomes a list: write `2024\. yılında`.

Unsupported syntax and its replacement:

| Instead of | Write |
|---|---|
| footnotes `[^1]` | `<sup>[1](#notlar)</sup>` and a "Notlar" section at the end |
| `> [!NOTE]`, `:::` containers | `> **⚠️ Uyarı:** …` (blockquotes render italic with a teal bar) |
| `==x==`, `^x^` | `<mark>x</mark>`, `<sup>x</sup>`; `<sub>x</sub>` for subscript |
| math `$…$`, `$$…$$` | Unicode (Σ √ ≤ ≥ ² · ×) or a code span |
| `{#id}` on a heading, `[TOC]` | nothing: headings get GitHub ids automatically, and the viewers have a TOC panel |
| definition lists | a table, or `<dl><dt><dd>` |

HTML that survives: `<details><summary>`, `<kbd>`, `<mark>`, `<sub>`, `<sup>`, `<br>`, `<div align="center">`, `<img width>` and inline `style`. Inside `<details>`, leave a blank line after `<summary>…</summary>` and before `</details>` so the Markdown inside is rendered. Avoid `<style>`, which restyles the whole viewer UI (if you must, scope it under `.markdown-body`). Avoid `<iframe>`, which is blocked in VS Code. `<script>` is stripped.

## Headings, anchors, links

- Headings get **GitHub-compatible ids**, Turkish letters included, with `-1` / `-2` for repeats: `## Güç Kalitesi` → `#güç-kalitesi`. Link with exactly what GitHub would use.
- An explicit anchor also works: `## Başlık <a id="baslik-ozet"></a>`. Use multi-word ids; single words like `title`, `images`, `name` or `timeline` are stripped by the sanitizer.
- Links to other files are relative and may carry a fragment: `[kurulum](docs/kurulum.md#adimlar)`. For names with spaces write `[x](<my file.md>)` or `my%20file.md`; Turkish file names work. The target opens in the viewer and scrolls to the fragment.
- `https://`, `mailto:` and `tel:` open externally. `file://` and `vscode:` hrefs are stripped.

## Images

- Relative paths work: `![şema](img/sema.png)`, `<img src="img/sema.png" width="400">`. In VS Code the image must be inside the workspace or the document's folder.
- `https://` URLs and `data:image/…;base64` work everywhere. `http://` is blocked in VS Code, and `file://` / `C:\` sources are stripped.
- The `=100x50` and `{width=…}` syntaxes don't exist; set the size with HTML.
- Prefer a diagram as code (Mermaid/OmniWare) over a screenshot of a diagram: it diffs, stays current, and themes with light/dark.

## Tables

- Up to 5 columns keeps readable 13px wrapping text. With 6 or more, the table switches to an 11px no-wrap compact style with horizontal scroll, and in PDF the extra columns are clipped. Split wide tables.
- Escape `|` in cells as `\|`, including inside backticks. The `:---:` alignment markers apply to body cells; headers stay left-aligned on the desktop app.
- Every table gets a hover pop-out with sort, filter, paging and CSV/JSON export. It shows plain text, so formatting and links are lost there.

## Code blocks

- Syntax colouring exists only for `csharp` (`cs`), `js`, `ts`, `jsx`, `tsx`, `python`, `bash` (`sh`), `json`, `html`/`xml`/`svg`, `css`, `sql`, `java`, `c` and `cpp`. Other languages (yaml, go, rust, powershell, diff, …) render as plain monospace. Still label them correctly, because GitHub colours them. Write `csharp`, never `c#`.

## Diagrams

A fenced code block (```` ``` ```` or `~~~`) whose info string starts with `mermaid`, `omniware` (alias `wireframe`), `d2` or `tscircuit` is drawn as a diagram. Case does not matter and extra words after the keyword are ignored. A diagram example *inside* another code block stays code, so documenting diagram syntax is safe.

| Need | Use | Renders in |
|---|---|---|
| flow, sequence, state, ER, class, gantt, timeline, mindmap, pie/xy/sankey charts | Mermaid | both |
| screen mock-up, form, dashboard, UI flow step | OmniWare | both |
| architecture with nested containers | Mermaid `flowchart` + `subgraph`; D2 only for desktop docs | both / desktop |
| electronic schematic | tscircuit | desktop |

### Mermaid 10.9.5 (details and verified examples: `references/mermaid.md`)

- **Works:** `flowchart`/`graph`, `sequenceDiagram`, `classDiagram`, `stateDiagram-v2`, `erDiagram`, `gantt`, `pie`, `journey`, `gitGraph`, `mindmap`, `timeline`, `quadrantChart`, `sankey-beta`, `xychart-beta`, `block-beta`, `requirementDiagram`, `C4Context`.
- **Too new (show an error):** `architecture-beta`, `kanban`, `packet-beta`, `radar-beta`, `treemap`, `zenuml`.
- **Labels:**
  - `<` directly before a letter is cut off by Mermaid's strict sanitizer: `A["Vin<Vmax"]` shows "Vin". Write `#lt;` (`A["Vin #lt; Vmax"]`) or put spaces around `<`.
  - Use `~T~` for generics and plain `<<interface>>` for class annotations.
  - `<br>` in a label makes a line break.
- `click` does nothing, because Mermaid runs in strict mode.

### OmniWare wireframes (read `references/omniware.md` before writing one)

OmniWare is Omnicore's own wireframe DSL, and its rules are strict. The reference file is built from the parser and was verified by rendering; the old README/spec examples were wrong before viewer 2.3.0.

- `@page "Title" status:draft|review|approved` comes first, and **everything else is indented under it**. Otherwise the page frame renders empty. The page title is not displayed, so put visible titles in `@breadcrumb`, `@nav` or `@section`.
- Header props are `key:value` with no space after the colon, and titles are quoted: `@section "Özet" icon:info ref:FR-1`. `title="…"` is not syntax.
- Only `@page`, `@section` and `@col` (inside `@columns`) contain other blocks. `@buttons` goes *after* `@form` as a sibling.
- Form fields are `type  "Label"  flags`, separated by **two or more spaces**. Buttons are `[primary] Label`.
- `{green}Text` has no space after `}` and comes last in a cell or line. `(UPPERCASE)` in parentheses becomes a reference chip. `---` is not a divider; use `@divider`.
- Wrong syntax never errors: lines just vanish or show as text. Always `--render`.

### Desktop-only features

D2, tscircuit, `@@@html`, sliders and notes are covered in `references/desktop.md`.

## Exports and using the viewer

- **VS Code:**
  - Clicking a `.md` opens the viewer; "Omnicore: Open as Text" (editor title icon) opens it for editing.
  - The viewer follows changes to the file and keeps its scroll position.
  - The toolbar exports PDF (A4, light theme). It uses a locally installed Chrome, Edge or Chromium; set `omnicore.pdf.browserPath` if none is found.
  - The toolbar also exports Word: images are embedded and Mermaid becomes PNG.
- **Desktop:**
  - File → Export gives PDF, Word or HTML.
  - Before a PDF, set zoom to 100%. For the Omnicore letterhead (logo, file name, company footer, page numbers), press **Ctrl+Shift+O** first; it is off at every launch.
  - The file name becomes the export name and the letterhead label, so name files for their audience.
- **Word** (both) keeps Mermaid as an image. D2, tscircuit and OmniWare are lost.
- For page breaks in PDF, use `<div style="page-break-after: always"></div>`.
- Full details are in `references/viewer-usage.md`: install and update, CLI, shortcuts, notes, translation and known limitations. Read it when the user asks how to do something in the viewer, or wants the viewer itself changed.
