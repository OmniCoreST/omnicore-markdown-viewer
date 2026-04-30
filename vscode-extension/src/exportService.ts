import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class ExportService {
  async savePdf(base64Data: string, defaultName: string): Promise<void> {
    const nameWithoutExt = defaultName.replace(/\.[^/.]+$/, '');
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(nameWithoutExt + '.pdf'),
      filters: { 'PDF Files': ['pdf'], 'All Files': ['*'] }
    });

    if (!uri) return;

    // Strip data URI prefix if present
    const raw = base64Data.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(raw, 'base64');
    await vscode.workspace.fs.writeFile(uri, buffer);
    vscode.window.showInformationMessage(`PDF exported: ${path.basename(uri.fsPath)}`);
  }

  async saveWord(htmlContent: string, defaultName: string): Promise<void> {
    const nameWithoutExt = defaultName.replace(/\.[^/.]+$/, '');
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(nameWithoutExt + '.docx'),
      filters: { 'Word Documents': ['docx'], 'All Files': ['*'] }
    });

    if (!uri) return;

    try {
      const HTMLtoDOCX = (await import('html-to-docx')).default;

      const fullHtml = `<!DOCTYPE html>
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
<body>${htmlContent}</body>
</html>`;

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

      await vscode.workspace.fs.writeFile(uri, new Uint8Array(docxBuffer));
      vscode.window.showInformationMessage(`Word exported: ${path.basename(uri.fsPath)}`);
    } catch (err: any) {
      vscode.window.showErrorMessage(`Word export failed: ${err.message}`);
    }
  }

  async saveCsv(content: string, defaultName: string): Promise<void> {
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(defaultName),
      filters: { 'CSV Files': ['csv'], 'All Files': ['*'] }
    });

    if (!uri) return;

    await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
    vscode.window.showInformationMessage(`CSV exported: ${path.basename(uri.fsPath)}`);
  }

  async saveJson(content: string, defaultName: string): Promise<void> {
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(defaultName),
      filters: { 'JSON Files': ['json'], 'All Files': ['*'] }
    });

    if (!uri) return;

    await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
    vscode.window.showInformationMessage(`JSON exported: ${path.basename(uri.fsPath)}`);
  }
}
