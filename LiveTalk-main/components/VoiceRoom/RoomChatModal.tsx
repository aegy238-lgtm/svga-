
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Smile, Shield } from 'lucide-react';
import { db } from '../../services/firebase';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, limit } from 'firebase/firestore';
import { User, Room } from '../../types';

interface RoomChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room;
  currentUser: User;
}

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  userLevel: number;
  content: string;
  timestamp: any;
  type: 'text' | 'gift';
}

const RoomChatModal: React.FC<RoomChatModalProps> = ({ isOpen, onClose, room, currentUser }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const q = query(
      collection(db, 'rooms', room.id, 'messages'),
      orderBy('timestamp', 'asc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ChatMessage[];
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [isOpen, room.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const text = inputText;
    setInputText('');

    try {
      await addDoc(collection(db, 'rooms', room.id, 'messages'), {
        userId: currentUser.id,
        userName: currentUser.name,
        userLevel: currentUser.wealthLevel || 1,
        content: text,
        type: 'text',
        timestamp: serverTimestamp()
      });
    } catch (err) {
      console.error("Error sending room message:", err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        onClick={onClose} 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      
      <motion.div 
        initial={{ y: "100%" }} 
        animate={{ y: 0 }} 
        exit={{ y: "100%" }}
        className="relative w-full max-w-md h-[60vh] bg-[#0f172a]/95 backdrop-blur-xl border-t border-white/10 rounded-t-[2.5rem] flex flex-col overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-amber-500" />
            <span className="text-xs font-black text-white">دردشة الغرفة العامة</span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-slate-400">
            <X size={20} />
          </button>
        </div>

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
          {messages.map((msg) => (
            <div key={msg.id} className="flex flex-col items-start text-right" dir="rtl">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="bg-amber-500 text-black text-[8px] font-black px-1.5 rounded-md">
                  Lv.{msg.userLevel}
                </span>
                <span className="text-[10px] font-bold text-slate-400">{msg.userName}:</span>
              </div>
              <div className="bg-white/5 border border-white/5 px-3 py-2 rounded-2xl rounded-tr-none max-w-[85%]">
                <p className="text-xs text-white leading-relaxed">{msg.content}</p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSendMessage} className="p-4 bg-black/40 border-t border-white/10 flex items-center gap-2">
          <button type="button" className="p-2 text-slate-500 hover:text-white"><Smile size={20} /></button>
          <input 
            type="text" 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="اكتب شيئاً..."
            className="flex-1 bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-xs text-white outline-none focus:border-amber-500/50 transition-all"
          />
          <button 
            type="submit"
            disabled={!inputText.trim()}
            className="w-10 h-10 bg-amber-500 text-black rounded-xl flex items-center justify-center shadow-lg active:scale-90 disabled:opacity-50"
          >
            <Send size={18} fill="currentColor" />
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default RoomChatModal;
