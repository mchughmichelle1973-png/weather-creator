import React, { useState } from 'react';
import {
  DamageAssessment,
  BuildingStructure,
  CityImpactSummary,
  DamageTier,
} from '../types';
import {
  DollarSign,
  Building2,
  Activity,
  HeartPulse,
  Flame,
  FileSpreadsheet,
  AlertOctagon,
  ArrowUpRight,
  Filter,
} from 'lucide-react';

interface DamageAssessmentViewProps {
  assessment: DamageAssessment;
  structures: BuildingStructure[];
  selectedStructure: BuildingStructure | null;
  onSelectStructure: (struct: BuildingStructure | null) => void;
  onOpenReportModal: () => void;
}

export function formatCurrency(amount: number): string {
  if (amount >= 1e12) return `$${(amount / 1e12).toFixed(2)} Trillion`;
  if (amount >= 1e9) return `$${(amount / 1e9).toFixed(2)} Billion`;
  if (amount >= 1e6) return `$${(amount / 1e6).toFixed(1)} Million`;
  if (amount >= 1e3) return `$${(amount / 1e3).toFixed(0)} Thousand`;
  return `$${amount.toLocaleString()}`;
}

export const DamageAssessmentView: React.FC<DamageAssessmentViewProps> = ({
  assessment,
  structures,
  selectedStructure,
  onSelectStructure,
  onOpenReportModal,
}) => {
  const [filterTier, setFilterTier] = useState<DamageTier | 'all' | 'critical'>('all');

  const impactedStructures = structures.filter((s) => s.damageTier !== 'undamaged');

  const filteredStructures = impactedStructures.filter((s) => {
    if (filterTier === 'all') return true;
    if (filterTier === 'critical') {
      return (
        s.type === 'hospital' ||
        s.type === 'school' ||
        s.type === 'power_station' ||
        s.type === 'bridge'
      );
    }
    return s.damageTier === filterTier;
  });

  return (
    <div className="flex flex-col gap-6 p-6 bg-slate-950 text-slate-100 overflow-y-auto">
      {/* Top Banner: Catastrophe Modeling Assessment Overview */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-rose-950/40 border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-rose-400 mb-1">
            <Flame className="w-4 h-4" />
            <span>Post-Disaster Catastrophe Impact Assessment</span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
            Comprehensive Structural Damage & Economic Exposure
          </h2>
          <div className="text-xs text-slate-400 mt-1 flex items-center gap-3">
            <span>Track Swath: {assessment.swathAreaSqMiles} sq miles</span>
            <span>·</span>
            <span>Track Length: {assessment.trackLengthMiles} miles</span>
            <span>·</span>
            <span>Warnings Issued: {assessment.warningsIssuedCount}</span>
          </div>
        </div>

        <button
          onClick={onOpenReportModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-rose-900/20 transition-all self-start md:self-auto shrink-0"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Generate Official Dossier</span>
        </button>
      </div>

      {/* Primary KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Economic Loss Card */}
        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-semibold uppercase tracking-wider">Total Economic Loss</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="font-mono text-2xl font-bold text-emerald-400 tracking-tight">
            {formatCurrency(assessment.totalEconomicLoss)}
          </div>
          <div className="mt-2 text-xs text-slate-400 flex justify-between font-mono pt-2 border-t border-slate-800/80">
            <span>Insured: {formatCurrency(assessment.insuredLoss)}</span>
            <span>Uninsured: {formatCurrency(assessment.uninsuredLoss)}</span>
          </div>
        </div>

        {/* Structures Impacted Card */}
        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-semibold uppercase tracking-wider">Structures Impacted</span>
            <Building2 className="w-4 h-4 text-amber-400" />
          </div>
          <div className="font-mono text-2xl font-bold text-amber-400 tracking-tight">
            {assessment.structuresImpacted.total.toLocaleString()}
          </div>
          <div className="mt-2 text-xs text-slate-400 flex items-center gap-2 pt-2 border-t border-slate-800/80 font-mono">
            <span className="text-rose-400 font-bold">{assessment.structuresImpacted.destroyed} Destroyed</span>
            <span>·</span>
            <span className="text-orange-400">{assessment.structuresImpacted.severe} Severe</span>
            <span>·</span>
            <span>{assessment.structuresImpacted.moderate} Mod</span>
          </div>
        </div>

        {/* Casualties Card */}
        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-semibold uppercase tracking-wider">Estimated Casualties</span>
            <HeartPulse className="w-4 h-4 text-rose-400" />
          </div>
          <div className="font-mono text-2xl font-bold text-rose-400 tracking-tight">
            {assessment.casualtyEstimate.fatalities.toLocaleString()} <span className="text-xs font-normal text-slate-400">fatalities</span>
          </div>
          <div className="mt-2 text-xs text-slate-400 flex justify-between font-mono pt-2 border-t border-slate-800/80">
            <span>Crit: {assessment.casualtyEstimate.criticalInjuries}</span>
            <span>Minor: {assessment.casualtyEstimate.minorInjuries}</span>
            <span>Displaced: {assessment.casualtyEstimate.displacedPersons.toLocaleString()}</span>
          </div>
        </div>

        {/* Critical Infrastructure Card */}
        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-semibold uppercase tracking-wider">Critical Infrastructure</span>
            <AlertOctagon className="w-4 h-4 text-sky-400" />
          </div>
          <div className="font-mono text-2xl font-bold text-sky-400 tracking-tight">
            {assessment.criticalInfrastructure.hospitalsDamaged +
              assessment.criticalInfrastructure.schoolsDamaged +
              assessment.criticalInfrastructure.powerSubstationsSevered +
              assessment.criticalInfrastructure.bridgesBlocked}{' '}
            <span className="text-xs font-normal text-slate-400">facilities</span>
          </div>
          <div className="mt-2 text-xs text-slate-400 flex justify-between font-mono pt-2 border-t border-slate-800/80">
            <span>Hosp: {assessment.criticalInfrastructure.hospitalsDamaged}</span>
            <span>Power: {assessment.criticalInfrastructure.powerSubstationsSevered}</span>
            <span>Bridges: {assessment.criticalInfrastructure.bridgesBlocked}</span>
          </div>
        </div>
      </div>

      {/* City Population vs Damage Impact Table */}
      <div className="bg-slate-900/70 rounded-xl border border-slate-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              City Population & Disaster Vulnerability Matrix
            </h3>
            <p className="text-xs text-slate-400">
              Direct correlation of user-defined city population sizes with structural damage and economic loss
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                <th className="py-2.5 px-3">City Name</th>
                <th className="py-2.5 px-3 text-right">Population Size</th>
                <th className="py-2.5 px-3 text-center">Hit Status</th>
                <th className="py-2.5 px-3 text-center">Max EF Intensity</th>
                <th className="py-2.5 px-3 text-right">Structures Damaged</th>
                <th className="py-2.5 px-3 text-right">Estimated Displaced</th>
                <th className="py-2.5 px-3 text-right">Economic Loss</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {assessment.cityImpacts.map((city: CityImpactSummary) => {
                const isChicago = city.cityName === 'Chicago';
                const isDirectHit = city.directHit;

                return (
                  <tr
                    key={city.cityId}
                    className={`hover:bg-slate-800/40 transition-colors ${
                      isDirectHit ? 'bg-rose-950/20' : ''
                    }`}
                  >
                    <td className="py-3 px-3 font-sans font-semibold text-slate-200">
                      <div className="flex items-center gap-2">
                        <span>{city.cityName}</span>
                        {isChicago && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800">
                            Megacity
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-300">
                      {city.population.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {isDirectHit ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-950 text-rose-400 border border-rose-800">
                          DIRECT HIT
                        </span>
                      ) : city.structuresDamaged > 0 ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-950 text-amber-400 border border-amber-800">
                          PERIPHERAL
                        </span>
                      ) : (
                        <span className="text-slate-500">SAFE</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                          city.maxEfExperienced === 'EF5'
                            ? 'bg-purple-950 text-purple-300'
                            : city.maxEfExperienced === 'EF4'
                            ? 'bg-rose-950 text-rose-300'
                            : city.maxEfExperienced === 'EF3'
                            ? 'bg-orange-950 text-orange-300'
                            : city.maxEfExperienced === 'EF2' || city.maxEfExperienced === 'EF1'
                            ? 'bg-amber-950 text-amber-300'
                            : 'text-slate-500'
                        }`}
                      >
                        {city.maxEfExperienced}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right text-slate-300">
                      {city.structuresDamaged > 0 ? city.structuresDamaged.toLocaleString() : '0'}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-300">
                      {city.estimatedDisplaced > 0 ? city.estimatedDisplaced.toLocaleString() : '0'}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-emerald-400">
                      {city.economicLoss > 0 ? formatCurrency(city.economicLoss) : '$0'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Building Structures Impact Inventory & Inspector */}
      <div className="bg-slate-900/70 rounded-xl border border-slate-800 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Impacted Building Structures Inventory
            </h3>
            <p className="text-xs text-slate-400">
              Showing {filteredStructures.length} of {impactedStructures.length} damaged structural parcels
            </p>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setFilterTier('all')}
              className={`px-2.5 py-1 rounded transition-colors ${
                filterTier === 'all' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              All Damaged
            </button>
            <button
              onClick={() => setFilterTier('destroyed')}
              className={`px-2.5 py-1 rounded transition-colors ${
                filterTier === 'destroyed' ? 'bg-rose-900 text-rose-200 font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Destroyed
            </button>
            <button
              onClick={() => setFilterTier('severe')}
              className={`px-2.5 py-1 rounded transition-colors ${
                filterTier === 'severe' ? 'bg-orange-900 text-orange-200 font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Severe
            </button>
            <button
              onClick={() => setFilterTier('moderate')}
              className={`px-2.5 py-1 rounded transition-colors ${
                filterTier === 'moderate' ? 'bg-amber-900 text-amber-200 font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Moderate
            </button>
            <button
              onClick={() => setFilterTier('critical')}
              className={`px-2.5 py-1 rounded transition-colors ${
                filterTier === 'critical' ? 'bg-sky-900 text-sky-200 font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Critical Infra
            </button>
          </div>
        </div>

        {filteredStructures.length === 0 ? (
          <div className="text-center py-10 text-xs text-slate-500">
            No structures match the selected damage category.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-1">
            {filteredStructures.slice(0, 48).map((struct) => {
              const isSelected = selectedStructure?.id === struct.id;

              return (
                <div
                  key={struct.id}
                  onClick={() => onSelectStructure(struct)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-slate-800 border-white shadow-md'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-xs text-white capitalize line-clamp-1">
                      {struct.name || `${struct.cityName || 'Rural'} ${struct.type}`}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                        struct.damageTier === 'destroyed'
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : struct.damageTier === 'severe'
                          ? 'bg-orange-950 text-orange-300 border border-orange-800'
                          : struct.damageTier === 'moderate'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : 'bg-lime-950 text-lime-300 border border-lime-800'
                      }`}
                    >
                      {struct.damageTier} ({struct.damagePercent}%)
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <span>Val: {formatCurrency(struct.value)}</span>
                    <span>Winds: {struct.maxWindExperienced} MPH</span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono mt-1 pt-1 border-t border-slate-800/80">
                    <span>Occupancy: {struct.occupancy}</span>
                    <span>Dist to Track: {struct.distanceToTrack} mi</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
