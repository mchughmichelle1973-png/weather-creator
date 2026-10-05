import { City, BuildingStructure } from '../types';

export interface RiverPath {
  points: { x: number; y: number }[];
  width: number;
  name: string;
}

export interface LakeBody {
  points: { x: number; y: number }[];
  name: string;
}

export interface CountyBoundary {
  id: string;
  name: string;
  points: { x: number; y: number }[];
  center: { x: number; y: number };
}

export interface RoadArtery {
  id: string;
  name: string;
  type: 'interstate' | 'highway' | 'arterial';
  points: { x: number; y: number }[];
}

export interface RadarStation {
  id: string;
  callsign: string;
  name: string;
  x: number;
  y: number;
  rangeRadius: number; // in map units
}

export interface FictionalMapData {
  seed: number;
  mapWidth: number; // 1400 (enlarged map)
  mapHeight: number; // 900 (enlarged map)
  coastline: { x: number; y: number }[];
  oceanPolygon: { x: number; y: number }[];
  islands: { points: { x: number; y: number }[] }[];
  lakes: LakeBody[];
  rivers: RiverPath[];
  elevationContours: { points: { x: number; y: number }[]; level: number }[];
  counties: CountyBoundary[];
  roads: RoadArtery[];
  radarStations: RadarStation[];
  cities: City[];
  structures: BuildingStructure[];
}

// Point-in-polygon helper
export function isPointInPoly(pt: { x: number; y: number }, poly: { x: number; y: number }[]): boolean {
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

// Check whether a coordinate on the map is over water (lakes, sounds, ocean)
export function isLocationOverWater(x: number, y: number, mapData: FictionalMapData): boolean {
  // 1. Check all inland lakes (Lake Eldoria, Mirror Basin, Obsidian Tarn)
  for (const lake of mapData.lakes) {
    if (isPointInPoly({ x, y }, lake.points)) {
      return true;
    }
  }

  // 2. Check coastline & eastern ocean
  if (mapData.coastline && mapData.coastline.length > 1) {
    const clampedY = Math.max(0, Math.min(mapData.mapHeight, y));
    const step = mapData.mapHeight / (mapData.coastline.length - 1);
    const idx = Math.min(mapData.coastline.length - 2, Math.max(0, Math.floor(clampedY / step)));
    const p1 = mapData.coastline[idx];
    const p2 = mapData.coastline[idx + 1];
    const t = p2.y !== p1.y ? (clampedY - p1.y) / (p2.y - p1.y) : 0;
    const coastXAtY = p1.x + t * (p2.x - p1.x);

    // If point is to the right (east) of the coastline, it is in the marine ocean/bay
    if (x >= coastXAtY) {
      // Check if point is inside an offshore island (which is land)
      for (const island of mapData.islands) {
        if (isPointInPoly({ x, y }, island.points)) {
          return false;
        }
      }
      return true;
    }
  }

  // 3. Fallback check using oceanPolygon
  if (isPointInPoly({ x, y }, mapData.oceanPolygon)) {
    for (const island of mapData.islands) {
      if (isPointInPoly({ x, y }, island.points)) {
        return false;
      }
    }
    return true;
  }

  return false;
}

// Seeded pseudo-random generator
function createRng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function generateFictionalMap(seed: number = 42): FictionalMapData {
  const rng = createRng(seed);
  // Enlarged map dimensions (1400 x 900)
  const mapWidth = 1400;
  const mapHeight = 900;

  // 1. Coastline & Ocean (Fictional coastal marine sea on the east, NOT USA)
  const coastPoints: { x: number; y: number }[] = [];
  const coastSteps = 28;
  for (let i = 0; i <= coastSteps; i++) {
    const t = i / coastSteps;
    const y = t * mapHeight;
    // Curving fictional coastline with large bays, peninsulas, and inlets
    const baseX =
      1040 +
      Math.sin(t * Math.PI * 3.2 + seed) * 110 -
      Math.cos(t * Math.PI * 1.8) * 80;
    const noise = (rng() - 0.5) * 45;
    coastPoints.push({ x: Math.max(880, Math.min(1340, baseX + noise)), y });
  }

  const oceanPolygon: { x: number; y: number }[] = [
    ...coastPoints,
    { x: mapWidth, y: mapHeight },
    { x: mapWidth, y: 0 },
  ];

  // Fictional offshore islands
  const islands = [
    {
      points: [
        { x: 1220, y: 180 },
        { x: 1310, y: 220 },
        { x: 1300, y: 310 },
        { x: 1220, y: 290 },
        { x: 1190, y: 230 },
      ],
    },
    {
      points: [
        { x: 1250, y: 620 },
        { x: 1340, y: 660 },
        { x: 1320, y: 740 },
        { x: 1240, y: 710 },
      ],
    },
    {
      points: [
        { x: 1150, y: 460 },
        { x: 1200, y: 480 },
        { x: 1180, y: 530 },
        { x: 1130, y: 510 },
      ],
    },
  ];

  // 2. Fictional Lakes
  const lakes: LakeBody[] = [
    {
      name: 'Lake Eldoria',
      points: [
        { x: 560, y: 130 },
        { x: 660, y: 110 },
        { x: 740, y: 160 },
        { x: 770, y: 230 },
        { x: 710, y: 290 },
        { x: 600, y: 270 },
        { x: 530, y: 190 },
      ],
    },
    {
      name: 'Mirror Basin',
      points: [
        { x: 230, y: 540 },
        { x: 330, y: 520 },
        { x: 380, y: 590 },
        { x: 350, y: 660 },
        { x: 270, y: 650 },
        { x: 210, y: 590 },
      ],
    },
    {
      name: 'Obsidian Tarn',
      points: [
        { x: 420, y: 390 },
        { x: 490, y: 380 },
        { x: 520, y: 430 },
        { x: 460, y: 470 },
        { x: 410, y: 430 },
      ],
    },
  ];

  // 3. Fictional Rivers
  const rivers: RiverPath[] = [
    {
      name: 'Veridian River',
      width: 6,
      points: [
        { x: 70, y: 80 },
        { x: 190, y: 140 },
        { x: 310, y: 210 },
        { x: 440, y: 250 },
        { x: 580, y: 280 },
        { x: 720, y: 370 },
        { x: 860, y: 450 },
        { x: 1030, y: 500 },
        { x: 1120, y: 530 },
      ],
    },
    {
      name: 'Kestrel Fork',
      width: 4,
      points: [
        { x: 720, y: 370 },
        { x: 780, y: 490 },
        { x: 750, y: 620 },
        { x: 840, y: 720 },
        { x: 990, y: 800 },
      ],
    },
    {
      name: 'Iowa Silver Run',
      width: 3.5,
      points: [
        { x: 150, y: 820 },
        { x: 250, y: 730 },
        { x: 350, y: 660 },
        { x: 460, y: 630 },
        { x: 520, y: 530 },
        { x: 620, y: 560 },
        { x: 750, y: 620 },
      ],
    },
  ];

  // 4. Elevation Contours
  const elevationContours = [
    {
      level: 1,
      points: [
        { x: 80, y: 230 },
        { x: 160, y: 310 },
        { x: 220, y: 410 },
        { x: 170, y: 530 },
        { x: 90, y: 600 },
      ],
    },
    {
      level: 2,
      points: [
        { x: 110, y: 270 },
        { x: 180, y: 360 },
        { x: 150, y: 470 },
        { x: 100, y: 510 },
      ],
    },
    {
      level: 1,
      points: [
        { x: 620, y: 40 },
        { x: 780, y: 70 },
        { x: 910, y: 110 },
        { x: 990, y: 190 },
      ],
    },
  ];

  // 5. Counties
  const counties: CountyBoundary[] = [
    {
      id: 'c1',
      name: 'Oakhaven District',
      center: { x: 330, y: 280 },
      points: [
        { x: 110, y: 110 },
        { x: 530, y: 90 },
        { x: 510, y: 430 },
        { x: 140, y: 440 },
      ],
    },
    {
      id: 'c2',
      name: 'Cooke Coastal Megaplex',
      center: { x: 1000, y: 320 },
      points: [
        { x: 800, y: 80 },
        { x: 1180, y: 100 },
        { x: 1120, y: 540 },
        { x: 790, y: 490 },
      ],
    },
    {
      id: 'c3',
      name: 'Sterling Ridge County',
      center: { x: 660, y: 260 },
      points: [
        { x: 530, y: 90 },
        { x: 800, y: 80 },
        { x: 790, y: 490 },
        { x: 510, y: 430 },
      ],
    },
    {
      id: 'c4',
      name: 'Prairie Bluffs County',
      center: { x: 290, y: 660 },
      points: [
        { x: 130, y: 450 },
        { x: 500, y: 440 },
        { x: 520, y: 840 },
        { x: 100, y: 850 },
      ],
    },
    {
      id: 'c5',
      name: 'Iron River Basin',
      center: { x: 650, y: 650 },
      points: [
        { x: 510, y: 440 },
        { x: 860, y: 480 },
        { x: 840, y: 850 },
        { x: 520, y: 840 },
      ],
    },
    {
      id: 'c6',
      name: 'Cascade Maritime Shore',
      center: { x: 990, y: 680 },
      points: [
        { x: 860, y: 480 },
        { x: 1130, y: 540 },
        { x: 1090, y: 870 },
        { x: 840, y: 850 },
      ],
    },
  ];

  // 6. Cities: 6 original cities with user-specified populations + 1 more city (Iowa City)
  // - Cedar Rapids: POP 1,460,000
  // - Chicago: POP 300,310,000
  // - Rockford: POP 25,649
  // - Des Moines: POP 1,200,432
  // - Davenport: POP 18,391
  // - Dubuque: POP 300,502
  // - Iowa City: POP 174,200
  const cities: City[] = [
    {
      id: 'city_cr',
      name: 'Cedar Rapids',
      population: 1460000,
      x: 440,
      y: 320,
      county: 'Oakhaven District',
      description: 'Major regional economic anchor along the Veridian River with dense industrial manufacturing and modern civic centers.',
      metroRadius: 46,
      economicBaseValue: 84000,
    },
    {
      id: 'city_chi',
      name: 'Chicago',
      population: 300310000,
      x: 1000,
      y: 330,
      county: 'Cooke Coastal Megaplex',
      description: 'Colossal coastal mega-metropolis of 300+ million citizens featuring vast skyscraper corridors, massive transit grids, and global financial maritime harbors.',
      metroRadius: 100,
      economicBaseValue: 18500000,
    },
    {
      id: 'city_rfd',
      name: 'Rockford',
      population: 25649,
      x: 720,
      y: 250,
      county: 'Sterling Ridge County',
      description: 'Scenic manufacturing enclave nestled near Lake Eldoria, known for precision machinery, parks, and regional railway logistics.',
      metroRadius: 24,
      economicBaseValue: 1650,
    },
    {
      id: 'city_dsm',
      name: 'Des Moines',
      population: 1200432,
      x: 240,
      y: 620,
      county: 'Prairie Bluffs County',
      description: 'Prosperous inland financial, insurance, and agricultural tech capital situated between high rolling bluffs and Mirror Basin.',
      metroRadius: 44,
      economicBaseValue: 72000,
    },
    {
      id: 'city_dvn',
      name: 'Davenport',
      population: 18391,
      x: 890,
      y: 710,
      county: 'Cascade Maritime Shore',
      description: 'Historic riverfront shipping and rail community with vibrant port docks, grain elevators, and artisan districts.',
      metroRadius: 22,
      economicBaseValue: 1100,
    },
    {
      id: 'city_dbq',
      name: 'Dubuque',
      population: 300502,
      x: 660,
      y: 550,
      county: 'Iron River Basin',
      description: 'Historic river bluff city with major shipping locks, universities, regional hospitals, and engineering works.',
      metroRadius: 34,
      economicBaseValue: 19500,
    },
    // The 1 New City: Iowa City (POP: 174,200)
    {
      id: 'city_iac',
      name: 'Iowa City',
      population: 174200,
      x: 520,
      y: 530,
      county: 'Iron River Basin',
      description: 'Prestigious university and medical trauma center city set along the Iowa Silver Run river bluffs with sprawling healthcare campuses and tech incubators.',
      metroRadius: 30,
      economicBaseValue: 14200,
    },
  ];

  // 7. Fictional Road Arteries
  const roads: RoadArtery[] = [
    {
      id: 'r1',
      name: 'Interstate 80 Trans-Basin',
      type: 'interstate',
      points: [
        { x: 80, y: 620 },
        { x: 240, y: 620 }, // Des Moines
        { x: 520, y: 530 }, // Iowa City
        { x: 660, y: 550 }, // Dubuque
        { x: 890, y: 710 }, // Davenport
        { x: 1020, y: 760 },
      ],
    },
    {
      id: 'r2',
      name: 'Northern Coastal Expressway',
      type: 'interstate',
      points: [
        { x: 190, y: 240 },
        { x: 440, y: 320 }, // Cedar Rapids
        { x: 720, y: 250 }, // Rockford
        { x: 1000, y: 330 }, // Chicago
        { x: 1110, y: 370 },
      ],
    },
    {
      id: 'r3',
      name: 'Veridian Meridian Route 380',
      type: 'highway',
      points: [
        { x: 440, y: 110 },
        { x: 440, y: 320 }, // Cedar Rapids
        { x: 520, y: 530 }, // Iowa City
        { x: 660, y: 550 }, // Dubuque
      ],
    },
    {
      id: 'r4',
      name: 'Chicago Coastal Ring Highway',
      type: 'arterial',
      points: [
        { x: 1000, y: 220 },
        { x: 1080, y: 280 },
        { x: 1090, y: 390 },
        { x: 1010, y: 440 },
        { x: 920, y: 390 },
        { x: 920, y: 280 },
        { x: 1000, y: 220 },
      ],
    },
  ];

  // 8. NEXRAD Doppler Radar Stations
  const radarStations: RadarStation[] = [
    { id: 'rad_chi', callsign: 'KCHI', name: 'Chicago Coastal Doppler', x: 1020, y: 290, rangeRadius: 210 },
    { id: 'rad_cr', callsign: 'KCRX', name: 'Cedar Rapids Valley Doppler', x: 410, y: 290, rangeRadius: 190 },
    { id: 'rad_dsm', callsign: 'KDSM', name: 'Des Moines Ridge Doppler', x: 210, y: 650, rangeRadius: 190 },
    { id: 'rad_dbq', callsign: 'KDBQ', name: 'Dubuque River Doppler', x: 670, y: 520, rangeRadius: 180 },
    { id: 'rad_dvn', callsign: 'KDVN', name: 'Quad Cities Regional Doppler', x: 880, y: 740, rangeRadius: 190 },
  ];

  // 9. Procedural Structures
  const structures: BuildingStructure[] = [];

  cities.forEach((city) => {
    let buildingCount = 24;
    if (city.name === 'Chicago') buildingCount = 160;
    else if (city.name === 'Cedar Rapids') buildingCount = 65;
    else if (city.name === 'Des Moines') buildingCount = 60;
    else if (city.name === 'Dubuque') buildingCount = 40;
    else if (city.name === 'Iowa City') buildingCount = 35;
    else if (city.name === 'Rockford') buildingCount = 26;
    else if (city.name === 'Davenport') buildingCount = 22;

    for (let i = 0; i < buildingCount; i++) {
      const angle = rng() * Math.PI * 2;
      const dist = Math.pow(rng(), 1.5) * city.metroRadius;
      const bx = city.x + Math.cos(angle) * dist;
      const by = city.y + Math.sin(angle) * dist;

      let type: BuildingStructure['type'] = 'residential';
      let value = 350000;
      let occupancy = 4;
      let name: string | undefined;

      if (dist < city.metroRadius * 0.28) {
        if (city.name === 'Chicago') {
          type = 'commercial';
          value = 550000000 + rng() * 950000000;
          occupancy = 1500 + Math.floor(rng() * 5000);
          name = `Skyscraper Tower ${i + 1}`;
        } else {
          type = 'commercial';
          value = 18000000 + rng() * 45000000;
          occupancy = 180 + Math.floor(rng() * 450);
          name = `${city.name} Commercial Center ${i + 1}`;
        }
      } else if (i === 1) {
        type = 'hospital';
        value = 95000000;
        occupancy = 750;
        name = `${city.name} University Medical & Trauma Center`;
      } else if (i === 2) {
        type = 'school';
        value = 28000000;
        occupancy = 850;
        name = `${city.name} High School & Civic Campus`;
      } else if (i === 3) {
        type = 'power_station';
        value = 110000000;
        occupancy = 50;
        name = `${city.county} Regional Power Substation`;
      } else if (i % 6 === 0) {
        type = 'industrial';
        value = 15000000 + rng() * 35000000;
        occupancy = 140;
        name = `${city.name} Logistics Center`;
      } else {
        type = 'residential';
        if (city.name === 'Chicago') {
          value = 2200000;
          occupancy = 30;
        } else {
          value = 350000 + rng() * 320000;
          occupancy = 3 + Math.floor(rng() * 3);
        }
      }

      structures.push({
        id: `bld_${city.id}_${i}`,
        cityId: city.id,
        cityName: city.name,
        x: Math.round(bx * 10) / 10,
        y: Math.round(by * 10) / 10,
        type,
        name,
        value,
        occupancy,
        damageTier: 'undamaged',
        damagePercent: 0,
      });
    }
  });

  // Marine vessels and coastal infrastructure
  const marineAssets = [
    { x: 1080, y: 350, type: 'dock_terminal' as const, name: 'Chicago Grand Harbor Maritime Terminal', value: 340000000, occupancy: 320 },
    { x: 1140, y: 330, type: 'marine_vessel' as const, name: 'Container Freight Carrier "Aethelgard Star"', value: 120000000, occupancy: 28 },
    { x: 1120, y: 400, type: 'marine_vessel' as const, name: 'Coastal Ferry "Windward Express"', value: 45000000, occupancy: 180 },
    { x: 1190, y: 480, type: 'marine_vessel' as const, name: 'Bulk Grain Freighter "Veridian Crest"', value: 78000000, occupancy: 24 },
    { x: 1260, y: 250, type: 'marine_vessel' as const, name: 'Offshore Commercial Tug & Barge 4', value: 18000000, occupancy: 12 },
    { x: 1160, y: 220, type: 'power_station' as const, name: 'Offshore Marine Wind Array Substation', value: 145000000, occupancy: 8 },
    { x: 630, y: 200, type: 'marine_vessel' as const, name: 'Lake Eldoria Marina Cruise Vessel', value: 8500000, occupancy: 65 },
    { x: 280, y: 600, type: 'marine_vessel' as const, name: 'Mirror Basin Recreational Harbor Fleet', value: 6500000, occupancy: 40 },
    { x: 530, y: 370, type: 'bridge' as const, name: 'Veridian River Main Cable Bridge', value: 55000000, occupancy: 45 },
    { x: 800, y: 290, type: 'power_station' as const, name: 'Sterling Intertie High-Voltage Station', value: 72000000, occupancy: 15 },
  ];

  marineAssets.forEach((ma, idx) => {
    structures.push({
      id: `marine_${idx}`,
      x: ma.x,
      y: ma.y,
      type: ma.type,
      name: ma.name,
      value: ma.value,
      occupancy: ma.occupancy,
      damageTier: 'undamaged',
      damagePercent: 0,
    });
  });

  return {
    seed,
    mapWidth,
    mapHeight,
    coastline: coastPoints,
    oceanPolygon,
    islands,
    lakes,
    rivers,
    elevationContours,
    counties,
    roads,
    radarStations,
    cities,
    structures,
  };
}
