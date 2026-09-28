#!/usr/bin/env node
/**
 * ROOT TEST FILE (TypeScript)
 * ---------------------------
 * Runs facial recognition on every image in input/ against the reference
 * faces stored in data/.
 *
 * Layout expected:
 *   input/          ← query image(s) to recognize
 *   data/
 *     <person-a>/   ← 1–N reference photos of person A
 *     <person-b>/   ← 1–N reference photos of person B
 *
 * Usage:
 *   npm test
 *   npx tsx test.ts
 *   npx tsx test.ts input/my-photo.jpg
 */

import fs from "node:fs";
import path from "node:path";
import {
  loadGallery,
  computeEmbedding,
  findNearest,
  MultiFrameVoter,
} from "./src/pipeline.js";
import { config } from "./src/config.js";

const args = process.argv.slice(2);

function listImages(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .map((f) => path.join(dir, f));
}

async function main(): Promise<void> {
  console.log("=== Facial Recognition Test (TypeScript) ===\n");

  // 1. Load reference faces from data/
  console.log("Loading reference faces from data/ …");
  const gallery = await loadGallery(config.dataPath);

  const byPerson = new Map<string, number>();
  for (const g of gallery) {
    byPerson.set(g.person, (byPerson.get(g.person) ?? 0) + 1);
  }

  if (gallery.length === 0) {
    console.log(`
  No reference faces found.

  To enroll people, create folders under data/ and put photos inside:

    data/
      alice/
        photo1.jpg
        photo2.jpg      ← 2–3 photos work great
      bob/
        photo1.jpg

  Then re-run: npm test
`);
    process.exit(1);
  }

  console.log(
    "  Reference people:",
    [...byPerson.entries()]
      .map(([n, c]) => `${n} (${c} face${c > 1 ? "s" : ""})`)
      .join(", ")
  );
  console.log();

  // 2. Collect query images
  let queries: string[] = [];
  if (args.length > 0) {
    queries = args.filter((p) => fs.existsSync(p));
  } else {
    queries = listImages(config.inputPath);
  }

  if (queries.length === 0) {
    console.log(`
  No input images found.

  Place a photo to recognize in:

    input/test.jpg

  (or pass a path: npx tsx test.ts /path/to/photo.jpg)
`);
    process.exit(1);
  }

  // 3. Recognize each query (with multi-frame voting across them)
  const voter = new MultiFrameVoter();

  for (const imagePath of queries) {
    console.log(`Processing: ${path.relative(process.cwd(), imagePath)}`);

    const emb = await computeEmbedding(imagePath);
    if (!emb) {
      console.log("  Face detected: no");
      console.log("  Status: UNKNOWN (no usable face)\n");
      voter.castVote(null, Infinity);
      continue;
    }

    console.log(
      `  Face detected: yes  (confidence ${(emb.confidence * 100).toFixed(0)}%)${emb.mock ? "  [MOCK]" : ""}`
    );
    console.log(`  Embedding: ${emb.descriptor.length}-d`);

    const match = findNearest(emb.descriptor, gallery);
    if (!match) {
      console.log("  Best match: (none within threshold)");
      const outcome = voter.castVote(null, Infinity);
      console.log(`  Status: ${outcome.status}\n`);
      continue;
    }

    console.log(
      `  Best match: ${match.person}  (distance ${match.distance.toFixed(3)}, ref: ${match.file})`
    );
    const outcome = voter.castVote(match.person, match.distance);
    console.log(
      `  Status: ${outcome.status}  (votes ${outcome.agreeingVotes}/${outcome.totalVotes}, need ${config.requiredVotes} for CONFIRMED)\n`
    );
  }

  // Final verdict if multiple frames were processed
  if (queries.length > 1) {
    const final = voter.tally();
    console.log("--- Final multi-frame result ---");
    console.log(`  Person : ${final.person ?? "(unknown)"}`);
    console.log(`  Status : ${final.status}`);
    console.log(`  Votes  : ${final.agreeingVotes}/${final.totalVotes}`);
  }

  console.log("\nDone.");
}

main().catch((err: unknown) => {
  console.error("Fatal:", err);
  process.exit(1);
});
