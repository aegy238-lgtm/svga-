import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Layers, Play, Pause, RotateCcw, Trash2, Maximize2, Info, Upload, X, Download, Image as ImageIcon, ShieldCheck, Monitor, Smartphone, Loader2 } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { PresetBackground, UserRecord } from '../types';
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

declare var SVGA: any;

interface MultiSvgaItem {
  id: string;
  file: File;
  url: string;
  name: string;
  size: number;
  dimensions: { width: number; height: number };
  fps: number;
  frames: number;
  videoItem: any;
}

interface MultiSvgaViewerProps {
  onCancel: () => void;
  currentUser: UserRecord | null;
}

export const MultiSvgaViewer: React.FC<MultiSvgaViewerProps> = ({ onCancel, currentUser }) => {
  const [items, setItems] = useState<MultiSvgaItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [previewBg, setPreviewBg] = useState<string | null>(null);
  const [watermark, setWatermark] = useState<string | null>(null);
  const [presetBgs, setPresetBgs] = useState<PresetBackground[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportDuration, setExportDuration] = useState(10);
  
  const [wmSettings, setWmSettings] = useState({
    position: 'bottom-right' as 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center' | 'full' | 'tiled',
    size: 15,
    opacity: 0.5
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const watermarkInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchPresets = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'presetBackgrounds'));
        const presets = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PresetBackground));
        setPresetBgs(presets);
      } catch (error) {
        console.error("Error fetching presets:", error);
      }
    };
    fetchPresets();
  }, []);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const newItems: MultiSvgaItem[] = [];
    
    for (const file of Array.from(files)) {
      if (!file.name.toLowerCase().endsWith('.svga')) continue;
      
      const url = URL.createObjectURL(file);
      
      try {
        const item = await new Promise<MultiSvgaItem>((resolve, reject) => {
          const parser = new SVGA.Parser();
          parser.load(url, (videoItem: any) => {
            let extractedFps = videoItem.FPS || videoItem.fps || 30;
            if (typeof extractedFps === 'string') extractedFps = parseFloat(extractedFps);
            if (!extractedFps || extractedFps <= 0) extractedFps = 30;

            resolve({
              id: Math.random().toString(36).substr(2, 9),
              file,
              url,
              name: file.name,
              size: file.size,
              dimensions: { 
                width: videoItem.videoSize?.width || 0, 
                height: videoItem.videoSize?.height || 0 
              },
              fps: extractedFps,
              frames: videoItem.frames || 0,
              videoItem
            });
          }, (err: any) => {
            reject(err);
          });
        });
        newItems.push(item);
      } catch (err) {
        console.error("Failed to load SVGA:", file.name, err);
        URL.revokeObjectURL(url);
      }
    }
    
    setItems(prev => [...prev, ...newItems]);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const removeItem = (id: string) => {
    setItems(prev => {
      const item = prev.find(i => i.id === id);
      if (item) URL.revokeObjectURL(item.url);
      return prev.filter(i => i.id !== id);
    });
  };

  const clearAll = () => {
    items.forEach(item => URL.revokeObjectURL(item.url));
    setItems([]);
  };

  const handleExportGrid = async () => {
    if (items.length === 0) return;
    setIsExporting(true);
    setExportProgress(0);

    // Create a hidden container for offscreen rendering
    const renderContainer = document.createElement('div');
    renderContainer.style.position = 'fixed';
    renderContainer.style.left = '-10000px';
    renderContainer.style.top = '0';
    renderContainer.style.width = '2000px';
    renderContainer.style.height = '2000px';
    renderContainer.style.overflow = 'hidden';
    renderContainer.style.zIndex = '-1000';
    renderContainer.style.pointerEvents = 'none';
    document.body.appendChild(renderContainer);

    try {
      const targetFps = 30;
      let canvasWidth: number;
      let canvasHeight: number;
      let cols: number;
      let rows: number;
      let cardSize: number;
      const padding = items.length > 1 ? 40 : 0;

      if (items.length === 1) {
        cols = 1;
        rows = 1;
        canvasWidth = items[0].dimensions.width;
        canvasHeight = items[0].dimensions.height;
        cardSize = Math.max(canvasWidth, canvasHeight);
      } else {
        cols = items.length <= 2 ? items.length : items.length <= 4 ? 2 : 3;
        rows = Math.ceil(items.length / cols);
        cardSize = 600; 
        canvasWidth = cols * cardSize + (cols + 1) * padding;
        canvasHeight = rows * cardSize + (rows + 1) * padding;
      }

      // Smart Scaling to stay within limits (AVC Level 5.1/5.2 limits)
      const maxPixels = 8_294_400; // 4K resolution limit for safety
      const currentPixels = canvasWidth * canvasHeight;
      if (currentPixels > maxPixels) {
        const scale = Math.sqrt(maxPixels / currentPixels);
        if (items.length === 1) {
          canvasWidth = Math.floor(canvasWidth * scale);
          canvasHeight = Math.floor(canvasHeight * scale);
          cardSize = Math.max(canvasWidth, canvasHeight);
        } else {
          cardSize = Math.floor(cardSize * scale);
          canvasWidth = cols * cardSize + (cols + 1) * padding;
          canvasHeight = rows * cardSize + (rows + 1) * padding;
        }
      }

      // Dimensions must be even for many encoders
      if (canvasWidth % 2 !== 0) canvasWidth += 1;
      if (canvasHeight % 2 !== 0) canvasHeight += 1;
      
      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext('2d', { alpha: false })!;
      
      let bgImg: HTMLImageElement | null = null;
      if (previewBg) {
        bgImg = await new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = previewBg;
        });
      }

      const wmImg = await new Promise<HTMLImageElement | null>((resolve) => {
        if (!watermark) return resolve(null);
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = watermark;
      });

      const totalFrames = exportDuration * targetFps;

      const muxer = new Muxer({
        target: new ArrayBufferTarget(),
        video: {
          codec: 'avc',
          width: canvasWidth,
          height: canvasHeight
        },
        fastStart: 'in-memory'
      });

      const videoEncoder = new VideoEncoder({
        output: (chunk, metadata) => muxer.addVideoChunk(chunk, metadata),
        error: (e) => {
          console.error("Encoder Error:", e);
          alert("خطأ في ترميز الفيديو: " + e.message);
        }
      });

      // Use a more widely compatible codec string if possible, or stick to High 5.1
      videoEncoder.configure({
        codec: 'avc1.640033', // High Profile, Level 5.1
        width: canvasWidth,
        height: canvasHeight,
        bitrate: 8_000_000,
        framerate: targetFps
      });

      const offscreenPlayers = items.map(item => {
        const div = document.createElement('div');
        div.style.width = item.dimensions.width + 'px';
        div.style.height = item.dimensions.height + 'px';
        div.style.position = 'absolute';
        div.style.left = '0';
        div.style.top = '0';
        renderContainer.appendChild(div);
        const player = new SVGA.Player(div);
        player.setVideoItem(item.videoItem);
        player.setContentMode('AspectFit');
        return { player, div, item };
      });

      // Wait for initialization and warmup
      await new Promise(resolve => setTimeout(resolve, 1500));
      offscreenPlayers.forEach(({ player }) => player.stepToFrame(0, false));

      for (let frame = 0; frame < totalFrames; frame++) {
        if (bgImg) {
          ctx.drawImage(bgImg, 0, 0, canvasWidth, canvasHeight);
        } else {
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        }

        offscreenPlayers.forEach(({ player, div, item }, index) => {
          let x, y, currentCardW, currentCardH;
          
          if (items.length === 1) {
            x = 0;
            y = 0;
            currentCardW = canvasWidth;
            currentCardH = canvasHeight;
          } else {
            const col = index % cols;
            const row = Math.floor(index / cols);
            x = padding + col * (cardSize + padding);
            y = padding + row * (cardSize + padding);
            currentCardW = cardSize;
            currentCardH = cardSize;

            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.beginPath();
            ctx.roundRect(x, y, cardSize, cardSize, 40);
            ctx.fill();
          }

          const elapsedSeconds = frame / targetFps;
          const itemFrame = Math.floor(elapsedSeconds * item.fps) % item.frames;
          player.stepToFrame(itemFrame, false);

          const internalCanvas = div.querySelector('canvas');
          if (internalCanvas) {
            const ratio = Math.min(currentCardW / item.dimensions.width, currentCardH / item.dimensions.height);
            const w = item.dimensions.width * ratio;
            const h = item.dimensions.height * ratio;
            const dx = x + (currentCardW - w) / 2;
            const dy = y + (currentCardH - h) / 2;
            
            ctx.save();
            ctx.beginPath();
            if (items.length > 1) {
              ctx.roundRect(x, y, currentCardW, currentCardH, 40);
            } else {
              ctx.rect(x, y, currentCardW, currentCardH);
            }
            ctx.clip();
            ctx.drawImage(internalCanvas, dx, dy, w, h);
            ctx.restore();
          }
        });

        if (wmImg) {
          ctx.globalAlpha = wmSettings.opacity;
          if (wmSettings.position === 'full') {
            ctx.drawImage(wmImg, 0, 0, canvasWidth, canvasHeight);
          } else if (wmSettings.position === 'tiled') {
            const wmSize = Math.min(canvasWidth, canvasHeight) * (wmSettings.size / 100);
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = wmSize;
            tempCanvas.height = wmSize;
            const tempCtx = tempCanvas.getContext('2d')!;
            tempCtx.drawImage(wmImg, 0, 0, wmSize, wmSize);
            
            const pattern = ctx.createPattern(tempCanvas, 'repeat');
            if (pattern) {
              ctx.fillStyle = pattern;
              ctx.fillRect(0, 0, canvasWidth, canvasHeight);
            }
          } else {
            const wmSize = Math.min(canvasWidth, canvasHeight) * (wmSettings.size / 100);
            let wx = 0, wy = 0;
            switch(wmSettings.position) {
              case 'top-left': wx = 40; wy = 40; break;
              case 'top-right': wx = canvasWidth - wmSize - 40; wy = 40; break;
              case 'bottom-left': wx = 40; wy = canvasHeight - wmSize - 40; break;
              case 'bottom-right': wx = canvasWidth - wmSize - 40; wy = canvasHeight - wmSize - 40; break;
              case 'center': wx = (canvasWidth - wmSize) / 2; wy = (canvasHeight - wmSize) / 2; break;
            }
            ctx.drawImage(wmImg, wx, wy, wmSize, wmSize);
          }
          ctx.globalAlpha = 1.0;
        }

        const timestamp = (frame / targetFps) * 1_000_000;
        const videoFrame = new VideoFrame(canvas, { timestamp });
        videoEncoder.encode(videoFrame, { keyFrame: frame % 30 === 0 });
        videoFrame.close();
        setExportProgress(Math.round((frame / totalFrames) * 100));
      }

      await videoEncoder.flush();
      muxer.finalize();
      const { buffer } = muxer.target as ArrayBufferTarget;
      const blob = new Blob([buffer], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SVGA_Record_${Date.now()}.mp4`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export error:", error);
      alert("حدث خطأ أثناء التصدير.");
    } finally {
      document.body.removeChild(renderContainer);
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const selectedItem = useMemo(() => items.find(i => i.id === selectedItemId), [items, selectedItemId]);

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 gap-6">
        <div>
          <h2 className="text-3xl font-black text-white flex items-center gap-3">
            <Layers className="w-8 h-8 text-indigo-500" />
            نظام العرض الذكي لملفات SVGA
          </h2>
          <p className="text-slate-500 font-bold mt-1 uppercase tracking-widest text-xs">
            دعم كامل لجميع المقاسات (500×500, 750×1334, 2000×2000) مع الحفاظ على الجودة
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {items.length > 0 && (
            <>
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl px-4 py-2">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">مدة الفيديو (ثواني):</span>
                <input 
                  type="number" 
                  min="1" 
                  max="60"
                  value={exportDuration}
                  onChange={(e) => setExportDuration(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 bg-transparent text-white font-black text-sm focus:outline-none text-center"
                />
              </div>
              <button 
                onClick={handleExportGrid}
                disabled={isExporting}
                className="relative overflow-hidden group px-8 py-3 bg-red-600/20 border border-red-500/30 rounded-full text-red-400 font-black text-xs uppercase tracking-[0.2em] hover:bg-red-600/30 transition-all flex items-center gap-3"
              >
                <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
                {isExporting ? `جاري التسجيل ${exportProgress}%` : '(SCREEN RECORD) تسجيل فيديو'}
                {isExporting && (
                  <motion.div 
                    className="absolute bottom-0 left-0 h-1 bg-red-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${exportProgress}%` }}
                  />
                )}
              </button>
              <button 
                onClick={clearAll}
                className="px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-2xl border border-red-500/20 font-black text-sm transition-all flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                مسح الكل
              </button>
            </>
          )}
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl shadow-lg shadow-indigo-600/20 font-black text-sm transition-all flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            رفع ملفات جديدة
          </button>
          <input 
            ref={fileInputRef}
            type="file" 
            multiple 
            accept=".svga" 
            className="hidden" 
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
        </div>
      </div>

      {/* Toolbar: Background & Watermark */}
      <div className="flex flex-col gap-6 mb-6 bg-white/5 p-6 rounded-[2.5rem] border border-white/10">
        <div className="flex flex-wrap items-center gap-8">
          <div className="flex items-center gap-3 border-r border-white/10 pr-6">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">الخلفية:</span>
            <div className="flex gap-2">
              <button 
                onClick={() => setPreviewBg(null)}
                className={`w-10 h-10 rounded-xl border transition-all ${!previewBg ? 'border-indigo-500 bg-indigo-500/20' : 'border-white/10 bg-white/5'}`}
                title="شفاف"
              >
                <X className="w-4 h-4 mx-auto text-slate-400" />
              </button>
              {presetBgs.slice(0, 5).map(bg => (
                <button 
                  key={bg.id}
                  onClick={() => setPreviewBg(bg.url)}
                  className={`w-10 h-10 rounded-xl border bg-cover bg-center transition-all ${previewBg === bg.url ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-white/10'}`}
                  style={{ backgroundImage: `url(${bg.url})` }}
                />
              ))}
              <button 
                onClick={() => bgInputRef.current?.click()}
                className="w-10 h-10 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all"
                title="خلفية مخصصة"
              >
                <ImageIcon className="w-4 h-4 text-slate-400" />
              </button>
              <input type="file" ref={bgInputRef} className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && setPreviewBg(URL.createObjectURL(e.target.files[0]))} />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">العلامة المائية:</span>
            <button 
              onClick={() => watermarkInputRef.current?.click()}
              className={`px-5 py-2.5 rounded-xl border text-[10px] font-black uppercase transition-all flex items-center gap-2 ${watermark ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-white/10 bg-white/5 text-slate-400'}`}
            >
              <ShieldCheck className="w-4 h-4" />
              {watermark ? 'تم التحديد' : 'رفع شعار'}
            </button>
            {watermark && (
              <div className="flex items-center gap-4 ml-2">
                <select 
                  value={wmSettings.position}
                  onChange={(e) => setWmSettings(prev => ({ ...prev, position: e.target.value as any }))}
                  className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white focus:outline-none"
                >
                  <option value="top-left">أعلى يسار</option>
                  <option value="top-right">أعلى يمين</option>
                  <option value="bottom-left">أسفل يسار</option>
                  <option value="bottom-right">أسفل يمين</option>
                  <option value="center">منتصف</option>
                  <option value="full">ملء الشاشة (تمديد)</option>
                  <option value="tiled">تكرار (تغطية كاملة)</option>
                </select>
                <div className="flex flex-col gap-1">
                  <span className="text-[8px] text-slate-500 uppercase font-black">الحجم</span>
                  <input 
                    type="range" min="5" max="100" value={wmSettings.size} 
                    onChange={(e) => setWmSettings(prev => ({ ...prev, size: parseInt(e.target.value) }))}
                    className="w-24 accent-indigo-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[8px] text-slate-500 uppercase font-black">الشفافية</span>
                  <input 
                    type="range" min="0.1" max="1" step="0.1" value={wmSettings.opacity} 
                    onChange={(e) => setWmSettings(prev => ({ ...prev, opacity: parseFloat(e.target.value) }))}
                    className="w-24 accent-indigo-500"
                  />
                </div>
                <button onClick={() => setWatermark(null)} className="text-red-500 hover:text-red-400 ml-2">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            <input type="file" ref={watermarkInputRef} className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && setWatermark(URL.createObjectURL(e.target.files[0]))} />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div 
        className={`flex-1 min-h-[400px] rounded-[3rem] border-2 border-dashed transition-all duration-500 relative overflow-hidden
          ${isDragging ? 'border-indigo-500 bg-indigo-500/5' : 'border-white/5 bg-white/2'}
          ${items.length === 0 ? 'flex items-center justify-center' : ''}
        `}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
      >
        {items.length === 0 ? (
          <div className="text-center p-12">
            <div className="w-24 h-24 bg-white/5 rounded-[2rem] flex items-center justify-center mx-auto mb-6 border border-white/10">
              <Upload className="w-10 h-10 text-slate-500" />
            </div>
            <h3 className="text-xl font-black text-white mb-2">اسحب الملفات هنا للبدء</h3>
            <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">يدعم جميع المقاسات بما فيها 750×1334 الطولية</p>
          </div>
        ) : (
          <div className="p-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-8 overflow-y-auto max-h-[calc(100vh-320px)] custom-scrollbar auto-rows-max">
            <AnimatePresence mode="popLayout">
              {items.map((item) => (
                <SvgaCard 
                  key={item.id} 
                  item={item} 
                  onRemove={() => removeItem(item.id)} 
                  onMaximize={() => setSelectedItemId(item.id)}
                  previewBg={previewBg}
                  watermark={watermark}
                  wmSettings={wmSettings}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Fullscreen Modal */}
      <AnimatePresence>
        {selectedItemId && selectedItem && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 sm:p-10">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedItemId(null)}
              className="absolute inset-0 bg-black/95 backdrop-blur-xl"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-5xl aspect-video sm:aspect-auto sm:h-full bg-slate-900 rounded-[3rem] border border-white/10 overflow-hidden shadow-2xl flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center">
                    <Maximize2 className="w-6 h-6 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white">{selectedItem.name}</h3>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">عرض كامل للملف بالمقاس الأصلي</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedItemId(null)}
                  className="w-12 h-12 bg-white/5 hover:bg-white/10 text-white rounded-full flex items-center justify-center transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 relative flex items-center justify-center p-10 overflow-hidden">
                <div 
                  className="relative shadow-2xl rounded-2xl overflow-hidden flex items-center justify-center"
                  style={{ 
                    width: '100%',
                    height: '100%',
                    maxWidth: selectedItem.dimensions.width,
                    maxHeight: selectedItem.dimensions.height,
                    aspectRatio: `${selectedItem.dimensions.width} / ${selectedItem.dimensions.height}`,
                    backgroundImage: previewBg ? `url(${previewBg})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}
                >
                  <SvgaPlayer videoItem={selectedItem.videoItem} />
                  {watermark && (
                    <img 
                      src={watermark} 
                      className="absolute pointer-events-none" 
                      style={{
                        opacity: wmSettings.opacity,
                        ...(wmSettings.position === 'full' ? {
                          inset: 0, width: '100%', height: '100%', objectFit: 'fill'
                        } : wmSettings.position === 'tiled' ? {
                          inset: 0, width: '100%', height: '100%', 
                          backgroundImage: `url(${watermark})`,
                          backgroundRepeat: 'repeat',
                          backgroundSize: `${wmSettings.size}%`,
                          backgroundColor: 'transparent'
                        } : {
                          bottom: '4%', right: '4%', width: wmSettings.size + '%', height: 'auto'
                        })
                      }}
                      alt="watermark"
                    />
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-8 bg-white/5 border-t border-white/5 grid grid-cols-2 sm:grid-cols-4 gap-6">
                <InfoItem label="المقاس" value={`${selectedItem.dimensions.width} × ${selectedItem.dimensions.height}`} />
                <InfoItem label="الإطارات" value={selectedItem.frames} />
                <InfoItem label="السرعة" value={`${selectedItem.fps} FPS`} />
                <InfoItem label="المدة" value={`${(selectedItem.frames / selectedItem.fps).toFixed(2)}s`} />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const InfoItem: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div className="text-center sm:text-right">
    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">{label}</p>
    <p className="text-lg text-white font-black">{value}</p>
  </div>
);

const SvgaPlayer: React.FC<{ videoItem: any }> = ({ videoItem }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const player = new SVGA.Player(containerRef.current);
    playerRef.current = player;
    player.setVideoItem(videoItem);
    player.fillMode = 'AspectFit';
    player.startAnimation();
    return () => {
      player.stopAnimation();
      player.clear();
    };
  }, [videoItem]);

  return <div ref={containerRef} className="w-full h-full flex items-center justify-center" />;
};

const SvgaCard: React.FC<{ 
  item: MultiSvgaItem; 
  onRemove: () => void; 
  onMaximize: () => void;
  previewBg: string | null;
  watermark: string | null;
  wmSettings: any;
}> = ({ item, onRemove, onMaximize, previewBg, watermark, wmSettings }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showInfo, setShowInfo] = useState(false);

  const isPortrait = item.dimensions.height > item.dimensions.width;

  useEffect(() => {
    if (!containerRef.current) return;
    
    const player = new SVGA.Player(containerRef.current);
    playerRef.current = player;
    player.setVideoItem(item.videoItem);
    player.setContentMode('AspectFill');

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          if (isPlaying) player.startAnimation();
        } else {
          player.pauseAnimation();
        }
      });
    }, { threshold: 0.1 });

    observer.observe(containerRef.current);
    
    return () => {
      observer.disconnect();
      player.stopAnimation();
      player.clear();
    };
  }, [item.videoItem, isPlaying]);

  const togglePlay = () => {
    if (isPlaying) {
      playerRef.current?.pauseAnimation();
    } else {
      playerRef.current?.startAnimation();
    }
    setIsPlaying(!isPlaying);
  };

  const replay = () => {
    playerRef.current?.stopAnimation();
    playerRef.current?.startAnimation();
    setIsPlaying(true);
  };

  const getWmStyle = () => {
    if (wmSettings.position === 'full') {
      return { inset: 0, width: '100%', height: '100%', objectFit: 'fill' as const };
    }
    if (wmSettings.position === 'tiled') {
      return { 
        inset: 0, width: '100%', height: '100%', 
        backgroundImage: `url(${watermark})`,
        backgroundRepeat: 'repeat',
        backgroundSize: `${wmSettings.size}%`,
        backgroundColor: 'transparent'
      };
    }
    const size = wmSettings.size + '%';
    switch(wmSettings.position) {
      case 'top-left': return { top: '4%', left: '4%', width: size, height: 'auto' };
      case 'top-right': return { top: '4%', right: '4%', width: size, height: 'auto' };
      case 'bottom-left': return { bottom: '4%', left: '4%', width: size, height: 'auto' };
      case 'bottom-right': return { bottom: '4%', right: '4%', width: size, height: 'auto' };
      case 'center': return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: size, height: 'auto' };
      default: return { bottom: '4%', right: '4%', width: size, height: 'auto' };
    }
  };

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 20 }}
      className={`group relative bg-white/5 rounded-[2.5rem] border border-white/10 overflow-hidden hover:border-indigo-500/50 transition-all duration-500 hover:shadow-2xl hover:shadow-indigo-500/10 flex flex-col
        ${isPortrait ? 'row-span-2' : ''}
      `}
    >
      {/* Preview Area */}
      <div 
        className={`relative bg-slate-950/50 flex items-center justify-center p-4 overflow-hidden flex-1
          ${isPortrait ? 'aspect-[9/16]' : 'aspect-square'}
        `}
        style={{
          backgroundImage: previewBg ? `url(${previewBg})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div 
          ref={containerRef} 
          className="w-full h-full flex items-center justify-center"
        />

        {/* Watermark */}
        {watermark && (
          <img 
            src={watermark} 
            className="absolute pointer-events-none z-10" 
            style={{ ...getWmStyle(), opacity: wmSettings.opacity }}
            alt="wm"
          />
        )}
        
        {/* Overlay Controls */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-4 z-20">
          <button 
            onClick={togglePlay}
            className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center hover:scale-110 transition-transform"
          >
            {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
          </button>
          <button 
            onClick={replay}
            className="w-12 h-12 bg-white/20 backdrop-blur-md text-white rounded-full flex items-center justify-center hover:scale-110 transition-transform"
          >
            <RotateCcw className="w-6 h-6" />
          </button>
        </div>

        {/* Top Right Actions */}
        <div className="absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
          <button 
            onClick={onRemove}
            className="w-10 h-10 bg-red-500/20 backdrop-blur-md text-red-500 rounded-xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"
          >
            <Trash2 className="w-5 h-5" />
          </button>
          <button 
            onClick={onMaximize}
            className="w-10 h-10 bg-indigo-500/20 backdrop-blur-md text-indigo-400 rounded-xl flex items-center justify-center hover:bg-indigo-500 hover:text-white transition-all"
          >
            <Maximize2 className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setShowInfo(!showInfo)}
            className={`w-10 h-10 backdrop-blur-md rounded-xl flex items-center justify-center transition-all ${showInfo ? 'bg-indigo-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
          >
            <Info className="w-5 h-5" />
          </button>
        </div>

        {/* Dimension Badge */}
        <div className="absolute bottom-4 left-4 flex items-center gap-2 z-20">
          <div className="px-3 py-1 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 flex items-center gap-2">
            {isPortrait ? <Smartphone className="w-3 h-3 text-sky-400" /> : <Monitor className="w-3 h-3 text-indigo-400" />}
            <span className="text-[10px] font-black text-white tracking-widest uppercase">
              {item.dimensions.width} × {item.dimensions.height}
            </span>
          </div>
        </div>
      </div>

      {/* Info Footer */}
      <div className="p-5 bg-white/[0.02] z-10">
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-white font-black text-sm truncate max-w-[150px]" title={item.name}>
            {item.name}
          </h4>
          <span className="text-[10px] text-slate-500 font-bold">
            {(item.size / 1024).toFixed(1)} KB
          </span>
        </div>
        
        <AnimatePresence>
          {showInfo && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-4 mt-4 border-t border-white/5 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest mb-1">Frames</p>
                  <p className="text-xs text-white font-bold">{item.frames}</p>
                </div>
                <div>
                  <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest mb-1">FPS</p>
                  <p className="text-xs text-white font-bold">{item.fps}</p>
                </div>
                <div>
                  <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest mb-1">Duration</p>
                  <p className="text-xs text-white font-bold">{(item.frames / item.fps).toFixed(2)}s</p>
                </div>
                <div>
                  <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest mb-1">Ratio</p>
                  <p className="text-xs text-white font-bold">{(item.dimensions.width / item.dimensions.height).toFixed(2)}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
