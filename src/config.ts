/**
 * Face recognition thresholds — mirrors Vision's faceRecognitionConfig.
 * Conservative defaults: prefer UNKNOWN over a wrong match.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  /** Euclidean distance at/under which a candidate counts as a match. */
  matchDistance: 0.5,

  /** How many independent frames must agree before status = CONFIRMED. */
  requiredVotes: 3,

  /** Max votes kept per track before the window slides. */
  maxVotesPerTrack: 8,

  /** Min face size as fraction of the shorter image side. */
  minFaceSizeFraction: 0.08,

  /** face-api TinyFaceDetector confidence floor. */
  minDetectorConfidence: 0.5,

  /** Paths */
  modelsPath: path.join(__dirname, "..", "models"),
  dataPath: path.join(__dirname, "..", "data"),
  inputPath: path.join(__dirname, "..", "input"),
} as const;

export type FaceRecognitionConfig = typeof config;

export type IdentityStatus = "CONFIRMED" | "PROVISIONAL" | "UNKNOWN";

export interface FaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EmbeddingResult {
  descriptor: number[];
  box: FaceBox;
  confidence: number;
  mock: boolean;
}

export interface GalleryEntry {
  person: string;
  file: string;
  descriptor: number[];
  confidence: number;
}

export interface MatchResult {
  person: string;
  distance: number;
  file: string;
}

export interface VotingOutcome {
  status: IdentityStatus;
  person: string | null;
  agreeingVotes: number;
  totalVotes: number;
}
