// Run: node web/sprites.test.js  (no DOM needed: grids are plain data)
import assert from "node:assert/strict";
import { GRIDS, FONT } from "./sprites.js";

const KNOWN = new Set("#aewroybk.");
const rect = (name, g, w, h) => {
  assert.equal(g.length, h, `${name}: ${h} rows (got ${g.length})`);
  g.forEach((row, i) => {
    assert.equal(row.length, w, `${name} row ${i}: ${w} columns (got ${row.length}: "${row}")`);
    for (const ch of row) assert.ok(KNOWN.has(ch), `${name} row ${i}: unknown palette char "${ch}"`);
  });
};

// the dino grids are exactly half the sim hitbox (28x30 standing, 28x16 ducking), so they draw at a clean 2x
for (const n of ["DINO_RUN_A", "DINO_RUN_B", "DINO_JUMP"]) rect(n, GRIDS[n], 14, 15);
for (const n of ["DINO_DUCK_A", "DINO_DUCK_B"]) rect(n, GRIDS[n], 14, 8);
GRIDS.STATIC.forEach((g, i) => rect(`STATIC[${i}]`, g, 8, 8));
for (const n of ["BIRD_UP", "BIRD_DOWN", "DRONE_A", "DRONE_B"]) rect(n, GRIDS[n], 14, 7);
rect("HOPPER", GRIDS.HOPPER, 10, 10);
for (const n of ["WEED_A", "WEED_B", "SNOWBALL", "BOULDER", "METEOR", "COIN_A", "COIN_B"]) rect(n, GRIDS[n], 8, 8);
rect("VENT", GRIDS.VENT, 12, 4);
rect("HEART", GRIDS.HEART, 7, 6);
rect("CLOUD", GRIDS.CLOUD, 16, 4);

// the digits and letters the HUD draws all exist
for (const ch of "0123456789HISTDM") {
  assert.ok(FONT[ch], `font has ${ch}`);
  assert.equal(FONT[ch].length, 5);
  for (const row of FONT[ch]) assert.equal(row.length, 3, `font ${ch} rows are 3 wide`);
}

// the dino has exactly one eye cell and a head in every frame
for (const n of ["DINO_RUN_A", "DINO_RUN_B", "DINO_JUMP", "DINO_DUCK_A", "DINO_DUCK_B"]) {
  assert.equal(GRIDS[n].join("").split("e").length - 1, 1, `${n} has one eye`);
}

console.log("ok: sprite grids are well formed");
