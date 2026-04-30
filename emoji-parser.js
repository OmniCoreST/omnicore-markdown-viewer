/**
 * Emoji Parser - Converts emoji shortcodes to Unicode characters
 * Example: :star: -> ⭐
 */

const emojiMap = require('./emoji-map');

/**
 * Replace emoji shortcodes with actual emoji characters
 * @param {string} text - Text containing emoji shortcodes like :star:
 * @returns {string} Text with shortcodes replaced by emojis
 */
function parseEmojis(text) {
  // Match :emoji_name: pattern
  // Must be word characters, numbers, underscores, hyphens, or plus signs
  return text.replace(/:([a-zA-Z0-9_+-]+):/g, (match, emojiName) => {
    // Look up the emoji in the map
    const emoji = emojiMap[emojiName];

    // Return the emoji if found, otherwise return the original match
    return emoji || match;
  });
}

module.exports = { parseEmojis };
