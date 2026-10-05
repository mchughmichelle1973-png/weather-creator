import { TornadoParameters, MapWaypoint } from '../types';
import { FictionalMapData, RadarStation } from './fictionalMap';
import { getPositionAtProgress } from './catastropheModel';

export interface RadarPixel {
  x: number;
  y: number;
  size: number;
  value: number; // dBZ for reflectivity, Knots for velocity
  color: string;
}

// 16-level NEXRAD Level II/III standard reflectivity color palette (dBZ)
export function getReflectivityColor(dbz: number): string | null {
  if (dbz < 8) return null;
  if (dbz < 15) return '#019ff4'; // 10-15 dBZ: Light Blue (Light drizzle)
  if (dbz < 20) return '#0300f4'; // 15-20 dBZ: Deep Blue
  if (dbz < 25) return '#02fd02'; // 20-25 dBZ: Bright Lime Green (Moderate rain)
  if (dbz < 30) return '#01c501'; // 25-30 dBZ: Medium Green
  if (dbz < 35) return '#008e00'; // 30-35 dBZ: Dark Green
  if (dbz < 40) return '#fdf802'; // 35-40 dBZ: Pure Yellow (Heavy rain)
  if (dbz < 45) return '#e5bc00'; // 40-45 dBZ: Mustard Yellow
  if (dbz < 50) return '#fd9500'; // 45-50 dBZ: Vivid Orange
  if (dbz < 55) return '#fd0000'; // 50-55 dBZ: Bright Red (Torrential rain)
  if (dbz < 60) return '#d40000'; // 55-60 dBZ: Crimson Red (Severe hail)
  if (dbz < 65) return '#bc0000'; // 60-65 dBZ: Deep Red
  if (dbz < 70) return '#f800fd'; // 65-70 dBZ: Vivid Magenta (Giant hail core / TDS)
  if (dbz < 75) return '#9854c6'; // 70-75 dBZ: Violet-Purple (Tornadic Debris Ball)
  return '#ffffff'; // 75+ dBZ: White (Violent TDS Debris Ball)
}

// NEXRAD Level II Storm-Relative & Base Velocity: PURE RED-GREEN PALETTE (NO YELLOW)
// Inbound (Moving toward radar) = PURE GREEN SHADES
// Outbound (Moving away from radar) = PURE RED SHADES
export function getVelocityColor(kts: number): string | null {
  // Near-zero neutral isodop zone (-3 to +3 knots)
  if (Math.abs(kts) < 3.5) return null;

  if (kts < 0) {
    // INBOUND (toward radar): Pure Greens from light to deep emerald
    if (kts <= -85) return '#022c22'; // Darkest Emerald (Violent Inbound)
    if (kts <= -70) return '#064e3b'; // Deep Pine Green
    if (kts <= -55) return '#047857'; // Forest Green
    if (kts <= -42) return '#059669'; // Medium Emerald
    if (kts <= -30) return '#10b981'; // Vivid Green
    if (kts <= -20) return '#22c55e'; // Bright Green
    if (kts <= -12) return '#4ade80'; // Medium Light Green
    return '#86efac'; // Light Pastel Green (Slight Inbound)
  } else {
    // OUTBOUND (away from radar): Pure Reds from light coral to deep maroon (NO YELLOW!)
    if (kts >= 85) return '#450a0a'; // Darkest Ruby / Maroon (Violent Outbound)
    if (kts >= 70) return '#7f1d1d'; // Deep Dark Red
    if (kts >= 55) return '#991b1b'; // Dark Crimson
    if (kts >= 42) return '#b91c1c'; // Rich Red
    if (kts >= 30) return '#dc2626'; // Vivid Scarlet Red
    if (kts >= 20) return '#ef4444'; // Bright Red
    if (kts >= 12) return '#f87171'; // Medium Light Red
    return '#fca5a5'; // Light Pastel Red (Slight Outbound)
  }
}

// Find nearest radar station to storm center
export function getNearestRadar(
  cx: number,
  cy: number,
  radarStations: RadarStation[]
): RadarStation {
  if (radarStations.length === 0) {
    return { id: 'kdefault', callsign: 'KCRX', name: 'Valley Doppler', x: cx - 200, y: cy - 200, rangeRadius: 250 };
  }
  let best = radarStations[0];
  let bestDist = Math.hypot(radarStations[0].x - cx, radarStations[0].y - cy);
  for (let i = 1; i < radarStations.length; i++) {
    const d = Math.hypot(radarStations[i].x - cx, radarStations[i].y - cy);
    if (d < bestDist) {
      bestDist = d;
      best = radarStations[i];
    }
  }
  return best;
}

// Deterministic pseudo-random noise for realistic convective texture
function hash2d(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
  return n - Math.floor(n);
}

// Calculate tornado lifecycle intensity factor (0.0 to 1.0)
// First few minutes (first 20%): weak developing circulation ramping up as tornado drops
// Middle (20% to 80%): mature full violent intensity
// Last few minutes (80% to 100%): roping out and dissipating
export function getTornadoLifecycleFactor(progress: number): {
  intensityFactor: number;
  stageName: 'Touchdown (Developing)' | 'Mature Vortex' | 'Roping Out (Dissipating)';
} {
  const p = Math.max(0, Math.min(1, progress));
  if (p < 0.20) {
    // Ramp up from 0.38 to 1.0
    const t = p / 0.20;
    const factor = 0.38 + 0.62 * Math.sin(t * (Math.PI / 2));
    return { intensityFactor: factor, stageName: 'Touchdown (Developing)' };
  } else if (p <= 0.80) {
    // Peak mature stage
    return { intensityFactor: 1.0, stageName: 'Mature Vortex' };
  } else {
    // Decay from 1.0 down to 0.32 as tornado ropes out and lifts
    const t = (p - 0.80) / 0.20;
    const factor = 1.0 - 0.68 * Math.sin(t * (Math.PI / 2));
    return { intensityFactor: factor, stageName: 'Roping Out (Dissipating)' };
  }
}

// Calculate radar beam degradation parameters based on range from nearest radar antenna
export function getRadarBeamDegradation(
  stormCenter: { x: number; y: number },
  radar: RadarStation
): {
  distanceMapUnits: number;
  distanceMiles: number;
  beamExpansion: number;
  velocitySmearFactor: number;
  noiseAmplitude: number;
  canDetectTDS: boolean;
  isRadarIndicated: boolean;
} {
  const d = Math.hypot(stormCenter.x - radar.x, stormCenter.y - radar.y);
  const distanceMiles = Math.round(d * 0.284);

  // Close range (< 90 map units / ~25 mi): sharp beam, low altitude
  // Long range (> 115 map units / ~33 mi): beam broadening and altitude overshoot
  const excess = Math.max(0, d - 90);
  const beamExpansion = 1.0 + (excess / 95) * 1.5;
  const velocitySmearFactor = 1.0 / (1.0 + (excess / 110) * 0.85);
  const noiseAmplitude = 2.5 + (d / 75) * 6.0;
  const canDetectTDS = d <= 115;
  const isRadarIndicated = d > 115;

  return {
    distanceMapUnits: d,
    distanceMiles,
    beamExpansion,
    velocitySmearFactor,
    noiseAmplitude,
    canDetectTDS,
    isRadarIndicated,
  };
}

// Generate realistic reflectivity radar pixel grid
export function generateReflectivityPixels(
  stormCenter: { x: number; y: number },
  headingDeg: number,
  params: TornadoParameters,
  nearestRadar: RadarStation,
  mapWidth: number,
  mapHeight: number,
  progress: number = 0.5,
  gridStep: number = 4
): RadarPixel[] {
  const pixels: RadarPixel[] = [];
  const cx = stormCenter.x;
  const cy = stormCenter.y;

  // 1. Lifecycle factor: weaker at start (first few minutes) and end (roping out)
  const { intensityFactor } = getTornadoLifecycleFactor(progress);

  // 2. Beam degradation with distance from radar
  const { beamExpansion, noiseAmplitude, canDetectTDS } = getRadarBeamDegradation(stormCenter, nearestRadar);

  // Storm heading vectors
  const headingRad = (headingDeg * Math.PI) / 180;
  const forwardX = Math.cos(headingRad);
  const forwardY = Math.sin(headingRad);
  const leftX = -forwardY;
  const leftY = forwardX;

  // FFD Center (Forward Flank Downdraft)
  const ffdDist = 52;
  const ffdX = cx + forwardX * ffdDist + leftX * 24;
  const ffdY = cy + forwardY * ffdDist + leftY * 24;

  // Hail core center
  const hailX = cx + forwardX * (ffdDist * 0.72) + leftX * 18;
  const hailY = cy + forwardY * (ffdDist * 0.72) + leftY * 18;

  // Vortex core radius for Debris Ball (TDS) - smeared if distant from radar
  const effectiveVortexRadius = Math.max(6, (params.vortexWidthYards / 1760) * 9 * beamExpansion);

  // Scan bounding box around the supercell
  const minX = Math.max(0, Math.floor((cx - 130 * beamExpansion) / gridStep) * gridStep);
  const maxX = Math.min(mapWidth, Math.ceil((cx + 160 * beamExpansion) / gridStep) * gridStep);
  const minY = Math.max(0, Math.floor((cy - 140 * beamExpansion) / gridStep) * gridStep);
  const maxY = Math.min(mapHeight, Math.ceil((cy + 140 * beamExpansion) / gridStep) * gridStep);

  for (let px = minX; px <= maxX; px += gridStep) {
    for (let py = minY; py <= maxY; py += gridStep) {
      const dx = px - cx;
      const dy = py - cy;
      const distToVortex = Math.hypot(dx, dy);

      const dotForward = dx * forwardX + dy * forwardY;
      const dotLeft = dx * leftX + dy * leftY;
      const angleRel = Math.atan2(dotLeft, dotForward);

      let dbz = 0;

      // 1. Tornadic Debris Signature (TDS) / Debris Ball
      // High reflectivity only appears when:
      // - Tornado is mature (intensityFactor > 0.65)
      // - Close enough to radar to resolve ground debris (canDetectTDS = true)
      if (canDetectTDS && distToVortex <= effectiveVortexRadius * 2.2 && intensityFactor > 0.55) {
        const coreT = 1 - distToVortex / (effectiveVortexRadius * 2.2);
        const effectiveWind = params.windSpeedMph * intensityFactor;
        if (effectiveWind >= 165) {
          dbz = 66 + coreT * 11 + hash2d(px, py, 11) * 3;
        } else if (effectiveWind >= 115) {
          dbz = 57 + coreT * 10 + hash2d(px, py, 12) * 3.5;
        } else {
          dbz = 47 + coreT * 10 + hash2d(px, py, 13) * 4;
        }
      }

      // 2. Realistic Hook Echo / Cyclonic RFD Appendage
      // Weakens during touchdown and roping out, sharpest during mature stage
      const hookCenterDist = Math.hypot(dotForward - (-10), dotLeft - (-16));
      const hookRingRadius = 28 * beamExpansion;
      const distFromHookAxis = Math.abs(hookCenterDist - hookRingRadius);

      if (distFromHookAxis < 16 * beamExpansion && angleRel < 0.9 && angleRel > -2.6) {
        const hookFactor = 1 - distFromHookAxis / (16 * beamExpansion);
        const hookDbz = (38 + hookFactor * 22 * intensityFactor) + hash2d(px, py, 21) * noiseAmplitude;
        if (hookDbz > dbz) dbz = hookDbz;
      }

      // 3. Inflow Notch (BWER Vault)
      const isInflow = dotForward > 4 && dotForward < 40 && dotLeft < -4 && dotLeft > -36;
      if (isInflow && distToVortex > effectiveVortexRadius * 2.2) {
        dbz = Math.min(dbz, 12 + hash2d(px, py, 31) * 4);
      }

      // 4. Forward Flank Downdraft (FFD) Precipitation Shield & Hail Core
      const dxFfd = px - ffdX;
      const dyFfd = py - ffdY;
      const distFfd = Math.hypot(dxFfd * 0.82, dyFfd * 1.18);

      if (distFfd < 85 * beamExpansion && !isInflow) {
        const ffdT = 1 - distFfd / (85 * beamExpansion);
        // Distance volume averaging lowers peak dBZ slightly at long range
        const attenuation = 1 - Math.min(0.25, (beamExpansion - 1) * 0.15);
        let ffdDbz = (Math.pow(ffdT, 0.75) * 66 * attenuation) + (hash2d(px, py, 33) - 0.5) * noiseAmplitude;

        // Hail core in heavy precipitation center
        const dxHail = px - hailX;
        const dyHail = py - hailY;
        const distHail = Math.hypot(dxHail, dyHail);
        if (distHail < 26 * beamExpansion) {
          const hailFactor = 1 - distHail / (26 * beamExpansion);
          ffdDbz = Math.max(ffdDbz, (58 + hailFactor * 9) * attenuation + hash2d(px, py, 44) * 3);
        }

        if (ffdDbz > dbz) dbz = ffdDbz;
      }

      // 5. Flanking Line of Congestus Cells
      const flankForward = dotForward - (-55);
      const flankLeft = dotLeft - (-34);
      const flankDist = Math.hypot(flankForward * 0.7, flankLeft * 1.3);
      if (flankDist < 46 && !isInflow) {
        const flankT = 1 - flankDist / 46;
        const cellNoise = Math.sin(px * 0.12) * Math.cos(py * 0.12);
        if (cellNoise > -0.2) {
          const flankDbz = flankT * 40 + cellNoise * 12 + hash2d(px, py, 55) * 5;
          if (flankDbz > dbz) dbz = flankDbz;
        }
      }

      // Final threshold and color assignment
      if (dbz >= 9) {
        const color = getReflectivityColor(dbz);
        if (color) {
          pixels.push({
            x: px,
            y: py,
            size: gridStep,
            value: Math.round(dbz),
            color,
          });
        }
      }
    }
  }

  return pixels;
}

// Generate realistic storm-relative / base velocity radar pixel grid (PURE RED & GREEN)
// Lifecycle: Weaker for first few minutes -> Strongest in mature stage -> Weaker at end of life
// Range Degradation: Inaccuracy, beam smearing, and noise increase with distance from radar
export function generateVelocityPixels(
  stormCenter: { x: number; y: number },
  headingDeg: number,
  params: TornadoParameters,
  radar: RadarStation,
  mapWidth: number,
  mapHeight: number,
  progress: number = 0.5,
  gridStep: number = 4
): RadarPixel[] {
  const pixels: RadarPixel[] = [];
  const cx = stormCenter.x;
  const cy = stormCenter.y;

  // 1. Lifecycle Intensity Factor (weaker at start, peak at middle, weaker at end)
  const { intensityFactor } = getTornadoLifecycleFactor(progress);

  // 2. Beam Degradation based on distance to scanning radar station
  const { beamExpansion, velocitySmearFactor, noiseAmplitude } = getRadarBeamDegradation(stormCenter, radar);

  // Radar viewing vector: from radar antenna to storm center
  const rdx = cx - radar.x;
  const rdy = cy - radar.y;
  const rDist = Math.hypot(rdx, rdy) || 1;
  const radBeamX = rdx / rDist;
  const radBeamY = rdy / rDist;

  // Vector orthogonal to radar beam (azimuth cross-beam)
  const radAzimX = -radBeamY;
  const radAzimY = radBeamX;

  // Peak rotational velocity scaled by:
  // - User configured wind speed
  // - Lifecycle factor (ramping up during genesis, peaking in mature, fading as it ropes out)
  // - Velocity smear factor (distant radars average over wider volume, reducing measured delta-V)
  const baseKnots = (params.windSpeedMph / 1.15078) * 0.78;
  const maxRotKnots = baseKnots * intensityFactor * velocitySmearFactor;

  // Vortex core radius expands as beam smears at long distance
  const vortexRadius = Math.max(5.5, (params.vortexWidthYards / 1760) * 8.5 * beamExpansion);
  const mesocycloneRadius = vortexRadius * 5.0;

  // Background environmental storm motion component along radar beam
  const stormHeadingRad = (headingDeg * Math.PI) / 180;
  const stormVx = Math.cos(stormHeadingRad) * (params.movementSpeedMph / 1.15078);
  const stormVy = Math.sin(stormHeadingRad) * (params.movementSpeedMph / 1.15078);
  const ambientRadialVel = (stormVx * radBeamX + stormVy * radBeamY) * 0.32;

  // Scan bounding box around the supercell
  const minX = Math.max(0, Math.floor((cx - 120 * beamExpansion) / gridStep) * gridStep);
  const maxX = Math.min(mapWidth, Math.ceil((cx + 150 * beamExpansion) / gridStep) * gridStep);
  const minY = Math.max(0, Math.floor((cy - 130 * beamExpansion) / gridStep) * gridStep);
  const maxY = Math.min(mapHeight, Math.ceil((cy + 130 * beamExpansion) / gridStep) * gridStep);

  for (let px = minX; px <= maxX; px += gridStep) {
    for (let py = minY; py <= maxY; py += gridStep) {
      const dx = px - cx;
      const dy = py - cy;
      const distToVortex = Math.hypot(dx, dy);

      // Convective storm envelope
      if (distToVortex > 105 * beamExpansion) continue;

      // Project displacement onto cross-beam axis and along-beam axis
      const dotCrossBeam = dx * radAzimX + dy * radAzimY;

      // Cyclonic rotation:
      // Positive cross-beam = INBOUND (toward radar, negative => pure GREEN)
      // Negative cross-beam = OUTBOUND (away from radar, positive => pure RED)
      let rotRadialKnots = 0;

      if (distToVortex <= vortexRadius) {
        // TVS Couplet Core: linear gate-to-gate shear
        const normalizedCross = dotCrossBeam / vortexRadius;
        rotRadialKnots = -normalizedCross * maxRotKnots;
      } else if (distToVortex <= mesocycloneRadius) {
        // Outer mesocyclone circulation
        const decay = Math.pow(vortexRadius / distToVortex, 0.72);
        const normalizedCross = (dotCrossBeam / distToVortex);
        rotRadialKnots = -normalizedCross * maxRotKnots * decay;
      } else {
        // Peripheral shear
        const envelopeT = 1 - (distToVortex - mesocycloneRadius) / (105 * beamExpansion - mesocycloneRadius);
        const normalizedCross = (dotCrossBeam / distToVortex);
        rotRadialKnots = -normalizedCross * (maxRotKnots * 0.26) * Math.max(0, envelopeT);
      }

      // Add environmental translation & distance-scaled Doppler gate noise (more inaccurate further away!)
      const noise = (hash2d(px, py, 77) - 0.5) * noiseAmplitude;
      const totalRadialKnots = rotRadialKnots + ambientRadialVel + noise;

      // Skip near-zero isodop
      if (Math.abs(totalRadialKnots) < 3.5) continue;

      const color = getVelocityColor(totalRadialKnots);
      if (color) {
        pixels.push({
          x: px,
          y: py,
          size: gridStep,
          value: Math.round(totalRadialKnots),
          color,
        });
      }
    }
  }

  return pixels;
}
