const SUFFIXES = ['', 'K', 'M', 'B', 'T'];

// 1234 -> "1.23K", 50690000 -> "50.69M". Past T it continues aa, ab, ... az, ba, ...
export function formatNumber(value) {
  if (!Number.isFinite(value)) return '∞';
  const sign = value < 0 ? '-' : '';
  let n = Math.abs(value);
  if (n < 1000) return sign + (n < 10 && n % 1 !== 0 ? n.toFixed(1) : Math.floor(n).toString());
  let tier = Math.floor(Math.log10(n) / 3);
  let scaled = n / Math.pow(1000, tier);
  // Rounding can push 999.995 up to "1000.00"; carry it into the next tier instead.
  if (Number(scaled.toFixed(2)) >= 1000) {
    tier += 1;
    scaled /= 1000;
  }
  return sign + scaled.toFixed(2) + suffixFor(tier);
}

function suffixFor(tier) {
  if (tier < SUFFIXES.length) return SUFFIXES[tier];
  const i = tier - SUFFIXES.length;
  const first = String.fromCharCode(97 + Math.floor(i / 26) % 26);
  const second = String.fromCharCode(97 + (i % 26));
  return first + second;
}

export function formatPercent(value, digits = 1) {
  return `${value.toFixed(digits)}%`;
}

export function formatDuration(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h} ชม. ${m} นาที`;
  if (m > 0) return `${m} นาที`;
  return `${s} วินาที`;
}
