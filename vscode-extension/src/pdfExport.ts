import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFile } from 'child_process';
import { pathToFileURL } from 'url';

/**
 * PDF export without the `vscode` API (so it can be tested with plain node):
 * builds a standalone, light-themed HTML page from the rendered document and
 * prints it with a locally installed Chromium-family browser in headless mode.
 */

export interface PdfContent {
  /** Rendered document HTML (UI buttons removed, images inlined). */
  html: string;
  /** OmniWare stylesheet taken from the webview (`#omniware-styles`). */
  omniwareCss?: string;
  title?: string;
  /** false: do not wrap in the markdown viewer container (OmniWare pop-out). */
  markdownBody?: boolean;
}

const PATH_CANDIDATES = [
  'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser',
  'microsoft-edge', 'microsoft-edge-stable', 'brave-browser'
];

function installCandidates(platform: NodeJS.Platform, env: NodeJS.ProcessEnv): string[] {
  if (platform === 'win32') {
    const roots = [env['PROGRAMFILES'], env['PROGRAMFILES(X86)'], env['LOCALAPPDATA']].filter((r): r is string => !!r);
    const rel = [
      'Google\\Chrome\\Application\\chrome.exe',
      'Microsoft\\Edge\\Application\\msedge.exe',
      'BraveSoftware\\Brave-Browser\\Application\\brave.exe',
      'Chromium\\Application\\chrome.exe'
    ];
    return roots.flatMap(root => rel.map(r => path.win32.join(root, r)));
  }
  if (platform === 'darwin') {
    const apps = [
      'Google Chrome.app/Contents/MacOS/Google Chrome',
      'Chromium.app/Contents/MacOS/Chromium',
      'Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      'Brave Browser.app/Contents/MacOS/Brave Browser'
    ];
    const dirs = ['/Applications', path.join(os.homedir(), 'Applications')];
    return dirs.flatMap(d => apps.map(a => path.join(d, a)));
  }
  return ['/snap/bin/chromium', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
}

function isExecutableFile(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

/**
 * Chromium-family browser to print with: the configured path, then $CHROME_PATH,
 * then well-known names on PATH, then common install locations.
 */
export function findBrowser(
  configuredPath?: string,
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform
): string | undefined {
  for (const explicit of [configuredPath, env['CHROME_PATH']]) {
    if (explicit && explicit.trim() && isExecutableFile(explicit.trim())) {
      return explicit.trim();
    }
  }
  const pathDirs = (env['PATH'] || env['Path'] || '').split(path.delimiter).filter(Boolean);
  const exts = platform === 'win32' ? ['.exe', '.cmd', ''] : [''];
  const names = platform === 'win32' ? [...PATH_CANDIDATES, 'chrome', 'msedge', 'brave'] : PATH_CANDIDATES;
  for (const name of names) {
    for (const dir of pathDirs) {
      for (const ext of exts) {
        const candidate = path.join(dir, name + ext);
        if (isExecutableFile(candidate)) return candidate;
      }
    }
  }
  return installCandidates(platform, env).find(isExecutableFile);
}

const PRINT_CSS = `
@page { size: A4; margin: 16mm 15mm 18mm 15mm; }
html, body {
  height: auto !important; overflow: visible !important; display: block !important;
  background: #ffffff !important; color: #1F3244 !important;
}
body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
#viewer { max-width: none !important; width: auto !important; margin: 0 !important; padding: 0 !important; line-height: 1.6; }
.markdown-body pre:not(.mermaid), .markdown-body pre:not(.mermaid) code {
  white-space: pre-wrap !important; word-break: break-word; overflow: visible !important;
}
.markdown-body table { overflow: visible; border-radius: 0; }
.markdown-body tr:hover { background: none; }
thead { display: table-header-group; }
pre, img, svg, blockquote, tr, .mermaid, .omniware-rendered, .ow-page {
  page-break-inside: avoid; break-inside: avoid;
}
h1, h2, h3, h4, h5, h6 { page-break-after: avoid; break-after: avoid; }
img { max-width: 100% !important; }
.mermaid-maximize-btn, .table-maximize-btn, .code-copy-btn, .omniware-maximize-btn { display: none !important; }
`;

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function readText(file: string): string {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

/** Standalone HTML page (always light theme) for the given rendered content. */
export function buildStandaloneHtml(extensionPath: string, content: PdfContent): string {
  const media = (...segments: string[]) => path.join(extensionPath, 'media', ...segments);
  const font = (file: string, weight: number) =>
    `@font-face { font-family: 'Fira Code Local'; src: url('${pathToFileURL(media('fonts', file)).href}') format('truetype'); font-weight: ${weight}; }`;
  const fonts = [
    font('FiraCode-Light.ttf', 300), font('FiraCode-Regular.ttf', 400), font('FiraCode-Medium.ttf', 500),
    font('FiraCode-SemiBold.ttf', 600), font('FiraCode-Bold.ttf', 700)
  ].join('\n');
  // `</style` inside a stylesheet would end the <style> element early.
  const css = (text: string) => text.replace(/<\/style/gi, '<\\/style');
  const body = content.markdownBody === false
    ? content.html
    : `<div id="viewer" class="markdown-body">${content.html}</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: https: file:; font-src data: file:;">
<title>${escapeHtml(content.title || 'Document')}</title>
<style>${fonts}</style>
<style>${css(readText(media('webview', 'styles.css')))}</style>
<style>${css(readText(media('libs', 'prismjs', 'themes', 'prism-solarizedlight.css')))}</style>
<style>${css(content.omniwareCss || '')}</style>
<style>${PRINT_CSS}</style>
</head>
<body>
${body}
</body>
</html>`;
}

export function chromeArgs(htmlFile: string, pdfFile: string, profileDir: string): string[] {
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--no-pdf-header-footer',
    '--print-to-pdf-no-header', // name of the same switch in older Chromium builds
    `--user-data-dir=${profileDir}`,
    `--print-to-pdf=${pdfFile}`
  ];
  if (typeof process.getuid === 'function' && process.getuid() === 0) {
    args.push('--no-sandbox');
  }
  args.push(pathToFileURL(htmlFile).href);
  return args;
}

function run(file: string, args: string[], timeoutMs: number): Promise<{ stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { timeout: timeoutMs, windowsHide: true, maxBuffer: 16 * 1024 * 1024 }, (error, _stdout, stderr) => {
      if (error) {
        const tail = String(stderr || '').trim().split('\n').slice(-3).join(' ');
        reject(new Error(`${error.message}${tail ? ` (${tail})` : ''}`));
      } else {
        resolve({ stderr: String(stderr || '') });
      }
    });
  });
}

/**
 * Prints `html` to `outputPdf` with `browser`. Works in a private temp folder
 * (page + browser profile) that is removed afterwards.
 */
export async function printHtmlToPdf(browser: string, html: string, outputPdf: string, timeoutMs = 120000): Promise<void> {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'omnicore-pdf-'));
  try {
    const htmlFile = path.join(workDir, 'document.html');
    const tempPdf = path.join(workDir, 'document.pdf');
    fs.writeFileSync(htmlFile, html, 'utf8');
    await run(browser, chromeArgs(htmlFile, tempPdf, path.join(workDir, 'profile')), timeoutMs);
    if (!fs.existsSync(tempPdf) || fs.statSync(tempPdf).size === 0) {
      throw new Error(`${path.basename(browser)} finished without writing a PDF`);
    }
    fs.copyFileSync(tempPdf, outputPdf);
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
  }
}
