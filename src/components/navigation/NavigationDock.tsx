import React from 'react';
import {
  Home,
  FolderKanban,
  Wrench,
  Lock,
  Settings,
  LayoutGrid,
} from 'lucide-react';
import { SpatialDirection } from '../../utils/spatialNavigation';

interface NavigationDockProps {
  activeDirection: SpatialDirection;
  workbenchOpen: boolean;
  workbenchTab: string;
  onNavigate: (dir: SpatialDirection) => void;
  onOpenVault: () => void;
  onOpenSettings: () => void;
  onOpenMore: () => void;
  onActivateCentralAI: () => void;
}

export const NavigationDock: React.FC<NavigationDockProps> = ({
  activeDirection,
  workbenchOpen,
  workbenchTab,
  onNavigate,
  onOpenVault,
  onOpenSettings,
  onOpenMore,
  onActivateCentralAI,
}) => {
  const isHome = !workbenchOpen && activeDirection === 'HOME';
  const isProjects = !workbenchOpen && activeDirection === 'WEST';
  const isTools = !workbenchOpen && activeDirection === 'EAST';
  const isVault = workbenchOpen && (workbenchTab === 'files' || workbenchTab === 'contract');
  const isSettings = workbenchOpen && workbenchTab === 'settings';
  const isMore = workbenchOpen && !isVault && !isSettings;

  const buttonCls = (active: boolean) =>
    `mercury-press group flex flex-col items-center justify-center gap-0.5 px-2.5 sm:px-4 py-1.5 rounded-xl border transition-all cursor-pointer min-w-[50px] sm:min-w-[68px] ${
      active
        ? 'bg-cyan-500/15 border-cyan-400/45 text-cyan-200 shadow-[0_0_20px_-6px_rgba(34,211,238,0.65)]'
        : 'bg-transparent border-transparent text-slate-400 hover:text-slate-100 hover:bg-white/[0.04] hover:border-slate-300/15'
    }`;

  return (
    <nav
      aria-label="Primary spatial dock"
      className="relative z-40 shrink-0 h-16 los-dock-surface px-2 sm:px-6 flex items-center justify-center"
    >
      <div className="max-w-4xl w-full flex items-center justify-between sm:justify-center sm:gap-4 md:gap-7">
        <button
          type="button"
          onClick={() => onNavigate('HOME')}
          className={buttonCls(isHome)}
          aria-current={isHome ? 'page' : undefined}
        >
          <Home className={`w-4 h-4 ${isHome ? 'text-cyan-300' : 'text-slate-400 group-hover:text-slate-200'}`} />
          <span className="text-[10px] font-medium tracking-wide">Home</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate(activeDirection === 'WEST' && !workbenchOpen ? 'HOME' : 'WEST')}
          className={buttonCls(isProjects)}
          aria-current={isProjects ? 'page' : undefined}
        >
          <FolderKanban className={`w-4 h-4 ${isProjects ? 'text-cyan-300' : 'text-slate-400 group-hover:text-slate-200'}`} />
          <span className="text-[10px] font-medium tracking-wide">Projects</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate(activeDirection === 'EAST' && !workbenchOpen ? 'HOME' : 'EAST')}
          className={buttonCls(isTools)}
          aria-current={isTools ? 'page' : undefined}
        >
          <Wrench className={`w-4 h-4 ${isTools ? 'text-cyan-300' : 'text-slate-400 group-hover:text-slate-200'}`} />
          <span className="text-[10px] font-medium tracking-wide">Tools</span>
        </button>

        {/* Central AI Crest Dock Anchor */}
        <button
          type="button"
          onClick={onActivateCentralAI}
          title="Focus Liquid AI Command Console (↓)"
          aria-label="Activate Central AI Command Console"
          className={`mercury-press relative flex items-center justify-center w-14 h-11 sm:w-20 sm:h-12 rounded-2xl border transition-all cursor-pointer ${
            activeDirection === 'SOUTH' && !workbenchOpen
              ? 'bg-cyan-500/20 border-cyan-300/60 shadow-[0_0_26px_-4px_rgba(34,211,238,0.75)]'
              : 'bg-slate-900/90 border-slate-300/25 hover:border-cyan-400/50 shadow-[0_0_20px_-8px_rgba(34,211,238,0.45)]'
          }`}
        >
          <svg
            viewBox="0 0 64 32"
            className="w-9 h-5 sm:w-11 sm:h-6"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="los-dock-inf" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="50%" stopColor="#e2e8f0" />
                <stop offset="100%" stopColor="#22d3ee" />
              </linearGradient>
            </defs>
            <path
              d="M17.5 23.5c-4.7 0-8.5-3.4-8.5-7.5s3.8-7.5 8.5-7.5c6.5 0 11 15 17.5 15 4.7 0 8.5-3.4 8.5-7.5s-3.8-7.5-8.5-7.5c-6.5 0-11 15-17.5 15Z"
              transform="translate(5 0)"
              fill="none"
              stroke="url(#los-dock-inf)"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <button
          type="button"
          onClick={onOpenVault}
          className={buttonCls(isVault)}
          aria-current={isVault ? 'page' : undefined}
        >
          <Lock className={`w-4 h-4 ${isVault ? 'text-cyan-300' : 'text-slate-400 group-hover:text-slate-200'}`} />
          <span className="text-[10px] font-medium tracking-wide">Vault</span>
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          className={buttonCls(isSettings)}
          aria-current={isSettings ? 'page' : undefined}
        >
          <Settings className={`w-4 h-4 ${isSettings ? 'text-cyan-300' : 'text-slate-400 group-hover:text-slate-200'}`} />
          <span className="text-[10px] font-medium tracking-wide">Settings</span>
        </button>

        <button
          type="button"
          onClick={onOpenMore}
          className={buttonCls(isMore)}
          aria-current={isMore ? 'page' : undefined}
        >
          <LayoutGrid className={`w-4 h-4 ${isMore ? 'text-cyan-300' : 'text-slate-400 group-hover:text-slate-200'}`} />
          <span className="text-[10px] font-medium tracking-wide">More</span>
        </button>
      </div>
    </nav>
  );
};
