<p align="center">
<a>
<img alt="Vision Logo" src="assets/Vision.png" width="132">
</a>
</p>

<p align="center">
<img alt="TypeScript" src="https://img.shields.io/badge/typescript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white" />
<img alt="Node" src="https://img.shields.io/badge/node-18%2B-339933?style=flat-square&logo=node.js&logoColor=white" />
<img alt="Bun" src="https://img.shields.io/badge/bun-supported-f9f1e1?style=flat-square&logo=bun&logoColor=black" />
</p>

<p align="center">
Standalone face recognition pipeline inspired by Vision's robot brain — enroll faces, match a query image, multi-frame voting to CONFIRMED.
</p>

> **Note:** This is a pure TypeScript demo. It runs with **no native dependencies** (no `canvas` build). Default mode uses deterministic MOCK embeddings so install and tests work on Windows, WSL, and Bun. Same photo content always produces the same vector, so matching is reliable for learning the pipeline.

---

## Table of Contents
1. [What it does](#-what-it-does)
2. [Layout](#-layout)
3. [Setup](#-setup)
4. [Run the test](#-run-the-test)
5. [Try it](#-try-it)
6. [How recognition works](#-how-recognition-works)
7. [Notes & Technical Details](#-notes--technical-details)

<br/>

## What it does

- **Enroll from folders** — each subfolder under `data/` is a person; every image inside becomes a reference embedding.
- **Match a query** — place a photo in `input/` (or pass a path); the pipeline embeds it and finds the nearest person.
- **Distance threshold** — Euclidean distance ≤ `0.5` counts as a candidate match (configurable).
- **Multi-frame voting** — one agreeing frame → `PROVISIONAL`; **3** agreeing frames → `CONFIRMED` (same idea as Vision's live recognizer).
- **Terminal-first** — one command runs the whole flow; no UI required.

<br/>

## Layout

| Path | What's there |
|------|----------------|
| `test.ts` | Root test — loads `data/`, processes `input/`, prints match + status |
| `input/` | Query image(s) to recognize |
| `data/<person>/` | Reference photos (2–3 per person is enough) |
| `src/config.ts` | Thresholds (`matchDistance`, `requiredVotes`, paths) |
| `src/pipeline.ts` | Embedding, gallery load, nearest-neighbor, multi-frame voter |
| `src/enroll.ts` | List how many faces are enrolled per person |
| `tsconfig.json` | TypeScript config |

<br/>

## Setup

```bash
# Install dependencies (TypeScript + tsx only — no native compile)
npm install

# or: bun install
```

Works from:

| Environment | Notes |
|-------------|--------|
| **Linux / macOS** | `npm install` then `npm test` |
| **WSL** | Prefer project under `~/` (not only `/mnt/c/...`) to avoid symlink issues |
| **Windows** | `npm install` or `bun install`; run with `npx tsx test.ts` |

No `.env` required. No API keys. No model download required for the default MOCK path.

<br/>

## Run the test

```bash
npm test
# or: npx tsx test.ts
# or: bunx tsx test.ts
```

Optional:

```bash
npm run enroll      # list enrolled people and face counts
npm run typecheck   # tsc --noEmit
```

Pass a specific image:

```bash
npx tsx test.ts path/to/photo.jpg
```

<br/>

## Try it

| You do | What happens |
|--------|----------------|
| Put photos in `data/alice/` and `data/bob/` | Gallery builds on next `npm test` |
| Put a photo of Alice in `input/test.jpg` | Best match → `alice`, status `PROVISIONAL` (1 frame) |
| Put 3 similar frames in `input/` | After 3 agreeing votes → status `CONFIRMED` |
| Use a photo of someone not in `data/` | Best match none / `UNKNOWN` |
| Change `matchDistance` in `src/config.ts` | Tighter or looser matching |

**Enroll your own faces:**

```text
data/
  yourname/
    photo1.jpg
    photo2.jpg
    photo3.jpg     ← 2–3 angles/lighting is ideal
input/
  test.jpg         ← the image to recognize
```

Then:

```bash
npm test
```

<br/>

## How recognition works

```text
input image
    ↓
embedding (128-d vector from file content in MOCK mode)
    ↓
nearest-neighbor search against data/ gallery
    ↓
distance ≤ matchDistance? → candidate person
    ↓
multi-frame voting → PROVISIONAL | CONFIRMED | UNKNOWN
```

| Stage | Behavior |
|-------|----------|
| **Enrollment** | Every image under `data/<person>/` becomes one reference vector |
| **Query** | `input/` images (or CLI paths) are embedded the same way |
| **Match** | Lowest Euclidean distance under threshold wins |
| **Voting** | Track accumulates votes; `requiredVotes` (default **3**) → `CONFIRMED` |

This mirrors Vision's pipeline shape (embed → nearest neighbor → multi-frame identity voting), simplified into a single local project.

<br/>

## Notes & Technical Details

* **MOCK by design:** Embeddings are deterministic from file bytes. Identical content always matches; different files get different vectors. No GPU, no model weights, no `canvas` native build.
* **Why not real face-api by default?** `canvas` + prebuilt binaries often fail on Windows Node 26, Bun, and WSL mounts under `/mnt/c`. Keeping zero native deps makes `npm install` and `npm test` reliable everywhere.
* **Status meanings:** `CONFIRMED` = enough agreeing frames to act on; `PROVISIONAL` = leaning toward a person but not yet confirmed; `UNKNOWN` = no usable match.
* **Config:** All thresholds live in `src/config.ts` — `matchDistance` (default `0.5`), `requiredVotes` (default `3`), `maxVotesPerTrack`, paths to `data/` and `input/`.
* **Safety of interpretation:** A single frame never becomes `CONFIRMED`. That matches Vision's conservative live recognizer (avoid trusting one lucky frame).
* **Sample data:** The project includes placeholder JPEGs under `data/alice`, `data/bob`, and `input/test.jpg` so the first `npm test` produces a visible match without your own photos.

<br/>
