import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, Upload, AlertCircle, Check } from 'lucide-react';

interface AbsenCameraProps {
  onCapture: (base64Image: string) => void;
  onCancel: () => void;
}

export default function AbsenCamera({ onCapture, onCancel }: AbsenCameraProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraState, setCameraState] = useState<'requesting' | 'active' | 'error' | 'fallback'>('requesting');
  const [errorMessage, setErrorMessage] = useState('');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  // Initialize camera
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    setCameraState('requesting');
    setErrorMessage('');
    setCapturedImage(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Browser tidak mendukung akses kamera langsung.');
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraState('active');
    } catch (err: any) {
      console.warn('Gagal memuat kamera: ', err);
      setCameraState('fallback');
      setErrorMessage(err.message || 'Gagal mengakses kamera. Silakan unggah foto secara manual.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Mirror the image for selfie natural look
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Reset transform
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        
        const base64 = canvas.toDataURL('image/jpeg', 0.85);
        setCapturedImage(base64);
        stopCamera();
      }
    } catch (err: any) {
      setErrorMessage('Gagal menangkap gambar: ' + err.message);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setCapturedImage(reader.result as string);
      stopCamera();
      setCameraState('fallback');
    };
    reader.readAsDataURL(file);
  };

  const handleConfirm = () => {
    if (capturedImage) {
      onCapture(capturedImage);
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    startCamera();
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Viewport Container */}
      <div className="relative w-full max-w-sm aspect-video sm:aspect-square bg-slate-900 rounded-2xl overflow-hidden border-2 border-slate-700 shadow-inner flex items-center justify-center">
        {capturedImage ? (
          <img 
            src={capturedImage} 
            alt="Foto Absen" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <>
            {cameraState === 'requesting' && (
              <div className="text-center text-slate-400 p-4">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-emerald-500 mb-2" />
                <p className="text-xs font-semibold">Menginisialisasi Kamera...</p>
                <p className="text-[10px] text-slate-500 mt-1">Izinkan akses kamera pada browser Anda</p>
              </div>
            )}

            {cameraState === 'active' && (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
            )}

            {(cameraState === 'error' || cameraState === 'fallback') && (
              <div className="text-center p-6 text-slate-400 space-y-3">
                <AlertCircle className="w-8 h-8 mx-auto text-amber-500" />
                <p className="text-xs font-bold text-slate-300">Akses Kamera Terkendala</p>
                <p className="text-[10px] text-slate-500 leading-relaxed max-w-xs mx-auto">
                  Silakan gunakan fitur unggah file foto dari galeri HP atau kamera sistem Anda.
                </p>
                
                <label className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer transition">
                  <Upload className="w-4 h-4" />
                  <span>Pilih / Ambil Foto</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    capture="user" 
                    onChange={handleFileUpload} 
                    className="hidden" 
                  />
                </label>
              </div>
            )}
          </>
        )}
      </div>

      {/* Camera Action Buttons */}
      <div className="flex items-center justify-center gap-3 w-full">
        {capturedImage ? (
          <>
            <button
              type="button"
              onClick={handleRetake}
              className="flex-1 max-w-[120px] px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Ulangi Foto
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="flex-1 max-w-[160px] inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl transition cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Gunakan Foto</span>
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Batal
            </button>
            
            {cameraState === 'active' && (
              <button
                type="button"
                onClick={capturePhoto}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl transition shadow-md shadow-emerald-500/20 cursor-pointer animate-pulse"
              >
                <Camera className="w-4 h-4" />
                <span>Ambil Foto</span>
              </button>
            )}

            {cameraState === 'fallback' && (
              <button
                type="button"
                onClick={startCamera}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Coba Lagi</span>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
