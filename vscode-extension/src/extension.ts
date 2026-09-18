import * as vscode from 'vscode';
import { PreviewManager } from './previewManager.js';
import { ExportService } from './exportService.js';
import { RecentFilesProvider, RecentFileItem } from './recentFilesProvider.js';
import { registerFormattingCommands } from './formattingCommands.js';
import { ExportFormat, MarkdownEditorProvider } from './markdownEditorProvider.js';
import { isMarkdownFile } from './fileHelpers.js';

let previewManager: PreviewManager | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const exportService = new ExportService(context.extensionUri);
  const recentFilesProvider = new RecentFilesProvider(context);

  // Register Recent Files tree view
  vscode.window.registerTreeDataProvider('omnicoreRecentFiles', recentFilesProvider);

  const preview = new PreviewManager(context.extensionUri, exportService, recentFilesProvider);
  previewManager = preview;

  // Preview commands
  context.subscriptions.push(
    vscode.commands.registerCommand('omnicore.openPreview', () => {
      preview.openPreview(vscode.ViewColumn.Active);
    }),
    vscode.commands.registerCommand('omnicore.openPreviewToSide', () => {
      preview.openPreview(vscode.ViewColumn.Beside);
    })
  );

  // Viewer as default editor for supported files
  const editor = MarkdownEditorProvider.register(context, exportService, recentFilesProvider);
  context.subscriptions.push(
    editor.disposable,
    vscode.commands.registerCommand('omnicore.openAsText', (uri?: vscode.Uri) => {
      const input = vscode.window.tabGroups.activeTabGroup.activeTab?.input;
      const target = uri ?? (input instanceof vscode.TabInputCustom ? input.uri : undefined);
      if (target) {
        vscode.commands.executeCommand('vscode.openWith', target, 'default');
      }
    })
  );

  /**
   * Export commands act on the active Omnicore viewer or preview; from a text
   * editor they use that document's viewer, or open the preview and export from it.
   */
  const exportActive = async (format: ExportFormat) => {
    const input = vscode.window.tabGroups.activeTabGroup.activeTab?.input;
    if (input instanceof vscode.TabInputCustom && input.viewType === MarkdownEditorProvider.viewType &&
        editor.provider.requestExport(input.uri, format)) {
      return;
    }
    if (preview.isActive() && preview.requestExport(format)) {
      return;
    }
    const textEditor = vscode.window.activeTextEditor;
    if (textEditor && isMarkdownFile(textEditor.document.fileName)) {
      if (editor.provider.requestExport(textEditor.document.uri, format)) return;
      await preview.openPreview(vscode.ViewColumn.Beside, format);
      return;
    }
    vscode.window.showWarningMessage('Open a Markdown file in the Omnicore viewer to export it.');
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('omnicore.exportPdf', () => exportActive('pdf')),
    vscode.commands.registerCommand('omnicore.exportWord', () => exportActive('docx'))
  );

  // Recent files commands
  context.subscriptions.push(
    vscode.commands.registerCommand('omnicore.recentFiles.clear', () => {
      recentFilesProvider.clearAll();
    }),
    vscode.commands.registerCommand('omnicore.recentFiles.remove', (item: RecentFileItem) => {
      recentFilesProvider.removeFile(item.entry.path);
    }),
    vscode.commands.registerCommand('omnicore.recentFiles.openContainingFolder', (item: RecentFileItem) => {
      vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(item.entry.path));
    }),
    vscode.commands.registerCommand('omnicore.recentFiles.copyPath', (item: RecentFileItem) => {
      vscode.env.clipboard.writeText(item.entry.path);
      vscode.window.showInformationMessage('Path copied to clipboard');
    })
  );

  // Formatting commands
  registerFormattingCommands(context);
}

export function deactivate(): void {
  previewManager?.dispose();
}
