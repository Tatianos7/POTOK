import { createContext, useContext, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import AppBottomNavigation from './AppBottomNavigation';

const DockActionsTarget = createContext<HTMLDivElement | null>(null);

export function BottomDockActions({ children }: { children: ReactNode }) {
  const target = useContext(DockActionsTarget);
  return target ? createPortal(children, target) : null;
}

export default function AppBottomDock({
  children,
  showNavigation,
  hasPremiumAccess,
}: {
  children: ReactNode;
  showNavigation: boolean;
  hasPremiumAccess: boolean;
}) {
  const dockRef = useRef<HTMLDivElement>(null);
  const [actionsTarget, setActionsTarget] = useState<HTMLDivElement | null>(null);
  const [dockHeight, setDockHeight] = useState(0);

  useLayoutEffect(() => {
    if (!showNavigation || !dockRef.current) return;
    const dock = dockRef.current;
    const updateHeight = () => setDockHeight(dock.getBoundingClientRect().height);
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(dock);
    return () => observer.disconnect();
  }, [showNavigation]);

  return (
    <DockActionsTarget.Provider value={showNavigation ? actionsTarget : null}>
      <div className="min-h-screen" style={showNavigation ? { paddingBottom: dockHeight } : undefined}>
        {children}
      </div>
      {showNavigation ? (
        <div ref={dockRef} data-app-bottom-dock className="fixed inset-x-0 bottom-0 z-40">
          <div ref={setActionsTarget} />
          <AppBottomNavigation hasPremiumAccess={hasPremiumAccess} />
        </div>
      ) : null}
    </DockActionsTarget.Provider>
  );
}
