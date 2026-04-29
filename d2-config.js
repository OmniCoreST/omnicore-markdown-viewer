// ============================================
// d2-config.js - D2 Theme Configuration
// ============================================

// D2 built-in theme IDs (subset). See https://d2lang.com/tour/themes
// 0   = Neutral default (light)
// 200 = Dark Mauve (dark)
const D2_LIGHT_THEME_ID = 0;
const D2_DARK_THEME_ID = 200;

/**
 * Get D2 compile/render options for the current theme.
 * @param {boolean} isDark - Whether dark mode is enabled
 * @returns {object} Options for d2.compile() / d2.render()
 */
function getD2Config(isDark) {
  return {
    layout: 'dagre',
    themeID: isDark ? D2_DARK_THEME_ID : D2_LIGHT_THEME_ID,
    pad: 20,
    center: false,
    sketch: false,
    noXMLTag: true
  };
}

module.exports = {
  D2_LIGHT_THEME_ID,
  D2_DARK_THEME_ID,
  getD2Config
};
