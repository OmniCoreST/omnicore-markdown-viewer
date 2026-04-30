// ============================================
// file-helpers.js - File Operations (Main Process)
// ============================================

const fs = require('fs');
const path = require('path');

/**
 * Supported file extensions
 *
 * tscircuit uses a compound extension (.circuit.tsx) so plain .tsx files —
 * which are normal TypeScript-React source — aren't auto-opened. The check
 * for tscircuit happens by basename suffix, not by `path.extname()`.
 */
const SUPPORTED_EXTENSIONS = {
  markdown: ['.md', '.markdown', '.mdown', '.mkd', '.mkdn'],
  mermaid: ['.mmd', '.mermaid'],
  omniware: ['.ow'],
  tscircuit: ['.circuit.tsx']
};

/**
 * Check if file is a Mermaid diagram file
 * @param {string} filePath - Path to the file
 * @returns {boolean}
 */
function isMermaidFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_EXTENSIONS.mermaid.includes(ext);
}

/**
 * Check if file is an OmniWare wireframe file
 * @param {string} filePath - Path to the file
 * @returns {boolean}
 */
function isOmniWareFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_EXTENSIONS.omniware.includes(ext);
}

/**
 * Check if file is a tscircuit schematic file. Uses suffix matching because
 * the extension is compound (.circuit.tsx) and `path.extname` can't see it.
 * @param {string} filePath - Path to the file
 * @returns {boolean}
 */
function isTscircuitFile(filePath) {
  const lower = filePath.toLowerCase();
  return SUPPORTED_EXTENSIONS.tscircuit.some(ext => lower.endsWith(ext));
}

/**
 * Check if file is a Markdown file (or viewable format: mermaid, omniware, tscircuit)
 * @param {string} filePath - Path to the file
 * @returns {boolean}
 */
function isMarkdownFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_EXTENSIONS.markdown.includes(ext) ||
         SUPPORTED_EXTENSIONS.mermaid.includes(ext) ||
         SUPPORTED_EXTENSIONS.omniware.includes(ext) ||
         isTscircuitFile(filePath);
}

/**
 * Wrap content in mermaid code block if it's a mermaid file
 * @param {string} content - File content
 * @param {string} filePath - Path to the file
 * @returns {string} Wrapped or original content
 */
function wrapMermaidContent(content, filePath) {
  if (isMermaidFile(filePath)) {
    // Check if already wrapped in mermaid code block
    const trimmed = content.trim();
    if (trimmed.startsWith('```mermaid') || trimmed.startsWith('~~~mermaid')) {
      return content; // Already wrapped
    }
    // Wrap in mermaid code block
    return '```mermaid\n' + content + '\n```';
  }
  return content;
}

/**
 * Wrap content in omniware code block if it's an OmniWare file
 * @param {string} content - File content
 * @param {string} filePath - Path to the file
 * @returns {string} Wrapped or original content
 */
function wrapOmniWareContent(content, filePath) {
  if (isOmniWareFile(filePath)) {
    const trimmed = content.trim();
    if (trimmed.startsWith('```omniware') || trimmed.startsWith('~~~omniware')) {
      return content; // Already wrapped
    }
    return '```omniware\n' + content + '\n```';
  }
  return content;
}

/**
 * Wrap content in tscircuit code block if it's a .circuit.tsx file
 * @param {string} content - File content
 * @param {string} filePath - Path to the file
 * @returns {string} Wrapped or original content
 */
function wrapTscircuitContent(content, filePath) {
  if (isTscircuitFile(filePath)) {
    const trimmed = content.trim();
    if (trimmed.startsWith('```tscircuit') || trimmed.startsWith('~~~tscircuit')) {
      return content;
    }
    return '```tscircuit\n' + content + '\n```';
  }
  return content;
}

/**
 * Remove BOM (Byte Order Mark) if present
 * @param {string} content - File content
 * @returns {string} Content without BOM
 */
function removeBOM(content) {
  if (content && content.charCodeAt(0) === 0xFEFF) {
    return content.substring(1);
  }
  return content;
}

/**
 * Read a markdown file with BOM removal and mermaid wrapping
 * @param {string} filePath - Path to the file
 * @param {function} callback - Callback(err, data)
 */
function readMarkdownFile(filePath, callback) {
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      callback(err, null);
      return;
    }
    // Remove BOM if present
    data = removeBOM(data);
    // Wrap mermaid files
    data = wrapMermaidContent(data, filePath);
    // Wrap omniware files
    data = wrapOmniWareContent(data, filePath);
    // Wrap tscircuit files
    data = wrapTscircuitContent(data, filePath);
    callback(null, data);
  });
}

/**
 * Send IPC result with standard format
 * @param {object} webContents - Electron webContents
 * @param {string} channel - IPC channel name
 * @param {boolean} success - Whether operation succeeded
 * @param {object} data - Additional data to send
 */
function sendIPCResult(webContents, channel, success, data = {}) {
  webContents.send(channel, { success, ...data });
}

// Export for use in other modules
module.exports = {
  SUPPORTED_EXTENSIONS,
  isMermaidFile,
  isOmniWareFile,
  isTscircuitFile,
  isMarkdownFile,
  wrapMermaidContent,
  wrapOmniWareContent,
  wrapTscircuitContent,
  removeBOM,
  readMarkdownFile,
  sendIPCResult
};
