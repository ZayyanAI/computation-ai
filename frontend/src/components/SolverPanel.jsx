import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { 
  MessageSquare, 
  Cpu, 
  GitBranch, 
  ShieldAlert, 
  PlayCircle, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  Settings2,
  RefreshCw,
  Move,
  Calculator,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Layers,
  FileText,
  Workflow,
  ArrowRight,
  Sliders,
  Eye,
  EyeOff,
  RotateCcw
} from 'lucide-react';
import KatexRenderer from './KatexRenderer';
import { apiPath } from '../apiConfig';

// Category color themes matching LangFlow / Canvas Node aesthetics
const CATEGORY_COLORS = {
  input: { border: 'border-blue-500/50', badge: 'bg-blue-500/20 text-blue-300 border border-blue-500/30', glow: 'shadow-blue-900/30' },
  agent: { border: 'border-purple-500/50', badge: 'bg-purple-500/20 text-purple-300 border border-purple-500/30', glow: 'shadow-purple-900/30' },
  logic: { border: 'border-amber-500/50', badge: 'bg-amber-500/20 text-amber-300 border border-amber-500/30', glow: 'shadow-amber-900/30' },
  config: { border: 'border-cyan-500/50', badge: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30', glow: 'shadow-cyan-900/30' },
  security: { border: 'border-rose-500/50', badge: 'bg-rose-500/20 text-rose-300 border border-rose-500/30', glow: 'shadow-rose-900/30' },
  pipeline: { border: 'border-emerald-400', badge: 'bg-emerald-500/30 text-emerald-200 border border-emerald-500/40', glow: 'shadow-emerald-700/40' },
  engine: { border: 'border-indigo-500/50', badge: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30', glow: 'shadow-indigo-900/30' }
};

const NODE_ICONS = {
  'node-prompt': MessageSquare,
  'node-parser': Cpu,
  'node-classifier': GitBranch,
  'node-guardrail': ShieldAlert,
  'node-solver': Calculator,
  'node-explanation': FileText,
  'node-pipeline-exec': PlayCircle,
};

// Relative layout of the full 7-node flow (topology preserved). Actual node positions
// are computed from the measured canvas size so the graph stays centered horizontally and
// vertically, with node spacing proportional to the available width (not fixed pixels).
const FULL_LAYOUT_REL = [
  { id: 'node-prompt', x: 0, y: 0 },
  { id: 'node-parser', x: 260, y: -120 },
  { id: 'node-classifier', x: 530, y: -120 },
  { id: 'node-guardrail', x: 530, y: 120 },
  { id: 'node-solver', x: 800, y: -120 },
  { id: 'node-explanation', x: 800, y: 120 },
  { id: 'node-pipeline-exec', x: 1080, y: 0 }
];
const FULL_LAYOUT_W = 1310; // rightmost node: x = 1080 + node width 230
const FULL_LAYOUT_H = 410;  // layout bbox height (-120 .. 120 + node height ~170)
const NODE_W = 230;
const COMPACT_NODE_H = 200;

// Intermediate nodes that can be toggled hidden/shown
const HIDDEN_NODE_IDS = [
  'node-parser',
  'node-classifier',
  'node-guardrail',
  'node-solver',
  'node-explanation'
];

// Edges defining the complete pipeline flow:
const GRAPH_EDGES = [
  { id: 'e1', source: 'node-prompt', target: 'node-parser', animated: true },
  { id: 'e2', source: 'node-parser', target: 'node-classifier', animated: true },
  { id: 'e3', source: 'node-classifier', target: 'node-guardrail', animated: true },
  { id: 'e4', source: 'node-guardrail', target: 'node-solver', animated: true },
  { id: 'e5', source: 'node-classifier', target: 'node-solver', animated: true },
  { id: 'e6', source: 'node-solver', target: 'node-explanation', animated: true },
  { id: 'e7', source: 'node-solver', target: 'node-pipeline-exec', animated: true },
  { id: 'e8', source: 'node-explanation', target: 'node-pipeline-exec', animated: true }
];

// Builds the SVG path for a smooth cubic bezier connecting a source socket (right edge
// of a node) to a target socket (left edge). Used identically in compact and full detail
// modes so the edge style stays consistent. A generous minimum bow guarantees every edge
// reads as a smooth curve even when adjacent nodes are close after layout scaling.
const MIN_EDGE_BOW = 100;
function buildEdgePath(srcX, srcY, tgtX, tgtY) {
  const dx = Math.max(MIN_EDGE_BOW, Math.abs(tgtX - srcX) * 0.5);
  return `M ${srcX} ${srcY} C ${srcX + dx} ${srcY}, ${tgtX - dx} ${tgtY}, ${tgtX} ${tgtY}`;
}

// Quick Examples
const QUICK_EXAMPLES = [
  { title: '2x + 4x - 12 = 0', eq: '2x + 4x - 12 = 0', variable: 'x' },
  { title: 'x² - 5x + 6 = 0', eq: 'x^2 - 5x + 6 = 0', variable: 'x' },
  { title: '2^x = 16', eq: '2^x = 16', variable: 'x' },
  { title: '(x²-4)/(x-2)', eq: '(x^2-4)/(x-2)', variable: 'x' },
  { title: '4x - 7 = 21', eq: '4x - 7 = 21', variable: 'x' },
  { title: 'akar dari x = 4', eq: 'akar dari x = 4', variable: 'x' }
];

export default function SolverPanel() {
  const [equation, setEquation] = useState('2x + 4x - 12 = 0');
  const [variable, setVariable] = useState('x');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [latencyMs, setLatencyMs] = useState(null);
  const [copied, setCopied] = useState(false);

  // Canvas Node & Panel State
  // Default showDetailNodes is false (hiding intermediate nodes by default)
  const [showDetailNodes, setShowDetailNodes] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState('node-pipeline-exec');
  const [rightPanelTab, setRightPanelTab] = useState('output'); // 'output' | 'inspector'
  const [drags, setDrags] = useState({}); // nodeId -> { dx, dy } delta from centered base layout
  const [canvasSize, setCanvasSize] = useState({ w: 1280, h: 600 });
  const [canvasMeasured, setCanvasMeasured] = useState(false);
  const [draggingNodeId, setDraggingNodeId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showFullStepsDrawer, setShowFullStepsDrawer] = useState(false);
  const canvasRef = useRef(null);

  // Initial solve on mount
  useEffect(() => {
    handleExecutePipeline('2x + 4x - 12 = 0', 'x');
  }, []);

// Measure the available canvas area so node layouts can be centered on any viewport size.
// useLayoutEffect runs synchronously AFTER the DOM is mounted but BEFORE the browser paints,
// so initial node positions land correctly on the very first frame (no slide from top-left).
useLayoutEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const update = () => setCanvasSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
}, []);

// Enable node drag transitions only after the canvas has been measured & painted.
useEffect(() => {
    setCanvasMeasured(true);
}, []);

  // Centered base positions (recomputed whenever the canvas is resized)
  const basePositions = useMemo(() => {
    const w = Math.max(canvasSize.w, 640);
    const h = Math.max(canvasSize.h, 360);

    // Full mode: spread proportionally across ~72% of canvas width, centered both axes
    const contentW = Math.min(0.72 * w, 1560);
    const scale = Math.max(0.55, contentW / FULL_LAYOUT_W);
    const xOff = Math.max((w - FULL_LAYOUT_W * scale) / 2, 12);
    const yOff = Math.max((h - FULL_LAYOUT_H) / 2, 12);
    const full = {};
    FULL_LAYOUT_REL.forEach((n) => {
      full[n.id] = {
        x: Math.round(xOff + n.x * scale),
        y: Math.round(yOff + n.y)
      };
    });

    // Compact two-node mode: pair centered, gap proportional to available width
    const gap = Math.max(120, Math.min(280, 0.14 * w));
    const pairW = NODE_W * 2 + gap;
    const cPx = Math.max((w - pairW) / 2, 16);
    const cY = Math.max((h - COMPACT_NODE_H) / 2, 24);
    const compact = {
      'node-prompt': { x: Math.round(cPx), y: Math.round(cY) },
      'node-pipeline-exec': { x: Math.round(cPx + NODE_W + gap), y: Math.round(cY) }
    };

    return { full, compact };
  }, [canvasSize]);

  // Helper to get active node coordinates
  const getNodePos = (nodeId) => {
    const base = showDetailNodes
      ? basePositions.full[nodeId] || { x: 0, y: 0 }
      : basePositions.compact[nodeId] || basePositions.full[nodeId] || { x: 0, y: 0 };
    const off = drags[nodeId];
    if (!off) return base;
    return { x: base.x + off.dx, y: base.y + off.dy };
  };

  // Solve execution handler
  const handleExecutePipeline = async (eq = equation, v = variable) => {
    if (!eq.trim()) {
      setError('Silakan masukkan persamaan matematika.');
      return;
    }

    setLoading(true);
    setError(null);
    const startTime = performance.now();

    try {
      const res = await fetch(apiPath('/api/solve-equation'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equation: eq.trim(),
          variable: v.trim() || 'x'
        })
      });

      const elapsed = Math.round(performance.now() - startTime);
      setLatencyMs(elapsed);

      if (!res.ok) {
        throw new Error(`HTTP Error: ${res.status}`);
      }

      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'Gagal memproses persamaan.');
        setResult(null);
      } else {
        setResult(data);
        setError(null);
        // Focus output tab and Solve Pipeline node
        setSelectedNodeId('node-pipeline-exec');
        setRightPanelTab('output');
      }
    } catch (err) {
      console.error('Solve equation error:', err);
      setError('Terjadi kesalahan saat menghubungkan ke mesin komputasi.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  // Node Dragging Handlers
  const handleMouseDown = (nodeId, e) => {
    e.stopPropagation();
    setSelectedNodeId(nodeId);
    if (nodeId === 'node-pipeline-exec') {
      setRightPanelTab('output');
    } else {
      setRightPanelTab('inspector');
    }
    setDraggingNodeId(nodeId);
    const pos = getNodePos(nodeId);
    setDragOffset({
      x: e.clientX - pos.x,
      y: e.clientY - pos.y
    });
  };

  const handleMouseMove = (e) => {
    if (draggingNodeId) {
      const newAbsX = Math.max(0, e.clientX - dragOffset.x);
      const newAbsY = Math.max(0, e.clientY - dragOffset.y);
      const base = showDetailNodes
        ? basePositions.full[draggingNodeId] || { x: 0, y: 0 }
        : basePositions.compact[draggingNodeId] || basePositions.full[draggingNodeId] || { x: 0, y: 0 };
      setDrags(prev => ({
        ...prev,
        [draggingNodeId]: {
          dx: newAbsX - base.x,
          dy: newAbsY - base.y
        }
      }));
    }
  };

  const handleMouseUp = () => {
    setDraggingNodeId(null);
  };

  // Re-center the graph to the centered default layout (discards any manual drags)
  const resetLayout = () => {
    setDrags({});
    canvasRef.current?.scrollTo?.({ left: 0, top: 0, behavior: 'smooth' });
  };

  // Toggle detail modes while resetting to the centered layout each time
  const showDetail = (val) => {
    setShowDetailNodes(val);
    setDrags({});
    if (!val && HIDDEN_NODE_IDS.includes(selectedNodeId)) {
      setSelectedNodeId('node-pipeline-exec');
    }
    canvasRef.current?.scrollTo?.({ left: 0, top: 0, behavior: 'smooth' });
  };

  const handleToggleDetail = () => showDetail(!showDetailNodes);

  const handleCopyLatex = () => {
    if (!result) return;
    const latexText = result.solution_display_latex || result.solutions?.map(s => s.exact_latex).join(', ') || '';
    navigator.clipboard.writeText(latexText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Node Definitions
  const NODES = [
    {
      id: 'node-prompt',
      label: 'User Goal Prompt',
      category: 'input',
      categoryLabel: 'INPUT',
      description: 'Menerima soal matematika dalam teks bebas dari pengguna',
      summary: `"${equation || '2x + 4x - 12 = 0'}"`
    },
    {
      id: 'node-parser',
      label: 'Equation Parser Agent',
      category: 'agent',
      categoryLabel: 'AGENT',
      description: 'Mem-parsing teks menjadi ekspresi matematis (SymPy) dan mendeteksi variabel',
      summary: `Variabel: ${result?.variable || variable || 'x'}`
    },
    {
      id: 'node-classifier',
      label: 'Equation Classifier',
      category: 'logic',
      categoryLabel: 'LOGIC',
      description: 'Mengklasifikasi jenis persamaan',
      summary: `Kategori: ${result?.equation_type || 'Linear / Kuadrat / Eksponensial'}`
    },
    {
      id: 'node-guardrail',
      label: 'Ambiguity Guardrail',
      category: 'security',
      categoryLabel: 'SECURITY',
      description: 'Validasi apakah input adalah persamaan matematika yang valid dan bisa diselesaikan',
      summary: error 
        ? 'Ambigu (Perlu Klarifikasi)' 
        : result 
          ? 'Tervalidasi (Sah)' 
          : 'Validasi Persamaan'
    },
    {
      id: 'node-solver',
      label: 'Solver Engine (SymPy)',
      category: 'engine',
      categoryLabel: 'ENGINE',
      description: 'Menghitung solusi eksak menggunakan symbolic math engine',
      summary: 'Metode: sympy.solve()'
    },
    {
      id: 'node-explanation',
      label: 'Step Explanation Generator',
      category: 'config',
      categoryLabel: 'FORMULA',
      description: 'Menyusun langkah-langkah penyelesaian terstruktur dalam format KaTeX',
      summary: result?.steps ? `Format: LaTeX (${result.steps.length} Tahap)` : 'Format: LaTeX'
    },
    {
      id: 'node-pipeline-exec',
      label: 'Solve Pipeline',
      category: 'pipeline',
      categoryLabel: 'PIPELINE',
      description: 'Menjalankan seluruh alur: Parse → Classify → Solve → Explain',
      summary: latencyMs !== null ? `Total Latensi: ${latencyMs} ms` : 'Status: Siap'
    }
  ];

  // Visible Nodes & Edges depending on showDetailNodes toggle
  const visibleNodes = showDetailNodes 
    ? NODES 
    : NODES.filter(n => n.id === 'node-prompt' || n.id === 'node-pipeline-exec');

  const visibleEdges = showDetailNodes
    ? GRAPH_EDGES
    : [
        {
          id: 'e-direct',
          source: 'node-prompt',
          target: 'node-pipeline-exec',
          animated: true
        }
      ];

  const selectedNode = NODES.find(n => n.id === selectedNodeId) || NODES[0];

  return (
    <div className="w-full flex flex-col xl:flex-row gap-4 h-[calc(100vh-105px)] max-w-[1780px] mx-auto overflow-hidden">
      
      {/* Left / Main Canvas Area */}
      <div className="flex-1 flex flex-col glass-panel overflow-hidden border border-[#333333] relative">
        
        {/* Canvas Toolbar matching reference layout */}
        <div className="flex flex-wrap items-center justify-between px-4 py-2.5 border-b border-[#333333] bg-[#222222]/90 z-10 gap-2">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#c4c4c4] animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-wider text-[#c4c4c4]">
              EQUATION SOLVER BASED ON WORKFLOWS
            </span>
            <span className="text-[11px] text-neutral-400 px-2 py-0.5 rounded bg-[#2a2a2a] border border-[#383838]">
              {visibleNodes.length} Nodes · {visibleEdges.length} {visibleEdges.length > 1 ? 'Edges' : 'Edge'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-400 hidden sm:inline">
              <Move className="w-3 h-3 inline mr-1" /> Geser node untuk tata letak
            </span>

            {/* Toggle Button to Show/Hide Intermediate Pipeline Nodes */}
            <button
              onClick={handleToggleDetail}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                showDetailNodes
                  ? 'bg-[#2a2a2a] hover:bg-[#333333] border-[#c4c4c4]/60 text-[#c4c4c4] shadow-sm'
                  : 'bg-[#242424] hover:bg-[#2c2c2c] border-[#383838] hover:border-neutral-500 text-neutral-300 hover:text-white'
              }`}
              title={showDetailNodes ? 'Sembunyikan 5 node perantara' : 'Tampilkan 5 node perantara di balik layar'}
            >
              {showDetailNodes ? (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Sembunyikan Detail Pipeline</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-[#c4c4c4]" />
                  <span>Tampilkan Detail Pipeline</span>
                </>
              )}
            </button>

            {/* Reset / Re-Center Layout Button */}
            <button
              onClick={resetLayout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#383838] text-neutral-300 hover:text-white hover:bg-[#2a2a2a] transition-all cursor-pointer"
              title="Reset & pusatkan kembali tata letak node"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset Tata Letak</span>
            </button>

            {/* CTA Button: Selesaikan Persamaan */}
            <button
              onClick={() => handleExecutePipeline(equation, variable)}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-[#3f3f3f] hover:bg-[#4d4d4d] text-white text-xs font-bold border border-[#5a5a5a] shadow-lg transition-all disabled:opacity-50 cursor-pointer"
            >
              <PlayCircle className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Menyelesaikan...' : 'Selesaikan Persamaan'}</span>
            </button>
          </div>
        </div>

        {/* Quick Example Chips Bar */}
        <div className="px-4 py-2 bg-[#202020] border-b border-[#2d2d2d] flex flex-wrap items-center gap-2 z-10">
          <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-[#c4c4c4]" /> Contoh Cepat:
          </span>
          {QUICK_EXAMPLES.map((item, idx) => (
            <button
              key={idx}
              onClick={() => {
                setEquation(item.eq);
                setVariable(item.variable);
                setSelectedNodeId('node-prompt');
                handleExecutePipeline(item.eq, item.variable);
              }}
              className="text-[11px] px-2.5 py-1 rounded-md bg-[#282828] hover:bg-[#323232] border border-[#383838] hover:border-[#c4c4c4]/50 text-neutral-300 hover:text-white transition-all font-mono cursor-pointer"
            >
              {item.title}
            </button>
          ))}
        </div>

        {/* Node Graph Interactive Canvas */}
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
          {/* SVG Connection Lines with Dashed & Glowing Green Dots */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none z-0"
            style={{
              minWidth: Math.max(canvasSize.w, NODE_W * 2),
              minHeight: Math.max(canvasSize.h, 320)
            }}
          >
            <defs>
            </defs>

            {visibleEdges.map(edge => {
              const srcPos = getNodePos(edge.source);
              const tgtPos = getNodePos(edge.target);

              const x1 = srcPos.x + 230;
              const y1 = srcPos.y + 55;
              const x2 = tgtPos.x;
              const y2 = tgtPos.y + 55;
              const pathD = buildEdgePath(x1, y1, x2, y2);

              return (
                <g key={edge.id}>
                  {/* Wide soft glow base — solid color, painted on first frame */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="9"
                    strokeOpacity="0.18"
                    strokeLinecap="round"
                  />
                  {/* Mid glow ring */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#0aa5c0"
                    strokeWidth="4.5"
                    strokeOpacity="0.45"
                    strokeLinecap="round"
                  />
                  {/* Active animated dashed line — same dash + glow in compact & full detail */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#22d3ee"
                    strokeWidth="2.4"
                    strokeOpacity="1"
                    strokeDasharray="7 7"
                    strokeLinecap="round"
                    className="node-edge-animated"
                  />
                  {/* Glowing connector dot at source endpoint */}
                  <circle cx={x1} cy={y1} r="7.5" fill="#06b6d4" opacity="0.25" />
                  <circle
                    cx={x1}
                    cy={y1}
                    r="4"
                    fill="#22d3ee"
                    className="drop-shadow-[0_0_6px_rgba(6,182,212,1)]"
                  />
                  {/* Glowing connector dot at target endpoint */}
                  <circle cx={x2} cy={y2} r="7.5" fill="#10b981" opacity="0.25" />
                  <circle
                    cx={x2}
                    cy={y2}
                    r="4"
                    fill="#34d399"
                    className="drop-shadow-[0_0_6px_rgba(16,185,129,1)]"
                  />
                </g>
              );
            })}

          </svg>

          {/* Render Graph Nodes */}
          {visibleNodes.map(node => {
            const pos = getNodePos(node.id);
            const isSelected = selectedNodeId === node.id;
            const IconComp = NODE_ICONS[node.id] || Calculator;
            const colorMeta = CATEGORY_COLORS[node.category] || CATEGORY_COLORS.config;

            // Solve Pipeline specific status styling
            const isPipelineNode = node.id === 'node-pipeline-exec';
            const isPipelineRunning = isPipelineNode && loading;
            const isPipelineDone = isPipelineNode && !loading && result;

            let nodeBorderClass = colorMeta.border;
            let nodeGlowClass = colorMeta.glow;

            if (isPipelineRunning) {
              nodeBorderClass = 'border-emerald-400 ring-4 ring-emerald-500/50';
              nodeGlowClass = 'shadow-[0_0_30px_rgba(16,185,129,0.7)] animate-pulse';
            } else if (isPipelineDone) {
              nodeBorderClass = isSelected ? 'border-emerald-300 ring-2 ring-emerald-400' : 'border-emerald-400/90 ring-1 ring-emerald-500/40';
              nodeGlowClass = 'shadow-[0_0_24px_rgba(16,185,129,0.35)]';
            } else if (isSelected) {
              nodeBorderClass = 'border-[#c4c4c4] ring-2 ring-[#c4c4c4]/40';
            }

            return (
              <div
                key={node.id}
                onMouseDown={(e) => handleMouseDown(node.id, e)}
                style={{
                  transform: `translate(${pos.x}px, ${pos.y}px)`,
                  width: '230px',
                  transition: canvasMeasured ? 'all 200ms' : 'none'
                }}
                className={`absolute cursor-grab active:cursor-grabbing transition-all duration-200 rounded-xl bg-[#252525]/95 backdrop-blur-md border ${nodeBorderClass} shadow-xl ${nodeGlowClass} z-10`}
              >
                {/* Node Header */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-[#333333] bg-[#2a2a2a]/90 rounded-t-xl">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div className={`p-1 rounded-lg bg-neutral-800 ${isPipelineNode ? 'text-emerald-300' : 'text-[#e5e5e5]'}`}>
                      <IconComp className={`w-3.5 h-3.5 ${isPipelineRunning ? 'animate-spin' : ''}`} />
                    </div>
                    <span className="text-xs font-bold text-neutral-100 truncate">{node.label}</span>
                  </div>
                  <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${colorMeta.badge}`}>
                    {node.categoryLabel}
                  </span>
                </div>

                {/* Node Body */}
                <div className="p-3 text-xs space-y-2">
                  <p className="text-[11px] text-neutral-400 line-clamp-2 leading-tight">
                    {node.description}
                  </p>

                  {/* Dynamic Summary Pill */}
                  {node.id === 'node-prompt' && (
                    <div className="p-1.5 rounded bg-[#1e1e1e] border border-[#333333] font-mono text-[10px] text-cyan-300 truncate">
                      "{equation}"
                    </div>
                  )}

                  {node.id === 'node-parser' && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-neutral-400">Variabel:</span>
                      <span className="font-bold text-purple-300 font-mono px-1.5 py-0.5 rounded bg-purple-950/60 border border-purple-800/40">
                        {result?.variable || variable || 'x'}
                      </span>
                    </div>
                  )}

                  {node.id === 'node-classifier' && (
                    <div className="flex flex-col gap-1 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-400">Kategori:</span>
                        <span className="font-bold text-amber-300 text-[10px] px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-800/40 truncate max-w-[130px]">
                          {result?.equation_type || 'Linear / Kuadrat'}
                        </span>
                      </div>
                    </div>
                  )}

                  {node.id === 'node-guardrail' && (
                    <div className="flex items-center gap-1.5 text-[11px]">
                      {error ? (
                        <span className="text-rose-400 flex items-center gap-1 font-semibold text-[10px]">
                          <AlertTriangle className="w-3.5 h-3.5" /> Ambigu (Perlu Klarifikasi)
                        </span>
                      ) : result ? (
                        <span className="text-emerald-400 flex items-center gap-1 font-semibold text-[10px]">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Persamaan Tervalidasi
                        </span>
                      ) : (
                        <span className="text-neutral-400 text-[10px]">Siap Evaluasi</span>
                      )}
                    </div>
                  )}

                  {node.id === 'node-solver' && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-neutral-400">Metode:</span>
                      <span className="font-mono text-cyan-300 text-[10px] px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/40">
                        sympy.solve()
                      </span>
                    </div>
                  )}

                  {node.id === 'node-explanation' && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-neutral-400">Format:</span>
                      <span className="font-mono text-teal-300 text-[10px] px-1.5 py-0.5 rounded bg-teal-950/60 border border-teal-800/40">
                        {result?.steps ? `${result.steps.length} Langkah KaTeX` : 'LaTeX'}
                      </span>
                    </div>
                  )}

                  {/* Solve Pipeline Dynamic Body */}
                  {node.id === 'node-pipeline-exec' && (
                    <div className="space-y-1.5 pt-0.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-neutral-400">Total Latensi:</span>
                        {loading ? (
                          <span className="font-mono text-emerald-300 font-bold animate-pulse">
                            Memproses...
                          </span>
                        ) : (
                          <span className="font-mono text-emerald-300 font-bold bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-800/40">
                            {latencyMs !== null ? `${latencyMs} ms` : '202.54 ms'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-neutral-400">Status:</span>
                        {loading ? (
                          <span className="text-cyan-300 animate-pulse">Eksekusi alur...</span>
                        ) : result ? (
                          <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Solusi Siap
                          </span>
                        ) : (
                          <span className="text-neutral-400">Siap Dijalankan</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Left & Right Socket Connectors */}
                <div className="absolute top-1/2 -left-2 w-3.5 h-3.5 -mt-1.5 rounded-full bg-[#1c1c1c] border-2 border-cyan-400 shadow-md pointer-events-none" />
                <div className={`absolute top-1/2 -right-2 w-3.5 h-3.5 -mt-1.5 rounded-full bg-[#1c1c1c] border-2 ${isPipelineNode ? 'border-emerald-400 ring-2 ring-emerald-500/50' : 'border-emerald-400'} shadow-md pointer-events-none`} />
              </div>
            );
          })}

          {/* Quick inline hint badge on direct edge when in compact mode */}
          {!showDetailNodes && (
            <div
              style={{
                transform: `translate(${((getNodePos('node-prompt').x + 230 + getNodePos('node-pipeline-exec').x) / 2) - 105}px, ${(getNodePos('node-prompt').y + 20)}px)`
              }}
              className="absolute pointer-events-auto z-10"
            >
              <button
                onClick={() => showDetail(true)}
                className="px-3 py-1 rounded-full bg-[#202020]/95 hover:bg-[#2a2a2a] border border-[#383838] hover:border-[#c4c4c4]/60 text-[11px] text-neutral-300 hover:text-[#c4c4c4] transition-all shadow-lg flex items-center gap-1.5 backdrop-blur-md cursor-pointer"
                title="Buka alur transparansi 5 node"
              >
                <Eye className="w-3.5 h-3.5 text-[#c4c4c4]" />
                <span>5 Node Diringkas · Intip Detail</span>
              </button>
            </div>
          )}
        </div>

        {/* Bottom Connected Solution Banner on Canvas */}
        {result && (
          <div className="border-t border-[#333333] bg-[#222222]/95 px-4 py-2.5 z-10 flex flex-wrap items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#2a2a2a] border border-[#c4c4c4]/40 text-[#c4c4c4] text-[11px] font-semibold shrink-0">
                <PlayCircle className="w-3.5 h-3.5 text-[#c4c4c4]" />
                <span>Output Solve Pipeline:</span>
              </div>
              <div className="text-sm font-serif text-[#f3f4f6] truncate max-w-[400px]">
                <KatexRenderer math={result.solution_display_latex} />
              </div>
              {latencyMs !== null && (
                <span className="text-[11px] font-mono text-neutral-400 border-l border-[#3a3a3a] pl-3 shrink-0 hidden sm:inline">
                  Latensi: <strong className="text-[#c4c4c4]">{latencyMs} ms</strong>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setSelectedNodeId('node-pipeline-exec');
                  setRightPanelTab('output');
                }}
                className="flex items-center gap-1.5 text-xs text-neutral-300 hover:text-white px-2.5 py-1 rounded bg-[#2a2a2a] hover:bg-[#333333] border border-[#3d3d3d] transition-colors shrink-0 cursor-pointer"
              >
                <span>Fokus di Panel Kanan</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#c4c4c4]" />
              </button>
              <button
                onClick={() => setShowFullStepsDrawer(!showFullStepsDrawer)}
                className="flex items-center gap-1.5 text-xs text-[#c4c4c4] hover:text-white px-3 py-1 rounded bg-[#2a2a2a] border border-[#3d3d3d] transition-colors shrink-0 cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{showFullStepsDrawer ? 'Tutup Langkah' : 'Buka Semua Langkah'}</span>
                {showFullStepsDrawer ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        )}

        {/* Full Steps Pop-up Drawer */}
        {showFullStepsDrawer && result?.steps && (
          <div className="border-t border-[#383838] bg-[#1a1a1a] p-4 max-h-[260px] overflow-y-auto space-y-3 z-20 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#303030] pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-neutral-200 uppercase tracking-wider">
                  Derivasi Langkah KaTeX Dinamis ({result.steps.length} Tahap)
                </span>
                <span className="text-[10px] font-mono text-[#c4c4c4] bg-[#2a2a2a] px-2 py-0.5 rounded border border-[#c4c4c4]/40">
                  Output Solve Pipeline
                </span>
              </div>
              <button
                onClick={handleCopyLatex}
                className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white px-2 py-0.5 rounded bg-[#252525] border border-[#383838] cursor-pointer"
              >
                {copied ? <Check className="w-3 h-3 text-[#c4c4c4]" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Tersalin' : 'Salin KaTeX'}</span>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {result.steps.map((step, idx) => (
                <div key={idx} className="animate-step-fade bg-[#242424] border border-[#333333] rounded-lg p-3 text-xs space-y-1.5"
                  style={{ animationDelay: `${idx * 70}ms` }}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-neutral-200">{step.step_number}. {step.title}</span>
                  </div>
                  <p className="text-[11px] text-neutral-400 leading-snug">{step.description}</p>
                  {step.latex && (
                    <div className="bg-[#1c1c1c] border border-[#303030] rounded p-2 text-center text-neutral-100 overflow-x-auto">
                      <KatexRenderer math={step.latex} block={true} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Right Sidebar: Dual Tab Inspector & Output Panel */}
      <div className="w-full xl:w-[420px] glass-panel flex flex-col border border-[#333333] overflow-hidden">
        
        {/* Inspector Mode Switcher Tabs */}
        <div className="p-2 border-b border-[#333333] bg-[#222222]/90 flex items-center gap-1.5">
          <button
            onClick={() => setRightPanelTab('output')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              rightPanelTab === 'output'
                ? 'bg-[#2a2a2a] text-[#c4c4c4] border border-[#c4c4c4]/50 shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-[#252525]'
            }`}
          >
            <PlayCircle className="w-3.5 h-3.5 text-[#c4c4c4]" />
            <span>Hasil Solusi Pipeline</span>
            {result && <span className="w-2 h-2 rounded-full bg-[#c4c4c4]" />}
          </button>

          <button
            onClick={() => setRightPanelTab('inspector')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              rightPanelTab === 'inspector'
                ? 'bg-[#2a2a2a] text-[#c4c4c4] border border-[#c4c4c4]/50 shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-[#252525]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-[#c4c4c4]" />
            <span>Parameter Node</span>
          </button>
        </div>

        {/* Panel Content View */}
        <div className="p-4 flex-1 overflow-y-auto space-y-4 text-xs">
          
          {/* VIEW A: Pipeline Output & Step-by-Step KaTeX Derivation */}
{rightPanelTab === 'output' ? (
            <div className="space-y-4">

              {/* Output Header Card connected to Solve Pipeline */}
              <div className="p-3.5 rounded-xl bg-gradient-to-br from-[#242424] to-[#202020] border border-[#c4c4c4]/30 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PlayCircle className="w-4 h-4 text-[#c4c4c4] animate-pulse" />
                    <span className="font-bold text-sm text-neutral-100">Output Solve Pipeline</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#2a2a2a] text-[#c4c4c4] border border-[#c4c4c4]/40 font-bold">
                    node-pipeline-exec
                  </span>
                </div>
                <p className="text-neutral-400 text-xs leading-relaxed">
                  Hasil komputasi simbolik dan langkah-langkah derivasi analitik KaTeX yang diproduksi secara langsung dari alur eksekusi pipeline.
                </p>

                {/* Telemetry Chips */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="p-2 rounded bg-[#1c1c1c]/90 border border-[#333333] flex flex-col">
                    <span className="text-[10px] text-neutral-400">Total Latensi:</span>
                    <span className="font-mono font-bold text-[#c4c4c4] text-xs mt-0.5">
                      {latencyMs !== null ? `${latencyMs} ms` : 'Siap'}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-[#1c1c1c]/90 border border-[#333333] flex flex-col">
                    <span className="text-[10px] text-neutral-400">Taksonomi:</span>
                    <span className="font-bold text-[#c4c4c4] text-xs mt-0.5 truncate">
                      {result?.equation_type || 'Linear / Kuadrat'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Error Box if any */}
              {error && (
                <div className="p-3 rounded-xl bg-[#2d1b1b] border border-[#522525] text-rose-300 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    <span>Pesan Ambigu / Kesalahan:</span>
                  </div>
                  <p className="text-[11px] text-rose-200/90 leading-relaxed">{error}</p>
                </div>
              )}

              {result ? (
                <>
                  {/* Primary Solution Card (Strict Standard Mathematical Notation: x = 4) */}
                  <div className="p-4 rounded-xl bg-[#202020] border border-[#3a3a3a] space-y-2.5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-[#c4c4c4]" />
                        Himpunan Solusi Ditemukan
                      </span>
                      <button
                        onClick={handleCopyLatex}
                        className="text-[11px] flex items-center gap-1 text-neutral-300 hover:text-white px-2 py-0.5 rounded bg-[#282828] border border-[#383838] transition-colors cursor-pointer"
                      >
                        {copied ? <Check className="w-3 h-3 text-[#c4c4c4]" /> : <Copy className="w-3 h-3" />}
                        <span>{copied ? 'Tersalin' : 'Salin KaTeX'}</span>
                      </button>
                    </div>

                    {/* Standard Exact KaTeX Math Notation without duplicate text */}
                    <div className="p-3.5 rounded-lg bg-[#181818] border border-[#353535] text-center overflow-x-auto text-white">
                      <div className="text-lg font-serif">
                        <KatexRenderer math={result.solution_display_latex} />
                      </div>
                    </div>

                    {/* Verification Status & Solution Set Notation */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      {result.solution_set_latex && (
                        <div className="flex items-center gap-1.5 text-[11px] text-neutral-400">
                          <span>Notasi Himpunan:</span>
                          <span className="font-serif text-[#e5e5e5]">
                            <KatexRenderer math={result.solution_set_latex} />
                          </span>
                        </div>
                      )}
                      <span className="flex items-center gap-1 text-[11px] text-[#c4c4c4] bg-[#2a2a2a] border border-[#c4c4c4]/40 px-2 py-0.5 rounded font-medium ml-auto">
                        <CheckCircle2 className="w-3 h-3" /> Terverifikasi
                      </span>
                    </div>
                  </div>

                  {/* Step-by-Step KaTeX Derivation Pipeline */}
                  <div className="space-y-2.5 pt-1">
                    <div className="flex items-center justify-between border-b border-[#303030] pb-2">
                      <span className="text-xs font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-[#c4c4c4]" />
                        Langkah Penyelesaian ({result.steps?.length || 0} Tahap)
                      </span>
                    </div>

                    <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1" key={`steps-${result?.solution_display_latex || ''}`}>
                      {result.steps?.map((step, idx) => (
                        <div
                          key={idx}
                          className="animate-step-fade bg-[#222222] border border-[#333333] rounded-xl p-3 space-y-1.5 hover:border-[#444444] transition-all"
                          style={{ animationDelay: `${idx * 70}ms` }}
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-[#2c2c2c] border border-[#404040] text-[11px] font-bold text-[#e5e5e5] flex items-center justify-center font-mono">
                              {step.step_number}
                            </span>
                            <span className="text-xs font-semibold text-neutral-100">{step.title}</span>
                          </div>

                          <p className="text-[11px] text-neutral-400 leading-relaxed pl-7">
                            {step.description}
                          </p>

                          {step.latex && (
                            <div className="ml-7 mt-1 p-2.5 rounded-lg bg-[#181818] border border-[#303030] text-center text-white overflow-x-auto">
                              <KatexRenderer math={step.latex} block={true} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Quick Action to edit equation */}
                  <button
                    onClick={() => {
                      setSelectedNodeId('node-prompt');
                      setRightPanelTab('inspector');
                    }}
                    className="w-full py-2 rounded-lg bg-[#282828] hover:bg-[#303030] border border-[#3d3d3d] text-neutral-300 hover:text-white font-medium text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-2"
                  >
                    <span>Ubah Soal di User Goal Prompt</span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#c4c4c4]" />
                  </button>
                </>
              ) : (
                <div className="p-8 text-center text-neutral-400 space-y-2">
                  <PlayCircle className="w-8 h-8 text-neutral-500 mx-auto" />
                  <p className="text-xs">Tekan tombol "Selesaikan Persamaan" untuk melihat hasil dan langkah KaTeX.</p>
                </div>
              )}

            </div>
          ) : (
            /* VIEW B: Node Parameter Inspector */
            <div className="space-y-4">
              
              {/* Selected Node Overview Header Card */}
              <div className="p-3.5 rounded-xl bg-[#242424] border border-[#333333] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-neutral-100">{selectedNode.label}</span>
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${CATEGORY_COLORS[selectedNode.category]?.badge || 'bg-neutral-800 text-neutral-300'}`}>
                    {selectedNode.categoryLabel}
                  </span>
                </div>
                <p className="text-neutral-400 text-xs leading-relaxed">
                  {selectedNode.description}
                </p>
              </div>

              {/* Notice when intermediate nodes are hidden */}
              {!showDetailNodes && (
                <div className="p-3 rounded-xl bg-[#202020] border border-[#333333] space-y-2">
                  <div className="flex items-center gap-1.5 text-neutral-300 font-semibold text-xs">
                    <Eye className="w-3.5 h-3.5 text-[#c4c4c4]" />
                    <span>5 Node Perantara Disembunyikan di Kanvas</span>
                  </div>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    Alur parsing, klasifikasi, validasi guardrail, SymPy engine, dan KaTeX generator tetap berjalan aktif secara otomatis.
                  </p>
                  <button
                    onClick={() => showDetail(true)}
                    className="w-full py-1.5 rounded-lg bg-[#2a2a2a] hover:bg-[#333333] border border-[#444444] text-xs font-semibold text-[#c4c4c4] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Tampilkan Seluruh Node di Kanvas</span>
                  </button>
                </div>
              )}

              {/* Error Notice if any */}
              {error && (
                <div className="p-3 rounded-xl bg-[#2d1b1b] border border-[#522525] text-rose-300 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    <span>Pesan Ambigu / Kesalahan:</span>
                  </div>
                  <p className="text-[11px] text-rose-200/90 leading-relaxed">{error}</p>
                </div>
              )}

              {/* 1. User Goal Prompt Node */}
              {selectedNode.id === 'node-prompt' && (
                <div className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                      Instruksi Bebas Pengguna (User Prompt):
                    </label>
                    <textarea
                      value={equation}
                      onChange={(e) => setEquation(e.target.value)}
                      rows={4}
                      placeholder="Contoh: 2x + 4x - 12 = 0 atau 2^x = 16..."
                      className="w-full p-3 rounded-xl bg-[#1a1a1a] border border-[#383838] focus:border-[#c4c4c4] focus:outline-none text-xs text-neutral-100 placeholder-neutral-500 resize-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                      Variabel Target:
                    </label>
                    <div className="grid grid-cols-5 gap-1.5">
                      {['x', 'y', 't', 'z', 'n'].map(v => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => {
                            setVariable(v);
                            if (equation) handleExecutePipeline(equation, v);
                          }}
                          className={`py-1.5 text-xs font-mono font-bold rounded-lg border transition-all cursor-pointer ${
                            variable === v
                              ? 'bg-[#333333] border-[#555555] text-white shadow-sm'
                              : 'bg-[#1c1c1c] border-[#303030] text-neutral-400 hover:text-white'
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => handleExecutePipeline(equation, variable)}
                    disabled={loading}
                    className="w-full py-2.5 rounded-lg bg-[#3f3f3f] hover:bg-[#4d4d4d] text-white font-bold text-xs border border-[#5a5a5a] shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    <span>Proses Ulang Soal</span>
                  </button>
                </div>
              )}

              {/* 2. Equation Parser Agent */}
              {selectedNode.id === 'node-parser' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-[#1a1a1a] border border-[#333333] space-y-2">
                    <span className="text-[11px] text-neutral-400 uppercase tracking-wider block font-semibold">
                      Status Parsing SymPy
                    </span>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-neutral-400">Input Mentah:</span>
                        <span className="font-mono text-neutral-200">{result?.equation_raw || equation}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-neutral-400">Teks Normal:</span>
                        <span className="font-mono text-[#c4c4c4]">{result?.normalized_input || equation}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-neutral-400">Variabel:</span>
                        <span className="font-mono text-purple-300 font-bold">{result?.variable || variable}</span>
                      </div>
                    </div>
                  </div>

                  {result?.equation_latex && (
                    <div className="p-3 rounded-lg bg-[#1a1a1a] border border-[#333333] space-y-1">
                      <span className="text-[11px] text-neutral-400 block">Ekspresi Terurai (KaTeX):</span>
                      <div className="text-sm font-serif text-white py-1">
                        <KatexRenderer math={result.equation_latex} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 3. Equation Classifier */}
              {selectedNode.id === 'node-classifier' && (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-lg bg-[#1a1a1a] border border-[#333333] space-y-2">
                    <span className="text-[11px] text-neutral-400 uppercase tracking-wider block font-semibold">
                      Hasil Klasifikasi Taksonomi
                    </span>
                    <div className="p-2 rounded bg-[#242424] border border-[#3a3a3a] text-center">
                      <span className="text-sm font-bold text-[#c4c4c4]">
                        {result?.equation_type || 'Aljabar / Polinomial'}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-400 leading-relaxed pt-1">
                      Taksonomi persamaan ditentukan oleh analisis derajat polinomial, penempatan variabel (basis vs eksponen), serta bentuk radikal.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-[#1a1a1a] border border-[#333333] space-y-1">
                    <span className="text-[11px] text-neutral-400 block">Bentuk Standar:</span>
                    <div className="text-sm font-serif text-white py-1">
                      <KatexRenderer math={result?.standard_form_latex || 'f(x) = 0'} />
                    </div>
                  </div>
                </div>
              )}

              {/* 4. Ambiguity Guardrail */}
              {selectedNode.id === 'node-guardrail' && (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-lg bg-[#1a1a1a] border border-[#333333] space-y-2">
                    <span className="text-[11px] text-neutral-400 uppercase tracking-wider block font-semibold">
                      Validasi Keabsahan Masukan
                    </span>
                    <div className={`p-2.5 rounded border text-xs font-semibold flex items-center gap-2 ${
                      error 
                        ? 'bg-rose-950/40 border-rose-800/50 text-rose-300' 
                        : result 
                          ? 'bg-[#262626] border-[#c4c4c4]/50 text-[#c4c4c4]' 
                          : 'bg-[#242424] border-[#383838] text-neutral-400'
                    }`}>
                      {error ? (
                        <>
                          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                          <span>Masukan Ambigu: Periksa kembali sintaks persamaan</span>
                        </>
                      ) : result ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-[#c4c4c4] shrink-0" />
                          <span>Masukan Valid: Persamaan matematika sah dan dapat diselesaikan</span>
                        </>
                      ) : (
                        <span>Menunggu validasi masukan...</span>
                      )}
                    </div>
                    <p className="text-[11px] text-neutral-400 leading-relaxed pt-1">
                      Guardrail memvalidasi bahwa input memiliki relasi kesetaraan (=), simbol variabel yang tepat, serta ekspresi yang bebas dari ambiguitas tak berhingga.
                    </p>
                  </div>
                </div>
              )}

              {/* 5. Solver Engine (SymPy) */}
              {selectedNode.id === 'node-solver' && (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-lg bg-[#1a1a1a] border border-[#333333] space-y-2">
                    <span className="text-[11px] text-neutral-400 uppercase tracking-wider block font-semibold">
                      Metode Komputasi Simbolik
                    </span>
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-400">Library:</span>
                      <span className="font-mono text-[#c4c4c4]">SymPy Python Engine</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-400">Fungsi:</span>
                      <span className="font-mono text-[#c4c4c4]">sympy.solve()</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-400">Jumlah Solusi:</span>
                      <span className="font-bold text-white">{result?.solution_count ?? 0}</span>
                    </div>
                  </div>

                  {result && (
                    <div className="p-3.5 rounded-lg bg-[#1a1a1a] border border-[#333333] space-y-2">
                      <span className="text-[11px] text-neutral-400 block font-semibold">Himpunan Solusi:</span>
                      <div className="text-base font-serif text-white py-1 bg-[#242424] rounded-lg p-2 border border-[#383838]">
                        <KatexRenderer math={result.solution_display_latex} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 6. Step Explanation Generator */}
              {selectedNode.id === 'node-explanation' && (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-lg bg-[#1a1a1a] border border-[#333333] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-neutral-400 uppercase tracking-wider font-semibold">
                        Langkah Penyelesaian Terstruktur
                      </span>
                      <span className="text-xs font-mono text-[#c4c4c4]">
                        {result?.steps?.length || 0} Tahap
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-400 leading-relaxed">
                      Menyusun langkah-langkah penyelesaian matematis analitik dalam notasi KaTeX yang transparan.
                    </p>
                  </div>

                  {result?.steps && (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1" key={`steps-${result?.solution_display_latex || ''}`}>
                      {result.steps.map((step, idx) => (
                        <div key={idx} className="animate-step-fade p-2.5 rounded-lg bg-[#1e1e1e] border border-[#303030] space-y-1 text-xs"
                          style={{ animationDelay: `${idx * 70}ms` }}>
                          <div className="font-semibold text-neutral-200 flex items-center gap-1.5">
                            <span className="w-4 h-4 rounded-full bg-[#2a2a2a] text-[10px] text-white flex items-center justify-center font-mono">
                              {step.step_number}
                            </span>
                            <span>{step.title}</span>
                          </div>
                          {step.latex && (
                            <div className="text-center py-1 bg-[#262626] rounded border border-[#353535]">
                              <KatexRenderer math={step.latex} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 7. Solve Pipeline Node Inspector */}
              {selectedNode.id === 'node-pipeline-exec' && (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-lg bg-[#1a1a1a] border border-[#333333] space-y-2">
                    <span className="text-[11px] text-neutral-400 uppercase tracking-wider block font-semibold">
                      Ringkasan Parameter Solve Pipeline
                    </span>
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-400">Total Latensi:</span>
                      <span className="font-mono text-[#c4c4c4] font-bold">
                        {latencyMs !== null ? `${latencyMs} ms` : 'Siap'}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-400">Status Alur:</span>
                      <span className="text-[#c4c4c4] font-bold">
                        {result ? 'Berhasil Dieksekusi' : 'Siap'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => setRightPanelTab('output')}
                    className="w-full py-2.5 rounded-lg bg-[#3f3f3f] hover:bg-[#4d4d4d] text-white font-bold text-xs border border-[#5a5a5a] shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <PlayCircle className="w-3.5 h-3.5" />
                    <span>Lihat Himpunan Solusi & Langkah Lengkap</span>
                  </button>
                </div>
              )}

            </div>
          )}

        </div>

      </div>

    </div>
  );
}
