# Using the Omnicore Markdown Viewer

Read this when the user asks how to do something in the viewer, wants a document exported, or wants the viewer itself changed. The source is `github.com/OmniCoreST/omnicore-markdown-viewer`: the desktop app is at the repo root, the VS Code extension is in `vscode-extension/`, and `markdown-shared.js` holds the rules both share (it is copied into the extension; CI checks the copies are identical).

## Contents
1. VS Code extension
2. Desktop app: install, open, reload
3. Desktop app: editing
4. Exports
5. Desktop app: shortcuts and settings
6. Known limitations

## 1. VS Code extension (`omnicore.omnicore-markdown-viewer` ≥ 1.2.0)

- **Install / update:** download `omnicore-markdown-viewer-X.Y.Z.vsix` from the GitHub release, then run `code --install-extension <file>.vsix --force`.
  - To build it yourself without Node on the host: in `vscode-extension/` run `docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD":/w -w /w node:22 sh -c "npm install && npx vsce package --skip-license"`.
- **Default editor.** `*.md`, `*.markdown`, `*.mmd`, `*.mermaid` and `*.ow` open in the viewer (custom editor `omnicore.markdownEditor`).
  - The viewer is **read-only**, by design: it is for viewing.
  - To edit, use **Omnicore: Open as Text** (editor title icon) or *Reopen Editor With… → Text Editor*.
  - When the file changes (typing, or another tool writing it), the viewer re-renders after 200 ms and keeps its scroll position.
- **Side preview:** from a Markdown text editor, `Ctrl+Shift+V` (preview) or `Ctrl+K V` (to the side).
- **Toolbar:**
  - zoom (`-` / `100%` / `+`, Ctrl `+`/`-`/`0`, Ctrl+wheel);
  - search (Ctrl+F);
  - TOC (h1–h6);
  - **PDF** and **DOCX** export (§4).
- **Hover buttons:**
  - code blocks: copy;
  - tables: pop-out with sort, filter, paging and CSV/JSON export;
  - diagrams and wireframes: pop-out with zoom, pan and Reset View; wireframes can also export PDF.
- **Links:**
  - `.md` targets open in the viewer and scroll to the `#fragment`;
  - `https`, `mailto` and `tel` links open externally;
  - a link to a folder reveals it in the Explorer;
  - `/docs/x.md` resolves from the workspace root.
- **Images:** local images are served from the document's folder and the workspace folders.
- **Theme:** follows VS Code, and diagrams re-render on a theme change.
- **Recent Files:** Activity Bar → Omnicore.
- **Setting:** `omnicore.pdf.browserPath` is the browser used for PDF export.

## 2. Desktop app: install, open, reload

- **Release assets** (GitHub `OmniCoreST/omnicore-markdown-viewer`, names without spaces from 2.3.0):
  - `Omnicore-Markdown-Viewer-Setup-X.Y.Z.exe`
  - `Omnicore-Markdown-Viewer-X.Y.Z-portable.exe`
  - `omnicore-markdown-viewer_X.Y.Z_amd64.deb`
  - `Omnicore-Markdown-Viewer-X.Y.Z.AppImage`
  - `Omnicore-Markdown-Viewer-X.Y.Z-arm64.dmg` (plus a `-mac.zip` for auto-update)
- **Ubuntu:** use the `.deb`. On Ubuntu 24.04+ the AppImage needs `--no-sandbox` (AppArmor) and libfuse2.
  ```bash
  gh release download -R OmniCoreST/omnicore-markdown-viewer -p '*_amd64.deb'
  sudo apt install ./omnicore-markdown-viewer_*_amd64.deb
  xdg-mime default omnicore-markdown-viewer.desktop text/markdown   # optional: default .md app
  ```
- **Open a file:** `setsid -f omnicore-markdown-viewer "/abs/path/doc.md" >/dev/null 2>&1`.
  - Use an absolute path. A second call hands the file to the running window, and asks first if there are unsaved changes.
  - There is one window and no tabs.
  - macOS Finder/`open` also works.
- **Automation:** there is none. No headless or CLI export, no URL protocol and no external IPC. An agent can write the file, open it for the user, and ask the user to export.
- **Reload:** the open file is watched. An external change shows a "File Updated" toast with **Reload** (Ctrl+R); there is no auto-reload.
- **Auto-update:** a prompt appears 5 s after launch when a newer GitHub release exists. On Linux, `.deb` updates ask for the admin password.

## 3. Desktop app: editing

- **Edit Mode** (File menu): a plain textarea on the left and a live preview on the right.
  - Ctrl+S saves. Ctrl+Z / Ctrl+Y undo and redo.
  - Ctrl+B, Ctrl+I and Ctrl+` toggle bold, italic and inline code.
  - Tab inserts 2 spaces.
- **Right-click edits in view mode:** bold, italic, code, list, edit text, notes, and insert/edit/delete image, table and Mermaid.
  - These edits mark the document **● Unsaved**, and Ctrl+S saves them.
  - Opening another file, reloading, going back/forward or quitting asks Save / Don't Save / Cancel.
- **Insert Mermaid:** 12 templates with a live preview, validated before insert. **Insert Table:** up to 30×15. **Insert Image:** embeds the image as a WebP data URI.
- **Notes:** select text → Add Note. See `desktop.md` §5. File → All Notes lists them.
- **Translation:** Tools → Language → Document (EN/TR). It uses Google's unofficial endpoint, **sends the text to Google** and needs internet. Code, diagrams and URLs are kept.

## 4. Exports

| Export | VS Code extension | Desktop app |
|---|---|---|
| **PDF** | Toolbar or *Omnicore: Export to PDF*. A4, light theme, fonts embedded. It prints with a locally installed Chrome, Edge or Chromium (`omnicore.pdf.browserPath`, `CHROME_PATH`, or found automatically). Without a browser it saves an HTML file to print from a browser. A snap-installed Chromium may not see `/tmp`; set the path to another browser then. | File → Export → PDF. A4 portrait, light theme, opens afterwards. Collapsed sections are printed and ▼ markers hidden. **Ctrl+Shift+O** first adds the Omnicore letterhead. |
| **Word (.docx)** | Images embedded, Mermaid as PNG, code line breaks kept. | Images embedded, Mermaid as PNG. |
| **HTML** | – | `name.html` plus a `name.files/` folder (CSS and images). Fonts and OmniWare styles are not included. |
| **Table CSV/JSON** | table pop-out | table pop-out |
| **Diagram / wireframe PDF** | pop-out | pop-out (A4 landscape; letterhead in corporate mode) |

In both apps, Word export drops D2, tscircuit and OmniWare (text only).

## 5. Desktop app: shortcuts and settings

| Key | Action |
|---|---|
| Ctrl+O | open (asks if there are unsaved changes) |
| Ctrl+S | save |
| Ctrl+R | reload from disk |
| Ctrl+F | search |
| Ctrl+D | dark mode |
| Ctrl + `+` / `-` / `0`, Ctrl+wheel | zoom |
| Ctrl+Shift+O | corporate letterhead mode |
| Ctrl+B / Ctrl+I / Ctrl+` | bold / italic / inline code (editor) |
| ← / → | back / forward through opened files |
| F11 / Esc | fullscreen |
| F12 | DevTools |
| Ctrl+Q | quit (asks if there are unsaved changes) |

- Click a heading to collapse its section.
- The theme is a manual light/dark toggle.
- Settings live in localStorage under `~/.config/omnicore-markdown-viewer/`: dark mode, UI language, notes visibility, split ratio and recent files. `debug.log` is in the same place.

## 6. Known limitations

- **Mermaid labels:** Mermaid's strict sanitizer cuts label text at `<` + letter (`Vin<Vmax` → "Vin"). Write `#lt;`.
- **Not supported:** footnotes, `> [!NOTE]` callouts, math, `==mark==` and `^sup^`.
- **Wide tables:** tables with 6+ columns use a compact 11px style.
- **VS Code extension:**
  - It has no D2, tscircuit, notes, sliders, `@@@html`, translation or letterhead.
  - Images must be inside the workspace or the document's folder.
  - Windows drive-letter image paths are best effort.
  - When the side preview follows a file outside the workspace, its zoom resets.
- **Desktop app:**
  - D2 SVG output is not sanitised (D2 escapes labels).
  - The Mermaid, D2 and tscircuit pop-up windows still run with Node integration.
  - HTML export does not bundle the fonts or the OmniWare CSS.
