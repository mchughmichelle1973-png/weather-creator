import React, { useState } from 'react';
import { TornadoWarning } from '../types';
import {
  AlertTriangle,
  Copy,
  Check,
  Radio,
  Clock,
  Navigation,
  Users,
  ShieldAlert,
} from 'lucide-react';

interface WarningBulletinsViewProps {
  warnings: TornadoWarning[];
  selectedWarning: TornadoWarning | null;
  onSelectWarning: (warning: TornadoWarning) => void;
  onClose?: () => void;
}

export const WarningBulletinsView: React.FC<WarningBulletinsViewProps> = ({
  warnings,
  selectedWarning,
  onSelectWarning,
  onClose,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const activeWarning = selectedWarning || (warnings.length > 0 ? warnings[0] : null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (warnings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-slate-400 bg-slate-900/90 rounded-xl border border-slate-800">
        <Radio className="w-12 h-12 text-slate-600 mb-3" />
        <h3 className="text-base font-semibold text-slate-200">No Tornado Warnings Issued</h3>
        <p className="text-xs text-slate-400 max-w-sm mt-1">
          Draw a tornado track with at least 2 points to generate NWS meteorological warning polygons and EAS broadcast bulletins.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 rounded-xl border border-slate-800 shadow-2xl overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>Severe Weather & Marine Bulletins</span>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
                {warnings.filter(w => !w.isMarineWarning).length} Tornado · {warnings.filter(w => w.isMarineWarning).length} Marine
              </span>
            </h2>
            <div className="text-xs text-slate-400">
              National Weather Service Doppler Radar & Emergency Alert System (EAS) Bulletins
            </div>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-md transition-colors"
          >
            Close
          </button>
        )}
      </div>

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {/* Warning selector sidebar */}
        <div className="w-full md:w-80 border-r border-slate-800/80 overflow-y-auto bg-slate-900/40 p-3 flex flex-col gap-2">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 py-1">
            Issued Warning Polygons
          </div>
          {warnings.map((w) => {
            const isSelected = activeWarning?.id === w.id;
            const isEmergency = w.urgencyLevel === 'Tornado Emergency';
            const isMarine = w.isMarineWarning;

            return (
              <button
                key={w.id}
                onClick={() => onSelectWarning(w)}
                className={`flex flex-col text-left p-3 rounded-lg transition-all border ${
                  isSelected
                    ? isMarine
                      ? 'bg-sky-950/70 border-sky-400 shadow-md'
                      : isEmergency
                      ? 'bg-rose-950/60 border-rose-500 shadow-md'
                      : 'bg-slate-800 border-amber-500/80 shadow-md'
                    : isMarine
                    ? 'bg-sky-950/20 border-sky-900/60 hover:border-sky-700'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono text-xs font-bold text-white flex items-center gap-1">
                    {isMarine && <span>⚓</span>}
                    <span>{isMarine ? 'SMW' : 'POLYGON'} #{w.warningNumber}</span>
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                      isMarine
                        ? 'bg-sky-900 text-sky-200 border border-sky-700'
                        : isEmergency
                        ? 'bg-rose-600 text-white animate-pulse'
                        : w.urgencyLevel === 'Particularly Dangerous Situation (PDS)'
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-700 text-slate-200'
                    }`}
                  >
                    {isMarine ? 'Marine' : w.urgencyLevel}
                  </span>
                </div>

                <div className="text-xs font-semibold text-slate-200 line-clamp-1 mb-1">
                  {w.impactedCities.length > 0 ? w.impactedCities.join(', ') : isMarine ? 'Maritime Navigable Waters' : 'Rural District'}
                </div>

                <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
                  <span>Winds {w.peakWindsObserved} MPH</span>
                  <span>·</span>
                  <span className={w.isRadarIndicated ? 'text-amber-400' : 'text-emerald-400'}>
                    {w.isRadarIndicated ? 'Radar Indicated' : 'Observed (TDS)'}
                  </span>
                  <span>·</span>
                  <span>{w.distanceToRadarMiles} mi</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Warning Bulletin Text & Polygon Telemetry */}
        {activeWarning && (
          <div className="flex-1 flex flex-col overflow-y-auto p-6 bg-slate-950">
            {/* Urgency Announcement Card */}
            <div
              className={`p-4 rounded-xl border mb-5 flex flex-col gap-2 ${
                activeWarning.isMarineWarning
                  ? 'bg-sky-950/40 border-sky-600/80 text-sky-200'
                  : activeWarning.urgencyLevel === 'Tornado Emergency'
                  ? 'bg-rose-950/40 border-rose-600/80 text-rose-200'
                  : 'bg-amber-950/30 border-amber-600/60 text-amber-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-sm">
                  {activeWarning.isMarineWarning ? (
                    <span className="text-lg">⚓</span>
                  ) : (
                    <ShieldAlert className="w-5 h-5 text-rose-400" />
                  )}
                  <span>{activeWarning.headline}</span>
                </div>
                <button
                  onClick={() => handleCopy(activeWarning.bulletinText, activeWarning.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-slate-900/80 hover:bg-slate-900 text-slate-200 border border-slate-700/80 transition-colors"
                >
                  {copiedId === activeWarning.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Bulletin Text</span>
                    </>
                  )}
                </button>
              </div>

              {/* Telemetry pill row */}
              <div className="flex flex-wrap items-center gap-4 text-xs pt-1 text-slate-300">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Validity: {activeWarning.issuedAtSimTimeMinutes}m – {activeWarning.expiresAtSimTimeMinutes}m</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5 text-slate-400" />
                  <span>Storm Motion: {activeWarning.motionSpeedMph} MPH @ {activeWarning.motionVectorHeadingDeg}°</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span>Warned Population: {activeWarning.populationAtRisk.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1.5 font-mono">
                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    activeWarning.isRadarIndicated
                      ? 'bg-amber-950 text-amber-300 border border-amber-800'
                      : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  }`}>
                    {activeWarning.isRadarIndicated
                      ? `Radar Indicated (${activeWarning.distanceToRadarMiles} mi from Doppler)`
                      : `Radar Confirmed / TDS (${activeWarning.distanceToRadarMiles} mi)`}
                  </span>
                </div>
              </div>
            </div>

            {/* Polygon Boundary Coordinates Grid */}
            <div className="mb-5 bg-slate-900/50 p-3.5 rounded-xl border border-slate-800/80">
              <div className="text-xs font-semibold text-slate-300 mb-2 flex items-center justify-between">
                <span>Polygon Boundary Vertices (NWS Lat/Long Grid Projection)</span>
                <span className="text-[11px] font-mono text-slate-400">{activeWarning.polygon.length} Points</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
                {activeWarning.polygon.map((p, idx) => (
                  <div key={idx} className="bg-slate-950 px-2.5 py-1.5 rounded border border-slate-800 text-slate-300">
                    <span className="text-slate-500 mr-2">P{idx + 1}:</span>
                    <span>X: {p.x.toFixed(1)}, Y: {p.y.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Verbatim NWS Bulletin Output */}
            <div className="flex-1 flex flex-col">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Official NWS Meteorological Bulletin Text
              </div>
              <pre className="flex-1 bg-slate-900/90 text-emerald-400 p-5 rounded-xl border border-slate-800 font-mono text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap select-all">
                {activeWarning.bulletinText}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
