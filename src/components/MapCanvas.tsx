import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  City,
  BuildingStructure,
  MapWaypoint,
  TornadoParameters,
  TornadoWarning,
  SimulationState,
  RadarLayer,
} from '../types';
import { FictionalMapData, isLocationOverWater } from '../utils/fictionalMap';
import { getPositionAtProgress, getEFScale, YARDS_TO_MILES, MAP_UNITS_TO_MILES } from '../utils/catastropheModel';
import {
  generateReflectivityPixels,
  generateVelocityPixels,
  getNearestRadar,
  getTornadoLifecycleFactor,
  getRadarBeamDegradation,
} from '../utils/radarRenderer';
import { ZoomIn, ZoomOut, RotateCcw, Crosshair, Eye, EyeOff, Radio, Activity } from 'lucide-react';

interface MapCanvasProps {
  mapData: FictionalMapData;
  tornadoParams: TornadoParameters;
  simulationState: SimulationState;
  warnings: TornadoWarning[];
  structures: BuildingStructure[];
  radarLayer: RadarLayer;
  onToggleRadarLayer: (layer: RadarLayer) => void;
  isDrawingMode: boolean;
  onAddWaypoint: (point: MapWaypoint) => void;
  onUpdateWaypoint: (index: number, point: MapWaypoint) => void;
  onSelectStructure?: (structure: BuildingStructure | null) => void;
  onSelectWarning?: (warning: TornadoWarning | null) => void;
  selectedStructureId?: string | null;
}

export const MapCanvas: React.FC<MapCanvasProps> = ({
  mapData,
  tornadoParams,
  simulationState,
  warnings,
  structures,
  radarLayer,
  onToggleRadarLayer,
  isDrawingMode,
  onAddWaypoint,
  onUpdateWaypoint,
  onSelectStructure,
  onSelectWarning,
  selectedStructureId,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Pan and Zoom transform state
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [draggingWaypointIndex, setDraggingWaypointIndex] = useState<number | null>(null);

  // Animation frame for rotating radar & swirling debris particles
  const animFrameRef = useRef<number>(0);
  const radarSweepAngleRef = useRef<number>(0);
  const debrisParticlesRef = useRef<{ angle: number; dist: number; speed: number; size: number }[]>([]);

  // Initialize debris particles
  useEffect(() => {
    const particles = [];
    for (let i = 0; i < 60; i++) {
      particles.push({
        angle: Math.random() * Math.PI * 2,
        dist: 4 + Math.random() * 22,
        speed: 0.08 + Math.random() * 0.15,
        size: 1 + Math.random() * 2.5,
      });
    }
    debrisParticlesRef.current = particles;
  }, []);

  // Screen coordinate to map coordinate conversion
  const screenToMap = useCallback(
    (screenX: number, screenY: number): { x: number; y: number } => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const clientX = screenX - rect.left;
      const clientY = screenY - rect.top;
      // Account for canvas internal resolution vs css size
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const unscaledX = clientX * scaleX;
      const unscaledY = clientY * scaleY;
      return {
        x: (unscaledX - transform.x) / transform.scale,
        y: (unscaledY - transform.y) / transform.scale,
      };
    },
    [transform]
  );

  // Map coordinate to screen coordinate
  const mapToScreen = useCallback(
    (mapX: number, mapY: number): { x: number; y: number } => {
      return {
        x: mapX * transform.scale + transform.x,
        y: mapY * transform.scale + transform.y,
      };
    },
    [transform]
  );

  // Fit view to entire map
  const handleResetView = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const padding = 20;
    const scaleX = (canvas.width - padding * 2) / mapData.mapWidth;
    const scaleY = (canvas.height - padding * 2) / mapData.mapHeight;
    const scale = Math.min(scaleX, scaleY, 1.2);
    const x = (canvas.width - mapData.mapWidth * scale) / 2;
    const y = (canvas.height - mapData.mapHeight * scale) / 2;
    setTransform({ x, y, scale });
  };

  // Zoom controls
  const handleZoom = (delta: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const newScale = Math.max(0.5, Math.min(4.0, transform.scale * delta));
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const newX = centerX - (centerX - transform.x) * (newScale / transform.scale);
    const newY = centerY - (centerY - transform.y) * (newScale / transform.scale);
    setTransform({ x: newX, y: newY, scale: newScale });
  };

  // Center on current tornado or track
  const handleCenterOnTrack = () => {
    const canvas = canvasRef.current;
    if (!canvas || tornadoParams.trackPoints.length === 0) return;

    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    tornadoParams.trackPoints.forEach((p) => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });

    const trackWidth = Math.max(120, maxX - minX);
    const trackHeight = Math.max(120, maxY - minY);
    const scale = Math.min(canvas.width / (trackWidth * 1.6), canvas.height / (trackHeight * 1.6), 2.5);
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    const x = canvas.width / 2 - midX * scale;
    const y = canvas.height / 2 - midY * scale;
    setTransform({ x, y, scale });
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
    const newScale = Math.max(0.5, Math.min(4.5, transform.scale * zoomFactor));
    const newX = mouseX - (mouseX - transform.x) * (newScale / transform.scale);
    const newY = mouseY - (mouseY - transform.y) * (newScale / transform.scale);
    setTransform({ x: newX, y: newY, scale: newScale });
  };

  // Mouse Down
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      // Middle click or Shift+Click for pan
      setIsPanning(true);
      setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
      return;
    }

    const { x: mapX, y: mapY } = screenToMap(e.clientX, e.clientY);

    // Check if clicked near an existing waypoint to drag
    const wpIndex = tornadoParams.trackPoints.findIndex((wp) => {
      return Math.hypot(wp.x - mapX, wp.y - mapY) < 16 / transform.scale;
    });

    if (wpIndex !== -1 && isDrawingMode) {
      setDraggingWaypointIndex(wpIndex);
      return;
    }

    if (isDrawingMode) {
      // Add new waypoint
      onAddWaypoint({
        id: `wp_${Date.now()}_${tornadoParams.trackPoints.length}`,
        x: Math.round(mapX * 10) / 10,
        y: Math.round(mapY * 10) / 10,
      });
      return;
    }

    // Check if clicked on a building
    const clickedStruct = structures.find(
      (s) => Math.hypot(s.x - mapX, s.y - mapY) < 10 / transform.scale
    );
    if (clickedStruct && onSelectStructure) {
      onSelectStructure(clickedStruct);
      return;
    }

    // Check if clicked in a warning polygon
    if (warnings.length > 0 && onSelectWarning) {
      for (const warn of warnings) {
        if (isPointInPolygon({ x: mapX, y: mapY }, warn.polygon)) {
          onSelectWarning(warn);
          return;
        }
      }
    }

    // Default to panning
    setIsPanning(true);
    setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
  };

  // Mouse Move
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (draggingWaypointIndex !== null && isDrawingMode) {
      const { x: mapX, y: mapY } = screenToMap(e.clientX, e.clientY);
      const existing = tornadoParams.trackPoints[draggingWaypointIndex];
      onUpdateWaypoint(draggingWaypointIndex, {
        ...existing,
        x: Math.round(mapX * 10) / 10,
        y: Math.round(mapY * 10) / 10,
      });
      return;
    }

    if (isPanning) {
      setTransform((prev) => ({
        ...prev,
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      }));
    }
  };

  // Mouse Up
  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingWaypointIndex(null);
  };

  // Helper: check if point inside polygon
  function isPointInPolygon(pt: { x: number; y: number }, poly: { x: number; y: number }[]) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x,
        yi = poly[i].y;
      const xj = poly[j].x,
        yj = poly[j].y;
      const intersect = yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  // Set initial canvas sizing & view
  useEffect(() => {
    handleResetView();
  }, [mapData.seed]);

  // Main Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isMounted = true;

    const render = () => {
      if (!isMounted) return;

      radarSweepAngleRef.current += 0.035;
      if (radarSweepAngleRef.current > Math.PI * 2) {
        radarSweepAngleRef.current -= Math.PI * 2;
      }

      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Background void
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Apply viewport transform (pan & zoom)
      ctx.translate(transform.x, transform.y);
      ctx.scale(transform.scale, transform.scale);

      // 1. Draw Landmass (Fictional terrain)
      ctx.fillStyle = '#141d2e';
      ctx.fillRect(0, 0, mapData.mapWidth, mapData.mapHeight);

      // Elevation terrain contours
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1.2 / transform.scale;
      mapData.elevationContours.forEach((contour) => {
        ctx.beginPath();
        contour.points.forEach((p, i) => {
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
      });

      // 2. Draw Fictional Ocean / Gulf
      ctx.fillStyle = '#0b1329';
      ctx.beginPath();
      mapData.oceanPolygon.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.closePath();
      ctx.fill();

      // Coastline water break edge
      ctx.strokeStyle = '#2563eb44';
      ctx.lineWidth = 2.5 / transform.scale;
      ctx.stroke();

      // Fictional offshore islands
      mapData.islands.forEach((isl) => {
        ctx.fillStyle = '#172237';
        ctx.beginPath();
        isl.points.forEach((p, i) => {
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#1e3a8a';
        ctx.lineWidth = 1 / transform.scale;
        ctx.stroke();
      });

      // 3. Draw Fictional Lakes
      mapData.lakes.forEach((lake) => {
        ctx.fillStyle = '#0d1e3d';
        ctx.beginPath();
        lake.points.forEach((p, i) => {
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#1d4ed855';
        ctx.lineWidth = 1.5 / transform.scale;
        ctx.stroke();

        // Lake label
        ctx.font = `${Math.max(9, 11 / transform.scale)}px 'Plus Jakarta Sans', sans-serif`;
        ctx.fillStyle = '#38bdf888';
        ctx.fillText(lake.name, lake.points[0].x - 15, lake.points[0].y + 12);
      });

      // 4. Draw Fictional Rivers
      mapData.rivers.forEach((river) => {
        ctx.strokeStyle = '#1e40af88';
        ctx.lineWidth = (river.width * 1.2) / transform.scale;
        ctx.beginPath();
        river.points.forEach((p, i) => {
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
      });

      // 5. Draw County boundaries (dashed)
      ctx.setLineDash([4 / transform.scale, 4 / transform.scale]);
      ctx.strokeStyle = '#33415566';
      ctx.lineWidth = 1 / transform.scale;
      mapData.counties.forEach((county) => {
        ctx.beginPath();
        county.points.forEach((p, i) => {
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();
        ctx.stroke();

        // County center subtle label
        ctx.font = `${Math.max(8, 10 / transform.scale)}px 'Plus Jakarta Sans', sans-serif`;
        ctx.fillStyle = '#64748b55';
        ctx.fillText(county.name, county.center.x - 30, county.center.y);
      });
      ctx.setLineDash([]);

      // 6. Draw Roads / Arteries
      mapData.roads.forEach((road) => {
        ctx.beginPath();
        road.points.forEach((p, i) => {
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        if (road.type === 'interstate') {
          ctx.strokeStyle = '#d9770655'; // Interstate amber glow
          ctx.lineWidth = 2.4 / transform.scale;
          ctx.stroke();
        } else {
          ctx.strokeStyle = '#47556944';
          ctx.lineWidth = 1.4 / transform.scale;
          ctx.stroke();
        }
      });

      // 7. Radar Stations & Coverage Sweep
      mapData.radarStations.forEach((radar) => {
        // Range ring
        ctx.beginPath();
        ctx.arc(radar.x, radar.y, radar.rangeRadius, 0, Math.PI * 2);
        ctx.strokeStyle = '#0284c722';
        ctx.lineWidth = 1 / transform.scale;
        ctx.stroke();

        // Radar tower icon
        ctx.fillStyle = '#0284c7';
        ctx.beginPath();
        ctx.arc(radar.x, radar.y, 4 / transform.scale, 0, Math.PI * 2);
        ctx.fill();

        // Rotating radar beam
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(radar.x, radar.y);
        ctx.arc(
          radar.x,
          radar.y,
          radar.rangeRadius,
          radarSweepAngleRef.current - 0.25,
          radarSweepAngleRef.current
        );
        ctx.closePath();
        const sweepGrad = ctx.createRadialGradient(
          radar.x,
          radar.y,
          0,
          radar.x,
          radar.y,
          radar.rangeRadius
        );
        sweepGrad.addColorStop(0, 'rgba(56, 189, 248, 0.22)');
        sweepGrad.addColorStop(1, 'rgba(56, 189, 248, 0.01)');
        ctx.fillStyle = sweepGrad;
        ctx.fill();
        ctx.restore();

        ctx.font = `${Math.max(8, 9 / transform.scale)}px 'IBM Plex Mono', monospace`;
        ctx.fillStyle = '#38bdf899';
        ctx.fillText(`${radar.callsign}`, radar.x + 6 / transform.scale, radar.y - 4 / transform.scale);
      });

      // 7.5 Realistic NEXRAD Reflectivity or Velocity Pixel Layer (Mutually Exclusive)
      if (radarLayer !== 'off') {
        let stormCenter: { x: number; y: number } | null = null;
        let stormHeading = 45;

        if (simulationState.progress > 0 && tornadoParams.trackPoints.length >= 2) {
          const pos = getPositionAtProgress(tornadoParams.trackPoints, simulationState.progress);
          if (pos) {
            stormCenter = { x: pos.x, y: pos.y };
            stormHeading = pos.headingDeg;
          }
        } else if (tornadoParams.trackPoints.length >= 2) {
          stormCenter = { x: tornadoParams.trackPoints[0].x, y: tornadoParams.trackPoints[0].y };
          const dx = tornadoParams.trackPoints[1].x - tornadoParams.trackPoints[0].x;
          const dy = tornadoParams.trackPoints[1].y - tornadoParams.trackPoints[0].y;
          stormHeading = (Math.atan2(dy, dx) * 180) / Math.PI;
        } else if (tornadoParams.trackPoints.length === 1) {
          stormCenter = { x: tornadoParams.trackPoints[0].x, y: tornadoParams.trackPoints[0].y };
          stormHeading = 45;
        }

        if (stormCenter) {
          ctx.save();
          const nearestRadar = getNearestRadar(stormCenter.x, stormCenter.y, mapData.radarStations);
          const progress = simulationState.progress;

          if (radarLayer === 'reflectivity') {
            const pixels = generateReflectivityPixels(
              stormCenter,
              stormHeading,
              tornadoParams,
              nearestRadar,
              mapData.mapWidth,
              mapData.mapHeight,
              progress,
              4 // 4 map units per crisp radar gate pixel
            );

            pixels.forEach((px) => {
              ctx.fillStyle = px.color;
              ctx.fillRect(px.x, px.y, px.size, px.size);
              // Subtle pixel gate raster grid for authentic WSR-88D look
              ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
              ctx.lineWidth = 0.4 / transform.scale;
              ctx.strokeRect(px.x, px.y, px.size, px.size);
            });
          } else if (radarLayer === 'velocity') {
            const pixels = generateVelocityPixels(
              stormCenter,
              stormHeading,
              tornadoParams,
              nearestRadar,
              mapData.mapWidth,
              mapData.mapHeight,
              progress,
              4 // 4 map units per crisp radar gate pixel
            );

            pixels.forEach((px) => {
              ctx.fillStyle = px.color;
              ctx.fillRect(px.x, px.y, px.size, px.size);
              ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
              ctx.lineWidth = 0.4 / transform.scale;
              ctx.strokeRect(px.x, px.y, px.size, px.size);
            });

            // Doppler radial line of sight from nearest radar station to storm center
            ctx.beginPath();
            ctx.moveTo(nearestRadar.x, nearestRadar.y);
            ctx.lineTo(stormCenter.x, stormCenter.y);
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
            ctx.setLineDash([4 / transform.scale, 4 / transform.scale]);
            ctx.lineWidth = 1.2 / transform.scale;
            ctx.stroke();
            ctx.setLineDash([]);
          }
          ctx.restore();
        }
      }

      // 8. Warning Polygons (NWS Severe Weather Warning style)
      if (warnings.length > 0) {
        warnings.forEach((warn) => {
          ctx.save();
          ctx.beginPath();
          warn.polygon.forEach((p, i) => {
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          });
          ctx.closePath();

          // Fill and stroke polygon based on warning type (Special Marine Warning vs Tornado Warning)
          const isMarine = warn.isMarineWarning;
          const isEmergency = warn.urgencyLevel === 'Tornado Emergency';

          if (isMarine) {
            ctx.fillStyle = 'rgba(2, 132, 199, 0.22)';
            ctx.fill();
            ctx.strokeStyle = '#0284c7';
            ctx.lineWidth = 3 / transform.scale;
            ctx.stroke();

            const centerPolyX = (warn.polygon[0].x + warn.polygon[2].x) / 2;
            const centerPolyY = (warn.polygon[0].y + warn.polygon[2].y) / 2;
            ctx.font = `bold ${Math.max(9, 11 / transform.scale)}px 'Plus Jakarta Sans', sans-serif`;
            ctx.fillStyle = '#bae6fd';
            ctx.fillText(
              `⚓ SPECIAL MARINE WARNING #${warn.warningNumber}`,
              centerPolyX - 60 / transform.scale,
              centerPolyY
            );
          } else {
            ctx.fillStyle = isEmergency ? 'rgba(239, 68, 68, 0.28)' : 'rgba(239, 68, 68, 0.16)';
            ctx.fill();
            ctx.strokeStyle = isEmergency ? '#ef4444' : warn.isRadarIndicated ? '#f59e0b' : '#dc2626';
            ctx.lineWidth = (isEmergency ? 3.5 : 2.5) / transform.scale;
            ctx.stroke();

            const centerPolyX = (warn.polygon[0].x + warn.polygon[2].x) / 2;
            const centerPolyY = (warn.polygon[0].y + warn.polygon[2].y) / 2;
            ctx.font = `bold ${Math.max(9, 10.5 / transform.scale)}px 'Plus Jakarta Sans', sans-serif`;
            ctx.fillStyle = isEmergency ? '#fecaca' : warn.isRadarIndicated ? '#fef3c7' : '#fecaca';

            const polyLabel = isEmergency
              ? `⚠️ TORNADO EMERGENCY #${warn.warningNumber}`
              : warn.isRadarIndicated
              ? `⚠️ TOR #${warn.warningNumber} (RADAR INDICATED)`
              : `🚨 TOR #${warn.warningNumber} (OBSERVED / TDS)`;

            ctx.fillText(
              polyLabel,
              centerPolyX - 60 / transform.scale,
              centerPolyY
            );
          }

          ctx.restore();
        });
      }

      // 9. Tornado Track corridor preview (Width-scaled damage envelope)
      const pts = tornadoParams.trackPoints;
      if (pts.length >= 2) {
        const widthMiles = tornadoParams.vortexWidthYards * YARDS_TO_MILES;
        const widthMapUnits = widthMiles / MAP_UNITS_TO_MILES;
        const outerSwathMapUnits = Math.max(6, widthMapUnits * 2.8);

        // Outer swath envelope
        ctx.save();
        ctx.beginPath();
        pts.forEach((p, i) => {
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.strokeStyle = 'rgba(249, 115, 22, 0.18)';
        ctx.lineWidth = outerSwathMapUnits * 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        // Core violent corridor
        ctx.beginPath();
        pts.forEach((p, i) => {
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.strokeStyle = 'rgba(220, 38, 38, 0.45)';
        ctx.lineWidth = Math.max(3, widthMapUnits * 2);
        ctx.stroke();

        // Track centerline
        ctx.beginPath();
        pts.forEach((p, i) => {
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.strokeStyle = '#ffffffaa';
        ctx.lineWidth = 1.2 / transform.scale;
        ctx.setLineDash([3 / transform.scale, 3 / transform.scale]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        // Scoured path for simulated progress
        if (simulationState.progress > 0) {
          const currentPos = getPositionAtProgress(pts, simulationState.progress);
          if (currentPos) {
            ctx.save();
            ctx.beginPath();
            const segIdx = currentPos.segmentIndex;
            for (let i = 0; i <= segIdx; i++) {
              if (i === 0) ctx.moveTo(pts[i].x, pts[i].y);
              else ctx.lineTo(pts[i].x, pts[i].y);
            }
            ctx.lineTo(currentPos.x, currentPos.y);
            // Scoured brown-red ground track
            ctx.strokeStyle = 'rgba(153, 27, 27, 0.75)';
            ctx.lineWidth = Math.max(3, widthMapUnits * 2);
            ctx.lineCap = 'round';
            ctx.stroke();
            ctx.restore();
          }
        }
      }

      // 10. Building structures & damage visualization
      structures.forEach((st) => {
        let color = '#475569'; // default undamaged
        let size = 2.4 / transform.scale;

        if (st.damageTier === 'destroyed') {
          color = '#dc2626'; // Red
          size = 3.8 / transform.scale;
        } else if (st.damageTier === 'severe') {
          color = '#ea580c'; // Deep Orange
          size = 3.4 / transform.scale;
        } else if (st.damageTier === 'moderate') {
          color = '#f59e0b'; // Amber
          size = 3.0 / transform.scale;
        } else if (st.damageTier === 'minor') {
          color = '#84cc16'; // Lime/Yellow
          size = 2.6 / transform.scale;
        } else if (st.type === 'hospital') {
          color = '#38bdf8';
          size = 4.5 / transform.scale;
        } else if (st.type === 'commercial' && st.cityName === 'Chicago') {
          color = '#94a3b8';
          size = 3.2 / transform.scale;
        }

        ctx.fillStyle = color;

        if (st.type === 'hospital') {
          // Cross icon shape
          const s = size * 1.2;
          ctx.fillRect(st.x - s / 3, st.y - s, (s * 2) / 3, s * 2);
          ctx.fillRect(st.x - s, st.y - s / 3, s * 2, (s * 2) / 3);
        } else if (st.type === 'marine_vessel') {
          // Boat / ship hull shape
          ctx.beginPath();
          ctx.moveTo(st.x - size * 1.8, st.y);
          ctx.lineTo(st.x, st.y - size * 0.9);
          ctx.lineTo(st.x + size * 1.8, st.y);
          ctx.lineTo(st.x + size * 1.2, st.y + size * 0.9);
          ctx.lineTo(st.x - size * 1.2, st.y + size * 0.9);
          ctx.closePath();
          ctx.fill();
        } else if (st.type === 'dock_terminal') {
          // Pier / terminal rectangle with border
          ctx.fillRect(st.x - size * 2, st.y - size, size * 4, size * 2);
        } else if (st.type === 'power_station' || st.type === 'bridge') {
          // Diamond shape
          ctx.beginPath();
          ctx.moveTo(st.x, st.y - size);
          ctx.lineTo(st.x + size, st.y);
          ctx.lineTo(st.x, st.y + size);
          ctx.lineTo(st.x - size, st.y);
          ctx.closePath();
          ctx.fill();
        } else {
          // Rect
          ctx.fillRect(st.x - size / 2, st.y - size / 2, size, size);
        }

        // Highlight selected structure
        if (selectedStructureId === st.id) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2 / transform.scale;
          ctx.strokeRect(st.x - size - 2, st.y - size - 2, size * 2 + 4, size * 2 + 4);
        }
      });

      // 11. Cities & Population Nodes
      mapData.cities.forEach((city) => {
        const isChicago = city.name === 'Chicago';

        // City metropolitan halo
        const haloGrad = ctx.createRadialGradient(
          city.x,
          city.y,
          0,
          city.x,
          city.y,
          city.metroRadius
        );
        haloGrad.addColorStop(0, isChicago ? 'rgba(56, 189, 248, 0.35)' : 'rgba(148, 163, 184, 0.22)');
        haloGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
        ctx.fillStyle = haloGrad;
        ctx.beginPath();
        ctx.arc(city.x, city.y, city.metroRadius, 0, Math.PI * 2);
        ctx.fill();

        // City center marker
        ctx.fillStyle = isChicago ? '#38bdf8' : '#f8fafc';
        ctx.beginPath();
        ctx.arc(city.x, city.y, (isChicago ? 6.5 : 4.5) / transform.scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 1.5 / transform.scale;
        ctx.stroke();

        // City Name & Population Label
        ctx.save();
        ctx.font = `bold ${Math.max(10, (isChicago ? 14 : 11) / transform.scale)}px 'Plus Jakarta Sans', sans-serif`;
        ctx.fillStyle = isChicago ? '#7dd3fc' : '#ffffff';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 4;
        ctx.fillText(city.name, city.x + 8 / transform.scale, city.y - 5 / transform.scale);

        ctx.font = `${Math.max(8, (isChicago ? 11 : 9) / transform.scale)}px 'IBM Plex Mono', monospace`;
        ctx.fillStyle = isChicago ? '#bae6fd' : '#cbd5e1';
        ctx.fillText(
          `POP: ${city.population.toLocaleString()}`,
          city.x + 8 / transform.scale,
          city.y + (isChicago ? 10 : 8) / transform.scale
        );
        ctx.restore();
      });

      // 12. Active Simulation: Live Tornado Vortex, Hook Echo & Debris Ball
      if (
        tornadoParams.trackPoints.length >= 2 &&
        simulationState.progress > 0 &&
        simulationState.progress < 1
      ) {
        const currentPos = getPositionAtProgress(tornadoParams.trackPoints, simulationState.progress);
        if (currentPos) {
          const vortexRadius = Math.max(
            8,
            (tornadoParams.vortexWidthYards * YARDS_TO_MILES * 0.5) / MAP_UNITS_TO_MILES
          );

          // Detect if current vortex position is over water
          const isOverWater = isLocationOverWater(currentPos.x, currentPos.y, mapData);

          // Physical / Satellite View: Rotating funnel cloud + condensation collar + debris/spray field
          ctx.save();

          // Outer cyclonic condensation cloud (blue-tinted if waterspout, dark slate if land tornado)
          const funnelGrad = ctx.createRadialGradient(
            currentPos.x,
            currentPos.y,
            2,
            currentPos.x,
            currentPos.y,
            vortexRadius * 2.2
          );
          if (isOverWater) {
            funnelGrad.addColorStop(0, 'rgba(12, 74, 110, 0.95)');
            funnelGrad.addColorStop(0.5, 'rgba(14, 116, 144, 0.8)');
            funnelGrad.addColorStop(0.85, 'rgba(56, 189, 248, 0.35)');
            funnelGrad.addColorStop(1, 'rgba(186, 230, 253, 0)');
          } else {
            funnelGrad.addColorStop(0, 'rgba(15, 23, 42, 0.98)');
            funnelGrad.addColorStop(0.5, 'rgba(51, 65, 85, 0.85)');
            funnelGrad.addColorStop(0.85, 'rgba(100, 116, 139, 0.4)');
            funnelGrad.addColorStop(1, 'rgba(148, 163, 184, 0)');
          }
          ctx.fillStyle = funnelGrad;
          ctx.beginPath();
          ctx.arc(currentPos.x, currentPos.y, vortexRadius * 2.2, 0, Math.PI * 2);
          ctx.fill();

          // Swirling multi-vortex suction spots
          const suctionCount = tornadoParams.windSpeedMph > 165 ? 3 : 1;
          for (let s = 0; s < suctionCount; s++) {
            const sAngle = radarSweepAngleRef.current * 4 + (s * Math.PI * 2) / suctionCount;
            const sx = currentPos.x + Math.cos(sAngle) * (vortexRadius * 0.6);
            const sy = currentPos.y + Math.sin(sAngle) * (vortexRadius * 0.6);
            ctx.fillStyle = isOverWater ? '#083344' : '#0f172a';
            ctx.beginPath();
            ctx.arc(sx, sy, Math.max(2, vortexRadius * 0.25), 0, Math.PI * 2);
            ctx.fill();
          }

          // Flying debris or sea-spray froth particles in cyclonic orbit
          ctx.fillStyle = isOverWater ? '#38bdf8' : '#f87171';
          debrisParticlesRef.current.forEach((part) => {
            part.angle += part.speed;
            const px = currentPos.x + Math.cos(part.angle) * (vortexRadius * (part.dist / 14));
            const py = currentPos.y + Math.sin(part.angle) * (vortexRadius * (part.dist / 14));
            ctx.fillRect(px - part.size / 2, py - part.size / 2, part.size, part.size);
          });

          ctx.restore();

          // Live Vortex HUD Tag
          ctx.save();
          ctx.font = `bold ${Math.max(9, 10 / transform.scale)}px 'IBM Plex Mono', monospace`;
          ctx.fillStyle = isOverWater ? '#38bdf8' : '#f87171';
          ctx.fillText(
            isOverWater
              ? `🌊 WATERSPOUT | ${getEFScale(tornadoParams.windSpeedMph)} | ${tornadoParams.windSpeedMph} MPH`
              : `🌪️ ${getEFScale(tornadoParams.windSpeedMph)} | ${tornadoParams.windSpeedMph} MPH`,
            currentPos.x + 15 / transform.scale,
            currentPos.y - 12 / transform.scale
          );
          ctx.restore();
        }
      }

      // 13. Waypoints in Drawing Mode
      if (isDrawingMode || pts.length > 0) {
        pts.forEach((wp, idx) => {
          const isStart = idx === 0;
          const isEnd = idx === pts.length - 1 && pts.length > 1;

          ctx.fillStyle = isStart ? '#10b981' : isEnd ? '#ef4444' : '#f59e0b';
          ctx.beginPath();
          ctx.arc(wp.x, wp.y, 6 / transform.scale, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2 / transform.scale;
          ctx.stroke();

          // Waypoint index number
          ctx.font = `bold ${Math.max(8, 9 / transform.scale)}px 'Plus Jakarta Sans', sans-serif`;
          ctx.fillStyle = '#ffffff';
          ctx.fillText(`${idx + 1}`, wp.x - 3 / transform.scale, wp.y + 3 / transform.scale);
        });
      }

      ctx.restore();

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      isMounted = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [
    mapData,
    tornadoParams,
    simulationState,
    warnings,
    structures,
    radarLayer,
    isDrawingMode,
    transform,
    selectedStructureId,
  ]);

  // Current storm position and radar degradation metrics for legend HUD
  const currentPos =
    tornadoParams.trackPoints.length >= 2
      ? getPositionAtProgress(tornadoParams.trackPoints, simulationState.progress) || {
          x: tornadoParams.trackPoints[0].x,
          y: tornadoParams.trackPoints[0].y,
        }
      : tornadoParams.trackPoints[0] || { x: 700, y: 450 };

  const currentRadar = getNearestRadar(currentPos.x, currentPos.y, mapData.radarStations);
  const { intensityFactor, stageName } = getTornadoLifecycleFactor(simulationState.progress);
  const { distanceMiles, isRadarIndicated, canDetectTDS } = getRadarBeamDegradation(currentPos, currentRadar);

  return (
    <div className="relative w-full h-full min-h-[520px] bg-slate-950 overflow-hidden select-none">
      <canvas
        ref={canvasRef}
        width={1400}
        height={900}
        className={`w-full h-full block ${isDrawingMode ? 'cursor-crosshair' : isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
      />

      {/* Radar Mode Toggle Dock: Mutually Exclusive (Only 1 active at a time) */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center bg-slate-900/90 backdrop-blur-md p-1 rounded-xl border border-slate-700/80 shadow-2xl">
        <button
          onClick={() => onToggleRadarLayer('off')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            radarLayer === 'off'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
          title="Turn Radar Layers Off (Base Map)"
        >
          <EyeOff className="w-3.5 h-3.5" />
          <span>Radar Off</span>
        </button>

        <button
          onClick={() => onToggleRadarLayer('reflectivity')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            radarLayer === 'reflectivity'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
          title="Toggle NEXRAD 0.5° Base Reflectivity Pixels (dBZ) — Turns off Velocity"
        >
          <Radio className="w-3.5 h-3.5" />
          <span>Reflectivity (dBZ)</span>
          {radarLayer === 'reflectivity' && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse ml-0.5"></span>
          )}
        </button>

        <button
          onClick={() => onToggleRadarLayer('velocity')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            radarLayer === 'velocity'
              ? 'bg-rose-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
          title="Toggle NEXRAD Storm-Relative Velocity Pixels (SRV) — Turns off Reflectivity"
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Velocity (SRV)</span>
          {radarLayer === 'velocity' && (
            <span className="w-1.5 h-1.5 rounded-full bg-rose-300 animate-pulse ml-0.5"></span>
          )}
        </button>
      </div>

      {/* Floating Canvas Zoom & View Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-1.5 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-lg border border-slate-800 shadow-xl z-20">
        <button
          onClick={() => handleZoom(1.2)}
          className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
          title="Zoom In"
          aria-label="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleZoom(0.83)}
          className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
          title="Zoom Out"
          aria-label="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleCenterOnTrack}
          className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
          title="Center on Tornado Track"
          aria-label="Center on Track"
        >
          <Crosshair className="w-4 h-4" />
        </button>
        <button
          onClick={handleResetView}
          className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
          title="Reset Full Map View"
          aria-label="Reset View"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Radar Calibration Color Bar & Product Legend */}
      {radarLayer === 'reflectivity' && (
        <div className="absolute bottom-4 left-4 z-20 bg-slate-900/95 backdrop-blur-md px-3.5 py-2.5 rounded-xl border border-slate-700 shadow-2xl flex flex-col gap-1.5 text-xs font-mono select-none animate-fade-in max-w-md">
          <div className="flex items-center justify-between text-[11px] text-slate-300 font-sans">
            <span className="font-bold flex items-center gap-1.5 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              NEXRAD Level-II Super-Res Base Reflectivity
            </span>
            <span className="text-[10px] text-slate-400 font-mono">0.5° Tilt · dBZ</span>
          </div>

          {/* dBZ Color Bar Strip */}
          <div className="flex items-center rounded overflow-hidden h-3 border border-slate-800">
            <div className="flex-1 h-full bg-[#04e9e7]" title="5-10 dBZ (Light rain/drizzle)"></div>
            <div className="flex-1 h-full bg-[#019ff4]" title="10-15 dBZ"></div>
            <div className="flex-1 h-full bg-[#0300f4]" title="15-20 dBZ"></div>
            <div className="flex-1 h-full bg-[#02fd02]" title="20-25 dBZ (Moderate rain)"></div>
            <div className="flex-1 h-full bg-[#01c501]" title="25-30 dBZ"></div>
            <div className="flex-1 h-full bg-[#008e00]" title="30-35 dBZ"></div>
            <div className="flex-1 h-full bg-[#fdf802]" title="35-40 dBZ (Heavy rain)"></div>
            <div className="flex-1 h-full bg-[#e5bc00]" title="40-45 dBZ"></div>
            <div className="flex-1 h-full bg-[#fd9500]" title="45-50 dBZ (Very heavy rain)"></div>
            <div className="flex-1 h-full bg-[#fd0000]" title="50-55 dBZ (Torrential)"></div>
            <div className="flex-1 h-full bg-[#d40000]" title="55-60 dBZ (Hail core)"></div>
            <div className="flex-1 h-full bg-[#bc0000]" title="60-65 dBZ (Severe hail)"></div>
            <div className="flex-1 h-full bg-[#f800fd]" title="65-70 dBZ (Giant hail/TDS)"></div>
            <div className="flex-1 h-full bg-[#9854c6]" title="70-75 dBZ (Debris ball)"></div>
            <div className="flex-1 h-full bg-[#ffffff]" title="75+ dBZ (Violent TDS)"></div>
          </div>

          {/* Scale Labels */}
          <div className="flex justify-between text-[9px] text-slate-400 font-mono px-0.5">
            <span>5</span>
            <span>15</span>
            <span>25</span>
            <span>35</span>
            <span>45</span>
            <span>55</span>
            <span>65</span>
            <span className="text-white font-bold">75+ dBZ</span>
          </div>

          <div className="text-[10px] text-slate-400 flex flex-col gap-1 pt-1 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-slate-300">
                Stage: <strong className="text-amber-400">{stageName}</strong> ({Math.round(intensityFactor * 100)}% vortex wind)
              </span>
              <span>{canDetectTDS ? '🎯 TDS Debris Ball Resolved' : 'No Ground Debris (Aloft)'}</span>
            </div>
            <div className="flex items-center justify-between text-[9px] text-slate-500 font-mono">
              <span>Scanning: {currentRadar.callsign} ({distanceMiles} mi range)</span>
              <span className={isRadarIndicated ? 'text-amber-400' : 'text-emerald-400'}>
                {isRadarIndicated ? '⚠️ Beam Degradation (Radar Indicated)' : '🟢 Low-Level Beam Resolution High'}
              </span>
            </div>
          </div>
        </div>
      )}

      {radarLayer === 'velocity' && (
        <div className="absolute bottom-4 left-4 z-20 bg-slate-900/95 backdrop-blur-md px-3.5 py-2.5 rounded-xl border border-slate-700 shadow-2xl flex flex-col gap-1.5 text-xs font-mono select-none animate-fade-in max-w-md">
          <div className="flex items-center justify-between text-[11px] text-slate-300 font-sans">
            <span className="font-bold flex items-center gap-1.5 text-rose-400">
              <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse"></span>
              NEXRAD Storm-Relative / Base Velocity (SRV)
            </span>
            <span className="text-[10px] text-slate-400 font-mono">0.5° Tilt · Knots</span>
          </div>

          {/* Doppler Inbound/Outbound Velocity Strip: Pure Green (Inbound) and Pure Red (Outbound) */}
          <div className="flex items-center rounded overflow-hidden h-3 border border-slate-800">
            {/* Inbound (Pure Green Shades: -85 to -4 KT) */}
            <div className="flex-1 h-full bg-[#022c22]" title="<-85 KT (Extreme Inbound)"></div>
            <div className="flex-1 h-full bg-[#064e3b]" title="-70 KT"></div>
            <div className="flex-1 h-full bg-[#047857]" title="-55 KT"></div>
            <div className="flex-1 h-full bg-[#059669]" title="-42 KT"></div>
            <div className="flex-1 h-full bg-[#10b981]" title="-30 KT"></div>
            <div className="flex-1 h-full bg-[#22c55e]" title="-20 KT"></div>
            <div className="flex-1 h-full bg-[#4ade80]" title="-12 KT"></div>
            <div className="flex-1 h-full bg-[#86efac]" title="-4 KT"></div>
            {/* Neutral Isodop (Zero) */}
            <div className="w-2.5 h-full bg-[#475569]" title="0 KT (Neutral Isodop)"></div>
            {/* Outbound (Pure Red Shades: +4 to +85+ KT) */}
            <div className="flex-1 h-full bg-[#fca5a5]" title="+4 KT"></div>
            <div className="flex-1 h-full bg-[#f87171]" title="+12 KT"></div>
            <div className="flex-1 h-full bg-[#ef4444]" title="+20 KT"></div>
            <div className="flex-1 h-full bg-[#dc2626]" title="+30 KT"></div>
            <div className="flex-1 h-full bg-[#b91c1c]" title="+42 KT"></div>
            <div className="flex-1 h-full bg-[#991b1b]" title="+55 KT"></div>
            <div className="flex-1 h-full bg-[#7f1d1d]" title="+70 KT"></div>
            <div className="flex-1 h-full bg-[#450a0a]" title="+85+ KT (Extreme Outbound)"></div>
          </div>

          {/* Scale Labels */}
          <div className="flex justify-between text-[9px] text-slate-400 font-mono px-0.5">
            <span className="text-emerald-400 font-bold">-80 KT Inbound (Green)</span>
            <span className="text-slate-400">0</span>
            <span className="text-rose-400 font-bold">+80 KT Outbound (Red)</span>
          </div>

          <div className="text-[10px] text-slate-400 flex flex-col gap-1 pt-1 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-amber-300 font-semibold">
                ⚡ TVS Couplet ({stageName})
              </span>
              <span className="font-mono text-slate-300">
                ΔV: ~{Math.round((tornadoParams.windSpeedMph / 1.15) * intensityFactor * (isRadarIndicated ? 0.65 : 1.0))} KT Gate-to-Gate
              </span>
            </div>
            <div className="flex items-center justify-between text-[9px] text-slate-500 font-mono">
              <span>Scanning: {currentRadar.callsign} ({distanceMiles} mi range)</span>
              <span className={isRadarIndicated ? 'text-amber-400' : 'text-emerald-400'}>
                {isRadarIndicated ? '⚠️ Distant Radar: Beam Broadening (Radar Indicated)' : '🟢 Sharp Gate Shear (Observed)'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Drawing mode hint toast */}
      {isDrawingMode && (
        <div className="absolute top-16 left-4 z-20 bg-amber-500/90 backdrop-blur text-slate-950 px-3.5 py-1.5 rounded-md font-medium text-xs shadow-lg flex items-center gap-2">
          <Crosshair className="w-3.5 h-3.5" />
          <span>Click on the map to add track waypoints. Drag existing points to adjust path.</span>
        </div>
      )}

      {/* Map scale & coordinates indicator */}
      <div className="absolute bottom-3 right-4 z-20 flex items-center gap-4 text-xs font-mono text-slate-400 bg-slate-950/80 px-3 py-1.5 rounded-md border border-slate-800/80">
        <div className="flex items-center gap-1.5">
          <div className="w-12 h-0.5 bg-slate-400 relative">
            <div className="absolute -left-0.5 -top-1 w-0.5 h-2.5 bg-slate-400"></div>
            <div className="absolute -right-0.5 -top-1 w-0.5 h-2.5 bg-slate-400"></div>
          </div>
          <span>12.5 mi</span>
        </div>
        <span>·</span>
        <span>Aethelgard Basin Grid</span>
        <span>·</span>
        <span>Not USA Geography</span>
      </div>
    </div>
  );
};
