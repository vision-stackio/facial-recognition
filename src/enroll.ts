/**
 * Helper: print how many reference faces are currently enrolled.
 * Usage: npm run enroll
 */
import { loadGallery } from "./pipeline.js";
import { config } from "./config.js";

const gallery = await loadGallery(config.dataPath);

const byPerson = new Map<string, number>();
for (const g of gallery) {
  byPerson.set(g.person, (byPerson.get(g.person) ?? 0) + 1);
}

console.log("=== Enrolled reference faces ===");
if (byPerson.size === 0) {
  console.log("  (none yet — put photos in data/<person-name>/)");
} else {
  for (const [person, count] of byPerson) {
    console.log(`  ${person}: ${count} face(s)`);
  }
}
console.log(`Total embeddings: ${gallery.length}`);
