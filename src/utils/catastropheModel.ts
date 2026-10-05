import {
  City,
  BuildingStructure,
  DamageAssessment,
  EFScale,
  MapWaypoint,
  TornadoParameters,
  TornadoWarning,
  WarningUrgency,
  CityImpactSummary,
} from '../types';
import { FictionalMapData, isLocationOverWater } from './fictionalMap';

export const MAP_UNITS_TO_MILES = 0.25; // 1400 units = 350 miles
export const YARDS_TO_MILES = 0.000568182;

export function getEFScale(windSpeedMph: number): EFScale {
  if (windSpeedMph >= 200) return 'EF5';
  if (windSpeedMph >= 166) return 'EF4';
  if (windSpeedMph >= 136) return 'EF3';
  if (windSpeedMph >= 111) return 'EF2';
  if (windSpeedMph >= 86) return 'EF1';
  return 'EF0';
}

export function getEFDescription(scale: EFScale): { name: string; windRange: string; damageDesc: string } {
  switch (scale) {
    case 'EF5':
      return {
        name: 'Incredible Tornado',
        windRange: '200+ mph (322+ km/h)',
        damageDesc: 'Strong frame houses leveled off foundations and swept away; steel-reinforced concrete structures critically damaged; high-rise structural deformations.',
      };
    case 'EF4':
      return {
        name: 'Devastating Tornado',
        windRange: '166 - 200 mph (267 - 322 km/h)',
        damageDesc: 'Well-built homes completely leveled; cars thrown large distances; significant missile/debris hazards generated.',
      };
    case 'EF3':
      return {
        name: 'Severe Tornado',
        windRange: '136 - 165 mph (218 - 266 km/h)',
        damageDesc: 'Entire stories of well-constructed houses destroyed; commercial exterior walls collapsed; heavy vehicles lifted and rolled.',
      };
    case 'EF2':
      return {
        name: 'Considerable Tornado',
        windRange: '111 - 135 mph (178 - 217 km/h)',
        damageDesc: 'Roofs torn completely off houses; mobile homes demolished; large trees snapped or uprooted; light objects become dangerous projectiles.',
      };
    case 'EF1':
      return {
        name: 'Moderate Tornado',
        windRange: '86 - 110 mph (138 - 177 km/h)',
        damageDesc: 'Roof surfaces peeled; mobile homes pushed off foundations or overturned; exterior doors blown in; broken window glazing.',
      };
    case 'EF0':
    default:
      return {
        name: 'Light Tornado',
        windRange: '65 - 85 mph (105 - 137 km/h)',
        damageDesc: 'Shallow rooted trees toppled; broken chimneys; damage to sign boards and gutters; light cladding loss.',
      };
  }
}

// Distance from point (px, py) to line segment (x1, y1) -> (x2, y2)
export function distToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): { distance: number; projectionX: number; projectionY: number; t: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) {
    const d = Math.hypot(px - x1, py - y1);
    return { distance: d, projectionX: x1, projectionY: y1, t: 0 };
  }
  let t = ((px - x1) * dx + (py - y1) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  const distance = Math.hypot(px - projX, py - projY);
  return { distance, projectionX: projX, projectionY: projY, t };
}

// Calculate total track distance in map units & miles
export function calculateTrackDistance(points: MapWaypoint[]): { mapUnits: number; miles: number } {
  if (points.length < 2) return { mapUnits: 0, miles: 0 };
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
  }
  return { mapUnits: total, miles: total * MAP_UNITS_TO_MILES };
}

// Interpolate track position at progress t in [0, 1]
export function getPositionAtProgress(
  points: MapWaypoint[],
  progress: number
): { x: number; y: number; segmentIndex: number; headingDeg: number } | null {
  if (points.length === 0) return null;
  if (points.length === 1) return { x: points[0].x, y: points[0].y, segmentIndex: 0, headingDeg: 0 };

  const clampedProgress = Math.max(0, Math.min(1, progress));
  const segmentLengths: number[] = [];
  let totalLength = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const len = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
    segmentLengths.push(len);
    totalLength += len;
  }

  if (totalLength === 0) {
    return { x: points[0].x, y: points[0].y, segmentIndex: 0, headingDeg: 0 };
  }

  const targetDist = clampedProgress * totalLength;
  let accumulated = 0;

  for (let i = 0; i < segmentLengths.length; i++) {
    const segLen = segmentLengths[i];
    if (accumulated + segLen >= targetDist || i === segmentLengths.length - 1) {
      const segT = segLen > 0 ? (targetDist - accumulated) / segLen : 0;
      const x = points[i].x + segT * (points[i + 1].x - points[i].x);
      const y = points[i].y + segT * (points[i + 1].y - points[i].y);
      const dx = points[i + 1].x - points[i].x;
      const dy = points[i + 1].y - points[i].y;
      const headingDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
      return { x, y, segmentIndex: i, headingDeg };
    }
    accumulated += segLen;
  }

  const last = points[points.length - 1];
  return { x: last.x, y: last.y, segmentIndex: points.length - 2, headingDeg: 0 };
}

// Convert map coordinates (0-1400 X, 0-900 Y) to realistic lat/lon integers for NWS LAT...LON block
function mapToNwsCoords(x: number, y: number): { latStr: string; lonStr: string } {
  // Region mapped around 41.5°N - 43.5°N and 87.0°W - 94.0°W
  const lat = Math.round((43.40 - (y / 900) * 2.10) * 100);
  const lon = Math.round((94.10 - (x / 1400) * 7.10) * 100);
  return { latStr: String(lat), lonStr: String(lon) };
}

function getCompassDirection(degrees: number): string {
  const norm = ((degrees % 360) + 360) % 360;
  const dirs = [
    'north',
    'north-northeast',
    'northeast',
    'east-northeast',
    'east',
    'east-southeast',
    'southeast',
    'south-southeast',
    'south',
    'south-southwest',
    'southwest',
    'west-southwest',
    'west',
    'west-northwest',
    'northwest',
    'north-northwest',
  ];
  const idx = Math.round(norm / 22.5) % 16;
  return dirs[idx];
}

// Generate authentic NWS-style Warning Polygons & Bulletins along the track
export function generateTornadoWarnings(
  params: TornadoParameters,
  cities: City[],
  structures: BuildingStructure[],
  mapData?: FictionalMapData
): TornadoWarning[] {
  if (params.trackPoints.length < 2) return [];

  const ef = getEFScale(params.windSpeedMph);
  const trackDist = calculateTrackDistance(params.trackPoints);
  const totalDurationMinutes = (trackDist.miles / params.movementSpeedMph) * 60;

  // Segment warnings along the track (every ~28-35 miles)
  const warningCount = Math.max(1, Math.min(5, Math.ceil(trackDist.miles / 28)));
  const warnings: TornadoWarning[] = [];

  for (let w = 0; w < warningCount; w++) {
    const startProgress = w / warningCount;
    const endProgress = Math.min(1, (w + 1.25) / warningCount);

    const startPos = getPositionAtProgress(params.trackPoints, startProgress);
    const endPos = getPositionAtProgress(params.trackPoints, endProgress);

    if (!startPos || !endPos) continue;

    const dx = endPos.x - startPos.x;
    const dy = endPos.y - startPos.y;
    const segDist = Math.hypot(dx, dy) || 1;
    const nx = -dy / segDist;
    const ny = dx / segDist;

    // Warning polygon trapezoid: wider downwind due to convective uncertainty
    const upwindHalfWidth = 28 + params.vortexWidthYards / 400;
    const downwindHalfWidth = 45 + params.vortexWidthYards / 250;

    // Extension points
    const p1 = {
      x: startPos.x - nx * upwindHalfWidth - (dx / segDist) * 12,
      y: startPos.y - ny * upwindHalfWidth - (dy / segDist) * 12,
    };
    const p2 = {
      x: startPos.x + nx * upwindHalfWidth - (dx / segDist) * 12,
      y: startPos.y + ny * upwindHalfWidth - (dy / segDist) * 12,
    };
    const p3 = {
      x: endPos.x + nx * downwindHalfWidth + (dx / segDist) * 16,
      y: endPos.y + ny * downwindHalfWidth + (dy / segDist) * 16,
    };
    const p4 = {
      x: endPos.x - nx * downwindHalfWidth + (dx / segDist) * 16,
      y: endPos.y - ny * downwindHalfWidth + (dy / segDist) * 16,
    };

    const polygon = [p1, p2, p3, p4];

    // Check if this segment/polygon is over water (ocean, coastal sound, lakes, bays)
    const midX = (startPos.x + endPos.x) / 2;
    const midY = (startPos.y + endPos.y) / 2;
    const q1X = (startPos.x + midX) / 2;
    const q1Y = (startPos.y + midY) / 2;
    const q3X = (midX + endPos.x) / 2;
    const q3Y = (midY + endPos.y) / 2;
    const polyCenterX = (p1.x + p2.x + p3.x + p4.x) / 4;
    const polyCenterY = (p1.y + p2.y + p3.y + p4.y) / 4;

    const isWaterSegment = mapData
      ? isLocationOverWater(midX, midY, mapData) ||
        isLocationOverWater(startPos.x, startPos.y, mapData) ||
        isLocationOverWater(endPos.x, endPos.y, mapData) ||
        isLocationOverWater(q1X, q1Y, mapData) ||
        isLocationOverWater(q3X, q3Y, mapData) ||
        isLocationOverWater(polyCenterX, polyCenterY, mapData)
      : false;

    // Find cities within or near polygon
    const impactedCities = cities.filter((city) => {
      const { distance } = distToSegment(city.x, city.y, startPos.x, startPos.y, endPos.x, endPos.y);
      return distance <= downwindHalfWidth + city.metroRadius;
    });

    const impactedCityNames = impactedCities.map((c) => c.name);
    const impactedCounties = Array.from(new Set(impactedCities.map((c) => c.county)));
    if (impactedCounties.length === 0) {
      impactedCounties.push(isWaterSegment ? 'Open Maritime Marine District' : 'Central Plains Regional Weather Area');
    }

    const totalPopAtRisk = impactedCities.reduce((acc, c) => acc + c.population, 0);

    // Calculate distance to nearest radar station and determine if warning is Radar Indicated
    // When far from radar (> 115 map units / ~33 miles) or during early touchdown or late roping-out:
    // Beam broadening and altitude overshooting mean ground vortex/debris cannot be confirmed,
    // so the warning is officially RADAR INDICATED.
    let distToRadarMiles = 45;
    let isRadarIndicated = true;

    if (mapData && mapData.radarStations && mapData.radarStations.length > 0) {
      let nearestDist = Infinity;
      mapData.radarStations.forEach((radar) => {
        const d = Math.hypot(midX - radar.x, midY - radar.y);
        if (d < nearestDist) nearestDist = d;
      });
      distToRadarMiles = Math.round(nearestDist * 0.284);
      isRadarIndicated = nearestDist > 115 || startProgress < 0.18 || startProgress > 0.85;
    } else {
      isRadarIndicated = true;
    }

    // Determine Urgency Level & Severity Tags
    let urgency: WarningUrgency = isWaterSegment
      ? params.windSpeedMph >= 140
        ? 'Severe Tornadic Waterspout'
        : 'Special Marine Warning'
      : 'Tornado Warning';

    let damageThreatTag = '';
    let hailSizeTag = '1.75 IN';

    const isMegaCityThreat = impactedCities.some((c) => c.name === 'Chicago' || c.name === 'Cedar Rapids');

    if (!isWaterSegment) {
      if (params.windSpeedMph >= 200 || (params.windSpeedMph >= 166 && isMegaCityThreat)) {
        urgency = 'Tornado Emergency';
        damageThreatTag = isRadarIndicated ? 'CONSIDERABLE' : 'CATASTROPHIC';
        hailSizeTag = '2.75 IN';
      } else if (params.windSpeedMph >= 140) {
        urgency = 'Particularly Dangerous Situation (PDS)';
        damageThreatTag = 'CONSIDERABLE';
        hailSizeTag = '2.00 IN';
      } else if (params.windSpeedMph >= 115) {
        urgency = 'Considerable Risk';
        damageThreatTag = isRadarIndicated ? 'POSSIBLE' : 'CONSIDERABLE';
        hailSizeTag = '1.75 IN';
      }
    } else {
      damageThreatTag = params.windSpeedMph >= 166 ? 'CATASTROPHIC WATERSPOUT' : 'CONSIDERABLE WATERSPOUT';
      hailSizeTag = params.windSpeedMph >= 166 ? '2.50 IN' : '1.75 IN';
    }

    // Time calculations
    const issuedSimMinutes = Math.round(startProgress * totalDurationMinutes);
    const expiresSimMinutes = Math.round(Math.min(totalDurationMinutes + 20, (startProgress + 0.6) * totalDurationMinutes + 25));

    const baseHour = 2;
    const baseMin = 15;
    const issueTotalMin = baseHour * 60 + baseMin + issuedSimMinutes;
    const expireTotalMin = baseHour * 60 + baseMin + expiresSimMinutes;

    const issueHr = Math.floor(issueTotalMin / 60);
    const issueMinStr = String(issueTotalMin % 60).padStart(2, '0');
    const expireHr = Math.floor(expireTotalMin / 60);
    const expireMinStr = String(expireTotalMin % 60).padStart(2, '0');

    // Office naming
    const officeName = impactedCities.some((c) => c.name === 'Chicago')
      ? 'Chicago / Romeoville IL'
      : impactedCities.some((c) => c.name === 'Cedar Rapids' || c.name === 'Dubuque' || c.name === 'Davenport' || c.name === 'Iowa City')
      ? 'Quad Cities IA IL'
      : 'Des Moines IA';

    const officeWmoCode = impactedCities.some((c) => c.name === 'Chicago')
      ? 'KLOT'
      : impactedCities.some((c) => c.name === 'Cedar Rapids' || c.name === 'Dubuque' || c.name === 'Davenport' || c.name === 'Iowa City')
      ? 'KDVN'
      : 'KDMX';

    const ugcCode = isWaterSegment
      ? 'LMZ740-741-742-743'
      : impactedCities.some((c) => c.name === 'Chicago')
      ? 'ILC031-043-089-097'
      : impactedCities.some((c) => c.name === 'Cedar Rapids' || c.name === 'Iowa City')
      ? 'IAC013-057-103-115'
      : 'IAC153-181-121-049';

    // Motion parameters
    const headingDeg = Math.round(((startPos.headingDeg % 360) + 360) % 360);
    const compassDir = getCompassDirection(headingDeg);
    const speedKnots = Math.round(params.movementSpeedMph / 1.15078);

    // LAT...LON string
    const nwsLatLons = polygon.map((pt) => {
      const c = mapToNwsCoords(pt.x, pt.y);
      return `${c.latStr} ${c.lonStr}`;
    }).join(' ');

    const centerCoord = mapToNwsCoords(startPos.x, startPos.y);
    const utcTime = `${String(issueHr + 5).padStart(2, '0')}${issueMinStr}Z`;

    let headline = '';
    let bulletinText = '';

    if (isWaterSegment) {
      // Special Marine Warning (SMW) format when tornado/vortex is over water
      headline =
        urgency === 'Severe Tornadic Waterspout'
          ? `SPECIAL MARINE WARNING FOR VIOLENT TORNADIC WATERSPOUT OVER OPEN WATERS`
          : `SPECIAL MARINE WARNING ISSUED FOR COASTAL WATERS AND NAVIGABLE HARBORS`;

      bulletinText = `WHUS53 ${officeWmoCode} 04${String(issuedSimMinutes).padStart(2, '0')}00
SMW${officeWmoCode.slice(1)}
${ugcCode}-04${String(expiresSimMinutes).padStart(2, '0')}00-
/O.NEW.${officeWmoCode}.MA.W.00${String(w + 1).padStart(2, '0')}.261004T${String(issueHr + 5).padStart(2, '0')}${issueMinStr}Z-261004T${String(expireHr + 5).padStart(2, '0')}${expireMinStr}Z/

BULLETIN - IMMEDIATE BROADCAST REQUESTED
Special Marine Warning
National Weather Service ${officeName}
${issueHr}:${issueMinStr} PM CDT Sun Oct 4 2026

The National Weather Service in ${officeName} has issued a

* Special Marine Warning for...
  Coastal waters from Chicago Harbor to Michigan Bay out to 25 NM...
  Navigable waters of Lake Eldoria and regional maritime sounds...

* Until ${expireHr}:${expireMinStr} PM CDT.

* At ${issueHr}:${issueMinStr} PM CDT, a confirmed ${
        params.windSpeedMph >= 140 ? 'violent tornadic waterspout' : 'dangerous waterspout'
      } was located over open water, moving ${compassDir} at ${params.movementSpeedMph} mph (${speedKnots} knots).

  HAZARD...Tornadic waterspout and violent wind gusts in excess of 65 knots (75 mph+) and large hail.
  SOURCE...Radar confirmed waterspout.
  IMPACT...Waterspouts can easily overturn commercial and recreational vessels and create locally hazardous seas. Small craft will be severely damaged or capsized by suddenly higher waves and violently rotating winds.

* Locations and navigable waters impacted include...
${
  impactedCities.length > 0
    ? `  Nearshore waters off ${impactedCities.map((c) => c.name).join(', ')}, shipping fairways, and offshore navigational channels.`
    : '  Open water cruising routes, commercial freight channels, and recreational boat harbors.'
}

PRECAUTIONARY/PREPAREDNESS ACTIONS...

Boaters should seek safe harbor immediately until rough conditions have passed. Move below deck if possible and avoid contact with electrical equipment. Waterspouts can easily capsize vessels.

&&

LAT...LON ${nwsLatLons}
TIME...MOT...LOC ${utcTime} ${String(headingDeg).padStart(3, '0')}DEG ${speedKnots}KT ${centerCoord.latStr} ${centerCoord.lonStr}

WATERSPOUT...OBSERVED
${damageThreatTag ? `WATERSPOUT DAMAGE THREAT...${damageThreatTag}\n` : ''}MAX HAIL SIZE...${hailSizeTag}

$$`;
    } else {
      // Standard Authentic NWS Tornado Warning (TOR) Format for land
      headline =
        urgency === 'Tornado Emergency'
          ? `TORNADO EMERGENCY FOR ${impactedCityNames.join(' AND ').toUpperCase() || 'METROPOLITAN AREA'}`
          : isRadarIndicated
          ? `TORNADO WARNING (RADAR INDICATED) FOR ${impactedCityNames.join(' AND ').toUpperCase() || 'REGIONAL DISTRICTS'}`
          : urgency === 'Particularly Dangerous Situation (PDS)'
          ? `PARTICULARLY DANGEROUS SITUATION (PDS) TORNADO WARNING FOR ${impactedCityNames.join(' AND ').toUpperCase() || 'REGIONAL DISTRICTS'}`
          : `TORNADO WARNING (CONFIRMED) FOR ${impactedCityNames.join(' AND ').toUpperCase() || 'CENTRAL BASIN'}`;

      bulletinText = `WFUS53 ${officeWmoCode} 04${String(issuedSimMinutes).padStart(2, '0')}00
TOR${officeWmoCode.slice(1)}
${ugcCode}-04${String(expiresSimMinutes).padStart(2, '0')}00-
/O.NEW.${officeWmoCode}.TO.W.00${String(w + 1).padStart(2, '0')}.261004T${String(issueHr + 5).padStart(2, '0')}${issueMinStr}Z-261004T${String(expireHr + 5).padStart(2, '0')}${expireMinStr}Z/

BULLETIN - EAS ACTIVATION REQUESTED
Tornado Warning
National Weather Service ${officeName}
${issueHr}:${issueMinStr} PM CDT Sun Oct 4 2026

The National Weather Service in ${officeName} has issued a

* Tornado Warning for...
${impactedCounties.map((county) => `  ${county}...`).join('\n')}

* Until ${expireHr}:${expireMinStr} PM CDT.

* At ${issueHr}:${issueMinStr} PM CDT, ${
        isRadarIndicated
          ? 'a severe thunderstorm capable of producing a tornado was located'
          : params.windSpeedMph >= 166
          ? 'a confirmed large and extremely dangerous tornado was located'
          : 'a confirmed dangerous tornado was located'
      } ${
        impactedCities[0]
          ? `near ${impactedCities[0].name}`
          : 'over the central basin'
      }, moving ${compassDir} at ${params.movementSpeedMph} mph (${distToRadarMiles} mi from Doppler radar).
${
  urgency === 'Tornado Emergency'
    ? `\n  TORNADO EMERGENCY FOR ${impactedCityNames.join(' AND ').toUpperCase() || 'THE METROPOLITAN AREA'}. This is a PARTICULARLY DANGEROUS SITUATION. TAKE COVER NOW!\n`
    : urgency === 'Particularly Dangerous Situation (PDS)'
    ? '\n  This is a PARTICULARLY DANGEROUS SITUATION. TAKE COVER NOW!\n'
    : ''
}
  HAZARD...${
    isRadarIndicated
      ? 'Tornado and quarter size hail.'
      : params.windSpeedMph >= 200
      ? 'Deadly tornado with peak estimated winds of ' + params.windSpeedMph + ' mph (' + ef + ') and baseball size hail.'
      : params.windSpeedMph >= 140
      ? 'Damaging tornado with peak winds of ' + params.windSpeedMph + ' mph (' + ef + ') and golf ball size hail.'
      : 'Damaging tornado and quarter size hail.'
  }

  SOURCE...${
    isRadarIndicated
      ? 'Radar indicated rotation.'
      : params.windSpeedMph >= 135
      ? 'Radar confirmed tornado debris signature (TDS).'
      : 'Radar confirmed tornado.'
  }

  IMPACT...${
    urgency === 'Tornado Emergency'
      ? 'You are in a life-threatening situation. Flying debris may be fatal to those without shelter. Complete destruction of residential, commercial, and multi-story structures is occurring. Vehicles and heavy infrastructure will be thrown. Catastrophic collapse of built environments is imminent.'
      : urgency === 'Particularly Dangerous Situation (PDS)'
      ? 'You are in a life-threatening situation. Flying debris will be deadly to those caught without shelter. Mobile homes will be completely destroyed. Considerable damage to homes, businesses, and vehicles is likely and complete structural failure is possible.'
      : isRadarIndicated
      ? 'Flying debris will be dangerous to those caught without shelter. Mobile homes will be damaged or destroyed. Damage to roofs, windows, and vehicles will occur. Tree damage is likely.'
      : 'Flying debris will be deadly to those caught without shelter. Manufactured homes will be severely damaged or destroyed. Substantial damage to roofs, windows, and trees.'
  }

* Locations impacted include...
${
  impactedCities.length > 0
    ? `  ${impactedCities.map((c) => `${c.name} (population ${c.population.toLocaleString()})`).join(', ')}, and surrounding corridors.`
    : '  Rural highway corridors, agricultural complexes, and local regional access routes.'
}

PRECAUTIONARY/PREPAREDNESS ACTIONS...

To protect your life, TAKE COVER NOW! Move to an interior room on the lowest floor of a sturdy building. Avoid windows. If in a mobile home, a vehicle, or outdoors, move to the closest substantial shelter and protect yourself from flying debris.

Tornadoes are extremely difficult to see and confirm at night or in heavy precipitation. Do not wait to see or hear the tornado. TAKE COVER NOW!

&&

LAT...LON ${nwsLatLons}
TIME...MOT...LOC ${utcTime} ${String(headingDeg).padStart(3, '0')}DEG ${speedKnots}KT ${centerCoord.latStr} ${centerCoord.lonStr}

TORNADO...${isRadarIndicated ? 'RADAR INDICATED' : 'OBSERVED'}
${damageThreatTag ? `TORNADO DAMAGE THREAT...${isRadarIndicated ? 'RADAR INDICATED' : damageThreatTag}\n` : ''}MAX HAIL SIZE...${hailSizeTag}

$$`;
    }

    warnings.push({
      id: `warn_${w + 1}`,
      warningNumber: w + 1,
      isMarineWarning: isWaterSegment,
      isRadarIndicated,
      distanceToRadarMiles: distToRadarMiles,
      warningType: isWaterSegment ? 'Special Marine Warning' : 'Tornado Warning',
      issuedAtSimTimeMinutes: issuedSimMinutes,
      expiresAtSimTimeMinutes: expiresSimMinutes,
      urgencyLevel: urgency,
      issuingOffice: `NWS ${officeName}`,
      headline,
      impactedCities: impactedCityNames,
      impactedCounties,
      polygon,
      bulletinText,
      peakWindsObserved: params.windSpeedMph,
      populationAtRisk: isWaterSegment ? Math.min(totalPopAtRisk, 45000) : totalPopAtRisk,
      motionVectorHeadingDeg: headingDeg,
      motionSpeedMph: params.movementSpeedMph,
    });
  }

  return warnings;
}

// Full Catastrophe Modeling & Damage Assessment
export function computeDamageAssessment(
  params: TornadoParameters,
  cities: City[],
  initialStructures: BuildingStructure[],
  currentProgress: number = 1.0,
  mapData?: FictionalMapData
): { assessment: DamageAssessment; updatedStructures: BuildingStructure[] } {
  const { miles: trackMiles } = calculateTrackDistance(params.trackPoints);
  const ef = getEFScale(params.windSpeedMph);

  // Swath radius in map units:
  // Convert vortexWidthYards to miles, then to map units
  const widthMiles = params.vortexWidthYards * YARDS_TO_MILES;
  const coreRadiusMapUnits = (widthMiles / 2) / MAP_UNITS_TO_MILES;
  // Outer damaging wind swath (EF0+ damage envelope) extends up to 2.8x core vortex width
  const outerRadiusMapUnits = Math.max(8, coreRadiusMapUnits * 2.8);

  const swathAreaSqMiles = Math.max(0.1, trackMiles * widthMiles * 1.8);

  // Active track points based on current simulation progress
  const activeSegmentsCount = Math.max(1, Math.floor((params.trackPoints.length - 1) * currentProgress));
  const activePoints = params.trackPoints.slice(0, activeSegmentsCount + 1);

  // Residence time factor: slower forward speed = longer destruction dwell time
  // e.g., 5 mph has a 1.6x damage multiplier, 130 mph has a 0.7x multiplier
  const residenceMultiplier = Math.max(0.65, Math.min(1.7, 1 + (40 - params.movementSpeedMph) / 100));

  let destroyedCount = 0;
  let severeCount = 0;
  let moderateCount = 0;
  let minorCount = 0;
  let directStructureLossUSD = 0;

  let hospitalsDamaged = 0;
  let schoolsDamaged = 0;
  let powerSubstationsSevered = 0;
  let bridgesBlocked = 0;

  let totalFatalities = 0;
  let totalCriticalInjuries = 0;
  let totalMinorInjuries = 0;
  let totalDisplaced = 0;

  const cityDamageMap: Record<
    string,
    { structuresDamaged: number; economicLoss: number; maxEf: EFScale | 'None'; directHit: boolean; displaced: number }
  > = {};

  cities.forEach((c) => {
    cityDamageMap[c.id] = {
      structuresDamaged: 0,
      economicLoss: 0,
      maxEf: 'None',
      directHit: false,
      displaced: 0,
    };
  });

  const updatedStructures = initialStructures.map((struct) => {
    if (activePoints.length < 2) {
      return { ...struct, damageTier: 'undamaged' as const, damagePercent: 0 };
    }

    // Find minimum distance to current simulated track
    let minDist = Infinity;
    for (let i = 0; i < activePoints.length - 1; i++) {
      const p1 = activePoints[i];
      const p2 = activePoints[i + 1];
      const { distance } = distToSegment(struct.x, struct.y, p1.x, p1.y, p2.x, p2.y);
      if (distance < minDist) minDist = distance;
    }

    if (minDist > outerRadiusMapUnits) {
      return { ...struct, damageTier: 'undamaged' as const, damagePercent: 0, distanceToTrack: minDist };
    }

    // Calculate experienced wind speed using modified Rankine Vortex profile
    let localWind = 0;
    if (minDist <= coreRadiusMapUnits) {
      // Core destructive vortex
      localWind = params.windSpeedMph;
    } else {
      // Wind speed drops off with distance
      const falloff = 1 - (minDist - coreRadiusMapUnits) / (outerRadiusMapUnits - coreRadiusMapUnits);
      localWind = 65 + (params.windSpeedMph - 65) * Math.pow(Math.max(0, falloff), 1.4);
    }

    // Apply residence time multiplier
    const effectiveDamageFactor = Math.min(1.0, (localWind / 240) * residenceMultiplier);

    let tier: BuildingStructure['damageTier'] = 'undamaged';
    let damagePct = 0;

    if (localWind >= 200 || (localWind >= 165 && minDist <= coreRadiusMapUnits)) {
      tier = 'destroyed';
      damagePct = 95 + Math.random() * 5;
    } else if (localWind >= 140) {
      tier = 'severe';
      damagePct = 70 + Math.random() * 20;
    } else if (localWind >= 105) {
      tier = 'moderate';
      damagePct = 40 + Math.random() * 25;
    } else if (localWind >= 65) {
      tier = 'minor';
      damagePct = 12 + Math.random() * 20;
    }

    if (tier !== 'undamaged') {
      const loss = struct.value * (damagePct / 100);
      directStructureLossUSD += loss;

      if (tier === 'destroyed') destroyedCount++;
      else if (tier === 'severe') severeCount++;
      else if (tier === 'moderate') moderateCount++;
      else if (tier === 'minor') minorCount++;

      // Critical infrastructure counters
      if (struct.type === 'hospital') hospitalsDamaged++;
      if (struct.type === 'school') schoolsDamaged++;
      if (struct.type === 'power_station') powerSubstationsSevered++;
      if (struct.type === 'bridge') bridgesBlocked++;

      // Human casualty modeling
      const occ = struct.occupancy;
      if (tier === 'destroyed') {
        totalFatalities += occ * 0.08 * (params.windSpeedMph / 250);
        totalCriticalInjuries += occ * 0.22;
        totalMinorInjuries += occ * 0.45;
        totalDisplaced += occ;
      } else if (tier === 'severe') {
        totalFatalities += occ * 0.015;
        totalCriticalInjuries += occ * 0.12;
        totalMinorInjuries += occ * 0.35;
        totalDisplaced += occ * 0.85;
      } else if (tier === 'moderate') {
        totalMinorInjuries += occ * 0.1;
        totalDisplaced += occ * 0.3;
      }

      // City-specific impact tracking
      if (struct.cityId && cityDamageMap[struct.cityId]) {
        const cStat = cityDamageMap[struct.cityId];
        cStat.structuresDamaged++;
        cStat.economicLoss += loss;
        if (minDist <= coreRadiusMapUnits) cStat.directHit = true;
        if (tier === 'destroyed') cStat.maxEf = ef;
        else if (cStat.maxEf === 'None' || cStat.maxEf === 'EF0') cStat.maxEf = getEFScale(localWind);
        cStat.displaced += Math.round(occ * (damagePct / 100));
      }
    }

    return {
      ...struct,
      damageTier: tier,
      damagePercent: Math.round(damagePct),
      distanceToTrack: Math.round(minDist * 10) / 10,
      maxWindExperienced: Math.round(localWind),
    };
  });

  // Scale macroeconomic business interruption and municipal recovery based on city populations!
  // Chicago (300.3M) direct hit causes massive macro multiplier due to global logistics and mega-density
  let macroMultiplier = 1.0;
  cities.forEach((c) => {
    const stat = cityDamageMap[c.id];
    if (stat && stat.structuresDamaged > 0) {
      if (c.name === 'Chicago') {
        // Chicago population is 300,310,000 -> direct hit triggers enormous economic disruption
        macroMultiplier += (stat.structuresDamaged / 40) * 18.5;
      } else if (c.name === 'Cedar Rapids' || c.name === 'Des Moines') {
        macroMultiplier += (stat.structuresDamaged / 20) * 2.8;
      } else {
        macroMultiplier += (stat.structuresDamaged / 10) * 0.4;
      }
    }
  });

  const totalEconomicLoss = Math.round(directStructureLossUSD * macroMultiplier);
  const insuredLoss = Math.round(totalEconomicLoss * 0.68);
  const uninsuredLoss = totalEconomicLoss - insuredLoss;

  const cityImpacts: CityImpactSummary[] = cities.map((c) => {
    const s = cityDamageMap[c.id];
    return {
      cityId: c.id,
      cityName: c.name,
      population: c.population,
      structuresDamaged: s ? s.structuresDamaged : 0,
      economicLoss: s ? Math.round(s.economicLoss * (c.name === 'Chicago' ? 12 : 1.8)) : 0,
      directHit: s ? s.directHit : false,
      maxEfExperienced: s ? s.maxEf : 'None',
      estimatedDisplaced: s ? Math.round(s.displaced * (c.population > 1000000 ? 4 : 1)) : 0,
    };
  });

  const warnings = generateTornadoWarnings(params, cities, updatedStructures, mapData);
  const marineWarningsIssuedCount = warnings.filter((w) => w.isMarineWarning).length;
  const tornadoWarningsIssuedCount = warnings.filter((w) => !w.isMarineWarning).length;

  return {
    assessment: {
      trackLengthMiles: Math.round(trackMiles * 10) / 10,
      swathAreaSqMiles: Math.round(swathAreaSqMiles * 10) / 10,
      totalEconomicLoss,
      insuredLoss,
      uninsuredLoss,
      structuresImpacted: {
        destroyed: destroyedCount,
        severe: severeCount,
        moderate: moderateCount,
        minor: minorCount,
        total: destroyedCount + severeCount + moderateCount + minorCount,
      },
      criticalInfrastructure: {
        hospitalsDamaged,
        schoolsDamaged,
        powerSubstationsSevered,
        bridgesBlocked,
      },
      casualtyEstimate: {
        fatalities: Math.round(totalFatalities),
        criticalInjuries: Math.round(totalCriticalInjuries),
        minorInjuries: Math.round(totalMinorInjuries),
        displacedPersons: Math.round(totalDisplaced),
      },
      cityImpacts,
      warningsIssuedCount: warnings.length,
      marineWarningsIssuedCount,
      tornadoWarningsIssuedCount,
      warnings,
      simulationCompleted: currentProgress >= 0.99,
    },
    updatedStructures,
  };
}
