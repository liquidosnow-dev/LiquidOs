import React, { useEffect, useRef } from 'react';
import {
  SpatialDirection,
  SpatialNavigationState,
  SPATIAL_TRANSITION_DURATION_MS,
  mapKeyboardToSpatialDirection,
  mapSwipeDeltaToSpatialDirection,
  settleSpatialTransition,
  transitionSpatialDirection,
  navigateSpatialBack,
} from '../../utils/spatialNavigation';

interface TransitionControllerProps {
  state: SpatialNavigationState;
  setState: React.Dispatch<React.SetStateAction<SpatialNavigationState>>;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function useSpatialController(
  state: SpatialNavigationState,
  setState: React.Dispatch<React.SetStateAction<SpatialNavigationState>>
) {
  const settleTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current);
      }
    };
  }, []);

  const scheduleSettle = () => {
    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current);
    }
    settleTimerRef.current = window.setTimeout(() => {
      setState((prev) => settleSpatialTransition(prev));
      settleTimerRef.current = null;
    }, SPATIAL_TRANSITION_DURATION_MS);
  };

  const navigate = (target: SpatialDirection) => {
    setState((prev) => transitionSpatialDirection(prev, target, Date.now()));
    scheduleSettle();
  };

  const toggleDirection = (target: Exclude<SpatialDirection, 'HOME'>) => {
    setState((prev) =>
      transitionSpatialDirection(
        prev,
        prev.activeDirection === target ? 'HOME' : target,
        Date.now()
      )
    );
    scheduleSettle();
  };

  const goHome = () => navigate('HOME');

  const goBack = () => {
    setState((prev) => navigateSpatialBack(prev, Date.now()));
    scheduleSettle();
  };

  return { navigate, toggleDirection, goHome, goBack };
}

/**
 * Coordinates directional keyboard shortcuts and swipe gestures around the Central AI stage
 * while preventing navigation misfires while typing or inside open modals/workbench overlays.
 */
export const TransitionController: React.FC<TransitionControllerProps> = ({
  state,
  setState,
  disabled = false,
  className = '',
  children,
}) => {
  const { navigate } = useSpatialController(state, setState);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          target.isContentEditable
        ) {
          if (e.key !== 'Escape') return;
        }
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const next = mapKeyboardToSpatialDirection(e.key, state.activeDirection);
      if (next) {
        e.preventDefault();
        navigate(next);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [disabled, state.activeDirection]);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (disabled || e.touches.length !== 1) return;
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (disabled || !touchStartRef.current || e.changedTouches.length !== 1) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartRef.current.x;
    const dy = t.clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    const next = mapSwipeDeltaToSpatialDirection(dx, dy, state.activeDirection);
    if (next) {
      navigate(next);
    }
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={className}
    >
      {children}
    </div>
  );
};
