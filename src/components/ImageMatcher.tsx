
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
    
    // Set canvas size to base image size
    canvas.width = baseImage.width;
    canvas.height = baseImage.height;
    
    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw Working Image stretched to match base image dimensions
    if (workingImage) {
      ctx.drawImage(workingImage, 0, 0, baseImage.width, baseImage.height);
    } else {
      // If no working image, draw a placeholder or just clear
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#22c55e';
      ctx.setLineDash([10, 10]);
      ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
    }
    
  }, [baseImage, workingImage]);

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
      canvas.width = baseImage.width;
      canvas.height = baseImage.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Draw working image stretched to base dimensions
      ctx.drawImage(workingImage, 0, 0, baseImage.width, baseImage.height);
      
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `resized_${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
        
        if (currentUser) {
          logActivity(currentUser, 'feature_usage', `Image resized to match: ${baseImage.width}x${baseImage.height}`);
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

            <div className="pt-4 border-t border-white/5">
                <p className="text-[9px] text-slate-500 text-center leading-relaxed">
                    سيتم تلقائياً تغيير أبعاد الصورة في الخانة الزرقاء لتصبح مطابقة تماماً لأبعاد الصورة في الخانة الخضراء عند التصدير.
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
                    معاينة النتيجة النهائية ({baseImage.width}x{baseImage.height})
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
