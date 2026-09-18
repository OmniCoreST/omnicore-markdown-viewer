import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ExportService } from './exportService.js';

export class PopupPanelManager {
  private exportService: ExportService;

  constructor(
    private extensionUri: vscode.Uri,
    exportService: ExportService
  ) {
    this.exportService = exportService;
  }

  private getMediaUri(webview: vscode.Webview, ...pathSegments: string[]): vscode.Uri {
    return webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', ...pathSegments));
  }

  openMermaidPopup(svgContent: string, isDarkMode: boolean): void {
    const panel = vscode.window.createWebviewPanel(
      'omnicoreMermaid',
      'Mermaid Diagram',
      vscode.ViewColumn.Active,
      { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')] }
    );

    panel.webview.html = this.getMermaidHtml(panel.webview, svgContent, isDarkMode);
  }

  openOmniWarePopup(dslCode: string, isDarkMode: boolean, docPath?: string): void {
    const panel = vscode.window.createWebviewPanel(
      'omnicoreOmniWare',
      'OmniWare Wireframe',
      vscode.ViewColumn.Active,
      { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')] }
    );

    const omniwareJsUri = this.getMediaUri(panel.webview, 'omniwire', 'omniware.js');
    panel.webview.html = this.getOmniWareHtml(panel.webview, dslCode, isDarkMode, omniwareJsUri);

    panel.webview.onDidReceiveMessage(async (msg) => {
      if (msg.type === 'export-pdf') {
        const base = docPath ? path.join(path.dirname(docPath), path.basename(docPath).replace(/\.[^/.]+$/, '') + '-wireframe.pdf') : undefined;
        await this.exportService.exportPdf(
          { html: String(msg.html || ''), omniwareCss: msg.omniwareCss, title: 'OmniWare Wireframe', markdownBody: false },
          base,
          'wireframe.pdf'
        );
      }
    });
  }

  openTablePopup(tableData: { columns: any[]; data: any[] }, isDarkMode: boolean): void {
    const panel = vscode.window.createWebviewPanel(
      'omnicoreTable',
      'Interactive Table',
      vscode.ViewColumn.Active,
      { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')] }
    );

    const tabulatorJsUri = this.getMediaUri(panel.webview, 'libs', 'tabulator', 'tabulator.min.js');
    const tabulatorCssUri = this.getMediaUri(panel.webview, 'libs', 'tabulator', 'tabulator.min.css');
    panel.webview.html = this.getTableHtml(panel.webview, tableData, isDarkMode, tabulatorJsUri, tabulatorCssUri);

    panel.webview.onDidReceiveMessage(async (msg) => {
      switch (msg.type) {
        case 'export-csv':
          await this.exportService.saveCsv(msg.data, 'table-export.csv');
          break;
        case 'export-json':
          await this.exportService.saveJson(msg.data, 'table-export.json');
          break;
      }
    });
  }

  private getMermaidHtml(webview: vscode.Webview, svgContent: string, isDarkMode: boolean): string {
    const nonce = getNonce();
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src data:; font-src data:;">
<style>
body, html {
  margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden;
  background-color: ${isDarkMode ? '#1a1a1a' : '#f0f0f0'};
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}
.ui-overlay {
  position: absolute; top: 20px; left: 20px;
  background: ${isDarkMode ? '#2d2d2d' : 'white'};
  padding: 15px; border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0,0,0,${isDarkMode ? '0.3' : '0.1'});
  pointer-events: auto; z-index: 10;
  border: 1px solid ${isDarkMode ? '#404040' : 'transparent'};
}
h1 { margin: 0 0 10px 0; font-size: 16px; color: ${isDarkMode ? '#3DBDC6' : '#333'}; }
p { margin: 0 0 10px 0; font-size: 12px; color: ${isDarkMode ? '#a0a0a0' : '#666'}; }
button {
  padding: 8px 12px; background-color: ${isDarkMode ? '#3DBDC6' : '#279EA7'};
  color: white; border: none; border-radius: 4px; cursor: pointer;
  font-weight: bold; transition: background 0.2s; width: 100%; margin-bottom: 8px;
}
button:last-child { margin-bottom: 0; }
button:hover { background-color: ${isDarkMode ? '#4FCDD6' : '#1f8089'}; }
#svg-container-wrapper { cursor: grab; overflow: hidden; }
#svg-container-wrapper:active { cursor: grabbing; }
#viewport { will-change: transform; }
</style>
</head>
<body>
<div class="ui-overlay">
  <h1>Mermaid Diagram</h1>
  <p>Scroll to Zoom | Click & Drag to Pan</p>
  <button id="resetViewBtn">Reset View</button>
</div>
<div id="svg-container-wrapper" style="width:100%;height:100%;position:relative;">
  <div id="viewport" style="transform-origin:0 0;">${svgContent}</div>
</div>
<script nonce="${nonce}">
const vscodeApi = acquireVsCodeApi();
const svgWrapper = document.getElementById('svg-container-wrapper');
const viewport = document.getElementById('viewport');
const mermaidSvg = viewport.querySelector('svg');
if (mermaidSvg) { mermaidSvg.style.display='block'; mermaidSvg.style.maxWidth='100%'; mermaidSvg.style.height='auto'; }
let state = { scale:1, panning:false, pointX:0, pointY:0, startX:0, startY:0 };
const config = { minScale:0.01, maxScale:10, zoomSpeed:0.1 };

function fitToView() {
  state = { scale:1, panning:false, pointX:0, pointY:0, startX:0, startY:0 };
  if (!mermaidSvg) { updateTransform(); return true; }
  viewport.style.transform = 'none';
  const svgRect = mermaidSvg.getBoundingClientRect();
  const wrapperRect = svgWrapper.getBoundingClientRect();
  if (!svgRect.width || !svgRect.height || !wrapperRect.width || !wrapperRect.height) { updateTransform(); return false; }
  const scaleX = (wrapperRect.width * 0.9) / svgRect.width;
  const scaleY = (wrapperRect.height * 0.9) / svgRect.height;
  const initialScale = Math.min(scaleX, scaleY, 1);
  state.scale = initialScale;
  state.pointX = (wrapperRect.width - svgRect.width * initialScale) / 2;
  state.pointY = (wrapperRect.height - svgRect.height * initialScale) / 2;
  updateTransform();
  return true;
}
// Fit as soon as the panel has a size (while the page is parsed it can still be 0 x 0).
let fitted = false;
new ResizeObserver(() => { if (!fitted) fitted = fitToView(); }).observe(svgWrapper);
document.getElementById('resetViewBtn').addEventListener('click', fitToView);

svgWrapper.addEventListener('wheel', (e) => {
  e.preventDefault();
  const rect = viewport.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  const delta = -Math.sign(e.deltaY);
  const zoomFactor = 1 + (config.zoomSpeed * delta);
  let newScale = state.scale * zoomFactor;
  if (newScale < config.minScale) newScale = config.minScale;
  if (newScale > config.maxScale) newScale = config.maxScale;
  const ratio = newScale / state.scale;
  state.pointX = mouseX - (mouseX - state.pointX) * ratio;
  state.pointY = mouseY - (mouseY - state.pointY) * ratio;
  state.scale = newScale;
  updateTransform();
}, { passive: false });

svgWrapper.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  e.preventDefault();
  state.panning = true;
  state.startX = e.clientX - state.pointX;
  state.startY = e.clientY - state.pointY;
  svgWrapper.style.cursor = 'grabbing';
});
window.addEventListener('mousemove', (e) => {
  if (!state.panning) return;
  e.preventDefault();
  state.pointX = e.clientX - state.startX;
  state.pointY = e.clientY - state.startY;
  updateTransform();
});
window.addEventListener('mouseup', () => { state.panning = false; svgWrapper.style.cursor = 'grab'; });

function updateTransform() {
  viewport.style.transform = 'translate(' + state.pointX + 'px, ' + state.pointY + 'px) scale(' + state.scale + ')';
}
</script>
</body>
</html>`;
  }

  private getOmniWareHtml(webview: vscode.Webview, dslCode: string, isDarkMode: boolean, omniwareJsUri: vscode.Uri): string {
    const nonce = getNonce();
    // JSON with '<' escaped cannot end the <script> element early.
    const dslJson = JSON.stringify(String(dslCode ?? '')).replace(/</g, '\\u003c');

    // Read OmniWare dark CSS
    const darkCSS = isDarkMode ? `<style>
.ow-page {
  --ow-bg: #2d2d2d; --ow-paper: #1a1a1a; --ow-border: #888888;
  --ow-border-light: #555555; --ow-text: #e0e0e0; --ow-text-light: #aaaaaa;
  --ow-grid: #3a3a3a; --ow-green-lt: #1a3a24; --ow-red-lt: #3a1a1a;
  --ow-yellow-lt: #3a3018; --ow-blue-lt: #1a2a3a; --ow-purple-lt: #2a2040;
  --ow-gray-lt: #333333;
}
.ow-page .ow-page-inner { background: var(--ow-paper); }
.ow-page .ow-section-title { background: #2a2a2a; }
.ow-page .ow-table th { background: #2a2a2a; }
.ow-page .ow-table tr:hover td { background: #252525; }
.ow-page .ow-form-input, .ow-page .ow-form-textarea, .ow-page .ow-form-file {
  background: #252525; color: var(--ow-text); border-color: var(--ow-border-light);
}
.ow-page .ow-form-input-readonly { background: #2a2a2a; }
.ow-page .ow-footer { background: #1e1e1e; }
.ow-page .ow-placeholder { background: repeating-linear-gradient(45deg,#2a2a2a,#2a2a2a 10px,#333333 10px,#333333 20px); }
.ow-page .ow-formula { background: #252530; }
.ow-page .ow-locked-overlay { background: rgba(0,0,0,0.6); }
.ow-page .ow-note-info { background: #2a2818; border-color: #8a7e2f; color: #d4c85a; }
</style>` : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${webview.cspSource} 'nonce-${nonce}'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com data:; img-src ${webview.cspSource} data:;">
<style>
body, html {
  margin: 0; padding: 20px;
  background-color: ${isDarkMode ? '#2d2d2d' : '#f0ede6'};
  min-height: 100vh;
}
.toolbar {
  position: fixed; top: 10px; right: 10px; z-index: 1000; display: flex; gap: 8px;
}
.toolbar button {
  padding: 6px 14px; border: 1px solid ${isDarkMode ? '#555' : '#ccc'};
  background: ${isDarkMode ? '#333' : '#fff'}; color: ${isDarkMode ? '#e0e0e0' : '#333'};
  border-radius: 4px; cursor: pointer; font-size: 13px;
}
.toolbar button:hover { background: ${isDarkMode ? '#444' : '#eee'}; }
</style>
${darkCSS}
</head>
<body>
<div class="toolbar">
  <button id="exportPdfBtn">Export PDF</button>
</div>
<div id="render-target"></div>
<script src="${omniwareJsUri}"></script>
<script nonce="${nonce}">
const vscodeApi = acquireVsCodeApi();
const dsl = ${dslJson};
OmniWare.render(dsl, document.getElementById('render-target'));

// PDF is printed by the extension host (webviews cannot call window.print()).
document.getElementById('exportPdfBtn').addEventListener('click', () => {
  const styles = document.getElementById('omniware-styles');
  vscodeApi.postMessage({
    type: 'export-pdf',
    html: document.getElementById('render-target').innerHTML,
    omniwareCss: styles ? styles.textContent : ''
  });
});
</script>
</body>
</html>`;
  }

  private getTableHtml(
    webview: vscode.Webview,
    tableData: { columns: any[]; data: any[] },
    isDarkMode: boolean,
    tabulatorJsUri: vscode.Uri,
    tabulatorCssUri: vscode.Uri
  ): string {
    const nonce = getNonce();
    const tableDataJson = JSON.stringify(tableData).replace(/</g, '\\u003c');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${webview.cspSource} 'nonce-${nonce}'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource} data:; img-src ${webview.cspSource} data:;">
<link href="${tabulatorCssUri}" rel="stylesheet">
<style>
body, html {
  margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden;
  background-color: ${isDarkMode ? '#1a1a1a' : '#f5f5f5'};
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}
.container { display: flex; flex-direction: column; height: 100vh; padding: 20px; box-sizing: border-box; }
.header-bar {
  background: ${isDarkMode ? '#2d2d2d' : 'white'}; padding: 20px;
  border-radius: 8px 8px 0 0;
  box-shadow: 0 2px 4px rgba(0,0,0,${isDarkMode ? '0.3' : '0.1'});
  display: flex; justify-content: space-between; align-items: center;
  border: 1px solid ${isDarkMode ? '#404040' : 'transparent'}; border-bottom: none;
}
h1 { margin: 0; font-size: 20px; color: ${isDarkMode ? '#3DBDC6' : '#279EA7'}; }
.controls { display: flex; gap: 10px; }
button {
  padding: 10px 16px; background-color: ${isDarkMode ? '#3DBDC6' : '#279EA7'};
  color: white; border: none; border-radius: 6px; cursor: pointer;
  font-weight: 600; font-size: 13px; transition: all 0.2s;
}
button:hover { background-color: ${isDarkMode ? '#4FCDD6' : '#1f8089'}; }
.table-wrapper {
  flex: 1; background: ${isDarkMode ? '#242424' : 'white'};
  border-radius: 0 0 8px 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,${isDarkMode ? '0.3' : '0.1'});
  overflow: hidden; display: flex; flex-direction: column;
  border: 1px solid ${isDarkMode ? '#404040' : 'transparent'}; border-top: none;
}
#data-table { flex: 1; }
.info {
  padding: 12px 20px; background: ${isDarkMode ? '#2d2d2d' : '#e8e8e8'};
  color: ${isDarkMode ? '#a0a0a0' : '#5a6b7d'}; font-size: 13px;
  border-bottom: 1px solid ${isDarkMode ? '#404040' : '#d0d0d0'};
}
.tabulator { font-size: 13px; border: none; background-color: ${isDarkMode ? '#242424' : 'white'}; color: ${isDarkMode ? '#e8e8e8' : '#1F3244'}; }
.tabulator .tabulator-header { background-color: #1F3244; color: ${isDarkMode ? '#3DBDC6' : '#279EA7'}; border: none; }
.tabulator .tabulator-header .tabulator-col { background-color: #1F3244; border-right: 1px solid #3a4a5c; }
.tabulator .tabulator-header .tabulator-col .tabulator-col-content { padding: 12px; }
.tabulator .tabulator-header .tabulator-col .tabulator-col-title { color: ${isDarkMode ? '#3DBDC6' : '#279EA7'}; font-weight: 600; }
.tabulator .tabulator-header .tabulator-col.tabulator-sortable:hover { background-color: #2a3a4c; }
.tabulator .tabulator-tableholder .tabulator-table .tabulator-row {
  background-color: ${isDarkMode ? '#242424' : 'white'}; color: ${isDarkMode ? '#e8e8e8' : '#1F3244'};
  border-bottom: 1px solid ${isDarkMode ? '#404040' : '#d0d0d0'};
}
.tabulator .tabulator-tableholder .tabulator-table .tabulator-row:hover { background-color: ${isDarkMode ? '#2d2d2d' : '#f5f5f5'}; }
.tabulator .tabulator-tableholder .tabulator-table .tabulator-row .tabulator-cell {
  padding: 10px 12px; border-right: 1px solid ${isDarkMode ? '#404040' : '#e8e8e8'};
}
.tabulator .tabulator-footer {
  background-color: ${isDarkMode ? '#2d2d2d' : '#f5f5f5'};
  border-top: 2px solid ${isDarkMode ? '#404040' : '#d0d0d0'}; padding: 8px;
  color: ${isDarkMode ? '#e8e8e8' : '#1F3244'};
}
.tabulator .tabulator-footer .tabulator-page {
  background-color: ${isDarkMode ? '#3DBDC6' : '#279EA7'}; color: white; border: none;
}
.tabulator .tabulator-footer .tabulator-page:hover { background-color: ${isDarkMode ? '#4FCDD6' : '#1f8089'}; }
.tabulator .tabulator-footer .tabulator-page.active { background-color: #1F3244; }
.tabulator .tabulator-header-filter input {
  border: 1px solid #d0d0d0; padding: 4px 8px; border-radius: 4px;
  background: white; color: #1F3244;
}
.tabulator .tabulator-header-filter input:focus { border-color: #279EA7; outline: none; }
</style>
</head>
<body>
<div class="container">
  <div class="header-bar">
    <h1>Interactive Table Viewer</h1>
    <div class="controls">
      <button id="clearFiltersBtn">Clear Filters</button>
      <button id="exportCsvBtn">Export CSV</button>
      <button id="exportJsonBtn">Export JSON</button>
    </div>
  </div>
  <div class="table-wrapper">
    <div class="info"><strong>Tips:</strong> Click column headers to sort | Type in filter boxes to search | Use pagination at bottom</div>
    <div id="data-table"></div>
  </div>
</div>
<script src="${tabulatorJsUri}"></script>
<script nonce="${nonce}">
const vscodeApi = acquireVsCodeApi();
const tableData = ${tableDataJson};
const table = new Tabulator("#data-table", {
  data: tableData.data,
  columns: tableData.columns,
  layout: "fitColumns",
  pagination: true,
  paginationSize: 50,
  paginationSizeSelector: [25, 50, 100, 200, true],
  paginationCounter: "rows",
  movableColumns: true,
  resizableColumns: true,
  headerFilterLiveFilterDelay: 300,
  initialSort: [],
  height: "100%"
});

function exportCSV() {
  const rows = table.getData();
  if (rows.length === 0) return;
  const cols = tableData.columns.map(c => c.field);
  const headers = tableData.columns.map(c => c.title);
  let csv = headers.join(',') + '\\n';
  rows.forEach(row => {
    csv += cols.map(c => {
      let val = (row[c] || '').toString().replace(/"/g, '""');
      return '"' + val + '"';
    }).join(',') + '\\n';
  });
  vscodeApi.postMessage({ type: 'export-csv', data: csv });
}

function exportJSON() {
  const data = JSON.stringify(table.getData(), null, 2);
  vscodeApi.postMessage({ type: 'export-json', data: data });
}

function clearFilters() { table.clearHeaderFilter(); }

// Inline onclick handlers are blocked by the nonce-only CSP.
document.getElementById('clearFiltersBtn').addEventListener('click', clearFilters);
document.getElementById('exportCsvBtn').addEventListener('click', exportCSV);
document.getElementById('exportJsonBtn').addEventListener('click', exportJSON);
</script>
</body>
</html>`;
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
