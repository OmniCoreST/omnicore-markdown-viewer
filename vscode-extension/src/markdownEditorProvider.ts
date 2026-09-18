import * as vscode from 'vscode';
import { ExportService } from './exportService.js';
import { PopupPanelManager } from './popupPanelManager.js';
import { RecentFilesProvider } from './recentFilesProvider.js';
import { createContentMessage, getWebviewHtml, handleWebviewMessage, isDarkTheme } from './webviewContent.js';

/**
 * Default editor for markdown / mermaid / omniware files: opens them directly
 * in the Omnicore viewer, one tab per file. "Omnicore: Open as Text" switches to the text editor.
 */
export class MarkdownEditorProvider implements vscode.CustomTextEditorProvider {
  static readonly viewType = 'omnicore.markdownEditor';

  static register(
    context: vscode.ExtensionContext,
    exportService: ExportService,
    recentFilesProvider: RecentFilesProvider
  ): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      MarkdownEditorProvider.viewType,
      new MarkdownEditorProvider(context.extensionUri, exportService, recentFilesProvider),
      { webviewOptions: { retainContextWhenHidden: true } }
    );
  }

  private readonly popupManager: PopupPanelManager;

  private constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly exportService: ExportService,
    private readonly recentFilesProvider: RecentFilesProvider
  ) {
    this.popupManager = new PopupPanelManager(extensionUri, exportService);
  }

  resolveCustomTextEditor(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel): void {
    const webview = webviewPanel.webview;
    webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')]
    };
    webview.html = getWebviewHtml(webview, this.extensionUri);
    webview.postMessage(createContentMessage(document));
    this.recentFilesProvider.addFile(document.fileName);

    const disposables: vscode.Disposable[] = [
      vscode.workspace.onDidChangeTextDocument(e => {
        if (e.document.uri.toString() === document.uri.toString()) {
          webview.postMessage(createContentMessage(document));
        }
      }),
      vscode.window.onDidChangeActiveColorTheme(theme => {
        webview.postMessage({ type: 'theme-changed', isDark: isDarkTheme(theme.kind) });
      }),
      webview.onDidReceiveMessage(msg =>
        handleWebviewMessage(msg, this.popupManager, this.exportService, uri =>
          vscode.commands.executeCommand('vscode.open', uri)
        )
      )
    ];

    webviewPanel.onDidDispose(() => disposables.forEach(d => d.dispose()));
  }
}
