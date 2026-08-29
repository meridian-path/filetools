# filetools design decisions

A short, dated log of deliberate design choices that a later reviewer or
audit might otherwise mistake for an oversight - kept here specifically so
the same finding isn't re-investigated from scratch each time it's noticed.

## 2026-08-29: tool-page breadcrumbs deliberately diverge from the URL path

**Finding:** every non-PDF tool lives at the flat `/data/<slug>/` URL, but
its breadcrumb shows the tool's real family folder instead (e.g.
`~ / developer / jwt-decoder`, not `~ / data / jwt-decoder`). A
reference-library audit flagged this as a mismatch worth resolving.

**Decision: kept, not changed.** This is the intended behavior from the
site-wide navigation/IA redesign, not an oversight (see
`src/pages/toolPage.js`'s own comment above its breadcrumb construction).
Google's own breadcrumb structured-data guidance explicitly supports a
curated hierarchy that doesn't have to mirror URL segments, and this
site's real 5-folder taxonomy (PDF/CSV & Spreadsheets/JSON & Data
Formats/Text/Developer/Image) is exactly that: a deliberately-built
display structure distinct from the flat `/data/` URL bucket every
non-PDF tool happens to share.

Migrating the 35 live, indexed URLs to match the breadcrumb instead was
considered and ruled out: this site deploys to GitHub Pages, which has no
server-side 301 redirect layer, so there is no way to move those URLs
without a real, permanent SEO cost (search-engine-visible content loss or
a much weaker meta-refresh substitute). Flattening the breadcrumb to match
the URL instead was also considered and rejected, since it would give up
a real, working part of the site's own "it's a file system" identity for
a purely cosmetic fix.
