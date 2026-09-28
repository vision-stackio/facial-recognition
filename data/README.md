# Reference faces (enrollment data)

Put one folder per person. Each image inside becomes a reference embedding.

```
data/
  alice/
    photo1.jpg
    photo2.jpg
    photo3.jpg     ← 2–3 photos from different angles work best
  bob/
    photo1.jpg
```

Then run from the project root:

```bash
npm test
```

The test file loads every image here, computes embeddings, and matches
whatever you put in `input/` against them.
