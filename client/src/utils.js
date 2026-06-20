export function formatLargeNumber(num) {
  if (num == null || isNaN(num)) return '0';
  if (num >= 1e8) return (num / 1e8).toFixed(1) + '亿';
  if (num >= 1e4) return (num / 1e4).toFixed(1) + '万';
  return num.toLocaleString();
}

export function truncateText(text, maxLen = 10) {
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
}
