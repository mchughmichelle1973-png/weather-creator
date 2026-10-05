import React from 'react';
import { RadarLayer } from '../types';
import {
  Tornado,
  RefreshCw,
  Layers,
  FileSpreadsheet,
  AlertTriangle,
  Building,
} from 'lucide-react';

interface NavigationProps {
  activeTab: 'simulator' | 'warnings' | 'damage';
  setActiveTab: (tab: 'simulator' | 'warnings' | 'damage') => void;
  warningsCount: number;
  radarLayer?: RadarLayer;
  onToggleRadarLayer?: (layer: RadarLayer) => void;
  onRegenerateMap: () => void;
  onOpenReportModal: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  warningsCount,
  radarLayer = 'off',
  onToggleRadarLayer,
  onRegenerateMap,
  onOpenReportModal,
}) => {
  return (
    <header className="flex items-center justify-between px-6 py-3.5 border-b border-slate-800 bg-slate-950 text-slate-100 z-30 select-none">
      {/* Zone 1: Single text element wordmark */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-rose-600/10 border border-rose-500/20 flex items-center justify-center text-rose-500 shadow-sm">
          <Tornado className="w-5 h-5" />
        </div>
        <span className="text-lg font-bold tracking-tight text-white font-sans">
          Weather Creator
        </span>
      </div>

      {/* Zone 2: 4-6 clean text navigation links / segmented controls */}
      <nav className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
        <button
          onClick={() => setActiveTab('simulator')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'simulator'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Radar & Map</span>
        </button>

        <button
          onClick={() => setActiveTab('warnings')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'warnings'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Warnings & Bulletins</span>
          {warningsCount > 0 && (
            <span className="font-mono text-[11px] px-1.5 py-0.2 rounded-full bg-rose-950 text-rose-300 border border-rose-800">
              {warningsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('damage')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'damage'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Building className="w-3.5 h-3.5" />
          <span>Damage Assessment</span>
        </button>
      </nav>

      {/* Radar Mode Pill Quick Toggle (Only 1 active at a time) */}
      {onToggleRadarLayer && (
        <div className="hidden xl:flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs">
          <span className="text-[11px] text-slate-400 px-2 font-mono">Radar Layer:</span>
          <button
            onClick={() => onToggleRadarLayer('off')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
              radarLayer === 'off'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            Off
          </button>
          <button
            onClick={() => onToggleRadarLayer('reflectivity')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
              radarLayer === 'reflectivity'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            Reflectivity (dBZ)
          </button>
          <button
            onClick={() => onToggleRadarLayer('velocity')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
              radarLayer === 'velocity'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            Velocity (SRV)
          </button>
        </div>
      )}

      {/* Zone 3: 1-2 primary actions */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={onRegenerateMap}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors whitespace-nowrap"
          title="Regenerate Random Fictional Map"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Random Map</span>
        </button>

        <button
          onClick={onOpenReportModal}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors shadow-sm whitespace-nowrap"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-rose-400" />
          <span>Dossier</span>
        </button>
      </div>
    </header>
  );
};
