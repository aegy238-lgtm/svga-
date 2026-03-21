import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../services/firebase';
import { collection, query, orderBy, limit, onSnapshot, Timestamp } from 'firebase/firestore';

interface EntryEvent {
  id: string;
  userId: string;
  userName: string;
  videoUrl: string;
  timestamp: any;
}

interface EntryAnimationLayerProps {
  roomId: string;
  currentUserId: string;
  onActiveChange?: (active: boolean) => void; // مضاف
}

const EntryAnimationLayer: React.FC<EntryAnimationLayerProps> = ({ roomId, currentUserId, onActiveChange }) => {
  const [activeEntry, setActiveEntry] = useState<EntryEvent | null>(null);
  const playedIds = useRef(new Set<string>());
  const videoRef = useRef<HTMLVideoElement>(null);

  // مراقبة النشاط لإبلاغ الغرفة
  useEffect(() => {
    if (onActiveChange) {
      onActiveChange(!!activeEntry);
    }
  }, [activeEntry, onActiveChange]);

  useEffect(() => {
    const q = query(
      collection(db, 'rooms', roomId, 'entry_events'),
      orderBy('timestamp', 'desc'),
      limit(3)
    );

    const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const data = change.doc.data();
          const event = { id: change.doc.id, ...data } as EntryEvent;
          
          if (playedIds.current.has(event.id)) return;

          const now = Date.now();
          const eventTime = data.timestamp?.toMillis ? data.timestamp.toMillis() : now;
          
          if (Math.abs(now - eventTime) < 15000) {
            playedIds.current.add(event.id);
            setActiveEntry(event);
            
            setTimeout(() => {
              setActiveEntry(null);
              setTimeout(() => playedIds.current.delete(event.id), 20000);
            }, 6500);
          }
        }
      });
    });

    return () => {
      unsubscribe();
      playedIds.current.clear();
    };
  }, [roomId]);

  return (
    <div className="absolute inset-0 z-[950] pointer-events-none overflow-hidden">
      <AnimatePresence>
        {activeEntry && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center"
          >
             <video 
               ref={videoRef}
               src={activeEntry.videoUrl} 
               autoPlay 
               playsInline 
               className="w-full h-full object-cover"
               onPlay={(e) => {
                 const video = e.target as HTMLVideoElement;
                 video.volume = 0.6;
                 video.muted = false;
               }}
             />
             
             <motion.div 
               initial={{ y: 100, opacity: 0, scale: 0.8 }}
               animate={{ y: 0, opacity: 1, scale: 1 }}
               exit={{ y: 50, opacity: 0 }}
               className="absolute bottom-24 bg-black/80 backdrop-blur-2xl border border-amber-500/50 px-10 py-4 rounded-full shadow-[0_0_50px_rgba(245,158,11,0.5)] flex items-center gap-5 z-[1000]"
             >
                <motion.div 
                  animate={{ scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                  className="w-3 h-3 bg-amber-500 rounded-full shadow-[0_0_15px_#f59e0b]"
                />
                <div className="flex flex-col items-center">
                   <span className="text-white font-black text-lg drop-shadow-lg tracking-tight">
                     الملك <span className="text-amber-400">{activeEntry.userName}</span>
                   </span>
                   <span className="text-[10px] text-amber-200/70 font-bold uppercase tracking-[0.2em] -mt-1">تفضل بالدخول</span>
                </div>
                <motion.div 
                  animate={{ scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] }}
                  transition={{ repeat: Infinity, duration: 1, delay: 0.5 }}
                  className="w-3 h-3 bg-amber-500 rounded-full shadow-[0_0_15px_#f59e0b]"
                />
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EntryAnimationLayer;