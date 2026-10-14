# Interface icons

Phosphor Regular icons, retrieved through the better-icons CLI from Iconify. Source: https://github.com/phosphor-icons/core. The MIT license is included in LICENSE.txt.

The app uses phosphor.svg as a same-origin SVG symbol sprite. js/icons.js provides the labeled-control helper; no runtime icon package or CDN request is needed. SVG icons are decorative and hidden from assistive technology; their adjacent labels provide the accessible name. The N-Queens board retains its full board description.

To retrieve an original icon during development:

```sh
npx better-icons get ph:play --json
```

Keep new interface icons in the Regular family so their weight and proportions stay consistent.
