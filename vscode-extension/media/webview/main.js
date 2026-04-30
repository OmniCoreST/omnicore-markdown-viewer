// ============================================
// Omnicore Markdown Viewer - VS Code Webview
// Port of renderer.js for VS Code extension
// ============================================

const vscode = acquireVsCodeApi();

// ============================================
// CONFIGURATION
// ============================================
const ZOOM_CONFIG = { level: 100, step: 10, min: 50, max: 200 };

// ============================================
// STATE
// ============================================
let zoomLevel = ZOOM_CONFIG.level;
let isDarkMode = false;
let currentFilePath = null;

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

// Configure marked
if (typeof marked !== 'undefined') {
  marked.setOptions({
    breaks: true,
    gfm: true
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

function showNotification(message, duration) {
  if (!duration) duration = 3000;
  notificationMessage.textContent = message;
  notificationToast.classList.add('show');
  setTimeout(function() {
    notificationToast.classList.remove('show');
  }, duration);
}

function showLoadingScreen() {
  loadingScreen.classList.add('active');
}

function hideLoadingScreen() {
  loadingScreen.classList.remove('active');
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
  isDarkMode = isDark;
  if (isDark) {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
  initializeMermaidWithTheme();
  updateOmniWareDarkMode(isDark);
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

function highlightSearchTerm(searchTerm) {
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
    highlightCurrentMatch();
  }
  updateSearchCounter();
}

function highlightCurrentMatch() {
  searchMatches.forEach(function(match, index) {
    if (index === currentMatchIndex) {
      match.classList.add('current');
      match.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
    if (!header.id) {
      header.id = 'header-' + index;
    }
    var level = parseInt(header.tagName.substring(1));
    var item = document.createElement('div');
    item.className = 'toc-item level-' + level;
    item.textContent = header.textContent;
    item.dataset.headerId = header.id;

    item.addEventListener('click', function() {
      var targetHeader = document.getElementById(header.id);
      if (targetHeader) {
        var contentRect = contentWrapper.getBoundingClientRect();
        var headerRect = targetHeader.getBoundingClientRect();
        var scrollOffset = headerRect.top - contentRect.top + contentWrapper.scrollTop - 20;
        contentWrapper.scrollTo({ top: scrollOffset, behavior: 'smooth' });
        document.querySelectorAll('.toc-item').forEach(function(i) { i.classList.remove('active'); });
        item.classList.add('active');
      }
    });
    tocList.appendChild(item);
  });
}

tocToggleBtn.addEventListener('click', function() { tocPanel.classList.toggle('visible'); });
tocCloseBtn.addEventListener('click', function() { tocPanel.classList.remove('visible'); });

// ============================================
// LINK HANDLING
// ============================================

viewer.addEventListener('click', function(e) {
  var link = e.target.closest('a');
  if (!link || !link.href) return;

  var hrefAttr = link.getAttribute('href');

  // Internal anchor link
  if (hrefAttr && hrefAttr.startsWith('#')) {
    e.preventDefault();
    var targetId = hrefAttr.substring(1);
    var targetElement = document.getElementById(targetId);

    if (!targetElement) {
      var headers = viewer.querySelectorAll('h1, h2, h3, h4, h5, h6');
      for (var i = 0; i < headers.length; i++) {
        var header = headers[i];
        if (header.id && header.id.toLowerCase() === targetId.toLowerCase()) {
          targetElement = header;
          break;
        }
        var headerText = header.textContent.trim().toLowerCase()
          .replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/^-+|-+$/g, '');
        if (headerText === targetId.toLowerCase()) {
          targetElement = header;
          break;
        }
      }
    }

    if (targetElement) {
      var contentRect = contentWrapper.getBoundingClientRect();
      var targetRect = targetElement.getBoundingClientRect();
      var scrollOffset = targetRect.top - contentRect.top + contentWrapper.scrollTop - 20;
      contentWrapper.scrollTo({ top: scrollOffset, behavior: 'smooth' });
    } else {
      showNotification('Section not found: ' + targetId, 3000);
    }
    return;
  }

  // External link
  var url = link.href;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    e.preventDefault();
    vscode.postMessage({ type: 'open-external', url: url });
    return;
  }

  // Local file link
  if (hrefAttr && !hrefAttr.startsWith('#') && !hrefAttr.startsWith('http')) {
    e.preventDefault();
    // Resolve relative path - send to extension host
    vscode.postMessage({ type: 'open-file', filePath: hrefAttr, basePath: currentFilePath });
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
// EXPORT BUTTONS
// ============================================

exportPdfBtn.addEventListener('click', function() {
  // Use browser print as the primary PDF method
  window.print();
});

exportWordBtn.addEventListener('click', function() {
  if (!currentFilePath) {
    showNotification('No file loaded for export', 3000);
    return;
  }

  // Clone viewer content for Word export
  var viewerClone = viewer.cloneNode(true);
  viewerClone.querySelectorAll('.mermaid-maximize-btn, .table-maximize-btn, .code-copy-btn, .omniware-maximize-btn').forEach(function(el) { el.remove(); });
  viewerClone.querySelectorAll('.code-block-container').forEach(function(container) {
    var pre = container.querySelector('pre');
    if (pre) { container.parentNode.replaceChild(pre.cloneNode(true), container); }
  });
  viewerClone.querySelectorAll('.table-container').forEach(function(container) {
    var table = container.querySelector('table');
    if (table) { container.parentNode.replaceChild(table.cloneNode(true), container); }
  });

  var fileName = currentFilePath.split(/[\\/]/).pop() || 'document';
  vscode.postMessage({
    type: 'export-word',
    htmlContent: viewerClone.innerHTML,
    fileName: fileName
  });
});

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
// RENDER MARKDOWN
// ============================================

async function renderMarkdown(content) {
  showLoadingScreen();
  await new Promise(function(resolve) { setTimeout(resolve, 10); });

  try {
    content = removeBOM(content);

    // Extract mermaid blocks and replace with placeholders
    var mermaidBlocks = [];
    var mermaidIndex = 0;
    content = content.replace(/```mermaid[\r\n]+([\s\S]*?)```/g, function(match, code) {
      var placeholder = 'MERMAID_PLACEHOLDER_' + mermaidIndex;
      mermaidBlocks.push({ placeholder: placeholder, code: code.trim() });
      mermaidIndex++;
      return placeholder;
    });

    // Extract omniware blocks and replace with placeholders
    var omniwareBlocks = [];
    var omniwareIndex = 0;
    content = content.replace(/```omniware[\r\n]+([\s\S]*?)```/g, function(match, code) {
      var placeholder = 'OMNIWARE_PLACEHOLDER_' + omniwareIndex;
      omniwareBlocks.push({ placeholder: placeholder, code: code.trim() });
      omniwareIndex++;
      return placeholder;
    });

    // Parse markdown
    var html = marked.parse(content);

    // Sanitize HTML
    html = DOMPurify.sanitize(html, {
      ADD_TAGS: ['iframe', 'style'],
      ADD_ATTR: ['target', 'style', 'class', 'id']
    });

    // Replace placeholders with mermaid divs
    mermaidBlocks.forEach(function(block) {
      var mermaidDiv = '<pre class="mermaid">' + block.code + '</pre>';
      html = html.replace(block.placeholder, mermaidDiv);
    });

    // Replace placeholders with rendered omniware wireframes
    omniwareBlocks.forEach(function(block) {
      try {
        var renderedHtml = OmniWare.toHTML(block.code);
        var escapedDsl = block.code.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        var omniwareDiv = '<div class="omniware-rendered" data-omniware-dsl="' + escapedDsl + '">' + renderedHtml + '</div>';
        html = html.replace(block.placeholder, omniwareDiv);
      } catch (err) {
        var errorDiv = '<div style="color: red; padding: 20px; background: #ffe6e6; border: 1px solid #ff0000; border-radius: 4px;">' +
          '<strong>OmniWare Rendering Error:</strong><br>' + err.message + '</div>';
        html = html.replace(block.placeholder, errorDiv);
      }
    });

    // Set HTML content
    viewer.innerHTML = html;

    // Render mermaid diagrams
    try {
      var mermaidElements = viewer.querySelectorAll('.mermaid');
      if (mermaidElements.length > 0) {
        mermaidElements.forEach(function(el, index) {
          el.removeAttribute('data-processed');
          el.id = 'mermaid-' + Date.now() + '-' + index;
        });

        await mermaid.run({ querySelector: '.mermaid', suppressErrors: false });

        // Add maximize buttons
        mermaidElements.forEach(function(el) {
          var svg = el.querySelector('svg');
          if (svg) {
            var container = document.createElement('div');
            container.className = 'mermaid-container';
            el.parentNode.insertBefore(container, el);
            container.appendChild(el);

            var maxBtn = document.createElement('button');
            maxBtn.className = 'mermaid-maximize-btn';
            maxBtn.title = 'Open in new tab';
            maxBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"></path></svg>';
            maxBtn.addEventListener('click', function() {
              var svgContent = svg.outerHTML;
              vscode.postMessage({ type: 'open-mermaid-popup', svgContent: svgContent, isDarkMode: isDarkMode });
            });
            container.appendChild(maxBtn);
          }
        });
      }
    } catch (error) {
      console.error('Mermaid rendering error:', error);
      var mermaidEls = viewer.querySelectorAll('.mermaid');
      mermaidEls.forEach(function(el) {
        if (!el.querySelector('svg')) {
          el.innerHTML = '<div style="color: red; padding: 20px; background: #ffe6e6; border: 1px solid #ff0000; border-radius: 4px;">' +
            '<strong>Mermaid Rendering Error:</strong><br>' + error.message + '</div>';
        }
      });
    }

    // Post-process OmniWare wireframes
    var omniwareElements = viewer.querySelectorAll('.omniware-rendered');
    if (omniwareElements.length > 0) {
      if (!document.getElementById('omniware-styles')) {
        var tempDiv = document.createElement('div');
        OmniWare.render('', tempDiv);
      }
      updateOmniWareDarkMode(isDarkMode);

      omniwareElements.forEach(function(el) {
        var container = document.createElement('div');
        container.className = 'omniware-container';
        el.parentNode.insertBefore(container, el);
        container.appendChild(el);

        var maxBtn = document.createElement('button');
        maxBtn.className = 'omniware-maximize-btn';
        maxBtn.title = 'Open wireframe in new tab';
        maxBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"></path></svg>';
        maxBtn.addEventListener('click', function() {
          var dslCode = el.getAttribute('data-omniware-dsl')
            .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
          vscode.postMessage({ type: 'open-omniware-popup', dslCode: dslCode, isDarkMode: isDarkMode });
        });
        container.appendChild(maxBtn);
      });
    }

    // Add table maximize buttons
    addTableMaximizeButtons();

    // Build table of contents
    buildTableOfContents();

    // Scroll to top
    contentWrapper.scrollTop = 0;

    // Apply syntax highlighting
    if (typeof Prism !== 'undefined') {
      var highlightCallback = window.requestIdleCallback || window.setTimeout;
      highlightCallback(function() {
        Prism.highlightAll();
        addCodeBlockCopyButtons();
        hideLoadingScreen();
      });
    } else {
      addCodeBlockCopyButtons();
      hideLoadingScreen();
    }
  } catch (error) {
    console.error('Error rendering markdown:', error);
    viewer.innerHTML = '<div style="color: red; padding: 20px;"><strong>Error rendering markdown:</strong><br>' + error.message + '</div>';
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

  switch (msg.type) {
    case 'content-updated':
      currentFilePath = msg.filePath;
      applyTheme(msg.isDark);
      renderMarkdown(msg.content);
      break;

    case 'theme-changed':
      applyTheme(msg.isDark);
      // Re-render if we have content
      if (viewer.innerHTML && currentFilePath) {
        // Theme change re-render is handled by mermaid re-init
      }
      break;
  }
});

// ============================================
// INITIAL SETUP
// ============================================
updateZoom();
