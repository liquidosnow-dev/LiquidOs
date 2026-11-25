import React from 'react';

export type StatusTone = 'nominal' | 'active' | 'warning' | 'critical' | 'live' | 'simulated';

interface StatusIndicatorProps {
  tone: StatusTone;
  label: string;
  sublabel?: string;
  size?: 'xs' | 'sm';
  className?: string;
}

const TONE_STYLES: Record<
  StatusTone,
  { dot: string; border: string; bg: string; text: string }
> = {
  nominal: {
    dot: 'bg-emerald-400',
    border: 'border-emerald-400/35',
    bg: 'bg-emerald-950/45',
    text: 'text-emerald-300',
  },
  active: {
    dot: 'bg-cyan-400',
    border: 'border-cyan-400/35',
    bg: 'bg-cyan-950/45',
    text: 'text-cyan-200',
  },
  warning: {
    dot: 'bg-amber-400',
    border: 'border-amber-400/35',
    bg: 'bg-amber-950/45',
    text: 'text-amber-300',
  },
  critical: {
    dot: 'bg-rose-400',
    border: 'border-rose-500/45',
    bg: 'bg-rose-950/50',
    text: 'text-rose-200',
  },
  live: {
    dot: 'bg-emerald-400',
    border: 'border-emerald-500/40',
    bg: 'bg-emerald-950/40',
    text: 'text-emerald-200',
  },
  simulated: {
    dot: 'bg-amber-300',
    border: 'border-amber-400/35',
    bg: 'bg-amber-950/40',
    text: 'text-amber-200',
  },
};

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  tone,
  label,
  sublabel,
  size = 'xs',
  className = '',
}) => {
  const palette = TONE_STYLES[tone];
  const padClass = size === 'xs' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border font-medium tracking-wide whitespace-nowrap ${palette.bg} ${palette.border} ${palette.text} ${padClass} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${palette.dot}`} aria-hidden="true" />
      <span>{label}</span>
      {sublabel && <span className="text-slate-400 font-mono text-[9px]">{sublabel}</span>}
    </span>
  );
};
