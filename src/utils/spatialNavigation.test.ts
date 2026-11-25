import { describe, it, expect } from 'vitest';
import {
  createInitialSpatialState,
  transitionSpatialDirection,
  settleSpatialTransition,
  navigateSpatialBack,
  getDirectionalOffscreenTransform,
  mapKeyboardToSpatialDirection,
  mapSwipeDeltaToSpatialDirection,
  computeProjectWatermark,
  buildRegisteredToolCatalog,
  validateProjectBriefInput,
} from './spatialNavigation';

describe('spatialNavigation pure logic', () => {
  it('starts anchored at HOME with initial history', () => {
    const state = createInitialSpatialState();
    expect(state.activeDirection).toBe('HOME');
    expect(state.history).toEqual(['HOME']);
    expect(state.isTransitioning).toBe(false);
  });

  it('transitions to cardinal directions and records history', () => {
    const t0 = 1000;
    const s1 = transitionSpatialDirection(createInitialSpatialState(), 'NORTH', t0);
    expect(s1.activeDirection).toBe('NORTH');
    expect(s1.previousDirection).toBe('HOME');
    expect(s1.history).toEqual(['HOME', 'NORTH']);
    expect(s1.isTransitioning).toBe(true);

    const settled = settleSpatialTransition(s1);
    expect(settled.isTransitioning).toBe(false);

    const s2 = transitionSpatialDirection(settled, 'WEST', t0 + 400);
    expect(s2.activeDirection).toBe('WEST');
    expect(s2.history).toEqual(['HOME', 'NORTH', 'WEST']);
  });

  it('guards against conflicting mid-flight cardinal transitions while allowing HOME escape', () => {
    const t0 = 5000;
    const s1 = transitionSpatialDirection(createInitialSpatialState(), 'EAST', t0, 300);
    // Conflicting transition within lock window should be ignored
    const conflicted = transitionSpatialDirection(s1, 'WEST', t0 + 80, 300);
    expect(conflicted.activeDirection).toBe('EAST');
    // Returning HOME is never blocked
    const homeEscape = transitionSpatialDirection(s1, 'HOME', t0 + 80, 300);
    expect(homeEscape.activeDirection).toBe('HOME');
  });

  it('navigates backwards through history stack cleanly', () => {
    const s1 = settleSpatialTransition(transitionSpatialDirection(createInitialSpatialState(), 'WEST', 100));
    const s2 = settleSpatialTransition(transitionSpatialDirection(s1, 'SOUTH', 500));
    const back1 = navigateSpatialBack(s2, 900);
    expect(back1.activeDirection).toBe('WEST');
    const back2 = navigateSpatialBack(back1, 1300);
    expect(back2.activeDirection).toBe('HOME');
  });

  it('returns correct offscreen CSS transforms for each cardinal panel', () => {
    expect(getDirectionalOffscreenTransform('NORTH')).toBe('translate3d(0, -100%, 0)');
    expect(getDirectionalOffscreenTransform('SOUTH')).toBe('translate3d(0, 100%, 0)');
    expect(getDirectionalOffscreenTransform('EAST')).toBe('translate3d(100%, 0, 0)');
    expect(getDirectionalOffscreenTransform('WEST')).toBe('translate3d(-100%, 0, 0)');
  });

  it('maps keyboard keys and swipe vectors symmetrically', () => {
    expect(mapKeyboardToSpatialDirection('ArrowUp', 'HOME')).toBe('NORTH');
    expect(mapKeyboardToSpatialDirection('ArrowDown', 'NORTH')).toBe('HOME');
    expect(mapKeyboardToSpatialDirection('Escape', 'EAST')).toBe('HOME');

    // Swiping finger right (+dx) reveals WEST; swiping left (-dx) reveals EAST
    expect(mapSwipeDeltaToSpatialDirection(90, 8, 'HOME')).toBe('WEST');
    expect(mapSwipeDeltaToSpatialDirection(-90, 5, 'HOME')).toBe('EAST');
    // Small jitter below threshold is ignored
    expect(mapSwipeDeltaToSpatialDirection(20, 12, 'HOME')).toBeNull();
  });

  it('computes deterministic unique project watermarks formatted as #XXXX-XXXX', () => {
    const w1 = computeProjectWatermark('proj_aurora', 'Aurora Nexus');
    const w2 = computeProjectWatermark('proj_aurora', 'Aurora Nexus');
    const w3 = computeProjectWatermark('proj_other', 'Aurora Nexus');
    expect(w1).toMatch(/^#[0-9A-F]{4}-[0-9A-F]{4}$/);
    expect(w1).toBe(w2);
    expect(w1).not.toBe(w3);
  });

  it('validates project brief submissions and exposes registered tool catalog', () => {
    expect(validateProjectBriefInput({ title: 'Hi', objectives: 'Short' }).ok).toBe(false);
    expect(
      validateProjectBriefInput({
        title: 'Quantum Mesh Rollout',
        objectives: 'Deploy edge telemetry collectors across three sovereign regions.',
      }).ok
    ).toBe(true);

    const tools = buildRegisteredToolCatalog();
    const names = tools.map((t) => t.name);
    expect(names).toContain('execute_code');
    expect(names).toContain('web_fetch');
    expect(names).toContain('math_eval');
    expect(names).toContain('create_file');
    expect(names).toContain('contract_interop');
  });
});
