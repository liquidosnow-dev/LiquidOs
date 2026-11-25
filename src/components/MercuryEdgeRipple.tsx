import React, { useId } from 'react';

interface MercuryEdgeRippleProps {
  variant?: 'green' | 'red' | 'dual';
  delaySeconds?: number;
  durationSeconds?: number;
  rx?: number;
  className?: string;
}

/**
 * Lightweight SVG border glint overlay that glides restrained neon-green and
 * neon-red light pulses along sculpted panel contours, staggered across views.
 * Automatically degrades to subtle static hairline highlights under prefers-reduced-motion.
 */
export const MercuryEdgeRipple: React.FC<MercuryEdgeRippleProps> = ({
  variant = 'dual',
  delaySeconds = 0,
  durationSeconds = 13,
  rx = 18,
  className = '',
}) => {
  const uid = useId().replace(/:/g, '');
  const greenGradId = `mg_${uid}`;
  const redGradId = `mr_${uid}`;

  return (
    <svg
      aria-hidden="true"
      className={`mercury-edge-ripple-svg pointer-events-none absolute inset-0 w-full h-full ${className}`}
    >
      <defs>
        <linearGradient id={greenGradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(52, 211, 153, 0)" />
          <stop offset="45%" stopColor="rgba(52, 211, 153, 0.92)" />
          <stop offset="55%" stopColor="rgba(167, 243, 208, 0.95)" />
          <stop offset="100%" stopColor="rgba(52, 211, 153, 0)" />
        </linearGradient>
        <linearGradient id={redGradId} x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(251, 113, 133, 0)" />
          <stop offset="45%" stopColor="rgba(251, 113, 133, 0.9)" />
          <stop offset="55%" stopColor="rgba(254, 205, 211, 0.92)" />
          <stop offset="100%" stopColor="rgba(251, 113, 133, 0)" />
        </linearGradient>
      </defs>

      {(variant === 'green' || variant === 'dual') && (
        <rect
          x="1"
          y="1"
          width="99%"
          height="99%"
          rx={rx}
          ry={rx}
          fill="none"
          stroke={`url(#${greenGradId})`}
          strokeWidth="1.25"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray="14 86"
          className="mercury-edge-glint"
          style={
            {
              '--edge-delay': `${delaySeconds}s`,
              '--edge-duration': `${durationSeconds}s`,
            } as React.CSSProperties
          }
        />
      )}

      {(variant === 'red' || variant === 'dual') && (
        <rect
          x="1"
          y="1"
          width="99%"
          height="99%"
          rx={rx}
          ry={rx}
          fill="none"
          stroke={`url(#${redGradId})`}
          strokeWidth="1.15"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray="11 89"
          className="mercury-edge-glint"
          style={
            {
              '--edge-delay': `${delaySeconds + durationSeconds * 0.48}s`,
              '--edge-duration': `${durationSeconds}s`,
            } as React.CSSProperties
          }
        />
      )}
    </svg>
  );
};
