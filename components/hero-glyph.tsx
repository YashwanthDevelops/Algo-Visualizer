import {createRoot} from 'react-dom/client';
import {GlyphBackground} from '@/components/ui/backgrounds-glyph';
import '@/components/styles.css';

export function mountHeroGlyph(host: HTMLElement) {
  const root = createRoot(host);
  root.render(<GlyphBackground glowColor="#f5f5f5" shapeColor="#b6cbb8" fontSize={10} interactive />);
  return () => root.unmount();
}
