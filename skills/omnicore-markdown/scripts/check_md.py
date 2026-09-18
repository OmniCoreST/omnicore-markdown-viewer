#!/usr/bin/env python3
"""Lint Markdown for the Omnicore Markdown Viewer (VS Code extension >= 1.2.0, desktop app >= 2.3.0).

Usage:
  check_md.py FILE [FILE ...] [--render] [--no-info] [--base DIR]

Static checks need only Python 3. They encode behaviour verified against the viewers'
rendering pipeline (marked 9.1.6 + DOMPurify 3.3.0 + Mermaid 10.9.5 + OmniWare).

--render additionally renders every mermaid and omniware block with the viewer's own
bundled libraries in headless Chrome (google-chrome / chromium). Libraries are taken from the
installed VS Code extension (~/.vscode/extensions/omnicore.omnicore-markdown-viewer-*/media)
or from $OMNICORE_VIEWER_MEDIA.

--base DIR checks relative links and images as if the file lived in DIR.

Levels: ERROR = renders wrong / broken link · WARN = wrong in one viewer or very likely
unintended · INFO = worth knowing (desktop-only feature, no syntax colouring, ...).
Exit code: 1 if any ERROR was found, else 0.
"""
from __future__ import annotations

import argparse
import html
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import unquote

FENCE_RE = re.compile(r"^(\s*)(`{3,}|~{3,})(.*)$")
DIAGRAM_LANGS = {"mermaid": "mermaid", "omniware": "omniware", "wireframe": "omniware", "d2": "d2",
                 "tscircuit": "tscircuit"}

PRISM_LANGS = {
    "plain", "plaintext", "text", "txt", "markup", "html", "mathml", "svg", "xml", "ssml", "atom", "rss",
    "css", "clike", "javascript", "js", "typescript", "ts", "jsx", "tsx", "json", "webmanifest",
    "python", "py", "java", "c", "cpp", "csharp", "cs", "dotnet", "bash", "sh", "shell", "sql",
}
LANG_SUGGEST = {"c#": "csharp", "console": "bash", "shell-session": "bash", "zsh": "bash"}

MERMAID_OK = {
    "flowchart", "graph", "flowchart-elk", "sequenceDiagram", "classDiagram", "classDiagram-v2",
    "stateDiagram", "stateDiagram-v2", "erDiagram", "gantt", "pie", "journey", "gitGraph", "mindmap",
    "timeline", "quadrantChart", "sankey-beta", "xychart-beta", "block-beta", "requirementDiagram",
    "C4Context", "C4Container", "C4Component", "C4Dynamic", "C4Deployment", "info",
}
MERMAID_TOO_NEW = {"architecture-beta", "architecture", "kanban", "packet-beta", "packet", "radar-beta",
                   "treemap", "treemap-beta", "zenuml"}

OW_KEYWORDS = {"page", "nav", "breadcrumb", "section", "grid", "badges", "tabs", "table", "buttons", "form",
               "note", "alert", "placeholder", "formula", "locked", "radio", "textarea", "divider", "footer",
               "progress", "metric", "columns", "col"}
OW_CONTAINERS = {"root", "page", "section", "col"}
OW_BLOCKS_AFTER = {"grid", "badges", "table", "locked"}          # nested @blocks still render
OW_FIRST_LINE_ONLY = {"nav", "tabs", "radio", "progress", "breadcrumb"}
OW_INLINE_PARENTS = OW_CONTAINERS | {"grid", "table", "note", "alert", "formula", "footer", "locked"}
OW_PROPS = {"icon", "ref", "cols", "type", "status", "height", "rows"}
OW_FORM_TYPES = {"text", "date", "number", "select", "textarea", "file", "checkbox", "radio"}
COLOR = r"\{(?:green|red|yellow|blue|gray)\}"

# Ids that DOMPurify strips from raw HTML (DOM-clobbering guard) — verified in Chrome.
CLOBBER_IDS = {"title", "images", "links", "forms", "body", "head", "domain", "location", "fonts", "scripts",
               "anchors", "embeds", "plugins", "all", "children", "style", "hidden", "name", "target", "action",
               "method", "length", "elements", "dir", "lang", "id", "timeline", "close", "open", "write",
               "cookie", "referrer", "dataset", "slot", "part", "prefix", "role", "translate", "submit",
               "reset", "encoding"}
MARKDOWN_EXT = {".md", ".markdown", ".mdown", ".mkd", ".mkdn"}


@dataclass
class Finding:
    level: str
    line: int
    rule: str
    msg: str


# ---------- anchors (same rules as markdown-shared.js) ----------
def github_slug(text: str) -> str:
    out = []
    for ch in text.strip().lower():
        cat = unicodedata.category(ch)
        if ch in "- " or cat[0] in "LMN" or cat == "Pc":
            out.append(ch)
    return "".join(out).replace(" ", "-")


def legacy_slug(text: str) -> str:
    s = re.sub(r"[^A-Za-z0-9_\s-]", "", text.strip().lower())
    return re.sub(r"\s+", "-", s).strip("-")


def strip_marks(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if not unicodedata.category(c).startswith("M")).lower()


def heading_text(md: str) -> str:
    t = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", md)                 # images have no text
    t = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", t)               # links keep their text
    t = re.sub(r"<[^>]+>", "", t)
    t = re.sub(r"\*\*|__|\*|(?<!\w)_|_(?!\w)|`", "", t)
    return html.unescape(t)


class Anchors:
    """Anchor targets of one Markdown file: explicit ids + GitHub slugs (+ legacy slugs)."""

    def __init__(self, lines: list[str], in_code: list[bool]):
        self.ids: set[str] = set()
        self.slugs: set[str] = set()
        self.legacy: set[str] = set()
        occ: dict[str, int] = {}
        prev = ""
        for i, line in enumerate(lines):
            if in_code[i]:
                prev = ""
                continue
            text = None
            m = re.match(r"^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$", line)
            if m:
                text = m.group(1)
            elif re.match(r"^\s{0,3}(=+|-+)\s*$", line) and prev.strip() and not re.match(r"^\s*([-*+|>]|\d+[.)])", prev):
                text = prev.strip()
            if text is not None:
                plain = heading_text(text)
                slug = github_slug(plain)
                base = slug
                while slug in occ:
                    occ[base] += 1
                    slug = f"{base}-{occ[base]}"
                occ[slug] = 0
                self.slugs.add(slug)
                self.legacy.add(legacy_slug(plain))
            for m2 in re.finditer(r"\b(?:id|name)=[\"']([^\"']+)[\"']", line):
                self.ids.add(m2.group(1))
            prev = line

    def has(self, frag: str) -> bool:
        low = frag.lower()
        pool = self.ids | self.slugs
        return (frag in pool or low in {x.lower() for x in pool}
                or strip_marks(frag) in {strip_marks(x) for x in pool} or low in self.legacy)


_anchor_cache: dict[Path, Anchors] = {}


def anchors_of_file(path: Path) -> Anchors | None:
    try:
        path = path.resolve()
        if path not in _anchor_cache:
            lt = Linter(path)
            lt.scan_structure()
            _anchor_cache[path] = Anchors(lt.lines, lt.in_fence)
        return _anchor_cache[path]
    except OSError:
        return None


class Linter:
    def __init__(self, path: Path, base: Path | None = None):
        self.path = path
        self.base = base
        self.text = path.read_text(encoding="utf-8-sig", errors="replace").replace("\r\n", "\n")
        self.lines = self.text.split("\n")
        self.findings: list[Finding] = []
        self.fences: list[tuple[int, int, str, str, int]] = []   # (start, end, char, info, indent) 0-based
        self.in_fence = [False] * len(self.lines)
        self.in_comment = [False] * len(self.lines)
        self.blocks: list[dict] = []                               # diagram blocks the viewer will render
        self.offset = 0                                            # -1 when a .ow/.mmd file was auto-wrapped

    def add(self, level: str, line: int, rule: str, msg: str) -> None:
        self.findings.append(Finding(level, line, rule, msg))

    def prose(self):
        for i, raw in enumerate(self.lines):
            if not self.in_fence[i] and not self.in_comment[i]:
                yield i, re.sub(r"`[^`\n]*`", "``", raw)   # drop inline code spans

    # ---------- structure ----------
    def scan_structure(self) -> None:
        open_ = None
        for i, line in enumerate(self.lines):
            m = FENCE_RE.match(line)
            if open_ is None:
                if m and not (m.group(2)[0] == "`" and "`" in m.group(3)):
                    open_ = (i, m.group(2)[0], len(m.group(2)), m.group(3).strip(), len(m.group(1)))
            elif m and m.group(2)[0] == open_[1] and len(m.group(2)) >= open_[2] and not m.group(3).strip():
                self.fences.append((open_[0], i, open_[1], open_[3], open_[4]))
                open_ = None
        if open_:
            self.fences.append((open_[0], len(self.lines) - 1, open_[1], open_[3], open_[4]))
            self.add("WARN", open_[0] + 1, "fence-unclosed", "code fence is never closed; the rest of the file is code")
        for s, e, *_ in self.fences:
            for k in range(s, e + 1):
                self.in_fence[k] = True
        if self.lines and self.lines[0].strip() == "---":            # front matter: shown as a table
            end = next((j for j in range(1, min(len(self.lines), 200)) if self.lines[j].strip() in ("---", "...")), -1)
            if end > 0 and any(re.match(r"^[A-Za-z0-9_-]+\s*:", x) for x in self.lines[1:end]):
                for k in range(end + 1):
                    self.in_comment[k] = True
        inside = False
        for i, line in enumerate(self.lines):
            if self.in_fence[i] or self.in_comment[i]:
                continue
            if inside:
                self.in_comment[i] = True
                inside = "-->" not in line
            elif line.lstrip().startswith("<!--"):
                self.in_comment[i] = True
                inside = "-->" not in line.split("<!--", 1)[1]

    # ---------- diagram blocks ----------
    def scan_diagrams(self) -> None:
        for s, e, ch, info, indent in self.fences:
            word = info.split()[0].lower() if info.split() else ""
            kind = DIAGRAM_LANGS.get(word)
            if not kind:
                continue
            body_lines = [ln[indent:] if ln[:indent].strip() == "" else ln.lstrip() for ln in self.lines[s + 1:e]]
            body = "\n".join(body_lines)
            self.blocks.append({"kind": kind, "line": s + 1, "body": body, "body_line": s + 2})
            getattr(self, f"check_{kind}")(body, s + 2)

    def check_mermaid(self, body: str, first: int) -> None:
        lines = body.split("\n")
        i = 0
        while i < len(lines) and (not lines[i].strip() or lines[i].strip().startswith("%%")):
            i += 1
        if i < len(lines) and lines[i].strip() == "---":
            i += 1
            while i < len(lines) and lines[i].strip() != "---":
                i += 1
            i += 1
            while i < len(lines) and (not lines[i].strip() or lines[i].strip().startswith("%%")):
                i += 1
        if i < len(lines):
            m = re.match(r"\s*([A-Za-z0-9_-]+)", lines[i])
            dtype = m.group(1) if m else ""
            if dtype in MERMAID_TOO_NEW:
                self.add("ERROR", first + i, "mermaid-type",
                         f"'{dtype}' does not exist in the bundled Mermaid 10.9.5 (syntax-error bomb)")
            elif dtype not in MERMAID_OK:
                self.add("WARN", first + i, "mermaid-type", f"unknown Mermaid diagram type '{dtype}'")
        for k, line in enumerate(lines):
            if re.match(r"\s*click\s", line):
                self.add("WARN", first + k, "mermaid-click", "'click' does nothing: Mermaid runs in strict mode")

    def check_d2(self, body: str, first: int) -> None:
        self.add("INFO", first - 1, "d2-desktop-only", "D2 renders only in the desktop app; VS Code shows plain code")
        for k, line in enumerate(body.split("\n")):
            if "$" in line:
                self.add("ERROR", first + k, "d2-dollar", "'$' starts a D2 substitution; the compile fails")
            if re.match(r"\s*(layers|scenarios|steps)\s*:", line):
                self.add("WARN", first + k, "d2-boards", "only the root board is shown; layers/scenarios/steps are dropped")
            if "d2-config" in line:
                self.add("INFO", first + k, "d2-config", "in-source d2-config is ignored (fixed: dagre, theme 0/200, no sketch)")

    def check_tscircuit(self, body: str, first: int) -> None:
        self.add("INFO", first - 1, "tscircuit-desktop-only",
                 "tscircuit renders only in the desktop app; see the tscircuit-schematics skill for layout rules")
        for k, line in enumerate(body.split("\n")):
            if re.search(r"""(from|to)=["']\.[\w-]+ \.""", line):
                self.add("ERROR", first + k, "tscircuit-selector",
                         "space selector ('.R1 .pin1') silently drops the trace; use '.R1 > .pin1'")
            if "@tsci/" in line:
                self.add("WARN", first + k, "tscircuit-import", "@tsci/* registry imports cannot resolve offline")

    def check_omniware(self, body: str, first: int) -> None:
        stack = [{"indent": -1, "type": "root", "n": 0}]
        first_node = None
        after_page_root = False
        for k, raw in enumerate(body.split("\n")):
            ln = first + k
            t = raw.replace("\t", "  ").rstrip()
            s = t.lstrip()
            if not s or s.startswith("//"):
                continue
            indent = (len(t) - len(s)) // 2
            while len(stack) > 1 and stack[-1]["indent"] >= indent:
                stack.pop()
            parent = stack[-1]["type"]
            m = re.match(r"^@(\w+)\s*(.*)", s)
            if first_node is None:
                first_node = m.group(1) if m else "content"
            elif first_node == "page" and indent == 0:
                if not after_page_root:
                    self.add("ERROR", ln, "ow-page-indent",
                             "line at indent 0 after @page renders OUTSIDE the page frame (frame stays empty). "
                             "Indent everything under @page")
                after_page_root = True
            if m:
                kw, rest = m.group(1), m.group(2)
                stack.append({"indent": indent, "type": kw, "n": 0})
                if kw not in OW_KEYWORDS:
                    self.add("ERROR", ln, "ow-keyword", f"unknown keyword @{kw}: header shown as text, children dropped")
                    continue
                if parent == "content":
                    self.add("ERROR", ln, "ow-dropped", f"@{kw} nested under a content line is dropped")
                elif parent == "columns" and kw != "col":
                    self.add("ERROR", ln, "ow-dropped", f"only @col renders inside @columns; @{kw} is dropped")
                elif parent not in OW_CONTAINERS | OW_BLOCKS_AFTER | {"columns", "content"}:
                    self.add("ERROR", ln, "ow-dropped",
                             f"@{kw} nested inside @{parent} is dropped; make it a sibling after @{parent}")
                if re.search(r"\b\w+=", rest):
                    self.add("ERROR", ln, "ow-equals",
                             "key=\"value\" (README style) is not OmniWare syntax: use @kw \"Title\" key:value")
                if re.search(r"\b(" + "|".join(OW_PROPS) + r")\s*:\s+\S", rest):
                    self.add("WARN", ln, "ow-prop-space", "no space allowed after ':' in key:value props")
                if not rest.startswith('"'):
                    title_part = re.sub(r"\b(" + "|".join(OW_PROPS) + r"):\S+", "", rest)
                    if re.search(r"\w:\S", title_part):
                        self.add("WARN", ln, "ow-quote-title",
                                 "unquoted title containing 'x:y' loses that part; quote the title")
                if re.search(r"\bref:\S*,\s", rest):
                    self.add("WARN", ln, "ow-ref-space", "ref list stops at the first space; write ref:A,B or ref:\"A, B\"")
                if kw == "page" and re.search(r"\bstatus:(?!(draft|review|approved)\b)", rest):
                    self.add("WARN", ln, "ow-status", "status must be draft, review or approved")
                continue
            stack[-1]["n"] += 1
            n = stack[-1]["n"]
            stack.append({"indent": indent, "type": "content", "n": 0})
            if parent == "content":
                self.add("ERROR", ln, "ow-dropped", "line indented under a content line is silently dropped")
                continue
            if s == "---":
                self.add("WARN", ln, "ow-divider", "'---' renders as the text '---'; use @divider")
            if parent in OW_FIRST_LINE_ONLY and n > 1:
                self.add("WARN", ln, "ow-first-line-only", f"@{parent} uses only its first line; this line is ignored")
            if parent == "columns":
                self.add("ERROR", ln, "ow-dropped", "text directly under @columns is dropped; put it in @col")
            if parent == "form":
                parts = re.split(r"\s{2,}", s)
                if len(parts) < 2:
                    self.add("ERROR", ln, "ow-form",
                             "form line is dropped: separate type, \"Label\" and flags with TWO or more spaces")
                elif parts[0] not in OW_FORM_TYPES:
                    self.add("INFO", ln, "ow-form-type", f"unknown field type '{parts[0]}' falls back to a text input")
                elif re.match(r"^[a-z]+:", parts[1]):
                    self.add("ERROR", ln, "ow-form", "missing \"Label\": the flag became the label")
            if parent == "buttons" and not re.match(r"^\[(primary|success|danger|default)\]\s+\S", s):
                self.add("WARN", ln, "ow-button",
                         "button line should be '[primary|success|danger|default] Label' (a bare [Label] shows brackets)")
            if parent in ("grid", "metric") and ":" not in s:
                self.add("ERROR", ln, "ow-kv", f"@{parent} line without ':' is skipped")
            if parent == "table" and s.strip() == "---":
                self.add("WARN", ln, "ow-table-sep", "@table separator is exactly '--' (two dashes)")
            if parent in OW_INLINE_PARENTS:
                if re.search(COLOR + r"\s", s):
                    self.add("WARN", ln, "ow-color-space", "'{color} text' with a space stays literal; write {color}Text")
                for seg in re.split(r"\|| {2,}", s):
                    if len(re.findall(COLOR, seg)) > 1:
                        self.add("WARN", ln, "ow-color-swallow",
                                 "a {color} tag swallows text up to 2 spaces, '|' or end of line; "
                                 "put {color} last or separate with two spaces")
                        break
                if re.search(r"\*\*" + COLOR, s):
                    self.add("WARN", ln, "ow-color-bold", "write {green}**x**, not **{green}x**")

    # ---------- markdown prose ----------
    def check_prose(self) -> None:
        prev_para = False
        last_i = -2
        for i, line in self.prose():
            ln = i + 1
            if i != last_i + 1:
                prev_para = False
            last_i = i
            is_rule = bool(re.match(r"^\s{0,3}(-{3,}|={3,})\s*$", line))
            if is_rule and prev_para and i > 0:
                self.add("WARN", ln, "setext-trap",
                         "text line directly followed by ---/=== becomes a heading; add a blank line for a rule")
            prev_para = bool(line.strip()) and not is_rule and \
                not re.match(r"^\s*(#{1,6}\s|\||<|[-*+]\s|\d+[.)]\s|>)", line)

            if re.search(r"\[\^[^\]\s]+\]", line):
                self.add("WARN", ln, "footnote", "footnotes are not supported (shown literally); use <sup> + an anchor")
            if re.match(r"^\s*>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]", line, re.I):
                self.add("WARN", ln, "callout", "'> [!NOTE]' callouts are not supported; use '> **⚠️ Not:** …'")
            if re.search(r"(?<![=\w])==[^=\s][^=]*==(?!=)", line):
                self.add("WARN", ln, "mark", "==highlight== is not supported; use <mark>")
            if re.search(r"(?<!\[)\^[^\s^\]]+\^", line):
                self.add("WARN", ln, "sup", "^sup^ is not supported; use <sup>")
            if "$$" in line or re.search(r"\$[^$\s][^$]*\\[a-zA-Z]+[^$]*\$", line):
                self.add("WARN", ln, "math", "math ($…$ / $$…$$) is not supported; shown literally")
            if re.search(r"\{#[\w-]+\}\s*$", line):
                self.add("WARN", ln, "heading-attr", "{#id} is not supported; add <a id=\"x-y\"></a> to the heading")
            if re.match(r"^\s*(\[TOC\]|\[\[_TOC_\]\])\s*$", line):
                self.add("WARN", ln, "toc-marker", "[TOC] is not supported (the viewers have a TOC panel)")
            if re.match(r"^\s*:::", line):
                self.add("WARN", ln, "container", "':::' containers are not supported")
            if len(re.findall(r"(?<![~\\])~(?!~)", line)) >= 2:
                self.add("WARN", ln, "single-tilde",
                         "single ~…~ strikes text through (e.g. '5~10 kV … 20~30 A'); use '–' or '≈' or '\\~'")
            if re.match(r"^\s*\d{3,}\.\s", line):
                self.add("INFO", ln, "number-list", "'2024. …' at line start becomes an ordered list; write '2024\\. …'")
            if re.search(r"<style\b", line, re.I):
                self.add("WARN", ln, "style-global", "<style> applies to the whole viewer UI; scope rules under .markdown-body")
            if "@@@html" in line:
                self.add("INFO", ln, "raw-html-block", "@@@html blocks render only in the desktop app (sandboxed iframe)")
            if re.search(r"<iframe\b", line, re.I):
                self.add("WARN", ln, "iframe", "<iframe> is blocked by the VS Code webview CSP (empty box)")
            if re.search(r"class=[\"'](noted-text|noted-image|note-label)", line):
                self.add("INFO", ln, "note-span", "desktop note span: keep attribute order class, data-note-id, "
                                                  "data-note-title, data-note-content")
            if re.match(r"^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$", line):
                cols = len(line.strip().strip("|").split("|"))
                if cols > 5:
                    self.add("WARN", ln, "table-wide", f"{cols}-column table switches to the 11px no-wrap compact "
                                                       "style and is clipped in PDF; split it (max 5 columns)")
            for m in re.finditer(r"\bid=[\"']([^\"']+)[\"']", line):
                if m.group(1).lower() in CLOBBER_IDS:
                    self.add("WARN", ln, "id-clobber",
                             f"id=\"{m.group(1)}\" is stripped by DOMPurify; use a multi-word id like 'x-{m.group(1)}'")
        for ln in range(len(self.lines)):
            if self.in_comment[ln] and re.search(r"<!--\s*slider-start", self.lines[ln]):
                self.add("INFO", ln + 1, "slider", "image slider is desktop-only; VS Code shows the images inline")

    # ---------- links and images ----------
    def check_links(self) -> None:
        own = Anchors(self.lines, self.in_fence)
        base = self.base or self.path.parent
        link_re = re.compile(r"(!?)\[((?:[^\[\]]|\[[^\]]*\])*)\]\(\s*(<[^>]*>|[^)\s]+)(?:\s+\"[^\"]*\")?\s*\)")
        for i, line in self.prose():
            ln = i + 1
            targets = [(m.group(1) == "!", m.group(3).strip("<>")) for m in link_re.finditer(line)]
            targets += [(False, m.group(1)) for m in re.finditer(r"^\s*\[(?!\^)[^\]]+\]:\s*<?(\S+?)>?(\s|$)", line)]
            targets += [(False, m.group(1)) for m in re.finditer(r"<a\b[^>]*\bhref=[\"']([^\"']+)", line, re.I)]
            targets += [(True, m.group(1)) for m in re.finditer(r"<img\b[^>]*\bsrc=[\"']([^\"']+)", line, re.I)]
            for is_img, url in targets:
                if is_img:
                    self.check_image(ln, url, base)
                else:
                    self.check_link(ln, url, own, base)

    def check_image(self, ln: int, url: str, base: Path) -> None:
        if url.startswith(("https://", "data:image/")):
            return
        if url.startswith("http://"):
            self.add("WARN", ln, "img-http", f"http:// image is blocked in VS Code (CSP allows https: and data:): {url}")
        elif url.startswith("file:") or re.match(r"^[A-Za-z]:\\", url):
            self.add("ERROR", ln, "img-file", f"file:// / C:\\ image src is stripped by the sanitizer; use a relative path: {url}")
        elif re.match(r"^[a-z][a-z0-9+.-]*:", url, re.I) or url.startswith("//"):
            return
        else:
            p = Path(unquote(url.split("#")[0].split("?")[0]))
            target = p if p.is_absolute() else (base / p)
            if not target.exists():
                self.add("ERROR", ln, "img-missing", f"image file does not exist: {url}")
            elif p.is_absolute():
                self.add("WARN", ln, "img-abs",
                         f"absolute image path shows in VS Code only inside the workspace / document folder: {url}")

    def check_link(self, ln: int, url: str, own: Anchors, base: Path) -> None:
        if re.match(r"^(https?|mailto|tel):", url, re.I):
            return
        if url.startswith("#"):
            frag = unquote(url[1:])
            if frag and not own.has(frag):
                self.add("ERROR", ln, "anchor-missing", f"no heading or id matches '#{frag}' in this file")
            elif re.fullmatch(r"header-\d+", frag):
                self.add("INFO", ln, "anchor-header-n", f"'#{frag}' depends on heading order; link the heading slug")
            return
        if re.match(r"^(file|vscode|vscode-insiders):", url):
            self.add("ERROR", ln, "link-scheme", f"'{url.split(':')[0]}:' href is stripped by the sanitizer (dead text)")
            return
        if re.match(r"^[a-z][a-z0-9+.-]*:", url, re.I) and not re.match(r"^[A-Za-z]:[\\/]", url):
            return
        path_part, _, frag = url.partition("#")
        path_part = unquote(path_part.split("?")[0])
        frag = unquote(frag)
        if not path_part:
            return
        p = Path(path_part)
        target = p if p.is_absolute() else (base / p)
        if not target.exists():
            self.add("ERROR", ln, "link-missing", f"linked file does not exist: {path_part}")
            return
        if frag and target.is_file() and target.suffix.lower() in MARKDOWN_EXT:
            a = anchors_of_file(target)
            if a is not None and not a.has(frag):
                self.add("ERROR", ln, "link-anchor-missing", f"no heading or id matches '#{frag}' in {path_part}")

    def check_code_fences(self) -> None:
        seen: set[str] = set()
        for s, e, ch, info, _ in self.fences:
            word = info.split()[0] if info.split() else ""
            lw = word.lower()
            if lw in DIAGRAM_LANGS or not word or lw in PRISM_LANGS or lw in seen:
                continue
            seen.add(lw)
            hint = f"; use '{LANG_SUGGEST[lw]}'" if lw in LANG_SUGGEST else ""
            self.add("INFO", s + 1, "code-lang", f"'{word}' has no syntax colouring in the viewers (plain){hint}")

    def run(self) -> list[Finding]:
        self.scan_structure()
        self.scan_diagrams()
        self.check_prose()
        self.check_links()
        self.check_code_fences()
        return self.findings


# ---------- --render: real libraries in headless Chrome ----------
HARNESS_JS = r"""
const out = document.getElementById('out');
function done(r) { out.textContent = 'RESULT:' + JSON.stringify(r); }
function owVerify(dsl) {
  const htmlStr = OmniWare.toHTML(dsl);
  const decode = s => s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&amp;/g,'&');
  const norm = s => s.replace(/\s+/g,' ').trim();
  const text = norm(decode(htmlStr.replace(/<[^>]+>/g,'')));
  const strip = s => s.replace(/\*\*/g,'').replace(/\{(green|red|yellow|blue|gray)\}/g,'')
    .replace(/\(([A-Z][A-Z0-9\-_~,.§ ]+?)\)/g,'$1').replace(/\[([^\]]+)\]/g,'$1');
  const problems = [];
  const expect = (ln, s) => { s = norm(s); if (s && !text.includes(s)) problems.push({line: ln, msg: 'missing in output: ' + JSON.stringify(s)}); };
  const stack = [{indent: -1, type: 'root'}];
  dsl.split('\n').forEach((raw, i) => {
    const ln = i + 1, t = raw.replace(/\t/g,'  '), s = t.trimStart();
    if (!s || s.startsWith('//')) return;
    const indent = (t.length - s.length) / 2 | 0;
    while (stack.length > 1 && stack[stack.length-1].indent >= indent) stack.pop();
    const parent = stack[stack.length-1].type;
    const m = s.match(/^@(\w+)\s*(.*)/);
    if (m) {
      stack.push({indent, type: m[1]});
      const title = (m[2].match(/^"([^"]+)"/) || [])[1];
      if (title && ['section','locked','radio','textarea'].includes(m[1])) expect(ln, title);
      return;
    }
    stack.push({indent, type: 'content'});
    switch (parent) {
      case 'nav': case 'tabs': case 'radio': case 'progress':
        s.split('|').map(x => x.trim().replace(/^\{\w+\}\s*/,'').replace(/^\*(.*)\*$/,'$1')).forEach(x => expect(ln, x)); break;
      case 'grid': { const k = s.indexOf(':'); if (k > 0) { expect(ln, s.slice(0,k)); expect(ln, strip(s.slice(k+1))); } break; }
      case 'badges': expect(ln, s.replace(/^\{\w+\}\s*/,'')); break;
      case 'buttons': expect(ln, s.replace(/^\[\w+\]\s*/,'')); break;
      case 'metric': { const k = s.indexOf(':'); if (k > 0) { expect(ln, s.slice(0,k).replace(/"/g,'')); expect(ln, (s.match(/\*\*(.+?)\*\*/)||[])[1]); } break; }
      case 'form': { const p = s.split(/\s{2,}/); if (p.length >= 2) expect(ln, p[1].replace(/"/g,'')); break; }
      case 'table': if (s.trim() !== '--') s.split('|').forEach(c => expect(ln, strip(c))); break;
      case 'textarea': case 'placeholder': case 'content': break;
      default: expect(ln, strip(s));
    }
  });
  const left = [[/\*\*/,'**'],[/\{(green|red|yellow|blue|gray)\}/,'{color}'],[/(^|\s)@[a-z]+\b/,'@keyword'],
                [/\[(primary|default|success|danger)\]/,'[style]']];
  for (const [re, label] of left) { const mm = text.match(re); if (mm) problems.push({line: 0, msg: 'leftover markup ' + label + ': …' + text.slice(Math.max(0, mm.index-40), mm.index+40) + '…'}); }
  return problems;
}
(async () => {
  const res = [];
  try { mermaid.initialize({startOnLoad: false, securityLevel: 'strict'}); } catch (e) {}
  let n = 0;
  for (const j of JOBS) {
    try {
      if (j.kind === 'mermaid') {
        await mermaid.parse(j.code);
        const holder = document.createElement('div'); document.body.appendChild(holder);
        await mermaid.render('omdchk' + (n++), j.code, holder);
        res.push({idx: j.idx, ok: true});
      } else {
        const problems = owVerify(j.code);
        res.push({idx: j.idx, ok: problems.length === 0, problems});
      }
    } catch (e) {
      res.push({idx: j.idx, ok: false, error: String((e && (e.message || e.str)) || e).slice(0, 500)});
    }
  }
  done(res);
})();
"""


def find_media() -> Path | None:
    env = os.environ.get("OMNICORE_VIEWER_MEDIA")
    if env and Path(env, "libs", "mermaid.min.js").exists():
        return Path(env)
    cands = sorted(Path.home().glob(".vscode*/extensions/omnicore.omnicore-markdown-viewer-*/media"),
                   key=lambda p: [int(x) if x.isdigit() else x for x in re.split(r"[.-]", p.parent.name)])
    return cands[-1] if cands else None


def find_chrome() -> str | None:
    for c in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge", "chrome"):
        if shutil.which(c):
            return shutil.which(c)
    return None


def render_check(linters: list[Linter]) -> None:
    jobs, where = [], []
    for lt in linters:
        for b in lt.blocks:
            if b["kind"] in ("mermaid", "omniware"):
                where.append((lt, b))
                jobs.append({"idx": len(jobs), "kind": b["kind"], "code": b["body"].strip()})
    if not jobs:
        return
    media, chrome = find_media(), find_chrome()
    if not media or not chrome:
        for lt, b in where:
            lt.add("INFO", b["line"], "render-skipped",
                   "--render skipped: " + ("Chrome/Chromium not found" if not chrome else
                                          "viewer libs not found (install the VS Code extension or set OMNICORE_VIEWER_MEDIA)"))
        return
    with tempfile.TemporaryDirectory(prefix="omdchk-") as tmp:
        page = Path(tmp, "harness.html")
        page.write_text(
            "<!doctype html><html><head><meta charset='utf-8'>"
            f"<script src='{(media / 'libs' / 'mermaid.min.js').as_uri()}'></script>"
            f"<script src='{(media / 'omniwire' / 'omniware.js').as_uri()}'></script>"
            "</head><body><pre id='out'>PENDING</pre><script>const JOBS = "
            + json.dumps(jobs).replace("</", "<\\/") + ";\n" + HARNESS_JS + "</script></body></html>",
            encoding="utf-8")
        cmd = [chrome, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
               f"--user-data-dir={Path(tmp, 'profile')}", "--allow-file-access-from-files",
               "--virtual-time-budget=30000", "--dump-dom", page.as_uri()]
        try:
            out = subprocess.run(cmd, capture_output=True, text=True, timeout=180).stdout
        except subprocess.TimeoutExpired:
            out = ""
    m = re.search(r"RESULT:(.*?)</pre>", out, re.S)
    if not m:
        for lt, b in where:
            lt.add("WARN", b["line"], "render-failed", "headless Chrome produced no result; blocks not verified")
        return
    for r in json.loads(html.unescape(m.group(1))):
        lt, b = where[r["idx"]]
        if r.get("error"):
            err = re.sub(r"\s*\n\s*", " ⏎ ", r["error"].strip())
            lt.add("ERROR", b["line"], f"{b['kind']}-render", f"{b['kind']} fails to render: {err}")
        lead = b["body"][:len(b["body"]) - len(b["body"].lstrip())].count("\n")
        for p in r.get("problems", []):
            line = b["body_line"] + lead + p["line"] - 1 if p["line"] else b["line"]
            lt.add("ERROR", line, "omniware-render", p["msg"])
        if r.get("ok"):
            lt.add("OK", b["line"], f"{b['kind']}-render", f"{b['kind']} block renders cleanly")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("files", nargs="+", type=Path)
    ap.add_argument("--render", action="store_true", help="render mermaid/omniware blocks in headless Chrome")
    ap.add_argument("--no-info", action="store_true", help="hide INFO and OK lines")
    ap.add_argument("--base", type=Path, help="resolve relative links/images from this directory (for a file "
                                              "that will be moved there later)")
    args = ap.parse_args()
    linters = []
    for f in args.files:
        if not f.is_file():
            print(f"{f}: not a file", file=sys.stderr)
            continue
        lt = Linter(f, args.base.resolve() if args.base else None)
        suffix = f.suffix.lower()
        if suffix in (".mmd", ".mermaid", ".ow") and not lt.text.lstrip().startswith(("```", "~~~")):
            kind = "omniware" if suffix == ".ow" else "mermaid"   # viewers auto-wrap these files
            lt.text = f"```{kind}\n{lt.text}\n```"
            lt.lines = lt.text.split("\n")
            lt.in_fence = [False] * len(lt.lines)
            lt.in_comment = [False] * len(lt.lines)
            lt.offset = -1
        lt.run()
        linters.append(lt)
    if args.render:
        render_check(linters)
    order = {"ERROR": 0, "WARN": 1, "INFO": 2, "OK": 3}
    errors = 0
    for lt in linters:
        shown = [x for x in lt.findings if not (args.no_info and x.level in ("INFO", "OK"))]
        for x in sorted(shown, key=lambda x: (x.line, order[x.level])):
            print(f"{lt.path}:{max(1, x.line + lt.offset)}: {x.level} [{x.rule}] {x.msg}")
        n = {k: sum(1 for x in lt.findings if x.level == k) for k in order}
        errors += n["ERROR"]
        print(f"{lt.path}: {n['ERROR']} error, {n['WARN']} warn, {n['INFO']} info"
              + (f", {n['OK']} rendered ok" if n["OK"] else ""))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
