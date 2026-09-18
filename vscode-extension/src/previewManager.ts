import * as vscode from 'vscode';
import * as path from 'path';
import { isMarkdownFile } from './fileHelpers.js';
import { ExportService } from './exportService.js';
import { ExportFormat, UPDATE_DEBOUNCE_MS } from './markdownEditorProvider.js';
import { PopupPanelManager } from './popupPanelManager.js';
import { RecentFilesProvider } from './recentFilesProvider.js';
import {
  createContentMessage, documentFolder, getWebviewHtml, handleWebviewMessage, isDarkTheme, localResourceRoots
} from './webviewContent.js';

export class PreviewManager {
  private panel: vscode.WebviewPanel | undefined;
  private currentDocument: vscode.TextDocument | undefined;
  private disposables: vscode.Disposable[] = [];
  private popupManager: PopupPanelManager;
  private exportService: ExportService;
  private recentFilesProvider: RecentFilesProvider;
  private updateTimer: ReturnType<typeof setTimeout> | undefined;
  /** Scroll target / export request applied after the next render of that file. */
  private pendingFragment: { filePath: string; fragment: string } | undefined;
  private pendingExport: ExportFormat | undefined;
  private rendered = false;

  constructor(
    private extensionUri: vscode.Uri,
    exportService: ExportService,
    recentFilesProvider: RecentFilesProvider
  ) {
    this.exportService = exportService;
    this.popupManager = new PopupPanelManager(extensionUri, exportService);
    this.recentFilesProvider = recentFilesProvider;
  }

  /** True while the preview panel is the active editor. */
  isActive(): boolean {
    return !!this.panel?.active;
  }

  /** Asks the preview to export the document it shows. */
  requestExport(format: ExportFormat): boolean {
    if (!this.panel) return false;
    if (this.rendered) {
      this.panel.webview.postMessage({ type: 'request-export', format });
    } else {
      this.pendingExport = format;
    }
    return true;
  }

  async openPreview(viewColumn: vscode.ViewColumn = vscode.ViewColumn.Beside, exportFormat?: ExportFormat): Promise<void> {
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

    const switching = this.currentDocument?.uri.toString() !== document.uri.toString();
    this.currentDocument = document;
    this.recentFilesProvider.addFile(document.fileName);

    if (this.panel) {
      if (switching) this.rendered = false;
      if (exportFormat) this.pendingExport = exportFormat;
      this.panel.reveal(viewColumn);
      this.updateContent();
      return;
    }

    this.rendered = false;
    this.pendingExport = exportFormat;
    this.panel = vscode.window.createWebviewPanel(
      'omnicorePreview',
      'Omnicore Preview',
      viewColumn,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: localResourceRoots(this.extensionUri, document)
      }
    );

    this.panel.webview.html = getWebviewHtml(this.panel.webview, this.extensionUri);
    this.updateContent();

    // Listen for document changes
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument(e => {
        if (this.currentDocument && e.document.uri.toString() === this.currentDocument.uri.toString()) {
          clearTimeout(this.updateTimer);
          this.updateTimer = setTimeout(() => this.updateContent(), UPDATE_DEBOUNCE_MS);
        }
      })
    );

    // Follow active editor
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor && isMarkdownFile(editor.document.fileName)) {
          if (this.currentDocument?.uri.toString() !== editor.document.uri.toString()) {
            this.rendered = false;
          }
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
        this.panel?.webview.postMessage({ type: 'theme-changed', isDark: isDarkTheme(theme.kind) });
      })
    );

    // Handle messages from webview
    this.panel.webview.onDidReceiveMessage(msg =>
      handleWebviewMessage(msg, {
        popupManager: this.popupManager,
        exportService: this.exportService,
        openFile: (uri, fragment) => this.openLinkedFile(uri, fragment),
        onRendered: filePath => this.onRendered(filePath)
      })
    );

    // Cleanup on dispose
    this.panel.onDidDispose(() => {
      clearTimeout(this.updateTimer);
      this.panel = undefined;
      this.rendered = false;
      this.pendingExport = undefined;
      this.pendingFragment = undefined;
      this.disposables.forEach(d => d.dispose());
      this.disposables = [];
    });
  }

  /** Linked markdown opens as text in the first column (the preview follows it); other files open normally. */
  private async openLinkedFile(uri: vscode.Uri, fragment: string): Promise<void> {
    if (!isMarkdownFile(uri.fsPath)) {
      await vscode.commands.executeCommand('vscode.open', uri);
      return;
    }
    if (fragment) {
      this.pendingFragment = { filePath: uri.fsPath, fragment };
    }
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
    if (fragment && this.rendered && this.currentDocument?.uri.toString() === uri.toString() && this.panel) {
      // Same document (already rendered): no new render will come, scroll now.
      this.pendingFragment = undefined;
      this.panel.webview.postMessage({ type: 'scroll-to', fragment });
    }
  }

  private onRendered(filePath: string): void {
    if (!this.panel || !this.currentDocument || filePath !== this.currentDocument.fileName) return;
    this.rendered = true;
    if (this.pendingFragment && this.pendingFragment.filePath === filePath) {
      this.panel.webview.postMessage({ type: 'scroll-to', fragment: this.pendingFragment.fragment });
      this.pendingFragment = undefined;
    }
    if (this.pendingExport) {
      this.panel.webview.postMessage({ type: 'request-export', format: this.pendingExport });
      this.pendingExport = undefined;
    }
  }

  private updateTitle(): void {
    if (this.panel && this.currentDocument) {
      const name = path.basename(this.currentDocument.fileName);
      this.panel.title = `Preview: ${name}`;
    }
  }

  /** Lets the webview load images from the followed document's folder (reloads the webview only if needed). */
  private updateResourceRoots(): void {
    if (!this.panel || !this.currentDocument || this.currentDocument.uri.scheme === 'untitled') return;
    const folder = documentFolder(this.currentDocument).toString();
    const roots = this.panel.webview.options.localResourceRoots ?? [];
    const covered = roots.some(root => {
      const r = root.toString().replace(/\/$/, '');
      return folder === r || folder.startsWith(r + '/');
    });
    if (!covered) {
      this.panel.webview.options = {
        ...this.panel.webview.options,
        localResourceRoots: localResourceRoots(this.extensionUri, this.currentDocument)
      };
    }
  }

  private updateContent(): void {
    if (!this.panel || !this.currentDocument) return;

    this.updateResourceRoots();
    this.panel.webview.postMessage(createContentMessage(this.currentDocument, this.panel.webview));

    this.updateTitle();
  }

  dispose(): void {
    this.panel?.dispose();
    this.disposables.forEach(d => d.dispose());
  }
}
