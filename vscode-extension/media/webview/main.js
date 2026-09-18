// ============================================
// Omnicore Markdown Viewer - VS Code Webview
// Port of renderer.js for VS Code extension
// Requires (loaded before this file): marked, DOMPurify, mermaid, OmniWare,
// Prism, mermaid-config.js, omniware-config.js, markdown-shared.js (OmdShared)
// and emoji-map.js (OMD_EMOJI_MAP).
// ============================================

const vscode = acquireVsCodeApi();

// ============================================
// CONFIGURATION
// ============================================
const ZOOM_CONFIG = { level: 100, step: 10, min: 50, max: 200 };
const DOCX_MAX_IMAGE_WIDTH = 600; // px, about the text width of an A4/Letter page with 1" margins

// ============================================
// STATE
// ============================================
let zoomLevel = ZOOM_CONFIG.level;
let isDarkMode = false;
let currentFilePath = null;
let resourceBase = '';   // webview URI of the document folder (no trailing slash)
let fileRoot = '';       // webview URI of the file system root ("/")
let lastContentMsg = null;
let lastRenderedPath = null;
let renderSeq = 0;
let pendingScrollFragment = null;
const mermaidSources = new WeakMap(); // pre.mermaid element -> diagram source

// ============================================
// DOM REFERENCES
// ============================================
const viewer = document.getElementById('viewer');
const contentWrapper = document.getElementById('contentWrapper');
const loadingScreen = document.getElementById('loadingScreen');
const searchPanel = document.getElementById('searchPanel');
const searchInput = document.getElementById('searchInput');
const searchCounter = document.getElementById('searchCounter');
const searchPrevBtn = document.getElementById('searchPrev');
const searchNextBtn = document.getElementById('searchNext');
const searchCloseBtn = document.getElementById('searchClose');
const tocPanel = document.getElementById('tocPanel');
const tocList = document.getElementById('tocList');
const tocCloseBtn = document.getElementById('tocClose');
const contextMenu = document.getElementById('contextMenu');
const notificationToast = document.getElementById('notificationToast');
const notificationMessage = document.getElementById('notificationMessage');

// Toolbar buttons
const zoomInBtn = document.getElementById('zoomIn');
const zoomOutBtn = document.getElementById('zoomOut');
const zoomResetBtn = document.getElementById('zoomReset');
const searchToggleBtn = document.getElementById('searchToggle');
const tocToggleBtn = document.getElementById('tocToggle');
const exportPdfBtn = document.getElementById('exportPdfBtn');
const exportWordBtn = document.getElementById('exportWordBtn');

// ============================================
// INITIALIZATION
// ============================================

function initializeMermaidWithTheme() {
  if (typeof mermaid !== 'undefined') {
    mermaid.initialize(getMermaidConfig(isDarkMode));
  }
}

// Diagram fences found by the marked renderer during the current parse.
// marked.parse is synchronous, so a module-level list is safe.
var diagramBlocks = [];
var diagramToken = '';

// Configure marked: CommonMark soft breaks (same as the desktop app) + GFM.
if (typeof marked !== 'undefined') {
  marked.setOptions({
    breaks: false,
    gfm: true
  });
  marked.use({
    renderer: {
      code: function(code, infostring) {
        var kind = OmdShared.diagramLang(infostring);
        if (kind !== 'mermaid' && kind !== 'omniware') return false; // ordinary code block
        var id = diagramToken + '-' + diagramBlocks.length;
        diagramBlocks.push({ id: id, kind: kind, code: code });
        return '<div class="omd-diagram" data-omd-ph="' + id + '"></div>\n';
      }
    }
  });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function removeBOM(content) {
  if (content && content.charCodeAt(0) === 0xFEFF) {
    return content.substring(1);
  }
  return content;
}

function safeDecode(s) {
  try { return decodeURIComponent(s); } catch (e) { return s; }
}

function sleep(ms) {
  return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

var notificationTimer = null;
function showNotification(message, duration) {
  if (!duration) duration = 3000;
  notificationMessage.textContent = message;
  notificationToast.classList.add('show');
  clearTimeout(notificationTimer);
  notificationTimer = setTimeout(function() {
    notificationToast.classList.remove('show');
  }, duration);
}

function showLoadingScreen() {
  loadingScreen.classList.add('active');
}

function hideLoadingScreen() {
  loadingScreen.classList.remove('active');
}

// Runs async jobs (renders, exports) one after another so they never share
// mermaid's global configuration or the viewer DOM halfway through.
var jobChain = Promise.resolve();
function serialize(job) {
  var next = jobChain.then(job, job);
  jobChain = next.catch(function(err) { console.error(err); });
  return next;
}

// ============================================
// ZOOM CONTROLS
// ============================================

function updateZoom() {
  viewer.style.fontSize = zoomLevel + '%';
  zoomResetBtn.textContent = zoomLevel + '%';
}

zoomInBtn.addEventListener('click', function() {
  if (zoomLevel < ZOOM_CONFIG.max) { zoomLevel += ZOOM_CONFIG.step; updateZoom(); }
});
zoomOutBtn.addEventListener('click', function() {
  if (zoomLevel > ZOOM_CONFIG.min) { zoomLevel -= ZOOM_CONFIG.step; updateZoom(); }
});
zoomResetBtn.addEventListener('click', function() {
  zoomLevel = ZOOM_CONFIG.level; updateZoom();
});

// ============================================
// DARK MODE
// ============================================

function updateOmniWareDarkMode(isDark) {
  var existingStyle = document.getElementById('omniware-dark-styles');
  if (isDark) {
    var css = getOmniWareDarkCSS(true);
    if (existingStyle) {
      existingStyle.textContent = css;
    } else {
      var style = document.createElement('style');
      style.id = 'omniware-dark-styles';
      style.textContent = css;
      document.head.appendChild(style);
    }
  } else if (existingStyle) {
    existingStyle.remove();
  }
}

function applyTheme(isDark) {
  isDarkMode = !!isDark;
  if (isDarkMode) {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
  initializeMermaidWithTheme();
  updateOmniWareDarkMode(isDarkMode);
}

// ============================================
// SEARCH FUNCTIONALITY
// ============================================

var searchMatches = [];
var currentMatchIndex = -1;

function clearSearchHighlights() {
  var highlights = viewer.querySelectorAll('.search-highlight');
  highlights.forEach(function(highlight) {
    var parent = highlight.parentNode;
    parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
    parent.normalize();
  });
  searchMatches = [];
  currentMatchIndex = -1;
  updateSearchCounter();
}

function highlightSearchTerm(searchTerm, keepScroll) {
  if (!searchTerm || searchTerm.length < 2) {
    clearSearchHighlights();
    return;
  }

  clearSearchHighlights();

  var textNodes = [];
  var walker = document.createTreeWalker(
    viewer,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        if (node.parentNode.tagName === 'SCRIPT' ||
            node.parentNode.tagName === 'STYLE' ||
            node.parentNode.tagName === 'SVG' ||
            node.parentNode.closest('.mermaid') ||
            node.parentNode.closest('svg') ||
            node.parentNode.closest('.omniware-rendered') ||
            (node.parentNode.classList && node.parentNode.classList.contains('search-highlight'))) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  var node;
  while (node = walker.nextNode()) {
    textNodes.push(node);
  }

  var searchRegex = new RegExp(escapeRegex(searchTerm), 'gi');

  textNodes.forEach(function(textNode) {
    var text = textNode.textContent;
    var matches = [];
    var match;
    while ((match = searchRegex.exec(text)) !== null) {
      matches.push(match);
    }

    if (matches.length > 0) {
      var fragment = document.createDocumentFragment();
      var lastIndex = 0;

      matches.forEach(function(match) {
        if (match.index > lastIndex) {
          fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
        }
        var span = document.createElement('span');
        span.className = 'search-highlight';
        span.textContent = match[0];
        fragment.appendChild(span);
        searchMatches.push(span);
        lastIndex = match.index + match[0].length;
      });

      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
      }

      textNode.parentNode.replaceChild(fragment, textNode);
    }
  });

  if (searchMatches.length > 0) {
    currentMatchIndex = 0;
    highlightCurrentMatch(keepScroll);
  }
  updateSearchCounter();
}

function highlightCurrentMatch(keepScroll) {
  searchMatches.forEach(function(match, index) {
    if (index === currentMatchIndex) {
      match.classList.add('current');
      if (!keepScroll) match.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      match.classList.remove('current');
    }
  });
}

function updateSearchCounter() {
  if (searchMatches.length > 0) {
    searchCounter.textContent = (currentMatchIndex + 1) + ' of ' + searchMatches.length;
    searchPrevBtn.disabled = false;
    searchNextBtn.disabled = false;
  } else {
    searchCounter.textContent = '0 of 0';
    searchPrevBtn.disabled = true;
    searchNextBtn.disabled = true;
  }
}

function nextMatch() {
  if (searchMatches.length === 0) return;
  currentMatchIndex = (currentMatchIndex + 1) % searchMatches.length;
  highlightCurrentMatch();
  updateSearchCounter();
}

function previousMatch() {
  if (searchMatches.length === 0) return;
  currentMatchIndex = currentMatchIndex - 1;
  if (currentMatchIndex < 0) currentMatchIndex = searchMatches.length - 1;
  highlightCurrentMatch();
  updateSearchCounter();
}

function toggleSearchPanel() {
  var isVisible = searchPanel.classList.toggle('visible');
  if (isVisible) {
    searchInput.focus();
    searchInput.select();
  } else {
    clearSearchHighlights();
    searchInput.value = '';
  }
}

// Search event listeners
searchInput.addEventListener('input', function(e) { highlightSearchTerm(e.target.value); });
searchInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (e.shiftKey) { previousMatch(); } else { nextMatch(); }
  } else if (e.key === 'Escape') {
    toggleSearchPanel();
  }
});
searchNextBtn.addEventListener('click', nextMatch);
searchPrevBtn.addEventListener('click', previousMatch);
searchCloseBtn.addEventListener('click', toggleSearchPanel);
searchToggleBtn.addEventListener('click', toggleSearchPanel);

// ============================================
// SCROLLING TO ELEMENTS / ANCHORS
// ============================================

function scrollToElement(el, smooth) {
  var contentRect = contentWrapper.getBoundingClientRect();
  var targetRect = el.getBoundingClientRect();
  var top = targetRect.top - contentRect.top + contentWrapper.scrollTop - 20;
  contentWrapper.scrollTo({ top: top, behavior: smooth ? 'smooth' : 'auto' });
}

/** Scrolls to `#fragment` inside the document. Returns false when nothing matches. */
function scrollToFragment(fragment, smooth) {
  var target = OmdShared.findAnchorTarget(viewer, fragment);
  if (!target) return false;
  scrollToElement(target, smooth);
  return true;
}

// ============================================
// TABLE OF CONTENTS
// ============================================

function buildTableOfContents() {
  var headers = viewer.querySelectorAll('h1, h2, h3, h4, h5, h6');
  if (headers.length === 0) {
    tocList.innerHTML = '<div class="toc-empty">No headers found</div>';
    return;
  }
  tocList.innerHTML = '';
  headers.forEach(function(header, index) {
    // Ids come from OmdShared.assignHeadingIds (GitHub slugs); this is only a
    // fallback for headings without any text.
    if (!header.id) {
      header.id = 'header-' + index;
    }
    var level = parseInt(header.tagName.substring(1));
    var item = document.createElement('div');
    item.className = 'toc-item level-' + level;
    item.textContent = header.textContent;
    item.dataset.headerId = header.id;

    item.addEventListener('click', function() {
      scrollToElement(header, true);
      document.querySelectorAll('.toc-item').forEach(function(i) { i.classList.remove('active'); });
      item.classList.add('active');
    });
    tocList.appendChild(item);
  });
}

tocToggleBtn.addEventListener('click', function() { tocPanel.classList.toggle('visible'); });
tocCloseBtn.addEventListener('click', function() { tocPanel.classList.remove('visible'); });

// ============================================
// LINK HANDLING
// ============================================

/** href of an HTML or SVG <a>, as written in the document (never the resolved URL). */
function getLinkHref(link) {
  var href = link.getAttribute('href');
  if (href === null) href = link.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
  if (href === null && link.href && typeof link.href === 'object' && 'baseVal' in link.href) {
    href = link.href.baseVal;
  }
  return href;
}

viewer.addEventListener('click', function(e) {
  var link = e.target && e.target.closest ? e.target.closest('a') : null;
  if (!link || !viewer.contains(link)) return;

  var href = getLinkHref(link);
  if (href === null || href === '') return;

  var target = OmdShared.parseLinkTarget(href);
  e.preventDefault();

  switch (target.kind) {
    case 'anchor':
      if (!scrollToFragment(href, true)) {
        showNotification('Section not found: ' + target.fragment, 3000);
      }
      break;
    case 'external':
      vscode.postMessage({ type: 'open-external', url: target.url });
      break;
    case 'file':
      if (target.path) {
        vscode.postMessage({ type: 'open-file', path: target.path, fragment: target.fragment, basePath: currentFilePath });
      } else if (target.fragment) {
        scrollToFragment(target.fragment, true);
      }
      break;
    default:
      showNotification('Unsupported link: ' + href, 3000);
  }
});

// ============================================
// CONTEXT MENU
// ============================================

var ctxCopy = document.getElementById('ctxCopy');
var ctxSelectAll = document.getElementById('ctxSelectAll');

viewer.addEventListener('contextmenu', function(e) {
  e.preventDefault();
  var selection = window.getSelection();
  var hasSelection = selection && selection.toString().trim().length > 0;

  if (hasSelection) {
    ctxCopy.classList.remove('disabled');
  } else {
    ctxCopy.classList.add('disabled');
  }

  contextMenu.style.left = e.clientX + 'px';
  contextMenu.style.top = e.clientY + 'px';
  contextMenu.classList.add('visible');

  // Adjust position if menu goes off screen
  var menuRect = contextMenu.getBoundingClientRect();
  if (menuRect.right > window.innerWidth) {
    contextMenu.style.left = (window.innerWidth - menuRect.width - 10) + 'px';
  }
  if (menuRect.bottom > window.innerHeight) {
    contextMenu.style.top = (window.innerHeight - menuRect.height - 10) + 'px';
  }
});

document.addEventListener('click', function(e) {
  if (!contextMenu.contains(e.target)) {
    contextMenu.classList.remove('visible');
  }
});

ctxCopy.addEventListener('click', function(e) {
  e.stopPropagation();
  if (ctxCopy.classList.contains('disabled')) return;
  contextMenu.classList.remove('visible');
  var selection = window.getSelection();
  if (selection) {
    navigator.clipboard.writeText(selection.toString()).then(function() {
      showNotification('Copied to clipboard', 1500);
    }).catch(function() {
      showNotification('Failed to copy', 2000);
    });
  }
});

ctxSelectAll.addEventListener('click', function() {
  contextMenu.classList.remove('visible');
  var range = document.createRange();
  range.selectNodeContents(viewer);
  var selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
});

document.addEventListener('scroll', function() { contextMenu.classList.remove('visible'); }, true);
window.addEventListener('resize', function() { contextMenu.classList.remove('visible'); });
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') contextMenu.classList.remove('visible');
});

// ============================================
// EXPORT (PDF via the extension host, DOCX via html-to-docx on the host)
// ============================================

exportPdfBtn.addEventListener('click', function() { requestExport('pdf'); });
exportWordBtn.addEventListener('click', function() { requestExport('docx'); });

function requestExport(format) {
  if (!currentFilePath) {
    showNotification('No file loaded for export', 3000);
    return Promise.resolve();
  }
  return serialize(function() { return exportDocument(format); });
}

async function exportDocument(format) {
  showNotification(format === 'pdf' ? 'Preparing PDF…' : 'Preparing Word document…', 2000);
  var clone = await buildExportClone(format);
  var fileName = currentFilePath.split(/[\\/]/).pop() || 'document';
  if (format === 'pdf') {
    var owStyles = document.getElementById('omniware-styles');
    var firstHeading = viewer.querySelector('h1');
    vscode.postMessage({
      type: 'export-pdf',
      html: clone.innerHTML,
      omniwareCss: owStyles ? owStyles.textContent : '',
      title: firstHeading ? firstHeading.textContent.trim() : fileName,
      fileName: fileName,
      filePath: currentFilePath
    });
  } else {
    vscode.postMessage({
      type: 'export-word',
      htmlContent: clone.innerHTML,
      fileName: fileName,
      filePath: currentFilePath
    });
  }
}

/**
 * Copy of the rendered document for export: no UI buttons, local images inlined
 * as data URIs, Mermaid in the light theme (PDF: inline SVG, DOCX: PNG).
 */
async function buildExportClone(format) {
  var clone = viewer.cloneNode(true);
  var liveMermaid = Array.prototype.slice.call(viewer.querySelectorAll('pre.mermaid'));

  clone.querySelectorAll('.mermaid-maximize-btn, .table-maximize-btn, .code-copy-btn, .omniware-maximize-btn').forEach(function(el) { el.remove(); });
  clone.querySelectorAll('.search-highlight').forEach(function(el) { el.replaceWith(document.createTextNode(el.textContent)); });
  clone.querySelectorAll('.code-block-container').forEach(function(container) {
    var pre = container.querySelector('pre');
    if (pre) { container.replaceWith(pre); }
  });
  clone.querySelectorAll('.table-container').forEach(function(container) {
    var table = container.querySelector('table');
    if (table) { container.replaceWith(table); }
  });
  clone.querySelectorAll('.mermaid-container').forEach(function(container) {
    var m = container.querySelector('.mermaid');
    if (m) { container.replaceWith(m); }
  });
  clone.querySelectorAll('.omniware-container').forEach(function(container) {
    var ow = container.querySelector('.omniware-rendered');
    if (ow) { container.replaceWith(ow); }
  });
  clone.querySelectorAll('script').forEach(function(el) { el.remove(); });
  clone.querySelectorAll('details').forEach(function(el) { el.setAttribute('open', ''); });

  // Mermaid: exports are always light, so re-render dark diagrams with the light theme.
  var cloneMermaid = Array.prototype.slice.call(clone.querySelectorAll('pre.mermaid'));
  if (isDarkMode && liveMermaid.length > 0) {
    await rerenderMermaidLight(liveMermaid, cloneMermaid);
  }

  await inlineImages(clone, format);

  if (format === 'docx') {
    await rasterizeSvgs(clone);
    clone.querySelectorAll('style').forEach(function(el) { el.remove(); });
    preserveCodeLineBreaks(clone);
  }
  return clone;
}

async function rerenderMermaidLight(liveEls, cloneEls) {
  mermaid.initialize(getMermaidConfig(false));
  try {
    for (var i = 0; i < liveEls.length && i < cloneEls.length; i++) {
      var source = mermaidSources.get(liveEls[i]);
      if (!source || !liveEls[i].querySelector('svg')) continue;
      var id = 'omd-export-' + Date.now() + '-' + i;
      try {
        var result = await mermaid.render(id, source);
        cloneEls[i].innerHTML = result.svg;
      } catch (err) {
        removeMermaidTempElements(id);
      }
    }
  } finally {
    initializeMermaidWithTheme();
  }
}

function blobToDataUrl(blob) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload = function() { resolve(reader.result); };
    reader.onerror = function() { reject(reader.error); };
    reader.readAsDataURL(blob);
  });
}

var IMAGE_MIME_BY_EXT = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp',
  webp: 'image/webp', svg: 'image/svg+xml', ico: 'image/x-icon', avif: 'image/avif'
};

async function fetchAsDataUrl(url) {
  var response = await fetch(url);
  if (!response.ok) throw new Error('HTTP ' + response.status);
  var blob = await response.blob();
  if (!/^image\//.test(blob.type)) {
    var ext = (url.split(/[?#]/)[0].split('.').pop() || '').toLowerCase();
    blob = new Blob([blob], { type: IMAGE_MIME_BY_EXT[ext] || 'application/octet-stream' });
  }
  return blobToDataUrl(blob);
}

function isWebviewResource(url) {
  if (!fileRoot) return false;
  try { return new URL(url).origin === new URL(fileRoot).origin; } catch (e) { return false; }
}

/** webview resource URL → file:// URL (used by the PDF export when inlining fails). */
function resourceToFileUrl(url) {
  if (!isWebviewResource(url)) return null;
  var pathname = new URL(url).pathname.replace(/^\/([A-Za-z])%3A\//i, '/$1:/');
  return 'file://' + pathname;
}

function imagePlaceholder(img) {
  var span = document.createElement('span');
  span.textContent = '[' + (img.getAttribute('alt') || 'image') + ']';
  return span;
}

async function inlineImages(clone, format) {
  var images = Array.prototype.slice.call(clone.querySelectorAll('img'));
  for (var i = 0; i < images.length; i++) {
    var img = images[i];
    var src = img.getAttribute('src');
    if (!src) {
      img.replaceWith(imagePlaceholder(img));
      continue;
    }
    if (/^data:/i.test(src)) continue;
    if (!isWebviewResource(src)) {
      if (/^https?:/i.test(src)) continue; // remote image: the exporter downloads it
      img.replaceWith(imagePlaceholder(img));
      continue;
    }
    try {
      img.setAttribute('src', await fetchAsDataUrl(src));
    } catch (err) {
      var fileUrl = format === 'pdf' ? resourceToFileUrl(src) : null;
      if (fileUrl) {
        img.setAttribute('src', fileUrl);
      } else {
        img.replaceWith(imagePlaceholder(img));
      }
    }
  }
}

/** Width/height of an SVG from its viewBox, falling back to width/height attributes. */
function svgSize(svg) {
  var vb = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
  if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) return { width: vb[2], height: vb[3] };
  var w = parseFloat(svg.getAttribute('width'));
  var h = parseFloat(svg.getAttribute('height'));
  if (w > 0 && h > 0 && !/%/.test(svg.getAttribute('width') + svg.getAttribute('height'))) return { width: w, height: h };
  return null;
}

function loadImage(src) {
  return new Promise(function(resolve, reject) {
    var img = new Image();
    img.onload = function() { resolve(img); };
    img.onerror = function() { reject(new Error('Image failed to load')); };
    img.src = src;
  });
}

/** Draws an image source onto a white canvas (2x) and returns a PNG data URI. */
async function rasterize(src, width, height) {
  var img = await loadImage(src);
  var scale = Math.min(2, 8000 / Math.max(width, height));
  var canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  var ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png'); // throws if the canvas is tainted
}

function docxImage(dataUrl, width, height, alt) {
  var img = document.createElement('img');
  var w = Math.min(width, DOCX_MAX_IMAGE_WIDTH);
  img.setAttribute('src', dataUrl);
  img.setAttribute('width', String(Math.round(w)));
  img.setAttribute('height', String(Math.round(height * w / width)));
  img.setAttribute('alt', alt);
  return img;
}

/** DOCX: SVG (Mermaid and inline) and non-PNG/JPEG/GIF images become PNG data URIs. */
async function rasterizeSvgs(clone) {
  var svgs = Array.prototype.slice.call(clone.querySelectorAll('svg')).filter(function(svg) {
    return !svg.parentNode.closest || !svg.parentNode.closest('svg');
  });
  for (var i = 0; i < svgs.length; i++) {
    var svg = svgs[i];
    var host = svg.closest('.mermaid');
    var size = svgSize(svg);
    var replacement;
    try {
      if (!size) throw new Error('SVG has no size');
      var copy = svg.cloneNode(true);
      copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      copy.setAttribute('width', String(size.width));
      copy.setAttribute('height', String(size.height));
      copy.style.maxWidth = '';
      var xml = new XMLSerializer().serializeToString(copy);
      var png = await rasterize('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml), size.width, size.height);
      replacement = docxImage(png, size.width, size.height, host ? 'Diagram' : 'Image');
    } catch (err) {
      replacement = document.createElement('p');
      var em = document.createElement('em');
      em.textContent = host ? '[Diagram: see the PDF or the viewer]' : '[Image]';
      replacement.appendChild(em);
    }
    if (host) {
      host.replaceWith(replacement);
    } else {
      svg.replaceWith(replacement);
    }
  }

  var images = Array.prototype.slice.call(clone.querySelectorAll('img'));
  for (var j = 0; j < images.length; j++) {
    var img = images[j];
    var src = img.getAttribute('src') || '';
    if (!/^data:/i.test(src) || /^data:image\/(png|jpe?g|gif);base64,/i.test(src)) continue;
    try {
      var loaded = await loadImage(src);
      var w = loaded.naturalWidth || 300, h = loaded.naturalHeight || 150;
      img.replaceWith(docxImage(await rasterize(src, w, h), w, h, img.getAttribute('alt') || ''));
    } catch (err) {
      img.replaceWith(imagePlaceholder(img));
    }
  }
}

/**
 * DOCX: html-to-docx drops line breaks inside <pre>, so each code block becomes a
 * monospace paragraph with one <br>-separated span per line (indentation kept).
 */
function preserveCodeLineBreaks(clone) {
  clone.querySelectorAll('pre').forEach(function(pre) {
    var text = pre.textContent.replace(/\n$/, '');
    var p = document.createElement('p');
    p.setAttribute('style', "font-family: Consolas, 'Courier New', monospace; font-size: 10pt; background-color: #f5f5f5;");
    text.split('\n').forEach(function(line, index) {
      if (index > 0) p.appendChild(document.createElement('br'));
      var lead = /^[ \t]*/.exec(line)[0];
      var indent = lead.replace(/\t/g, '    ').replace(/ /g, '\u00a0');
      var span = document.createElement('span');
      span.textContent = (indent + line.slice(lead.length)) || '\u00a0';
      p.appendChild(span);
    });
    pre.replaceWith(p);
  });
}

// ============================================
// KEYBOARD SHORTCUTS
// ============================================

document.addEventListener('keydown', function(e) {
  if (e.ctrlKey || e.metaKey) {
    switch (e.key) {
      case 'f':
      case 'F':
        e.preventDefault();
        toggleSearchPanel();
        break;
      case '+':
      case '=':
        e.preventDefault();
        if (zoomLevel < ZOOM_CONFIG.max) { zoomLevel += ZOOM_CONFIG.step; updateZoom(); }
        break;
      case '-':
      case '_':
        e.preventDefault();
        if (zoomLevel > ZOOM_CONFIG.min) { zoomLevel -= ZOOM_CONFIG.step; updateZoom(); }
        break;
      case '0':
        e.preventDefault();
        zoomLevel = ZOOM_CONFIG.level; updateZoom();
        break;
    }
  }
});

// Mouse wheel zoom
document.addEventListener('wheel', function(e) {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    if (e.deltaY < 0) {
      if (zoomLevel < ZOOM_CONFIG.max) { zoomLevel += ZOOM_CONFIG.step; updateZoom(); }
    } else if (e.deltaY > 0) {
      if (zoomLevel > ZOOM_CONFIG.min) { zoomLevel -= ZOOM_CONFIG.step; updateZoom(); }
    }
  }
}, { passive: false });

// ============================================
// LOCAL IMAGES
// ============================================

function encodePath(p) {
  return p.split('/').map(function(segment) { return encodeURIComponent(segment); }).join('/');
}

function trimTrailingSlash(s) {
  return s.replace(/\/+$/, '');
}

/**
 * Webview URL for a local image path (relative to the document, absolute POSIX
 * or Windows drive path), or null when `src` is not a local path.
 */
function resolveLocalResource(src) {
  if (!OmdShared.isLocalPath(src)) return null;
  var raw = src.trim();
  var cut = raw.search(/[?#]/);
  if (cut >= 0) raw = raw.slice(0, cut);
  if (!raw) return null;
  var decoded = safeDecode(raw).replace(/\\/g, '/');

  var drive = /^([A-Za-z]):\/(.*)$/.exec(decoded);
  if (drive) {
    return fileRoot ? trimTrailingSlash(fileRoot) + '/' + drive[1].toLowerCase() + '%3A/' + encodePath(drive[2]) : null;
  }
  if (decoded.charAt(0) === '/') {
    return fileRoot ? trimTrailingSlash(fileRoot) + encodePath(decoded) : null;
  }
  if (!resourceBase) return null;
  try {
    return new URL(encodePath(decoded), trimTrailingSlash(resourceBase) + '/').href;
  } catch (e) {
    return null;
  }
}

var LOCAL_MEDIA = [['img', 'src'], ['video', 'src'], ['video', 'poster'], ['audio', 'src'], ['source', 'src']];

function rewriteLocalMedia(root) {
  LOCAL_MEDIA.forEach(function(pair) {
    root.querySelectorAll(pair[0] + '[' + pair[1] + ']').forEach(function(el) {
      var url = resolveLocalResource(el.getAttribute(pair[1]));
      if (url) el.setAttribute(pair[1], url);
    });
  });
}

// ============================================
// RENDER MARKDOWN
// ============================================

var pendingRenderMsg = null;
var renderScheduled = false;

/** Renders the newest content message; bursts of updates collapse into one render. */
function queueRender(msg) {
  pendingRenderMsg = msg;
  if (renderScheduled) return;
  renderScheduled = true;
  serialize(function() {
    renderScheduled = false;
    var next = pendingRenderMsg;
    pendingRenderMsg = null;
    return next ? renderMarkdown(next) : undefined;
  });
}

/** Parses markdown into an inert fragment: sanitised HTML, front matter, diagrams restored. */
function buildDocumentFragment(content) {
  var fm = OmdShared.extractFrontMatter(removeBOM(content));

  diagramBlocks = [];
  diagramToken = 'omd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  var html = marked.parse(fm.body);
  var blocks = {};
  diagramBlocks.forEach(function(block) { blocks[block.id] = block; });
  diagramBlocks = [];

  html = DOMPurify.sanitize(html, {
    ADD_TAGS: ['iframe', 'style'],
    ADD_ATTR: ['target', 'style', 'class', 'id']
  });

  // A <template> is inert: nothing loads until the nodes are moved into the viewer.
  var tpl = document.createElement('template');
  tpl.innerHTML = (fm.frontMatter ? OmdShared.frontMatterHtml(fm.frontMatter) : '') + html;
  var frag = tpl.content;
  var doc = frag.ownerDocument;

  frag.querySelectorAll('[data-omd-ph]').forEach(function(ph) {
    var block = blocks[ph.getAttribute('data-omd-ph')];
    if (!block) { ph.remove(); return; } // not produced by the renderer (raw HTML)
    if (block.kind === 'mermaid') {
      var pre = doc.createElement('pre');
      pre.className = 'mermaid';
      pre.textContent = block.code;
      ph.replaceWith(pre);
    } else {
      var div = doc.createElement('div');
      try {
        div.innerHTML = OmniWare.toHTML(block.code);
        div.className = 'omniware-rendered';
        div.setAttribute('data-omniware-dsl', block.code);
      } catch (err) {
        div.className = 'omd-render-error';
        var strong = doc.createElement('strong');
        strong.textContent = 'OmniWare Rendering Error:';
        div.appendChild(strong);
        div.appendChild(doc.createElement('br'));
        div.appendChild(doc.createTextNode(err && err.message ? err.message : String(err)));
      }
      ph.replaceWith(div);
    }
  });

  rewriteLocalMedia(frag);
  return frag;
}

function removeMermaidTempElements(id) {
  ['d' + id, id, 'i' + id].forEach(function(elementId) {
    var el = document.getElementById(elementId);
    if (el && !viewer.contains(el)) el.remove();
  });
}

function addPopoutButton(container, className, title, onClick) {
  var btn = document.createElement('button');
  btn.className = className;
  btn.title = title;
  btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"></path></svg>';
  btn.addEventListener('click', onClick);
  container.appendChild(btn);
}

async function renderMermaidDiagrams(seq) {
  var elements = viewer.querySelectorAll('pre.mermaid');
  for (var i = 0; i < elements.length; i++) {
    var el = elements[i];
    var source = el.textContent;
    mermaidSources.set(el, source);
    var id = 'omd-mermaid-' + seq + '-' + i;
    try {
      var result = await mermaid.render(id, source);
      el.innerHTML = result.svg;
      if (result.bindFunctions) result.bindFunctions(el);
    } catch (error) {
      removeMermaidTempElements(id);
      console.error('Mermaid rendering error:', error);
      var box = document.createElement('div');
      box.className = 'omd-render-error';
      var strong = document.createElement('strong');
      strong.textContent = 'Mermaid Rendering Error:';
      box.appendChild(strong);
      box.appendChild(document.createElement('br'));
      box.appendChild(document.createTextNode(error && error.message ? error.message : String(error)));
      el.textContent = '';
      el.appendChild(box);
      continue;
    }

    var svg = el.querySelector('svg');
    if (!svg) continue;
    var container = document.createElement('div');
    container.className = 'mermaid-container';
    el.parentNode.insertBefore(container, el);
    container.appendChild(el);
    addPopoutButton(container, 'mermaid-maximize-btn', 'Open in new tab', (function(svgEl) {
      return function() {
        vscode.postMessage({ type: 'open-mermaid-popup', svgContent: svgEl.outerHTML, isDarkMode: isDarkMode });
      };
    })(svg));
  }
}

function decorateOmniWare() {
  var omniwareElements = viewer.querySelectorAll('.omniware-rendered');
  if (omniwareElements.length === 0) return;
  if (!document.getElementById('omniware-styles')) {
    OmniWare.render('', document.createElement('div')); // injects #omniware-styles
  }
  updateOmniWareDarkMode(isDarkMode);

  omniwareElements.forEach(function(el) {
    var container = document.createElement('div');
    container.className = 'omniware-container';
    el.parentNode.insertBefore(container, el);
    container.appendChild(el);
    addPopoutButton(container, 'omniware-maximize-btn', 'Open wireframe in new tab', function() {
      vscode.postMessage({
        type: 'open-omniware-popup',
        dslCode: el.getAttribute('data-omniware-dsl') || '',
        isDarkMode: isDarkMode,
        filePath: currentFilePath
      });
    });
  });
}

async function renderMarkdown(msg) {
  var seq = ++renderSeq;
  var sameFile = msg.filePath === lastRenderedPath && viewer.childNodes.length > 0;
  var keepScroll = sameFile ? contentWrapper.scrollTop : 0;

  currentFilePath = msg.filePath;
  resourceBase = msg.resourceBase || '';
  fileRoot = msg.fileRoot || '';
  applyTheme(msg.isDark);

  if (sameFile) {
    // Keep the old height while diagrams re-render so the scroll position survives.
    viewer.style.minHeight = viewer.offsetHeight + 'px';
  } else {
    showLoadingScreen();
    await sleep(10);
  }

  try {
    var searchTerm = searchPanel.classList.contains('visible') ? searchInput.value : '';
    var frag = buildDocumentFragment(msg.content || '');

    // Heading ids first, emoji second (GitHub slugs `## :rocket: Launch` as `rocket-launch`).
    OmdShared.assignHeadingIds(frag);
    OmdShared.applyEmoji(frag, window.OMD_EMOJI_MAP);

    viewer.replaceChildren(frag);
    if (sameFile) contentWrapper.scrollTop = keepScroll;

    await renderMermaidDiagrams(seq);
    decorateOmniWare();
    addTableMaximizeButtons();
    buildTableOfContents();
    if (searchTerm) highlightSearchTerm(searchTerm, true);

    if (sameFile) {
      viewer.style.minHeight = '';
      contentWrapper.scrollTop = keepScroll;
    } else {
      contentWrapper.scrollTop = 0;
    }
    lastRenderedPath = msg.filePath;

    if (pendingScrollFragment) {
      var fragment = pendingScrollFragment;
      pendingScrollFragment = null;
      scrollToFragment(fragment, false);
    }
    vscode.postMessage({ type: 'rendered', filePath: msg.filePath, seq: seq });

    // Apply syntax highlighting
    if (typeof Prism !== 'undefined') {
      await new Promise(function(resolve) {
        var highlight = function() {
          Prism.highlightAll();
          addCodeBlockCopyButtons();
          resolve();
        };
        if (window.requestIdleCallback) {
          window.requestIdleCallback(highlight, { timeout: 500 });
        } else {
          setTimeout(highlight, 0);
        }
      });
    } else {
      addCodeBlockCopyButtons();
    }
  } catch (error) {
    console.error('Error rendering markdown:', error);
    viewer.style.minHeight = '';
    viewer.textContent = '';
    var box = document.createElement('div');
    box.className = 'omd-render-error';
    box.textContent = 'Error rendering markdown: ' + (error && error.message ? error.message : String(error));
    viewer.appendChild(box);
  } finally {
    hideLoadingScreen();
  }
}

// ============================================
// TABLE MAXIMIZE BUTTONS
// ============================================

function addTableMaximizeButtons() {
  var tables = viewer.querySelectorAll('.markdown-body table, #viewer table');
  var updates = [];

  tables.forEach(function(table) {
    if (table.parentNode.classList && table.parentNode.classList.contains('table-container')) return;
    if (table.classList.contains('front-matter') || table.closest('.omniware-rendered')) return;

    var firstRow = table.querySelector('thead tr, tr:first-child');
    if (firstRow) {
      var columnCount = firstRow.querySelectorAll('th, td').length;
      if (columnCount > 5) { table.classList.add('compact-table'); }
    }

    var container = document.createElement('div');
    container.className = 'table-container';

    var maxBtn = document.createElement('button');
    maxBtn.className = 'table-maximize-btn';
    maxBtn.title = 'Open in interactive popup';
    maxBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"></path></svg>';

    maxBtn.addEventListener('click', function() {
      var tableData = extractTableData(table);
      vscode.postMessage({ type: 'open-table-popup', tableData: tableData, isDarkMode: isDarkMode });
    });

    updates.push({ table: table, container: container, maxBtn: maxBtn });
  });

  updates.forEach(function(u) {
    u.table.parentNode.insertBefore(u.container, u.table);
    u.container.appendChild(u.table);
    u.container.appendChild(u.maxBtn);
  });
}

// ============================================
// CODE BLOCK COPY BUTTONS
// ============================================

function addCodeBlockCopyButtons() {
  var codeBlocks = viewer.querySelectorAll('.markdown-body pre, #viewer pre');

  codeBlocks.forEach(function(pre) {
    if (pre.parentNode.classList && pre.parentNode.classList.contains('code-block-container')) return;
    // Skip mermaid pre elements
    if (pre.classList.contains('mermaid')) return;

    var codeElement = pre.querySelector('code');
    if (!codeElement) return;

    var container = document.createElement('div');
    container.className = 'code-block-container';

    var copyBtn = document.createElement('button');
    copyBtn.className = 'code-copy-btn';
    copyBtn.title = 'Copy to clipboard';
    copyBtn.innerHTML = '<svg class="copy-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg><svg class="check-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none;"><polyline points="20 6 9 17 4 12"></polyline></svg>';

    copyBtn.addEventListener('click', async function() {
      var textContent = codeElement.textContent;
      try {
        await navigator.clipboard.writeText(textContent);
        var copyIcon = copyBtn.querySelector('.copy-icon');
        var checkIcon = copyBtn.querySelector('.check-icon');
        copyIcon.style.display = 'none';
        checkIcon.style.display = 'block';
        copyBtn.classList.add('copied');
        setTimeout(function() {
          copyIcon.style.display = 'block';
          checkIcon.style.display = 'none';
          copyBtn.classList.remove('copied');
        }, 2000);
      } catch (err) {
        showNotification('Failed to copy to clipboard', 2000);
      }
    });

    pre.parentNode.insertBefore(container, pre);
    container.appendChild(pre);
    container.appendChild(copyBtn);
  });
}

// ============================================
// TABLE DATA EXTRACTION
// ============================================

function extractTableData(table) {
  var data = [];
  var columns = [];

  var headerRow = table.querySelector('thead tr, tr:first-child');
  if (headerRow) {
    var headers = headerRow.querySelectorAll('th, td');
    headers.forEach(function(header, index) {
      var headerText = header.textContent.trim() || ('Column ' + (index + 1));
      columns.push({
        title: headerText,
        field: 'col' + index,
        headerFilter: 'input',
        headerFilterPlaceholder: 'Filter...'
      });
    });
  }

  var tbody = table.querySelector('tbody') || table;
  var rows = tbody.querySelectorAll('tr');

  rows.forEach(function(row, rowIndex) {
    if (!table.querySelector('thead') && rowIndex === 0) return;
    var cells = row.querySelectorAll('td, th');
    if (cells.length > 0) {
      var rowData = {};
      cells.forEach(function(cell, index) {
        rowData['col' + index] = cell.textContent.trim();
      });
      data.push(rowData);
    }
  });

  return { columns: columns, data: data };
}

// ============================================
// MESSAGE HANDLER (from extension host)
// ============================================

window.addEventListener('message', function(event) {
  var msg = event.data;
  if (!msg || typeof msg !== 'object') return;

  switch (msg.type) {
    case 'content-updated':
      lastContentMsg = msg;
      currentFilePath = msg.filePath; // an export request may arrive before the render ran
      queueRender(msg);
      break;

    case 'theme-changed':
      if (lastContentMsg) {
        // Re-render so Mermaid diagrams pick up the new theme.
        lastContentMsg = Object.assign({}, lastContentMsg, { isDark: msg.isDark });
        queueRender(lastContentMsg);
      } else {
        applyTheme(msg.isDark);
      }
      break;

    case 'scroll-to':
      if (!msg.fragment) break;
      if (!lastRenderedPath) {
        pendingScrollFragment = msg.fragment; // applied right after the first render
        break;
      }
      serialize(function() { // after any queued render
        if (!scrollToFragment(msg.fragment, false)) {
          showNotification('Section not found: ' + msg.fragment, 3000);
        }
      });
      break;

    case 'request-export':
      requestExport(msg.format === 'docx' ? 'docx' : 'pdf');
      break;
  }
});

// ============================================
// INITIAL SETUP
// ============================================
updateZoom();
