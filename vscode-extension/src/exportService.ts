import * as vscode from 'vscode';
import * as path from 'path';
import { buildStandaloneHtml, findBrowser, PdfContent, printHtmlToPdf } from './pdfExport.js';

/** `<folder of docPath>/<name of docPath or fallbackName>.<ext>` as a save-dialog default. */
function defaultTarget(docPath: string | undefined, fallbackName: string, ext: string): vscode.Uri {
  const base = (docPath ? path.basename(docPath) : fallbackName).replace(/\.[^/.]+$/, '') || 'document';
  const dir = docPath && path.isAbsolute(docPath)
    ? path.dirname(docPath)
    : vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  return vscode.Uri.file(dir ? path.join(dir, `${base}.${ext}`) : `${base}.${ext}`);
}

export class ExportService {
  constructor(private readonly extensionUri: vscode.Uri) {}

  /**
   * Prints the rendered document to PDF with a local Chromium-family browser.
   * Without one, saves the standalone HTML so the user can print it from a browser.
   */
  async exportPdf(content: PdfContent, docPath?: string, fallbackName = 'document.pdf'): Promise<void> {
    const html = buildStandaloneHtml(this.extensionUri.fsPath, content);
    const configured = vscode.workspace.getConfiguration('omnicore').get<string>('pdf.browserPath');
    const browser = findBrowser(configured);

    if (!browser) {
      const htmlUri = await vscode.window.showSaveDialog({
        title: 'No Chrome/Chromium/Edge found: save printable HTML instead',
        defaultUri: defaultTarget(docPath, fallbackName, 'html'),
        filters: { 'HTML Files': ['html'], 'All Files': ['*'] }
      });
      if (!htmlUri) return;
      await vscode.workspace.fs.writeFile(htmlUri, Buffer.from(html, 'utf8'));
      const choice = await vscode.window.showWarningMessage(
        `No Chromium-based browser was found for PDF export, so ${path.basename(htmlUri.fsPath)} was saved instead. ` +
        'Open it in a browser and print it to PDF, or set "omnicore.pdf.browserPath".',
        'Open HTML', 'Open Settings'
      );
      if (choice === 'Open HTML') {
        vscode.env.openExternal(htmlUri);
      } else if (choice === 'Open Settings') {
        vscode.commands.executeCommand('workbench.action.openSettings', 'omnicore.pdf.browserPath');
      }
      return;
    }

    const pdfUri = await vscode.window.showSaveDialog({
      defaultUri: defaultTarget(docPath, fallbackName, 'pdf'),
      filters: { 'PDF Files': ['pdf'], 'All Files': ['*'] }
    });
    if (!pdfUri) return;

    try {
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: `Exporting ${path.basename(pdfUri.fsPath)}…` },
        () => printHtmlToPdf(browser, html, pdfUri.fsPath)
      );
    } catch (err: any) {
      vscode.window.showErrorMessage(`PDF export failed: ${err?.message ?? err}`);
      return;
    }
    const open = await vscode.window.showInformationMessage(`PDF exported: ${path.basename(pdfUri.fsPath)}`, 'Open');
    if (open === 'Open') {
      vscode.env.openExternal(pdfUri);
    }
  }

  async saveWord(htmlContent: string, defaultName: string, docPath?: string): Promise<void> {
    const uri = await vscode.window.showSaveDialog({
      defaultUri: defaultTarget(docPath, defaultName, 'docx'),
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
      defaultUri: defaultTarget(undefined, defaultName, 'csv'),
      filters: { 'CSV Files': ['csv'], 'All Files': ['*'] }
    });

    if (!uri) return;

    await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
    vscode.window.showInformationMessage(`CSV exported: ${path.basename(uri.fsPath)}`);
  }

  async saveJson(content: string, defaultName: string): Promise<void> {
    const uri = await vscode.window.showSaveDialog({
      defaultUri: defaultTarget(undefined, defaultName, 'json'),
      filters: { 'JSON Files': ['json'], 'All Files': ['*'] }
    });

    if (!uri) return;

    await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
    vscode.window.showInformationMessage(`JSON exported: ${path.basename(uri.fsPath)}`);
  }
}
