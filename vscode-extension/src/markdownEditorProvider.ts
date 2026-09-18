import * as vscode from 'vscode';
import { ExportService } from './exportService.js';
import { isMarkdownFile } from './fileHelpers.js';
import { PopupPanelManager } from './popupPanelManager.js';
import { RecentFilesProvider } from './recentFilesProvider.js';
import {
  createContentMessage, getWebviewHtml, handleWebviewMessage, isDarkTheme, localResourceRoots
} from './webviewContent.js';

/** Delay before a document change is re-rendered (typing bursts collapse into one render). */
export const UPDATE_DEBOUNCE_MS = 200;
/** How long a `#fragment` waits for its target document's first render. */
const PENDING_FRAGMENT_TTL_MS = 15000;

export type ExportFormat = 'pdf' | 'docx';

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
  ): { provider: MarkdownEditorProvider; disposable: vscode.Disposable } {
    const provider = new MarkdownEditorProvider(context.extensionUri, exportService, recentFilesProvider);
    const disposable = vscode.window.registerCustomEditorProvider(
      MarkdownEditorProvider.viewType,
      provider,
      { webviewOptions: { retainContextWhenHidden: true } }
    );
    return { provider, disposable };
  }

  private readonly popupManager: PopupPanelManager;
  /** Open viewer panels per document URI (split editors can show one document twice). */
  private readonly panels = new Map<string, vscode.WebviewPanel[]>();
  /** Panels whose webview has rendered at least once. */
  private readonly readyPanels = new WeakSet<vscode.WebviewPanel>();
  /** `#fragment` to scroll to once the linked document has rendered. */
  private readonly pendingFragments = new Map<string, { fragment: string; expires: number }>();

  private constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly exportService: ExportService,
    private readonly recentFilesProvider: RecentFilesProvider
  ) {
    this.popupManager = new PopupPanelManager(extensionUri, exportService);
  }

  resolveCustomTextEditor(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel): void {
    const key = document.uri.toString();
    const webview = webviewPanel.webview;
    webview.options = {
      enableScripts: true,
      localResourceRoots: localResourceRoots(this.extensionUri, document)
    };
    webview.html = getWebviewHtml(webview, this.extensionUri);
    this.panels.set(key, [...(this.panels.get(key) ?? []), webviewPanel]);

    const postContent = () => webview.postMessage(createContentMessage(document, webview));
    postContent();
    this.recentFilesProvider.addFile(document.fileName);

    let updateTimer: ReturnType<typeof setTimeout> | undefined;
    const disposables: vscode.Disposable[] = [
      vscode.workspace.onDidChangeTextDocument(e => {
        if (e.document.uri.toString() === key) {
          clearTimeout(updateTimer);
          updateTimer = setTimeout(postContent, UPDATE_DEBOUNCE_MS);
        }
      }),
      vscode.window.onDidChangeActiveColorTheme(theme => {
        webview.postMessage({ type: 'theme-changed', isDark: isDarkTheme(theme.kind) });
      }),
      webview.onDidReceiveMessage(msg =>
        handleWebviewMessage(msg, {
          popupManager: this.popupManager,
          exportService: this.exportService,
          openFile: (uri, fragment) => this.openLinkedFile(uri, fragment),
          onRendered: () => this.onRendered(key, webviewPanel)
        })
      )
    ];

    webviewPanel.onDidDispose(() => {
      clearTimeout(updateTimer);
      const remaining = (this.panels.get(key) ?? []).filter(p => p !== webviewPanel);
      if (remaining.length) {
        this.panels.set(key, remaining);
      } else {
        this.panels.delete(key);
      }
      disposables.forEach(d => d.dispose());
    });
  }

  /** The viewer panel showing `uri` (the active or visible one first). */
  getPanel(uri: vscode.Uri): vscode.WebviewPanel | undefined {
    const list = this.panels.get(uri.toString()) ?? [];
    return list.find(p => p.active) ?? list.find(p => p.visible) ?? list[list.length - 1];
  }

  /** Asks the viewer of `uri` to export itself; false when no viewer shows it. */
  requestExport(uri: vscode.Uri, format: ExportFormat): boolean {
    const panel = this.getPanel(uri);
    if (!panel) return false;
    panel.webview.postMessage({ type: 'request-export', format });
    return true;
  }

  private onRendered(key: string, panel: vscode.WebviewPanel): void {
    this.readyPanels.add(panel);
    const pending = this.pendingFragments.get(key);
    if (pending) {
      this.pendingFragments.delete(key);
      if (pending.expires > Date.now()) {
        panel.webview.postMessage({ type: 'scroll-to', fragment: pending.fragment });
      }
    }
  }

  /** Opens a linked file with its default editor and scrolls the viewer to `#fragment`. */
  private async openLinkedFile(uri: vscode.Uri, fragment: string): Promise<void> {
    await vscode.commands.executeCommand('vscode.open', uri);
    if (!fragment) return;
    const panel = this.getPanel(uri);
    if (panel && this.readyPanels.has(panel)) {
      panel.webview.postMessage({ type: 'scroll-to', fragment });
    } else if (isMarkdownFile(uri.fsPath)) {
      this.pendingFragments.set(uri.toString(), { fragment, expires: Date.now() + PENDING_FRAGMENT_TTL_MS });
    }
  }
}
