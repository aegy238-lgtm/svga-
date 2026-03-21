import React, { useState, useCallback, useEffect } from 'react';
import { Header } from './components/Header';
import { Uploader } from './components/Uploader';
import { Workspace } from './components/Workspace';
import { BatchCompressor } from './components/BatchCompressor';
import { BatchCropper } from './components/BatchCropper';
import { VideoConverter } from './components/VideoConverter';
import { MultiSvgaViewer } from './components/MultiSvgaViewer';
import { ImageToSvga } from './components/ImageToSvga';
import { ImageProcessor } from './components/ImageProcessor';
import { ImageEditor } from './components/ImageEditor';
import { ImageMatcher } from './components/ImageMatcher';
import { Store } from './components/Store';
import { AdminPanel } from './components/AdminPanel';
import { Login } from './components/Auth/Login';
import { Signup } from './components/Auth/Signup';
import { Loading } from './components/Auth/Loading';
import { UserProfileModal } from './components/UserProfileModal';
import { SubscriptionModal } from './components/SubscriptionModal';
import { useAuth } from './contexts/AuthContext';
import { AppState, FileMetadata, AppSettings } from './types';
import { useAccessControl } from './hooks/useAccessControl';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './lib/firebase';
import { logActivity } from './utils/logger';

declare var SVGA: any;

import { OnboardingModal } from './components/OnboardingModal';
import { HelpCircle } from 'lucide-react';

const videoWidth = 1334;
const videoHeight = 750;

const App: React.FC = () => {
  const { currentUser, loading, logout } = useAuth();
  const { checkAccess } = useAccessControl();
  const [state, setState] = useState<AppState>(AppState.IDLE);
  const [fileMetadata, setFileMetadata] = useState<FileMetadata | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(() => {
    const cached = localStorage.getItem('appSettings');
    return cached ? JSON.parse(cached) : null;
  });
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [globalQuality, setGlobalQuality] = useState<'low' | 'medium' | 'high'>('high');

  useEffect(() => {
    // Check if user has seen onboarding
    const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
    if (!hasSeenOnboarding) {
      setShowOnboarding(true);
    }
  }, []);

  const handleCloseOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem('hasSeenOnboarding', 'true');
  };

  useEffect(() => {
    // Load Global Settings - Use cache immediately on failure
    const loadSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'global');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as AppSettings;
          setSettings(data);
          localStorage.setItem('appSettings', JSON.stringify(data));
        }
      } catch (e: any) { 
        if (e.code === 'resource-exhausted') {
          setIsQuotaExceeded(true);
          console.warn("Firestore Quota Exceeded. Using cached settings.");
        }
      }
    };
    loadSettings();
  }, []);

  const handleFeatureAccess = async (targetState: AppState, featureName: string) => {
    // All features are now accessible
    setState(targetState);
  };

  const handleFileUpload = useCallback(async (file: File) => {
    // Allow upload without login
    const fileUrl = URL.createObjectURL(file);

    // Log the upload activity if user exists
    if (currentUser) {
      logActivity(currentUser, 'upload', `Uploaded file: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
    }

    const isVideo = file.type.startsWith('video/') || file.name.toLowerCase().endsWith('.mp4') || file.name.toLowerCase().endsWith('.webm') || file.name.toLowerCase().endsWith('.mov');
    const isImage = false; // Disabled image support

    if (isVideo || isImage) {
        // For simple MP4/WebM, try to extract frames immediately
        if (file.name.toLowerCase().endsWith('.mp4') || file.name.toLowerCase().endsWith('.webm')) {
            try {
               const video = document.createElement('video');
               video.src = fileUrl;
               video.muted = true;
               video.playsInline = true;
               await video.play();
               video.pause();
               
               const duration = video.duration;
               
               if (duration > 15) {
                  alert("عذراً، يجب أن يكون الفيديو أقل من 15 ثانية لتجنب انهيار المتصفح.");
                  URL.revokeObjectURL(fileUrl);
                  return;
               }

               const vw = video.videoWidth;
               const vh = video.videoHeight;
               const fps = 30; 
               const totalFrames = Math.floor(duration * fps);

               const canvas = document.createElement('canvas');
               canvas.width = vw;
               canvas.height = vh;
               const ctx = canvas.getContext('2d');
               
               const newLayerImages: Record<string, string> = {};
               const newSprites: any[] = [];
               
               for (let i = 0; i < totalFrames; i++) {
                   const time = i / fps;
                   video.currentTime = time;
                   await new Promise(r => {
                       const onSeek = () => {
                           video.removeEventListener('seeked', onSeek);
                           r(null);
                       };
                       video.addEventListener('seeked', onSeek);
                   });
                   
                   if (ctx) {
                       ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                       const quality = 0.8;
                       const dataUrl = canvas.toDataURL('image/png', quality);
                       const key = `v_frame_${i}`;
                       newLayerImages[key] = dataUrl;
                       
                       const frames = [];
                       for (let f = 0; f < totalFrames; f++) {
                           frames.push({
                               alpha: f === i ? 1.0 : 0.0,
                               layout: { x: (videoWidth - canvas.width) / 2, y: (videoHeight - canvas.height) / 2, width: canvas.width, height: canvas.height },
                               transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }
                           });
                       }
                       
                       newSprites.push({
                           imageKey: key,
                           frames: frames,
                           matteKey: ""
                       });
                   }
               }

               const meta: FileMetadata = {
                   name: file.name, size: file.size, type: 'MP4',
                   dimensions: { width: videoWidth, height: videoHeight },
                   fps: fps, frames: totalFrames, assets: [], 
                   videoItem: {
                       version: "2.0",
                       videoSize: { width: videoWidth, height: videoHeight },
                       FPS: fps,
                       frames: totalFrames,
                       images: newLayerImages,
                       sprites: newSprites,
                       audios: [] 
                   },
                   fileUrl: fileUrl 
               };
               
               setFileMetadata(meta);
               setState(AppState.PROCESSING);

            } catch (e) {
                console.error(e);
                // Fallback to Workspace processing if simple extraction fails
                const meta: FileMetadata = {
                    name: file.name, size: file.size, type: 'VIDEO_COMPLEX',
                    dimensions: { width: 0, height: 0 },
                    fps: 30, frames: 0, assets: [], 
                    videoItem: null,
                    fileUrl: fileUrl 
                };
                setFileMetadata(meta);
                setState(AppState.PROCESSING);
            }
            return;
        }

        // For GIF/WebP/MOV (complex formats), pass to Workspace for FFmpeg processing
        const meta: FileMetadata = {
            name: file.name, 
            size: file.size, 
            type: isImage ? 'IMAGE_ANIM' : 'VIDEO_COMPLEX',
            dimensions: { width: 0, height: 0 },
            fps: 30, 
            frames: 0, 
            assets: [], 
            videoItem: null,
            fileUrl: fileUrl 
        };
        setFileMetadata(meta);
        setState(AppState.PROCESSING);
        return;
    }

    if (!file || !file.name.toLowerCase().endsWith('.svga')) return;
    
    try {
      const parser = new SVGA.Parser();
      parser.load(fileUrl, (videoItem: any) => {
        // Robust FPS extraction
        let extractedFps = videoItem.FPS || videoItem.fps || 30;
        if (typeof extractedFps === 'string') extractedFps = parseFloat(extractedFps);
        if (!extractedFps || extractedFps <= 0) extractedFps = 30;

        const meta: FileMetadata = {
          name: file.name, size: file.size, type: 'SVGA',
          dimensions: { width: videoItem.videoSize?.width || 0, height: videoItem.videoSize?.height || 0 },
          fps: extractedFps, frames: videoItem.frames || 0, assets: [], videoItem,
          fileUrl: fileUrl,
          originalFile: file
        };
        
        setFileMetadata(meta);
        setState(AppState.PROCESSING);
      }, (err: any) => {
        console.error("SVGA Load Error:", err);
        alert("فشل في قراءة ملف SVGA.");
        URL.revokeObjectURL(fileUrl);
      });
    } catch (err) {
      setState(AppState.IDLE);
    }
  }, [currentUser, settings]);

  const handleReset = useCallback(() => {
    if (fileMetadata?.fileUrl) {
      URL.revokeObjectURL(fileMetadata.fileUrl);
    }
    setState(AppState.IDLE);
    setFileMetadata(null);
  }, [fileMetadata]);

  if (loading) {
    return <Loading />;
  }

  const dynamicBgStyle: React.CSSProperties = settings?.backgroundUrl ? {
    backgroundImage: `linear-gradient(rgba(2, 6, 23, 0.4), rgba(2, 6, 23, 0.4)), url(${settings.backgroundUrl})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: 'fixed'
  } : {};

  return (
    <div className="min-h-screen text-slate-200 overflow-x-hidden relative" style={dynamicBgStyle}>
      {!settings?.backgroundUrl && <div className="fixed inset-0 bg-[#020617] -z-10" />}
      
      {isQuotaExceeded && (
        <div className="fixed top-0 left-0 right-0 bg-amber-500/90 backdrop-blur-sm text-black py-1 px-4 text-center text-[10px] font-bold z-[300] flex items-center justify-center gap-2">
          <span>⚠️ تم تجاوز حصة الاستخدام اليومية للسيرفر. الموقع يعمل الآن بالوضع الاحتياطي (Offline Mode).</span>
        </div>
      )}

      <Header 
        onLogoClick={handleReset} 
        isAdmin={currentUser?.role === 'admin'} 
        currentUser={currentUser}
        settings={settings}
        onAdminToggle={() => setState(AppState.ADMIN_PANEL)}
        onLogout={logout}
        isAdminOpen={state === AppState.ADMIN_PANEL}
        onBatchOpen={() => handleFeatureAccess(AppState.BATCH_COMPRESSOR, 'Batch Compressor')}
        onStoreOpen={() => setState(AppState.STORE)}
        onConverterOpen={() => handleFeatureAccess(AppState.VIDEO_CONVERTER, 'Video Converter')}
        onImageConverterOpen={() => handleFeatureAccess(AppState.IMAGE_CONVERTER, 'Image Converter')}
        onImageEditorOpen={() => handleFeatureAccess(AppState.IMAGE_EDITOR, 'Image Editor')}
        onImageMatcherOpen={() => handleFeatureAccess(AppState.IMAGE_MATCHER, 'Image Matcher')}
        onCropperOpen={() => handleFeatureAccess(AppState.BATCH_CROPPER, 'Batch Cropper')}
        onSvgaExOpen={() => handleFeatureAccess(AppState.SVGA_EDITOR_EX, 'SVGA Editor EX')}
        onMultiSvgaOpen={() => handleFeatureAccess(AppState.MULTI_SVGA_VIEWER, 'Multi SVGA Preview')}
        onImageProcessorOpen={() => handleFeatureAccess(AppState.IMAGE_PROCESSOR, 'Image Processor')}
        onLoginClick={() => {}}
        onProfileClick={() => {}}
        currentTab={
          state === AppState.BATCH_COMPRESSOR ? 'batch' : 
          state === AppState.STORE ? 'store' : 
          state === AppState.VIDEO_CONVERTER ? 'converter' : 
          state === AppState.IMAGE_CONVERTER ? 'image-converter' :
          state === AppState.IMAGE_PROCESSOR ? 'image-processor' :
          state === AppState.IMAGE_EDITOR ? 'image-editor' :
          state === AppState.IMAGE_MATCHER ? 'image-matcher' :
          state === AppState.BATCH_CROPPER ? 'cropper' :
          state === AppState.SVGA_EDITOR_EX ? 'svga-ex' :
          state === AppState.MULTI_SVGA_VIEWER ? 'multi-svga' :
          'svga'
        }
      />
      
      <div className="flex pt-20 h-screen overflow-hidden relative">
        <main className={`flex-1 overflow-y-auto transition-all duration-700 custom-scrollbar mr-0`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
            {state === AppState.IDLE && (
              <div className="py-10 sm:py-20 animate-in fade-in zoom-in duration-700">
                <Uploader 
                  onUpload={handleFileUpload} 
                  isUploading={false} 
                  onConverterOpen={() => handleFeatureAccess(AppState.VIDEO_CONVERTER, 'Video Converter')}
                  onMultiSvgaOpen={() => handleFeatureAccess(AppState.MULTI_SVGA_VIEWER, 'Multi SVGA Preview')}
                  globalQuality={globalQuality}
                  setGlobalQuality={setGlobalQuality}
                />
              </div>
            )}
            {(state === AppState.PROCESSING || state === AppState.SVGA_EDITOR_EX) && fileMetadata && (
              <Workspace 
                key={fileMetadata.fileUrl}
                metadata={fileMetadata} 
                onCancel={handleReset} 
                settings={settings} 
                currentUser={currentUser} 
                onLoginRequired={() => {}}
                onSubscriptionRequired={() => {}}
                globalQuality={globalQuality}
                onFileReplace={(meta) => setFileMetadata(meta)}
                mode={state === AppState.SVGA_EDITOR_EX ? 'ex' : 'normal'}
              />
            )}
            {state === AppState.BATCH_COMPRESSOR && (
              <BatchCompressor 
                onCancel={handleReset} 
                currentUser={currentUser} 
                onLoginRequired={() => {}}
                onSubscriptionRequired={() => {}}
              />
            )}
            {state === AppState.STORE && (
              <Store currentUser={currentUser} onLoginRequired={() => {}} />
            )}
            {state === AppState.VIDEO_CONVERTER && (
              <VideoConverter 
                currentUser={currentUser} 
                onCancel={handleReset} 
                onLoginRequired={() => {}}
                onSubscriptionRequired={() => {}}
                globalQuality={globalQuality}
              />
            )}
            {state === AppState.IMAGE_CONVERTER && (
              <ImageToSvga 
                currentUser={currentUser} 
                onCancel={handleReset} 
                onLoginRequired={() => {}}
                onSubscriptionRequired={() => {}}
                globalQuality={globalQuality}
              />
            )}
            {state === AppState.IMAGE_PROCESSOR && (
              <ImageProcessor 
                currentUser={currentUser} 
                onCancel={handleReset} 
              />
            )}
            {state === AppState.IMAGE_EDITOR && (
              <ImageEditor 
                currentUser={currentUser} 
                onCancel={handleReset} 
                onLoginRequired={() => {}}
                onSubscriptionRequired={() => {}}
              />
            )}
            {state === AppState.IMAGE_MATCHER && (
              <ImageMatcher 
                currentUser={currentUser} 
                onCancel={handleReset} 
                onLoginRequired={() => {}}
                onSubscriptionRequired={() => {}}
              />
            )}
            {state === AppState.BATCH_CROPPER && (
              <BatchCropper 
                currentUser={currentUser} 
                onCancel={handleReset} 
                onLoginRequired={() => {}}
                onSubscriptionRequired={() => {}}
              />
            )}
            {state === AppState.MULTI_SVGA_VIEWER && (
              <MultiSvgaViewer 
                onCancel={handleReset} 
              />
            )}
            {state === AppState.ADMIN_PANEL && currentUser?.role === 'admin' && (
              <AdminPanel currentUser={currentUser} onCancel={handleReset} />
            )}
          </div>
        </main>
      </div>

      {/* WhatsApp Floating Button */}
      {settings?.whatsappNumber && (
        <a 
          href={`https://wa.me/${settings.whatsappNumber}`}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 left-6 z-[100] w-14 h-14 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-full flex items-center justify-center shadow-lg shadow-[#25D366]/30 transition-all hover:scale-110 hover:-translate-y-1 group"
          title="تواصل معنا عبر واتساب"
        >
          <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
          </svg>
        </a>
      )}

      {/* Help Button */}
      <button 
        onClick={() => setShowOnboarding(true)}
        className={`fixed ${settings?.whatsappNumber ? 'bottom-24' : 'bottom-6'} left-6 z-[100] w-14 h-14 bg-blue-600 hover:bg-blue-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-blue-600/30 transition-all hover:scale-110 hover:-translate-y-1 group`}
        title="شرح الموقع"
      >
        <HelpCircle className="w-8 h-8" />
      </button>

      {/* Onboarding Modal */}
      <OnboardingModal 
        isOpen={showOnboarding} 
        onClose={handleCloseOnboarding} 
      />
    </div>
  );
};

export default App;
