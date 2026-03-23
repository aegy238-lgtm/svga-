import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserRecord } from '../types';
import { 
  Images, 
  Upload, 
  X, 
  Play, 
  Pause, 
  Download, 
  Settings, 
  ArrowRight, 
  Trash2, 
  Layers,
  Zap,
  CheckSquare,
  ListOrdered,
  Image as ImageIcon,
  Stamp
} from 'lucide-react';
import { parse } from 'protobufjs';
import pako from 'pako';
import lottie from 'lottie-web';
import JSZip from 'jszip';
import { svgaSchema } from '../svga-proto';
import { logActivity } from '../utils/logger';
import { useAccessControl } from '../hooks/useAccessControl';
import { convertSvgaToLottie, convertFramesToLottieSequence } from '../utils/svgaToLottie';

// Custom Lottie Player component to avoid lottie-react hook issues in React 19
const LottiePlayer: React.FC<{ 
    animationData: any; 
    loop?: boolean; 
    autoplay?: boolean; 
    className?: string;
}> = ({ animationData, loop = true, autoplay = true, className }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const animRef = useRef<any>(null);

    useEffect(() => {
        if (containerRef.current && animationData) {
            animRef.current = lottie.loadAnimation({
                container: containerRef.current,
                renderer: 'svg',
                loop: loop,
                autoplay: autoplay,
                animationData: animationData
            });

            return () => {
                if (animRef.current) {
                    animRef.current.destroy();
                }
            };
        }
    }, [animationData, loop, autoplay]);

    return <div ref={containerRef} className={className} />;
};

declare var ImageDecoder: any;
declare var SVGA: any;

interface ImageToSvgaProps {
  currentUser?: UserRecord | null;
  onCancel?: () => void;
  onLoginRequired: () => void;
  onSubscriptionRequired?: () => void;
  globalQuality?: 'low' | 'medium' | 'high';
  initialFile?: File | null;
}

interface ImageFrame {
  id: string;
  file: File;
  previewUrl: string;
  width: number;
  height: number;
}

export const ImageToSvga: React.FC<ImageToSvgaProps> = ({ currentUser, onCancel, onLoginRequired, onSubscriptionRequired, globalQuality: initialGlobalQuality = 'high', initialFile }) => {
  const { checkAccess } = useAccessControl();
  const [frames, setFrames] = useState<ImageFrame[]>([]);
  const [fps, setFps] = useState(10);
  const [duration, setDuration] = useState<number>(1);
  const [preserveDuration, setPreserveDuration] = useState(true);
  const [selectedQuality, setSelectedQuality] = useState<'low' | 'medium' | 'high'>(initialGlobalQuality);
  const quality = selectedQuality === 'high' ? 0.9 : selectedQuality === 'medium' ? 0.7 : 0.5;
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentPreviewFrame, setCurrentPreviewFrame] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [canvasSize, setCanvasSize] = useState({ width: 750, height: 750 });
  const [autoSize, setAutoSize] = useState(true);
  const [target10MB, setTarget10MB] = useState(false);
  const [imageFormat, setImageFormat] = useState<'png' | 'jpeg' | 'webp'>('png');
  const [lottieData, setLottieData] = useState<any>(null);
  const [isLottieMode, setIsLottieMode] = useState(false);
  const [lottieExtractionMode, setLottieExtractionMode] = useState<'sequence' | 'assets'>('sequence');
  const [showLottieModal, setShowLottieModal] = useState(false);
  const [pendingLottieData, setPendingLottieData] = useState<any>(null);
  
  // Range Selection
  const [rangeStart, setRangeStart] = useState(1);
  const [rangeEnd, setRangeEnd] = useState(1);
  const [showRangeModal, setShowRangeModal] = useState(false);
  const [exportPhase, setExportPhase] = useState('');

  const downloadFramesAsZip = async () => {
    if (frames.length === 0) return;
    setIsProcessing(true);
    setProgress(0);
    
    try {
      const zip = new JSZip();
      const folder = zip.folder("frames");
      
      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        // Use the actual file blob
        folder?.file(`frame_${(i + 1).toString().padStart(4, '0')}.png`, frame.file);
        setProgress(Math.floor(((i + 1) / frames.length) * 100));
        
        // Yield to UI
        if (i % 20 === 0) await new Promise(r => setTimeout(r, 0));
      }
      
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `animation_frames_${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      if (currentUser) {
        logActivity(currentUser, 'download_zip', `Downloaded ${frames.length} frames as ZIP`);
      }
    } catch (err) {
      console.error("Error generating ZIP:", err);
      alert("حدث خطأ أثناء إنشاء ملف ZIP. يرجى المحاولة مرة أخرى.");
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const downloadSingleFrame = (frame: ImageFrame, index: number) => {
    const link = document.createElement('a');
    link.href = frame.previewUrl;
    link.download = `frame_${(index + 1).toString().padStart(4, '0')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle initial file if provided
  useEffect(() => {
    if (initialFile) {
        const event = {
            target: {
                files: [initialFile]
            }
        } as unknown as React.ChangeEvent<HTMLInputElement>;
        handleFileUpload(event);
    }
  }, [initialFile]);
  
  // Background & Watermark
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [watermarkImage, setWatermarkImage] = useState<string | null>(null);
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.5);
  const [watermarkPosition, setWatermarkPosition] = useState<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'>('bottom-right');
  const [watermarkSize, setWatermarkSize] = useState(0.2); // 20% of canvas width
  
  // Animation Effects State
  const [effectType, setEffectType] = useState<'none' | 'pulse' | 'shake' | 'flash' | 'spin' | 'sparkles' | 'shine'>('none');
  const [effectDuration, setEffectDuration] = useState(2.0); // Seconds
  const [effectIntensity, setEffectIntensity] = useState(0.5); // 0 to 1

  // Chroma Key State
  const [chromaKeyEnabled, setChromaKeyEnabled] = useState(false);
  const [chromaKeyColor, setChromaKeyColor] = useState('#00FF00'); // Default Green
  const [chromaKeyThreshold, setChromaKeyThreshold] = useState(0.35);
  const [chromaKeyFeather, setChromaKeyFeather] = useState(0.15);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    return () => {
      frames.forEach(f => URL.revokeObjectURL(f.previewUrl));
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  const loadStaticImage = (file: File, framesArray: ImageFrame[]) => {
    return new Promise<void>((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            framesArray.push({
                id: Math.random().toString(36).substr(2, 9),
                file,
                previewUrl: url,
                width: img.width,
                height: img.height
            });
            resolve();
        };
        img.onerror = () => {
            console.error("Failed to load image:", file.name);
            resolve();
        }
        img.src = url;
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files) as File[];
      setIsProcessing(true);
      setProgress(0);
      
      const newFrames: ImageFrame[] = [];
      
      for (const file of newFiles) {
          const fileName = (file.name || '').toLowerCase();
          
          // Check if it's an SVGA file
          if (fileName.endsWith('.svga')) {
              try {
                  const buffer = await file.arrayBuffer();
                  const data = new Uint8Array(buffer);
                  
                  // Create a temporary container for SVGA Player
                  const tempDiv = document.createElement('div');
                  const player = new SVGA.Player(tempDiv);
                  const parser = new SVGA.Parser();
                  
                  const videoItem = await new Promise<any>((resolve, reject) => {
                      const blob = new Blob([data], { type: 'application/octet-stream' });
                      const url = URL.createObjectURL(blob);
                      
                      parser.load(url, (videoItem: any) => {
                          URL.revokeObjectURL(url);
                          resolve(videoItem);
                      }, (err: any) => {
                          URL.revokeObjectURL(url);
                          reject(err);
                      });
                  });
                  
                  player.setVideoItem(videoItem);
                  const totalFrames = videoItem.frames;
                  const { width, height } = videoItem.videoSize;
                  
                  setFps(videoItem.FPS || 20);
                  setDuration(totalFrames / (videoItem.FPS || 20));
                  setCanvasSize({ width, height });

                  for (let i = 0; i < totalFrames; i++) {
                      player.stepToFrame(i, false);
                      const canvas = tempDiv.querySelector('canvas');
                      if (canvas) {
                          const url = canvas.toDataURL('image/png');
                          const res = await fetch(url);
                          const blob = await res.blob();
                          
                          newFrames.push({
                              id: Math.random().toString(36).substr(2, 9),
                              file: new File([blob], `svga_frame_${i}.png`, { type: 'image/png' }),
                              previewUrl: url,
                              width: canvas.width,
                              height: canvas.height
                          });
                      }
                      setProgress(Math.floor(((i + 1) / totalFrames) * 100));
                      if (i % 5 === 0) await new Promise(r => setTimeout(r, 0));
                  }
                  
                  player.clear();
                  continue; // Move to next file
              } catch (err) {
                  console.error("Error parsing SVGA file:", err);
                  alert("فشل في قراءة ملف SVGA.");
                  continue;
              }
          }

          // Check if it's a Lottie JSON file
          if (file.type === 'application/json' || fileName.endsWith('.json')) {
              try {
                  const text = await file.text();
                  const json = JSON.parse(text);
                  // Basic Lottie validation
                  if (json.v && json.layers && json.fr) {
                      setLottieData(json);
                      setIsLottieMode(true);
                      setFps(json.fr);
                      setDuration(json.op / json.fr);
                      setCanvasSize({ width: json.w, height: json.h });
                      
                      setPendingLottieData(json);
                      setShowLottieModal(true);
                      setIsProcessing(false);
                      return; // Stop processing other files if a Lottie is found
                  }
              } catch (err) {
                  console.error("Error parsing Lottie JSON:", err);
              }
          }

          const isAnimated = file.type === 'image/gif' || file.type === 'image/webp' || (file.name || '').toLowerCase().endsWith('.gif') || (file.name || '').toLowerCase().endsWith('.webp');
          
          if (isAnimated) {
               if (typeof ImageDecoder === 'undefined') {
                   alert("متصفحك لا يدعم استخراج إطارات الصور المتحركة (WebP/GIF). سيتم تحميل الصورة كإطار ثابت.");
                   await loadStaticImage(file, newFrames);
                   continue;
               }

               try {
                   const buffer = await file.arrayBuffer();
                   const decoder = new ImageDecoder({ data: new DataView(buffer), type: file.type });
                   
                   await decoder.tracks.ready;
                   const track = decoder.tracks.selectedTrack;
                   
                   if (!track || track.frameCount <= 1) {
                       // Not animated or single frame
                       await loadStaticImage(file, newFrames);
                       continue;
                   }

                   const frameCount = track.frameCount;
                   
                   for (let i = 0; i < frameCount; i++) {
                       const result = await decoder.decode({ frameIndex: i });
                       const videoFrame = result.image;
                       
                       const canvas = document.createElement('canvas');
                       canvas.width = videoFrame.displayWidth;
                       canvas.height = videoFrame.displayHeight;
                       const ctx = canvas.getContext('2d');
                       if (ctx) {
                           ctx.drawImage(videoFrame, 0, 0);
                           const url = canvas.toDataURL('image/png');
                           
                           // Create a blob from dataURL for the file object
                           const res = await fetch(url);
                           const blob = await res.blob();

                           newFrames.push({
                               id: Math.random().toString(36).substr(2, 9),
                               file: new File([blob], `frame_${i}.png`, { type: 'image/png' }),
                               previewUrl: url,
                               width: canvas.width,
                               height: canvas.height
                           });
                       }
                       
                       videoFrame.close();
                       setProgress(Math.floor(((i + 1) / frameCount) * 100));
                   }
                   
               } catch (err) {
                   console.error("Error parsing animated image with ImageDecoder:", err);
                   // Fallback to static load
                   await loadStaticImage(file, newFrames);
               }
          } else {
              // Static image
              await loadStaticImage(file, newFrames);
          }
      }
      
      setFrames(prev => {
          const combined = [...prev, ...newFrames];
          if (autoSize && combined.length > 0 && prev.length === 0) {
              setCanvasSize({ width: combined[0].width, height: combined[0].height });
          }
          
          // If this is the first upload, set a reasonable default duration
          if (prev.length === 0 && combined.length > 0) {
              setDuration(Math.max(1, combined.length / fps));
          }
          
          return combined;
      });
      
      setIsProcessing(false);
      setProgress(0);
      
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeFrame = (id: string) => {
    setFrames(prev => prev.filter(f => f.id !== id));
    if (frames.length <= 1) {
        setLottieData(null);
        setIsLottieMode(false);
    }
  };

  const extractAssetsFromLottie = async (data: any) => {
    if (!data.assets || data.assets.length === 0) {
        alert("هذا الملف لا يحتوي على أصول (صور) داخلية.");
        return;
    }

    setIsProcessing(true);
    setProgress(0);
    const extractedAssets: ImageFrame[] = [];

    for (let i = 0; i < data.assets.length; i++) {
        const asset = data.assets[i];
        // Check if it's an image asset (has 'p' property and usually 'w', 'h')
        if (asset.p && asset.w && asset.h) {
            let imageUrl = '';
            let blob: Blob | null = null;

            if (asset.p.startsWith('data:image')) {
                // Base64 embedded image
                imageUrl = asset.p;
                const res = await fetch(imageUrl);
                blob = await res.blob();
            } else if (asset.u) {
                // External image (might not work due to CORS, but we try)
                imageUrl = asset.u + asset.p;
                try {
                    const res = await fetch(imageUrl);
                    blob = await res.blob();
                } catch (e) {
                    console.warn(`Could not fetch external asset: ${imageUrl}`);
                }
            }

            if (blob) {
                const previewUrl = URL.createObjectURL(blob);
                extractedAssets.push({
                    id: Math.random().toString(36).substr(2, 9),
                    file: new File([blob], asset.p.split('/').pop() || `asset_${i}.png`, { type: 'image/png' }),
                    previewUrl: previewUrl,
                    width: asset.w,
                    height: asset.h
                });
            }
        }
        setProgress(Math.floor(((i + 1) / data.assets.length) * 100));
    }

    if (extractedAssets.length === 0) {
        alert("لم يتم العثور على صور قابلة للاستخراج في هذا الملف.");
    } else {
        setFrames(extractedAssets);
    }
    
    setIsProcessing(false);
    setProgress(0);
  };

  useEffect(() => {
    if (isLottieMode && lottieData) {
        if (lottieExtractionMode === 'sequence') {
            extractFramesFromLottie(lottieData);
        } else {
            extractAssetsFromLottie(lottieData);
        }
    }
  }, [lottieExtractionMode, lottieData, isLottieMode]);

  const extractFramesFromLottie = async (data: any) => {
    setIsProcessing(true);
    setProgress(0);
    
    // Create a hidden canvas for high-speed rendering
    const canvas = document.createElement('canvas');
    canvas.width = data.w;
    canvas.height = data.h;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        setIsProcessing(false);
        return;
    }

    // Use Canvas renderer for much faster extraction
    const anim = (lottie as any).loadAnimation({
        renderer: 'canvas',
        loop: false,
        autoplay: false,
        animationData: data,
        rendererSettings: {
            context: ctx,
            preserveAspectRatio: 'xMidYMid meet',
            clearCanvas: true
        }
    });

    // Wait for animation to be ready
    await new Promise(resolve => {
        if (anim.isLoaded) resolve(null);
        else anim.addEventListener('DOMLoaded', () => resolve(null));
    });

    const totalFrames = data.op - data.ip;
    const extractedFrames: ImageFrame[] = [];

    // Optimize: Process in chunks to keep UI responsive
    const CHUNK_SIZE = 5;
    
    for (let i = 0; i < totalFrames; i++) {
        anim.goToAndStop(i + data.ip, true);
        
        // Canvas is updated immediately by lottie-web in canvas renderer mode
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png', 0.9));
        
        if (blob) {
            const frameUrl = URL.createObjectURL(blob);
            extractedFrames.push({
                id: Math.random().toString(36).substr(2, 9),
                file: new File([blob], `lottie_frame_${i}.png`, { type: 'image/png' }),
                previewUrl: frameUrl,
                width: data.w,
                height: data.h
            });
        }

        if (i % CHUNK_SIZE === 0) {
            setProgress(Math.floor(((i + 1) / totalFrames) * 100));
            // Yield to UI thread
            await new Promise(r => setTimeout(r, 0));
        }
    }

    setFrames(extractedFrames);
    anim.destroy();
    setIsProcessing(false);
    setProgress(0);
  };

  const applyRangeSelection = () => {
    const start = Math.max(1, rangeStart) - 1;
    const end = Math.min(frames.length, rangeEnd);
    if (start < end) {
      setFrames(prev => prev.slice(start, end));
    }
    setShowRangeModal(false);
  };

  const moveFrame = (index: number, direction: 'left' | 'right') => {
    if (direction === 'left' && index > 0) {
      setFrames(prev => {
        const newFrames = [...prev];
        [newFrames[index], newFrames[index - 1]] = [newFrames[index - 1], newFrames[index]];
        return newFrames;
      });
    } else if (direction === 'right' && index < frames.length - 1) {
      setFrames(prev => {
        const newFrames = [...prev];
        [newFrames[index], newFrames[index + 1]] = [newFrames[index + 1], newFrames[index]];
        return newFrames;
      });
    }
  };

  // Preview Animation Loop
  useEffect(() => {
    if (!isPlaying || frames.length === 0) {
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        return;
    }

    let lastTime = performance.now();
    const interval = 1000 / fps;
    const totalFrames = Math.max(1, Math.round(duration * fps));
    
    // For single image effects, we need to track time differently
    let startTime = performance.now();

    const animate = (time: number) => {
        if (frames.length === 1 && effectType !== 'none') {
            // Single Image Effect Preview
            const elapsed = (time - startTime) / 1000; // Seconds
            const effectTotalFrames = Math.floor(effectDuration * fps);
            const currentFrameIndex = Math.floor((elapsed % effectDuration) * fps);
            setCurrentPreviewFrame(currentFrameIndex % effectTotalFrames); // Use this to drive effect logic in draw
        } else {
            // Sequence Preview with Resampling
            if (time - lastTime > interval) {
                setCurrentPreviewFrame(prev => (prev + 1) % totalFrames);
                lastTime = time;
            }
        }
        animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, fps, frames.length, effectType, effectDuration]);

  // Helper function for Background & Watermark
  const drawOverlays = (ctx: CanvasRenderingContext2D, width: number, height: number, isBackground: boolean) => {
    if (isBackground && backgroundImage) {
        const img = new Image();
        img.src = backgroundImage;
        // Draw background centered and covered
        const scale = Math.max(width / img.width, height / img.height);
        const x = (width - img.width * scale) / 2;
        const y = (height - img.height * scale) / 2;
        ctx.save();
        ctx.globalCompositeOperation = 'destination-over'; // Draw behind
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
        ctx.restore();
    } else if (!isBackground && watermarkImage) {
        const img = new Image();
        img.src = watermarkImage;
        const w = width * watermarkSize;
        const h = (img.height / img.width) * w;
        let x = 0, y = 0;

        if (watermarkPosition === 'top-left') { x = 20; y = 20; }
        else if (watermarkPosition === 'top-right') { x = width - w - 20; y = 20; }
        else if (watermarkPosition === 'bottom-left') { x = 20; y = height - h - 20; }
        else if (watermarkPosition === 'bottom-right') { x = width - w - 20; y = height - h - 20; }
        else if (watermarkPosition === 'center') { x = (width - w) / 2; y = (height - h) / 2; }

        ctx.save();
        ctx.globalAlpha = watermarkOpacity;
        ctx.drawImage(img, x, y, w, h);
        ctx.restore();
    }
  };

  // Helper function for Chroma Key (Green Screen Removal)
  const processChromaKey = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    if (!chromaKeyEnabled) return;

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    // Parse Target Color
    const rT = parseInt(chromaKeyColor.slice(1, 3), 16);
    const gT = parseInt(chromaKeyColor.slice(3, 5), 16);
    const bT = parseInt(chromaKeyColor.slice(5, 7), 16);

    // Max distance in RGB space is sqrt(255^2 * 3) approx 441.67
    const maxDist = 442;
    const threshold = chromaKeyThreshold * maxDist;
    const feather = chromaKeyFeather * maxDist;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Euclidean distance
        const dist = Math.sqrt((r - rT) ** 2 + (g - gT) ** 2 + (b - bT) ** 2);

        if (dist < threshold) {
            data[i + 3] = 0; // Fully transparent
        } else if (dist < threshold + feather) {
            // Feathering: Map dist from [threshold, threshold+feather] to [0, 1]
            // Smooth transition for anti-aliasing
            const alpha = (dist - threshold) / feather;
            data[i + 3] = Math.floor(data[i + 3] * alpha);
        }
    }
    
    ctx.putImageData(imageData, 0, 0);
  };

  // Helper function to draw sparkles
  const drawSparkles = (ctx: CanvasRenderingContext2D, width: number, height: number, time: number, intensity: number) => {
    const sparkleCount = Math.floor(20 + intensity * 50);
    for (let i = 0; i < sparkleCount; i++) {
        // Deterministic pseudo-random based on index
        const seed = i * 1337;
        const x = ((Math.sin(seed) * 10000) % width + width) % width;
        const y = ((Math.cos(seed) * 10000) % height + height) % height;
        
        // Animate based on time and seed
        const offset = (seed % 100) / 100;
        const life = (time + offset) % 1; // 0 to 1 loop
        
        // Fade in and out
        const alpha = Math.sin(life * Math.PI); // 0 -> 1 -> 0
        
        // Size variation
        const size = (2 + (seed % 5)) * (0.5 + intensity);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowBlur = 10 * intensity;
        ctx.shadowColor = 'white';
        
        // Draw star shape
        ctx.translate(x, y);
        ctx.rotate(life * Math.PI); // Rotate slightly
        ctx.beginPath();
        for(let j=0; j<4; j++) {
            ctx.rotate(Math.PI / 2);
            ctx.lineTo(0, 0 - size);
            ctx.lineTo(0 + size/4, 0 - size/4);
        }
        ctx.fill();
        ctx.restore();
    }
  };

  // Helper function to draw shine
  const drawShine = (ctx: CanvasRenderingContext2D, width: number, height: number, time: number, intensity: number) => {
      const t = time % 1; // 0 to 1
      const shineWidth = width * (0.2 + intensity * 0.3);
      const startX = -shineWidth - width; // Start far left
      const endX = width * 2; // End far right
      const x = startX + (endX - startX) * t;
      
      ctx.save();
      ctx.beginPath();
      // Skewed rectangle
      ctx.moveTo(x, 0);
      ctx.lineTo(x + shineWidth, 0);
      ctx.lineTo(x + shineWidth - width * 0.5, height); // Skew
      ctx.lineTo(x - width * 0.5, height);
      ctx.closePath();
      
      const gradient = ctx.createLinearGradient(x, 0, x + shineWidth, 0);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
      gradient.addColorStop(0.5, `rgba(255, 255, 255, ${0.3 + intensity * 0.4})`);
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      
      ctx.fillStyle = gradient;
      ctx.globalCompositeOperation = 'overlay'; // Blend mode
      ctx.fill();
      
      // Second pass
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = gradient; 
      ctx.globalAlpha = 0.5;
      ctx.fill();
      
      ctx.restore();
  };

  // Draw Preview
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas || frames.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (frames.length === 1 && effectType !== 'none') {
        // Apply Effect Logic for Preview
        const frame = frames[0];
        const img = new Image();
        img.src = frame.previewUrl;
        
        // Calculate transform based on currentPreviewFrame (which acts as time ticker)
        const totalFrames = Math.floor(effectDuration * fps);
        const t = (currentPreviewFrame % totalFrames) / totalFrames; // 0 to 1
        
        let scaleX = 1, scaleY = 1, translateX = 0, translateY = 0, rotation = 0, alpha = 1;

        if (effectType === 'pulse') {
            const s = 1 + Math.sin(t * Math.PI * 2) * (0.1 + effectIntensity * 0.2);
            scaleX = s; scaleY = s;
        } else if (effectType === 'shake') {
            const shake = Math.sin(t * Math.PI * 10) * (5 + effectIntensity * 20);
            translateX = shake;
        } else if (effectType === 'flash') {
            alpha = 0.5 + Math.abs(Math.sin(t * Math.PI * 2)) * 0.5;
        } else if (effectType === 'spin') {
            rotation = t * 360;
        }

        // Draw with transforms
        ctx.save();
        ctx.globalAlpha = alpha;
        
        // Center pivot
        const imgScale = Math.min(canvas.width / frame.width, canvas.height / frame.height);
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        
        ctx.translate(centerX + translateX, centerY + translateY);
        ctx.rotate(rotation * Math.PI / 180);
        ctx.scale(scaleX, scaleY);
        
        const drawW = frame.width * imgScale;
        const drawH = frame.height * imgScale;
        ctx.drawImage(img, -drawW/2, -drawH/2, drawW, drawH);
        
        ctx.restore();

        // Apply Chroma Key (on the whole canvas after drawing the frame)
        if (chromaKeyEnabled) {
            processChromaKey(ctx, canvas.width, canvas.height);
        }

        // Draw Overlay Effects (Sparkles / Shine)
        if (effectType === 'sparkles') {
            drawSparkles(ctx, canvas.width, canvas.height, t, effectIntensity);
        } else if (effectType === 'shine') {
            drawShine(ctx, canvas.width, canvas.height, t, effectIntensity);
        }

    } else {
        // Standard Sequence Draw with Resampling
        const totalFrames = Math.max(1, Math.round(duration * fps));
        const resampledIndex = Math.floor((currentPreviewFrame % totalFrames) / totalFrames * frames.length);
        const frame = frames[resampledIndex];
        if (!frame) return;

        const img = new Image();
        img.src = frame.previewUrl;
        // Draw centered and contained
        const scale = Math.min(canvas.width / frame.width, canvas.height / frame.height);
        const x = (canvas.width - frame.width * scale) / 2;
        const y = (canvas.height - frame.height * scale) / 2;
        
        ctx.drawImage(img, x, y, frame.width * scale, frame.height * scale);

        // Apply Chroma Key
        if (chromaKeyEnabled) {
            processChromaKey(ctx, canvas.width, canvas.height);
        }

        // Apply Overlays
        if (backgroundImage) drawOverlays(ctx, canvas.width, canvas.height, true);
        if (watermarkImage) drawOverlays(ctx, canvas.width, canvas.height, false);
    }
  }, [currentPreviewFrame, frames, canvasSize, effectType, effectDuration, effectIntensity, chromaKeyEnabled, chromaKeyColor, chromaKeyThreshold, chromaKeyFeather, backgroundImage, watermarkImage, watermarkOpacity, watermarkPosition, watermarkSize]);

  const generateSVGA = async () => {
    if (frames.length === 0) return;

    if (!currentUser) {
      onLoginRequired();
      return;
    }

    const { allowed, reason } = await checkAccess('Image to SVGA');
    if (!allowed) {
      if (reason === 'trial_ended' && onSubscriptionRequired) onSubscriptionRequired();
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
        const parsed = parse(svgaSchema);
        const root = parsed.root;
        const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");

        const imagesData: Record<string, Uint8Array> = {};
        const sprites: any[] = [];
        
        // Determine mode
        const isSingleImageEffect = frames.length === 1 && effectType !== 'none';
        const totalFrames = isSingleImageEffect ? Math.floor(effectDuration * fps) : frames.length;

        if (isSingleImageEffect) {
            // --- Single Image Effect Mode ---
            const frame = frames[0];
            
            // For complex effects like Sparkles/Shine, we MUST bake frames (Raster Sequence)
            // For simple transforms (Pulse, Spin), we can use Sprites (Vector Transform)
            const isBakedEffect = effectType === 'sparkles' || effectType === 'shine';

            if (isBakedEffect) {
                // RASTER SEQUENCE MODE (Heavy but detailed)
                const img = new Image();
                img.src = frame.previewUrl;
                await new Promise(r => img.onload = r);

                for (let f = 0; f < totalFrames; f++) {
                    const t = f / totalFrames;
                    const key = `img_${f}`;
                    
                    const canvas = document.createElement('canvas');
                    canvas.width = canvasSize.width;
                    canvas.height = canvasSize.height;
                    const ctx = canvas.getContext('2d');
                    
                    if (ctx) {
                        // Draw Background
                        if (backgroundImage) drawOverlays(ctx, canvas.width, canvas.height, true);

                        // Draw Base Image
                        const scale = Math.min(canvas.width / frame.width, canvas.height / frame.height);
                        const x = (canvas.width - frame.width * scale) / 2;
                        const y = (canvas.height - frame.height * scale) / 2;
                        ctx.drawImage(img, x, y, frame.width * scale, frame.height * scale);

                        // Apply Chroma Key
                        processChromaKey(ctx, canvas.width, canvas.height);

                        // Draw Watermark
                        if (watermarkImage) drawOverlays(ctx, canvas.width, canvas.height, false);

                        // Draw Overlay
                        if (effectType === 'sparkles') drawSparkles(ctx, canvas.width, canvas.height, t, effectIntensity);
                        if (effectType === 'shine') drawShine(ctx, canvas.width, canvas.height, t, effectIntensity);

                        const dataUrl = canvas.toDataURL('image/png', quality);
                        const binary = atob(dataUrl.split(',')[1]);
                        const bytes = new Uint8Array(binary.length);
                        for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
                        imagesData[key] = bytes;
                    }

                    // Create Sprite Entry for this frame
                    // In baked mode, we swap images every frame
                    sprites.push({
                        imageKey: key,
                        frames: [{
                            alpha: 1.0,
                            layout: { x: 0, y: 0, width: canvasSize.width, height: canvasSize.height },
                            transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }
                        }]
                    });
                    
                    // Note: The above structure creates a new sprite for EVERY frame. 
                    // Better SVGA structure: One Sprite, multiple frames switching imageKey? 
                    // SVGA 2.0 doesn't support switching imageKey per frame easily in one sprite.
                    // Instead, we create ONE sprite per frame, and toggle visibility.
                    // OR: We create ONE sprite with ONE imageKey, but that's static.
                    // CORRECT APPROACH for Sequence: 
                    // We need to generate a sequence of images, but SVGA is best with one sprite having many frames.
                    // However, SVGA doesn't support "image sequence" natively in one sprite without using a matte or complex setup.
                    // The standard way for "Video to SVGA" or "Sequence" is creating N sprites, each visible for 1 frame.
                    // Let's refine the loop below.
                }

                // Refined Loop for Baked Sequence:
                // We actually need to clear the sprites array and rebuild it correctly.
                // The previous loop was pushing to sprites array incorrectly for a sequence.
                // Let's fix it.
                sprites.length = 0; // Clear
                
                // We will create ONE sprite for EACH frame, visible only at its time slot.
                // This is the "Frame-by-Frame" method.
                for (let f = 0; f < totalFrames; f++) {
                    const key = `img_${f}`;
                    const spriteFrames = [];
                    for (let time = 0; time < totalFrames; time++) {
                        spriteFrames.push({
                            alpha: time === f ? 1.0 : 0.0, // Only visible at its specific frame index
                            layout: { x: 0, y: 0, width: canvasSize.width, height: canvasSize.height },
                            transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }
                        });
                    }
                    sprites.push({
                        imageKey: key,
                        frames: spriteFrames
                    });
                    setProgress(Math.floor(((f + 1) / totalFrames) * 100));
                }

            } else {
                // VECTOR TRANSFORM MODE (Lightweight)
                // (Existing Logic for Pulse, Spin, etc.)
                const key = "img_0";
                
                // Process Image Once
                const img = new Image();
                img.src = frame.previewUrl;
                await new Promise(r => img.onload = r);
                
                const canvas = document.createElement('canvas');
                canvas.width = canvasSize.width;
                canvas.height = canvasSize.height;
                const ctx = canvas.getContext('2d');
                
                if (ctx) {
                    // Draw Background
                    if (backgroundImage) drawOverlays(ctx, canvas.width, canvas.height, true);

                    const scale = Math.min(canvas.width / frame.width, canvas.height / frame.height);
                    const x = (canvas.width - frame.width * scale) / 2;
                    const y = (canvas.height - frame.height * scale) / 2;
                    ctx.drawImage(img, x, y, frame.width * scale, frame.height * scale);
                    
                    // Apply Chroma Key
                    processChromaKey(ctx, canvas.width, canvas.height);

                    // Draw Watermark
                    if (watermarkImage) drawOverlays(ctx, canvas.width, canvas.height, false);

                    const dataUrl = canvas.toDataURL('image/png', quality);
                    const binary = atob(dataUrl.split(',')[1]);
                    const bytes = new Uint8Array(binary.length);
                    for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
                    imagesData[key] = bytes;
                }

                // Generate Animated Frames
                const spriteFrames = [];
                for (let f = 0; f < totalFrames; f++) {
                    const t = f / totalFrames; // 0 to 1
                    let a = 1, b = 0, c = 0, d = 1, tx = 0, ty = 0, alpha = 1;

                    if (effectType === 'pulse') {
                        const s = 1 + Math.sin(t * Math.PI * 2) * (0.1 + effectIntensity * 0.2);
                        a = s; d = s;
                        tx = (1 - s) * (canvasSize.width / 2);
                        ty = (1 - s) * (canvasSize.height / 2);
                    } else if (effectType === 'shake') {
                        tx = Math.sin(t * Math.PI * 10) * (5 + effectIntensity * 20);
                    } else if (effectType === 'flash') {
                        alpha = 0.5 + Math.abs(Math.sin(t * Math.PI * 2)) * 0.5;
                    } else if (effectType === 'spin') {
                        const angle = t * 360 * (Math.PI / 180);
                        const cos = Math.cos(angle);
                        const sin = Math.sin(angle);
                        a = cos; b = sin; c = -sin; d = cos;
                        const cx = canvasSize.width / 2;
                        const cy = canvasSize.height / 2;
                        tx = cx * (1 - cos) + cy * sin;
                        ty = cy * (1 - cos) - cx * sin;
                    }

                    spriteFrames.push({
                        alpha: alpha,
                        layout: { x: 0, y: 0, width: canvasSize.width, height: canvasSize.height },
                        transform: { a, b, c, d, tx, ty }
                    });
                }

                sprites.push({
                    imageKey: key,
                    frames: spriteFrames
                });
            }
        } else {
            // --- Sequence Mode (Resampled) ---
            const totalFrames = Math.max(1, Math.round(duration * fps));
            
            for (let i = 0; i < totalFrames; i++) {
                const resampledIndex = Math.floor((i / totalFrames) * frames.length);
                const frame = frames[resampledIndex];
                const key = `img_${i}`;

                // Process Image
                const img = new Image();
                img.src = frame.previewUrl;
                await new Promise(r => img.onload = r);

                const canvas = document.createElement('canvas');
                canvas.width = canvasSize.width;
                canvas.height = canvasSize.height;
                const ctx = canvas.getContext('2d');
                
                if (ctx) {
                    // Draw Background
                    if (backgroundImage) drawOverlays(ctx, canvas.width, canvas.height, true);

                    // Draw image centered
                    const scale = Math.min(canvas.width / frame.width, canvas.height / frame.height);
                    const x = (canvas.width - frame.width * scale) / 2;
                    const y = (canvas.height - frame.height * scale) / 2;
                    ctx.drawImage(img, x, y, frame.width * scale, frame.height * scale);

                    // Apply Chroma Key
                    processChromaKey(ctx, canvas.width, canvas.height);

                    // Draw Watermark
                    if (watermarkImage) drawOverlays(ctx, canvas.width, canvas.height, false);

                    // --- Ultra-Compression System (Same as Video System) ---
                    if (target10MB || selectedQuality !== 'high') {
                        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        const data = imageData.data;
                        
                        // 1. Spatial Smoothing (Noise reduction for better DEFLATE)
                        const blurAlpha = target10MB ? 0.2 : (selectedQuality === 'low' ? 0.3 : 0.1);
                        ctx.globalAlpha = blurAlpha;
                        ctx.drawImage(canvas, 1, 0);
                        ctx.drawImage(canvas, -1, 0);
                        ctx.drawImage(canvas, 0, 1);
                        ctx.drawImage(canvas, 0, -1);
                        ctx.globalAlpha = 1.0;

                        // 2. Color Quantization
                        let levels = 255;
                        if (target10MB) {
                            levels = totalFrames > 300 ? 16 : (totalFrames > 150 ? 32 : 64);
                        } else {
                            levels = selectedQuality === 'low' ? 32 : (selectedQuality === 'medium' ? 128 : 255);
                        }

                        const finalData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        const d = finalData.data;
                        for (let j = 0; j < d.length; j += 4) {
                            if (d[j+3] < 10) continue; // Skip transparent
                            d[j] = Math.round(d[j] / (256/levels)) * (256/levels);
                            d[j+1] = Math.round(d[j+1] / (256/levels)) * (256/levels);
                            d[j+2] = Math.round(d[j+2] / (256/levels)) * (256/levels);
                        }
                        ctx.putImageData(finalData, 0, 0);
                    }

                    const mimeType = imageFormat === 'png' ? 'image/png' : (imageFormat === 'jpeg' ? 'image/jpeg' : 'image/webp');
                    const dataUrl = canvas.toDataURL(mimeType, quality);
                    const binary = atob(dataUrl.split(',')[1]);
                    const bytes = new Uint8Array(binary.length);
                    for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
                    
                    imagesData[key] = bytes;
                }

                // Create Sprite
                const spriteFrames = [];
                for (let f = 0; f < totalFrames; f++) {
                    spriteFrames.push({
                        alpha: f === i ? 1.0 : 0.0,
                        layout: { x: 0, y: 0, width: canvasSize.width, height: canvasSize.height },
                        transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }
                    });
                }

                sprites.push({
                    imageKey: key,
                    frames: spriteFrames
                });

                setProgress(Math.floor(((i + 1) / totalFrames) * 100));
            }
        }

        const payload = {
            version: "2.0",
            params: {
                viewBoxWidth: canvasSize.width,
                viewBoxHeight: canvasSize.height,
                fps: fps,
                frames: totalFrames
            },
            images: imagesData,
            sprites: sprites,
            audios: []
        };

        const errMsg = MovieEntity.verify(payload);
        if (errMsg) throw Error(`Payload verification failed: ${errMsg}`);

        const message = MovieEntity.create(payload);
        const buffer = MovieEntity.encode(message).finish();
        const compressed = pako.deflate(buffer);
        
        const blob = new Blob([compressed], { type: 'application/octet-stream' });
        
        if (currentUser) {
            logActivity(currentUser, 'generate_svga', `Generated SVGA from ${frames.length} images. Size: ${(blob.size / 1024).toFixed(2)} KB`);
        }

        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `sequence_animation_${Date.now()}.svga`;
        link.click();

    } catch (e: any) {
        console.error(e);
        alert(`فشل إنشاء ملف SVGA: ${e.message || e}`);
    } finally {
        setIsProcessing(false);
    }
  };

  const generateLottie = async () => {
    if (frames.length === 0) return;

    if (!currentUser) {
      onLoginRequired();
      return;
    }

    setIsProcessing(true);
    setExportPhase('جاري تصدير ملف Lottie...');
    setProgress(0);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = canvasSize.width;
      canvas.height = canvasSize.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Could not get canvas context");

      const lottieFrames: { data: string; w: number; h: number }[] = [];
      const totalFramesCount = Math.max(1, Math.round(duration * fps));

      for (let i = 0; i < totalFramesCount; i++) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // Draw the frame exactly as it appears in preview
          const resampledIndex = Math.floor((i / totalFramesCount) * frames.length);
          const frame = frames[resampledIndex];
          
          const img = await new Promise<HTMLImageElement>((resolve) => {
              const image = new Image();
              image.onload = () => resolve(image);
              image.src = frame.previewUrl;
          });

          const scale = Math.min(canvas.width / frame.width, canvas.height / frame.height);
          const x = (canvas.width - frame.width * scale) / 2;
          const y = (canvas.height - frame.height * scale) / 2;
          ctx.drawImage(img, x, y, frame.width * scale, frame.height * scale);

          // Apply Chroma Key if enabled
          if (chromaKeyEnabled) {
              processChromaKey(ctx, canvas.width, canvas.height);
          }

          // Apply Overlays
          if (backgroundImage) drawOverlays(ctx, canvas.width, canvas.height, true);
          if (watermarkImage) drawOverlays(ctx, canvas.width, canvas.height, false);

          const dataUrl = canvas.toDataURL('image/png', 0.8);
          lottieFrames.push({ data: dataUrl, w: canvas.width, h: canvas.height });
          
          setProgress(Math.floor(((i + 1) / totalFramesCount) * 100));
          if (i % 10 === 0) await new Promise(r => setTimeout(r, 0));
      }

      const lottieJson = await convertFramesToLottieSequence(lottieFrames, fps);
      
      const blob = new Blob([JSON.stringify(lottieJson)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `animation_lottie_${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      if (currentUser) {
        logActivity(currentUser, 'export_lottie', `Exported Lottie from ${frames.length} frames`);
      }
      
      alert("✅ تم تصدير ملف Lottie بنجاح!");
    } catch (err) {
      console.error("Lottie Export Error:", err);
      alert("حدث خطأ أثناء تصدير ملف Lottie.");
    } finally {
      setIsProcessing(false);
      setExportPhase('');
      setProgress(0);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 sm:p-10 bg-slate-900/60 backdrop-blur-3xl rounded-[3rem] border border-white/10 shadow-3xl text-right font-sans" dir="rtl">
      <div className="flex items-center justify-between mb-10">
        {onCancel && (
            <button onClick={onCancel} className="p-3 hover:bg-white/10 rounded-2xl transition-all text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
            </button>
        )}
        <div className="text-right flex items-center gap-4 ml-auto">
          <div>
            <h2 className="text-3xl font-black text-white tracking-tighter">تحويل الصور إلى SVGA</h2>
            <p className="text-slate-500 text-xs mt-1 font-bold uppercase tracking-widest">إنشاء رسوم متحركة من تسلسل الصور</p>
          </div>
          <div className="w-12 h-12 bg-purple-500/20 rounded-2xl flex items-center justify-center border border-purple-500/30">
            <Images className="w-6 h-6 text-purple-400" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Preview & Settings */}
        <div className="lg:col-span-5 space-y-6">
            <div className="bg-black/40 rounded-[2.5rem] border border-white/10 overflow-hidden relative aspect-square flex items-center justify-center shadow-2xl">
                {isLottieMode && lottieData ? (
                    <div className="w-full h-full flex items-center justify-center">
                        <LottiePlayer 
                            animationData={lottieData} 
                            loop={isPlaying}
                            autoplay={isPlaying}
                            className="w-full h-full flex items-center justify-center"
                        />
                    </div>
                ) : (
                    <canvas 
                        ref={previewCanvasRef} 
                        width={canvasSize.width} 
                        height={canvasSize.height} 
                        className="max-w-full max-h-full object-contain"
                    />
                )}
                {frames.length === 0 && !lottieData && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-4">
                        <Images className="w-16 h-16 opacity-20" />
                        <span className="text-xs font-black uppercase tracking-widest">لا توجد صور للمعاينة</span>
                    </div>
                )}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-slate-950/80 backdrop-blur-md px-6 py-2 rounded-2xl border border-white/10">
                    <button onClick={() => setIsPlaying(!isPlaying)} className="text-white hover:text-purple-400 transition-colors">
                        {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current" />}
                    </button>
                    <span className="text-white font-mono text-xs w-24 text-center">
                        {currentPreviewFrame + 1} / {Math.max(1, Math.round(duration * fps))}
                    </span>
                </div>
            </div>

            <div className="bg-slate-950/40 p-6 rounded-[2.5rem] border border-white/5 space-y-6">
                <div className="flex items-center gap-2 mb-2">
                    <Settings className="w-4 h-4 text-purple-400" />
                    <h3 className="text-white font-black text-xs uppercase tracking-widest">إعدادات الحركة</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-[9px] text-slate-500 font-black uppercase tracking-widest">سرعة الإطارات (FPS)</label>
                        <input 
                            type="number" 
                            value={fps} 
                            onChange={(e) => {
                                const newFps = Math.max(1, parseFloat(e.target.value) || 10);
                                setFps(newFps);
                            }}
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-xs text-center outline-none focus:border-purple-500 transition-all"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[9px] text-slate-500 font-black uppercase tracking-widest">المدة (ثواني)</label>
                        <input 
                            type="number" 
                            step="0.1"
                            value={duration} 
                            onChange={(e) => {
                                const newDuration = Math.max(0.1, parseFloat(e.target.value) || 1);
                                setDuration(newDuration);
                            }}
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-xs text-center outline-none focus:border-purple-500 transition-all"
                        />
                    </div>
                </div>

                <div className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/10">
                    <div className="flex flex-col">
                        <span className="text-[9px] font-black text-white uppercase">الحفاظ على المدة عند الرفع</span>
                        <span className="text-[7px] text-slate-500 font-bold">تعديل FPS تلقائياً عند إضافة صور</span>
                    </div>
                    <button 
                        onClick={() => setPreserveDuration(!preserveDuration)}
                        className={`w-10 h-5 rounded-full transition-all relative ${preserveDuration ? 'bg-purple-500 shadow-glow-purple' : 'bg-slate-800'}`}
                    >
                        <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${preserveDuration ? 'right-1' : 'left-1'}`} />
                    </button>
                </div>

                {/* Target 10MB Limit Toggle */}
                <div className="flex items-center justify-between p-4 bg-sky-500/10 rounded-2xl border border-sky-500/20">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-sky-500/20 rounded-lg flex items-center justify-center text-sky-400">
                            <Zap className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-white text-[10px] font-black uppercase tracking-tighter">Target 10MB Limit</p>
                            <p className="text-sky-400/60 text-[8px] font-bold">ضغط هجومي للوصول لحجم 10 ميجا</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => setTarget10MB(!target10MB)}
                        className={`w-12 h-6 rounded-full transition-all relative ${target10MB ? 'bg-sky-500' : 'bg-slate-800'}`}
                    >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${target10MB ? 'left-7' : 'left-1'}`} />
                    </button>
                </div>

                {/* Image Format */}
                <div className="space-y-2">
                    <label className="text-[9px] text-slate-500 font-black uppercase tracking-widest">صيغة الصور الداخلية</label>
                    <div className="grid grid-cols-3 gap-2">
                        {(['png', 'jpeg', 'webp'] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => setImageFormat(f)}
                                className={`py-2 rounded-xl border text-[10px] font-black uppercase transition-all ${imageFormat === f ? 'bg-purple-500 border-purple-500 text-white' : 'bg-white/5 border-white/10 text-slate-400'}`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-[9px] text-slate-500 font-black uppercase tracking-widest">جودة الصور</label>
                    <div className="flex gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
                            <button onClick={() => setSelectedQuality('low')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${selectedQuality === 'low' ? 'bg-red-500/20 text-red-400 shadow-glow-red' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>منخفضة</button>
                            <button onClick={() => setSelectedQuality('medium')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${selectedQuality === 'medium' ? 'bg-yellow-500/20 text-yellow-400 shadow-glow-yellow' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>متوسطة</button>
                            <button onClick={() => setSelectedQuality('high')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${selectedQuality === 'high' ? 'bg-emerald-500/20 text-emerald-400 shadow-glow-green' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>عالية</button>
                        </div>
                    </div>


                {/* Background & Watermark Settings */}
                <div className="space-y-4 pt-4 border-t border-white/5">
                    <div className="flex items-center gap-2 mb-2">
                        <ImageIcon className="w-4 h-4 text-purple-400" />
                        <h3 className="text-white font-black text-[10px] uppercase tracking-widest">الخلفية والعلامة المائية</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Background Upload */}
                        <div className="space-y-2">
                            <label className="text-[9px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-2">
                                <ImageIcon className="w-3 h-3" /> صورة الخلفية
                            </label>
                            <div className="relative group">
                                <input 
                                    type="file" accept="image/*" className="hidden" id="bg-upload"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) setBackgroundImage(URL.createObjectURL(file));
                                    }}
                                />
                                <label htmlFor="bg-upload" className="flex flex-col items-center justify-center aspect-video bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-all overflow-hidden">
                                    {backgroundImage ? (
                                        <img src={backgroundImage} className="w-full h-full object-cover" />
                                    ) : (
                                        <Upload className="w-4 h-4 text-slate-500" />
                                    )}
                                </label>
                                {backgroundImage && (
                                    <button onClick={() => setBackgroundImage(null)} className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg">
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Watermark Upload */}
                        <div className="space-y-2">
                            <label className="text-[9px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-2">
                                <Stamp className="w-3 h-3" /> العلامة المائية
                            </label>
                            <div className="relative group">
                                <input 
                                    type="file" accept="image/*" className="hidden" id="wm-upload"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) setWatermarkImage(URL.createObjectURL(file));
                                    }}
                                />
                                <label htmlFor="wm-upload" className="flex flex-col items-center justify-center aspect-video bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-all overflow-hidden">
                                    {watermarkImage ? (
                                        <img src={watermarkImage} className="w-full h-full object-contain" />
                                    ) : (
                                        <Upload className="w-4 h-4 text-slate-500" />
                                    )}
                                </label>
                                {watermarkImage && (
                                    <button onClick={() => setWatermarkImage(null)} className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg">
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {watermarkImage && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="space-y-2">
                                <label className="text-[9px] text-slate-500 font-black uppercase tracking-widest">موقع العلامة المائية</label>
                                <div className="grid grid-cols-5 gap-1">
                                    {(['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'] as const).map(pos => (
                                        <button 
                                            key={pos}
                                            onClick={() => setWatermarkPosition(pos)}
                                            className={`py-1.5 rounded-lg border text-[8px] font-black uppercase transition-all ${watermarkPosition === pos ? 'bg-purple-500 border-purple-500 text-white' : 'bg-white/5 border-white/10 text-slate-500'}`}
                                        >
                                            {pos.replace('-', ' ')}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <label className="text-[9px] text-slate-500 font-black uppercase tracking-widest">الشفافية</label>
                                        <span className="text-[9px] text-white font-mono">{Math.round(watermarkOpacity * 100)}%</span>
                                    </div>
                                    <input 
                                        type="range" min="0" max="1" step="0.01" 
                                        value={watermarkOpacity} 
                                        onChange={(e) => setWatermarkOpacity(parseFloat(e.target.value))}
                                        className="w-full h-1.5 bg-white/5 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <label className="text-[9px] text-slate-500 font-black uppercase tracking-widest">الحجم</label>
                                        <span className="text-[9px] text-white font-mono">{Math.round(watermarkSize * 100)}%</span>
                                    </div>
                                    <input 
                                        type="range" min="0.05" max="0.5" step="0.01" 
                                        value={watermarkSize} 
                                        onChange={(e) => setWatermarkSize(parseFloat(e.target.value))}
                                        className="w-full h-1.5 bg-white/5 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Chroma Key Settings */}
                <div className="space-y-4 pt-4 border-t border-white/5">
                    <div className="flex items-center justify-between">
                        <label className="text-[9px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${chromaKeyEnabled ? 'bg-green-500 shadow-glow-green' : 'bg-slate-600'}`}></div>
                            إزالة الخلفية (Chroma Key)
                        </label>
                        <button 
                            onClick={() => setChromaKeyEnabled(!chromaKeyEnabled)}
                            className={`text-[8px] px-3 py-1.5 rounded-lg border transition-all font-black uppercase ${chromaKeyEnabled ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-white/5 text-slate-500 border-white/10'}`}
                        >
                            {chromaKeyEnabled ? 'مفعل (ON)' : 'معطل (OFF)'}
                        </button>
                    </div>

                    {chromaKeyEnabled && (
                        <div className="grid grid-cols-1 gap-4 animate-in slide-in-from-top-2 fade-in duration-300 bg-black/20 p-4 rounded-2xl border border-white/5">
                            <div className="flex items-center gap-4">
                                <div className="flex-1 space-y-2">
                                    <label className="text-[9px] text-slate-500 font-black uppercase tracking-widest">لون الخلفية</label>
                                    <div className="flex gap-2">
                                        <input 
                                            type="color" 
                                            value={chromaKeyColor}
                                            onChange={(e) => setChromaKeyColor(e.target.value)}
                                            className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                                        />
                                        <input 
                                            type="text" 
                                            value={chromaKeyColor}
                                            onChange={(e) => setChromaKeyColor(e.target.value)}
                                            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 text-[10px] text-white font-mono uppercase"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <label className="text-[9px] text-slate-500 font-black uppercase tracking-widest">الحساسية (Threshold)</label>
                                    <span className="text-[9px] text-white font-mono">{Math.round(chromaKeyThreshold * 100)}%</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="0" 
                                    max="0.8" 
                                    step="0.01" 
                                    value={chromaKeyThreshold} 
                                    onChange={(e) => setChromaKeyThreshold(parseFloat(e.target.value))}
                                    className="w-full h-1.5 bg-white/5 rounded-lg appearance-none cursor-pointer accent-green-500"
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <label className="text-[9px] text-slate-500 font-black uppercase tracking-widest">النعومة (Feather)</label>
                                    <span className="text-[9px] text-white font-mono">{Math.round(chromaKeyFeather * 100)}%</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="0" 
                                    max="0.5" 
                                    step="0.01" 
                                    value={chromaKeyFeather} 
                                    onChange={(e) => setChromaKeyFeather(parseFloat(e.target.value))}
                                    className="w-full h-1.5 bg-white/5 rounded-lg appearance-none cursor-pointer accent-green-500"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Single Image Effects Controls */}
                {frames.length === 1 && (
                    <div className="space-y-4 pt-4 border-t border-white/5">
                        <div className="space-y-2">
                            <label className="text-[9px] text-slate-500 font-black uppercase tracking-widest">تأثير الحركة (صورة واحدة)</label>
                            <select 
                                value={effectType} 
                                onChange={(e) => setEffectType(e.target.value as any)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-xs text-center outline-none focus:border-purple-500 transition-all appearance-none"
                            >
                                <option value="none">بدون تأثير (ثابت)</option>
                                <option value="pulse">نبض (Pulse)</option>
                                <option value="shake">اهتزاز (Shake)</option>
                                <option value="flash">وميض (Flash)</option>
                                <option value="spin">دوران (Spin)</option>
                                <option value="sparkles">بريق (Sparkles)</option>
                                <option value="shine">لمعان (Shine)</option>
                            </select>
                        </div>

                        {effectType !== 'none' && (
                            <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2 fade-in duration-300">
                                <div className="space-y-2">
                                    <label className="text-[9px] text-slate-500 font-black uppercase tracking-widest">المدة (ثواني)</label>
                                    <input 
                                        type="number" 
                                        value={effectDuration} 
                                        step="0.1"
                                        min="0.5"
                                        max="10"
                                        onChange={(e) => setEffectDuration(parseFloat(e.target.value))}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-xs text-center outline-none focus:border-purple-500 transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[9px] text-slate-500 font-black uppercase tracking-widest">الحدة ({Math.round(effectIntensity * 100)}%)</label>
                                    <input 
                                        type="range" 
                                        min="0" 
                                        max="1" 
                                        step="0.1"
                                        value={effectIntensity} 
                                        onChange={(e) => setEffectIntensity(parseFloat(e.target.value))}
                                        className="w-full h-2 bg-white/5 rounded-lg appearance-none cursor-pointer accent-purple-500 mt-3"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="space-y-3 pt-4 border-t border-white/5">
                    <div className="flex justify-between items-center">
                        <label className="text-[9px] text-slate-500 font-black uppercase tracking-widest">أبعاد الملف</label>
                        <button onClick={() => setAutoSize(!autoSize)} className={`text-[8px] px-2 py-1 rounded-lg border ${autoSize ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' : 'bg-white/5 text-slate-500 border-white/10'}`}>
                            {autoSize ? 'تلقائي (من أول صورة)' : 'يدوي'}
                        </button>
                    </div>
                    {!autoSize && (
                        <div className="grid grid-cols-2 gap-4">
                            <input 
                                type="number" 
                                placeholder="العرض"
                                value={canvasSize.width}
                                onChange={(e) => setCanvasSize(p => ({ ...p, width: parseInt(e.target.value) || 0 }))}
                                className="bg-white/5 border border-white/10 rounded-xl p-3 text-white text-xs text-center outline-none"
                            />
                            <input 
                                type="number" 
                                placeholder="الارتفاع"
                                value={canvasSize.height}
                                onChange={(e) => setCanvasSize(p => ({ ...p, height: parseInt(e.target.value) || 0 }))}
                                className="bg-white/5 border border-white/10 rounded-xl p-3 text-white text-xs text-center outline-none"
                            />
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <button 
                        onClick={generateSVGA}
                        disabled={frames.length === 0 || isProcessing}
                        className={`py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${frames.length === 0 || isProcessing ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-purple-500 text-white shadow-glow-purple hover:bg-purple-400 active:scale-95'}`}
                    >
                        {isProcessing ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <>
                                <Download className="w-4 h-4" />
                                <span>تصدير SVGA</span>
                            </>
                        )}
                    </button>

                    <button 
                        onClick={generateLottie}
                        disabled={frames.length === 0 || isProcessing}
                        className={`py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${frames.length === 0 || isProcessing ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-blue-500 text-white shadow-glow-blue hover:bg-blue-400 active:scale-95'}`}
                    >
                        {isProcessing ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <>
                                <Zap className="w-4 h-4" />
                                <span>تصدير Lottie</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>

        {/* Right: Image List */}
        <div className="lg:col-span-7 flex flex-col gap-6">
            {isLottieMode && (
                <div className="bg-slate-900/60 border border-white/10 rounded-[2.5rem] p-6">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="text-right flex-1">
                            <div className="flex items-center justify-end gap-3">
                                <button 
                                    onClick={() => {
                                        setLottieData(null);
                                        setIsLottieMode(false);
                                        setFrames([]);
                                    }}
                                    className="text-red-500 hover:text-red-400 text-[10px] font-black uppercase"
                                >
                                    إلغاء وضع Lottie
                                </button>
                                <h3 className="text-white font-black text-lg">خيارات استخراج Lottie</h3>
                            </div>
                            <p className="text-slate-400 text-xs mt-1">اختر طريقة استخراج المحتوى من ملف الأنميشن</p>
                        </div>
                        
                        <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/5">
                            <button 
                                onClick={() => setLottieExtractionMode('sequence')}
                                className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all ${lottieExtractionMode === 'sequence' ? 'bg-purple-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                تسلسل الصور (Frames)
                            </button>
                            <button 
                                onClick={() => setLottieExtractionMode('assets')}
                                className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all ${lottieExtractionMode === 'assets' ? 'bg-purple-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                طبقات مفككة (Assets)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-white/10 hover:border-purple-500/50 hover:bg-purple-500/5 rounded-[2.5rem] p-8 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all group h-48"
            >
                <input 
                    type="file" 
                    multiple 
                    accept="image/*,application/json,.json,.svga" 
                    ref={fileInputRef} 
                    className="hidden" 
                    onChange={handleFileUpload} 
                />
                <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Upload className="w-8 h-8 text-slate-400 group-hover:text-purple-400" />
                </div>
                <div className="text-center">
                    <h3 className="text-white font-black text-sm">إضافة صور أو ملف Lottie أو SVGA</h3>
                    <p className="text-slate-500 text-[10px] uppercase tracking-widest mt-1">PNG, JPG, WEBP, GIF, JSON (Lottie), SVGA</p>
                </div>
            </div>

            <div className="bg-slate-950/40 rounded-[2.5rem] border border-white/5 p-6 flex-1 min-h-[400px]">
                <div className="flex justify-between items-center mb-6 px-2">
                    <h3 className="text-white font-black text-xs uppercase tracking-widest flex items-center gap-2">
                        <Layers className="w-4 h-4 text-purple-400" />
                        قائمة الإطارات ({frames.length})
                    </h3>
                    {frames.length > 0 && (
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={downloadFramesAsZip}
                                disabled={isProcessing}
                                className="flex items-center gap-2 text-blue-400 text-[10px] font-black uppercase hover:text-blue-300 transition-colors disabled:opacity-50"
                            >
                                <Download className="w-3 h-3" />
                                تحميل الكل (ZIP)
                            </button>
                            <button 
                                onClick={() => {
                                    setRangeStart(1);
                                    setRangeEnd(frames.length);
                                    setShowRangeModal(true);
                                }} 
                                className="flex items-center gap-2 text-purple-400 text-[10px] font-black uppercase hover:text-purple-300 transition-colors"
                            >
                                <ListOrdered className="w-3 h-3" />
                                تحديد تسلسلي (نطاق)
                            </button>
                            <button onClick={() => setFrames([])} className="text-red-500 text-[10px] font-black uppercase hover:text-red-400">
                                مسح الكل
                            </button>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4 max-h-[500px] overflow-y-auto custom-scrollbar p-2">
                    <AnimatePresence>
                        {frames.map((frame, index) => (
                            <motion.div 
                                key={frame.id}
                                layout
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                className={`relative group aspect-square rounded-2xl overflow-hidden border ${index === currentPreviewFrame && isPlaying ? 'border-purple-500 ring-2 ring-purple-500/20' : 'border-white/10'} bg-black/40`}
                            >
                                <img src={frame.previewUrl} className="w-full h-full object-contain" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                downloadSingleFrame(frame, index);
                                            }}
                                            className="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500 hover:text-white transition-colors"
                                            title="تحميل الإطار"
                                        >
                                            <Download className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => removeFrame(frame.id)} className="p-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500 hover:text-white transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => moveFrame(index, 'right')} className="p-1.5 bg-white/10 rounded-lg hover:bg-white/20 text-white disabled:opacity-30" disabled={index === 0}>
                                            <ArrowRight className="w-3 h-3 rotate-180" />
                                        </button>
                                        <button onClick={() => moveFrame(index, 'left')} className="p-1.5 bg-white/10 rounded-lg hover:bg-white/20 text-white disabled:opacity-30" disabled={index === frames.length - 1}>
                                            <ArrowRight className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                                <div className="absolute top-1 right-1 bg-black/60 px-1.5 rounded text-[8px] font-mono text-white/70">
                                    {index + 1}
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </div>
        </div>
      </div>

      {/* Range Selection Modal */}
      <AnimatePresence>
        {showRangeModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="bg-slate-900 border border-white/10 p-8 rounded-[2.5rem] w-full max-w-md shadow-3xl text-right"
                >
                    <div className="flex items-center gap-4 mb-6 ml-auto justify-end">
                        <div className="text-right">
                            <h3 className="text-xl font-black text-white">تحديد نطاق الصور</h3>
                            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">اختر بداية ونهاية التسلسل</p>
                        </div>
                        <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center text-purple-400">
                            <ListOrdered className="w-5 h-5" />
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[9px] text-slate-500 font-black uppercase tracking-widest">من (رقم الصورة)</label>
                                <input 
                                    type="number" 
                                    min="1" 
                                    max={frames.length}
                                    value={rangeStart}
                                    onChange={(e) => setRangeStart(parseInt(e.target.value) || 1)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white text-center outline-none focus:border-purple-500 transition-all"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] text-slate-500 font-black uppercase tracking-widest">إلى (رقم الصورة)</label>
                                <input 
                                    type="number" 
                                    min="1" 
                                    max={frames.length}
                                    value={rangeEnd}
                                    onChange={(e) => setRangeEnd(parseInt(e.target.value) || 1)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white text-center outline-none focus:border-purple-500 transition-all"
                                />
                            </div>
                        </div>

                        <div className="bg-purple-500/5 p-4 rounded-2xl border border-purple-500/10">
                            <p className="text-[10px] text-purple-300 text-center font-bold">
                                سيتم الاحتفاظ بالصور من {rangeStart} إلى {rangeEnd} وحذف الباقي.
                                <br />
                                (إجمالي الصور المختارة: {Math.max(0, Math.min(frames.length, rangeEnd) - Math.max(1, rangeStart) + 1)})
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <button 
                                onClick={applyRangeSelection}
                                className="flex-1 py-4 bg-purple-500 hover:bg-purple-400 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-glow-purple"
                            >
                                تطبيق التحديد
                            </button>
                            <button 
                                onClick={() => setShowRangeModal(false)}
                                className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest transition-all border border-white/10"
                            >
                                إلغاء
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

      {/* Lottie Extraction Choice Modal */}
      <AnimatePresence>
        {showLottieModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="bg-slate-900 border border-white/10 p-8 rounded-[2.5rem] w-full max-w-md shadow-3xl text-right"
                >
                    <div className="flex items-center gap-4 mb-6 ml-auto justify-end">
                        <div className="text-right">
                            <h3 className="text-xl font-black text-white">خيارات استخراج Lottie</h3>
                            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">اختر طريقة معالجة الملف</p>
                        </div>
                        <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center text-blue-400">
                            <Layers className="w-5 h-5" />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <button 
                            onClick={() => {
                                setShowLottieModal(false);
                                extractFramesFromLottie(pendingLottieData);
                            }}
                            className="w-full p-6 bg-white/5 hover:bg-white/10 border border-white/10 rounded-3xl text-right transition-all group"
                        >
                            <div className="flex items-center justify-between">
                                <ArrowRight className="w-3 h-3 text-slate-600 group-hover:text-white transition-colors rotate-180" />
                                <div className="text-right">
                                    <h4 className="text-white font-black text-sm">تسلسل الصور (Animation)</h4>
                                    <p className="text-slate-500 text-[10px] mt-1">استخراج كل إطارات الحركة كفيديو متسلسل</p>
                                </div>
                            </div>
                        </button>

                        <button 
                            onClick={() => {
                                setShowLottieModal(false);
                                extractAssetsFromLottie(pendingLottieData);
                            }}
                            className="w-full p-6 bg-white/5 hover:bg-white/10 border border-white/10 rounded-3xl text-right transition-all group"
                        >
                            <div className="flex items-center justify-between">
                                <ArrowRight className="w-3 h-3 text-slate-600 group-hover:text-white transition-colors rotate-180" />
                                <div className="text-right">
                                    <h4 className="text-white font-black text-sm">طبقات مفككة (Assets)</h4>
                                    <p className="text-slate-500 text-[10px] mt-1">استخراج الصور الأصلية المستخدمة في الملف كقطع منفصلة</p>
                                </div>
                            </div>
                        </button>

                        <button 
                            onClick={() => setShowLottieModal(false)}
                            className="w-full py-4 text-slate-500 text-xs font-bold uppercase tracking-widest hover:text-white transition-colors"
                        >
                            إلغاء
                        </button>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>
    </div>
  );
};
