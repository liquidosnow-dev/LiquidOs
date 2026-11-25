export interface MercuryAestheticPreferences {
  edgeRippleIntensity: number;
  edgeRippleSpeed: number;
}

export const MERCURY_AESTHETICS_STORAGE_KEY = 'liquidos_mercury_aesthetics_v1';
export const DEFAULT_EDGE_RIPPLE_INTENSITY = 1.0;
export const DEFAULT_EDGE_RIPPLE_SPEED = 1.0;

export const MIN_EDGE_RIPPLE_INTENSITY = 0;
export const MAX_EDGE_RIPPLE_INTENSITY = 1.5;
export const MIN_EDGE_RIPPLE_SPEED = 0.4;
export const MAX_EDGE_RIPPLE_SPEED = 2.5;

export function clampEdgeRippleIntensity(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_EDGE_RIPPLE_INTENSITY;
  const clamped = Math.min(MAX_EDGE_RIPPLE_INTENSITY, Math.max(MIN_EDGE_RIPPLE_INTENSITY, value));
  return Math.round(clamped * 100) / 100;
}

export function clampEdgeRippleSpeed(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_EDGE_RIPPLE_SPEED;
  const clamped = Math.min(MAX_EDGE_RIPPLE_SPEED, Math.max(MIN_EDGE_RIPPLE_SPEED, value));
  return Math.round(clamped * 100) / 100;
}

export function computeRippleDurationSeconds(baseDurationSeconds: number, speed: number): number {
  const safeBase = Number.isFinite(baseDurationSeconds) && baseDurationSeconds > 0 ? baseDurationSeconds : 13;
  const safeSpeed = clampEdgeRippleSpeed(speed);
  return Math.round((safeBase / safeSpeed) * 100) / 100;
}

export interface FrameRectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface FrameRefractionPoint {
  xPx: number;
  yPx: number;
  xPct: number;
  yPct: number;
}

export function computeFrameRefractionPoint(
  clientX: number,
  clientY: number,
  rect: FrameRectLike
): FrameRefractionPoint {
  const safeWidth = Number.isFinite(rect.width) && rect.width > 0 ? rect.width : 1;
  const safeHeight = Number.isFinite(rect.height) && rect.height > 0 ? rect.height : 1;
  const rawX = Number.isFinite(clientX) ? clientX - rect.left : safeWidth / 2;
  const rawY = Number.isFinite(clientY) ? clientY - rect.top : safeHeight / 2;

  const xPx = Math.round(Math.min(safeWidth, Math.max(0, rawX)) * 10) / 10;
  const yPx = Math.round(Math.min(safeHeight, Math.max(0, rawY)) * 10) / 10;
  const xPct = Math.round((xPx / safeWidth) * 1000) / 10;
  const yPct = Math.round((yPx / safeHeight) * 1000) / 10;

  return { xPx, yPx, xPct, yPct };
}

export function applyMercuryAestheticCssVars(
  target: HTMLElement | null | undefined,
  intensity: number,
  speed: number
): void {
  if (!target) return;
  const safeIntensity = clampEdgeRippleIntensity(intensity);
  const safeSpeed = clampEdgeRippleSpeed(speed);
  target.style.setProperty('--mercury-ripple-intensity', String(safeIntensity));
  target.style.setProperty('--mercury-ripple-speed', String(safeSpeed));
}

export function loadMercuryAestheticsFromStorage(
  storage?: Pick<Storage, 'getItem'> | null
): MercuryAestheticPreferences {
  const resolvedStorage =
    storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  if (!resolvedStorage) {
    return {
      edgeRippleIntensity: DEFAULT_EDGE_RIPPLE_INTENSITY,
      edgeRippleSpeed: DEFAULT_EDGE_RIPPLE_SPEED,
    };
  }
  try {
    const raw = resolvedStorage.getItem(MERCURY_AESTHETICS_STORAGE_KEY);
    if (!raw) {
      return {
        edgeRippleIntensity: DEFAULT_EDGE_RIPPLE_INTENSITY,
        edgeRippleSpeed: DEFAULT_EDGE_RIPPLE_SPEED,
      };
    }
    const parsed = JSON.parse(raw) as Partial<MercuryAestheticPreferences>;
    return {
      edgeRippleIntensity: clampEdgeRippleIntensity(
        typeof parsed.edgeRippleIntensity === 'number'
          ? parsed.edgeRippleIntensity
          : DEFAULT_EDGE_RIPPLE_INTENSITY
      ),
      edgeRippleSpeed: clampEdgeRippleSpeed(
        typeof parsed.edgeRippleSpeed === 'number'
          ? parsed.edgeRippleSpeed
          : DEFAULT_EDGE_RIPPLE_SPEED
      ),
    };
  } catch {
    return {
      edgeRippleIntensity: DEFAULT_EDGE_RIPPLE_INTENSITY,
      edgeRippleSpeed: DEFAULT_EDGE_RIPPLE_SPEED,
    };
  }
}

export function saveMercuryAestheticsToStorage(
  prefs: MercuryAestheticPreferences,
  storage?: Pick<Storage, 'setItem'> | null
): void {
  const resolvedStorage =
    storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  if (!resolvedStorage) return;
  try {
    const sanitized: MercuryAestheticPreferences = {
      edgeRippleIntensity: clampEdgeRippleIntensity(prefs.edgeRippleIntensity),
      edgeRippleSpeed: clampEdgeRippleSpeed(prefs.edgeRippleSpeed),
    };
    resolvedStorage.setItem(MERCURY_AESTHETICS_STORAGE_KEY, JSON.stringify(sanitized));
  } catch {
    // Ignore storage quota or private browsing errors cleanly
  }
}
