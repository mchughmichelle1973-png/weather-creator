import React from 'react';
import { DamageAssessment, TornadoParameters } from '../types';
import { formatCurrency } from './DamageAssessmentView';
import { Printer, Download, X, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface CatastropheReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  assessment: DamageAssessment;
  params: TornadoParameters;
}

export const CatastropheReportModal: React.FC<CatastropheReportModalProps> = ({
  isOpen,
  onClose,
  assessment,
  params,
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadJSON = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(
        JSON.stringify(
          {
            reportTitle: 'WEATHER CREATOR CATASTROPHE MODELING REPORT',
            generatedDate: new Date().toISOString(),
            tornadoParameters: params,
            damageAssessment: assessment,
          },
          null,
          2
        )
      );
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `Catastrophe_Modeling_Report_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-950 text-slate-100 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-500" />
            <h2 className="font-bold text-base text-white">
              Official Catastrophe Modeling & Disaster Assessment Dossier
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadJSON}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors border border-slate-700"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors border border-slate-700"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Dossier</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Dossier Content */}
        <div className="p-8 flex flex-col gap-6 text-xs text-slate-300 font-sans leading-relaxed max-h-[75vh] overflow-y-auto">
          {/* Document Header */}
          <div className="border-b border-slate-800 pb-5">
            <div className="text-slate-500 uppercase tracking-widest text-[10px] font-mono mb-1">
              Catastrophe Modeling Platform · Impact Assessment Report #WCR-2026-X
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              METEOROLOGICAL EVENT DAMAGE REPORT
            </h1>
            <div className="flex flex-wrap gap-4 text-xs font-mono text-slate-400 mt-2">
              <span>Classification: {params.efScale} Violent Vortex</span>
              <span>·</span>
              <span>Winds: {params.windSpeedMph} MPH</span>
              <span>·</span>
              <span>Vortex Width: {params.vortexWidthYards} yds</span>
              <span>·</span>
              <span>Forward Motion: {params.movementSpeedMph} MPH</span>
            </div>
          </div>

          {/* Executive Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80">
              <div className="text-slate-400 font-semibold mb-1">Total Loss Estimate</div>
              <div className="text-2xl font-mono font-bold text-emerald-400">
                {formatCurrency(assessment.totalEconomicLoss)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1 font-mono">
                Insured: {formatCurrency(assessment.insuredLoss)}
              </div>
            </div>

            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80">
              <div className="text-slate-400 font-semibold mb-1">Structures Compromised</div>
              <div className="text-2xl font-mono font-bold text-amber-400">
                {assessment.structuresImpacted.total.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-400 mt-1 font-mono">
                {assessment.structuresImpacted.destroyed} Complete Destruction
              </div>
            </div>

            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80">
              <div className="text-slate-400 font-semibold mb-1">Casualty Toll (Est.)</div>
              <div className="text-2xl font-mono font-bold text-rose-400">
                {assessment.casualtyEstimate.fatalities.toLocaleString()} Fatalities
              </div>
              <div className="text-[11px] text-slate-400 mt-1 font-mono">
                {assessment.casualtyEstimate.displacedPersons.toLocaleString()} Displaced
              </div>
            </div>
          </div>

          {/* City Impact Matrix */}
          <div>
            <h3 className="text-sm font-bold text-white mb-2 uppercase tracking-wider">
              Jurisdictional Impact & Population Exposure Matrix
            </h3>
            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-900/80 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-mono">
                    <th className="py-2.5 px-3">City</th>
                    <th className="py-2.5 px-3 text-right">Population</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-center">Intensity</th>
                    <th className="py-2.5 px-3 text-right">Structures</th>
                    <th className="py-2.5 px-3 text-right">Economic Loss</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {assessment.cityImpacts.map((c) => (
                    <tr key={c.cityId}>
                      <td className="py-2.5 px-3 font-semibold text-slate-200">{c.cityName}</td>
                      <td className="py-2.5 px-3 text-right text-slate-300">
                        {c.population.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {c.directHit ? (
                          <span className="text-rose-400 font-bold">DIRECT</span>
                        ) : c.structuresDamaged > 0 ? (
                          <span className="text-amber-400">PERIPHERAL</span>
                        ) : (
                          <span className="text-slate-500">CLEAR</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-300">{c.maxEfExperienced}</td>
                      <td className="py-2.5 px-3 text-right text-slate-300">
                        {c.structuresDamaged.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right text-emerald-400 font-bold">
                        {c.economicLoss > 0 ? formatCurrency(c.economicLoss) : '$0'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Meteorological Warning Audit */}
          <div>
            <h3 className="text-sm font-bold text-white mb-2 uppercase tracking-wider">
              NWS Warning Issuance Audit ({assessment.warningsIssuedCount} Polygons)
            </h3>
            <div className="flex flex-col gap-2">
              {assessment.warnings.map((w) => (
                <div
                  key={w.id}
                  className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div>
                    <span className="font-mono font-bold text-rose-400 mr-2">
                      POLYGON #{w.warningNumber} [{w.urgencyLevel}]
                    </span>
                    <span className="text-slate-300">
                      {w.impactedCities.join(', ') || 'Regional Basin'}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400">
                    Population at risk: {w.populationAtRisk.toLocaleString()} · Motion: {w.motionSpeedMph} MPH @ {w.motionVectorHeadingDeg}°
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 font-mono">
            Weather Creator Disaster Simulation Platform · Algorithmic Catastrophe Modeling
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-colors"
          >
            Close Dossier
          </button>
        </div>
      </div>
    </div>
  );
};
