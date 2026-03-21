import React, { useState, useRef, useEffect, useCallback } from 'react';
import { UserRecord } from '../types';

import { useAccessControl } from '../hooks/useAccessControl';

interface ImageEditorProps {
  currentUser: UserRecord | null;
  onCancel: () => void;
  onLoginRequired: () => void;
  onSubscriptionRequired: () => void;
  globalQuality?: 'low' | 'medium' | 'high';
}

export const ImageEditor: React.FC<ImageEditorProps> = ({ currentUser, onCancel, onLoginRequired, onSubscriptionRequired, globalQuality: initialGlobalQuality = 'high' }) => {
  const { checkAccess } = useAccessControl();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mainImg, setMainImg] = useState<HTMLImageElement | null>(null);
  const [overlayImg, setOverlayImg] = useState<HTMLImageElement | null>(null);
  const [selectedQuality, setSelectedQuality] = useState<'low' | 'medium' | 'high'>(initialGlobalQuality);
  
  const [config, setConfig] = useState({
    width: 500,
    height: 500,
    borderRadius: 30,
    overlayScale: 40,
    overlayOpacity: 100,
    mainScale: 100,
    mainX: 0,
    mainY: 0,
    feather: 0,
    rotation: 0
  });

  const handleConfigChange = (key: string, value: number) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, isOverlay: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        if (isOverlay) {
          setOverlayImg(img);
        } else {
          setMainImg(img);
          // Reset position on new image
          setConfig(prev => ({ ...prev, mainX: 0, mainY: 0, mainScale: 100, rotation: 0 }));
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // Resize canvas
    canvas.width = config.width;
    canvas.height = config.height;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!mainImg) return;

    ctx.save();

    // Draw rounded rectangle path
    const radiusPercent = config.borderRadius / 100;
    const minSide = Math.min(canvas.width, canvas.height);
    const borderRadius = minSide * radiusPercent;

    // Create a temporary canvas for the mask
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = canvas.width;
    maskCanvas.height = canvas.height;
    const maskCtx = maskCanvas.getContext('2d');
    
    if (maskCtx) {
      maskCtx.fillStyle = 'white';
      
      // Calculate inset for feathering
      // We inset the shape so the blur fades out to the original edge
      const feather = config.feather || 0;
      const inset = feather; 
      
      // Adjust dimensions for inset
      const maskW = Math.max(0, canvas.width - (inset * 2));
      const maskH = Math.max(0, canvas.height - (inset * 2));
      const maskX = inset;
      const maskY = inset;
      
      // Adjust radius for inset (prevent negative radius)
      // If feather is large, radius shrinks
      const maskRadius = Math.max(0, borderRadius - inset);

      maskCtx.beginPath();
      maskCtx.moveTo(maskX + maskRadius, maskY);
      maskCtx.lineTo(maskX + maskW - maskRadius, maskY);
      maskCtx.quadraticCurveTo(maskX + maskW, maskY, maskX + maskW, maskY + maskRadius);
      maskCtx.lineTo(maskX + maskW, maskY + maskH - maskRadius);
      maskCtx.quadraticCurveTo(maskX + maskW, maskY + maskH, maskX + maskW - maskRadius, maskY + maskH);
      maskCtx.lineTo(maskX + maskRadius, maskY + maskH);
      maskCtx.quadraticCurveTo(maskX, maskY + maskH, maskX, maskY + maskH - maskRadius);
      maskCtx.lineTo(maskX, maskY + maskRadius);
      maskCtx.quadraticCurveTo(maskX, maskY, maskX + maskRadius, maskY);
      maskCtx.closePath();

      if (feather > 0) {
        maskCtx.filter = `blur(${feather}px)`;
      }
      maskCtx.fill();
      
      // Reset filter for other operations if needed (though we discard maskCtx)
      maskCtx.filter = 'none';
    }

    // Draw the image first (without clipping yet)
    // Calculate scale to cover
    const scaleX = canvas.width / mainImg.naturalWidth;
    const scaleY = canvas.height / mainImg.naturalHeight;
    const coverScale = Math.max(scaleX, scaleY);

    // Apply user scale (relative to cover scale)
    const finalScale = coverScale * (config.mainScale / 100);

    const drawW = mainImg.naturalWidth * finalScale;
    const drawH = mainImg.naturalHeight * finalScale;

    // Center position
    const centerX = (canvas.width - drawW) / 2;
    const centerY = (canvas.height - drawH) / 2;

    // Apply user offsets
    const drawX = centerX + config.mainX;
    const drawY = centerY + config.mainY;

    // Apply rotation
    ctx.save();
    const pivotX = drawX + drawW / 2;
    const pivotY = drawY + drawH / 2;
    ctx.translate(pivotX, pivotY);
    ctx.rotate((config.rotation * Math.PI) / 180);
    ctx.translate(-pivotX, -pivotY);

    ctx.drawImage(mainImg, drawX, drawY, drawW, drawH);
    ctx.restore();

    // Apply the mask using destination-in
    // This keeps the image where the mask is white (opaque) and fades it where mask is transparent
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(maskCanvas, 0, 0);
    
    // Reset composite operation for overlay
    ctx.globalCompositeOperation = 'source-over';

    ctx.restore();

    if (overlayImg) {
      const scale = config.overlayScale / 100;
      const overlayW = overlayImg.naturalWidth * scale;
      const overlayH = overlayImg.naturalHeight * scale;
      const posX = (canvas.width - overlayW) / 2;
      const posY = (canvas.height - overlayH) / 2;

      const opacity = config.overlayOpacity / 100;
      ctx.globalAlpha = opacity;

      ctx.drawImage(overlayImg, posX, posY, overlayW, overlayH);

      ctx.globalAlpha = 1.0;
    }
  }, [config, mainImg, overlayImg]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  const handleDownload = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!currentUser) {
      onLoginRequired();
      return;
    }

    const { allowed, reason } = await checkAccess('Image Editor Export');
    if (!allowed) {
      if (reason === 'trial_ended') onSubscriptionRequired();
      return;
    }

    const link = document.createElement('a');
    if (selectedQuality === 'high') {
        link.download = 'edited-image.png';
        link.href = canvas.toDataURL('image/png');
    } else {
        const q = selectedQuality === 'medium' ? 0.85 : 0.6;
        link.download = 'edited-image.webp';
        link.href = canvas.toDataURL('image/webp', q);
    }
    link.click();
  };

  return (
    <div className="w-full max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Image Editor</h2>
          <p className="text-slate-400">Create rounded images with overlays easily.</p>
        </div>
        <button 
          onClick={onCancel}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-colors"
        >
          Back
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Canvas Area */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center bg-slate-900/50 border border-white/10 rounded-3xl p-8 backdrop-blur-sm">
           <div className="relative max-w-full overflow-auto custom-scrollbar rounded-2xl shadow-2xl bg-[url('data:image/svg+xml;utf8,<svg width=\'20\' height=\'20\' viewBox=\'0 0 20 20\' xmlns=\'http://www.w3.org/2000/svg\'><rect width=\'10\' height=\'10\' fill=\'%231e293b\'/><rect x=\'10\' y=\'10\' width=\'10\' height=\'10\' fill=\'%231e293b\'/><rect x=\'0\' y=\'10\' width=\'10\' height=\'10\' fill=\'%230f172a\'/><rect x=\'10\' y=\'0\' width=\'10\' height=\'10\' fill=\'%230f172a\'/></svg>')]">
              <canvas ref={canvasRef} className="max-w-full h-auto block" />
           </div>
           <div className="mt-4 flex items-center gap-2 text-slate-500 text-xs">
             <div className="w-4 h-4 bg-[url('data:image/svg+xml;utf8,<svg width=\'20\' height=\'20\' viewBox=\'0 0 20 20\' xmlns=\'http://www.w3.org/2000/svg\'><rect width=\'10\' height=\'10\' fill=\'%231e293b\'/><rect x=\'10\' y=\'10\' width=\'10\' height=\'10\' fill=\'%231e293b\'/><rect x=\'0\' y=\'10\' width=\'10\' height=\'10\' fill=\'%230f172a\'/><rect x=\'10\' y=\'0\' width=\'10\' height=\'10\' fill=\'%230f172a\'/></svg>')] border border-slate-600 rounded"></div>
             <span>Checkerboard pattern indicates transparent areas</span>
           </div>
           {!mainImg && (
             <div className="mt-2 text-slate-500 text-sm">Upload an image to start editing</div>
           )}
        </div>

        {/* Controls */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-6 backdrop-blur-md">
            
            {/* Main Image */}
            <div className="mb-6 pb-6 border-b border-white/5">
              <label className="block text-sm font-bold text-slate-300 mb-3">Main Image</label>
              <input 
                type="file" 
                accept="image/*"
                onChange={(e) => handleImageUpload(e, false)}
                className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-pink-500/10 file:text-pink-400 hover:file:bg-pink-500/20 transition-all cursor-pointer"
              />
              
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Width (px)</label>
                  <input 
                    type="number" 
                    value={config.width}
                    onChange={(e) => handleConfigChange('width', parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-pink-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Height (px)</label>
                  <input 
                    type="number" 
                    value={config.height}
                    onChange={(e) => handleConfigChange('height', parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-pink-500 outline-none"
                  />
                </div>
              </div>

              {mainImg && (
                <div className="mt-6 pt-6 border-t border-white/5 space-y-4">
                  <div>
                    <div className="flex justify-between mb-1">
                      <label className="text-xs font-bold text-slate-400">Zoom</label>
                      <span className="text-[10px] font-mono text-pink-400">{config.mainScale}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="10" 
                      max="300" 
                      value={config.mainScale}
                      onChange={(e) => handleConfigChange('mainScale', parseInt(e.target.value))}
                      className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <label className="text-xs font-bold text-slate-400">Rotation</label>
                      <span className="text-[10px] font-mono text-pink-400">{config.rotation}°</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="360" 
                      value={config.rotation}
                      onChange={(e) => handleConfigChange('rotation', parseInt(e.target.value))}
                      className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1">Position X</label>
                      <input 
                        type="range" 
                        min={-config.width} 
                        max={config.width} 
                        value={config.mainX}
                        onChange={(e) => handleConfigChange('mainX', parseInt(e.target.value))}
                        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1">Position Y</label>
                      <input 
                        type="range" 
                        min={-config.height} 
                        max={config.height} 
                        value={config.mainY}
                        onChange={(e) => handleConfigChange('mainY', parseInt(e.target.value))}
                        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Border Radius */}
            <div className="mb-6 pb-6 border-b border-white/5">
              <div className="flex justify-between mb-2">
                <label className="text-sm font-bold text-slate-300">Border Radius</label>
                <span className="text-xs font-mono text-pink-400">{config.borderRadius}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="50" 
                value={config.borderRadius}
                onChange={(e) => handleConfigChange('borderRadius', parseInt(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
              />
            </div>

            {/* Edge Softness (Feather) */}
            <div className="mb-6 pb-6 border-b border-white/5">
              <div className="flex justify-between mb-2">
                <label className="text-sm font-bold text-slate-300">Edge Softness</label>
                <span className="text-xs font-mono text-pink-400">{config.feather}px</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={config.feather}
                onChange={(e) => handleConfigChange('feather', parseInt(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
              />
            </div>

            {/* Overlay Image */}
            <div className="mb-6 pb-6 border-b border-white/5">
              <label className="block text-sm font-bold text-slate-300 mb-3">Overlay Image (Optional)</label>
              <input 
                type="file" 
                accept="image/*"
                onChange={(e) => handleImageUpload(e, true)}
                className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-500/10 file:text-indigo-400 hover:file:bg-indigo-500/20 transition-all cursor-pointer"
              />
              
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-xs font-bold text-slate-400">Scale</label>
                    <span className="text-[10px] font-mono text-indigo-400">{config.overlayScale}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="10" 
                    max="200" 
                    value={config.overlayScale}
                    onChange={(e) => handleConfigChange('overlayScale', parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-xs font-bold text-slate-400">Opacity</label>
                    <span className="text-[10px] font-mono text-indigo-400">{config.overlayOpacity}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={config.overlayOpacity}
                    onChange={(e) => handleConfigChange('overlayOpacity', parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Quality Settings */}
            <div className="mb-6 pb-6 border-b border-white/5">
              <label className="block text-sm font-bold text-slate-300 mb-3">Export Quality</label>
              <div className="flex gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
                  <button onClick={() => setSelectedQuality('low')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${selectedQuality === 'low' ? 'bg-red-500/20 text-red-400 shadow-glow-red' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>Low (WebP)</button>
                  <button onClick={() => setSelectedQuality('medium')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${selectedQuality === 'medium' ? 'bg-yellow-500/20 text-yellow-400 shadow-glow-yellow' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>Medium (WebP)</button>
                  <button onClick={() => setSelectedQuality('high')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${selectedQuality === 'high' ? 'bg-emerald-500/20 text-emerald-400 shadow-glow-green' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>High (PNG)</button>
              </div>
            </div>

            {/* Download Button */}
            <button 
              onClick={handleDownload}
              disabled={!mainImg}
              className={`w-full py-4 rounded-xl font-black text-sm uppercase tracking-widest shadow-lg transition-all hover:scale-[1.02] ${
                mainImg 
                  ? 'bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white shadow-pink-900/20' 
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              Download PNG
            </button>

          </div>
        </div>
      </div>
    </div>
  );
};
