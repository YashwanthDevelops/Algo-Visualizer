import {defineConfig} from 'vite';
import tailwindcss from '@tailwindcss/vite';
import {fileURLToPath} from 'node:url';

export default defineConfig({
  plugins:[tailwindcss()],
  define:{'process.env.NODE_ENV':JSON.stringify('production')},
  resolve:{alias:{'@':fileURLToPath(new URL('.',import.meta.url))}},
  build:{
    outDir:'assets/glyph',emptyOutDir:true,minify:true,
    rollupOptions:{onwarn(warning, report){if(warning.code !== 'MODULE_LEVEL_DIRECTIVE') report(warning);}},
    lib:{entry:{
      'hero-glyph':fileURLToPath(new URL('./components/hero-glyph.tsx',import.meta.url)),
      'analysis-orb':fileURLToPath(new URL('./components/analysis-orb.tsx',import.meta.url)),
    },formats:['es'],fileName:(_format, name)=>`${name}.js`,cssFileName:'hero-glyph'},
  },
});
