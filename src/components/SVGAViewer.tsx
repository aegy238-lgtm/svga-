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
  PenTool
} from 'lucide-react';
import pako from 'pako';
import { parse } from 'protobufjs';
import { svgaSchema } from '../svga-proto';
import { SVGAFileInfo, PlayerStatus } from '../types';

interface SVGAViewerProps {
  file: SVGAFileInfo;
  onClear: () => void;
  originalFile?: File; 
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
  const [videoSize, setVideoSize] = useState<{width: number, height: number} | null>(null);
  const [audioFiles, setAudioFiles] = useState<{id: string, name: string, data: string, type: 'builtin' | 'custom'}[]>([]);
  const [isAudioModified, setIsAudioModified] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const howlInstancesRef = useRef<{ [id: string]: any }>({});
  const lastPlayedFrameRef = useRef(-1);

  const bgOptions = [
    { label: 'Dark', value: '#0f0f0f' },
    { label: 'Green', value: '#14532d' },
    { label: 'White', value: '#ffffff' },
    { label: 'Transparent', value: 'transparent' },
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
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `${file.name.replace('.svga', '')}_Sequence.zip`;
      link.click();

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
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `${file.name.replace('.svga', '')}_AE_Project.zip`;
      link.click();
      
      setExporting(false);
      setExportProgress(100);
    } catch (err) {
      console.error("AE Export Error:", err);
      setExporting(false);
      alert("An error occurred while exporting to After Effects.");
    }
  };

  const downloadModifiedSVGA = async () => {
    if (hiddenAssets.size === 0 && !isAudioModified) {
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

        hiddenAssets.forEach(assetId => {
          const possibleNames = [assetId, `${assetId}.png`, `${assetId}.jpg`, `${assetId}.jpeg`];
          let found = false;
          for (const name of possibleNames) {
            if (zip.file(name)) {
              zip.file(name, transparentPngBytes);
              found = true;
            }
          }
          if (!found) {
            zip.file(assetId, transparentPngBytes);
            zip.file(`${assetId}.png`, transparentPngBytes);
          }
        });

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
          hiddenAssets.forEach(assetId => {
            if (message.images[assetId]) {
              message.images[assetId] = transparentPngBytes;
            }
          });
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
      a.download = `${file.name.replace('.svga', '')}_modified.svga`;
      a.click();
      URL.revokeObjectURL(url);

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
        sound.pause();
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

  return (
    <div className="flex flex-col min-h-screen bg-[#0f0f0f] text-[#e5e5e5] font-sans selection:bg-blue-500/30 md:h-screen md:overflow-hidden" dir="ltr">
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
        <div className="hidden md:flex items-center gap-6 text-xs font-medium text-[#a3a3a3]">
          <span className="text-white">Features</span>
          <span className="hover:text-white cursor-pointer transition-colors">Motion Workspace</span>
          <span className="hover:text-white cursor-pointer transition-colors">Image Compression</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={onClear} className="flex items-center gap-1 text-xs text-[#a3a3a3] hover:text-white transition-colors bg-[#1a1a1a] px-3 py-1.5 rounded border border-[#333]">
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
              <div className="grid grid-cols-3 gap-2">
                {filteredAssets.map(asset => (
                  <div 
                    key={asset.id} 
                    className={`flex flex-col items-center p-2 rounded-lg border cursor-pointer transition-colors ${hiddenAssets.has(asset.id) ? 'border-red-500/50 bg-red-500/10' : 'border-[#262626] bg-[#111] hover:border-[#444]'}`}
                    onClick={() => toggleAssetVisibility(asset.id)}
                    title={hiddenAssets.has(asset.id) ? 'Click to show' : 'Click to hide'}
                  >
                    <div className="w-12 h-12 flex items-center justify-center mb-2 relative">
                       <img src={asset.data} className="max-w-full max-h-full object-contain" />
                       {hiddenAssets.has(asset.id) && <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded"><EyeOff size={14} className="text-red-400"/></div>}
                    </div>
                    <span className="text-[9px] text-[#a3a3a3] truncate w-full text-center">{asset.id}</span>
                  </div>
                ))}
                {filteredAssets.length === 0 && (
                   <div className="col-span-3 text-center text-[#555] text-xs py-4">No assets found</div>
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
                   }
                 `}</style>
                 <div id="svga-container" ref={containerRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}></div>
              </div>
              
              {/* Player Controls */}
              <div className="h-14 bg-[#1a1a1a] border-t border-[#262626] flex items-center gap-4 px-4 z-30 shrink-0">
                 <button onClick={togglePlay} className="text-white hover:text-gray-300 transition-colors">
                   {status === PlayerStatus.PLAYING ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                 </button>
                 <div 
                   className="flex-1 h-1.5 bg-[#333] rounded-full relative cursor-pointer group"
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
             </div>

             <div className="flex flex-col gap-2">
               <button onClick={downloadModifiedSVGA} className="w-full bg-[#262626] hover:bg-[#333] text-[#e5e5e5] py-2 rounded text-xs font-medium transition-colors border border-[#333]">
                 Save Modified SVGA
               </button>
               <button onClick={exportAsZip} className="w-full bg-[#262626] hover:bg-[#333] text-[#e5e5e5] py-2 rounded text-xs font-medium transition-colors border border-[#333]">
                 Export PNG Sequence
               </button>
               <button onClick={exportAsAEProject} className="w-full bg-[#262626] hover:bg-[#333] text-[#e5e5e5] py-2 rounded text-xs font-medium transition-colors border border-[#333]">
                 Export AE Project
               </button>
             </div>
           </div>
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
