
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { FileMetadata, MaterialAsset, AppSettings, UserRecord, PresetBackground } from '../types';
import { Layers, Download, Copy, Trash2, Lock } from 'lucide-react';
import { logActivity } from '../utils/logger';
import * as Mp4Muxer from 'mp4-muxer';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

declare var SVGA: any;
declare var JSZip: any;
declare var protobuf: any;
declare var pako: any;
declare var GIF: any;
declare var UPNG: any;

declare var WebMMuxer: any;
declare var VideoEncoder: any;
declare var VideoFrame: any;

import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { VapPlayer } from './VapPlayer';
import { useLanguage } from '../contexts/LanguageContext';
import { useAccessControl } from '../hooks/useAccessControl';
import { svgaSchema } from '../svga-proto';
import { handleSvgaExExport } from '../utils/svgaExExport';

interface WorkspaceProps {
  metadata: FileMetadata;
  onCancel: () => void;
  settings: AppSettings | null;
  currentUser: UserRecord | null;
  onLoginRequired: () => void;
  onSubscriptionRequired: () => void;
  globalQuality?: 'low' | 'medium' | 'high';
  onFileReplace?: (meta: FileMetadata) => void;
  mode?: 'normal' | 'ex';
}

interface CustomLayer {
  id: string;
  name: string;
  url: string;
  x: number;
  y: number;
  scale: number;
  width: number;
  height: number;
  zIndexMode: 'front' | 'back';
}

const TRANSPARENT_PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

export const Workspace: React.FC<WorkspaceProps> = ({ metadata: initialMetadata, onCancel, settings, currentUser, onLoginRequired, onSubscriptionRequired, globalQuality: initialGlobalQuality = 'high', onFileReplace, mode = 'normal' }) => {
  const { checkAccess } = useAccessControl();
  const { t, dir } = useLanguage();
  const [metadata, setMetadata] = useState<FileMetadata>(initialMetadata);
  const playerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceSvgaInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const watermarkInputRef = useRef<HTMLInputElement>(null);
  const layerInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [selectedFormat, setSelectedFormat] = useState('AE Project');
  const [globalQuality, setGlobalQuality] = useState<'low' | 'medium' | 'high'>(initialGlobalQuality);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exportPhase, setExportPhase] = useState('');
  const [svgaInstance, setSvgaInstance] = useState<any>(null);
  const [exportedVapUrl, setExportedVapUrl] = useState<string | null>(null);
  const [showVapHelp, setShowVapHelp] = useState(false);
  const [showFlutterCode, setShowFlutterCode] = useState(false);
  const [replacingAssetKey, setReplacingAssetKey] = useState<string | null>(null);
  const [layerImages, setLayerImages] = useState<Record<string, string>>({});
  const [assetColors, setAssetColors] = useState<Record<string, string>>({});
  const [assetColorModes, setAssetColorModes] = useState<Record<string, 'tint' | 'fill'>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [scale, setScale] = useState(1);
  const [activeSideTab, setActiveSideTab] = useState<'layers' | 'transforms' | 'bg' | 'optimize' | 'settings'>('transforms');
  const [hiddenFormats, setHiddenFormats] = useState<string[]>(() => {
      const saved = localStorage.getItem('quantum_hidden_formats');
      return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
      localStorage.setItem('quantum_hidden_formats', JSON.stringify(hiddenFormats));
  }, [hiddenFormats]);

  useEffect(() => {
      const handleStorage = () => {
          const saved = localStorage.getItem('quantum_hidden_formats');
          if (saved) setHiddenFormats(JSON.parse(saved));
      };
      window.addEventListener('storage', handleStorage);
      return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const [presetBgs, setPresetBgs] = useState<PresetBackground[]>([]);
  const [previewBg, setPreviewBg] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<string>('none');
  const [watermark, setWatermark] = useState<string | null>(null);
  const [deletedKeys, setDeletedKeys] = useState<Set<string>>(new Set());
  
  const [bgPos, setBgPos] = useState({ x: 50, y: 50 });
  const [bgScale, setBgScale] = useState(100);
  const [svgaPos, setSvgaPos] = useState({ x: 0, y: 0 });
  const [svgaScale, setSvgaScale] = useState(1);
  const [wmPos, setWmPos] = useState({ x: 0, y: 0 });
  const [wmScale, setWmScale] = useState(0.3);
  const [customDimensions, setCustomDimensions] = useState<{width: number, height: number} | null>(null);

  const [customLayers, setCustomLayers] = useState<CustomLayer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [originalAudioUrl, setOriginalAudioUrl] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [fadeConfig, setFadeConfig] = useState({ top: 0, bottom: 0, left: 0, right: 0 }); // Percentages 0-50
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [exportScale, setExportScale] = useState(1.0); // 0.1 to 1.0 for file size control
  const [isProcessingVideo, setIsProcessingVideo] = useState(false);
  const [exportResult, setExportResult] = useState<{ url: string; filename: string } | null>(null);
  const [fadeModalTarget, setFadeModalTarget] = useState<string | null>(null);
  const [fadeModalValues, setFadeModalValues] = useState({ top: 0, bottom: 0, left: 0, right: 0 });
  const [recordingDuration, setRecordingDuration] = useState<number>(10);
  const ffmpegRef = useRef(new FFmpeg());
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);

  const loadFfmpeg = async () => {
    if (ffmpegLoaded) return;
    
    if (!window.crossOriginIsolated) {
        console.warn("SharedArrayBuffer is not available. FFmpeg might fail or be slow.");
    }

    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    const ffmpeg = ffmpegRef.current;
    ffmpeg.on('log', ({ message }) => {
        console.log(message);
    });
    
    try {
        const loadPromise = ffmpeg.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });

        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("FFmpeg load timeout (20s)")), 20000)
        );

        await Promise.race([loadPromise, timeoutPromise]);
        setFfmpegLoaded(true);
    } catch (e) {
        console.error("FFmpeg load error:", e);
        throw e;
    }
  };

  const handleRemoveAudio = () => {
    if (confirm('هل أنت متأكد من حذف الصوت؟\nAre you sure you want to remove the audio?')) {
        setAudioUrl(null);
        setOriginalAudioUrl(null);
        setAudioFile(null);
        
        // Update metadata to remove audio references
        if (metadata.videoItem) {
             const newMetadata = { ...metadata };
             if (newMetadata.videoItem.audios) {
                 newMetadata.videoItem.audios = [];
             }
             setMetadata(newMetadata);
        }
    }
  };

  useEffect(() => {
    if (metadata.frames && metadata.fps) {
      setRecordingDuration(parseFloat((metadata.frames / metadata.fps).toFixed(2)));
    }
  }, [metadata]);

  const audioRef = useRef<HTMLAudioElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const videoWidth = customDimensions?.width || metadata.dimensions?.width || 750;
  const videoHeight = customDimensions?.height || metadata.dimensions?.height || 1334;
  const cost = settings?.costs.svgaProcess || 5;

  // ... (existing effects)

  const [isVapMode, setIsVapMode] = useState(false);

  // Clean up Blob URLs on unmount or when layerImages changes
  useEffect(() => {
    return () => {
      Object.values(layerImages).forEach((url) => {
        if ((url as string).startsWith('blob:')) {
          URL.revokeObjectURL(url as string);
        }
      });
    };
  }, []);

  const processImportedFile = useCallback(async (file: File, isVap: boolean, vapLayout: string, targetFps: number, targetQuality: number) => {
      setIsProcessingVideo(true);
      setExportPhase('جاري معالجة الملف...');
      setIsExporting(true);

      try {
          let videoSrc = '';
          
          if (file.type.startsWith('video/') || file.name.toLowerCase().endsWith('.mp4') || file.name.toLowerCase().endsWith('.webm') || file.name.toLowerCase().endsWith('.mov')) {
              videoSrc = URL.createObjectURL(file);
          } else if (file.type.startsWith('image/') || file.name.toLowerCase().endsWith('.gif') || file.name.toLowerCase().endsWith('.webp')) {
              // Reverted to simple object URL as per user request to remove FFmpeg conversion system
              videoSrc = URL.createObjectURL(file);
          } else {
              throw new Error('Unsupported file format');
          }

          const video = document.createElement('video');
          video.src = videoSrc;
          video.muted = true;
          video.playsInline = true;
          video.crossOrigin = "anonymous"; // Add crossOrigin for safety
          
          await new Promise((resolve, reject) => {
              video.onloadeddata = () => resolve(null);
              video.onerror = (e) => reject(new Error(`Video load error: ${video.error?.message || 'Unknown error'}`));
              // Timeout fallback
              setTimeout(() => reject(new Error("Video load timeout")), 10000);
          });

          await video.play();
          video.pause();
          
          let duration = video.duration;
          if (!Number.isFinite(duration) || duration <= 0) {
              console.warn("Invalid duration detected, defaulting to 1s");
              duration = 1; // Default to 1 second if duration is invalid (e.g. static image converted to video)
          }

          const vw = video.videoWidth;
          const vh = video.videoHeight;
          
          if (vw === 0 || vh === 0) {
              throw new Error("Invalid video dimensions (0x0)");
          }

          let totalFrames = Math.floor(duration * targetFps);
          if (totalFrames < 1) totalFrames = 1; // Ensure at least 1 frame

          setAudioUrl(video.src);
          setOriginalAudioUrl(video.src);
          setAudioFile(file);

          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d', { willReadFrequently: true });

          let frameWidth = vw;
          let frameHeight = vh;

          if (isVap) {
              if (vapLayout === 'rgb_left' || vapLayout === 'alpha_left') {
                  frameWidth = Math.floor(vw / 2);
                  frameHeight = vh;
              } else {
                  frameWidth = vw;
                  frameHeight = Math.floor(vh / 2);
              }
          }

          canvas.width = frameWidth;
          canvas.height = frameHeight;
          
          const newLayerImages: Record<string, string> = {};
          const newSprites: any[] = [];
          
          // Temp canvas for VAP processing
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = vw;
          tempCanvas.height = vh;
          const tCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
          
          for (let i = 0; i < totalFrames; i++) {
              const time = i / targetFps;
              video.currentTime = time;
              await new Promise(r => {
                  const onSeek = () => { video.removeEventListener('seeked', onSeek); r(null); };
                  video.addEventListener('seeked', onSeek);
              });
              
              if (ctx && tCtx && video.readyState >= 2) {
                  const key = `v_frame_${i}`;

                  if (isVap) {
                      // Draw full video frame
                      tCtx.drawImage(video, 0, 0);
                      
                      // Extract RGB and Alpha
                      let rgbX = 0, rgbY = 0, alphaX = 0, alphaY = 0;

                      if (vapLayout === 'rgb_left') {
                          rgbX = 0; alphaX = frameWidth;
                      } else if (vapLayout === 'alpha_left') {
                          rgbX = frameWidth; alphaX = 0;
                      } else if (vapLayout === 'rgb_top') {
                          rgbY = 0; alphaY = frameHeight;
                      } else if (vapLayout === 'alpha_top') {
                          rgbY = frameHeight; alphaY = 0;
                      }
                      
                      const rgbData = tCtx.getImageData(rgbX, rgbY, frameWidth, frameHeight);
                      const alphaData = tCtx.getImageData(alphaX, alphaY, frameWidth, frameHeight);
                      
                      // Merge
                      const finalData = ctx.createImageData(frameWidth, frameHeight);
                      for (let p = 0; p < finalData.data.length; p += 4) {
                          const alphaVal = alphaData.data[p];
                          
                          if (alphaVal > 10) { // Threshold to remove compression noise
                              const alphaFloat = alphaVal / 255;
                              // Un-premultiply RGB (assuming video is premultiplied on black)
                              finalData.data[p] = Math.min(255, Math.round(rgbData.data[p] / alphaFloat));     // R
                              finalData.data[p+1] = Math.min(255, Math.round(rgbData.data[p+1] / alphaFloat)); // G
                              finalData.data[p+2] = Math.min(255, Math.round(rgbData.data[p+2] / alphaFloat)); // B
                              finalData.data[p+3] = alphaVal;
                          } else {
                              finalData.data[p] = 0;
                              finalData.data[p+1] = 0;
                              finalData.data[p+2] = 0;
                              finalData.data[p+3] = 0;
                          }
                      }
                      ctx.putImageData(finalData, 0, 0);
                      
                      // Use Data URL (Base64) for compatibility
                      newLayerImages[key] = canvas.toDataURL('image/png');

                  } else {
                      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                      // Use Data URL (Base64) for compatibility
                      newLayerImages[key] = canvas.toDataURL('image/webp', targetQuality);
                  }
                  
                  const frames = [];
                  for (let f = 0; f < totalFrames; f++) {
                      frames.push({
                          alpha: f === i ? 1.0 : 0.0,
                          layout: { x: 0, y: 0, width: canvas.width, height: canvas.height },
                          transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }
                      });
                  }
                  
                  newSprites.push({
                      imageKey: key,
                      frames: frames,
                      matteKey: ""
                  });
              }
              if (i % 5 === 0) {
                  setProgress(Math.floor((i / totalFrames) * 100));
                  await new Promise(r => setTimeout(r, 0));
              }
          }

          setCurrentFrame(0);
          setMetadata({
              ...metadata,
              name: file.name.replace(/\.[^/.]+$/, ""),
              frames: totalFrames,
              fps: targetFps,
              dimensions: { width: canvas.width, height: canvas.height },
              videoItem: {
                  version: "2.0",
                  videoSize: { width: canvas.width, height: canvas.height },
                  FPS: targetFps,
                  frames: totalFrames,
                  images: newLayerImages,
                  sprites: newSprites,
                  audios: []
              }
          });
          
          // Revoke old URLs before setting new ones
          Object.values(layerImages).forEach((url) => {
              if ((url as string).startsWith('blob:')) URL.revokeObjectURL(url as string);
          });

          setLayerImages(newLayerImages);
          setCustomLayers([]);
          setWatermark(null);
          
      } catch (e) {
          console.error(e);
          alert("فشل معالجة الفيديو: " + (e as any).message);
      } finally {
          setIsProcessingVideo(false);
          setIsExporting(false);
          setExportPhase('');
          setProgress(0);
      }
  }, [ffmpegLoaded, layerImages, metadata]);

  // Handle initial import from App.tsx
  useEffect(() => {
      if ((metadata.type === 'VIDEO_COMPLEX' || metadata.type === 'IMAGE_ANIM') && !metadata.videoItem && !isProcessingVideo) {
          const initImport = async () => {
              if (!metadata.fileUrl) return;
              
              // Show loading immediately
              setIsExporting(true);
              setExportPhase('جاري تحضير الملف...');

              try {
                  const response = await fetch(metadata.fileUrl);
                  const blob = await response.blob();
                  const file = new File([blob], metadata.name, { type: metadata.type === 'IMAGE_ANIM' ? 'image/gif' : 'video/mp4' });
                  
                  let isVap = false;
                  let vapLayout = 'rgb_left';
                  let targetFps = 30;
                  let targetQuality = 0.8;

                  // Only ask for settings if it's a complex video (likely VAP)
                  // For GIFs/WebP (IMAGE_ANIM), use defaults to ensure smooth UX
                  if (metadata.type === 'VIDEO_COMPLEX') {
                      // Small delay to allow UI to render loading state before blocking alert
                      await new Promise(r => setTimeout(r, 100));
                      
                      isVap = confirm("هل هذا الفيديو يحتوي على قناة شفافية (VAP/Alpha)؟\nIs this a transparent video (VAP)?");
                      
                      if (isVap) {
                          const layout = prompt("اختر تخطيط الفيديو:\n1. يسار: RGB | يمين: Alpha (افتراضي)\n2. يسار: Alpha | يمين: RGB\n3. أعلى: RGB | أسفل: Alpha\n4. أعلى: Alpha | أسفل: RGB", "1");
                          if (layout === "2") vapLayout = 'alpha_left';
                          if (layout === "3") vapLayout = 'rgb_top';
                          if (layout === "4") vapLayout = 'alpha_top';
                      }

                      const fpsInput = prompt("أدخل عدد الإطارات في الثانية (FPS):", "30");
                      targetFps = parseInt(fpsInput || "30");
                      
                      const qualityInput = prompt("أدخل جودة الصور (0.1 - 1.0):", "0.8");
                      targetQuality = parseFloat(qualityInput || "0.8");
                  }

                  await processImportedFile(file, isVap, vapLayout, targetFps, targetQuality);
              } catch (e) {
                  console.error("Failed to fetch initial file", e);
                  alert("فشل في معالجة الملف: " + (e as any).message);
                  setIsExporting(false);
                  onCancel(); // Go back to uploader
              }
          };
          initImport();
      }
  }, [metadata, isProcessingVideo, processImportedFile, onCancel]);

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Log Upload Activity
      if (currentUser) {
        logActivity(currentUser, 'upload', `Uploaded file: ${file.name}`);
      }

      // Use the toggle state instead of confirm dialog if possible, or fallback to confirm if not set
      let isVap = isVapMode;
      if (!isVap) {
          isVap = confirm("هل هذا الفيديو يحتوي على قناة شفافية (VAP/Alpha)؟\nIs this a transparent video (VAP)?");
      }

      let vapLayout = 'rgb_left';
      if (isVap) {
          const layout = prompt("اختر تخطيط الفيديو:\n1. يسار: RGB | يمين: Alpha (افتراضي)\n2. يسار: Alpha | يمين: RGB\n3. أعلى: RGB | أسفل: Alpha\n4. أعلى: Alpha | أسفل: RGB", "1");
          if (layout === "2") vapLayout = 'alpha_left';
          if (layout === "3") vapLayout = 'rgb_top';
          if (layout === "4") vapLayout = 'alpha_top';
      }

      const targetFps = parseInt(prompt("أدخل عدد الإطارات في الثانية (FPS):", "30") || "30");
      const targetQuality = parseFloat(prompt("أدخل جودة الصور (0.1 - 1.0):", "0.8") || "0.8");

      await processImportedFile(file, isVap, vapLayout, targetFps, targetQuality);
  };

  useEffect(() => {
    if (audioRef.current) {
        audioRef.current.volume = volume;
        audioRef.current.muted = isMuted;
        
        if (isPlaying && audioUrl) {
            const playPromise = audioRef.current.play();
            if (playPromise !== undefined) {
                playPromise.catch(e => console.log("Audio play prevented:", e));
            }
        } else {
            audioRef.current.pause();
        }
    }
  }, [isPlaying, audioUrl, volume, isMuted]);

  // Sync audio with animation frames
  // REMOVED: Aggressive frame-by-frame sync caused stuttering. 
  // We now rely on start/stop sync and loop handling.
  useEffect(() => {
      if (audioRef.current && svgaInstance && metadata.fps && isPlaying) {
          // Only check for loop reset (when frame goes back to 0)
          if (currentFrame === 0) {
              const audioTime = audioRef.current.currentTime;
              // If audio is far ahead (near end), reset it
              if (audioTime > 0.5) {
                  audioRef.current.currentTime = 0;
                  audioRef.current.play().catch(() => {});
              }
          }
      }
  }, [currentFrame, metadata.fps, isPlaying]);

  useEffect(() => {
    const fetchBackgrounds = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'presetBackgrounds'));
        const list: PresetBackground[] = [];
        querySnapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as PresetBackground));
        setPresetBgs(list);
      } catch (e) {
        console.error("Error fetching backgrounds:", e);
      }
    };
    fetchBackgrounds();
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const parent = containerRef.current.parentElement;
        if (parent) {
          const maxWidth = parent.clientWidth;
          const maxHeight = window.innerHeight * 0.85; 
          const s = Math.min(maxWidth / videoWidth, maxHeight / videoHeight);
          setScale(s);
        }
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [videoWidth, videoHeight]);

  const applyTransparencyEffects = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    if (fadeConfig.top === 0 && fadeConfig.bottom === 0 && fadeConfig.left === 0 && fadeConfig.right === 0) return;

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    const fadeTopLimit = (height * fadeConfig.top) / 100;
    const fadeBottomLimit = height - (height * fadeConfig.bottom) / 100;
    const fadeLeftLimit = (width * fadeConfig.left) / 100;
    const fadeRightLimit = width - (width * fadeConfig.right) / 100;

    for (let i = 0; i < data.length; i += 4) {
      const x = (i / 4) % width;
      const y = Math.floor((i / 4) / width);

      let a = data[i + 3];

      // Edge Fade Calculation
      let edgeAlpha = 1.0;
      if (fadeConfig.top > 0 && y < fadeTopLimit) edgeAlpha *= (y / fadeTopLimit);
      if (fadeConfig.bottom > 0 && y > fadeBottomLimit) edgeAlpha *= ((height - y) / (height - fadeBottomLimit));
      if (fadeConfig.left > 0 && x < fadeLeftLimit) edgeAlpha *= (x / fadeLeftLimit);
      if (fadeConfig.right > 0 && x > fadeRightLimit) edgeAlpha *= ((width - x) / (width - fadeRightLimit));

      const finalAlpha = (a / 255) * edgeAlpha;
      data[i + 3] = Math.round(finalAlpha * 255);
    }
    ctx.putImageData(imageData, 0, 0);
  }, [fadeConfig]);

  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizeQuality, setOptimizeQuality] = useState(80);

  const compressAsset = useCallback(async (base64: string, quality: number): Promise<string> => {
    if (!base64 || base64 === TRANSPARENT_PIXEL) return base64;
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(img, 0, 0);
            
            if (quality < 100) {
                 const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                 const data = imageData.data;
                 const levels = Math.max(2, Math.floor((quality / 100) * 255));
                 const factor = 255 / (levels - 1);
                 
                 for (let i = 0; i < data.length; i += 4) {
                     data[i] = Math.round(Math.round(data[i] / factor) * factor);
                     data[i+1] = Math.round(Math.round(data[i+1] / factor) * factor);
                     data[i+2] = Math.round(Math.round(data[i+2] / factor) * factor);
                 }
                 ctx.putImageData(imageData, 0, 0);
            }
            
            const newDataUrl = canvas.toDataURL('image/png');
            // If new size is larger (due to PNG overhead), keep original
            if (newDataUrl.length < base64.length) {
                resolve(newDataUrl);
            } else {
                resolve(base64);
            }
        } else {
            resolve(base64);
        }
      };
      img.onerror = () => resolve(base64);
      img.src = base64;
    });
  }, []);

  const handleOptimizeAssets = async () => {
    if (isOptimizing) return;
    setIsOptimizing(true);
    
    let sizeBefore = 0;
    Object.values(layerImages).forEach(v => sizeBefore += (v as string).length);
    
    const newLayerImages = { ...layerImages };
    const keys = Object.keys(newLayerImages);
    
    for (const key of keys) {
        if (newLayerImages[key] === TRANSPARENT_PIXEL) continue;
        try {
            newLayerImages[key] = await compressAsset(newLayerImages[key], optimizeQuality);
        } catch (e) {
            console.error(e);
        }
    }
    
    let sizeAfter = 0;
    Object.values(newLayerImages).forEach(v => sizeAfter += (v as string).length);
    
    setLayerImages(newLayerImages);
    setIsOptimizing(false);
    
    const saved = ((sizeBefore - sizeAfter) / 1024 / 1024).toFixed(2);
    alert(`تم ضغط الصور بنجاح! تم تقليل الحجم بمقدار ${saved} MB`);
  };

  const extractImageData = useCallback(async (img: any): Promise<string> => {
    if (!img) return '';
    if (typeof img === 'string') return img.startsWith('data:') ? img : `data:image/png;base64,${img}`;
    return new Promise((resolve) => {
      const processImage = (imgElement: HTMLImageElement | HTMLCanvasElement) => {
        try {
          const canvas = document.createElement('canvas');
          const w = (imgElement as HTMLImageElement).naturalWidth || imgElement.width || 200;
          const h = (imgElement as HTMLImageElement).naturalHeight || imgElement.height || 200;
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) { ctx.drawImage(imgElement, 0, 0, w, h); resolve(canvas.toDataURL('image/png')); }
          else resolve('');
        } catch (e) { resolve(''); }
      };
      if (img instanceof HTMLImageElement) {
        if (img.complete && img.naturalWidth > 0) processImage(img);
        else { img.onload = () => processImage(img); img.onerror = () => resolve(''); }
      } else if (img instanceof HTMLCanvasElement) processImage(img);
      else resolve('');
    });
  }, []);

  const tintImage = useCallback(async (base64: string, color: string, mode: 'tint' | 'fill' = 'tint'): Promise<string> => {
    if (!color || color === '#ffffff') return base64;
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          
          if (mode === 'fill') {
             ctx.globalCompositeOperation = 'source-in';
             ctx.fillStyle = color;
             ctx.fillRect(0, 0, canvas.width, canvas.height);
          } else {
             // Improved Tint: Multiply to preserve details/shading while applying color
             ctx.globalCompositeOperation = 'multiply';
             ctx.fillStyle = color;
             ctx.fillRect(0, 0, canvas.width, canvas.height);
             
             // Restore original alpha channel to ensure clean edges
             ctx.globalCompositeOperation = 'destination-in';
             ctx.drawImage(img, 0, 0);
          }
          
          resolve(canvas.toDataURL('image/png'));
        } else resolve(base64);
      };
      img.src = base64;
    });
  }, []);

  const getProcessedAsset = useCallback(async (key: string): Promise<string> => {
    const base64 = layerImages[key];
    if (!base64) return TRANSPARENT_PIXEL;
    const color = assetColors[key];
    const mode = assetColorModes[key] || 'tint';
    if (color && color !== '#ffffff') {
      return await tintImage(base64, color, mode);
    }
    return base64;
  }, [layerImages, assetColors, assetColorModes, tintImage]);

  useEffect(() => {
    if (!metadata.videoItem) return;
    const fetchAssets = async () => {
      setAssetsLoading(true);
      const extractedImages: Record<string, string> = {};
      const sourceImages = metadata.videoItem.images || {};
      
      // Identify audio keys to skip during image extraction
      const audioKeys = new Set<string>();
      if (metadata.videoItem.audios) {
          metadata.videoItem.audios.forEach((audio: any) => {
              if (audio.audioKey) audioKeys.add(audio.audioKey);
          });
      }

      for (const key of Object.keys(sourceImages)) {
        if (audioKeys.has(key)) continue;
        const data = await extractImageData(sourceImages[key]);
        if (data) extractedImages[key] = data;
      }
      setLayerImages(extractedImages);

      // Extract Audio
      if (metadata.videoItem.audios && metadata.videoItem.audios.length > 0) {
          const audioObj = metadata.videoItem.audios[0];
          const audioKey = audioObj.audioKey;
          const rawAudio = sourceImages[audioKey];
          
          if (rawAudio) {
             let url = '';
             try {
                 if (typeof rawAudio === 'string') {
                     let binaryString = rawAudio;
                     if (rawAudio.startsWith('data:audio')) {
                         binaryString = atob(rawAudio.split(',')[1]);
                     } else if (rawAudio.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(rawAudio)) {
                         // Likely base64
                         try {
                             binaryString = atob(rawAudio);
                         } catch (e) {
                             // Not base64, treat as binary string
                             binaryString = rawAudio;
                         }
                     }
                     
                     const bytes = new Uint8Array(binaryString.length);
                     for (let i = 0; i < binaryString.length; i++) {
                         bytes[i] = binaryString.charCodeAt(i);
                     }
                     const blob = new Blob([bytes], { type: 'audio/mp3' });
                     url = URL.createObjectURL(blob);
                 } else if (rawAudio instanceof Uint8Array) {
                     const blob = new Blob([rawAudio], { type: 'audio/mp3' });
                     url = URL.createObjectURL(blob);
                 }
             } catch (e) {
                 console.error("Error extracting audio:", e);
             }
             
             if (url) {
                 setAudioUrl(url);
                 setOriginalAudioUrl(url);
             }
          }
      } else if (metadata.type === 'MP4' && metadata.fileUrl) {
          // Fallback for MP4: Use the fileUrl as audio source
          setAudioUrl(metadata.fileUrl);
          setOriginalAudioUrl(metadata.fileUrl);
      }

      setAssetsLoading(false);
    };
    fetchAssets();
  }, [metadata.videoItem, extractImageData, metadata.type, metadata.fileUrl]);

  useEffect(() => {
    let player: any = null;
    if (playerRef.current && metadata.videoItem && typeof SVGA !== 'undefined') {
      playerRef.current.innerHTML = '';
      player = new SVGA.Player(playerRef.current);
      player.loops = 0; player.clearsAfterStop = false;
      player.setContentMode('AspectFit'); 
      player.setVideoItem(metadata.videoItem);
      
      // Restore frame if we were playing/paused at a specific frame
      if (currentFrame > 0) {
          player.stepToFrame(currentFrame, true);
      }
      
      player.startAnimation();
      setIsPlaying(true);
      player.onFrame((frame: number) => setCurrentFrame(frame));
      setSvgaInstance(player);
      return () => { if (player) { player.stopAnimation(); player.clear(); } };
    }
  }, [metadata.videoItem, videoWidth, videoHeight]);

  const handleOpenFadeModal = (key: string) => {
    setFadeModalTarget(key);
    setFadeModalValues({ top: 0, bottom: 0, left: 0, right: 0 });
  };

  // Background Removal State
  const [bgRemoveTarget, setBgRemoveTarget] = useState<string | null>(null);
  const [bgRemoveTolerance, setBgRemoveTolerance] = useState<number>(30);

  const handleApplyBgRemoval = async () => {
      if (!bgRemoveTarget || !layerImages[bgRemoveTarget]) return;
      
      try {
          const imgUrl = layerImages[bgRemoveTarget];
          const img = new Image();
          img.src = imgUrl;
          await new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = reject;
          });

          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          const threshold = 255 - bgRemoveTolerance;

          for (let i = 0; i < data.length; i += 4) {
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              // Simple threshold: if all channels are brighter than threshold, it's white
              if (r >= threshold && g >= threshold && b >= threshold) {
                  data[i + 3] = 0; // Transparent
              }
          }

          ctx.putImageData(imageData, 0, 0);
          const newUrl = canvas.toDataURL('image/png');

          // Update Layer Images
          setLayerImages(prev => ({ ...prev, [bgRemoveTarget]: newUrl }));
          
          // Update Metadata Images if present
          if (metadata.videoItem?.images?.[bgRemoveTarget]) {
              const newMetadata = { ...metadata };
              newMetadata.videoItem.images[bgRemoveTarget] = newUrl;
              setMetadata(newMetadata);
          }

          setBgRemoveTarget(null);
      } catch (e) {
          console.error("Failed to remove background", e);
          alert("حدث خطأ أثناء إزالة الخلفية");
      }
  };

  const handleApplyFade = async () => {
    if (!fadeModalTarget || !layerImages[fadeModalTarget]) return;

    const img = new Image();
    img.src = layerImages[fadeModalTarget];
    await new Promise(r => img.onload = r);

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw original image
    ctx.drawImage(img, 0, 0);

    // Apply Fade (Destination Out)
    ctx.globalCompositeOperation = 'destination-out';

    const w = canvas.width;
    const h = canvas.height;
    const { top, bottom, left, right } = fadeModalValues;

    if (left > 0) {
        const fadeW = w * (left / 100);
        const g = ctx.createLinearGradient(0, 0, fadeW, 0);
        g.addColorStop(0, 'rgba(0,0,0,1)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, fadeW, h);
    }
    if (right > 0) {
        const fadeW = w * (right / 100);
        const g = ctx.createLinearGradient(w, 0, w - fadeW, 0);
        g.addColorStop(0, 'rgba(0,0,0,1)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(w - fadeW, 0, fadeW, h);
    }
    if (top > 0) {
        const fadeH = h * (top / 100);
        const g = ctx.createLinearGradient(0, 0, 0, fadeH);
        g.addColorStop(0, 'rgba(0,0,0,1)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, fadeH);
    }
    if (bottom > 0) {
        const fadeH = h * (bottom / 100);
        const g = ctx.createLinearGradient(0, h, 0, h - fadeH);
        g.addColorStop(0, 'rgba(0,0,0,1)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, h - fadeH, w, fadeH);
    }

    const newDataUrl = canvas.toDataURL('image/png');
    
    setLayerImages(prev => ({
        ...prev,
        [fadeModalTarget]: newDataUrl
    }));
    
    // Update metadata
    const binary = atob(newDataUrl.split(',')[1]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    
    const newMetadata = {
        ...metadata,
        videoItem: {
            ...metadata.videoItem,
            images: {
                ...metadata.videoItem.images,
                [fadeModalTarget]: bytes
            }
        }
    };
    setMetadata(newMetadata);
    setFadeModalTarget(null);
  };

  const handleBakeLayer = async (targetKey: string) => {
    if (!metadata.videoItem || !layerImages[targetKey]) return;
    
    // Find the sprite using this image
    const targetSpriteIndex = (metadata.videoItem.sprites || []).findIndex((s: any) => s.imageKey === targetKey);
    if (targetSpriteIndex === -1) {
        alert("لم يتم العثور على عنصر متحرك يستخدم هذه الصورة.");
        return;
    }
    
    const targetSprite = metadata.videoItem.sprites[targetSpriteIndex];
    if (!confirm(`هل تريد تحويل العنصر "${targetKey}" إلى سلسلة صور (Frame Sequence)؟\n\nسيتم:\n1. استبدال العنصر الأصلي بـ ${metadata.frames} طبقة (واحدة لكل إطار).\n2. دمج الحركة في الصور لتقليل المعالجة.\n3. ضغط الصور لتقليل الحجم.\n\nهذه العملية قد تستغرق وقتاً.`)) return;

    setIsExporting(true);
    setExportPhase(`جاري معالجة العنصر ${targetKey}...`);

    try {
        const totalFrames = metadata.frames || 0;
        const newImages: Record<string, string> = { ...layerImages };
        const currentSprites = [...(metadata.videoItem.sprites || [])];
        
        const sourceImg = new Image();
        const processedUrl = await getProcessedAsset(targetKey);
        sourceImg.src = processedUrl;
        await new Promise(r => sourceImg.onload = r);

        const generatedSprites: any[] = [];
        const viewBoxWidth = metadata.dimensions?.width || 750;
        const viewBoxHeight = metadata.dimensions?.height || 750;

        for (let i = 0; i < totalFrames; i++) {
            const frame = targetSprite.frames[i];
            
            // Skip invisible frames
            if (!frame || frame.alpha <= 0.01) continue;

            const t = frame.transform || { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
            const l = frame.layout || { x: 0, y: 0, width: sourceImg.width, height: sourceImg.height };

            // Calculate exact transformed bounding box in viewBox space
            const points = [
                { x: l.x, y: l.y },
                { x: l.x + l.width, y: l.y },
                { x: l.x, y: l.y + l.height },
                { x: l.x + l.width, y: l.y + l.height }
            ];

            const transformedPoints = points.map(p => ({
                x: t.a * p.x + t.c * p.y + t.tx,
                y: t.b * p.x + t.d * p.y + t.ty
            }));

            const minX = Math.floor(Math.min(...transformedPoints.map(p => p.x)));
            const minY = Math.floor(Math.min(...transformedPoints.map(p => p.y)));
            const maxX = Math.ceil(Math.max(...transformedPoints.map(p => p.x)));
            const maxY = Math.ceil(Math.max(...transformedPoints.map(p => p.y)));
            
            const width = Math.max(1, maxX - minX);
            const height = Math.max(1, maxY - minY);

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            
            if (ctx && sourceImg.complete && sourceImg.naturalWidth > 0) {
                // Align the transformed sprite into the new canvas
                ctx.translate(-minX, -minY);
                ctx.transform(t.a, t.b, t.c, t.d, t.tx, t.ty);
                ctx.drawImage(sourceImg, l.x, l.y, l.width, l.height);
                
                let dataUrl = canvas.toDataURL('image/png');
                dataUrl = await compressAsset(dataUrl, optimizeQuality);

                const newKey = `baked_${targetKey}_${i}`;
                newImages[newKey] = dataUrl;

                const spriteFrames = [];
                for (let f = 0; f < totalFrames; f++) {
                    spriteFrames.push({
                        alpha: f === i ? (frame.alpha || 1.0) : 0.0,
                        layout: { x: minX, y: minY, width: width, height: height },
                        transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
                        blendMode: frame.blendMode,
                        clipPath: frame.clipPath
                    });
                }
                
                generatedSprites.push({
                    imageKey: newKey,
                    frames: spriteFrames,
                    matteKey: targetSprite.matteKey
                });
            }
            
            if (i % 5 === 0) {
                setProgress(Math.floor(((i + 1) / totalFrames) * 100));
                await new Promise(r => setTimeout(r, 0)); // Prevent UI freeze
            }
        }

        currentSprites.splice(targetSpriteIndex, 1, ...generatedSprites);

        const newMetadata = {
            ...metadata,
            videoItem: {
                ...metadata.videoItem,
                images: newImages,
                sprites: currentSprites
            }
        };

        setLayerImages(newImages);
        setMetadata(newMetadata);
        
        if (deletedKeys.has(targetKey)) {
             const next = new Set(deletedKeys);
             next.delete(targetKey);
             setDeletedKeys(next);
        }

        alert(`تم تحويل العنصر بنجاح! تم الحفاظ على الأبعاد والحركة بدقة.`);

    } catch (e) {
        console.error(e);
        alert("حدث خطأ أثناء تحويل العنصر.");
    } finally {
        setIsExporting(false);
        setProgress(0);
    }
  };

  const handlePlayToggle = () => {
    if (!svgaInstance) return;
    if (isPlaying) {
        svgaInstance.pauseAnimation();
        audioRef.current?.pause();
    } else {
        svgaInstance.startAnimation();
        if (audioRef.current) {
            // Sync audio to current frame before playing
            if (metadata.fps) {
                audioRef.current.currentTime = currentFrame / metadata.fps;
            }
            audioRef.current.play().catch(e => console.log("Audio play failed", e));
        }
    }
    setIsPlaying(!isPlaying);
  };

  const filteredKeys = useMemo(() => {
    return Object.keys(layerImages)
      .filter(key => key.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => parseInt(a.match(/\d+/)?.[0] || '0') - parseInt(b.match(/\d+/)?.[0] || '0'));
  }, [layerImages, searchQuery]);

  const handleReplaceImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const base64 = ev.target?.result as string;
            if (replacingAssetKey) {
                setLayerImages(p => ({ ...p, [replacingAssetKey]: base64 }));
                
                // Update Metadata to persist changes
                if (metadata.videoItem) {
                    const newVideoItem = JSON.parse(JSON.stringify(metadata.videoItem));
                    if (!newVideoItem.images) newVideoItem.images = {};
                    newVideoItem.images[replacingAssetKey] = base64;
                    
                    setMetadata({
                        ...metadata,
                        videoItem: newVideoItem
                    });
                }

                const color = assetColors[replacingAssetKey];
                const finalImage = color ? await tintImage(base64, color) : base64;
                // We still call setImage for immediate feedback, though the metadata update will eventually trigger a re-render
                svgaInstance?.setImage(finalImage, replacingAssetKey);
                setReplacingAssetKey(null);
            }
        };
        reader.readAsDataURL(file);
    }
  };

  const handleColorChange = async (key: string, color: string) => {
    setAssetColors(p => ({ ...p, [key]: color }));
    if (svgaInstance && !deletedKeys.has(key)) {
      const mode = assetColorModes[key] || 'tint';
      const finalImage = await tintImage(layerImages[key], color, mode);
      svgaInstance.setImage(finalImage, key);
    }
  };

  const handleToggleColorMode = async (key: string) => {
    const currentMode = assetColorModes[key] || 'tint';
    const newMode = currentMode === 'tint' ? 'fill' : 'tint';
    setAssetColorModes(p => ({ ...p, [key]: newMode }));
    
    const color = assetColors[key];
    if (color && color !== '#ffffff' && svgaInstance && !deletedKeys.has(key)) {
        const finalImage = await tintImage(layerImages[key], color, newMode);
        svgaInstance.setImage(finalImage, key);
    }
  };

  const handleDownloadLayer = async (key: string) => {
    const base64 = await getProcessedAsset(key);
    if (base64) {
      const link = document.createElement("a");
      link.href = base64;
      link.download = `${key}.png`;
      link.click();
    }
  };

  const handleDeleteAsset = (key: string) => {
    if (deletedKeys.has(key)) {
        setDeletedKeys(p => { const next = new Set(p); next.delete(key); return next; });
        if (svgaInstance) {
            const color = assetColors[key];
            if (color) tintImage(layerImages[key], color).then(tinted => svgaInstance.setImage(tinted, key));
            else svgaInstance.setImage(layerImages[key], key);
        }
    } else {
        setDeletedKeys(p => new Set(p).add(key));
        if (svgaInstance) svgaInstance.setImage(TRANSPARENT_PIXEL, key);
    }
  };

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => { 
        setPreviewBg(ev.target?.result as string); setBgScale(100); setBgPos({ x: 50, y: 50 }); setActivePreset('custom');
      };
      reader.readAsDataURL(file);
    }
  };

  const selectPresetBg = (bg: PresetBackground | null) => {
    if (!bg) { setActivePreset('none'); setPreviewBg(null); }
    else { setActivePreset(bg.id); setPreviewBg(bg.url); setBgScale(100); setBgPos({ x: 50, y: 50 }); }
  };

  const handleWatermarkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => { setWatermark(ev.target?.result as string); setWmPos({ x: 0, y: 0 }); setWmScale(0.3); };
      reader.readAsDataURL(file);
    }
  };

  const getImageSize = (base64: string): Promise<{w: number, h: number}> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.width, h: img.height });
      img.src = base64;
    });
  };

  const handleAddLayer = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const url = ev.target?.result as string;
        const size = await getImageSize(url);
        
        // Generate unique key
        const newKey = `layer_${Date.now()}`;
        
        // 1. Add to layerImages (and metadata images)
        const newLayerImages = { ...layerImages, [newKey]: url };
        setLayerImages(newLayerImages);
        
        // 2. Create new Sprite
        // Center it
        const x = (videoWidth - size.w) / 2;
        const y = (videoHeight - size.h) / 2;
        
        const newSprite = {
            imageKey: newKey,
            frames: Array(metadata.frames || 1).fill({
                alpha: 1.0,
                layout: { x, y, width: size.w, height: size.h },
                transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }
            }),
            matteKey: ""
        };

        // 3. Update Metadata
        // We need to update both the `images` map and `sprites` list in videoItem
        const newMetadata = {
            ...metadata,
            videoItem: {
                ...metadata.videoItem,
                images: {
                    ...metadata.videoItem.images,
                    [newKey]: url // Store as base64/url temporarily, export handles conversion
                },
                sprites: [...(metadata.videoItem.sprites || []), newSprite]
            }
        };
        
        setMetadata(newMetadata);
        
        // Select the new layer
        setSelectedKeys(new Set([newKey]));
        setActiveSideTab('transforms');
        
        // Reset input
        if (layerInputRef.current) layerInputRef.current.value = '';
      };
      reader.readAsDataURL(file);
    }
  };

  const [moveStep, setMoveStep] = useState(10);

  const handleToggleVisibility = (key: string) => {
      if (!metadata.videoItem) return;
      
      const newVideoItem = JSON.parse(JSON.stringify(metadata.videoItem));
      let updated = false;

      if (newVideoItem.sprites) {
          newVideoItem.sprites.forEach((sprite: any) => {
              if (sprite.imageKey === key) {
                  const isCurrentlyHidden = sprite.frames.some((f: any) => f.alpha === 0);
                  const newAlpha = isCurrentlyHidden ? 1.0 : 0.0;
                  
                  sprite.frames.forEach((frame: any) => {
                      frame.alpha = newAlpha;
                  });
                  updated = true;
              }
          });
      }

      if (updated) {
          setMetadata({
              ...metadata,
              videoItem: newVideoItem
          });
      }
  };

  const handleDuplicateSprite = (key: string) => {
      if (!metadata.videoItem) return;

      const newVideoItem = JSON.parse(JSON.stringify(metadata.videoItem));
      const spriteToClone = newVideoItem.sprites.find((s: any) => s.imageKey === key);

      if (!spriteToClone) return;

      const newKey = `${key}_copy_${Date.now()}`;
      
      // Clone the sprite
      const newSprite = JSON.parse(JSON.stringify(spriteToClone));
      newSprite.imageKey = newKey;

      // Offset the new sprite slightly so it's visible
      newSprite.frames.forEach((frame: any) => {
          if (frame.layout) {
              frame.layout.x = (parseFloat(frame.layout.x) || 0) + 20;
              frame.layout.y = (parseFloat(frame.layout.y) || 0) + 20;
          } else if (frame.transform) {
              frame.transform.tx = (parseFloat(frame.transform.tx) || 0) + 20;
              frame.transform.ty = (parseFloat(frame.transform.ty) || 0) + 20;
          }
      });

      // Add to sprites
      newVideoItem.sprites.push(newSprite);

      // Duplicate image data in metadata
      if (newVideoItem.images && newVideoItem.images[key]) {
          newVideoItem.images[newKey] = newVideoItem.images[key];
      }

      // Duplicate image data in layerImages state
      if (layerImages[key]) {
          setLayerImages(prev => ({
              ...prev,
              [newKey]: prev[key]
          }));
      }
      
      // Also duplicate assetColors if exists
      if (assetColors[key]) {
          setAssetColors(prev => ({
              ...prev,
              [newKey]: prev[key]
          }));
      }

      setMetadata({
          ...metadata,
          videoItem: newVideoItem
      });

      // Select the new layer
      setSelectedKeys(new Set([newKey]));
  };

  const handleSwitchLayer = (currentKey: string) => {
      if (!metadata.videoItem) return;

      const copyRegex = /_copy_\d+$/;
      const isCopy = copyRegex.test(currentKey);
      const baseKey = isCopy ? currentKey.replace(copyRegex, '') : currentKey;

      const allSprites = metadata.videoItem.sprites.map((s: any) => s.imageKey);
      
      const relatedKeys = allSprites.filter((k: string) => 
          k === baseKey || (k.startsWith(`${baseKey}_copy_`) && copyRegex.test(k))
      );

      if (relatedKeys.length <= 1) {
          // No copies found
          return;
      }

      // Sort: Base key first, then others
      relatedKeys.sort((a: string, b: string) => {
          if (a === baseKey) return -1;
          if (b === baseKey) return 1;
          return a.localeCompare(b);
      });

      const currentIndex = relatedKeys.indexOf(currentKey);
      const nextIndex = (currentIndex + 1) % relatedKeys.length;
      const nextKey = relatedKeys[nextIndex];

      setSelectedKeys(new Set([nextKey]));
  };

  const handleFlipSprite = (key: string, direction: 'horizontal' | 'vertical') => {
      if (!metadata.videoItem) return;

      const newVideoItem = JSON.parse(JSON.stringify(metadata.videoItem));
      let updated = false;

      newVideoItem.sprites.forEach((sprite: any) => {
          if (sprite.imageKey === key) {
              sprite.frames.forEach((frame: any) => {
                  if (!frame.transform) {
                      frame.transform = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
                  }
                  
                  // Calculate current center based on layout and transform
                  // Note: This is an approximation. SVGA transform logic is complex.
                  // If we flip scale, we must adjust translation to keep the visual center.
                  
                  const width = frame.layout ? frame.layout.width : 0;
                  const height = frame.layout ? frame.layout.height : 0;
                  
                  if (direction === 'horizontal') {
                      const oldA = frame.transform.a;
                      frame.transform.a *= -1;
                      const newA = frame.transform.a;
                      
                      // Adjust tx to keep center stable
                      // Formula: tx_new = tx_old + (width/2) * (oldA - newA)
                      frame.transform.tx += (width / 2) * (oldA - newA);
                      
                  } else {
                      const oldD = frame.transform.d;
                      frame.transform.d *= -1;
                      const newD = frame.transform.d;
                      
                      // Adjust ty to keep center stable
                      frame.transform.ty += (height / 2) * (oldD - newD);
                  }
              });
              updated = true;
          }
      });

      if (updated) {
          setMetadata({
              ...metadata,
              videoItem: newVideoItem
          });
      }
  };

  const handleReorderSprite = (key: string, direction: 'up' | 'down' | 'top' | 'bottom') => {
      if (!metadata.videoItem) return;

      const newVideoItem = JSON.parse(JSON.stringify(metadata.videoItem));
      const sprites = newVideoItem.sprites;
      const index = sprites.findIndex((s: any) => s.imageKey === key);

      if (index === -1) return;

      if (direction === 'up' && index < sprites.length - 1) {
          // Swap with next (move to front)
          [sprites[index], sprites[index + 1]] = [sprites[index + 1], sprites[index]];
      } else if (direction === 'down' && index > 0) {
          // Swap with prev (move to back)
          [sprites[index], sprites[index - 1]] = [sprites[index - 1], sprites[index]];
      } else if (direction === 'top') {
          // Move to very end of array (topmost)
          const sprite = sprites.splice(index, 1)[0];
          sprites.push(sprite);
      } else if (direction === 'bottom') {
          // Move to very start of array (bottommost)
          const sprite = sprites.splice(index, 1)[0];
          sprites.unshift(sprite);
      } else {
          return; 
      }

      setMetadata({
          ...metadata,
          videoItem: newVideoItem
      });
  };

  const handleMirrorCopy = (key: string) => {
      if (!metadata.videoItem) return;

      const newVideoItem = JSON.parse(JSON.stringify(metadata.videoItem));
      const spriteToClone = newVideoItem.sprites.find((s: any) => s.imageKey === key);

      if (!spriteToClone) return;

      const newKey = `${key}_mirror_${Date.now()}`;
      
      // Clone the sprite
      const newSprite = JSON.parse(JSON.stringify(spriteToClone));
      newSprite.imageKey = newKey;

      newSprite.frames.forEach((frame: any) => {
          if (!frame.transform) frame.transform = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
          
          const width = frame.layout ? frame.layout.width : 0;
          
          // 1. Flip Content Horizontally (Mirror Image)
          frame.transform.a *= -1;
          frame.transform.c *= -1; // Fix rotation direction

          // 2. Mirror Position relative to Canvas Center
          if (frame.layout) {
              frame.layout.x = videoWidth - frame.layout.x - width;
          }

          // 3. Mirror Horizontal Movement (Animation)
          frame.transform.tx *= -1;

          // 4. Compensation for Flip Origin
          // When scaling by -1, the coordinate system flips. 
          // We usually need to shift by the width to get it back to the expected visual position.
          if (frame.transform.a < 0) {
              frame.transform.tx += width;
          } else {
              frame.transform.tx -= width;
          }
      });

      // Add to sprites
      newVideoItem.sprites.push(newSprite);

      // Duplicate image data
      if (newVideoItem.images && newVideoItem.images[key]) {
          newVideoItem.images[newKey] = newVideoItem.images[key];
      }
      if (layerImages[key]) {
          setLayerImages(prev => ({ ...prev, [newKey]: prev[key] }));
      }
      if (assetColors[key]) {
          setAssetColors(prev => ({ ...prev, [newKey]: prev[key] }));
      }

      setMetadata({
          ...metadata,
          videoItem: newVideoItem
      });
      setSelectedKeys(new Set([newKey]));
  };

  const handleScaleSprite = (key: string, factor: number) => {
      if (!metadata.videoItem) return;

      const newVideoItem = JSON.parse(JSON.stringify(metadata.videoItem));
      let updated = false;

      newVideoItem.sprites.forEach((sprite: any) => {
          if (sprite.imageKey === key) {
              sprite.frames.forEach((frame: any) => {
                  // Handle Transform Scaling (Priority)
                  if (frame.transform) {
                      const oldA = frame.transform.a;
                      const oldD = frame.transform.d;
                      
                      // Apply scaling factor
                      frame.transform.a *= factor;
                      frame.transform.d *= factor;
                      
                      // Adjust position to keep center stable
                      // We rely on layout width/height to determine the visual center shift
                      if (frame.layout) {
                          const w = frame.layout.width;
                          const h = frame.layout.height;
                          
                          // Calculate the shift needed to keep the center in place
                          // Formula: Shift = - (Width * (NewScale - OldScale)) / 2
                          const deltaW = w * (frame.transform.a - oldA);
                          frame.transform.tx -= deltaW / 2;
                          
                          const deltaH = h * (frame.transform.d - oldD);
                          frame.transform.ty -= deltaH / 2;
                      }
                  } 
                  // Fallback to Layout Scaling (if no transform)
                  else if (frame.layout) {
                      const oldW = frame.layout.width;
                      const oldH = frame.layout.height;
                      const newW = oldW * factor;
                      const newH = oldH * factor;
                      
                      frame.layout.width = newW;
                      frame.layout.height = newH;
                      
                      // Center scaling
                      frame.layout.x -= (newW - oldW) / 2;
                      frame.layout.y -= (newH - oldH) / 2;
                  }
              });
              updated = true;
          }
      });

      if (updated) {
          setMetadata({
              ...metadata,
              videoItem: newVideoItem
          });
      }
  };

  const handleRotateSprite = (key: string, angle: number) => {
      if (!metadata.videoItem) return;

      const newVideoItem = JSON.parse(JSON.stringify(metadata.videoItem));
      let updated = false;

      newVideoItem.sprites.forEach((sprite: any) => {
          if (sprite.imageKey === key) {
              sprite.frames.forEach((frame: any) => {
                  if (frame.transform) {
                      const a = frame.transform.a;
                      const b = frame.transform.b;
                      const c = frame.transform.c;
                      const d = frame.transform.d;

                      // Extract scale
                      const scaleX = Math.sqrt(a * a + b * b);
                      const scaleY = Math.sqrt(c * c + d * d);

                      // Convert degrees to radians
                      const rad = (angle * Math.PI) / 180;
                      const cos = Math.cos(rad);
                      const sin = Math.sin(rad);

                      // Apply new rotation with existing scale
                      frame.transform.a = scaleX * cos;
                      frame.transform.b = scaleX * sin;
                      frame.transform.c = -scaleY * sin;
                      frame.transform.d = scaleY * cos;
                  }
              });
              updated = true;
          }
      });

      if (updated) {
          setMetadata({
              ...metadata,
              videoItem: newVideoItem
          });
      }
  };

  const handleDuplicatePair = (key: string) => {
      if (!metadata.videoItem) return;

      const newVideoItem = JSON.parse(JSON.stringify(metadata.videoItem));
      const spriteToClone = newVideoItem.sprites.find((s: any) => s.imageKey === key);

      if (!spriteToClone) return;

      const timestamp = Date.now();
      const copyKey = `${key}_copy_${timestamp}`;
      const mirrorKey = `${key}_mirror_${timestamp}`;
      
      // 1. Create Normal Copy
      const copySprite = JSON.parse(JSON.stringify(spriteToClone));
      copySprite.imageKey = copyKey;
      // Offset slightly
      copySprite.frames.forEach((frame: any) => {
           if (frame.layout) {
              frame.layout.x = (parseFloat(frame.layout.x) || 0) + 20;
              frame.layout.y = (parseFloat(frame.layout.y) || 0) + 20;
          }
      });
      newVideoItem.sprites.push(copySprite);

      // 2. Create Mirrored Copy
      const mirrorSprite = JSON.parse(JSON.stringify(spriteToClone));
      mirrorSprite.imageKey = mirrorKey;
      mirrorSprite.frames.forEach((frame: any) => {
          if (!frame.transform) frame.transform = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
          
          frame.transform.a *= -1;
          const width = frame.layout ? frame.layout.width : 0;
          if (frame.layout) {
              frame.layout.x = videoWidth - frame.layout.x - width;
          }
          frame.transform.tx *= -1;
          if (frame.transform.a < 0) {
              frame.transform.tx += width;
          } else {
              frame.transform.tx -= width;
          }
      });
      newVideoItem.sprites.push(mirrorSprite);

      // Duplicate Images/Colors
      if (newVideoItem.images && newVideoItem.images[key]) {
          newVideoItem.images[copyKey] = newVideoItem.images[key];
          newVideoItem.images[mirrorKey] = newVideoItem.images[key];
      }
      if (layerImages[key]) {
          setLayerImages(prev => ({ ...prev, [copyKey]: prev[key], [mirrorKey]: prev[key] }));
      }
      if (assetColors[key]) {
          setAssetColors(prev => ({ ...prev, [copyKey]: prev[key], [mirrorKey]: prev[key] }));
      }

      setMetadata({
          ...metadata,
          videoItem: newVideoItem
      });
      
      setSelectedKeys(new Set([copyKey]));
  };

  const handleShiftSprite = (key: string, delta: { x?: number, y?: number }) => {
      if (!metadata.videoItem) return;
      
      // Deep clone to avoid mutation
      const newVideoItem = JSON.parse(JSON.stringify(metadata.videoItem));
      let updated = false;

      if (newVideoItem.sprites) {
          newVideoItem.sprites.forEach((sprite: any) => {
              if (sprite.imageKey === key) {
                  sprite.frames.forEach((frame: any) => {
                      // Prioritize Transform (tx, ty) for movement as it's more reliable for animations
                      if (frame.transform) {
                          if (delta.x !== undefined) frame.transform.tx = (parseFloat(frame.transform.tx) || 0) + delta.x;
                          if (delta.y !== undefined) frame.transform.ty = (parseFloat(frame.transform.ty) || 0) + delta.y;
                      } 
                      // Fallback to Layout (x, y) if no transform
                      else if (frame.layout) {
                          if (delta.x !== undefined) frame.layout.x = (parseFloat(frame.layout.x) || 0) + delta.x;
                          if (delta.y !== undefined) frame.layout.y = (parseFloat(frame.layout.y) || 0) + delta.y;
                      }
                  });
                  updated = true;
              }
          });
      }

      if (updated) {
          setMetadata({
              ...metadata,
              videoItem: newVideoItem
          });
      }
  };

  const handleUpdateSprite = (key: string, updates: { x?: number, y?: number, width?: number, height?: number, scale?: number }) => {
      if (!metadata.videoItem) return;
      
      const newVideoItem = JSON.parse(JSON.stringify(metadata.videoItem));
      let updated = false;

      if (newVideoItem.sprites) {
          newVideoItem.sprites.forEach((sprite: any) => {
              if (sprite.imageKey === key) {
                  sprite.frames.forEach((frame: any) => {
                      if (!frame.layout) frame.layout = { x: 0, y: 0, width: 0, height: 0 };
                      
                      if (updates.x !== undefined) frame.layout.x = updates.x;
                      if (updates.y !== undefined) frame.layout.y = updates.y;
                      if (updates.width !== undefined) frame.layout.width = updates.width;
                      if (updates.height !== undefined) frame.layout.height = updates.height;
                  });
                  updated = true;
              }
          });
      }

      if (updated) {
          setMetadata({
              ...metadata,
              videoItem: newVideoItem
          });
      }
  };

  const handleMoveSprite = (key: string, direction: 'up' | 'down') => {
      if (!metadata.videoItem || !metadata.videoItem.sprites) return;
      
      const newSprites = [...metadata.videoItem.sprites];
      const index = newSprites.findIndex((s: any) => s.imageKey === key);
      
      if (index === -1) return;

      if (direction === 'up' && index < newSprites.length - 1) {
          // Move UP means moving towards the END of the array (rendered later = on top)
          [newSprites[index], newSprites[index + 1]] = [newSprites[index + 1], newSprites[index]];
      } else if (direction === 'down' && index > 0) {
          // Move DOWN means moving towards the START of the array (rendered earlier = behind)
          [newSprites[index], newSprites[index - 1]] = [newSprites[index - 1], newSprites[index]];
      } else {
          return; // No change
      }

      setMetadata({
          ...metadata,
          videoItem: {
              ...metadata.videoItem,
              sprites: newSprites
          }
      });
  };

  const handleRemoveLayer = (id: string) => {
    if (confirm("حذف هذه الطبقة؟")) {
        setCustomLayers(prev => prev.filter(l => l.id !== id));
        if (selectedLayerId === id) setSelectedLayerId(null);
    }
  };

  const handleMoveLayer = (id: string, direction: 'up' | 'down') => {
    setCustomLayers(prev => {
      const index = prev.findIndex(l => l.id === id);
      if (index === -1) return prev;
      const newLayers = [...prev];
      if (direction === 'up' && index < newLayers.length - 1) {
        [newLayers[index], newLayers[index + 1]] = [newLayers[index + 1], newLayers[index]];
      } else if (direction === 'down' && index > 0) {
        [newLayers[index], newLayers[index - 1]] = [newLayers[index - 1], newLayers[index]];
      }
      return newLayers;
    });
  };

  const handleUpdateLayer = (id: string, updates: Partial<CustomLayer>) => {
    setCustomLayers(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
  };

  const getProcessedSVGAData = async (isAEExport = false) => {
      const isEdgeFadeActive = fadeConfig.top > 0 || fadeConfig.bottom > 0 || fadeConfig.left > 0 || fadeConfig.right > 0;
      const root = protobuf.parse(svgaSchema).root;
      const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");
      let message: any;
      let imagesData: Record<string, Uint8Array> = {};

      if (metadata.type === 'SVGA') {
          let buffer: ArrayBuffer;
          if (metadata.originalFile) {
              buffer = await metadata.originalFile.arrayBuffer();
          } else if (metadata.fileUrl) {
              const res = await fetch(metadata.fileUrl);
              buffer = await res.arrayBuffer();
          } else {
              throw new Error("No original file available.");
          }

          const uint8Array = new Uint8Array(buffer);
          const isZip = uint8Array[0] === 0x50 && uint8Array[1] === 0x4B && uint8Array[2] === 0x03 && uint8Array[3] === 0x04;

          if (isZip) {
              const JSZip = (window as any).JSZip;
              if (!JSZip) throw new Error("JSZip not loaded");
              const zip = await JSZip.loadAsync(buffer);
              const binaryFile = zip.file("movie.binary");
              if (!binaryFile) {
                  throw new Error("Invalid SVGA 1.0 file: movie.binary not found.");
              }
              const binaryData = await binaryFile.async("uint8array");
              message = MovieEntity.decode(binaryData);
              
              message.images = message.images || {};
              for (const filename of Object.keys(zip.files)) {
                  if (filename.endsWith('.png') || filename.endsWith('.jpg') || filename.endsWith('.jpeg')) {
                      const key = filename.replace(/\.(png|jpg|jpeg)$/, '');
                      const imgData = await zip.file(filename)?.async("uint8array");
                      if (imgData) {
                          message.images[key] = imgData;
                      }
                  }
              }
          } else {
              const inflated = pako.inflate(uint8Array);
              message = MovieEntity.decode(inflated);
          }

          if (message.sprites) {
              // Use metadata.videoItem.sprites as the source of truth if it exists, 
              // but preserve original sprite data if we're just filtering/editing.
              // For duplicated layers, we MUST use metadata.videoItem.sprites.
              message.sprites = (metadata.videoItem.sprites || message.sprites).filter((s: any) => !deletedKeys.has(s.imageKey)).map((s: any) => JSON.parse(JSON.stringify(s)));
          }
          if (message.images) {
              // Ensure all images from metadata.videoItem.images are included
              const combinedImages = { ...message.images, ...(metadata.videoItem.images || {}) };
              deletedKeys.forEach(key => {
                  delete combinedImages[key];
              });
              message.images = combinedImages;
          }

          imagesData = message.images || {};
      } else {
          message = {
              version: "2.0",
              params: {
                  viewBoxWidth: metadata.dimensions?.width || 750,
                  viewBoxHeight: metadata.dimensions?.height || 750,
                  fps: metadata.fps || 30,
                  frames: metadata.frames || 0
              },
              images: {},
              sprites: (metadata.videoItem.sprites || []).filter((s: any) => !deletedKeys.has(s.imageKey)).map((s: any) => JSON.parse(JSON.stringify(s))),
              audios: [...(metadata.videoItem.audios || [])]
          };
          
          const allImageKeys = new Set<string>();
          (metadata.videoItem.sprites || []).forEach((s: any) => allImageKeys.add(s.imageKey));
          Object.keys(layerImages).forEach(k => allImageKeys.add(k));
          
          for (const key of Array.from(allImageKeys)) {
              if (deletedKeys.has(key)) continue;
              let finalBase64 = layerImages[key] || "";
              if (!finalBase64) continue;
              const binaryString = atob(finalBase64.split(',')[1]);
              const bytes = new Uint8Array(binaryString.length);
              for (let j = 0; j < binaryString.length; j++) bytes[j] = binaryString.charCodeAt(j);
              imagesData[key] = bytes;
          }
          message.images = imagesData;
      }

      const keys = Object.keys(imagesData);
      for (let i = 0; i < keys.length; i++) {
          const key = keys[i];
          if (deletedKeys.has(key)) continue;

          let finalBase64 = "";
          if (layerImages[key]) {
              finalBase64 = await getProcessedAsset(key);
          } else {
              const imgData = imagesData[key];
              let binary = '';
              const len = imgData.byteLength;
              for (let k = 0; k < len; k++) {
                  binary += String.fromCharCode(imgData[k]);
              }
              finalBase64 = `data:image/png;base64,${btoa(binary)}`;
          }

          if (!finalBase64) continue;
          
          const hasColorTint = !!assetColors[key];
          // For AE export, we don't want to scale down the assets unless necessary, 
          // but we DO want color tints if applied.
          if ((!isAEExport && exportScale < 0.99) || isEdgeFadeActive || hasColorTint) {
              const img = new Image();
              img.src = finalBase64;
              await new Promise(r => img.onload = r);
              const canvas = document.createElement('canvas');
              const targetScale = (!isAEExport && exportScale < 0.99) ? exportScale : 1.0;
              canvas.width = Math.floor(img.width * targetScale);
              canvas.height = Math.floor(img.height * targetScale);
              
              const ctx = canvas.getContext('2d');
              if (ctx) {
                  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                  if (hasColorTint) {
                      const color = assetColors[key];
                      const mode = assetColorModes[key] || 'tint';
                      
                      if (mode === 'fill') {
                          ctx.globalCompositeOperation = 'source-in';
                          ctx.fillStyle = color;
                          ctx.fillRect(0, 0, canvas.width, canvas.height);
                      } else {
                          ctx.globalCompositeOperation = 'multiply';
                          ctx.fillStyle = color;
                          ctx.fillRect(0, 0, canvas.width, canvas.height);
                          ctx.globalCompositeOperation = 'destination-in';
                          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                      }
                      ctx.globalCompositeOperation = 'source-over';
                  }
                  
                  if (isEdgeFadeActive) {
                      applyTransparencyEffects(ctx, canvas.width, canvas.height);
                  }

                  finalBase64 = canvas.toDataURL('image/png');
              }
          }

          const binaryString = atob(finalBase64.split(',')[1]);
          const bytes = new Uint8Array(binaryString.length);
          for (let j = 0; j < binaryString.length; j++) bytes[j] = binaryString.charCodeAt(j);
          imagesData[key] = bytes;
      }
      
      message.images = imagesData;

      // Ensure all sprites have an image entry (fix for missing layers)
      if (message.sprites) {
          message.sprites.forEach((s: any) => {
              if (s.imageKey && !imagesData[s.imageKey]) {
                  const binaryString = atob(TRANSPARENT_PIXEL.split(',')[1]);
                  const bytes = new Uint8Array(binaryString.length);
                  for (let j = 0; j < binaryString.length; j++) bytes[j] = binaryString.charCodeAt(j);
                  imagesData[s.imageKey] = bytes;
              }
          });
      }

      const origW = message.params.viewBoxWidth;
      const origH = message.params.viewBoxHeight;

      // Skip preview-specific transformations for AE export
      if (!isAEExport) {
          const scaleX = videoWidth / origW;
          const scaleY = videoHeight / origH;
          
          const fitScale = Math.min(scaleX, scaleY);
          const fitOffsetX = (videoWidth - origW * fitScale) / 2;
          const fitOffsetY = (videoHeight - origH * fitScale) / 2;

          if (message.sprites) {
              message.sprites.forEach((sprite: any) => {
                  if (sprite.frames) {
                      sprite.frames.forEach((frame: any) => {
                          const cx = videoWidth / 2;
                          const cy = videoHeight / 2;
                          const totalScale = fitScale * svgaScale;

                          if (frame.layout) {
                              let fx = frame.layout.x * fitScale + fitOffsetX;
                              let fy = frame.layout.y * fitScale + fitOffsetY;
                              let fw = frame.layout.width * fitScale;
                              let fh = frame.layout.height * fitScale;

                              frame.layout.x = (fx - cx) * svgaScale + cx + svgaPos.x;
                              frame.layout.y = (fy - cy) * svgaScale + cy + svgaPos.y;
                              frame.layout.width = fw * svgaScale;
                              frame.layout.height = fh * svgaScale;
                          }

                          if (frame.transform) {
                              if (frame.layout) {
                                  frame.transform.tx *= totalScale;
                                  frame.transform.ty *= totalScale;
                              } else {
                                   let ftx = frame.transform.tx * fitScale + fitOffsetX;
                                   let fty = frame.transform.ty * fitScale + fitOffsetY;
                                   
                                   frame.transform.tx = (ftx - cx) * svgaScale + cx + svgaPos.x;
                                   frame.transform.ty = (fty - cy) * svgaScale + cy + svgaPos.y;
                                   
                                   frame.transform.a *= totalScale;
                                   frame.transform.b *= totalScale;
                                   frame.transform.c *= totalScale;
                                   frame.transform.d *= totalScale;
                              }
                          }
                      });
                  }
              });
          }

          message.params.viewBoxWidth = videoWidth;
          message.params.viewBoxHeight = videoHeight;
      }

      const backLayers = customLayers.filter(l => l.zIndexMode === 'back').reverse();
      for (const layer of backLayers) {
          try {
              const layerKey = layer.id;
              let bytes: Uint8Array | null = null;

              if (layer.url.startsWith('blob:')) {
                  const response = await fetch(layer.url);
                  const arrayBuffer = await response.arrayBuffer();
                  bytes = new Uint8Array(arrayBuffer);
              } else if (layer.url.includes(',')) {
                  const binary = atob(layer.url.split(',')[1]);
                  bytes = new Uint8Array(binary.length);
                  for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
              }

              if (!bytes) continue;
              message.images[layerKey] = bytes;

              const finalWidth = layer.width * layer.scale;
              const finalHeight = layer.height * layer.scale;
              
              // For AE export, we might need to adjust custom layer positions to match original viewBox
              let lx = layer.x;
              let ly = layer.y;
              let lw = finalWidth;
              let lh = finalHeight;

              if (isAEExport) {
                  const scaleX = origW / videoWidth;
                  const scaleY = origH / videoHeight;
                  lx *= scaleX;
                  ly *= scaleY;
                  lw *= scaleX;
                  lh *= scaleY;
              }

              const layerFrame = {
                  alpha: 1.0,
                  layout: { 
                      x: parseFloat(lx.toString()), 
                      y: parseFloat(ly.toString()), 
                      width: parseFloat(lw.toString()), 
                      height: parseFloat(lh.toString()) 
                  },
                  transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }
              };
              if (!message.sprites) message.sprites = [];
              message.sprites.unshift({ imageKey: layerKey, frames: Array(message.params.frames || 1).fill(layerFrame) });
          } catch (e) {
              console.error("Failed to process back layer:", layer.id, e);
          }
      }

      const frontLayers = customLayers.filter(l => l.zIndexMode === 'front');
      for (const layer of frontLayers) {
          try {
              const layerKey = layer.id;
              let bytes: Uint8Array | null = null;

              if (layer.url.startsWith('blob:')) {
                  const response = await fetch(layer.url);
                  const arrayBuffer = await response.arrayBuffer();
                  bytes = new Uint8Array(arrayBuffer);
              } else if (layer.url.includes(',')) {
                  const binary = atob(layer.url.split(',')[1]);
                  bytes = new Uint8Array(binary.length);
                  for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
              }

              if (!bytes) continue;
              message.images[layerKey] = bytes;

              const finalWidth = layer.width * layer.scale;
              const finalHeight = layer.height * layer.scale;
              
              let lx = layer.x;
              let ly = layer.y;
              let lw = finalWidth;
              let lh = finalHeight;

              if (isAEExport) {
                  const scaleX = origW / videoWidth;
                  const scaleY = origH / videoHeight;
                  lx *= scaleX;
                  ly *= scaleY;
                  lw *= scaleX;
                  lh *= scaleY;
              }

              const layerFrame = {
                  alpha: 1.0,
                  layout: { 
                      x: parseFloat(lx.toString()), 
                      y: parseFloat(ly.toString()), 
                      width: parseFloat(lw.toString()), 
                      height: parseFloat(lh.toString()) 
                  },
                  transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }
              };
              if (!message.sprites) message.sprites = [];
              message.sprites.push({ imageKey: layerKey, frames: Array(message.params.frames || 1).fill(layerFrame) });
          } catch (e) {
              console.error("Failed to process front layer:", layer.id, e);
          }
      }

      const wmKey = "quantum_wm_layer_fixed";
      if (watermark) {
          const binary = atob(watermark.split(',')[1]);
          const bytes = new Uint8Array(binary.length);
          for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
          message.images[wmKey] = bytes;

          const wmSize = await getImageSize(watermark);
          const wmWidth = videoWidth * wmScale;
          const wmHeight = wmWidth * (wmSize.h / wmSize.w);
          const wmX = (videoWidth / 2) - (wmWidth / 2) + wmPos.x;
          const wmY = (videoHeight / 2) - (wmHeight / 2) + wmPos.y;
          
          let finalWmX = wmX;
          let finalWmY = wmY;
          let finalWmW = wmWidth;
          let finalWmH = wmHeight;

          if (isAEExport) {
              const scaleX = origW / videoWidth;
              const scaleY = origH / videoHeight;
              finalWmX *= scaleX;
              finalWmY *= scaleY;
              finalWmW *= scaleX;
              finalWmH *= scaleY;
          }

          const wmFrame = {
              alpha: 1.0,
              layout: { x: finalWmX || 0, y: finalWmY || 0, width: finalWmW, height: finalWmH },
              transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }
          };
          if (!message.sprites) message.sprites = [];
          message.sprites.push({
              imageKey: wmKey,
              frames: Array(message.params.frames || 1).fill(wmFrame)
          });
      }

      if (audioUrl) {
          const audioKey = "quantum_audio_track";
          let bytes: Uint8Array | null = null;
          
          if (audioFile) {
              const arrayBuffer = await audioFile.arrayBuffer();
              bytes = new Uint8Array(arrayBuffer);
          } else if (audioUrl === originalAudioUrl) {
               bytes = null;
          } else {
              try {
                  const response = await fetch(audioUrl);
                  const arrayBuffer = await response.arrayBuffer();
                  bytes = new Uint8Array(arrayBuffer);
              } catch (e) { console.error("Failed to fetch audio", e); }
          }

          if (bytes) {
              message.images[audioKey] = bytes; 
              message.audios = [{
                  audioKey: audioKey,
                  startFrame: 0,
                  endFrame: message.params.frames || 0,
                  startTime: 0,
                  totalTime: Math.floor(((message.params.frames || 0) / (message.params.fps || 30)) * 1000)
              }];
          }
      } else {
          message.audios = [];
      }

      return { message, imagesData, originalWidth: origW, originalHeight: origH };
  };

  const handleExportAEProject = async () => {
    if (!svgaInstance) return;

    setIsExporting(true);
    setExportPhase('تحليل مصفوفة الطبقات Quantum v5.6...');
    try {
      const zip = new JSZip();
      const assetsFolder = zip.folder("assets");
      
      const { message, imagesData, originalWidth, originalHeight } = await getProcessedSVGAData(true);

      const keys = Object.keys(imagesData);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const fileName = `${key}.png`;
        assetsFolder.file(fileName, imagesData[key]);
        setProgress(Math.floor((i / keys.length) * 30));
      }

      if (previewBg) zip.file(`background.png`, previewBg.split(',')[1], { base64: true });

      // Handle Audio Export
      let audioFilename = '';
      let hasAudio = false;
      if (audioFile) {
          const audioBuffer = await audioFile.arrayBuffer();
          audioFilename = `audio.${audioFile.name.split('.').pop() || 'mp3'}`;
          assetsFolder.file(audioFilename, audioBuffer);
          hasAudio = true;
      } else if (audioUrl) {
          try {
              const response = await fetch(audioUrl);
              const blob = await response.blob();
              const audioBuffer = await blob.arrayBuffer();
              const ext = blob.type.split('/')[1] || 'mp3';
              audioFilename = `audio.${ext}`;
              assetsFolder.file(audioFilename, audioBuffer);
              hasAudio = true;
          } catch (e) {
              console.warn("Failed to fetch audio for export", e);
          }
      }

      const sprites = message.sprites || [];
      const exportFps = message.params?.fps || metadata.fps || 30;
      const exportFrames = message.params?.frames || metadata.frames || 0;
      const svgaVersion = "2.0"; // Force 2.0 logic for AE export as requested

      const round = (n: number) => Math.round(n * 1000000) / 1000000;

      const manifest = {
        version: "7.0-QUANTUM-ULTRA",
        format: "SVGA 2.0",
        svgaVersion: svgaVersion,
        width: originalWidth,
        height: originalHeight,
        fps: exportFps,
        frames: exportFrames,
        adjustments: {
            svga: { pos: {x:0, y:0}, scale: 1 },
            bg: { pos: bgPos, scale: bgScale, exists: !!previewBg },
            wm: { pos: {x:0, y:0}, scale: 1, exists: false },
            audio: { exists: hasAudio, filename: audioFilename }
        },
        sprites: sprites.map((s: any, sIdx: number) => {
          const allFrames: any[] = [];
          
          s.frames.forEach((f: any, fIdx: number) => {
            const currentFrameData = {
              f: fIdx,
              a: f.alpha !== undefined ? round(f.alpha) : 1,
              l: { 
                x: round(f.layout?.x || 0), 
                y: round(f.layout?.y || 0), 
                w: round(f.layout?.width || 0), 
                h: round(f.layout?.height || 0) 
              },
              t: f.transform ? {
                a: round(f.transform.a),
                b: round(f.transform.b),
                c: round(f.transform.c),
                d: round(f.transform.d),
                tx: round(f.transform.tx),
                ty: round(f.transform.ty)
              } : null
            };
            allFrames.push(currentFrameData);
          });

          return {
            imageKey: s.imageKey || `layer_${sIdx}`,
            matteKey: s.matteKey || null,
            blendMode: s.blendMode || null,
            hasShapes: !!(s.shapes && s.shapes.length > 0),
            keyframes: allFrames
          };
        })
      };

      zip.file("manifest.json", JSON.stringify(manifest));

      const jsxContent = `
if (!this.JSON) { this.JSON = {}; }
(function () {
    'use strict';
    var cx = /[\\u0000\\u00ad\\u0600-\\u0604\\u070f\\u17b4\\u17b5\\u200c-\\u200f\\u2028-\\u202f\\u2060-\\u206f\\ufeff\\ufff0-\\uffff]/g;
    if (typeof JSON.parse !== 'function') {
        JSON.parse = function (text) {
            var j; text = String(text); cx.lastIndex = 0;
            if (cx.test(text)) { text = text.replace(cx, function (a) { return '\\\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4); }); }
            j = eval('(' + text + ')'); return j;
        };
    }
}());

(function() {
    var scriptFile = new File($.fileName);
    var projectFolder = scriptFile.parent;
    var manifestFile = new File(projectFolder.fsName + "/manifest.json");
    
    if (!manifestFile.exists) {
        alert("❌ Error: manifest.json not found in the same folder as the script!");
        return;
    }
    
    manifestFile.open("r");
    var data = JSON.parse(manifestFile.read());
    manifestFile.close();

    app.beginUndoGroup("Quantum SVGA Rebuild v7.0");
    
    var compDuration = data.frames / data.fps;
    if (compDuration <= 0) compDuration = 1/data.fps;
    
    var mainComp = app.project.items.addComp("Quantum_Animation_Suite", data.width, data.height, 1.0, compDuration, data.fps);
    mainComp.bgColor = [0,0,0];
    mainComp.frameRate = data.fps;
    
    var masterNull = mainComp.layers.addNull();
    masterNull.name = "SVGA_ROOT_TRANSFORM";
    masterNull.position.setValue([0, 0]); // Absolute origin
    masterNull.scale.setValue([100, 100]);

    var assetsFolder = new Folder(projectFolder.fsName + "/assets");
    if (!assetsFolder.exists) {
        assetsFolder = Folder.selectDialog("Select the 'assets' folder");
    }
    if (!assetsFolder) { app.endUndoGroup(); return; }

    // Import Audio
    if (data.adjustments.audio.exists) {
        var audioFile = File(assetsFolder.fsName + "/" + data.adjustments.audio.filename);
        if (audioFile.exists) {
            try {
                var audioItem = app.project.importFile(new ImportOptions(audioFile));
                var audioLayer = mainComp.layers.add(audioItem);
                audioLayer.name = "Audio_Track";
            } catch(e) { $.writeln("Audio import failed: " + e); }
        }
    }

    var layerMap = {};
    var blendMap = {
        "ADD": BlendingMode.ADD,
        "SCREEN": BlendingMode.SCREEN,
        "MULTIPLY": BlendingMode.MULTIPLY,
        "OVERLAY": BlendingMode.OVERLAY,
        "DARKEN": BlendingMode.DARKEN,
        "LIGHTEN": BlendingMode.LIGHTEN,
        "COLOR_DODGE": BlendingMode.COLOR_DODGE,
        "COLOR_BURN": BlendingMode.COLOR_BURN,
        "HARD_LIGHT": BlendingMode.HARD_LIGHT,
        "SOFT_LIGHT": BlendingMode.SOFT_LIGHT,
        "DIFFERENCE": BlendingMode.DIFFERENCE,
        "EXCLUSION": BlendingMode.EXCLUSION
    };

    for (var i = 0; i < data.sprites.length; i++) {
        var sprite = data.sprites[i];
        var layer;
        var footage;

        if (sprite.imageKey) {
            var imgFile = File(assetsFolder.fsName + "/" + sprite.imageKey + ".png");
            if (imgFile.exists) {
                try {
                    footage = app.project.importFile(new ImportOptions(imgFile));
                    layer = mainComp.layers.add(footage);
                    layer.anchorPoint.setValue([0, 0]);
                } catch(e) {
                    $.writeln("Failed to import: " + imgFile.fsName);
                }
            }
        }
        
        if (!layer) {
            // Create a placeholder for shape layers or missing assets
            var layerName = "Layer_" + i + (sprite.imageKey ? "_" + sprite.imageKey : "_Shape");
            if (sprite.hasShapes) {
                layer = mainComp.layers.addShape();
                layer.name = layerName + "_[VECTOR]";
            } else {
                layer = mainComp.layers.addSolid([0.2, 0.2, 0.2], layerName, 100, 100, 1.0);
                layer.guideLayer = true;
            }
            layer.anchorPoint.setValue([0, 0]);
        }

        layer.name = "Layer_" + i + "_" + (sprite.imageKey || "Shape");
        layer.parent = masterNull;
        layerMap[i] = layer;

        if (sprite.blendMode && blendMap[sprite.blendMode]) {
            layer.blendingMode = blendMap[sprite.blendMode];
        }
        
        var fd = mainComp.frameDuration;
        
        for (var k = 0; k < sprite.keyframes.length; k++) {
            var kf = sprite.keyframes[k];
            var time = kf.f * fd;
            
            var imgW = footage ? footage.width : (kf.l.w || 100);
            var imgH = footage ? footage.height : (kf.l.h || 100);
            
            var sw = (kf.l.w || 1) / (imgW || 1);
            var sh = (kf.l.h || 1) / (imgH || 1);
            
            var a = kf.t ? kf.t.a : 1;
            var b = kf.t ? kf.t.b : 0;
            var c = kf.t ? kf.t.c : 0;
            var d = kf.t ? kf.t.d : 1;
            var tx = kf.t ? kf.t.tx : 0;
            var ty = kf.t ? kf.t.ty : 0;

            var Ma = a * sw;
            var Mb = b * sw;
            var Mc = c * sh;
            var Md = d * sh;
            var Mtx = a * kf.l.x + c * kf.l.y + tx;
            var Mty = b * kf.l.x + d * kf.l.y + ty;

            var finalX, finalY;
            var scaleX = 100;
            var scaleY = 100;
            var rot = 0;
            
            var opKey = layer.opacity.addKey(time);
            layer.opacity.setValueAtKey(opKey, kf.a * 100);
            layer.opacity.setInterpolationTypeAtKey(opKey, KeyframeInterpolationType.HOLD, KeyframeInterpolationType.HOLD);
            
            scaleX = Math.sqrt(Ma * Ma + Mb * Mb);
            var det = Ma * Md - Mb * Mc;
            scaleY = det / (scaleX || 1e-6);
            rot = Math.atan2(Mb, Ma) * 180 / Math.PI;
            
            scaleX *= 100;
            scaleY *= 100;
            
            finalX = Mtx;
            finalY = Mty;
            
            var scaleKey = layer.scale.addKey(time);
            layer.scale.setValueAtKey(scaleKey, [scaleX, scaleY]);
            layer.scale.setInterpolationTypeAtKey(scaleKey, KeyframeInterpolationType.HOLD, KeyframeInterpolationType.HOLD);
            
            var rotKey = layer.rotation.addKey(time);
            layer.rotation.setValueAtKey(rotKey, rot);
            layer.rotation.setInterpolationTypeAtKey(rotKey, KeyframeInterpolationType.HOLD, KeyframeInterpolationType.HOLD);
            
            var posKey = layer.position.addKey(time);
            layer.position.setValueAtKey(posKey, [finalX, finalY]);
            layer.position.setInterpolationTypeAtKey(posKey, KeyframeInterpolationType.HOLD, KeyframeInterpolationType.HOLD);
        }
    }

    // Apply Track Mattes (Professional Duplicate Logic for multi-use mattes)
    // We process in reverse to maintain correct stack order during duplication
    for (var i = data.sprites.length - 1; i >= 0; i--) {
        var s = data.sprites[i];
        if (s.matteKey) {
            var targetLayer = layerMap[i];
            if (!targetLayer) continue;
            
            var originalMatteLayer = null;
            // Find the sprite that acts as the matte source
            for (var j = 0; j < data.sprites.length; j++) {
                if (data.sprites[j].imageKey === s.matteKey) {
                    originalMatteLayer = layerMap[j];
                    break;
                }
            }
            
            if (originalMatteLayer) {
                try {
                    // Duplicate the matte layer so it can be used specifically for this target
                    var matteInstance = originalMatteLayer.duplicate();
                    matteInstance.name = "[MATTE]_" + originalMatteLayer.name;
                    matteInstance.moveBefore(targetLayer);
                    matteInstance.parent = originalMatteLayer.parent;
                    targetLayer.trackMatteType = TrackMatteType.ALPHA;
                    
                    // Hide the original matte layer if it's purely a mask source
                    // SVGA usually uses separate sprites for masks
                    originalMatteLayer.enabled = false;
                } catch(e) { $.writeln("Matte apply failed for layer " + i + ": " + e); }
            }
        }
    }

    if (data.adjustments.bg.exists) {
        var bgFile = File(projectFolder.fsName + "/background.png");
        if (bgFile.exists) {
            var bgL = mainComp.layers.add(app.project.importFile(new ImportOptions(bgFile)));
            bgL.name = "Quantum_Background";
            bgL.moveToEnd();
            bgL.scale.setValue([data.adjustments.bg.scale, data.adjustments.bg.scale]);
            bgL.position.setValue([data.width * (data.adjustments.bg.pos.x/100), data.height * (data.adjustments.bg.pos.y/100)]);
        }
    }

    app.endUndoGroup();
    alert("✅ Animation Rebuild Complete (v7.0 ULTRA)!\\nLayers: " + data.sprites.length + "\\nCheck Info panel for any missing assets.");
})();
      `;

      const readmeContent = `SVGA to AEP Script Usage Guide (v7.0 ULTRA)
================================

📁 Files Included
-----------------
- ${metadata.name.replace('.svga','')}.jsx - After Effects script file
- manifest.json - Animation data file (DO NOT DELETE)
- assets/ - Exported image and audio files
- README.txt - This file

🚀 Quick Start
--------------
1. Extract the entire ZIP file to a folder.
2. Open Adobe After Effects.
3. Go to File > Scripts > Run Script File.
4. Select ${metadata.name.replace('.svga','')}.jsx script file.
5. The script will automatically find manifest.json and assets/ in the same folder.

✅ Features (v7.0 Updates)
--------------------------
- SVGA 2.0 Engine: Built using the same high-fidelity logic as the SVGA 2.0 export button.
- Original Version Sync: Detects and labels the project with the original SVGA version (2.0 forced).
- Robust Layer Recovery: All layers from the original file are now included. Missing assets are replaced with guide placeholders to maintain animation structure.
- Frame-Perfect Motion: Matches original FPS, frames, and viewBox dimensions exactly.
- Professional Mirroring: Advanced matrix decomposition for flipped/mirrored layers.
- Background & Audio support.

⚠️ Requirements
---------------
- Adobe After Effects CC 2018 or newer.
- Allow Scripts to Write Files and Access Network (Edit > Preferences > Scripting & Expressions).
`;

      zip.file(`${metadata.name.replace('.svga','')}.jsx`, jsxContent);
      zip.file("README.txt", readmeContent);
      
      const blob = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${metadata.name.replace('.svga','')}_AfterEffects_Project.zip`;
      link.click();
      setProgress(100);
    } catch (e) { console.error(e); } finally { setTimeout(() => setIsExporting(false), 800); }
  };

  const handleExportImageSequence = async () => {
    if (!svgaInstance || !playerRef.current) return;

    setIsExporting(true);
    setExportPhase('جاري تصدير تسلسل الصور...');
    
    try {
      const zip = new JSZip();
      const folder = zip.folder("sequence");
      const totalFrames = metadata.frames || 0;
      
      svgaInstance.pauseAnimation();

      const canvas = playerRef.current.querySelector('canvas');
      if (!canvas) throw new Error("Canvas not found");

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

      const originalFrame = currentFrame;

      for (let i = 0; i < totalFrames; i++) {
        svgaInstance.stepToFrame(i, true);
        await new Promise(resolve => setTimeout(resolve, 30));
        
        const currentCanvas = playerRef.current?.querySelector('canvas');
        if (currentCanvas && tCtx) {
            tCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
            tCtx.drawImage(currentCanvas, 0, 0);
            applyTransparencyEffects(tCtx, tempCanvas.width, tempCanvas.height);
            
            const dataUrl = tempCanvas.toDataURL("image/png");
            const base64 = dataUrl.split(',')[1];
            folder.file(`frame_${String(i).padStart(5, '0')}.png`, base64, { base64: true });
        }
        
        setProgress(Math.floor(((i + 1) / totalFrames) * 100));
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${metadata.name.replace('.svga','')}_Sequence.zip`;
      link.click();
      
      svgaInstance.stepToFrame(originalFrame, true);
      
    } catch (e) {
      console.error(e);
      alert("حدث خطأ أثناء تصدير الصور");
    } finally {
      setIsExporting(false);
      if (isPlaying) svgaInstance.startAnimation();
    }
  };

  const handleExportGIF = async () => {
    if (!svgaInstance || !playerRef.current) return;

    setIsExporting(true);
    setExportPhase('جاري إنشاء ملف GIF شفاف...');

    try {
        svgaInstance.pauseAnimation();
        const originalFrame = currentFrame;
        const totalFrames = metadata.frames || 0;
        const fps = metadata.fps || 30;
        const canvas = playerRef.current.querySelector('canvas');
        if (!canvas) throw new Error("Canvas not found");

        let gifQuality = 10;
        if (globalQuality === 'high') gifQuality = 1;
        if (globalQuality === 'medium') gifQuality = 10;
        if (globalQuality === 'low') gifQuality = 20;

        const gif = new GIF({
            workers: 2,
            quality: gifQuality,
            width: canvas.width,
            height: canvas.height,
            workerScript: '/gif.worker.js',
            transparent: 0x00FF00
        });

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

        for (let i = 0; i < totalFrames; i++) {
            svgaInstance.stepToFrame(i, true);
            await new Promise(r => setTimeout(r, 30));
            
            const currentCanvas = playerRef.current?.querySelector('canvas');
            if (tCtx && currentCanvas) {
                tCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
                tCtx.drawImage(currentCanvas, 0, 0);
                
                applyTransparencyEffects(tCtx, tempCanvas.width, tempCanvas.height);

                const imageData = tCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
                const data = imageData.data;
                
                for (let j = 0; j < data.length; j += 4) {
                    const a = data[j + 3];
                    if (a < 50) {
                        // Make it Green (Transparent Key)
                        data[j] = 0;
                        data[j + 1] = 255;
                        data[j + 2] = 0;
                        data[j + 3] = 255;
                    } else {
                        // Make it Opaque (Remove semi-transparency)
                        data[j + 3] = 255;
                    }
                }
                tCtx.putImageData(imageData, 0, 0);
                
                gif.addFrame(tempCanvas, { delay: 1000 / fps, copy: true });
            }
            setProgress(Math.floor(((i + 1) / totalFrames) * 50));
        }

        setExportPhase('جاري معالجة GIF (Rendering)...');
        
        gif.on('progress', (p: number) => {
            setProgress(50 + Math.floor(p * 50));
        });

        gif.on('finished', (blob: Blob) => {
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `${metadata.name.replace('.svga', '')}_Transparent.gif`;
            link.click();
            setIsExporting(false);
            svgaInstance.stepToFrame(originalFrame, true);
            if (isPlaying) svgaInstance.startAnimation();
        });

        gif.render();

    } catch (e) {
        console.error(e);
        alert("فشل تصدير GIF");
        setIsExporting(false);
    }
  };

  const handleExportWebM = async () => {
    if (!svgaInstance || !playerRef.current) return;

    setIsExporting(true);
    setExportPhase('جاري تحضير الأصول...');

    try {
        svgaInstance.pauseAnimation();
        const originalFrame = currentFrame;
        const totalFrames = metadata.frames || 0;
        const fps = metadata.fps || 30;
        
        // Use video dimensions for consistency
        const safeWidth = videoWidth;
        const safeHeight = videoHeight;

        // Helper to load image
        const loadImage = (src: string): Promise<HTMLImageElement> => {
            return new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.onload = () => resolve(img);
                img.onerror = () => resolve(img);
                img.src = src;
            });
        };

        // Load assets
        let bgImg: HTMLImageElement | null = null;
        if (previewBg) bgImg = await loadImage(previewBg);
        
        let wmImg: HTMLImageElement | null = null;
        if (watermark) wmImg = await loadImage(watermark);

        const loadedLayers = await Promise.all(customLayers.map(async l => {
            const img = await loadImage(l.url);
            return { ...l, img };
        }));

        // Composition Canvas
        const compCanvas = document.createElement('canvas');
        compCanvas.width = safeWidth;
        compCanvas.height = safeHeight;
        const cCtx = compCanvas.getContext('2d', { willReadFrequently: true });
        if (!cCtx) throw new Error("Failed to create context");

        // Check if VideoEncoder supports Alpha with VP9
        let supportAlpha = false;
        try {
            const config = {
                codec: 'vp09.00.10.08',
                width: safeWidth,
                height: safeHeight,
                bitrate: 2000000,
                alpha: 'keep' as const
            };
            // @ts-ignore
            const support = await VideoEncoder.isConfigSupported(config);
            if (support.supported) {
                supportAlpha = true;
            }
        } catch (e) {
            console.log("Alpha check failed", e);
        }

        if (!supportAlpha) {
             console.warn("Alpha encoding not supported, falling back to APNG");
             setExportPhase('الشفافية غير مدعومة للفيديو، جاري التحويل إلى APNG...');
             await new Promise(r => setTimeout(r, 1000));
             handleExportAPNG();
             return;
        }

        const muxer = new WebMMuxer.Muxer({
            target: new WebMMuxer.ArrayBufferTarget(),
            video: {
                codec: 'V_VP9',
                width: safeWidth,
                height: safeHeight,
                frameRate: fps,
                alpha: true
            }
        });

        let hasError = false;
        const videoEncoder = new VideoEncoder({
            output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
            error: (e) => {
                console.error("VideoEncoder Error:", e);
                hasError = true;
            }
        });

        setExportPhase('جاري إنشاء WebP متحرك (WebM Container)...');

        let bitrate = 2500000;
        if (globalQuality === 'high') bitrate = 4000000;
        if (globalQuality === 'low') bitrate = 1000000;

        videoEncoder.configure({
            codec: 'vp09.00.10.08',
            width: safeWidth,
            height: safeHeight,
            bitrate: bitrate,
            alpha: 'keep'
        });

        for (let i = 0; i < totalFrames; i++) {
            if (hasError || videoEncoder.state !== 'configured') {
                throw new Error("VideoEncoder configuration failed or crashed");
            }

            svgaInstance.stepToFrame(i, true);
            await new Promise(r => setTimeout(r, 30));
            
            const currentCanvas = playerRef.current?.querySelector('canvas');
            if (!currentCanvas) continue;

            // Render Composition
            cCtx.clearRect(0, 0, safeWidth, safeHeight);

            // 1. Background
            if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
                const bgW = (safeWidth * bgScale) / 100;
                const bgH = bgW * (bgImg.height / bgImg.width);
                const bgX = (safeWidth - bgW) * (bgPos.x / 100);
                const bgY = (safeHeight - bgH) * (bgPos.y / 100);
                cCtx.drawImage(bgImg, bgX, bgY, bgW, bgH);
            }

            // 2. Back Layers
            loadedLayers.filter(l => l.zIndexMode === 'back').forEach(l => {
                if (l.img.complete && l.img.naturalWidth > 0) {
                    cCtx.drawImage(l.img, l.x, l.y, l.width * l.scale, l.height * l.scale);
                }
            });

            // 3. SVGA
            const cx = safeWidth / 2;
            const cy = safeHeight / 2;
            cCtx.save();
            cCtx.translate(cx + svgaPos.x, cy + svgaPos.y);
            cCtx.scale(svgaScale, svgaScale);
            cCtx.translate(-cx, -cy);
            cCtx.drawImage(currentCanvas, 0, 0);
            cCtx.restore();

            // 4. Watermark
            if (wmImg && wmImg.complete && wmImg.naturalWidth > 0) {
                const wmW = safeWidth * wmScale;
                const wmH = wmW * (wmImg.height / wmImg.width);
                const wmX = (safeWidth - wmW) / 2 + wmPos.x;
                const wmY = (safeHeight - wmH) / 2 + wmPos.y;
                cCtx.globalAlpha = 0.7;
                cCtx.drawImage(wmImg, wmX, wmY, wmW, wmH);
                cCtx.globalAlpha = 1.0;
            }

            // 5. Front Layers
            loadedLayers.filter(l => l.zIndexMode === 'front').forEach(l => {
                if (l.img.complete && l.img.naturalWidth > 0) {
                    cCtx.drawImage(l.img, l.x, l.y, l.width * l.scale, l.height * l.scale);
                }
            });

            const bitmap = await createImageBitmap(compCanvas);
            const frame = new VideoFrame(bitmap, { timestamp: (i * 1000000) / fps });
            
            try {
                videoEncoder.encode(frame, { keyFrame: i % 30 === 0 });
            } catch (encodeError) {
                frame.close();
                bitmap.close();
                throw encodeError;
            }
            
            frame.close();
            bitmap.close();
            
            setProgress(Math.floor(((i + 1) / totalFrames) * 90));
        }

        await videoEncoder.flush();
        muxer.finalize();

        const buffer = muxer.target.buffer;
        const blob = new Blob([buffer], { type: 'video/webm' });
        
        const url = URL.createObjectURL(blob);
        setExportResult({
            url,
            filename: `${metadata.name.replace('.svga', '')}_Animated.webm`
        });

        setIsExporting(false);
        svgaInstance.stepToFrame(originalFrame, true);
        if (isPlaying) svgaInstance.startAnimation();

    } catch (e) {
        console.error("Export failed:", e);
        setExportPhase('فشل تصدير الفيديو، جاري المحاولة بصيغة APNG...');
        await new Promise(r => setTimeout(r, 1000));
        handleExportAPNG();
    }
  };

  const handleExportWebP = async () => {
    if (!svgaInstance || !playerRef.current) return;

    setIsExporting(true);
    setExportPhase('جاري إنشاء WebP المتحرك...');

    try {
        svgaInstance.pauseAnimation();
        const originalFrame = currentFrame;
        const totalFrames = metadata.frames || 0;
        const fps = metadata.fps || 30;
        
        const safeWidth = videoWidth;
        const safeHeight = videoHeight;

        const loadImage = (src: string): Promise<HTMLImageElement> => {
            return new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.onload = () => resolve(img);
                img.onerror = () => resolve(img);
                img.src = src;
            });
        };

        let bgImg: HTMLImageElement | null = null;
        if (previewBg) bgImg = await loadImage(previewBg);
        
        let wmImg: HTMLImageElement | null = null;
        if (watermark) wmImg = await loadImage(watermark);

        const loadedLayers = await Promise.all(customLayers.map(async l => {
            const img = await loadImage(l.url);
            return { ...l, img };
        }));

        const compCanvas = document.createElement('canvas');
        compCanvas.width = safeWidth;
        compCanvas.height = safeHeight;
        const cCtx = compCanvas.getContext('2d', { willReadFrequently: true });
        if (!cCtx) throw new Error("Failed to create context");

        const frames: { data: Uint8Array, duration: number }[] = [];

        for (let i = 0; i < totalFrames; i++) {
            svgaInstance.stepToFrame(i, true);
            await new Promise(r => setTimeout(r, 30));
            
            const currentCanvas = playerRef.current?.querySelector('canvas');
            if (!currentCanvas) continue;

            cCtx.clearRect(0, 0, safeWidth, safeHeight);

            if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
                const bgW = (safeWidth * bgScale) / 100;
                const bgH = bgW * (bgImg.height / bgImg.width);
                const bgX = (safeWidth - bgW) * (bgPos.x / 100);
                const bgY = (safeHeight - bgH) * (bgPos.y / 100);
                cCtx.drawImage(bgImg, bgX, bgY, bgW, bgH);
            }

            loadedLayers.filter(l => l.zIndexMode === 'back').forEach(l => {
                if (l.img.complete && l.img.naturalWidth > 0) {
                    cCtx.drawImage(l.img, l.x, l.y, l.width * l.scale, l.height * l.scale);
                }
            });

            const cx = safeWidth / 2;
            const cy = safeHeight / 2;
            cCtx.save();
            cCtx.translate(cx + svgaPos.x, cy + svgaPos.y);
            cCtx.scale(svgaScale, svgaScale);
            cCtx.translate(-cx, -cy);
            cCtx.drawImage(currentCanvas, 0, 0);
            cCtx.restore();

            if (wmImg && wmImg.complete && wmImg.naturalWidth > 0) {
                const wmW = safeWidth * wmScale;
                const wmH = wmW * (wmImg.height / wmImg.width);
                const wmX = (safeWidth - wmW) / 2 + wmPos.x;
                const wmY = (safeHeight - wmH) / 2 + wmPos.y;
                cCtx.globalAlpha = 0.7;
                cCtx.drawImage(wmImg, wmX, wmY, wmW, wmH);
                cCtx.globalAlpha = 1.0;
            }

            loadedLayers.filter(l => l.zIndexMode === 'front').forEach(l => {
                if (l.img.complete && l.img.naturalWidth > 0) {
                    cCtx.drawImage(l.img, l.x, l.y, l.width * l.scale, l.height * l.scale);
                }
            });

            applyTransparencyEffects(cCtx, safeWidth, safeHeight);

            let webpQuality = 0.8;
            if (globalQuality === 'high') webpQuality = 0.95;
            if (globalQuality === 'low') webpQuality = 0.6;

            const base64 = compCanvas.toDataURL('image/webp', webpQuality);
            const binary = atob(base64.split(',')[1]);
            const bytes = new Uint8Array(binary.length);
            for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
            
            frames.push({ data: bytes, duration: Math.round(1000 / fps) });
            
            setProgress(Math.floor(((i + 1) / totalFrames) * 80));
        }

        setExportPhase('جاري تجميع ملف WebP...');

        const chunks: Uint8Array[] = [];
        
        const vp8x = new Uint8Array(18);
        vp8x.set([0x56, 0x50, 0x38, 0x58], 0);
        vp8x.set([0x0A, 0x00, 0x00, 0x00], 4);
        vp8x[8] = 0x12;
        vp8x[12] = (safeWidth - 1) & 0xFF;
        vp8x[13] = ((safeWidth - 1) >> 8) & 0xFF;
        vp8x[14] = ((safeWidth - 1) >> 16) & 0xFF;
        vp8x[15] = (safeHeight - 1) & 0xFF;
        vp8x[16] = ((safeHeight - 1) >> 8) & 0xFF;
        vp8x[17] = ((safeHeight - 1) >> 16) & 0xFF;
        chunks.push(vp8x);

        const anim = new Uint8Array(14);
        anim.set([0x41, 0x4E, 0x49, 0x4D], 0);
        anim.set([0x06, 0x00, 0x00, 0x00], 4);
        anim.set([0, 0, 0, 0], 8);
        anim.set([0, 0], 12);
        chunks.push(anim);

        for (const frame of frames) {
            let offset = 12;
            const frameData = frame.data;
            const frameChunks: Uint8Array[] = [];
            
            while (offset < frameData.length) {
                const fourCC = String.fromCharCode(...frameData.slice(offset, offset + 4));
                const size = frameData[offset + 4] | (frameData[offset + 5] << 8) | (frameData[offset + 6] << 16) | (frameData[offset + 7] << 24);
                
                if (fourCC === 'VP8 ' || fourCC === 'VP8L' || fourCC === 'ALPH') {
                    const chunkHeader = frameData.slice(offset, offset + 8);
                    const chunkPayload = frameData.slice(offset + 8, offset + 8 + size);
                    const padding = (size % 2 !== 0) ? new Uint8Array([0]) : new Uint8Array(0);
                    
                    const fullChunk = new Uint8Array(chunkHeader.length + chunkPayload.length + padding.length);
                    fullChunk.set(chunkHeader);
                    fullChunk.set(chunkPayload, 8);
                    if (padding.length > 0) fullChunk.set(padding, 8 + size);
                    
                    frameChunks.push(fullChunk);
                }
                offset += 8 + size + (size % 2);
            }

            let payloadSize = 0;
            frameChunks.forEach(c => payloadSize += c.length);
            const anmfSize = 16 + payloadSize;
            
            const anmf = new Uint8Array(8 + 16);
            anmf.set([0x41, 0x4E, 0x4D, 0x46], 0);
            anmf.set([anmfSize & 0xFF, (anmfSize >> 8) & 0xFF, (anmfSize >> 16) & 0xFF, (anmfSize >> 24) & 0xFF], 4);
            
            anmf[8] = 0; anmf[9] = 0; anmf[10] = 0;
            anmf[11] = 0; anmf[12] = 0; anmf[13] = 0;
            
            const w = safeWidth - 1;
            const h = safeHeight - 1;
            anmf[14] = w & 0xFF; anmf[15] = (w >> 8) & 0xFF; anmf[16] = (w >> 16) & 0xFF;
            anmf[17] = h & 0xFF; anmf[18] = (h >> 8) & 0xFF; anmf[19] = (h >> 16) & 0xFF;
            
            const dur = frame.duration;
            anmf[20] = dur & 0xFF; anmf[21] = (dur >> 8) & 0xFF; anmf[22] = (dur >> 16) & 0xFF;
            
            anmf[23] = 0x01;

            chunks.push(anmf);
            frameChunks.forEach(c => chunks.push(c));
        }

        let totalSize = 4;
        chunks.forEach(c => totalSize += c.length);
        
        const riff = new Uint8Array(8);
        riff.set([0x52, 0x49, 0x46, 0x46], 0);
        riff.set([totalSize & 0xFF, (totalSize >> 8) & 0xFF, (totalSize >> 16) & 0xFF, (totalSize >> 24) & 0xFF], 4);
        
        const webpHeader = new Uint8Array(4);
        webpHeader.set([0x57, 0x45, 0x42, 0x50], 0);
        
        const finalBlob = new Blob([riff, webpHeader, ...chunks], { type: 'image/webp' });
        const url = URL.createObjectURL(finalBlob);
        
        setExportResult({
            url,
            filename: `${metadata.name.replace('.svga', '')}_Animated.webp`
        });

        setIsExporting(false);
        svgaInstance.stepToFrame(originalFrame, true);
        if (isPlaying) svgaInstance.startAnimation();

    } catch (e) {
        console.error(e);
        alert("فشل تصدير WebP: " + (e as any).message);
        setIsExporting(false);
    }
  };


  const handleExportAPNG = async () => {
    if (!svgaInstance || !playerRef.current) return;

    setIsExporting(true);
    setExportPhase('جاري إنشاء ملف APNG (Animation)...');

    try {
        svgaInstance.pauseAnimation();
        const originalFrame = currentFrame;
        const totalFrames = metadata.frames || 0;
        const fps = metadata.fps || 30;
        const canvas = playerRef.current.querySelector('canvas');
        if (!canvas) throw new Error("Canvas not found");

        const framesData: ArrayBuffer[] = [];
        const delays: number[] = [];
        const delay = Math.round(1000 / fps);

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

        for (let i = 0; i < totalFrames; i++) {
            svgaInstance.stepToFrame(i, true);
            await new Promise(r => setTimeout(r, 30));
            
            const currentCanvas = playerRef.current?.querySelector('canvas');
            if (currentCanvas && tCtx) {
                tCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
                tCtx.drawImage(currentCanvas, 0, 0);
                applyTransparencyEffects(tCtx, tempCanvas.width, tempCanvas.height);

                const imageData = tCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
                framesData.push(imageData.data.buffer);
                delays.push(delay);
            }
            setProgress(Math.floor(((i + 1) / totalFrames) * 80));
        }

        setExportPhase('جاري ضغط APNG...');
        
        // UPNG.encode(imgs, w, h, cnum, dels)
        let cnum = 0;
        if (globalQuality === 'medium') cnum = 256;
        if (globalQuality === 'low') cnum = 128;

        const apngBuffer = UPNG.encode(framesData, canvas.width, canvas.height, cnum, delays);
        
        const blob = new Blob([apngBuffer], { type: 'image/png' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${metadata.name.replace('.svga', '')}_Animation.png`;
        link.click();

        setIsExporting(false);
        svgaInstance.stepToFrame(originalFrame, true);
        if (isPlaying) svgaInstance.startAnimation();

    } catch (e) {
        console.error(e);
        alert("فشل تصدير APNG");
        setIsExporting(false);
    }
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        setAudioFile(file);
        const url = URL.createObjectURL(file);
        setAudioUrl(url);
        // Reset input value to allow re-uploading same file
        e.target.value = '';
    }
  };

  const handleDownloadFrame = async () => {
    if (!playerRef.current) return;

    // Helper to load image
    const loadImage = (src: string): Promise<HTMLImageElement> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => resolve(img);
            img.onerror = () => resolve(img);
            img.src = src;
        });
    };

    // Load assets
    let bgImg: HTMLImageElement | null = null;
    if (previewBg) bgImg = await loadImage(previewBg);
    
    let wmImg: HTMLImageElement | null = null;
    if (watermark) wmImg = await loadImage(watermark);

    const loadedLayers = await Promise.all(customLayers.map(async l => {
        const img = await loadImage(l.url);
        return { ...l, img };
    }));

    const safeWidth = videoWidth;
    const safeHeight = videoHeight;
    const compCanvas = document.createElement('canvas');
    compCanvas.width = safeWidth;
    compCanvas.height = safeHeight;
    const cCtx = compCanvas.getContext('2d');
    if (!cCtx) return;

    // 1. Background
    if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
        const bgW = (safeWidth * bgScale) / 100;
        const bgH = bgW * (bgImg.height / bgImg.width);
        const bgX = (safeWidth - bgW) * (bgPos.x / 100);
        const bgY = (safeHeight - bgH) * (bgPos.y / 100);
        cCtx.drawImage(bgImg, bgX, bgY, bgW, bgH);
    }

    // 2. Back Layers
    loadedLayers.filter(l => l.zIndexMode === 'back').forEach(l => {
        if (l.img.complete && l.img.naturalWidth > 0) {
            cCtx.drawImage(l.img, l.x, l.y, l.width * l.scale, l.height * l.scale);
        }
    });

    // 3. SVGA
    const currentCanvas = playerRef.current.querySelector('canvas');
    if (currentCanvas) {
        const cx = safeWidth / 2;
        const cy = safeHeight / 2;
        cCtx.save();
        cCtx.translate(cx + svgaPos.x, cy + svgaPos.y);
        cCtx.scale(svgaScale, svgaScale);
        cCtx.translate(-cx, -cy);
        cCtx.drawImage(currentCanvas, 0, 0);
        cCtx.restore();
    }

    // 4. Watermark
    if (wmImg && wmImg.complete && wmImg.naturalWidth > 0) {
        const wmW = safeWidth * wmScale;
        const wmH = wmW * (wmImg.height / wmImg.width);
        const wmX = (safeWidth - wmW) / 2 + wmPos.x;
        const wmY = (safeHeight - wmH) / 2 + wmPos.y;
        cCtx.globalAlpha = 0.7;
        cCtx.drawImage(wmImg, wmX, wmY, wmW, wmH);
        cCtx.globalAlpha = 1.0;
    }

    // 5. Front Layers
    loadedLayers.filter(l => l.zIndexMode === 'front').forEach(l => {
        if (l.img.complete && l.img.naturalWidth > 0) {
            cCtx.drawImage(l.img, l.x, l.y, l.width * l.scale, l.height * l.scale);
        }
    });

    const link = document.createElement('a');
    link.download = `${metadata.name.replace('.svga', '')}_frame_${currentFrame}.png`;
    link.href = compCanvas.toDataURL('image/png');
    link.click();
  };



  const handleExportStandardVideo = async () => {
    if (!currentUser) {
      onLoginRequired();
      return;
    }

    const { allowed, reason } = await checkAccess('Standard Video Export');
    if (!allowed) {
      if (reason === 'trial_ended') onSubscriptionRequired();
      return;
    }

    if (!svgaInstance || !playerRef.current) return;

    setIsExporting(true);
    setExportPhase('جاري تسجيل الفيديو (Frame-by-Frame)...');
    setShowRecordingModal(false);

    let audioContext: AudioContext | null = null;

    try {
        svgaInstance.pauseAnimation();
        const originalFrame = currentFrame;
        const totalFrames = metadata.frames || 0;
        const fps = metadata.fps || 30;
        
        if (totalFrames === 0) {
            alert("لا يمكن تسجيل الفيديو: عدد الإطارات غير صالح (0)");
            setIsExporting(false);
            return;
        }

        // Calculate target frames based on recordingDuration
        const targetFrames = Math.ceil((recordingDuration || (totalFrames / fps)) * fps);
        
        if (targetFrames <= 0) {
            alert("مدة التسجيل غير صالحة");
            setIsExporting(false);
            return;
        }

        // Ensure even dimensions
        const safeWidth = videoWidth % 2 === 0 ? videoWidth : videoWidth - 1;
        const safeHeight = videoHeight % 2 === 0 ? videoHeight : videoHeight - 1;

        // Composition Canvas
        const compCanvas = document.createElement('canvas');
        compCanvas.width = safeWidth;
        compCanvas.height = safeHeight;
        const cCtx = compCanvas.getContext('2d', { willReadFrequently: true });
        if (!cCtx) throw new Error("Failed to create Composition context");

        // Helper to load image
        const loadImage = (src: string): Promise<HTMLImageElement> => {
            return new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.onload = () => resolve(img);
                img.onerror = () => {
                    console.warn("Failed to load image for recording:", src);
                    resolve(img); // Resolve anyway to prevent hanging
                };
                img.src = src;
            });
        };

        // Preload Assets
        setExportPhase('تحضير الأصول والخلفيات...');
        const loadedLayers = await Promise.all(customLayers.map(async l => {
            const img = await loadImage(l.url);
            return { ...l, img };
        }));

        let bgImg: HTMLImageElement | null = null;
        if (previewBg) bgImg = await loadImage(previewBg);
        
        let wmImg: HTMLImageElement | null = null;
        if (watermark) wmImg = await loadImage(watermark);

        // Audio Setup
        let audioEncoder: AudioEncoder | null = null;
        let audioTrack: any = undefined;
        let audioDataChunks: AudioData[] = [];

        if (audioFile || audioUrl) {
            try {
                let arrayBuffer: ArrayBuffer | null = null;
                if (audioFile) {
                    arrayBuffer = await audioFile.arrayBuffer();
                } else if (audioUrl) {
                    const resp = await fetch(audioUrl);
                    arrayBuffer = await resp.arrayBuffer();
                }

                if (arrayBuffer && arrayBuffer.byteLength > 0) {
                    const offlineCtx = new OfflineAudioContext(2, 48000 * 1, 48000);
                    const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer);
                    
                    audioTrack = {
                        codec: recordingFormat === 'mp4' ? 'mp4a.40.2' : 'A_OPUS',
                        numberOfChannels: 2,
                        sampleRate: 48000
                    };

                    const numberOfChannels = 2;
                    const sampleRate = audioBuffer.sampleRate;
                    // Limit audio length to recordingDuration to prevent extra audio in export
                    const maxSamples = Math.floor(recordingDuration * sampleRate);
                    const length = Math.min(audioBuffer.length, maxSamples);
                    const planarBuffer = new Float32Array(length * numberOfChannels);
                    
                    for (let c = 0; c < numberOfChannels; c++) {
                        const channelData = audioBuffer.numberOfChannels > c 
                            ? audioBuffer.getChannelData(c) 
                            : audioBuffer.getChannelData(0);
                        planarBuffer.set(channelData.subarray(0, length), c * length);
                    }

                    const chunkSize = sampleRate;
                    for (let i = 0; i < length; i += chunkSize) {
                        const currentChunkSize = Math.min(chunkSize, length - i);
                        const chunkBuffer = new Float32Array(currentChunkSize * numberOfChannels);
                        for (let c = 0; c < numberOfChannels; c++) {
                            const start = c * length + i;
                            const end = start + currentChunkSize;
                            chunkBuffer.set(planarBuffer.subarray(start, end), c * currentChunkSize);
                        }
                        audioDataChunks.push(new AudioData({
                            format: 'f32-planar',
                            sampleRate: sampleRate,
                            numberOfFrames: currentChunkSize,
                            numberOfChannels: numberOfChannels,
                            timestamp: (i / sampleRate) * 1000000,
                            data: chunkBuffer
                        }));
                    }
                }
            } catch (e) {
                console.warn("Audio setup failed", e);
            }
        }

        const muxer = recordingFormat === 'mp4' 
            ? new Mp4Muxer.Muxer({
                target: new Mp4Muxer.ArrayBufferTarget(),
                video: {
                    codec: 'avc',
                    width: safeWidth,
                    height: safeHeight
                },
                audio: audioTrack ? {
                    codec: 'aac',
                    numberOfChannels: 2,
                    sampleRate: 48000
                } : undefined,
                fastStart: 'in-memory'
            })
            : new WebMMuxer.Muxer({
                target: new WebMMuxer.ArrayBufferTarget(),
                video: {
                    codec: 'V_VP9',
                    width: safeWidth,
                    height: safeHeight,
                    frameRate: fps,
                    alpha: false
                },
                audio: audioTrack
            });

        const videoEncoder = new VideoEncoder({
            output: (chunk: any, meta: any) => muxer.addVideoChunk(chunk, meta),
            error: (e: any) => console.error(e)
        });

        if (audioTrack) {
            audioEncoder = new AudioEncoder({
                output: (chunk: any, meta: any) => muxer.addAudioChunk(chunk, meta),
                error: (e: any) => console.error(e)
            });
            audioEncoder.configure({
                codec: recordingFormat === 'mp4' ? 'mp4a.40.2' : 'opus',
                numberOfChannels: 2,
                sampleRate: 48000,
                bitrate: 128000
            });
            for (const chunk of audioDataChunks) {
                audioEncoder.encode(chunk);
                chunk.close();
            }
            await audioEncoder.flush();
        }

        let bitrate = 8000000;
        if (globalQuality === 'high') bitrate = 15000000;
        if (globalQuality === 'low') bitrate = 4000000;

        const videoCodec = recordingFormat === 'mp4' 
            ? ((safeWidth * safeHeight) > 2228224 ? 'avc1.4d0033' : 'avc1.4d002a')
            : 'vp09.00.10.08';

        videoEncoder.configure({
            codec: videoCodec,
            width: safeWidth,
            height: safeHeight,
            bitrate: bitrate, 
            alpha: recordingFormat === 'mp4' ? undefined : 'discard'
        });

        setExportPhase('جاري تسجيل الإطارات (Rendering)...');

        for (let i = 0; i < targetFrames; i++) {
            // Use modulo to loop the animation
            const svgaFrameIndex = i % totalFrames;

            // Use false to prevent auto-play, ensuring we stay on the specific frame
            svgaInstance.stepToFrame(svgaFrameIndex, false);
            
            // Increased delay to 100ms to ensure frame is fully rendered and prevent stuttering/cutting
            // This is critical for ensuring the SVGA canvas is fully updated before capture
            await new Promise(r => setTimeout(r, 100));

            // Render Composition
            cCtx.clearRect(0, 0, safeWidth, safeHeight);

            // 1. Background
            if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
                const bgW = (safeWidth * bgScale) / 100;
                const bgH = bgW * (bgImg.height / bgImg.width);
                const bgX = (safeWidth - bgW) * (bgPos.x / 100);
                const bgY = (safeHeight - bgH) * (bgPos.y / 100);
                cCtx.drawImage(bgImg, bgX, bgY, bgW, bgH);
            }

            // 2. Back Layers
            loadedLayers.filter(l => l.zIndexMode === 'back').forEach(l => {
                if (l.img.complete && l.img.naturalWidth > 0) {
                    cCtx.drawImage(l.img, l.x, l.y, l.width * l.scale, l.height * l.scale);
                }
            });

            // 3. SVGA
            const currentSourceCanvas = playerRef.current?.querySelector('canvas');
            if (currentSourceCanvas) {
                const cx = safeWidth / 2;
                const cy = safeHeight / 2;
                cCtx.save();
                cCtx.translate(cx + svgaPos.x, cy + svgaPos.y);
                cCtx.scale(svgaScale, svgaScale);
                cCtx.translate(-cx, -cy);
                cCtx.drawImage(currentSourceCanvas, 0, 0);
                cCtx.restore();
            }

            // 4. Watermark
            if (wmImg && wmImg.complete && wmImg.naturalWidth > 0) {
                const wmW = safeWidth * wmScale;
                const wmH = wmW * (wmImg.height / wmImg.width);
                const wmX = (safeWidth - wmW) / 2 + wmPos.x;
                const wmY = (safeHeight - wmH) / 2 + wmPos.y;
                cCtx.globalAlpha = 0.7;
                cCtx.drawImage(wmImg, wmX, wmY, wmW, wmH);
                cCtx.globalAlpha = 1.0;
            }

            // 5. Front Layers
            loadedLayers.filter(l => l.zIndexMode === 'front').forEach(l => {
                if (l.img.complete && l.img.naturalWidth > 0) {
                    cCtx.drawImage(l.img, l.x, l.y, l.width * l.scale, l.height * l.scale);
                }
            });

            const bitmap = await createImageBitmap(compCanvas);
            const frame = new VideoFrame(bitmap, { timestamp: (i * 1000000) / fps });
            videoEncoder.encode(frame, { keyFrame: i % 30 === 0 });
            frame.close();
            bitmap.close();

            setProgress(Math.floor(((i + 1) / targetFrames) * 100));
        }

        await videoEncoder.flush();
        muxer.finalize();

        const buffer = muxer.target.buffer;
        const mimeType = recordingFormat === 'mp4' ? 'video/mp4' : 'video/webm';
        const extension = recordingFormat === 'mp4' ? 'mp4' : 'webm';
        const blob = new Blob([buffer], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${metadata.name.replace('.svga', '')}_Recording.${extension}`;
        a.click();

        svgaInstance.stepToFrame(originalFrame, true);
        if (isPlaying) svgaInstance.startAnimation();

    } catch (e) {
        console.error(e);
        alert("فشل التسجيل: " + (e as any).message);
    } finally {
        setIsExporting(false);
        setProgress(0);
    }
  };

  const [showRecordingModal, setShowRecordingModal] = useState(false);
  const [recordingFormat, setRecordingFormat] = useState<'webm' | 'mp4'>('mp4');

  const handleReplaceSvgaFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Reset input value so same file can be selected again
    e.target.value = '';

    // Clear previous audio state immediately
    setAudioUrl(null);
    setOriginalAudioUrl(null);
    setAudioFile(null);

    try {
        const arrayBuffer = await file.arrayBuffer();
        const parser = new SVGA.Parser();
        
        parser.load(URL.createObjectURL(new Blob([arrayBuffer])), (videoItem: any) => {
            let extractedFps = videoItem.FPS || videoItem.fps || 30;
            if (typeof extractedFps === 'string') extractedFps = parseFloat(extractedFps);
            if (!extractedFps || extractedFps <= 0) extractedFps = 30;

            const newMeta: FileMetadata = {
                name: file.name,
                size: file.size,
                type: 'SVGA',
                dimensions: { width: videoItem.videoSize.width, height: videoItem.videoSize.height },
                fps: extractedFps,
                frames: videoItem.frames,
                assets: [],
                videoItem: videoItem,
                fileUrl: URL.createObjectURL(new Blob([arrayBuffer])),
                originalFile: file
            };

            if (onFileReplace) {
                onFileReplace(newMeta);
            } else {
                setMetadata(newMeta);
                setCustomDimensions(null);
                setCurrentFrame(0);
            }
            
        }, (err: Error) => {
            console.error(err);
            alert("ملف SVGA غير صالح");
        });
    } catch (error) {
        console.error("Error reading file:", error);
        alert("حدث خطأ أثناء قراءة الملف");
    }
  };

  const calculateChecksum = async (buffer: ArrayBuffer): Promise<string> => {
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const handleVAP105Export = async (fromMain = false) => {
    if (!currentUser) {
        onLoginRequired();
        return;
    }

    const hasActiveSubscription = currentUser.subscriptionType && currentUser.subscriptionType !== 'none';
    const hasSpecificPermission = currentUser.allowedExportFormat && 
        (Array.isArray(currentUser.allowedExportFormat) 
            ? currentUser.allowedExportFormat.includes('VAP 1.0.5') 
            : currentUser.allowedExportFormat === 'VAP 1.0.5');

    const isAllowed = hasActiveSubscription || hasSpecificPermission;

    if (!isAllowed) {
        onSubscriptionRequired();
        return;
    }

    if (!metadata.videoItem) return;

    if (!fromMain) {
         logActivity(currentUser, 'export', `Exported ${metadata.name} as VAP 1.0.5`, 'VAP 1.0.5');
    }
    
    setIsExporting(true);
    setExportPhase('جاري تحضير VAP 1.0.5...');

    try {
        const { message, imagesData } = await getProcessedSVGAData();
        const width = message.params?.viewBoxWidth || metadata.dimensions?.width || 750;
        const height = message.params?.viewBoxHeight || metadata.dimensions?.height || 750;
        const fps = message.params?.fps || metadata.fps || 30;
        const totalFrames = message.params?.frames || metadata.frames || 0;
        
        // VAP Layout Calculation (Based on user request)
        const gap = 4;
        const alphaWidth = Math.floor(width / 2);
        const alphaHeight = Math.floor(height / 2);
        
        // Align to 16px
        const videoW = Math.ceil((width + gap + alphaWidth) / 16) * 16;
        const videoH = Math.ceil(height / 16) * 16;
        
        const canvas = document.createElement('canvas');
        canvas.width = videoW;
        canvas.height = videoH;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        
        if (!ctx) throw new Error("Canvas context not supported");

        // Calculate Video Duration
        const videoDuration = totalFrames / fps;
        const maxAudioDuration = videoDuration;

        // Audio Setup
        let audioEncoder: AudioEncoder | null = null;
        let audioTrack: any = undefined;
        let audioDataChunks: AudioData[] = [];

        // Try to process audio first
        if (audioFile || audioUrl) {
            try {
                let arrayBuffer: ArrayBuffer | null = null;
                if (audioFile) {
                    arrayBuffer = await audioFile.arrayBuffer();
                } else if (audioUrl) {
                    const resp = await fetch(audioUrl);
                    arrayBuffer = await resp.arrayBuffer();
                }

                if (arrayBuffer && arrayBuffer.byteLength > 0) {
                    const offlineCtx = new OfflineAudioContext(2, 48000 * 1, 48000); 
                    const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer);
                    
                    audioTrack = {
                        codec: 'mp4a.40.2',
                        numberOfChannels: 2,
                        sampleRate: 48000
                    };

                    const numberOfChannels = 2;
                    const sampleRate = audioBuffer.sampleRate;
                    const maxSamples = Math.floor(maxAudioDuration * sampleRate);
                    const length = Math.min(audioBuffer.length, maxSamples);
                    const planarBuffer = new Float32Array(length * numberOfChannels);
                    
                    for (let c = 0; c < numberOfChannels; c++) {
                        const channelData = audioBuffer.numberOfChannels > c ? audioBuffer.getChannelData(c) : audioBuffer.getChannelData(0);
                        planarBuffer.set(channelData.subarray(0, length), c * length);
                    }

                    const chunkSize = sampleRate;
                    for (let i = 0; i < length; i += chunkSize) {
                        const currentChunkSize = Math.min(chunkSize, length - i);
                        const chunkBuffer = new Float32Array(currentChunkSize * numberOfChannels);
                        for (let c = 0; c < numberOfChannels; c++) {
                            const start = c * length + i;
                            const end = start + currentChunkSize;
                            chunkBuffer.set(planarBuffer.subarray(start, end), c * currentChunkSize);
                        }
                        audioDataChunks.push(new AudioData({
                            format: 'f32-planar',
                            sampleRate: sampleRate,
                            numberOfFrames: currentChunkSize,
                            numberOfChannels: numberOfChannels,
                            timestamp: (i / sampleRate) * 1000000,
                            data: chunkBuffer
                        }));
                    }
                }
            } catch (audioError) {
                console.warn("Audio processing failed, continuing without audio:", audioError);
                audioTrack = undefined;
                audioDataChunks = [];
            }
        }

        // Mp4Muxer Setup
        const muxer = new Mp4Muxer.Muxer({
            target: new Mp4Muxer.ArrayBufferTarget(),
            video: {
                codec: 'avc',
                width: videoW,
                height: videoH
            },
            audio: audioTrack ? {
                codec: 'aac',
                numberOfChannels: 2,
                sampleRate: 48000
            } : undefined,
            fastStart: 'in-memory'
        });

        let hasEncoderError = false;
        const videoEncoder = new VideoEncoder({
            output: (chunk: any, meta: any) => muxer.addVideoChunk(chunk, meta),
            error: (e: any) => {
                console.error("VideoEncoder error:", e);
                hasEncoderError = true;
            }
        });

        if (audioTrack) {
             audioEncoder = new AudioEncoder({
                output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
                error: (e) => console.error("AudioEncoder error:", e)
            });

            audioEncoder.configure({
                codec: 'mp4a.40.2',
                numberOfChannels: 2,
                sampleRate: 48000,
                bitrate: 128000
            });

            for (const chunk of audioDataChunks) {
                audioEncoder.encode(chunk);
                chunk.close();
            }
            await audioEncoder.flush();
        }

        // Calculate total pixels to determine appropriate AVC level
        const totalPixels = videoW * videoH;
        // Level 4.2 limit is roughly 2,228,224 pixels (8704 macroblocks * 256)
        // If higher, use Level 5.1 (avc1.4d0033) which supports up to ~9.4MP (4K)
        // Hex 33 = Decimal 51 (Level 5.1)
        const codec = totalPixels > 2228224 ? 'avc1.4d0033' : 'avc1.4d002a';

        let bitrate = 8000000;
        if (globalQuality === 'low') bitrate = 2000000;
        if (globalQuality === 'medium') bitrate = 5000000;
        if (globalQuality === 'high') bitrate = 12000000;

        videoEncoder.configure({
            codec: codec,
            width: videoW,
            height: videoH,
            bitrate: bitrate,
            framerate: fps
        });

        // Preload Images
        const images: Record<string, HTMLImageElement> = {};
        const loadImage = (src: string): Promise<HTMLImageElement> => {
            return new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.onload = () => resolve(img);
                img.onerror = () => resolve(img);
                img.src = src;
            });
        };

        const uniqueKeys = Object.keys(imagesData);
        for (const key of uniqueKeys) {
            const uint8Array = imagesData[key];
            if (uint8Array) {
                let mimeType = 'image/png';
                if (uint8Array[0] === 0xFF && uint8Array[1] === 0xD8) mimeType = 'image/jpeg';
                const blob = new Blob([uint8Array], { type: mimeType });
                const url = URL.createObjectURL(blob);
                images[key] = await loadImage(url);
                URL.revokeObjectURL(url);
            }
        }

        // Render Loop
        const frameDuration = 1000000 / fps; // Microseconds
        
        for (let i = 0; i < totalFrames; i++) {
            setExportPhase(`جاري معالجة الإطار ${i + 1}/${totalFrames}`);
            
            ctx.clearRect(0, 0, videoW, videoH);
            
            // 1. Draw RGB Frame at (0,0)
            const sprites = message.sprites || [];
            
            const frameCanvas = document.createElement('canvas');
            frameCanvas.width = width;
            frameCanvas.height = height;
            const fCtx = frameCanvas.getContext('2d');
            
            if (fCtx) {
                for (const sprite of sprites) {
                    const frame = sprite.frames[i];
                    if (!frame || frame.alpha <= 0.01) continue;
                    
                    const img = images[sprite.imageKey];
                    if (!img) continue;
                    
                    const t = frame.transform || { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
                    const l = frame.layout || { x: 0, y: 0, width: img.width, height: img.height };
                    
                    fCtx.save();
                    fCtx.globalAlpha = frame.alpha;
                    if (frame.blendMode) fCtx.globalCompositeOperation = frame.blendMode;
                    
                    fCtx.transform(t.a, t.b, t.c, t.d, t.tx, t.ty);
                    fCtx.drawImage(img, l.x, l.y, l.width, l.height);
                    fCtx.restore();
                }
                
                // Draw RGB to main canvas
                ctx.drawImage(frameCanvas, 0, 0);
                
                // 2. Extract Alpha and Draw
                const frameData = fCtx.getImageData(0, 0, width, height);
                const alphaCanvas = document.createElement('canvas');
                alphaCanvas.width = width;
                alphaCanvas.height = height;
                const aCtx = alphaCanvas.getContext('2d');
                
                if (aCtx) {
                    const alphaImageData = aCtx.createImageData(width, height);
                    const d = frameData.data;
                    const ad = alphaImageData.data;
                    for (let p = 0; p < d.length; p += 4) {
                        const a = d[p + 3];
                        ad[p] = a;     // R
                        ad[p + 1] = a; // G
                        ad[p + 2] = a; // B
                        ad[p + 3] = 255; // Alpha
                    }
                    aCtx.putImageData(alphaImageData, 0, 0);
                    
                    // Draw scaled alpha to main canvas
                    ctx.drawImage(alphaCanvas, width + gap, 0, alphaWidth, alphaHeight);
                }
            }

            // Create VideoFrame
            if (hasEncoderError) throw new Error("Video encoding failed");
            const videoFrame = new VideoFrame(canvas, { timestamp: i * frameDuration });
            videoEncoder.encode(videoFrame, { keyFrame: i % 30 === 0 });
            videoFrame.close();
            
            // Yield to UI
            await new Promise(r => setTimeout(r, 0));
        }
        
        await videoEncoder.flush();
        muxer.finalize();
        
        // Generate JSON Config
        const jsonConfig = {
            info: {
                v: 2,
                f: totalFrames,
                w: width,
                h: height,
                fps: fps,
                videoW: videoW,
                videoH: videoH,
                aFrame: [width + gap, 0, alphaWidth, alphaHeight],
                rgbFrame: [0, 0, width, height],
                isVapx: 0,
                codeTag: ["common"],
                orien: 0
            }
        };

        const jsonStr = JSON.stringify(jsonConfig);
        
        // Create vapc box
        const jsonBytes = new TextEncoder().encode(jsonStr);
        const boxSize = 8 + jsonBytes.length;
        const boxBuffer = new Uint8Array(boxSize);
        const view = new DataView(boxBuffer.buffer);
        
        view.setUint32(0, boxSize);
        view.setUint8(4, 0x76); // v
        view.setUint8(5, 0x61); // a
        view.setUint8(6, 0x70); // p
        view.setUint8(7, 0x63); // c
        
        boxBuffer.set(jsonBytes, 8);
        
        // Combine buffers (Append vapc box to the end of the file)
        const muxerBuffer = muxer.target.buffer;
        const finalBuffer = new Uint8Array(muxerBuffer.byteLength + boxSize);
        finalBuffer.set(new Uint8Array(muxerBuffer), 0);
        finalBuffer.set(boxBuffer, muxerBuffer.byteLength);
        
        const buffer = finalBuffer.buffer;
        const checksum = await calculateChecksum(buffer);
        
        // Download Files
        const timestamp = new Date().getTime();
        const baseName = `vap_export_${timestamp}`;
        
        // 1. Video (with embedded vapc)
        const videoBlob = new Blob([buffer], { type: 'video/mp4' });
        const videoUrl = URL.createObjectURL(videoBlob);
        const videoLink = document.createElement('a');
        videoLink.href = videoUrl;
        videoLink.download = `${baseName}.mp4`;
        videoLink.click();
        
        // 3. Checksum (SHA-256)
        const checksumBlob = new Blob([checksum], { type: 'text/plain' });
        const checksumUrl = URL.createObjectURL(checksumBlob);
        const checksumLink = document.createElement('a');
        checksumLink.href = checksumUrl;
        checksumLink.download = `${baseName}.sha256`;
        checksumLink.click();

        alert("تم تصدير ملفات VAP 1.0.5 بنجاح!");

    } catch (e) {
        console.error(e);
        alert("حدث خطأ أثناء تصدير VAP: " + (e as any).message);
    } finally {
        setIsExporting(false);
    }
  };

  // Enforce Allowed Format
  useEffect(() => {
    if (currentUser?.allowedExportFormat) {
        const allowed = Array.isArray(currentUser.allowedExportFormat) 
            ? currentUser.allowedExportFormat 
            : [currentUser.allowedExportFormat];
        
        if (!allowed.includes(selectedFormat)) {
             setSelectedFormat(allowed[0] || 'AE Project');
        }
    }
  }, [currentUser, selectedFormat]);

  const availableFormats = ['AE Project', 'SVGA 2.0 EX', 'SVGA 2.0', 'Image Sequence', 'GIF (Animation)', 'APNG (Animation)', 'WebM (Video)', 'WebP (Animated)', 'VAP (MP4)', 'VAP 1.0.5'];
  
  const displayedFormats = useMemo(() => {
      // If we are in EX mode, only show SVGA 2.0 EX
      if (mode === 'ex') return ['SVGA 2.0 EX'];

      if (!currentUser?.allowedExportFormat) return availableFormats.filter(f => !hiddenFormats.includes(f));
      const allowed = Array.isArray(currentUser.allowedExportFormat) 
          ? currentUser.allowedExportFormat 
          : [currentUser.allowedExportFormat];
      
      // Always show SVGA 2.0 and SVGA 2.0 EX if enabled globally, even if not in allowed formats
      return availableFormats.filter(f => (allowed.includes(f) || (f === 'SVGA 2.0' && settings?.isSvgaExEnabled) || (f === 'SVGA 2.0 EX')) && !hiddenFormats.includes(f));
  }, [currentUser, availableFormats, hiddenFormats, mode, settings?.isSvgaExEnabled]);

  useEffect(() => {
      if (!displayedFormats.includes(selectedFormat) && displayedFormats.length > 0) {
          setSelectedFormat(displayedFormats[0]);
      }
  }, [displayedFormats, selectedFormat]);

  const handleMainExport = async (formatOverride?: string | any) => {
    const currentFormat = (typeof formatOverride === 'string' && formatOverride) ? formatOverride : selectedFormat;

    if (!currentUser) {
      onLoginRequired();
      return;
    }

    // Special handling for VAP 1.0.5 - Handled separately to enforce subscription/permission without consuming free attempts
    if (currentFormat === 'VAP 1.0.5') {
        await handleVAP105Export(false);
        return;
    }

    const { allowed, reason } = await checkAccess('Main Export');
    if (!allowed) {
      if (reason === 'trial_ended') onSubscriptionRequired();
      return;
    }

    // Enforce restriction check again
    let isAllowed = !currentUser.allowedExportFormat || 
        (Array.isArray(currentUser.allowedExportFormat) 
            ? currentUser.allowedExportFormat.includes(currentFormat) 
            : currentUser.allowedExportFormat === currentFormat);

    if (!isAllowed) {
         alert(`عذراً، حسابك غير مصرح له بتصدير صيغة ${currentFormat}.`);
         return;
    }

    // Log Activity
    logActivity(currentUser, 'export', `Exported ${metadata.name}`, currentFormat);

    if (currentFormat === 'AE Project') await handleExportAEProject();
    else if (currentFormat === 'SVGA 2.0 EX') {
        await handleSvgaExExport({
            metadata, videoWidth, videoHeight, exportScale, svgaScale, svgaPos,
            layerImages, assetColors, assetColorModes, deletedKeys, customLayers, watermark,
            wmScale, wmPos, audioUrl, audioFile, originalAudioUrl, fadeConfig,
            applyTransparencyEffects, setProgress, setExportPhase, setIsExporting,
            protobuf, globalQuality
        });
    }
    else if (currentFormat === 'Image Sequence') await handleExportImageSequence();
    else if (currentFormat === 'GIF (Animation)') await handleExportGIF();
    else if (currentFormat === 'APNG (Animation)') await handleExportAPNG();
    else if (currentFormat === 'WebM (Video)') await handleExportWebM();
    else if (currentFormat === 'VAP (MP4)') {
        setIsExporting(true);
        setExportPhase('جاري إنشاء فيديو VAP (Alpha+RGB)...');

        let audioContext: AudioContext | null = null;

        try {
            if (!svgaInstance || !playerRef.current) throw new Error("Player not ready");
            
            svgaInstance.pauseAnimation();
            const originalFrame = currentFrame;
            // Use the actual FPS from the SVGA file if available to prevent frame mismatch/stuttering
            const fps = metadata.fps || svgaInstance.videoItem?.FPS || 30;
            const originalTotalFrames = svgaInstance.videoItem?.frames || metadata.frames || 0;
            // Use recordingDuration if specified, otherwise fallback to original duration
            const totalFrames = Math.ceil(recordingDuration * fps) || originalTotalFrames;
            
            // Ensure even dimensions for video encoding
            const safeWidth = videoWidth % 2 === 0 ? videoWidth : videoWidth - 1;
            const safeHeight = videoHeight % 2 === 0 ? videoHeight : videoHeight - 1;
            
            // VAP Canvas (2x Width)
            const vapWidth = safeWidth * 2;
            const vapHeight = safeHeight;
            
            const vapCanvas = document.createElement('canvas');
            vapCanvas.width = vapWidth;
            vapCanvas.height = vapHeight;
            const vCtx = vapCanvas.getContext('2d', { willReadFrequently: true });
            
            if (!vCtx) throw new Error("Failed to create VAP context");

            // Composition Canvas (for stacking layers)
            const compCanvas = document.createElement('canvas');
            compCanvas.width = safeWidth;
            compCanvas.height = safeHeight;
            const cCtx = compCanvas.getContext('2d', { willReadFrequently: true });
            if (!cCtx) throw new Error("Failed to create Composition context");

            // Helper to load image with crossOrigin
            const loadImage = (src: string): Promise<HTMLImageElement> => {
                return new Promise((resolve) => {
                    const img = new Image();
                    img.crossOrigin = "anonymous";
                    img.onload = () => resolve(img);
                    img.onerror = () => {
                         console.warn(`Failed to load image: ${src}`);
                         resolve(img); 
                    };
                    img.src = src;
                });
            };

            // Preload Assets
            const loadedLayers = await Promise.all(customLayers.map(async l => {
                const img = await loadImage(l.url);
                return { ...l, img };
            }));

            let bgImg: HTMLImageElement | null = null;
            if (previewBg) {
                bgImg = await loadImage(previewBg);
            }
            
            let wmImg: HTMLImageElement | null = null;
            if (watermark) {
                wmImg = await loadImage(watermark);
            }

            // Calculate Video Duration
            const videoDuration = totalFrames / fps;
            const maxAudioDuration = videoDuration; // Sync audio with video

            // Audio Setup
            let audioEncoder: AudioEncoder | null = null;
            let audioTrack: any = undefined;
            let audioDataChunks: AudioData[] = [];

            // Try to process audio first
            if (audioFile || audioUrl) {
                try {
                    let arrayBuffer: ArrayBuffer | null = null;
                    if (audioFile) {
                        arrayBuffer = await audioFile.arrayBuffer();
                    } else if (audioUrl) {
                        const resp = await fetch(audioUrl);
                        arrayBuffer = await resp.arrayBuffer();
                    }

                    if (arrayBuffer && arrayBuffer.byteLength > 0) {
                        // Use OfflineAudioContext for more stable decoding
                        const offlineCtx = new OfflineAudioContext(2, 48000 * 1, 48000); 
                        const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer);
                        
                        // If successful, we have audio. Prepare for encoding.
                        audioTrack = {
                            codec: 'A_OPUS',
                            numberOfChannels: 2,
                            sampleRate: 48000
                        };

                        // Prepare Audio Data Chunks
                        const numberOfChannels = 2;
                        const sampleRate = audioBuffer.sampleRate;
                        
                        // Calculate max samples based on video duration
                        const maxSamples = Math.floor(maxAudioDuration * sampleRate);
                        const length = Math.min(audioBuffer.length, maxSamples);
                        
                        const planarBuffer = new Float32Array(length * numberOfChannels);
                        
                        for (let c = 0; c < numberOfChannels; c++) {
                            const channelData = audioBuffer.numberOfChannels > c 
                                ? audioBuffer.getChannelData(c) 
                                : audioBuffer.getChannelData(0);
                            // Only copy up to 'length'
                            planarBuffer.set(channelData.subarray(0, length), c * length);
                        }

                        const chunkSize = sampleRate; // 1 second chunks
                        for (let i = 0; i < length; i += chunkSize) {
                            const currentChunkSize = Math.min(chunkSize, length - i);
                            const chunkBuffer = new Float32Array(currentChunkSize * numberOfChannels);
                            for (let c = 0; c < numberOfChannels; c++) {
                                const start = c * length + i;
                                const end = start + currentChunkSize;
                                chunkBuffer.set(planarBuffer.subarray(start, end), c * currentChunkSize);
                            }
                            audioDataChunks.push(new AudioData({
                                format: 'f32-planar',
                                sampleRate: sampleRate,
                                numberOfFrames: currentChunkSize,
                                numberOfChannels: numberOfChannels,
                                timestamp: (i / sampleRate) * 1000000,
                                data: chunkBuffer
                            }));
                        }
                    }
                } catch (audioError) {
                    console.warn("Audio processing failed, continuing without audio:", audioError);
                    audioTrack = undefined;
                    audioDataChunks = [];
                }
            }

            // Use Mp4Muxer for true MP4 (H.264) support to avoid stuttering
            const muxer = new Mp4Muxer.Muxer({
                target: new Mp4Muxer.ArrayBufferTarget(),
                video: {
                    codec: 'avc', // H.264
                    width: vapWidth,
                    height: vapHeight,
                    frameRate: fps
                },
                audio: audioTrack ? {
                    codec: 'aac',
                    numberOfChannels: 2,
                    sampleRate: 48000
                } : undefined,
                fastStart: 'in-memory' // Optimize for streaming/playback
            });

            const videoEncoder = new VideoEncoder({
                output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
                error: (e) => console.error("VideoEncoder error:", e)
            });

            // Configure Audio Encoder if we have audio track
            if (audioTrack) {
                 audioEncoder = new AudioEncoder({
                    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
                    error: (e) => console.error("AudioEncoder error:", e)
                });

                audioEncoder.configure({
                    codec: 'mp4a.40.2', // AAC
                    numberOfChannels: 2,
                    sampleRate: 48000,
                    bitrate: 128000
                });

                // Encode all prepared chunks
                for (const chunk of audioDataChunks) {
                    audioEncoder.encode(chunk);
                    chunk.close();
                }
                await audioEncoder.flush();
            }

            // VAP Export Optimization
            // 1. Bitrate: Increased significantly to prevent frame dropping/macroblocking at low settings.
            //    VAP is double-width, so it needs roughly 2x the bitrate of a normal video.
            let bitrate = 12000000; // 12 Mbps (High)
            if (globalQuality === 'medium') bitrate = 8000000; // 8 Mbps
            if (globalQuality === 'low') bitrate = 5000000; // 5 Mbps (Minimum safe for smooth playback)

            // 2. Codec Config: Use H.264 (AVC) with specific profile for mobile compatibility
            const videoConfig: VideoEncoderConfig = {
                codec: 'avc1.4d0028', // Main Profile Level 4.0 (Widely supported, good quality)
                width: vapWidth,
                height: vapHeight,
                bitrate: bitrate,
                framerate: fps,
                latencyMode: 'quality', // Prioritize quality/smoothness over encoding speed
                avc: { format: 'avc' }
            };

            // Check support and fallback if needed
            const support = await VideoEncoder.isConfigSupported(videoConfig);
            if (!support.supported) {
                console.warn("H.264 Main Profile not supported, falling back to Baseline");
                videoConfig.codec = 'avc1.42001E'; // Baseline
            }

            videoEncoder.configure(videoConfig);

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = safeWidth;
            tempCanvas.height = safeHeight;
            const tCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

            // Frame Duration in Microseconds
            const frameDurationMicros = Math.round(1000000 / fps);

            for (let i = 0; i < totalFrames; i++) {
                // Use modulo to loop the animation if totalFrames > originalTotalFrames
                svgaInstance.stepToFrame(i % originalTotalFrames, true);
                
                // Wait for frame rendering - use requestAnimationFrame to sync with paint if possible, 
                // but here we use a small delay to allow SVGA to draw.
                await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); // Wait for 2 frames
                await new Promise(r => setTimeout(r, 50)); // And a safety buffer

                // Manage Encoder Queue - Keep it fed but not overflowing
                if (videoEncoder.encodeQueueSize > 2) { 
                    await videoEncoder.flush();
                }

                // --- COMPOSITION START ---
                cCtx.clearRect(0, 0, safeWidth, safeHeight);
                vCtx?.clearRect(0, 0, vapWidth, vapHeight);

                // 1. Background
                if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
                    const bgW = (safeWidth * bgScale) / 100;
                    const bgH = bgW * (bgImg.height / bgImg.width);
                    const bgX = (safeWidth - bgW) * (bgPos.x / 100);
                    const bgY = (safeHeight - bgH) * (bgPos.y / 100);
                    cCtx.drawImage(bgImg, bgX, bgY, bgW, bgH);
                }

                // 2. Back Layers
                loadedLayers.filter(l => l.zIndexMode === 'back').forEach(l => {
                    if (l.img.complete && l.img.naturalWidth > 0) {
                        cCtx.drawImage(l.img, l.x, l.y, l.width * l.scale, l.height * l.scale);
                    }
                });

                // 3. SVGA Frame
                const currentSourceCanvas = playerRef.current?.querySelector('canvas');
                if (currentSourceCanvas) {
                    const cx = safeWidth / 2;
                    const cy = safeHeight / 2;
                    cCtx.save();
                    cCtx.translate(cx + svgaPos.x, cy + svgaPos.y);
                    cCtx.scale(svgaScale, svgaScale);
                    cCtx.translate(-cx, -cy);
                    cCtx.drawImage(currentSourceCanvas, 0, 0);
                    cCtx.restore();
                }

                // 4. Watermark
                if (wmImg && wmImg.complete && wmImg.naturalWidth > 0) {
                    const wmW = safeWidth * wmScale;
                    const wmH = wmW * (wmImg.height / wmImg.width);
                    const wmX = (safeWidth - wmW) / 2 + wmPos.x;
                    const wmY = (safeHeight - wmH) / 2 + wmPos.y;
                    cCtx.globalAlpha = 0.7;
                    cCtx.drawImage(wmImg, wmX, wmY, wmW, wmH);
                    cCtx.globalAlpha = 1.0;
                }

                // 5. Front Layers
                loadedLayers.filter(l => l.zIndexMode === 'front').forEach(l => {
                    if (l.img.complete && l.img.naturalWidth > 0) {
                        cCtx.drawImage(l.img, l.x, l.y, l.width * l.scale, l.height * l.scale);
                    }
                });
                // --- COMPOSITION END ---

                // Prepare VAP Frame
                vCtx.fillStyle = '#000000';
                vCtx.fillRect(0, 0, vapWidth, vapHeight);

                // Draw RGB (Right Side)
                vCtx.drawImage(compCanvas, safeWidth, 0);

                // Draw Alpha (Left Side)
                if (tCtx) {
                    tCtx.clearRect(0, 0, safeWidth, safeHeight);
                    tCtx.drawImage(compCanvas, 0, 0);
                    
                    applyTransparencyEffects(tCtx, safeWidth, safeHeight);

                    const imageData = tCtx.getImageData(0, 0, safeWidth, safeHeight);
                    const data = imageData.data;
                    
                    for (let j = 0; j < data.length; j += 4) {
                        const alpha = data[j + 3];
                        data[j] = alpha;     // R
                        data[j + 1] = alpha; // G
                        data[j + 2] = alpha; // B
                        data[j + 3] = 255;   // Full Opaque
                    }
                    tCtx.putImageData(imageData, 0, 0);
                    vCtx.drawImage(tempCanvas, 0, 0);
                }
                
                const bitmap = await createImageBitmap(vapCanvas);
                
                // Precise Timestamping
                const timestamp = i * frameDurationMicros;
                
                const frame = new VideoFrame(bitmap, { 
                    timestamp: timestamp, 
                    duration: frameDurationMicros 
                });
                
                // Keyframe Strategy:
                // Force a keyframe at the start (0) and then every 1 second (fps).
                // This ensures seekability and recovery from errors without bloating size too much.
                const isKeyFrame = i === 0 || (i % fps === 0);

                videoEncoder.encode(frame, { keyFrame: isKeyFrame });
                frame.close();
                bitmap.close();

                setProgress(Math.floor(((i + 1) / totalFrames) * 100));
            }

            await videoEncoder.flush();
            muxer.finalize();

            const buffer = muxer.target.buffer;
            const blob = new Blob([buffer], { type: 'video/mp4' });
            const url = URL.createObjectURL(blob);
            
            setExportedVapUrl(url);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `${metadata.name.replace('.svga', '')}_VAP.mp4`;
            a.click();
            
            svgaInstance.stepToFrame(originalFrame, true);
            if (isPlaying) svgaInstance.startAnimation();
            setIsExporting(false);
            setProgress(0);

        } catch (e) {
            console.error(e);
            alert("فشل تصدير VAP: " + (e as any).message);
            setIsExporting(false);
        } finally {
            if (audioContext) {
                await audioContext.close();
            }
        }
    }
    else if (currentFormat === 'WebP (Animated)') {
        await handleExportWebP();
    }
    else if (currentFormat === 'SVGA 2.0' && typeof protobuf !== 'undefined') {
        const isEdgeFadeActive = fadeConfig.top > 0 || fadeConfig.bottom > 0 || fadeConfig.left > 0 || fadeConfig.right > 0;

        setIsExporting(true); 
        setExportPhase(isEdgeFadeActive ? 'جاري تطبيق الشفافية على الصور (Baking)...' : 'جاري ضغط الصور وإعادة بناء ملف SVGA...');
        
        try {
            if (metadata.type === 'SVGA') {
                let buffer: ArrayBuffer;
                if (metadata.originalFile) {
                    buffer = await metadata.originalFile.arrayBuffer();
                } else if (metadata.fileUrl) {
                    const res = await fetch(metadata.fileUrl);
                    buffer = await res.arrayBuffer();
                } else {
                    throw new Error("No original file available.");
                }

                const uint8Array = new Uint8Array(buffer);
                const isZip = uint8Array[0] === 0x50 && uint8Array[1] === 0x4B && uint8Array[2] === 0x03 && uint8Array[3] === 0x04;

                const root = protobuf.parse(svgaSchema).root;
                const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");
                
                let message: any;

                if (isZip) {
                    const JSZip = (window as any).JSZip;
                    if (!JSZip) throw new Error("JSZip not loaded");
                    const zip = await JSZip.loadAsync(buffer);
                    const binaryFile = zip.file("movie.binary");
                    if (!binaryFile) {
                        throw new Error("Invalid SVGA 1.0 file: movie.binary not found.");
                    }
                    const binaryData = await binaryFile.async("uint8array");
                    message = MovieEntity.decode(binaryData);
                    
                    message.images = message.images || {};
                    for (const filename of Object.keys(zip.files)) {
                        if (filename.endsWith('.png') || filename.endsWith('.jpg') || filename.endsWith('.jpeg')) {
                            const key = filename.replace(/\.(png|jpg|jpeg)$/, '');
                            const imgData = await zip.file(filename)?.async("uint8array");
                            if (imgData) {
                                message.images[key] = imgData;
                            }
                        }
                    }
                } else {
                    const inflated = pako.inflate(uint8Array);
                    message = MovieEntity.decode(inflated);
                }

                if (message.sprites) {
                    message.sprites = message.sprites.filter((s: any) => !deletedKeys.has(s.imageKey));
                }
                if (message.images) {
                    deletedKeys.forEach(key => {
                        delete message.images[key];
                    });
                }

                const imagesData: Record<string, Uint8Array> = message.images || {};
                const keys = Object.keys(imagesData);
                
                for (let i = 0; i < keys.length; i++) {
                    const key = keys[i];
                    if (deletedKeys.has(key)) continue;

                    let finalBase64 = "";
                    
                    if (layerImages[key]) {
                        finalBase64 = await getProcessedAsset(key);
                    } else {
                        const imgData = imagesData[key];
                        let binary = '';
                        const len = imgData.byteLength;
                        for (let k = 0; k < len; k++) {
                            binary += String.fromCharCode(imgData[k]);
                        }
                        finalBase64 = `data:image/png;base64,${btoa(binary)}`;
                    }

                    if (!finalBase64) continue;
                    
                    const hasColorTint = !!assetColors[key];
                    if (exportScale < 0.99 || isEdgeFadeActive || hasColorTint) {
                        const img = new Image();
                        img.src = finalBase64;
                        await new Promise(r => img.onload = r);
                        const canvas = document.createElement('canvas');
                        const targetScale = exportScale < 0.99 ? exportScale : 1.0;
                        canvas.width = Math.floor(img.width * targetScale);
                        canvas.height = Math.floor(img.height * targetScale);
                        
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                            if (hasColorTint) {
                                const color = assetColors[key];
                                const mode = assetColorModes[key] || 'tint';
                                
                                if (mode === 'fill') {
                                    ctx.globalCompositeOperation = 'source-in';
                                    ctx.fillStyle = color;
                                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                                } else {
                                    ctx.globalCompositeOperation = 'multiply';
                                    ctx.fillStyle = color;
                                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                                    ctx.globalCompositeOperation = 'destination-in';
                                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                                }
                                ctx.globalCompositeOperation = 'source-over';
                            }
                            
                            if (isEdgeFadeActive) {
                                applyTransparencyEffects(ctx, canvas.width, canvas.height);
                            }

                            finalBase64 = canvas.toDataURL('image/png');
                        }
                    }

                    const binaryString = atob(finalBase64.split(',')[1]);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let j = 0; j < binaryString.length; j++) bytes[j] = binaryString.charCodeAt(j);
                    imagesData[key] = bytes;
                    
                    if (i % 10 === 0) {
                        setProgress(Math.floor((i / keys.length) * 100));
                        await new Promise(r => setTimeout(r, 0));
                    }
                }
                
                message.images = imagesData;

                const origW = message.params.viewBoxWidth;
                const origH = message.params.viewBoxHeight;
                const scaleX = videoWidth / origW;
                const scaleY = videoHeight / origH;
                
                const fitScale = Math.min(scaleX, scaleY);
                const fitOffsetX = (videoWidth - origW * fitScale) / 2;
                const fitOffsetY = (videoHeight - origH * fitScale) / 2;

                if (message.sprites) {
                    message.sprites.forEach((sprite: any) => {
                        if (sprite.frames) {
                            sprite.frames.forEach((frame: any) => {
                                const cx = videoWidth / 2;
                                const cy = videoHeight / 2;
                                const totalScale = fitScale * svgaScale;

                                if (frame.layout) {
                                    let fx = frame.layout.x * fitScale + fitOffsetX;
                                    let fy = frame.layout.y * fitScale + fitOffsetY;
                                    let fw = frame.layout.width * fitScale;
                                    let fh = frame.layout.height * fitScale;

                                    frame.layout.x = (fx - cx) * svgaScale + cx + svgaPos.x;
                                    frame.layout.y = (fy - cy) * svgaScale + cy + svgaPos.y;
                                    frame.layout.width = fw * svgaScale;
                                    frame.layout.height = fh * svgaScale;
                                }

                                if (frame.transform) {
                                    if (frame.layout) {
                                        frame.transform.tx *= totalScale;
                                        frame.transform.ty *= totalScale;
                                    } else {
                                         let ftx = frame.transform.tx * fitScale + fitOffsetX;
                                         let fty = frame.transform.ty * fitScale + fitOffsetY;
                                         
                                         frame.transform.tx = (ftx - cx) * svgaScale + cx + svgaPos.x;
                                         frame.transform.ty = (fty - cy) * svgaScale + cy + svgaPos.y;
                                         
                                         frame.transform.a *= totalScale;
                                         frame.transform.b *= totalScale;
                                         frame.transform.c *= totalScale;
                                         frame.transform.d *= totalScale;
                                    }
                                }
                            });
                        }
                    });
                }

                message.params.viewBoxWidth = videoWidth;
                message.params.viewBoxHeight = videoHeight;

                const backLayers = customLayers.filter(l => l.zIndexMode === 'back').reverse();
                for (const layer of backLayers) {
                    try {
                        const layerKey = layer.id;
                        let bytes: Uint8Array | null = null;

                        if (layer.url.startsWith('blob:')) {
                            const response = await fetch(layer.url);
                            const arrayBuffer = await response.arrayBuffer();
                            bytes = new Uint8Array(arrayBuffer);
                        } else if (layer.url.includes(',')) {
                            const binary = atob(layer.url.split(',')[1]);
                            bytes = new Uint8Array(binary.length);
                            for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
                        }

                        if (!bytes) continue;
                        message.images[layerKey] = bytes;

                        const finalWidth = layer.width * layer.scale;
                        const finalHeight = layer.height * layer.scale;
                        const layerFrame = {
                            alpha: 1.0,
                            layout: { 
                                x: parseFloat(layer.x.toString()), 
                                y: parseFloat(layer.y.toString()), 
                                width: parseFloat(finalWidth.toString()), 
                                height: parseFloat(finalHeight.toString()) 
                            },
                            transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }
                        };
                        if (!message.sprites) message.sprites = [];
                        message.sprites.unshift({ imageKey: layerKey, frames: Array(message.params.frames || 1).fill(layerFrame) });
                    } catch (e) {
                        console.error("Failed to process back layer:", layer.id, e);
                    }
                }

                const frontLayers = customLayers.filter(l => l.zIndexMode === 'front');
                for (const layer of frontLayers) {
                    try {
                        const layerKey = layer.id;
                        let bytes: Uint8Array | null = null;

                        if (layer.url.startsWith('blob:')) {
                            const response = await fetch(layer.url);
                            const arrayBuffer = await response.arrayBuffer();
                            bytes = new Uint8Array(arrayBuffer);
                        } else if (layer.url.includes(',')) {
                            const binary = atob(layer.url.split(',')[1]);
                            bytes = new Uint8Array(binary.length);
                            for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
                        }

                        if (!bytes) continue;
                        message.images[layerKey] = bytes;

                        const finalWidth = layer.width * layer.scale;
                        const finalHeight = layer.height * layer.scale;
                        const layerFrame = {
                            alpha: 1.0,
                            layout: { 
                                x: parseFloat(layer.x.toString()), 
                                y: parseFloat(layer.y.toString()), 
                                width: parseFloat(finalWidth.toString()), 
                                height: parseFloat(finalHeight.toString()) 
                            },
                            transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }
                        };
                        if (!message.sprites) message.sprites = [];
                        message.sprites.push({ imageKey: layerKey, frames: Array(message.params.frames || 1).fill(layerFrame) });
                    } catch (e) {
                        console.error("Failed to process front layer:", layer.id, e);
                    }
                }

                const wmKey = "quantum_wm_layer_fixed";
                if (watermark) {
                    const binary = atob(watermark.split(',')[1]);
                    const bytes = new Uint8Array(binary.length);
                    for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
                    message.images[wmKey] = bytes;

                    const wmSize = await getImageSize(watermark);
                    const wmWidth = videoWidth * wmScale;
                    const wmHeight = wmWidth * (wmSize.h / wmSize.w);
                    const wmX = (videoWidth / 2) - (wmWidth / 2) + wmPos.x;
                    const wmY = (videoHeight / 2) - (wmHeight / 2) + wmPos.y;
                    
                    const wmFrame = {
                        alpha: 1.0,
                        layout: { x: wmX || 0, y: wmY || 0, width: wmWidth, height: wmHeight },
                        transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }
                    };
                    if (!message.sprites) message.sprites = [];
                    message.sprites.push({
                        imageKey: wmKey,
                        frames: Array(message.params.frames || 1).fill(wmFrame)
                    });
                }

                if (audioUrl) {
                    const audioKey = "quantum_audio_track";
                    let bytes: Uint8Array | null = null;
                    
                    if (audioFile) {
                        const arrayBuffer = await audioFile.arrayBuffer();
                        bytes = new Uint8Array(arrayBuffer);
                    } else if (audioUrl === originalAudioUrl) {
                         bytes = null;
                    } else {
                        try {
                            const response = await fetch(audioUrl);
                            const arrayBuffer = await response.arrayBuffer();
                            bytes = new Uint8Array(arrayBuffer);
                        } catch (e) { console.error("Failed to fetch audio", e); }
                    }

                    if (bytes) {
                        message.images[audioKey] = bytes; 
                        message.audios = [{
                            audioKey: audioKey,
                            startFrame: 0,
                            endFrame: message.params.frames || 0,
                            startTime: 0,
                            totalTime: Math.floor(((message.params.frames || 0) / (message.params.fps || 30)) * 1000)
                        }];
                    }
                } else {
                    message.audios = [];
                }

                const bufferOut = MovieEntity.encode(message).finish();
                const compressedBuffer = pako.deflate(bufferOut);
                
                const link = document.createElement("a");
                link.href = URL.createObjectURL(new Blob([compressedBuffer]));
                link.download = `${metadata.name.replace('.svga','')}_Quantum_${Math.round(exportScale*100)}.svga`;
                link.click();
                setProgress(100);
            } else {
                const root = protobuf.parse(svgaSchema).root;
                const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");
                
                const imagesData: Record<string, Uint8Array> = {};
                const audioList: any[] = [...(metadata.videoItem.audios || [])];
                
                let finalSprites = (metadata.videoItem.sprites || []).filter((s: any) => !deletedKeys.has(s.imageKey)).map((s: any) => {
                    return JSON.parse(JSON.stringify(s));
                });

                const allImageKeys = new Set<string>();
                (metadata.videoItem.sprites || []).forEach((s: any) => allImageKeys.add(s.imageKey));
                Object.keys(layerImages).forEach(k => allImageKeys.add(k));

                const keys = Array.from(allImageKeys);
                for (let i = 0; i < keys.length; i++) {
                    const key = keys[i];
                    if (deletedKeys.has(key)) continue;
                    if (imagesData[key]) continue; 

                    let finalBase64 = "";
                    
                    if (layerImages[key]) {
                        finalBase64 = await getProcessedAsset(key);
                    } 
                    else if (metadata.videoItem.images[key]) {
                        const imgData = metadata.videoItem.images[key];
                        if (typeof imgData === 'string') {
                             finalBase64 = imgData.startsWith('data:') ? imgData : `data:image/png;base64,${imgData}`;
                        } else if (imgData instanceof Uint8Array) {
                             let binary = '';
                             const len = imgData.byteLength;
                             for (let k = 0; k < len; k++) {
                                 binary += String.fromCharCode(imgData[k]);
                             }
                             finalBase64 = `data:image/png;base64,${btoa(binary)}`;
                        }
                    }

                    if (!finalBase64) continue;
                    
                    const hasColorTint = !!assetColors[key];
                    if (exportScale < 0.99 || isEdgeFadeActive || hasColorTint) {
                        const img = new Image();
                        img.src = finalBase64;
                        await new Promise(r => img.onload = r);
                        const canvas = document.createElement('canvas');
                        const targetScale = exportScale < 0.99 ? exportScale : 1.0;
                        canvas.width = Math.floor(img.width * targetScale);
                        canvas.height = Math.floor(img.height * targetScale);
                        
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                            if (hasColorTint) {
                                const color = assetColors[key];
                                const mode = assetColorModes[key] || 'tint';
                                
                                if (mode === 'fill') {
                                    ctx.globalCompositeOperation = 'source-in';
                                    ctx.fillStyle = color;
                                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                                } else {
                                    ctx.globalCompositeOperation = 'multiply';
                                    ctx.fillStyle = color;
                                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                                    ctx.globalCompositeOperation = 'destination-in';
                                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                                }
                                ctx.globalCompositeOperation = 'source-over';
                            }
                            
                            if (isEdgeFadeActive) {
                                applyTransparencyEffects(ctx, canvas.width, canvas.height);
                            }

                            finalBase64 = canvas.toDataURL('image/png');
                        }
                    }

                    const binaryString = atob(finalBase64.split(',')[1]);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let j = 0; j < binaryString.length; j++) bytes[j] = binaryString.charCodeAt(j);
                    imagesData[key] = bytes;
                    
                    if (i % 10 === 0) {
                        setProgress(Math.floor((i / keys.length) * 100));
                        await new Promise(r => setTimeout(r, 0));
                    }
                }

                const origW = metadata.videoItem.videoSize.width;
                const origH = metadata.videoItem.videoSize.height;
                const scaleX = videoWidth / origW;
                const scaleY = videoHeight / origH;
                
                const fitScale = Math.min(scaleX, scaleY);
                const fitOffsetX = (videoWidth - origW * fitScale) / 2;
                const fitOffsetY = (videoHeight - origH * fitScale) / 2;

                finalSprites.forEach((sprite: any) => {
                    sprite.frames.forEach((frame: any) => {
                        const cx = videoWidth / 2;
                        const cy = videoHeight / 2;
                        const totalScale = fitScale * svgaScale;

                        if (frame.layout) {
                            let fx = frame.layout.x * fitScale + fitOffsetX;
                            let fy = frame.layout.y * fitScale + fitOffsetY;
                            let fw = frame.layout.width * fitScale;
                            let fh = frame.layout.height * fitScale;

                            frame.layout.x = (fx - cx) * svgaScale + cx + svgaPos.x;
                            frame.layout.y = (fy - cy) * svgaScale + cy + svgaPos.y;
                            frame.layout.width = fw * svgaScale;
                            frame.layout.height = fh * svgaScale;
                        }

                        if (frame.transform) {
                            if (frame.layout) {
                                frame.transform.tx *= totalScale;
                                frame.transform.ty *= totalScale;
                            } 
                            else {
                                 let ftx = frame.transform.tx * fitScale + fitOffsetX;
                                 let fty = frame.transform.ty * fitScale + fitOffsetY;
                                 
                                 frame.transform.tx = (ftx - cx) * svgaScale + cx + svgaPos.x;
                                 frame.transform.ty = (fty - cy) * svgaScale + cy + svgaPos.y;
                                 
                                 frame.transform.a *= totalScale;
                                 frame.transform.b *= totalScale;
                                 frame.transform.c *= totalScale;
                                 frame.transform.d *= totalScale;
                            }
                        }
                    });
                });

                const backLayers = customLayers.filter(l => l.zIndexMode === 'back').reverse();
                
                for (const layer of backLayers) {
                    try {
                        const layerKey = layer.id;
                        let bytes: Uint8Array | null = null;

                        if (layer.url.startsWith('blob:')) {
                            const response = await fetch(layer.url);
                            const arrayBuffer = await response.arrayBuffer();
                            bytes = new Uint8Array(arrayBuffer);
                        } else if (layer.url.includes(',')) {
                            const binary = atob(layer.url.split(',')[1]);
                            bytes = new Uint8Array(binary.length);
                            for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
                        }

                        if (!bytes) continue;
                        imagesData[layerKey] = bytes;

                        const finalWidth = layer.width * layer.scale;
                        const finalHeight = layer.height * layer.scale;
                        const layerFrame = {
                            alpha: 1.0,
                            layout: { 
                                x: parseFloat(layer.x.toString()), 
                                y: parseFloat(layer.y.toString()), 
                                width: parseFloat(finalWidth.toString()), 
                                height: parseFloat(finalHeight.toString()) 
                            },
                            transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }
                        };
                        finalSprites.unshift({ imageKey: layerKey, frames: Array(metadata.frames || 1).fill(layerFrame) });
                    } catch (e) {
                        console.error("Failed to process back layer:", layer.id, e);
                    }
                }

                const frontLayers = customLayers.filter(l => l.zIndexMode === 'front');
                for (const layer of frontLayers) {
                    try {
                        const layerKey = layer.id;
                        let bytes: Uint8Array | null = null;

                        if (layer.url.startsWith('blob:')) {
                            const response = await fetch(layer.url);
                            const arrayBuffer = await response.arrayBuffer();
                            bytes = new Uint8Array(arrayBuffer);
                        } else if (layer.url.includes(',')) {
                            const binary = atob(layer.url.split(',')[1]);
                            bytes = new Uint8Array(binary.length);
                            for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
                        }

                        if (!bytes) continue;
                        imagesData[layerKey] = bytes;

                        const finalWidth = layer.width * layer.scale;
                        const finalHeight = layer.height * layer.scale;
                        const layerFrame = {
                            alpha: 1.0,
                            layout: { 
                                x: parseFloat(layer.x.toString()), 
                                y: parseFloat(layer.y.toString()), 
                                width: parseFloat(finalWidth.toString()), 
                                height: parseFloat(finalHeight.toString()) 
                            },
                            transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }
                        };
                        finalSprites.push({ imageKey: layerKey, frames: Array(metadata.frames || 1).fill(layerFrame) });
                    } catch (e) {
                        console.error("Failed to process front layer:", layer.id, e);
                    }
                }

                const wmKey = "quantum_wm_layer_fixed";
                if (watermark) {
                    const binary = atob(watermark.split(',')[1]);
                    const bytes = new Uint8Array(binary.length);
                    for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
                    imagesData[wmKey] = bytes;

                    const wmSize = await getImageSize(watermark);
                    const wmWidth = videoWidth * wmScale;
                    const wmHeight = wmWidth * (wmSize.h / wmSize.w);
                    const wmX = (videoWidth / 2) - (wmWidth / 2) + wmPos.x;
                    const wmY = (videoHeight / 2) - (wmHeight / 2) + wmPos.y;
                    
                    const wmFrame = {
                        alpha: 1.0,
                        layout: { x: wmX || 0, y: wmY || 0, width: wmWidth, height: wmHeight },
                        transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }
                    };
                    finalSprites.push({
                        imageKey: wmKey,
                        frames: Array(metadata.frames || 1).fill(wmFrame)
                    });
                }

                if (audioUrl) {
                    const audioKey = "quantum_audio_track";
                    let bytes: Uint8Array | null = null;
                    
                    if (audioFile) {
                        const arrayBuffer = await audioFile.arrayBuffer();
                        bytes = new Uint8Array(arrayBuffer);
                    } 
                    else if (audioUrl === originalAudioUrl) {
                         try {
                            const response = await fetch(audioUrl);
                            const arrayBuffer = await response.arrayBuffer();
                            bytes = new Uint8Array(arrayBuffer);
                         } catch (e) { console.error("Failed to fetch audio blob", e); }
                    }
                    else {
                        try {
                            const response = await fetch(audioUrl);
                            const arrayBuffer = await response.arrayBuffer();
                            bytes = new Uint8Array(arrayBuffer);
                        } catch (e) { console.error("Failed to fetch audio", e); }
                    }

                    if (bytes) {
                        imagesData[audioKey] = bytes; 
                        audioList.length = 0; 
                        audioList.push({
                            audioKey: audioKey,
                            startFrame: 0,
                            endFrame: metadata.frames || 0,
                            startTime: 0,
                            totalTime: Math.floor(((metadata.frames || 0) / (metadata.fps || 30)) * 1000)
                        });
                    }
                }

                const payload = { 
                    version: "2.0", 
                    params: { 
                        viewBoxWidth: videoWidth, 
                        viewBoxHeight: videoHeight, 
                        fps: metadata.fps || 30, 
                        frames: metadata.frames || 0 
                    }, 
                    images: imagesData, 
                    sprites: finalSprites,
                    audios: audioList
                };

                const buffer = MovieEntity.encode(MovieEntity.create(payload)).finish();
                const compressedBuffer = pako.deflate(buffer);
                
                const link = document.createElement("a");
                link.href = URL.createObjectURL(new Blob([compressedBuffer]));
                link.download = `${metadata.name.replace('.svga','')}_Quantum_${Math.round(exportScale*100)}.svga`;
                link.click();
                setProgress(100);
            }
        } catch (e) {
            console.error(e);
            alert("فشل التصدير: " + (e as any).message);
        } finally { 
            setTimeout(() => setIsExporting(false), 800); 
        }
    }
  };

  if (!metadata.videoItem && isExporting) {
      return (
        <div className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-3xl flex items-center justify-center p-6">
           <div className="max-w-md w-full bg-slate-900 border border-white/10 p-10 rounded-[3rem] shadow-3xl text-center space-y-6">
              <div className="w-24 h-24 bg-sky-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-sky-500/20">
                 <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
              <h3 className="text-white font-black text-xl uppercase tracking-tighter">{exportPhase}</h3>
              <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5">
                 <div className="h-full bg-sky-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
              </div>
           </div>
        </div>
      );
  }

  return (
    <div className="flex flex-col gap-6 sm:gap-8 pb-32 animate-in fade-in slide-in-from-bottom-8 duration-1000 font-arabic select-none text-right" dir="rtl">
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleReplaceImage} />
      <input type="file" ref={replaceSvgaInputRef} className="hidden" accept=".svga" onChange={handleReplaceSvgaFile} />
      <input type="file" ref={bgInputRef} className="hidden" accept="image/*" onChange={handleBgUpload} />
      <input type="file" ref={watermarkInputRef} className="hidden" accept="image/*" onChange={handleWatermarkUpload} />
      <input type="file" ref={layerInputRef} className="hidden" accept="image/*" onChange={handleAddLayer} />
      <input type="file" ref={audioInputRef} className="hidden" accept="audio/*" onChange={handleAudioUpload} />
      <input type="file" ref={videoInputRef} className="hidden" accept="video/*,image/gif,image/webp" onChange={handleVideoUpload} />
      <audio ref={audioRef} src={audioUrl || undefined} loop />

      {isExporting && (
        <div className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-3xl flex items-center justify-center p-6">
           <div className="max-w-md w-full bg-slate-900 border border-white/10 p-10 rounded-[3rem] shadow-3xl text-center space-y-6">
              <div className="w-24 h-24 bg-sky-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-sky-500/20">
                 <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
              <h3 className="text-white font-black text-xl uppercase tracking-tighter">{exportPhase}</h3>
              <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5">
                 <div className="h-full bg-sky-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
              </div>
           </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row items-center justify-between p-4 sm:p-6 lg:p-10 rounded-2xl sm:rounded-[3rem] border border-white/5 gap-4 sm:gap-6 shadow-2xl bg-slate-900/40 backdrop-blur-3xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-l from-transparent via-sky-500/30 to-transparent"></div>
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8 text-center sm:text-right w-full lg:w-auto">
          <div className="w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20 bg-gradient-to-br from-sky-400 to-indigo-600 rounded-xl sm:rounded-[2rem] flex items-center justify-center text-white shadow-glow-sky text-xl sm:text-3xl">
             <span className="drop-shadow-lg animate-pulse">⚛️</span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg sm:text-xl lg:text-3xl font-black text-white tracking-tight mb-1 truncate">{metadata.name}</h2>
            <div className="flex flex-wrap justify-center sm:justify-start items-center gap-2 sm:gap-4">
               <span className="px-2 py-0.5 sm:px-3 sm:py-1 bg-sky-500/10 text-sky-400 text-[8px] sm:text-[10px] font-black rounded-lg border border-sky-500/20 uppercase tracking-[0.1em] sm:tracking-[0.2em]">{videoWidth}X{videoHeight}</span>
               <span className="text-[8px] sm:text-[10px] lg:text-[12px] text-slate-500 font-bold uppercase tracking-[0.1em] sm:tracking-[0.3em]">{metadata.frames} إطارات</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full lg:w-auto">
            <button onClick={() => replaceSvgaInputRef.current?.click()} className="flex-1 lg:flex-none px-4 sm:px-6 py-3 sm:py-5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 hover:text-sky-300 rounded-xl sm:rounded-[2rem] border border-sky-500/20 transition-all font-black uppercase text-[8px] sm:text-[10px] tracking-widest active:scale-95 flex items-center justify-center gap-2">
                <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                تغيير ملف SVGA
            </button>
            <button onClick={onCancel} className="flex-1 lg:flex-none px-4 sm:px-10 py-3 sm:py-5 bg-white/5 hover:bg-red-500/10 text-slate-400 hover:text-red-400 rounded-xl sm:rounded-[2rem] border border-white/10 transition-all font-black uppercase text-[8px] sm:text-[10px] tracking-widest active:scale-95">إلغاء المعالجة</button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 sm:gap-8 overflow-visible">
        <div className="xl:col-span-7 flex flex-col gap-4 sm:gap-0 overflow-visible">
          <div className="relative flex items-center justify-center w-full overflow-hidden rounded-2xl sm:rounded-[3rem] border border-white/10 shadow-3xl bg-black/20" style={{ height: `${Math.max(200, videoHeight * scale)}px` }}>
              <div ref={containerRef} className="absolute inset-0 flex items-center justify-center transition-transform duration-500 ease-out origin-center pointer-events-none" style={{ transform: `scale(${scale})` }}>
                  <div className="relative overflow-hidden shadow-2xl pointer-events-auto" style={{ 
                      width: `${videoWidth}px`, 
                      height: `${videoHeight}px`, 
                      backgroundImage: previewBg ? `url(${previewBg})` : `
                        linear-gradient(45deg, #334155 25%, transparent 25%), 
                        linear-gradient(-45deg, #334155 25%, transparent 25%), 
                        linear-gradient(45deg, transparent 75%, #334155 75%), 
                        linear-gradient(-45deg, transparent 75%, #334155 75%)
                      `,
                      backgroundSize: previewBg ? `${bgScale}%` : '20px 20px',
                      backgroundRepeat: previewBg ? 'no-repeat' : 'repeat', 
                      backgroundPosition: previewBg ? `${bgPos.x}% ${bgPos.y}%` : '0 0, 0 10px, 10px -10px, -10px 0px', 
                      backgroundColor: previewBg ? 'transparent' : '#0f172a',
                      boxShadow: '0 0 100px rgba(0,0,0,0.5), inset 0 0 50px rgba(0,0,0,0.5)', 
                      border: previewBg ? 'none' : '2px solid rgba(255,255,255,0.05)',
                      maskImage: (fadeConfig.top > 0 || fadeConfig.bottom > 0 || fadeConfig.left > 0 || fadeConfig.right > 0) ? `
                        linear-gradient(to right, transparent, black ${fadeConfig.left}%, black ${100-fadeConfig.right}%, transparent), 
                        linear-gradient(to bottom, transparent, black ${fadeConfig.top}%, black ${100-fadeConfig.bottom}%, transparent)
                      ` : 'none',
                      maskComposite: 'intersect'
                  }}>
                      {/* Back Layers */}
                      {customLayers.filter(l => l.zIndexMode === 'back').map(layer => (
                        <div 
                            key={layer.id}
                            className="absolute z-[5] pointer-events-none transition-transform duration-200"
                            style={{ 
                                left: 0, 
                                top: 0, 
                                transform: `translate(${layer.x}px, ${layer.y}px)`,
                                width: layer.width * layer.scale,
                                height: layer.height * layer.scale
                            }}
                        >
                            <img 
                                src={layer.url} 
                                className={`w-full h-full pointer-events-auto cursor-pointer ${selectedLayerId === layer.id ? 'ring-2 ring-sky-500 shadow-glow-sky' : ''}`}
                                onClick={(e) => { e.stopPropagation(); setSelectedLayerId(layer.id); setActiveSideTab('transforms'); }}
                            />
                        </div>
                      ))}

                      <div className="w-full h-full relative z-10 flex items-center justify-center transition-transform duration-300" style={{ transform: `translate(${svgaPos.x}px, ${svgaPos.y}px) scale(${svgaScale})` }}>
                         <div 
                            key={`${videoWidth}-${videoHeight}`} 
                            ref={playerRef} 
                            id="svga-player-container" 
                            className="w-full h-full relative flex items-center justify-center overflow-visible"
                            style={{
                                WebkitMaskImage: `linear-gradient(to bottom, transparent 0%, black ${fadeConfig.top}%, black ${100 - fadeConfig.bottom}%, transparent 100%), linear-gradient(to right, transparent 0%, black ${fadeConfig.left}%, black ${100 - fadeConfig.right}%, transparent 100%)`,
                                maskImage: `linear-gradient(to bottom, transparent 0%, black ${fadeConfig.top}%, black ${100 - fadeConfig.bottom}%, transparent 100%), linear-gradient(to right, transparent 0%, black ${fadeConfig.left}%, black ${100 - fadeConfig.right}%, transparent 100%)`,
                                WebkitMaskComposite: 'source-in',
                                maskComposite: 'intersect'
                            }}
                         ></div>
                      </div>
                      {watermark && (
                        <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center p-0 transition-transform duration-200" style={{ transform: `translate(${wmPos.x}px, ${wmPos.y}px)` }}>
                           <img src={watermark} className="object-contain filter drop-shadow-2xl opacity-70" style={{ width: `${wmScale * 100}%` }} alt="Watermark" />
                        </div>
                      )}
                      {/* Front Layers */}
                      {customLayers.filter(l => l.zIndexMode === 'front').map(layer => (
                        <div 
                            key={layer.id}
                            className="absolute z-25 pointer-events-none transition-transform duration-200"
                            style={{ 
                                left: 0, 
                                top: 0, 
                                transform: `translate(${layer.x}px, ${layer.y}px)`,
                                width: layer.width * layer.scale,
                                height: layer.height * layer.scale
                            }}
                        >
                            <img 
                                src={layer.url} 
                                className={`w-full h-full pointer-events-auto cursor-pointer ${selectedLayerId === layer.id ? 'ring-2 ring-sky-500 shadow-glow-sky' : ''}`}
                                onClick={(e) => { e.stopPropagation(); setSelectedLayerId(layer.id); setActiveSideTab('transforms'); }}
                            />
                        </div>
                      ))}
                  </div>
              </div>
          </div>

          <div className="mt-4 w-full bg-slate-950/60 backdrop-blur-3xl p-4 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-white/5 flex flex-col lg:flex-row items-center gap-4 sm:gap-8 shadow-2xl relative z-20">
               <div className="flex items-center gap-4 w-full lg:w-auto">
                 <button onClick={handlePlayToggle} className="w-12 h-12 sm:w-16 sm:h-16 bg-sky-500 hover:bg-sky-400 text-white rounded-xl sm:rounded-2xl flex items-center justify-center shadow-glow-sky transition-all active:scale-90 flex-shrink-0">
                   {isPlaying ? <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="currentColor" viewBox="0 0 20 20"><path d="M5 4h3v12H5V4zm7 0h3v12h-3V4z"/></svg> : <svg className="w-6 h-6 sm:w-8 sm:h-8 mr-1" fill="currentColor" viewBox="0 0 20 20"><path d="M4.5 3.5l11 6.5-11 6.5z"/></svg>}
                 </button>
                 <button onClick={handleDownloadFrame} className="w-12 h-12 sm:w-16 sm:h-16 bg-white/5 hover:bg-white/10 text-white rounded-xl sm:rounded-2xl flex items-center justify-center border border-white/10 transition-all active:scale-90 flex-shrink-0" title="تنزيل الإطار الحالي">
                     <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                 </button>
               </div>
               <div className="flex-1 w-full flex flex-col gap-3">
                  <div className="flex justify-between items-center px-1">
                    <div className="flex items-center gap-2">
                       <span className="text-white font-black text-[10px] px-2 py-0.5 sm:px-3 sm:py-1 bg-white/5 rounded-lg border border-white/5">{currentFrame} / {metadata.frames || 0} ({((currentFrame) / (metadata.fps || 20)).toFixed(2)}s / {((metadata.frames || 0) / (metadata.fps || 20)).toFixed(2)}s)</span>
                       {audioUrl && (
                         <span className="flex items-center gap-1 text-[8px] sm:text-[9px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20 animate-pulse">
                           <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                           صوت نشط
                         </span>
                       )}
                    </div>
                    <span className="text-slate-600 text-[8px] sm:text-[9px] font-black uppercase tracking-widest">إطار المشهد</span>
                  </div>
                  <div className="relative h-2 flex items-center">
                    <div className="absolute inset-0 h-1 bg-white/5 rounded-full overflow-hidden">
                       <div className="h-full bg-sky-500" style={{ width: `${(currentFrame / (metadata.frames || 1)) * 100}%` }}></div>
                    </div>
                    <input type="range" min="0" max={metadata.frames || 1} value={currentFrame} onChange={(e) => { 
                        const f = parseInt(e.target.value); 
                        svgaInstance?.stepToFrame(f, false); 
                        setCurrentFrame(f); 
                        // Manual scrub sync
                        if (audioRef.current && metadata.fps) {
                            audioRef.current.currentTime = f / metadata.fps;
                        }
                    }} className="absolute inset-0 w-full h-full appearance-none bg-transparent accent-sky-500 cursor-pointer z-10" />
                  </div>
               </div>
          </div>
        </div>

        <div className="xl:col-span-5 flex flex-col gap-6 h-auto xl:h-[800px]">
          <div className="flex bg-slate-950/80 p-1 rounded-2xl sm:rounded-3xl border border-white/5 overflow-x-auto custom-scrollbar no-scrollbar">
              <button onClick={() => setActiveSideTab('layers')} className={`flex-shrink-0 px-4 py-3 rounded-xl sm:rounded-2xl text-[8px] sm:text-[9px] font-black uppercase transition-all ${activeSideTab === 'layers' ? 'bg-sky-500 text-white shadow-glow-sky' : 'text-slate-500'}`}>الطبقات</button>
              <button onClick={() => setActiveSideTab('transforms')} className={`flex-shrink-0 px-4 py-3 rounded-xl sm:rounded-2xl text-[8px] sm:text-[9px] font-black uppercase transition-all ${activeSideTab === 'transforms' ? 'bg-sky-500 text-white shadow-glow-sky' : 'text-slate-500'}`}>التحويلات</button>
              <button onClick={() => setActiveSideTab('bg')} className={`flex-shrink-0 px-4 py-3 rounded-xl sm:rounded-2xl text-[8px] sm:text-[9px] font-black uppercase transition-all ${activeSideTab === 'bg' ? 'bg-sky-500 text-white shadow-glow-sky' : 'text-slate-500'}`}>الخلفية</button>
              <button onClick={() => setActiveSideTab('optimize')} className={`flex-shrink-0 px-4 py-3 rounded-xl sm:rounded-2xl text-[8px] sm:text-[9px] font-black uppercase transition-all ${activeSideTab === 'optimize' ? 'bg-emerald-500 text-white shadow-glow-emerald' : 'text-slate-500'}`}>ضغط الحجم</button>
              {currentUser?.role === 'admin' && (
                <button onClick={() => setActiveSideTab('settings')} className={`flex-shrink-0 px-4 py-3 rounded-xl sm:rounded-2xl text-[8px] sm:text-[9px] font-black uppercase transition-all ${activeSideTab === 'settings' ? 'bg-purple-500 text-white shadow-glow-purple' : 'text-slate-500'}`}>الإعدادات</button>
              )}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-950/80 rounded-2xl sm:rounded-[3rem] p-4 sm:p-6 border border-white/5 shadow-3xl">
              {activeSideTab === 'layers' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-white font-black text-xl uppercase">إدارة الطبقات Quantum</h3>
                        <div className="flex gap-2">
                            {selectedKeys.size > 0 && (
                                <button onClick={() => {
                                    const newDeleted = new Set(deletedKeys);
                                    selectedKeys.forEach(k => newDeleted.add(k));
                                    setDeletedKeys(newDeleted);
                                    setSelectedKeys(new Set());
                                }} className="px-4 py-2 bg-red-500 text-white rounded-xl text-[10px] font-black uppercase shadow-glow-red">حذف المحدد ({selectedKeys.size})</button>
                            )}
                            <button onClick={() => layerInputRef.current?.click()} className="px-4 py-2 bg-sky-500 text-white rounded-xl text-[10px] font-black uppercase shadow-glow-sky">+ إضافة طبقة</button>
                        </div>
                    </div>
                    
                    {/* VAP Toggle */}
                    <div className="flex items-center gap-2 mb-4 p-3 bg-white/5 rounded-xl border border-white/5">
                        <div className="relative inline-flex items-center cursor-pointer" onClick={() => setIsVapMode(!isVapMode)}>
                            <input type="checkbox" className="sr-only peer" checked={isVapMode} readOnly />
                            <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500"></div>
                            <span className="mr-3 text-xs font-bold text-slate-300">استيراد فيديو شفاف (VAP)</span>
                        </div>
                    </div>
                    
                    {/* Custom Layers & Existing Layers Merged Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        {/* Custom Layers */}
                        {[...customLayers].reverse().map(layer => (
                            <div key={layer.id} onClick={() => { setSelectedLayerId(layer.id); setActiveSideTab('transforms'); }} className={`group bg-slate-900/30 rounded-[2rem] border p-4 transition-all cursor-pointer ${selectedLayerId === layer.id ? 'border-sky-500 bg-sky-500/10' : 'border-white/[0.03]'}`}>
                                <div className="aspect-square rounded-2xl bg-black/40 flex items-center justify-center relative overflow-hidden mb-2">
                                    <img src={layer.url} className="max-w-[80%] max-h-[80%] object-contain" />
                                </div>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[8px] text-white font-black truncate max-w-[80px]">{layer.name}</span>
                                    <button onClick={(e) => { e.stopPropagation(); handleRemoveLayer(layer.id); }} className="text-red-500 hover:text-red-400">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                                    </button>
                                </div>
                                <div className="flex gap-1 justify-between">
                                    <button onClick={(e) => { e.stopPropagation(); handleMoveLayer(layer.id, 'down'); }} className="px-2 py-1 bg-white/5 rounded text-[8px] text-slate-400 hover:text-white">⬇️</button>
                                    <button onClick={(e) => { e.stopPropagation(); handleUpdateLayer(layer.id, { zIndexMode: layer.zIndexMode === 'front' ? 'back' : 'front' }); }} className={`px-2 py-1 rounded text-[8px] font-black uppercase ${layer.zIndexMode === 'front' ? 'bg-sky-500/20 text-sky-400' : 'bg-slate-700 text-slate-400'}`}>{layer.zIndexMode === 'front' ? 'أمام' : 'خلف'}</button>
                                    <button onClick={(e) => { e.stopPropagation(); handleMoveLayer(layer.id, 'up'); }} className="px-2 py-1 bg-white/5 rounded text-[8px] text-slate-400 hover:text-white">⬆️</button>
                                </div>
                            </div>
                        ))}

                        {/* Existing Layers */}
                        {filteredKeys.map(key => (
                            <div 
                                key={key} 
                                onClick={() => {
                                    // Exclusive selection for easier editing
                                    setSelectedKeys(new Set([key]));
                                    setActiveSideTab('transforms');
                                }}
                                className={`group bg-slate-900/30 rounded-[2rem] border p-4 transition-all duration-300 relative cursor-pointer ${selectedKeys.has(key) ? 'border-sky-500 bg-sky-500/10' : deletedKeys.has(key) ? 'border-red-500/50 grayscale opacity-40' : 'border-white/[0.03]'}`}
                            >
                                <div className="aspect-square rounded-2xl bg-black/40 flex items-center justify-center relative overflow-hidden">
                                   {layerImages[key] && <img src={layerImages[key]} className="max-w-[70%] max-h-[70%] object-contain" style={{ filter: assetColors[key] ? `drop-shadow(0 0 2px ${assetColors[key]})` : 'none' }} />}
                                   <div className="absolute top-2 right-2 w-5 h-5 rounded-full border border-white/20 flex items-center justify-center bg-black/40">
                                      {selectedKeys.has(key) && <div className="w-3 h-3 bg-sky-500 rounded-full"></div>}
                                   </div>
                                   <div className="absolute inset-0 bg-slate-950/90 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-2 backdrop-blur-md px-2" onClick={(e) => e.stopPropagation()}>
                                      {!deletedKeys.has(key) && (
                                          <div className="flex flex-col gap-2 w-full">
                                            <div className="flex gap-2 justify-center">
                                                <button onClick={() => { setReplacingAssetKey(key); fileInputRef.current?.click(); }} className="w-8 h-8 bg-sky-500 text-white rounded-lg flex items-center justify-center" title="استبدال الصورة">✏️</button>
                                                <button onClick={() => handleDownloadLayer(key)} className="w-8 h-8 bg-emerald-500 text-white rounded-lg flex items-center justify-center" title="تحميل الصورة">⬇️</button>
                                                <div className={`relative w-8 h-8 rounded-lg overflow-hidden border-2 ${assetColorModes[key] === 'fill' ? 'border-pink-500' : 'border-white/20'}`} title={assetColorModes[key] === 'fill' ? "تلوين كامل (Fill)" : "تلوين دمج (Multiply - يحافظ على التفاصيل)"}>
                                                  <input type="color" value={assetColors[key] || "#ffffff"} onChange={(e) => handleColorChange(key, e.target.value)} className="absolute inset-[-50%] w-[200%] h-[200%] cursor-pointer bg-transparent border-none" />
                                                </div>
                                                <button 
                                                    onClick={() => handleToggleColorMode(key)} 
                                                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] border transition-all ${assetColorModes[key] === 'fill' ? 'bg-pink-500/20 border-pink-500 text-pink-400' : 'bg-blue-500/20 border-blue-500 text-blue-400'}`}
                                                    title={assetColorModes[key] === 'fill' ? "وضع التعبئة (تغيير كامل)" : "وضع التلوين (Multiply - يحافظ على التفاصيل)"}
                                                >
                                                    {assetColorModes[key] === 'fill' ? '🎨' : '💧'}
                                                </button>
                                            </div>
                                            <div className="flex gap-1 justify-between w-full">
                                                <button onClick={(e) => { e.stopPropagation(); handleMoveSprite(key, 'down'); }} className="flex-1 py-1.5 bg-white/5 rounded-lg text-[8px] text-slate-400 hover:text-white hover:bg-white/10">⬇️ خلف</button>
                                                <button onClick={(e) => { e.stopPropagation(); handleMoveSprite(key, 'up'); }} className="flex-1 py-1.5 bg-white/5 rounded-lg text-[8px] text-slate-400 hover:text-white hover:bg-white/10">⬆️ أمام</button>
                                            </div>
                                            <button onClick={() => handleBakeLayer(key)} className="w-full py-1.5 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-lg text-[8px] font-black uppercase hover:bg-indigo-500/30">تحويل متسلسل (Bake)</button>
                                            <button onClick={() => handleOpenFadeModal(key)} className="w-full py-1.5 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-lg text-[8px] font-black uppercase hover:bg-purple-500/30">تلاشي الحواف (Fade)</button>
                                          </div>
                                      )}
                                      <button onClick={() => handleDeleteAsset(key)} className={`w-full py-1.5 ${deletedKeys.has(key) ? 'bg-emerald-500' : 'bg-red-500'} text-white rounded-lg text-[8px] font-black uppercase`}>{deletedKeys.has(key) ? 'استعادة' : 'حذف'}</button>
                                   </div>
                                </div>
                                <span className="mt-2 text-[8px] text-slate-500 font-black block text-center uppercase truncate">{key}</span>
                            </div>
                        ))}
                    </div>
                </div>
              )}

              {activeSideTab === 'settings' && currentUser?.role === 'admin' && (
                <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                    <div className="space-y-6">
                        <h4 className="text-white font-black text-xs uppercase tracking-widest text-purple-400">إدارة صيغ التصدير (Control Panel)</h4>
                        <p className="text-[10px] text-slate-400 font-bold leading-relaxed">
                            تحكم في الصيغ التي تظهر للمستخدم في قائمة التصدير. الصيغ المحددة هنا سيتم إخفاؤها.
                        </p>
                        
                        <div className="grid grid-cols-1 gap-3">
                            {availableFormats.map(format => (
                                <div 
                                    key={format} 
                                    onClick={() => {
                                        setHiddenFormats(prev => 
                                            prev.includes(format) 
                                                ? prev.filter(f => f !== format) 
                                                : [...prev, format]
                                        );
                                    }}
                                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${hiddenFormats.includes(format) ? 'bg-red-500/10 border-red-500/30' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${hiddenFormats.includes(format) ? 'border-red-500 bg-red-500' : 'border-slate-600'}`}>
                                            {hiddenFormats.includes(format) && (
                                                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>
                                            )}
                                        </div>
                                        <span className={`text-xs font-black uppercase ${hiddenFormats.includes(format) ? 'text-red-400' : 'text-white'}`}>{format}</span>
                                    </div>
                                    <span className={`text-[9px] font-bold uppercase ${hiddenFormats.includes(format) ? 'text-red-500/70' : 'text-slate-500'}`}>
                                        {hiddenFormats.includes(format) ? 'مخفي' : 'ظاهر'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
              )}

              {activeSideTab === 'transforms' && (
                <div className="space-y-10 animate-in slide-in-from-right-4 duration-300">
                    <div className="space-y-6 pb-6 border-b border-white/5">
                        <h4 className="text-white font-black text-xs uppercase tracking-widest text-sky-400">أبعاد الملف (Canvas Dimensions)</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-slate-500 uppercase">العرض (Width)</label>
                                <input 
                                    type="number" 
                                    value={videoWidth} 
                                    onChange={(e) => setCustomDimensions(prev => ({ width: parseInt(e.target.value) || 750, height: prev?.height || videoHeight }))}
                                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:border-sky-500 outline-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-slate-500 uppercase">الارتفاع (Height)</label>
                                <input 
                                    type="number" 
                                    value={videoHeight} 
                                    onChange={(e) => setCustomDimensions(prev => ({ width: prev?.width || videoWidth, height: parseInt(e.target.value) || 1334 }))}
                                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:border-sky-500 outline-none"
                                />
                            </div>
                            <button 
                                onClick={() => { setSvgaPos({x:0, y:0}); setSvgaScale(1); }}
                                className="col-span-2 py-3 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-xl text-[10px] font-black uppercase hover:bg-sky-500/20 transition-all flex items-center justify-center gap-2 group"
                            >
                                <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                                وسطنة وتناسب تلقائي (Auto Center & Fit)
                            </button>
                        </div>
                    </div>

                    {selectedKeys.size === 1 && (
                        <div className="space-y-6 pb-6 border-b border-white/5">
                            <div className="flex justify-between items-center">
                                <h4 className="text-white font-black text-xs uppercase tracking-widest text-sky-400">تحويلات الطبقة المحددة</h4>
                                <button onClick={() => setSelectedKeys(new Set())} className="text-[9px] text-slate-500 hover:text-white">إلغاء التحديد</button>
                            </div>
                            <div className="space-y-4">
                               {(() => {
                                   const key = Array.from(selectedKeys)[0] as string;
                                   // Find current sprite values
                                   const sprite = metadata.videoItem?.sprites?.find((s: any) => s.imageKey === key);
                                   const frame = sprite?.frames?.[currentFrame] || sprite?.frames?.[0];
                                   
                                   if (!frame || !frame.layout) return <div className="text-slate-500 text-[10px]">لا يمكن تعديل أبعاد هذه الطبقة</div>;

                                   const { x, y, width, height } = frame.layout;
                                   const isHidden = frame.alpha === 0;
                                   const currentRotation = frame.transform ? Math.round(Math.atan2(frame.transform.b, frame.transform.a) * 180 / Math.PI) : 0;

                                   return (
                                       <>
                                           {/* Directional Controls (Prominent) */}
                                           <div className="py-6 border-b border-white/5 mb-6">
                                               <div className="flex justify-between items-center mb-4">
                                                   <h5 className="text-[11px] font-black text-white uppercase tracking-wider">تحريك (Move)</h5>
                                                   <div className="flex bg-slate-900 rounded-lg p-0.5 border border-white/10">
                                                       {[1, 5, 10, 50, 100].map(step => (
                                                           <button 
                                                               key={step}
                                                               onClick={() => setMoveStep(step)}
                                                               className={`px-2 py-1 text-[9px] font-bold rounded-md transition-all ${moveStep === step ? 'bg-sky-500 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                                                           >
                                                               {step}px
                                                           </button>
                                                       ))}
                                                   </div>
                                               </div>

                                               {/* Scale Controls */}
                                               <div className="flex items-center justify-between bg-slate-900/50 rounded-xl p-2 mb-4 border border-white/5">
                                                   <span className="text-[10px] font-black text-slate-400 px-2">الحجم (Scale)</span>
                                                   <div className="flex gap-2">
                                                       <button 
                                                           onClick={() => handleScaleSprite(key, 0.9)}
                                                           className="w-8 h-8 bg-slate-800 hover:bg-sky-500 border border-white/10 rounded-lg text-white flex items-center justify-center transition-all active:scale-90"
                                                           title="تصغير"
                                                       >
                                                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                                                       </button>
                                                       <button 
                                                           onClick={() => handleScaleSprite(key, 1.1)}
                                                           className="w-8 h-8 bg-slate-800 hover:bg-sky-500 border border-white/10 rounded-lg text-white flex items-center justify-center transition-all active:scale-90"
                                                           title="تكبير"
                                                       >
                                                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                                       </button>
                                                   </div>
                                               </div>

                                               {/* Rotation Control */}
                                               <div className="bg-slate-900/50 rounded-xl p-3 mb-4 border border-white/5">
                                                   <div className="flex justify-between mb-2">
                                                       <span className="text-[10px] font-black text-slate-400 uppercase">تدوير (Rotate)</span>
                                                       <span className="text-[10px] font-mono text-sky-400">{currentRotation}°</span>
                                                   </div>
                                                   <input 
                                                       type="range" 
                                                       min="-180" 
                                                       max="180" 
                                                       value={currentRotation} 
                                                       onChange={(e) => handleRotateSprite(key, parseInt(e.target.value))}
                                                       className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
                                                   />
                                               </div>
                                               
                                               <div className="grid grid-cols-3 gap-3 max-w-[160px] mx-auto mb-6">
                                                   <div className="col-start-2">
                                                       <button onClick={() => handleShiftSprite(key, { y: -moveStep })} className="w-full aspect-square bg-slate-800 hover:bg-sky-500 border border-white/10 hover:border-sky-400 rounded-xl text-white transition-all flex items-center justify-center active:scale-90 shadow-lg shadow-black/20 group">
                                                           <svg className="w-6 h-6 group-hover:-translate-y-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" /></svg>
                                                       </button>
                                                   </div>
                                                   <div className="col-start-1 row-start-2">
                                                       <button onClick={() => handleShiftSprite(key, { x: -moveStep })} className="w-full aspect-square bg-slate-800 hover:bg-sky-500 border border-white/10 hover:border-sky-400 rounded-xl text-white transition-all flex items-center justify-center active:scale-90 shadow-lg shadow-black/20 group">
                                                           <svg className="w-6 h-6 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                                                       </button>
                                                   </div>
                                                   <div className="col-start-2 row-start-2 flex items-center justify-center">
                                                       <div className="w-3 h-3 bg-sky-500 rounded-full shadow-[0_0_10px_rgba(14,165,233,0.5)]"></div>
                                                   </div>
                                                   <div className="col-start-3 row-start-2">
                                                       <button onClick={() => handleShiftSprite(key, { x: moveStep })} className="w-full aspect-square bg-slate-800 hover:bg-sky-500 border border-white/10 hover:border-sky-400 rounded-xl text-white transition-all flex items-center justify-center active:scale-90 shadow-lg shadow-black/20 group">
                                                           <svg className="w-6 h-6 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                                                       </button>
                                                   </div>
                                                   <div className="col-start-2 row-start-3">
                                                       <button onClick={() => handleShiftSprite(key, { y: moveStep })} className="w-full aspect-square bg-slate-800 hover:bg-sky-500 border border-white/10 hover:border-sky-400 rounded-xl text-white transition-all flex items-center justify-center active:scale-90 shadow-lg shadow-black/20 group">
                                                           <svg className="w-6 h-6 group-hover:translate-y-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                                                       </button>
                                                   </div>
                                               </div>

                                               <div className="grid grid-cols-2 gap-3">
                                                   <button 
                                                       onClick={() => handleToggleVisibility(key)}
                                                       className={`py-3 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all ${isHidden ? 'bg-slate-800 text-slate-400 border border-white/10' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}
                                                   >
                                                       {isHidden ? (
                                                           <>
                                                               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                                                               إظهار (Show)
                                                           </>
                                                       ) : (
                                                           <>
                                                               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                               إخفاء (Hide)
                                                           </>
                                                       )}
                                                   </button>
                                                   <button 
                                                       onClick={() => setBgRemoveTarget(key)}
                                                       className="py-3 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl text-[10px] font-black text-rose-400 hover:text-rose-300 transition-all flex items-center justify-center gap-2"
                                                   >
                                                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                       إزالة الخلفية
                                                   </button>
                                                   <button 
                                                       onClick={() => handleDuplicateSprite(key)}
                                                       className="py-3 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-xl text-[10px] font-black text-indigo-400 hover:text-indigo-300 transition-all flex items-center justify-center gap-2"
                                                   >
                                                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                                                       نسخ (Duplicate)
                                                   </button>
                                                   
                                                   {/* Mirror Copy */}
                                                   <button 
                                                       onClick={() => handleMirrorCopy(key)}
                                                       className="py-3 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-xl text-[10px] font-black text-indigo-400 hover:text-indigo-300 transition-all flex items-center justify-center gap-2"
                                                   >
                                                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                                                       نسخ وعكس (Mirror Copy)
                                                   </button>
                                                   <button 
                                                       onClick={() => handleDuplicatePair(key)}
                                                       className="col-span-2 py-3 bg-fuchsia-500/10 hover:bg-fuchsia-500/20 border border-fuchsia-500/20 rounded-xl text-[10px] font-black text-fuchsia-400 hover:text-fuchsia-300 transition-all flex items-center justify-center gap-2"
                                                   >
                                                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                                       نسخ مزدوج (Pair Copy)
                                                   </button>
                                                   <button 
                                                       onClick={() => handleSwitchLayer(key)}
                                                       className="py-3 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 rounded-xl text-[10px] font-black text-violet-400 hover:text-violet-300 transition-all flex items-center justify-center gap-2"
                                                   >
                                                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                                                       تبديل (Switch)
                                                   </button>

                                                   {/* Flip Controls */}
                                                   <button 
                                                       onClick={() => handleFlipSprite(key, 'horizontal')}
                                                       className="py-3 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-xl text-[10px] font-black text-slate-400 hover:text-white transition-all flex items-center justify-center gap-2"
                                                   >
                                                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" transform="rotate(90 12 12)" /></svg>
                                                       عكس أفقي
                                                   </button>
                                                   <button 
                                                       onClick={() => handleFlipSprite(key, 'vertical')}
                                                       className="py-3 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-xl text-[10px] font-black text-slate-400 hover:text-white transition-all flex items-center justify-center gap-2"
                                                   >
                                                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>
                                                       عكس رأسي
                                                   </button>

                                                   {/* Order Controls */}
                                                   <div className="col-span-2 grid grid-cols-4 gap-2">
                                                       <button 
                                                           onClick={() => handleReorderSprite(key, 'bottom')}
                                                           className="py-3 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-xl text-[10px] font-black text-slate-400 hover:text-white transition-all flex items-center justify-center"
                                                           title="إلى الخلفية تماماً"
                                                       >
                                                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 13l-7 7-7-7m14-8l-7 7-7-7" /></svg>
                                                       </button>
                                                       <button 
                                                           onClick={() => handleReorderSprite(key, 'down')}
                                                           className="py-3 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-xl text-[10px] font-black text-slate-400 hover:text-white transition-all flex items-center justify-center"
                                                           title="طبقة للأسفل"
                                                       >
                                                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                                       </button>
                                                       <button 
                                                           onClick={() => handleReorderSprite(key, 'up')}
                                                           className="py-3 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-xl text-[10px] font-black text-slate-400 hover:text-white transition-all flex items-center justify-center"
                                                           title="طبقة للأعلى"
                                                       >
                                                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                                                       </button>
                                                       <button 
                                                           onClick={() => handleReorderSprite(key, 'top')}
                                                           className="py-3 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-xl text-[10px] font-black text-slate-400 hover:text-white transition-all flex items-center justify-center"
                                                           title="إلى المقدمة تماماً"
                                                       >
                                                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 11l7-7 7 7M5 19l7-7 7 7" /></svg>
                                                       </button>
                                                   </div>
                                               </div>
                                           </div>
                                       </>
                                   );
                               })()}
                            </div>
                        </div>
                    )}

                    <div className="space-y-6">
                        <h4 className="text-white font-black text-xs uppercase tracking-widest text-sky-400">تحويلات الهدية (SVGA)</h4>
                        <div className="space-y-4">
                           <TransformControl label="الموضع الأفقي (X)" value={svgaPos.x} min={-500} max={500} onChange={v => setSvgaPos(p => ({ ...p, x: v }))} />
                           <TransformControl label="الموضع الرأسي (Y)" value={svgaPos.y} min={-800} max={800} onChange={v => setSvgaPos(p => ({ ...p, y: v }))} />
                           <TransformControl label="مقياس الحجم" value={svgaScale} min={0.1} max={3} step={0.01} onChange={v => setSvgaScale(v)} />
                        </div>
                    </div>

                    <div className="space-y-6 pt-6 border-t border-white/5">
                        <h4 className="text-white font-black text-xs uppercase tracking-widest text-indigo-400">تحويلات العلامة المائية</h4>
                        <div className="space-y-4">
                           <TransformControl label="الموضع الأفقي (X)" value={wmPos.x} min={-500} max={500} onChange={v => setWmPos(p => ({ ...p, x: v }))} />
                           <TransformControl label="الموضع الرأسي (Y)" value={wmPos.y} min={-800} max={800} onChange={v => setWmPos(p => ({ ...p, y: v }))} />
                           <TransformControl label="الحجم" value={wmScale} min={0.05} max={1} step={0.01} onChange={v => setWmScale(v)} />
                        </div>
                    </div>

                    <div className="space-y-6 pt-6 border-t border-white/5">
                        <h4 className="text-white font-black text-xs uppercase tracking-widest text-emerald-400">تحويلات الخلفية</h4>
                        <div className="space-y-4">
                           <TransformControl label="تكبير الخلفية" value={bgScale} min={100} max={300} onChange={v => setBgScale(v)} />
                           <TransformControl label="الموضع X" value={bgPos.x} min={0} max={100} onChange={v => setBgPos(p => ({ ...p, x: v }))} />
                           <TransformControl label="الموضع Y" value={bgPos.y} min={0} max={100} onChange={v => setBgPos(p => ({ ...p, y: v }))} />
                        </div>
                    </div>
                </div>
              )}

              {activeSideTab === 'bg' && (
                <div className="space-y-8 animate-in fade-in duration-300">
                    <div className="grid grid-cols-2 gap-4">
                       <button onClick={() => bgInputRef.current?.click()} className="py-4 bg-white/5 border border-white/5 rounded-2xl text-[10px] text-white font-black uppercase">رفع خلفية</button>
                       <button onClick={() => watermarkInputRef.current?.click()} className="py-4 bg-white/5 border border-white/5 rounded-2xl text-[10px] text-white font-black uppercase">رفع علامة</button>
                       <div className="flex gap-2 col-span-1">
                           <button onClick={() => audioInputRef.current?.click()} className={`flex-1 py-4 border border-white/5 rounded-2xl text-[10px] font-black uppercase ${audioUrl ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-white/5 text-white'}`}>{audioUrl ? 'تغيير الصوت' : 'رفع صوت'}</button>
                           {audioUrl && (
                               <button onClick={handleRemoveAudio} className="w-12 flex items-center justify-center bg-red-500/20 border border-red-500/30 rounded-2xl text-red-400 hover:bg-red-500/30 transition-all" title="إزالة الصوت">
                                   <Trash2 className="w-4 h-4" />
                               </button>
                           )}
                       </div>
                       {displayedFormats.includes('VAP (MP4)') && (
                       <div className="flex gap-2">
                           <button onClick={() => { setSelectedFormat('VAP (MP4)'); handleMainExport('VAP (MP4)'); }} className="flex-1 py-4 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-2xl text-[10px] font-black uppercase hover:bg-indigo-500/30 transition-all">تصدير VAP (flutter_vap_plus)</button>
                           <button onClick={() => setShowVapHelp(true)} className="w-12 flex items-center justify-center bg-white/5 border border-white/5 rounded-2xl text-white hover:bg-white/10 transition-all">
                               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                           </button>
                       </div>
                       )}
                       <button onClick={() => videoInputRef.current?.click()} className="py-4 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-2xl text-[10px] font-black uppercase">استيراد ملف (فيديو/GIF/WebP)</button>
                       <button onClick={() => setShowRecordingModal(true)} className="col-span-2 py-4 bg-red-500/20 text-red-400 border border-red-500/30 rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-2">
                          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                          تسجيل فيديو (Screen Record)
                       </button>
                       {originalAudioUrl && (
                           <button onClick={() => { const link = document.createElement('a'); link.href = originalAudioUrl; link.download = `${metadata.name.replace('.svga', '')}_audio.mp3`; link.click(); }} className="py-4 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-2xl text-[10px] font-black uppercase">تنزيل الصوت الأصلي</button>
                       )}
                    </div>

                    {presetBgs.length > 0 && (
                        <div className="space-y-4 pt-4 border-t border-white/5">
                            <h4 className="text-white font-black text-xs uppercase tracking-widest text-sky-400 mb-2">خلفيات جاهزة</h4>
                            <div className="grid grid-cols-3 gap-2">
                                <button 
                                    onClick={() => selectPresetBg(null)}
                                    className={`aspect-square rounded-xl border flex items-center justify-center text-[10px] font-black text-slate-500 hover:text-white transition-all ${activePreset === 'none' ? 'border-sky-500 bg-sky-500/10 text-sky-400' : 'border-white/5 bg-white/5'}`}
                                >
                                    بدون
                                </button>
                                {presetBgs.map(bg => (
                                    <button
                                        key={bg.id}
                                        onClick={() => selectPresetBg(bg)}
                                        className={`relative aspect-square rounded-xl border overflow-hidden transition-all group ${activePreset === bg.id ? 'border-sky-500 ring-2 ring-sky-500/20' : 'border-white/5 hover:border-white/20'}`}
                                    >
                                        <img src={bg.url} className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                            <span className="text-[8px] text-white font-black">{bg.label}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    

                    
                    {audioUrl && (
                        <div className="space-y-4 pt-4 border-t border-white/5">
                            <div className="flex items-center justify-between">
                                <h4 className="text-white font-black text-xs uppercase tracking-widest text-emerald-400">التحكم بالصوت</h4>
                                <button onClick={() => setIsMuted(!isMuted)} className={`text-[10px] font-black uppercase ${isMuted ? 'text-red-500' : 'text-emerald-400'}`}>{isMuted ? 'تم كتم الصوت' : 'مفعل'}</button>
                            </div>
                            <TransformControl label="مستوى الصوت" value={volume * 100} min={0} max={100} step={1} onChange={v => setVolume(v / 100)} />
                        </div>
                    )}

                    {showRecordingModal && (
                        <div className="fixed inset-0 z-[400] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 animate-in zoom-in duration-300">
                            <div className="bg-slate-900 border border-white/10 p-8 rounded-[3rem] w-full max-w-md shadow-3xl text-center space-y-6">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-white font-black text-lg uppercase tracking-tighter">{t('recording_window')}</h3>
                                    <button onClick={() => setShowRecordingModal(false)} className="text-slate-500 hover:text-white">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                                
                                <div className="bg-black/40 rounded-2xl p-6 border border-white/5 space-y-4">
                                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                        <span className="text-slate-500 text-[10px] font-black uppercase">{t('dimensions')}</span>
                                        <span className="text-sky-400 font-mono font-bold">{videoWidth} x {videoHeight}</span>
                                    </div>
                                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                        <span className="text-slate-500 text-[10px] font-black uppercase">{t('duration')}</span>
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="number" 
                                                min="1" 
                                                step="0.1"
                                                value={recordingDuration} 
                                                onChange={(e) => setRecordingDuration(parseFloat(e.target.value))}
                                                className="w-20 bg-black/50 border border-white/10 rounded-lg px-3 py-1 text-right text-sky-400 font-mono font-bold text-xs focus:outline-none focus:border-sky-500 transition-colors"
                                            />
                                            <span className="text-slate-500 text-[10px]">s</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-500 text-[10px] font-black uppercase">{t('frames')}</span>
                                        <span className="text-sky-400 font-mono font-bold">{metadata.frames} Frame</span>
                                    </div>
                                    <div className="flex justify-between items-center pt-2 border-t border-white/5">
                                        <span className="text-slate-500 text-[10px] font-black uppercase">صيغة التصدير</span>
                                        <div className="flex bg-black/50 rounded-lg p-1 border border-white/10">
                                            <button 
                                                onClick={() => setRecordingFormat('mp4')}
                                                className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${recordingFormat === 'mp4' ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20' : 'text-slate-500 hover:text-white'}`}
                                            >
                                                MP4
                                            </button>
                                            <button 
                                                onClick={() => setRecordingFormat('webm')}
                                                className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${recordingFormat === 'webm' ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20' : 'text-slate-500 hover:text-white'}`}
                                            >
                                                WebM
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 bg-sky-500/10 border border-sky-500/20 rounded-2xl">
                                    <p className="text-[10px] text-sky-300 font-bold">
                                        {t('recording_note')}
                                    </p>
                                </div>

                                <button 
                                    onClick={handleExportStandardVideo}
                                    className="w-full py-5 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-glow-red transition-all active:scale-95 flex items-center justify-center gap-3"
                                >
                                    <span className="w-3 h-3 bg-white rounded-full animate-pulse"></span>
                                    {t('start_recording')}
                                </button>
                                <style>{`.shadow-glow-red { box-shadow: 0 0 30px rgba(239, 68, 68, 0.4); }`}</style>
                            </div>
                        </div>
                    )}

                    {showVapHelp && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                            <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden shadow-2xl flex flex-col">
                                <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
                                    <h3 className="text-white font-bold text-sm">{t('vap_docs')}</h3>
                                    <button onClick={() => setShowVapHelp(false)} className="text-white/50 hover:text-white transition-colors">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                                <div className="p-6 overflow-y-auto space-y-6 text-gray-300 text-sm leading-relaxed" dir="ltr">
                                    <div className={`space-y-4 ${dir === 'rtl' ? 'text-right' : 'text-left'}`} dir={dir}>
                                        <h4 className="text-white font-bold text-base border-b border-white/10 pb-2 mb-4">{t('installation')}</h4>
                                        
                                        <div className="space-y-2">
                                            <p className="text-slate-400 font-bold text-xs">{t('run_command')}</p>
                                            <div className="bg-black/50 rounded-lg p-3 font-mono text-xs border border-white/5 text-left text-sky-400" dir="ltr">
                                                $ flutter pub add flutter_vap_plus
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <p className="text-slate-400 font-bold text-xs">{t('add_to_pubspec')}</p>
                                            <div className="bg-black/50 rounded-lg p-3 font-mono text-xs border border-white/5 text-left text-emerald-400" dir="ltr">
                                                dependencies:
                                                  flutter_vap_plus: ^1.2.10
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <p className="text-slate-400 font-bold text-xs">{t('import_dart')}</p>
                                            <div className="bg-black/50 rounded-lg p-3 font-mono text-xs border border-white/5 text-left text-indigo-400" dir="ltr">
                                                import 'package:flutter_vap_plus/flutter_vap_plus.dart';
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <h4 className="text-white font-bold text-base">{t('complete_example')}</h4>
                                        <div className="bg-black/50 rounded-lg p-3 font-mono text-xs border border-white/5 whitespace-pre overflow-x-auto h-96 custom-scrollbar">
{`import 'dart:io';

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/services.dart';

import 'package:flutter_vap_plus/flutter_vap_plus.dart';
import 'package:oktoast/oktoast.dart';
import 'package:path_provider/path_provider.dart';

void main() {
  runApp(MyApp());
}

class MyApp extends StatefulWidget {
  @override
  _MyAppState createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  List<String> downloadPathList = [];
  bool isDownload = false;
  VapController? vapController;
  VapScaleFit vapScaleFit = VapScaleFit.FIT_XY;

  @override
  void initState() {
    super.initState();
    initDownloadPath();
  }

  Future<void> initDownloadPath() async {
    Directory appDocDir = await getApplicationDocumentsDirectory();
    String rootPath = appDocDir.path;
    downloadPathList = ["$rootPath/vap_demo1.mp4", "$rootPath/vap_demo2.mp4"];
    print("downloadPathList:$downloadPathList");
  }

  @override
  Widget build(BuildContext context) {
    return OKToast(
      child: MaterialApp(
        home: Scaffold(
          body: Container(
            width: double.infinity,
            height: double.infinity,
            decoration: BoxDecoration(
              color: Color.fromARGB(255, 100, 241, 243),
              // image: DecorationImage(image: AssetImage("static/bg.jpeg")),
            ),
            child: Stack(
              alignment: Alignment.bottomCenter,
              children: [
                Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    CupertinoButton(
                      color: Colors.purple,
                      child: Text(
                          "download video source\${isDownload ? "(✅)" : ""}"),
                      onPressed: _download,
                    ),
                    CupertinoButton(
                      color: Colors.purple,
                      child: Text("File1 play"),
                      onPressed: () => _playFile(downloadPathList[0]),
                    ),
                    CupertinoButton(
                      color: Colors.purple,
                      child: Text("File2 play"),
                      onPressed: () => _playFile(downloadPathList[1]),
                    ),
                    CupertinoButton(
                      color: Colors.purple,
                      child: Text("asset play"),
                      onPressed: () => _playAsset("static/demo.mp4"),
                    ),
                    Builder(builder: (context) {
                      return CupertinoButton(
                        color: Colors.purple,
                        child: Text("fusion animation play"),
                        onPressed: () {
                          showDialog<void>(
                            context: context,
                            barrierDismissible: true,
                            // false = user must tap button, true = tap outside dialog
                            builder: (BuildContext dialogContext) {
                              return AlertDialog(
                                backgroundColor: Colors.transparent,
                                content: GestureDetector(
                                  onTap: () {
                                    Navigator.of(context).pop();
                                  },
                                  child: SizedBox(
                                    width: double.infinity,
                                    height: double.infinity,
                                    child: IgnorePointer(
                                      child: VapView(
                                          fit: VapScaleFit.FIT_CENTER,
                                          onControllerCreated:
                                              (controller) async {
                                            var avatarFile =
                                                await _getImageFileFromAssets(
                                                    'static/bg.jpeg');
                                            await controller.playAsset(
                                                'static/video.mp4',
                                                fetchResources: [
                                                  FetchResourceModel(
                                                      tag: '01',
                                                      resource: '测试文本01'),
                                                  FetchResourceModel(
                                                      tag: '02',
                                                      resource: '测试文本02'),
                                                  FetchResourceModel(
                                                      tag: '03',
                                                      resource:
                                                          avatarFile.path),
                                                ]);

                                            Navigator.of(context).pop();
                                          }),
                                    ),
                                  ),
                                ),
                              );
                            },
                          );
                        },
                      );
                    }),
                    CupertinoButton(
                      color: Colors.purple,
                      child: Text("stop play"),
                      onPressed: () => vapController?.stop(),
                    ),
                    CupertinoButton(
                      color: Colors.purple,
                      child: Text("queue play"),
                      onPressed: _queuePlay,
                    ),
                  ],
                ),
                Positioned.fill(
                    child: IgnorePointer(
                  // VapView可以通过外层包Container(),设置宽高来限制弹出视频的宽高
                  // VapView can set the width and height through the outer package Container() to limit the width and height of the pop-up video
                  child: VapView(
                    fit: VapScaleFit.FIT_XY,
                    onEvent: (event, args) {
                      debugPrint('VapView event:\${event}');
                    },
                    onControllerCreated: (controller) {
                      vapController = controller;
                    },
                  ),
                )),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<File> _getImageFileFromAssets(String path) async {
    Directory tempDir = await getTemporaryDirectory();
    String tempPath = tempDir.path;
    var filePath = "$tempPath/$path";
    var file = File(filePath);
    if (file.existsSync()) {
      return file;
    } else {
      final byteData = await rootBundle.load(path);
      final buffer = byteData.buffer;
      await file.create(recursive: true);
      return file.writeAsBytes(
          buffer.asUint8List(byteData.offsetInBytes, byteData.lengthInBytes));
    }
  }

  _download() async {
    await Dio().download(
        "https://res.cloudinary.com/dkmchpua1/video/upload/v1737623468/zta2wxsuokcskw0bhar7.mp4",
        downloadPathList[0]);
    await Dio().download(
        "https://res.cloudinary.com/dkmchpua1/video/upload/v1737624783/vcg9co6yyfqsadgety1n.mp4",
        downloadPathList[1]);
    setState(() {
      isDownload = true;
    });
  }

  Future<void> _playFile(String path,
      {List<FetchResourceModel> fetchResources = const []}) async {
    try {
      await vapController?.playPath(path, fetchResources: fetchResources);
    } catch (e, s) {
      print(s);
    }
  }

  Future<void> _playAsset(String asset,
      {List<FetchResourceModel> fetchResources = const []}) async {
    await vapController?.playAsset(asset, fetchResources: fetchResources);
  }

  Future<void> _queuePlay() async {
    // 模拟多个地方同时调用播放,使得按顺序执行播放。
    // Simultaneously call playback in multiple places, making the queue perform playback.
    await vapController?.playPath(downloadPathList[0]);
    await vapController?.playPath(downloadPathList[1]);
    await _playAsset("static/demo.mp4");
  }
}`}
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4 border-t border-white/10 bg-white/5 flex justify-end">
                                    <button 
                                        onClick={() => setShowVapHelp(false)}
                                        className="px-6 py-2 bg-white/10 text-white rounded-lg text-sm font-bold hover:bg-white/20 transition-colors"
                                    >
                                        إغلاق
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}


                    {exportedVapUrl && (
                        <div className="space-y-4 pt-6 border-t border-white/5 animate-in fade-in slide-in-from-bottom-4">
                            <h4 className="text-white font-black text-xs uppercase tracking-widest text-sky-400">معاينة VAP (MP4)</h4>
                            <div className="relative rounded-2xl overflow-hidden border border-white/10 aspect-video flex items-center justify-center" style={{
                                backgroundImage: `
                                    linear-gradient(45deg, #334155 25%, transparent 25%), 
                                    linear-gradient(-45deg, #334155 25%, transparent 25%), 
                                    linear-gradient(45deg, transparent 75%, #334155 75%), 
                                    linear-gradient(-45deg, transparent 75%, #334155 75%)
                                `,
                                backgroundSize: '20px 20px',
                                backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                                backgroundColor: '#0f172a'
                            }}>
                                <VapPlayer 
                                    src={exportedVapUrl} 
                                    width={videoWidth}
                                    height={videoHeight}
                                    className="w-full h-full"
                                />
                            </div>
                            <a 
                                href={exportedVapUrl} 
                                download={`${metadata.name.replace('.svga', '')}_VAP.mp4`}
                                className="block w-full py-3 bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded-xl text-center text-[10px] font-black uppercase hover:bg-sky-500/30 transition-colors"
                            >
                                تحميل الفيديو مرة أخرى
                            </a>
                        </div>
                    )}
                    
                    <div className="space-y-6 pt-4 border-t border-white/5">
                        <h5 className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Layers className="w-3 h-3" />
                            تدرج الشفافية (Edge Fade)
                        </h5>
                        <div className="grid grid-cols-2 gap-6">
                            {['top', 'bottom', 'left', 'right'].map((dir) => (
                                <div key={dir} className="space-y-3">
                                    <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase">
                                        <span>{dir === 'top' ? 'أعلى (Top)' : dir === 'bottom' ? 'أسفل (Bottom)' : dir === 'left' ? 'يسار (Left)' : 'يمين (Right)'}</span>
                                        <span className="text-sky-400">{fadeConfig[dir as keyof typeof fadeConfig]}%</span>
                                    </div>
                                    <input 
                                        type="range" min="0" max="100" value={fadeConfig[dir as keyof typeof fadeConfig]} 
                                        onChange={(e) => setFadeConfig(p => ({...p, [dir]: parseInt(e.target.value)}))}
                                        className="w-full h-1 bg-white/5 rounded-lg appearance-none cursor-pointer accent-sky-500"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>


                </div>
              )}

              {activeSideTab === 'optimize' && (
                <div className="space-y-8 animate-in fade-in duration-300">
                    <div className="bg-slate-950/40 p-6 rounded-[2rem] border border-white/5 space-y-6">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-1 h-4 bg-emerald-500 rounded-full"></div>
                            <h4 className="text-white font-black text-xs uppercase tracking-widest">إعدادات الضغط والسرعة</h4>
                        </div>

                        <div className="grid gap-4">
                            {/* Compression */}
                            <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center justify-between hover:bg-white/[0.07] transition-all group">
                                <div className="flex flex-col gap-1">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider group-hover:text-emerald-400 transition-colors">نسبة الضغط</span>
                                    <span className="text-[8px] text-slate-600">القيمة الأقل = حجم أصغر</span>
                                </div>
                                <div className="flex items-center bg-black/50 rounded-xl border border-white/10 px-4 py-2 group-hover:border-emerald-500/30 transition-all">
                                    <input 
                                        type="number" 
                                        value={optimizeQuality}
                                        onChange={(e) => setOptimizeQuality(Math.min(100, Math.max(1, parseInt(e.target.value) || 50)))}
                                        className="w-12 bg-transparent text-center text-white font-mono font-bold text-lg outline-none"
                                    />
                                    <span className="text-emerald-500 font-bold text-xs ml-1">%</span>
                                </div>
                            </div>

                            {/* FPS */}
                            <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center justify-between hover:bg-white/[0.07] transition-all group">
                                <div className="flex flex-col gap-1">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider group-hover:text-purple-400 transition-colors">سرعة الإطارات</span>
                                    <span className="text-[8px] text-slate-600">عدد الإطارات في الثانية</span>
                                </div>
                                <div className="flex items-center bg-black/50 rounded-xl border border-white/10 px-4 py-2 group-hover:border-purple-500/30 transition-all">
                                    <input 
                                        type="number" 
                                        step="0.01"
                                        value={metadata.fps || 30}
                                        onChange={(e) => setMetadata({...metadata, fps: Math.min(120, Math.max(1, parseFloat(e.target.value) || 30))})}
                                        className="w-16 bg-transparent text-center text-white font-mono font-bold text-lg outline-none"
                                    />
                                    <span className="text-purple-500 font-bold text-xs ml-1">FPS</span>
                                </div>
                            </div>

                            {/* Duration (Seconds) */}
                            <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center justify-between hover:bg-white/[0.07] transition-all group">
                                <div className="flex flex-col gap-1">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider group-hover:text-sky-400 transition-colors">مدة العرض (ثواني)</span>
                                    <span className="text-[8px] text-slate-600">تعديل المدة الإجمالية</span>
                                </div>
                                <div className="flex items-center bg-black/50 rounded-xl border border-white/10 px-4 py-2 group-hover:border-sky-500/30 transition-all">
                                    <input 
                                        type="number" 
                                        step="0.1"
                                        value={((metadata.frames || 0) / (metadata.fps || 30)).toFixed(2)}
                                        onChange={(e) => {
                                            const duration = parseFloat(e.target.value);
                                            if (duration > 0 && metadata.frames) {
                                                const newFps = metadata.frames / duration;
                                                setMetadata({...metadata, fps: Math.min(120, Math.max(1, newFps))});
                                            }
                                        }}
                                        className="w-16 bg-transparent text-center text-white font-mono font-bold text-lg outline-none"
                                    />
                                    <span className="text-sky-500 font-bold text-xs ml-1">SEC</span>
                                </div>
                            </div>
                        </div>

                        <button 
                            onClick={handleOptimizeAssets}
                            disabled={isOptimizing}
                            className={`w-full py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${isOptimizing ? 'bg-slate-800 text-slate-600' : 'bg-emerald-500 text-white shadow-glow-emerald hover:bg-emerald-400 hover:scale-[1.02]'}`}
                        >
                            {isOptimizing ? (
                                <>
                                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                    <span>جاري المعالجة...</span>
                                </>
                            ) : (
                                'تطبيق التغييرات'
                            )}
                        </button>
                        
                        <p className="text-[8px] text-center text-slate-500 font-black uppercase tracking-widest mt-2">
                            ملاحظة: هذا الإجراء سيقوم بتعديل الصور الحالية في الذاكرة.
                        </p>
                    </div>
                </div>
              )}
                    <div className="space-y-4 pt-4 border-t border-white/5">
                        <h4 className="text-white font-black text-xs uppercase tracking-widest text-emerald-400 mb-2">جودة التصدير (حجم الملف)</h4>
                        <div className="flex gap-1">
                            <button onClick={() => setGlobalQuality('low')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase border transition-all ${globalQuality === 'low' ? 'bg-emerald-500 text-white border-emerald-500 shadow-glow-emerald' : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'}`}>
                                منخفضة
                                <span className="block text-[8px] opacity-70 font-normal mt-1">حجم صغير</span>
                            </button>
                            <button onClick={() => setGlobalQuality('medium')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase border transition-all ${globalQuality === 'medium' ? 'bg-emerald-500 text-white border-emerald-500 shadow-glow-emerald' : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'}`}>
                                متوسطة
                                <span className="block text-[8px] opacity-70 font-normal mt-1">متوازن</span>
                            </button>
                            <button onClick={() => setGlobalQuality('high')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase border transition-all ${globalQuality === 'high' ? 'bg-emerald-500 text-white border-emerald-500 shadow-glow-emerald' : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'}`}>
                                عالية
                                <span className="block text-[8px] opacity-70 font-normal mt-1">أفضل دقة</span>
                            </button>
                        </div>
                    </div>

              {/* VAP 1.0.5 Special Button - Only visible if allowed */}
              {displayedFormats.includes('VAP 1.0.5') && (
                  <button 
                    onClick={() => handleVAP105Export(false)}
                    className="w-full py-4 mb-4 text-[11px] font-black rounded-xl shadow-glow-purple active:scale-95 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] bg-purple-600 hover:bg-purple-500 text-white"
                 >
                    🚀 تصدير VAP 1.0.5 (خاص)
                 </button>
              )}
             <div className="flex flex-wrap gap-2">
                {displayedFormats.filter(f => f !== 'VAP 1.0.5').map(f => {
                  const isSvga2 = f === 'SVGA 2.0';
                  const isLocked = isSvga2 && !currentUser?.hasSvgaExAccess && currentUser?.role !== 'admin';
                  return (
                    <button 
                      key={f} 
                      onClick={() => {
                        if (isLocked) {
                          alert("عذراً، هذه الميزة مغلقة لحسابك. يرجى التواصل مع الإدارة لتفعيلها.");
                          return;
                        }
                        setSelectedFormat(f);
                      }} 
                      className={`flex-1 py-3 px-2 rounded-xl text-[9px] font-black border transition-all whitespace-nowrap relative ${
                        selectedFormat === f 
                          ? 'bg-sky-500 text-white border-sky-400 shadow-glow-sky' 
                          : 'bg-slate-950/40 text-slate-300 border-white/5 hover:bg-white/5'
                      } ${isLocked ? 'opacity-70 grayscale-[0.5]' : ''}`}
                    >
                      <div className="flex items-center justify-center gap-1">
                        {isLocked && <Lock className="w-2.5 h-2.5 text-amber-500" />}
                        {f}
                      </div>
                    </button>
                  );
                })}
             </div>
             <button 
              onClick={handleMainExport} 
              className={`w-full py-5 text-white text-[11px] font-black rounded-[2rem] active:scale-95 transition-all ${
                mode === 'ex' 
                  ? 'bg-[#ff0000] hover:bg-red-600 shadow-glow-red' 
                  : 'bg-sky-500 hover:bg-sky-400 shadow-glow-sky'
              }`}
            >
              بدء التصدير الاحترافي
            </button>
          </div>
        </div>
      </div>

      {bgRemoveTarget && (
        <div className="fixed inset-0 z-[600] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-white/10 p-6 rounded-3xl w-full max-w-sm shadow-2xl space-y-6">
                <div className="flex justify-between items-center">
                    <h3 className="text-white font-black text-lg">إزالة الخلفية البيضاء</h3>
                    <button onClick={() => setBgRemoveTarget(null)} className="text-slate-500 hover:text-white">✕</button>
                </div>
                
                <div className="space-y-4">
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <label className="text-xs font-bold text-slate-400">درجة الحساسية (Tolerance)</label>
                            <span className="text-xs font-mono text-sky-400">{bgRemoveTolerance}</span>
                        </div>
                        <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={bgRemoveTolerance} 
                            onChange={(e) => setBgRemoveTolerance(parseInt(e.target.value))}
                            className="w-full h-2 bg-slate-800 rounded-full appearance-none accent-sky-500"
                        />
                        <p className="text-[10px] text-slate-500">كلما زادت القيمة، زاد مدى درجات اللون الأبيض التي يتم حذفها.</p>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button onClick={handleApplyBgRemoval} className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-bold text-sm transition-colors shadow-lg shadow-rose-500/20">
                        تطبيق الإزالة
                    </button>
                    <button onClick={() => setBgRemoveTarget(null)} className="px-6 py-3 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl font-bold text-sm transition-colors">
                        إلغاء
                    </button>
                </div>
            </div>
        </div>
      )}

      {fadeModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
                    <h3 className="text-white font-bold text-sm">تلاشي الحواف (Edge Fade)</h3>
                    <button onClick={() => setFadeModalTarget(null)} className="text-white/50 hover:text-white transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="p-6 space-y-6">
                    <div className="aspect-square bg-black/50 rounded-xl border border-white/5 flex items-center justify-center overflow-hidden relative">
                        {layerImages[fadeModalTarget] && (
                            <img 
                                src={layerImages[fadeModalTarget]} 
                                className="max-w-full max-h-full object-contain transition-all duration-300" 
                                style={{
                                    maskImage: `linear-gradient(to bottom, transparent, black ${fadeModalValues.top}%, black ${100 - fadeModalValues.bottom}%, transparent), linear-gradient(to right, transparent, black ${fadeModalValues.left}%, black ${100 - fadeModalValues.right}%, transparent)`,
                                    WebkitMaskImage: `linear-gradient(to bottom, transparent, black ${fadeModalValues.top}%, black ${100 - fadeModalValues.bottom}%, transparent), linear-gradient(to right, transparent, black ${fadeModalValues.left}%, black ${100 - fadeModalValues.right}%, transparent)`,
                                    maskComposite: 'intersect',
                                    WebkitMaskComposite: 'source-in'
                                }}
                            />
                        )}
                    </div>
                    <div className="space-y-4">
                        <TransformControl label="أعلى (Top)" value={fadeModalValues.top} min={0} max={50} step={1} onChange={v => setFadeModalValues(p => ({ ...p, top: v }))} />
                        <TransformControl label="أسفل (Bottom)" value={fadeModalValues.bottom} min={0} max={50} step={1} onChange={v => setFadeModalValues(p => ({ ...p, bottom: v }))} />
                        <TransformControl label="يسار (Left)" value={fadeModalValues.left} min={0} max={50} step={1} onChange={v => setFadeModalValues(p => ({ ...p, left: v }))} />
                        <TransformControl label="يمين (Right)" value={fadeModalValues.right} min={0} max={50} step={1} onChange={v => setFadeModalValues(p => ({ ...p, right: v }))} />
                    </div>
                </div>
                <div className="p-4 border-t border-white/10 bg-white/5 flex justify-end gap-2">
                    <button onClick={() => setFadeModalTarget(null)} className="px-4 py-2 bg-white/10 text-white rounded-lg text-xs font-bold hover:bg-white/20 transition-colors">إلغاء</button>
                    <button onClick={handleApplyFade} className="px-6 py-2 bg-emerald-500 text-white rounded-lg text-xs font-bold hover:bg-emerald-400 transition-colors shadow-glow-emerald">تطبيق التلاشي</button>
                </div>
            </div>
        </div>
      )}
      {exportResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-white/10 p-6 rounded-2xl w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4 text-center">تم التحويل بنجاح!</h3>
            
            <div className="bg-slate-800 p-4 rounded-xl mb-6">
              <label className="text-xs text-slate-400 mb-2 block">اسم الملف</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  readOnly 
                  value={exportResult.filename}
                  className="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                />
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(exportResult.filename);
                    alert('تم نسخ الاسم');
                  }}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  نسخ
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <a 
                href={exportResult.url} 
                download={exportResult.filename}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl text-center font-bold transition-colors flex items-center justify-center gap-2"
                onClick={() => setExportResult(null)}
              >
                <Download className="w-5 h-5" />
                تحميل الملف
              </a>
              <button 
                onClick={() => setExportResult(null)}
                className="px-4 py-3 rounded-xl border border-white/10 text-slate-300 hover:bg-white/5 transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const TransformControl: React.FC<{ label: string, value: number, min: number, max: number, step?: number, onChange: (v: number) => void }> = ({ label, value, min, max, step = 1, onChange }) => (
  <div className="space-y-2">
    <div className="flex justify-between items-center px-1">
      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
      <span className="text-[10px] font-bold text-white bg-white/5 px-2 py-0.5 rounded-lg border border-white/5">{value}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))} className="w-full h-1.5 bg-slate-800 rounded-full appearance-none accent-sky-500 cursor-pointer" />
  </div>
);
