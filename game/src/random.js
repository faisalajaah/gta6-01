// A small seeded random number generator (mulberry32): the same seed gives the same city,
// the same traffic and the same screenshot scenes, which is what makes the game repeatable.
export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** An integer in [min, max] from a seeded random. */
export function randomInt(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

/** One item of an array, picked by a seeded random. */
export function pick(random, items) {
  return items[Math.floor(random() * items.length)];
}

/** True with probability `p`, from a seeded random. */
export function chance(random, p) {
  return random() < p;
}

/** A number in [min, max) from a seeded random. */
export function randomRange(random, min, max) {
  return min + random() * (max - min);
}

/** A shuffled copy of an array (Fisher-Yates), from a seeded random. */
export function shuffle(random, items) {
  const copy = items.slice();
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    const held = copy[index];
    copy[index] = copy[other];
    copy[other] = held;
  }
  return copy;
}
