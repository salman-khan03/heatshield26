export const fmtInt = (n: number) => Math.round(n).toLocaleString("en-US");

export const fmtMoney = (n: number) => {
  if (Math.abs(n) >= 1_000_000) {
    const m = n / 1_000_000;
    return `$${Number.isInteger(m) ? m.toFixed(0) : m.toFixed(2)}M`;
  }
  if (n === 0) return "$0";
  return `$${Math.round(n / 1000)}K`;
};

export const fmtCompact = (n: number) =>
  Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

export const fmtMi = (m: number) => `${(m / 1609.34).toFixed(2)} mi`;

export const pctChange = (from: number, to: number) => (from === 0 ? 0 : ((to - from) / from) * 100);
