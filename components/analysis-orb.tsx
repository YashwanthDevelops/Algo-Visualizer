import {createRoot} from 'react-dom/client';
import type {CSSProperties} from 'react';
import {Orb} from '@aicss/react/orbs';

export function mountAnalysisOrb(host: HTMLElement) {
  const root = createRoot(host);
  root.render(<Orb variant="S1" pill className="analysis-orb" style={{
    '--orb-fg':'#151a17',
    '--orb-pill-bg':'transparent',
    '--orb-pill-shadow':'none',
    '--orb-label':'#333e36',
  } as CSSProperties} />);
  return () => root.unmount();
}
