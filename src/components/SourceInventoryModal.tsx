import React, { useState } from 'react';
import {
  SEVENTEEN_SOURCES_INVENTORY,
  CONSOLIDATED_REPOSITORY_TREE,
  A2A_BOUNDARY_TEST_RESULTS,
} from '../utils/liquidArchitectureEngine';
import { SourceInventoryItem, ConsolidatedRepoNode } from '../types/architecture';
import {
  BookOpen,
  FolderGit2,
  CheckCircle2,
  ExternalLink,
  Code2,
  FileText,
  Image as ImageIcon,
  FlaskConical,
  X,
  Search,
  ChevronRight,
  ShieldCheck,
  Terminal,
  Cpu,
  Lock,
} from 'lucide-react';

interface SourceInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SourceInventoryModal: React.FC<SourceInventoryModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'sources' | 'repository' | 'a2a_tests'>('sources');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedDir, setSelectedDir] = useState<ConsolidatedRepoNode>(CONSOLIDATED_REPOSITORY_TREE[0]);
  const [selectedFileIdx, setSelectedFileIdx] = useState<number>(0);

  if (!isOpen) return null;

  const filteredSources = SEVENTEEN_SOURCES_INVENTORY.filter((s) => {
    const matchesSearch =
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.citation.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (typeFilter !== 'all' && s.type !== typeFilter) return false;
    return true;
  });

  const selectedFile = selectedDir.files[selectedFileIdx] || selectedDir.files[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">Active Source Inventory & Repository</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono font-semibold">
                  17 Sources Verified
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800 font-mono">
                  24/24 A2A Tests Pass
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Master architectural synthesis spanning local specifications, enterprise connectors, test frameworks & schematics.
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

        {/* Tab Selector */}
        <div className="px-6 py-3 border-b border-slate-800/80 bg-slate-900/60 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 p-1 bg-slate-950/60 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('sources')}
              className={`px-3 py-1.5 rounded-lg transition-colors font-medium flex items-center gap-1.5 ${
                activeTab === 'sources' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              17-Source Inventory Matrix
            </button>
            <button
              onClick={() => setActiveTab('repository')}
              className={`px-3 py-1.5 rounded-lg transition-colors font-medium flex items-center gap-1.5 ${
                activeTab === 'repository' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <FolderGit2 className="w-3.5 h-3.5" />
              Reconstructed Repository Tree
            </button>
            <button
              onClick={() => setActiveTab('a2a_tests')}
              className={`px-3 py-1.5 rounded-lg transition-colors font-medium flex items-center gap-1.5 ${
                activeTab === 'a2a_tests' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <FlaskConical className="w-3.5 h-3.5" />
              A2A 24-Test Suite (8 Boundaries)
            </button>
          </div>

          {activeTab === 'sources' && (
            <div className="flex items-center gap-2">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
              >
                <option value="all">All Media Types</option>
                <option value="Markdown">Markdown Specs</option>
                <option value="URL">Live URLs</option>
                <option value="Image/Schematic">Visual Schematics</option>
                <option value="Test Suite">Test Suites</option>
              </select>

              <div className="relative min-w-[180px]">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search sources..."
                  className="w-full pl-8 pr-2.5 py-1.5 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'sources' && (
            /* 17 Sources Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSources.map((source) => (
                <div
                  key={source.id}
                  className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 hover:bg-slate-900 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold bg-cyan-950 text-cyan-400 border border-cyan-800">
                        {source.citation}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-md font-mono ${
                          source.type === 'Markdown'
                            ? 'bg-blue-950/80 text-blue-300 border border-blue-800'
                            : source.type === 'URL'
                            ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
                            : source.type === 'Image/Schematic'
                            ? 'bg-purple-950/80 text-purple-300 border border-purple-800'
                            : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                        }`}
                      >
                        {source.type}
                      </span>
                    </div>

                    <h4 className="font-bold text-white text-sm mt-2.5">{source.title}</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed line-clamp-3">
                      {source.description}
                    </p>

                    {source.boundaryCoverage && (
                      <div className="mt-3 text-[11px] text-cyan-400/90 font-mono flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span>{source.boundaryCoverage}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-slate-500 font-mono text-[10px] truncate max-w-[180px]">
                      {source.keyArtifacts[0]}
                    </div>
                    {source.urlOrPath && (
                      <span className="text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1">
                        View Reference
                        <ExternalLink className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'repository' && (
            /* Reconstructed Repository Tree Explorer */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
              {/* Directory Column */}
              <div className="lg:col-span-4 space-y-2 overflow-y-auto max-h-[600px] pr-2">
                <div className="text-xs font-mono text-slate-400 mb-2 uppercase tracking-wider">
                  Modules (10 Root Directories)
                </div>
                {CONSOLIDATED_REPOSITORY_TREE.map((dir) => (
                  <button
                    key={dir.directory}
                    onClick={() => {
                      setSelectedDir(dir);
                      setSelectedFileIdx(0);
                    }}
                    className={`w-full p-3 rounded-xl border text-left transition-all ${
                      selectedDir.directory === dir.directory
                        ? 'bg-indigo-950/40 border-indigo-500 ring-1 ring-indigo-500/50'
                        : 'bg-slate-950/40 border-slate-800 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-white">{dir.directory}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                        {dir.files.length} files
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{dir.description}</p>
                    <span className="text-[10px] text-cyan-400/80 font-mono mt-1 block">{dir.citation}</span>
                  </button>
                ))}
              </div>

              {/* File Viewer Column */}
              <div className="lg:col-span-8 flex flex-col rounded-xl bg-slate-950/80 border border-slate-800 overflow-hidden">
                {/* File list pills */}
                <div className="p-3 border-b border-slate-800 bg-slate-900/60 flex items-center gap-2 overflow-x-auto">
                  {selectedDir.files.map((file, idx) => (
                    <button
                      key={file.name}
                      onClick={() => setSelectedFileIdx(idx)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                        selectedFileIdx === idx
                          ? 'bg-indigo-600 text-white font-medium shadow'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      {file.name}
                    </button>
                  ))}
                </div>

                {/* File details & preview */}
                {selectedFile && (
                  <div className="p-5 space-y-4 flex-1 overflow-y-auto">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-mono text-sm font-bold text-white">{selectedFile.path}</h4>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-indigo-300 font-mono uppercase">
                            {selectedFile.language}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1">{selectedFile.purpose}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-mono text-cyan-400">{selectedFile.size}</span>
                        <div className="text-[10px] text-slate-500 font-mono">{selectedFile.citation}</div>
                      </div>
                    </div>

                    <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-4 font-mono text-xs text-slate-200">
                      <div className="text-[11px] text-slate-500 mb-2 border-b border-slate-800 pb-1">
                        Synthesized Source Code Preview
                      </div>
                      <pre className="overflow-x-auto text-cyan-300 leading-relaxed">
                        {selectedFile.previewSnippet}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'a2a_tests' && (
            /* A2A 24-Test Suite */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/80 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-emerald-300 text-sm">
                    tests/unit/pipeline/test_a2a_engine.py
                  </h3>
                  <p className="text-xs text-emerald-400/80 mt-0.5">
                    Co-validates all 8 operational boundaries of the a2a_transfer_engine.py pipeline.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    24 / 24 Tests Passing (100%)
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                {A2A_BOUNDARY_TEST_RESULTS.map((boundary) => (
                  <div
                    key={boundary.boundaryId}
                    className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-cyan-950 border border-cyan-800 text-cyan-400 font-mono text-xs flex items-center justify-center font-bold">
                          B{boundary.boundaryId}
                        </span>
                        <h4 className="font-bold text-white text-sm">{boundary.boundaryName}</h4>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-mono">
                        <span className="text-slate-400">{boundary.executionTimeMs} ms</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                          {boundary.testCount} tests ok
                        </span>
                        <span className="text-[10px] text-slate-500">{boundary.sourceCitation}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
                      {boundary.testNames.map((testName) => (
                        <div
                          key={testName}
                          className="px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800/80 text-[11px] font-mono text-slate-300 flex items-center gap-2"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="truncate">{testName}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span>Atomic Nexus & Liquid OS Synthesis</span>
            <span>·</span>
            <span className="text-cyan-400 font-mono">17 Sources Cataloged</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
