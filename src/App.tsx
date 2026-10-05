import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  TornadoParameters,
  SimulationState,
  SimSpeed,
  BuildingStructure,
  TornadoWarning,
  MapWaypoint,
  RadarLayer,
} from './types';
import { generateFictionalMap, FictionalMapData } from './utils/fictionalMap';
import {
  computeDamageAssessment,
  getEFScale,
  calculateTrackDistance,
} from './utils/catastropheModel';
import { playEASAlertTone, startTornadoRumble, stopTornadoRumble } from './utils/audioSynth';
import { Navigation } from './components/Navigation';
import { MapCanvas } from './components/MapCanvas';
import { TornadoControls } from './components/TornadoControls';
import { WarningBulletinsView } from './components/WarningBulletinsView';
import { DamageAssessmentView, formatCurrency } from './components/DamageAssessmentView';
import { CatastropheReportModal } from './components/CatastropheReportModal';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  DollarSign,
  Flame,
  Radio,
  X,
} from 'lucide-react';

export default function App() {
  // 1. Fictional Map State (Random map, not the USA)
  const [mapSeed, setMapSeed] = useState<number>(42);
  const mapData = useMemo<FictionalMapData>(() => generateFictionalMap(mapSeed), [mapSeed]);

  // 2. Tornado Parameters State
  const [tornadoParams, setTornadoParams] = useState<TornadoParameters>(() => {
    // Default initial track traversing towards Chicago and offshore into marine waters
    const initialWaypoints: MapWaypoint[] = [
      { id: 'wp_0', x: 680, y: 420 },
      { id: 'wp_1', x: 820, y: 370 },
      { id: 'wp_2', x: 950, y: 340 },
      { id: 'wp_3', x: 1020, y: 330 }, // Near Chicago (300.3M pop)
      { id: 'wp_4', x: 1160, y: 340 }, // Marine waters -> triggers Special Marine Warning!
    ];

    return {
      windSpeedMph: 195, // EF4
      vortexWidthYards: 1200,
      movementSpeedMph: 45, // 5 to 130 mph
      trackPoints: initialWaypoints,
      efScale: 'EF4',
    };
  });

  // 3. Simulation Execution State
  const [simulationState, setSimulationState] = useState<SimulationState>({
    isPlaying: false,
    speedMultiplier: 2, // 1x to 8x
    progress: 0,
    elapsedSimSeconds: 0,
    totalSimSeconds: 120,
    currentCoord: null,
    currentSegmentIndex: 0,
    hasFinished: false,
  });

  // 4. UI & Display States
  const [activeTab, setActiveTab] = useState<'simulator' | 'warnings' | 'damage'>('simulator');
  const [radarLayer, setRadarLayer] = useState<RadarLayer>('reflectivity');
  const [isDrawingMode, setIsDrawingMode] = useState<boolean>(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState<boolean>(true);
  const [selectedStructure, setSelectedStructure] = useState<BuildingStructure | null>(null);
  const [selectedWarning, setSelectedWarning] = useState<TornadoWarning | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [showLiftedNotification, setShowLiftedNotification] = useState<boolean>(false);

  // Toggle radar layer: Only 1 can be turned on at a time. Clicking active layer turns it off.
  const handleToggleRadarLayer = (layer: RadarLayer) => {
    setRadarLayer((prev) => (prev === layer ? 'off' : layer));
  };

  // 5. Catastrophe Modeling & Damage Assessment
  const { assessment, updatedStructures } = useMemo(() => {
    return computeDamageAssessment(
      tornadoParams,
      mapData.cities,
      mapData.structures,
      simulationState.progress,
      mapData
    );
  }, [tornadoParams, mapData, simulationState.progress]);

  // Previous progress tracking for triggering notifications when tornado lifts
  const prevProgressRef = useRef<number>(0);

  // Simulation Animation Loop
  useEffect(() => {
    if (!simulationState.isPlaying) {
      stopTornadoRumble();
      return;
    }

    if (isAudioEnabled) {
      startTornadoRumble(0.09);
    }

    let lastTime = performance.now();
    let animId: number;

    const tick = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      const trackDist = calculateTrackDistance(tornadoParams.trackPoints);
      const totalDurationSec =
        tornadoParams.movementSpeedMph > 0 && trackDist.miles > 0
          ? (trackDist.miles / tornadoParams.movementSpeedMph) * 3600
          : 60;

      // Base simulation time: 1 progress step = dt * speedMultiplier / realTrackDuration
      // Scaled so a full track simulation is enjoyable and responsive
      const simRate = (dt * simulationState.speedMultiplier) / Math.max(12, totalDurationSec * 0.25);

      setSimulationState((prev) => {
        const nextProgress = Math.min(1.0, prev.progress + simRate);
        const hasFinished = nextProgress >= 1.0;

        if (hasFinished && prev.progress < 1.0) {
          setShowLiftedNotification(true);
          if (isAudioEnabled) {
            playEASAlertTone(600);
          }
        }

        return {
          ...prev,
          progress: nextProgress,
          isPlaying: !hasFinished,
          hasFinished,
          elapsedSimSeconds: prev.elapsedSimSeconds + dt * simulationState.speedMultiplier,
        };
      });

      if (simulationState.progress < 1.0) {
        animId = requestAnimationFrame(tick);
      }
    };

    animId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animId);
      stopTornadoRumble();
    };
  }, [
    simulationState.isPlaying,
    simulationState.speedMultiplier,
    tornadoParams.movementSpeedMph,
    tornadoParams.trackPoints,
    isAudioEnabled,
  ]);

  // Handle parameter updates
  const handleUpdateParams = (newParams: Partial<TornadoParameters>) => {
    setTornadoParams((prev) => {
      const merged = { ...prev, ...newParams };
      merged.efScale = getEFScale(merged.windSpeedMph);
      return merged;
    });
  };

  // Play / Pause Simulation
  const handlePlayPause = () => {
    if (tornadoParams.trackPoints.length < 2) return;

    if (simulationState.progress >= 0.99) {
      // Replay from beginning
      setSimulationState((prev) => ({
        ...prev,
        progress: 0,
        isPlaying: true,
        hasFinished: false,
      }));
      setShowLiftedNotification(false);
      if (isAudioEnabled) {
        playEASAlertTone(750);
      }
      return;
    }

    setSimulationState((prev) => ({
      ...prev,
      isPlaying: !prev.isPlaying,
    }));
  };

  // Reset Simulation
  const handleResetSimulation = () => {
    setSimulationState((prev) => ({
      ...prev,
      isPlaying: false,
      progress: 0,
      hasFinished: false,
    }));
    setShowLiftedNotification(false);
  };

  // Scrub progress
  const handleSeekProgress = (p: number) => {
    setSimulationState((prev) => ({
      ...prev,
      progress: p,
      hasFinished: p >= 1.0,
      isPlaying: p >= 1.0 ? false : prev.isPlaying,
    }));
    if (p >= 1.0 && prevProgressRef.current < 1.0) {
      setShowLiftedNotification(true);
    }
    prevProgressRef.current = p;
  };

  // Waypoint operations
  const handleAddWaypoint = (point: MapWaypoint) => {
    setTornadoParams((prev) => ({
      ...prev,
      trackPoints: [...prev.trackPoints, point],
    }));
  };

  const handleUpdateWaypoint = (index: number, point: MapWaypoint) => {
    setTornadoParams((prev) => {
      const updated = [...prev.trackPoints];
      updated[index] = point;
      return { ...prev, trackPoints: updated };
    });
  };

  const handleUndoWaypoint = () => {
    setTornadoParams((prev) => ({
      ...prev,
      trackPoints: prev.trackPoints.slice(0, -1),
    }));
  };

  const handleClearTrack = () => {
    setTornadoParams((prev) => ({
      ...prev,
      trackPoints: [],
    }));
    handleResetSimulation();
  };

  // Preset Tracks
  const handleLoadPreset = (key: string) => {
    let pts: MapWaypoint[] = [];
    let wind = 195;
    let width = 1200;
    let speed = 45;

    if (key === 'marine_crossing') {
      // Direct track into coastal ocean/sound triggering Special Marine Warnings
      pts = [
        { id: 'p1', x: 880, y: 360 },
        { id: 'p2', x: 1000, y: 330 }, // Chicago coastal edge
        { id: 'p3', x: 1120, y: 340 }, // Open water -> Special Marine Warning!
        { id: 'p4', x: 1250, y: 320 }, // Open maritime sound & islands
      ];
      wind = 210;
      width = 1600;
      speed = 48;
    } else if (key === 'chicago_direct') {
      // Direct hit on the 300,310,000 population mega-metropolis
      pts = [
        { id: 'p1', x: 820, y: 410 },
        { id: 'p2', x: 910, y: 370 },
        { id: 'p3', x: 1000, y: 330 }, // Exact Chicago center
        { id: 'p4', x: 1070, y: 310 },
        { id: 'p5', x: 1150, y: 350 }, // Offshore water
      ];
      wind = 240; // EF5 Violent Wedge
      width = 2400;
      speed = 35;
    } else if (key === 'iowa_city_cedar') {
      // Iowa City (174.2k) to Cedar Rapids (1.46M)
      pts = [
        { id: 'p1', x: 520, y: 620 },
        { id: 'p2', x: 520, y: 530 }, // Iowa City
        { id: 'p3', x: 480, y: 420 },
        { id: 'p4', x: 440, y: 320 }, // Cedar Rapids
        { id: 'p5', x: 410, y: 220 },
      ];
      wind = 180; // EF4
      width = 1200;
      speed = 46;
    } else if (key === 'cedar_rockford') {
      // Cedar Rapids (1.46M) through Rockford (25.6k) and Lake Eldoria
      pts = [
        { id: 'p1', x: 340, y: 360 },
        { id: 'p2', x: 440, y: 320 }, // Cedar Rapids
        { id: 'p3', x: 580, y: 270 },
        { id: 'p4', x: 720, y: 250 }, // Rockford
        { id: 'p5', x: 840, y: 220 },
      ];
      wind = 175; // EF4
      width = 1100;
      speed = 52;
    } else if (key === 'lake_eldoria_waterspout') {
      // Waterspout directly traversing Lake Eldoria inland waters -> Special Marine Warning!
      pts = [
        { id: 'p1', x: 500, y: 220 },
        { id: 'p2', x: 620, y: 200 }, // Lake Eldoria
        { id: 'p3', x: 740, y: 190 }, // Lake Eldoria
        { id: 'p4', x: 860, y: 210 }, // East coast
      ];
      wind = 145; // EF3
      width = 900;
      speed = 38;
    } else if (key === 'dubuque_davenport') {
      // Dubuque (300.5k) to Davenport (18.4k)
      pts = [
        { id: 'p1', x: 660, y: 480 },
        { id: 'p2', x: 660, y: 550 }, // Dubuque
        { id: 'p3', x: 770, y: 630 },
        { id: 'p4', x: 890, y: 710 }, // Davenport
        { id: 'p5', x: 980, y: 780 },
      ];
      wind = 185; // EF4
      width = 1300;
      speed = 44;
    }

    setTornadoParams({
      windSpeedMph: wind,
      vortexWidthYards: width,
      movementSpeedMph: speed,
      trackPoints: pts,
      efScale: getEFScale(wind),
    });

    handleResetSimulation();
  };

  // Re-generate random map (Not the USA)
  const handleRegenerateMap = () => {
    const nextSeed = Math.floor(Math.random() * 999999);
    setMapSeed(nextSeed);
    handleResetSimulation();
  };

  return (
    <div className="flex flex-col w-full h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans select-none">
      {/* Top Bar Navigation */}
      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        warningsCount={assessment.warningsIssuedCount}
        radarLayer={radarLayer}
        onToggleRadarLayer={handleToggleRadarLayer}
        onRegenerateMap={handleRegenerateMap}
        onOpenReportModal={() => setIsReportModalOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {activeTab === 'simulator' && (
          <>
            {/* Left/Sidebar: Tornado Parameters & Simulation Controls */}
            <div className="w-full lg:w-96 shrink-0 h-auto lg:h-full z-10">
              <TornadoControls
                tornadoParams={tornadoParams}
                simulationState={simulationState}
                isDrawingMode={isDrawingMode}
                isAudioEnabled={isAudioEnabled}
                onUpdateParams={handleUpdateParams}
                onToggleDrawingMode={() => setIsDrawingMode(!isDrawingMode)}
                onClearTrack={handleClearTrack}
                onUndoWaypoint={handleUndoWaypoint}
                onLoadPreset={handleLoadPreset}
                onPlayPause={handlePlayPause}
                onResetSimulation={handleResetSimulation}
                onSetSimSpeed={(s: SimSpeed) =>
                  setSimulationState((prev) => ({ ...prev, speedMultiplier: s }))
                }
                onSeekProgress={handleSeekProgress}
                onToggleAudio={() => setIsAudioEnabled(!isAudioEnabled)}
              />
            </div>

            {/* Center/Right: Interactive Map Canvas */}
            <div className="flex-1 h-full relative">
              <MapCanvas
                mapData={mapData}
                tornadoParams={tornadoParams}
                simulationState={simulationState}
                warnings={assessment.warnings}
                structures={updatedStructures}
                radarLayer={radarLayer}
                onToggleRadarLayer={handleToggleRadarLayer}
                isDrawingMode={isDrawingMode}
                onAddWaypoint={handleAddWaypoint}
                onUpdateWaypoint={handleUpdateWaypoint}
                onSelectStructure={setSelectedStructure}
                onSelectWarning={(w) => {
                  setSelectedWarning(w);
                  setActiveTab('warnings');
                }}
                selectedStructureId={selectedStructure?.id}
              />

              {/* Live Mini HUD / Status Bar */}
              <div className="absolute top-4 left-4 z-20 hidden md:flex items-center gap-3 bg-slate-900/90 backdrop-blur-md px-4 py-2 rounded-xl border border-slate-800 shadow-xl text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-slate-300 font-sans font-semibold">
                    {simulationState.isPlaying ? 'Simulation Running' : 'Meteorological Engine Ready'}
                  </span>
                </div>
                <span className="text-slate-600">|</span>
                <span className="text-slate-400">
                  Loss: <strong className="text-emerald-400">{formatCurrency(assessment.totalEconomicLoss)}</strong>
                </span>
                <span className="text-slate-600">|</span>
                <span className="text-slate-400">
                  Damaged: <strong className="text-amber-400">{assessment.structuresImpacted.total}</strong>
                </span>
                <span className="text-slate-600">|</span>
                <span className="text-slate-400">
                  Warnings: <strong className="text-rose-400">{assessment.warningsIssuedCount}</strong>
                </span>
              </div>

              {/* Selected Structure Inspector Drawer */}
              {selectedStructure && (
                <div className="absolute bottom-4 left-4 z-20 bg-slate-900/95 backdrop-blur-md p-4 rounded-xl border border-slate-700 shadow-2xl max-w-sm text-xs animate-fade-in">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-bold text-white text-sm capitalize">
                      {selectedStructure.name || `${selectedStructure.cityName || 'Rural'} ${selectedStructure.type}`}
                    </div>
                    <button
                      onClick={() => setSelectedStructure(null)}
                      className="text-slate-400 hover:text-white p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono mb-2">
                    <div className="bg-slate-950 p-2 rounded border border-slate-800">
                      <span className="text-slate-500">Damage State:</span>
                      <div className="font-bold capitalize text-rose-400">
                        {selectedStructure.damageTier} ({selectedStructure.damagePercent}%)
                      </div>
                    </div>
                    <div className="bg-slate-950 p-2 rounded border border-slate-800">
                      <span className="text-slate-500">Asset Value:</span>
                      <div className="font-bold text-emerald-400">
                        {formatCurrency(selectedStructure.value)}
                      </div>
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-400 flex justify-between">
                    <span>Experienced Winds: {selectedStructure.maxWindExperienced || 0} MPH</span>
                    <span>Occupancy: {selectedStructure.occupancy}</span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Tab 2: Warning Bulletins & EAS Output */}
        {activeTab === 'warnings' && (
          <div className="w-full h-full p-4 lg:p-6 overflow-hidden">
            <WarningBulletinsView
              warnings={assessment.warnings}
              selectedWarning={selectedWarning}
              onSelectWarning={setSelectedWarning}
              onClose={() => setActiveTab('simulator')}
            />
          </div>
        )}

        {/* Tab 3: Damage Assessment & Catastrophe Modeling Dashboard */}
        {activeTab === 'damage' && (
          <div className="w-full h-full overflow-y-auto">
            <DamageAssessmentView
              assessment={assessment}
              structures={updatedStructures}
              selectedStructure={selectedStructure}
              onSelectStructure={(s) => {
                setSelectedStructure(s);
                setActiveTab('simulator');
              }}
              onOpenReportModal={() => setIsReportModalOpen(true)}
            />
          </div>
        )}

        {/* Post-Event "Tornado Lifted" Toast Alert */}
        {showLiftedNotification && (
          <div className="absolute top-20 right-6 z-40 max-w-md bg-slate-900/95 backdrop-blur-md p-4 rounded-xl border border-rose-500 shadow-2xl animate-fade-in flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                <span>Tornado Has Lifted</span>
              </div>
              <button
                onClick={() => setShowLiftedNotification(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-300">
              The meteorological vortex has dissipated. <strong>{assessment.warningsIssuedCount} Warning Polygons</strong> were generated ({assessment.tornadoWarningsIssuedCount} Tornado Warnings, {assessment.marineWarningsIssuedCount} Special Marine Warnings) along with comprehensive damage and catastrophe assessments.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => {
                  setShowLiftedNotification(false);
                  setActiveTab('warnings');
                }}
                className="flex-1 py-1.5 px-3 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-semibold transition-colors"
              >
                View Warning Bulletins
              </button>
              <button
                onClick={() => {
                  setShowLiftedNotification(false);
                  setActiveTab('damage');
                }}
                className="flex-1 py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-semibold transition-colors border border-slate-700"
              >
                View Damage Map
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Official Disaster Dossier Export Modal */}
      <CatastropheReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        assessment={assessment}
        params={tornadoParams}
      />
    </div>
  );
}
