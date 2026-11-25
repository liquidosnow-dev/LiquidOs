import React, { useState } from 'react';
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Terminal,
} from 'lucide-react';
import {
  AuditLedgerEntry,
  ChatMessage,
  ModelOption,
  Project,
} from '../../types';
import { CloudSandboxSpecs, CloudflareBindings } from '../../types/sandbox';
import { ControlPlaneState } from '../../utils/ingestionControlPlane';
import {
  ProjectBriefStatus,
  SpatialNavigationState,
  WorkspaceProjectRecord,
} from '../../utils/spatialNavigation';
import { WorkspaceTabType } from '../PreviewCanvas';
import { GlassPanel } from '../ui/GlassPanel';
import {
  TransitionController,
  useSpatialController,
} from '../navigation/TransitionController';
import { CentralAI } from './CentralAI';
import { DirectionalPanel } from './DirectionalPanel';
import { CommandConsole } from './CommandConsole';
import { SystemTelemetry } from '../panels/SystemTelemetry';
import { ProjectWorkspace } from '../panels/ProjectWorkspace';
import { ToolLibrary } from '../panels/ToolLibrary';
import { RecentActivity } from '../panels/RecentActivity';
import { QuickAccess } from '../panels/QuickAccess';

interface SpatialNavigationProps {
  spatialState: SpatialNavigationState;
  setSpatialState: React.Dispatch<React.SetStateAction<SpatialNavigationState>>;
  workbenchOpen: boolean;
  onOpenWorkbench: (tab?: WorkspaceTabType) => void;
  selectedModel: ModelOption;
  selectedPersona: string;
  onSelectPersona: (persona: string) => void;
  isLoading: boolean;
  autonomousMode: boolean;
  onToggleAutonomousMode: () => void;
  autonomousStatus: string | null;
  onStopAutonomousLoop: () => void;
  pendingSyncCount: number;
  controlPlaneState: ControlPlaneState;
  specs: CloudSandboxSpecs;
  bindings: CloudflareBindings;
  watchTestStatus: {
    isRunning: boolean;
    passed: number;
    failed: number;
    total: number;
  } | null;
  project: Project;
  workspaceProjects: WorkspaceProjectRecord[];
  onSelectWorkspaceProject: (projectId: string) => void;
  onCreateWorkspaceProject: (input: {
    name: string;
    description: string;
    stack: string;
  }) => void;
  onSubmitProjectBrief: (
    projectId: string,
    brief: {
      title: string;
      objectives: string;
      constraints: string;
      targetStack: string;
    }
  ) => void;
  onReviewProjectBrief: (
    projectId: string,
    status: ProjectBriefStatus,
    reviewNotes: string
  ) => void;
  messages: ChatMessage[];
  onSendMessage: (prompt: string, persona?: string) => Promise<void>;
  onApplyAllFiles: (files: { path: string; content: string }[]) => void;
  auditLedger: AuditLedgerEntry[];
  externalPrompt?: string;
  onClearExternalPrompt?: () => void;
  consoleFocusNonce: number;
  onBumpConsoleFocus: () => void;
}

export const SpatialNavigation: React.FC<SpatialNavigationProps> = ({
  spatialState,
  setSpatialState,
  workbenchOpen,
  onOpenWorkbench,
  selectedModel,
  selectedPersona,
  onSelectPersona,
  isLoading,
  autonomousMode,
  onToggleAutonomousMode,
  autonomousStatus,
  onStopAutonomousLoop,
  pendingSyncCount,
  controlPlaneState,
  specs,
  bindings,
  watchTestStatus,
  project,
  workspaceProjects,
  onSelectWorkspaceProject,
  onCreateWorkspaceProject,
  onSubmitProjectBrief,
  onReviewProjectBrief,
  messages,
  onSendMessage,
  onApplyAllFiles,
  auditLedger,
  externalPrompt,
  onClearExternalPrompt,
  consoleFocusNonce,
  onBumpConsoleFocus,
}) => {
  const { navigate, toggleDirection, goHome, goBack } = useSpatialController(
    spatialState,
    setSpatialState
  );
  const [homePrompt, setHomePrompt] = useState('');

  const activeDir = spatialState.activeDirection;
  const isHome = activeDir === 'HOME';
  const canGoBack = spatialState.history.length > 1;

  const handleHomeConsoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = homePrompt.trim();
    navigate('SOUTH');
    onBumpConsoleFocus();
    if (text) {
      setHomePrompt('');
      await onSendMessage(text, selectedPersona);
    }
  };

  return (
    <TransitionController
      state={spatialState}
      setState={setSpatialState}
      disabled={workbenchOpen}
      className="relative flex-1 min-h-0 h-full w-full overflow-hidden flex flex-col lg:block"
    >
      {/* Persistent Central AI Anchor — Always fixed at center on desktop & top strip on mobile */}
      <CentralAI
        activeDirection={activeDir}
        selectedModel={selectedModel}
        selectedPersona={selectedPersona}
        onSelectPersona={onSelectPersona}
        isProcessing={isLoading}
        autonomousMode={autonomousMode}
        onToggleAutonomousMode={onToggleAutonomousMode}
        autonomousStatus={autonomousStatus}
        pendingSyncCount={pendingSyncCount}
        onFocusConsole={() => {
          navigate('SOUTH');
          onBumpConsoleFocus();
        }}
        onGoHome={goHome}
      />

      {/* Directional Cardinal Edge Triggers (Desktop) */}
      <button
        type="button"
        data-testid="spatial-nav-north"
        aria-label={activeDir === 'NORTH' ? 'Close Telemetry' : 'Expand North System Telemetry'}
        onClick={() => toggleDirection('NORTH')}
        className={`mercury-press hidden lg:flex items-center justify-center w-9 h-7 rounded-full border absolute left-1/2 -translate-x-1/2 top-2 z-[35] cursor-pointer transition-all ${
          activeDir === 'NORTH'
            ? 'bg-cyan-500/25 border-cyan-300/60 text-cyan-100'
            : 'bg-slate-950/75 border-cyan-400/35 text-cyan-300 hover:border-cyan-300/70'
        }`}
      >
        <ChevronUp className={`w-4 h-4 transition-transform ${activeDir === 'NORTH' ? 'rotate-180' : ''}`} />
      </button>

      <button
        type="button"
        data-testid="spatial-nav-south"
        aria-label={activeDir === 'SOUTH' ? 'Close Console' : 'Expand South Command Console'}
        onClick={() => toggleDirection('SOUTH')}
        className={`mercury-press hidden lg:flex items-center justify-center w-9 h-7 rounded-full border absolute left-1/2 -translate-x-1/2 bottom-2 z-[35] cursor-pointer transition-all ${
          activeDir === 'SOUTH'
            ? 'bg-cyan-500/25 border-cyan-300/60 text-cyan-100'
            : 'bg-slate-950/75 border-cyan-400/35 text-cyan-300 hover:border-cyan-300/70'
        }`}
      >
        <ChevronDown className={`w-4 h-4 transition-transform ${activeDir === 'SOUTH' ? 'rotate-180' : ''}`} />
      </button>

      <button
        type="button"
        data-testid="spatial-nav-west"
        aria-label={activeDir === 'WEST' ? 'Close Project Workspace' : 'Expand West Project Workspace'}
        onClick={() => toggleDirection('WEST')}
        className={`mercury-press hidden lg:flex items-center justify-center w-7 h-10 rounded-full border absolute left-2 top-1/2 -translate-y-1/2 z-[35] cursor-pointer transition-all ${
          activeDir === 'WEST'
            ? 'bg-cyan-500/25 border-cyan-300/60 text-cyan-100'
            : 'bg-slate-950/75 border-cyan-400/35 text-cyan-300 hover:border-cyan-300/70'
        }`}
      >
        <ChevronLeft className={`w-4 h-4 transition-transform ${activeDir === 'WEST' ? 'rotate-180' : ''}`} />
      </button>

      <button
        type="button"
        data-testid="spatial-nav-east"
        aria-label={activeDir === 'EAST' ? 'Close Tool Library' : 'Expand East Tool Library'}
        onClick={() => toggleDirection('EAST')}
        className={`mercury-press hidden lg:flex items-center justify-center w-7 h-10 rounded-full border absolute right-2 top-1/2 -translate-y-1/2 z-[35] cursor-pointer transition-all ${
          activeDir === 'EAST'
            ? 'bg-cyan-500/25 border-cyan-300/60 text-cyan-100'
            : 'bg-slate-950/75 border-cyan-400/35 text-cyan-300 hover:border-cyan-300/70'
        }`}
      >
        <ChevronRight className={`w-4 h-4 transition-transform ${activeDir === 'EAST' ? 'rotate-180' : ''}`} />
      </button>

      {/* Orbital HOME Overview Cards (Fade & go inert when any cardinal panel is active) */}
      <div
        aria-hidden={!isHome}
        inert={!isHome ? true : undefined}
        className={`relative z-10 flex-1 min-h-0 h-full overflow-y-auto lg:overflow-hidden px-3 pb-4 lg:p-0 transition-opacity duration-200 ${
          isHome ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Mobile Quick Cardinal Pills (< lg) */}
        <div className="grid grid-cols-4 gap-1.5 mb-3 lg:hidden">
          {(['NORTH', 'WEST', 'EAST', 'SOUTH'] as const).map((dir) => (
            <button
              key={dir}
              type="button"
              onClick={() => navigate(dir)}
              className="py-1.5 px-2 rounded-lg bg-slate-950/80 border border-cyan-400/30 text-[10px] font-semibold text-cyan-200 text-center"
            >
              {dir === 'NORTH'
                ? '↑ Telemetry'
                : dir === 'WEST'
                ? '← Projects'
                : dir === 'EAST'
                ? '→ Tools'
                : '↓ Console'}
            </button>
          ))}
        </div>

        <div className="space-y-3 lg:space-y-0 lg:static">
          {/* Top-Center: Telemetry Overview Card */}
          <div className="lg:absolute lg:top-10 lg:left-1/2 lg:-translate-x-1/2 lg:w-[460px] lg:max-w-[38vw]">
            <GlassPanel
              withEdgeRipple
              rippleDurationSec={15}
              className="px-4 py-2.5 cursor-pointer"
              onClick={() => navigate('NORTH')}
            >
              <SystemTelemetry
                compact
                specs={specs}
                controlPlaneState={controlPlaneState}
                watchTestStatus={watchTestStatus}
                onOpenFullMetrics={() => onOpenWorkbench('metrics')}
              />
            </GlassPanel>
          </div>

          {/* Left Wing: Project Workspace Summary Card */}
          <div className="lg:absolute lg:left-11 lg:top-[22%] lg:w-[min(32vw,420px)] lg:h-[268px]">
            <GlassPanel
              elevated
              withEdgeRipple
              rippleDurationSec={14}
              rippleDelaySec={-3}
              className="h-full p-4"
            >
              <ProjectWorkspace
                compact
                projects={workspaceProjects}
                activeProjectId={project.id}
                onSelectProject={onSelectWorkspaceProject}
                onCreateProject={onCreateWorkspaceProject}
                onSubmitBrief={onSubmitProjectBrief}
                onReviewBrief={onReviewProjectBrief}
                onOpenWorkbench={(tab) => onOpenWorkbench(tab || 'preview')}
              />
            </GlassPanel>
          </div>

          {/* Right Wing: Tool Library Summary Card */}
          <div className="lg:absolute lg:right-11 lg:top-[22%] lg:w-[min(32vw,420px)] lg:h-[268px]">
            <GlassPanel
              elevated
              withEdgeRipple
              rippleDurationSec={14}
              rippleDelaySec={-7}
              className="h-full p-4"
            >
              <ToolLibrary
                compact
                onApplyCreatedFile={(f) => onApplyAllFiles([f])}
                onOpenWorkbench={(tab) => onOpenWorkbench(tab)}
                onFocusConsole={(prompt) => {
                  navigate('SOUTH');
                  onBumpConsoleFocus();
                  if (prompt) {
                    void onSendMessage(prompt, selectedPersona);
                  }
                }}
              />
            </GlassPanel>
          </div>

          {/* Bottom-Left: Recent Activity */}
          <div className="lg:absolute lg:left-11 lg:bottom-5 lg:w-[min(24vw,320px)] lg:h-[132px]">
            <GlassPanel className="h-full p-3.5">
              <RecentActivity
                auditLedger={auditLedger}
                commits={project.commits}
                messages={messages}
              />
            </GlassPanel>
          </div>

          {/* Bottom-Center: Command Console Prompt Entry */}
          <div className="lg:absolute lg:bottom-11 lg:left-1/2 lg:-translate-x-1/2 lg:w-[min(42vw,540px)]">
            <GlassPanel elevated className="p-3">
              <div className="flex items-center justify-between mb-2">
                <button
                  type="button"
                  onClick={() => {
                    navigate('SOUTH');
                    onBumpConsoleFocus();
                  }}
                  className="flex items-center gap-2 text-xs font-semibold text-slate-100 hover:text-cyan-200 cursor-pointer"
                >
                  <Terminal className="w-3.5 h-3.5 text-cyan-300" />
                  <span>Command Console</span>
                </button>
                <span className="flex items-center gap-1.5 shrink-0 text-[10px] font-mono text-slate-400">
                  <span>{selectedModel.name}</span>
                  <span className="text-slate-600">·</span>
                  <span className="inline-flex items-center gap-0.5 text-cyan-300/90">
                    Expand
                    <ChevronDown className="w-3 h-3" />
                  </span>
                </span>
              </div>
              <form
                onSubmit={handleHomeConsoleSubmit}
                className="flex items-center gap-2 rounded-xl bg-[#040812]/90 border border-slate-300/20 focus-within:border-cyan-400/55 px-3 py-1.5"
              >
                <span className="text-cyan-400 font-mono text-sm font-bold">&gt;</span>
                <input
                  type="text"
                  value={homePrompt}
                  onChange={(e) => setHomePrompt(e.target.value)}
                  placeholder="Enter command or ask anything..."
                  aria-label="Quick Command Console Prompt"
                  className="flex-1 bg-transparent text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none"
                />
                <button
                  type="submit"
                  aria-label="Send to Command Console"
                  className="mercury-press w-7 h-7 rounded-full flex items-center justify-center bg-cyan-500/20 border border-cyan-300/45 text-cyan-200 hover:bg-cyan-500/35 cursor-pointer"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </form>
            </GlassPanel>
          </div>

          {/* Bottom-Right: Quick Access */}
          <div className="lg:absolute lg:right-11 lg:bottom-5 lg:w-[min(24vw,320px)] lg:h-[132px]">
            <GlassPanel className="h-full p-3.5">
              <QuickAccess
                onOpenSettings={() => onOpenWorkbench('settings')}
                onOpenDiagnostics={() => navigate('NORTH')}
                onOpenArchives={() => onOpenWorkbench('backups')}
              />
            </GlassPanel>
          </div>
        </div>
      </div>

      {/* 4 Persistent Directional Panels moving smoothly around the Fixed CentralAI */}
      <DirectionalPanel
        direction="NORTH"
        isActive={activeDir === 'NORTH'}
        onClose={goHome}
        onBack={goBack}
        canGoBack={canGoBack}
        onExpandWorkbench={() => onOpenWorkbench('metrics')}
        expandLabel="Full Metrics"
      >
        <SystemTelemetry
          specs={specs}
          controlPlaneState={controlPlaneState}
          watchTestStatus={watchTestStatus}
          onOpenFullMetrics={() => onOpenWorkbench('metrics')}
        />
      </DirectionalPanel>

      <DirectionalPanel
        direction="WEST"
        isActive={activeDir === 'WEST'}
        onClose={goHome}
        onBack={goBack}
        canGoBack={canGoBack}
        onExpandWorkbench={() => onOpenWorkbench('preview')}
        expandLabel="Open Workbench"
      >
        <ProjectWorkspace
          projects={workspaceProjects}
          activeProjectId={project.id}
          onSelectProject={onSelectWorkspaceProject}
          onCreateProject={onCreateWorkspaceProject}
          onSubmitBrief={onSubmitProjectBrief}
          onReviewBrief={onReviewProjectBrief}
          onOpenWorkbench={(tab) => onOpenWorkbench(tab || 'preview')}
        />
      </DirectionalPanel>

      <DirectionalPanel
        direction="EAST"
        isActive={activeDir === 'EAST'}
        onClose={goHome}
        onBack={goBack}
        canGoBack={canGoBack}
        onExpandWorkbench={() => onOpenWorkbench('testing')}
        expandLabel="Test Runner"
      >
        <ToolLibrary
          onApplyCreatedFile={(f) => onApplyAllFiles([f])}
          onOpenWorkbench={(tab) => onOpenWorkbench(tab)}
          onFocusConsole={(prompt) => {
            navigate('SOUTH');
            onBumpConsoleFocus();
            if (prompt) {
              void onSendMessage(prompt, selectedPersona);
            }
          }}
        />
      </DirectionalPanel>

      <DirectionalPanel
        direction="SOUTH"
        isActive={activeDir === 'SOUTH'}
        onClose={goHome}
        onBack={goBack}
        canGoBack={canGoBack}
        onExpandWorkbench={() => onOpenWorkbench('split')}
        expandLabel="Split Canvas"
      >
        <CommandConsole
          messages={messages}
          onSendMessage={onSendMessage}
          isLoading={isLoading}
          selectedPersona={selectedPersona}
          activeModelName={selectedModel.name}
          files={project.files}
          specs={specs}
          bindings={bindings}
          autonomousMode={autonomousMode}
          onToggleAutonomousMode={onToggleAutonomousMode}
          autonomousStatus={autonomousStatus}
          onStopAutonomousLoop={onStopAutonomousLoop}
          onOpenPreviewSplit={() => onOpenWorkbench('split')}
          onApplyAllFiles={onApplyAllFiles}
          externalPrompt={externalPrompt}
          onClearExternalPrompt={onClearExternalPrompt}
          focusNonce={consoleFocusNonce}
        />
      </DirectionalPanel>
    </TransitionController>
  );
};
