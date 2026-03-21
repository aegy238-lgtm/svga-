
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserRecord } from '../types';
import { 
  Image as ImageIcon, 
  Upload, 
  X, 
  Download, 
  Scissors, 
  Check,
  RefreshCw,
  FileArchive,
  Trash2,
  LayoutGrid,
  Maximize2,
  Crop as CropIcon
} from 'lucide-react';
import { logActivity } from '../utils/logger';
import { useAccessControl } from '../hooks/useAccessControl';

declare var JSZip: any;

interface BatchCropperProps {
  currentUser: UserRecord | null;
  onCancel: () => void;
  onLoginRequired: () => void;
  onSubscriptionRequired: () => void;
}

interface CroppableImage {
  id: string;
  file: File;
  url: string;
  name: string;
  width: number;
  height: number;
  status: 'idle' | 'processing' | 'completed' | 'error';
  processedBlob?: Blob;
}

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

type CropShape = 'rect' | 'circle' | 'rounded';

export const BatchCropper: React.FC<BatchCropperProps> = ({ 
  currentUser, 
  onCancel, 
  onLoginRequired, 
  onSubscriptionRequired 
}) => {
  const { checkAccess } = useAccessControl();
  
  const [images, setImages] = useState<CroppableImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [editingImage, setEditingImage] = useState<CroppableImage | null>(null);
  const [cropArea, setCropArea] = useState<CropArea>({ x: 10, y: 10, width: 80, height: 80 }); // Percentage based
  const [cropShape, setCropShape] = useState<CropShape>('rect');
  const [borderRadius, setBorderRadius] = useState(20); // For rounded rect
  const [format, setFormat] = useState<'png' | 'jpeg' | 'webp'>('png');
  const [quality, setQuality] = useState(0.9);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    const newImages: CroppableImage[] = [];
    
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      
      const url = URL.createObjectURL(file);
      const img = new Image();
      
      await new Promise((resolve) => {
        img.onload = () => {
          newImages.push({
            id: Math.random().toString(36).substr(2, 9),
            file,
            url,
            name: file.name,
            width: img.width,
            height: img.height,
            status: 'idle'
          });
          resolve(null);
        };
        img.src = url;
      });
    }

    setImages(prev => [...prev, ...newImages]);
  };

  const removeImage = (id: string) => {
    setImages(prev => {
      const filtered = prev.filter(img => img.id !== id);
      const removed = prev.find(img => img.id === id);
      if (removed) URL.revokeObjectURL(removed.url);
      return filtered;
    });
  };

  const clearAll = () => {
    images.forEach(img => URL.revokeObjectURL(img.url));
    setImages([]);
    setProgress(0);
  };

  const processImages = async () => {
    if (images.length === 0) return;
    
    if (!currentUser) {
      onLoginRequired();
      return;
    }

    const { allowed } = await checkAccess('Batch Cropping');
    if (!allowed) {
      onSubscriptionRequired();
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    const processedImages = [...images];
    
    for (let i = 0; i < processedImages.length; i++) {
      const imgData = processedImages[i];
      processedImages[i] = { ...imgData, status: 'processing' };
      setImages([...processedImages]);

      try {
        const blob = await cropImage(imgData.url, cropArea, format, quality, cropShape, borderRadius);
        processedImages[i] = { 
          ...processedImages[i], 
          status: 'completed', 
          processedBlob: blob || undefined 
        };
      } catch (e) {
        processedImages[i] = { ...processedImages[i], status: 'error' };
      }

      setProgress(Math.round(((i + 1) / processedImages.length) * 100));
      setImages([...processedImages]);
    }

    setIsProcessing(false);
    
    if (currentUser) {
      logActivity(currentUser, 'feature_usage', `Batch cropped ${images.length} images`);
    }
  };

  const cropImage = (url: string, area: CropArea, format: string, quality: number, shape: CropShape, radius: number): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        
        // Calculate pixel coordinates from percentages
        const x = (area.x / 100) * img.width;
        const y = (area.y / 100) * img.height;
        const w = (area.width / 100) * img.width;
        const h = (area.height / 100) * img.height;
        
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Apply Shape Mask
        ctx.beginPath();
        if (shape === 'circle') {
          const size = Math.min(w, h);
          ctx.arc(w / 2, h / 2, size / 2, 0, Math.PI * 2);
          ctx.clip();
        } else if (shape === 'rounded') {
          const r = (radius / 100) * Math.min(w, h);
          ctx.moveTo(r, 0);
          ctx.lineTo(w - r, 0);
          ctx.quadraticCurveTo(w, 0, w, r);
          ctx.lineTo(w, h - r);
          ctx.quadraticCurveTo(w, h, w - r, h);
          ctx.lineTo(r, h);
          ctx.quadraticCurveTo(0, h, 0, h - r);
          ctx.lineTo(0, r);
          ctx.quadraticCurveTo(0, 0, r, 0);
          ctx.clip();
        }
        
        ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
        
        canvas.toBlob((blob) => {
          resolve(blob);
        }, `image/${format}`, quality);
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  };

  const downloadAll = async () => {
    const completed = images.filter(img => img.status === 'completed' && img.processedBlob);
    if (completed.length === 0) return;

    if (completed.length === 1) {
      const img = completed[0];
      const url = URL.createObjectURL(img.processedBlob!);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cropped_${img.name}`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    const zip = new JSZip();
    completed.forEach(img => {
      const ext = format === 'jpeg' ? 'jpg' : format;
      const fileName = img.name.split('.').slice(0, -1).join('.') + `_cropped.${ext}`;
      zip.file(fileName, img.processedBlob);
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cropped_images_${Date.now()}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Handle Resizing Logic for the Crop Box
  const [resizing, setResizing] = useState<string | null>(null);
  const startPosRef = useRef({ x: 0, y: 0, area: { ...cropArea } });
  const requestRef = useRef<number | null>(null);

  const onHandleMouseDown = (e: React.MouseEvent, handle: string) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing(handle);
    startPosRef.current = { x: e.clientX, y: e.clientY, area: { ...cropArea } };
  };

  const updateCropArea = useCallback((clientX: number, clientY: number) => {
    if (!resizing || !editorContainerRef.current) return;

    const rect = editorContainerRef.current.getBoundingClientRect();
    const dx = ((clientX - startPosRef.current.x) / rect.width) * 100;
    const dy = ((clientY - startPosRef.current.y) / rect.height) * 100;

    let newArea = { ...startPosRef.current.area };

    if (resizing === 'move') {
      newArea.x = Math.max(0, Math.min(100 - newArea.width, startPosRef.current.area.x + dx));
      newArea.y = Math.max(0, Math.min(100 - newArea.height, startPosRef.current.area.y + dy));
    } else {
      if (resizing.includes('right')) newArea.width = Math.max(5, Math.min(100 - newArea.x, startPosRef.current.area.width + dx));
      if (resizing.includes('left')) {
        const potentialX = startPosRef.current.area.x + dx;
        const potentialW = startPosRef.current.area.width - dx;
        if (potentialX >= 0 && potentialW >= 5) {
          newArea.x = potentialX;
          newArea.width = potentialW;
        }
      }
      if (resizing.includes('bottom')) newArea.height = Math.max(5, Math.min(100 - newArea.y, startPosRef.current.area.height + dy));
      if (resizing.includes('top')) {
        const potentialY = startPosRef.current.area.y + dy;
        const potentialH = startPosRef.current.area.height - dy;
        if (potentialY >= 0 && potentialH >= 5) {
          newArea.y = potentialY;
          newArea.height = potentialH;
        }
      }

      // Force perfect circle aspect ratio if shape is circle
      if (cropShape === 'circle') {
        const size = Math.min(newArea.width, newArea.height);
        newArea.width = size;
        newArea.height = size;
      }
    }

    setCropArea(newArea);
  }, [resizing]);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!resizing) return;
    
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }
    
    requestRef.current = requestAnimationFrame(() => {
      updateCropArea(e.clientX, e.clientY);
    });
  }, [resizing, updateCropArea]);

  const onMouseUp = useCallback(() => {
    setResizing(null);
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
  }, []);

  const onHandleTouchStart = (e: React.TouchEvent, handle: string) => {
    e.preventDefault();
    e.stopPropagation();
    const touch = e.touches[0];
    setResizing(handle);
    startPosRef.current = { x: touch.clientX, y: touch.clientY, area: { ...cropArea } };
  };

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (!resizing) return;
    const touch = e.touches[0];
    
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }
    
    requestRef.current = requestAnimationFrame(() => {
      updateCropArea(touch.clientX, touch.clientY);
    });
  }, [resizing, updateCropArea]);

  useEffect(() => {
    if (resizing) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      window.addEventListener('touchmove', onTouchMove, { passive: false });
      window.addEventListener('touchend', onMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onMouseUp);
    };
  }, [resizing, onMouseMove, onTouchMove, onMouseUp]);

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tighter flex items-center gap-3">
            <Scissors className="w-8 h-8 text-indigo-500" />
            القصّ وتحديد المقاس الجماعي للصور
          </h2>
          <p className="text-slate-400 text-sm mt-1">تحديد منطقة قصّ موحدة وتطبيقها على جميع الصور دفعة واحدة</p>
        </div>
        <div className="flex items-center gap-3">
          {images.length > 0 && (
            <button 
              onClick={clearAll}
              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              مسح الكل
            </button>
          )}
          <button 
            onClick={onCancel}
            className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-slate-400 hover:text-white transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Controls Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-900/60 border border-white/5 rounded-[2.5rem] p-6 space-y-6 shadow-2xl backdrop-blur-xl">
            
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-widest text-indigo-500 flex items-center gap-2">
                <CropIcon className="w-3 h-3" />
                إعدادات القصّ
              </label>

              <div className="bg-white/5 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between text-[10px] font-bold">
                  <span className="text-slate-400">منطقة القصّ:</span>
                  <span className="text-indigo-400 font-mono">{Math.round(cropArea.width)}% x {Math.round(cropArea.height)}%</span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-bold">
                  <span className="text-slate-400">الإزاحة:</span>
                  <span className="text-indigo-400 font-mono">X: {Math.round(cropArea.x)}% Y: {Math.round(cropArea.y)}%</span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-bold pt-2 border-t border-white/5">
                  <span className="text-slate-400">الشكل المختار:</span>
                  <span className="text-indigo-400">
                    {cropShape === 'rect' ? 'مربع' : cropShape === 'circle' ? 'دائري' : 'حواف دائرية'}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-[9px] text-slate-400 font-bold">صيغة التصدير</span>
                <div className="flex gap-2">
                  {(['png', 'jpeg', 'webp'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setFormat(f)}
                      className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${format === f ? 'bg-indigo-500 text-white shadow-glow-indigo' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-white/5">
              <button 
                onClick={processImages}
                disabled={images.length === 0 || isProcessing}
                className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 transition-all ${images.length === 0 || isProcessing ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-indigo-500 hover:bg-indigo-400 text-white shadow-glow-indigo active:scale-95'}`}
              >
                {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                تطبيق القصّ على الكل
              </button>

              {images.some(img => img.status === 'completed') && (
                <button 
                  onClick={downloadAll}
                  className="w-full py-4 rounded-2xl bg-green-500 hover:bg-green-400 text-white font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-glow-green active:scale-95"
                >
                  <FileArchive className="w-4 h-4" />
                  تحميل النتائج (ZIP)
                </button>
              )}
            </div>

            {isProcessing && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[9px] font-bold text-slate-400">
                  <span>جاري القصّ...</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-indigo-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-3 space-y-6">
          {/* Upload Dropzone */}
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="bg-slate-900/40 border-2 border-dashed border-white/5 hover:border-indigo-500/30 rounded-[2.5rem] p-10 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all group"
          >
            <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Upload className="w-8 h-8 text-indigo-500" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-white">رفع الصور للقصّ الجماعي</h3>
              <p className="text-slate-500 text-sm mt-1">اسحب وأفلت الصور هنا أو اضغط للاختيار</p>
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              multiple 
              accept="image/*" 
              onChange={handleUpload} 
            />
          </div>

          {/* Image Grid */}
          {images.length > 0 && (
            <div className="bg-slate-900/40 border border-white/5 rounded-[2.5rem] p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4" />
                  قائمة الصور ({images.length})
                </h4>
                <p className="text-[10px] text-slate-500">اضغط على أي صورة لفتح محرر القصّ</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                <AnimatePresence mode="popLayout">
                  {images.map((img) => (
                    <motion.div 
                      key={img.id}
                      layout
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      onClick={() => setEditingImage(img)}
                      className={`relative group rounded-2xl overflow-hidden border-2 cursor-pointer transition-all ${img.status === 'processing' ? 'border-indigo-500 animate-pulse' : img.status === 'completed' ? 'border-green-500/50' : 'border-white/5 hover:border-indigo-500/50'}`}
                    >
                      <img 
                        src={img.url} 
                        alt={img.name} 
                        className="w-full aspect-square object-cover"
                      />
                      
                      {/* Overlay */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Maximize2 className="w-6 h-6 text-white" />
                      </div>

                      {/* Info Bar */}
                      <div className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm px-2 py-1.5 border-t border-white/5">
                        <p className="text-[8px] text-white font-bold truncate">{img.name}</p>
                        <p className="text-[7px] text-slate-400 font-mono">{img.width}x{img.height}</p>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Crop Editor Modal */}
      <AnimatePresence>
        {editingImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 sm:p-10"
          >
            <div className="w-full max-w-4xl bg-slate-900 border border-white/10 rounded-[3rem] overflow-hidden flex flex-col h-full max-h-[90vh]">
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center">
                    <Scissors className="w-6 h-6 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white tracking-tight">تحديد منطقة القصّ</h3>
                    <p className="text-slate-400 text-xs truncate max-w-[200px]">{editingImage.name}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setEditingImage(null)}
                  className="p-3 hover:bg-white/5 rounded-2xl text-slate-400 hover:text-white transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 p-10 flex items-center justify-center relative overflow-hidden bg-slate-950">
                <div 
                  ref={editorContainerRef}
                  className="relative max-w-full max-h-full shadow-2xl"
                  style={{ aspectRatio: `${editingImage.width}/${editingImage.height}` }}
                >
                  <img 
                    src={editingImage.url} 
                    alt="Editing" 
                    className="max-w-full max-h-[60vh] object-contain select-none pointer-events-none"
                  />
                  
                  {/* Overlay Dimmer */}
                  <div className="absolute inset-0 bg-black/60 pointer-events-none" />

                  {/* Crop Box */}
                  <div 
                    className="absolute border-2 border-indigo-500 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)] cursor-move overflow-hidden"
                    style={{
                      left: `${cropArea.x}%`,
                      top: `${cropArea.y}%`,
                      width: `${cropArea.width}%`,
                      height: `${cropArea.height}%`,
                      borderRadius: cropShape === 'circle' ? '50%' : cropShape === 'rounded' ? `${borderRadius}%` : '0',
                    }}
                    onMouseDown={(e) => onHandleMouseDown(e, 'move')}
                    onTouchStart={(e) => onHandleTouchStart(e, 'move')}
                  >
                    {/* Handles */}
                    <div 
                      className="absolute -top-2 -left-2 w-4 h-4 bg-white border-2 border-indigo-500 rounded-full cursor-nw-resize" 
                      onMouseDown={(e) => onHandleMouseDown(e, 'top-left')}
                      onTouchStart={(e) => onHandleTouchStart(e, 'top-left')}
                    />
                    <div 
                      className="absolute -top-2 -right-2 w-4 h-4 bg-white border-2 border-indigo-500 rounded-full cursor-ne-resize" 
                      onMouseDown={(e) => onHandleMouseDown(e, 'top-right')}
                      onTouchStart={(e) => onHandleTouchStart(e, 'top-right')}
                    />
                    <div 
                      className="absolute -bottom-2 -left-2 w-4 h-4 bg-white border-2 border-indigo-500 rounded-full cursor-sw-resize" 
                      onMouseDown={(e) => onHandleMouseDown(e, 'bottom-left')}
                      onTouchStart={(e) => onHandleTouchStart(e, 'bottom-left')}
                    />
                    <div 
                      className="absolute -bottom-2 -right-2 w-4 h-4 bg-white border-2 border-indigo-500 rounded-full cursor-se-resize" 
                      onMouseDown={(e) => onHandleMouseDown(e, 'bottom-right')}
                      onTouchStart={(e) => onHandleTouchStart(e, 'bottom-right')}
                    />
                    
                    <div 
                      className="absolute top-1/2 -left-2 w-4 h-4 bg-white border-2 border-indigo-500 rounded-full -translate-y-1/2 cursor-w-resize" 
                      onMouseDown={(e) => onHandleMouseDown(e, 'left')}
                      onTouchStart={(e) => onHandleTouchStart(e, 'left')}
                    />
                    <div 
                      className="absolute top-1/2 -right-2 w-4 h-4 bg-white border-2 border-indigo-500 rounded-full -translate-y-1/2 cursor-e-resize" 
                      onMouseDown={(e) => onHandleMouseDown(e, 'right')}
                      onTouchStart={(e) => onHandleTouchStart(e, 'right')}
                    />
                    <div 
                      className="absolute -top-2 left-1/2 w-4 h-4 bg-white border-2 border-indigo-500 rounded-full -translate-x-1/2 cursor-n-resize" 
                      onMouseDown={(e) => onHandleMouseDown(e, 'top')}
                      onTouchStart={(e) => onHandleTouchStart(e, 'top')}
                    />
                    <div 
                      className="absolute -bottom-2 left-1/2 w-4 h-4 bg-white border-2 border-indigo-500 rounded-full -translate-x-1/2 cursor-s-resize" 
                      onMouseDown={(e) => onHandleMouseDown(e, 'bottom')}
                      onTouchStart={(e) => onHandleTouchStart(e, 'bottom')}
                    />

                    {/* Grid Lines */}
                    <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-30">
                      <div className="border-r border-white/50" />
                      <div className="border-r border-white/50" />
                      <div />
                      <div className="border-b border-white/50 col-span-3" />
                      <div className="border-b border-white/50 col-span-3" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8 bg-slate-900/80 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="flex flex-col gap-4 w-full sm:w-auto">
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">شكل القصّ</span>
                  <div className="flex gap-2">
                    {[
                      { id: 'rect', label: 'مربع', icon: '🔲' },
                      { id: 'circle', label: 'دائري', icon: '⚪' },
                      { id: 'rounded', label: 'حواف دائرية', icon: '▢' },
                    ].map(s => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setCropShape(s.id as CropShape);
                          if (s.id === 'circle') {
                            const size = Math.min(cropArea.width, cropArea.height);
                            setCropArea(prev => ({ ...prev, width: size, height: size }));
                          }
                        }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black transition-all border ${cropShape === s.id ? 'bg-indigo-500 border-indigo-400 text-white shadow-glow-indigo' : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'}`}
                      >
                        <span className="text-sm">{s.icon}</span>
                        {s.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                    {/* Size Controls */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] text-slate-400 font-bold">العرض:</span>
                        <span className="text-[9px] text-indigo-400 font-mono">{Math.round(cropArea.width)}%</span>
                      </div>
                      <input 
                        type="range" min="5" max="100" 
                        value={cropArea.width} 
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setCropArea(prev => {
                            const newWidth = Math.min(val, 100 - prev.x);
                            const next = { ...prev, width: newWidth };
                            if (cropShape === 'circle') next.height = newWidth;
                            return next;
                          });
                        }}
                        className="w-full h-1.5 bg-slate-800 rounded-full appearance-none accent-indigo-500 cursor-pointer"
                      />
                    </div>

                    {cropShape !== 'circle' && (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] text-slate-400 font-bold">الطول:</span>
                          <span className="text-[9px] text-indigo-400 font-mono">{Math.round(cropArea.height)}%</span>
                        </div>
                        <input 
                          type="range" min="5" max="100" 
                          value={cropArea.height} 
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setCropArea(prev => ({ ...prev, height: Math.min(val, 100 - prev.y) }));
                          }}
                          className="w-full h-1.5 bg-slate-800 rounded-full appearance-none accent-indigo-500 cursor-pointer"
                        />
                      </div>
                    )}

                    {/* Position Controls */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] text-slate-400 font-bold">الموقع الأفقي (X):</span>
                        <span className="text-[9px] text-indigo-400 font-mono">{Math.round(cropArea.x)}%</span>
                      </div>
                      <input 
                        type="range" min="0" max="100" 
                        value={cropArea.x} 
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setCropArea(prev => ({ ...prev, x: Math.min(val, 100 - prev.width) }));
                        }}
                        className="w-full h-1.5 bg-slate-800 rounded-full appearance-none accent-indigo-500 cursor-pointer"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] text-slate-400 font-bold">الموقع الرأسي (Y):</span>
                        <span className="text-[9px] text-indigo-400 font-mono">{Math.round(cropArea.y)}%</span>
                      </div>
                      <input 
                        type="range" min="0" max="100" 
                        value={cropArea.y} 
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setCropArea(prev => ({ ...prev, y: Math.min(val, 100 - prev.height) }));
                        }}
                        className="w-full h-1.5 bg-slate-800 rounded-full appearance-none accent-indigo-500 cursor-pointer"
                      />
                    </div>

                    {cropShape === 'rounded' && (
                      <div className="col-span-full flex items-center gap-4 bg-white/5 p-3 rounded-xl border border-white/5">
                        <span className="text-[9px] text-slate-400 font-bold whitespace-nowrap">نصف قطر الحواف:</span>
                        <input 
                          type="range" 
                          min="1" 
                          max="50" 
                          value={borderRadius} 
                          onChange={(e) => setBorderRadius(parseInt(e.target.value))}
                          className="flex-1 h-1.5 bg-slate-800 rounded-full appearance-none accent-indigo-500 cursor-pointer"
                        />
                        <span className="text-[9px] text-indigo-400 font-mono">{borderRadius}%</span>
                      </div>
                    )}
                  </div>
                </div>

                <button 
                  onClick={() => setEditingImage(null)}
                  className="px-8 py-4 bg-indigo-500 hover:bg-indigo-400 text-white rounded-2xl font-black text-sm shadow-glow-indigo transition-all active:scale-95 flex items-center gap-2 w-full sm:w-auto justify-center"
                >
                  <Check className="w-5 h-5" />
                  حفظ منطقة القصّ
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
