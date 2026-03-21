import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Upload, 
  Download, 
  RotateCcw, 
  Image as ImageIcon, 
  Sliders, 
  Layers, 
  Maximize, 
  ChevronRight, 
  ChevronLeft, 
  ChevronUp, 
  ChevronDown,
  Trash2,
  Check,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ImageProcessorProps {
  onCancel: () => void;
  currentUser: any;
}

export const ImageProcessor: React.FC<ImageProcessorProps> = ({ onCancel, currentUser }) => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Settings
  const [whiteEffect, setWhiteEffect] = useState(0); // 0 to 1
  const [opacity, setOpacity] = useState(1);
  const [intensity, setIntensity] = useState(0); // -1 to 1 (Fade to Enhance)
  const [edgeSettings, setEdgeSettings] = useState({
    top: true,
    bottom: true,
    left: true,
    right: true,
    thickness: 0,
    smoothness: 20,
    transparent: false
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setImage(img);
        setPreviewUrl(event.target?.result as string);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const processImage = useCallback(() => {
    if (!image || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = image.width;
    canvas.height = image.height;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply global opacity
    ctx.globalAlpha = opacity;

    // Apply filters (Intensity)
    const brightness = 100 + (intensity * 50);
    const contrast = 100 + (intensity * 50);
    const saturate = 100 + (intensity * 100);
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%)`;

    // Draw original image
    ctx.drawImage(image, 0, 0);

    // Apply White Effect
    if (whiteEffect > 0) {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        // Luminance
        const luma = 0.299 * r + 0.587 * g + 0.114 * b;
        
        // For "White Effect" with shading:
        // We want the color to be white, but the brightness to be preserved.
        // Option A: R=255, G=255, B=255, A = originalA * (luma/255) -> Good for silhouettes
        // Option B: R=luma, G=luma, B=luma -> Grayscale
        // Option C: R=255, G=255, B=255, but use luma to dim it? -> R=luma, G=luma, B=luma
        
        // Let's go with a "White Tint" that preserves luminance
        const targetR = 255;
        const targetG = 255;
        const targetB = 255;
        
        // We'll use the luma to determine how "white" it is vs how "transparent" or "shaded"
        // If luma is high (white), it's solid white. If luma is low (black), it's transparent white.
        const targetA = a * (luma / 255);

        data[i] = r + (targetR - r) * whiteEffect;
        data[i + 1] = g + (targetG - g) * whiteEffect;
        data[i + 2] = b + (targetB - b) * whiteEffect;
        data[i + 3] = a + (targetA - a) * whiteEffect;
      }
      ctx.putImageData(imageData, 0, 0);
    }

    // Apply Edges Control (Vignette/Fade effect)
    if (edgeSettings.thickness > 0) {
      const gradientSize = (edgeSettings.thickness / 100) * Math.min(canvas.width, canvas.height);
      
      ctx.save();
      
      // If transparent edges is ON, we use destination-out to cut the edges
      if (edgeSettings.transparent) {
        ctx.globalCompositeOperation = 'destination-out';
      } else {
        // If OFF, maybe we just don't do anything? 
        // Or maybe we fade to a color? Let's assume they want a fade to transparent by default
        // as "Edges Control" usually implies a fade.
        ctx.globalCompositeOperation = 'destination-out';
      }

      // We'll use a temporary canvas to draw the edge mask
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = canvas.width;
      maskCanvas.height = canvas.height;
      const mctx = maskCanvas.getContext('2d');
      
      if (mctx) {
        mctx.fillStyle = 'white';
        
        const drawEdge = (x: number, y: number, w: number, h: number, x2: number, y2: number) => {
          const grad = mctx.createLinearGradient(x, y, x2, y2);
          grad.addColorStop(0, 'rgba(255,255,255,1)');
          grad.addColorStop(1, 'rgba(255,255,255,0)');
          mctx.fillStyle = grad;
          mctx.fillRect(x, y, w, h);
        };

        if (edgeSettings.top) drawEdge(0, 0, canvas.width, gradientSize, 0, gradientSize);
        if (edgeSettings.bottom) drawEdge(0, canvas.height, canvas.width, -gradientSize, 0, canvas.height - gradientSize);
        if (edgeSettings.left) drawEdge(0, 0, gradientSize, canvas.height, gradientSize, 0);
        if (edgeSettings.right) drawEdge(canvas.width, 0, -gradientSize, canvas.height, canvas.width - gradientSize, 0);

        // Apply blur to the mask for smoothness
        if (edgeSettings.smoothness > 0) {
          ctx.filter = `blur(${edgeSettings.smoothness / 2}px)`;
        }
        
        ctx.drawImage(maskCanvas, 0, 0);
      }
      
      ctx.restore();
    }

  }, [image, whiteEffect, opacity, intensity, edgeSettings]);

  useEffect(() => {
    processImage();
  }, [processImage]);

  const handleExport = (format: 'png' | 'jpg') => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `processed-image.${format}`;
    link.href = canvasRef.current.toDataURL(format === 'png' ? 'image/png' : 'image/jpeg', 0.9);
    link.click();
  };

  const reset = () => {
    setWhiteEffect(0);
    setOpacity(1);
    setIntensity(0);
    setEdgeSettings({
      top: true,
      bottom: true,
      left: true,
      right: true,
      thickness: 0,
      smoothness: 20,
      transparent: false
    });
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-8 bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/10 shadow-2xl text-right font-sans" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center border border-blue-500/30">
            <ImageIcon className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white uppercase tracking-tight">معالج الصور</h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">تحويل، تأثيرات، وتصدير احترافي</p>
          </div>
        </div>
        <button 
          onClick={onCancel}
          className="p-3 hover:bg-white/5 rounded-2xl transition-all text-slate-400 hover:text-white"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Controls */}
        <div className="lg:col-span-4 space-y-6">
          {/* Upload Area */}
          {!image ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="aspect-square rounded-[2rem] border-2 border-dashed border-white/10 bg-white/5 flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-white/10 transition-all group"
            >
              <div className="w-16 h-16 bg-blue-500/20 rounded-3xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Upload className="w-8 h-8 text-blue-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-white">اضغط لرفع صورة</p>
                <p className="text-[10px] text-slate-500 mt-1">PNG, JPG, WEBP</p>
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleUpload} 
                accept="image/*" 
                className="hidden" 
              />
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-right duration-500">
              {/* White Effect */}
              <div className="bg-white/5 p-5 rounded-3xl border border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <Maximize className="w-3 h-3 text-blue-400" />
                    تأثير اللون الأبيض
                  </label>
                  <span className="text-[10px] font-mono text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full">
                    {Math.round(whiteEffect * 100)}%
                  </span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.01" 
                  value={whiteEffect} 
                  onChange={(e) => setWhiteEffect(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              {/* Edges Control */}
              <div className="bg-white/5 p-5 rounded-3xl border border-white/5 space-y-6">
                <label className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-3 h-3 text-purple-400" />
                  التحكم في الحواف
                </label>
                
                {/* Directions */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'top', icon: ChevronUp, label: 'أعلى' },
                    { id: 'bottom', icon: ChevronDown, label: 'أسفل' },
                    { id: 'left', icon: ChevronRight, label: 'يمين' },
                    { id: 'right', icon: ChevronLeft, label: 'يسار' }
                  ].map((dir) => (
                    <button
                      key={dir.id}
                      onClick={() => setEdgeSettings(prev => ({ ...prev, [dir.id]: !prev[dir.id as keyof typeof prev] }))}
                      className={`flex flex-col items-center gap-2 p-2 rounded-xl border transition-all ${
                        edgeSettings[dir.id as keyof typeof edgeSettings] 
                          ? 'bg-purple-500/20 border-purple-500/40 text-purple-400' 
                          : 'bg-white/5 border-white/5 text-slate-500'
                      }`}
                    >
                      <dir.icon className="w-4 h-4" />
                      <span className="text-[8px] font-bold">{dir.label}</span>
                    </button>
                  ))}
                </div>

                {/* Thickness & Smoothness */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold text-slate-400">
                      <span>سمك الحواف</span>
                      <span>{edgeSettings.thickness}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="50" 
                      value={edgeSettings.thickness} 
                      onChange={(e) => setEdgeSettings(prev => ({ ...prev, thickness: parseInt(e.target.value) }))}
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold text-slate-400">
                      <span>النعومة</span>
                      <span>{edgeSettings.smoothness}px</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={edgeSettings.smoothness} 
                      onChange={(e) => setEdgeSettings(prev => ({ ...prev, smoothness: parseInt(e.target.value) }))}
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                  </div>
                </div>

                {/* Transparent Edges Toggle */}
                <button
                  onClick={() => setEdgeSettings(prev => ({ ...prev, transparent: !prev.transparent }))}
                  className={`w-full py-3 rounded-2xl border flex items-center justify-center gap-2 transition-all text-[10px] font-black uppercase ${
                    edgeSettings.transparent 
                      ? 'bg-red-500/20 border-red-500/40 text-red-400' 
                      : 'bg-white/5 border-white/5 text-slate-500'
                  }`}
                >
                  <Trash2 className="w-3 h-3" />
                  حواف شفافة
                </button>
              </div>

              {/* Intensity & Opacity */}
              <div className="bg-white/5 p-5 rounded-3xl border border-white/5 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                      <Sliders className="w-3 h-3 text-emerald-400" />
                      شدة اللون (Fade / Enhance)
                    </label>
                    <input 
                      type="range" 
                      min="-1" 
                      max="1" 
                      step="0.01" 
                      value={intensity} 
                      onChange={(e) => setIntensity(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                      <Maximize className="w-3 h-3 text-orange-400" />
                      الشفافية الكلية
                    </label>
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.01" 
                      value={opacity} 
                      onChange={(e) => setOpacity(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={reset}
                  className="py-4 rounded-2xl bg-white/5 border border-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase"
                >
                  <RotateCcw className="w-4 h-4" />
                  إعادة تعيين
                </button>
                <button 
                  onClick={() => setImage(null)}
                  className="py-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase"
                >
                  <Trash2 className="w-4 h-4" />
                  حذف الصورة
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Preview */}
        <div className="lg:col-span-8">
          <div className="bg-black/40 rounded-[2.5rem] border border-white/5 p-6 h-full flex flex-col items-center justify-center relative overflow-hidden min-h-[500px]">
            {/* Checkerboard background for transparency preview */}
            <div className="absolute inset-0 -z-10 opacity-20" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 0)', backgroundSize: '20px 20px' }} />
            
            {image ? (
              <>
                <div className="relative max-w-full max-h-[600px] flex items-center justify-center">
                  <canvas 
                    ref={canvasRef} 
                    className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
                  />
                </div>
                
                {/* Export Buttons */}
                <div className="mt-8 flex gap-4">
                  <button 
                    onClick={() => handleExport('png')}
                    className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl flex items-center gap-3 transition-all shadow-lg shadow-blue-600/20 font-black text-xs uppercase tracking-widest"
                  >
                    <Download className="w-5 h-5" />
                    تصدير PNG (شفاف)
                  </button>
                  <button 
                    onClick={() => handleExport('jpg')}
                    className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl flex items-center gap-3 transition-all font-black text-xs uppercase tracking-widest border border-white/10"
                  >
                    <Download className="w-5 h-5" />
                    تصدير JPG
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center space-y-4">
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                  <ImageIcon className="w-10 h-10 text-slate-700" />
                </div>
                <p className="text-slate-500 text-sm font-medium">لا توجد صورة للمعاينة</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
