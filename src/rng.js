// Mulberry32: small, fast seedable PRNG. Returns a function producing floats in [0, 1).
export function createRng(seed = Date.now()) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randRange(rng, min, max) {
  return min + (max - min) * rng();
}

export function randInt(rng, min, maxInclusive) {
  return Math.floor(randRange(rng, min, maxInclusive + 1));
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

// Picks an index from a list of non-negative weights.
export function weightedIndex(rng, weights) {
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i];
    if (roll < 0) return i;
  }
  return weights.length - 1;
}
