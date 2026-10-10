/*
 * Sudoku engine: puzzle generation, uniqueness check and difficulty grading.
 * Exposed as window.Sudoku (classic script, no build step needed).
 */
(function (global) {
  'use strict';

  const ALL = 0x1ff;
  const ROW = [];
  const COL = [];
  const BOX = [];
  const PEERS = [];
  const UNITS = [];

  for (let i = 0; i < 81; i++) {
    ROW[i] = (i / 9) | 0;
    COL[i] = i % 9;
    BOX[i] = ((ROW[i] / 3) | 0) * 3 + ((COL[i] / 3) | 0);
  }
  for (let u = 0; u < 9; u++) {
    UNITS.push([], [], []);
  }
  for (let i = 0; i < 81; i++) {
    UNITS[ROW[i] * 3].push(i);
    UNITS[COL[i] * 3 + 1].push(i);
    UNITS[BOX[i] * 3 + 2].push(i);
  }
  for (let i = 0; i < 81; i++) {
    const peers = [];
    for (let j = 0; j < 81; j++) {
      if (j !== i && (ROW[i] === ROW[j] || COL[i] === COL[j] || BOX[i] === BOX[j])) peers.push(j);
    }
    PEERS[i] = peers;
  }

  // Hardness scale: 1 = naked singles suffice, 2 = needs hidden singles,
  // 3 = needs techniques beyond singles. Each level targets a clue count and a hardness range.
  const DIFFICULTY = {
    easy: { clues: 40, min: 1, max: 1 },
    medium: { clues: 33, min: 2, max: 2 },
    hard: { clues: 28, min: 2, max: 3 },
    expert: { clues: 24, min: 3, max: 3 },
  };
  const MAX_ATTEMPTS = 60;

  const bit = (d) => 1 << (d - 1);

  function popcount(x) {
    let c = 0;
    while (x) {
      x &= x - 1;
      c++;
    }
    return c;
  }

  function digitOf(mask) {
    for (let d = 1; d <= 9; d++) if (mask === bit(d)) return d;
    return 0;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rand) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function candidates(grid, i) {
    let used = 0;
    const peers = PEERS[i];
    for (let k = 0; k < peers.length; k++) {
      const v = grid[peers[k]];
      if (v) used |= bit(v);
    }
    return ALL & ~used;
  }

  function fillGrid(rand) {
    const g = new Array(81).fill(0);
    function fill(i) {
      if (i === 81) return true;
      const mask = candidates(g, i);
      const digits = [];
      for (let d = 1; d <= 9; d++) if (mask & bit(d)) digits.push(d);
      shuffle(digits, rand);
      for (const d of digits) {
        g[i] = d;
        if (fill(i + 1)) return true;
      }
      g[i] = 0;
      return false;
    }
    fill(0);
    return g;
  }

  // Counts solutions, stopping once `limit` is reached.
  function countSolutions(grid, limit) {
    limit = limit || 2;
    const g = grid.slice();
    let count = 0;
    function search() {
      let best = -1;
      let bestMask = 0;
      let bestCount = 10;
      for (let i = 0; i < 81; i++) {
        if (g[i]) continue;
        const m = candidates(g, i);
        const c = popcount(m);
        if (c === 0) return;
        if (c < bestCount) {
          best = i;
          bestMask = m;
          bestCount = c;
          if (c === 1) break;
        }
      }
      if (best === -1) {
        count++;
        return;
      }
      for (let d = 1; d <= 9; d++) {
        if (!(bestMask & bit(d))) continue;
        g[best] = d;
        search();
        if (count >= limit) break;
      }
      g[best] = 0;
    }
    search();
    return count;
  }

  // Returns the hardest technique needed (1 = naked singles, 2 = hidden singles),
  // or 0 if singles alone cannot finish the puzzle.
  function logicLevel(grid) {
    const g = grid.slice();
    let level = 1;
    for (;;) {
      let progress = false;
      let done = true;
      for (let i = 0; i < 81; i++) {
        if (g[i]) continue;
        done = false;
        const m = candidates(g, i);
        if (m === 0) return 0;
        if (popcount(m) === 1) {
          g[i] = digitOf(m);
          progress = true;
        }
      }
      if (done) return level;
      if (progress) continue;

      for (const unit of UNITS) {
        for (let d = 1; d <= 9; d++) {
          let spot = -1;
          let n = 0;
          for (const i of unit) {
            if (g[i] === d) {
              n = -1;
              break;
            }
            if (!g[i] && candidates(g, i) & bit(d)) {
              spot = i;
              n++;
            }
          }
          if (n === 1) {
            g[spot] = d;
            progress = true;
          }
        }
      }
      if (!progress) return 0;
      level = 2;
    }
  }

  function hardness(grid) {
    const lv = logicLevel(grid);
    return lv === 0 ? 3 : lv;
  }

  function generate(difficulty, seed) {
    const cfg = DIFFICULTY[difficulty] || DIFFICULTY.medium;
    if (seed === undefined || seed === null) seed = Math.floor(Math.random() * 4294967296);
    const rand = mulberry32(seed); // same seed -> same puzzle (daily challenge)
    let best = null;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const p = carve(cfg, rand);
      const h = hardness(p.puzzle);
      if (h >= cfg.min && h <= cfg.max) return Object.assign(p, { difficulty, seed });
      if (!best || Math.abs(h - cfg.min) < Math.abs(best.h - cfg.min)) best = Object.assign(p, { h });
    }
    delete best.h;
    return Object.assign(best, { difficulty, seed });
  }

  function carve(cfg, rand) {
    const solution = fillGrid(rand);
    const puzzle = solution.slice();
    let clues = 81;

    const order = shuffle(Array.from({ length: 41 }, (_, i) => i), rand);
    for (const i of order) {
      if (clues <= cfg.clues) break;
      const j = 80 - i; // keep the classic rotational symmetry
      const a = puzzle[i];
      const b = puzzle[j];
      puzzle[i] = 0;
      puzzle[j] = 0;
      let ok = countSolutions(puzzle, 2) === 1;
      if (ok && cfg.max < 3) ok = hardness(puzzle) <= cfg.max;
      if (ok) {
        clues -= i === j ? 1 : 2;
      } else {
        puzzle[i] = a;
        puzzle[j] = b;
      }
    }

    return { puzzle, solution };
  }

  function seedFromString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  global.Sudoku = {
    generate,
    countSolutions,
    logicLevel,
    seedFromString,
    PEERS,
    ROW,
    COL,
    BOX,
    bit,
    DIFFICULTIES: Object.keys(DIFFICULTY),
  };
})(window);
