import React, { useState } from 'react';
import { 
  Calculator, 
  BookOpen, 
  BarChart3, 
  Copy, 
  Check, 
  HelpCircle, 
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Zap
} from 'lucide-react';
import KatexRenderer from './KatexRenderer';

export default function FormulaPanel({
  pipelineResult,
  selectedObjectId,
  onSelectObject
}) {
  const [activeTab, setActiveTab] = useState('selected'); // 'selected' | 'global' | 'stats'
  const [copiedIndex, setCopiedIndex] = useState(null);

  const objects = pipelineResult?.objects || [];
  const calib = pipelineResult?.calibration || {};
  const calibFormula = calib?.formula || {};
  const summaryFormulas = pipelineResult?.summary_formulas || {};
  const stats = pipelineResult?.stats || {};
  const unit = calib?.unit || 'cm';

  // Find active selected object or default to first
  const selectedObj = objects.find(o => o.id === selectedObjectId) || objects[0];
  const objFormulas = selectedObj?.formulas || [];

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 1800);
  };

  return (
    <div className="w-full h-full glass-panel flex flex-col border border-[#333333] overflow-hidden">
      
      {/* Header */}
      <div className="px-4 py-3 bg-[#222222]/90 border-b border-[#333333] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <Calculator className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-100 flex items-center gap-1.5">
              Panel Transparansi Formula <span className="text-emerald-400 font-mono">LaTeX</span>
            </h2>
            <p className="text-[11px] text-neutral-400">Verifikasi matematis step-by-step tanpa black-box</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center p-0.5 rounded-lg bg-[#1a1a1a] border border-[#333333]">
          <button
            onClick={() => setActiveTab('selected')}
            className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
              activeTab === 'selected'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Objek Terpilih {selectedObj ? `(#${selectedObj.id})` : ''}
          </button>

          <button
            onClick={() => setActiveTab('stats')}
            className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
              activeTab === 'stats'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Statistik & Densitas
          </button>

          <button
            onClick={() => setActiveTab('global')}
            className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
              activeTab === 'global'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Buku Rumus Pipeline
          </button>
        </div>
      </div>

      {/* Content Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        
        {/* VIEW 1: SELECTED OBJECT STEP-BY-STEP FORMULAS */}
        {activeTab === 'selected' && (
          <>
            {/* Quick Object Switcher Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider whitespace-nowrap">
                Pilih Objek:
              </span>
              {objects.map(obj => (
                <button
                  key={obj.id}
                  onClick={() => onSelectObject(obj.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-mono font-bold transition-all whitespace-nowrap ${
                    selectedObj?.id === obj.id
                      ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                      : 'bg-[#252525] text-neutral-300 hover:bg-[#303030] border border-[#383838]'
                  }`}
                >
                  #{obj.id}
                </button>
              ))}
            </div>

            {selectedObj ? (
              <div className="space-y-3">
                {/* Object Summary Card */}
                <div className="p-3.5 rounded-xl bg-gradient-to-r from-[#252525] to-[#202020] border border-[#383838] flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">Entitas Terpilih</span>
                    <h3 className="text-sm font-bold text-neutral-100">{selectedObj.label}</h3>
                    <p className="text-[11px] text-neutral-400">
                      Centroid: ({selectedObj.centroid[0]}, {selectedObj.centroid[1]}) px • Confidence: {Math.round(selectedObj.confidence * 100)}%
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <span className="text-[10px] text-neutral-400 block">Volume Estimasi</span>
                      <span className="text-sm font-extrabold text-emerald-400 font-mono">
                        {selectedObj.measurements?.volume} {unit}³
                      </span>
                    </div>
                  </div>
                </div>

                {/* Step 0: Scale Calibration Card */}
                {calibFormula?.algebraic && (
                  <div className="p-3.5 rounded-xl bg-[#222222] border border-[#353535] hover:border-cyan-500/40 transition-all space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-cyan-400 font-bold text-xs">
                        <span className="w-5 h-5 rounded-full bg-cyan-950 text-cyan-300 text-[10px] flex items-center justify-center font-mono border border-cyan-800">0</span>
                        <span>{calibFormula.title || 'Kalibrasi Skala Piksel ke Fisik'}</span>
                      </div>
                      <button
                        onClick={() => handleCopy(calibFormula.substituted, 'calib')}
                        className="p-1 rounded text-neutral-400 hover:text-white hover:bg-[#303030]"
                        title="Salin LaTeX"
                      >
                        {copiedIndex === 'calib' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#191919] border border-[#2c2c2c] overflow-x-auto space-y-1.5">
                      <div className="text-neutral-400 text-[11px]">Formula Umum:</div>
                      <div className="text-center py-1">
                        <KatexRenderer math={calibFormula.algebraic} block />
                      </div>
                      <div className="text-neutral-400 text-[11px] pt-1 border-t border-[#262626]">Substitusi Nilai Riil:</div>
                      <div className="text-center py-1 bg-cyan-950/20 rounded border border-cyan-900/30">
                        <KatexRenderer math={calibFormula.substituted} block />
                      </div>
                    </div>
                    <p className="text-[11px] text-neutral-400">{calibFormula.explanation}</p>
                  </div>
                )}

                {/* Step 1 to N: Object Formulas */}
                {objFormulas.map((f, fIdx) => (
                  <div 
                    key={fIdx}
                    className="p-3.5 rounded-xl bg-[#222222] border border-[#353535] hover:border-emerald-500/40 transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs">
                        <span className="w-5 h-5 rounded-full bg-emerald-950 text-emerald-300 text-[10px] flex items-center justify-center font-mono border border-emerald-800">
                          {f.step}
                        </span>
                        <span>{f.metric}</span>
                      </div>
                      <button
                        onClick={() => handleCopy(f.substituted, fIdx)}
                        className="p-1 rounded text-neutral-400 hover:text-white hover:bg-[#303030]"
                        title="Salin LaTeX"
                      >
                        {copiedIndex === fIdx ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#191919] border border-[#2c2c2c] overflow-x-auto space-y-1.5">
                      <div className="text-neutral-400 text-[11px]">Formula Aljabar:</div>
                      <div className="text-center py-1">
                        <KatexRenderer math={f.algebraic} block />
                      </div>
                      <div className="text-neutral-400 text-[11px] pt-1 border-t border-[#262626]">Kalkulasi dengan Angka Nyata:</div>
                      <div className="text-center py-1 bg-emerald-950/20 rounded border border-emerald-900/30">
                        <KatexRenderer math={f.substituted} block />
                      </div>
                    </div>
                    <p className="text-[11px] text-neutral-400 leading-relaxed">{f.explanation}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-neutral-500">
                Belum ada objek terpilih.
              </div>
            )}
          </>
        )}

        {/* VIEW 2: STATISTICAL & SPATIAL DENSITY FORMULAS */}
        {activeTab === 'stats' && (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-[#242424] border border-[#333333] space-y-1">
              <h3 className="font-bold text-neutral-100 flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-purple-400" />
                Agregasi Statistik & Densitas Spasial
              </h3>
              <p className="text-[11px] text-neutral-400">
                Formula matematika yang digunakan untuk merangkum populasi objek di area frame.
              </p>
            </div>

            {/* Density Formula */}
            {summaryFormulas.density && (
              <div className="p-3.5 rounded-xl bg-[#222222] border border-[#333333] space-y-2">
                <span className="font-bold text-purple-300 text-xs">{summaryFormulas.density.metric}</span>
                <div className="p-2.5 rounded-lg bg-[#191919] border border-[#2c2c2c] text-center space-y-2">
                  <div>
                    <KatexRenderer math={summaryFormulas.density.algebraic} block />
                  </div>
                  <div className="pt-2 border-t border-[#2a2a2a] bg-purple-950/20 p-2 rounded">
                    <KatexRenderer math={summaryFormulas.density.substituted} block />
                  </div>
                </div>
                <p className="text-[11px] text-neutral-400">{summaryFormulas.density.explanation}</p>
              </div>
            )}

            {/* Mean Formula */}
            {summaryFormulas.mean_length && (
              <div className="p-3.5 rounded-xl bg-[#222222] border border-[#333333] space-y-2">
                <span className="font-bold text-amber-300 text-xs">Nilai Rata-rata Panjang (Sample Mean)</span>
                <div className="p-2.5 rounded-lg bg-[#191919] border border-[#2c2c2c] text-center space-y-2">
                  <div>
                    <KatexRenderer math={summaryFormulas.mean_length.algebraic} block />
                  </div>
                  <div className="pt-2 border-t border-[#2a2a2a] bg-amber-950/20 p-2 rounded">
                    <KatexRenderer math={summaryFormulas.mean_length.substituted} block />
                  </div>
                </div>
              </div>
            )}

            {/* Standard Deviation Formula */}
            {summaryFormulas.std_length && (
              <div className="p-3.5 rounded-xl bg-[#222222] border border-[#333333] space-y-2">
                <span className="font-bold text-cyan-300 text-xs">Standar Deviasi Dimensi (Spread)</span>
                <div className="p-2.5 rounded-lg bg-[#191919] border border-[#2c2c2c] text-center space-y-2">
                  <div>
                    <KatexRenderer math={summaryFormulas.std_length.algebraic} block />
                  </div>
                  <div className="pt-2 border-t border-[#2a2a2a] bg-cyan-950/20 p-2 rounded">
                    <KatexRenderer math={summaryFormulas.std_length.substituted} block />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW 3: GLOBAL FORMULA HANDBOOK */}
        {activeTab === 'global' && (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-[#242424] border border-[#333333] space-y-1">
              <h3 className="font-bold text-neutral-100 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-emerald-400" />
                Daftar Rumus Standar Pipeline CountMeasure AI
              </h3>
              <p className="text-[11px] text-neutral-400">
                Kompilasi rumus matematis yang berlaku di seluruh modul Computer Vision.
              </p>
            </div>

            {/* Handbook Cards */}
            <div className="p-3 rounded-lg bg-[#222222] border border-[#333333] space-y-1.5">
              <div className="font-bold text-neutral-200">1. Kalibrasi Skala Piksel ke Metrik</div>
              <KatexRenderer math={"S = \\frac{D_{\\text{real}}}{d_{\\text{px}}} \\quad (\\text{unit}/\\text{px})"} block />
              <p className="text-[11px] text-neutral-400">Menentukan rasio ukuran fisik per satuan piksel kamera.</p>
            </div>

            <div className="p-3 rounded-lg bg-[#222222] border border-[#333333] space-y-1.5">
              <div className="font-bold text-neutral-200">2. Luas Permukaan Kontur Riil</div>
              <KatexRenderer math={"A = A_{\\text{px}} \\times S^2 \\quad (\\text{unit}^2)"} block />
              <p className="text-[11px] text-neutral-400">Mengonversi luas piksel menjadi satuan luas riil dengan pengali S kuadrat.</p>
            </div>

            <div className="p-3 rounded-lg bg-[#222222] border border-[#333333] space-y-1.5">
              <div className="font-bold text-neutral-200">3. Derajat Kebulatan (Circularity)</div>
              <KatexRenderer math={"C = \\frac{4\\pi \\cdot A}{P^2}"} block />
              <p className="text-[11px] text-neutral-400">Rentang nilai 0 hingga 1. Nilai 1.0 mewakili bentuk lingkaran sempurna.</p>
            </div>

            <div className="p-3 rounded-lg bg-[#222222] border border-[#333333] space-y-1.5">
              <div className="font-bold text-neutral-200">4. Estimasi Volume Elipsoid 3D</div>
              <KatexRenderer math={"V = \\frac{4}{3}\\pi \\cdot a \\cdot b \\cdot c = \\frac{4}{3}\\pi \\left(\\frac{L}{2}\\right) \\left(\\frac{W}{2}\\right)^2"} block />
              <p className="text-[11px] text-neutral-400">Digunakan untuk objek simetris rotasi seperti buah atau sel.</p>
            </div>

            <div className="p-3 rounded-lg bg-[#222222] border border-[#333333] space-y-1.5">
              <div className="font-bold text-neutral-200">5. Kepadatan Objek (Spatial Density)</div>
              <KatexRenderer math={"\\rho = \\frac{N}{\\text{Luas Area Field}}"} block />
              <p className="text-[11px] text-neutral-400">Menghitung jumlah objek per satuan luas area pandang kamera.</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
