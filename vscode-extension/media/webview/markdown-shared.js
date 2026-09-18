/**
 * Markdown behaviour shared by the desktop app and the VS Code extension.
 *
 * Keep this file byte-identical with vscode-extension/media/webview/markdown-shared.js
 * (CI checks it). Works as a CommonJS module (desktop, nodeIntegration) and as a
 * browser global `OmdShared` (VS Code webview).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.OmdShared = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- Diagram fences ----------

  const DIAGRAM_LANGS = {
    mermaid: 'mermaid',
    omniware: 'omniware',
    wireframe: 'omniware', // name used by OMNIWARE_SPEC.md
    d2: 'd2',
    tscircuit: 'tscircuit'
  };

  /** Diagram kind for a fenced code block info string, or null for ordinary code. */
  function diagramLang(infostring) {
    const word = String(infostring || '').trim().split(/\s+/)[0].toLowerCase();
    return Object.prototype.hasOwnProperty.call(DIAGRAM_LANGS, word) ? DIAGRAM_LANGS[word] : null;
  }

  // ---------- Heading ids (GitHub-compatible) ----------

  /** github-slugger: lower-case, drop punctuation/symbols, spaces become '-'. */
  function githubSlug(text) {
    return String(text || '')
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, '')
      .replace(/ /g, '-');
  }

  /** Returns slug(text) with GitHub's -1, -2 … suffixes for repeated headings. */
  function createSlugger() {
    const occurrences = Object.create(null);
    return function slug(text) {
      let result = githubSlug(text);
      const original = result;
      while (Object.prototype.hasOwnProperty.call(occurrences, result)) {
        occurrences[original]++;
        result = original + '-' + occurrences[original];
      }
      occurrences[result] = 0;
      return result;
    };
  }

  /** Gives every h1–h6 in `container` without an id a GitHub-style id. */
  function assignHeadingIds(container) {
    const slug = createSlugger();
    container.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(function (h) {
      const s = slug(h.textContent);
      if (!h.id && s) h.id = s;
    });
  }

  /** The ASCII-only slug older versions used; kept so existing links keep working. */
  function legacySlug(text) {
    return String(text || '').trim().toLowerCase()
      .replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/^-+|-+$/g, '');
  }

  function stripMarks(s) {
    return String(s).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  }

  function safeDecode(s) {
    try { return decodeURIComponent(s); } catch (e) { return s; }
  }

  /**
   * Finds the element an in-document link `#fragment` points to, searching only
   * inside `container` (so app UI ids never capture a link).
   */
  function findAnchorTarget(container, fragment) {
    const frag = safeDecode(String(fragment || '').replace(/^#/, ''));
    if (!frag) return null;
    const withId = Array.prototype.slice.call(container.querySelectorAll('[id], a[name]'));
    const key = function (el) { return el.id || el.getAttribute('name') || ''; };
    let hit = withId.find(function (el) { return key(el) === frag; });
    if (hit) return hit;
    const lower = frag.toLowerCase();
    hit = withId.find(function (el) { return key(el).toLowerCase() === lower; });
    if (hit) return hit;
    const bare = stripMarks(frag);
    hit = withId.find(function (el) { return stripMarks(key(el)) === bare; });
    if (hit) return hit;
    const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
    for (let i = 0; i < headings.length; i++) {
      if (legacySlug(headings[i].textContent) === lower) return headings[i];
    }
    return null;
  }

  // ---------- Links ----------

  /**
   * Classifies a link href.
   *   { kind: 'anchor', fragment }
   *   { kind: 'external', url }            http(s), mailto, tel
   *   { kind: 'file', path, fragment }     local path, URL-decoded, fragment split off
   *   { kind: 'other', url }               any other scheme
   */
  function parseLinkTarget(href) {
    const raw = String(href || '').trim();
    if (!raw) return { kind: 'other', url: raw };
    if (raw.charAt(0) === '#') return { kind: 'anchor', fragment: safeDecode(raw.slice(1)) };
    if (/^(https?:|mailto:|tel:)/i.test(raw)) return { kind: 'external', url: raw };
    if (/^file:\/\//i.test(raw)) {
      let p = raw.replace(/^file:\/\//i, '');
      const hash = p.indexOf('#');
      const fragment = hash >= 0 ? safeDecode(p.slice(hash + 1)) : '';
      if (hash >= 0) p = p.slice(0, hash);
      p = safeDecode(p);
      if (/^\/[A-Za-z]:\//.test(p)) p = p.slice(1); // file:///C:/x → C:/x
      return { kind: 'file', path: p, fragment: fragment };
    }
    if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(raw) && !/^[A-Za-z]:[\\/]/.test(raw)) {
      return { kind: 'other', url: raw };
    }
    const hash = raw.indexOf('#');
    const pathPart = hash >= 0 ? raw.slice(0, hash) : raw;
    const fragment = hash >= 0 ? safeDecode(raw.slice(hash + 1)) : '';
    const query = pathPart.indexOf('?');
    return { kind: 'file', path: safeDecode(query >= 0 ? pathPart.slice(0, query) : pathPart), fragment: fragment };
  }

  /** True for an image/link src that points at a local file (relative or absolute path). */
  function isLocalPath(src) {
    const s = String(src || '').trim();
    if (!s || s.charAt(0) === '#') return false;
    if (/^[A-Za-z]:[\\/]/.test(s)) return true; // Windows drive path
    return !/^[A-Za-z][A-Za-z0-9+.-]*:/.test(s) && s.indexOf('//') !== 0;
  }

  // ---------- Front matter ----------

  const FRONT_MATTER_RE = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/;

  /** Splits a leading YAML front matter block off. Returns { body, frontMatter } (frontMatter may be null). */
  function extractFrontMatter(markdown) {
    const text = String(markdown || '');
    const m = FRONT_MATTER_RE.exec(text);
    if (!m || !/^[A-Za-z0-9_-]+[ \t]*:/m.test(m[1])) return { body: text, frontMatter: null };
    return { body: text.slice(m[0].length), frontMatter: m[1] };
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** Renders front matter as a small key/value table, like GitHub. Values are shown as text. */
  function frontMatterHtml(yaml) {
    const rows = [];
    String(yaml || '').split(/\r?\n/).forEach(function (line) {
      const m = /^([A-Za-z0-9_-]+)[ \t]*:[ \t]*(.*)$/.exec(line);
      if (m) {
        rows.push([m[1], m[2]]);
      } else if (rows.length && /^\s+\S/.test(line)) {
        const last = rows[rows.length - 1];
        last[1] = (last[1] ? last[1] + ' ' : '') + line.trim();
      }
    });
    if (!rows.length) return '';
    const unquote = function (v) { return v.replace(/^(["'])(.*)\1$/, '$2'); };
    return '<table class="front-matter"><tbody>' + rows.map(function (r) {
      return '<tr><th>' + escapeHtml(r[0]) + '</th><td>' + escapeHtml(unquote(r[1].trim())) + '</td></tr>';
    }).join('') + '</tbody></table>\n';
  }

  // ---------- Emoji shortcodes ----------

  const EMOJI_SKIP = { CODE: 1, PRE: 1, SCRIPT: 1, STYLE: 1, TEXTAREA: 1, KBD: 1, SAMP: 1 };

  /**
   * Replaces :shortcode: with emoji in text nodes only — never inside code, pre,
   * SVG or diagram sources.
   */
  function applyEmoji(container, emojiMap) {
    if (!emojiMap || !container) return;
    const doc = container.ownerDocument || document;
    const walker = doc.createTreeWalker(container, 4 /* NodeFilter.SHOW_TEXT */, {
      acceptNode: function (node) {
        if (node.nodeValue.indexOf(':') < 0) return 2; // FILTER_REJECT
        for (let el = node.parentNode; el && el !== container; el = el.parentNode) {
          if (EMOJI_SKIP[el.nodeName] || el.namespaceURI === 'http://www.w3.org/2000/svg') return 2;
          if (el.classList && (el.classList.contains('mermaid') || el.classList.contains('d2-container') ||
              el.classList.contains('tscircuit-container'))) return 2;
        }
        return 1; // FILTER_ACCEPT
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      const next = node.nodeValue.replace(/:([a-zA-Z0-9_+-]+):/g, function (match, name) {
        return Object.prototype.hasOwnProperty.call(emojiMap, name) ? emojiMap[name] : match;
      });
      if (next !== node.nodeValue) node.nodeValue = next;
    });
  }

  return {
    diagramLang: diagramLang,
    githubSlug: githubSlug,
    createSlugger: createSlugger,
    assignHeadingIds: assignHeadingIds,
    legacySlug: legacySlug,
    findAnchorTarget: findAnchorTarget,
    parseLinkTarget: parseLinkTarget,
    isLocalPath: isLocalPath,
    extractFrontMatter: extractFrontMatter,
    frontMatterHtml: frontMatterHtml,
    escapeHtml: escapeHtml,
    applyEmoji: applyEmoji
  };
});
