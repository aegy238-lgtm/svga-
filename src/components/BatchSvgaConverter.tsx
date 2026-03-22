
import React, { useState, useRef, useEffect } from 'react';
import { UserRecord, AppSettings } from '../types';
import { useAccessControl } from '../hooks/useAccessControl';
import { Download, Trash2, Upload, Play, Check, X, Layers, Settings, RefreshCw, Video, FileVideo } from 'lucide-react';
import * as Mp4Muxer from 'mp4-muxer';

import { calculateSafeDimensions } from '../utils/dimensions';

declare var SVGA: any;
declare var JSZip: any;
declare var VideoEncoder: any;
declare var VideoFrame: any;

interface SvgaFile {
  file: File;
  id: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  progress: number;
  error?: string;
  resultBlob?: Blob;
  resultUrl?: string;
}

interface BatchSvgaConverterProps {
  onCancel: () => void;
  currentUser: UserRecord | null;
  settings: AppSettings | null;
  onLoginRequired: () => void;
  onSubscriptionRequired: () => void;
  initialFiles?: File[];
}

export const BatchSvgaConverter: React.FC<BatchSvgaConverterProps> = ({ onCancel, currentUser, settings, onLoginRequired, onSubscriptionRequired, initialFiles }) => {
  const { checkAccess } = useAccessControl();
  const [files, setFiles] = useState<SvgaFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [exportFormat, setExportFormat] = useState<'mp4' | 'vap'>('mp4');
  const [quality, setQuality] = useState<'low' | 'medium' | 'high'>('high');
  const [scale, setScale] = useState<number>(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      const svgaFiles = initialFiles.filter(f => f.name.toLowerCase().endsWith('.svga'));
      const newFiles: SvgaFile[] = svgaFiles.map(file => ({
        file,
        id: Math.random().toString(36).substring(2, 11) + Date.now(),
        status: 'pending',
        progress: 0
      }));
      setFiles(newFiles);
    }
  }, [initialFiles]);

  useEffect(() => {
    return () => {
      files.forEach(f => {
        if (f.resultUrl) URL.revokeObjectURL(f.resultUrl);
      });
    };
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []) as File[];
    const svgaFiles = selectedFiles.filter(f => f.name.toLowerCase().endsWith('.svga'));
    
    const newFiles: SvgaFile[] = svgaFiles.map(file => ({
      file,
      id: Math.random().toString(36).substring(2, 11) + Date.now(),
      status: 'pending',
      progress: 0
    }));

    setFiles(prev => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (id: string) => {
    setFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file?.resultUrl) URL.revokeObjectURL(file.resultUrl);
      return prev.filter(f => f.id !== id);
    });
  };

  const processAll = async () => {
    if (isProcessing) return;
    
    const hasAccess = await checkAccess('svgaProcess');
    if (!hasAccess) {
      if (!currentUser) onLoginRequired();
      else onSubscriptionRequired();
      return;
    }

    setIsProcessing(true);
    
    for (let i = 0; i < files.length; i++) {
      if (files[i].status === 'done') continue;
      
      try {
        await processFile(files[i].id);
      } catch (err) {
        console.error(`Error processing ${files[i].file.name}:`, err);
        setFiles(prev => prev.map(f => f.id === files[i].id ? { ...f, status: 'error', error: String(err) } : f));
      }
    }
    
    setIsProcessing(false);
  };

  const processFile = async (id: string) => {
    const fileObj = files.find(f => f.id === id);
    if (!fileObj) return;

    setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'processing', progress: 0 } : f));

    return new Promise<void>(async (resolve, reject) => {
      try {
        const parser = new SVGA.Parser();
        const data = await fileObj.file.arrayBuffer();
        const videoItem = await new Promise<any>((res, rej) => {
          parser.do(data, (videoItem: any) => res(videoItem), (err: any) => rej(err));
        });

        const fps = videoItem.FPS || 30;
        const totalFrames = videoItem.frames;
        
        // Ensure even dimensions using utility
        const rawWidth = videoItem.videoSize?.width || 1334;
        const rawHeight = videoItem.videoSize?.height || 750;
        
        const safe = calculateSafeDimensions(rawWidth * scale, rawHeight * scale);
        let width = safe.width;
        let height = safe.height;

        const exportWidth = exportFormat === 'vap' ? width * 2 : width;
        const exportHeight = height;

        // Setup Canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const vapCanvas = exportFormat === 'vap' ? document.createElement('canvas') : null;
        if (vapCanvas) {
          vapCanvas.width = exportWidth;
          vapCanvas.height = exportHeight;
        }
        const vCtx = vapCanvas?.getContext('2d');

        // Setup Player
        const playerDiv = document.createElement('div');
        playerDiv.style.width = `${width}px`;
        playerDiv.style.height = `${height}px`;
        playerDiv.style.position = 'fixed';
        playerDiv.style.left = '-9999px';
        document.body.appendChild(playerDiv);

        const player = new SVGA.Player(playerDiv);
        player.setVideoItem(videoItem);
        
        // Setup Muxer
        const muxer = new Mp4Muxer.Muxer({
          target: new Mp4Muxer.ArrayBufferTarget(),
          video: {
            codec: 'avc',
            width: exportWidth,
            height: exportHeight,
            frameRate: fps
          },
          fastStart: 'in-memory'
        });

        // Setup Encoder
        let bitrate = 8000000;
        if (quality === 'low') bitrate = 4000000;
        if (quality === 'high') bitrate = 12000000;
        if (exportFormat === 'vap') bitrate *= 1.5;

        const videoEncoder = new VideoEncoder({
          output: (chunk: any, meta: any) => muxer.addVideoChunk(chunk, meta),
          error: (e: any) => {
            console.error("VideoEncoder error:", e);
            reject(e);
          }
        });

        const videoConfig: any = {
          codec: 'avc1.640033', // High Profile 5.1
          width: exportWidth,
          height: exportHeight,
          bitrate: bitrate,
          framerate: fps,
          latencyMode: 'quality',
          avc: { format: 'avc' }
        };

        const support = await VideoEncoder.isConfigSupported(videoConfig);
        if (!support.supported) {
          videoConfig.codec = 'avc1.4d0028'; // Main 4.0
        }
        
        videoEncoder.configure(videoConfig);

        // Process Frames
        for (let i = 0; i < totalFrames; i++) {
          player.stepToFrame(i, true);
          
          // Wait for render
          await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
          
          const sourceCanvas = playerDiv.querySelector('canvas');
          if (sourceCanvas) {
            if (exportFormat === 'vap' && vCtx) {
              // RGB on left, Alpha on right
              vCtx.clearRect(0, 0, exportWidth, exportHeight);
              
              // Draw RGB
              vCtx.globalCompositeOperation = 'source-over';
              vCtx.fillStyle = '#000';
              vCtx.fillRect(0, 0, width, height);
              vCtx.drawImage(sourceCanvas, 0, 0, width, height);
              
              // Draw Alpha
              vCtx.save();
              vCtx.translate(width, 0);
              vCtx.drawImage(sourceCanvas, 0, 0, width, height);
              vCtx.globalCompositeOperation = 'source-in';
              vCtx.fillStyle = '#fff';
              vCtx.fillRect(0, 0, width, height);
              vCtx.restore();
              
              const frame = new VideoFrame(vapCanvas!, { timestamp: (i * 1000000) / fps });
              videoEncoder.encode(frame);
              frame.close();
            } else {
              // Standard MP4 (Black background for transparency)
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.fillStyle = '#000';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(sourceCanvas, 0, 0, width, height);
                const frame = new VideoFrame(canvas, { timestamp: (i * 1000000) / fps });
                videoEncoder.encode(frame);
                frame.close();
              }
            }
          }

          const prog = Math.round(((i + 1) / totalFrames) * 100);
          setFiles(prev => prev.map(f => f.id === id ? { ...f, progress: prog } : f));
        }

        await videoEncoder.flush();
        muxer.finalize();
        
        const { buffer } = muxer.target as Mp4Muxer.ArrayBufferTarget;
        const blob = new Blob([buffer], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);

        setFiles(prev => prev.map(f => f.id === id ? { 
          ...f, 
          status: 'done', 
          progress: 100, 
          resultBlob: blob, 
          resultUrl: url 
        } : f));

        // Cleanup
        document.body.removeChild(playerDiv);
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  };

  const downloadAll = async () => {
    const doneFiles = files.filter(f => f.status === 'done' && f.resultBlob);
    if (doneFiles.length === 0) return;

    if (doneFiles.length === 1) {
      const link = document.createElement('a');
      link.href = doneFiles[0].resultUrl!;
      link.download = doneFiles[0].file.name.replace('.svga', '.mp4');
      link.click();
      return;
    }

    const zip = new JSZip();
    doneFiles.forEach(f => {
      zip.file(f.file.name.replace('.svga', '.mp4'), f.resultBlob!);
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = `converted_videos_${Date.now()}.zip`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#020617] pt-24 pb-12 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center border border-indigo-500/30">
                <Video className="w-6 h-6 text-indigo-400" />
              </div>
              <h1 className="text-3xl font-black text-white tracking-tight">محول SVGA الجماعي</h1>
            </div>
            <p className="text-slate-400 font-medium">تحويل ملفات SVGA المتعددة إلى فيديوهات MP4 بسرعة واحترافية</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl border border-white/10 transition-all active:scale-95"
            >
              إلغاء
            </button>
            <button
              onClick={processAll}
              disabled={isProcessing || files.length === 0}
              className={`px-8 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black rounded-2xl shadow-lg shadow-indigo-600/20 transition-all active:scale-95 flex items-center gap-2`}
            >
              {isProcessing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
              بدء التحويل الجماعي
            </button>
          </div>
        </div>

        {/* Settings Bar */}
        <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-6 mb-8 flex flex-wrap items-center gap-8">
          <div className="flex items-center gap-4">
            <Settings className="w-5 h-5 text-slate-400" />
            <span className="text-sm font-bold text-slate-300 uppercase tracking-widest">الإعدادات:</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-black text-slate-500 uppercase">التنسيق:</span>
            <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
              <button
                onClick={() => setExportFormat('mp4')}
                className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${exportFormat === 'mp4' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Standard MP4
              </button>
              <button
                onClick={() => setExportFormat('vap')}
                className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${exportFormat === 'vap' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                VAP (Alpha)
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-black text-slate-500 uppercase">الجودة:</span>
            <select
              value={quality}
              onChange={(e) => setQuality(e.target.value as any)}
              className="bg-black/40 text-white text-xs font-black px-4 py-2 rounded-xl border border-white/5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            >
              <option value="low">منخفضة</option>
              <option value="medium">متوسطة</option>
              <option value="high">عالية</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-black text-slate-500 uppercase">المقياس:</span>
            <select
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
              className="bg-black/40 text-white text-xs font-black px-4 py-2 rounded-xl border border-white/5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            >
              <option value="0.5">0.5x</option>
              <option value="1">1.0x</option>
              <option value="1.5">1.5x</option>
              <option value="2">2.0x</option>
            </select>
          </div>
        </div>

        {/* Upload Area */}
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="relative group cursor-pointer mb-8"
        >
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-[3rem] blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
          <div className="relative bg-[#0f172a] border-2 border-dashed border-white/10 rounded-[3rem] p-12 flex flex-col items-center justify-center gap-4 hover:border-indigo-500/50 transition-all">
            <div className="w-20 h-20 bg-indigo-500/10 rounded-3xl flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
              <Upload className="w-10 h-10 text-indigo-400" />
            </div>
            <div className="text-center">
              <h3 className="text-xl font-black text-white mb-1">اسحب ملفات SVGA هنا</h3>
              <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">أو اضغط لاختيار الملفات من جهازك</p>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              multiple
              accept=".svga"
              className="hidden"
            />
          </div>
        </div>

        {/* Files List */}
        {files.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-6">
              <h2 className="text-white font-black uppercase tracking-widest text-sm">الملفات المختارة ({files.length})</h2>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setFiles([])}
                  className="text-red-400 hover:text-red-300 text-xs font-black uppercase tracking-widest flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  مسح الكل
                </button>
                <button
                  onClick={downloadAll}
                  disabled={!files.some(f => f.status === 'done')}
                  className="text-emerald-400 hover:text-emerald-300 disabled:opacity-50 text-xs font-black uppercase tracking-widest flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  تحميل الكل (ZIP)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {files.map((file) => (
                <div 
                  key={file.id}
                  className="bg-white/5 border border-white/10 rounded-3xl p-4 flex items-center gap-4 group hover:bg-white/10 transition-all"
                >
                  <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center">
                    <FileVideo className="w-6 h-6 text-indigo-400" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h4 className="text-white font-bold truncate">{file.file.name}</h4>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] text-slate-500 font-black uppercase">{(file.file.size / 1024).toFixed(1)} KB</span>
                      {file.status === 'processing' && (
                        <div className="flex-1 h-1.5 bg-black/40 rounded-full overflow-hidden max-w-[200px]">
                          <div 
                            className="h-full bg-indigo-500 transition-all duration-300"
                            style={{ width: `${file.progress}%` }}
                          />
                        </div>
                      )}
                      {file.status === 'error' && <span className="text-[10px] text-red-500 font-black uppercase">{file.error}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {file.status === 'done' && (
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 font-black text-[10px] uppercase">اكتمل</span>
                        <button
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = file.resultUrl!;
                            link.download = file.file.name.replace('.svga', '.mp4');
                            link.click();
                          }}
                          className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl hover:bg-emerald-500/30 transition-all"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    
                    <button
                      onClick={() => removeFile(file.id)}
                      className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
