// Generates media/webview/emoji-map.js (browser global) from the desktop app's
// ../emoji-map.js (CommonJS), so both apps know the same :shortcodes:.
// Run from vscode-extension/:  npm run gen:emoji
'use strict';
const fs = require('fs');
const path = require('path');

const source = path.resolve(__dirname, '..', '..', 'emoji-map.js');
const target = path.resolve(__dirname, '..', 'media', 'webview', 'emoji-map.js');
const map = require(source);
const keys = Object.keys(map);

const body = keys.map(k => '  ' + JSON.stringify(k) + ': ' + JSON.stringify(map[k])).join(',\n');
const out = `// GENERATED FILE - do not edit. ${keys.length} emoji shortcodes from the repo-root emoji-map.js.
// Regenerate from vscode-extension/: npm run gen:emoji   (node scripts/gen-emoji-map.js)
window.OMD_EMOJI_MAP = {
${body}
};
`;
fs.writeFileSync(target, out);
console.log(`wrote ${path.relative(process.cwd(), target)} (${keys.length} shortcodes)`);
