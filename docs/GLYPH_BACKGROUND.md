# Hero glyph background

The dashboard hero mounts the supplied React glyph component as an island behind its existing text, portrait orbit, and introduction. Its container ends before “Compare what you find.” The rest of the application uses its existing vanilla JavaScript routes and renderers.

## Project structure

- `components/ui/backgrounds-glyph.tsx`: reusable React 19 / TypeScript component, including the supplied WebGL shaders and pointer waves.
- `components/hero-glyph.tsx`: dashboard mount/unmount adapter. Props are `glowColor="#f5f5f5"`, `shapeColor="#b6cbb8"`, `fontSize={10}`, and `interactive`.
- `components/demo.tsx`: standalone demo.
- `components/styles.css`: Tailwind v4 theme and utilities, scoped to the React island and demo. There is no Tailwind preflight reset.
- `lib/utils.ts`: shared `cn` export for future shadcn components.
- `components.json`: shadcn aliases, with `@/components/ui` as the UI component path and `@/lib/utils` for utilities.
- `tsconfig.json`: TypeScript, React JSX, DOM types, and `@/*` path resolution.
- `vite.config.ts`: builds the hero and analysis indicator as separate entry points under `assets/glyph`, sharing the React runtime. Their CSS is combined in `assets/glyph/hero-glyph.css`.
- `components/analysis-orb.tsx`: mounts the supplied `@aicss/react/orbs` S1 pill inside the image-analysis button while its request is pending. The indicator unmounts on completion, cancellation, failure, replacement, and navigation. It respects reduced motion, and its control footprint is reserved in `question-study.css`.

The original project had no React component directory or Tailwind/TypeScript configuration. `components/ui` gives future shadcn components a predictable home, makes the supplied `@/components/ui/...` import work, and matches the CLI aliases. Existing app styles remain in the root CSS files; new React utility styles belong in `components/styles.css`.

## Install and run

```sh
npm ci
npm run dev
```

The `predev` hook rebuilds the island before starting the app at `http://127.0.0.1:8001`. After changing a TSX file, rebuild with:

```sh
npm run typecheck
npm run build:glyph
```

Built assets are included with the static app, so the existing static hosting and Python server can serve the background too. GitHub Pages builds these assets before browser checks and deployment.

## Equivalent setup for a fresh project

For a new standalone React application, the shadcn CLI can scaffold a Vite project:

```sh
npx shadcn@latest init --template vite
npm install cn motion @animate-ui/react
```

For an existing Vite React project that needs the dependencies configured here:

```sh
npm install react react-dom cn motion @animate-ui/react
npm install -D typescript @types/react @types/react-dom vite tailwindcss @tailwindcss/vite
```

Register the Tailwind Vite plugin, point the shadcn CSS setting at the React stylesheet, and add the `@/*` alias in both TypeScript and Vite. This repository already includes that configuration. See the official [shadcn Vite setup](https://ui.shadcn.com/docs/installation/vite) and [Tailwind Vite setup](https://tailwindcss.com/docs/installation/using-vite).

## Behavior and cleanup

The background has no application data or shared state. Its wave ages, pointer trail, activity, and animation clock are local refs. The component includes its `ReducedMotionConfig` provider and Animate UI visibility hooks. It resizes with its container, caps device pixel ratio at two, pauses when offscreen or the page is hidden, and renders a static frame for reduced motion. Pointer waves are disabled under reduced motion. WebGL absence leaves the hero usable without a canvas effect.

Dashboard route cleanup unmounts the React root, cancels the frame callback, stops wave animations, disconnects the resize observer, and releases WebGL resources. The supplied implementation was extended with resource disposal and a minimum cell size for that lifecycle. No images, icons, or remote font assets are required by this procedural background.
