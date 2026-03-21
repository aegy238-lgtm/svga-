
import React, { useState, useRef, useEffect } from 'react';
import { UserRecord } from '../types';
import { useAccessControl } from '../hooks/useAccessControl';
import { Download, Trash2, Upload, Play, Check, X, FileImage, Settings, RefreshCw } from 'lucide-react';

declare var JSZip: any;

interface ImageFile {
  file: File;
  id: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  progress: number;
  originalSize: number;
  compressedSize?: number;
  previewUrl: string;
  savingPercent?: number;
}

interface BatchCompressorProps {
  onCancel: () => void;
  currentUser: UserRecord | null;
  onLoginRequired: () => void;
  onSubscriptionRequired: () => void;
  globalQuality?: 'low' | 'medium' | 'high';
}

export const BatchCompressor: React.FC<BatchCompressorProps> = ({ onCancel, currentUser, onLoginRequired, onSubscriptionRequired }) => {
  const { checkAccess } = useAccessControl();
  const [images, setImages] = useState<ImageFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [quality, setQuality] = useState<number>(80);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      images.forEach(img => URL.revokeObjectURL(img.previewUrl));
    };
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    const newImages: ImageFile[] = files.map(file => ({
      file,
      id: Math.random().toString(36).substring(2, 11) + Date.now(),
      status: 'pending',
      progress: 0,
      originalSize: file.size,
      previewUrl: URL.createObjectURL(file)
    }));
    setImages(prev => [...prev, ...newImages]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const compressImage = async (imgFile: ImageFile, quality: number): Promise<{ blob: Blob; size: number; percent: number }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const w = img.naturalWidth || img.width;
          const h = img.naturalHeight || img.height;
          canvas.width = w;
          canvas.height = h;
          
          const ctx = canvas.getContext('2d', { alpha: true, willReadFrequently: true });
          if (!ctx) throw new Error('Context fail');
          
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, w, h);
          
          // For PNG, we can use simple quantization to reduce size if quality is not 100
          // This helps reduce file size while keeping PNG format
          if (imgFile.file.type === 'image/png' && quality < 100) {
             const imageData = ctx.getImageData(0, 0, w, h);
             const data = imageData.data;
             
             // Less aggressive quantization to preserve colors better
             // Map 0-100 quality to 2-256 levels
             const levels = Math.max(4, Math.floor((quality / 100) * 256));
             const factor = 255 / (levels - 1);

             for (let i = 0; i < data.length; i += 4) {
               data[i] = Math.floor(data[i] / factor + 0.5) * factor;
               data[i+1] = Math.floor(data[i+1] / factor + 0.5) * factor;
               data[i+2] = Math.floor(data[i+2] / factor + 0.5) * factor;
             }
             ctx.putImageData(imageData, 0, 0);
          }

          // Determine output format and quality
          // If it's JPEG/WebP, toBlob supports quality
          // If PNG, quality param is ignored by spec, but we did quantization above
          const outputType = imgFile.file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          const outputQuality = outputType === 'image/jpeg' ? quality / 100 : undefined;

          canvas.toBlob((blob) => {
            if (blob) {
              // Check if we actually saved space
              if (blob.size >= imgFile.originalSize && quality > 90) {
                 resolve({ blob: imgFile.file, size: imgFile.originalSize, percent: 0 });
              } else {
                 const saving = imgFile.originalSize > blob.size 
                    ? Math.round(((imgFile.originalSize - blob.size) / imgFile.originalSize) * 100) 
                    : 0;
                 resolve({ blob, size: blob.size, percent: saving });
              }
            } else reject('Blob Error');
          }, outputType, outputQuality);

        } catch (err) { reject(err); }
      };
      img.onerror = () => reject('Load Error');
      img.src = imgFile.previewUrl;
    });
  };

  const startBatchProcess = async () => {
    if (images.length === 0 || isProcessing) return;

    if (!currentUser) {
      onLoginRequired();
      return;
    }

    const { allowed, reason } = await checkAccess('Batch Compression');
    if (!allowed) {
      if (reason === 'trial_ended') onSubscriptionRequired();
      return;
    }

    setIsProcessing(true);

    const zip = new JSZip();
    let processedCount = 0;
    const CONCURRENCY = 3;

    const processQueue = [...images];
    const workers = Array(CONCURRENCY).fill(null).map(async () => {
      while (processQueue.length > 0) {
        const item = processQueue.shift();
        if (!item) break;

        setImages(prev => prev.map(img => img.id === item.id ? { ...img, status: 'processing' } : img));

        try {
          const result = await compressImage(item, quality);
          const ext = item.file.name.split('.').pop();
          const name = item.file.name.replace(/\.[^/.]+$/, "");
          zip.file(`${name}_optimized.${ext}`, result.blob);
          
          setImages(prev => prev.map(img => 
            img.id === item.id ? { ...img, status: 'done', compressedSize: result.size, savingPercent: result.percent, progress: 100 } : img
          ));
        } catch (e) {
          setImages(prev => prev.map(img => img.id === item.id ? { ...img, status: 'error' } : img));
        }

        processedCount++;
      }
    });

    await Promise.all(workers);
    setIsProcessing(false);
  };

  const downloadZip = async () => {
    if (images.filter(i => i.status === 'done').length === 0) return;
    
    const zip = new JSZip();
    // Re-add already processed blobs? 
    // Since we didn't store blobs in state (to save memory), we might need to re-compress or 
    // ideally we should have stored them if we want instant download.
    // BUT, for this demo, let's assume the user clicks "Start" and it auto-downloads, 
    // OR we re-run the zip generation from the processed images if we stored them.
    // To keep it simple and memory efficient, we'll just trigger the process again if they click download 
    // OR we can't really "Download ZIP" without re-processing if we didn't keep the blobs.
    // Let's modify startBatchProcess to auto-download, and the Download button to just alert or re-process.
    // Actually, let's store the blobs in a ref for the session? No, memory leak.
    // Let's just make "Start Compression" do the work and download.
    // The "Download ZIP" button can be disabled until processing is done, 
    // and we can store the LAST generated zip blob in a ref.
  };
  
  // We'll use a ref to store the last zip blob to allow downloading without re-processing
  const lastZipBlob = useRef<Blob | null>(null);

  const handleProcessAndDownload = async () => {
      await startBatchProcess();
      // After processing, we need to generate the zip from the *results*. 
      // Since we didn't store blobs in state, we have to do it inside startBatchProcess.
      // Let's modify startBatchProcess to save to lastZipBlob.
  };

  // Modified startBatchProcess to handle zip generation
  const runCompression = async () => {
      if (images.length === 0 || isProcessing) return;
      if (!currentUser) { onLoginRequired(); return; }
      
      const { allowed, reason } = await checkAccess('Batch Compression');
      if (!allowed) {
        if (reason === 'trial_ended') onSubscriptionRequired();
        return;
      }

      setIsProcessing(true);
      const zip = new JSZip();
      let processedCount = 0;
      const CONCURRENCY = 3;
      const processQueue = [...images];

      const workers = Array(CONCURRENCY).fill(null).map(async () => {
        while (processQueue.length > 0) {
          const item = processQueue.shift();
          if (!item) break;
          
          // Skip if already done? No, user might have changed quality.
          setImages(prev => prev.map(img => img.id === item.id ? { ...img, status: 'processing' } : img));

          try {
            const result = await compressImage(item, quality);
            const ext = item.file.name.split('.').pop();
            const name = item.file.name.replace(/\.[^/.]+$/, "");
            zip.file(`${name}_optimized.${ext}`, result.blob);
            
            setImages(prev => prev.map(img => 
              img.id === item.id ? { ...img, status: 'done', compressedSize: result.size, savingPercent: result.percent, progress: 100 } : img
            ));
          } catch (e) {
            setImages(prev => prev.map(img => img.id === item.id ? { ...img, status: 'error' } : img));
          }
          processedCount++;
        }
      });

      await Promise.all(workers);
      
      if (processedCount > 0) {
        const content = await zip.generateAsync({ type: "blob" });
        lastZipBlob.current = content;
        // Auto download? Maybe not, let user click download.
        // But usually batch tools auto download. Let's do auto download for convenience.
        // const link = document.createElement("a");
        // link.href = URL.createObjectURL(content);
        // link.download = `Optimized_Images_Q${quality}.zip`;
        // link.click();
      }
      setIsProcessing(false);
  };

  const handleDownloadClick = () => {
      if (lastZipBlob.current) {
          const link = document.createElement("a");
          link.href = URL.createObjectURL(lastZipBlob.current);
          link.download = `Optimized_Images_Q${quality}.zip`;
          link.click();
      }
  };

  const totalOriginalSize = images.reduce((acc, img) => acc + img.originalSize, 0);
  const totalCompressedSize = images.reduce((acc, img) => acc + (img.compressedSize || 0), 0);
  const totalSaved = totalOriginalSize - totalCompressedSize;
  const totalSavedPercent = totalOriginalSize > 0 ? (totalSaved / totalOriginalSize) * 100 : 0;
  const successCount = images.filter(img => img.status === 'done').length;

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white p-4 sm:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <FileImage className="w-6 h-6 text-blue-500" />
                Batch Image Compression
            </h1>
            <button onClick={onCancel} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-6 h-6" />
            </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
            {/* Left Column: Image Grid & Dropzone */}
            <div className="flex-1 space-y-6">
                {/* Dropzone */}
                <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-800 bg-slate-900/50 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-500/5 transition-all group min-h-[200px]"
                >
                    <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg">
                        <Upload className="w-8 h-8 text-slate-400 group-hover:text-blue-500" />
                    </div>
                    <p className="text-slate-300 font-medium text-lg">Click to add images</p>
                    <p className="text-slate-500 text-sm mt-1">Supports PNG, JPG, WEBP</p>
                    <input type="file" multiple ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} />
                </div>

                {/* Image Grid */}
                {images.length > 0 && (
                    <div className="grid grid-cols-1 gap-4">
                        {images.map(img => (
                            <div key={img.id} className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center gap-4 relative overflow-hidden group hover:border-slate-700 transition-all">
                                {/* Thumbnail */}
                                <div className="w-16 h-16 bg-slate-950 rounded-lg overflow-hidden border border-slate-800 shrink-0">
                                    <img src={img.previewUrl} className="w-full h-full object-cover" alt="" />
                                </div>
                                
                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                        <h4 className="text-slate-200 font-medium truncate text-sm">{img.file.name}</h4>
                                        {img.status === 'done' && (
                                            <span className="text-green-500 text-xs font-bold bg-green-500/10 px-2 py-0.5 rounded-full">
                                                -{img.savingPercent}%
                                            </span>
                                        )}
                                    </div>
                                    
                                    <div className="flex items-center gap-2 text-xs">
                                        <span className="text-slate-500">{formatSize(img.originalSize)}</span>
                                        {img.status === 'done' && (
                                            <>
                                                <span className="text-slate-600">→</span>
                                                <span className="text-green-400 font-mono">{formatSize(img.compressedSize || 0)}</span>
                                            </>
                                        )}
                                    </div>
                                    
                                    {/* Progress Bar */}
                                    {img.status === 'processing' && (
                                        <div className="mt-2 h-1 bg-slate-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-blue-500 animate-pulse w-full"></div>
                                        </div>
                                    )}
                                </div>

                                {/* Status Icon */}
                                <div className="shrink-0">
                                    {img.status === 'done' && <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center text-green-500"><Check className="w-4 h-4" /></div>}
                                    {img.status === 'error' && <div className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center text-red-500"><X className="w-4 h-4" /></div>}
                                    {img.status === 'pending' && (
                                        <button onClick={() => setImages(prev => prev.filter(i => i.id !== img.id))} className="w-8 h-8 hover:bg-slate-800 rounded-full flex items-center justify-center text-slate-500 hover:text-red-400 transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Right Column: Sidebar Controls */}
            <div className="w-full lg:w-80 shrink-0 space-y-6">
                {/* Controls Panel */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
                    <div className="mb-8">
                        <div className="flex justify-between items-center mb-4">
                            <label className="text-sm font-bold text-slate-300 uppercase tracking-wider">Image Quality</label>
                            <div className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1 text-white font-mono text-sm min-w-[3rem] text-center">
                                {quality}
                            </div>
                        </div>
                        
                        <div className="relative pt-2">
                            <input 
                                type="range" 
                                min="1" 
                                max="100" 
                                value={quality} 
                                onChange={(e) => setQuality(parseInt(e.target.value))}
                                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                            <style>{`
                                input[type=range]::-webkit-slider-thumb {
                                    -webkit-appearance: none;
                                    height: 16px;
                                    width: 16px;
                                    border-radius: 50%;
                                    background: #ffffff;
                                    cursor: pointer;
                                    box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
                                    margin-top: -6px;
                                }
                                input[type=range]::-webkit-slider-runnable-track {
                                    height: 4px;
                                    background: #334155;
                                    border-radius: 2px;
                                }
                            `}</style>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <button 
                            onClick={runCompression}
                            disabled={images.length === 0 || isProcessing}
                            className={`w-full py-3 rounded-xl font-bold text-sm uppercase tracking-wide text-white transition-all shadow-lg ${
                                images.length === 0 || isProcessing 
                                ? 'bg-blue-600/50 cursor-not-allowed' 
                                : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20 active:scale-95'
                            }`}
                        >
                            {isProcessing ? 'Processing...' : 'Start Compression'}
                        </button>

                        <button 
                            onClick={handleDownloadClick}
                            disabled={!lastZipBlob.current || isProcessing}
                            className={`w-full py-3 rounded-xl font-bold text-sm uppercase tracking-wide text-white transition-all shadow-lg flex items-center justify-center gap-2 ${
                                !lastZipBlob.current || isProcessing
                                ? 'bg-green-600/50 cursor-not-allowed'
                                : 'bg-green-600 hover:bg-green-500 shadow-green-900/20 active:scale-95'
                            }`}
                        >
                            <Download className="w-4 h-4" />
                            Download ZIP
                        </button>

                        <button 
                            onClick={() => { setImages([]); lastZipBlob.current = null; }}
                            className="w-full py-3 rounded-xl font-bold text-sm uppercase tracking-wide text-red-500 border border-red-900/30 hover:bg-red-950/30 transition-all active:scale-95"
                        >
                            Clear All
                        </button>
                    </div>
                </div>

                {/* Results Panel */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
                    <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-6">Compression Results</h3>
                    
                    <div className="space-y-4 text-sm">
                        <div className="flex justify-between items-center py-2 border-b border-slate-800/50">
                            <span className="text-slate-500 font-medium">Total Files</span>
                            <span className="text-white font-mono">{images.length}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-800/50">
                            <span className="text-slate-500 font-medium">Success Count</span>
                            <span className="text-white font-mono">{successCount}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-800/50">
                            <span className="text-slate-500 font-medium">Original Size</span>
                            <span className="text-white font-mono">{formatSize(totalOriginalSize)}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-800/50">
                            <span className="text-slate-500 font-medium">Compressed</span>
                            <span className="text-blue-400 font-mono">
                                {successCount > 0 ? formatSize(totalCompressedSize) : '---'}
                            </span>
                        </div>
                        <div className="flex justify-between items-center pt-2">
                            <span className="text-slate-500 font-medium">Total Saved</span>
                            <span className="text-green-500 font-mono font-bold">
                                {successCount > 0 ? `${formatSize(totalSaved)} (-${totalSavedPercent.toFixed(1)}%)` : '---'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
