import React from 'react';
import logoIcon from '../img/icon.svg';
import {
  Calculator,
  Eye,
  Camera,
  Upload,
  FileDown,
  Layers,
  Activity,
  Server
} from 'lucide-react';

export default function Navbar({
  activeTab,
  setActiveTab,
  backendStatus,
  onOpenPresets,
  onUploadClick,
  onOpenLiveCamera,
  onOpenExport,
  isProcessing
}) {
  const statusDot = {
    checking: 'bg-amber-400 animate-pulse',
    connected: 'bg-[#c4c4c4]',
    error: 'bg-rose-500'
  }[backendStatus] || 'bg-amber-400 animate-pulse';

  const statusText = {
    checking: 'Menyiapkan Mesin...',
    connected: 'Mesin Terhubung',
    error: 'Mesin Gagal Terhubung'
  }[backendStatus] || 'Menyiapkan Mesin...';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#333333] bg-[#1c1c1c]/95 backdrop-blur-md px-4 lg:px-8 py-3 shadow-xl transition-all">
      <div className="max-w-[1780px] mx-auto flex items-center gap-4">

        {/* Left: Brand Header — logo + "Compute" only */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-[#292929] border border-[#444444] flex items-center justify-center shadow-md">
            <img src={logoIcon} alt="Compute" className="w-8 h-8" />
          </div>
          <h1 className="text-xl lg:text-2xl font-black tracking-tight text-white font-sans">
            Compute
          </h1>
        </div>

        {/* Center: Action Toolbar */}
        <div className="flex-1 flex items-center justify-center gap-2 flex-wrap">
          {activeTab === 'vision' && (
            <>
              <button
                onClick={onOpenPresets}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#242424] hover:bg-[#2c2c2c] border border-[#383838] hover:border-[#525252] text-xs text-[#e5e5e5] font-medium transition-all shadow-sm"
                title="Pilih Preset Skenario Bawaan"
              >
                <Layers className="w-3.5 h-3.5 text-[#a3a3a3]" />
                <span>Pilih Preset</span>
              </button>

              <button
                onClick={onUploadClick}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#242424] hover:bg-[#2c2c2c] border border-[#383838] hover:border-[#525252] text-xs text-[#e5e5e5] font-medium transition-all shadow-sm"
                title="Upload Gambar Anda"
              >
                <Upload className="w-3.5 h-3.5 text-[#a3a3a3]" />
                <span>Upload</span>
              </button>

              <button
                onClick={onOpenLiveCamera}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#242424] hover:bg-[#2c2c2c] border border-[#383838] hover:border-[#525252] text-xs text-[#e5e5e5] font-medium transition-all shadow-sm"
                title="Kamera Langsung (Webcam)"
              >
                <Camera className="w-3.5 h-3.5 text-[#a3a3a3]" />
                <span>Live Cam</span>
              </button>

              <button
                onClick={onOpenExport}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#282828] hover:bg-[#323232] border border-[#444444] text-xs text-white font-medium transition-all shadow-sm"
                title="Ekspor Laporan Hasil Audit (CSV / JSON / PDF)"
              >
                <FileDown className="w-3.5 h-3.5 text-[#c4c4c4]" />
                <span>Ekspor Laporan</span>
              </button>

              {isProcessing && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#222222] border border-[#444444] text-xs text-[#d4d4d8] shadow-sm animate-pulse">
                  <Activity className="w-3.5 h-3.5 animate-spin text-[#c4c4c4]" />
                  <span className="text-[11px] font-mono">Memproses...</span>
                </div>
              )}
            </>
          )}

          {/* {activeTab === 'workflow' && (
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#242424] border border-[#383838] text-xs text-[#d4d4d8] font-medium shadow-sm"
              title="Status backend kerja AI"
            >
              <Server className="w-3.5 h-3.5 text-[#a3a3a3]" />
              <span className={`w-2 h-2 rounded-full ${statusDot}`} />
              <span className="hidden sm:inline">{statusText}</span>
            </div>
          )} */}
        </div>

        {/* Right: Mode Navigation Tabs */}
        <div className="flex items-center p-1 rounded-lg bg-[#141414] border border-[#333333] shrink-0">
          <button
            onClick={() => setActiveTab('vision')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 ${activeTab === 'vision'
              ? 'bg-[#2a2a2a] text-white border border-[#c4c4c4] shadow-sm'
              : 'text-[#9ca3af] hover:text-[#e5e5e5] hover:bg-[#1f1f1f]'
              }`}
          >
            <Eye className="w-4 h-4 text-[#d4d4d8]" />
            <span>Vision Studio</span>
          </button>

          <button
            onClick={() => setActiveTab('workflow')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 ${activeTab === 'workflow'
              ? 'bg-[#2a2a2a] text-white border border-[#c4c4c4] shadow-sm'
              : 'text-[#9ca3af] hover:text-[#e5e5e5] hover:bg-[#1f1f1f]'
              }`}
          >
            <Calculator className="w-4 h-4 text-[#d4d4d8]" />
            <span>Equation Solver</span>
          </button>
        </div>

      </div>
    </header>
  );
}