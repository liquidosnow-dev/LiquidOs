import React, { useState, useRef, useEffect, useId, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface MercuryTooltipProps {
  content: string;
  placement?: 'top' | 'bottom';
  children: React.ReactNode;
  className?: string;
}

/**
 * Accessible tooltip shown on pointer hover, keyboard focus (:focus-visible),
 * and brief touch interaction. Rendered via portal so overflowing toolbars never clip it,
 * and clamped horizontally inside the viewport.
 */
export const MercuryTooltip: React.FC<MercuryTooltipProps> = ({
  content,
  placement = 'bottom',
  children,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const tooltipId = useId();
  const touchTimerRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLSpanElement>(null);

  const updatePosition = useCallback(() => {
    if (!containerRef.current || typeof window === 'undefined') return;
    const rect = containerRef.current.getBoundingClientRect();
    const clampedLeft = Math.min(
      Math.max(rect.left + rect.width / 2, 112),
      window.innerWidth - 112
    );
    const top = placement === 'top' ? rect.top - 8 : rect.bottom + 8;
    setCoords({ top, left: clampedLeft });
  }, [placement]);

  const showTooltip = useCallback(() => {
    updatePosition();
    setOpen(true);
  }, [updatePosition]);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const handleScrollOrResize = () => updatePosition();
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    const handleDocTouch = (e: TouchEvent | PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleDocTouch);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('pointerdown', handleDocTouch);
      document.removeEventListener('keydown', handleKey);
      if (touchTimerRef.current) {
        window.clearTimeout(touchTimerRef.current);
      }
    };
  }, []);

  if (!content) {
    return <>{children}</>;
  }

  const handleTouchStart = () => {
    showTooltip();
    if (touchTimerRef.current) window.clearTimeout(touchTimerRef.current);
    touchTimerRef.current = window.setTimeout(() => {
      setOpen(false);
    }, 2200);
  };

  const tooltipNode =
    typeof document !== 'undefined' && coords
      ? createPortal(
          <span
            id={tooltipId}
            role="tooltip"
            aria-hidden={!open}
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              transform:
                placement === 'top'
                  ? open
                    ? 'translate(-50%, -100%)'
                    : 'translate(-50%, calc(-100% + 4px))'
                  : open
                  ? 'translate(-50%, 0)'
                  : 'translate(-50%, -4px)',
            }}
            className={`pointer-events-none z-[120] w-max max-w-[220px] px-2.5 py-1 rounded-lg glass-surface-2 text-[11px] font-medium text-slate-100 leading-snug text-center shadow-xl transition-all duration-150 ${
              open ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {content}
          </span>,
          document.body
        )
      : null;

  return (
    <span
      ref={containerRef}
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={showTooltip}
      onMouseLeave={() => setOpen(false)}
      onFocus={showTooltip}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
      onTouchStart={handleTouchStart}
      aria-describedby={open ? tooltipId : undefined}
    >
      {children}
      {tooltipNode}
    </span>
  );
};
