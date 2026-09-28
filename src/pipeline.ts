/**
 * Core face-recognition pipeline (Vision-style):
 *   load image → detect face → compute 128-d embedding → nearest neighbor
 *
 * Uses face-api.js (TinyFaceDetector + FaceRecognitionNet / ResNet-34).
 * Falls back to a deterministic mock when models are missing so `npm test`
 * still exercises the full flow.
 */

import fs from "node:fs";
import path from "node:path";
import {
  config,
  type EmbeddingResult,
  type GalleryEntry,
  type MatchResult,
  type VotingOutcome,
  type IdentityStatus,
} from "./config.js";

let faceapi: typeof import("face-api.js") | null = null;
let canvas: typeof import("canvas") | null = null;
let modelsLoaded = false;
let useMock = false;

async function ensureModels(): Promise<void> {
  if (modelsLoaded) return;

  try {
    canvas = await import("canvas");
    faceapi = await import("face-api.js");

    const { Canvas, Image, ImageData } = canvas;
    // face-api expects browser globals; monkey-patch for Node
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (faceapi as any).env.monkeyPatch({ Canvas, Image, ImageData });

    const modelsDir = config.modelsPath;
    if (
      !fs.existsSync(
        path.join(modelsDir, "tiny_face_detector_model-weights_manifest.json")
      )
    ) {
      throw new Error("Models not found. Run: npm run download-models");
    }

    await faceapi.nets.tinyFaceDetector.loadFromDisk(modelsDir);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(modelsDir);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(modelsDir);

    modelsLoaded = true;
    useMock = false;
    console.log("  [pipeline] face-api models loaded");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(
      "  [pipeline] Models unavailable — using MOCK embeddings:",
      message
    );
    useMock = true;
    modelsLoaded = true;
  }
}

/**
 * Compute a 128-d face descriptor for the largest face in the image.
 */
export async function computeEmbedding(
  imagePath: string
): Promise<EmbeddingResult | null> {
  await ensureModels();

  if (useMock) {
    // Deterministic pseudo-embedding from file *content* only so the
    // same photo always produces the same vector regardless of path.
    const buf = fs.readFileSync(imagePath);
    let seed = 0;
    for (let i = 0; i < Math.min(buf.length, 256); i++) {
      seed = (seed * 31 + buf[i]!) >>> 0;
    }
    const descriptor = Array.from({ length: 128 }, (_, i) =>
      Math.sin((seed + 1) * (i + 1) * 0.017) * 0.5
    );
    return {
      descriptor,
      box: { x: 10, y: 10, width: 100, height: 100 },
      confidence: 0.9,
      mock: true,
    };
  }

  if (!faceapi || !canvas) return null;

  const img = await canvas.loadImage(imagePath);
  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: 416,
    scoreThreshold: config.minDetectorConfidence,
  });

  const detection = await faceapi
    .detectSingleFace(img, options)
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) return null;

  const { x, y, width, height } = detection.detection.box;
  const shorter = Math.min(img.width, img.height);
  if (Math.min(width, height) / shorter < config.minFaceSizeFraction) {
    return null; // face too small
  }

  return {
    descriptor: Array.from(detection.descriptor),
    box: { x, y, width, height },
    confidence: detection.detection.score,
    mock: false,
  };
}

/** Euclidean distance between two equal-length vectors. */
export function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/**
 * Load every image under data/<personName>/*.jpg|png and build a gallery.
 */
export async function loadGallery(
  dataDir: string = config.dataPath
): Promise<GalleryEntry[]> {
  await ensureModels();
  const gallery: GalleryEntry[] = [];

  if (!fs.existsSync(dataDir)) {
    console.warn(`  [pipeline] data/ folder missing: ${dataDir}`);
    return gallery;
  }

  const people = fs
    .readdirSync(dataDir, { withFileTypes: true })
    .filter((d) => d.isDirectory());

  for (const person of people) {
    const personDir = path.join(dataDir, person.name);
    const files = fs
      .readdirSync(personDir)
      .filter((f) => /\.(jpe?g|png|webp)$/i.test(f));

    for (const file of files) {
      const full = path.join(personDir, file);
      try {
        const emb = await computeEmbedding(full);
        if (emb) {
          gallery.push({
            person: person.name,
            file,
            descriptor: emb.descriptor,
            confidence: emb.confidence,
          });
        } else {
          console.warn(
            `  [pipeline] no face in reference: ${person.name}/${file}`
          );
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(`  [pipeline] failed ${person.name}/${file}: ${msg}`);
      }
    }
  }

  return gallery;
}

/**
 * Find the nearest person in the gallery for a query embedding.
 */
export function findNearest(
  descriptor: number[],
  gallery: GalleryEntry[],
  maxDistance: number = config.matchDistance
): MatchResult | null {
  let best: MatchResult | null = null;
  for (const entry of gallery) {
    const dist = euclideanDistance(descriptor, entry.descriptor);
    if (dist <= maxDistance && (!best || dist < best.distance)) {
      best = { person: entry.person, distance: dist, file: entry.file };
    }
  }
  return best;
}

interface IdentityVote {
  person: string | null;
  distance: number;
}

/**
 * Multi-frame identity voting (same idea as Vision's multiFrameIdentity.ts).
 * Call castVote() once per frame; status becomes CONFIRMED after
 * requiredVotes agreeing person IDs.
 */
export class MultiFrameVoter {
  private readonly required: number;
  private readonly maxVotes: number;
  private votes: IdentityVote[] = [];

  constructor(
    required: number = config.requiredVotes,
    maxVotes: number = config.maxVotesPerTrack
  ) {
    this.required = required;
    this.maxVotes = maxVotes;
  }

  castVote(person: string | null, distance: number): VotingOutcome {
    this.votes.push({ person, distance });
    if (this.votes.length > this.maxVotes) this.votes.shift();
    return this.tally();
  }

  tally(): VotingOutcome {
    const counts = new Map<string, number>();
    for (const v of this.votes) {
      if (!v.person) continue;
      counts.set(v.person, (counts.get(v.person) ?? 0) + 1);
    }

    let leading: string | null = null;
    let leadingCount = 0;
    for (const [person, count] of counts) {
      if (count > leadingCount) {
        leading = person;
        leadingCount = count;
      }
    }

    const status: IdentityStatus =
      leadingCount >= this.required && leading
        ? "CONFIRMED"
        : leading
          ? "PROVISIONAL"
          : "UNKNOWN";

    return {
      status,
      person: leading,
      agreeingVotes: leadingCount,
      totalVotes: this.votes.length,
    };
  }
}
