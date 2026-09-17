import React, { useState, useRef, useEffect } from 'react';
import { 
  MessageSquare, 
  Cpu, 
  GitBranch, 
  Scale, 
  Compass, 
  ShieldAlert, 
  PlayCircle, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  Settings2,
  RefreshCw,
  Info,
  Maximize2,
  Move
} from 'lucide-react';
import KatexRenderer from './KatexRenderer';

const NODE_ICONS = {
  inputNode: MessageSquare,
  agentNode: Cpu,
  decisionNode: GitBranch,
  configNode: Scale,
  strategyNode: Compass,
  guardrailNode: ShieldAlert,
  outputNode: PlayCircle,
};

const CATEGORY_COLORS = {
  input: { border: 'border-blue-500/50', badge: 'bg-blue-500/20 text-blue-300', glow: 'shadow-blue-900/30' },
  agent: { border: 'border-purple-500/50', badge: 'bg-purple-500/20 text-purple-300', glow: 'shadow-purple-900/30' },
  logic: { border: 'border-amber-500/50', badge: 'bg-amber-500/20 text-amber-300', glow: 'shadow-amber-900/30' },
  config: { border: 'border-cyan-500/50', badge: 'bg-cyan-500/20 text-cyan-300', glow: 'shadow-cyan-900/30' },
  calibration: { border: 'border-emerald-500/50', badge: 'bg-emerald-500/20 text-emerald-300', glow: 'shadow-emerald-900/30' },
  security: { border: 'border-rose-500/50', badge: 'bg-rose-500/20 text-rose-300', glow: 'shadow-rose-900/30' },
  pipeline: { border: 'border-emerald-400', badge: 'bg-emerald-500/30 text-emerald-200', glow: 'shadow-emerald-700/40' },
};

export default function LangflowWorkflow({
  flowGraph,
  pipelineConfig,
  onUpdateConfig,
  onExecutePipeline,
  isProcessing,
  timings,
  onApplyPromptPreset
}) {
  const [selectedNodeId, setSelectedNodeId] = useState('node-prompt');
  const [nodePositions, setNodePositions] = useState({});
  const [draggingNodeId, setDraggingNodeId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [promptText, setPromptText] = useState(pipelineConfig?.prompt || '');
  const canvasRef = useRef(null);

  // Initialize node positions from graph definition
  useEffect(() => {
    if (flowGraph?.nodes) {
      const posMap = {};
      flowGraph.nodes.forEach(node => {
        posMap[node.id] = { ...node.position };
      });
      setNodePositions(posMap);
    }
  }, [flowGraph]);

  useEffect(() => {
    if (pipelineConfig?.prompt) {
      setPromptText(pipelineConfig.prompt);
    }
  }, [pipelineConfig?.prompt]);

  // Handle Dragging
  const handleMouseDown = (nodeId, e) => {
    e.stopPropagation();
    setSelectedNodeId(nodeId);
    setDraggingNodeId(nodeId);
    const pos = nodePositions[nodeId] || { x: 0, y: 0 };
    setDragOffset({
      x: e.clientX - pos.x,
      y: e.clientY - pos.y
    });
  };

  const handleMouseMove = (e) => {
    if (draggingNodeId) {
      setNodePositions(prev => ({
        ...prev,
        [draggingNodeId]: {
          x: Math.max(10, e.clientX - dragOffset.x),
          y: Math.max(10, e.clientY - dragOffset.y)
        }
      }));
    }
  };

  const handleMouseUp = () => {
    setDraggingNodeId(null);
  };

  const nodes = flowGraph?.nodes || [];
  const edges = flowGraph?.edges || [];
  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  // Prompt Templates
  const PROMPT_PRESETS = [
    { title: "Sortir Apel & Jeruk", prompt: "Hitung buah apel dan jeruk, ukur diameter dan volume dalam cm pakai koin 500 IDR." },
    { title: "Paket Kardus Gudang", prompt: "Ukur panjang, lebar, dan volume paket kardus dalam cm dengan kartu referensi." },
    { title: "Cacah Sel Mikroskopis", prompt: "Hitung semua sel mikroskopis dan estimasi densitas per mm2." },
    { title: "Inspeksi Mur & Baut", prompt: "Hitung dan ukur dimensi mur dan baut menggunakan ArUco marker dalam mm." }
  ];

  return (
    <div className="w-full flex flex-col xl:flex-row gap-4 h-[calc(100vh-80px)] p-4 max-w-[1780px] mx-auto overflow-hidden">
      
      {/* Left / Main: Langflow Visual Canvas */}
      <div className="flex-1 flex flex-col glass-panel overflow-hidden border border-[#333333] relative">
        
        {/* Canvas Toolbar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#333333] bg-[#222222]/80 z-10">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></div>
            <span className="text-xs font-semibold uppercase tracking-wider text-cyan-300">Stage 0: Clarification & Orchestration Flow</span>
            <span className="text-[11px] text-neutral-400 px-2 py-0.5 rounded bg-[#2a2a2a] border border-[#383838]">
              {nodes.length} Nodes • {edges.length} Edges
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-400 hidden sm:inline">
              <Move className="w-3 h-3 inline mr-1" /> Geser node untuk menyesuaikan tata letak
            </span>
            <button
              onClick={() => onExecutePipeline()}
              disabled={isProcessing}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/50 transition-all disabled:opacity-50"
            >
              <PlayCircle className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
              <span>{isProcessing ? 'Memproses Pipeline...' : 'Jalankan Pipeline (Stage 1-7)'}</span>
            </button>
          </div>
        </div>

        {/* Quick Prompt Bar above Canvas */}
        <div className="px-4 py-2 bg-[#202020] border-b border-[#2d2d2d] flex flex-wrap items-center gap-2 z-10">
          <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" /> Contoh Cepat:
          </span>
          {PROMPT_PRESETS.map((p, idx) => (
            <button
              key={idx}
              onClick={() => {
                setPromptText(p.prompt);
                onApplyPromptPreset(p.prompt);
              }}
              className="text-[11px] px-2.5 py-1 rounded-md bg-[#282828] hover:bg-[#323232] border border-[#383838] hover:border-cyan-500/50 text-neutral-300 hover:text-white transition-all"
            >
              {p.title}
            </button>
          ))}
        </div>

        {/* Node Graph Canvas Area */}
        <div 
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className="flex-1 relative overflow-auto bg-[#191919] select-none"
          style={{
            backgroundImage: 'radial-gradient(#303030 1px, transparent 1px)',
            backgroundSize: '24px 24px'
          }}
        >
          {/* SVG Connection Lines */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0 min-w-[1200px] min-h-[700px]">
            <defs>
              <linearGradient id="gradCyan" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.8" />
              </linearGradient>
            </defs>
            {edges.map(edge => {
              const srcPos = nodePositions[edge.source] || { x: 0, y: 0 };
              const tgtPos = nodePositions[edge.target] || { x: 0, y: 0 };
              
              // Approximate sockets: Source right edge, Target left edge
              const x1 = srcPos.x + 220;
              const y1 = srcPos.y + 55;
              const x2 = tgtPos.x;
              const y2 = tgtPos.y + 55;
              const dx = Math.max(40, Math.abs(x2 - x1) * 0.45);
              const pathD = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

              return (
                <g key={edge.id}>
                  {/* Subtle background glow line */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="4"
                    strokeOpacity="0.15"
                  />
                  {/* Active animated wire */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke="url(#gradCyan)"
                    strokeWidth="2.2"
                    className={edge.animated ? 'node-edge-animated' : ''}
                  />
                </g>
              );
            })}
          </svg>

          {/* Render Graph Nodes */}
          {nodes.map(node => {
            const pos = nodePositions[node.id] || node.position;
            const isSelected = selectedNodeId === node.id;
            const IconComp = NODE_ICONS[node.type] || MessageSquare;
            const colorMeta = CATEGORY_COLORS[node.data.category] || CATEGORY_COLORS.config;

            return (
              <div
                key={node.id}
                onMouseDown={(e) => handleMouseDown(node.id, e)}
                style={{
                  transform: `translate(${pos.x}px, ${pos.y}px)`,
                  width: '230px'
                }}
                className={`absolute cursor-grab active:cursor-grabbing transition-shadow duration-150 rounded-xl bg-[#252525]/95 backdrop-blur-md border ${
                  isSelected ? 'border-cyan-400 ring-2 ring-cyan-500/30' : colorMeta.border
                } shadow-xl ${colorMeta.glow} z-10`}
              >
                {/* Node Header */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-[#333333] bg-[#2a2a2a]/90 rounded-t-xl">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div className="p-1 rounded-lg bg-neutral-800 text-cyan-300">
                      <IconComp className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold text-neutral-100 truncate">{node.data.label}</span>
                  </div>
                  <span className={`text-[9px] uppercase font-bold px-1.5 py-0.2 rounded ${colorMeta.badge}`}>
                    {node.data.category}
                  </span>
                </div>

                {/* Node Body / Value Summary */}
                <div className="p-3 text-xs space-y-2">
                  <p className="text-[11px] text-neutral-400 line-clamp-2 leading-tight">
                    {node.data.description}
                  </p>

                  {/* Dynamic summary pill based on node */}
                  {node.id === 'node-prompt' && (
                    <div className="p-1.5 rounded bg-[#1e1e1e] border border-[#333333] font-mono text-[10px] text-cyan-300 truncate">
                      "{pipelineConfig?.prompt || 'Hitung buah...'}"
                    </div>
                  )}

                  {node.id === 'node-extractor' && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-neutral-400">Target:</span>
                      <span className="font-bold text-purple-300 uppercase px-1.5 py-0.5 rounded bg-purple-950/60 border border-purple-800/40">
                        {pipelineConfig?.target_object || 'buah'}
                      </span>
                    </div>
                  )}

                  {node.id === 'node-mode' && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-neutral-400">Mode:</span>
                      <span className="font-bold text-amber-300 uppercase px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-800/40">
                        {pipelineConfig?.mode || 'both'}
                      </span>
                    </div>
                  )}

                  {node.id === 'node-unit' && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-neutral-400">Satuan:</span>
                      <span className="font-bold text-cyan-300 font-mono px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/40">
                        {pipelineConfig?.unit || 'cm'}
                      </span>
                    </div>
                  )}

                  {node.id === 'node-calibration' && (
                    <div className="space-y-1 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-400">Tipe:</span>
                        <span className="text-emerald-300 font-semibold">{pipelineConfig?.calibration_type || 'coin_idr500'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-400">Ref:</span>
                        <span className="text-neutral-200 font-mono">{pipelineConfig?.reference_real_size_mm || 27} mm</span>
                      </div>
                    </div>
                  )}

                  {node.id === 'node-guardrail' && (
                    <div className="flex items-center gap-1.5 text-[11px]">
                      {pipelineConfig?.is_ambiguous ? (
                        <span className="text-amber-400 flex items-center gap-1 font-semibold">
                          <AlertTriangle className="w-3.5 h-3.5" /> Ambigu (Perlu Klarifikasi)
                        </span>
                      ) : (
                        <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Konfigurasi Tervalidasi
                        </span>
                      )}
                    </div>
                  )}

                  {node.id === 'node-pipeline-exec' && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-neutral-400">Total Latensi:</span>
                      <span className="font-mono text-emerald-300 font-bold">
                        {timings?.total_pipeline_ms ? `${timings.total_pipeline_ms} ms` : 'Ready'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Sockets */}
                <div className="absolute top-1/2 -left-2 w-3.5 h-3.5 -mt-1.5 rounded-full bg-[#1c1c1c] border-2 border-cyan-400 shadow-md"></div>
                <div className="absolute top-1/2 -right-2 w-3.5 h-3.5 -mt-1.5 rounded-full bg-[#1c1c1c] border-2 border-emerald-400 shadow-md"></div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Sidebar: Node Inspector & Config Editor */}
      <div className="w-full xl:w-[380px] glass-panel flex flex-col border border-[#333333] overflow-hidden">
        
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#333333] bg-[#222222]/90 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-200">Node Parameter Inspector</h3>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#2a2a2a] text-neutral-400 border border-[#383838]">
            {selectedNode?.id || 'Pilih Node'}
          </span>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 overflow-y-auto space-y-4 text-xs">
          {selectedNode ? (
            <>
              {/* Selected Node Header */}
              <div className="p-3 rounded-xl bg-[#242424] border border-[#333333] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-neutral-100">{selectedNode.data.label}</span>
                  <span className="text-[10px] uppercase font-bold text-cyan-400 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/40">
                    {selectedNode.data.category}
                  </span>
                </div>
                <p className="text-neutral-400 text-xs">{selectedNode.data.description}</p>
              </div>

              {/* Node-Specific Parameter Controls */}

              {/* Prompt Node Editor */}
              {selectedNode.id === 'node-prompt' && (
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-neutral-300">
                    Instruksi Bebas Pengguna (User Prompt):
                  </label>
                  <textarea
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                    rows={4}
                    placeholder="Contoh: Hitung apel dan jeruk dalam cm pakai koin 500 sebagai referensi..."
                    className="w-full p-3 rounded-xl bg-[#1a1a1a] border border-[#383838] focus:border-cyan-500 focus:outline-none text-xs text-neutral-100 placeholder-neutral-500 resize-none font-mono"
                  />
                  <button
                    onClick={() => onUpdateConfig({ prompt: promptText })}
                    className="w-full py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Urai & Perbarui Node Workflow</span>
                  </button>
                </div>
              )}

              {/* Target Extractor Node Editor */}
              {selectedNode.id === 'node-extractor' && (
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-neutral-300">Target Objek Deteksi:</label>
                  <input
                    type="text"
                    value={pipelineConfig?.target_object || ''}
                    onChange={(e) => onUpdateConfig({ target_object: e.target.value })}
                    className="w-full p-2.5 rounded-lg bg-[#1a1a1a] border border-[#383838] focus:border-purple-500 text-xs text-purple-300 font-bold"
                  />
                  <label className="block text-xs font-semibold text-neutral-300 mt-2">Kategori:</label>
                  <select
                    value={pipelineConfig?.category || 'general'}
                    onChange={(e) => onUpdateConfig({ category: e.target.value })}
                    className="w-full p-2.5 rounded-lg bg-[#1a1a1a] border border-[#383838] text-xs text-neutral-200"
                  >
                    <option value="fruit">Buah / Pertanian (Fruit)</option>
                    <option value="box">Paket Kardus / Logistik (Box)</option>
                    <option value="cell">Sel / Riset Medis (Microscopic Cell)</option>
                    <option value="part">Komponen Industri (Screws & Washers)</option>
                    <option value="vehicle">Kendaraan / Transportasi</option>
                    <option value="general">Umum / Semua Objek (General)</option>
                  </select>
                </div>
              )}

              {/* Task Mode Router */}
              {selectedNode.id === 'node-mode' && (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-neutral-300">Pilihan Mode Operasi:</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['count', 'measure', 'both'].map(mode => (
                      <button
                        key={mode}
                        onClick={() => onUpdateConfig({ mode })}
                        className={`p-2 rounded-lg text-center font-bold text-xs capitalize transition-all ${
                          pipelineConfig?.mode === mode
                            ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                            : 'bg-[#252525] border border-[#383838] text-neutral-300 hover:bg-[#303030]'
                        }`}
                      >
                        {mode === 'count' ? 'Hitung Saja' : mode === 'measure' ? 'Ukur Saja' : 'Keduanya'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Unit Normalizer */}
              {selectedNode.id === 'node-unit' && (
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-neutral-300">Satuan Dimensi Fisik:</label>
                  <div className="grid grid-cols-4 gap-2">
                    {['mm', 'cm', 'in', 'm'].map(u => (
                      <button
                        key={u}
                        onClick={() => onUpdateConfig({ unit: u })}
                        className={`p-2.5 rounded-lg font-mono font-bold text-xs uppercase transition-all ${
                          pipelineConfig?.unit === u
                            ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20'
                            : 'bg-[#252525] border border-[#383838] text-neutral-300 hover:bg-[#303030]'
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                  <div className="p-3 rounded-lg bg-[#1d1d1d] border border-[#333333] flex items-center justify-between">
                    <span className="text-neutral-400">Formula KaTeX:</span>
                    <KatexRenderer math={`\\text{Satuan: } \\text{${pipelineConfig?.unit || 'cm'}}`} />
                  </div>
                </div>
              )}

              {/* Calibration Strategy */}
              {selectedNode.id === 'node-calibration' && (
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-neutral-300">Metode Referensi Kalibrasi:</label>
                  <select
                    value={pipelineConfig?.calibration_type || 'coin_idr500'}
                    onChange={(e) => onUpdateConfig({ calibration_type: e.target.value })}
                    className="w-full p-2.5 rounded-lg bg-[#1a1a1a] border border-[#383838] text-xs text-emerald-300 font-semibold"
                  >
                    <option value="coin_idr500">Koin 500 IDR (Aluminium, 27.0 mm)</option>
                    <option value="coin_quarter">US Quarter Coin (24.26 mm)</option>
                    <option value="credit_card">Standard ID / Credit Card (85.60 mm)</option>
                    <option value="aruco">ArUco Marker 4x4 (50.0 mm)</option>
                    <option value="manual_ruler">Interactive 2-Point Manual Line</option>
                  </select>

                  <div className="space-y-1">
                    <label className="block text-[11px] text-neutral-400">Ukuran Referensi Nyata (mm):</label>
                    <input
                      type="number"
                      step="0.1"
                      value={pipelineConfig?.reference_real_size_mm || 27.0}
                      onChange={(e) => onUpdateConfig({ reference_real_size_mm: parseFloat(e.target.value) || 27.0 })}
                      className="w-full p-2 rounded-lg bg-[#1a1a1a] border border-[#383838] text-xs font-mono text-neutral-200"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] text-neutral-400">Model Estimasi Volume 3D:</label>
                    <select
                      value={pipelineConfig?.volume_model || 'ellipsoid'}
                      onChange={(e) => onUpdateConfig({ volume_model: e.target.value })}
                      className="w-full p-2 rounded-lg bg-[#1a1a1a] border border-[#383838] text-xs text-neutral-200"
                    >
                      <option value="ellipsoid">Elipsoid (Buah, Telur, Sel Darah)</option>
                      <option value="cylinder">Silinder (Botol, Kapsul, Baut)</option>
                      <option value="box">Balok / Box (Paket Kardus Gudang)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Ambiguity Guardrail */}
              {selectedNode.id === 'node-guardrail' && (
                <div className="space-y-3">
                  {pipelineConfig?.clarification_questions?.length > 0 ? (
                    <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-600/40 space-y-2">
                      <div className="flex items-center gap-1.5 text-amber-300 font-bold text-xs">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Pertanyaan Klarifikasi Diperlukan:</span>
                      </div>
                      {pipelineConfig.clarification_questions.map((q, idx) => (
                        <div key={idx} className="space-y-1 pt-2 border-t border-amber-900/40">
                          <p className="text-[11px] text-amber-200">{q.question}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {q.options?.map((opt, oIdx) => (
                              <button
                                key={oIdx}
                                onClick={() => {
                                  if (q.field === 'calibration_type') {
                                    if (opt.includes('Koin')) onUpdateConfig({ calibration_type: 'coin_idr500', is_ambiguous: false });
                                    else if (opt.includes('Kartu')) onUpdateConfig({ calibration_type: 'credit_card', is_ambiguous: false });
                                    else if (opt.includes('ArUco')) onUpdateConfig({ calibration_type: 'aruco', is_ambiguous: false });
                                    else onUpdateConfig({ calibration_type: 'manual_ruler', is_ambiguous: false });
                                  }
                                }}
                                className="text-[10px] px-2 py-0.5 rounded bg-amber-900/60 hover:bg-amber-800 text-amber-100 border border-amber-700/50"
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-600/40 text-emerald-300 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Semua parameter valid. Siap dieksekusi tanpa ambiguitas!</span>
                    </div>
                  )}
                </div>
              )}

              {/* Pipeline Exec Node */}
              {selectedNode.id === 'node-pipeline-exec' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-[#1e1e1e] border border-[#333333] space-y-2">
                    <span className="font-semibold text-neutral-300">Tahapan Pipeline:</span>
                    <ol className="space-y-1 text-[11px] text-neutral-400 list-decimal list-inside">
                      <li>Input Frame Preprocessing</li>
                      <li>Deteksi Objek Kalibrasi & Skala</li>
                      <li>Segmentasi & Rotated Bounding Box</li>
                      <li>Kalkulasi Metrik & Model Geometri</li>
                      <li>Translasi KaTeX Formula Step-by-step</li>
                      <li>Agregasi Statistik & Densitas</li>
                      <li>Anotasi Gambar & Ekspor Laporan</li>
                    </ol>
                  </div>
                  <button
                    onClick={() => onExecutePipeline()}
                    disabled={isProcessing}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold text-xs shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2"
                  >
                    <PlayCircle className="w-4 h-4" />
                    <span>Jalankan Sekarang</span>
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-neutral-500">
              <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Klik salah satu node pada canvas untuk mengedit parameter.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
