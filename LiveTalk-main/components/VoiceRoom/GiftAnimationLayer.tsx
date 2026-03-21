import React, { useState, useEffect, useImperativeHandle, forwardRef, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../services/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { User, GiftDisplaySize } from '../../types';

interface GiftEvent {
  id: string;
  giftId: string;
  giftName: string;
  giftIcon: string;
  giftAnimation: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  recipientIds: string[];
  quantity: number;
  duration?: number;
  displaySize?: GiftDisplaySize;
  timestamp: any;
}

interface GiftAnimationLayerProps {
  roomId: string;
  currentUserId: string;
  speakers?: any[];
  onActiveChange?: (active: boolean) => void; // مضاف
}

const SmartVideoPlayer = ({ src, objectFit }: { src: string, objectFit: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const startVideo = async () => {
      try {
        video.muted = true;
        if (playPromiseRef.current) {
          await playPromiseRef.current;
        }
        playPromiseRef.current = video.play();
        await playPromiseRef.current;
        
        setTimeout(() => {
          if (video) {
            video.muted = false;
            video.volume = 0.5;
          }
        }, 100);
      } catch (err) {
        console.warn("Video sound playback blocked by browser", err);
      }
    };

    startVideo();

    return () => {
      if (video) {
        video.pause();
        video.src = "";
        video.load();
      }
    };
  }, [src]);

  return (
    <div className="w-full h-full relative flex items-center justify-center bg-transparent overflow-hidden">
      <video 
        ref={videoRef}
        key={src}
        src={src} 
        autoPlay
        playsInline
        webkit-playsinline="true"
        preload="auto"
        disablePictureInPicture
        disableRemotePlayback
        className={`w-full h-full ${objectFit}`}
        style={{ 
          pointerEvents: 'none',
          backgroundColor: 'transparent'
        }}
      />
    </div>
  );
};

export const GiftAnimationLayer = forwardRef((props: GiftAnimationLayerProps, ref) => {
  const { roomId, currentUserId, onActiveChange } = props;
  const [activeAnimations, setActiveAnimations] = useState<GiftEvent[]>([]);
  const playedIds = useRef(new Set<string>());

  // مراقبة النشاط لإبلاغ الغرفة
  useEffect(() => {
    if (onActiveChange) {
      onActiveChange(activeAnimations.length > 0);
    }
  }, [activeAnimations, onActiveChange]);

  const isVideoUrl = (url: string) => {
    if (!url) return false;
    return url.match(/\.(mp4|webm|ogg|mov|m4v)$/i) || url.includes('video') || url.includes('mp4');
  };

  const triggerAnimation = (event: GiftEvent) => {
    if (playedIds.current.has(event.id)) return;
    playedIds.current.add(event.id);

    setActiveAnimations(prev => [...prev, event]);
    
    const displayDuration = (event.duration || 5) * 1000;
    
    setTimeout(() => {
      setActiveAnimations(prev => prev.filter(a => a.id !== event.id));
      setTimeout(() => playedIds.current.delete(event.id), 5000);
    }, displayDuration);
  };

  useImperativeHandle(ref, () => ({
    trigger: (event: GiftEvent) => triggerAnimation(event)
  }));

  useEffect(() => {
    const q = query(
      collection(db, 'rooms', roomId, 'gift_events'),
      orderBy('timestamp', 'desc'),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const data = change.doc.data();
          const newEvent = { id: change.doc.id, ...data } as GiftEvent;
          
          if (newEvent.senderId === currentUserId) return;
          
          const now = Date.now();
          const eventTime = data.timestamp?.toMillis ? data.timestamp.toMillis() : now;
          
          if (now - eventTime < 10000) {
            triggerAnimation(newEvent);
          }
        }
      });
    });

    return () => unsubscribe();
  }, [roomId, currentUserId]);

  const getSizeClass = (size?: GiftDisplaySize) => {
    switch (size) {
      case 'small': return 'w-32 h-32';
      case 'medium': return 'w-64 h-64';
      case 'large': return 'w-[85vw] h-[85vw]';
      case 'full': return 'w-full h-full';
      case 'max': return 'w-full h-full';
      default: return 'w-64 h-64';
    }
  };

  const renderGiftContent = (icon: string, displaySize: GiftDisplaySize = 'medium') => {
    if (!icon) return null;
    
    const isFull = displaySize === 'full' || displaySize === 'max';
    const objectFit = isFull ? 'object-cover' : 'object-contain';

    if (isVideoUrl(icon)) {
      return <SmartVideoPlayer src={icon} objectFit={objectFit} />;
    }

    const isImage = icon.includes('http') || icon.includes('data:image') || icon.includes('base64');
    if (isImage) {
      return (
        <img 
          src={icon} 
          className={`w-full h-full ${objectFit}`} 
          alt="" 
        />
      );
    }
    return <span className={`${isFull ? 'text-[200px]' : 'text-8xl'} drop-shadow-2xl`}>{icon}</span>;
  };

  return (
    <div className="absolute inset-0 z-[800] pointer-events-none overflow-hidden">
      <AnimatePresence>
        {activeAnimations.map((event) => {
          const displaySize = event.displaySize || 'medium';
          const isFull = displaySize === 'full' || displaySize === 'max' || event.giftAnimation === 'full-screen';
          
          const sizeClass = getSizeClass(displaySize);
          const showFullScreen = isFull;
          
          return (
            <motion.div 
              key={event.id}
              initial={showFullScreen ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.5, y: 50 }}
              animate={showFullScreen ? { opacity: 1 } : { opacity: [0, 1, 1, 0], scale: [0.5, 1.1, 1, 1.2], y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ 
                duration: showFullScreen ? 0 : 0.5,
                ease: "linear"
              }}
              className={`absolute inset-0 flex flex-col items-center justify-center ${showFullScreen ? 'z-[1000]' : 'z-[800]'}`}
            >
              <div className={`relative ${sizeClass} flex items-center justify-center overflow-hidden`}>
                 <div className="relative z-10 w-full h-full flex items-center justify-center">
                    {renderGiftContent(event.giftIcon, displaySize)}
                 </div>
                 
                 {!showFullScreen && event.quantity > 1 && (
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1.2 }}
                      className="absolute -right-6 top-0 bg-gradient-to-b from-yellow-300 to-orange-600 text-white font-black text-5xl px-4 py-1 rounded-2xl shadow-[0_0_30px_rgba(0,0,0,0.6)] border-2 border-white italic z-20"
                    >
                       X{event.quantity}
                    </motion.div>
                 )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
});

export default GiftAnimationLayer;