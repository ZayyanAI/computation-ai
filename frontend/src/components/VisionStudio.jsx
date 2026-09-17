import React, { useState, useRef } from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Layers, 
  Eye, 
  EyeOff, 
  Tag, 
  Crosshair, 
  Maximize2,
  Compass,
  CheckSquare,
  Sparkles,
  MousePointerClick,
  Box,
  Scale,
  LayoutGrid,
  Ruler,
  Info,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Star
} from 'lucide-react';

export default function VisionStudio({
  pipelineResult,
  selectedObjectId,
  onSelectObject,
  candidateObjects,
  primaryObjectId,
  onSelectCandidate,
  isProcessing
}) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });

  // Layer Toggles
  const [showAnnotated, setShowAnnotated] = useState(true);
  const [showBBox, setShowBBox] = useState(true);
  const [showMask, setShowMask] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showCentroids, setShowCentroids] = useState(true);
  const [showCalib, setShowCalib] = useState(true);
  const [showCandidatePanel, setShowCandidatePanel] = useState(false);

  const containerRef = useRef(null);

  const objects = pipelineResult?.objects || [];
  const stats = pipelineResult?.stats || {};
  const calib = pipelineResult?.calibration || {};
  const imgData = pipelineResult?.image || {};
  const unit = calib?.unit || 'cm';

  const lowConfidenceThreshold = 0.65;
  const primaryAccuracy = objects[0]?.saliency_score ?? null;
  const detectionStatus = pipelineResult?.detection_status;
  const detectionMessage = pipelineResult?.detection_message;
  const lowConfidence = detectionStatus
    ? detectionStatus !== 'ok'
    : primaryAccuracy != null && primaryAccuracy < lowConfidenceThreshold;

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = 0.1;
    if (e.deltaY < 0) {
      setZoom(prev => Math.min(prev + zoomFactor, 3.5));
    } else {
      setZoom(prev => Math.max(prev - zoomFactor, 0.5));
    }
  };

  const handleMouseDown = (e) => {
    if (e.button === 0 && (e.altKey || e.shiftKey)) {
      setIsPanning(true);
      setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e) => {
    if (isPanning) {
      setPan({
        x: e.clientX - startPan.x,
        y: e.clientY - startPan.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleObjectClick = (objId, e) => {
    e.stopPropagation();
    onSelectObject(objId);
  };

  return (
    <div className="w-full flex flex-col gap-6">
      
      {/* Requirement 4: Panel Statistik (Grid 4 Kartu Statistik #242424) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        
        {/* Stat Card 1: Total Objek */}
        <div className="p-4 rounded-xl bg-[#242424] border border-[#333333] shadow-md flex items-center justify-between hover:border-[#c4c4c4]/40 transition-all">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-neutral-400 block uppercase tracking-wider">
              Total Objek Dihitung
            </span>
            <div className="text-3xl font-extrabold text-[#c4c4c4] font-mono tracking-tight">
              {stats.total_count ?? 0}
            </div>
            <span className="text-[11px] text-neutral-500">Objek terdeteksi & tersegmentasi</span>
          </div>
          <div className="p-3 rounded-xl bg-neutral-800 text-[#c4c4c4] border border-[#c4c4c4]/30 shrink-0">
            <Box className="w-6 h-6" />
          </div>
        </div>

        {/* Stat Card 2: Faktor Skala (S) */}
        <div className="p-4 rounded-xl bg-[#242424] border border-[#333333] shadow-md flex items-center justify-between hover:border-cyan-500/50 transition-all">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-neutral-400 block uppercase tracking-wider">
              Faktor Skala Kalibrasi (S)
            </span>
            <div className="text-2xl font-extrabold text-cyan-400 font-mono tracking-tight">
              {calib.scale ? `${calib.scale.toFixed(4)}` : 'N/A'}
              <span className="text-xs text-cyan-300 font-normal ml-1.5">{unit}/px</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-neutral-500">Ref: {calib.type || 'coin'} ({calib.real_dimension || 0} {unit})</span>
              {calib.tilt_angle_deg != null && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${calib.tilt_warning ? 'bg-amber-950/80 text-amber-300 border border-amber-800/60' : 'bg-[#181818] text-neutral-400 border border-[#333333]'}`}>
                  Tilt: {calib.tilt_angle_deg}°
                </span>
              )}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
            <Scale className="w-6 h-6" />
          </div>
        </div>

        {/* Stat Card 3: Densitas Spasial */}
        <div className="p-4 rounded-xl bg-[#242424] border border-[#333333] shadow-md flex items-center justify-between hover:border-purple-500/50 transition-all">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-neutral-400 block uppercase tracking-wider">
              Densitas Spasial (ρ)
            </span>
            <div className="text-2xl font-extrabold text-purple-400 font-mono tracking-tight">
              {stats.density ? `${stats.density}` : '0'}
              <span className="text-xs text-purple-300 font-normal ml-1.5">obj/{unit}²</span>
            </div>
            <span className="text-[11px] text-neutral-500">Kepadatan per unit area visual</span>
          </div>
          <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0">
            <LayoutGrid className="w-6 h-6" />
          </div>
        </div>

        {/* Stat Card 4: Rerata Panjang */}
        <div className="p-4 rounded-xl bg-[#242424] border border-[#333333] shadow-md flex items-center justify-between hover:border-amber-500/50 transition-all">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-neutral-400 block uppercase tracking-wider">
              Rerata Panjang (Mean L)
            </span>
            <div className="text-2xl font-extrabold text-amber-400 font-mono tracking-tight">
              {stats.mean_length ? `${stats.mean_length}` : '0'}
              <span className="text-xs text-amber-300 font-normal ml-1.5">{unit}</span>
            </div>
            <span className="text-[11px] text-neutral-500">Rentang: {stats.min_length ?? 0} – {stats.max_length ?? 0} {unit}</span>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
            <Ruler className="w-6 h-6" />
          </div>
        </div>

      </div>

      {/* Catatan Asumsi & Batasan Akurasi Pengukuran */}
      <div className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-colors ${
        calib.tilt_warning 
          ? 'bg-amber-950/20 border-amber-700/40 text-amber-200' 
          : 'bg-[#222222]/80 border-[#333333] text-neutral-300'
      }`}>
        <div className="flex items-start sm:items-center gap-2.5">
          {calib.tilt_warning ? (
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
          ) : (
            <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5 sm:mt-0" />
          )}
          <div>
            <span className="font-semibold text-neutral-200">Panduan Akurasi Metrik: </span>
            <span>Untuk hasil pengukuran presisi, pastikan objek dan referensi berada pada <strong className="text-neutral-100">permukaan datar yang sama (koplanar)</strong> dan difoto <strong className="text-neutral-100">tegak lurus dari atas (90°)</strong>.</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          {calib.tilt_warning ? (
            <span className="px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] font-semibold flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3" />
              Kamera Miring (~{calib.tilt_angle_deg}°)
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-full bg-[#181818] border border-[#3a3a3a] text-neutral-300 text-[11px] font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-[#c4c4c4]" />
              {calib.accuracy_grade || 'Tegak lurus'} {calib.tilt_angle_deg != null ? `(Tilt: ${calib.tilt_angle_deg}°)` : ''}
            </span>
          )}
        </div>
      </div>

      {/* Requirement 6: Card Container Kanvas Deteksi Objek */}
      <div className="w-full h-[580px] rounded-2xl bg-[#181818] border border-[#333333] shadow-2xl relative overflow-hidden flex flex-col">
        
        {/* Canvas Header Info & Floating Pill Toolbar */}
        <div className="absolute top-4 left-4 z-20 pointer-events-none flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#202020]/90 backdrop-blur-md border border-[#383838] text-xs text-neutral-300 shadow-lg">
            <MousePointerClick className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-semibold">Klik objek untuk menyorot di tabel</span>
            <span className="text-neutral-600">•</span>
            <span className="text-neutral-400 text-[11px]">Shift+Drag untuk Pan</span>
          </div>
        </div>

        {/* Requirement: Low Confidence / Detection Status Warning Badge */}
        {lowConfidence && (
          <div className="absolute top-14 left-4 z-20 pointer-events-none flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-950/90 backdrop-blur-md border border-amber-500/60 text-amber-200 text-xs shadow-lg">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="font-semibold whitespace-nowrap">
                {detectionMessage
                  ? (detectionStatus === 'low_confidence' && primaryAccuracy != null
                      ? `Akurasi Deteksi Rendah (${Math.round(primaryAccuracy * 100)}%)`
                      : 'Perhatian')
                  : `Akurasi Deteksi Rendah (${Math.round(primaryAccuracy * 100)}%)`}
              </span>
              {detectionMessage ? (
                <span className="text-amber-300/80 text-[11px] hidden sm:inline">
                  — {detectionMessage}
                </span>
              ) : (
                <span className="text-amber-300/80 text-[11px] hidden sm:inline">
                  — Coba foto ulang dengan pencahayaan lebih merata
                </span>
              )}
            </div>
          </div>
        )}

        {/* Requirement 5: Floating Pill Toolbar (Mengambang di Pojok Kanan Atas) */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 p-1.5 rounded-full bg-[#1e1e1e]/90 backdrop-blur-md border border-[#383838] shadow-2xl">
          
          {/* Toggle Clean vs Annotated */}
          <button
            onClick={() => setShowAnnotated(!showAnnotated)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all ${
              showAnnotated ? 'bg-[#2e2e2e] text-[#f5f5f5] border border-[#c4c4c4]/60 shadow-md' : 'text-neutral-400 hover:text-neutral-200'
            }`}
            title="Beralih Gambar Anotasi / Gambar Asli"
          >
            {showAnnotated ? <Eye className="w-3.5 h-3.5 text-[#c4c4c4]" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>{showAnnotated ? 'Anotasi' : 'Asli'}</span>
          </button>

          <span className="w-[1px] h-4 bg-[#383838] mx-0.5"></span>

          {/* Layer toggles */}
          <button
            onClick={() => setShowBBox(!showBBox)}
            className={`p-1.5 rounded-full transition-all ${showBBox ? 'text-cyan-400 bg-cyan-950/80' : 'text-neutral-500 hover:text-neutral-300'}`}
            title="Toggle Bounding Box"
          >
            <CheckSquare className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setShowLabels(!showLabels)}
            className={`p-1.5 rounded-full transition-all ${showLabels ? 'text-amber-400 bg-amber-950/80' : 'text-neutral-500 hover:text-neutral-300'}`}
            title="Toggle Label Dimensi"
          >
            <Tag className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setShowCentroids(!showCentroids)}
            className={`p-1.5 rounded-full transition-all ${showCentroids ? 'text-rose-400 bg-rose-950/80' : 'text-neutral-500 hover:text-neutral-300'}`}
            title="Toggle Titik Pusat (Centroid)"
          >
            <Crosshair className="w-3.5 h-3.5" />
          </button>

          <span className="w-[1px] h-4 bg-[#383838] mx-0.5"></span>

          {/* Zoom In, Badge, Zoom Out, Reset */}
          <button
            onClick={() => setZoom(prev => Math.min(prev + 0.2, 3.5))}
            className="p-1.5 rounded-full text-neutral-300 hover:text-white hover:bg-[#2e2e2e]"
            title="Perbesar (Zoom In)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <span className="text-[11px] font-mono font-bold text-neutral-300 px-2 py-0.5 rounded-full bg-[#282828] border border-[#383838]">
            {Math.round(zoom * 100)}%
          </span>

          <button
            onClick={() => setZoom(prev => Math.max(prev - 0.2, 0.5))}
            className="p-1.5 rounded-full text-neutral-300 hover:text-white hover:bg-[#2e2e2e]"
            title="Perkecil (Zoom Out)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={resetView}
            className="p-1.5 rounded-full text-neutral-300 hover:text-white hover:bg-[#2e2e2e]"
            title="Reset Zoom & Posisi"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Pilih Ulang Objek toggle — only visible when candidates exist */}
          {candidateObjects && candidateObjects.length > 1 && (
            <>
              <span className="w-[1px] h-4 bg-[#383838] mx-0.5"></span>
              <button
                onClick={() => setShowCandidatePanel(p => !p)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all ${
                  showCandidatePanel
                    ? 'bg-violet-600 text-white shadow-md'
                    : 'bg-[#2a2a2a] text-violet-300 border border-violet-700/50 hover:bg-violet-900/40'
                }`}
                title="Tampilkan kandidat objek lain untuk dipilih sebagai pengukuran utama"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Pilih Ulang</span>
                {showCandidatePanel ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </>
          )}
        </div>

        {/* Main Canvas Area with subtle background dot grid */}
        <div 
          ref={containerRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className="flex-1 w-full h-full relative overflow-hidden flex items-center justify-center p-8 cursor-default select-none"
          style={{
            backgroundImage: 'radial-gradient(#2c2c2c 1px, transparent 1px)',
            backgroundSize: '20px 20px'
          }}
        >
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
              transition: isPanning ? 'none' : 'transform 0.12s ease-out'
            }}
            className="relative inline-block shadow-2xl rounded-xl overflow-hidden border border-[#383838] bg-[#121212]"
          >
            {/* Base Image */}
            {imgData.clean_b64 || imgData.annotated_b64 ? (
              <img
                src={showAnnotated ? (imgData.annotated_b64 || imgData.clean_b64) : imgData.clean_b64}
                alt="Deteksi Objek"
                className="block max-h-[490px] w-auto pointer-events-none rounded-xl"
              />
            ) : (
              <div className="w-[780px] h-[480px] bg-[#1f1f1f] flex items-center justify-center text-neutral-500 font-semibold">
                Memuat data visual...
              </div>
            )}

            {/* Requirement 7: Refined SVG Overlays on Top of Image */}
            {imgData.width && imgData.height && (
              <svg
                viewBox={`0 0 ${imgData.width} ${imgData.height}`}
                className="absolute inset-0 w-full h-full pointer-events-auto"
              >
                {/* Calibration Marker Amber Ring */}
                {showCalib && calib.type === 'coin' && calib.center && (
                  <g>
                    <circle
                      cx={calib.center[0]}
                      cy={calib.center[1]}
                      r={(calib.radius_px || 35) + 4}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="3"
                      strokeDasharray="5 5"
                      className="animate-pulse"
                    />
                    {/* Badge Kalibrasi Amber */}
                    <rect
                      x={calib.center[0] - 45}
                      y={calib.center[1] - (calib.radius_px || 35) - 26}
                      width="90"
                      height="20"
                      rx="6"
                      fill="rgba(24, 24, 24, 0.92)"
                      stroke="#f59e0b"
                      strokeWidth="1.5"
                    />
                    <text
                      x={calib.center[0]}
                      y={calib.center[1] - (calib.radius_px || 35) - 12}
                      textAnchor="middle"
                      fill="#f59e0b"
                      fontSize="11"
                      fontWeight="bold"
                      fontFamily="sans-serif"
                    >
                      CALIB: {calib.real_dimension}{unit}
                    </text>
                  </g>
                )}

                {/* Inactive Candidates (clickable dashed outlines when candidate picker is open) */}
                {showCandidatePanel && candidateObjects && candidateObjects.filter(c => (c.candidate_id || c.id) !== primaryObjectId).map(cand => {
                  const cid = cand.candidate_id || cand.id;
                  return (
                    <g
                      key={`cand-overlay-${cid}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectCandidate?.(cid);
                        setShowCandidatePanel(false);
                      }}
                      className="cursor-pointer group/cand"
                    >
                      {cand.polygon && (
                        <polygon
                          points={cand.polygon.map(p => `${p[0]},${p[1]}`).join(' ')}
                          fill="rgba(196, 196, 196, 0.08)"
                          stroke="rgba(196, 196, 196, 0.45)"
                          strokeWidth="1.5"
                          strokeDasharray="4 4"
                          className="group-hover/cand:stroke-[#ffffff] group-hover/cand:stroke-[2.5] group-hover/cand:fill-[#c4c4c4]/25 transition-all"
                        />
                      )}
                    </g>
                  );
                })}

                {/* Primary Target Object Highlighting in #c4c4c4 Neutral */}
                {objects.map(obj => {
                  const isSelected = selectedObjectId === obj.id;
                  const m = obj.measurements || {};
                  
                  // Color #c4c4c4 for primary focused object
                  const objColor = '#c4c4c4';

                  return (
                    <g 
                      key={obj.id} 
                      onClick={(e) => handleObjectClick(obj.id, e)}
                      className="cursor-pointer group"
                    >
                      {/* Polygon Mask */}
                      {showMask && obj.polygon && (
                        <polygon
                          points={obj.polygon.map(p => `${p[0]},${p[1]}`).join(' ')}
                          fill={isSelected ? 'rgba(196, 196, 196, 0.28)' : 'rgba(196, 196, 196, 0.16)'}
                          stroke={objColor}
                          strokeWidth={isSelected ? '3.0' : '2.0'}
                          className="transition-all duration-150 group-hover:fill-white/20 group-hover:stroke-white"
                        />
                      )}

                      {/* Oriented Bounding Box */}
                      {showBBox && obj.min_area_rect?.corners && (
                        <polygon
                          points={obj.min_area_rect.corners.map(p => `${p[0]},${p[1]}`).join(' ')}
                          fill="none"
                          stroke={objColor}
                          strokeWidth={isSelected ? '2.0' : '1.2'}
                          strokeDasharray={isSelected ? 'none' : '4 4'}
                          className="pointer-events-none"
                        />
                      )}

                      {/* Centroid Pin */}
                      {showCentroids && obj.centroid && (
                        <circle
                          cx={obj.centroid[0]}
                          cy={obj.centroid[1]}
                          r={isSelected ? 5.5 : 4}
                          fill={objColor}
                          stroke="#181818"
                          strokeWidth="1.5"
                          className="pointer-events-none shadow-md"
                        />
                      )}

                      {/* Requirement 2: Label Anotasi Objek (#1 • Panjang × Lebar cm) in #c4c4c4 */}
                      {showLabels && obj.centroid && (
                        <g 
                          transform={`translate(${obj.centroid[0]}, ${obj.centroid[1] - 24})`}
                          className="pointer-events-none"
                        >
                          <rect
                            x="-65"
                            y="-14"
                            width="130"
                            height="22"
                            rx="6"
                            fill="rgba(18, 18, 18, 0.92)"
                            stroke={objColor}
                            strokeWidth="1.2"
                          />
                          <text
                            x="0"
                            y="1"
                            textAnchor="middle"
                            fill="#f5f5f5"
                            fontSize="10.5"
                            fontWeight="bold"
                            fontFamily="sans-serif"
                          >
                            #{obj.id} • {m.length ?? 0} × {m.width ?? 0} {unit}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
        </div>
      </div>

      {/* Requirement 4: Candidate Object Picker Panel ("Pilih Ulang Objek") */}
      {showCandidatePanel && candidateObjects && candidateObjects.length > 1 && (
        <div className="w-full rounded-2xl bg-[#181818] border border-[#383838] shadow-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-[#c4c4c4]" />
              <span className="text-sm font-bold text-neutral-200">Pilih Ulang Objek Utama</span>
              <span className="px-2 py-0.5 rounded-full bg-neutral-800 border border-[#383838] text-[#c4c4c4] text-[11px] font-semibold">
                {candidateObjects.length} kandidat terdeteksi
              </span>
            </div>
            <span className="text-[11px] text-neutral-500">Pilih kandidat di bawah atau klik langsung kontur pada gambar</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {candidateObjects.map((cand, idx) => {
              const isCurrentPrimary = (cand.candidate_id ?? cand.id) === primaryObjectId || idx === 0;
              const m = cand.measurements || {};
              const scorePercent = cand.saliency_score != null ? Math.round(cand.saliency_score * 100) : null;
              return (
                <button
                  key={cand.candidate_id ?? cand.id ?? idx}
                  onClick={() => {
                    const cid = cand.candidate_id ?? cand.id ?? idx;
                    onSelectCandidate?.(cid);
                    setShowCandidatePanel(false);
                  }}
                  disabled={isProcessing}
                  className={`relative flex flex-col items-start gap-1.5 p-3 rounded-xl border text-left transition-all ${
                    isCurrentPrimary
                      ? 'bg-neutral-800/90 border-[#c4c4c4] ring-1 ring-[#c4c4c4]/50'
                      : 'bg-[#212121] border-[#333] hover:border-[#c4c4c4]/60 hover:bg-neutral-800/50 cursor-pointer'
                  } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isCurrentPrimary && (
                    <span className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-neutral-700/60 border border-[#c4c4c4]/50 text-[#f5f5f5] text-[10px] font-bold">
                      <Star className="w-2.5 h-2.5 text-[#c4c4c4]" fill="currentColor" /> Aktif
                    </span>
                  )}
                  <span className="text-[11px] font-bold text-neutral-300">Kandidat #{idx + 1}</span>
                  {scorePercent != null && (
                    <div className="w-full">
                      <div className="flex justify-between text-[10px] mb-0.5">
                        <span className="text-neutral-500">Skor Saliency</span>
                        <span className={isCurrentPrimary ? 'text-[#c4c4c4] font-bold' : 'text-neutral-400'}>{scorePercent}%</span>
                      </div>
                      <div className="w-full h-1 rounded-full bg-[#2a2a2a]">
                        <div
                          className={`h-1 rounded-full transition-all ${
                            isCurrentPrimary ? 'bg-[#c4c4c4]' : 'bg-neutral-600'
                          }`}
                          style={{ width: `${scorePercent}%` }}
                        />
                      </div>
                    </div>
                  )}
                  <div className="text-[11px] text-neutral-300 font-mono">
                    {m.length != null ? `${m.length} × ${m.width} ${unit}` : (m.area_cm2 != null ? `Area: ${m.area_cm2} ${unit}²` : '—')}
                  </div>
                  {!isCurrentPrimary && (
                    <span className="text-[10px] text-[#c4c4c4] font-semibold mt-0.5">Klik untuk pilih →</span>
                  )}
                </button>
              );
            })}
          </div>

          <p className="text-[11px] text-neutral-500 mt-1">
            💡 Sistem secara otomatis memilih objek dengan skor gabungan tertinggi (sentral, proporsional, bukan kulit/wajah). Pilih manual jika tebakan otomatis kurang tepat.
          </p>
        </div>
      )}

    </div>
  );
}
