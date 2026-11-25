import { useRef, useCallback, useEffect } from 'react';
import { computeFrameRefractionPoint } from '../utils/mercuryAesthetics';

/**
 * Lightweight hook updating CSS custom properties (--mx, --my, --mglow)
 * directly on the target panel DOM node so hovered panels render a smooth,
 * frame-aware light refraction & edge glow without React re-renders.
 */
export function useMercuryFrameGlow<T extends HTMLElement = HTMLDivElement>() {
  const frameRef = useRef<T | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const scheduleUpdate = useCallback((clientX: number, clientY: number, glow: string) => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      const el = frameRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const point = computeFrameRefractionPoint(clientX, clientY, rect);
      el.style.setProperty('--mx', `${point.xPx}px`);
      el.style.setProperty('--my', `${point.yPx}px`);
      el.style.setProperty('--mglow', glow);
    });
  }, []);

  const onPointerEnter = useCallback(
    (e: React.PointerEvent<T>) => {
      if (e.pointerType === 'touch') return;
      scheduleUpdate(e.clientX, e.clientY, '1');
    },
    [scheduleUpdate]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<T>) => {
      if (e.pointerType === 'touch') return;
      scheduleUpdate(e.clientX, e.clientY, '1');
    },
    [scheduleUpdate]
  );

  const onPointerLeave = useCallback(() => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (frameRef.current) {
      frameRef.current.style.setProperty('--mglow', '0');
    }
  }, []);

  return {
    frameRef,
    glowHandlers: {
      onPointerEnter,
      onPointerMove,
      onPointerLeave,
    },
  };
}
