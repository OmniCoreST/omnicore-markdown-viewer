import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { prepareContent } from './fileHelpers.js';
import { ExportService } from './exportService.js';
import { PopupPanelManager } from './popupPanelManager.js';

export function isDarkTheme(kind: vscode.ColorThemeKind = vscode.window.activeColorTheme.kind): boolean {
  return kind === vscode.ColorThemeKind.Dark || kind === vscode.ColorThemeKind.HighContrast;
}

/** Folder that contains the document (relative image paths resolve against it). */
export function documentFolder(document: vscode.TextDocument): vscode.Uri {
  return document.uri.with({ path: path.posix.dirname(document.uri.path) });
}

/** Extension media + the document folder + every workspace folder. */
export function localResourceRoots(extensionUri: vscode.Uri, document?: vscode.TextDocument): vscode.Uri[] {
  const roots = [vscode.Uri.joinPath(extensionUri, 'media')];
  if (document && document.uri.scheme !== 'untitled') {
    roots.push(documentFolder(document));
  }
  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    roots.push(folder.uri);
  }
  return roots;
}

export function createContentMessage(document: vscode.TextDocument, webview: vscode.Webview) {
  const hasFolder = document.uri.scheme !== 'untitled';
  return {
    type: 'content-updated',
    content: prepareContent(document.getText(), document.fileName),
    filePath: document.fileName,
    isDark: isDarkTheme(),
    // Webview URIs used to show local images: relative paths resolve against
    // resourceBase, absolute paths against fileRoot.
    resourceBase: hasFolder ? webview.asWebviewUri(documentFolder(document)).toString() : '',
    fileRoot: webview.asWebviewUri(vscode.Uri.file('/')).toString()
  };
}

export interface WebviewMessageContext {
  popupManager: PopupPanelManager;
  exportService: ExportService;
  /** Shows a linked local file; `fragment` is the decoded `#part` of the link ('' if none). */
  openFile: (uri: vscode.Uri, fragment: string) => Thenable<unknown>;
  /** Called after the webview finished rendering a document. */
  onRendered?: (filePath: string) => void;
}

/** Local path of a link target, resolved against the linking document. */
function resolveLinkedPath(linkPath: string, basePath: string | undefined): string {
  const isDrivePath = /^[A-Za-z]:[\\/]/.test(linkPath);
  if (isDrivePath || (path.isAbsolute(linkPath) && fs.existsSync(linkPath))) {
    return linkPath;
  }
  if (path.isAbsolute(linkPath)) {
    // "/docs/x.md" as on GitHub: relative to the workspace (repository) root.
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
      const candidate = path.join(folder.uri.fsPath, linkPath);
      if (fs.existsSync(candidate)) return candidate;
    }
    return linkPath;
  }
  return basePath ? path.resolve(path.dirname(basePath), linkPath) : path.resolve(linkPath);
}

/**
 * Handles messages posted by the preview webview. `ctx.openFile` decides how a
 * linked local file is shown (the side preview follows the text editor, the
 * custom editor opens the file with its associated editor).
 */
export async function handleWebviewMessage(msg: any, ctx: WebviewMessageContext): Promise<void> {
  if (!msg || typeof msg.type !== 'string') return;
  switch (msg.type) {
    case 'open-mermaid-popup':
      ctx.popupManager.openMermaidPopup(msg.svgContent, msg.isDarkMode);
      break;
    case 'open-omniware-popup':
      ctx.popupManager.openOmniWarePopup(msg.dslCode, msg.isDarkMode, msg.filePath);
      break;
    case 'open-table-popup':
      ctx.popupManager.openTablePopup(msg.tableData, msg.isDarkMode);
      break;
    case 'export-pdf':
      await ctx.exportService.exportPdf(
        { html: String(msg.html || ''), omniwareCss: msg.omniwareCss, title: msg.title },
        msg.filePath,
        msg.fileName || 'document.pdf'
      );
      break;
    case 'export-word':
      await ctx.exportService.saveWord(msg.htmlContent, msg.fileName || 'document.docx', msg.filePath);
      break;
    case 'open-external':
      if (typeof msg.url === 'string' && /^(https?:|mailto:|tel:)/i.test(msg.url)) {
        vscode.env.openExternal(vscode.Uri.parse(msg.url, true));
      }
      break;
    case 'open-file': {
      if (typeof msg.path !== 'string' || !msg.path) break;
      const resolvedPath = resolveLinkedPath(msg.path, msg.basePath);
      if (!fs.existsSync(resolvedPath)) {
        vscode.window.showWarningMessage(`File not found: ${resolvedPath}`);
        break;
      }
      const uri = vscode.Uri.file(resolvedPath);
      if (fs.statSync(resolvedPath).isDirectory()) {
        vscode.commands.executeCommand('revealInExplorer', uri);
        break;
      }
      try {
        await ctx.openFile(uri, typeof msg.fragment === 'string' ? msg.fragment : '');
      } catch {
        vscode.window.showWarningMessage(`Could not open file: ${resolvedPath}`);
      }
      break;
    }
    case 'rendered':
      ctx.onRendered?.(msg.filePath);
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
  const csp = webview.cspSource;

  // Library URIs
  const markedUri = media('libs', 'marked.min.js');
  const mermaidUri = media('libs', 'mermaid.min.js');
  const dompurifyUri = media('libs', 'dompurify.min.js');
  const omniwareUri = media('omniwire', 'omniware.js');
  const mainJsUri = media('webview', 'main.js');
  const sharedJsUri = media('webview', 'markdown-shared.js');
  const emojiMapUri = media('webview', 'emoji-map.js');
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
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${csp} 'unsafe-eval'; style-src ${csp} 'unsafe-inline' https://fonts.googleapis.com; font-src ${csp} https://fonts.gstatic.com data:; img-src ${csp} https: data:; media-src ${csp} https: data:; connect-src ${csp};">
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
<script src="${sharedJsUri}"></script>
<script src="${emojiMapUri}"></script>
<script src="${mainJsUri}"></script>
</body>
</html>`;
}
