# Test fixtures

Real binary files too large or too structurally complex to embed as an inline base64
literal in a test file (most fixtures here still use that inline approach - see
`test/imagesToPdf.e2e.test.mjs`'s `PNG_1PX_B64` for the precedent this directory
supplements, not replaces).

- `testsrc.heic` (2,968 bytes) - a real, valid HEIC-encoded synthetic test-pattern image,
  used by `test/heicToImages.e2e.test.mjs`. There is no practical way to encode a real HEIC
  file from inside this repo's own test setup (no browser API creates one, and this repo's
  one HEIC-capable library, heic2any, only decodes). Sourced from
  [imgdrop/imgdrop](https://github.com/imgdrop/imgdrop)'s own `images/testsrc.heic`, a
  project that generates exactly this kind of synthetic cross-format test image on purpose
  - not a real photo, no personal/third-party content. That repository is licensed under
  the Mozilla Public License 2.0 (see its own `LICENSE`); the image content itself carries
  no separate copyright notice.
  Verified before use, not assumed: real ISOBMFF/HEIF box structure (`ftypheic`/`mif1`
  brands, an `hvc1` codec box) confirmed by inspecting the raw bytes, and a real decode via
  this repo's own vendored heic2any confirmed live in a headless browser before this file was
  committed.
