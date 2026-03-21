import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Layers, Play, Pause, RotateCcw, Trash2, Maximize2, Info, Upload, X, Download, Image as ImageIcon, ShieldCheck, Monitor, Smartphone, Loader2, Camera } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { PresetBackground, UserRecord } from '../types';
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import JSZip from 'jszip';

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

interface DevicePreset {
  id: string;
  name: string;
  width: number;
  height: number;
  category: string;
}

const DEVICE_PRESETS: DevicePreset[] = [
  // Standard Series
  { id: 'ip8', name: '750 × 1334 (iPhone 8)', width: 750, height: 1334, category: 'Standard' },
  { id: 'sq500', name: '500 × 500 (Square)', width: 500, height: 500, category: 'Standard' },
  
  // iPhone Series
  { id: 'ip15pm', name: 'iPhone 15 Max', width: 1290, height: 2796, category: 'iPhone' },
  { id: 'ip15p', name: 'iPhone 15 pro', width: 1179, height: 2556, category: 'iPhone' },
  { id: 'ip13', name: 'iPhone 13', width: 1170, height: 2532, category: 'iPhone' },
  { id: 'ip12pm', name: 'iPhone 12 Max', width: 1284, height: 2778, category: 'iPhone' },
  { id: 'ip12p', name: 'iPhone 12 pro', width: 1170, height: 2532, category: 'iPhone' },
  { id: 'ip12', name: 'iPhone 12', width: 1170, height: 2532, category: 'iPhone' },
  { id: 'ip11', name: 'iPhone 11', width: 828, height: 1792, category: 'iPhone' },
  { id: 'ipx', name: 'iPhone X', width: 1125, height: 2436, category: 'iPhone' },
  { id: 's10', name: '三星 S10', width: 1440, height: 3040, category: 'iPhone' },
  { id: 's20', name: '三星 S20', width: 1440, height: 3200, category: 'iPhone' },
  { id: 'mate40p', name: '华为Mate40 pro', width: 1344, height: 2772, category: 'iPhone' },
  { id: 'p40p', name: '华为 P40 pro', width: 1200, height: 2640, category: 'iPhone' },
  
  // Android Series
  { id: 'mate60p', name: 'Mate 60 Pro', width: 1260, height: 2720, category: 'Android' },
  { id: 'p70', name: '华为 P70', width: 1256, height: 2760, category: 'Android' },
  { id: 'mi14', name: '小米14', width: 1200, height: 2670, category: 'Android' },
  { id: 'mi14u', name: 'Xiaomi 14 Ultra', width: 1440, height: 3200, category: 'Android' },
  { id: 's21u', name: 'Galaxy S21 Ultra', width: 1440, height: 3200, category: 'Android' },
  { id: 'oppor17', name: 'OPPO R17', width: 1080, height: 2340, category: 'Android' },
  { id: 'mi10', name: '小米10', width: 1080, height: 2340, category: 'Android' },
  { id: 'mi6', name: '小米6', width: 1080, height: 1920, category: 'Android' },
  { id: 'vivonex3s', name: 'VIVO NEX 3S', width: 1080, height: 2256, category: 'Android' },
  { id: 'vivox50', name: 'VIVO X50', width: 1080, height: 2376, category: 'Android' },
  { id: 'oneplus8t', name: '一加8T', width: 1080, height: 2400, category: 'Android' },

  // Tablet Series
  { id: 'ipadair', name: 'ipad air', width: 1640, height: 2360, category: 'Tablet' },
  { id: 'ipadpro', name: 'ipad pro', width: 2048, height: 2732, category: 'Tablet' },
  { id: 'matepadpro', name: 'MatePad Pro', width: 1600, height: 2560, category: 'Tablet' },
  { id: 'tabs7', name: 'Galaxy Tab S7', width: 1600, height: 2560, category: 'Tablet' },

  // PC Series
  { id: 'pc800', name: '800*600', width: 800, height: 600, category: 'PC' },
  { id: 'pc1280', name: '1280*800', width: 1280, height: 800, category: 'PC' },
  { id: 'pc1920', name: '1920*1080', width: 1920, height: 1080, category: 'PC' },
  { id: 'pc27', name: '27寸', width: 2560, height: 1440, category: 'PC' },
];

export const MultiSvgaViewer: React.FC<MultiSvgaViewerProps> = ({ onCancel, currentUser }) => {
  const [items, setItems] = useState<MultiSvgaItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [previewBg, setPreviewBg] = useState<string | null>(null);
  const [watermark, setWatermark] = useState<string | null>(null);
  const [presetBgs, setPresetBgs] = useState<PresetBackground[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportDuration, setExportDuration] = useState(10);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('auto');
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  
  const selectedPreset = useMemo(() => DEVICE_PRESETS.find(p => p.id === selectedPresetId), [selectedPresetId]);

  const [wmSettings, setWmSettings] = useState({
    position: 'bottom-right' as 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center',
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
      let cardW: number;
      let cardH: number;
      const padding = items.length > 1 ? 40 : 0;

      if (items.length === 1) {
        cols = 1;
        rows = 1;
        cardW = selectedPreset ? selectedPreset.width : items[0].dimensions.width;
        cardH = selectedPreset ? selectedPreset.height : items[0].dimensions.height;
        canvasWidth = cardW;
        canvasHeight = cardH;
      } else {
        cols = items.length <= 2 ? items.length : items.length <= 4 ? 2 : 3;
        rows = Math.ceil(items.length / cols);
        cardW = selectedPreset ? selectedPreset.width : 1334;
        cardH = selectedPreset ? selectedPreset.height : 750;
        canvasWidth = cols * cardW + (cols + 1) * padding;
        canvasHeight = rows * cardH + (rows + 1) * padding;
      }

      // Smart Scaling to stay within limits (AVC Level 5.1/5.2 limits)
      const maxPixels = 8_294_400; // 4K resolution limit for safety
      const currentPixels = canvasWidth * canvasHeight;
      if (currentPixels > maxPixels) {
        const scale = Math.sqrt(maxPixels / currentPixels);
        cardW = Math.floor(cardW * scale);
        cardH = Math.floor(cardH * scale);
        canvasWidth = cols * cardW + (cols + 1) * padding;
        canvasHeight = rows * cardH + (rows + 1) * padding;
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
        const w = items.length === 1 ? (selectedPreset ? selectedPreset.width : item.dimensions.width) : cardW;
        const h = items.length === 1 ? (selectedPreset ? selectedPreset.height : item.dimensions.height) : cardH;
        
        const div = document.createElement('div');
        div.style.width = w + 'px';
        div.style.height = h + 'px';
        div.style.position = 'absolute';
        div.style.left = '0';
        div.style.top = '0';
        renderContainer.appendChild(div);
        
        const player = new SVGA.Player(div);
        player.setVideoItem(item.videoItem);
        player.setContentMode(selectedPreset ? 'AspectFill' : 'AspectFit');
        
        // Cache the canvas reference
        const internalCanvas = div.querySelector('canvas');
        return { player, div, item, cardW, cardH, internalCanvas };
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

        offscreenPlayers.forEach(({ player, item, cardW, cardH, internalCanvas }, index) => {
          let x, y;
          
          if (items.length === 1) {
            x = 0;
            y = 0;
          } else {
            const col = index % cols;
            const row = Math.floor(index / cols);
            x = padding + col * (cardW + padding);
            y = padding + row * (cardH + padding);

            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.beginPath();
            ctx.roundRect(x, y, cardW, cardH, 40);
            ctx.fill();
          }

          const elapsedSeconds = frame / targetFps;
          const itemFrame = Math.floor(elapsedSeconds * item.fps) % item.frames;
          player.stepToFrame(itemFrame, false);

          if (internalCanvas) {
            const sw = item.dimensions.width;
            const sh = item.dimensions.height;
            
            // Manual AspectFill calculation for video export
            const scale = selectedPreset ? Math.max(cardW / sw, cardH / sh) : 1;
            const finalW = sw * scale;
            const finalH = sh * scale;
            const dx = x + (cardW - finalW) / 2;
            const dy = y + (cardH - finalH) / 2;

            ctx.save();
            ctx.beginPath();
            if (items.length > 1) {
              ctx.roundRect(x, y, cardW, cardH, 40);
            } else {
              ctx.rect(x, y, cardW, cardH);
            }
            ctx.clip();
            ctx.drawImage(internalCanvas, dx, dy, finalW, finalH);
            ctx.restore();
          }
        });

        if (wmImg) {
          const wmSize = Math.min(canvasWidth, canvasHeight) * (wmSettings.size / 100);
          let wx = 0, wy = 0;
          switch(wmSettings.position) {
            case 'top-left': wx = 40; wy = 40; break;
            case 'top-right': wx = canvasWidth - wmSize - 40; wy = 40; break;
            case 'bottom-left': wx = 40; wy = canvasHeight - wmSize - 40; break;
            case 'bottom-right': wx = canvasWidth - wmSize - 40; wy = canvasHeight - wmSize - 40; break;
            case 'center': wx = (canvasWidth - wmSize) / 2; wy = (canvasHeight - wmSize) / 2; break;
          }
          ctx.globalAlpha = wmSettings.opacity;
          ctx.drawImage(wmImg, wx, wy, wmSize, wmSize);
          ctx.globalAlpha = 1.0;
        }

        const timestamp = (frame / targetFps) * 1_000_000;
        const videoFrame = new VideoFrame(canvas, { timestamp });
        videoEncoder.encode(videoFrame, { keyFrame: frame % 30 === 0 });
        videoFrame.close();
        
        // Throttled progress update
        if (frame % 5 === 0) {
          setExportProgress(Math.round((frame / totalFrames) * 100));
        }
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

  const captureFrame = async (item: MultiSvgaItem, frameIndex: number = 0): Promise<Blob> => {
    const canvas = document.createElement('canvas');
    const dw = selectedPreset ? selectedPreset.width : item.dimensions.width;
    const dh = selectedPreset ? selectedPreset.height : item.dimensions.height;
    
    canvas.width = dw;
    canvas.height = dh;
    const ctx = canvas.getContext('2d', { alpha: true })!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const div = document.createElement('div');
    div.style.width = `${item.dimensions.width}px`;
    div.style.height = `${item.dimensions.height}px`;
    div.style.position = 'fixed';
    div.style.top = '-9999px';
    document.body.appendChild(div);

    try {
      const player = new SVGA.Player(div);
      await new Promise<void>((resolve) => {
        player.setVideoItem(item.videoItem);
        player.setContentMode('AspectFit'); // Use Fit internally
        player.stepToFrame(frameIndex, false);
        setTimeout(resolve, 250);
      });
      
      const svgaCanvas = div.querySelector('canvas');
      if (svgaCanvas) {
        const sw = item.dimensions.width;
        const sh = item.dimensions.height;

        // Manual AspectFill calculation
        const scale = selectedPreset ? Math.max(dw / sw, dh / sh) : 1;
        const finalW = sw * scale;
        const finalH = sh * scale;
        const x = (dw - finalW) / 2;
        const y = (dh - finalH) / 2;

        ctx.drawImage(svgaCanvas, x, y, finalW, finalH);
      }
    } finally {
      document.body.removeChild(div);
    }

    // Draw Watermark
    if (watermark) {
      try {
        const wmImg = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = watermark;
        });

        ctx.globalAlpha = wmSettings.opacity;
        const wmSize = Math.min(canvas.width, canvas.height) * (wmSettings.size / 100);
        let wx = 0, wy = 0;
        switch(wmSettings.position) {
          case 'top-left': wx = 20; wy = 20; break;
          case 'top-right': wx = canvas.width - wmSize - 20; wy = 20; break;
          case 'bottom-left': wx = 20; wy = canvas.height - wmSize - 20; break;
          case 'bottom-right': wx = canvas.width - wmSize - 20; wy = canvas.height - wmSize - 20; break;
          case 'center': wx = (canvas.width - wmSize) / 2; wy = (canvas.height - wmSize) / 2; break;
        }
        ctx.drawImage(wmImg, wx, wy, wmSize, wmSize);
        ctx.globalAlpha = 1.0;
      } catch (e) {
        console.error("Failed to load watermark for capture", e);
      }
    }

    return new Promise((resolve) => canvas.toBlob(blob => resolve(blob!), 'image/png'));
  };

  const handleDownloadAllImages = async () => {
    if (items.length === 0) return;
    setIsZipping(true);
    setExportProgress(0);
    
    const zip = new JSZip();
    const folder = zip.folder("SVGA_Screenshots");

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const blob = await captureFrame(item, Math.floor(item.frames / 2)); // Capture middle frame
      folder?.file(`${item.name.replace('.svga', '')}.png`, blob);
      setExportProgress(Math.round(((i + 1) / items.length) * 100));
    }

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SVGA_Images_${Date.now()}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    setIsZipping(false);
  };

  const handleDownloadSingleImage = async (item: MultiSvgaItem) => {
    const blob = await captureFrame(item, Math.floor(item.frames / 2));
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${item.name.replace('.svga', '')}.png`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadSvga = (item: MultiSvgaItem) => {
    const url = URL.createObjectURL(item.file);
    const a = document.createElement('a');
    a.href = url;
    a.download = item.name;
    a.click();
    URL.revokeObjectURL(url);
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
            {items.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full"
              >
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                <span className="text-xs font-black text-indigo-400 uppercase tracking-widest">
                  {items.length} {items.length === 1 ? 'ملف مرفوع' : 'ملفات مرفوعة'}
                </span>
              </motion.div>
            )}
          </h2>
          <p className="text-slate-500 font-bold mt-1 uppercase tracking-widest text-xs">
            دعم كامل لجميع المقاسات (500×500, 750×1334, 2000×2000) مع الحفاظ على الجودة
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {items.length > 0 && (
            <>
              {/* Standard Sizes */}
              <div className="flex items-center gap-2 bg-white/5 p-1.5 rounded-2xl border border-white/10">
                <button 
                  onClick={() => setSelectedPresetId('ip8')}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${selectedPresetId === 'ip8' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white'}`}
                >
                  750 × 1334
                </button>
                <button 
                  onClick={() => setSelectedPresetId('sq500')}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${selectedPresetId === 'sq500' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white'}`}
                >
                  500 × 500
                </button>
                <button 
                  onClick={() => setSelectedPresetId('auto')}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${selectedPresetId === 'auto' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  تلقائي
                </button>
              </div>

              <div className="h-8 w-px bg-white/10 mx-1" />

              <div className="relative">
                <button 
                  onClick={() => setShowPresetMenu(!showPresetMenu)}
                  className={`px-6 py-3 rounded-2xl border font-black text-sm transition-all flex items-center gap-2 ${selectedPresetId !== 'auto' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}
                >
                  <Smartphone className="w-4 h-4" />
                  {selectedPreset ? selectedPreset.name : 'تلقائي (Native)'}
                </button>

                <AnimatePresence>
                  {showPresetMenu && (
                    <>
                      <div className="fixed inset-0 z-[100]" onClick={() => setShowPresetMenu(false)} />
                      <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute top-full right-0 mt-4 w-[600px] max-h-[500px] bg-slate-900 border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden z-[110] flex flex-col"
                      >
                        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/2">
                          <h4 className="text-white font-black text-sm flex items-center gap-2">
                            <Monitor className="w-4 h-4 text-indigo-500" />
                            اختر مقاس العرض المفضل
                          </h4>
                          <button onClick={() => setSelectedPresetId('auto')} className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 uppercase tracking-widest">
                            إعادة للوضع التلقائي
                          </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                          {['iPhone', 'Android', 'Tablet', 'PC'].map(cat => (
                            <div key={cat} className="mb-8 last:mb-0">
                              <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                                {cat === 'iPhone' ? 'سلسلة آيفون' : cat === 'Android' ? 'سلسلة أندرويد' : cat === 'Tablet' ? 'سلسلة الأجهزة اللوحية' : 'سلسلة الكمبيوتر'}
                              </h5>
                              <div className="grid grid-cols-3 gap-2">
                                {DEVICE_PRESETS.filter(p => p.category === cat).map(preset => (
                                  <button
                                    key={preset.id}
                                    onClick={() => {
                                      setSelectedPresetId(preset.id);
                                      setShowPresetMenu(false);
                                    }}
                                    className={`px-3 py-2.5 rounded-xl text-[10px] font-bold text-right transition-all border ${selectedPresetId === preset.id ? 'bg-indigo-500 border-indigo-400 text-white shadow-lg shadow-indigo-500/20' : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10 hover:text-white'}`}
                                  >
                                    <div className="flex flex-col">
                                      <span>{preset.name}</span>
                                      <span className="text-[8px] opacity-50">{preset.width} × {preset.height}</span>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              <div className="h-8 w-px bg-white/10 mx-2" />

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
                onClick={handleDownloadAllImages}
                disabled={isZipping || isExporting}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl shadow-lg shadow-emerald-600/20 font-black text-sm transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isZipping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {isZipping ? `جاري التحضير ${exportProgress}%` : 'تنزيل كل الصور (ZIP)'}
              </button>
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
          <div className="p-8 flex flex-wrap justify-center gap-12 overflow-y-auto max-h-[calc(100vh-320px)] custom-scrollbar">
            <AnimatePresence mode="popLayout">
              {items.map((item) => (
                <SvgaCard 
                  key={`${item.id}-${selectedPresetId}`} 
                  item={item} 
                  onRemove={() => removeItem(item.id)} 
                  onMaximize={() => setSelectedItemId(item.id)}
                  onDownload={() => handleDownloadSingleImage(item)}
                  onDownloadSvga={() => handleDownloadSvga(item)}
                  previewBg={previewBg}
                  watermark={watermark}
                  selectedPreset={selectedPreset}
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
                      className="absolute bottom-4 right-4 w-16 h-16 object-contain opacity-50 pointer-events-none" 
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
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || !wrapperRef.current) return;
    
    // Clear container first
    containerRef.current.innerHTML = '';
    
    const player = new SVGA.Player(containerRef.current);
    playerRef.current = player;
    
    // We manually scale and center the container, so use Fill
    player.setContentMode('Fill');
    player.setVideoItem(videoItem);
    player.startAnimation();

    const updateCanvasStyles = () => {
      if (!wrapperRef.current || !containerRef.current) return;
      
      const wrapperWidth = wrapperRef.current.clientWidth;
      const wrapperHeight = wrapperRef.current.clientHeight;
      const svgaWidth = videoItem.videoSize?.width || 1;
      const svgaHeight = videoItem.videoSize?.height || 1;

      // Fixed container dimensions as requested
      const containerWidth = 1334;
      const containerHeight = 750;

      // 1. Scale the SVGA to fit inside the fixed 1334x750 container
      const svgaScale = Math.min(containerWidth / svgaWidth, containerHeight / svgaHeight);
      const finalSvgaWidth = svgaWidth * svgaScale;
      const finalSvgaHeight = svgaHeight * svgaScale;

      // 2. Scale the fixed 1334x750 container to fit inside the screen wrapper
      const wrapperScale = Math.min(wrapperWidth / containerWidth, wrapperHeight / containerHeight);

      // Size the inner container to exactly match the scaled SVGA dimensions
      // and scale it down to fit the wrapper
      Object.assign(containerRef.current.style, {
        width: `${finalSvgaWidth}px`,
        height: `${finalSvgaHeight}px`,
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: `translate(-50%, -50%) scale(${wrapperScale})`,
        transformOrigin: 'center center',
        zIndex: '1'
      });

      const canvas = containerRef.current.querySelector('canvas');
      if (canvas) {
        Object.assign(canvas.style, {
          width: '100%',
          height: '100%',
          display: 'block',
          objectFit: 'fill'
        });
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      updateCanvasStyles();
    });

    resizeObserver.observe(wrapperRef.current);

    const mutationObserver = new MutationObserver(() => {
      updateCanvasStyles();
    });
    
    mutationObserver.observe(containerRef.current, { childList: true, subtree: true });

    updateCanvasStyles();
    const timer = setTimeout(updateCanvasStyles, 100);

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      clearTimeout(timer);
      player.stopAnimation();
      player.clear();
    };
  }, [videoItem]);

  return (
    <div ref={wrapperRef} className="w-full h-full relative overflow-hidden flex items-center justify-center">
      <div ref={containerRef} className="relative" />
    </div>
  );
};

const SvgaCard: React.FC<{ 
  item: MultiSvgaItem; 
  onRemove: () => void; 
  onMaximize: () => void;
  onDownload: () => void;
  onDownloadSvga: () => void;
  previewBg: string | null;
  watermark: string | null;
  selectedPreset?: DevicePreset;
}> = ({ item, onRemove, onMaximize, onDownload, onDownloadSvga, previewBg, watermark, selectedPreset }) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [zoom, setZoom] = useState(1);
  const isPortrait = item.dimensions.height > item.dimensions.width;

  useEffect(() => {
    if (!containerRef.current || !item.videoItem) return;
    
    // Clear container first to avoid multiple canvases
    containerRef.current.innerHTML = '';
    
    const player = new SVGA.Player(containerRef.current);
    playerRef.current = player;
    
    player.loops = 0;
    player.clearsAfterStop = false;
    
    // Always use Fill since we are perfectly sizing the container
    player.setContentMode('Fill');
    player.setVideoItem(item.videoItem);

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

    // Separate effect for Zoom and Preset style updates - much faster and smoother
    useEffect(() => {
      const updateCanvasStyles = () => {
        if (!wrapperRef.current || !containerRef.current) return;
        
        const wrapperWidth = wrapperRef.current.clientWidth;
        const wrapperHeight = wrapperRef.current.clientHeight;
        const svgaWidth = item.dimensions.width || 1;
        const svgaHeight = item.dimensions.height || 1;
  
        // Fixed container dimensions as requested
        const containerWidth = 1334;
        const containerHeight = 750;
  
        // 1. Scale the SVGA to fit inside the fixed 1334x750 container
        const svgaScale = Math.min(containerWidth / svgaWidth, containerHeight / svgaHeight);
        const finalSvgaWidth = svgaWidth * svgaScale;
        const finalSvgaHeight = svgaHeight * svgaScale;
  
        // 2. Scale the fixed 1334x750 container to fit inside the card wrapper
        const wrapperScale = Math.min(wrapperWidth / containerWidth, wrapperHeight / containerHeight);
  
        // Size the inner container to exactly match the scaled SVGA dimensions
        // and scale it down to fit the wrapper
        Object.assign(containerRef.current.style, {
          width: `${finalSvgaWidth}px`,
          height: `${finalSvgaHeight}px`,
          position: 'absolute',
          top: '50%',
          left: '50%',
          // Combine the wrapper scale and the user zoom
          transform: `translate(-50%, -50%) scale(${wrapperScale * zoom})`,
          transformOrigin: 'center center',
          zIndex: '1'
        });
  
        const canvas = containerRef.current.querySelector('canvas');
        if (canvas) {
          Object.assign(canvas.style, {
            width: '100%',
            height: '100%',
            display: 'block',
            objectFit: 'fill'
          });
        }
      };
  
      const resizeObserver = new ResizeObserver(() => {
        updateCanvasStyles();
      });
  
      if (wrapperRef.current) {
        resizeObserver.observe(wrapperRef.current);
      }
  
      // Use MutationObserver to catch when SVGA.Player adds the canvas
      const mutationObserver = new MutationObserver(() => {
        updateCanvasStyles();
      });
      
      if (containerRef.current) {
        mutationObserver.observe(containerRef.current, { childList: true, subtree: true });
      }
  
      updateCanvasStyles();
      const timer = setTimeout(updateCanvasStyles, 100);
      
      return () => {
        resizeObserver.disconnect();
        mutationObserver.disconnect();
        clearTimeout(timer);
      };
    }, [selectedPreset, zoom, item.dimensions]);

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

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 20 }}
      className={`group relative bg-white/5 rounded-[3rem] border border-white/10 overflow-hidden hover:border-indigo-500/50 transition-all duration-500 hover:shadow-2xl hover:shadow-indigo-500/10 flex flex-col shrink-0 ${selectedPreset ? 'w-[350px]' : 'w-[400px]'}`}
    >
      {/* Preview Area - Forced Ratio */}
      <div 
        ref={wrapperRef}
        className={`relative bg-slate-950/50 flex items-center justify-center overflow-hidden w-full`}
        style={{
          height: selectedPreset ? `${(selectedPreset.height / selectedPreset.width) * 350}px` : `${(750 / 1334) * 400}px`,
          backgroundImage: previewBg ? `url(${previewBg})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div 
          ref={containerRef} 
          className="relative"
        />

        {/* Watermark */}
        {watermark && (
          <img 
            src={watermark} 
            className="absolute bottom-4 right-4 w-12 h-12 object-contain opacity-40 pointer-events-none z-10" 
            alt="wm"
          />
        )}
        
        {/* Info Badge */}
        <div className="absolute bottom-4 left-4 flex flex-col gap-1 z-20">
          <div className="px-3 py-1.5 bg-black/60 backdrop-blur-md border border-white/10 rounded-xl flex items-center gap-2">
            <span className="text-[10px] font-black text-white">
              {selectedPreset ? `${selectedPreset.width} × ${selectedPreset.height}` : `${item.dimensions.width} × ${item.dimensions.height}`}
            </span>
            {isPortrait ? <Smartphone className="w-3 h-3 text-sky-400" /> : <Monitor className="w-3 h-3 text-indigo-400" />}
          </div>
          {selectedPreset && (
            <div className="px-2 py-0.5 bg-indigo-500/20 border border-indigo-500/30 rounded-lg text-[8px] font-black text-indigo-300 uppercase tracking-tighter text-center">
              مقاس إجباري (Fill)
            </div>
          )}
        </div>
        
        {/* Overlay Controls */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center gap-6 z-20">
          <div className="flex items-center gap-4">
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

          {/* Zoom Slider */}
          <div className="w-48 px-4 py-3 bg-black/60 backdrop-blur-md rounded-2xl border border-white/10 flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black text-white uppercase tracking-widest">تكبير العرض (Zoom)</span>
              <span className="text-[10px] font-black text-indigo-400">{Math.round(zoom * 100)}%</span>
            </div>
            <input 
              type="range" 
              min="0.5" 
              max="3" 
              step="0.1" 
              value={zoom} 
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>
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
            onClick={onDownload}
            className="w-10 h-10 bg-emerald-500/20 backdrop-blur-md text-emerald-400 rounded-xl flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all"
            title="تنزيل صورة"
          >
            <Camera className="w-5 h-5" />
          </button>
          <button 
            onClick={onDownloadSvga}
            className="w-10 h-10 bg-blue-500/20 backdrop-blur-md text-blue-400 rounded-xl flex items-center justify-center hover:bg-blue-500 hover:text-white transition-all"
            title="تنزيل ملف SVGA"
          >
            <Download className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setShowInfo(!showInfo)}
            className={`w-10 h-10 backdrop-blur-md rounded-xl flex items-center justify-center transition-all ${showInfo ? 'bg-indigo-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
          >
            <Info className="w-5 h-5" />
          </button>
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
