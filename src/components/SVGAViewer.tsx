import React, { useEffect, useRef, useState } from 'react';
import { 
  Play, 
  Pause, 
  Layers,
  Download,
  FileArchive,
  Video,
  Eye,
  EyeOff,
  Search,
  ChevronLeft,
  Plus,
  Pencil,
  PenTool,
  Trash2,
  ExternalLink,
  Clock
} from 'lucide-react';
import pako from 'pako';
import { parse } from 'protobufjs';
import gifshot from 'gifshot';
import * as mp4Muxer from 'mp4-muxer';
import * as webmMuxer from 'webm-muxer';
import { svgaSchema } from '../svga-proto';
import { SVGAFileInfo, PlayerStatus } from '../types';

interface SVGAViewerProps {
  file: SVGAFileInfo;
  onClear: () => void;
  originalFile?: File; 
}

interface ConvertedFile {
  id: string;
  name: string;
  format: 'mp4' | 'gif' | 'webp' | 'svga' | 'zip' | 'ae';
  url: string;
  timestamp: number;
  size?: string;
}

export const SVGAViewer: React.FC<SVGAViewerProps> = ({ file, onClear, originalFile }) => {
  const containerRef = useRef<any>(null);
  const playerRef = useRef<any>(null);
  const videoItemRef = useRef<any>(null);
  const [status, setStatus] = useState<PlayerStatus>(PlayerStatus.LOADING);
  const [isLoop] = useState(true);
  const [bgColor, setBgColor] = useState('transparent');
  const [progress, setProgress] = useState(0);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [assets, setAssets] = useState<{id: string, data: string}[]>([]);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState('');
  const [hiddenAssets, setHiddenAssets] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const [videoSize, setVideoSize] = useState<{width: number, height: number} | null>(null);
  const [audioFiles, setAudioFiles] = useState<{id: string, name: string, data: string, type: 'builtin' | 'custom'}[]>([]);
  const [isAudioModified, setIsAudioModified] = useState(false);
  const [isAssetsModified, setIsAssetsModified] = useState(false);
  const [customBg, setCustomBg] = useState<string | null>(null);
  const [watermark, setWatermark] = useState<string | null>(null);
  const [watermarkScale, setWatermarkScale] = useState(1);
  const [targetVideoDuration, setTargetVideoDuration] = useState(5);
  const [showDurationModal, setShowDurationModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<'mp4' | 'gif' | 'webp'>('mp4');
  const [replacingAssetId, setReplacingAssetId] = useState<string | null>(null);
  const [convertedFiles, setConvertedFiles] = useState<ConvertedFile[]>([]);
  const [previewFile, setPreviewFile] = useState<ConvertedFile | null>(null);
  const [enableTransparentExports, setEnableTransparentExports] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const watermarkInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const howlInstancesRef = useRef<{ [id: string]: any }>({});
  const lastPlayedFrameRef = useRef(-1);

  const bgOptions = [
    { label: 'Dark', value: '#0f0f0f' },
    { label: 'Green', value: '#14532d' },
    { label: 'White', value: '#ffffff' },
    { label: 'Transparent', value: 'transparent' },
    { label: 'Red', value: '#800000' },
    { label: 'Blue', value: '#0000FF' },
    { label: 'Yellow', value: '#FFFF00' },
  ];

  useEffect(() => {
    let isMounted = true;
    let player: any = null;

    const init = async () => {
      try {
        setStatus(PlayerStatus.LOADING);
        const SVGA: any = await new Promise((resolve) => {
          const check = () => (window as any).SVGA ? resolve((window as any).SVGA) : setTimeout(check, 100);
          check();
        });

        if (containerRef.current) containerRef.current.innerHTML = '';
        player = new SVGA.Player(containerRef.current);
        const parser = new SVGA.Parser();
        
        player.setContentMode('AspectFit'); 
        player.loops = isLoop ? 0 : 1;
        player.clearsAfterStop = false;

        player.onFrame((frame: number) => {
          if (isMounted) {
            setCurrentFrame(frame);
            if (totalFrames > 0) setProgress((frame / totalFrames) * 100);
          }
        });

        player.onFinished(() => {
          if (isMounted) {
            setStatus(PlayerStatus.PAUSED);
            // Also stop custom audio explicitly just in case
            (Object.values(howlInstancesRef.current) as any[]).forEach(sound => {
              sound.stop();
            });
          }
        });

        let source: string = file.url;
        if (originalFile) {
          source = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(originalFile);
          });
        }

        parser.load(source, (videoItem: any) => {
          if (!isMounted) return;
          if (videoItem.images) {
            const extracted = Object.keys(videoItem.images).map(key => ({
              id: key,
              data: typeof videoItem.images[key] === 'string' 
                ? (videoItem.images[key].startsWith('data') ? videoItem.images[key] : `data:image/png;base64,${videoItem.images[key]}`)
                : videoItem.images[key].src
            }));
            setAssets(extracted);
          }
          
          // Handle existing audios in SVGA
          if (videoItem.audios && videoItem.audios.length > 0) {
            const extractedAudios = videoItem.audios.map((audio: any, index: number) => {
               return {
                 id: audio.audioKey || `builtin_audio_${index}`,
                 name: `Original Audio ${index + 1}`,
                 data: '', // Built-in audio data is handled by the player
                 type: 'builtin' as const
               };
            });
            setAudioFiles(prev => [...prev.filter(a => a.type !== 'builtin'), ...extractedAudios]);
          }

          videoItemRef.current = videoItem;
          setTotalFrames(videoItem.frames);
          if (videoItem.videoSize) {
            setVideoSize({ width: videoItem.videoSize.width, height: videoItem.videoSize.height });
          }
          player.setVideoItem(videoItem);
          player.startAnimation();
          playerRef.current = player;
          setStatus(PlayerStatus.PLAYING);
        }, () => {
          if (isMounted) setStatus(PlayerStatus.ERROR);
        });
      } catch (err) {
        if (isMounted) setStatus(PlayerStatus.ERROR);
      }
    };
    init();
    return () => { 
      isMounted = false; 
      if (player) {
        player.stopAnimation();
        if (typeof player.clear === 'function') {
          player.clear();
        }
      }
    };
  }, [file.url, originalFile, isLoop]);

  const togglePlay = () => {
    if (!playerRef.current) return;
    status === PlayerStatus.PLAYING ? playerRef.current.pauseAnimation() : playerRef.current.startAnimation();
    setStatus(status === PlayerStatus.PLAYING ? PlayerStatus.PAUSED : PlayerStatus.PLAYING);
  };

  const toggleAssetVisibility = (assetId: string) => {
    if (!playerRef.current || !videoItemRef.current) return;
    
    setHiddenAssets(prev => {
      const newHidden = new Set(prev);
      if (newHidden.has(assetId)) {
        newHidden.delete(assetId);
      } else {
        newHidden.add(assetId);
      }
      
      // Update SVGA player dynamically
      const videoItem = videoItemRef.current;
      if (videoItem && videoItem.sprites) {
        if (newHidden.has(assetId)) {
          // Hide by setting an empty transparent 1x1 image
          playerRef.current.setImage('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', assetId);
        } else {
          // Restore original image
          const originalAsset = assets.find(a => a.id === assetId);
          if (originalAsset) {
            playerRef.current.setImage(originalAsset.data, assetId);
          }
        }
      }
      
      return newHidden;
    });
  };

  const addConvertedFile = (name: string, format: ConvertedFile['format'], url: string, blob?: Blob) => {
    const newFile: ConvertedFile = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      format,
      url,
      timestamp: Date.now(),
      size: blob ? (blob.size / 1024).toFixed(1) + ' KB' : undefined
    };
    setConvertedFiles(prev => [newFile, ...prev]);
  };

  const exportAsZip = async () => {
    if (!playerRef.current || !videoItemRef.current || exporting) return;
    const JSZip = (window as any).JSZip;
    if (!JSZip) return alert("Please wait for required libraries to load.");

    try {
      setExporting(true);
      setExportProgress(0);
      setExportStatus('Initializing extraction engine...');
      
      playerRef.current.pauseAnimation();
      setStatus(PlayerStatus.PAUSED);

      const { width, height } = videoItemRef.current.videoSize;
      const zip = new JSZip();

      const exportContainer = document.createElement('div');
      exportContainer.style.position = 'fixed';
      exportContainer.style.left = '-9999px';
      exportContainer.style.top = '-9999px';
      exportContainer.style.width = `${width}px`;
      exportContainer.style.height = `${height}px`;
      exportContainer.style.backgroundColor = bgColor;
      document.body.appendChild(exportContainer);

      const SVGA = (window as any).SVGA;
      const exportPlayer = new SVGA.Player(exportContainer);
      exportPlayer.setContentMode('Fill'); 
      exportPlayer.setVideoItem(videoItemRef.current);

      // Apply hidden assets to export player
      hiddenAssets.forEach(assetId => {
         exportPlayer.setImage('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', assetId);
      });

      await new Promise(r => setTimeout(r, 800));

      for (let i = 0; i < totalFrames; i++) {
        setExportStatus(`Capturing frame ${i + 1} of ${totalFrames}...`);
        exportPlayer.stepToFrame(i, false);
        await new Promise(r => setTimeout(r, 100));
        
        const canvas = exportContainer.querySelector('canvas');
        if (canvas) {
          const dataUrl = canvas.toDataURL('image/png', 1.0);
          const base64Data = dataUrl.replace(/^data:image\/(png|jpg);base64,/, "");
          zip.file(`frame_${i.toString().padStart(5, '0')}.png`, base64Data, {base64: true});
        }
        setExportProgress(Math.round(((i + 1) / totalFrames) * 100));
      }

      setExportStatus('Compressing file and preparing download...');
      const content = await zip.generateAsync({type: "blob"});
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      const fileName = `${file.name.replace('.svga', '')}_Sequence.zip`;
      link.download = fileName;
      link.click();

      addConvertedFile(fileName, 'zip', url, content);

      document.body.removeChild(exportContainer);
      exportPlayer.clear();
      
      setExporting(false);
      playerRef.current.startAnimation();
      setStatus(PlayerStatus.PLAYING);
    } catch (err) {
      console.error("Export Error:", err);
      setExporting(false);
      alert("An error occurred during export.");
    }
  };

  const exportAsAEProject = async () => {
    if (!playerRef.current || !videoItemRef.current || exporting) return;
    const JSZip = (window as any).JSZip;
    if (!JSZip) return alert("Please wait for required libraries to load.");

    try {
      setExporting(true);
      setExportProgress(0);
      setExportStatus('Preparing After Effects files...');
      
      const zip = new JSZip();
      const assetsFolder = zip.folder("assets");
      const videoItem = videoItemRef.current;
      
      const imageKeys = Object.keys(videoItem.images);
      
      for (let i = 0; i < imageKeys.length; i++) {
        const key = imageKeys[i];
        let data = videoItem.images[key];
        let base64Data = "";
        if (typeof data === 'string') {
           base64Data = data.replace(/^data:image\/(png|jpg);base64,/, "");
        } else if (data.src) {
           base64Data = data.src.replace(/^data:image\/(png|jpg);base64,/, "");
        }
        
        if (base64Data) {
           assetsFolder?.file(`${key}.png`, base64Data, {base64: true});
        }
      }

      setExportProgress(30);
      setExportStatus('Generating animation data...');

      const width = videoItem.videoSize.width;
      const height = videoItem.videoSize.height;
      const fps = videoItem.FPS || 30;
      const totalFrames = videoItem.frames;
      const duration = totalFrames / fps;

      const spritesData = videoItem.sprites.map((sprite: any) => {
          return {
              imageKey: sprite.imageKey,
              frames: sprite.frames.map((f: any) => ({
                  alpha: f.alpha,
                  transform: f.transform ? {
                      a: f.transform.a,
                      b: f.transform.b,
                      c: f.transform.c,
                      d: f.transform.d,
                      tx: f.transform.tx,
                      ty: f.transform.ty
                  } : null
              }))
          };
      });

      zip.file("data.json", JSON.stringify(spritesData));

      setExportProgress(60);
      setExportStatus('Generating JSX script...');

      const fileNameWithoutExt = file.name.replace('.svga', '').replace(/"/g, '\\"');
      const jsxContent = `// Auto-generated After Effects Script from Flex Studio Pro
(function() {
    app.beginUndoGroup("Import SVGA");

    var compName = "${fileNameWithoutExt}";
    var compWidth = ${width};
    var compHeight = ${height};
    var compPixelAspect = 1;
    var compDuration = ${duration};
    var compFPS = ${fps};

    // Prompt user to select the assets folder
    var assetsFolder = Folder.selectDialog("Please select the 'assets' folder for " + compName);
    if (!assetsFolder) {
        alert("Operation cancelled. You must select the assets folder.");
        return;
    }

    // Look for data.json in the parent directory of the selected assets folder
    var dataFile = new File(assetsFolder.parent.fsName + "/data.json");
    if (!dataFile.exists) {
        // Fallback: look inside the assets folder just in case
        dataFile = new File(assetsFolder.fsName + "/data.json");
        if (!dataFile.exists) {
            alert("Could not find data.json! Please make sure it's in the same folder as the assets folder.");
            return;
        }
    }

    var myItemCollection = app.project.items;
    var myComp = myItemCollection.addComp(compName, compWidth, compHeight, compPixelAspect, compDuration, compFPS);
    myComp.openInViewer();

    var importedAssets = {};

    if (assetsFolder.exists) {
        var files = assetsFolder.getFiles("*.png");
        for (var i = 0; i < files.length; i++) {
            var importOptions = new ImportOptions(files[i]);
            if (importOptions.canImportAs(ImportAsType.FOOTAGE)) {
                var importedItem = app.project.importFile(importOptions);
                var keyName = decodeURIComponent(files[i].name).replace(".png", "");
                importedAssets[keyName] = importedItem;
            }
        }
    }

    dataFile.open("r");
    var jsonString = dataFile.read();
    dataFile.close();

    var sprites = eval("(" + jsonString + ")");

    for (var s = 0; s < sprites.length; s++) {
        var sprite = sprites[s];
        if (!sprite.imageKey || !importedAssets[sprite.imageKey]) continue;
        
        var assetItem = importedAssets[sprite.imageKey];
        var layer = myComp.layers.add(assetItem);
        layer.name = sprite.imageKey + "_" + s;
        
        layer.property("Anchor Point").setValue([0, 0]);
        
        var opacityProp = layer.property("Opacity");
        var positionProp = layer.property("Position");
        var scaleProp = layer.property("Scale");
        var rotationProp = layer.property("Rotation");

        for (var f = 0; f < sprite.frames.length; f++) {
            var frameData = sprite.frames[f];
            var time = f / compFPS;
            
            var alpha = frameData.alpha !== undefined ? frameData.alpha * 100 : 100;
            opacityProp.setValueAtTime(time, alpha);
            
            if (frameData.transform) {
                var t = frameData.transform;
                var scaleX = Math.sqrt(t.a * t.a + t.b * t.b);
                var scaleY = Math.sqrt(t.c * t.c + t.d * t.d);
                
                var det = t.a * t.d - t.b * t.c;
                if (det < 0) {
                    scaleY = -scaleY;
                }
                
                var rotation = 0;
                if (scaleX !== 0) {
                    rotation = Math.atan2(t.b, t.a) * (180 / Math.PI);
                } else if (scaleY !== 0) {
                    rotation = Math.atan2(-t.c, t.d) * (180 / Math.PI);
                }
                
                positionProp.setValueAtTime(time, [t.tx, t.ty]);
                scaleProp.setValueAtTime(time, [scaleX * 100, scaleY * 100]);
                rotationProp.setValueAtTime(time, rotation);
            }
        }
    }

    app.endUndoGroup();
    alert("SVGA project imported successfully!");
})();`;

      zip.file(`${fileNameWithoutExt}.jsx`, jsxContent);

      setExportProgress(80);
      setExportStatus('Compressing file and preparing download...');
      const content = await zip.generateAsync({type: "blob"});
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      const fileName = `${file.name.replace('.svga', '')}_AE_Project.zip`;
      link.download = fileName;
      link.click();
      
      addConvertedFile(fileName, 'ae', url, content);

      setExporting(false);
      setExportProgress(100);
    } catch (err) {
      console.error("AE Export Error:", err);
      setExporting(false);
      alert("An error occurred while exporting to After Effects.");
    }
  };

  const downloadModifiedSVGA = async () => {
    if (hiddenAssets.size === 0 && !isAudioModified && !isAssetsModified) {
      const a = document.createElement('a');
      a.href = file.url;
      a.download = file.name;
      a.click();
      return;
    }

    try {
      setExporting(true);
      setExportStatus('Modifying SVGA file...');
      setExportProgress(10);

      let buffer: ArrayBuffer;
      if (originalFile) {
        buffer = await originalFile.arrayBuffer();
      } else {
        const res = await fetch(file.url);
        buffer = await res.arrayBuffer();
      }

      setExportProgress(30);

      const uint8Array = new Uint8Array(buffer);
      const isZip = uint8Array[0] === 0x50 && uint8Array[1] === 0x4B && uint8Array[2] === 0x03 && uint8Array[3] === 0x04;

      const transparentPngBytes = new Uint8Array([
        137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 
        0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 
        0, 0, 11, 73, 68, 65, 84, 8, 215, 99, 96, 0, 2, 0, 0, 5, 0, 
        1, 226, 38, 5, 155, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130
      ]);

      let finalBlob: Blob;

      if (isZip) {
        // SVGA 1.0 (ZIP)
        const JSZip = (window as any).JSZip;
        if (!JSZip) throw new Error("JSZip not loaded");
        
        const zip = await JSZip.loadAsync(buffer);
        setExportProgress(60);

        // Apply hidden assets
        hiddenAssets.forEach(assetId => {
          const possibleNames = [assetId, `${assetId}.png`, `${assetId}.jpg`, `${assetId}.jpeg`];
          for (const name of possibleNames) {
            if (zip.file(name)) {
              zip.file(name, transparentPngBytes);
            }
          }
        });

        // Apply replaced assets
        for (const asset of assets) {
          if (asset.data.startsWith('data:image')) {
            const base64Data = asset.data.split(',')[1];
            const binaryString = window.atob(base64Data);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            
            const possibleNames = [asset.id, `${asset.id}.png`, `${asset.id}.jpg`, `${asset.id}.jpeg`];
            let found = false;
            for (const name of possibleNames) {
              if (zip.file(name)) {
                zip.file(name, bytes);
                found = true;
              }
            }
            if (!found) {
              zip.file(`${asset.id}.png`, bytes);
            }
          }
        }

        const customAudios = audioFiles.filter(a => a.type === 'custom');
        if (customAudios.length > 0) {
          alert("Audio modification is only fully supported for SVGA 2.0 files. The exported file might not contain the new audio.");
        }

        setExportProgress(80);
        const content = await zip.generateAsync({type: "blob"});
        finalBlob = content;
      } else {
        // SVGA 2.0 (zlib + protobuf)
        setExportStatus('Decompressing file...');
        const inflated = pako.inflate(uint8Array);
        
        setExportProgress(50);
        setExportStatus('Parsing data...');
        
        const root = parse(svgaSchema).root;
        const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");
        
        const message = MovieEntity.decode(inflated) as any;
        
        setExportProgress(70);
        setExportStatus('Applying modifications...');

        if (message.images) {
          // Apply hidden assets
          hiddenAssets.forEach(assetId => {
            if (message.images[assetId]) {
              message.images[assetId] = transparentPngBytes;
            }
          });

          // Apply replaced assets
          for (const asset of assets) {
            if (asset.data.startsWith('data:image')) {
              const base64Data = asset.data.split(',')[1];
              const binaryString = window.atob(base64Data);
              const len = binaryString.length;
              const bytes = new Uint8Array(len);
              for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              message.images[asset.id] = bytes;
            }
          }
        }

        // Handle audio modifications
        const customAudios = audioFiles.filter(a => a.type === 'custom');
        const builtinAudios = audioFiles.filter(a => a.type === 'builtin');
        
        if (customAudios.length > 0) {
          if (!message.audios) message.audios = [];
          if (!message.images) message.images = {};
          
          // Clear existing audios because we replace them
          message.audios = [];
          
          customAudios.forEach(audio => {
            // Convert base64 data to Uint8Array
            const base64Data = audio.data.split(',')[1];
            const binaryString = window.atob(base64Data);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            
            message.images[audio.id] = bytes;
            message.audios.push({
              audioKey: audio.id,
              startFrame: 0,
              endFrame: message.params?.frames || 0,
              startTime: 0,
              totalTime: 0
            });
          });
        } else if (message.audios) {
          // If no custom audios, filter the built-in audios to only keep the ones that weren't removed
          const builtinAudioIds = builtinAudios.map(a => a.id);
          message.audios = message.audios.filter((a: any, index: number) => {
             const audioId = a.audioKey || `builtin_audio_${index}`;
             return builtinAudioIds.includes(audioId);
          });
        }

        setExportProgress(80);
        setExportStatus('Recompressing file...');

        const encoded = MovieEntity.encode(message).finish();
        const deflated = pako.deflate(encoded);
        
        finalBlob = new Blob([deflated], { type: 'application/octet-stream' });
      }

      setExportProgress(90);
      setExportStatus('Saving file...');
      
      const url = URL.createObjectURL(finalBlob);
      const a = document.createElement('a');
      a.href = url;
      const fileName = `${file.name.replace('.svga', '')}_modified.svga`;
      a.download = fileName;
      a.click();
      
      addConvertedFile(fileName, 'svga', url, finalBlob);

      setExportProgress(100);
      setExporting(false);
    } catch (err) {
      console.error("SVGA Modify Error:", err);
      setExporting(false);
      alert("An error occurred while modifying and saving the SVGA file. Please ensure the file is valid.");
    }
  };

  const handleAudioUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result as string;
      const newAudioId = `custom_audio_${Date.now()}`;
      
      // Remove built-in audios from the player
      if (videoItemRef.current && videoItemRef.current.audios) {
        const initialLength = videoItemRef.current.audios.length;
        videoItemRef.current.audios = []; // Clear all built-in audios
        
        if (initialLength > 0 && playerRef.current && status === PlayerStatus.PLAYING) {
           playerRef.current.stopAnimation();
           playerRef.current.startAnimation();
        }
      }

      // Replace all audios in the state with the new custom audio
      setAudioFiles([
        {
          id: newAudioId,
          name: file.name,
          data: data,
          type: 'custom'
        }
      ]);
      setIsAudioModified(true);
    };
    reader.readAsDataURL(file);
    
    // Reset input
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const handleRemoveAudio = (id: string) => {
    const audioToRemove = audioFiles.find(a => a.id === id);
    setAudioFiles(prev => prev.filter(a => a.id !== id));
    
    if (audioToRemove?.type === 'builtin' && videoItemRef.current && videoItemRef.current.audios) {
      const initialLength = videoItemRef.current.audios.length;
      videoItemRef.current.audios = videoItemRef.current.audios.filter((a: any, index: number) => {
        const audioId = a.audioKey || `builtin_audio_${index}`;
        return audioId !== id;
      });
      
      if (videoItemRef.current.audios.length < initialLength && playerRef.current && status === PlayerStatus.PLAYING) {
         playerRef.current.stopAnimation();
         playerRef.current.startAnimation();
      }
    }
    setIsAudioModified(true);
  };

  // Effect to manage Howl instances
  useEffect(() => {
    if (!(window as any).Howl) return;

    // Create new instances
    audioFiles.forEach(audio => {
      if (audio.type === 'custom' && !howlInstancesRef.current[audio.id]) {
        howlInstancesRef.current[audio.id] = new (window as any).Howl({
          src: [audio.data],
          loop: isLoop,
          html5: true // Better for larger files
        });
      }
    });

    // Remove deleted instances
    const currentIds = audioFiles.filter(a => a.type === 'custom').map(a => a.id);
    Object.keys(howlInstancesRef.current).forEach(id => {
      if (!currentIds.includes(id)) {
        howlInstancesRef.current[id].unload();
        delete howlInstancesRef.current[id];
      }
    });

  }, [audioFiles, isLoop]);

  // Cleanup effect on unmount
  useEffect(() => {
    return () => {
      Object.values(howlInstancesRef.current).forEach((sound: any) => {
        sound.unload();
      });
      howlInstancesRef.current = {};
    };
  }, []);

  // Effect to handle custom audio playback sync
  useEffect(() => {
    if (status === PlayerStatus.PLAYING) {
      if (currentFrame === 0 && lastPlayedFrameRef.current !== 0) {
        (Object.values(howlInstancesRef.current) as any[]).forEach(sound => {
          sound.stop();
          sound.play();
        });
        lastPlayedFrameRef.current = 0;
      } else if (currentFrame > 0) {
        lastPlayedFrameRef.current = currentFrame;
        // Resume if not playing
        (Object.values(howlInstancesRef.current) as any[]).forEach(sound => {
          if (!sound.playing()) {
             const fps = videoItemRef.current?.FPS || 30;
             sound.seek(currentFrame / fps);
             sound.play();
          }
        });
      }
    } else if (status === PlayerStatus.PAUSED) {
      (Object.values(howlInstancesRef.current) as any[]).forEach(sound => {
        sound.stop();
      });
      lastPlayedFrameRef.current = -1;
    }
  }, [status, currentFrame]);

  const filteredAssets = assets.filter(a => a.id.toLowerCase().includes(searchQuery.toLowerCase()));

  const fps = videoItemRef.current?.FPS || 0;
  const duration = fps > 0 ? (totalFrames / fps).toFixed(2) : '0.00';
  const width = videoItemRef.current?.videoSize?.width || 0;
  const height = videoItemRef.current?.videoSize?.height || 0;
  const version = videoItemRef.current?.version || '2.0';
  const fileSize = originalFile ? (originalFile.size / 1024).toFixed(2) + ' KB' : 'Unknown';

  const handleReplaceImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !replacingAssetId || !playerRef.current) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result as string;
      
      // Update the asset in our state
      setAssets(prev => prev.map(a => a.id === replacingAssetId ? { ...a, data } : a));
      setIsAssetsModified(true);
      
      // Update the SVGA player
      playerRef.current.setImage(data, replacingAssetId);
      
      setReplacingAssetId(null);
    };
    reader.readAsDataURL(file);
    if (replaceInputRef.current) replaceInputRef.current.value = '';
  };

  const handleBgUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => setCustomBg(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleWatermarkUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => setWatermark(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const downloadAsset = (asset: {id: string, data: string}) => {
    const link = document.createElement('a');
    link.href = asset.data;
    link.download = `${asset.id}.png`;
    link.click();
  };

  const exportAsVideo = async (formatOverride?: 'mp4' | 'gif' | 'webp', forceTransparent?: boolean) => {
    const currentFormat = formatOverride || exportFormat;
    const isTransparent = forceTransparent || (bgColor === 'transparent');
    if (!playerRef.current || !videoItemRef.current || exporting) return;
    
    try {
      setExporting(true);
      setExportProgress(0);
      setExportStatus(`Initializing ${currentFormat.toUpperCase()}${isTransparent ? ' (Transparent)' : ''} engine...`);
      
      playerRef.current.pauseAnimation();
      setStatus(PlayerStatus.PAUSED);

      const { width, height } = videoItemRef.current.videoSize;
      const fps = videoItemRef.current.FPS || 30;
      const totalFramesInSvga = videoItemRef.current.frames;
      const totalFramesToRecord = Math.ceil(targetVideoDuration * fps);
      
      const captureCanvas = document.createElement('canvas');
      captureCanvas.width = width;
      captureCanvas.height = height;
      const ctx = captureCanvas.getContext('2d', { alpha: true });
      if (!ctx) throw new Error("Could not create canvas context");

      // Prepare background image if exists
      let bgImg: HTMLImageElement | null = null;
      if (customBg && !isTransparent) {
        bgImg = new Image();
        bgImg.src = customBg;
        await new Promise((resolve) => { bgImg!.onload = resolve; bgImg!.onerror = resolve; });
      }

      // Prepare watermark image if exists
      let watermarkImg: HTMLImageElement | null = null;
      if (watermark) {
        watermarkImg = new Image();
        watermarkImg.src = watermark;
        await new Promise((resolve) => { 
          watermarkImg!.onload = resolve; 
          watermarkImg!.onerror = () => { watermarkImg = null; resolve(null); }; 
        });
      }

      // Prepare Audio if exists
      let audioBuffer: AudioBuffer | null = null;
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      if (audioFiles.length > 0) {
        setExportStatus('Preparing audio tracks...');
        try {
          // Create an offline context for the full duration
          const offlineCtx = new OfflineAudioContext(2, Math.ceil(targetVideoDuration * audioCtx.sampleRate), audioCtx.sampleRate);
          
          for (const audio of audioFiles) {
            let data: ArrayBuffer | null = null;
            if (audio.type === 'custom') {
              const res = await fetch(audio.data);
              data = await res.arrayBuffer();
            } else if (videoItemRef.current.images[audio.id]) {
              const imgData = videoItemRef.current.images[audio.id];
              if (imgData instanceof Uint8Array) {
                data = imgData.buffer;
              } else if (typeof imgData === 'string') {
                const base64 = imgData.split(',')[1] || imgData;
                const binary = window.atob(base64);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                data = bytes.buffer;
              }
            }

            if (data) {
              const buffer = await offlineCtx.decodeAudioData(data);
              const source = offlineCtx.createBufferSource();
              source.buffer = buffer;
              source.connect(offlineCtx.destination);
              
              // If it's a loop, we might need to repeat it
              if (isLoop && buffer.duration < targetVideoDuration) {
                source.loop = true;
                source.loopEnd = buffer.duration;
              }
              source.start(0);
            }
          }
          
          audioBuffer = await offlineCtx.startRendering();
        } catch (err) {
          console.error("Audio preparation failed:", err);
        }
      }

      const frames: string[] = [];
      const chunks: Blob[] = [];
      let recorder: MediaRecorder | null = null;
      let muxer: any = null;
      let encoder: any = null;
      let audioEncoder: any = null;
      let useVideoEncoder = false;

      if ((currentFormat === 'mp4' || currentFormat === 'webp') && typeof VideoEncoder !== 'undefined') {
        const config: any = {
          codec: currentFormat === 'mp4' ? 'avc1.4D4033' : 'vp09.00.10.08',
          width: width,
          height: height,
          bitrate: 15000000,
          framerate: fps,
        };
        
        if (currentFormat === 'webp' && isTransparent) {
          config.alpha = 'keep';
        }

        try {
          const support = await VideoEncoder.isConfigSupported(config);
          if (support.supported) {
            useVideoEncoder = true;
            setExportStatus('Using High-Performance Hardware Encoder...');
          } else {
            console.warn('VideoEncoder config not supported, falling back to MediaRecorder');
          }
        } catch (e) {
          console.error('VideoEncoder support check failed:', e);
        }
        
        if (useVideoEncoder) {
          if (currentFormat === 'mp4') {
            const muxerConfig: any = {
              target: new mp4Muxer.ArrayBufferTarget(),
              video: {
                codec: 'avc',
                width: width,
                height: height
              },
              fastStart: 'in-memory'
            };

            if (audioBuffer) {
              muxerConfig.audio = {
                codec: 'aac',
                numberOfChannels: audioBuffer.numberOfChannels,
                sampleRate: audioBuffer.sampleRate
              };
            }

            muxer = new mp4Muxer.Muxer(muxerConfig);

            encoder = new VideoEncoder({
              output: (chunk, metadata) => muxer.addVideoChunk(chunk, metadata),
              error: (e) => {
                console.error('VideoEncoder error:', e);
                setExportStatus('Encoder Error. Falling back to standard recording...');
                // Note: If this happens mid-stream, we might have issues
              }
            });

            encoder.configure({
              codec: 'avc1.4D4033', // Level 5.1
              width: width,
              height: height,
              bitrate: 15000000,
              framerate: fps
            });

            if (audioBuffer && typeof AudioEncoder !== 'undefined') {
              audioEncoder = new AudioEncoder({
                output: (chunk, metadata) => muxer.addAudioChunk(chunk, metadata),
                error: (e) => console.error('AudioEncoder error:', e)
              });

              audioEncoder.configure({
                codec: 'mp4a.40.2', // AAC-LC
                numberOfChannels: audioBuffer.numberOfChannels,
                sampleRate: audioBuffer.sampleRate,
                bitrate: 128000
              });

              // Encode audio buffer
              const samplesPerChunk = 1024;
              for (let i = 0; i < audioBuffer.length; i += samplesPerChunk) {
                const length = Math.min(samplesPerChunk, audioBuffer.length - i);
                const data = new Float32Array(length * audioBuffer.numberOfChannels);
                for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
                  const channelData = audioBuffer.getChannelData(channel);
                  for (let j = 0; j < length; j++) {
                    data[j * audioBuffer.numberOfChannels + channel] = channelData[i + j];
                  }
                }

                const audioData = new AudioData({
                  format: 'f32',
                  sampleRate: audioBuffer.sampleRate,
                  numberOfFrames: length,
                  numberOfChannels: audioBuffer.numberOfChannels,
                  timestamp: (i * 1000000) / audioBuffer.sampleRate,
                  data: data
                });
                audioEncoder.encode(audioData);
                audioData.close();
              }
              await audioEncoder.flush();
            }
          } else if (currentFormat === 'webp') {
            muxer = new webmMuxer.Muxer({
              target: new webmMuxer.ArrayBufferTarget(),
              video: {
                codec: 'V_VP9',
                width: width,
                height: height,
                alpha: isTransparent
              }
            });

            encoder = new VideoEncoder({
              output: (chunk, metadata) => muxer.addVideoChunk(chunk, metadata),
              error: (e) => {
                console.error('VideoEncoder error:', e);
                setExportStatus('Encoder Error. Falling back to standard recording...');
              }
            });

            encoder.configure({
              codec: 'vp09.00.10.08',
              width: width,
              height: height,
              bitrate: 15000000,
              framerate: fps,
              alpha: isTransparent ? 'keep' : 'discard'
            });
          }
        }
      }

      if ((currentFormat === 'mp4' || currentFormat === 'webp') && !useVideoEncoder) {
        let mimeType = 'video/webm;codecs=vp9';
        
        if (currentFormat === 'mp4') {
          const types = [
            'video/mp4;codecs=avc1',
            'video/mp4',
            'video/webm;codecs=h264',
            'video/webm;codecs=vp9',
            'video/webm;codecs=vp8',
            'video/webm'
          ];
          mimeType = types.find(t => MediaRecorder.isTypeSupported(t)) || 'video/webm';
        } else {
          mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
        }

        // Combine canvas stream and audio stream if exists
        const canvasStream = captureCanvas.captureStream(0);
        let combinedStream = canvasStream;

        recorder = new MediaRecorder(combinedStream, {
          mimeType: mimeType,
          videoBitsPerSecond: 15000000
        });

        if (audioBuffer) {
          const audioDest = audioCtx.createMediaStreamDestination();
          const bufferSource = audioCtx.createBufferSource();
          bufferSource.buffer = audioBuffer;
          bufferSource.connect(audioDest);
          
          combinedStream = new MediaStream([
            ...canvasStream.getVideoTracks(),
            ...audioDest.stream.getAudioTracks()
          ]);
          
          // Re-create recorder with the combined stream if audio was added
          recorder = new MediaRecorder(combinedStream, {
            mimeType: mimeType,
            videoBitsPerSecond: 15000000
          });
          
          (recorder as any)._bufferSource = bufferSource;
        }
        
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: recorder?.mimeType || 'video/mp4' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          const ext = currentFormat === 'mp4' ? (recorder?.mimeType.includes('mp4') ? 'mp4' : 'webm') : (currentFormat === 'webp' ? 'webp' : 'webm');
          const fileName = `${file.name.replace('.svga', '')}_export${isTransparent ? '_transparent' : ''}.${ext}`;
          a.download = fileName;
          a.click();
          
          addConvertedFile(fileName, currentFormat, url, blob);
          
          setExporting(false);
          playerRef.current.startAnimation();
          setStatus(PlayerStatus.PLAYING);
        };

        recorder.start();
        if ((recorder as any)._bufferSource) {
          (recorder as any)._bufferSource.start(0);
        }
      }

      const SVGA = (window as any).SVGA;
      const exportContainer = document.createElement('div');
      exportContainer.style.position = 'fixed';
      exportContainer.style.left = '-9999px';
      exportContainer.style.top = '-9999px';
      exportContainer.style.width = `${width}px`;
      exportContainer.style.height = `${height}px`;
      document.body.appendChild(exportContainer);

      const exportPlayer = new SVGA.Player(exportContainer);
      exportPlayer.setVideoItem(videoItemRef.current);
      
      hiddenAssets.forEach(assetId => {
        exportPlayer.setImage('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', assetId);
      });
      assets.forEach(asset => {
        exportPlayer.setImage(asset.data, asset.id);
      });

      await new Promise(r => setTimeout(r, 500));

      for (let i = 0; i < totalFramesToRecord; i++) {
        const svgaFrame = i % totalFramesInSvga;
        setExportStatus(`Rendering frame ${i + 1} of ${totalFramesToRecord}...`);
        
        exportPlayer.stepToFrame(svgaFrame, false);
        await new Promise(r => setTimeout(r, 40));
        
        const svgaCanvas = exportContainer.querySelector('canvas');
        
        ctx.clearRect(0, 0, width, height);
        ctx.imageSmoothingEnabled = !isTransparent;
        ctx.imageSmoothingQuality = 'high';
        
        if (bgImg && !isTransparent) {
          ctx.drawImage(bgImg, 0, 0, width, height);
        } else if (isTransparent) {
          // Keep it transparent
          if (currentFormat === 'gif') {
            // For GIF, we use a chroma key
            ctx.fillStyle = '#00FF00'; // Pure green for transparency
            ctx.fillRect(0, 0, width, height);
          } else {
            // For WEBP/MP4, we want a clear canvas
            ctx.clearRect(0, 0, width, height);
          }
        } else if (bgColor !== 'transparent') {
          ctx.fillStyle = bgColor;
          ctx.fillRect(0, 0, width, height);
        } else {
          // Default background for non-transparent exports
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, width, height);
        }

        if (svgaCanvas) {
          if (isTransparent && currentFormat === 'gif') {
            // To avoid green fringe in GIF, we remove semi-transparency aggressively
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = width;
            tempCanvas.height = height;
            const tempCtx = tempCanvas.getContext('2d');
            if (tempCtx) {
              tempCtx.imageSmoothingEnabled = false;
              tempCtx.drawImage(svgaCanvas, 0, 0, width, height);
              const imageData = tempCtx.getImageData(0, 0, width, height);
              const data = imageData.data;
              for (let j = 0; j < data.length; j += 4) {
                // Aggressive binary transparency: any non-opaque pixel becomes fully transparent
                if (data[j + 3] < 255) {
                  data[j + 3] = 0;
                } else {
                  data[j + 3] = 255;
                }
              }
              tempCtx.putImageData(imageData, 0, 0);
              ctx.drawImage(tempCanvas, 0, 0, width, height);
            }
          } else {
            ctx.drawImage(svgaCanvas, 0, 0, width, height);
          }
        }

        if (watermarkImg) {
          ctx.save();
          ctx.globalAlpha = 0.7;
          
          // Calculate fit size for watermark
          const maxW = width * 0.8;
          const maxH = height * 0.8;
          let w = watermarkImg.width * watermarkScale;
          let h = watermarkImg.height * watermarkScale;
          
          const scale = Math.min(maxW / w, maxH / h, 1);
          w *= scale;
          h *= scale;
          
          ctx.drawImage(watermarkImg, (width - w) / 2, (height - h) / 2, w, h);
          ctx.restore();
        }

        if (currentFormat === 'gif') {
          frames.push(captureCanvas.toDataURL('image/png'));
        } else if (useVideoEncoder) {
          const bitmap = await createImageBitmap(captureCanvas);
          const timestamp = (i * 1000000) / fps;
          const frame = new VideoFrame(bitmap, { timestamp });
          encoder.encode(frame);
          frame.close();
        } else if (recorder) {
          // Manually request a frame if using captureStream(0)
          const track = recorder.stream.getVideoTracks()[0];
          if (track && (track as any).requestFrame) {
            (track as any).requestFrame();
          }
          // Small delay to ensure recorder captures the frame
          await new Promise(r => setTimeout(r, 20));
        }

        setExportProgress(Math.round(((i + 1) / totalFramesToRecord) * 100));
      }

      if (currentFormat === 'gif') {
        setExportStatus('Generating GIF (this may take a while)...');
        gifshot.createGIF({
          images: frames,
          gifWidth: width,
          gifHeight: height,
          interval: 1 / fps,
          numFrames: frames.length,
          frameDuration: 1 / fps,
          sampleInterval: 1,
          numWorkers: 4,
          transparent: isTransparent ? '#00FF00' : undefined
        }, (obj: any) => {
          if (!obj.error) {
            const url = obj.image;
            const a = document.createElement('a');
            a.href = url;
            const fileName = `${file.name.replace('.svga', '')}_export${isTransparent ? '_transparent' : ''}.gif`;
            a.download = fileName;
            a.click();
            
            addConvertedFile(fileName, 'gif', url);
          }
          setExporting(false);
          playerRef.current.startAnimation();
          setStatus(PlayerStatus.PLAYING);
        });
      } else if (useVideoEncoder) {
        setExportStatus(`Finalizing ${currentFormat.toUpperCase()} file...`);
        await encoder.flush();
        muxer.finalize();
        const { buffer } = muxer.target as mp4Muxer.ArrayBufferTarget;
        const blob = new Blob([buffer], { type: currentFormat === 'mp4' ? 'video/mp4' : 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ext = currentFormat === 'mp4' ? 'mp4' : (currentFormat === 'webp' ? 'webp' : 'webm');
        const fileName = `${file.name.replace('.svga', '')}_export${isTransparent ? '_transparent' : ''}.${ext}`;
        a.download = fileName;
        a.click();
        
        addConvertedFile(fileName, currentFormat, url, blob);
        
        setExporting(false);
        playerRef.current.startAnimation();
        setStatus(PlayerStatus.PLAYING);
      } else if (recorder) {
        recorder.stop();
      }

      document.body.removeChild(exportContainer);
      exportPlayer.clear();
    } catch (error) {
      console.error("Export failed:", error);
      alert("Export failed. Please try again.");
      setExporting(false);
      playerRef.current?.startAnimation();
      setStatus(PlayerStatus.PLAYING);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#0f0f0f] text-[#e5e5e5] font-sans selection:bg-blue-500/30 md:h-screen md:overflow-hidden" dir="ltr">
      {/* Replacement Input */}
      <input type="file" accept="image/*" className="hidden" ref={replaceInputRef} onChange={handleReplaceImage} />
      <input type="file" accept="image/*" className="hidden" ref={bgInputRef} onChange={handleBgUpload} />
      <input type="file" accept="image/*" className="hidden" ref={watermarkInputRef} onChange={handleWatermarkUpload} />
      
      {showDurationModal && (
        <div className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-md flex items-center justify-center p-6">
          <div className="max-w-sm w-full bg-[#1a1a1a] p-8 rounded-2xl border border-[#333] shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4 text-center">Export Settings</h3>
            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-[10px] text-[#a3a3a3] uppercase tracking-wider mb-2">Export Format</label>
                <div className="grid grid-cols-1 gap-2">
                  {(['mp4'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setExportFormat(f)}
                      className={`py-2 rounded-lg text-xs font-bold transition-all border ${
                        exportFormat === f 
                          ? 'bg-blue-600 border-blue-500 text-white' 
                          : 'bg-[#111] border-[#333] text-[#a3a3a3] hover:border-[#444]'
                      }`}
                    >
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-[#a3a3a3] uppercase tracking-wider mb-2">Video Duration (Seconds)</label>
                <input 
                  type="number" 
                  value={targetVideoDuration} 
                  onChange={(e) => setTargetVideoDuration(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-[#111] border border-[#333] rounded-lg px-4 py-2.5 text-sm text-white focus:border-blue-500 outline-none transition-colors"
                />
              </div>
              <p className="text-[10px] text-[#a3a3a3] leading-relaxed">
                The animation will loop automatically if the specified duration is longer than the original animation.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => {
                  setShowDurationModal(false);
                  exportAsVideo();
                }}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg text-sm font-bold transition-all"
              >
                Start Export
              </button>
              <button 
                onClick={() => setShowDurationModal(false)}
                className="w-full bg-[#262626] hover:bg-[#333] text-[#a3a3a3] py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {replacingAssetId && (
        <div className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-md flex items-center justify-center p-6">
          <div className="max-w-sm w-full bg-[#1a1a1a] p-8 rounded-2xl border border-[#333] shadow-2xl text-center">
            <h3 className="text-lg font-bold text-white mb-2">Replace Asset</h3>
            <p className="text-[#a3a3a3] text-xs mb-6">The new image will automatically take the dimensions of the original layer "{replacingAssetId}".</p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => replaceInputRef.current?.click()}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                Select New Image
              </button>
              <button 
                onClick={() => setReplacingAssetId(null)}
                className="w-full bg-[#262626] hover:bg-[#333] text-[#a3a3a3] py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {exporting && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-[#1a1a1a] p-10 rounded-2xl border border-[#333] shadow-2xl">
            <div className="flex flex-col items-center justify-center mb-8 gap-4">
                <div className="w-16 h-16 border-4 border-[#333] border-t-blue-500 rounded-full animate-spin flex items-center justify-center">
                    <FileArchive size={20} className="text-blue-500" />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-white mb-1">Exporting</h3>
                    <p className="text-[#a3a3a3] text-xs font-medium uppercase tracking-widest">
                        {exportStatus}
                    </p>
                </div>
            </div>
            
            <div className="space-y-4">
                <div className="relative h-2 bg-[#333] rounded-full overflow-hidden">
                  <div 
                    className="absolute inset-y-0 left-0 transition-all duration-300 bg-blue-500"
                    style={{ width: `${exportProgress}%` }}
                  ></div>
                </div>
                <div className="flex justify-between items-end">
                  <span className="text-white/40 text-xs">Please do not close this window</span>
                  <span className="text-blue-400 font-mono text-sm">{exportProgress}%</span>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="h-14 border-b border-[#262626] flex items-center justify-between px-6 shrink-0 bg-[#0a0a0a]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 2L2 22h20L12 2z"/></svg>
          </div>
          <span className="font-bold text-white text-sm">MotionTools</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={onClear} className="flex items-center gap-1 text-xs text-[#a3a3a3] hover:text-white transition-colors bg-[#800000] px-3 py-1.5 rounded border border-[#333]">
            <ChevronLeft size={14} /> Back
          </button>
          <div className="w-7 h-7 bg-white rounded-full flex items-center justify-center text-black font-bold text-xs">
            A
          </div>
        </div>
      </header>

      <div className="flex flex-col md:flex-row flex-1 md:overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-full md:w-[280px] border-b md:border-b-0 md:border-r border-[#262626] flex flex-col bg-[#0a0a0a] shrink-0 md:h-full md:overflow-hidden">
          {/* Audio Assets */}
          <div className="p-4 border-b border-[#262626]">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-sm text-[#e5e5e5]">Audio Assets</h3>
              <button className="bg-[#1a1a1a] border border-[#333] rounded px-2 py-1 text-[10px] text-[#a3a3a3] flex items-center gap-1 hover:bg-[#262626] transition-colors">
                <Download size={10} /> Download
              </button>
            </div>
            
            <div className="space-y-2 mb-3">
               {audioFiles.map(audio => (
                  <div key={audio.id} className="flex items-center justify-between bg-[#111] border border-[#333] rounded px-2 py-1.5">
                     <span className="text-xs text-[#e5e5e5] truncate max-w-[150px]">{audio.name}</span>
                     <button 
                        onClick={() => handleRemoveAudio(audio.id)}
                        className="text-red-400 hover:text-red-300 text-xs"
                     >
                        Remove
                     </button>
                  </div>
               ))}
            </div>

            <input 
              type="file" 
              accept="audio/*" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleAudioUpload}
            />
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border border-dashed border-[#333] rounded-lg p-3 flex items-center justify-center text-[#a3a3a3] text-xs cursor-pointer hover:border-[#555] hover:text-[#e5e5e5] transition-colors"
            >
              <Plus size={12} className="text-green-500 mr-1" /> Click to add...
            </div>
          </div>

          {/* Edge Feather */}
          <div className="p-4 border-b border-[#262626]">
            <h3 className="font-bold text-sm text-[#e5e5e5] mb-3">Edge Feather</h3>
            <button className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg py-2 text-xs text-[#a3a3a3] flex items-center justify-center gap-2 hover:bg-[#262626] transition-colors">
              <PenTool size={12} className="text-purple-500" />
              Add edge feather
            </button>
          </div>

          {/* Image Assets */}
          <div className="flex-1 flex flex-col min-h-0 p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-sm text-[#e5e5e5]">Image Assets</h3>
            </div>
            <div className="flex gap-1.5 mb-3">
              <button className="flex-1 bg-[#1a1a1a] border border-[#333] rounded px-1.5 py-1 text-[10px] text-[#a3a3a3] flex items-center justify-center gap-1 hover:bg-[#262626] transition-colors">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                Add Watermark
              </button>
              <button className="flex-1 bg-[#1a1a1a] border border-[#333] rounded px-1.5 py-1 text-[10px] text-[#a3a3a3] flex items-center justify-center gap-1 hover:bg-[#262626] transition-colors">
                <Layers size={10} /> Batch
              </button>
              <button className="flex-1 bg-[#1a1a1a] border border-[#333] rounded px-1.5 py-1 text-[10px] text-[#a3a3a3] flex items-center justify-center gap-1 hover:bg-[#262626] transition-colors">
                <Download size={10} /> Download
              </button>
            </div>
            <div className="relative mb-4">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#555]" />
              <input 
                type="text" 
                placeholder="Search image names..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#111] border border-[#333] rounded-md py-1.5 pl-8 pr-3 text-xs text-[#e5e5e5] placeholder-[#555] focus:outline-none focus:border-[#555] transition-colors"
              />
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar -mx-2 px-2">
              <div className="grid grid-cols-2 gap-3">
                {filteredAssets.map(asset => (
                  <div 
                    key={asset.id} 
                    className={`flex flex-col items-center p-3 rounded-xl border transition-all duration-200 ${hiddenAssets.has(asset.id) ? 'border-red-500/50 bg-red-500/5' : 'border-[#262626] bg-[#111] hover:border-[#444]'}`}
                  >
                    <div className="w-full aspect-square flex items-center justify-center mb-3 relative bg-[#0a0a0a] rounded-lg overflow-hidden border border-[#262626]">
                       <img src={asset.data} className="max-w-[80%] max-h-[80%] object-contain" />
                       {hiddenAssets.has(asset.id) && <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><EyeOff size={16} className="text-red-400"/></div>}
                    </div>
                    <span className="text-[10px] text-[#a3a3a3] truncate w-full text-center mb-3 font-mono">{asset.id}</span>
                    
                    <div className="grid grid-cols-3 gap-1 w-full">
                      <button 
                        onClick={() => toggleAssetVisibility(asset.id)}
                        className="bg-[#1a1a1a] hover:bg-[#262626] border border-[#333] rounded p-1.5 flex items-center justify-center transition-colors"
                        title={hiddenAssets.has(asset.id) ? 'Show' : 'Hide'}
                      >
                        {hiddenAssets.has(asset.id) ? <Eye size={12} /> : <EyeOff size={12} />}
                      </button>
                      <button 
                        onClick={() => downloadAsset(asset)}
                        className="bg-[#1a1a1a] hover:bg-[#262626] border border-[#333] rounded p-1.5 flex items-center justify-center transition-colors"
                        title="Download"
                      >
                        <Download size={12} />
                      </button>
                      <button 
                        onClick={() => setReplacingAssetId(asset.id)}
                        className="bg-[#1a1a1a] hover:bg-[#262626] border border-[#333] rounded p-1.5 flex items-center justify-center transition-colors"
                        title="Replace"
                      >
                        <Pencil size={12} className="text-blue-400" />
                      </button>
                    </div>
                  </div>
                ))}
                {filteredAssets.length === 0 && (
                   <div className="col-span-2 text-center text-[#555] text-xs py-8">No assets found</div>
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* Center Canvas */}
        <main className="flex-1 flex flex-col relative bg-[#0f0f0f] min-h-[50vh] md:min-h-0 items-center justify-center p-4 md:p-8 overflow-hidden">
           <div 
             className="relative flex flex-col bg-[#111] border border-[#262626] rounded-lg overflow-hidden shadow-2xl"
             style={{ 
               width: '100%',
               maxHeight: 'calc(100vh - 120px)',
               maxWidth: videoSize 
                 ? `min(${videoSize.width}px, calc((100vh - 120px) * (${videoSize.width} / ${videoSize.height})))` 
                 : '360px',
               aspectRatio: videoSize ? `${videoSize.width}/${videoSize.height}` : '9/16'
             }}
           >
              <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
                  {customBg && (
                    <img 
                      src={customBg} 
                      className="absolute inset-0 w-full h-full object-cover opacity-100" 
                      style={{ zIndex: 0 }}
                    />
                  )}
                  {watermark && (
                    <div 
                      className="absolute inset-0 flex items-center justify-center pointer-events-none"
                      style={{ zIndex: 20 }}
                    >
                      <img 
                        src={watermark} 
                        style={{ transform: `scale(${watermarkScale})` }}
                        className="max-w-full max-h-full opacity-70"
                      />
                    </div>
                  )}
                 {status === PlayerStatus.LOADING && (
                   <div className="absolute inset-0 flex items-center justify-center z-20">
                     <div className="w-10 h-10 border-4 border-[#333] border-t-blue-500 rounded-full animate-spin"></div>
                   </div>
                 )}
                 {status === PlayerStatus.ERROR && (
                   <div className="absolute inset-0 flex items-center justify-center z-20">
                     <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2 text-sm">
                       <span className="font-medium">Error loading SVGA file</span>
                     </div>
                   </div>
                 )}
                 <style>{`
                   #svga-container canvas {
                     /* Let SVGA player handle the sizing and transform */
                     background-color: #0000FF;
                   }
                 `}</style>
                 <div id="svga-container" ref={containerRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 10 }}></div>
              </div>
              
              {/* Player Controls */}
              <div className="h-14 bg-[#1a1a1a] border-t border-[#262626] flex items-center gap-4 px-4 z-30 shrink-0">
                 <button onClick={togglePlay} className="text-white hover:text-gray-300 transition-colors">
                   {status === PlayerStatus.PLAYING ? <Pause size={16} fill="currentColor" style={{ backgroundColor: '#0000FF' }} /> : <Play size={16} fill="currentColor" style={{ backgroundColor: '#0000FF' }} />}
                 </button>
                 <div 
                   className="flex-1 h-1.5 bg-[#0000FF] rounded-full relative cursor-pointer group"
                   onClick={(e) => {
                     if (!playerRef.current || totalFrames === 0) return;
                     const rect = e.currentTarget.getBoundingClientRect();
                     const x = e.clientX - rect.left;
                     const percentage = Math.max(0, Math.min(1, x / rect.width));
                     const frame = Math.floor(percentage * totalFrames);
                     playerRef.current.stepToFrame(frame, status === PlayerStatus.PLAYING);
                     
                     // Sync custom audio
                     const fps = videoItemRef.current?.FPS || 30;
                     const timeInSeconds = frame / fps;
                     (Object.values(howlInstancesRef.current) as any[]).forEach(sound => {
                       sound.seek(timeInSeconds);
                     });
                   }}
                 >
                   <div className="absolute inset-y-0 left-0 bg-blue-500 rounded-full" style={{ width: `${progress}%` }}></div>
                   <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity" style={{ left: `calc(${progress}% - 6px)` }}></div>
                 </div>
              </div>
           </div>
        </main>

        {/* Right Sidebar */}
        <aside className="w-full md:w-[320px] border-t md:border-t-0 md:border-l border-[#262626] flex flex-col bg-[#0a0a0a] shrink-0 md:overflow-y-auto p-5 custom-scrollbar">
            {/* Animation Info */}
           <div className="mb-8">
             <h3 className="text-xs font-bold text-[#e5e5e5] mb-3">Animation Info</h3>
             <div className="flex flex-wrap gap-1.5">
               <div className="bg-[#1a1a1a] border border-[#262626] rounded px-2 py-1 text-[10px] text-[#a3a3a3] flex gap-1">
                 <span className="text-[#e5e5e5] font-medium">Format:</span> SVGA
               </div>
               <div className="bg-[#1a1a1a] border border-[#262626] rounded px-2 py-1 text-[10px] text-[#a3a3a3] flex gap-1">
                 <span className="text-[#e5e5e5] font-medium">Version:</span> {version}
               </div>
               <div className="bg-[#1a1a1a] border border-[#262626] rounded px-2 py-1 text-[10px] text-[#a3a3a3] flex gap-1">
                 <span className="text-[#e5e5e5] font-medium">Resolution:</span> {width} PX x {height} PX
               </div>
               <div className="bg-[#1a1a1a] border border-[#262626] rounded px-2 py-1 text-[10px] text-[#a3a3a3] flex gap-1">
                 <span className="text-[#e5e5e5] font-medium">Duration:</span> {duration} S
               </div>
               <div className="bg-[#1a1a1a] border border-[#262626] rounded px-2 py-1 text-[10px] text-[#a3a3a3] flex gap-1">
                 <span className="text-[#e5e5e5] font-medium">File Size:</span> {fileSize}
               </div>
               <div className="bg-[#1a1a1a] border border-[#262626] rounded px-2 py-1 text-[10px] text-[#a3a3a3] flex gap-1">
                 <span className="text-[#e5e5e5] font-medium">Frame Rate:</span> {fps.toFixed(2)} FPS
               </div>
               <div className="bg-[#1a1a1a] border border-[#262626] rounded px-2 py-1 text-[10px] text-[#a3a3a3] flex gap-1">
                 <span className="text-[#e5e5e5] font-medium">File Name:</span> <span className="truncate max-w-[100px]">{file.name}</span>
               </div>
             </div>
           </div>

            {/* Background & Watermark */}
            <div className="mb-8">
              <h3 className="text-xs font-bold text-[#e5e5e5] mb-4">Customization</h3>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <button 
                  onClick={() => bgInputRef.current?.click()}
                  className="bg-[#1a1a1a] border border-[#333] rounded-lg py-2 text-[10px] text-[#a3a3a3] flex items-center justify-center gap-2 hover:bg-[#262626] transition-colors"
                >
                  <Layers size={12} className="text-blue-500" />
                  Upload Background
                </button>
                <button 
                  onClick={() => watermarkInputRef.current?.click()}
                  className="bg-[#1a1a1a] border border-[#333] rounded-lg py-2 text-[10px] text-[#a3a3a3] flex items-center justify-center gap-2 hover:bg-[#262626] transition-colors"
                >
                  <PenTool size={12} className="text-purple-500" />
                  Upload Watermark
                </button>
              </div>
              
              {watermark && (
                <div className="space-y-3 mb-6 bg-[#111] p-3 rounded-xl border border-[#262626]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#a3a3a3] font-medium uppercase tracking-wider">Watermark Scale</span>
                    <span className="text-[10px] text-blue-400 font-mono">{watermarkScale.toFixed(1)}x</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.1" 
                    max="3" 
                    step="0.1" 
                    value={watermarkScale} 
                    onChange={(e) => setWatermarkScale(parseFloat(e.target.value))}
                    className="w-full h-1 bg-[#333] rounded-full appearance-none cursor-pointer accent-blue-500"
                  />
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setWatermarkScale(prev => Math.max(0.1, prev - 0.1))}
                      className="flex-1 bg-[#1a1a1a] border border-[#333] rounded py-1 text-[10px] text-[#a3a3a3] hover:text-white transition-colors"
                    >
                      Shrink
                    </button>
                    <button 
                      onClick={() => setWatermarkScale(prev => Math.min(3, prev + 0.1))}
                      className="flex-1 bg-[#1a1a1a] border border-[#333] rounded py-1 text-[10px] text-[#a3a3a3] hover:text-white transition-colors"
                    >
                      Enlarge
                    </button>
                  </div>
                </div>
              )}

            </div>

           {/* Animation Edit (Export Options) */}
           <div>
             <h3 className="text-xs font-bold text-[#e5e5e5] mb-4">Animation Edit</h3>
             
             <div className="space-y-4 mb-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#e5e5e5]">Resize</span>
                  <div className="flex gap-1">
                    <input type="text" value={width} readOnly className="w-16 bg-[#1a1a1a] border border-[#333] rounded px-2 py-1 text-xs text-center text-[#e5e5e5] outline-none" />
                    <select className="bg-[#1a1a1a] border border-[#333] rounded px-2 py-1 text-xs text-[#e5e5e5] outline-none appearance-none pr-6 relative">
                      <option>Width</option>
                    </select>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#e5e5e5]">Mirror Mode</span>
                  <select className="w-32 bg-[#1a1a1a] border border-[#333] rounded px-2 py-1 text-xs text-[#e5e5e5] outline-none appearance-none">
                    <option>No Mirror</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#e5e5e5]">Format Conversion</span>
                  <select className="w-32 bg-[#1a1a1a] border border-[#333] rounded px-2 py-1 text-xs text-[#e5e5e5] outline-none appearance-none">
                    <option>Keep Original</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#e5e5e5]">Compression Quality</span>
                  <input type="text" defaultValue="100" className="w-32 bg-[#1a1a1a] border border-[#333] rounded px-2 py-1 text-xs text-[#e5e5e5] outline-none" />
                </div>

                <div className="flex flex-col gap-2 pt-2 border-t border-[#262626]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[#e5e5e5]">Video Duration (S)</span>
                    <input 
                      type="number" 
                      value={targetVideoDuration} 
                      onChange={(e) => setTargetVideoDuration(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 bg-[#1a1a1a] border border-[#333] rounded px-2 py-1 text-xs text-center text-[#e5e5e5] outline-none" 
                    />
                  </div>
                  <p className="text-[10px] text-[#a3a3a3]">Animation will loop if duration is longer than original.</p>
                </div>
             </div>

             <div className="flex flex-col gap-2">
               {!isCreateMenuOpen ? (
                 <button 
                   onClick={() => setIsCreateMenuOpen(true)}
                   className="w-full bg-[#800000] hover:bg-[#a00000] text-white py-3 rounded-lg text-sm font-bold transition-all shadow-lg flex items-center justify-center gap-2"
                 >
                   <Plus size={16} /> Create
                 </button>
               ) : (
                 <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                   <div className="flex items-center justify-between px-1">
                     <span className="text-[10px] font-bold text-[#a3a3a3] uppercase tracking-widest">Available Formats</span>
                     <button 
                       onClick={() => setIsCreateMenuOpen(false)}
                       className="text-[#a3a3a3] hover:text-white transition-colors"
                     >
                       <ChevronLeft size={14} className="rotate-90" />
                     </button>
                   </div>
                    <div className="grid grid-cols-1 gap-2">
                      <button onClick={() => { setExportFormat('mp4'); setShowDurationModal(true); }} className="w-full bg-[#1a1a1a] hover:bg-[#262626] text-[#e5e5e5] py-2.5 rounded text-xs font-medium transition-colors border border-[#333] flex items-center gap-3 px-4">
                        <div className="w-6 h-6 rounded bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                          <Video size={14} />
                        </div>
                        Export MP4 Video
                      </button>
                      <button onClick={downloadModifiedSVGA} className="w-full bg-[#1a1a1a] hover:bg-[#262626] text-[#e5e5e5] py-2.5 rounded text-xs font-medium transition-colors border border-[#333] flex items-center gap-3 px-4">
                        <div className="w-6 h-6 rounded bg-green-500/10 flex items-center justify-center text-green-500">
                          <Download size={14} />
                        </div>
                        Save Modified SVGA
                      </button>
                      <button onClick={exportAsZip} className="w-full bg-[#1a1a1a] hover:bg-[#262626] text-[#e5e5e5] py-2.5 rounded text-xs font-medium transition-colors border border-[#333] flex items-center gap-3 px-4">
                        <div className="w-6 h-6 rounded bg-purple-500/10 flex items-center justify-center text-purple-500">
                          <Layers size={14} />
                        </div>
                        Export PNG Sequence
                      </button>
                      <button onClick={exportAsAEProject} className="w-full bg-[#1a1a1a] hover:bg-[#262626] text-[#e5e5e5] py-2.5 rounded text-xs font-medium transition-colors border border-[#333] flex items-center gap-3 px-4">
                        <div className="w-6 h-6 rounded bg-orange-500/10 flex items-center justify-center text-orange-500">
                          <FileArchive size={14} />
                        </div>
                        Export AE Project
                      </button>
                    </div>
                   <button 
                     onClick={() => setIsCreateMenuOpen(false)}
                     className="w-full py-2 text-[10px] text-[#555] hover:text-[#a3a3a3] transition-colors uppercase tracking-widest font-bold"
                   >
                     Close Menu
                   </button>
                 </div>
               )}
             </div>
           </div>

           {/* Conversion History */}
           <div className="flex-1 flex flex-col min-h-0">
             <div className="flex items-center justify-between mb-4">
               <h3 className="text-xs font-bold text-[#e5e5e5] flex items-center gap-2">
                 <Clock size={14} className="text-blue-500" />
                 Conversion History
               </h3>
               {convertedFiles.length > 0 && (
                 <button 
                   onClick={() => setConvertedFiles([])}
                   className="text-[10px] text-red-400 hover:text-red-300 transition-colors"
                 >
                   Clear All
                 </button>
               )}
             </div>

             <div className="flex-1 overflow-y-auto custom-scrollbar -mx-2 px-2 space-y-2">
               {convertedFiles.map(file => (
                 <div 
                   key={file.id}
                   className={`group p-3 rounded-xl border transition-all duration-200 cursor-pointer ${
                     previewFile?.id === file.id 
                       ? 'border-blue-500/50 bg-blue-500/5' 
                       : 'border-[#262626] bg-[#111] hover:border-[#333]'
                   }`}
                   onClick={() => setPreviewFile(file)}
                 >
                   <div className="flex items-start gap-3">
                     <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                       file.format === 'mp4' ? 'bg-blue-500/10 text-blue-500' :
                       file.format === 'gif' ? 'bg-purple-500/10 text-purple-500' :
                       file.format === 'webp' ? 'bg-emerald-500/10 text-emerald-500' :
                       file.format === 'svga' ? 'bg-orange-500/10 text-orange-500' :
                       'bg-gray-500/10 text-gray-500'
                     }`}>
                       {file.format === 'mp4' || file.format === 'webp' ? <Video size={18} /> :
                        file.format === 'gif' ? <Layers size={18} /> :
                        file.format === 'svga' ? <FileArchive size={18} /> :
                        <Download size={18} />}
                     </div>
                     <div className="flex-1 min-w-0">
                       <p className="text-xs font-medium text-[#e5e5e5] truncate mb-0.5">{file.name}</p>
                       <div className="flex items-center gap-2 text-[10px] text-[#a3a3a3]">
                         <span className="uppercase font-bold">{file.format}</span>
                         <span>•</span>
                         <span>{file.size}</span>
                       </div>
                     </div>
                     <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                       <a 
                         href={file.url} 
                         download={file.name}
                         onClick={(e) => e.stopPropagation()}
                         className="p-1.5 hover:bg-white/10 rounded-md text-[#a3a3a3] hover:text-white transition-colors"
                       >
                         <Download size={14} />
                       </a>
                       <button 
                         onClick={(e) => {
                           e.stopPropagation();
                           setConvertedFiles(prev => prev.filter(f => f.id !== file.id));
                           if (previewFile?.id === file.id) setPreviewFile(null);
                         }}
                         className="p-1.5 hover:bg-red-500/10 rounded-md text-[#a3a3a3] hover:text-red-400 transition-colors"
                       >
                         <Trash2 size={14} />
                       </button>
                     </div>
                   </div>
                 </div>
               ))}
               {convertedFiles.length === 0 && (
                 <div className="flex flex-col items-center justify-center py-12 text-center">
                   <div className="w-12 h-12 rounded-full bg-[#1a1a1a] flex items-center justify-center mb-4 border border-[#262626]">
                     <Clock size={20} className="text-[#333]" />
                   </div>
                   <p className="text-xs text-[#555] font-medium">No conversion history</p>
                   <p className="text-[10px] text-[#333] mt-1">Files you convert will appear here</p>
                 </div>
               )}
             </div>
           </div>

           {/* Preview Modal */}
           {previewFile && (
             <div className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 md:p-10">
               <div className="max-w-5xl w-full bg-[#0a0a0a] rounded-3xl border border-[#262626] shadow-2xl overflow-hidden flex flex-col max-h-full">
                 <div className="h-16 border-b border-[#262626] flex items-center justify-between px-8 shrink-0">
                   <div className="flex items-center gap-4">
                     <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                       <ExternalLink size={20} />
                     </div>
                     <div>
                       <h3 className="text-sm font-bold text-white">{previewFile.name}</h3>
                       <p className="text-[10px] text-[#a3a3a3] uppercase tracking-widest font-bold">Preview Mode • {previewFile.format}</p>
                     </div>
                   </div>
                   <button 
                     onClick={() => setPreviewFile(null)}
                     className="w-10 h-10 rounded-full bg-[#1a1a1a] hover:bg-[#262626] flex items-center justify-center text-[#a3a3a3] hover:text-white transition-colors border border-[#333]"
                   >
                     <ChevronLeft size={20} className="rotate-90" />
                   </button>
                 </div>
                 
                 <div className="flex-1 overflow-hidden bg-black flex items-center justify-center p-8">
                   {previewFile.format === 'mp4' || previewFile.format === 'webp' ? (
                     <video 
                       src={previewFile.url} 
                       controls 
                       autoPlay 
                       loop 
                       className="max-w-full max-h-full rounded-lg shadow-2xl"
                     />
                   ) : previewFile.format === 'gif' || previewFile.format === 'svga' ? (
                     <img 
                       src={previewFile.url} 
                       className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                       referrerPolicy="no-referrer"
                     />
                   ) : (
                     <div className="flex flex-col items-center gap-6">
                       <div className="w-24 h-24 rounded-3xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                         <FileArchive size={48} />
                       </div>
                       <div className="text-center">
                         <p className="text-white font-bold mb-2">Package Ready</p>
                         <p className="text-[#a3a3a3] text-xs max-w-xs">This format cannot be previewed directly in the browser. Please download the file to view its contents.</p>
                       </div>
                       <a 
                         href={previewFile.url} 
                         download={previewFile.name}
                         className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
                       >
                         <Download size={18} /> Download Now
                       </a>
                     </div>
                   )}
                 </div>

                 <div className="h-20 border-t border-[#262626] flex items-center justify-between px-8 shrink-0 bg-[#0a0a0a]">
                    <div className="flex items-center gap-6">
                      <div>
                        <p className="text-[10px] text-[#a3a3a3] uppercase tracking-widest mb-1">File Size</p>
                        <p className="text-xs font-bold text-white">{previewFile.size || 'Unknown'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#a3a3a3] uppercase tracking-widest mb-1">Created At</p>
                        <p className="text-xs font-bold text-white">{new Date(previewFile.timestamp).toLocaleTimeString()}</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => {
                          setConvertedFiles(prev => prev.filter(f => f.id !== previewFile.id));
                          setPreviewFile(null);
                        }}
                        className="px-6 py-2.5 rounded-xl text-xs font-bold text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        Delete
                      </button>
                      <a 
                        href={previewFile.url} 
                        download={previewFile.name}
                        className="bg-white text-black px-8 py-2.5 rounded-xl text-xs font-bold hover:bg-gray-200 transition-colors flex items-center gap-2"
                      >
                        <Download size={14} /> Download
                      </a>
                    </div>
                 </div>
               </div>
             </div>
           )}
         </aside>
      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #333;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #555;
        }
      `}</style>
    </div>
  );
};
