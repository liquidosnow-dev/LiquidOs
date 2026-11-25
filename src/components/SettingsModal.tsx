import React from 'react';
import { ModelHyperparameters } from '../types';
import { RotateCcw, Check, Zap, Sparkles, Cpu } from 'lucide-react';
import {
  DEFAULT_EDGE_RIPPLE_INTENSITY,
  DEFAULT_EDGE_RIPPLE_SPEED,
  MIN_EDGE_RIPPLE_INTENSITY,
  MAX_EDGE_RIPPLE_INTENSITY,
  MIN_EDGE_RIPPLE_SPEED,
  MAX_EDGE_RIPPLE_SPEED,
  clampEdgeRippleIntensity,
  clampEdgeRippleSpeed,
} from '../utils/mercuryAesthetics';
import { MercuryEdgeRipple } from './MercuryEdgeRipple';
import { MercuryFrameGlow } from './MercuryFrameGlow';
import { MercurySphere } from './MercurySphere';
import { useMercuryFrameGlow } from '../hooks/useMercuryFrameGlow';

interface SettingsModalProps {
  settings: ModelHyperparameters;
  onUpdateSettings: (newSettings: ModelHyperparameters) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onUpdateSettings,
}) => {
  const { frameRef: aestheticCardRef, glowHandlers: aestheticGlowHandlers } = useMercuryFrameGlow<HTMLDivElement>();
  const { frameRef: previewStripRef, glowHandlers: previewStripGlowHandlers } = useMercuryFrameGlow<HTMLDivElement>();

  const rippleIntensity = clampEdgeRippleIntensity(
    settings.edgeRippleIntensity ?? DEFAULT_EDGE_RIPPLE_INTENSITY
  );
  const rippleSpeed = clampEdgeRippleSpeed(
    settings.edgeRippleSpeed ?? DEFAULT_EDGE_RIPPLE_SPEED
  );

  const handleSliderChange = (field: keyof ModelHyperparameters, value: number) => {
    onUpdateSettings({
      ...settings,
      [field]: value,
    });
  };

  const handleReset = () => {
    onUpdateSettings({
      temperature: 0.70,
      topP: 0.90,
      seed: 198662,
      maxOutput: 2048,
      minP: 0.05,
      repetitionPenalty: 1.10,
      buildQuality: 'thorough',
      quickEdits: true,
      mtpSpeculativeDecoding: true,
      kvCacheQuant: 'Q8_0',
      targetAccelerator: 'gpu,cpu',
      peakRamCeilingMb: 2800,
      edgeRippleIntensity: DEFAULT_EDGE_RIPPLE_INTENSITY,
      edgeRippleSpeed: DEFAULT_EDGE_RIPPLE_SPEED,
    });
  };

  return (
    <div className="w-full h-full max-w-2xl mx-auto p-4 md:p-6 overflow-y-auto space-y-6 text-slate-100">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10 gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Advanced Builder &amp; Sampling Settings</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Apollo Hyperparameter Studio, MercurySi Surface Tuning &amp; Codex Synthesis Preferences
          </p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="mercury-press flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-surface-2 hover:border-slate-300/40 text-xs font-medium text-slate-200 cursor-pointer shrink-0"
          title="Reset to recommended defaults"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Defaults</span>
        </button>
      </div>

      {/* MercurySi Liquid-Glass & Edge Ripple Controls */}
      <div
        ref={aestheticCardRef}
        {...aestheticGlowHandlers}
        data-mercury-panel="settings-aesthetics"
        className="mercury-crest-panel relative p-4 rounded-2xl glass-surface-2 space-y-4 shadow-xl"
      >
        <MercuryFrameGlow />
        <div className="relative z-10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <MercurySphere size="xs" label="MercurySi Aesthetic Calibration" />
            <div>
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                MercurySi Liquid-Glass &amp; Edge Ripples
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Tune perimeter light pulse intensity and travel cadence across command panels
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-white/5 border border-white/15 text-slate-300 shrink-0">
            {rippleIntensity === 0
              ? 'Static Glass'
              : `${Math.round(rippleIntensity * 100)}% · ${rippleSpeed.toFixed(1)}x`}
          </span>
        </div>

        {/* Live Interactive Calibration Strip */}
        <div
          ref={previewStripRef}
          {...previewStripGlowHandlers}
          data-mercury-panel="settings-ripple-preview"
          className="mercury-crest-panel relative z-10 rounded-xl glass-surface-3 p-3 flex items-center justify-between gap-3"
        >
          <MercuryFrameGlow />
          <MercuryEdgeRipple variant="dual" delaySeconds={0} durationSeconds={6} rx={14} />
          <div className="relative z-10 min-w-0">
            <div className="text-xs font-semibold text-white">Live Refraction &amp; Edge Pulse Preview</div>
            <div className="text-[11px] text-slate-300/85">
              Hover this surface to test frame refraction glow; pulses scale live below.
            </div>
          </div>
          <span className="relative z-10 text-[10px] font-mono text-emerald-300 bg-black/40 border border-white/15 px-2 py-1 rounded-lg shrink-0">
            Active
          </span>
        </div>

        {/* Edge Ripple Intensity */}
        <div className="relative z-10 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <label htmlFor="mercury-ripple-intensity" className="text-slate-200 font-medium">
              Edge Ripple Intensity
            </label>
            <span
              data-testid="ripple-intensity-value"
              className="px-2.5 py-0.5 rounded-md bg-black/40 border border-white/15 text-cyan-300 font-mono text-xs tabular-nums"
            >
              {Math.round(rippleIntensity * 100)}%
            </span>
          </div>
          <input
            id="mercury-ripple-intensity"
            aria-label="Edge Ripple Intensity"
            type="range"
            min={MIN_EDGE_RIPPLE_INTENSITY}
            max={MAX_EDGE_RIPPLE_INTENSITY}
            step={0.05}
            value={rippleIntensity}
            onChange={(e) =>
              handleSliderChange('edgeRippleIntensity', clampEdgeRippleIntensity(parseFloat(e.target.value)))
            }
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {[
              { label: 'Off', value: 0 },
              { label: 'Subtle (50%)', value: 0.5 },
              { label: 'Balanced (100%)', value: 1.0 },
              { label: 'Luminous (140%)', value: 1.4 },
            ].map((preset) => {
              const isSelected = Math.abs(rippleIntensity - preset.value) < 0.03;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handleSliderChange('edgeRippleIntensity', preset.value)}
                  className={`mercury-press px-2.5 py-1 rounded-lg text-[11px] font-medium border cursor-pointer ${
                    isSelected
                      ? 'glass-surface-3 border-cyan-400/55 text-white font-semibold'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:text-white'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Edge Ripple Speed */}
        <div className="relative z-10 space-y-2 pt-2 border-t border-white/10">
          <div className="flex items-center justify-between text-sm">
            <label htmlFor="mercury-ripple-speed" className="text-slate-200 font-medium">
              Edge Ripple Speed
            </label>
            <span
              data-testid="ripple-speed-value"
              className="px-2.5 py-0.5 rounded-md bg-black/40 border border-white/15 text-emerald-300 font-mono text-xs tabular-nums"
            >
              {rippleSpeed.toFixed(1)}x
            </span>
          </div>
          <input
            id="mercury-ripple-speed"
            aria-label="Edge Ripple Speed"
            type="range"
            min={MIN_EDGE_RIPPLE_SPEED}
            max={MAX_EDGE_RIPPLE_SPEED}
            step={0.1}
            value={rippleSpeed}
            onChange={(e) =>
              handleSliderChange('edgeRippleSpeed', clampEdgeRippleSpeed(parseFloat(e.target.value)))
            }
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
          />
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {[
              { label: 'Calm (0.5x)', value: 0.5 },
              { label: 'Standard (1.0x)', value: 1.0 },
              { label: 'Swift (1.6x)', value: 1.6 },
              { label: 'Brisk (2.2x)', value: 2.2 },
            ].map((preset) => {
              const isSelected = Math.abs(rippleSpeed - preset.value) < 0.06;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handleSliderChange('edgeRippleSpeed', preset.value)}
                  className={`mercury-press px-2.5 py-1 rounded-lg text-[11px] font-medium border cursor-pointer ${
                    isSelected
                      ? 'glass-surface-3 border-emerald-400/55 text-white font-semibold'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:text-white'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Builder Quality Section */}
      <div className="mercury-crest-panel p-4 rounded-2xl glass-surface-2 space-y-4 shadow-lg">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Builder Preferences</h3>

        <div>
          <div className="text-sm font-semibold text-white mb-1">Build quality</div>
          <p className="text-xs text-slate-400 mb-3">Thorough lets the AI think longer with extended reasoning for better results, but takes more time.</p>
          <div className="flex items-center gap-2 p-1 bg-black/35 rounded-xl border border-white/15 max-w-xs">
            <button
              type="button"
              onClick={() => onUpdateSettings({ ...settings, buildQuality: 'fast' })}
              className={`mercury-press flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
                settings.buildQuality === 'fast'
                  ? 'glass-surface-2 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Fast</span>
            </button>
            <button
              type="button"
              onClick={() => onUpdateSettings({ ...settings, buildQuality: 'thorough' })}
              className={`mercury-press flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
                settings.buildQuality === 'thorough'
                  ? 'bg-cyan-600/90 text-white font-bold shadow-sm border border-cyan-300/30'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-200" />
              <span>Thorough</span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-white/10">
          <div>
            <div className="text-sm font-semibold text-white">Quick edits</div>
            <p className="text-xs text-slate-400">For small changes, the AI rewrites only the part that changes. Much faster on big sites.</p>
          </div>
          <input
            type="checkbox"
            aria-label="Enable quick edits"
            checked={settings.quickEdits}
            onChange={(e) => onUpdateSettings({ ...settings, quickEdits: e.target.checked })}
            className="w-5 h-5 accent-cyan-500 rounded cursor-pointer"
          />
        </div>
      </div>

      {/* Apollo Model Hyperparameters (from Apollo screenshot IMG 2) */}
      <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-5 shadow-xl">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Model Hyperparameters (Apollo Engine)</h3>

        {/* Temperature */}
        <div>
          <div className="flex items-center justify-between text-sm mb-1.5">
            <span className="text-zinc-200 font-medium">Temperature</span>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-zinc-800 text-cyan-400 font-mono text-xs">
                {settings.temperature.toFixed(2)}
              </span>
              <input type="checkbox" defaultChecked className="w-4 h-4 accent-emerald-500 rounded" />
            </div>
          </div>
          <input
            type="range"
            min="0"
            max="2"
            step="0.05"
            value={settings.temperature}
            onChange={(e) => handleSliderChange('temperature', parseFloat(e.target.value))}
            className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>

        {/* Top P */}
        <div>
          <div className="flex items-center justify-between text-sm mb-1.5">
            <span className="text-zinc-200 font-medium">Top P</span>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-zinc-800 text-cyan-400 font-mono text-xs">
                {settings.topP.toFixed(2)}
              </span>
              <input type="checkbox" defaultChecked className="w-4 h-4 accent-emerald-500 rounded" />
            </div>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={settings.topP}
            onChange={(e) => handleSliderChange('topP', parseFloat(e.target.value))}
            className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>

        {/* Seed */}
        <div>
          <div className="flex items-center justify-between text-sm mb-1.5">
            <span className="text-zinc-200 font-medium">Seed</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={settings.seed}
                onChange={(e) => handleSliderChange('seed', parseInt(e.target.value, 10) || 0)}
                className="w-24 px-2 py-0.5 rounded-md bg-zinc-800 text-cyan-300 font-mono text-xs text-right border border-zinc-700 focus:outline-none"
              />
              <input type="checkbox" defaultChecked className="w-4 h-4 accent-emerald-500 rounded" />
            </div>
          </div>
        </div>

        {/* Maximum Output */}
        <div>
          <div className="flex items-center justify-between text-sm mb-1.5">
            <span className="text-zinc-200 font-medium">Maximum output</span>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-zinc-800 text-cyan-400 font-mono text-xs">
                {settings.maxOutput} tokens
              </span>
              <input type="checkbox" defaultChecked className="w-4 h-4 accent-emerald-500 rounded" />
            </div>
          </div>
          <input
            type="range"
            min="512"
            max="8192"
            step="256"
            value={settings.maxOutput}
            onChange={(e) => handleSliderChange('maxOutput', parseInt(e.target.value, 10))}
            className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>

        {/* Sampling Group */}
        <div className="pt-3 border-t border-zinc-800 space-y-4">
          <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Sampling</div>

          {/* Min P */}
          <div>
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="text-zinc-200 font-medium">Min P</span>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-zinc-800 text-cyan-400 font-mono text-xs">
                  {settings.minP.toFixed(2)}
                </span>
                <input type="checkbox" defaultChecked className="w-4 h-4 accent-emerald-500 rounded" />
              </div>
            </div>
            <input
              type="range"
              min="0"
              max="0.5"
              step="0.01"
              value={settings.minP}
              onChange={(e) => handleSliderChange('minP', parseFloat(e.target.value))}
              className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
          </div>

          {/* Repetition penalty */}
          <div>
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="text-zinc-200 font-medium">Repetition penalty</span>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-zinc-800 text-cyan-400 font-mono text-xs">
                  {settings.repetitionPenalty.toFixed(2)}
                </span>
                <input type="checkbox" defaultChecked className="w-4 h-4 accent-emerald-500 rounded" />
              </div>
            </div>
            <input
              type="range"
              min="1"
              max="2"
              step="0.05"
              value={settings.repetitionPenalty}
              onChange={(e) => handleSliderChange('repetitionPenalty', parseFloat(e.target.value))}
              className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
          </div>
        </div>
      </div>

      {/* LiteRT-LM & Edge Accelerators (iPad A16 ~2.8GB Budget) */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-5 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              On-Device Edge & MTP Accelerators (iPad A16)
            </h3>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
            LiteRT-LM v0.3
          </span>
        </div>

        {/* MTP Speculative Decoding Toggle */}
        <div className="flex items-start justify-between gap-4 p-3 rounded-xl bg-slate-950/80 border border-slate-800/80">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">Gemma 4 Multi-Token Prediction (MTP)</span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                1.84x Speedup
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Speculative decoding leveraging Gemma 4's built-in MTP heads. Yields ~38.6 tok/s vs 21.0 tok/s baseline.
            </p>
          </div>
          <input
            type="checkbox"
            checked={settings.mtpSpeculativeDecoding ?? true}
            onChange={(e) => onUpdateSettings({ ...settings, mtpSpeculativeDecoding: e.target.checked })}
            className="w-5 h-5 accent-emerald-500 rounded cursor-pointer mt-0.5"
          />
        </div>

        {/* KV Cache Quantization */}
        <div>
          <div className="flex items-center justify-between text-sm mb-1.5">
            <span className="text-slate-300 font-medium">KV Cache Quantization</span>
            <span className="text-xs text-slate-400 font-mono">
              {settings.kvCacheQuant ?? 'Q8_0'} (~142.5 MB footprint)
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onUpdateSettings({ ...settings, kvCacheQuant: 'Q8_0' })}
              className={`p-2.5 rounded-xl border text-left text-xs transition-colors cursor-pointer ${
                (settings.kvCacheQuant ?? 'Q8_0') === 'Q8_0'
                  ? 'bg-emerald-950/40 border-emerald-500/60 text-white font-semibold'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span>Q8_0 (8-bit Quantized)</span>
                {(settings.kvCacheQuant ?? 'Q8_0') === 'Q8_0' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
              </div>
              <p className="text-[11px] text-slate-400">Fits 2.8 GB budget. High attention fidelity.</p>
            </button>
            <button
              type="button"
              onClick={() => onUpdateSettings({ ...settings, kvCacheQuant: 'FP16' })}
              className={`p-2.5 rounded-xl border text-left text-xs transition-colors cursor-pointer ${
                settings.kvCacheQuant === 'FP16'
                  ? 'bg-emerald-950/40 border-emerald-500/60 text-white font-semibold'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span>FP16 (Half Precision)</span>
                {settings.kvCacheQuant === 'FP16' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
              </div>
              <p className="text-[11px] text-slate-400">285 MB cache. Full numerical precision.</p>
            </button>
          </div>
        </div>

        {/* Target Accelerator Selection */}
        <div>
          <div className="text-sm font-semibold text-white mb-1.5">Hardware Accelerator</div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'gpu,cpu' as const, label: 'Metal GPU + CPU', desc: 'Hybrid MPS execution' },
              { id: 'gpu' as const, label: 'Metal GPU Only', desc: 'Max pipeline throughput' },
              { id: 'cpu' as const, label: 'CPU Fallback', desc: 'Low thermal dissipation' },
            ].map((acc) => (
              <button
                key={acc.id}
                type="button"
                onClick={() => onUpdateSettings({ ...settings, targetAccelerator: acc.id })}
                className={`p-2 rounded-xl border text-left text-xs transition-colors cursor-pointer ${
                  (settings.targetAccelerator ?? 'gpu,cpu') === acc.id
                    ? 'bg-cyan-950/40 border-cyan-500/60 text-white font-semibold'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="font-medium text-slate-200">{acc.label}</div>
                <div className="text-[10px] text-slate-500">{acc.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Peak RAM Budget Ceiling */}
        <div className="pt-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-sm mb-1.5">
            <span className="text-slate-200 font-medium">RAM Budget Ceiling</span>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-xs font-mono ${
                (settings.peakRamCeilingMb ?? 2800) <= 2800
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                  : 'bg-red-950 text-red-400 border border-red-800'
              }`}>
                {settings.peakRamCeilingMb ?? 2800} MB
              </span>
              {(settings.peakRamCeilingMb ?? 2800) <= 2800 ? (
                <span className="text-[10px] text-emerald-400 font-medium">Within A16 Envelope</span>
              ) : (
                <span className="text-[10px] text-red-400 font-medium">Exceeds 2.8 GB Limit!</span>
              )}
            </div>
          </div>
          <input
            type="range"
            min="1500"
            max="4000"
            step="100"
            value={settings.peakRamCeilingMb ?? 2800}
            onChange={(e) => onUpdateSettings({ ...settings, peakRamCeilingMb: parseInt(e.target.value, 10) })}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
          />
          <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
            <span>1,500 MB (Min)</span>
            <span className="text-emerald-400">~2,800 MB (iPad A16 Ceiling)</span>
            <span>4,000 MB (8GB iPad)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
