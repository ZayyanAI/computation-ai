import React, { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import SolverPanel from './components/SolverPanel';
import DataTable from './components/DataTable';
import VisionStudio from './components/VisionStudio';
import PresetModal from './components/PresetModal';
import LiveCameraModal from './components/LiveCameraModal';
import ExportModal from './components/ExportModal';
import CaptureConfirmModal from './components/CaptureConfirmModal';
import { apiPath } from './apiConfig';

export default function App() {
  const [activeTab, setActiveTab] = useState('vision'); // 'workflow' | 'vision'
  const [backendStatus, setBackendStatus] = useState('checking');
  const [isProcessing, setIsProcessing] = useState(false);

  const [presets, setPresets] = useState([]);
  const [activePresetId, setActivePresetId] = useState('fruit_sorting');

  const [pipelineResult, setPipelineResult] = useState(null);
  const [pipelineConfig, setPipelineConfig] = useState(null);
  const [flowGraph, setFlowGraph] = useState(null);
  const [selectedObjectId, setSelectedObjectId] = useState(1);
  const [candidateObjects, setCandidateObjects] = useState([]);
  const [primaryObjectId, setPrimaryObjectId] = useState(null);

  // Modals
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
  const [isLiveCameraOpen, setIsLiveCameraOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  const fileInputRef = useRef(null);

  // Pending capture awaiting the user's object-confirmation hint.
  // { type: 'upload', file, previewUrl } | { type: 'frame', frameB64, previewUrl }
  const [pendingCapture, setPendingCapture] = useState(null);

  // Initial load
  useEffect(() => {
    checkHealthAndInit();
  }, []);

  const checkHealthAndInit = async () => {
    try {
      const healthRes = await fetch(apiPath('/api/health'));
      if (healthRes.ok) {
        setBackendStatus('connected');
      } else {
        setBackendStatus('error');
      }

      // Load presets
      const presetsRes = await fetch(apiPath('/api/presets'));
      if (presetsRes.ok) {
        const data = await presetsRes.json();
        setPresets(data.presets || []);
      }

      // Run initial preset
      executePreset('fruit_sorting');
    } catch (err) {
      console.error('Initialization error:', err);
      setBackendStatus('error');
    }
  };

  const executePreset = async (presetId, customConfig = null) => {
    setIsProcessing(true);
    setActivePresetId(presetId);
    try {
      const res = await fetch(apiPath('/api/process/preset'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preset_id: presetId,
          config: customConfig || pipelineConfig || {}
        })
      });

      if (res.ok) {
        const data = await res.json();
        setPipelineResult(data);
        setPipelineConfig(data.pipeline_config);
        setFlowGraph(data.flow_graph);
        setCandidateObjects(data.candidate_objects || []);
        setPrimaryObjectId(data.primary_object_id || null);
        if (data.objects && data.objects.length > 0) {
          setSelectedObjectId(data.objects[0].id);
        }
      }
    } catch (err) {
      console.error('Execute preset error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Update Config from Langflow Node Inspector
  const handleUpdateConfig = async (newConfigPartial) => {
    const updated = { ...(pipelineConfig || {}), ...newConfigPartial };
    setPipelineConfig(updated);

    // Call /api/clarify to refresh node graph
    try {
      const res = await fetch(apiPath('/api/clarify'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: updated.prompt || '',
          current_config: updated
        })
      });
      if (res.ok) {
        const data = await res.json();
        setPipelineConfig(data);
        setFlowGraph(data.flow_graph);
      }
    } catch (err) {
      console.error('Update clarify error:', err);
    }
  };

  const handleApplyPromptPreset = (promptStr) => {
    handleUpdateConfig({ prompt: promptStr });
  };

  // Re-run pipeline with current config
  const handleExecutePipeline = () => {
    executePreset(activePresetId || 'fruit_sorting', pipelineConfig);
  };

  // Handle User File Upload
  const handleUploadFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Read preview as data URL, then ask for an object-confirmation hint before
    // running the detection pipeline (skippable).
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPendingCapture({
        type: 'upload',
        file,
        previewUrl: ev.target.result,
        sourceLabel: 'Upload'
      });
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Run the final pipeline for a captured image using the user's hint (or default
  // when skipped). Applies to both uploaded files and live camera frames.
  const processCapture = async (config) => {
    if (!pendingCapture) return;
    setIsProcessing(true);
    try {
      let data = null;
      if (pendingCapture.type === 'upload') {
        const formData = new FormData();
        formData.append('file', pendingCapture.file);
        formData.append('config', JSON.stringify(config));
        const res = await fetch(apiPath('/api/process/upload'), { method: 'POST', body: formData });
        if (res.ok) data = await res.json();
      } else if (pendingCapture.type === 'frame') {
        const res = await fetch(apiPath('/api/process/frame'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ frame_b64: pendingCapture.frameB64, config })
        });
        if (res.ok) data = await res.json();
      }
      if (data) {
        setPipelineResult(data);
        setPipelineConfig(data.pipeline_config);
        setFlowGraph(data.flow_graph);
        setActivePresetId(null);
        setCandidateObjects(data.candidate_objects || []);
        setPrimaryObjectId(data.primary_object_id || null);
        if (data.objects?.length > 0) setSelectedObjectId(data.objects[0].id);
        setActiveTab('vision');
      }
    } catch (err) {
      console.error('Process capture error:', err);
    } finally {
      setIsProcessing(false);
      setPendingCapture(null);
    }
  };

  // User supplied an optional object hint ("Apa nama benda yang ingin diukur?")
  const handleConfirmCapture = (hint) => {
    const config = {
      ...(pipelineConfig || {}),
      target_object: hint?.target_object || 'benda',
      category: hint?.category || 'general',
      single_object_mode: true,
      object_label: hint?.object_label || ''
    };
    processCapture(config);
  };

  // Skip the hint step and use pure automatic detection
  const handleSkipCapture = () => {
    handleConfirmCapture(null);
  };

  const handleCancelCapture = () => {
    setPendingCapture(null);
  };

  // Handle Live Frame
  const handleAnalyzeFrame = async (frameB64) => {
    const previewUrl = frameB64.startsWith('data:') ? frameB64 : `data:image/jpeg;base64,${frameB64}`;
    setPendingCapture({
      type: 'frame',
      frameB64,
      previewUrl,
      sourceLabel: 'Live Cam'
    });
  };

  // Handle candidate object selection ("Pilih Ulang Objek")
  // Asks backend to re-run pipeline with a forced candidate_id override
  const handleSelectCandidate = async (candidateId) => {
    if (!pipelineResult) return;
    setIsProcessing(true);
    try {
      const config = { ...(pipelineConfig || {}), selected_candidate_id: candidateId, single_object_mode: true };
      let res;
      if (activePresetId) {
        res = await fetch(apiPath('/api/process/preset'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ preset_id: activePresetId, config })
        });
      } else {
        // Re-use the last uploaded image via /api/process/reselect shortcut
        // If no preset, just locally swap the primary from existing candidate list
        const matchedCand = candidateObjects.find(c => c.candidate_id === candidateId || c.id === candidateId);
        if (matchedCand) {
          const updatedObjects = [{ ...matchedCand, id: 1, is_primary: true, label: 'Objek Utama #1' }];
          setPipelineResult(prev => ({ ...prev, objects: updatedObjects }));
          setPrimaryObjectId(candidateId);
          setSelectedObjectId(1);
        }
        setIsProcessing(false);
        return;
      }
      if (res?.ok) {
        const data = await res.json();
        setPipelineResult(data);
        setPipelineConfig(data.pipeline_config);
        setCandidateObjects(data.candidate_objects || []);
        setPrimaryObjectId(data.primary_object_id || null);
        if (data.objects?.length > 0) setSelectedObjectId(data.objects[0].id);
      }
    } catch (err) {
      console.error('Select candidate error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1c1c1c] text-neutral-100 flex flex-col font-sans">
      
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        backendStatus={backendStatus}
        onOpenPresets={() => setIsPresetModalOpen(true)}
        onUploadClick={() => fileInputRef.current?.click()}
        onOpenLiveCamera={() => setIsLiveCameraOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        isProcessing={isProcessing}
      />

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleUploadFile}
        className="hidden"
      />

      {/* Main Views */}
      <main className="flex-1 w-full p-3 lg:p-4 overflow-hidden">
        <div key={activeTab} className="animate-step-fade">
        {activeTab === 'workflow' ? (
          /* TAB 1: AI Equation Solver (SymPy + KaTeX Transparent Steps) */
          <SolverPanel />
        ) : (
          /* TAB 2: Vision Studio & KaTeX Transparency Panel */
          <div className="w-full max-w-[1780px] mx-auto flex flex-col gap-4">
            
            {/* Full Width Vision Studio (Stat Cards & Detection Canvas) */}
            <div className="w-full">
              <VisionStudio
                pipelineResult={pipelineResult}
                selectedObjectId={selectedObjectId}
                onSelectObject={setSelectedObjectId}
                candidateObjects={candidateObjects}
                primaryObjectId={primaryObjectId}
                onSelectCandidate={handleSelectCandidate}
                isProcessing={isProcessing}
              />
            </div>

            {/* Lower Section: Sortable Data Metrics Table & Distribution */}
            <div className="w-full">
              <DataTable
                objects={pipelineResult?.objects || []}
                stats={pipelineResult?.stats || {}}
                unit={pipelineResult?.calibration?.unit || 'cm'}
                selectedObjectId={selectedObjectId}
                onSelectObject={setSelectedObjectId}
              />
            </div>

          </div>
        )}
        </div>
      </main>

      {/* Modals */}
      <PresetModal
        isOpen={isPresetModalOpen}
        onClose={() => setIsPresetModalOpen(false)}
        presets={presets}
        onSelectPreset={(id) => executePreset(id)}
        activePresetId={activePresetId}
      />

      <LiveCameraModal
        isOpen={isLiveCameraOpen}
        onClose={() => setIsLiveCameraOpen(false)}
        onAnalyzeFrame={handleAnalyzeFrame}
        pipelineConfig={pipelineConfig}
      />

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        pipelineResult={pipelineResult}
      />

      {/* Object Confirmation Hint Step — shown after upload / live cam capture,
          before the final detection result is accepted */}
      <CaptureConfirmModal
        isOpen={pendingCapture !== null}
        previewUrl={pendingCapture?.previewUrl}
        sourceLabel={pendingCapture?.sourceLabel}
        isProcessing={isProcessing}
        onConfirm={handleConfirmCapture}
        onSkip={handleSkipCapture}
        onCancel={handleCancelCapture}
      />

    </div>
  );
}
