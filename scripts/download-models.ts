/**
 * Downloads the three face-api.js model weight sets needed for detection,
 * landmarks and recognition into ./models/
 */
import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODELS_DIR = path.join(__dirname, "..", "models");
const BASE =
  "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights";

const FILES = [
  "tiny_face_detector_model-weights_manifest.json",
  "tiny_face_detector_model-shard1",
  "face_landmark_68_model-weights_manifest.json",
  "face_landmark_68_model-shard1",
  "face_recognition_model-weights_manifest.json",
  "face_recognition_model-shard1",
  "face_recognition_model-shard2",
] as const;

function download(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          file.close();
          fs.unlinkSync(dest);
          const location = res.headers.location;
          if (!location) {
            reject(new Error("Redirect without location"));
            return;
          }
          download(location, dest).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlinkSync(dest);
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        res.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
      })
      .on("error", (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
  });
}

fs.mkdirSync(MODELS_DIR, { recursive: true });

console.log("Downloading face-api.js models into models/ …");
for (const name of FILES) {
  const dest = path.join(MODELS_DIR, name);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 100) {
    console.log(`  skip (exists): ${name}`);
    continue;
  }
  process.stdout.write(`  ${name} … `);
  try {
    await download(`${BASE}/${name}`, dest);
    console.log("ok");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log("FAILED:", msg);
  }
}
console.log("Done. You can now run: npm test");
