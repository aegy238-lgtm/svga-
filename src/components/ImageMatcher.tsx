
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserRecord } from '../types';
import { 
  Image as ImageIcon, 
  Upload, 
  X, 
  Download, 
  Maximize, 
  Move, 
  Settings2,
  Check,
  Layers,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';
import { logActivity } from '../utils/logger';
import { useAccessControl } from '../hooks/useAccessControl';

interface ImageMatcherProps {
  currentUser: UserRecord | null;
  onCancel: () => void;
  onLoginRequired: () => void;
  onSubscriptionRequired: () => void;
}

export const ImageMatcher: React.FC<ImageMatcherProps> = ({ 
  currentUser, 
  onCancel, 
  onLoginRequired, 
  onSubscriptionRequired 
}) => {
  const { checkAccess } = useAccessControl();
  
  const [baseImage, setBaseImage] = useState<HTMLImageElement | null>(null);
  const [workingImage, setWorkingImage] = useState<HTMLImageElement | null>(null);
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const [scale, setScale] = useState(1.0);
  const [manualPos, setManualPos] = useState({ x: 0, y: 0 });
  const [manualScale, setManualScale] = useState(1.0);
  const [mergeWithBase, setMergeWithBase] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseInputRef = useRef<HTMLInputElement>(null);
  const workingInputRef = useRef<HTMLInputElement>(null);

  const handleBaseUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setBaseImage(img);
      // Center manual position when new base image is uploaded
      setManualPos({ x: 0, y: 0 });
      setManualScale(1.0);
    };
    img.src = url;
  };

  const handleWorkingUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setWorkingImage(img);
    };
    img.src = url;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !baseImage) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas size to base image size * scale
    canvas.width = baseImage.width * scale;
    canvas.height = baseImage.height * scale;
    
    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw Base Image as background
    if (mergeWithBase || mode === 'manual' || !workingImage) {
      ctx.globalAlpha = (mode === 'manual' && !mergeWithBase) ? 0.3 : 1.0;
      ctx.drawImage(baseImage, 0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1.0;
    }
    
    if (workingImage) {
      if (mode === 'auto') {
        // Draw Working Image stretched to match base image dimensions * scale
        ctx.drawImage(workingImage, 0, 0, canvas.width, canvas.height);
      } else {
        // Manual Mode: Draw working image with its own transform
        const w = workingImage.width * manualScale * scale;
        const h = workingImage.height * manualScale * scale;
        const x = (canvas.width / 2) - (w / 2) + (manualPos.x * scale);
        const y = (canvas.height / 2) - (h / 2) + (manualPos.y * scale);
        ctx.drawImage(workingImage, x, y, w, h);
      }
    } else {
      // If no working image, draw a placeholder
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#22c55e';
      ctx.setLineDash([10, 10]);
      ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
    }
    
  }, [baseImage, workingImage, scale, mode, manualPos, manualScale]);

  const handleExport = async () => {
    if (!baseImage || !workingImage) return;
    
    if (!currentUser) {
      onLoginRequired();
      return;
    }

    const { allowed } = await checkAccess('Image Matching');
    if (!allowed) {
      onSubscriptionRequired();
      return;
    }

    setIsExporting(true);
    
    try {
      const canvas = document.createElement('canvas');
      canvas.width = baseImage.width * scale;
      canvas.height = baseImage.height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Draw base image first if merging
      if (mergeWithBase) {
        ctx.drawImage(baseImage, 0, 0, canvas.width, canvas.height);
      }
      
      if (mode === 'auto') {
        ctx.drawImage(workingImage, 0, 0, canvas.width, canvas.height);
      } else {
        const w = workingImage.width * manualScale * scale;
        const h = workingImage.height * manualScale * scale;
        const x = (canvas.width / 2) - (w / 2) + (manualPos.x * scale);
        const y = (canvas.height / 2) - (h / 2) + (manualPos.y * scale);
        ctx.drawImage(workingImage, x, y, w, h);
      }
      
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `resized_${mode}_${mergeWithBase ? 'merged_' : ''}${Math.round(scale * 100)}_${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
        
        if (currentUser) {
          logActivity(currentUser, 'feature_usage', `Image matched (${mode}): ${canvas.width}x${canvas.height}`);
        }
      }
    } catch (e) {
      console.error(e);
      alert("فشل التصدير");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tighter flex items-center gap-3">
            <ImageIcon className="w-8 h-8 text-green-500" />
            مطابق مقاسات الصور التلقائي
          </h2>
          <p className="text-slate-400 text-sm mt-1">تغيير مقاسات الصورة تلقائياً لتطابق أبعاد الصورة المرجعية</p>
        </div>
        <button 
          onClick={onCancel}
          className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-slate-400 hover:text-white transition-all"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Controls Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-900/60 border border-white/5 rounded-[2.5rem] p-6 space-y-6 shadow-2xl backdrop-blur-xl">
            {/* Mode Switcher */}
            <div className="flex gap-2 p-1 bg-white/5 rounded-2xl border border-white/5">
              <button 
                onClick={() => setMode('auto')}
                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${mode === 'auto' ? 'bg-sky-500 text-white shadow-glow-sky' : 'text-slate-400 hover:text-white'}`}
              >
                <Maximize className="w-3.5 h-3.5" />
                تلقائي
              </button>
              <button 
                onClick={() => setMode('manual')}
                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${mode === 'manual' ? 'bg-sky-500 text-white shadow-glow-sky' : 'text-slate-400 hover:text-white'}`}
              >
                <Move className="w-3.5 h-3.5" />
                يدوي
              </button>
            </div>

            {/* Uploads */}
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-green-500 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                  الخانة الخضراء (الصورة المرجعية)
                </label>
                <button 
                  onClick={() => baseInputRef.current?.click()}
                  className={`w-full py-6 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center gap-3 ${baseImage ? 'border-green-500 bg-green-500/10' : 'border-green-500/30 hover:border-green-500/50 bg-green-500/5'}`}
                >
                  <Upload className={`w-6 h-6 ${baseImage ? 'text-green-500' : 'text-green-400'}`} />
                  <span className="text-[10px] font-bold text-green-400">{baseImage ? 'تم رفع المرجع' : 'رفع الصورة المرجعية'}</span>
                  {baseImage && <span className="text-[8px] text-green-500/70 font-mono">{baseImage.width}x{baseImage.height}</span>}
                </button>
                <input type="file" ref={baseInputRef} className="hidden" accept="image/*" onChange={handleBaseUpload} />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-sky-500 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
                  الخانة الزرقاء (الصورة المراد تعديلها)
                </label>
                <button 
                  onClick={() => workingInputRef.current?.click()}
                  className={`w-full py-6 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center gap-3 ${workingImage ? 'border-sky-500 bg-sky-500/10' : 'border-sky-500/30 hover:border-sky-500/50 bg-sky-500/5'}`}
                >
                  <Upload className={`w-6 h-6 ${workingImage ? 'text-sky-500' : 'text-sky-400'}`} />
                  <span className="text-[10px] font-bold text-sky-400">{workingImage ? 'تم رفع الصورة' : 'رفع الصورة للتعديل'}</span>
                  {workingImage && <span className="text-[8px] text-sky-500/70 font-mono">{workingImage.width}x{workingImage.height}</span>}
                </button>
                <input type="file" ref={workingInputRef} className="hidden" accept="image/*" onChange={handleWorkingUpload} />
              </div>
            </div>

            {/* Merge Option */}
            <div className="pt-4 border-t border-white/5">
              <button 
                onClick={() => setMergeWithBase(!mergeWithBase)}
                className={`w-full py-4 rounded-2xl border transition-all flex items-center justify-between px-4 ${mergeWithBase ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
              >
                <div className="flex items-center gap-3">
                  <Layers className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">دمج الصورتين معاً</span>
                </div>
                <div className={`w-8 h-4 rounded-full relative transition-all ${mergeWithBase ? 'bg-green-500' : 'bg-slate-700'}`}>
                  <div className={`absolute top-1 w-2 h-2 bg-white rounded-full transition-all ${mergeWithBase ? 'right-1' : 'right-5'}`}></div>
                </div>
              </button>
            </div>

            {/* Manual Controls */}
            {mode === 'manual' && workingImage && (
              <div className="space-y-4 pt-4 border-t border-white/5 animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="text-[10px] font-black uppercase tracking-widest text-sky-500 flex items-center gap-2">
                  <Move className="w-3 h-3" />
                  التحكم اليدوي بالصورة
                </label>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-slate-400 font-bold">الحجم (Zoom)</span>
                    <span className="text-[9px] font-mono text-sky-500">{Math.round(manualScale * 100)}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.1" 
                    max="5" 
                    step="0.01" 
                    value={manualScale} 
                    onChange={(e) => setManualScale(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-sky-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <span className="text-[9px] text-slate-400 font-bold">أفقي (X)</span>
                    <input 
                      type="number" 
                      value={manualPos.x} 
                      onChange={(e) => setManualPos(prev => ({ ...prev, x: parseInt(e.target.value) || 0 }))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[10px] font-mono text-white focus:outline-none focus:border-sky-500/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <span className="text-[9px] text-slate-400 font-bold">رأسي (Y)</span>
                    <input 
                      type="number" 
                      value={manualPos.y} 
                      onChange={(e) => setManualPos(prev => ({ ...prev, y: parseInt(e.target.value) || 0 }))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[10px] font-mono text-white focus:outline-none focus:border-sky-500/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => setManualScale(0.5)} className={`p-2 rounded-lg text-[9px] font-bold transition-all ${manualScale === 0.5 ? 'bg-sky-500 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>50%</button>
                  <button onClick={() => setManualScale(1.0)} className={`p-2 rounded-lg text-[9px] font-bold transition-all ${manualScale === 1.0 ? 'bg-sky-500 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>100%</button>
                  <button onClick={() => setManualScale(2.0)} className={`p-2 rounded-lg text-[9px] font-bold transition-all ${manualScale === 2.0 ? 'bg-sky-500 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>200%</button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => setManualPos(p => ({ ...p, x: p.x - 10 }))} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-bold text-slate-400">يسار</button>
                  <div className="flex flex-col gap-2">
                    <button onClick={() => setManualPos(p => ({ ...p, y: p.y - 10 }))} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-bold text-slate-400">فوق</button>
                    <button onClick={() => setManualPos(p => ({ ...p, y: p.y + 10 }))} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-bold text-slate-400">تحت</button>
                  </div>
                  <button onClick={() => setManualPos(p => ({ ...p, x: p.x + 10 }))} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-bold text-slate-400">يمين</button>
                </div>

                <button 
                  onClick={() => { setManualPos({ x: 0, y: 0 }); setManualScale(1.0); }}
                  className="w-full py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[9px] font-bold text-slate-400 transition-all"
                >
                  إعادة ضبط الموقع
                </button>
              </div>
            )}

            {/* Scale Control */}
            <div className="space-y-3 pt-4 border-t border-white/5">
              <label className="text-[10px] font-black uppercase tracking-widest text-amber-500 flex items-center gap-2">
                <Settings2 className="w-3 h-3" />
                حجم التصدير (Scale)
              </label>
              <div className="flex items-center gap-3 bg-white/5 p-3 rounded-2xl border border-white/5">
                <input 
                  type="range" 
                  min="0.1" 
                  max="2" 
                  step="0.01" 
                  value={scale} 
                  onChange={(e) => setScale(parseFloat(e.target.value))}
                  className="flex-1 h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-amber-500"
                />
                <span className="text-[10px] font-mono text-amber-500 w-12 text-center">
                  {Math.round(scale * 100)}%
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button 
                  onClick={() => setScale(1.0)}
                  className={`flex-1 py-2 rounded-xl text-[9px] font-bold transition-all ${scale === 1.0 ? 'bg-amber-500 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                >
                  100%
                </button>
                <button 
                  onClick={() => setScale(0.9)}
                  className={`flex-1 py-2 rounded-xl text-[9px] font-bold transition-all ${scale === 0.9 ? 'bg-amber-500 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                >
                  90%
                </button>
                <button 
                  onClick={() => setScale(0.8)}
                  className={`flex-1 py-2 rounded-xl text-[9px] font-bold transition-all ${scale === 0.8 ? 'bg-amber-500 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                >
                  80%
                </button>
                <button 
                  onClick={() => setScale(0.75)}
                  className={`flex-1 py-2 rounded-xl text-[9px] font-bold transition-all ${scale === 0.75 ? 'bg-amber-500 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                >
                  75%
                </button>
                <button 
                  onClick={() => setScale(0.5)}
                  className={`flex-1 py-2 rounded-xl text-[9px] font-bold transition-all ${scale === 0.5 ? 'bg-amber-500 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                >
                  50%
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-white/5">
                <p className="text-[9px] text-slate-500 text-center leading-relaxed">
                    {mode === 'auto' 
                      ? `سيتم تلقائياً تغيير أبعاد الصورة في الخانة الزرقاء لتصبح مطابقة لأبعاد الصورة المرجعية${mergeWithBase ? " ودمجهما معاً" : ""} عند التصدير.`
                      : `في الوضع اليدوي، يمكنك تحريك وتكبير/تصغير الصورة بحرية فوق الخلفية المرجعية. سيتم التصدير${mergeWithBase ? " مدمجاً مع الخلفية" : " كصورة منفصلة"} بأبعاد الصورة المرجعية.`
                    }
                </p>
            </div>

            <button 
              onClick={handleExport}
              disabled={!baseImage || !workingImage || isExporting}
              className={`w-full py-5 rounded-3xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 transition-all ${(!baseImage || !workingImage) ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-sky-500 hover:bg-sky-400 text-white shadow-glow-sky active:scale-95'}`}
            >
              {isExporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              تصدير بالمقاسات الجديدة
            </button>
          </div>
        </div>

        {/* Preview Area */}
        <div className="lg:col-span-3">
          <div className="bg-slate-950/40 border border-white/5 rounded-[3rem] p-8 min-h-[600px] flex items-center justify-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-grid-white/[0.02] -z-10"></div>
            
            {!baseImage ? (
              <div className="text-center space-y-4">
                <div className="w-20 h-20 bg-green-500/10 rounded-3xl flex items-center justify-center mx-auto border border-green-500/20">
                  <ImageIcon className="w-10 h-10 text-green-500" />
                </div>
                <h3 className="text-xl font-bold text-white">بانتظار الصورة المرجعية</h3>
                <p className="text-slate-500 text-sm max-w-xs mx-auto">ارفع الصورة التي تريد أخذ مقاساتها في الخانة الخضراء</p>
              </div>
            ) : (
              <div className="relative max-w-full max-h-full overflow-auto custom-scrollbar p-4 flex flex-col items-center gap-4">
                <div className="bg-green-500/20 border border-green-500/30 px-4 py-2 rounded-full text-[10px] font-black text-green-400 uppercase tracking-widest">
                    معاينة النتيجة {mergeWithBase ? "المدمجة" : "النهائية"} ({Math.round(baseImage.width * scale)}x{Math.round(baseImage.height * scale)})
                </div>
                <canvas 
                  ref={canvasRef} 
                  className="max-w-full h-auto shadow-2xl rounded-lg bg-black/20 border border-white/10"
                  style={{ 
                    maxHeight: '70vh',
                    objectFit: 'contain'
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
