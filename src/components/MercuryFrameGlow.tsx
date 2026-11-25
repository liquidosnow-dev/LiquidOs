import React from 'react';

interface MercuryFrameGlowProps {
  className?: string;
}

/**
 * Non-interactive interior & perimeter refraction layer driven by
 * parent panel CSS custom properties (--mx, --my, --mglow).
 */
export const MercuryFrameGlow: React.FC<MercuryFrameGlowProps> = ({ className = '' }) => {
  return (
    <div
      aria-hidden="true"
      className={`mercury-frame-refraction pointer-events-none absolute inset-0 rounded-[inherit] ${className}`}
    >
      <div className="mercury-frame-refraction-core" />
      <div className="mercury-frame-refraction-rim" />
    </div>
  );
};
