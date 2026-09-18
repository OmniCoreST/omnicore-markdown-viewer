import * as vscode from 'vscode';
import { PreviewManager } from './previewManager.js';
import { ExportService } from './exportService.js';
import { RecentFilesProvider, RecentFileItem } from './recentFilesProvider.js';
import { registerFormattingCommands } from './formattingCommands.js';
import { MarkdownEditorProvider } from './markdownEditorProvider.js';

let previewManager: PreviewManager | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const exportService = new ExportService();
  const recentFilesProvider = new RecentFilesProvider(context);

  // Register Recent Files tree view
  vscode.window.registerTreeDataProvider('omnicoreRecentFiles', recentFilesProvider);

  previewManager = new PreviewManager(context.extensionUri, exportService, recentFilesProvider);

  // Preview commands
  context.subscriptions.push(
    vscode.commands.registerCommand('omnicore.openPreview', () => {
      previewManager?.openPreview(vscode.ViewColumn.Active);
    }),
    vscode.commands.registerCommand('omnicore.openPreviewToSide', () => {
      previewManager?.openPreview(vscode.ViewColumn.Beside);
    })
  );

  // Viewer as default editor for supported files
  context.subscriptions.push(
    MarkdownEditorProvider.register(context, exportService, recentFilesProvider),
    vscode.commands.registerCommand('omnicore.openAsText', (uri?: vscode.Uri) => {
      const input = vscode.window.tabGroups.activeTabGroup.activeTab?.input;
      const target = uri ?? (input instanceof vscode.TabInputCustom ? input.uri : undefined);
      if (target) {
        vscode.commands.executeCommand('vscode.openWith', target, 'default');
      }
    })
  );

  // Export commands
  context.subscriptions.push(
    vscode.commands.registerCommand('omnicore.exportPdf', () => {
      previewManager?.openPreview(vscode.ViewColumn.Beside);
      // PDF export is triggered from webview toolbar
    }),
    vscode.commands.registerCommand('omnicore.exportWord', () => {
      previewManager?.openPreview(vscode.ViewColumn.Beside);
      // Word export is triggered from webview toolbar
    })
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
