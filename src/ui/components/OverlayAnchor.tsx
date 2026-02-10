import type { ReactNode } from 'react';

interface OverlayAnchorProps {
  children: ReactNode;
}

const OverlayAnchor = ({ children }: OverlayAnchorProps) => {
  return <div style={{ position: 'relative' }}>{children}</div>;
};

export default OverlayAnchor;
