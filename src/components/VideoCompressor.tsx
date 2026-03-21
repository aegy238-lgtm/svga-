
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { 
  Video, 
  Upload, 
  X, 
  Download, 
  Zap, 
  Check,
  RefreshCw,
  FileVideo,
  ArrowRight,
  ShieldCheck,
  BarChart3
} from 'lucide-react';
import { logActivity } from '../utils/logger';
import { UserRecord } from '../types';
import { useAccessControl } from '../hooks/useAccessControl';

interface VideoCompressorProps {
  currentUser: UserRecord | null;
  onCancel: () => void;
  onLoginRequired: () => void;
  onSubscriptionRequired: () => void;
}

export const VideoCompressor: React.FC<VideoCompressorProps> = ({ 
  currentUser, 
  onCancel, 
  onLoginRequired, 
  onSubscriptionRequired 
}) => {
  const { checkAccess } = useAccessControl();
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const [result, setResult] = useState<{ url: string; size: number; originalSize: number } | null>(null);
  const ffmpegRef = useRef(new FFmpeg());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [crf, setCrf] = useState('28');
  const [isDragging, setIsDragging] = useState(false);
  const [isCompatible, setIsCompatible] = useState<boolean | null>(null);

  useEffect(() => {
    // Check for SharedArrayBuffer (required for multi-threaded FFmpeg)
    // and basic browser compatibility
    const checkCompatibility = () => {
      const hasSAB = typeof SharedArrayBuffer !== 'undefined';
      const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost';
      
      if (!isSecure) {
        setError('⚠️ يجب تشغيل الموقع عبر بروتوكول آمن (HTTPS) لعمل محرك الضغط.');
        setIsCompatible(false);
      } else {
        setIsCompatible(true);
        if (!hasSAB) {
          console.warn('SharedArrayBuffer is not available. Compression will be slower (single-threaded).');
        }
      }
    };

    checkCompatibility();
    loadFfmpeg();
  }, []);

  const loadFfmpeg = async () => {
    if (ffmpegLoaded) return;
    
    setStatus('جاري تحميل محرك المعالجة (FFmpeg)...');
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    const ffmpeg = ffmpegRef.current;
    
    ffmpeg.on('log', ({ message }) => {
      console.log('FFmpeg:', message);
    });
    
    try {
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      setFfmpegLoaded(true);
      setStatus('');
    } catch (e) {
      console.error("FFmpeg load error:", e);
      setError('فشل تحميل محرك المعالجة. يرجى التأكد من اتصال الإنترنت وتحديث المتصفح.');
      setStatus('');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processSelectedFile(selectedFile);
    }
  };

  const processSelectedFile = (selectedFile: File) => {
    if (!selectedFile.type.startsWith('video/')) {
      alert("يرجى اختيار ملف فيديو صحيح.");
      return;
    }
    setFile(selectedFile);
    setResult(null);
    setProgress(0);
    setStatus('جاهز للضغط...');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      processSelectedFile(droppedFile);
    }
  };

  const compressVideo = async (videoFile: File) => {
    if (!videoFile || isProcessing) return;

    if (!currentUser) {
      onLoginRequired();
      return;
    }

    const { allowed } = await checkAccess('Video Compression');
    if (!allowed) {
      onSubscriptionRequired();
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setStatus('جاري تحضير الملف...');

    try {
      if (!ffmpegLoaded) await loadFfmpeg();
      const ffmpeg = ffmpegRef.current;

      ffmpeg.on('progress', ({ progress }) => {
        setProgress(Math.round(progress * 100));
      });

      const inputName = 'input_file';
      const outputName = 'output.mp4';
      
      const fileData = await fetchFile(videoFile);
      await ffmpeg.writeFile(inputName, fileData);

      setStatus('جاري الضغط والتحويل (قد يستغرق وقتاً)...');

      // Professional Compression Parameters
      // -crf: Quality setting (23=High, 28=Medium, 32=Low)
      // -preset fast: Balance of speed and compression
      await ffmpeg.exec([
        '-i', inputName,
        '-vcodec', 'libx264',
        '-crf', crf,
        '-preset', 'fast',
        '-acodec', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        '-threads', '0',
        outputName
      ]);

      setStatus('جاري قراءة الملف الناتج...');
      const data = await ffmpeg.readFile(outputName);
      const compressedBlob = new Blob([data], { type: 'video/mp4' });
      
      if (compressedBlob.size === 0) {
        throw new Error("فشل الضغط: الملف الناتج فارغ.");
      }

      const url = URL.createObjectURL(compressedBlob);

      setResult({
        url,
        size: compressedBlob.size,
        originalSize: videoFile.size
      });

      setStatus('تم ضغط الفيديو بنجاح!');

      if (currentUser) {
        logActivity(currentUser, 'feature_usage', `Compressed video: ${videoFile.name} (CRF: ${crf}, ${(videoFile.size / 1024 / 1024).toFixed(2)}MB -> ${(compressedBlob.size / 1024 / 1024).toFixed(2)}MB)`);
      }

      // Cleanup
      try {
        await ffmpeg.deleteFile(inputName);
        await ffmpeg.deleteFile(outputName);
      } catch (cleanupError) {
        console.warn("Cleanup failed:", cleanupError);
      }

    } catch (e) {
      console.error('Compression Error:', e);
      setStatus('حدث خطأ أثناء المعالجة.');
      alert("حدث خطأ أثناء ضغط الفيديو. يرجى التأكد من أن الفيديو غير محمي وبصيغة مدعومة.");
    } finally {
      setIsProcessing(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const reductionPercentage = result 
    ? Math.round(((result.originalSize - result.size) / result.originalSize) * 100)
    : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tighter flex items-center gap-3">
            <Zap className="w-8 h-8 text-indigo-500" />
            ضاغط الفيديو الذكي (Pro)
          </h2>
          <p className="text-slate-400 text-sm mt-1">ضغط وتحويل أي فيديو إلى MP4 بجودة عالية وخصوصية تامة</p>
        </div>
        <button 
          onClick={onCancel}
          className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-slate-400 hover:text-white transition-all"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-red-400 text-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <X className="w-5 h-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Upload Section */}
        <div className="md:col-span-2 space-y-6">
          {!file ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`bg-slate-900/40 border-2 border-dashed rounded-[2.5rem] p-12 flex flex-col items-center justify-center gap-6 cursor-pointer transition-all group min-h-[400px] ${
                isDragging ? 'border-indigo-500 bg-indigo-500/10 scale-[0.98]' : 'border-white/5 hover:border-indigo-500/30'
              }`}
            >
              <div className="w-20 h-20 bg-indigo-500/10 rounded-3xl flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                <Upload className="w-10 h-10 text-indigo-500" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold text-white">اختر فيديو للضغط والتحويل</h3>
                <p className="text-slate-500 text-sm">اسحب وأفلت الفيديو هنا أو اضغط للاختيار</p>
                <p className="text-indigo-400 text-[10px] font-bold">يدعم جميع الصيغ (MOV, AVI, MKV, etc) ويحولها إلى MP4</p>
              </div>
              <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-slate-500">
                <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> جودة عالية</span>
                <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> ضغط ذكي</span>
                <span className="flex items-center gap-1"><FileVideo className="w-3 h-3" /> تحويل MP4</span>
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="video/*" 
                onChange={handleFileChange} 
              />
            </div>
          ) : (
            <div className="bg-slate-900/60 border border-white/5 rounded-[2.5rem] p-8 space-y-8 backdrop-blur-xl relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center">
                    <FileVideo className="w-6 h-6 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white truncate max-w-[250px]">{file.name}</h3>
                    <p className="text-slate-400 text-xs">{formatSize(file.size)}</p>
                  </div>
                </div>
                {!isProcessing && (
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-2xl border border-white/10">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">الجودة:</label>
                      <select 
                        value={crf}
                        onChange={(e) => setCrf(e.target.value)}
                        className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer"
                      >
                        <option value="23" className="bg-slate-900">عالية (23)</option>
                        <option value="28" className="bg-slate-900">متوسطة (28)</option>
                        <option value="32" className="bg-slate-900">منخفضة (32)</option>
                      </select>
                    </div>
                    <button 
                      onClick={() => { setFile(null); setResult(null); setStatus(''); }}
                      className="p-2 hover:bg-white/5 rounded-xl text-slate-500 hover:text-red-400 transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>

              {isProcessing ? (
                <div className="space-y-6 py-10">
                  <div className="flex flex-col items-center justify-center gap-4">
                    <div className="relative">
                      <RefreshCw className="w-16 h-16 text-indigo-500 animate-spin opacity-20" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xl font-black text-white">{progress}%</span>
                      </div>
                    </div>
                    <div className="text-center">
                      <h4 className="text-lg font-bold text-white">{status || 'جاري المعالجة...'}</h4>
                      <p className="text-slate-500 text-xs mt-1">يرجى عدم إغلاق الصفحة حتى اكتمال العملية</p>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.5)]"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              ) : result ? (
                <div className="space-y-8 animate-in fade-in zoom-in duration-500">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 rounded-3xl p-6 border border-white/5 space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">الحجم الأصلي</p>
                      <p className="text-2xl font-black text-white">{formatSize(result.originalSize)}</p>
                    </div>
                    <div className="bg-indigo-500/10 rounded-3xl p-6 border border-indigo-500/20 space-y-2 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-3">
                        <Zap className="w-4 h-4 text-indigo-400 opacity-30" />
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400">الحجم الجديد</p>
                      <p className="text-2xl font-black text-white">{formatSize(result.size)}</p>
                    </div>
                  </div>

                  <div className="bg-green-500/10 border border-green-500/20 rounded-3xl p-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
                        <BarChart3 className="w-5 h-5 text-green-400" />
                      </div>
                      <div>
                        <p className="text-green-400 font-black text-lg">تم توفير {reductionPercentage}%</p>
                        <p className="text-slate-400 text-xs">تم تقليل المساحة مع الحفاظ على الجودة</p>
                      </div>
                    </div>
                    <Check className="w-6 h-6 text-green-500" />
                  </div>

                  <div className="flex gap-4">
                    <a 
                      href={result.url}
                      download={`compressed_${file.name}`}
                      className="flex-1 py-5 bg-indigo-500 hover:bg-indigo-400 text-white font-black rounded-2xl shadow-xl shadow-indigo-500/20 flex items-center justify-center gap-3 transition-all active:scale-95 text-sm uppercase tracking-widest"
                    >
                      <Download className="w-5 h-5" />
                      تحميل الفيديو المضغوط
                    </a>
                    <button 
                      onClick={() => { setFile(null); setResult(null); }}
                      className="px-8 py-5 bg-white/5 hover:bg-white/10 text-white font-black rounded-2xl border border-white/10 transition-all active:scale-95 text-sm"
                    >
                      ضغط فيديو آخر
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-10 flex flex-col items-center justify-center gap-6">
                  <div className="w-20 h-20 bg-indigo-500/10 rounded-3xl flex items-center justify-center">
                    <FileVideo className="w-10 h-10 text-indigo-400" />
                  </div>
                  <div className="text-center">
                    <h4 className="text-lg font-bold text-white">جاهز للضغط</h4>
                    <p className="text-slate-500 text-sm mt-1">اضغط على الزر أدناه لبدء العملية</p>
                  </div>
                  <button 
                    onClick={() => compressVideo(file)}
                    className="px-12 py-4 bg-indigo-500 hover:bg-indigo-400 text-white font-black rounded-2xl shadow-xl shadow-indigo-500/20 flex items-center justify-center gap-3 transition-all active:scale-95"
                  >
                    <Zap className="w-5 h-5" />
                    ابدأ الضغط الآن
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Info Sidebar */}
        <div className="space-y-6">
          <div className="bg-slate-900/60 border border-white/5 rounded-[2.5rem] p-6 space-y-6 backdrop-blur-xl">
            <h4 className="text-xs font-black uppercase tracking-widest text-indigo-500 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              مميزات الأداة
            </h4>
            <ul className="space-y-4">
              {[
                { title: 'الحفاظ على الجودة', desc: 'استخدام خوارزميات ضغط ذكية تحافظ على تفاصيل الفيديو.' },
                { title: 'توفير المساحة', desc: 'تقليل حجم الملف بنسبة تصل إلى 80% في بعض الحالات.' },
                { title: 'خصوصية تامة', desc: 'تتم عملية الضغط بالكامل داخل متصفحك ولا يتم رفع الفيديو لخوادمنا.' },
                { title: 'دعم MP4', desc: 'الفيديو الناتج متوافق مع جميع الأجهزة ومنصات التواصل.' }
              ].map((item, i) => (
                <li key={i} className="flex gap-3 group">
                  <div className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-500 group-hover:scale-150 transition-transform" />
                  <div>
                    <p className="text-xs font-bold text-white">{item.title}</p>
                    <p className="text-[10px] text-slate-500 leading-relaxed mt-0.5">{item.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-[2.5rem] p-6 space-y-4">
            <div className="flex items-center gap-3 text-indigo-400">
              <Zap className="w-5 h-5" />
              <span className="text-xs font-black uppercase tracking-widest">نصيحة ذكية</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              للحصول على أفضل النتائج، تأكد من أن الفيديو الأصلي بجودة جيدة. الضغط يعمل بشكل أفضل مع الفيديوهات ذات الحجم الكبير والمدة الطويلة.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper for Trash icon which was missing in imports
const Trash2 = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);
