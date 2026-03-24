
import pako from 'pako';
import { svgaSchema } from '../svga-proto';

/**
 * SVGA 2.0 EX Export Logic
 * This file is separate from the main workspace logic to allow independent modifications.
 */
export const handleSvgaExExport = async (params: {
    metadata: any,
    videoWidth: number,
    videoHeight: number,
    exportScale: number,
    svgaScale: number,
    svgaPos: { x: number, y: number },
    layerImages: Record<string, string>,
    assetColors: Record<string, string>,
    assetColorModes: Record<string, 'tint' | 'fill'>,
    deletedKeys: Set<string>,
    customLayers: any[],
    watermark: string | null,
    wmScale: number,
    wmPos: { x: number, y: number },
    audioUrl: string | null,
    audioFile: File | null,
    originalAudioUrl: string | null,
    fadeConfig: { top: number, bottom: number, left: number, right: number },
    applyTransparencyEffects: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
    setProgress: (p: number) => void,
    setExportPhase: (ph: string) => void,
    setIsExporting: (ex: boolean) => void,
    protobuf: any,
    globalQuality?: 'low' | 'medium' | 'high'
}) => {
    const {
        metadata, videoWidth, videoHeight, exportScale, svgaScale, svgaPos,
        layerImages, assetColors, assetColorModes, deletedKeys, customLayers, watermark,
        wmScale, wmPos, audioUrl, audioFile, originalAudioUrl, fadeConfig,
        applyTransparencyEffects, setProgress, setExportPhase, setIsExporting,
        protobuf, globalQuality
    } = params;

    const isEdgeFadeActive = fadeConfig.top > 0 || fadeConfig.bottom > 0 || fadeConfig.left > 0 || fadeConfig.right > 0;

    setIsExporting(true);
    setExportPhase('جاري تصدير SVGA 2.0 EX (برمجة خاصة)...');

    try {
        let message: any;
        const root = protobuf.parse(svgaSchema).root;
        const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");

        // Initialize message from metadata.videoItem if available to preserve workspace changes (like copied layers)
        if (metadata.videoItem) {
            // Clone the videoItem to avoid mutating the original
            const vi = metadata.videoItem;
            message = MovieEntity.create({
                version: vi.version || "2.0",
                params: {
                    viewBoxWidth: vi.videoSize?.width || videoWidth,
                    viewBoxHeight: vi.videoSize?.height || videoHeight,
                    fps: metadata.fps || vi.FPS || 30,
                    frames: vi.frames || metadata.frames || 0
                },
                images: {}, // Will be populated below
                sprites: JSON.parse(JSON.stringify(vi.sprites || [])),
                audios: JSON.parse(JSON.stringify(vi.audios || []))
            });

            // Handle images from videoItem
            const viImages = vi.images || {};
            const processedImages: Record<string, Uint8Array> = {};
            for (const [key, val] of Object.entries(viImages)) {
                if (typeof val === 'string') {
                    const base64 = (val as string).startsWith('data:') ? (val as string).split(',')[1] : (val as string);
                    const binary = atob(base64);
                    const bytes = new Uint8Array(binary.length);
                    for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
                    processedImages[key] = bytes;
                } else if (val instanceof Uint8Array) {
                    processedImages[key] = val;
                }
            }
            message.images = processedImages;
        } else if (metadata.type === 'SVGA') {
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
                if (!binaryFile) throw new Error("Invalid SVGA 1.0 file: movie.binary not found.");
                const binaryData = await binaryFile.async("uint8array");
                message = MovieEntity.decode(binaryData);
                
                message.images = message.images || {};
                for (const filename of Object.keys(zip.files)) {
                    if (filename.endsWith('.png') || filename.endsWith('.jpg') || filename.endsWith('.jpeg')) {
                        const key = filename.replace(/\.(png|jpg|jpeg)$/, '');
                        const imgData = await zip.file(filename)?.async("uint8array");
                        if (imgData) message.images[key] = imgData;
                    }
                }
            } else {
                const inflated = pako.inflate(uint8Array);
                message = MovieEntity.decode(inflated);
            }
        } else {
            throw new Error("Unable to initialize SVGA export: No video data available.");
        }

        // Filter deleted sprites
        if (message.sprites) {
            message.sprites = message.sprites.filter((s: any) => !deletedKeys.has(s.imageKey));
        }

        // Process Images
        const imagesData: Record<string, Uint8Array> = {};
        const sourceImages = message.images || (metadata.videoItem ? metadata.videoItem.images : {});
        const keys = Object.keys(sourceImages);

        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            if (deletedKeys.has(key)) continue;

            let finalBase64 = "";
            if (layerImages[key]) {
                finalBase64 = layerImages[key];
            } else {
                const imgData = sourceImages[key];
                if (!imgData) continue;
                if (typeof imgData === 'string') {
                    finalBase64 = imgData.startsWith('data:') ? imgData : `data:image/png;base64,${imgData}`;
                } else {
                    let binary = '';
                    const len = imgData.byteLength;
                    for (let k = 0; k < len; k++) binary += String.fromCharCode(imgData[k]);
                    finalBase64 = `data:image/png;base64,${btoa(binary)}`;
                }
            }

            if (!finalBase64) continue;

            // Apply modifications (Scale, Tint, Fade, Quality)
            const hasColorTint = !!assetColors[key];
            const needsQualityCompression = globalQuality === 'low' || globalQuality === 'medium';
            
            if (exportScale < 0.99 || isEdgeFadeActive || hasColorTint || needsQualityCompression) {
                const img = new Image();
                img.src = finalBase64;
                await new Promise(r => img.onload = r);
                const canvas = document.createElement('canvas');
                
                let targetScale = exportScale < 0.99 ? exportScale : 1.0;
                // Auto-downscale for low quality
                if (globalQuality === 'low' && targetScale > 0.7) targetScale = 0.7;
                if (globalQuality === 'medium' && targetScale > 0.85) targetScale = 0.85;

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
                    
                    // Apply color levels reduction if quality is low
                    if (needsQualityCompression) {
                        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        const data = imageData.data;
                        const qFactor = globalQuality === 'low' ? 0.4 : 0.7;
                        const levels = Math.max(2, Math.floor(qFactor * 255));
                        const factor = 255 / (levels - 1);
                        for (let j = 0; j < data.length; j += 4) {
                            data[j] = Math.round(Math.round(data[j] / factor) * factor);
                            data[j+1] = Math.round(Math.round(data[j+1] / factor) * factor);
                            data[j+2] = Math.round(Math.round(data[j+2] / factor) * factor);
                        }
                        ctx.putImageData(imageData, 0, 0);
                    }

                    if (isEdgeFadeActive) applyTransparencyEffects(ctx, canvas.width, canvas.height);
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

        // Apply Layout Transformations
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

        // Add Custom Layers (Back/Front)
        const processLayer = async (layer: any, isBack: boolean) => {
            const layerKey = layer.id;
            let bytes: Uint8Array | null = null;
            if (layer.url.startsWith('blob:')) {
                const res = await fetch(layer.url);
                bytes = new Uint8Array(await res.arrayBuffer());
            } else if (layer.url.includes(',')) {
                const binary = atob(layer.url.split(',')[1]);
                bytes = new Uint8Array(binary.length);
                for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
            }
            if (!bytes) return;
            message.images[layerKey] = bytes;
            const finalWidth = layer.width * layer.scale;
            const finalHeight = layer.height * layer.scale;
            const layerFrame = {
                alpha: 1.0,
                layout: { x: parseFloat(layer.x.toString()), y: parseFloat(layer.y.toString()), width: parseFloat(finalWidth.toString()), height: parseFloat(finalHeight.toString()) },
                transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }
            };
            if (!message.sprites) message.sprites = [];
            if (isBack) message.sprites.unshift({ imageKey: layerKey, frames: Array(message.params.frames || 1).fill(layerFrame) });
            else message.sprites.push({ imageKey: layerKey, frames: Array(message.params.frames || 1).fill(layerFrame) });
        };

        for (const layer of customLayers.filter(l => l.zIndexMode === 'back').reverse()) await processLayer(layer, true);
        for (const layer of customLayers.filter(l => l.zIndexMode === 'front')) await processLayer(layer, false);

        // Watermark
        if (watermark) {
            const wmKey = "quantum_wm_ex";
            const binary = atob(watermark.split(',')[1]);
            const bytes = new Uint8Array(binary.length);
            for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
            message.images[wmKey] = bytes;

            const wmFrame = {
                alpha: 1.0,
                layout: { x: (videoWidth / 2) + wmPos.x, y: (videoHeight / 2) + wmPos.y, width: videoWidth * wmScale, height: (videoWidth * wmScale) },
                transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }
            };
            if (!message.sprites) message.sprites = [];
            message.sprites.push({ imageKey: wmKey, frames: Array(message.params.frames || 1).fill(wmFrame) });
        }

        // Audio
        if (audioUrl) {
            const audioKey = "quantum_audio_ex";
            let bytes: Uint8Array | null = null;
            if (audioFile) bytes = new Uint8Array(await audioFile.arrayBuffer());
            else if (audioUrl !== originalAudioUrl) {
                const res = await fetch(audioUrl);
                bytes = new Uint8Array(await res.arrayBuffer());
            }
            if (bytes) {
                message.images[audioKey] = bytes;
                message.audios = [{ audioKey, startFrame: 0, endFrame: message.params.frames || 0, startTime: 0, totalTime: Math.floor(((message.params.frames || 0) / (message.params.fps || 30)) * 1000) }];
            }
        }

        const bufferOut = MovieEntity.encode(message).finish();
        const compressedBuffer = pako.deflate(bufferOut);
        const link = document.createElement("a");
        link.href = URL.createObjectURL(new Blob([compressedBuffer]));
        link.download = `${metadata.name.replace('.svga','')}_Quantum_EX.svga`;
        link.click();
        setProgress(100);

    } catch (e) {
        console.error(e);
        alert("فشل تصدير EX: " + (e as any).message);
    } finally {
        setTimeout(() => setIsExporting(false), 800);
    }
};
