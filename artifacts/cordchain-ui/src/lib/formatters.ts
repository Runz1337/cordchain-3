/**
 * Global CordChain price and points formatters.
 * Formats tokens with up to 5 decimal places for sub-dollar and sub-$10 assets,
 * accommodating micro-penny market dynamics cleanly without wrapping or card overflow.
 */

export const fmtPoints = (n: number | string | null | undefined): string => {
  const num = Number(n);
  if (isNaN(num) || num <= 0) return '0.00000';
  if (num < 10) return num.toFixed(5);
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const fmtPrice = fmtPoints;

export const fmtUsd = (n: number | string | null | undefined): string => {
  return `$${fmtPoints(n)}`;
};

export const fmtPriceInput = (n: number | string | null | undefined): string => {
  const num = Number(n);
  if (isNaN(num) || num <= 0) return '0.00010';
  if (num < 10) return num.toFixed(5);
  return num.toFixed(2);
};
