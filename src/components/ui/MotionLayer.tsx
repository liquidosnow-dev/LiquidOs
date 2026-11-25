import React from 'react';
import {
  CardinalDirection,
  getDirectionalOffscreenTransform,
} from '../../utils/spatialNavigation';

interface MotionLayerProps {
  direction: CardinalDirection;
  isActive: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Compositor-only transform + opacity transition wrapper that stays mounted
 * and becomes inert when off-stage so internal inputs/timers/streams never reset.
 */
export const MotionLayer: React.FC<MotionLayerProps> = ({
  direction,
  isActive,
  className = '',
  children,
}) => {
  const offscreen = getDirectionalOffscreenTransform(direction);

  return (
    <div
      data-spatial-panel={direction}
      data-active={isActive ? 'true' : 'false'}
      aria-hidden={!isActive}
      inert={!isActive ? true : undefined}
      style={{
        transform: isActive ? 'translate3d(0, 0, 0)' : offscreen,
        opacity: isActive ? 1 : 0,
        pointerEvents: isActive ? 'auto' : 'none',
      }}
      className={`los-motion-panel ${className}`}
    >
      {children}
    </div>
  );
};
