# withnate-social-resize

Put one picture in and get it at every social media size you tick: Instagram, Facebook, X, LinkedIn,
Pinterest, TikTok, YouTube and WhatsApp. **The whole picture is kept.** The space around it is filled
with a blurred copy of the picture or a plain colour, instead of the platform cropping off a head or
a logo.

**Runs entirely in the browser.** No upload, no network requests, no storage. Built for
[withnate.co.uk](https://withnate.co.uk/tools/social-resize/) as a drop-in: one IIFE, one stylesheet,
and a demo page.

MIT licensed.

## Why it exists

"Resize image for instagram without cropping" is one of the most common things people search for
about Instagram. The usual answers are an app with an account, or an online tool that uploads your
photo. This does it on your own device, for many platforms at once, from one file.

## What it does

- **Fit: whole picture.** The picture is scaled until it touches one pair of edges, then centred.
  Nothing is cut off, and a test checks that for every preset and several extreme picture shapes.
- **Fit: fill.** The slot is filled and the edges are cut, and the tool says what percentage of
  the picture was lost for each size.
- **Around the picture:** a blurred, slightly darkened copy of the picture itself, or a plain colour
  you choose.
- **A warning when a slot is bigger than your picture**, because it then has to be enlarged and will
  look softer.
- Every size is shown as a preview with its own download, saved as JPEG at quality 90.

## Things the code is shaped around

- **The megapixel ceiling is read from the file header before decoding.** An 80 MP image is about
  320 MB once decoded, enough to crash a phone browser, so it is refused with its size named before a
  single pixel is allocated.
- **Phone photos are decoded with `imageOrientation: "from-image"`**, so they do not come out sideways.
- **Downscaling is done in steps of at most 2x**, landing exactly on the target size. One big jump
  skips most of the source pixels and looks jagged.
- **Only a checked hex colour reaches the canvas.** Anything else falls back to white.
- **Races:** each re-render takes a ticket and stops if a newer one has started, so a slow render
  cannot replace a fresh one.

## The sizes

The list is in `src/plan.ts` (`PRESETS`). These are the commonly published upload sizes. Platforms
change them without notice; if one is wrong, a pull request changing that one line is welcome.

## Integration

The bundle mounts on any element with `data-sr` and does nothing if there is none. The markup it
expects is in `src/markup.html` and in `demo/index.html`.

| Attribute | Element | Role |
|---|---|---|
| `data-sr` | any | Mount point |
| `data-sr-drop` | any | Drop zone; must contain an `input[type=file]` |
| `data-sr-status` | any | Reading, working, refusals |
| `data-sr-controls` | any | Hidden until a picture loads |
| `data-sr-presets` | any | Filled with platform checkboxes if empty |
| `data-sr-fit` | `select` | `contain` or `cover` |
| `data-sr-bg` | `select` | `blur` or `colour` |
| `data-sr-colour` | `input[type=color]` | Padding colour |
| `data-sr-results` | any | Preview cards with downloads |
| `data-sr-reset` | `button` | Clears the picture |

## Checks

- `npm test`: 17 tests over `src/plan.ts`, where every decision lives.
- `npm run prove`: switches off each of the seven guards in turn and confirms a test fails. All seven do.
- `npm run smoke`: builds, then checks the bundle has no network calls, no storage, no module syntax,
  no external URLs and no inline handlers, runs silently with no root element, and the stylesheet
  only defines `.sr-` classes.

## Built on

[`@nasdigitaluk/withnate-tool-core`](https://github.com/N-Graves/withnate-tool-core) for intake,
header measurement, `formatBytes` and the DOM helper, bundled into the artefact.

## Licence

MIT. See [LICENSE](LICENSE).
