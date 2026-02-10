import type { ReactNode } from 'react';

interface OverlayLayerProps {
  children: ReactNode;
  position?: 'top' | 'bottom';
  offsetY?: number;
}

const OverlayLayer = ({ children, position = 'top', offsetY = 0 }: OverlayLayerProps) => {
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: position === 'top' ? 0 : 'auto',
        bottom: position === 'bottom' ? 0 : 'auto',
        zIndex: 20,
        transform: offsetY ? `translateY(${offsetY}px)` : undefined,
      }}
    >
      {children}
    </div>
  );
};

export default OverlayLayer;
