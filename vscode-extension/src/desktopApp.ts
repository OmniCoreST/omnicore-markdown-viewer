import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawn } from 'child_process';

/**
 * Locating and launching the Omnicore Markdown Viewer desktop app. No `vscode`
 * import, so it can be tested with plain node.
 */

export const RELEASES_URL = 'https://github.com/OmniCoreST/omnicore-markdown-viewer/releases/latest';

const PRODUCT = 'Omnicore Markdown Viewer';
const LINUX_BIN = 'omnicore-markdown-viewer';

function exists(p: string): boolean {
  try {
    return fs.statSync(p).isFile() || p.endsWith('.app');
  } catch {
    return false;
  }
}

export function desktopAppCandidates(platform: NodeJS.Platform, env: NodeJS.ProcessEnv): string[] {
  if (platform === 'win32') {
    const roots = [env['PROGRAMFILES'], env['PROGRAMFILES(X86)'], env['LOCALAPPDATA'] && path.win32.join(env['LOCALAPPDATA'], 'Programs')]
      .filter((r): r is string => !!r);
    return roots.map(root => path.win32.join(root, PRODUCT, `${PRODUCT}.exe`));
  }
  if (platform === 'darwin') {
    return ['/Applications', path.join(os.homedir(), 'Applications')].map(d => path.join(d, `${PRODUCT}.app`));
  }
  const onPath = (env['PATH'] || '').split(path.delimiter).filter(Boolean).map(d => path.join(d, LINUX_BIN));
  return [...onPath, `/opt/${PRODUCT}/${LINUX_BIN}`];
}

/** The configured path if it exists, otherwise the first installed copy found. */
export function findDesktopApp(
  configuredPath?: string,
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform
): string | undefined {
  const explicit = configuredPath?.trim();
  if (explicit) return exists(explicit) ? explicit : undefined;
  return desktopAppCandidates(platform, env).find(exists);
}

/**
 * Starts the desktop app with `filePath`, detached from VS Code. A running app
 * receives the file through its single-instance handler.
 */
export function launchDesktopApp(app: string, filePath: string, platform: NodeJS.Platform = process.platform): Promise<void> {
  // VS Code's extension host runs with ELECTRON_RUN_AS_NODE=1; passed on, it
  // would start the Electron app as plain node without a window.
  const env = { ...process.env };
  delete env['ELECTRON_RUN_AS_NODE'];
  delete env['ELECTRON_NO_ATTACH_CONSOLE'];

  const [command, args] = platform === 'darwin' && app.endsWith('.app')
    ? ['open', ['-a', app, filePath]]
    : [app, [filePath]];

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { detached: true, stdio: 'ignore', env, windowsHide: false });
    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });
}
