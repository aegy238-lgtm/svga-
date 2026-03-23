import React, { useState, useRef } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { Upload, CheckCircle2 } from 'lucide-react';

export const ConverterPage: React.FC<{ onCancel: () => void }> = ({ onCancel }) => {
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const [previewFile, setPreviewFile] = useState<{file: File, url: string, type: string, name: string} | null>(null);
  const [convertSource, setConvertSource] = useState('SVGA 2.0');
  const [convertTarget, setConvertTarget] = useState('Lottie (JSON)');
  const [isProcessingVideo, setIsProcessingVideo] = useState(false);
  const [exportResult, setExportResult] = useState<{ url: string; filename: string } | null>(null);
  const ffmpegRef = useRef(new FFmpeg());
  const aeJsonInputRef = useRef<HTMLInputElement>(null);

  const availableFormats = [
    'SVGA 2.0', 'SVGA 2.0 EX', 'VAP (MP4)', 'GIF (Animation)', 
    'WebP (Animated)', 'APNG (Animation)', 'WebM (Video)', 
    'Image Sequence', 'Lottie (JSON)'
  ];

  const handlePreviewFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const url = URL.createObjectURL(file);
    const type = file.type;
    setPreviewFile({ file, url, type, name: file.name });
  };

  const handleConvert = async () => {
    if (!previewFile) {
      alert('يرجى رفع ملف أولاً.');
      return;
    }
    
    if (!ffmpegLoaded) {
      alert('جاري تحميل محرك التحويل، يرجى الانتظار...');
      return;
    }

    setIsProcessingVideo(true);
    try {
      const ffmpeg = ffmpegRef.current;
      await ffmpeg.writeFile(previewFile.name, await fetchFile(previewFile.file));
      
      const outputName = `converted_${previewFile.name.split('.')[0]}.${convertTarget.toLowerCase().includes('json') ? 'json' : 'png'}`;
      
      await ffmpeg.exec(['-i', previewFile.name, outputName]);
      
      const data = await ffmpeg.readFile(outputName);
      const blob = new Blob([data], { type: convertTarget.toLowerCase().includes('json') ? 'application/json' : 'image/png' });
      const url = URL.createObjectURL(blob);
      
      setExportResult({ url, filename: outputName });
      alert('تم التحويل بنجاح!');
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء التحويل.');
    } finally {
      setIsProcessingVideo(false);
    }
  };

  return (
    <div className="p-6 bg-slate-900/50 rounded-2xl border border-white/10">
      <h2 className="text-2xl font-black text-white mb-6">محول الصيغ والمعاينة</h2>
      
      <div className="flex gap-4 mb-6">
        <input type="file" onChange={handlePreviewFile} className="hidden" ref={aeJsonInputRef} />
        <button onClick={() => aeJsonInputRef.current?.click()} className="px-6 py-3 bg-sky-600 text-white rounded-xl font-bold">
          اختيار ملف
        </button>
      </div>

      {previewFile && (
        <div className="mb-6">
          <div className="aspect-video bg-black/40 rounded-xl flex items-center justify-center overflow-hidden relative border-4 border-slate-700 shadow-2xl">
            <div className="absolute top-2 left-2 bg-black/50 px-2 py-1 rounded text-[8px] text-white">Simulator: App View</div>
            {previewFile.type.startsWith('image/') && <img src={previewFile.url} className="max-w-full max-h-full object-contain" />}
            {previewFile.type.startsWith('video/') && <video src={previewFile.url} controls className="max-w-full max-h-full" />}
          </div>
        </div>
      )}

      <div className="flex gap-4 mb-6">
        <select value={convertSource} onChange={(e) => setConvertSource(e.target.value)} className="bg-slate-800 text-white p-3 rounded-xl">
          {availableFormats.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <select value={convertTarget} onChange={(e) => setConvertTarget(e.target.value)} className="bg-slate-800 text-white p-3 rounded-xl">
          {availableFormats.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <button onClick={handleConvert} disabled={isProcessingVideo} className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold">
          {isProcessingVideo ? 'جاري التحويل...' : 'بدء التحويل'}
        </button>
      </div>
    </div>
  );
};
