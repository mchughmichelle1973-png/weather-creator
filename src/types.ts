export type EFScale = 'EF0' | 'EF1' | 'EF2' | 'EF3' | 'EF4' | 'EF5';

export interface City {
  id: string;
  name: 'Cedar Rapids' | 'Chicago' | 'Rockford' | 'Des Moines' | 'Davenport' | 'Dubuque' | 'Iowa City';
  population: number;
  x: number;
  y: number;
  county: string;
  description: string;
  metroRadius: number; // in map units
  economicBaseValue: number; // in millions of USD
}

export type StructureType =
  | 'residential'
  | 'commercial'
  | 'industrial'
  | 'hospital'
  | 'school'
  | 'power_station'
  | 'bridge'
  | 'marine_vessel'
  | 'dock_terminal';

export type DamageTier = 'undamaged' | 'minor' | 'moderate' | 'severe' | 'destroyed';

export interface BuildingStructure {
  id: string;
  cityId?: string;
  cityName?: string;
  x: number;
  y: number;
  type: StructureType;
  name?: string;
  value: number; // in USD
  occupancy: number; // estimated people present
  damageTier: DamageTier;
  damagePercent: number; // 0 to 100%
  distanceToTrack?: number;
  maxWindExperienced?: number;
}

export interface MapWaypoint {
  id: string;
  x: number;
  y: number;
}

export interface TornadoParameters {
  windSpeedMph: number; // 65 - 320 mph
  vortexWidthYards: number; // 50 - 4500 yards
  movementSpeedMph: number; // 5 - 130 mph
  trackPoints: MapWaypoint[];
  efScale: EFScale;
}

export type WarningUrgency =
  | 'Tornado Warning'
  | 'Considerable Risk'
  | 'Particularly Dangerous Situation (PDS)'
  | 'Tornado Emergency'
  | 'Special Marine Warning'
  | 'Severe Tornadic Waterspout';

export interface TornadoWarning {
  id: string;
  warningNumber: number;
  isMarineWarning: boolean;
  isRadarIndicated: boolean;
  distanceToRadarMiles: number;
  warningType: 'Tornado Warning' | 'Special Marine Warning';
  issuedAtSimTimeMinutes: number;
  expiresAtSimTimeMinutes: number;
  urgencyLevel: WarningUrgency;
  issuingOffice: string;
  headline: string;
  impactedCities: string[];
  impactedCounties: string[];
  polygon: { x: number; y: number }[];
  bulletinText: string;
  peakWindsObserved: number;
  populationAtRisk: number;
  motionVectorHeadingDeg: number;
  motionSpeedMph: number;
}

export interface CityImpactSummary {
  cityId: string;
  cityName: string;
  population: number;
  structuresDamaged: number;
  economicLoss: number;
  directHit: boolean;
  maxEfExperienced: EFScale | 'None';
  estimatedDisplaced: number;
}

export interface DamageAssessment {
  trackLengthMiles: number;
  swathAreaSqMiles: number;
  totalEconomicLoss: number; // in USD
  insuredLoss: number;
  uninsuredLoss: number;
  structuresImpacted: {
    destroyed: number;
    severe: number;
    moderate: number;
    minor: number;
    total: number;
  };
  criticalInfrastructure: {
    hospitalsDamaged: number;
    schoolsDamaged: number;
    powerSubstationsSevered: number;
    bridgesBlocked: number;
  };
  casualtyEstimate: {
    fatalities: number;
    criticalInjuries: number;
    minorInjuries: number;
    displacedPersons: number;
  };
  cityImpacts: CityImpactSummary[];
  warningsIssuedCount: number;
  marineWarningsIssuedCount: number;
  tornadoWarningsIssuedCount: number;
  warnings: TornadoWarning[];
  simulationCompleted: boolean;
}

export interface RadarStation {
  id: string;
  callsign: string;
  name: string;
  x: number;
  y: number;
  rangeRadius: number;
}

export type RadarLayer = 'off' | 'reflectivity' | 'velocity';

export type RadarDisplayMode = 'terrain' | 'reflectivity' | 'velocity' | 'damage';

export type SimSpeed = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface SimulationState {
  isPlaying: boolean;
  speedMultiplier: SimSpeed;
  progress: number; // 0.0 to 1.0
  elapsedSimSeconds: number;
  totalSimSeconds: number;
  currentCoord: { x: number; y: number } | null;
  currentSegmentIndex: number;
  hasFinished: boolean;
}
