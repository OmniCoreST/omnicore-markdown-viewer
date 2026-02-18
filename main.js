// ============================================
// IMPORTS
// ============================================
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const HTMLtoDOCX = require('html-to-docx');

// Helper modules
const { isMermaidFile, wrapMermaidContent, removeBOM, readMarkdownFile, sendIPCResult } = require('./file-helpers');

// ============================================
// CONDITIONAL IMPORTS
// ============================================
let autoUpdater = null;
try {
  autoUpdater = require('electron-updater').autoUpdater;
} catch (err) {
  console.log('electron-updater not available:', err.message);
}

// ============================================
// LOGGING
// ============================================
const logFilePath = path.join(app.getPath('userData'), 'debug.log');
const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

function log(...args) {
  // Only log in development mode to improve performance
  if (!app.isPackaged) {
    console.log(...args);
  }

  // Always write to file for troubleshooting
  const message = args.map(arg =>
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ');
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  logStream.write(logMessage);
}

log('=== Application started ===');
log('User data path:', app.getPath('userData'));
log('Log file:', logFilePath);

// ============================================
// APPLICATION STATE
// ============================================
let mainWindow = null;
let fileToOpen = null;

// File watching state
let fileWatcher = null;
let watchedFilePath = null;
let lastModifiedTime = null;

// ============================================
// WINDOW MANAGEMENT
// ============================================

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // Don't show until ready
    title: 'Omnicore Markdown Viewer',
    backgroundColor: '#f5f5f5',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    icon: path.join(__dirname, 'logo.ico')
  });

  mainWindow.loadFile('index.html');

  // Hide the menu bar
  mainWindow.setMenu(null);

  // Show window only when content is ready (prevents flicker)
  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  // Load file from command line after window loads
  mainWindow.webContents.on('did-finish-load', () => {
    log('Window finished loading. fileToOpen:', fileToOpen);

    if (fileToOpen) {
      openFile(fileToOpen);
      fileToOpen = null;
    }
  });

  // Open DevTools in development (F12 to toggle)
  // mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Register keyboard shortcuts
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control || input.meta) {
      if (input.key === 'o' && input.type === 'keyDown' && !input.shift) {
        event.preventDefault();
        openFileDialog();
      } else if (input.key === 'q' && input.type === 'keyDown') {
        event.preventDefault();
        app.quit();
      } else if (input.key === 'O' && input.type === 'keyDown' && input.shift) {
        // Ctrl+Shift+O → Corporate mode toggle (forwarded to renderer)
        event.preventDefault();
        mainWindow.webContents.send('toggle-corporate-mode');
      }
    }

    if (input.key === 'F12' && input.type === 'keyDown') {
      event.preventDefault();
      mainWindow.webContents.toggleDevTools();
    } else if (input.key === 'F11' && input.type === 'keyDown') {
      event.preventDefault();
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
    } else if (input.key === 'Escape' && input.type === 'keyDown') {
      if (mainWindow.isFullScreen()) {
        mainWindow.setFullScreen(false);
      }
    }
  });
}

// ============================================
// FILE WATCHING
// ============================================

// Debounce helper for file change events
let fileChangeDebounce = null;

function startFileWatching(filePath) {
  // Stop any existing watcher
  stopFileWatching();

  if (!fs.existsSync(filePath)) {
    console.error('Cannot watch non-existent file:', filePath);
    return;
  }

  watchedFilePath = filePath;

  // Get initial modification time
  try {
    const stats = fs.statSync(filePath);
    lastModifiedTime = stats.mtimeMs;
  } catch (err) {
    console.error('Error getting file stats:', err);
    return;
  }

  // Use OS-level fs.watch for instant detection
  try {
    fileWatcher = fs.watch(filePath, { persistent: false }, (eventType) => {
      if (eventType === 'rename') {
        // File renamed or deleted
        if (!fs.existsSync(filePath)) {
          if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('file-deleted', { path: filePath });
          }
          stopFileWatching();
        }
        return;
      }
      // Debounce 'change' events (editors may fire multiple events rapidly)
      clearTimeout(fileChangeDebounce);
      fileChangeDebounce = setTimeout(() => checkFileChanges(), 150);
    });

    fileWatcher.on('error', (err) => {
      console.error('fs.watch error, falling back to polling:', err.message);
      fileWatcher = null;
      // Fallback to polling every 2 seconds (faster than before)
      fileWatcher = setInterval(() => checkFileChanges(), 2000);
    });

    console.log('Started watching file (OS-level):', filePath);
  } catch (err) {
    console.error('fs.watch not available, using polling:', err.message);
    // Fallback to polling every 2 seconds
    fileWatcher = setInterval(() => checkFileChanges(), 2000);
    console.log('Started watching file (polling):', filePath);
  }
}

function checkFileChanges() {
  if (!watchedFilePath || !fs.existsSync(watchedFilePath)) {
    if (watchedFilePath && !fs.existsSync(watchedFilePath)) {
      // File was deleted
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('file-deleted', { path: watchedFilePath });
      }
      stopFileWatching();
    }
    return;
  }

  try {
    const stats = fs.statSync(watchedFilePath);
    const currentModTime = stats.mtimeMs;

    // Check if file has been modified
    if (currentModTime > lastModifiedTime) {
      console.log('File modified externally:', watchedFilePath);
      lastModifiedTime = currentModTime;

      // Notify renderer about file change
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('file-changed-externally', {
          path: watchedFilePath,
          modifiedTime: currentModTime
        });
      }
    }
  } catch (err) {
    console.error('Error checking file changes:', err);
  }
}

function stopFileWatching() {
  if (fileWatcher) {
    if (typeof fileWatcher.close === 'function') {
      // fs.watch FSWatcher
      try { fileWatcher.close(); } catch (e) { /* ignore */ }
    } else {
      // setInterval fallback
      clearInterval(fileWatcher);
    }
    fileWatcher = null;
    watchedFilePath = null;
    lastModifiedTime = null;
    clearTimeout(fileChangeDebounce);
    fileChangeDebounce = null;
    console.log('Stopped file watching');
  }
}

function pauseFileWatching() {
  if (fileWatcher) {
    if (typeof fileWatcher.close === 'function') {
      try { fileWatcher.close(); } catch (e) { /* ignore */ }
    } else {
      clearInterval(fileWatcher);
    }
    fileWatcher = null;
    console.log('Paused file watching');
  }
}

function resumeFileWatching() {
  if (watchedFilePath && !fileWatcher) {
    startFileWatching(watchedFilePath);
    console.log('Resumed file watching');
  }
}

// ============================================
// FILE OPERATIONS
// ============================================

function openFile(filePath) {
  log('Attempting to open file:', filePath);

  if (!fs.existsSync(filePath)) {
    log('ERROR: File not found:', filePath);
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('show-error', `File not found: ${filePath}`);
    }
    return;
  }

  // Ensure window is ready
  if (!mainWindow || !mainWindow.webContents) {
    log('ERROR: Window not ready');
    return;
  }

  // Use helper function for reading markdown files
  readMarkdownFile(filePath, (err, data) => {
    if (err) {
      log('ERROR: Error reading file:', err);
      mainWindow.webContents.send('show-error', `Error reading file: ${err.message}`);
      return;
    }

    log('File read successfully, sending to renderer');
    mainWindow.webContents.send('file-opened', {
      content: data,
      path: filePath,
      allPaths: [filePath]
    });

    // Start watching the file for external changes
    startFileWatching(filePath);
  });
}

function openFileDialog() {
  dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Markdown Files', extensions: ['md', 'markdown', 'mdown', 'mkd', 'mkdn'] },
      { name: 'Mermaid Files', extensions: ['mmd', 'mermaid'] },
      { name: 'OmniWare Files', extensions: ['ow'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  }).then(result => {
    if (!result.canceled && result.filePaths.length > 0) {
      const filePaths = result.filePaths;
      const firstFilePath = filePaths[0];

      // Use helper function for reading markdown files
      readMarkdownFile(firstFilePath, (err, data) => {
        if (err) {
          console.error('Error reading file:', err);
          return;
        }

        // Send first file content and all selected paths
        mainWindow.webContents.send('file-opened', {
          content: data,
          path: firstFilePath,
          allPaths: filePaths
        });

        // Start watching the first file for external changes
        startFileWatching(firstFilePath);
      });
    }
  }).catch(err => {
    console.error('Error opening file:', err);
  });
}

// ============================================
// IPC HANDLERS - File Operations
// ============================================

ipcMain.on('open-file-dialog', () => {
  openFileDialog();
});

// Handle image insert dialog
ipcMain.on('open-image-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Image',
    filters: [
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'] }
    ],
    properties: ['openFile']
  });

  if (result.canceled || result.filePaths.length === 0) return;

  const filePath = result.filePaths[0];
  const ext = path.extname(filePath).toLowerCase().replace('.', '');
  const fileName = path.basename(filePath);

  const mimeTypes = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp'
  };
  const mimeType = mimeTypes[ext] || 'image/png';

  try {
    const data = fs.readFileSync(filePath);
    const base64 = data.toString('base64');
    mainWindow.webContents.send('image-selected', { base64, mimeType, fileName });
  } catch (err) {
    console.error('Image read error:', err);
    mainWindow.webContents.send('image-selected', { error: err.message });
  }
});

// Handle direct file path open request from renderer (for markdown links)
ipcMain.on('open-file-path', (event, filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    openFile(filePath);
  } else if (filePath) {
    // File doesn't exist - notify renderer to update recent files
    mainWindow.webContents.send('file-not-found', { path: filePath });
  }
});

// Handle open folder in file explorer request
ipcMain.on('open-folder-in-explorer', (event, filePath) => {
  if (filePath) {
    // shell.showItemInFolder will open the folder and select the file
    shell.showItemInFolder(filePath);
  }
});

// ============================================
// IPC HANDLERS - Export
// ============================================

// Handle corporate PDF export (with letterhead)
ipcMain.on('export-pdf-corporate', async (event, data) => {
  try {
    const { currentFileName } = data;

    let defaultFilename = 'document-corporate.pdf';
    if (currentFileName) {
      const nameWithoutExt = currentFileName.replace(/\.[^/.]+$/, '');
      defaultFilename = `${nameWithoutExt}-corporate.pdf`;
    }

    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export to PDF (Corporate)',
      defaultPath: defaultFilename,
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
    });

    if (result.canceled || !result.filePath) return;

    // Ask renderer to switch to light mode so PDF is always captured in light theme
    mainWindow.webContents.send('prepare-for-pdf-export');
    await new Promise(resolve => ipcMain.once('pdf-export-ready', resolve));

    // Build corporate letterhead templates (header/footer appear on every page via Chromium)
    const logoPath = path.join(__dirname, 'omnicore-letterhead-logo.png');
    let logoDataUri = '';
    try {
      const logoData = fs.readFileSync(logoPath);
      logoDataUri = 'data:image/png;base64,' + logoData.toString('base64');
    } catch (e) {
      console.warn('Corporate logo not found:', logoPath);
    }

    const headerTemplate = `<div style="-webkit-print-color-adjust:exact;color-adjust:exact;width:100%;padding:10px 36px 0 36px;box-sizing:border-box;display:flex;justify-content:space-between;align-items:flex-start;">
      <img src="${logoDataUri}" style="height:36px;width:auto;display:block;">
      <span style="font-size:9px;color:#999999;font-family:Arial,sans-serif;padding-top:4px;">${currentFileName || ''}</span>
    </div>`;

    const footerTemplate = `<div style="-webkit-print-color-adjust:exact;color-adjust:exact;width:100%;height:100%;padding:4px 0 0 36px;box-sizing:border-box;display:flex;justify-content:space-between;align-items:flex-end;font-family:Arial,sans-serif;overflow:visible;">
      <div style="line-height:1.5;">
        <div style="font-size:7px;font-weight:bold;font-style:italic;color:#279EA7;">OMNICORE STRATEJİK TEKNOLOJİLER LİMİTED ŞİRKETİ</div>
        <div style="font-size:6px;color:#1F3244;">KÜÇÜKBAKKALKÖY MAH. SELVİLİ SK. NO: 4 İÇ KAPI NO: 20 ATAŞEHİR</div>
        <div style="font-size:6px;color:#1F3244;">1074342 / 0642108183700001</div>
        <div style="font-size:6px;color:#279EA7;">www.omnicore.com.tr</div>
      </div>
      <div style="display:flex;align-items:flex-end;gap:22px;overflow:visible;align-self:stretch;">
        <div style="display:flex;gap:3px;height:70%;align-self:flex-end;margin-bottom:-20px;overflow:visible;">
          <div style="width:1px;background:#279EA7;"></div>
          <div style="width:1px;background:#279EA7;"></div>
          <div style="width:1px;background:#279EA7;"></div>
        </div>
        <span class="pageNumber" style="font-size:20px;font-weight:300;color:#1F3244;padding-right:28px;"></span>
      </div>
    </div>`;

    const pdfData = await mainWindow.webContents.printToPDF({
      printBackground: true,
      landscape: false,
      pageSize: 'A4',
      displayHeaderFooter: true,
      headerTemplate,
      footerTemplate,
      margins: { top: 1.2, bottom: 1.0, left: 0.8, right: 0.8 }
    });

    fs.writeFile(result.filePath, pdfData, (err) => {
      if (err) {
        mainWindow.webContents.send('pdf-export-result', { success: false, error: err.message });
      } else {
        mainWindow.webContents.send('pdf-export-result', { success: true, path: result.filePath });
      }
    });
  } catch (error) {
    mainWindow.webContents.send('pdf-export-result', { success: false, error: error.message });
  }
});

ipcMain.on('export-pdf', async (event, data) => {
  try {
    const { currentFileName } = data;

    // Determine default filename
    let defaultFilename = 'document.pdf';
    if (currentFileName) {
      const nameWithoutExt = currentFileName.replace(/\.[^/.]+$/, '');
      defaultFilename = `${nameWithoutExt}.pdf`;
    }

    // Show save dialog
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export to PDF',
      defaultPath: defaultFilename,
      filters: [
        { name: 'PDF Files', extensions: ['pdf'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (result.canceled || !result.filePath) {
      return;
    }

    // Ask renderer to switch to light mode so PDF is always captured in light theme
    mainWindow.webContents.send('prepare-for-pdf-export');
    await new Promise(resolve => ipcMain.once('pdf-export-ready', resolve));

    // Generate PDF from current page
    const pdfData = await mainWindow.webContents.printToPDF({
      printBackground: true,
      landscape: false,
      marginsType: 1, // Minimum margins
      pageSize: 'A4',
      preferCSSPageSize: false
    });

    // Write PDF to file
    fs.writeFile(result.filePath, pdfData, (err) => {
      if (err) {
        console.error('Error saving PDF:', err);
        mainWindow.webContents.send('pdf-export-result', {
          success: false,
          error: err.message
        });
      } else {
        console.log('PDF saved successfully:', result.filePath);
        mainWindow.webContents.send('pdf-export-result', {
          success: true,
          path: result.filePath
        });
      }
    });
  } catch (error) {
    console.error('Error exporting PDF:', error);
    mainWindow.webContents.send('pdf-export-result', {
      success: false,
      error: error.message
    });
  }
});

// Handle Word export request from renderer
ipcMain.on('export-word', async (event, data) => {
  console.log('Received export-word request');
  try {
    const { currentFileName, htmlContent } = data;
    console.log('Processing Word export for:', currentFileName, 'HTML length:', htmlContent?.length);

    // Determine default filename
    let defaultFilename = 'document.docx';
    if (currentFileName) {
      const nameWithoutExt = currentFileName.replace(/\.[^/.]+$/, '');
      defaultFilename = `${nameWithoutExt}.docx`;
    }

    // Show save dialog
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export to Word',
      defaultPath: defaultFilename,
      filters: [
        { name: 'Word Documents', extensions: ['docx'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (result.canceled || !result.filePath) {
      return;
    }

    // Create a complete HTML document with styling
    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Calibri', 'Arial', sans-serif; font-size: 11pt; line-height: 1.6; color: #333; }
          h1 { font-size: 24pt; color: #1F3244; margin-top: 24pt; margin-bottom: 12pt; }
          h2 { font-size: 18pt; color: #1F3244; margin-top: 18pt; margin-bottom: 10pt; }
          h3 { font-size: 14pt; color: #1F3244; margin-top: 14pt; margin-bottom: 8pt; }
          h4, h5, h6 { font-size: 12pt; color: #1F3244; margin-top: 12pt; margin-bottom: 6pt; }
          p { margin-bottom: 10pt; }
          code { font-family: 'Consolas', 'Courier New', monospace; background-color: #f5f5f5; padding: 2pt 4pt; font-size: 10pt; }
          pre { font-family: 'Consolas', 'Courier New', monospace; background-color: #f5f5f5; padding: 10pt; font-size: 10pt; border: 1pt solid #ddd; }
          table { border-collapse: collapse; width: 100%; margin-bottom: 12pt; }
          th, td { border: 1pt solid #ddd; padding: 8pt; text-align: left; }
          th { background-color: #1F3244; color: white; }
          blockquote { border-left: 3pt solid #279EA7; padding-left: 12pt; margin-left: 0; color: #666; }
          a { color: #279EA7; }
          ul, ol { margin-bottom: 10pt; }
          li { margin-bottom: 4pt; }
          img { max-width: 100%; height: auto; }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
      </html>
    `;

    // Convert HTML to DOCX
    const docxBuffer = await HTMLtoDOCX(fullHtml, null, {
      table: { row: { cantSplit: true } },
      footer: true,
      pageNumber: true,
      font: 'Calibri',
      fontSize: 22, // In half-points (22 = 11pt)
      margins: {
        top: 1440,    // 1 inch in twips
        right: 1440,
        bottom: 1440,
        left: 1440,
        header: 720,  // 0.5 inch
        footer: 720,  // 0.5 inch
        gutter: 0
      }
    });

    // Write DOCX to file
    fs.writeFile(result.filePath, docxBuffer, (err) => {
      if (err) {
        console.error('Error saving Word document:', err);
        mainWindow.webContents.send('word-export-result', {
          success: false,
          error: err.message
        });
      } else {
        console.log('Word document saved successfully:', result.filePath);
        mainWindow.webContents.send('word-export-result', {
          success: true,
          path: result.filePath
        });
      }
    });
  } catch (error) {
    console.error('Error exporting Word document:', error);
    mainWindow.webContents.send('word-export-result', {
      success: false,
      error: error.message
    });
  }
});

// Handle corporate Word export (with letterhead)
ipcMain.on('export-word-corporate', async (event, data) => {
  try {
    const { currentFileName, htmlContent } = data;

    let defaultFilename = 'document-corporate.docx';
    if (currentFileName) {
      const nameWithoutExt = currentFileName.replace(/\.[^/.]+$/, '');
      defaultFilename = `${nameWithoutExt}-corporate.docx`;
    }

    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export to Word (Corporate)',
      defaultPath: defaultFilename,
      filters: [{ name: 'Word Documents', extensions: ['docx'] }]
    });

    if (result.canceled || !result.filePath) return;

    // Corporate letterhead HTML wrapper
    const corporateHeader = `
      <div style="border-bottom: 3pt solid #279EA7; padding-bottom: 8pt; margin-bottom: 16pt;">
        <p style="font-size: 10pt; color: #279EA7; font-weight: bold; letter-spacing: 2pt; margin: 0;">OMNICORE</p>
      </div>
    `;
    const corporateFooter = `
      <div style="border-top: 2pt solid #279EA7; padding-top: 8pt; margin-top: 32pt;">
        <p style="font-size: 9pt; color: #666; text-align: center; letter-spacing: 2pt; margin: 0;">CONFIDENTIAL &mdash; OMNICORE DOCUMENT</p>
      </div>
    `;

    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Calibri', 'Arial', sans-serif; font-size: 11pt; line-height: 1.6; color: #333; }
          h1 { font-size: 24pt; color: #1F3244; margin-top: 24pt; margin-bottom: 12pt; }
          h2 { font-size: 18pt; color: #1F3244; margin-top: 18pt; margin-bottom: 10pt; }
          h3 { font-size: 14pt; color: #1F3244; margin-top: 14pt; margin-bottom: 8pt; }
          h4, h5, h6 { font-size: 12pt; color: #1F3244; margin-top: 12pt; margin-bottom: 6pt; }
          p { margin-bottom: 10pt; }
          code { font-family: 'Consolas', 'Courier New', monospace; background-color: #f5f5f5; padding: 2pt 4pt; font-size: 10pt; }
          pre { font-family: 'Consolas', 'Courier New', monospace; background-color: #f5f5f5; padding: 10pt; font-size: 10pt; border: 1pt solid #ddd; }
          table { border-collapse: collapse; width: 100%; margin-bottom: 12pt; }
          th, td { border: 1pt solid #ddd; padding: 8pt; text-align: left; }
          th { background-color: #1F3244; color: white; }
          blockquote { border-left: 3pt solid #279EA7; padding-left: 12pt; margin-left: 0; color: #666; }
          a { color: #279EA7; }
          ul, ol { margin-bottom: 10pt; }
          li { margin-bottom: 4pt; }
          img { max-width: 100%; height: auto; }
        </style>
      </head>
      <body>
        ${corporateHeader}
        ${htmlContent}
        ${corporateFooter}
      </body>
      </html>
    `;

    const docxBuffer = await HTMLtoDOCX(fullHtml, null, {
      table: { row: { cantSplit: true } },
      footer: true,
      pageNumber: true,
      font: 'Calibri',
      fontSize: 22,
      margins: {
        top: 1440,
        right: 1440,
        bottom: 1440,
        left: 1440,
        header: 720,
        footer: 720,
        gutter: 0
      }
    });

    fs.writeFile(result.filePath, docxBuffer, (err) => {
      if (err) {
        mainWindow.webContents.send('word-export-result', { success: false, error: err.message });
      } else {
        mainWindow.webContents.send('word-export-result', { success: true, path: result.filePath });
      }
    });
  } catch (error) {
    mainWindow.webContents.send('word-export-result', { success: false, error: error.message });
  }
});

// Handle markdown file save request from renderer
ipcMain.on('save-markdown-file', (event, data) => {
  try {
    const { filePath, content } = data;

    if (!filePath) {
      mainWindow.webContents.send('save-markdown-result', {
        success: false,
        error: 'No file path provided'
      });
      return;
    }

    // Write file to disk
    fs.writeFile(filePath, content, 'utf8', (err) => {
      if (err) {
        console.error('Error saving file:', err);
        mainWindow.webContents.send('save-markdown-result', {
          success: false,
          error: err.message
        });
      } else {
        console.log('File saved successfully:', filePath);

        // Update lastModifiedTime to prevent false "external change" detection
        if (watchedFilePath === filePath) {
          try {
            const stats = fs.statSync(filePath);
            lastModifiedTime = stats.mtimeMs;
            console.log('Updated lastModifiedTime after save:', lastModifiedTime);
          } catch (statErr) {
            console.error('Error updating file stats after save:', statErr);
          }
        }

        mainWindow.webContents.send('save-markdown-result', {
          success: true,
          path: filePath
        });
      }
    });
  } catch (error) {
    console.error('Error in save handler:', error);
    mainWindow.webContents.send('save-markdown-result', {
      success: false,
      error: error.message
    });
  }
});

// ============================================
// IPC HANDLERS - File Watching
// ============================================

ipcMain.on('start-file-watching', (event, data) => {
  const { filePath } = data;
  startFileWatching(filePath);
});

ipcMain.on('pause-file-watching', () => {
  pauseFileWatching();
});

ipcMain.on('resume-file-watching', () => {
  resumeFileWatching();
});

ipcMain.on('stop-file-watching', () => {
  stopFileWatching();
});

// Handle file reload request
ipcMain.on('reload-file', (event, data) => {
  const { filePath } = data;

  if (!fs.existsSync(filePath)) {
    sendIPCResult(mainWindow.webContents, 'file-reload-result', false, { error: 'File not found' });
    return;
  }

  // Use helper function for reading markdown files
  readMarkdownFile(filePath, (err, content) => {
    if (err) {
      console.error('Error reloading file:', err);
      sendIPCResult(mainWindow.webContents, 'file-reload-result', false, { error: err.message });
    } else {
      // Update the last modified time after successful reload
      try {
        const stats = fs.statSync(filePath);
        lastModifiedTime = stats.mtimeMs;
      } catch (statErr) {
        console.error('Error updating file stats:', statErr);
      }

      sendIPCResult(mainWindow.webContents, 'file-reload-result', true, { content, path: filePath });
    }
  });
});

// ============================================
// IPC HANDLERS - Popups
// ============================================

ipcMain.on('open-mermaid-popup', (event, data) => {
  const { svgContent, isDarkMode } = data;

  // Create popup window
  const popupWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    title: 'Mermaid Diagram - Zoom with mouse wheel, Pan by dragging',
    icon: path.join(__dirname, 'logo.ico')
  });

  popupWindow.setMenu(null);

  // Write a temporary HTML file in system temp directory
  const tempHtmlPath = path.join(os.tmpdir(), 'omnicore-temp-mermaid.html');

  // Create HTML with pan/zoom using matrix transform approach
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mermaid Diagram</title>
    <style>
        body, html {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            background-color: ${isDarkMode ? '#1a1a1a' : '#f0f0f0'};
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        .ui-overlay {
            position: absolute;
            top: 20px;
            left: 20px;
            background: ${isDarkMode ? '#2d2d2d' : 'white'};
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,${isDarkMode ? '0.3' : '0.1'});
            pointer-events: auto;
            z-index: 10;
            border: 1px solid ${isDarkMode ? '#404040' : 'transparent'};
        }
        h1 {
            margin: 0 0 10px 0;
            font-size: 16px;
            color: ${isDarkMode ? '#3DBDC6' : '#333'};
        }
        p {
            margin: 0 0 10px 0;
            font-size: 12px;
            color: ${isDarkMode ? '#a0a0a0' : '#666'};
        }
        button {
            padding: 8px 12px;
            background-color: ${isDarkMode ? '#3DBDC6' : '#279EA7'};
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
            transition: background 0.2s;
            width: 100%;
            margin-bottom: 8px;
        }
        button:last-child {
            margin-bottom: 0;
        }
        button:hover {
            background-color: ${isDarkMode ? '#4FCDD6' : '#1f8089'};
        }
        button:disabled {
            background-color: ${isDarkMode ? '#555' : '#ccc'};
            cursor: not-allowed;
        }
        #svg-container-wrapper {
            cursor: grab;
            overflow: hidden;
        }
        #svg-container-wrapper:active {
            cursor: grabbing;
        }
        #viewport {
            will-change: transform;
        }
    </style>
</head>
<body>
    <div class="ui-overlay">
        <h1>Mermaid Diagram</h1>
        <p>• Scroll to Zoom (at cursor)<br>• Click & Drag to Pan</p>
        <button onclick="resetView()">Reset View</button>
        <button id="pdfBtn" onclick="savePDF()">Save as PDF</button>
    </div>
    <div id="svg-container-wrapper" style="width: 100%; height: 100%; position: relative;">
        <div id="viewport" style="transform-origin: 0 0;">
            ${svgContent}
        </div>
    </div>
    <script>
        const svgWrapper = document.getElementById('svg-container-wrapper');
        const viewport = document.getElementById('viewport');
        const mermaidSvg = viewport.querySelector('svg');

        // Don't extract children - keep the Mermaid SVG intact so styles work
        if (mermaidSvg) {
            mermaidSvg.style.display = 'block';
            mermaidSvg.style.maxWidth = '100%';
            mermaidSvg.style.height = 'auto';
        }
        const svg = svgWrapper; // Treat wrapper as pan/zoom container
        let state = {
            scale: 1,
            panning: false,
            pointX: 0,
            pointY: 0,
            startX: 0,
            startY: 0
        };
        const config = {
            minScale: 0.01,
            maxScale: 10,
            zoomSpeed: 0.1
        };

        // Initial fit to screen
        if (mermaidSvg) {
            const svgRect = mermaidSvg.getBoundingClientRect();
            const wrapperRect = svgWrapper.getBoundingClientRect();
            const scaleX = (wrapperRect.width * 0.9) / svgRect.width;
            const scaleY = (wrapperRect.height * 0.9) / svgRect.height;
            const initialScale = Math.min(scaleX, scaleY, 1);
            state.scale = initialScale;
            state.pointX = (wrapperRect.width - svgRect.width * initialScale) / 2;
            state.pointY = (wrapperRect.height - svgRect.height * initialScale) / 2;
            updateTransform();
        }

        // Mouse wheel zoom
        svg.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = viewport.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const delta = -Math.sign(e.deltaY);
            const zoomFactor = 1 + (config.zoomSpeed * delta);
            let newScale = state.scale * zoomFactor;

            if (newScale < config.minScale) newScale = config.minScale;
            if (newScale > config.maxScale) newScale = config.maxScale;

            const ratio = newScale / state.scale;
            state.pointX = mouseX - (mouseX - state.pointX) * ratio;
            state.pointY = mouseY - (mouseY - state.pointY) * ratio;
            state.scale = newScale;

            updateTransform();
        }, { passive: false });

        // Pan with left mouse button
        function startPan(e) {
            if (e.button !== 0) return;
            e.preventDefault();
            state.panning = true;
            state.startX = e.clientX - state.pointX;
            state.startY = e.clientY - state.pointY;
            svg.style.cursor = 'grabbing';
        }

        function pan(e) {
            if (!state.panning) return;
            e.preventDefault();
            state.pointX = e.clientX - state.startX;
            state.pointY = e.clientY - state.startY;
            updateTransform();
        }

        function endPan(e) {
            state.panning = false;
            svg.style.cursor = 'grab';
        }

        svg.addEventListener('mousedown', startPan);
        window.addEventListener('mousemove', pan);
        window.addEventListener('mouseup', endPan);
        svg.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                state.panning = true;
                state.startX = e.touches[0].clientX - state.pointX;
                state.startY = e.touches[0].clientY - state.pointY;
            }
        }, {passive: false});
        window.addEventListener('touchmove', (e) => {
            if (!state.panning || e.touches.length !== 1) return;
            e.preventDefault();
            state.pointX = e.touches[0].clientX - state.startX;
            state.pointY = e.touches[0].clientY - state.startY;
            updateTransform();
        }, {passive: false});
        window.addEventListener('touchend', endPan);

        function updateTransform() {
            viewport.style.transform = \`translate(\${state.pointX}px, \${state.pointY}px) scale(\${state.scale})\`;
        }
        window.resetView = function() {
            state = {
                scale: 1,
                panning: false,
                pointX: 0,
                pointY: 0,
                startX: 0,
                startY: 0
            };
            updateTransform();
        }

        window.savePDF = async function() {
            const { ipcRenderer } = require('electron');

            const pdfBtn = document.getElementById('pdfBtn');
            const originalText = pdfBtn.textContent;
            pdfBtn.textContent = 'Saving...';
            pdfBtn.disabled = true;

            // Hide UI overlay for PDF
            const overlay = document.querySelector('.ui-overlay');
            overlay.style.display = 'none';

            // Hide the normal view
            svgWrapper.style.display = 'none';

            // Create a clean PDF container with the SVG at proper size
            const pdfContainer = document.createElement('div');
            pdfContainer.id = 'pdf-export-container';
            pdfContainer.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${isDarkMode ? '#1a1a1a' : '#f0f0f0'};';

            // Clone the SVG
            const svgClone = mermaidSvg.cloneNode(true);

            // Get viewport dimensions
            const pageWidth = window.innerWidth;
            const pageHeight = window.innerHeight;

            // Get SVG natural dimensions
            const viewBox = mermaidSvg.viewBox?.baseVal;
            const naturalWidth = viewBox?.width || parseFloat(mermaidSvg.getAttribute('width')) || 800;
            const naturalHeight = viewBox?.height || parseFloat(mermaidSvg.getAttribute('height')) || 600;

            // Calculate size to fit 85% of page while maintaining aspect ratio
            const maxWidth = pageWidth * 0.85;
            const maxHeight = pageHeight * 0.85;
            const scale = Math.min(maxWidth / naturalWidth, maxHeight / naturalHeight);

            const finalWidth = naturalWidth * scale;
            const finalHeight = naturalHeight * scale;

            // Set SVG to calculated size (not using CSS transform)
            svgClone.setAttribute('width', finalWidth);
            svgClone.setAttribute('height', finalHeight);
            svgClone.style.maxWidth = 'none';
            svgClone.style.width = finalWidth + 'px';
            svgClone.style.height = finalHeight + 'px';

            pdfContainer.appendChild(svgClone);
            document.body.appendChild(pdfContainer);

            // Small delay to ensure rendering
            await new Promise(resolve => setTimeout(resolve, 200));

            // Request PDF export from main process
            ipcRenderer.send('mermaid-export-pdf');

            // Listen for result
            ipcRenderer.once('mermaid-pdf-result', (event, result) => {
                // Remove PDF container and restore normal view
                pdfContainer.remove();
                svgWrapper.style.display = '';
                overlay.style.display = 'block';

                if (result.success) {
                    pdfBtn.textContent = 'Saved!';
                } else if (result.canceled) {
                    pdfBtn.textContent = originalText;
                    pdfBtn.disabled = false;
                    return;
                } else {
                    pdfBtn.textContent = 'Error!';
                }
                setTimeout(() => {
                    pdfBtn.textContent = originalText;
                    pdfBtn.disabled = false;
                }, 1500);
            });
        }
    </script>
</body>
</html>`;

  // Write temp HTML file
  fs.writeFileSync(tempHtmlPath, htmlContent);

  // Load the HTML file
  popupWindow.loadFile(tempHtmlPath);

  // Clean up temp file after window closes
  popupWindow.on('closed', () => {
    try {
      if (fs.existsSync(tempHtmlPath)) {
        fs.unlinkSync(tempHtmlPath);
      }
    } catch (err) {
      console.error('Error cleaning up temp file:', err);
    }
  });

  // Handle PDF export request from this popup window
  ipcMain.once('mermaid-export-pdf', async (event) => {
    try {
      // Generate PDF from current window view
      const pdfData = await popupWindow.webContents.printToPDF({
        printBackground: true,
        landscape: true,
        pageSize: 'A4',
        margins: { top: 0, bottom: 0, left: 0, right: 0 }
      });

      // Show save dialog
      const result = await dialog.showSaveDialog(popupWindow, {
        title: 'Save Mermaid Diagram as PDF',
        defaultPath: path.join(os.homedir(), 'mermaid-diagram.pdf'),
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
      });

      if (!result.canceled && result.filePath) {
        fs.writeFileSync(result.filePath, pdfData);
        popupWindow.webContents.send('mermaid-pdf-result', { success: true });
      } else {
        popupWindow.webContents.send('mermaid-pdf-result', { canceled: true });
      }
    } catch (err) {
      console.error('Mermaid PDF export error:', err);
      popupWindow.webContents.send('mermaid-pdf-result', { success: false, error: err.message });
    }
  });
});

// Handle OmniWare wireframe popup request
ipcMain.on('open-omniware-popup', (event, data) => {
  const { dslCode, isDarkMode } = data;

  const popupWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    backgroundColor: isDarkMode ? '#1a1a1a' : '#f8f6f1',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    title: 'OmniWare Wireframe',
    icon: path.join(__dirname, 'logo.ico')
  });

  popupWindow.setMenu(null);

  // Read the OmniWare library
  const omniwareJsPath = path.join(__dirname, 'omniwire', 'omniware.js');
  const omniwareJs = fs.readFileSync(omniwareJsPath, 'utf8');

  // Dark mode CSS overrides
  const { getOmniWareDarkCSS } = require('./omniware-config');
  const darkCSS = isDarkMode ? `<style>${getOmniWareDarkCSS(true)}</style>` : '';

  const escapedDsl = dslCode.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');

  const tempHtmlPath = path.join(os.tmpdir(), 'omnicore-temp-omniware.html');
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OmniWare Wireframe</title>
    <style>
        body, html {
            margin: 0;
            padding: 20px;
            background-color: ${isDarkMode ? '#2d2d2d' : '#f0ede6'};
            min-height: 100vh;
        }
        .toolbar {
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 1000;
            display: flex;
            gap: 8px;
        }
        .toolbar button {
            padding: 6px 14px;
            border: 1px solid ${isDarkMode ? '#555' : '#ccc'};
            background: ${isDarkMode ? '#333' : '#fff'};
            color: ${isDarkMode ? '#e0e0e0' : '#333'};
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
        }
        .toolbar button:hover {
            background: ${isDarkMode ? '#444' : '#eee'};
        }
    </style>
    ${darkCSS}
</head>
<body>
    <div class="toolbar">
        <button onclick="exportPDF()">Export PDF</button>
    </div>
    <div id="render-target"></div>

    <script>${omniwareJs}</script>
    <script>
        const { ipcRenderer } = require('electron');

        const dsl = \`${escapedDsl}\`;
        OmniWare.render(dsl, document.getElementById('render-target'));

        function exportPDF() {
            ipcRenderer.send('omniware-export-pdf');
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') window.close();
        });
    </script>
</body>
</html>`;

  fs.writeFileSync(tempHtmlPath, htmlContent, 'utf8');
  popupWindow.loadFile(tempHtmlPath);

  // Handle PDF export from popup
  ipcMain.once('omniware-export-pdf', async () => {
    try {
      const saveResult = await dialog.showSaveDialog(popupWindow, {
        title: 'Export Wireframe as PDF',
        defaultPath: 'wireframe.pdf',
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
      });
      if (!saveResult.canceled && saveResult.filePath) {
        const pdfData = await popupWindow.webContents.printToPDF({
          landscape: false,
          printBackground: true,
          margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 }
        });
        fs.writeFileSync(saveResult.filePath, pdfData);
      }
    } catch (err) {
      console.error('OmniWare PDF export error:', err);
    }
  });

  // Clean up temp file on close
  popupWindow.on('closed', () => {
    try { fs.unlinkSync(tempHtmlPath); } catch (e) { /* ignore */ }
  });
});

// Handle Image popup request
ipcMain.on('open-image-popup', (event, data) => {
  const { src, alt, isDarkMode } = data;

  const title = alt ? `Image — ${alt}` : 'Image Viewer';
  const popupWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    backgroundColor: isDarkMode ? '#1a1a1a' : '#f0f0f0',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    title,
    icon: path.join(__dirname, 'logo.ico')
  });

  popupWindow.setMenu(null);

  const tempHtmlPath = path.join(os.tmpdir(), 'omnicore-temp-image.html');
  const bg = isDarkMode ? '#1a1a1a' : '#f0f0f0';
  const uiBg = isDarkMode ? '#2d2d2d' : '#ffffff';
  const uiBorder = isDarkMode ? '#404040' : 'transparent';
  const textColor = isDarkMode ? '#e0e0e0' : '#333';
  const accentColor = isDarkMode ? '#3DBDC6' : '#279EA7';
  const accentHover = isDarkMode ? '#4FCDD6' : '#1f8089';
  const subTextColor = isDarkMode ? '#a0a0a0' : '#666';

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${alt || 'Image Viewer'}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%; height: 100%; overflow: hidden;
      background: ${bg};
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }
    #canvas {
      width: 100%; height: 100%;
      cursor: grab;
      overflow: hidden;
      position: relative;
      display: flex; align-items: center; justify-content: center;
    }
    #canvas:active { cursor: grabbing; }
    #viewport {
      will-change: transform;
      transform-origin: 0 0;
    }
    #viewport img {
      display: block;
      max-width: none;
      user-select: none;
      -webkit-user-drag: none;
    }
    .ui-overlay {
      position: absolute;
      top: 20px; left: 20px;
      background: ${uiBg};
      border: 1px solid ${uiBorder};
      padding: 14px 16px;
      border-radius: 10px;
      box-shadow: 0 4px 12px rgba(0,0,0,${isDarkMode ? '0.4' : '0.12'});
      z-index: 10;
      min-width: 160px;
    }
    .ui-overlay h1 {
      font-size: 14px;
      font-weight: 600;
      color: ${accentColor};
      margin-bottom: 6px;
    }
    .ui-overlay p {
      font-size: 11px;
      color: ${subTextColor};
      margin-bottom: 10px;
      line-height: 1.5;
    }
    .ui-overlay button {
      display: block;
      width: 100%;
      padding: 7px 10px;
      margin-bottom: 6px;
      background: ${accentColor};
      color: #fff;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.18s;
    }
    .ui-overlay button:last-child { margin-bottom: 0; }
    .ui-overlay button:hover { background: ${accentHover}; }
    .ui-overlay button:disabled { opacity: 0.55; cursor: not-allowed; background: ${accentColor}; }
    #zoom-label {
      display: block;
      text-align: center;
      font-size: 12px;
      color: ${textColor};
      margin-bottom: 8px;
      font-weight: 500;
    }
    .btn-secondary {
      background: ${isDarkMode ? '#3a3a3a' : '#e8e8e8'} !important;
      color: ${isDarkMode ? '#e0e0e0' : '#444'} !important;
    }
    .btn-secondary:hover { background: ${isDarkMode ? '#4a4a4a' : '#d4d4d4'} !important; }
    .divider {
      border: none;
      border-top: 1px solid ${isDarkMode ? '#404040' : '#e0e0e0'};
      margin: 8px 0;
    }
  </style>
</head>
<body>
  <div class="ui-overlay">
    <h1>Image Viewer</h1>
    <p>• Scroll to zoom (at cursor)<br>• Drag to pan</p>
    <span id="zoom-label">100%</span>
    <button onclick="resetView()">Reset View</button>
    <hr class="divider">
    <button id="btn-png" class="btn-secondary" onclick="saveImage('png')">⬇ Save as PNG</button>
    <button id="btn-jpg" class="btn-secondary" onclick="saveImage('jpeg')">⬇ Save as JPG</button>
  </div>
  <div id="canvas">
    <div id="viewport">
      <img id="the-img" src="${src}" alt="${alt || ''}">
    </div>
  </div>
  <script>
    const canvas = document.getElementById('canvas');
    const viewport = document.getElementById('viewport');
    const theImg = document.getElementById('the-img');
    const zoomLabel = document.getElementById('zoom-label');

    let state = { scale: 1, panning: false, pointX: 0, pointY: 0, startX: 0, startY: 0 };
    const MIN_SCALE = 0.05, MAX_SCALE = 20, ZOOM_SPEED = 0.12;

    function updateTransform() {
      viewport.style.transform = \`translate(\${state.pointX}px, \${state.pointY}px) scale(\${state.scale})\`;
      zoomLabel.textContent = Math.round(state.scale * 100) + '%';
    }

    // Fit image to window on load
    theImg.onload = function() {
      const cw = canvas.clientWidth, ch = canvas.clientHeight;
      const iw = theImg.naturalWidth, ih = theImg.naturalHeight;
      const scale = Math.min(cw * 0.9 / iw, ch * 0.9 / ih, 1);
      state.scale = scale;
      state.pointX = (cw - iw * scale) / 2;
      state.pointY = (ch - ih * scale) / 2;
      updateTransform();
    };

    // Wheel zoom toward cursor
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const delta = -Math.sign(e.deltaY);
      const factor = 1 + ZOOM_SPEED * delta;
      let newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, state.scale * factor));
      const ratio = newScale / state.scale;
      state.pointX = mouseX - (mouseX - state.pointX) * ratio;
      state.pointY = mouseY - (mouseY - state.pointY) * ratio;
      state.scale = newScale;
      updateTransform();
    }, { passive: false });

    // Pan
    canvas.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      e.preventDefault();
      state.panning = true;
      state.startX = e.clientX - state.pointX;
      state.startY = e.clientY - state.pointY;
    });
    window.addEventListener('mousemove', e => {
      if (!state.panning) return;
      e.preventDefault();
      state.pointX = e.clientX - state.startX;
      state.pointY = e.clientY - state.startY;
      updateTransform();
    });
    window.addEventListener('mouseup', () => { state.panning = false; });

    window.resetView = function() {
      const cw = canvas.clientWidth, ch = canvas.clientHeight;
      const iw = theImg.naturalWidth, ih = theImg.naturalHeight;
      const scale = Math.min(cw * 0.9 / iw, ch * 0.9 / ih, 1);
      state = { scale, panning: false, pointX: (cw - iw * scale) / 2, pointY: (ch - ih * scale) / 2, startX: 0, startY: 0 };
      updateTransform();
    };

    window.saveImage = function(format) {
      const { ipcRenderer } = require('electron');
      const btnId = format === 'jpeg' ? 'btn-jpg' : 'btn-png';
      const btn = document.getElementById(btnId);
      const origText = btn.textContent;
      btn.textContent = 'Saving…';
      btn.disabled = true;

      const offscreen = document.createElement('canvas');
      offscreen.width = theImg.naturalWidth;
      offscreen.height = theImg.naturalHeight;
      const ctx = offscreen.getContext('2d');
      if (format === 'jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, offscreen.width, offscreen.height);
      }
      ctx.drawImage(theImg, 0, 0);
      const dataUrl = offscreen.toDataURL(format === 'jpeg' ? 'image/jpeg' : 'image/png', 0.95);

      ipcRenderer.send('image-popup-save', { dataUrl, format });
      ipcRenderer.once('image-popup-save-result', (_, result) => {
        if (result.success) {
          btn.textContent = 'Saved!';
          setTimeout(() => { btn.textContent = origText; btn.disabled = false; }, 1500);
        } else if (result.canceled) {
          btn.textContent = origText;
          btn.disabled = false;
        } else {
          btn.textContent = 'Error!';
          setTimeout(() => { btn.textContent = origText; btn.disabled = false; }, 1500);
        }
      });
    };
  </script>
</body>
</html>`;

  fs.writeFileSync(tempHtmlPath, htmlContent, 'utf8');
  popupWindow.loadFile(tempHtmlPath);
  popupWindow.on('closed', () => {
    try { fs.unlinkSync(tempHtmlPath); } catch (e) { /* ignore */ }
  });
});

// Handle image save request from image popup
ipcMain.on('image-popup-save', async (event, { dataUrl, format }) => {
  const ext = format === 'jpeg' ? 'jpg' : 'png';
  const filterName = format === 'jpeg' ? 'JPEG Image' : 'PNG Image';
  const win = BrowserWindow.fromWebContents(event.sender);

  try {
    const result = await dialog.showSaveDialog(win, {
      defaultPath: `image.${ext}`,
      filters: [{ name: filterName, extensions: [ext] }]
    });

    if (result.canceled) {
      event.reply('image-popup-save-result', { canceled: true });
      return;
    }

    const base64 = dataUrl.split(',')[1];
    const buffer = Buffer.from(base64, 'base64');
    fs.writeFileSync(result.filePath, buffer);
    event.reply('image-popup-save-result', { success: true });
  } catch (err) {
    event.reply('image-popup-save-result', { success: false, error: err.message });
  }
});

// Handle Table popup request
ipcMain.on('open-table-popup', (event, data) => {
  const { tableData, isDarkMode } = data;

  // Create popup window
  const popupWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    title: 'Interactive Table - Sort, Filter, Export',
    icon: path.join(__dirname, 'logo.ico')
  });

  popupWindow.setMenu(null);

  // Write a temporary HTML file in system temp directory
  const tempHtmlPath = path.join(os.tmpdir(), 'omnicore-temp-table.html');

  // Read Tabulator files from local directory
  const tabulatorJsPath = path.join(__dirname, 'libs', 'tabulator', 'tabulator.min.js');
  const tabulatorCssPath = path.join(__dirname, 'libs', 'tabulator', 'tabulator.min.css');

  const tabulatorJs = fs.readFileSync(tabulatorJsPath, 'utf8');
  const tabulatorCss = fs.readFileSync(tabulatorCssPath, 'utf8');

  // Create HTML with embedded Tabulator
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Interactive Table</title>
    <style>
        ${tabulatorCss}

        /* Custom theme to match app colors */
        body, html {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            background-color: ${isDarkMode ? '#1a1a1a' : '#f5f5f5'};
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        .container {
            display: flex;
            flex-direction: column;
            height: 100vh;
            padding: 20px;
            box-sizing: border-box;
        }

        .header {
            background: ${isDarkMode ? '#2d2d2d' : 'white'};
            padding: 20px;
            border-radius: 8px 8px 0 0;
            box-shadow: 0 2px 4px rgba(0,0,0,${isDarkMode ? '0.3' : '0.1'});
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0;
            border: 1px solid ${isDarkMode ? '#404040' : 'transparent'};
            border-bottom: none;
        }

        h1 {
            margin: 0;
            font-size: 20px;
            color: ${isDarkMode ? '#3DBDC6' : '#279EA7'};
        }

        .controls {
            display: flex;
            gap: 10px;
        }

        button {
            padding: 10px 16px;
            background-color: ${isDarkMode ? '#3DBDC6' : '#279EA7'};
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
            font-size: 13px;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        button:hover {
            background-color: ${isDarkMode ? '#4FCDD6' : '#1f8089'};
            transform: translateY(-1px);
            box-shadow: 0 2px 8px rgba(${isDarkMode ? '61, 189, 198' : '39, 158, 167'}, 0.3);
        }

        button:active {
            transform: translateY(0);
        }

        .table-wrapper {
            flex: 1;
            background: ${isDarkMode ? '#242424' : 'white'};
            border-radius: 0 0 8px 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,${isDarkMode ? '0.3' : '0.1'});
            overflow: hidden;
            display: flex;
            flex-direction: column;
            border: 1px solid ${isDarkMode ? '#404040' : 'transparent'};
            border-top: none;
        }

        #data-table {
            flex: 1;
        }

        .info {
            padding: 12px 20px;
            background: ${isDarkMode ? '#2d2d2d' : '#e8e8e8'};
            color: ${isDarkMode ? '#a0a0a0' : '#5a6b7d'};
            font-size: 13px;
            border-bottom: 1px solid ${isDarkMode ? '#404040' : '#d0d0d0'};
        }

        /* Tabulator theme customization */
        .tabulator {
            font-size: 13px;
            border: none;
            background-color: ${isDarkMode ? '#242424' : 'white'};
            color: ${isDarkMode ? '#e8e8e8' : '#1F3244'};
        }

        .tabulator .tabulator-header {
            background-color: #1F3244;
            color: ${isDarkMode ? '#3DBDC6' : '#279EA7'};
            border: none;
        }

        .tabulator .tabulator-header .tabulator-col {
            background-color: #1F3244;
            border-right: 1px solid #3a4a5c;
        }

        .tabulator .tabulator-header .tabulator-col .tabulator-col-content {
            padding: 12px;
        }

        .tabulator .tabulator-header .tabulator-col .tabulator-col-title {
            color: ${isDarkMode ? '#3DBDC6' : '#279EA7'};
            font-weight: 600;
        }

        .tabulator .tabulator-header .tabulator-col.tabulator-sortable:hover {
            background-color: #2a3a4c;
        }

        .tabulator .tabulator-tableholder .tabulator-table .tabulator-row {
            background-color: ${isDarkMode ? '#242424' : 'white'};
            color: ${isDarkMode ? '#e8e8e8' : '#1F3244'};
            border-bottom: 1px solid ${isDarkMode ? '#404040' : '#d0d0d0'};
        }

        .tabulator .tabulator-tableholder .tabulator-table .tabulator-row:hover {
            background-color: ${isDarkMode ? '#2d2d2d' : '#f5f5f5'};
        }

        .tabulator .tabulator-tableholder .tabulator-table .tabulator-row .tabulator-cell {
            padding: 10px 12px;
            border-right: 1px solid ${isDarkMode ? '#404040' : '#e8e8e8'};
        }

        .tabulator .tabulator-footer {
            background-color: ${isDarkMode ? '#2d2d2d' : '#f5f5f5'};
            border-top: 2px solid ${isDarkMode ? '#404040' : '#d0d0d0'};
            padding: 8px;
            color: ${isDarkMode ? '#e8e8e8' : '#1F3244'};
        }

        .tabulator .tabulator-footer .tabulator-page {
            background-color: ${isDarkMode ? '#3DBDC6' : '#279EA7'};
            color: white;
            border: none;
        }

        .tabulator .tabulator-footer .tabulator-page:hover {
            background-color: ${isDarkMode ? '#4FCDD6' : '#1f8089'};
        }

        .tabulator .tabulator-footer .tabulator-page.active {
            background-color: #1F3244;
        }

        /* Header filter styling */
        .tabulator .tabulator-header-filter input {
            border: 1px solid #d0d0d0;
            padding: 4px 8px;
            border-radius: 4px;
            background: white;
            color: #1F3244;
        }

        .tabulator .tabulator-header-filter input:focus {
            border-color: #279EA7;
            outline: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Interactive Table Viewer</h1>
            <div class="controls">
                <button onclick="clearFilters()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                    Clear Filters
                </button>
                <button onclick="exportCSV()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    Export CSV
                </button>
                <button onclick="exportJSON()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    Export JSON
                </button>
            </div>
        </div>
        <div class="table-wrapper">
            <div class="info">
                <strong>Tips:</strong> Click column headers to sort • Type in filter boxes to search • Use pagination at bottom • Export filtered data
            </div>
            <div id="data-table"></div>
        </div>
    </div>

    <script>
        ${tabulatorJs}

        // Initialize Tabulator
        const tableData = ${JSON.stringify(tableData)};

        const table = new Tabulator("#data-table", {
            data: tableData.data,
            columns: tableData.columns,
            layout: "fitColumns",
            pagination: true,
            paginationSize: 50,
            paginationSizeSelector: [25, 50, 100, 200, true],
            paginationCounter: "rows",
            movableColumns: true,
            resizableColumns: true,
            responsiveLayout: "collapse",
            headerFilterLiveFilterDelay: 300,
            initialSort: [],
            height: "100%"
        });

        // Export functions
        function exportCSV() {
            table.download("csv", "table-export.csv", {bom: true});
        }

        function exportJSON() {
            table.download("json", "table-export.json");
        }

        function clearFilters() {
            table.clearHeaderFilter();
        }

        // Keyboard shortcut
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                window.close();
            }
        });
    </script>
</body>
</html>`;

  // Write temp HTML file
  fs.writeFileSync(tempHtmlPath, htmlContent);

  // Load the HTML file
  popupWindow.loadFile(tempHtmlPath);

  // Clean up temp file after window closes
  popupWindow.on('closed', () => {
    try {
      if (fs.existsSync(tempHtmlPath)) {
        fs.unlinkSync(tempHtmlPath);
      }
    } catch (err) {
      console.error('Error cleaning up temp file:', err);
    }
  });
});

// ============================================
// COMMAND LINE HANDLING
// ============================================

function handleFileArgument(argv) {
  log('handleFileArgument called with argv:', argv);
  log('app.isPackaged:', app.isPackaged);

  // Find the file path in argv - it should be a .md file
  // Skip the executable path and any electron/chromium flags
  let filePath = null;

  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    // Skip flags (starting with --)
    if (arg.startsWith('--')) {
      continue;
    }
    // Skip '.' (dev mode current directory)
    if (arg === '.') {
      continue;
    }
    // Check if it's a file path
    if (fs.existsSync(arg)) {
      const ext = path.extname(arg).toLowerCase();
      if (['.md', '.markdown', '.mdown', '.mkd', '.mkdn', '.mmd', '.mermaid', '.ow'].includes(ext)) {
        filePath = arg;
        break;
      }
    }
  }

  log('Extracted file path:', filePath);

  if (filePath) {
    const ext = path.extname(filePath).toLowerCase();
    log('File extension:', ext);
    fileToOpen = filePath;
    log('Valid markdown file, setting fileToOpen:', fileToOpen);
    return true;
  } else {
    log('No valid markdown file found in arguments');
  }
  return false;
}

// Check for file argument on first launch
log('Initial process.argv:', process.argv);
handleFileArgument(process.argv);

ipcMain.on('request-open-file', (event, data) => {
  const { filePath } = data;
  if (filePath && fs.existsSync(filePath)) {
    openFile(filePath);
  }
});

// ============================================
// SINGLE INSTANCE LOCK & APP LIFECYCLE
// ============================================

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // User opened a file while app is running
    log('Second instance detected, commandLine:', commandLine);

    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();

      // Handle the file from second instance - send to renderer for unsaved changes check
      if (handleFileArgument(commandLine)) {
        log('File to open from second instance:', fileToOpen);

        // Ensure webContents is ready before sending IPC
        if (mainWindow.webContents.isLoading()) {
          log('WebContents is loading, waiting for did-finish-load');
          mainWindow.webContents.once('did-finish-load', () => {
            log('Sending external-file-open-request after load');
            mainWindow.webContents.send('external-file-open-request', { filePath: fileToOpen });
            fileToOpen = null;
          });
        } else {
          log('Sending external-file-open-request immediately');
          mainWindow.webContents.send('external-file-open-request', { filePath: fileToOpen });
          fileToOpen = null;
        }
      } else {
        log('No valid file found in command line arguments');
      }
    }
  });

  app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ============================================
// Auto-Updater Configuration
// ============================================

// Only configure auto-updater if it's available
// Portable .exe detection: electron-builder sets PORTABLE_EXECUTABLE_DIR for portable builds.
const isPortable = !!process.env.PORTABLE_EXECUTABLE_DIR;
let downloadedUpdatePath = null; // path to downloaded installer, set in update-downloaded event

if (autoUpdater) {
  // Configure auto-updater
  autoUpdater.autoDownload = false; // Don't download automatically, let user decide
  autoUpdater.autoInstallOnAppQuit = !isPortable; // Pointless for portable builds

  // Auto-updater event handlers
  autoUpdater.on('checking-for-update', () => {
    log('Auto-updater: Checking for updates...');
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('update-status', { status: 'checking' });
    }
  });

  autoUpdater.on('update-available', (info) => {
    log('Auto-updater: Update available:', info.version, isPortable ? '(portable)' : '(installer)');
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('update-status', {
        status: 'available',
        version: info.version,
        releaseNotes: info.releaseNotes,
        releaseDate: info.releaseDate
      });
    }
  });

  autoUpdater.on('update-not-available', (info) => {
    log('Auto-updater: No updates available. Current version:', app.getVersion());
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('update-status', {
        status: 'not-available',
        currentVersion: app.getVersion()
      });
    }
  });

  autoUpdater.on('download-progress', (progressObj) => {
    log(`Auto-updater: Download progress: ${progressObj.percent.toFixed(1)}%`);
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('update-status', {
        status: 'downloading',
        percent: progressObj.percent,
        bytesPerSecond: progressObj.bytesPerSecond,
        transferred: progressObj.transferred,
        total: progressObj.total
      });
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    log('Auto-updater: Update downloaded:', info.version, info.downloadedFile || '');
    downloadedUpdatePath = info.downloadedFile || null;
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('update-status', {
        status: 'downloaded',
        version: info.version
      });
    }
  });

  autoUpdater.on('error', (err) => {
    // Silently log errors - don't show to user
    // Common errors: no release on GitHub, network issues, etc.
    log('Auto-updater error (silent):', err.message);
  });
}

// IPC handlers for update actions
ipcMain.on('check-for-updates', () => {
  log('Manual update check requested');
  if (!autoUpdater) {
    log('Auto-updater not available');
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('update-status', {
        status: 'error',
        error: 'Auto-updater not available'
      });
    }
    return;
  }
  if (app.isPackaged) {
    autoUpdater.checkForUpdates();
  } else {
    log('Skipping update check in development mode');
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('update-status', {
        status: 'dev-mode',
        message: 'Update check is disabled in development mode'
      });
    }
  }
});

ipcMain.on('download-update', () => {
  log('Download update requested');
  if (autoUpdater) {
    autoUpdater.downloadUpdate();
  }
});

ipcMain.on('install-update', () => {
  log('Install update requested');
  if (!autoUpdater) return;

  if (isPortable && downloadedUpdatePath) {
    // Portable .exe: quitAndInstall() doesn't work.
    // Launch the downloaded NSIS installer via a temp batch script (waits for app to exit first).
    try {
      const batchPath = path.join(os.tmpdir(), 'omnicore-update.bat');
      const batch = [
        '@echo off',
        'timeout /t 2 /nobreak > nul',
        `start "" "${downloadedUpdatePath}"`,
        'del "%~f0"'
      ].join('\r\n') + '\r\n';
      fs.writeFileSync(batchPath, batch, 'utf8');
      const { exec } = require('child_process');
      exec(`start /min "" cmd /c "${batchPath}"`);
      log('Portable update: batch script launched, quitting app');
      app.quit();
    } catch (err) {
      log('Portable update batch failed:', err.message);
    }
  } else if (!isPortable) {
    autoUpdater.quitAndInstall(false, true);
  }
});

// Check for updates after app is ready (only in production)
function checkForUpdatesOnStartup() {
  if (app.isPackaged && autoUpdater) {
    // Wait a few seconds after app starts before checking for updates
    setTimeout(() => {
      log('Checking for updates on startup...');
      autoUpdater.checkForUpdates().catch(err => {
        log('Error checking for updates:', err.message);
      });
    }, 5000);
  }
}

// Call update check after window is ready
app.on('ready', () => {
  checkForUpdatesOnStartup();
});
