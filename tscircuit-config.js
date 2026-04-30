// ============================================
// tscircuit-config.js - tscircuit Schematic Theme Configuration
// ============================================
//
// Used by the renderer when calling window.Tscircuit.renderSchematic().
// The actual color overrides for dark mode live inside the bundle entry
// (libs/tscircuit/bundle-entry.tsx → darkSchematicColors); this module
// exists for parity with mermaid-config.js / d2-config.js / omniware-config.js
// and as the place to add future theming options without rebuilding the bundle.

/**
 * Get tscircuit render options for the current theme.
 * @param {boolean} isDark - Whether dark mode is enabled
 * @returns {object} Options passed to window.Tscircuit.renderSchematic()
 */
function getTscircuitConfig(isDark) {
  return {
    isDark: !!isDark,
  };
}

module.exports = {
  getTscircuitConfig,
};
