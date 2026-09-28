# Input images (queries)

Place the photo(s) you want to recognize here.

```
input/
  test.jpg          ← the image that will be matched against data/
```

Then run:

```bash
npm test
```

Or pass a path directly:

```bash
node test.mjs /path/to/any/photo.jpg
```

If you put multiple images in `input/`, the test runs multi-frame voting:
3 agreeing frames → status CONFIRMED.
