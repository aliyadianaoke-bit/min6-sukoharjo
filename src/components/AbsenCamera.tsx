import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, Upload, AlertCircle, Check, FlipHorizontal } from 'lucide-react';

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
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  // Initialize and handle camera stream on facingMode change
  useEffect(() => {
    startCamera(facingMode);
    return () => {
      stopCamera();
    };
  }, [facingMode]);

  const startCamera = async (mode: 'user' | 'environment') => {
    setCameraState('requesting');
    setErrorMessage('');
    
    // Stop any existing stream before opening a new one
    stopCamera();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Browser tidak mendukung akses kamera langsung secara aman (HTTPS).');
      }
      
      let stream: MediaStream;
      
      try {
        // Attempt 1: Standard constraints with ideal dimensions
        stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: mode, 
            width: { ideal: 1280 }, 
            height: { ideal: 720 } 
          },
          audio: false,
        });
      } catch (err1) {
        console.warn('Attempt 1 standard constraints failed, trying simple facingMode:', err1);
        try {
          // Attempt 2: Relaxed constraints with facingMode only
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: mode },
            audio: false,
          });
        } catch (err2) {
          console.warn('Attempt 2 constraints failed, trying basic video true:', err2);
          // Attempt 3: absolute fallback to any camera
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }
      }
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Explicitly play to prevent static black screens on iOS/mobile webviews
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch((playErr) => {
            console.warn('Video playback was prevented, will wait for user action or loadedmetadata:', playErr);
          });
        }
      }
      setCameraState('active');
    } catch (err: any) {
      console.error('Failed to load camera after all attempts:', err);
      setCameraState('fallback');
      setErrorMessage(err.message || 'Gagal mengakses kamera HP Anda. Silakan pilih opsi Unggah Manual.');
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
      
      // Use the actual video dimensions of the active stream
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Mirror the image *only* if we are using the front/selfie camera
        if (facingMode === 'user') {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Reset translation and scaling
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
    startCamera(facingMode);
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Viewport Container */}
      <div className="relative w-full max-w-sm aspect-square bg-slate-950 rounded-2xl overflow-hidden border-2 border-slate-700 shadow-inner flex items-center justify-center">
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
                <p className="text-[10px] text-slate-500 mt-1">Harap izinkan akses kamera pada perangkat Anda</p>
              </div>
            )}

            {cameraState === 'active' && (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                onLoadedMetadata={() => {
                  videoRef.current?.play().catch(e => console.warn('Play interrupted on loadedmetadata:', e));
                }}
                className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
              />
            )}

            {(cameraState === 'error' || cameraState === 'fallback') && (
              <div className="text-center p-6 text-slate-400 space-y-3">
                <AlertCircle className="w-8 h-8 mx-auto text-amber-500" />
                <p className="text-xs font-bold text-slate-300">Akses Kamera Terkendala</p>
                <p className="text-[10px] text-slate-500 leading-relaxed max-w-xs mx-auto">
                  Kamera tidak merespon atau izin ditolak. Silakan ambil foto selfie menggunakan kamera bawaan HP Anda dengan tombol di bawah.
                </p>
                
                <label className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer transition shadow-xs">
                  <Upload className="w-4 h-4" />
                  <span>Ambil Foto via HP / Galeri</span>
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

      {errorMessage && (
        <div className="text-[10px] text-rose-500 text-center bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-100 max-w-sm">
          {errorMessage}
        </div>
      )}

      {/* Camera Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full">
        {capturedImage ? (
          <div className="flex gap-2 w-full">
            <button
              type="button"
              onClick={handleRetake}
              className="flex-1 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Ulangi Foto
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl transition cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Gunakan Foto</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 w-full justify-center">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Batal
            </button>
            
            {cameraState === 'active' && (
              <>
                <button
                  type="button"
                  onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1 shrink-0"
                  title="Ganti Kamera Depan / Belakang"
                >
                  <FlipHorizontal className="w-3.5 h-3.5 text-slate-500" />
                  <span>Kamera {facingMode === 'user' ? 'Belakang' : 'Depan'}</span>
                </button>

                <label className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer transition flex items-center gap-1 shrink-0" title="Unggah File / Kamera Sistem HP">
                  <Upload className="w-3.5 h-3.5 text-slate-500" />
                  <span>Pilih dari HP</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    capture="user" 
                    onChange={handleFileUpload} 
                    className="hidden" 
                  />
                </label>

                <button
                  type="button"
                  onClick={capturePhoto}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl transition shadow-md shadow-emerald-500/20 cursor-pointer animate-pulse shrink-0"
                >
                  <Camera className="w-4 h-4" />
                  <span>Ambil Foto</span>
                </button>
              </>
            )}

            {(cameraState === 'error' || cameraState === 'fallback') && (
              <button
                type="button"
                onClick={() => startCamera(facingMode)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Coba Hubungkan Lagi</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
