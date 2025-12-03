const { ipcRenderer, shell, clipboard } = require('electron');
const fs = require('fs');
const path = require('path');

// Libraries loaded from CDN in index.html
// marked, mermaid, and DOMPurify are available globally

// Initialize Mermaid with theme based on dark mode preference
function initializeMermaidWithTheme() {
  const isDark = localStorage.getItem('darkMode') === 'enabled';
  mermaid.initialize({
    startOnLoad: true,
    theme: isDark ? 'dark' : 'default',
    themeVariables: isDark ? {
      primaryColor: '#3DBDC6',
      primaryTextColor: '#e8e8e8',
      primaryBorderColor: '#3DBDC6',
      lineColor: '#3DBDC6',
      secondaryColor: '#2d2d2d',
      tertiaryColor: '#1a1a1a',
      background: '#242424',
      mainBkg: '#242424',
      secondBkg: '#2d2d2d',
      textColor: '#e8e8e8',
      border1: '#404040',
      border2: '#404040',
      fontSize: '13px',
      fontFamily: 'Fira Code Local, Fira Code, Segoe UI, Calibri, Arial, sans-serif'
    } : {
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
}

// Initial mermaid setup
initializeMermaidWithTheme();

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
const fileInfoBar = document.getElementById('fileInfoBar');
const fileName = document.getElementById('fileName');
const filePath = document.getElementById('filePath');
const exportPdfBtn = document.getElementById('exportPdf');
const toggleEditBtn = document.getElementById('toggleEdit');
const editorPanel = document.getElementById('editorPanel');
const markdownEditor = document.getElementById('markdownEditor');
const saveButton = document.getElementById('saveButton');
const unsavedIndicator = document.getElementById('unsavedIndicator');
const contentWrapper = document.querySelector('.content-wrapper');
const loadingScreen = document.getElementById('loadingScreen');
const darkModeToggle = document.getElementById('darkModeToggle');

// Current file tracking
let currentFilePath = null;

// File watching state
let isFileTrackingActive = false;
let fileUpdateNotificationShown = false;
let fileUpdateDismissTimeout = null;

// Editor state
let isEditMode = false;
let hasUnsavedChanges = false;
let originalMarkdown = '';
let previewDebounceTimer = null;
const PREVIEW_DEBOUNCE_DELAY = 3000; // 3 seconds

// Navigation history (for back/forward)
let navigationHistory = [];
let navigationIndex = -1;
let isNavigating = false; // Flag to prevent adding to history during back/forward

// Update file info display
function updateFileInfo(path) {
  if (!path) {
    fileInfoBar.style.display = 'none';
    currentFilePath = null;
    return;
  }

  currentFilePath = path;
  const pathParts = path.split(/[\\/]/);
  const name = pathParts.pop();
  const directory = pathParts.join('/');

  fileName.textContent = name;
  filePath.textContent = directory;
  fileInfoBar.style.display = 'flex';
}

// Copy path to clipboard on click
filePath.addEventListener('click', () => {
  if (currentFilePath) {
    navigator.clipboard.writeText(currentFilePath).then(() => {
      // Visual feedback
      const originalText = filePath.textContent;
      filePath.textContent = '✓ Path copied to clipboard';
      filePath.style.color = 'var(--primary-color)';
      setTimeout(() => {
        const pathParts = currentFilePath.split(/[\\/]/);
        pathParts.pop(); // Remove filename
        filePath.textContent = pathParts.join('/');
        filePath.style.color = '';
      }, 1500);
    }).catch(err => {
      console.error('Failed to copy path:', err);
    });
  }
});

// Navigation history functions
const navBackBtn = document.getElementById('navBackBtn');
const navForwardBtn = document.getElementById('navForwardBtn');

function updateNavButtons() {
  if (navBackBtn) navBackBtn.disabled = navigationIndex <= 0;
  if (navForwardBtn) navForwardBtn.disabled = navigationIndex >= navigationHistory.length - 1;
}

function addToNavigationHistory(filePath, scrollPosition = 0) {
  if (isNavigating) return; // Don't add during back/forward navigation

  // Update scroll position of current entry before navigating away
  if (navigationIndex >= 0 && navigationHistory[navigationIndex]) {
    navigationHistory[navigationIndex].scrollPosition = contentWrapper.scrollTop;
  }

  // Remove any forward history when navigating to new file
  if (navigationIndex < navigationHistory.length - 1) {
    navigationHistory = navigationHistory.slice(0, navigationIndex + 1);
  }

  // Don't add if it's the same file
  if (navigationHistory.length > 0 && navigationHistory[navigationHistory.length - 1].filePath === filePath) {
    return;
  }

  navigationHistory.push({ filePath, scrollPosition });
  navigationIndex = navigationHistory.length - 1;
  updateNavButtons();
}

function navigateBack() {
  if (navigationIndex <= 0) return;

  // Save current scroll position
  if (navigationHistory[navigationIndex]) {
    navigationHistory[navigationIndex].scrollPosition = contentWrapper.scrollTop;
  }

  navigationIndex--;
  const entry = navigationHistory[navigationIndex];
  if (entry) {
    isNavigating = true;
    ipcRenderer.send('open-file-path', entry.filePath);
    // Scroll position will be restored when file loads
  }
  updateNavButtons();
}

function navigateForward() {
  if (navigationIndex >= navigationHistory.length - 1) return;

  // Save current scroll position
  if (navigationHistory[navigationIndex]) {
    navigationHistory[navigationIndex].scrollPosition = contentWrapper.scrollTop;
  }

  navigationIndex++;
  const entry = navigationHistory[navigationIndex];
  if (entry) {
    isNavigating = true;
    ipcRenderer.send('open-file-path', entry.filePath);
    // Scroll position will be restored when file loads
  }
  updateNavButtons();
}

// Navigation button click handlers
if (navBackBtn) navBackBtn.addEventListener('click', navigateBack);
if (navForwardBtn) navForwardBtn.addEventListener('click', navigateForward);

// Keyboard navigation (left/right arrows)
document.addEventListener('keydown', (e) => {
  // Don't trigger if typing in input/textarea or if modifier keys are pressed
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.ctrlKey || e.altKey || e.metaKey) return;

  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    navigateBack();
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    navigateForward();
  }
});

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

// Dark mode toggle
darkModeToggle.addEventListener('click', () => {
  document.body.classList.toggle('dark-mode');
  const isDarkMode = document.body.classList.contains('dark-mode');
  localStorage.setItem('darkMode', isDarkMode ? 'enabled' : 'disabled');

  // Re-initialize Mermaid with new theme if there are diagrams
  const mermaidElements = document.querySelectorAll('.mermaid');
  if (mermaidElements.length > 0) {
    updateMermaidTheme(isDarkMode);
  }
});

// Load dark mode preference on startup
function loadDarkModePreference() {
  const darkMode = localStorage.getItem('darkMode');
  if (darkMode === 'enabled') {
    document.body.classList.add('dark-mode');
  }
}

// Update Mermaid theme based on dark mode and re-render diagrams
async function updateMermaidTheme(isDark) {
  mermaid.initialize({
    startOnLoad: true,
    theme: isDark ? 'dark' : 'default',
    themeVariables: isDark ? {
      primaryColor: '#3DBDC6',
      primaryTextColor: '#e8e8e8',
      primaryBorderColor: '#3DBDC6',
      lineColor: '#3DBDC6',
      secondaryColor: '#2d2d2d',
      tertiaryColor: '#1a1a1a',
      background: '#242424',
      mainBkg: '#242424',
      secondBkg: '#2d2d2d',
      textColor: '#e8e8e8',
      border1: '#404040',
      border2: '#404040',
      fontSize: '13px',
      fontFamily: 'Fira Code Local, Fira Code, Segoe UI, Calibri, Arial, sans-serif'
    } : {
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

  // Re-render existing content if there's markdown loaded
  if (originalMarkdown) {
    await renderMarkdown(originalMarkdown);
  }
}

// Load dark mode on startup
loadDarkModePreference();

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

// Handle links in rendered markdown
viewer.addEventListener('click', (e) => {
  // Find the closest anchor tag (in case click was on child element)
  const link = e.target.closest('a');
  if (link && link.href) {
    const url = link.href;

    // Check if it's an external web link (http or https)
    if (url.startsWith('http://') || url.startsWith('https://')) {
      e.preventDefault();
      shell.openExternal(url);
      return;
    }

    // Check if it's a local file link (file:// or relative path)
    // Get the href attribute directly to handle relative paths
    const hrefAttr = link.getAttribute('href');
    if (hrefAttr && !hrefAttr.startsWith('#') && !hrefAttr.startsWith('http')) {
      e.preventDefault();

      // Resolve the path relative to current file
      let targetPath = hrefAttr;

      // Handle file:// protocol
      if (targetPath.startsWith('file://')) {
        targetPath = targetPath.replace('file://', '');
        // Handle Windows paths like file:///C:/...
        if (targetPath.startsWith('/') && targetPath[2] === ':') {
          targetPath = targetPath.substring(1);
        }
      }

      // If it's a relative path, resolve it against current file's directory
      if (currentFilePath && !path.isAbsolute(targetPath)) {
        const currentDir = path.dirname(currentFilePath);
        targetPath = path.resolve(currentDir, targetPath);
      }

      // Check if the file exists
      if (fs.existsSync(targetPath)) {
        // Check if it's a markdown or mermaid file
        const ext = path.extname(targetPath).toLowerCase();
        if (['.md', '.markdown', '.mmd', '.mermaid'].includes(ext)) {
          // Open the markdown file in this app
          ipcRenderer.send('open-file-path', targetPath);
        } else {
          // Open other files with system default app
          shell.openPath(targetPath);
        }
      } else {
        showNotification(`File not found: ${path.basename(targetPath)}`, 4000);
      }
    }
  }
});

// Open file button
openFileBtn.addEventListener('click', () => {
  // Check for unsaved changes before opening file dialog
  if (isEditMode && hasUnsavedChanges) {
    if (!confirm('You have unsaved changes. Discard changes and open a new file?')) {
      return; // User canceled, don't open file dialog
    }
  }

  ipcRenderer.send('open-file-dialog');
});

// Export to PDF button
exportPdfBtn.addEventListener('click', () => {
  if (!currentFilePath) {
    alert('Please open a markdown file first before exporting to PDF.');
    return;
  }

  const pathParts = currentFilePath.split(/[\\/]/);
  const currentFileName = pathParts.pop();

  ipcRenderer.send('export-pdf', { currentFileName });
});

// Show notification toast
function showNotification(message, duration = 3000) {
  const toast = document.getElementById('notificationToast');
  const messageEl = document.getElementById('notificationMessage');

  messageEl.textContent = message;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

// Loading screen functions
function showLoadingScreen() {
  loadingScreen.classList.add('active');
}

function hideLoadingScreen() {
  loadingScreen.classList.remove('active');
}

// File update notification functions
function showFileUpdateNotification() {
  if (fileUpdateNotificationShown) {
    return; // Don't show multiple notifications
  }

  const toast = document.getElementById('fileUpdateToast');
  if (!toast) {
    console.error('File update toast element not found');
    return;
  }

  toast.classList.add('show');
  fileUpdateNotificationShown = true;

  // Auto-dismiss after 10 seconds
  fileUpdateDismissTimeout = setTimeout(() => {
    dismissFileUpdateNotification();
  }, 10000);
}

function dismissFileUpdateNotification() {
  const toast = document.getElementById('fileUpdateToast');
  if (toast) {
    toast.classList.remove('show');
  }
  fileUpdateNotificationShown = false;

  if (fileUpdateDismissTimeout) {
    clearTimeout(fileUpdateDismissTimeout);
    fileUpdateDismissTimeout = null;
  }
}

function reloadCurrentFile() {
  if (!currentFilePath) {
    return;
  }

  dismissFileUpdateNotification();
  ipcRenderer.send('reload-file', { filePath: currentFilePath });
}

// Handle PDF export result
ipcRenderer.on('pdf-export-result', (event, data) => {
  if (data.success) {
    console.log('PDF exported successfully to:', data.path);
    const fileName = data.path.split(/[\\/]/).pop();
    showNotification(`PDF exported: ${fileName}`);
  } else {
    console.error('PDF export failed:', data.error);
    alert(`Failed to export PDF: ${data.error}`);
  }
});

// Toggle edit mode
toggleEditBtn.addEventListener('click', () => {
  if (isEditMode && hasUnsavedChanges) {
    if (!confirm('You have unsaved changes. Exit edit mode anyway?')) {
      return;
    }
  }

  isEditMode = !isEditMode;

  if (isEditMode) {
    // Enter edit mode
    contentWrapper.classList.add('split-view');
    markdownEditor.value = originalMarkdown;
    hasUnsavedChanges = false;
    updateUnsavedIndicator();
    toggleEditBtn.style.background = 'var(--primary-color)';
    toggleEditBtn.style.color = '#ffffff';
  } else {
    // Exit edit mode
    contentWrapper.classList.remove('split-view');
    toggleEditBtn.style.background = '';
    toggleEditBtn.style.color = '';
    clearTimeout(previewDebounceTimer);

    // Resume file tracking when exiting edit mode (if it was paused)
    if (!isFileTrackingActive && currentFilePath) {
      ipcRenderer.send('resume-file-watching');
      isFileTrackingActive = true;
    }
  }
});

// Live preview with 3-second debounce
markdownEditor.addEventListener('input', () => {
  if (!isEditMode) return;

  const previousUnsavedState = hasUnsavedChanges;
  hasUnsavedChanges = (markdownEditor.value !== originalMarkdown);
  updateUnsavedIndicator();

  // Pause file tracking when unsaved changes appear
  if (!previousUnsavedState && hasUnsavedChanges) {
    ipcRenderer.send('pause-file-watching');
    isFileTrackingActive = false;
  }

  // Clear existing timer
  clearTimeout(previewDebounceTimer);

  // Set new timer for 3 seconds
  previewDebounceTimer = setTimeout(() => {
    renderMarkdown(markdownEditor.value);
  }, PREVIEW_DEBOUNCE_DELAY);
});

// Save file
function saveMarkdownFile() {
  if (!currentFilePath) {
    alert('No file is currently open.');
    return;
  }

  const content = markdownEditor.value;
  ipcRenderer.send('save-markdown-file', {
    filePath: currentFilePath,
    content: content
  });
}

// Save button click
saveButton.addEventListener('click', saveMarkdownFile);

// Ctrl+S keyboard shortcut
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's' && isEditMode) {
    e.preventDefault();
    saveMarkdownFile();
  }
});

// Handle save result
ipcRenderer.on('save-markdown-result', (event, data) => {
  if (data.success) {
    originalMarkdown = markdownEditor.value;
    hasUnsavedChanges = false;
    updateUnsavedIndicator();
    console.log('File saved successfully');

    // Resume file tracking after save
    if (!isFileTrackingActive) {
      ipcRenderer.send('resume-file-watching');
      isFileTrackingActive = true;
    }
  } else {
    console.error('Save failed:', data.error);
    alert(`Failed to save file: ${data.error}`);
  }
});

// Update unsaved indicator
function updateUnsavedIndicator() {
  if (hasUnsavedChanges) {
    unsavedIndicator.style.display = 'inline';
  } else {
    unsavedIndicator.style.display = 'none';
  }
}

// Pin functionality for recent panel
const pinRecentPanelBtn = document.getElementById('pinRecentPanel');
let isRecentPanelPinned = localStorage.getItem('recentPanelPinned') === 'true';

// Initialize pinned state on load
function initPinnedState() {
  if (isRecentPanelPinned) {
    pinRecentPanelBtn.classList.add('pinned');
    pinRecentPanelBtn.title = 'Unpin panel';
    recentPanel.classList.add('visible');
  }
}
initPinnedState();

// Toggle pin state
pinRecentPanelBtn.addEventListener('click', () => {
  isRecentPanelPinned = !isRecentPanelPinned;
  localStorage.setItem('recentPanelPinned', isRecentPanelPinned);

  if (isRecentPanelPinned) {
    pinRecentPanelBtn.classList.add('pinned');
    pinRecentPanelBtn.title = 'Unpin panel';
  } else {
    pinRecentPanelBtn.classList.remove('pinned');
    pinRecentPanelBtn.title = 'Pin panel open';
  }
});

// Recent files panel toggle
toggleRecentBtn.addEventListener('click', () => {
  recentPanel.classList.toggle('visible');
});

closeRecentBtn.addEventListener('click', () => {
  recentPanel.classList.remove('visible');
  // Also unpin when manually closing
  if (isRecentPanelPinned) {
    isRecentPanelPinned = false;
    localStorage.setItem('recentPanelPinned', 'false');
    pinRecentPanelBtn.classList.remove('pinned');
    pinRecentPanelBtn.title = 'Pin panel open';
  }
});

// Clear all recent files
const clearAllRecentBtn = document.getElementById('clearAllRecent');
clearAllRecentBtn.addEventListener('click', () => {
  if (confirm('Are you sure you want to clear all recent files?')) {
    localStorage.removeItem('recentFiles');
    updateRecentFilesList();
  }
});

// Mouse hover to open recent panel
let mouseHoverTimeout = null;
let isMouseInTriggerZone = false;
const HOVER_TRIGGER_ZONE = 10; // pixels from left edge
const HOVER_DELAY = 500; // milliseconds

document.addEventListener('mousemove', (e) => {
  // Don't auto-show if panel is pinned (it's already visible)
  if (isRecentPanelPinned) return;

  // Check if mouse is near the left edge
  if (e.clientX <= HOVER_TRIGGER_ZONE) {
    // Start timeout if not already started
    if (!mouseHoverTimeout && !recentPanel.classList.contains('visible')) {
      isMouseInTriggerZone = true;
      mouseHoverTimeout = setTimeout(() => {
        // Only open if mouse is still in the trigger zone
        if (isMouseInTriggerZone) {
          recentPanel.classList.add('visible');
        }
        mouseHoverTimeout = null;
      }, HOVER_DELAY);
    }
  } else {
    // Clear timeout if mouse moves away before delay completes
    isMouseInTriggerZone = false;
    if (mouseHoverTimeout) {
      clearTimeout(mouseHoverTimeout);
      mouseHoverTimeout = null;
    }
  }
});

// Close recent panel when clicking outside (unless pinned)
document.addEventListener('click', (e) => {
  if (recentPanel.classList.contains('visible') && !isRecentPanelPinned) {
    // Check if click is outside the recent panel
    if (!recentPanel.contains(e.target) && e.target !== toggleRecentBtn) {
      recentPanel.classList.remove('visible');
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

    const contentDiv = document.createElement('div');
    contentDiv.className = 'recent-item-content';
    contentDiv.innerHTML = `
      <div class="recent-item-name">${file.name}</div>
      <div class="recent-item-path">${file.path}</div>
    `;

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'recent-delete-btn';
    deleteBtn.innerHTML = '×';
    deleteBtn.title = 'Remove from recent files';

    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent opening the file
      let recentFiles = getRecentFiles();
      recentFiles = recentFiles.filter(f => f.path !== file.path);
      localStorage.setItem('recentFiles', JSON.stringify(recentFiles));
      updateRecentFilesList();
    });

    contentDiv.addEventListener('click', () => {
      // Check for unsaved changes before opening
      if (isEditMode && hasUnsavedChanges) {
        if (!confirm(`You have unsaved changes. Discard changes and open "${file.name}"?`)) {
          return; // User canceled, don't open the file
        }
      }

      // Use the standard file opening path via IPC
      ipcRenderer.send('open-file-path', file.path);
      recentPanel.classList.remove('visible');
    });

    item.appendChild(contentDiv);
    item.appendChild(deleteBtn);
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
  // Show loading screen
  showLoadingScreen();

  // Give browser time to render the loading screen before heavy processing
  await new Promise(resolve => setTimeout(resolve, 10));

  try {
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

      // Add maximize buttons to rendered diagrams
      mermaidElements.forEach((el) => {
        const svg = el.querySelector('svg');
        if (svg) {
          // Wrap in container
          const container = document.createElement('div');
          container.className = 'mermaid-container';
          el.parentNode.insertBefore(container, el);
          container.appendChild(el);

          // Add maximize button
          const maxBtn = document.createElement('button');
          maxBtn.className = 'mermaid-maximize-btn';
          maxBtn.title = 'Open in new window';
          maxBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"></path>
            </svg>
          `;

          maxBtn.addEventListener('click', () => {
            const svgContent = svg.outerHTML;
            const isDarkMode = document.body.classList.contains('dark-mode');
            ipcRenderer.send('open-mermaid-popup', { svgContent, isDarkMode });
          });

          container.appendChild(maxBtn);
        }
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

    // Add maximize buttons to tables
    addTableMaximizeButtons();

    // Build table of contents
    buildTableOfContents();

    // Scroll to top
    viewer.parentElement.scrollTop = 0;

    // Apply syntax highlighting with PrismJS (asynchronously to avoid blocking)
    if (typeof Prism !== 'undefined') {
      // Use requestIdleCallback for non-blocking syntax highlighting
      const highlightCallback = window.requestIdleCallback || window.setTimeout;
      highlightCallback(() => {
        Prism.highlightAll();
        // Add copy buttons to code blocks after syntax highlighting
        addCodeBlockCopyButtons();
        // Hide loading screen after syntax highlighting is done
        hideLoadingScreen();
      });
    } else {
      // Add copy buttons even without Prism
      addCodeBlockCopyButtons();
      // Hide loading screen if no syntax highlighting needed
      hideLoadingScreen();
    }
  } catch (error) {
    console.error('Error rendering markdown:', error);
    viewer.innerHTML = `<div style="color: red; padding: 20px;">
      <strong>Error rendering markdown:</strong><br>${error.message}
    </div>`;
    hideLoadingScreen();
  }
}

// Add maximize buttons to tables for popup view
function addTableMaximizeButtons() {
  const tables = viewer.querySelectorAll('.markdown-body table, #viewer table');

  // Use DocumentFragment to batch DOM operations
  const fragment = document.createDocumentFragment();
  const updates = [];

  tables.forEach((table) => {
    // Skip if already wrapped
    if (table.parentNode.classList?.contains('table-container')) {
      return;
    }

    // Check column count and apply compact styling if needed
    const firstRow = table.querySelector('thead tr, tr:first-child');
    if (firstRow) {
      const columnCount = firstRow.querySelectorAll('th, td').length;
      if (columnCount > 5) {
        table.classList.add('compact-table');
      }
    }

    // Create container and button
    const container = document.createElement('div');
    container.className = 'table-container';

    const maxBtn = document.createElement('button');
    maxBtn.className = 'table-maximize-btn';
    maxBtn.title = 'Open in interactive popup';
    maxBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"></path>
      </svg>
    `;

    maxBtn.addEventListener('click', () => {
      // Extract table data
      const tableData = extractTableData(table);
      const isDarkMode = document.body.classList.contains('dark-mode');
      ipcRenderer.send('open-table-popup', { tableData, isDarkMode });
    });

    // Store for batch insertion
    updates.push({ table, container, maxBtn });
  });

  // Batch insert all containers and buttons
  updates.forEach(({ table, container, maxBtn }) => {
    table.parentNode.insertBefore(container, table);
    container.appendChild(table);
    container.appendChild(maxBtn);
  });
}

// Add copy buttons to code blocks
function addCodeBlockCopyButtons() {
  const codeBlocks = viewer.querySelectorAll('.markdown-body pre, #viewer pre');

  codeBlocks.forEach((pre) => {
    // Skip if already wrapped
    if (pre.parentNode.classList?.contains('code-block-container')) {
      return;
    }

    // Get the code element inside pre
    const codeElement = pre.querySelector('code');
    if (!codeElement) return;

    // Create container
    const container = document.createElement('div');
    container.className = 'code-block-container';

    // Create copy button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'code-copy-btn';
    copyBtn.title = 'Copy to clipboard';
    copyBtn.innerHTML = `
      <svg class="copy-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
      <svg class="check-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: none;">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    `;

    copyBtn.addEventListener('click', async () => {
      // Get the raw text content (without formatting)
      const textContent = codeElement.textContent;

      try {
        await navigator.clipboard.writeText(textContent);

        // Show success feedback
        const copyIcon = copyBtn.querySelector('.copy-icon');
        const checkIcon = copyBtn.querySelector('.check-icon');
        copyIcon.style.display = 'none';
        checkIcon.style.display = 'block';
        copyBtn.classList.add('copied');

        // Reset after 2 seconds
        setTimeout(() => {
          copyIcon.style.display = 'block';
          checkIcon.style.display = 'none';
          copyBtn.classList.remove('copied');
        }, 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
        showNotification('Failed to copy to clipboard', 2000);
      }
    });

    // Wrap pre in container and add button
    pre.parentNode.insertBefore(container, pre);
    container.appendChild(pre);
    container.appendChild(copyBtn);
  });
}

// Extract table data as structured JSON for Tabulator
function extractTableData(table) {
  const data = [];
  const columns = [];

  // Extract headers
  const headerRow = table.querySelector('thead tr, tr:first-child');
  if (headerRow) {
    const headers = headerRow.querySelectorAll('th, td');
    headers.forEach((header, index) => {
      const headerText = header.textContent.trim() || `Column ${index + 1}`;
      columns.push({
        title: headerText,
        field: `col${index}`,
        headerFilter: 'input',
        headerFilterPlaceholder: 'Filter...'
      });
    });
  }

  // Extract data rows
  const tbody = table.querySelector('tbody') || table;
  const rows = tbody.querySelectorAll('tr');

  rows.forEach((row, rowIndex) => {
    // Skip header row if no thead
    if (!table.querySelector('thead') && rowIndex === 0) {
      return;
    }

    const cells = row.querySelectorAll('td, th');
    if (cells.length > 0) {
      const rowData = {};
      cells.forEach((cell, index) => {
        rowData[`col${index}`] = cell.textContent.trim();
      });
      data.push(rowData);
    }
  });

  return { columns, data };
}

// Handle file opened
ipcRenderer.on('file-opened', async (event, data) => {
  // Store original markdown for editor
  originalMarkdown = data.content;

  // If in edit mode, update editor content
  if (isEditMode) {
    markdownEditor.value = originalMarkdown;
    hasUnsavedChanges = false;
    updateUnsavedIndicator();
  }

  await renderMarkdown(data.content);

  // Update file info bar
  updateFileInfo(data.path);

  // Handle navigation history and scroll position
  if (isNavigating) {
    // Restore scroll position for back/forward navigation
    const entry = navigationHistory[navigationIndex];
    if (entry && entry.scrollPosition) {
      // Small delay to ensure content is rendered
      setTimeout(() => {
        contentWrapper.scrollTop = entry.scrollPosition;
      }, 100);
    }
    isNavigating = false;
  } else {
    // Add to navigation history for normal file opens
    addToNavigationHistory(data.path, 0);
    // Scroll to top for new files
    contentWrapper.scrollTop = 0;
  }

  // Enable file tracking
  isFileTrackingActive = true;

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

// Handle file changed externally
ipcRenderer.on('file-changed-externally', (event, data) => {
  console.log('File changed externally:', data.path);

  // Don't show notification if we have unsaved changes (tracking should be paused anyway)
  if (hasUnsavedChanges) {
    return;
  }

  // Show notification
  showFileUpdateNotification();
});

// Handle file deleted
ipcRenderer.on('file-deleted', (event, data) => {
  console.log('File deleted:', data.path);
  showNotification('Warning: The opened file has been deleted from disk', 5000);
  isFileTrackingActive = false;
});

// Handle file not found (from recent files or links)
ipcRenderer.on('file-not-found', (event, data) => {
  console.log('File not found:', data.path);
  showNotification(`File not found: ${path.basename(data.path)}`, 4000);

  // Remove from recent files if it exists there
  let recentFiles = getRecentFiles();
  const filtered = recentFiles.filter(f => f.path !== data.path);
  if (filtered.length !== recentFiles.length) {
    localStorage.setItem('recentFiles', JSON.stringify(filtered));
    updateRecentFilesList();
  }
});

// Handle file reload result
ipcRenderer.on('file-reload-result', async (event, data) => {
  if (data.success) {
    // Store new content as original
    originalMarkdown = data.content;

    // If in edit mode, update editor content
    if (isEditMode) {
      markdownEditor.value = originalMarkdown;
      hasUnsavedChanges = false;
      updateUnsavedIndicator();
    }

    // Re-render the markdown
    await renderMarkdown(data.content);

    showNotification('File reloaded successfully', 2000);
  } else {
    showNotification(`Failed to reload file: ${data.error}`, 4000);
  }
});

// Handle external file open request (from double-clicking a file when app is already open)
ipcRenderer.on('external-file-open-request', (event, data) => {
  const { filePath } = data;

  // Check for unsaved changes
  if (isEditMode && hasUnsavedChanges) {
    if (!confirm(`You have unsaved changes. Discard changes and open "${filePath.split(/[\\/]/).pop()}"?`)) {
      return; // User canceled, don't open the new file
    }
  }

  // Proceed with opening the file
  ipcRenderer.send('request-open-file', { filePath });
});

// Handle error messages from main process
ipcRenderer.on('show-error', (event, message) => {
  showNotification(message, 5000);
});

// Update zoom on load
updateZoom();

// ============================================
// Auto-Update UI Handler
// ============================================

const appUpdateToast = document.getElementById('appUpdateToast');
const updateTitle = document.getElementById('updateTitle');
const updateMessage = document.getElementById('updateMessage');
const updateProgress = document.getElementById('updateProgress');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const updateActions = document.getElementById('updateActions');
const downloadUpdateBtn = document.getElementById('downloadUpdateBtn');
const installUpdateBtn = document.getElementById('installUpdateBtn');
const laterUpdateBtn = document.getElementById('laterUpdateBtn');
const closeUpdateToast = document.getElementById('closeUpdateToast');

let pendingUpdateVersion = null;

function showUpdateToast() {
  appUpdateToast.classList.add('show');
}

function hideUpdateToast() {
  appUpdateToast.classList.remove('show');
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Update status handler
ipcRenderer.on('update-status', (event, data) => {
  switch (data.status) {
    case 'checking':
      // Silent check, don't show UI
      break;

    case 'available':
      pendingUpdateVersion = data.version;
      updateTitle.textContent = 'Update Available';
      updateMessage.textContent = `Version ${data.version} is ready to download`;
      updateProgress.style.display = 'none';
      downloadUpdateBtn.style.display = 'flex';
      installUpdateBtn.style.display = 'none';
      laterUpdateBtn.style.display = 'block';
      updateActions.style.display = 'flex';
      showUpdateToast();
      break;

    case 'not-available':
      // Silent, no update available
      break;

    case 'downloading':
      updateTitle.textContent = 'Downloading Update';
      updateMessage.textContent = `${formatBytes(data.transferred)} / ${formatBytes(data.total)}`;
      updateProgress.style.display = 'flex';
      progressFill.style.width = `${data.percent}%`;
      progressText.textContent = `${Math.round(data.percent)}%`;
      downloadUpdateBtn.style.display = 'none';
      laterUpdateBtn.style.display = 'none';
      updateActions.style.display = 'none';
      break;

    case 'downloaded':
      updateTitle.textContent = 'Update Ready';
      updateMessage.textContent = `Version ${data.version} is ready to install`;
      updateProgress.style.display = 'none';
      downloadUpdateBtn.style.display = 'none';
      installUpdateBtn.style.display = 'flex';
      laterUpdateBtn.style.display = 'block';
      updateActions.style.display = 'flex';
      showUpdateToast();
      break;

    case 'error':
      updateTitle.textContent = 'Update Error';
      updateMessage.textContent = data.error || 'Failed to check for updates';
      updateProgress.style.display = 'none';
      downloadUpdateBtn.style.display = 'none';
      installUpdateBtn.style.display = 'none';
      laterUpdateBtn.style.display = 'block';
      laterUpdateBtn.textContent = 'Dismiss';
      updateActions.style.display = 'flex';
      showUpdateToast();
      break;

    case 'dev-mode':
      // Silent in dev mode
      console.log('Auto-updater:', data.message);
      break;
  }
});

// Update button handlers
downloadUpdateBtn.addEventListener('click', () => {
  ipcRenderer.send('download-update');
});

installUpdateBtn.addEventListener('click', () => {
  ipcRenderer.send('install-update');
});

laterUpdateBtn.addEventListener('click', () => {
  hideUpdateToast();
  laterUpdateBtn.textContent = 'Later'; // Reset text
});

closeUpdateToast.addEventListener('click', () => {
  hideUpdateToast();
  laterUpdateBtn.textContent = 'Later'; // Reset text
});

// ============================================
// Context Menu
// ============================================

const contextMenu = document.getElementById('contextMenu');
const ctxCopy = document.getElementById('ctxCopy');
const ctxCopyPlain = document.getElementById('ctxCopyPlain');
const ctxSelectAll = document.getElementById('ctxSelectAll');

function showContextMenu(x, y) {
  // Get selected text
  const selection = window.getSelection();
  const hasSelection = selection && selection.toString().trim().length > 0;

  // Enable/disable copy items based on selection
  if (hasSelection) {
    ctxCopy.classList.remove('disabled');
    ctxCopyPlain.classList.remove('disabled');
  } else {
    ctxCopy.classList.add('disabled');
    ctxCopyPlain.classList.add('disabled');
  }

  // Position the menu
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;

  // Show the menu
  contextMenu.classList.add('visible');

  // Adjust position if menu goes off screen
  const menuRect = contextMenu.getBoundingClientRect();
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;

  if (menuRect.right > windowWidth) {
    contextMenu.style.left = `${windowWidth - menuRect.width - 10}px`;
  }
  if (menuRect.bottom > windowHeight) {
    contextMenu.style.top = `${windowHeight - menuRect.height - 10}px`;
  }
}

function hideContextMenu() {
  contextMenu.classList.remove('visible');
}

// Show context menu on right-click in viewer area
viewer.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  showContextMenu(e.clientX, e.clientY);
});

// Also allow context menu in editor
markdownEditor.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  showContextMenu(e.clientX, e.clientY);
});

// Hide context menu when clicking elsewhere
document.addEventListener('click', (e) => {
  if (!contextMenu.contains(e.target)) {
    hideContextMenu();
  }
});

// Hide context menu on scroll or resize
document.addEventListener('scroll', hideContextMenu, true);
window.addEventListener('resize', hideContextMenu);

// Hide context menu on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    hideContextMenu();
  }
});

// Copy with formatting (HTML)
ctxCopy.addEventListener('click', () => {
  if (ctxCopy.classList.contains('disabled')) return;

  const selection = window.getSelection();
  if (selection && selection.toString().trim()) {
    // Use document.execCommand for copy with formatting
    document.execCommand('copy');
    showNotification('Copied to clipboard', 1500);
  }
  hideContextMenu();
});

// Copy as plain text
ctxCopyPlain.addEventListener('click', () => {
  if (ctxCopyPlain.classList.contains('disabled')) return;

  const selection = window.getSelection();
  if (selection && selection.toString().trim()) {
    const plainText = selection.toString();
    clipboard.writeText(plainText);
    showNotification('Copied as plain text', 1500);
  }
  hideContextMenu();
});

// Select all
ctxSelectAll.addEventListener('click', () => {
  // Determine which element to select based on focus
  if (isEditMode && document.activeElement === markdownEditor) {
    markdownEditor.select();
  } else {
    // Select all content in viewer
    const range = document.createRange();
    range.selectNodeContents(viewer);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }
  hideContextMenu();
});
