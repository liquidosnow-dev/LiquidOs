import React from 'react';

interface MercurySphereProps {
  size?: 'xs' | 'sm' | 'md' | 'focal';
  isActive?: boolean;
  label?: string;
  className?: string;
}

/**
 * Sculpted liquid-mercury focal sphere with curved upper glass crest
 * and gently shifting specular silver reflections.
 */
export const MercurySphere: React.FC<MercurySphereProps> = ({
  size = 'sm',
  isActive = false,
  label = 'MercurySi Sphere',
  className = '',
}) => {
  const sizeClass =
    size === 'xs'
      ? 'w-6 h-6'
      : size === 'sm'
      ? 'w-7 h-7'
      : size === 'md'
      ? 'w-9 h-9'
      : 'w-12 h-12';

  return (
    <span
      role="img"
      aria-label={label}
      className={`relative inline-flex items-center justify-center rounded-full shrink-0 select-none ${sizeClass} ${className}`}
    >
      {/* Softly rounded upper liquid-glass crest arc */}
      {size === 'focal' && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -inset-1.5 rounded-full border border-slate-200/20"
          style={{
            background:
              'radial-gradient(120% 70% at 50% 0%, rgba(248,250,252,0.22) 0%, rgba(148,163,184,0.04) 55%, transparent 72%)',
            boxShadow: 'inset 0 1.5px 0 rgba(255,255,255,0.42), 0 8px 24px -8px rgba(148,163,184,0.25)',
          }}
        />
      )}

      {/* Core liquid-mercury body */}
      <span
        aria-hidden="true"
        className="relative w-full h-full rounded-full overflow-hidden border border-slate-200/35"
        style={{
          background:
            'radial-gradient(125% 125% at 32% 24%, #f8fafc 0%, #cbd5e1 18%, #64748b 46%, #1e293b 74%, #090d18 100%)',
          boxShadow:
            'inset 0 2px 4px rgba(255, 255, 255, 0.55), inset 0 -3px 6px rgba(2, 6, 23, 0.85), 0 4px 14px -4px rgba(148, 163, 184, 0.35)',
        }}
      >
        {/* Subtle shifting specular silver caustic highlight */}
        <span
          className={`absolute inset-0 rounded-full ${
            isActive ? 'mercury-caustic-drift-active' : 'mercury-caustic-drift'
          }`}
          style={{
            background:
              'radial-gradient(62% 48% at 34% 26%, rgba(255,255,255,0.72) 0%, rgba(226,232,240,0.2) 55%, transparent 80%)',
          }}
        />

        {/* Lower glass refraction rim */}
        <span
          className="absolute inset-x-1.5 bottom-0.5 h-1.5 rounded-full opacity-55"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, rgba(226,232,240,0.45) 50%, transparent 100%)',
          }}
        />
      </span>
    </span>
  );
};
