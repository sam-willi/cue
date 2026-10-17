/**
 * The statistics continuous learning relies on. Deliberately simple and explainable: a sign test
 * across sessions for "does this pattern hold up?", Beta posteriors for "do taps beat holding
 * back?", and plain means and medians. Nothing here is fitted to a population.
 */

export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

export function median(xs: number[]): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function quantile(xs: number[], q: number): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * s.length)))];
}

function choose(n: number, k: number): number {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

/**
 * One-sided sign test: the chance of `agree` or more of `n` sessions pointing the same way if
 * there were no real pattern (each session a coin flip). Small means the pattern is consistent.
 */
export function signTest(agree: number, n: number): number {
  let p = 0;
  for (let k = agree; k <= n; k++) p += choose(n, k);
  return p / 2 ** n;
}

/**
 * One-sided binomial tail: the chance of `k` or more of `n` events landing in a share `q` of the
 * time if they were spread evenly. Used to check that fillers really bunch up somewhere (at the
 * start of a turn, while speeding up) rather than landing there by chance.
 */
export function binomialTail(k: number, n: number, q: number): number {
  if (k <= 0) return 1;
  let p = 0;
  for (let i = k; i <= n; i++) p += choose(n, i) * q ** i * (1 - q) ** (n - i);
  return Math.min(1, p);
}

/** Confidence wording for a sign-test p-value. Needs at least 3 sessions, all agreeing, to say anything. */
export function confidenceLevel(p: number): "emerging" | "likely" | "strong" {
  return p <= 0.035 ? "strong" : p <= 0.07 ? "likely" : "emerging";
}

/** Standard normal CDF (Abramowitz & Stegun 7.1.26). */
export function normalCdf(z: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

/**
 * Probability that rate A beats rate B, from Beta(1 + successes, 1 + failures) posteriors with a
 * normal approximation. Used to ask: is "worked after a tap" more common than "worked anyway"?
 */
export function probBetter(aWins: number, aN: number, bWins: number, bN: number): number {
  const beta = (w: number, n: number) => {
    const a = 1 + w;
    const b = 1 + n - w;
    return { m: a / (a + b), v: (a * b) / ((a + b) ** 2 * (a + b + 1)) };
  };
  const A = beta(aWins, aN);
  const B = beta(bWins, bN);
  return normalCdf((A.m - B.m) / Math.sqrt(A.v + B.v));
}

/** A small deterministic random number generator (mulberry32), for repeatable simulations and tests. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const round1 = (x: number) => Math.round(x * 10) / 10;
export const pct = (x: number) => `${Math.round(x * 100)}%`;
