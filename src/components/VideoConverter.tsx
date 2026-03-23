
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { FileMetadata, UserRecord } from '../types';
import { 
  Video, 
  Box, 
  Image as ImageIcon, 
  Film, 
  Download, 
  Settings2, 
  Zap, 
  ChevronLeft,
  Maximize,
  Moon,
  Layers,
  Music,
  Trash2,
  Scissors
} from 'lucide-react';
import { logActivity } from '../utils/logger';

import * as Mp4Muxer from 'mp4-muxer';

declare var SVGA: any;
declare var protobuf: any;
declare var pako: any;
declare var GIF: any;
declare var UPNG: any;
declare var WebMMuxer: any;

import { useAccessControl } from '../hooks/useAccessControl';

import { calculateSafeDimensions } from '../utils/dimensions';

interface VideoConverterProps {
  currentUser: UserRecord | null;
  onCancel: () => void;
  onLoginRequired: () => void;
  onSubscriptionRequired: () => void;
  globalQuality?: 'low' | 'medium' | 'high';
}

export const VideoConverter: React.FC<VideoConverterProps> = ({ currentUser, onCancel, onLoginRequired, onSubscriptionRequired, globalQuality: initialGlobalQuality = 'high' }) => {
  const { checkAccess } = useAccessControl();
  const [files, setFiles] = useState<File[]>([]);
  const [videoUrls, setVideoUrls] = useState<string[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [isMerging, setIsMerging] = useState(false);
  const [generateChecksum, setGenerateChecksum] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [compressionQuality, setCompressionQuality] = useState(80);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('');
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const ffmpegRef = useRef(new FFmpeg());
  const [selectedFormat, setSelectedFormat] = useState('VAP (MP4)');
  const [globalQuality, setGlobalQuality] = useState<'low' | 'medium' | 'high'>(initialGlobalQuality);
  const [exportScale, setExportScale] = useState(1.0);
  const [customWidth, setCustomWidth] = useState<number | ''>('');
  const [customHeight, setCustomHeight] = useState<number | ''>('');
  const [fps, setFps] = useState(30);
  const [customBitrate, setCustomBitrate] = useState<number | ''>('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [removeBlack, setRemoveBlack] = useState(false);
  const [removeWhite, setRemoveWhite] = useState(false);
  const [isVapInput, setIsVapInput] = useState(false);
  const [whiteTolerance, setWhiteTolerance] = useState(30);
  const [removeGreen, setRemoveGreen] = useState(false);
  const [removeBlue, setRemoveBlue] = useState(false);
  const [fadeConfig, setFadeConfig] = useState({ top: 0, bottom: 0, left: 0, right: 0 });
  
  const file = files[currentFileIndex] || null;
  const videoUrl = videoUrls[currentFileIndex] || null;

  useEffect(() => {
    const urls = files.map(f => URL.createObjectURL(f));
    setVideoUrls(urls);
    return () => urls.forEach(url => URL.revokeObjectURL(url));
  }, [files]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const [hiddenFormats, setHiddenFormats] = useState<string[]>(() => {
      const saved = localStorage.getItem('quantum_hidden_formats');
      return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    const loadFFmpeg = async () => {
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
      const ffmpeg = ffmpegRef.current;
      
      ffmpeg.on('log', ({ message }) => {
        console.log(message);
      });

      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      setFfmpegLoaded(true);
    };
    loadFFmpeg();
  }, []);

  useEffect(() => {
      const handleStorage = () => {
          const saved = localStorage.getItem('quantum_hidden_formats');
          if (saved) setHiddenFormats(JSON.parse(saved));
      };
      window.addEventListener('storage', handleStorage);
      return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const formats = [
    { id: 'MP4 (Standard)', name: 'MP4 (Standard)', icon: '🎬', cost: 1, desc: 'فيديو MP4 قياسي بجودة عالية' },
    { id: 'VAP (MP4)', name: 'VAP (Alpha+RGB)', icon: '📹', cost: 1, desc: 'فيديو مع قناة شفافية منفصلة' },
    { id: 'VAP 1.0.5', name: 'VAP 1.0.5 (Special)', icon: '🚀', cost: 1, desc: 'تصدير خاص VAP 1.0.5' },
    { id: 'SVGA 2.0', name: 'SVGA Animation', icon: '📦', cost: 1, desc: 'ملف SVGA متوافق مع تطبيقات البث' },
    { id: 'GIF (Animation)', name: 'GIF الشفاف', icon: '🖼️', cost: 1, desc: 'صور متحركة للمواقع والدردشة' },
    { id: 'APNG (Animation)', name: 'APNG الشفاف', icon: '🎞️', cost: 1, desc: 'جودة أعلى من GIF مع شفافية كاملة' },
    { id: 'WebP (Animated)', name: 'WebP متحرك', icon: '💫', cost: 1, desc: 'أفضل جودة وحجم للويب (Stickers)' },
    { id: 'WebM (Video)', name: 'WebM شفاف', icon: '🎥', cost: 1, desc: 'فيديو عالي الجودة للويب مع شفافية' },
  ].filter(f => {
    // Check local hidden formats
    if (hiddenFormats.includes(f.id)) return false;
    
    // Check admin restricted formats
    if (currentUser?.allowedExportFormat) {
        const allowed = Array.isArray(currentUser.allowedExportFormat) 
            ? currentUser.allowedExportFormat 
            : [currentUser.allowedExportFormat];
        return allowed.includes(f.id);
    }
    
    return true;
  });

  useEffect(() => {
      if (!formats.find(f => f.id === selectedFormat) && formats.length > 0) {
          setSelectedFormat(formats[0].id);
      }
  }, [formats, selectedFormat]);

  const applyTransparencyEffects = (ctx: CanvasRenderingContext2D, width: number, height: number, configOverride?: typeof fadeConfig) => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const currentFade = configOverride || fadeConfig;

    const fadeTopLimit = (height * currentFade.top) / 100;
    const fadeBottomLimit = height - (height * currentFade.bottom) / 100;
    const fadeLeftLimit = (width * currentFade.left) / 100;
    const fadeRightLimit = width - (width * currentFade.right) / 100;

    for (let i = 0; i < data.length; i += 4) {
      const x = (i / 4) % width;
      const y = Math.floor((i / 4) / width);

      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];
      let a = data[i + 3];

      // 1. Edge Fade Calculation
      let edgeAlpha = 1.0;
      if (currentFade.top > 0 && y < fadeTopLimit) edgeAlpha *= (y / fadeTopLimit);
      if (currentFade.bottom > 0 && y > fadeBottomLimit) edgeAlpha *= ((height - y) / (height - fadeBottomLimit));
      if (currentFade.left > 0 && x < fadeLeftLimit) edgeAlpha *= (x / fadeLeftLimit);
      if (currentFade.right > 0 && x > fadeRightLimit) edgeAlpha *= ((width - x) / (width - fadeRightLimit));

      // 2. Remove Black Logic (Enhanced with Tolerance)
      if (removeBlack) {
        const brightness = (r + g + b) / 3;
        const threshold = whiteTolerance * 3; // 30 -> 90
        if (brightness < threshold) {
          const factor = brightness / threshold;
          a = Math.min(a, 255 * factor);
          
          // Brighten to avoid dark fringes
          const boost = 1.0 - factor;
          r = Math.min(255, r + (255 - r) * boost * 0.8);
          g = Math.min(255, g + (255 - g) * boost * 0.8);
          b = Math.min(255, b + (255 - b) * boost * 0.8);
        }
      }

      // 3. Remove Green Logic (Chroma Key with Tolerance)
      if (removeGreen) {
        // Adjust sensitivity based on tolerance
        const sensitivity = Math.max(10, 70 - whiteTolerance);
        
        if (g > 100 && g > r + sensitivity && g > b + sensitivity) {
            const dominance = Math.min((g - Math.max(r, b)), 100) / 100; 
            a = Math.min(a, 255 * (1 - dominance));
            
            if (a < 255) {
                g = Math.min(g, Math.max(r, b));
            }
        }
      }

      // 3.5 Remove Blue Logic (Chroma Key with Tolerance)
      if (removeBlue) {
        const sensitivity = Math.max(10, 70 - whiteTolerance);
        
        if (b > 100 && b > r + sensitivity && b > g + sensitivity) {
            const dominance = Math.min((b - Math.max(r, g)), 100) / 100; 
            a = Math.min(a, 255 * (1 - dominance));
            
            if (a < 255) {
                b = Math.min(b, Math.max(r, g));
            }
        }
      }

      // 4. Remove White Logic (Professional & Color Safe)
      if (removeWhite) {
        const dist = Math.sqrt(
          Math.pow(255 - r, 2) + 
          Math.pow(255 - g, 2) + 
          Math.pow(255 - b, 2)
        );

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const saturation = max - min;
        
        if (saturation < 20) {
            const threshold = whiteTolerance * 1.5; 
            const softness = 20; 

            if (dist < threshold) {
                a = 0;
            } else if (dist < threshold + softness) {
                const factor = (dist - threshold) / softness;
                a = Math.min(a, 255 * factor);
            }
        }
      }

      const finalAlpha = (a / 255) * edgeAlpha;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = Math.round(finalAlpha * 255);
    }
    ctx.putImageData(imageData, 0, 0);
  };

  const captureFrame = async (
    video: HTMLVideoElement, 
    ctx: CanvasRenderingContext2D, 
    tCtx: CanvasRenderingContext2D, 
    vw: number, 
    vh: number, 
    time: number
  ) => {
    video.currentTime = time;
    await new Promise(r => {
      const onSeek = () => { video.removeEventListener('seeked', onSeek); r(null); };
      video.addEventListener('seeked', onSeek);
    });

    ctx.clearRect(0, 0, vw, vh);
    tCtx.clearRect(0, 0, tCtx.canvas.width, tCtx.canvas.height);
    tCtx.drawImage(video, 0, 0, tCtx.canvas.width, tCtx.canvas.height);

    if (isVapInput) {
      // VAP Input: Left half is Alpha, Right half is RGB
      const alphaData = tCtx.getImageData(0, 0, vw, vh).data;
      const rgbData = tCtx.getImageData(vw, 0, vw, vh).data;
      const combinedData = ctx.createImageData(vw, vh);
      const d = combinedData.data;

      for (let j = 0; j < rgbData.length; j += 4) {
        d[j] = rgbData[j];     // R
        d[j + 1] = rgbData[j + 1]; // G
        d[j + 2] = rgbData[j + 2]; // B
        // Use grayscale value from alpha side as alpha
        const alpha = (alphaData[j] + alphaData[j + 1] + alphaData[j + 2]) / 3;
        d[j + 3] = alpha;
      }
      ctx.putImageData(combinedData, 0, 0);
    } else {
      ctx.drawImage(tCtx.canvas, 0, 0, vw, vh);
    }
    
    // Apply transparency effects (Edge Fade, Chroma Key, etc.)
    applyTransparencyEffects(ctx, vw, vh);
  };

  useEffect(() => {
    if (files.length > 0) {
      const urls = files.map(f => URL.createObjectURL(f));
      setVideoUrls(urls);
      
      const video = document.createElement('video');
      video.src = urls[currentFileIndex];
      video.onloadedmetadata = () => {
        setDuration(video.duration);
        setEndTime(video.duration);
      };
      
      return () => {
        urls.forEach(url => URL.revokeObjectURL(url));
        setVideoUrls([]);
      };
    }
  }, [files, currentFileIndex]);

  const extractAudio = async () => {
    if (files.length === 0) return;
    const currentFile = files[currentFileIndex];
    setIsProcessing(true);
    setPhase('جاري استخراج الصوت...');
    setProgress(0);

    try {
      const ffmpeg = ffmpegRef.current;
      if (!ffmpeg) throw new Error("FFmpeg not loaded");

      const uint8 = new Uint8Array(await currentFile.arrayBuffer());
      await ffmpeg.writeFile('input.mp4', uint8);

      // Instant extraction: use '-c:a copy' to extract the audio stream without re-encoding.
      await ffmpeg.exec(['-i', 'input.mp4', '-vn', '-c:a', 'copy', 'output.m4a']);

      const data = await ffmpeg.readFile('output.m4a');
      const blob = new Blob([data], { type: 'audio/mp4' });
      downloadBlob(blob, `${currentFile.name.replace('.mp4', '')}.m4a`);
      
      setPhase('تم استخراج الصوت فوراً!');
      setProgress(100);
    } catch (e) {
      console.warn("Fast extraction failed, falling back to encoding:", e);
      // Fallback to mp3 encoding if copy fails (rare for mp4)
      try {
        const ffmpeg = ffmpegRef.current!;
        await ffmpeg.exec(['-i', 'input.mp4', '-vn', '-acodec', 'libmp3lame', '-q:a', '4', 'output.mp3']);
        const data = await ffmpeg.readFile('output.mp3');
        const blob = new Blob([data], { type: 'audio/mpeg' });
        downloadBlob(blob, `${files[currentFileIndex].name.replace('.mp4', '')}.mp3`);
        setPhase('تم استخراج الصوت بنجاح!');
        setProgress(100);
      } catch (err) {
        console.error(err);
        setPhase('فشل استخراج الصوت');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConvert = async () => {
    if (files.length === 0) return;
    const format = formats.find(f => f.id === selectedFormat);
    if (!format) return;

    if (!currentUser) {
      onLoginRequired();
      return;
    }

    const { allowed, reason } = await checkAccess('Video Conversion');
    if (!allowed) {
      if (reason === 'trial_ended') onSubscriptionRequired();
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      if (isMerging && files.length > 1) {
        await processMerge();
      } else {
        // Batch processing
        for (let i = 0; i < files.length; i++) {
          setCurrentFileIndex(i);
          setPhase(`جاري معالجة الملف ${i + 1} من ${files.length}...`);
          await processSingleFile(files[i], i);
        }
      }

      alert("تم التحويل بنجاح!");
      
      if (currentUser) {
        logActivity(currentUser, 'convert_video', `Converted ${files.length} videos to ${selectedFormat}`);
      }

      onCancel();
    } catch (e) {
      console.error(e);
      alert("حدث خطأ أثناء التحويل: " + (e as any).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const processSingleFile = async (currentFile: File, index: number) => {
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(currentFile);
    video.src = objectUrl;
    video.muted = true;
    video.playsInline = true;
    
    try {
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = () => resolve(null);
        video.onerror = () => reject(new Error("فشل في تحميل بيانات الفيديو"));
        setTimeout(() => reject(new Error("انتهت مهلة تحميل بيانات الفيديو")), 10000);
      });

      await video.play();
      video.pause();

      const parsedWidth = typeof customWidth === 'number' ? customWidth : parseInt(customWidth as string);
      const parsedHeight = typeof customHeight === 'number' ? customHeight : parseInt(customHeight as string);
      const validScale = isNaN(exportScale) ? 1.0 : exportScale;
      
      const rawWidth = (customWidth && !isNaN(parsedWidth) && parsedWidth > 0) ? parsedWidth : (video.videoWidth || 1334) * validScale;
      const rawHeight = (customHeight && !isNaN(parsedHeight) && parsedHeight > 0) ? parsedHeight : (video.videoHeight || 750) * validScale;
      
      const isVap = selectedFormat === 'VAP (MP4)' || selectedFormat === 'VAP 1.0.5';
      const maxPixels = isVap ? 6000000 : 9437184; // Cap VAP earlier because it expands dimensions
      const safe = calculateSafeDimensions(rawWidth, rawHeight, maxPixels);
      let vw = safe.width;
      let vh = safe.height;
      
      video.currentTime = startTime;
      await new Promise(r => {
        const onSeek = () => { video.removeEventListener('seeked', onSeek); r(null); };
        video.addEventListener('seeked', onSeek);
      });

      const duration = isNaN(endTime) || isNaN(startTime) ? 0 : endTime - startTime;
      const validFps = isNaN(fps) || fps <= 0 ? 30 : fps;
      const totalFrames = Math.max(1, Math.floor(duration * validFps));

      let audioData: Uint8Array | null = null;
      if (audioFile) {
        const arrayBuffer = await audioFile.arrayBuffer();
        audioData = new Uint8Array(arrayBuffer);
      }

      if (selectedFormat === 'MP4 (Standard)') {
        await exportToMP4Standard(video, vw, vh, totalFrames, fps, audioData, startTime, currentFile.name);
      } else if (selectedFormat === 'VAP (MP4)') {
        await exportToVAP(video, vw, vh, totalFrames, fps, audioData, startTime, currentFile.name);
      } else if (selectedFormat === 'VAP 1.0.5') {
        await exportToVAP105(video, vw, vh, totalFrames, fps, audioData, startTime, currentFile.name);
      } else if (selectedFormat === 'SVGA 2.0') {
        await exportToSVGA(video, vw, vh, totalFrames, fps, audioData, startTime, endTime, currentFile.name);
      } else if (selectedFormat === 'GIF (Animation)') {
        await exportToGIF(video, vw, vh, totalFrames, fps, startTime, currentFile.name);
      } else if (selectedFormat === 'APNG (Animation)') {
        await exportToAPNG(video, vw, vh, totalFrames, fps, startTime, currentFile.name);
      } else if (selectedFormat === 'WebP (Animated)') {
        await exportToWebP(video, vw, vh, totalFrames, fps, startTime, currentFile.name);
      } else if (selectedFormat === 'WebM (Video)') {
        await exportToWebM(video, vw, vh, totalFrames, fps, startTime, currentFile.name);
      }
    } finally {
      URL.revokeObjectURL(objectUrl);
      video.src = "";
      video.load();
    }
  };

  const processMerge = async () => {
    setPhase('جاري دمج الفيديوهات...');
    // For merging, we'll use the first video's dimensions as base
    const firstVideo = document.createElement('video');
    const firstObjectUrl = URL.createObjectURL(files[0]);
    firstVideo.src = firstObjectUrl;
    await new Promise(r => firstVideo.onloadedmetadata = () => r(null));
    
    const parsedWidth = typeof customWidth === 'number' ? customWidth : parseInt(customWidth as string);
    const parsedHeight = typeof customHeight === 'number' ? customHeight : parseInt(customHeight as string);
    const validScale = isNaN(exportScale) ? 1.0 : exportScale;
    
    const rawWidth = (customWidth && !isNaN(parsedWidth) && parsedWidth > 0) ? parsedWidth : (firstVideo.videoWidth || 1334) * validScale;
    const rawHeight = (customHeight && !isNaN(parsedHeight) && parsedHeight > 0) ? parsedHeight : (firstVideo.videoHeight || 750) * validScale;
    
    const safe = calculateSafeDimensions(rawWidth, rawHeight);
    let vw = safe.width;
    let vh = safe.height;
    
    URL.revokeObjectURL(firstObjectUrl);
    firstVideo.src = "";
    firstVideo.load();

    const safeWidth = vw;
    const safeHeight = vh;
    const validFps = isNaN(fps) || fps <= 0 ? 30 : fps;

    const muxer = new Mp4Muxer.Muxer({
        target: new Mp4Muxer.ArrayBufferTarget(),
        video: {
            codec: 'avc',
            width: safeWidth,
            height: safeHeight
        },
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

    const videoCodec = (safeWidth * safeHeight) > 2228224 ? 'avc1.4d0033' : 'avc1.4d002a';
    let bitrate = customBitrate ? Number(customBitrate) * 1000000 : 8000000;

    videoEncoder.configure({
        codec: videoCodec,
        width: safeWidth,
        height: safeHeight,
        bitrate: bitrate,
        framerate: validFps
    });

    const canvas = document.createElement('canvas');
    canvas.width = safeWidth; canvas.height = safeHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    let globalFrameCount = 0;

    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;

    try {
      for (let i = 0; i < files.length; i++) {
          setCurrentFileIndex(i);
          const currentFile = files[i];
          const objectUrl = URL.createObjectURL(currentFile);
          video.src = objectUrl;
          
          await new Promise((resolve, reject) => {
              video.onloadedmetadata = () => resolve(null);
              video.onerror = () => reject(new Error(`فشل في تحميل الفيديو: ${currentFile.name}`));
              setTimeout(() => reject(new Error(`انتهت مهلة تحميل الفيديو: ${currentFile.name}`)), 10000);
          });
          
          const fileDuration = video.duration;
          const fileFrames = Math.floor(fileDuration * validFps);

          for (let f = 0; f < fileFrames; f++) {
              video.currentTime = f / validFps;
              await new Promise(r => {
                  const onSeek = () => { video.removeEventListener('seeked', onSeek); r(null); };
                  video.addEventListener('seeked', onSeek);
              });

              if (ctx) {
                  if (hasEncoderError) break;
                  ctx.clearRect(0, 0, safeWidth, safeHeight);
                  ctx.drawImage(video, 0, 0, safeWidth, safeHeight);
                  applyTransparencyEffects(ctx, safeWidth, safeHeight);
                  
                  const bitmap = await createImageBitmap(canvas);
                  const frame = new VideoFrame(bitmap, { timestamp: (globalFrameCount * 1000000) / validFps });
                  videoEncoder.encode(frame, { keyFrame: globalFrameCount % 30 === 0 });
                  frame.close();
                  bitmap.close();
              }
              globalFrameCount++;
              setProgress(Math.floor(((i * fileFrames + f) / (files.length * fileFrames)) * 100));
          }
          URL.revokeObjectURL(objectUrl);
          video.src = "";
          video.load();
      }
    } finally {
      video.src = "";
      video.load();
    }

    if (hasEncoderError) throw new Error("Video encoding failed. Check console for details.");
    await videoEncoder.flush();
    videoEncoder.close();
    muxer.finalize();
    const buffer = muxer.target.buffer;
    downloadBlob(new Blob([buffer], { type: 'video/mp4' }), `Merged_Video_${Date.now()}.mp4`);
    
    if (generateChecksum) {
        const checksum = await calculateChecksum(buffer);
        downloadBlob(new Blob([checksum], { type: 'text/plain' }), `Merged_Video_${Date.now()}.sha256`);
    }
  };

  const exportToMP4Standard = async (video: HTMLVideoElement, vw: number, vh: number, totalFrames: number, fps: number, audioData: Uint8Array | null, startTime: number, fileName?: string) => {
    setPhase('جاري إنشاء فيديو MP4 القياسي...');
    
    // Ensure valid dimensions and even integers for MP4
    vw = Math.round(vw);
    vh = Math.round(vh);
    if (isNaN(vw) || vw <= 0) vw = 1334;
    if (isNaN(vh) || vh <= 0) vh = 750;

    const safeWidth = Math.floor(vw / 2) * 2;
    const safeHeight = Math.floor(vh / 2) * 2;
    
    console.log(`MP4 Export Dimensions: vw=${vw}, vh=${vh}, safeWidth=${safeWidth}, safeHeight=${safeHeight}`);
    
    if (isNaN(safeWidth) || safeWidth <= 0 || isNaN(safeHeight) || safeHeight <= 0) {
        throw new Error(`أبعاد الفيديو غير صالحة: ${safeWidth}x${safeHeight}`);
    }

    // Audio Setup (AAC for MP4)
    let audioTrack: any = undefined;
    let audioEncoder: AudioEncoder | null = null;
    let audioDataChunks: AudioData[] = [];

    if (audioData) {
        try {
            const offlineCtx = new OfflineAudioContext(2, 48000 * 1, 48000); 
            const audioBuffer = await offlineCtx.decodeAudioData(audioData.buffer.slice(0));
            
            audioTrack = {
                codec: 'mp4a.40.2',
                numberOfChannels: 2,
                sampleRate: 48000
            };

            const numberOfChannels = 2;
            const sampleRate = audioBuffer.sampleRate;
            const duration = totalFrames / fps;
            const maxSamples = Math.floor(duration * sampleRate);
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
        } catch (audioError) {
            console.warn("Audio processing failed, continuing without audio:", audioError);
            audioTrack = undefined;
            audioDataChunks = [];
        }
    }

    const muxer = new Mp4Muxer.Muxer({
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
    });

    let hasEncoderError = false;
    const videoEncoder = new VideoEncoder({
        output: (chunk: any, meta: any) => muxer.addVideoChunk(chunk, meta),
        error: (e: any) => {
            console.error("VideoEncoder error:", e);
            hasEncoderError = true;
        }
    });

    const videoCodec = (safeWidth * safeHeight) > 2228224 ? 'avc1.4d0033' : 'avc1.4d002a';
    
    let bitrate = customBitrate ? Number(customBitrate) * 1000000 : 8000000;
    if (!customBitrate) {
      if (globalQuality === 'high') bitrate = 15000000;
      if (globalQuality === 'low') bitrate = 4000000;
    }

    if (audioTrack) {
        audioEncoder = new AudioEncoder({
            output: (chunk: any, meta: any) => muxer.addAudioChunk(chunk, meta),
            error: (e: any) => console.error(e)
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

    // Configure video encoder right before the loop to avoid inactivity reclamation
    videoEncoder.configure({
        codec: videoCodec,
        width: safeWidth,
        height: safeHeight,
        bitrate: bitrate
    });

    const canvas = document.createElement('canvas');
    canvas.width = safeWidth; canvas.height = safeHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = isVapInput ? safeWidth * 2 : safeWidth;
    tempCanvas.height = safeHeight;
    const tCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

    for (let i = 0; i < totalFrames; i++) {
        if (ctx && tCtx) {
            if (hasEncoderError) break;
            await captureFrame(video, ctx, tCtx, safeWidth, safeHeight, startTime + (i / fps));
            
            const bitmap = await createImageBitmap(canvas);
            const frame = new VideoFrame(bitmap, { timestamp: (i * 1000000) / fps });
            
            while (videoEncoder.encodeQueueSize > 10 && !hasEncoderError) {
                await new Promise(r => requestAnimationFrame(r));
            }
            
            if (hasEncoderError) {
                frame.close();
                bitmap.close();
                break;
            }

            videoEncoder.encode(frame, { keyFrame: i % 30 === 0 });
            frame.close();
            bitmap.close();
        }
        
        if (i % 5 === 0) {
            await new Promise(r => requestAnimationFrame(r));
            setProgress(Math.floor((i / totalFrames) * 100));
        }
    }

    if (hasEncoderError) throw new Error("Video encoding failed. Check console for details.");
    await videoEncoder.flush();
    videoEncoder.close();
    if (audioEncoder) {
        await audioEncoder.flush();
        audioEncoder.close();
    }
    muxer.finalize();
    const buffer = muxer.target.buffer;
    downloadBlob(new Blob([buffer], { type: 'video/mp4' }), `${fileName?.replace('.mp4', '') || 'Video'}_Standard.mp4`);
    
    if (generateChecksum) {
        const checksum = await calculateChecksum(buffer);
        downloadBlob(new Blob([checksum], { type: 'text/plain' }), `${fileName?.replace('.mp4', '') || 'Video'}_Standard.sha256`);
    }
  };

  const exportToVAP105 = async (video: HTMLVideoElement, vw: number, vh: number, totalFrames: number, fps: number, audioData: Uint8Array | null, startTime: number, fileName?: string) => {
    setPhase('جاري تحضير VAP 1.0.5...');
    
    // Ensure valid dimensions
    vw = Math.round(vw);
    vh = Math.round(vh);
    if (isNaN(vw) || vw <= 0) vw = 1334;
    if (isNaN(vh) || vh <= 0) vh = 750;

    // VAP Layout Calculation
    const width = vw;
    const height = vh;
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

    // Audio Setup
    let audioEncoder: AudioEncoder | null = null;
    let audioTrack: any = undefined;
    let audioDataChunks: AudioData[] = [];

    if (audioData) {
        try {
            const offlineCtx = new OfflineAudioContext(2, 48000 * 1, 48000); 
            const audioBuffer = await offlineCtx.decodeAudioData(audioData.buffer.slice(0));
            
            audioTrack = {
                codec: 'mp4a.40.2',
                numberOfChannels: 2,
                sampleRate: 48000
            };

            const numberOfChannels = 2;
            const sampleRate = audioBuffer.sampleRate;
            const duration = totalFrames / fps;
            const maxSamples = Math.floor(duration * sampleRate);
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

    if (audioTrack && audioDataChunks.length > 0) {
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

    const totalPixels = videoW * videoH;
    const codec = totalPixels > 2228224 ? 'avc1.4d0033' : 'avc1.4d002a';

    let bitrate = customBitrate ? Number(customBitrate) * 1000000 : 4000000;
    if (!customBitrate) {
        bitrate = globalQuality === 'high' ? 8000000 : globalQuality === 'medium' ? 4000000 : 1500000;
    }

    videoEncoder.configure({
        codec: codec,
        width: videoW,
        height: videoH,
        bitrate: bitrate,
        framerate: fps
    });

    const frameDuration = 1000000 / fps; // Microseconds
    
    // Temp canvas for processing source frame
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

    for (let i = 0; i < totalFrames; i++) {
        setPhase(`جاري معالجة الإطار ${i + 1}/${totalFrames}`);
        
        video.currentTime = startTime + (i / fps);
        await new Promise(r => {
            const onSeek = () => { video.removeEventListener('seeked', onSeek); r(null); };
            video.addEventListener('seeked', onSeek);
        });

        if (ctx && tCtx) {
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, videoW, videoH);
            
            // 1. Draw Source Frame
            tCtx.clearRect(0, 0, width, height);
            tCtx.drawImage(video, 0, 0, width, height);
            
            // Apply transparency effects
            applyTransparencyEffects(tCtx, width, height);
            
            // 2. Draw RGB to main canvas (Left)
            ctx.drawImage(tempCanvas, 0, 0);
            
            // 3. Extract Alpha and Draw (Right)
            const frameData = tCtx.getImageData(0, 0, width, height);
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
        
        while (videoEncoder.encodeQueueSize > 10) {
            await new Promise(r => requestAnimationFrame(r));
        }
        
        videoEncoder.encode(videoFrame, { keyFrame: i % 30 === 0 });
        videoFrame.close();
        
        // Yield to UI
        if (i % 5 === 0) {
            await new Promise(r => requestAnimationFrame(r));
            setProgress(Math.floor((i / totalFrames) * 100));
        }
    }
    
    await videoEncoder.flush();
    videoEncoder.close();
    if (audioEncoder) {
        await audioEncoder.flush();
        audioEncoder.close();
    }
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
    const baseName = fileName?.replace('.mp4', '') || `vap_export_${new Date().getTime()}`;
    
    // 1. Video (with embedded vapc)
    const videoBlob = new Blob([buffer], { type: 'video/mp4' });
    downloadBlob(videoBlob, `${baseName}.mp4`);
    
    // 3. Checksum (SHA-256)
    const checksumBlob = new Blob([checksum], { type: 'text/plain' });
    downloadBlob(checksumBlob, `${baseName}.sha256`);

    alert("تم تصدير ملفات VAP 1.0.5 بنجاح!");
  };

  const exportToWebM = async (video: HTMLVideoElement, vw: number, vh: number, totalFrames: number, fps: number, startTime: number, fileName?: string) => {
    setPhase('جاري إنشاء WebM الشفاف...');

    // Ensure valid dimensions
    vw = Math.round(vw);
    vh = Math.round(vh);
    if (isNaN(vw) || vw <= 0) vw = 1334;
    if (isNaN(vh) || vh <= 0) vh = 750;

    const muxer = new WebMMuxer.Muxer({
        target: new WebMMuxer.ArrayBufferTarget(),
        video: { codec: 'V_VP9', width: vw, height: vh, frameRate: fps, alpha: true }
    });

    let hasEncoderError = false;
    const videoEncoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: (e) => {
            console.error("VideoEncoder error:", e);
            hasEncoderError = true;
        }
    });

    videoEncoder.configure({
        codec: 'vp09.00.10.08',
        width: vw,
        height: vh,
        bitrate: customBitrate ? Number(customBitrate) * 1000000 : (globalQuality === 'high' ? 8000000 : globalQuality === 'medium' ? 4000000 : 1500000),
        alpha: 'keep'
    });

    const canvas = document.createElement('canvas');
    canvas.width = vw; canvas.height = vh;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = isVapInput ? vw * 2 : vw;
    tempCanvas.height = vh;
    const tCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

    for (let i = 0; i < totalFrames; i++) {
        if (ctx && tCtx) {
            if (hasEncoderError) break;
            await captureFrame(video, ctx, tCtx, vw, vh, startTime + (i / fps));
            
            const bitmap = await createImageBitmap(canvas);
            const frame = new VideoFrame(bitmap, { timestamp: (i * 1000000) / fps });
            
            while (videoEncoder.encodeQueueSize > 10 && !hasEncoderError) {
                await new Promise(r => requestAnimationFrame(r));
            }
            
            if (hasEncoderError) {
                frame.close();
                bitmap.close();
                break;
            }

            videoEncoder.encode(frame, { keyFrame: i % 30 === 0 });
            frame.close();
            bitmap.close();
        }
        
        if (i % 5 === 0) {
            await new Promise(r => requestAnimationFrame(r));
            setProgress(Math.floor((i / totalFrames) * 100));
        }
    }

    await videoEncoder.flush();
    videoEncoder.close();
    muxer.finalize();
    downloadBlob(new Blob([muxer.target.buffer], { type: 'video/webm' }), `${fileName?.replace('.mp4', '') || 'Video'}.webm`);
  };

  const exportToWebP = async (video: HTMLVideoElement, vw: number, vh: number, totalFrames: number, fps: number, startTime: number, fileName?: string) => {
    setPhase('جاري إنشاء WebP المتحرك...');
    
    // Ensure valid dimensions
    if (isNaN(vw) || vw <= 0) vw = 1334;
    if (isNaN(vh) || vh <= 0) vh = 750;

    const canvas = document.createElement('canvas');
    canvas.width = vw; canvas.height = vh;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = isVapInput ? vw * 2 : vw;
    tempCanvas.height = vh;
    const tCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    
    const frames: { data: Uint8Array, duration: number }[] = [];

    // 1. Capture Frames
    for (let i = 0; i < totalFrames; i++) {
        if (ctx && tCtx) {
            await captureFrame(video, ctx, tCtx, vw, vh, startTime + (i / fps));
            
            const base64 = canvas.toDataURL('image/webp', globalQuality === 'high' ? 0.9 : globalQuality === 'medium' ? 0.75 : 0.5);
            const binary = atob(base64.split(',')[1]);
            const bytes = new Uint8Array(binary.length);
            for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
            
            frames.push({ data: bytes, duration: Math.round(1000 / fps) });
        }
        setProgress(Math.floor((i / totalFrames) * 80));
    }

    setPhase('جاري تجميع ملف WebP...');

    // 2. Muxing Logic
    const chunks: Uint8Array[] = [];
    
    // VP8X Chunk
    const vp8x = new Uint8Array(18);
    vp8x.set([0x56, 0x50, 0x38, 0x58], 0); // 'VP8X'
    vp8x.set([0x0A, 0x00, 0x00, 0x00], 4); // Size 10
    // Flags: Animation (bit 1) + Alpha (bit 4) = 0x02 | 0x10 = 0x12
    vp8x[8] = 0x12; 
    // Canvas Width (24 bit)
    vp8x[12] = (vw - 1) & 0xFF;
    vp8x[13] = ((vw - 1) >> 8) & 0xFF;
    vp8x[14] = ((vw - 1) >> 16) & 0xFF;
    // Canvas Height (24 bit)
    vp8x[15] = (vh - 1) & 0xFF;
    vp8x[16] = ((vh - 1) >> 8) & 0xFF;
    vp8x[17] = ((vh - 1) >> 16) & 0xFF;
    chunks.push(vp8x);

    // ANIM Chunk
    const anim = new Uint8Array(14);
    anim.set([0x41, 0x4E, 0x49, 0x4D], 0); // 'ANIM'
    anim.set([0x06, 0x00, 0x00, 0x00], 4); // Size 6
    // BG Color (Blue, Green, Red, Alpha) -> 0,0,0,0
    anim.set([0, 0, 0, 0], 8); 
    // Loop Count (0 = infinite)
    anim.set([0, 0], 12);
    chunks.push(anim);

    // ANMF Chunks
    for (const frame of frames) {
        // Parse single frame WebP to get VP8/VP8L/ALPH chunks
        let offset = 12; // Skip RIFF header
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

        // Create ANMF Header
        let payloadSize = 0;
        frameChunks.forEach(c => payloadSize += c.length);
        const anmfSize = 16 + payloadSize;
        
        const anmf = new Uint8Array(8 + 16); // Header + Frame Data Header
        anmf.set([0x41, 0x4E, 0x4D, 0x46], 0); // 'ANMF'
        anmf.set([anmfSize & 0xFF, (anmfSize >> 8) & 0xFF, (anmfSize >> 16) & 0xFF, (anmfSize >> 24) & 0xFF], 4);
        
        // Frame X, Y, W, H, Duration, Flags
        // X (3), Y (3), W (3), H (3), Dur (3), Flags (1)
        anmf[8] = 0; anmf[9] = 0; anmf[10] = 0; // X
        anmf[11] = 0; anmf[12] = 0; anmf[13] = 0; // Y
        
        const w = vw - 1;
        const h = vh - 1;
        anmf[14] = w & 0xFF; anmf[15] = (w >> 8) & 0xFF; anmf[16] = (w >> 16) & 0xFF;
        anmf[17] = h & 0xFF; anmf[18] = (h >> 8) & 0xFF; anmf[19] = (h >> 16) & 0xFF;
        
        const dur = frame.duration;
        anmf[20] = dur & 0xFF; anmf[21] = (dur >> 8) & 0xFF; anmf[22] = (dur >> 16) & 0xFF;
        
        // Flags: Reserved(6) + Blending(1) + Disposal(1)
        // Disposal 1 (Do not dispose), Blending 0 (Blend) -> 00000010 -> 0x02?
        // Wait, bit 0 is Disposal. Bit 1 is Blending.
        // Disposal 1 = 1. Blending 0 = 0.
        // So 00000001 = 0x01.
        anmf[23] = 0x01; 

        chunks.push(anmf);
        frameChunks.forEach(c => chunks.push(c));
    }

    // Final File Construction
    let totalSize = 4; // 'WEBP'
    chunks.forEach(c => totalSize += c.length);
    
    const riff = new Uint8Array(8);
    riff.set([0x52, 0x49, 0x46, 0x46], 0); // 'RIFF'
    riff.set([totalSize & 0xFF, (totalSize >> 8) & 0xFF, (totalSize >> 16) & 0xFF, (totalSize >> 24) & 0xFF], 4);
    
    const webpHeader = new Uint8Array(4);
    webpHeader.set([0x57, 0x45, 0x42, 0x50], 0); // 'WEBP'
    
    const finalBlob = new Blob([riff, webpHeader, ...chunks], { type: 'image/webp' });
    downloadBlob(finalBlob, `${file?.name.replace('.mp4', '')}.webp`);
    setProgress(100);
  };

  const exportToVAP = async (video: HTMLVideoElement, vw: number, vh: number, totalFrames: number, fps: number, audioData: Uint8Array | null, startTime: number, fileName?: string) => {
    setPhase('جاري إنشاء فيديو VAP...');
    
    // Ensure valid dimensions and even integers for MP4
    vw = Math.round(vw);
    vh = Math.round(vh);
    if (isNaN(vw) || vw <= 0) vw = 1334;
    if (isNaN(vh) || vh <= 0) vh = 750;

    const safeWidth = Math.floor(vw / 2) * 2;
    const safeHeight = Math.floor(vh / 2) * 2;
    
    console.log(`VAP Export Dimensions: vw=${vw}, vh=${vh}, safeWidth=${safeWidth}, safeHeight=${safeHeight}`);
    
    if (isNaN(safeWidth) || safeWidth <= 0 || isNaN(safeHeight) || safeHeight <= 0) {
        throw new Error(`أبعاد الفيديو غير صالحة: ${safeWidth}x${safeHeight}`);
    }
    
    const vapCanvas = document.createElement('canvas');
    vapCanvas.width = safeWidth * 2;
    vapCanvas.height = safeHeight;
    const vCtx = vapCanvas.getContext('2d', { willReadFrequently: true });
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = safeWidth;
    tempCanvas.height = safeHeight;
    const tCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

    // Audio Setup
    let audioTrack: any = undefined;
    let audioEncoder: AudioEncoder | null = null;
    let audioDataChunks: AudioData[] = [];

    if (audioData) {
        try {
            // Use OfflineAudioContext for more stable decoding
            const offlineCtx = new OfflineAudioContext(2, 48000 * 1, 48000);
            const audioBuffer = await offlineCtx.decodeAudioData(audioData.buffer.slice(0)); // Clone buffer to be safe
            
            audioTrack = {
                codec: 'A_OPUS',
                numberOfChannels: 2,
                sampleRate: 48000
            };

            const numberOfChannels = 2;
            const sampleRate = audioBuffer.sampleRate;
            const duration = totalFrames / fps;
            const maxSamples = Math.floor(duration * sampleRate);
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
        } catch (e) {
            console.warn("Audio encoding failed, continuing without audio", e);
            audioTrack = undefined;
            audioDataChunks = [];
        }
    }

    const muxer = new Mp4Muxer.Muxer({
      target: new Mp4Muxer.ArrayBufferTarget(),
      video: { codec: 'avc', width: vapCanvas.width, height: vapCanvas.height },
      audio: audioTrack ? {
          codec: 'aac',
          numberOfChannels: 2,
          sampleRate: 48000
      } : undefined,
      fastStart: 'in-memory'
    });

    let hasEncoderError = false;
    const videoEncoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta as any),
      error: (e) => {
          console.error("VideoEncoder error:", e);
          hasEncoderError = true;
      }
    });

    if (audioTrack && audioDataChunks.length > 0) {
        audioEncoder = new AudioEncoder({
            output: (chunk, meta) => muxer.addAudioChunk(chunk, meta as any),
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

        videoEncoder.configure({ 
        codec: 'avc1.42E01F', // H.264 Baseline Profile
        width: vapCanvas.width, 
        height: vapCanvas.height, 
        bitrate: customBitrate ? Number(customBitrate) * 1000000 : (globalQuality === 'high' ? 8000000 : globalQuality === 'medium' ? 4000000 : 1500000),
        avc: { format: 'annexb' }
    });

    for (let i = 0; i < totalFrames; i++) {
      video.currentTime = startTime + (i / fps);
      await new Promise(r => {
        const onSeek = () => { video.removeEventListener('seeked', onSeek); r(null); };
        video.addEventListener('seeked', onSeek);
      });

      if (vCtx && tCtx) {
        // Clear temp canvas
        tCtx.clearRect(0, 0, safeWidth, safeHeight);
        tCtx.drawImage(video, 0, 0, safeWidth, safeHeight);
        
        // Apply transparency effects to the source before splitting
        applyTransparencyEffects(tCtx, safeWidth, safeHeight);

        // Prepare VAP Frame
        // IMPORTANT: Fill with black first to ensure no transparency issues
        vCtx.fillStyle = '#000000';
        vCtx.fillRect(0, 0, vapCanvas.width, vapCanvas.height);

        // Draw RGB side (Right)
        vCtx.drawImage(tempCanvas, safeWidth, 0, safeWidth, safeHeight); 

        // Create Alpha Mask
        const imageData = tCtx.getImageData(0, 0, safeWidth, safeHeight);
        const data = imageData.data;
        for (let j = 0; j < data.length; j += 4) {
          const alpha = data[j + 3];
          data[j] = alpha; 
          data[j + 1] = alpha; 
          data[j + 2] = alpha; 
          data[j + 3] = 255;
        }
        tCtx.putImageData(imageData, 0, 0);
        
        // Draw Alpha side (Left)
        vCtx.drawImage(tempCanvas, 0, 0, safeWidth, safeHeight); 
      }

      if (hasEncoderError) break;
      const bitmap = await createImageBitmap(vapCanvas);
      const frame = new VideoFrame(bitmap, { timestamp: (i * 1000000) / fps });
      videoEncoder.encode(frame, { keyFrame: i % 30 === 0 });
      frame.close();
      bitmap.close();
      
      setProgress(Math.floor((i / totalFrames) * 100));
    }

    if (hasEncoderError) throw new Error("Video encoding failed. Check console for details.");
    await videoEncoder.flush();
    videoEncoder.close();
    if (audioEncoder) {
        await audioEncoder.flush();
        audioEncoder.close();
    }
    muxer.finalize();
    
    downloadBlob(new Blob([muxer.target.buffer], { type: 'video/mp4' }), `${file?.name}_VAP.mp4`);
  };

  const exportToSVGA = async (video: HTMLVideoElement, vw: number, vh: number, totalFrames: number, fps: number, audioData: Uint8Array | null, startTime: number, endTime: number, fileName?: string) => {
    if (totalFrames <= 0) {
      alert("مدة الفيديو غير صالحة للتحويل");
      return;
    }
    
    // Ensure valid dimensions
    if (isNaN(vw) || vw <= 0) vw = 1334;
    if (isNaN(vh) || vh <= 0) vh = 750;

    const actualWidth = isVapInput ? Math.floor(vw / 2) : vw;
    const actualHeight = vh;

    setPhase('جاري إنشاء ملف SVGA...');
    console.log(`Starting SVGA export: ${actualWidth}x${actualHeight}, ${totalFrames} frames, ${fps} fps (VAP Input: ${isVapInput})`);
    
    try {
      const protoStr = `
        syntax = "proto3";
        package com.opensource.svga;

        message MovieParams {
          float viewBoxWidth = 1;
          float viewBoxHeight = 2;
          int32 fps = 3;
          int32 frames = 4;
        }

        message Transform {
          float a = 1;
          float b = 2;
          float c = 3;
          float d = 4;
          float tx = 5;
          float ty = 6;
        }

        message Layout {
          float x = 1;
          float y = 2;
          float width = 3;
          float height = 4;
        }

        message SpriteEntity {
          string imageKey = 1;
          repeated FrameEntity frames = 2;
          string matteKey = 3;
        }

        message FrameEntity {
          float alpha = 1;
          Layout layout = 2;
          Transform transform = 3;
          string clipPath = 4;
          repeated ShapeEntity shapes = 5;
          string blendMode = 6;
        }

        message ShapeEntity {
          int32 type = 1;
          map<string, float> args = 2;
          map<string, string> styles = 3;
          Transform transform = 4;
        }

        message AudioEntity {
          string audioKey = 1;
          int32 startFrame = 2;
          int32 endFrame = 3;
          int32 startTime = 4;
          int32 totalTime = 5;
        }

        message MovieEntity {
          string version = 1;
          MovieParams params = 2;
          map<string, bytes> images = 3;
          repeated SpriteEntity sprites = 4;
          repeated AudioEntity audios = 5;
        }
      `;

      const root = protobuf.parse(protoStr).root;
      const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");
      
      const imagesData: Record<string, Uint8Array> = {};
      const finalSprites: any[] = [];
      const finalAudios: any[] = [];

      if (audioData) {
        const audioKey = "audio_0";
        imagesData[audioKey] = audioData;
        finalAudios.push({
          audioKey: audioKey,
          startFrame: 0,
          endFrame: totalFrames,
          startTime: 0,
          totalTime: Math.round((endTime - startTime) * 1000)
        });
      }

      const canvas = document.createElement('canvas');
      canvas.width = actualWidth;
      canvas.height = actualHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = vw;
      tempCanvas.height = vh;
      const tCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

      const spriteFrames: any[] = [];

      for (let i = 0; i < totalFrames; i++) {
        await captureFrame(video, ctx, tCtx, actualWidth, actualHeight, startTime + (i / fps));
        
        // Use UPNG for extreme lossy compression if quality is below 100
        let bytes: Uint8Array;
        if (compressionQuality < 100) {
          const imageData = ctx.getImageData(0, 0, actualWidth, actualHeight);
          const colors = Math.max(2, Math.round((compressionQuality / 100) * 256));
          const apng = UPNG.encode([imageData.data.buffer], actualWidth, actualHeight, colors);
          bytes = new Uint8Array(apng);
        } else {
          const base64 = canvas.toDataURL('image/png');
          try {
            const response = await fetch(base64);
            const blob = await response.blob();
            const arrayBuffer = await blob.arrayBuffer();
            bytes = new Uint8Array(arrayBuffer);
          } catch (e) {
            const binary = atob(base64.split(',')[1]);
            bytes = new Uint8Array(binary.length);
            for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
          }
        }
        
        const currentKey = `img_${i}`;
        imagesData[currentKey] = bytes;

        spriteFrames.push({
          alpha: 1.0,
          layout: { x: 0, y: 0, width: actualWidth, height: actualHeight },
          transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }
        });

        // In this optimized version, we create one sprite per frame to keep it simple but correct
        // Actually, standard SVGA usually has one sprite per image key.
        finalSprites.push({
          imageKey: currentKey,
          frames: new Array(totalFrames).fill({ alpha: 0 }).map((f, idx) => idx === i ? spriteFrames[i] : f)
        });
        
        if (i % 5 === 0) {
          setProgress(Math.floor((i / totalFrames) * 100));
          await new Promise(r => setTimeout(r, 0));
        }
      }

      const payload = { 
        version: "2.0", 
        params: { viewBoxWidth: actualWidth, viewBoxHeight: actualHeight, fps, frames: totalFrames }, 
        images: imagesData, 
        sprites: finalSprites,
        audios: finalAudios
      };
      
      console.log("Verifying SVGA payload...");
      const errMsg = MovieEntity.verify(payload);
      if (errMsg) {
        console.error("Payload verification failed:", errMsg);
        throw new Error("Payload verification failed: " + errMsg);
      }

      console.log("Creating SVGA movie entity...");
      const movie = MovieEntity.create(payload);
      
      console.log("Encoding SVGA movie entity...");
      const buffer = MovieEntity.encode(movie).finish();
      
      if (!buffer || buffer.length === 0) {
        throw new Error("Encoded buffer is empty");
      }

      console.log(`SVGA buffer size: ${buffer.length} bytes. Compressing with Level 9...`);
      const compressed = pako.deflate(buffer, { level: 9 });
      
      console.log(`Compressed SVGA size: ${compressed.length} bytes. Reduction: ${((1 - compressed.length / buffer.length) * 100).toFixed(2)}%`);
      downloadBlob(new Blob([compressed]), `${file?.name.replace('.mp4', '')}.svga`);
      setProgress(100);
      setPhase('تم إنشاء ملف SVGA بنجاح!');
    } catch (err) {
      console.error("SVGA Export Error:", err);
      alert("حدث خطأ أثناء إنشاء ملف SVGA: " + (err as any).message);
    }
  };

  const exportToGIF = async (video: HTMLVideoElement, vw: number, vh: number, totalFrames: number, fps: number, startTime: number, fileName?: string) => {
    setPhase('جاري إنشاء GIF الشفاف...');
    
    // Ensure valid dimensions
    if (isNaN(vw) || vw <= 0) vw = 1334;
    if (isNaN(vh) || vh <= 0) vh = 750;

    // Fetch worker to avoid path issues
    let workerUrl = '/gif.worker.js';
    try {
      const resp = await fetch('https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js');
      const blob = await resp.blob();
      workerUrl = URL.createObjectURL(blob);
    } catch (e) { console.error("Failed to fetch GIF worker", e); }

    const gif = new GIF({ 
      workers: 2, 
      quality: globalQuality === 'high' ? 5 : globalQuality === 'medium' ? 10 : 20, 
      width: vw, 
      height: vh, 
      transparent: 'rgba(0,0,0,0)',
      workerScript: workerUrl
    });
    
    const canvas = document.createElement('canvas');
    canvas.width = vw; canvas.height = vh;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = isVapInput ? vw * 2 : vw;
    tempCanvas.height = vh;
    const tCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

    for (let i = 0; i < totalFrames; i++) {
      if (ctx && tCtx) {
        await captureFrame(video, ctx, tCtx, vw, vh, startTime + (i / fps));
        gif.addFrame(ctx, { copy: true, delay: 1000 / fps });
      }
      setProgress(Math.floor((i / totalFrames) * 50));
    }
    gif.on('finished', (blob: Blob) => {
      downloadBlob(blob, `${file?.name}.gif`);
      setIsProcessing(false);
      if (workerUrl.startsWith('blob:')) URL.revokeObjectURL(workerUrl);
    });
    gif.render();
  };

  const exportToAPNG = async (video: HTMLVideoElement, vw: number, vh: number, totalFrames: number, fps: number, startTime: number, fileName?: string) => {
    setPhase('جاري إنشاء APNG الشفاف...');
    
    // Ensure valid dimensions
    if (isNaN(vw) || vw <= 0) vw = 1334;
    if (isNaN(vh) || vh <= 0) vh = 750;

    const framesData: ArrayBuffer[] = [];
    const delays: number[] = [];
    const canvas = document.createElement('canvas');
    canvas.width = vw; canvas.height = vh;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = isVapInput ? vw * 2 : vw;
    tempCanvas.height = vh;
    const tCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

    for (let i = 0; i < totalFrames; i++) {
      if (ctx && tCtx) {
        await captureFrame(video, ctx, tCtx, vw, vh, startTime + (i / fps));
        framesData.push(ctx.getImageData(0, 0, vw, vh).data.buffer);
        delays.push(1000 / fps);
      }
      setProgress(Math.floor((i / totalFrames) * 100));
    }
    const apngBuffer = UPNG.encode(framesData, vw, vh, 0, delays);
    downloadBlob(new Blob([apngBuffer]), `${file?.name}.png`);
  };

  const downloadBlob = (blob: Blob, name: string) => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = name;
    link.click();
  };

  const calculateChecksum = async (buffer: ArrayBuffer): Promise<string> => {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  return (
    <div className="max-w-6xl mx-auto p-6 sm:p-10 bg-slate-900/60 backdrop-blur-3xl rounded-[3rem] border border-white/10 shadow-3xl text-right font-arabic" dir="rtl">
      <div className="flex items-center justify-between mb-10">
        <button onClick={onCancel} className="p-3 hover:bg-white/10 rounded-2xl transition-all text-slate-400 hover:text-white">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="text-right flex items-center gap-4">
          <div>
            <h2 className="text-3xl font-black text-white tracking-tighter">محول الفيديو المباشر</h2>
            <p className="text-slate-500 text-xs mt-1 font-bold uppercase tracking-widest">تحويل MP4 إلى صيغ متحركة بضغطة واحدة</p>
          </div>
          <div className="w-12 h-12 bg-sky-500/20 rounded-2xl flex items-center justify-center border border-sky-500/30">
            <Zap className="w-6 h-6 text-sky-400 fill-sky-400/20" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
        {/* Left Column: Upload & Formats */}
        <div className="xl:col-span-4 space-y-6">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className={`h-64 rounded-[2.5rem] border-2 border-dashed transition-all flex flex-col items-center justify-center cursor-pointer group relative overflow-hidden ${files.length > 0 ? 'border-sky-500 bg-sky-500/5' : 'border-white/10 hover:border-sky-500/50 hover:bg-white/5'}`}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="video/*,.vap" 
              multiple
              onChange={(e) => {
                const newFiles = Array.from(e.target.files || []);
                if (newFiles.length > 0) {
                  setFiles(prev => [...prev, ...newFiles]);
                }
              }} 
            />
            {file ? (
              <div className="text-center p-6 relative z-10 w-full h-full flex flex-col items-center justify-center">
                {videoUrl ? (
                  <video 
                    src={videoUrl} 
                    className="max-h-40 rounded-xl mb-2 border border-white/10" 
                    onTimeUpdate={(e) => {
                      const v = e.currentTarget;
                      if (v.currentTime > endTime) v.currentTime = startTime;
                      if (v.currentTime < startTime) v.currentTime = startTime;
                    }}
                    autoPlay loop muted playsInline
                  />
                ) : (
                  <div className="w-20 h-20 bg-sky-500/20 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-sky-500/30">
                    <Film className="w-10 h-10 text-sky-400" />
                  </div>
                )}
                <div className="flex items-center gap-2 justify-center">
                  <div className="text-white font-black truncate max-w-[200px] text-sm">{file.name}</div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); extractAudio(); }}
                    className="p-1.5 bg-white/10 hover:bg-sky-500/20 rounded-lg transition-all text-slate-400 hover:text-sky-400"
                    title="تحميل الصوت فقط"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="text-sky-400 text-[10px] font-black mt-2 uppercase tracking-widest">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
              </div>
            ) : (
              <div className="text-center p-6 relative z-10">
                <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-white/5 group-hover:scale-110 transition-transform">
                  <Video className="w-10 h-10 text-slate-400" />
                </div>
                <div className="text-white font-black text-sm">اضغط لرفع الفيديوهات</div>
                <div className="text-slate-500 text-[10px] font-bold mt-2 uppercase tracking-widest">MP4 فقط</div>
              </div>
            )}
          </div>

          {files.length > 0 && (
            <div className="bg-slate-950/40 p-6 rounded-[2.5rem] border border-white/5 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-white font-black text-xs uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-sky-500" />
                  الملفات المرفوعة ({files.length})
                </h4>
                <button 
                  onClick={() => {
                    setFiles([]);
                    setCurrentFileIndex(0);
                  }}
                  className="text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  مسح الكل
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-2 custom-scrollbar pr-2">
                {files.map((f, i) => (
                  <div 
                    key={i} 
                    className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${i === currentFileIndex ? 'bg-sky-500/10 border-sky-500/30' : 'bg-white/5 border-white/5 hover:border-white/10'}`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                        <Film className="w-4 h-4 text-slate-400" />
                      </div>
                      <span className="text-xs text-slate-300 truncate font-bold">{f.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentFileIndex(i);
                        }}
                        className={`p-1.5 rounded-lg transition-colors ${i === currentFileIndex ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                      >
                        <Maximize className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          const newFiles = [...files];
                          newFiles.splice(i, 1);
                          setFiles(newFiles);
                          if (currentFileIndex >= newFiles.length) {
                            setCurrentFileIndex(Math.max(0, newFiles.length - 1));
                          }
                        }}
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {file && (
            <div className="bg-slate-950/40 p-6 rounded-[2.5rem] border border-white/5 space-y-4">
              <h4 className="text-white font-black text-xs uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Scissors className="w-3 h-3" />
                تحديد مدة التصدير:
              </h4>
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black">
                    <span className="text-slate-500 uppercase tracking-widest">البداية</span>
                    <span className="text-sky-400">{startTime.toFixed(2)}s</span>
                  </div>
                  <input 
                    type="range" min="0" max={duration} step="0.01" value={startTime} 
                    onChange={(e) => setStartTime(Math.min(parseFloat(e.target.value), endTime - 0.1))}
                    className="w-full h-1.5 bg-white/5 rounded-lg appearance-none cursor-pointer accent-sky-500"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black">
                    <span className="text-slate-500 uppercase tracking-widest">النهاية</span>
                    <span className="text-sky-400">{endTime.toFixed(2)}s</span>
                  </div>
                  <input 
                    type="range" min="0" max={duration} step="0.01" value={endTime} 
                    onChange={(e) => setEndTime(Math.max(parseFloat(e.target.value), startTime + 0.1))}
                    className="w-full h-1.5 bg-white/5 rounded-lg appearance-none cursor-pointer accent-sky-500"
                  />
                </div>
                <div className="text-center text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  المدة المختارة: <span className="text-emerald-400">{(endTime - startTime).toFixed(2)}s</span>
                </div>
              </div>
            </div>
          )}

          <div className="bg-slate-950/40 p-6 rounded-[2.5rem] border border-white/5">
            <h4 className="text-white font-black mb-4 text-xs uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <Layers className="w-3 h-3" />
              اختر صيغة التصدير:
            </h4>
            <div className="grid grid-cols-1 gap-3">
              {formats.map(f => (
                <button 
                  key={f.id}
                  onClick={() => setSelectedFormat(f.id)}
                  className={`flex items-center gap-4 p-4 rounded-2xl border transition-all text-right group ${selectedFormat === f.id ? 'bg-sky-500 border-sky-400 text-white shadow-glow-sky' : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'}`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${selectedFormat === f.id ? 'bg-white/20' : 'bg-white/5 group-hover:bg-white/10'}`}>
                    {f.id === 'VAP (MP4)' && <Video className="w-5 h-5" />}
                    {f.id === 'SVGA 2.0' && <Box className="w-5 h-5" />}
                    {f.id === 'GIF (Animation)' && <ImageIcon className="w-5 h-5" />}
                    {f.id === 'APNG (Animation)' && <Film className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="font-black text-xs">{f.name}</div>
                    <div className={`text-[9px] mt-0.5 ${selectedFormat === f.id ? 'text-white/70' : 'text-slate-500'}`}>{f.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Middle Column: Advanced Settings */}
        <div className="xl:col-span-5 space-y-6">
          <div className="bg-slate-950/40 p-8 rounded-[3rem] border border-white/5 space-y-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-sky-400" />
                <span className="text-white font-black text-xs uppercase tracking-widest">إعدادات متقدمة</span>
              </div>
              <div className="px-3 py-1 bg-sky-500/10 text-sky-400 text-[9px] font-black rounded-lg border border-sky-500/20">ADVANCED MODE</div>
            </div>

            {/* Batch & Verification Options */}
            <div className="grid grid-cols-2 gap-4 pb-4 border-b border-white/5">
              <div className="space-y-2">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">دمج الفيديوهات</div>
                <button 
                  onClick={() => setIsMerging(!isMerging)}
                  className={`w-full p-3 rounded-2xl border transition-all flex items-center justify-between ${isMerging ? 'bg-sky-500/10 border-sky-500/30 text-sky-400' : 'bg-white/5 border-white/5 text-slate-500 hover:border-white/10'}`}
                >
                  <Layers className="w-4 h-4" />
                  <span className="text-[10px] font-black">{isMerging ? 'مفعل' : 'معطل'}</span>
                </button>
              </div>
              <div className="space-y-2">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">ملف التحقق (SHA-256)</div>
                <button 
                  onClick={() => setGenerateChecksum(!generateChecksum)}
                  className={`w-full p-3 rounded-2xl border transition-all flex items-center justify-between ${generateChecksum ? 'bg-sky-500/10 border-sky-500/30 text-sky-400' : 'bg-white/5 border-white/5 text-slate-500 hover:border-white/10'}`}
                >
                  <Download className="w-4 h-4" />
                  <span className="text-[10px] font-black">{generateChecksum ? 'مفعل' : 'معطل'}</span>
                </button>
              </div>
            </div>

            {/* Quality Settings */}
            <div className="space-y-4 pb-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Settings2 className="w-3 h-3 text-sky-400" />
                <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">جودة التصدير</span>
              </div>
              <div className="flex gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
                  <button onClick={() => { setGlobalQuality('low'); setCustomBitrate(''); }} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${globalQuality === 'low' && !customBitrate ? 'bg-red-500/20 text-red-400 shadow-glow-red' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>منخفضة</button>
                  <button onClick={() => { setGlobalQuality('medium'); setCustomBitrate(''); }} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${globalQuality === 'medium' && !customBitrate ? 'bg-yellow-500/20 text-yellow-400 shadow-glow-yellow' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>متوسطة</button>
                  <button onClick={() => { setGlobalQuality('high'); setCustomBitrate(''); }} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${globalQuality === 'high' && !customBitrate ? 'bg-emerald-500/20 text-emerald-400 shadow-glow-green' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>عالية</button>
              </div>
            </div>

            {/* FPS & Bitrate Settings */}
            <div className="grid grid-cols-2 gap-4 pb-4 border-b border-white/5">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Film className="w-3 h-3 text-slate-500" />
                    <label className="text-[9px] text-slate-500 font-black uppercase tracking-widest block">معدل الفريمات (FPS)</label>
                  </div>
                  <span className="text-sky-400 font-black text-[10px]">{fps}</span>
                </div>
                <input 
                  type="range" min="10" max="60" step="1" value={fps} 
                  onChange={(e) => setFps(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-white/5 rounded-lg appearance-none cursor-pointer accent-sky-500"
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Zap className="w-3 h-3 text-slate-500" />
                    <label className="text-[9px] text-slate-500 font-black uppercase tracking-widest block">نسبة الضغط (Mbps)</label>
                  </div>
                  <span className="text-sky-400 font-black text-[10px]">{customBitrate || (globalQuality === 'high' ? '15' : globalQuality === 'medium' ? '8' : '4')}</span>
                </div>
                <input 
                  type="range" min="1" max="30" step="1" value={customBitrate || (globalQuality === 'high' ? 15 : globalQuality === 'medium' ? 8 : 4)} 
                  onChange={(e) => setCustomBitrate(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-white/5 rounded-lg appearance-none cursor-pointer accent-sky-500"
                />
              </div>
            </div>

            {/* SVGA Compression Quality */}
            {selectedFormat === 'SVGA 2.0' && (
              <div className="space-y-4 pb-4 border-b border-white/5">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Zap className="w-3 h-3 text-sky-400" />
                    <label className="text-[9px] text-slate-500 font-black uppercase tracking-widest block">جودة ضغط صور SVGA</label>
                  </div>
                  <span className="text-sky-400 font-black text-[10px]">{compressionQuality}%</span>
                </div>
                <input 
                  type="range" min="1" max="100" step="1" value={compressionQuality} 
                  onChange={(e) => setCompressionQuality(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-white/5 rounded-lg appearance-none cursor-pointer accent-sky-500"
                />
                <div className="space-y-1">
                  <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest leading-relaxed">
                    * للحصول على أصغر حجم ملف (ضغط فائق):
                  </p>
                  <p className="text-[8px] text-sky-400/70 font-black uppercase tracking-widest leading-relaxed">
                    1. قلل "جودة ضغط صور SVGA" إلى 10-30%
                  </p>
                  <p className="text-[8px] text-sky-400/70 font-black uppercase tracking-widest leading-relaxed">
                    2. قلل "معدل الفريمات (FPS)" إلى 15 أو أقل
                  </p>
                  <p className="text-[8px] text-sky-400/70 font-black uppercase tracking-widest leading-relaxed">
                    3. قلل "مقياس سريع" إلى 50% أو أقل
                  </p>
                </div>
              </div>
            )}

            {/* Scale Inputs */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Maximize className="w-3 h-3 text-slate-500" />
                  <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">أبعاد التصدير</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] text-slate-500 font-black uppercase tracking-widest block">العرض (Width)</label>
                  <input 
                    type="number" 
                    value={customWidth}
                    onChange={(e) => setCustomWidth(e.target.value ? parseInt(e.target.value) : '')}
                    placeholder="تلقائي"
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-xs focus:border-sky-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] text-slate-500 font-black uppercase tracking-widest block">الارتفاع (Height)</label>
                  <input 
                    type="number" 
                    value={customHeight}
                    onChange={(e) => setCustomHeight(e.target.value ? parseInt(e.target.value) : '')}
                    placeholder="تلقائي"
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-xs focus:border-sky-500 outline-none transition-all"
                  />
                </div>
              </div>
              {!customWidth && !customHeight && (
                <div className="pt-2">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-slate-500 text-[9px] font-black uppercase tracking-widest">مقياس سريع</span>
                    <span className="text-sky-400 font-black text-xs">{Math.round(exportScale * 100)}%</span>
                  </div>
                  <input 
                    type="range" min="0.1" max="2.0" step="0.1" value={exportScale} 
                    onChange={(e) => setExportScale(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-white/5 rounded-lg appearance-none cursor-pointer accent-sky-500"
                  />
                </div>
              )}
            </div>

            {/* Audio Upload */}
            <div className="space-y-4 pt-4 border-t border-white/5">
              <div className="flex items-center gap-2">
                <Music className="w-3 h-3 text-slate-500" />
                <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">إضافة صوت (اختياري)</span>
              </div>
              <div 
                onClick={() => audioInputRef.current?.click()}
                className={`p-4 rounded-2xl border-2 border-dashed transition-all flex items-center gap-4 cursor-pointer ${audioFile ? 'border-emerald-500 bg-emerald-500/5' : 'border-white/5 hover:border-white/10'}`}
              >
                <input type="file" ref={audioInputRef} className="hidden" accept="audio/*" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} />
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${audioFile ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-slate-500'}`}>
                  <Music className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-[10px] font-black truncate">{audioFile ? audioFile.name : 'اختر ملف صوتي'}</div>
                  <div className="text-slate-500 text-[8px] uppercase tracking-widest">{audioFile ? `${(audioFile.size / 1024).toFixed(1)} KB` : 'MP3, WAV...'}</div>
                </div>
                {audioFile && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); setAudioFile(null); }}
                    className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Black Removal Toggle */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button 
                onClick={() => setRemoveBlack(!removeBlack)}
                className={`w-full p-5 rounded-2xl border transition-all flex items-center justify-between group ${removeBlack ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/5 text-slate-500'}`}
                >
                <div className="flex items-center gap-3">
                    <Moon className={`w-5 h-5 transition-colors ${removeBlack ? 'text-emerald-400' : 'text-slate-500'}`} />
                    <span className="font-black text-xs uppercase tracking-widest">إزالة الخلفية السوداء</span>
                </div>
                <div className={`w-10 h-5 rounded-full relative transition-colors ${removeBlack ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${removeBlack ? 'right-6' : 'right-1'}`}></div>
                </div>
                </button>

                <button 
                onClick={() => setRemoveGreen(!removeGreen)}
                className={`w-full p-5 rounded-2xl border transition-all flex items-center justify-between group ${removeGreen ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-white/5 border-white/5 text-slate-500'}`}
                >
                <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-md border-2 transition-colors ${removeGreen ? 'bg-green-500 border-green-400' : 'bg-transparent border-slate-500'}`}></div>
                    <span className="font-black text-xs uppercase tracking-widest">إزالة الكروما (أخضر)</span>
                </div>
                <div className={`w-10 h-5 rounded-full relative transition-colors ${removeGreen ? 'bg-green-500' : 'bg-slate-700'}`}>
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${removeGreen ? 'right-6' : 'right-1'}`}></div>
                </div>
                </button>

                <button 
                onClick={() => setRemoveBlue(!removeBlue)}
                className={`w-full p-5 rounded-2xl border transition-all flex items-center justify-between group ${removeBlue ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/5 text-slate-500'}`}
                >
                <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-md border-2 transition-colors ${removeBlue ? 'bg-blue-600 border-blue-400' : 'bg-transparent border-slate-500'}`}></div>
                    <span className="font-black text-xs uppercase tracking-widest">إزالة الكروما (أزرق)</span>
                </div>
                <div className={`w-10 h-5 rounded-full relative transition-colors ${removeBlue ? 'bg-blue-600' : 'bg-slate-700'}`}>
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${removeBlue ? 'right-6' : 'right-1'}`}></div>
                </div>
                </button>

                <button 
                onClick={() => setRemoveWhite(!removeWhite)}
                className={`w-full p-5 rounded-2xl border transition-all flex flex-col items-start justify-between group ${removeWhite ? 'bg-slate-200/10 border-slate-200/30 text-slate-200' : 'bg-white/5 border-white/5 text-slate-500'}`}
                >
                <div className="flex items-center justify-between w-full mb-2">
                    <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-md border-2 transition-colors ${removeWhite ? 'bg-white border-slate-200' : 'bg-transparent border-slate-500'}`}></div>
                        <span className="font-black text-xs uppercase tracking-widest">إزالة الخلفية البيضاء</span>
                    </div>
                    <div className={`w-10 h-5 rounded-full relative transition-colors ${removeWhite ? 'bg-slate-200' : 'bg-slate-700'}`}>
                        <div className={`absolute top-1 w-3 h-3 bg-slate-900 rounded-full transition-all ${removeWhite ? 'right-6' : 'right-1'}`}></div>
                    </div>
                </div>
                </button>

                <button 
                onClick={() => setIsVapInput(!isVapInput)}
                className={`w-full p-5 rounded-2xl border transition-all flex items-center justify-between group ${isVapInput ? 'bg-sky-500/10 border-sky-500/30 text-sky-400' : 'bg-white/5 border-white/5 text-slate-500'}`}
                >
                <div className="flex items-center gap-3">
                    <Video className={`w-5 h-5 transition-colors ${isVapInput ? 'text-sky-400' : 'text-slate-500'}`} />
                    <span className="font-black text-xs uppercase tracking-widest">فيديو VAP (مدخل)</span>
                </div>
                <div className={`w-10 h-5 rounded-full relative transition-colors ${isVapInput ? 'bg-sky-500' : 'bg-slate-700'}`}>
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isVapInput ? 'right-6' : 'right-1'}`}></div>
                </div>
                </button>
                <p className="text-[9px] text-slate-500 mt-2 text-right px-2">
                    {isVapInput && "تفعيل هذا الخيار إذا كان الفيديو المدخل بتنسيق VAP (نصف شفاف ونصف ألوان)."}
                </p>
            </div>

            {/* Universal Tolerance Slider */}
            {(removeWhite || removeBlack || removeGreen || removeBlue) && (
                <div className="pt-4 border-t border-white/10 mt-2">
                    <div className="flex justify-between text-[9px] font-black text-slate-400 mb-2">
                        <span>الحساسية (Tolerance)</span>
                        <span className="text-sky-400">{whiteTolerance}%</span>
                    </div>
                    <input 
                        type="range" min="1" max="100" value={whiteTolerance} 
                        onChange={(e) => setWhiteTolerance(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-sky-500"
                    />
                    <p className="text-[8px] text-slate-500 mt-2 text-right">
                        {removeBlack && "يتحكم في درجة السواد التي يتم إزالتها."}
                        {removeGreen && "يتحكم في دقة عزل اللون الأخضر."}
                        {removeWhite && "يتحكم في درجة البياض التي يتم إزالتها."}
                    </p>
                </div>
            )}

            {/* Edge Fade Sliders */}
            <div className="space-y-6 pt-4 border-t border-white/5">
              <h5 className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                <Layers className="w-3 h-3" />
                تدرج الشفافية (Edge Fade)
              </h5>
              <div className="grid grid-cols-2 gap-6">
                {['top', 'bottom', 'left', 'right'].map((dir) => (
                  <div key={dir} className="space-y-3">
                    <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase">
                      <span>{dir === 'top' ? 'أعلى' : dir === 'bottom' ? 'أسفل' : dir === 'left' ? 'يسار' : 'يمين'}</span>
                      <span className="text-sky-400">{fadeConfig[dir as keyof typeof fadeConfig]}%</span>
                    </div>
                    <input 
                      type="range" min="0" max="50" value={fadeConfig[dir as keyof typeof fadeConfig]} 
                      onChange={(e) => setFadeConfig({...fadeConfig, [dir]: parseInt(e.target.value)})}
                      className="w-full h-1 bg-white/5 rounded-lg appearance-none cursor-pointer accent-sky-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Action & Progress */}
        <div className="xl:col-span-3 flex flex-col justify-between gap-6">
          <div className="bg-gradient-to-br from-sky-500/10 to-indigo-600/10 p-8 rounded-[3rem] border border-sky-500/20 flex-1 flex flex-col items-center justify-center text-center">
            <div 
              onClick={() => file && !isProcessing && extractAudio()}
              className={`w-16 h-16 bg-sky-500/20 rounded-full flex items-center justify-center mb-6 border border-sky-500/30 transition-all ${file && !isProcessing ? 'cursor-pointer hover:scale-110 active:scale-95 hover:bg-sky-500/30' : 'opacity-50'}`}
            >
              <Download className={`w-8 h-8 text-sky-400 ${file && !isProcessing ? 'animate-bounce' : ''}`} />
            </div>
            <h3 className="text-white font-black text-lg mb-2">جاهز للتحويل؟</h3>
            <p className="text-slate-400 text-[10px] leading-relaxed font-bold">سيتم تطبيق كافة إعدادات الشفافية والمقياس مباشرة على الملف الناتج.</p>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <button 
                onClick={handleConvert}
                disabled={!file || isProcessing}
                className={`w-full py-6 rounded-[2.5rem] font-black text-lg transition-all active:scale-95 shadow-2xl flex items-center justify-center gap-3 ${!file || isProcessing ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-glow-sky hover:shadow-glow-indigo'}`}
              >
                {isProcessing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>جاري المعالجة...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5 fill-white" />
                    <span>ابدأ التحويل الآن</span>
                  </>
                )}
              </button>

              <button 
                onClick={extractAudio}
                disabled={!file || isProcessing}
                className={`w-full py-6 rounded-[2.5rem] font-black text-lg transition-all active:scale-95 flex items-center justify-center gap-3 ${!file || isProcessing ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-white/5 text-white border border-white/10 hover:bg-white/10'}`}
              >
                <Music className="w-5 h-5" />
                <span>استخراج الصوت فقط</span>
              </button>
            </div>

            <AnimatePresence>
              {isProcessing && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="bg-slate-950/60 p-6 rounded-[2rem] border border-white/5 space-y-4"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-sky-400 font-black text-[10px] uppercase tracking-widest">{phase}</span>
                    <span className="text-white font-black text-xs">{progress}%</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 rounded-full shadow-glow-sky"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};
