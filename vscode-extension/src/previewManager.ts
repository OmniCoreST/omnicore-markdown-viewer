import * as vscode from 'vscode';
import * as path from 'path';
import { isMarkdownFile, prepareContent } from './fileHelpers.js';
import { ExportService } from './exportService.js';
import { PopupPanelManager } from './popupPanelManager.js';
import { RecentFilesProvider } from './recentFilesProvider.js';

export class PreviewManager {
  private panel: vscode.WebviewPanel | undefined;
  private currentDocument: vscode.TextDocument | undefined;
  private disposables: vscode.Disposable[] = [];
  private popupManager: PopupPanelManager;
  private exportService: ExportService;
  private recentFilesProvider: RecentFilesProvider;

  constructor(
    private extensionUri: vscode.Uri,
    exportService: ExportService,
    recentFilesProvider: RecentFilesProvider
  ) {
    this.exportService = exportService;
    this.popupManager = new PopupPanelManager(extensionUri, exportService);
    this.recentFilesProvider = recentFilesProvider;
  }

  async openPreview(viewColumn: vscode.ViewColumn = vscode.ViewColumn.Beside): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active editor to preview.');
      return;
    }

    const document = editor.document;
    if (!isMarkdownFile(document.fileName)) {
      vscode.window.showWarningMessage('Not a supported file type.');
      return;
    }

    this.currentDocument = document;
    this.recentFilesProvider.addFile(document.fileName);

    if (this.panel) {
      this.panel.reveal(viewColumn);
      this.updateContent();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'omnicorePreview',
      'Omnicore Preview',
      viewColumn,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')]
      }
    );

    this.panel.webview.html = this.getWebviewHtml();
    this.updateContent();

    // Listen for document changes
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument(e => {
        if (this.currentDocument && e.document.uri.toString() === this.currentDocument.uri.toString()) {
          this.updateContent();
        }
      })
    );

    // Follow active editor
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor && isMarkdownFile(editor.document.fileName)) {
          this.currentDocument = editor.document;
          this.recentFilesProvider.addFile(editor.document.fileName);
          this.updateTitle();
          this.updateContent();
        }
      })
    );

    // Theme changes
    this.disposables.push(
      vscode.window.onDidChangeActiveColorTheme(theme => {
        const isDark = theme.kind === vscode.ColorThemeKind.Dark || theme.kind === vscode.ColorThemeKind.HighContrast;
        this.panel?.webview.postMessage({ type: 'theme-changed', isDark });
      })
    );

    // Handle messages from webview
    this.panel.webview.onDidReceiveMessage(msg => this.handleMessage(msg));

    // Cleanup on dispose
    this.panel.onDidDispose(() => {
      this.panel = undefined;
      this.disposables.forEach(d => d.dispose());
      this.disposables = [];
    });
  }

  private updateTitle(): void {
    if (this.panel && this.currentDocument) {
      const name = path.basename(this.currentDocument.fileName);
      this.panel.title = `Preview: ${name}`;
    }
  }

  private updateContent(): void {
    if (!this.panel || !this.currentDocument) return;

    const content = this.currentDocument.getText();
    const filePath = this.currentDocument.fileName;
    const prepared = prepareContent(content, filePath);

    const isDark = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark ||
                   vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.HighContrast;

    this.panel.webview.postMessage({
      type: 'content-updated',
      content: prepared,
      filePath: filePath,
      isDark: isDark
    });

    this.updateTitle();
  }

  private async handleMessage(msg: any): Promise<void> {
    switch (msg.type) {
      case 'open-mermaid-popup':
        this.popupManager.openMermaidPopup(msg.svgContent, msg.isDarkMode);
        break;
      case 'open-omniware-popup':
        this.popupManager.openOmniWarePopup(msg.dslCode, msg.isDarkMode);
        break;
      case 'open-table-popup':
        this.popupManager.openTablePopup(msg.tableData, msg.isDarkMode);
        break;
      case 'export-pdf':
        await this.exportService.savePdf(msg.data, msg.fileName || 'document.pdf');
        break;
      case 'export-word':
        await this.exportService.saveWord(msg.htmlContent, msg.fileName || 'document.docx');
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
            const doc = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
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

  private getMediaUri(...pathSegments: string[]): vscode.Uri {
    return this.panel!.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', ...pathSegments)
    );
  }

  private getWebviewHtml(): string {
    const webview = this.panel!.webview;
    const nonce = getNonce();
    const csp = webview.cspSource;

    // Library URIs
    const markedUri = this.getMediaUri('libs', 'marked.min.js');
    const mermaidUri = this.getMediaUri('libs', 'mermaid.min.js');
    const dompurifyUri = this.getMediaUri('libs', 'dompurify.min.js');
    const omniwareUri = this.getMediaUri('omniwire', 'omniware.js');
    const mainJsUri = this.getMediaUri('webview', 'main.js');
    const stylesUri = this.getMediaUri('webview', 'styles.css');
    const mermaidConfigUri = this.getMediaUri('webview', 'mermaid-config.js');
    const omniwareConfigUri = this.getMediaUri('webview', 'omniware-config.js');

    // PrismJS (pre-built bundle with all languages, avoids dynamic loading in webview)
    const prismBundleUri = this.getMediaUri('libs', 'prismjs', 'prism-bundle.js');
    const prismThemeUri = this.getMediaUri('libs', 'prismjs', 'themes', 'prism-solarizedlight.css');

    // Font URIs
    const fontRegularUri = this.getMediaUri('fonts', 'FiraCode-Regular.ttf');
    const fontBoldUri = this.getMediaUri('fonts', 'FiraCode-Bold.ttf');
    const fontLightUri = this.getMediaUri('fonts', 'FiraCode-Light.ttf');
    const fontMediumUri = this.getMediaUri('fonts', 'FiraCode-Medium.ttf');
    const fontSemiBoldUri = this.getMediaUri('fonts', 'FiraCode-SemiBold.ttf');

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

  dispose(): void {
    this.panel?.dispose();
    this.disposables.forEach(d => d.dispose());
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
