import * as vscode from 'vscode';
import * as path from 'path';
import { isMarkdownFile } from './fileHelpers.js';
import { ExportService } from './exportService.js';
import { PopupPanelManager } from './popupPanelManager.js';
import { RecentFilesProvider } from './recentFilesProvider.js';
import { createContentMessage, getWebviewHtml, handleWebviewMessage, isDarkTheme } from './webviewContent.js';

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

    this.panel.webview.html = getWebviewHtml(this.panel.webview, this.extensionUri);
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
        this.panel?.webview.postMessage({ type: 'theme-changed', isDark: isDarkTheme(theme.kind) });
      })
    );

    // Handle messages from webview
    this.panel.webview.onDidReceiveMessage(msg =>
      handleWebviewMessage(msg, this.popupManager, this.exportService, async uri => {
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
      })
    );

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

    this.panel.webview.postMessage(createContentMessage(this.currentDocument));

    this.updateTitle();
  }

  dispose(): void {
    this.panel?.dispose();
    this.disposables.forEach(d => d.dispose());
  }
}
