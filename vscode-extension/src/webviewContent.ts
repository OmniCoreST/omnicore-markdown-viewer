import * as vscode from 'vscode';
import * as path from 'path';
import { prepareContent } from './fileHelpers.js';
import { ExportService } from './exportService.js';
import { PopupPanelManager } from './popupPanelManager.js';

export function isDarkTheme(kind: vscode.ColorThemeKind = vscode.window.activeColorTheme.kind): boolean {
  return kind === vscode.ColorThemeKind.Dark || kind === vscode.ColorThemeKind.HighContrast;
}

export function createContentMessage(document: vscode.TextDocument) {
  return {
    type: 'content-updated',
    content: prepareContent(document.getText(), document.fileName),
    filePath: document.fileName,
    isDark: isDarkTheme()
  };
}

/**
 * Handles messages posted by the preview webview. `openFile` decides how a
 * linked local file is shown (the side preview follows the text editor, the
 * custom editor opens the file with its associated editor).
 */
export async function handleWebviewMessage(
  msg: any,
  popupManager: PopupPanelManager,
  exportService: ExportService,
  openFile: (uri: vscode.Uri) => Thenable<unknown>
): Promise<void> {
  switch (msg.type) {
    case 'open-mermaid-popup':
      popupManager.openMermaidPopup(msg.svgContent, msg.isDarkMode);
      break;
    case 'open-omniware-popup':
      popupManager.openOmniWarePopup(msg.dslCode, msg.isDarkMode);
      break;
    case 'open-table-popup':
      popupManager.openTablePopup(msg.tableData, msg.isDarkMode);
      break;
    case 'export-pdf':
      await exportService.savePdf(msg.data, msg.fileName || 'document.pdf');
      break;
    case 'export-word':
      await exportService.saveWord(msg.htmlContent, msg.fileName || 'document.docx');
      break;
    case 'open-external':
      if (msg.url) {
        vscode.env.openExternal(vscode.Uri.parse(msg.url));
      }
      break;
    case 'open-file':
      if (msg.filePath) {
        // Resolve relative paths against the current document's directory
        let resolvedPath = msg.filePath;
        if (msg.basePath && !path.isAbsolute(msg.filePath)) {
          resolvedPath = path.resolve(path.dirname(msg.basePath), msg.filePath);
        }
        try {
          const uri = vscode.Uri.file(resolvedPath);
          await openFile(uri);
        } catch {
          vscode.window.showWarningMessage(`Could not open file: ${resolvedPath}`);
        }
      }
      break;
    case 'reveal-in-explorer':
      if (msg.filePath) {
        vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(msg.filePath));
      }
      break;
  }
}

export function getWebviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const media = (...pathSegments: string[]) =>
    webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', ...pathSegments));
  const nonce = getNonce();
  const csp = webview.cspSource;

  // Library URIs
  const markedUri = media('libs', 'marked.min.js');
  const mermaidUri = media('libs', 'mermaid.min.js');
  const dompurifyUri = media('libs', 'dompurify.min.js');
  const omniwareUri = media('omniwire', 'omniware.js');
  const mainJsUri = media('webview', 'main.js');
  const stylesUri = media('webview', 'styles.css');
  const mermaidConfigUri = media('webview', 'mermaid-config.js');
  const omniwareConfigUri = media('webview', 'omniware-config.js');

  // PrismJS (pre-built bundle with all languages, avoids dynamic loading in webview)
  const prismBundleUri = media('libs', 'prismjs', 'prism-bundle.js');
  const prismThemeUri = media('libs', 'prismjs', 'themes', 'prism-solarizedlight.css');

  // Font URIs
  const fontRegularUri = media('fonts', 'FiraCode-Regular.ttf');
  const fontBoldUri = media('fonts', 'FiraCode-Bold.ttf');
  const fontLightUri = media('fonts', 'FiraCode-Light.ttf');
  const fontMediumUri = media('fonts', 'FiraCode-Medium.ttf');
  const fontSemiBoldUri = media('fonts', 'FiraCode-SemiBold.ttf');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${csp} 'unsafe-eval'; style-src ${csp} 'unsafe-inline' https://fonts.googleapis.com; font-src ${csp} https://fonts.gstatic.com; img-src ${csp} https: data:;">
<link rel="stylesheet" href="${stylesUri}">
<link rel="stylesheet" href="${prismThemeUri}">
<style>
@font-face { font-family: 'Fira Code Local'; src: url('${fontRegularUri}') format('truetype'); font-weight: 400; }
@font-face { font-family: 'Fira Code Local'; src: url('${fontBoldUri}') format('truetype'); font-weight: 700; }
@font-face { font-family: 'Fira Code Local'; src: url('${fontLightUri}') format('truetype'); font-weight: 300; }
@font-face { font-family: 'Fira Code Local'; src: url('${fontMediumUri}') format('truetype'); font-weight: 500; }
@font-face { font-family: 'Fira Code Local'; src: url('${fontSemiBoldUri}') format('truetype'); font-weight: 600; }
</style>
</head>
<body>
<!-- Toolbar -->
<div class="preview-toolbar">
  <div class="toolbar-left">
    <button id="zoomOut" title="Zoom Out">-</button>
    <button id="zoomReset" title="Reset Zoom">100%</button>
    <button id="zoomIn" title="Zoom In">+</button>
  </div>
  <div class="toolbar-right">
    <button id="searchToggle" title="Search (Ctrl+F)">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>
    </button>
    <button id="tocToggle" title="Table of Contents">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line>
        <line x1="8" y1="18" x2="21" y2="18"></line>
        <line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line>
        <line x1="3" y1="18" x2="3.01" y2="18"></line>
      </svg>
    </button>
    <button id="exportPdfBtn" title="Export PDF">PDF</button>
    <button id="exportWordBtn" title="Export Word">DOCX</button>
  </div>
</div>

<!-- Search Panel -->
<div id="searchPanel" class="search-panel">
  <input type="text" id="searchInput" placeholder="Search..." />
  <span id="searchCounter" class="search-counter">0 of 0</span>
  <button id="searchPrev" class="search-btn" disabled>&#9650;</button>
  <button id="searchNext" class="search-btn" disabled>&#9660;</button>
  <button id="searchClose" class="search-btn">&#10005;</button>
</div>

<!-- TOC Panel -->
<div id="tocPanel" class="toc-panel">
  <div class="toc-header">
    <span>Table of Contents</span>
    <button id="tocClose" class="toc-close-btn">&#10005;</button>
  </div>
  <div id="tocList" class="toc-list"></div>
</div>

<!-- Context Menu -->
<div id="contextMenu" class="context-menu">
  <div id="ctxCopy" class="ctx-item">Copy</div>
  <div id="ctxSelectAll" class="ctx-item">Select All</div>
</div>

<!-- Loading Screen -->
<div id="loadingScreen" class="loading-screen">
  <div class="loading-spinner"></div>
  <div class="loading-text">Rendering...</div>
</div>

<!-- Notification Toast -->
<div id="notificationToast" class="notification-toast">
  <span id="notificationMessage"></span>
</div>

<!-- Content Area -->
<div id="contentWrapper" class="content-wrapper">
  <div id="viewer" class="markdown-body"></div>
</div>

<script src="${markedUri}"></script>
<script src="${dompurifyUri}"></script>
<script src="${mermaidUri}"></script>
<script src="${omniwareUri}"></script>
<script src="${prismBundleUri}"></script>
<script src="${mermaidConfigUri}"></script>
<script src="${omniwareConfigUri}"></script>
<script src="${mainJsUri}"></script>
</body>
</html>`;
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
