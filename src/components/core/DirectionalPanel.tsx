import React from 'react';
import { ArrowLeft, Minimize2, Maximize2 } from 'lucide-react';
import {
  CARDINAL_LABELS,
  CardinalDirection,
} from '../../utils/spatialNavigation';
import { MotionLayer } from '../ui/MotionLayer';
import { GlassPanel } from '../ui/GlassPanel';

interface DirectionalPanelProps {
  direction: CardinalDirection;
  isActive: boolean;
  onClose: () => void;
  onBack?: () => void;
  canGoBack?: boolean;
  headerRight?: React.ReactNode;
  onExpandWorkbench?: () => void;
  expandLabel?: string;
  children: React.ReactNode;
}

const DIRECTION_GEOMETRY: Record<CardinalDirection, string> = {
  NORTH:
    'lg:top-10 lg:left-11 lg:right-11 lg:h-[236px] lg:max-w-[920px] lg:mx-auto',
  SOUTH:
    'lg:bottom-8 lg:left-11 lg:right-11 lg:h-[286px] lg:max-w-[1040px] lg:mx-auto',
  WEST:
    'lg:top-3 lg:bottom-3 lg:left-11 lg:w-[min(38vw,540px)]',
  EAST:
    'lg:top-3 lg:bottom-3 lg:right-11 lg:w-[min(38vw,540px)]',
};

export const DirectionalPanel: React.FC<DirectionalPanelProps> = ({
  direction,
  isActive,
  onClose,
  onBack,
  canGoBack = false,
  headerRight,
  onExpandWorkbench,
  expandLabel,
  children,
}) => {
  const meta = CARDINAL_LABELS[direction];

  return (
    <MotionLayer
      direction={direction}
      isActive={isActive}
      className={`fixed inset-x-3 top-20 bottom-20 lg:inset-auto lg:absolute z-30 ${DIRECTION_GEOMETRY[direction]}`}
    >
      <GlassPanel
        elevated
        withEdgeRipple
        rippleDurationSec={14}
        className="h-full w-full flex flex-col"
      >
        {/* Cardinal Panel Header */}
        <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-2 border-b border-slate-200/15 bg-slate-950/55">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-cyan-500/15 border border-cyan-400/35 text-xs font-mono font-bold text-cyan-200 shrink-0">
              {meta.shortcut}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xs sm:text-sm font-semibold text-slate-100 tracking-wide truncate">
                  {meta.title}
                </h2>
                <span className="hidden sm:inline text-[10px] font-mono uppercase tracking-widest text-cyan-300/80">
                  {direction}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 truncate hidden sm:block">
                {meta.subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {headerRight}
            {onExpandWorkbench && (
              <button
                type="button"
                onClick={onExpandWorkbench}
                className="mercury-press hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-cyan-400/30 bg-cyan-950/40 text-[11px] font-medium text-cyan-200 hover:border-cyan-300/60 cursor-pointer"
              >
                <Maximize2 className="w-3 h-3" />
                <span>{expandLabel || 'Workbench'}</span>
              </button>
            )}
            {canGoBack && onBack && (
              <button
                type="button"
                onClick={onBack}
                title="Previous panel"
                className="mercury-press inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-300/20 bg-slate-900/70 text-[11px] text-slate-200 hover:border-slate-200/40 cursor-pointer"
              >
                <ArrowLeft className="w-3 h-3" />
                <span className="hidden sm:inline">Back</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              title="Return to Orbital Home (Esc)"
              className="mercury-press inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-300/20 bg-slate-900/75 text-[11px] text-slate-200 hover:border-cyan-400/50 hover:text-cyan-100 cursor-pointer"
            >
              <Minimize2 className="w-3 h-3" />
              <span>Home</span>
            </button>
          </div>
        </div>

        {/* Scrollable Panel Content */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-2.5 flex flex-col">
          {children}
        </div>
      </GlassPanel>
    </MotionLayer>
  );
};
