const { ipcRenderer, shell } = require('electron');

// Libraries loaded from CDN in index.html
// marked, mermaid, and DOMPurify are available globally

// Initialize Mermaid
mermaid.initialize({
  startOnLoad: true,
  theme: 'default',
  themeVariables: {
    primaryColor: '#279EA7',
    primaryTextColor: '#1F3244',
    primaryBorderColor: '#279EA7',
    lineColor: '#279EA7',
    secondaryColor: '#1F3244',
    tertiaryColor: '#f5f5f5',
    background: '#ffffff',
    mainBkg: '#ffffff',
    secondBkg: '#f5f5f5',
    textColor: '#1F3244',
    border1: '#d0d0d0',
    border2: '#d0d0d0',
    fontSize: '13px',
    fontFamily: 'Fira Code Local, Fira Code, Segoe UI, Calibri, Arial, sans-serif'
  }
});

// Configure marked
marked.setOptions({
  breaks: true,
  gfm: true,
  headerIds: true,
  mangle: false,
  sanitize: false
});

// Zoom level
let zoomLevel = 100;
const zoomStep = 10;
const minZoom = 50;
const maxZoom = 200;

// DOM Elements
const viewer = document.getElementById('viewer');
const openFileBtn = document.getElementById('openFile');
const zoomInBtn = document.getElementById('zoomIn');
const zoomOutBtn = document.getElementById('zoomOut');
const zoomResetBtn = document.getElementById('zoomReset');
const fullscreenToggle = document.getElementById('fullscreenToggle');
const toggleRecentBtn = document.getElementById('toggleRecent');
const closeRecentBtn = document.getElementById('closeRecent');
const recentPanel = document.getElementById('recentPanel');
const recentList = document.getElementById('recentList');
const logoLink = document.getElementById('logoLink');
const searchPanel = document.getElementById('searchPanel');
const searchInput = document.getElementById('searchInput');
const searchCounter = document.getElementById('searchCounter');
const searchPrevBtn = document.getElementById('searchPrev');
const searchNextBtn = document.getElementById('searchNext');
const searchCloseBtn = document.getElementById('searchClose');
const toggleIndexBtn = document.getElementById('toggleIndex');
const closeIndexBtn = document.getElementById('closeIndex');
const indexPanel = document.getElementById('indexPanel');
const indexList = document.getElementById('indexList');

// Update zoom display
function updateZoom() {
  viewer.style.fontSize = `${zoomLevel}%`;
  zoomResetBtn.textContent = `${zoomLevel}%`;
}

// Zoom controls
zoomInBtn.addEventListener('click', () => {
  if (zoomLevel < maxZoom) {
    zoomLevel += zoomStep;
    updateZoom();
  }
});

zoomOutBtn.addEventListener('click', () => {
  if (zoomLevel > minZoom) {
    zoomLevel -= zoomStep;
    updateZoom();
  }
});

zoomResetBtn.addEventListener('click', () => {
  zoomLevel = 100;
  updateZoom();
});

// Fullscreen toggle
fullscreenToggle.addEventListener('click', () => {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    document.documentElement.requestFullscreen();
  }
});

// Logo link - open website
logoLink.addEventListener('click', (e) => {
  e.preventDefault();
  shell.openExternal('https://www.omnicore.com.tr');
});

// Open file button
openFileBtn.addEventListener('click', () => {
  ipcRenderer.send('open-file-dialog');
});

// Recent files panel toggle
toggleRecentBtn.addEventListener('click', () => {
  recentPanel.classList.toggle('visible');
});

closeRecentBtn.addEventListener('click', () => {
  recentPanel.classList.remove('visible');
});

// Mouse hover to open recent panel
let mouseHoverTimeout = null;
const HOVER_TRIGGER_ZONE = 10; // pixels from left edge
const HOVER_DELAY = 500; // milliseconds

document.addEventListener('mousemove', (e) => {
  // Check if mouse is near the left edge
  if (e.clientX <= HOVER_TRIGGER_ZONE) {
    // Start timeout if not already started
    if (!mouseHoverTimeout && !recentPanel.classList.contains('visible')) {
      mouseHoverTimeout = setTimeout(() => {
        recentPanel.classList.add('visible');
        mouseHoverTimeout = null;
      }, HOVER_DELAY);
    }
  } else {
    // Clear timeout if mouse moves away
    if (mouseHoverTimeout) {
      clearTimeout(mouseHoverTimeout);
      mouseHoverTimeout = null;
    }
  }
});

// Recent files management
const MAX_RECENT_FILES = 100;

function getRecentFiles() {
  try {
    const recent = localStorage.getItem('recentFiles');
    return recent ? JSON.parse(recent) : [];
  } catch (e) {
    console.error('Error loading recent files:', e);
    return [];
  }
}

function saveRecentFile(filePath) {
  try {
    let recentFiles = getRecentFiles();

    // Remove if already exists
    recentFiles = recentFiles.filter(f => f.path !== filePath);

    // Add to beginning
    recentFiles.unshift({
      path: filePath,
      name: filePath.split(/[\\/]/).pop(),
      timestamp: Date.now()
    });

    // Keep only MAX_RECENT_FILES
    recentFiles = recentFiles.slice(0, MAX_RECENT_FILES);

    localStorage.setItem('recentFiles', JSON.stringify(recentFiles));
    updateRecentFilesList();
  } catch (e) {
    console.error('Error saving recent file:', e);
  }
}

function updateRecentFilesList() {
  const recentFiles = getRecentFiles();

  if (recentFiles.length === 0) {
    recentList.innerHTML = '<div class="recent-empty">No recent files</div>';
    return;
  }

  recentList.innerHTML = '';

  recentFiles.forEach(file => {
    const item = document.createElement('div');
    item.className = 'recent-item';
    item.innerHTML = `
      <div class="recent-item-name">${file.name}</div>
      <div class="recent-item-path">${file.path}</div>
    `;

    item.addEventListener('click', () => {
      // Send request to main process to open this file
      const fs = require('fs');
      fs.readFile(file.path, 'utf8', (err, data) => {
        if (err) {
          console.error('Error reading file:', err);
          // Remove from recent files if it doesn't exist
          let recentFiles = getRecentFiles();
          recentFiles = recentFiles.filter(f => f.path !== file.path);
          localStorage.setItem('recentFiles', JSON.stringify(recentFiles));
          updateRecentFilesList();
          return;
        }
        renderMarkdown(data);
        saveRecentFile(file.path);
        recentPanel.classList.remove('visible');
      });
    });

    recentList.appendChild(item);
  });
}

// Initialize recent files list
updateRecentFilesList();

// Search functionality
let searchMatches = [];
let currentMatchIndex = -1;

function clearSearchHighlights() {
  const highlights = viewer.querySelectorAll('.search-highlight');
  highlights.forEach(highlight => {
    const parent = highlight.parentNode;
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

  const textNodes = [];
  const walker = document.createTreeWalker(
    viewer,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        // Skip script, style, svg, mermaid, and already highlighted nodes
        if (node.parentNode.tagName === 'SCRIPT' ||
            node.parentNode.tagName === 'STYLE' ||
            node.parentNode.tagName === 'SVG' ||
            node.parentNode.closest('.mermaid') ||
            node.parentNode.closest('svg') ||
            node.parentNode.classList?.contains('search-highlight')) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  let node;
  while (node = walker.nextNode()) {
    textNodes.push(node);
  }

  const searchRegex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');

  textNodes.forEach(textNode => {
    const text = textNode.textContent;
    const matches = [...text.matchAll(searchRegex)];

    if (matches.length > 0) {
      const fragment = document.createDocumentFragment();
      let lastIndex = 0;

      matches.forEach(match => {
        // Add text before match
        if (match.index > lastIndex) {
          fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
        }

        // Add highlighted match
        const span = document.createElement('span');
        span.className = 'search-highlight';
        span.textContent = match[0];
        fragment.appendChild(span);
        searchMatches.push(span);

        lastIndex = match.index + match[0].length;
      });

      // Add remaining text
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
  searchMatches.forEach((match, index) => {
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
    searchCounter.textContent = `${currentMatchIndex + 1} of ${searchMatches.length}`;
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
  const isVisible = searchPanel.classList.toggle('visible');
  if (isVisible) {
    searchInput.focus();
    searchInput.select();
  } else {
    clearSearchHighlights();
    searchInput.value = '';
  }
}

// Search event listeners
searchInput.addEventListener('input', (e) => {
  highlightSearchTerm(e.target.value);
});

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (e.shiftKey) {
      previousMatch();
    } else {
      nextMatch();
    }
  } else if (e.key === 'Escape') {
    toggleSearchPanel();
  }
});

searchNextBtn.addEventListener('click', nextMatch);
searchPrevBtn.addEventListener('click', previousMatch);
searchCloseBtn.addEventListener('click', toggleSearchPanel);

// Index/TOC functionality
function buildTableOfContents() {
  const headers = viewer.querySelectorAll('h1, h2, h3, h4, h5, h6');

  if (headers.length === 0) {
    indexList.innerHTML = '<div class="index-empty">No headers found</div>';
    return;
  }

  indexList.innerHTML = '';

  headers.forEach((header, index) => {
    // Add ID to header if it doesn't have one
    if (!header.id) {
      header.id = `header-${index}`;
    }

    const level = parseInt(header.tagName.substring(1));
    const item = document.createElement('div');
    item.className = `index-item level-${level}`;
    item.textContent = header.textContent;
    item.dataset.headerId = header.id;

    item.addEventListener('click', () => {
      const targetHeader = document.getElementById(header.id);
      if (targetHeader) {
        targetHeader.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // Update active state
        document.querySelectorAll('.index-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
      }
    });

    indexList.appendChild(item);
  });
}

// Index panel toggle
toggleIndexBtn.addEventListener('click', () => {
  indexPanel.classList.toggle('visible');
});

closeIndexBtn.addEventListener('click', () => {
  indexPanel.classList.remove('visible');
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
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
        if (zoomLevel < maxZoom) {
          zoomLevel += zoomStep;
          updateZoom();
        }
        break;
      case '-':
      case '_':
        e.preventDefault();
        if (zoomLevel > minZoom) {
          zoomLevel -= zoomStep;
          updateZoom();
        }
        break;
      case '0':
        e.preventDefault();
        zoomLevel = 100;
        updateZoom();
        break;
    }
  }
});

// Mouse wheel zoom
document.addEventListener('wheel', (e) => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();

    // Negative deltaY means scrolling up (zoom in)
    // Positive deltaY means scrolling down (zoom out)
    if (e.deltaY < 0) {
      // Zoom in
      if (zoomLevel < maxZoom) {
        zoomLevel += zoomStep;
        updateZoom();
      }
    } else if (e.deltaY > 0) {
      // Zoom out
      if (zoomLevel > minZoom) {
        zoomLevel -= zoomStep;
        updateZoom();
      }
    }
  }
}, { passive: false });

// Process markdown with Mermaid support
async function renderMarkdown(content) {
  // Remove BOM (Byte Order Mark) if present
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.substring(1);
  }

  // First, extract mermaid blocks and replace with placeholders
  const mermaidBlocks = [];
  let mermaidIndex = 0;

  // Replace mermaid code blocks with placeholders (handle both \n and \r\n)
  content = content.replace(/```mermaid[\r\n]+([\s\S]*?)```/g, (match, code) => {
    const placeholder = `MERMAID_PLACEHOLDER_${mermaidIndex}`;
    mermaidBlocks.push({ placeholder, code: code.trim() });
    mermaidIndex++;
    return placeholder;
  });

  // Parse markdown with marked (allows HTML)
  let html = marked.parse(content);

  // Sanitize HTML but allow most tags for rich content
  html = DOMPurify.sanitize(html, {
    ADD_TAGS: ['iframe', 'style'],
    ADD_ATTR: ['target', 'style', 'class', 'id']
  });

  // Replace placeholders with mermaid divs
  mermaidBlocks.forEach(({ placeholder, code }) => {
    const mermaidDiv = `<pre class="mermaid">${code}</pre>`;
    html = html.replace(placeholder, mermaidDiv);
  });

  // Set HTML content
  viewer.innerHTML = html;

  // Re-run mermaid on the new content
  try {
    const mermaidElements = viewer.querySelectorAll('.mermaid');
    if (mermaidElements.length > 0) {
      // Clear any existing IDs to prevent conflicts
      mermaidElements.forEach((el, index) => {
        el.removeAttribute('data-processed');
        el.id = `mermaid-${Date.now()}-${index}`;
      });

      // Render mermaid diagrams
      await mermaid.run({
        querySelector: '.mermaid',
        suppressErrors: false
      });
    }
  } catch (error) {
    console.error('Mermaid rendering error:', error);
    // Show error in the diagram location
    const mermaidElements = viewer.querySelectorAll('.mermaid');
    mermaidElements.forEach(el => {
      if (!el.querySelector('svg')) {
        el.innerHTML = `<div style="color: red; padding: 20px; background: #ffe6e6; border: 1px solid #ff0000; border-radius: 4px;">
          <strong>Mermaid Rendering Error:</strong><br>${error.message}
        </div>`;
      }
    });
  }

  // Build table of contents
  buildTableOfContents();

  // Scroll to top
  viewer.parentElement.scrollTop = 0;
}

// Handle file opened
ipcRenderer.on('file-opened', async (event, data) => {
  await renderMarkdown(data.content);

  // If multiple files were selected, add all to recent files
  if (data.allPaths && data.allPaths.length > 0) {
    data.allPaths.forEach(filePath => {
      saveRecentFile(filePath);
    });
  } else {
    // Fallback for single file (backwards compatibility)
    saveRecentFile(data.path);
  }
});

// Update zoom on load
updateZoom();
