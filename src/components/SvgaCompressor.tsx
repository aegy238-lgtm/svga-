import React, { useState, useRef } from 'react';
import { UserRecord } from '../types';
import { parse } from 'protobufjs';
import pako from 'pako';
import { svgaSchema } from '../svga-proto';

declare var JSZip: any;

interface SvgaFile {
  file: File;
  id: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  originalSize: number;
  compressedSize?: number;
  savingPercent?: number;
  downloadUrl?: string;
}

export const SvgaCompressor: React.FC<{ onCancel: () => void, currentUser: UserRecord | null }> = ({ onCancel, currentUser }) => {
  const [svgaFile, setSvgaFile] = useState<SvgaFile | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [quality, setQuality] = useState(80);
  const [compressionMode, setCompressionMode] = useState<'manual' | 'target'>('manual');
  const [targetSize, setTargetSize] = useState<number>(0); // in KB
  const [useWebP, setUseWebP] = useState(false);
  const [resizeScale, setResizeScale] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Basic validation
    if (!file.name.toLowerCase().endsWith('.svga')) {
      alert('Please select a valid .svga file');
      return;
    }

    setSvgaFile({
      file,
      id: Math.random().toString(36).substring(7),
      status: 'pending',
      originalSize: file.size
    });
    
    // Set default target size to 50% of original
    setTargetSize(Math.round(file.size / 1024 / 2));
  };

  const compressImage = async (blob: Blob, q: number, format: 'image/png' | 'image/webp', scale: number): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        URL.revokeObjectURL(url);
        
        // Ensure dimensions are at least 1x1
        const width = Math.max(1, Math.floor(img.width * scale));
        const height = Math.max(1, Math.floor(img.height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context failed'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        
        // Compress
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error('Compression failed'));
        }, format, q / 100);
      };
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = url;
    });
  };

  const processSvga = async () => {
    if (!svgaFile || isProcessing) return;
    setIsProcessing(true);
    setSvgaFile(prev => prev ? { ...prev, status: 'processing' } : null);

    try {
      // Determine settings based on mode
      let applyQuality = quality;
      let applyScale = resizeScale;
      let applyFormat: 'image/png' | 'image/webp' = useWebP ? 'image/webp' : 'image/png';

      if (compressionMode === 'target' && targetSize > 0) {
          const targetBytes = targetSize * 1024;
          const currentBytes = svgaFile.originalSize;
          const ratio = targetBytes / currentBytes;

          // Heuristic for Target Size
          if (ratio >= 0.9) {
              applyQuality = 90;
              applyScale = 1;
          } else {
              // Aggressive curve
              applyQuality = Math.max(10, Math.min(90, Math.floor(ratio * 120))); 
              
              // User requested to NOT change dimensions (scale = 1)
              applyScale = 1;
          }
          // Force WebP if ratio is low to ensure we hit target
          // if (ratio < 0.7) applyFormat = 'image/webp'; // DISABLED: User requested to avoid WebP
      }

      const zip = new JSZip();
      let isZip = false;

      try {
        const arrayBuffer = await svgaFile.file.arrayBuffer();
        await zip.loadAsync(arrayBuffer);
        isZip = true;
      } catch (e: any) {
        // Not a zip, try Protobuf fallback
        console.log("Not a ZIP, attempting Protobuf decode...");
      }

      if (!isZip) {
        try {
          const arrayBuffer = await svgaFile.file.arrayBuffer();
          let inflatedData: Uint8Array;
          try {
             inflatedData = pako.inflate(new Uint8Array(arrayBuffer));
          } catch (e) {
             throw new Error("Invalid SVGA file format. Not a valid Zip archive or SVGA binary.");
          }

          const parsed = parse(svgaSchema);
          const root = parsed.root;
          const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");
          
          const movie = MovieEntity.decode(inflatedData) as any;
          
          if (movie.images) {
             const imageKeys = Object.keys(movie.images);
             for (const key of imageKeys) {
                 const imageBytes = movie.images[key];
                 if (imageBytes && imageBytes.length > 0) {
                     const blob = new Blob([imageBytes], { type: 'image/png' }); // Source is usually PNG
                     try {
                         const compressedBlob = await compressImage(blob, applyQuality, applyFormat, applyScale);
                         const buffer = await compressedBlob.arrayBuffer();
                         movie.images[key] = new Uint8Array(buffer);
                     } catch (err) {
                         console.warn(`Failed to compress image ${key}`, err);
                     }
                 }
             }
          }

          const message = MovieEntity.create(movie);
          const buffer = MovieEntity.encode(message).finish();
          const compressed = pako.deflate(buffer);
          
          const generatedBlob = new Blob([compressed], { type: 'application/octet-stream' });
          const downloadUrl = URL.createObjectURL(generatedBlob);
          
          setSvgaFile(prev => prev ? {
            ...prev,
            status: 'done',
            compressedSize: generatedBlob.size,
            savingPercent: Math.round(((prev.originalSize - generatedBlob.size) / prev.originalSize) * 100),
            downloadUrl
          } : null);
          
          return;

        } catch (protoError: any) {
          console.error("Protobuf processing failed", protoError);
          throw new Error("Failed to process SVGA file. Ensure it is a valid SVGA file.");
        }
      }
      
      // --- ZIP MODE (SVGA 2.0) ---
      // Instead of creating a new ZIP, we modify the existing one to preserve all metadata/audio
      
      const imagesToProcess: { path: string, content: Blob }[] = [];

      // 1. Identify images
      zip.forEach((relativePath: string, zipEntry: any) => {
        if (!zipEntry.dir && relativePath.toLowerCase().endsWith('.png')) {
           // We will process this
        }
      });

      // 2. Process images concurrently
      const promises: Promise<void>[] = [];
      
      zip.forEach((relativePath: string, zipEntry: any) => {
          if (!zipEntry.dir && relativePath.toLowerCase().endsWith('.png')) {
              const promise = (async () => {
                  try {
                      const data = await zipEntry.async('blob');
                      const compressedBlob = await compressImage(data, applyQuality, applyFormat, applyScale);
                      
                      // If compressed is larger and we are not in target mode, keep original
                      if (compressedBlob.size < data.size || compressionMode === 'target') {
                          // Overwrite the file in the zip
                          zip.file(relativePath, compressedBlob);
                      }
                  } catch (e) {
                      console.error(`Failed to process ${relativePath}`, e);
                      // Keep original on error
                  }
              })();
              promises.push(promise);
          }
      });

      await Promise.all(promises);

      // 3. Generate output
      const generatedBlob = await zip.generateAsync({ 
          type: 'blob',
          compression: 'DEFLATE',
          compressionOptions: { level: 6 }
      });
      
      const downloadUrl = URL.createObjectURL(generatedBlob);

      setSvgaFile(prev => prev ? {
        ...prev,
        status: 'done',
        compressedSize: generatedBlob.size,
        savingPercent: Math.round(((prev.originalSize - generatedBlob.size) / prev.originalSize) * 100),
        downloadUrl
      } : null);

    } catch (error) {
      console.error('SVGA Processing Error:', error);
      setSvgaFile(prev => prev ? { ...prev, status: 'error' } : null);
      alert('Failed to process SVGA file');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-[#0f1115] text-white p-4 sm:p-8 font-sans animate-in fade-in zoom-in duration-500">
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-white/10 pb-6">
          <div>
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-rose-600 mb-2">
              SVGA Smart Compressor
            </h1>
            <p className="text-slate-400 text-sm">
              Reduce SVGA file size intelligently while maintaining quality.
            </p>
          </div>
          <button 
            onClick={onCancel} 
            className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Main Area */}
        <div className="bg-[#1a1d24] rounded-2xl p-8 border border-white/5 shadow-2xl">
          
          {!svgaFile ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-pink-500/50 rounded-2xl p-12 flex flex-col items-center justify-center cursor-pointer transition-all group bg-slate-900/50 hover:bg-slate-900"
            >
              <div className="w-20 h-20 bg-pink-500/10 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                <svg className="w-10 h-10 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Upload SVGA File</h3>
              <p className="text-slate-400 text-sm">Click to browse or drag & drop</p>
              <input type="file" ref={fileInputRef} className="hidden" accept=".svga" onChange={handleFileSelect} />
            </div>
          ) : (
            <div className="space-y-8">
              {/* File Info */}
              <div className="flex items-center gap-4 bg-slate-900/50 p-4 rounded-xl border border-white/5">
                <div className="w-12 h-12 bg-pink-500/20 rounded-lg flex items-center justify-center text-pink-500 font-bold text-xs">SVGA</div>
                <div className="flex-1">
                  <h4 className="font-bold text-white truncate">{svgaFile.file.name}</h4>
                  <p className="text-xs text-slate-400">{formatSize(svgaFile.originalSize)}</p>
                </div>
                {svgaFile.status === 'pending' && (
                  <button onClick={() => setSvgaFile(null)} className="text-red-400 hover:text-red-300 text-sm font-bold px-3 py-1">Remove</button>
                )}
              </div>

              {/* Controls */}
              {svgaFile.status === 'pending' && (
                <div className="space-y-6">
                  
                  {/* Mode Selection */}
                  <div className="flex bg-slate-900/50 p-1 rounded-xl border border-white/5">
                    <button 
                      onClick={() => setCompressionMode('manual')}
                      className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${compressionMode === 'manual' ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/20' : 'text-slate-500 hover:text-white'}`}
                    >
                      Manual Quality
                    </button>
                    <button 
                      onClick={() => setCompressionMode('target')}
                      className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${compressionMode === 'target' ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/20' : 'text-slate-500 hover:text-white'}`}
                    >
                      Target Size
                    </button>
                  </div>

                  {compressionMode === 'manual' ? (
                    <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
                      <div>
                        <div className="flex justify-between mb-2">
                          <label className="text-sm font-bold text-slate-300">Compression Quality</label>
                          <span className="text-sm font-mono text-pink-400">{quality}%</span>
                        </div>
                        <input 
                          type="range" 
                          min="10" 
                          max="90" 
                          value={quality} 
                          onChange={(e) => setQuality(parseInt(e.target.value))}
                          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
                        />
                        <div className="flex justify-between mt-1 text-[10px] text-slate-500 uppercase tracking-wider">
                          <span>Smaller Size</span>
                          <span>Better Quality</span>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between mb-2">
                          <label className="text-sm font-bold text-slate-300">Resize Images</label>
                          <span className="text-sm font-mono text-pink-400">{Math.round(resizeScale * 100)}%</span>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                            {[1, 0.9, 0.75, 0.5].map((s) => (
                                <button
                                    key={s}
                                    onClick={() => setResizeScale(s)}
                                    className={`py-2 rounded-lg text-xs font-bold border transition-all ${resizeScale === s ? 'bg-pink-500/20 border-pink-500 text-pink-400' : 'bg-slate-800 border-transparent text-slate-400 hover:bg-slate-700'}`}
                                >
                                    {s * 100}%
                                </button>
                            ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                        <div>
                            <label className="text-sm font-bold text-slate-300 mb-2 block">Target File Size (KB)</label>
                            <div className="relative">
                                <input 
                                    type="number" 
                                    value={targetSize}
                                    onChange={(e) => setTargetSize(parseInt(e.target.value) || 0)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-white font-mono text-lg outline-none focus:border-pink-500 transition-all"
                                    placeholder="e.g. 500"
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-bold">KB</div>
                            </div>
                            <p className="text-xs text-slate-500 mt-2">
                                Original size: <span className="text-slate-300">{Math.round(svgaFile.originalSize / 1024)} KB</span>
                            </p>
                        </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-white/5">
                      <label className="text-sm font-bold text-slate-300 mb-2 block">Image Format</label>
                      <div className="flex bg-slate-900/50 p-1 rounded-xl border border-white/5">
                          <button 
                              onClick={() => setUseWebP(false)}
                              className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${!useWebP ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/20' : 'text-slate-500 hover:text-white'}`}
                          >
                              PNG (Standard)
                          </button>
                          <button 
                              onClick={() => setUseWebP(true)}
                              className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${useWebP ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/20' : 'text-slate-500 hover:text-white'}`}
                          >
                              WebP (Smaller)
                          </button>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-2">
                          {useWebP ? "WebP reduces size significantly but may not be supported by all players." : "PNG is supported by all SVGA players."}
                      </p>
                  </div>

                  <button 
                    onClick={processSvga}
                    disabled={isProcessing}
                    className="w-full py-4 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white rounded-xl font-black text-sm uppercase tracking-widest shadow-lg shadow-pink-900/20 transition-all hover:scale-[1.02]"
                  >
                    {isProcessing ? 'Compressing...' : 'Start Compression'}
                  </button>
                </div>
              )}

              {/* Processing State */}
              {svgaFile.status === 'processing' && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 border-4 border-pink-500/30 border-t-pink-500 rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-slate-300 font-medium animate-pulse">Optimizing assets...</p>
                </div>
              )}

              {/* Result */}
              {svgaFile.status === 'done' && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6 text-center space-y-6 animate-in zoom-in duration-300">
                  <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto text-green-400">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  </div>
                  
                  <div>
                    <h3 className="text-2xl font-black text-white mb-1">Compression Complete!</h3>
                    <p className="text-green-400 font-medium">Saved {svgaFile.savingPercent}%</p>
                  </div>

                  <div className="flex justify-center gap-8 text-sm">
                    <div>
                      <p className="text-slate-500 text-xs uppercase tracking-widest mb-1">Before</p>
                      <p className="font-mono text-slate-300">{formatSize(svgaFile.originalSize)}</p>
                    </div>
                    <div className="w-px bg-white/10"></div>
                    <div>
                      <p className="text-slate-500 text-xs uppercase tracking-widest mb-1">After</p>
                      <p className="font-mono text-white font-bold">{formatSize(svgaFile.compressedSize || 0)}</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <a 
                      href={svgaFile.downloadUrl} 
                      download={`compressed_${svgaFile.file.name}`}
                      className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-900/20 transition-all hover:scale-[1.02]"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      Download
                    </a>
                    <button 
                      onClick={() => setSvgaFile(null)}
                      className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold transition-all"
                    >
                      New File
                    </button>
                  </div>
                </div>
              )}

              {svgaFile.status === 'error' && (
                <div className="text-center py-8">
                  <p className="text-red-400 mb-4">Something went wrong during compression.</p>
                  <button onClick={() => setSvgaFile(null)} className="text-white underline">Try Again</button>
                </div>
              )}

            </div>
          )}
        </div>

        {/* Offline Tool Link */}
        <div className="text-center pt-8 border-t border-white/5">
          <p className="text-slate-500 text-xs mb-4">Need an offline solution? Download our Python script.</p>
          <a 
            href="/svga_compressor/svga_compress.py" 
            download
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Download Python Script
          </a>
        </div>
      </div>
    </div>
  );
};
