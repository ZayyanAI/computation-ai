import React, { useState, useEffect } from 'react';
import {
  X,
  Camera,
  ScanLine,
  Sparkles,
  ArrowRight,
  SkipForward,
  Box,
  MousePointerClick
} from 'lucide-react';

// Quick-category chips users can tap so detection gets a semantic hint
// (instead of pure automatic guessing). Maps to backend config category + target_object.
const CATEGORY_CHIPS = [
  { id: 'fruit', label: 'Buah / Sayur', category: 'fruit', target: 'buah' },
  { id: 'electronics', label: 'Elektronik', category: 'general', target: 'barang elektronik' },
  { id: 'stationery', label: 'Alat Tulis', category: 'general', target: 'alat tulis' },
  { id: 'bottle', label: 'Botol / Minuman', category: 'general', target: 'botol' },
  { id: 'box', label: 'Kotak / Paket', category: 'box', target: 'kotak' },
  { id: 'part', label: 'Komponen / Baut', category: 'part', target: 'komponen' },
  { id: 'other', label: 'Lainnya', category: 'general', target: 'benda' }
];

export default function CaptureConfirmModal({
  isOpen,
  previewUrl,
  sourceLabel,
  isProcessing,
  onConfirm,
  onSkip,
  onCancel
}) {
  const [objectName, setObjectName] = useState('');
  const [categoryId, setCategoryId] = useState(null);

  // Reset form each time the modal opens for a fresh capture
  useEffect(() => {
    if (isOpen) {
      setObjectName('');
      setCategoryId(null);
    }
  }, [isOpen]);

  const selectedChip = CATEGORY_CHIPS.find(c => c.id === categoryId) || CATEGORY_CHIPS[6];

  const handleConfirm = () => {
    onConfirm({
      target_object: (objectName.trim() || selectedChip.target).toLowerCase(),
      category: selectedChip.category,
      object_label: objectName.trim()
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-2xl rounded-2xl bg-[#222222] border border-[#383838] shadow-2xl overflow-hidden flex flex-col">

        {/* Header */}
        <div className="px-6 py-4 border-b border-[#333333] flex items-center justify-between bg-[#262626]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#c4c4c4]/15 text-[#c4c4c4] border border-[#c4c4c4]/30">
              <ScanLine className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-100">
                Konfirmasi Objek {sourceLabel ? `(${sourceLabel})` : ''}
              </h3>
              <p className="text-xs text-neutral-400">
                Beri tahu sistem benda apa yang ingin diukur agar deteksi lebih akurat
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-[#333333] disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body: preview + hint input */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-5 gap-5 bg-[#181818]">
          {/* Photo Preview */}
          <div className="md:col-span-2 rounded-xl overflow-hidden border border-[#333333] bg-[#121212] flex items-center justify-center min-h-[180px] relative">
            {previewUrl ? (
              <img src={previewUrl} alt="Preview tangkapan" className="w-full h-auto max-h-[260px] object-contain" />
            ) : (
              <Camera className="w-10 h-10 text-neutral-600" />
            )}
            <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 text-[10px] font-mono text-neutral-300 border border-[#3a3a3a]">
              Preview
            </span>
          </div>

          {/* Hint Inputs */}
          <div className="md:col-span-3 flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                Apa nama benda yang ingin diukur?
              </label>
              <input
                type="text"
                value={objectName}
                onChange={(e) => setObjectName(e.target.value)}
                placeholder="cth: apel, kotak kardus, botol minuman..."
                maxLength={60}
                disabled={isProcessing}
                className="w-full px-3 py-2.5 rounded-xl bg-[#1a1a1a] border border-[#383838] focus:border-[#c4c4c4] focus:outline-none text-sm text-neutral-100 placeholder-neutral-500 font-mono disabled:opacity-50"
              />
              <p className="text-[11px] text-neutral-500 mt-1 flex items-center gap-1">
                <MousePointerClick className="w-3 h-3" />
                Nama ini dipakai sebagai hint pencarian objek utama, bukan kunci deteksi kaku.
              </p>
            </div>

            <div>
              <span className="block text-xs font-semibold text-neutral-300 mb-1.5">
                Atau pilih kategori cepat:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORY_CHIPS.map(chip => (
                  <button
                    key={chip.id}
                    onClick={() => setCategoryId(chip.id)}
                    disabled={isProcessing}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all disabled:opacity-50 cursor-pointer ${
                      categoryId === chip.id
                        ? 'bg-[#c4c4c4]/15 border-[#c4c4c4]/60 text-[#c4c4c4]'
                        : 'bg-[#242424] border-[#383838] text-neutral-300 hover:border-[#5a5a5a]'
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1e1e1e] border border-[#333333] text-[11px] text-neutral-400">
              <Sparkles className="w-3.5 h-3.5 text-[#c4c4c4]" />
              Hint dipakai untuk <span className="text-neutral-200 font-semibold">menyempurnakan deteksi</span> — hasil
              tetap diverifikasi silang oleh sistem.
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-[#202020] border-t border-[#333333] flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-neutral-400 flex items-center gap-1.5">
            <Box className="w-3.5 h-3.5 text-[#a3a3a3]" />
            Langkah ini opsional — satu klik saja.
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onSkip}
              disabled={isProcessing}
              className="px-4 py-2 rounded-lg bg-[#2c2c2c] hover:bg-[#363636] text-xs font-semibold text-neutral-300 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <SkipForward className="w-3.5 h-3.5 text-[#a3a3a3]" />
              Lewati — Deteksi Otomatis
            </button>
            <button
              onClick={handleConfirm}
              disabled={isProcessing}
              className="px-5 py-2 rounded-lg bg-[#c4c4c4] hover:bg-[#d4d4d8] text-[#1a1a1a] text-xs font-bold shadow-lg flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <ScanLine className="w-4 h-4" />
              <span>{isProcessing ? 'Memproses...' : 'Ukur Dengan Hint Ini'}</span>
              {!isProcessing && <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}