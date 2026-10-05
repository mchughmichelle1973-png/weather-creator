import React from 'react';
import {
  TornadoParameters,
  SimSpeed,
  SimulationState,
  EFScale,
} from '../types';
import { getEFScale, getEFDescription, calculateTrackDistance } from '../utils/catastropheModel';
import {
  Play,
  Pause,
  RotateCcw,
  Pencil,
  Trash2,
  Wind,
  Gauge,
  Compass,
  Zap,
  Volume2,
  VolumeX,
  FastForward,
} from 'lucide-react';

interface TornadoControlsProps {
  tornadoParams: TornadoParameters;
  simulationState: SimulationState;
  isDrawingMode: boolean;
  isAudioEnabled: boolean;
  onUpdateParams: (newParams: Partial<TornadoParameters>) => void;
  onToggleDrawingMode: () => void;
  onClearTrack: () => void;
  onUndoWaypoint: () => void;
  onLoadPreset: (presetKey: string) => void;
  onPlayPause: () => void;
  onResetSimulation: () => void;
  onSetSimSpeed: (speed: SimSpeed) => void;
  onSeekProgress: (progress: number) => void;
  onToggleAudio: () => void;
}

export const TornadoControls: React.FC<TornadoControlsProps> = ({
  tornadoParams,
  simulationState,
  isDrawingMode,
  isAudioEnabled,
  onUpdateParams,
  onToggleDrawingMode,
  onClearTrack,
  onUndoWaypoint,
  onLoadPreset,
  onPlayPause,
  onResetSimulation,
  onSetSimSpeed,
  onSeekProgress,
  onToggleAudio,
}) => {
  const efScale = getEFScale(tornadoParams.windSpeedMph);
  const efDesc = getEFDescription(efScale);
  const trackDistance = calculateTrackDistance(tornadoParams.trackPoints);

  const estimatedDurationMinutes =
    trackDistance.miles > 0 && tornadoParams.movementSpeedMph > 0
      ? (trackDistance.miles / tornadoParams.movementSpeedMph) * 60
      : 0;

  const simSpeeds: SimSpeed[] = [1, 2, 3, 4, 5, 6, 7, 8];

  return (
    <div className="flex flex-col gap-5 p-5 bg-slate-900/95 border-b lg:border-b-0 lg:border-r border-slate-800 text-slate-100 overflow-y-auto max-h-[calc(100vh-60px)]">
      {/* 1. Playback & Simulation Speed Hub */}
      <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
            Simulation Engine
          </div>
          <button
            onClick={onToggleAudio}
            className={`p-1.5 rounded transition-colors ${
              isAudioEnabled ? 'text-amber-400 bg-amber-500/10' : 'text-slate-500 hover:text-slate-300'
            }`}
            title={isAudioEnabled ? 'EAS Sound & Audio Active' : 'Sound Muted'}
          >
            {isAudioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>

        {/* Play/Pause & Reset */}
        <div className="flex items-center gap-2">
          <button
            onClick={onPlayPause}
            disabled={tornadoParams.trackPoints.length < 2}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-semibold text-sm transition-all shadow-md ${
              tornadoParams.trackPoints.length < 2
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : simulationState.isPlaying
                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                : 'bg-rose-600 hover:bg-rose-500 text-white'
            }`}
          >
            {simulationState.isPlaying ? (
              <>
                <Pause className="w-4 h-4" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>{simulationState.progress >= 0.99 ? 'Replay Simulation' : 'Run Simulation'}</span>
              </>
            )}
          </button>

          <button
            onClick={onResetSimulation}
            className="p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Reset Simulation to Touchdown"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Progress Slider */}
        <div className="flex flex-col gap-1.5 pt-1">
          <div className="flex justify-between text-xs text-slate-400 font-mono">
            <span>
              {simulationState.progress === 0
                ? 'Touchdown'
                : simulationState.progress >= 0.99
                ? 'Tornado Lifted'
                : `Progress ${(simulationState.progress * 100).toFixed(0)}%`}
            </span>
            <span>
              {(estimatedDurationMinutes * simulationState.progress).toFixed(1)} / {estimatedDurationMinutes.toFixed(1)} min
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={simulationState.progress}
            onChange={(e) => onSeekProgress(parseFloat(e.target.value))}
            className="w-full accent-rose-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        {/* Specified Speeds: realtime, 2x, 3x, 4x, 5x, 6x, 7x, and 8x */}
        <div className="flex flex-col gap-1.5 pt-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <FastForward className="w-3.5 h-3.5" />
            <span>Simulation Speed Multiplier:</span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {simSpeeds.map((s) => (
              <button
                key={s}
                onClick={() => onSetSimSpeed(s)}
                className={`py-1.5 text-xs font-semibold rounded transition-colors ${
                  simulationState.speedMultiplier === s
                    ? 'bg-rose-500 text-white shadow-sm'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {s === 1 ? '1x Real' : `${s}x`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Meteorological Parameters: Winds & EF Scale */}
      <div className="flex flex-col gap-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-400 uppercase">
            <Wind className="w-4 h-4 text-rose-400" />
            <span>Peak Vortex Winds</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs px-2 py-0.5 rounded font-bold ${
                efScale === 'EF5'
                  ? 'bg-purple-950 text-purple-300 border border-purple-700'
                  : efScale === 'EF4'
                  ? 'bg-rose-950 text-rose-300 border border-rose-700'
                  : efScale === 'EF3'
                  ? 'bg-amber-950 text-amber-300 border border-amber-700'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {efScale}
            </span>
            <span className="font-mono text-base font-bold text-rose-400 tabular-nums">
              {tornadoParams.windSpeedMph} MPH
            </span>
          </div>
        </div>

        <input
          type="range"
          min={65}
          max={320}
          step={5}
          value={tornadoParams.windSpeedMph}
          onChange={(e) => onUpdateParams({ windSpeedMph: parseInt(e.target.value, 10) })}
          className="w-full accent-rose-500 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer"
        />

        <div className="text-xs text-slate-400 leading-relaxed bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60">
          <div className="font-semibold text-slate-200 mb-0.5">{efDesc.name}</div>
          <div>{efDesc.damageDesc}</div>
        </div>
      </div>

      {/* 3. Vortex Width */}
      <div className="flex flex-col gap-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-400 uppercase">
            <Gauge className="w-4 h-4 text-amber-400" />
            <span>Vortex Width</span>
          </div>
          <div className="font-mono text-sm font-bold text-amber-400 tabular-nums">
            {tornadoParams.vortexWidthYards.toLocaleString()} yards{' '}
            <span className="text-xs font-normal text-slate-400">
              ({(tornadoParams.vortexWidthYards * 0.000568182).toFixed(2)} mi)
            </span>
          </div>
        </div>

        <input
          type="range"
          min={50}
          max={4500}
          step={50}
          value={tornadoParams.vortexWidthYards}
          onChange={(e) => onUpdateParams({ vortexWidthYards: parseInt(e.target.value, 10) })}
          className="w-full accent-amber-500 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer"
        />

        <div className="flex justify-between text-xs text-slate-400">
          <span>50 yd (Rope)</span>
          <span>1,760 yd (1 Mile)</span>
          <span>4,500 yd (Wedge)</span>
        </div>
      </div>

      {/* 4. Movement Speed (Between 5 mph and 130 mph) */}
      <div className="flex flex-col gap-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-400 uppercase">
            <Compass className="w-4 h-4 text-sky-400" />
            <span>Movement Speed (5 - 130 mph)</span>
          </div>
          <span className="font-mono text-sm font-bold text-sky-400 tabular-nums">
            {tornadoParams.movementSpeedMph} MPH
          </span>
        </div>

        <input
          type="range"
          min={5}
          max={130}
          step={1}
          value={tornadoParams.movementSpeedMph}
          onChange={(e) => onUpdateParams({ movementSpeedMph: parseInt(e.target.value, 10) })}
          className="w-full accent-sky-500 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer"
        />

        <div className="flex justify-between text-xs text-slate-400">
          <span title="Prolonged dwell time increases localized structural scouring">5 mph (Slow Staller)</span>
          <span title="Average supercell translation">45 mph (Typical)</span>
          <span title="High translational velocity">130 mph (Extreme Runner)</span>
        </div>
      </div>

      {/* 5. Precise Tornado Track Drawing */}
      <div className="flex flex-col gap-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-400 uppercase">
            <Pencil className="w-4 h-4 text-emerald-400" />
            <span>Tornado Track Path</span>
          </div>
          <span className="font-mono text-xs text-slate-300 tabular-nums">
            {trackDistance.miles.toFixed(1)} miles · {tornadoParams.trackPoints.length} waypoints
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onToggleDrawingMode}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${
              isDrawingMode
                ? 'bg-emerald-500 text-slate-950 shadow-md font-bold'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
            }`}
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>{isDrawingMode ? 'Finish Drawing Path' : 'Draw Track on Map'}</span>
          </button>

          <button
            onClick={onUndoWaypoint}
            disabled={tornadoParams.trackPoints.length === 0}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 transition-colors"
            title="Undo Last Waypoint"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onClearTrack}
            disabled={tornadoParams.trackPoints.length === 0}
            className="p-2 rounded-lg bg-slate-800 hover:bg-rose-900/60 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 hover:text-rose-200 transition-colors"
            title="Clear Entire Track"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Quick Scenario Presets */}
        <div className="flex flex-col gap-1.5 pt-1">
          <span className="text-xs text-slate-400">Meteorological Scenarios:</span>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => onLoadPreset('chicago_direct')}
              className="px-2.5 py-1.5 text-xs text-left bg-slate-800/80 hover:bg-slate-800 text-slate-200 rounded transition-colors border border-slate-700/50"
            >
              🏢 Chicago Megacity (300M)
            </button>
            <button
              onClick={() => onLoadPreset('marine_crossing')}
              className="px-2.5 py-1.5 text-xs text-left bg-sky-950/60 hover:bg-sky-900/60 text-sky-200 rounded transition-colors border border-sky-700/60"
            >
              ⚓ Offshore Marine (SMW)
            </button>
            <button
              onClick={() => onLoadPreset('lake_eldoria_waterspout')}
              className="px-2.5 py-1.5 text-xs text-left bg-sky-950/60 hover:bg-sky-900/60 text-sky-200 rounded transition-colors border border-sky-700/60"
            >
              🌊 Lake Waterspout (SMW)
            </button>
            <button
              onClick={() => onLoadPreset('iowa_city_cedar')}
              className="px-2.5 py-1.5 text-xs text-left bg-slate-800/80 hover:bg-slate-800 text-slate-200 rounded transition-colors border border-slate-700/50"
            >
              🌾 Iowa City & Cedar Rapids
            </button>
            <button
              onClick={() => onLoadPreset('cedar_rockford')}
              className="px-2.5 py-1.5 text-xs text-left bg-slate-800/80 hover:bg-slate-800 text-slate-200 rounded transition-colors border border-slate-700/50"
            >
              ⚙️ Rockford & Cedar Rapids
            </button>
            <button
              onClick={() => onLoadPreset('dubuque_davenport')}
              className="px-2.5 py-1.5 text-xs text-left bg-slate-800/80 hover:bg-slate-800 text-slate-200 rounded transition-colors border border-slate-700/50"
            >
              🚢 Dubuque & Davenport
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
