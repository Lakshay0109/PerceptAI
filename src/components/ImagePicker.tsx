import React, { useState, useRef, useEffect } from 'react';
import { Camera, Image as ImageIcon, Upload } from 'lucide-react';
import { useAppContext } from '../context';
import { resizeImage } from '../utils';

interface ImagePickerProps {
  onImageChange?: (dataUrl: string) => void;
  mode?: 'both' | 'camera' | 'upload';
  hideWebcam?: boolean;
}

export interface ImagePickerRef {
  takePhoto: () => void;
  openCamera: () => void;
  isCameraOpen: boolean;
}

export const ImagePicker = React.forwardRef<ImagePickerRef, ImagePickerProps>(({ 
  onImageChange, 
  mode = 'both', 
  hideWebcam = false 
}, ref) => {
  const { settings, showToast } = useAppContext();
  const [isCameraOpen, setIsCameraOpen] = useState(mode === 'camera');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useImperativeHandle(ref, () => ({
    takePhoto: captureCamera,
    openCamera,
    isCameraOpen
  }));

  // Automatically start camera if mode is 'camera'
  useEffect(() => {
    if (mode === 'camera' && !isCameraOpen) {
      openCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    return () => closeCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      let dataUrl: string;
      if (settings.resizeOnUpload) {
        dataUrl = await resizeImage(file, 1024);
        showToast('Image resized to 1024px max edge');
      } else {
        dataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });
      }
      setPreview(dataUrl);
      onImageChange?.(dataUrl);
    } catch (err) {
      showToast('Error processing image');
    }
  };

  const openCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      setStream(mediaStream);
      setIsCameraOpen(true);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      showToast('Microphone/Camera permission denied or unavailable');
    }
  };

  const captureCamera = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg');
      setPreview(dataUrl);
      onImageChange?.(dataUrl);
      closeCamera();
    }
  };

  const closeCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setStream(null);
    setIsCameraOpen(false);
  };

  return (
    <div className="flex flex-col gap-2 h-full">
      {isCameraOpen ? (
        <div className="relative rounded-lg overflow-hidden bg-black aspect-video flex flex-col items-center justify-center">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-2 flex gap-2">
            <button 
              onClick={captureCamera}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded text-xs shadow-lg shadow-black/50 transition-colors"
            >
              Capture
            </button>
            <button 
              onClick={closeCamera}
              className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1 rounded text-xs shadow-lg shadow-black/50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 w-full">
          {preview ? (
            <div className="relative w-full">
              <img src={preview} alt="Preview" className="max-h-32 mx-auto rounded object-contain bg-black/20" />
              <button 
                onClick={() => { setPreview(null); onImageChange?.(''); }}
                className="absolute top-1 right-1 bg-slate-900/80 text-white px-2 py-0.5 text-xs rounded hover:bg-red-500/80"
              >
                Clear
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {(mode === 'both' || mode === 'upload') && (
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 p-2 rounded border border-slate-700 text-xs text-slate-200 transition-colors"
                >
                  <ImageIcon className="w-4 h-4 text-emerald-400" />
                  Upload from disk
                </button>
              )}
              {(mode === 'both' || mode === 'camera') && !hideWebcam && (
                <button 
                  onClick={openCamera}
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 p-2 rounded border border-slate-700 text-xs text-slate-200 transition-colors"
                >
                  <Camera className="w-4 h-4 text-emerald-400" />
                  Open Webcam
                </button>
              )}
            </div>
          )}
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*"
            onChange={handleFileUpload}
          />
        </div>
      )}
    </div>
  );
});

ImagePicker.displayName = 'ImagePicker';
