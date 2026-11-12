import React, { useState } from 'react';
import {
  LITERT_EDGE_MODELS,
  evaluateEdgeModelRamCompatibility,
} from '../utils/liquidArchitectureEngine';
import { EdgeModelDefinition } from '../types/architecture';
import {
  Cpu,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Brain,
  Layers,
  Sparkles,
  Smartphone,
  Gauge,
  X,
  Radio,
  FileCode2,
  Search,
  ExternalLink,
} from 'lucide-react';

interface ModelAllowlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedModel: string;
  onSelectModel: (modelName: string) => void;
}

export const ModelAllowlistModal: React.FC<ModelAllowlistModalProps> = ({
  isOpen,
  onClose,
  selectedModel,
  onSelectModel,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'llm' | 'multimodal' | 'audio_tts' | 'benchmark'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [targetDeviceRam, setTargetDeviceRam] = useState<number>(6); // Default: iPad A16 6 GB RAM
  const [peakEnvelopeMb, setPeakEnvelopeMb] = useState<number>(2800); // Default: ~2.8 GB increased-memory-limit
  const [enableMtp, setEnableMtp] = useState<boolean>(true); // Gemma 4 Multi Token Prediction
  const [benchmarkingModel, setBenchmarkingModel] = useState<EdgeModelDefinition>(LITERT_EDGE_MODELS[0]);

  if (!isOpen) return null;

  const filteredModels = LITERT_EDGE_MODELS.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.modelId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.description.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeTab === 'llm') {
      return !m.modelType || m.modelType === 'llm';
    }
    if (activeTab === 'multimodal') {
      return m.llmSupportImage || m.llmSupportAudio || m.modelType === 'segmentation' || m.taskTypes.includes('smart_album');
    }
    if (activeTab === 'audio_tts') {
      return m.modelType === 'asr' || m.modelType === 'tts';
    }
    return true;
  });

  const activeCompat = evaluateEdgeModelRamCompatibility(benchmarkingModel, targetDeviceRam, peakEnvelopeMb);
  const hasMtp = benchmarkingModel.capabilities?.includes('speculative_decoding') || false;
  const mtpSpeedup = hasMtp && enableMtp ? 1.84 : 1.0;
  const simulatedTps = (hasMtp && enableMtp ? 38.6 : 21.0).toFixed(1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center text-white shadow-lg">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">LiteRT-LM On-Device Model Allowlist</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono font-semibold">
                  iOS Native · 13 Models
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800 font-mono">
                  MTP Powered
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Google AI Edge & LiteRT-LM deployment gallery optimized for iPad A16 (6 GB RAM · ~2.8 GB Peak Envelope).
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab & Search Bar */}
        <div className="px-6 py-3 border-b border-slate-800/80 bg-slate-900/60 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-slate-950/60 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${
                activeTab === 'all' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              All Models ({LITERT_EDGE_MODELS.length})
            </button>
            <button
              onClick={() => setActiveTab('llm')}
              className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${
                activeTab === 'llm' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Gemma LLMs
            </button>
            <button
              onClick={() => setActiveTab('multimodal')}
              className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${
                activeTab === 'multimodal' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Vision & Multimodal
            </button>
            <button
              onClick={() => setActiveTab('audio_tts')}
              className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${
                activeTab === 'audio_tts' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              ASR & TTS Voice
            </button>
            <button
              onClick={() => setActiveTab('benchmark')}
              className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${
                activeTab === 'benchmark' ? 'bg-indigo-600 text-white shadow' : 'text-indigo-400 hover:text-indigo-300'
              }`}
            >
              Hardware Benchmark
            </button>
          </div>

          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by name, task, or ID..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'benchmark' ? (
            /* Benchmark & iPad RAM Envelope Panel */
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                  <div className="text-xs text-slate-400 flex items-center justify-between">
                    <span>iPad Hardware Profile</span>
                    <Smartphone className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="text-lg font-bold text-white mt-1">Apple A16 Bionic</div>
                  <div className="text-xs text-cyan-400/90 mt-0.5">6 GB Unified LPDDR5 RAM</div>
                  <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span>increased-memory-limit enabled</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                  <div className="text-xs text-slate-400 flex items-center justify-between">
                    <span>Peak RAM Budget Envelope</span>
                    <Gauge className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-lg font-bold text-amber-400 mt-1">~2,800 MB (2.8 GB)</div>
                  <div className="text-xs text-slate-400 mt-0.5">Crash ceiling under iOS Springboard</div>
                  <div className="mt-3 text-[11px] text-slate-400 font-mono">
                    Model: {activeCompat.modelSizeMb} MB · KV: 142.5 MB
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                  <div className="text-xs text-slate-400 flex items-center justify-between">
                    <span>Gemma 4 MTP Acceleration</span>
                    <Zap className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-lg font-bold text-emerald-400 mt-1">
                    {hasMtp ? `${simulatedTps} tok/s (${mtpSpeedup}x)` : '21.0 tok/s'}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">Multi Token Prediction decode</div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">MTP Toggle:</span>
                    <button
                      onClick={() => setEnableMtp(!enableMtp)}
                      disabled={!hasMtp}
                      className={`px-2 py-0.5 text-xs rounded font-mono transition-colors ${
                        enableMtp && hasMtp ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {enableMtp && hasMtp ? 'ENABLED' : 'DISABLED'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Active Model Benchmark Card */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">Benchmarked Target</span>
                    <h3 className="text-xl font-bold text-white mt-0.5">{benchmarkingModel.name}</h3>
                    <p className="text-xs text-slate-400 font-mono">{benchmarkingModel.modelId}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {activeCompat.compatible ? (
                      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-600 text-emerald-300 text-xs font-medium">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        A16 Compatible (Fits 2.8GB Budget)
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-950/80 border border-rose-600 text-rose-300 text-xs font-medium">
                        <AlertTriangle className="w-4 h-4 text-rose-400" />
                        Exceeds 2.8GB Envelope ({activeCompat.modelSizeMb} MB)
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-500">Model File Size</span>
                    <div className="font-bold text-white font-mono mt-1">{activeCompat.modelSizeMb} MB</div>
                    <span className="text-[10px] text-slate-500">{(activeCompat.modelSizeMb / 1024).toFixed(2)} GB</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-500">Context Window</span>
                    <div className="font-bold text-cyan-300 font-mono mt-1">
                      {benchmarkingModel.defaultConfig.maxContextLength
                        ? `${(benchmarkingModel.defaultConfig.maxContextLength / 1000).toFixed(0)}K Tokens`
                        : `${benchmarkingModel.defaultConfig.maxTokens} Max`}
                    </div>
                    <span className="text-[10px] text-slate-500">Max tokens: {benchmarkingModel.defaultConfig.maxTokens}</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-500">Accelerators</span>
                    <div className="font-bold text-amber-300 font-mono mt-1">
                      {benchmarkingModel.defaultConfig.accelerators.toUpperCase()}
                    </div>
                    <span className="text-[10px] text-slate-500">LiteRT-LM Metal / GPU</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-500">Min Device RAM</span>
                    <div className="font-bold text-purple-300 font-mono mt-1">
                      {benchmarkingModel.minDeviceMemoryInGb} GB RAM
                    </div>
                    <span className="text-[10px] text-slate-500">iPad A16 has 6 GB</span>
                  </div>
                </div>

                {benchmarkingModel.updateInfo && (
                  <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-800/60 text-xs text-indigo-300 flex items-start gap-2.5">
                    <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-white">Model Update Note: </span>
                      {benchmarkingModel.updateInfo}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Model Cards Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredModels.map((model) => {
                const compat = evaluateEdgeModelRamCompatibility(model, targetDeviceRam, peakEnvelopeMb);
                const isSelected = selectedModel === model.name;
                const hasThinking = model.capabilities?.includes('llm_thinking');
                const hasSpeculative = model.capabilities?.includes('speculative_decoding');

                return (
                  <div
                    key={model.modelId}
                    className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-slate-900 border-cyan-500 ring-1 ring-cyan-500/50 shadow-lg shadow-cyan-950/30'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                    }`}
                  >
                    <div>
                      {/* Title & Badges */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-white text-sm">{model.name}</h4>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                              v{model.version}
                            </span>
                            {model.modelType && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 uppercase font-mono font-semibold">
                                {model.modelType}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate max-w-sm">
                            {model.modelId}
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              compat.compatible
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : 'bg-amber-950 text-amber-400 border border-amber-800'
                            }`}
                          >
                            {compat.modelSizeMb} MB
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-300 mt-2.5 leading-relaxed line-clamp-2">
                        {model.description}
                      </p>

                      {/* Capabilities */}
                      <div className="flex items-center gap-1.5 flex-wrap mt-3">
                        {hasThinking && (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-950 text-indigo-300 border border-indigo-800 flex items-center gap-1 font-mono">
                            <Brain className="w-3 h-3 text-indigo-400" />
                            llm_thinking
                          </span>
                        )}
                        {hasSpeculative && (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1 font-mono">
                            <Zap className="w-3 h-3 text-emerald-400" />
                            MTP Speculative
                          </span>
                        )}
                        {model.defaultConfig.maxContextLength && (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-mono">
                            {(model.defaultConfig.maxContextLength / 1000).toFixed(0)}K Context
                          </span>
                        )}
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 font-mono">
                          {model.defaultConfig.accelerators}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 font-mono">
                          Min: {model.minDeviceMemoryInGb}GB RAM
                        </span>
                      </div>
                    </div>

                    {/* Actions footer */}
                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <button
                        onClick={() => {
                          setBenchmarkingModel(model);
                          setActiveTab('benchmark');
                        }}
                        className="text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 transition-colors"
                      >
                        <Gauge className="w-3.5 h-3.5" />
                        Benchmark A16
                      </button>

                      <button
                        onClick={() => {
                          onSelectModel(model.name);
                          onClose();
                        }}
                        className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-800 hover:bg-cyan-600 text-slate-200 hover:text-white'
                        }`}
                      >
                        {isSelected ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Active Model
                          </>
                        ) : (
                          'Deploy to Canvas'
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <span>LiteRT-LM Community Checkpoint Catalog</span>
            <span>·</span>
            <span className="text-cyan-400 font-mono">A16 Envelope: 2,800 MB</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
