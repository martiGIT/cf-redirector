/**
 * User-agent substrings of link-preview crawlers and search-engine bots.
 *
 * Design choice: bots are NOT blocked at write time. Every hit is stored raw,
 * and this list is applied as an optional SQL filter at READ time
 * (`/api/stats/:code?bots=exclude`). That keeps the redirect hot path free of
 * logic, preserves full data, and lets you tune the list without losing history.
 *
 * Messenger preview crawlers (WhatsApp, Telegram, Facebook, ...) are the main
 * source of phantom "clicks": they pre-fetch a URL once per message to build a
 * preview card before any human clicks.
 */
export const BOT_UA_PATTERNS = [
  "WhatsApp",
  "facebookexternalhit",
  "Facebot",
  "TelegramBot",
  "Twitterbot",
  "Slackbot",
  "Discordbot",
  "LinkedInBot",
  "SkypeUriPreview",
  "redditbot",
  "Pinterest",
  "vkShare",
  "Googlebot",
  "bingbot",
  "Applebot",
  "DuckDuckBot",
  "YandexBot",
];
