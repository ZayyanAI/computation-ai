import React, { useRef, useState, useEffect } from 'react';
import { X, Camera, RefreshCw, CheckCircle2, AlertCircle, Play, Pause } from 'lucide-react';

export default function LiveCameraModal({
  isOpen,
  onClose,
  onAnalyzeFrame,
  pipelineConfig
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch (err) {
      console.error('Camera access error:', err);
      setErrorMsg('Tidak dapat mengakses webcam: ' + err.message);
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const captureFrame = () => {
    if (!videoRef.current) return;
    setIsCapturing(true);

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const base64Data = canvas.toDataURL('image/jpeg', 0.92);
    onAnalyzeFrame(base64Data);
    setIsCapturing(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-3xl rounded-2xl bg-[#222222] border border-[#383838] shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#333333] flex items-center justify-between bg-[#262626]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-100">Live Camera Feed (Webcam)</h3>
              <p className="text-xs text-neutral-400">Ambil frame langsung dari kamera Anda untuk dihitung & diukur</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-[#333333]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video View */}
        <div className="p-6 flex flex-col items-center justify-center bg-[#181818] min-h-[380px] relative">
          {errorMsg ? (
            <div className="text-center p-6 space-y-3">
              <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
              <p className="text-sm text-rose-300 font-semibold">{errorMsg}</p>
              <button
                onClick={startCamera}
                className="px-4 py-2 rounded-lg bg-neutral-800 text-neutral-200 text-xs font-bold hover:bg-neutral-700"
              >
                Coba Lagi
              </button>
            </div>
          ) : (
            <div className="relative rounded-xl overflow-hidden border border-[#333333] shadow-lg max-w-full">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="max-h-[460px] w-auto block bg-black"
              />
              {/* Target Reticle Overlay */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-48 h-48 border border-dashed border-cyan-400/40 rounded-lg"></div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-[#202020] border-t border-[#333333] flex items-center justify-between">
          <div className="text-xs text-neutral-400">
            Pastikan objek target dan objek referensi (mis. koin 500 IDR) berada dalam frame.
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-[#2c2c2c] hover:bg-[#363636] text-xs font-semibold text-neutral-300"
            >
              Batal
            </button>
            <button
              onClick={captureFrame}
              disabled={!cameraActive || isCapturing}
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white text-xs font-bold shadow-lg shadow-emerald-950/50 flex items-center gap-2 disabled:opacity-50"
            >
              <Camera className="w-4 h-4" />
              <span>Ambil Frame & Hitung</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
