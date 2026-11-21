/** Legal references used in Polish messages. */
export const RO_2016 = 'rozp. PRM z 4.04.2016';
export const RP_2015 = 'rozp. PRM z 23.07.2015';

const EPSILON = 1e-9;

/**
 * Formats a number the Polish way, truncated (not rounded) to `decimals`,
 * so a value just under a threshold is never displayed as the threshold.
 * 4.2 -> "4,20", 55 / 7 -> "7,85".
 */
export function formatPl(value: number, decimals = 2): string {
  const factor = 10 ** decimals;
  const truncated = Math.floor(value * factor + EPSILON) / factor;
  return truncated.toFixed(decimals).replace('.', ',');
}

/** "ORGANIZACJA PRACY i ORIENTACJA..." -> "Organizacja pracy i orientacja...". */
export function displayName(name: string): string {
  const lower = name.toLocaleLowerCase('pl-PL');
  return lower.charAt(0).toLocaleUpperCase('pl-PL') + lower.slice(1);
}

/** "1, 3, 5, 7 lub 9" */
export function listPoints(points: readonly number[]): string {
  if (points.length <= 1) return points.join('');
  return `${points.slice(0, -1).join(', ')} lub ${points[points.length - 1]}`;
}

export function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= EPSILON;
}
