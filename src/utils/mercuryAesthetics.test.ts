import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  DEFAULT_EDGE_RIPPLE_INTENSITY,
  DEFAULT_EDGE_RIPPLE_SPEED,
  clampEdgeRippleIntensity,
  clampEdgeRippleSpeed,
  computeFrameRefractionPoint,
  computeRippleDurationSeconds,
  loadMercuryAestheticsFromStorage,
  saveMercuryAestheticsToStorage,
} from './mercuryAesthetics';

test('MercuryAesthetics: clamps edge ripple intensity and handles non-finite inputs', () => {
  assert.equal(clampEdgeRippleIntensity(-0.4), 0);
  assert.equal(clampEdgeRippleIntensity(0.75), 0.75);
  assert.equal(clampEdgeRippleIntensity(2.4), 1.5);
  assert.equal(clampEdgeRippleIntensity(Number.NaN), DEFAULT_EDGE_RIPPLE_INTENSITY);
});

test('MercuryAesthetics: clamps edge ripple speed and scales base animation duration', () => {
  assert.equal(clampEdgeRippleSpeed(0.1), 0.4);
  assert.equal(clampEdgeRippleSpeed(1.5), 1.5);
  assert.equal(clampEdgeRippleSpeed(5.0), 2.5);
  assert.equal(clampEdgeRippleSpeed(Number.POSITIVE_INFINITY), DEFAULT_EDGE_RIPPLE_SPEED);

  assert.equal(computeRippleDurationSeconds(14, 1.0), 14);
  assert.equal(computeRippleDurationSeconds(14, 2.0), 7);
  assert.equal(computeRippleDurationSeconds(10, 0.5), 20);
});

test('MercuryAesthetics: computes frame-aware pointer refraction coordinates clamped to frame bounds', () => {
  const rect = { left: 100, top: 50, width: 400, height: 200 };

  const inside = computeFrameRefractionPoint(300, 150, rect);
  assert.deepEqual(inside, { xPx: 200, yPx: 100, xPct: 50, yPct: 50 });

  const outside = computeFrameRefractionPoint(20, 400, rect);
  assert.deepEqual(outside, { xPx: 0, yPx: 200, xPct: 0, yPct: 100 });

  const zeroRect = computeFrameRefractionPoint(10, 10, { left: 0, top: 0, width: 0, height: 0 });
  assert.equal(Number.isFinite(zeroRect.xPct), true);
  assert.equal(Number.isFinite(zeroRect.yPct), true);
});

test('MercuryAesthetics: loads and persists sanitized preferences in storage', () => {
  const store = new Map<string, string>();
  const mockStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };

  const initial = loadMercuryAestheticsFromStorage(mockStorage);
  assert.deepEqual(initial, {
    edgeRippleIntensity: DEFAULT_EDGE_RIPPLE_INTENSITY,
    edgeRippleSpeed: DEFAULT_EDGE_RIPPLE_SPEED,
  });

  saveMercuryAestheticsToStorage({ edgeRippleIntensity: 1.8, edgeRippleSpeed: 0.2 }, mockStorage);
  const reloaded = loadMercuryAestheticsFromStorage(mockStorage);
  assert.deepEqual(reloaded, {
    edgeRippleIntensity: 1.5,
    edgeRippleSpeed: 0.4,
  });
});
