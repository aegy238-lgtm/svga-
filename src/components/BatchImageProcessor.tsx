import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, X, Download, Settings, Image as ImageIcon, CheckCircle2, AlertCircle, Loader2, Maximize2, Minimize2 } from 'lucide-react';
import JSZip from 'jszip';
import imageCompression from 'browser-image-compression';
import UPNG from 'upng-js';

interface ProcessedImage {
  id: string;
  originalName: string;
  originalSize: number;
  newSize?: number;
  status: 'pending' | 'processing' | 'success' | 'error';
  url?: string;
  error?: string;
}

export const BatchImageProcessor: React.FC<{ onCancel?: () => void }> = ({ onCancel }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [processedImages, setProcessedImages] = useState<ProcessedImage[]>([]);
  const [targetWidth, setTargetWidth] = useState<number>(512);
  const [targetHeight, setTargetHeight] = useState<number>(512);
  const [quality, setQuality] = useState<number>(80);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fitMode, setFitMode] = useState<'contain' | 'cover' | 'fill'>('contain');
  const [outputFormat, setOutputFormat] = useState<'image/webp' | 'image/jpeg' | 'image/png'>('image/webp');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []) as File[];
    const imageFiles = selectedFiles.filter(file => file.type.startsWith('image/'));
    
    setFiles(prev => [...prev, ...imageFiles]);
    
    const newProcessedImages = imageFiles.map(file => ({
      id: Math.random().toString(36).substring(2, 11),
      originalName: file.name,
      originalSize: file.size,
      status: 'pending' as const
    }));
    
    setProcessedImages(prev => [...prev, ...newProcessedImages]);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setProcessedImages(prev => prev.filter((_, i) => i !== index));
  };

  const processImages = async () => {
    if (files.length === 0) return;
    
    setIsProcessing(true);
    setProgress(0);
    
    const updatedImages = [...processedImages];
    const zip = new JSZip();
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      updatedImages[i].status = 'processing';
      setProcessedImages([...updatedImages]);
      
      try {
        const blob = await processSingleImage(file);
        const url = URL.createObjectURL(blob);
        
        updatedImages[i].status = 'success';
        updatedImages[i].newSize = blob.size;
        updatedImages[i].url = url;
        
        // Add to zip
        const extension = outputFormat === 'image/webp' ? '.webp' : outputFormat === 'image/jpeg' ? '.jpg' : '.png';
        const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        zip.file(`${baseName}_processed${extension}`, blob);
        
      } catch (error: any) {
        updatedImages[i].status = 'error';
        updatedImages[i].error = error.message || 'Failed to process';
      }
      
      setProgress(((i + 1) / files.length) * 100);
      setProcessedImages([...updatedImages]);
    }
    
    // Download zip if there are successful files
    const successCount = updatedImages.filter(img => img.status === 'success').length;
    if (successCount > 0) {
      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `processed_images_${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    
    setIsProcessing(false);
  };

  const processSingleImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        
        // Clear canvas (transparent background)
        ctx.clearRect(0, 0, targetWidth, targetHeight);
        
        let drawWidth = targetWidth;
        let drawHeight = targetHeight;
        let offsetX = 0;
        let offsetY = 0;
        
        const imgRatio = img.width / img.height;
        const targetRatio = targetWidth / targetHeight;
        
        if (fitMode === 'contain') {
          if (imgRatio > targetRatio) {
            drawHeight = targetWidth / imgRatio;
            offsetY = (targetHeight - drawHeight) / 2;
          } else {
            drawWidth = targetHeight * imgRatio;
            offsetX = (targetWidth - drawWidth) / 2;
          }
        } else if (fitMode === 'cover') {
          if (imgRatio > targetRatio) {
            drawWidth = targetHeight * imgRatio;
            offsetX = (targetWidth - drawWidth) / 2;
          } else {
            drawHeight = targetWidth / imgRatio;
            offsetY = (targetHeight - drawHeight) / 2;
          }
        }
        
        // Draw image
        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
        
        // Export
        if (outputFormat === 'image/png' && quality < 100) {
          try {
            // Use UPNG.js for lossy PNG compression (quantization)
            const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
            // Map quality (10-99) to number of colors (2-256)
            const colors = Math.max(2, Math.floor((quality / 100) * 256));
            const pngBuffer = UPNG.encode([imageData.data.buffer], targetWidth, targetHeight, colors);
            const blob = new Blob([pngBuffer], { type: 'image/png' });
            resolve(blob);
          } catch (err) {
            console.warn('UPNG compression failed, falling back to canvas.toBlob', err);
            canvas.toBlob(
              (blob) => {
                if (blob) resolve(blob);
                else reject(new Error('Failed to create blob'));
              },
              'image/png'
            );
          }
        } else {
          canvas.toBlob(
            async (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('Failed to create blob'));
              }
            },
            outputFormat,
            outputFormat === 'image/png' ? undefined : quality / 100
          );
        }
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Failed to load image'));
      };
      
      img.src = objectUrl;
    });
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-8 bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/10 shadow-2xl text-right font-sans" dir="rtl">
      <div className="space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center border border-blue-500/30">
              <ImageIcon className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tight">معالجة الصور الشاملة</h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">تغيير المقاسات والضغط دفعة واحدة</p>
            </div>
          </div>
          {onCancel && (
            <button 
              onClick={onCancel}
              className="p-3 hover:bg-white/5 rounded-2xl transition-all text-slate-400 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Settings Panel */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-[#0f172a]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl">
              <div className="flex items-center gap-3 mb-6">
                <Settings className="w-5 h-5 text-blue-400" />
                <h2 className="text-xl font-bold text-white">إعدادات المعالجة</h2>
              </div>
              
              <div className="space-y-6">
                {/* Dimensions */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-slate-300">المقاس المطلوب (بكسل)</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">العرض (Width)</label>
                      <input 
                        type="number" 
                        value={targetWidth}
                        onChange={(e) => setTargetWidth(Number(e.target.value))}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">الطول (Height)</label>
                      <input 
                        type="number" 
                        value={targetHeight}
                        onChange={(e) => setTargetHeight(Number(e.target.value))}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Fit Mode */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-slate-300">طريقة الملاءمة</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setFitMode('contain')}
                      className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                        fitMode === 'contain' 
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                          : 'bg-black/40 text-slate-400 border border-white/5 hover:bg-white/5'
                      }`}
                    >
                      <Minimize2 className="w-4 h-4" />
                      احتواء (بدون قص)
                    </button>
                    <button
                      onClick={() => setFitMode('cover')}
                      className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                        fitMode === 'cover' 
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                          : 'bg-black/40 text-slate-400 border border-white/5 hover:bg-white/5'
                      }`}
                    >
                      <Maximize2 className="w-4 h-4" />
                      تغطية (مع قص)
                    </button>
                  </div>
                </div>

                {/* Output Format */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-slate-300">صيغة الإخراج</label>
                  <select
                    value={outputFormat}
                    onChange={(e) => setOutputFormat(e.target.value as any)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all"
                  >
                    <option value="image/webp">WebP (أفضل ضغط)</option>
                    <option value="image/jpeg">JPEG (متوافق)</option>
                    <option value="image/png">PNG (جودة عالية/شفافية)</option>
                  </select>
                </div>

                {/* Quality */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-slate-300">جودة الصورة (الضغط)</label>
                    <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-1 rounded-lg">
                      {quality}%
                    </span>
                  </div>
                  <input 
                    type="range" 
                    min="10" 
                    max="100" 
                    value={quality}
                    onChange={(e) => setQuality(Number(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                </div>

                {/* Process Button */}
                <button
                  onClick={processImages}
                  disabled={files.length === 0 || isProcessing}
                  className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-xl font-bold shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      جاري المعالجة... {Math.round(progress)}%
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5" />
                      معالجة وتحميل ({files.length} صور)
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Dropzone */}
            <div 
              onClick={() => !isProcessing && fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center text-center transition-all ${
                isProcessing 
                  ? 'border-white/10 bg-white/5 cursor-not-allowed opacity-50' 
                  : 'border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-500/50 cursor-pointer'
              }`}
            >
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileSelect}
                multiple 
                accept="image/*"
                className="hidden"
              />
              <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center mb-4">
                <Upload className="w-8 h-8 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">ارفع الصور هنا</h3>
              <p className="text-slate-400 max-w-sm">
                اضغط لاختيار مجموعة من الصور أو اسحبها وأفلتها هنا
              </p>
            </div>

            {/* File List */}
            {files.length > 0 && (
              <div className="bg-[#0f172a]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">الصور المحددة ({files.length})</h3>
                  {!isProcessing && (
                    <button 
                      onClick={() => { setFiles([]); setProcessedImages([]); }}
                      className="text-sm text-red-400 hover:text-red-300 transition-colors"
                    >
                      مسح الكل
                    </button>
                  )}
                </div>
                
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  <AnimatePresence>
                    {processedImages.map((img, index) => (
                      <motion.div 
                        key={img.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="flex items-center justify-between p-3 bg-black/40 border border-white/5 rounded-xl hover:border-white/10 transition-colors"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                            {img.url ? (
                              <img src={img.url} alt="" className="w-full h-full object-cover rounded-lg" />
                            ) : (
                              <ImageIcon className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white truncate">{img.originalName}</p>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <span>{formatBytes(img.originalSize)}</span>
                              {img.newSize && (
                                <>
                                  <span>→</span>
                                  <span className="text-emerald-400">{formatBytes(img.newSize)}</span>
                                  <span className="text-blue-400">
                                    (-{Math.round((1 - img.newSize / img.originalSize) * 100)}%)
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3 shrink-0 pl-3">
                          {img.status === 'processing' && <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />}
                          {img.status === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                          {img.status === 'error' && <AlertCircle className="w-5 h-5 text-red-400" title={img.error} />}
                          
                          {!isProcessing && img.status === 'pending' && (
                            <button 
                              onClick={() => removeFile(index)}
                              className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}
            
          </div>
        </div>
      </div>
    </div>
  );
};
