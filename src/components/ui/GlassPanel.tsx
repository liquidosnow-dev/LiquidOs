import React from 'react';
import { MercuryFrameGlow } from '../MercuryFrameGlow';
import { MercuryEdgeRipple } from '../MercuryEdgeRipple';
import { useMercuryFrameGlow } from '../../hooks/useMercuryFrameGlow';

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
  withFrameGlow?: boolean;
  withEdgeRipple?: boolean;
  rippleDurationSec?: number;
  rippleDelaySec?: number;
  children: React.ReactNode;
}

export const GlassPanel: React.FC<GlassPanelProps> = ({
  elevated = false,
  withFrameGlow = true,
  withEdgeRipple = false,
  rippleDurationSec = 14,
  rippleDelaySec = 0,
  className = '',
  children,
  ...rest
}) => {
  const { frameRef, glowHandlers } = useMercuryFrameGlow<HTMLDivElement>();

  return (
    <div
      ref={withFrameGlow ? frameRef : undefined}
      {...(withFrameGlow ? glowHandlers : {})}
      {...rest}
      className={`relative rounded-2xl overflow-hidden ${
        elevated ? 'los-glass-elevated' : 'los-glass-surface'
      } ${className}`}
    >
      {withFrameGlow && <MercuryFrameGlow />}
      {withEdgeRipple && (
        <MercuryEdgeRipple
          durationSeconds={rippleDurationSec}
          delaySeconds={rippleDelaySec}
        />
      )}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-[12%] top-0 h-[1.5px] rounded-full bg-gradient-to-r from-transparent via-slate-100/55 to-transparent"
      />
      <div className="relative z-10 h-full w-full flex flex-col min-h-0">{children}</div>
    </div>
  );
};
