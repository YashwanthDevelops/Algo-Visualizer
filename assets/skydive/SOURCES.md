# Skydiving homepage reference assets

Collected on 2026-11-04 from the public SkyDive homepage and its static asset URLs. This file records origin and retrieval details only; it makes no claim about licensing or reuse rights.

## Page and bundles

- Classic homepage: https://www.skydive.com/?home=classic — inspected as the reference page; HTML was not retained in this folder.
- Stylesheet: https://www.skydive.com/assets/main-cPbHUMLN.css — inspected upstream to identify font and image assets; the bundle is not retained in this folder.
- JavaScript bundle: https://www.skydive.com/assets/main-C8kXuvHy.js — inspected upstream to identify image assets; the bundle is not retained in this folder.

## Fonts

- Aeonik regular: https://www.skydive.com/fonts/aeonik-regular.woff2 — `aeonik-regular.woff2`.
- Aeonik medium: https://www.skydive.com/fonts/aeonik-medium.woff2 — `aeonik-medium.woff2`.
- Aeonik semibold: https://www.skydive.com/fonts/aeonik-semibold.woff2 — `aeonik-semibold.woff2`.
- Inter Latin standard normal: https://www.skydive.com/assets/inter-latin-standard-normal-BwkfbSeq.woff2 — saved as `inter.woff2`.

## Images

- Hero images `rq1.webp` through `rq16.webp`: `https://www.skydive.com/images/marketing/home-v3/hero-agents/rqN.webp`, where `N` is 1–16; saved under `hero/`. All 16 requested URLs returned successfully (HTTP 200).
- Mountain image: https://www.skydive.com/images/marketing/home/cta/mountains.webp — saved as `mountains.webp`.

Files were fetched as served by the origin with PowerShell `Invoke-WebRequest`; no image transformations were applied.
