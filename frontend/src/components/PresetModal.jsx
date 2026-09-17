import React from 'react';
import { X, Layers, Sparkles, Check, ArrowRight } from 'lucide-react';

export default function PresetModal({
  isOpen,
  onClose,
  presets = [],
  onSelectPreset,
  activePresetId
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl rounded-2xl bg-[#222222] border border-[#383838] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#333333] flex items-center justify-between bg-[#262626]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-100">Pilih Preset Skenario Siap Pakai</h3>
              <p className="text-xs text-neutral-400">Dataset realistis dengan objek referensi ground-truth</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-[#333333]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preset Cards List */}
        <div className="p-6 overflow-y-auto space-y-3">
          {presets.map(preset => {
            const isCurrent = activePresetId === preset.id;
            return (
              <div
                key={preset.id}
                onClick={() => {
                  onSelectPreset(preset.id);
                  onClose();
                }}
                className={`p-4 rounded-xl cursor-pointer transition-all border ${
                  isCurrent 
                    ? 'bg-gradient-to-r from-amber-500/15 to-transparent border-amber-500/60 ring-1 ring-amber-500/30' 
                    : 'bg-[#282828] hover:bg-[#303030] border-[#383838] hover:border-neutral-500'
                } flex items-center justify-between gap-4`}
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-neutral-100">{preset.name}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-800 text-cyan-300 border border-neutral-700 uppercase">
                      {preset.category}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500 text-black">
                        Aktif
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    {preset.description}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-[10px] text-neutral-400">
                    <span>Satuan: <strong className="text-neutral-200">{preset.unit}</strong></span>
                    <span>•</span>
                    <span>Kalibrasi: <strong className="text-emerald-300">{preset.calibration_type} ({preset.reference_real_size_mm} mm)</strong></span>
                    <span>•</span>
                    <span>Model 3D: <strong className="text-purple-300">{preset.volume_model}</strong></span>
                  </div>
                </div>

                <button className="px-3 py-2 rounded-lg bg-[#333333] hover:bg-cyan-600 text-neutral-200 hover:text-white text-xs font-bold transition-all flex items-center gap-1 shrink-0">
                  <span>Muat</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-[#1e1e1e] border-t border-[#333333] text-right">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#2c2c2c] hover:bg-[#363636] text-xs font-semibold text-neutral-300"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
