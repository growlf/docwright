#!/usr/bin/env node
/**
 * make-lossy.mjs — derive a lossy variant of a fixture for the self-heal test.
 *
 * Drops 50% of `message.part.delta` events (every other one, deterministically)
 * while retaining ALL other events — crucially every `message.part.updated`
 * snapshot. Per Constraint 9 the renderer treats deltas as an optimization and
 * part.updated snapshots as source of truth, so a renderer fed this lossy stream
 * must still converge to text byte-identical to the lossless run (step 3.1 test).
 *
 * Deterministic (no RNG) so the fixture is reproducible and reviewable.
 *
 * Usage: node make-lossy.mjs <in.jsonl> <out.jsonl>
 */
import fs from 'node:fs';

const [inFile, outFile] = process.argv.slice(2);
if (!inFile || !outFile) {
  console.error('usage: node make-lossy.mjs <in.jsonl> <out.jsonl>');
  process.exit(2);
}

const lines = fs.readFileSync(inFile, 'utf8').split('\n').filter(Boolean);
let deltaSeen = 0;
let dropped = 0;
const kept = [];
for (const line of lines) {
  const evt = JSON.parse(line);
  if (evt.type === 'message.part.delta') {
    // drop every other delta (odd occurrences)
    if (deltaSeen % 2 === 1) {
      dropped++;
      deltaSeen++;
      continue;
    }
    deltaSeen++;
  }
  kept.push(line);
}

fs.writeFileSync(outFile, kept.join('\n') + '\n');
console.error(
  `deltas: ${deltaSeen} total, dropped ${dropped} (${Math.round((dropped / deltaSeen) * 100)}%); ` +
    `wrote ${kept.length}/${lines.length} events → ${outFile}`,
);
