
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, User as UserIcon, Shield, Smile, Paperclip } from 'lucide-react';
import { User } from '../types';
import { db } from '../services/firebase';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, limit, doc, setDoc } from 'firebase/firestore';

interface PrivateChatModalProps {
  partner: User;
  currentUser: User;
  onClose: () => void;
}

interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: any;
}

const PrivateChatModal: React.FC<PrivateChatModalProps> = ({ partner, currentUser, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // توليد معرف فريد للمحادثة بين الطرفين
  const chatId = [currentUser.id, partner.id].sort().join('_');

  useEffect(() => {
    const q = query(
      collection(db, 'private_chats', chatId, 'messages'),
      orderBy('timestamp', 'asc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setMessages(msgs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [chatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    const text = inputText;
    setInputText('');

    try {
      // 1. إضافة الرسالة للمجموعة الفرعية
      await addDoc(collection(db, 'private_chats', chatId, 'messages'), {
        senderId: currentUser.id,
        text,
        timestamp: serverTimestamp()
      });

      // 2. تحديث بيانات المحادثة الأساسية لتظهر في تبويب الرسائل
      await setDoc(doc(db, 'private_chats', chatId), {
        participants: [currentUser.id, partner.id],
        lastMessage: text,
        lastTimestamp: serverTimestamp(),
        [`user_${currentUser.id}`]: {
          name: currentUser.name,
          avatar: currentUser.avatar
        },
        [`user_${partner.id}`]: {
          name: partner.name,
          avatar: partner.avatar
        }
      }, { merge: true });

    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="w-full max-w-md h-[80vh] bg-[#0c101b] border border-white/10 rounded-[2.5rem] flex flex-col overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="p-5 bg-white/5 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="relative">
                <img src={partner.avatar} className="w-12 h-12 rounded-full object-cover border border-white/10 shadow-lg" alt="" />
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[#0c101b] rounded-full"></div>
             </div>
             <div className="text-right">
                <h3 className="text-white font-black text-sm leading-tight">{partner.name}</h3>
                <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1 justify-end">
                   متواجد الآن <Shield size={10} />
                </span>
             </div>
          </div>
          <button onClick={onClose} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-4 opacity-50">
               <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-2 shadow-inner">
                 <Shield size={40} className="text-slate-600" />
               </div>
               <p className="text-sm font-black text-center px-10">ابدأ الآن أول محادثة خاصة ومشفرة مع {partner.name}</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMine = msg.senderId === currentUser.id;
              return (
                <motion.div 
                  initial={{ opacity: 0, x: isMine ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={msg.id} 
                  className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] px-5 py-3 rounded-2xl text-xs md:text-sm ${
                    isMine 
                      ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-black rounded-tr-none shadow-xl shadow-orange-900/20 font-black' 
                      : 'bg-slate-800/80 backdrop-blur text-white rounded-tl-none border border-white/5 shadow-md font-bold'
                  }`}>
                    {msg.text}
                  </div>
                </motion.div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <form onSubmit={handleSendMessage} className="p-4 bg-black/40 border-t border-white/5 flex items-center gap-3">
           <button type="button" className="p-2.5 bg-white/5 rounded-xl text-slate-500 hover:text-white transition-colors active:scale-90"><Paperclip size={20} /></button>
           <div className="flex-1 relative">
              <input 
                type="text" 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="اكتب رسالتك الخاصة..."
                className="w-full bg-[#0a0c14] border border-white/5 rounded-2xl py-3.5 px-5 pr-12 text-sm text-white outline-none focus:border-amber-500/50 transition-all text-right font-bold"
              />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-amber-500"><Smile size={20} /></button>
           </div>
           <button 
              type="submit"
              disabled={!inputText.trim()}
              className="w-12 h-12 bg-gradient-to-r from-amber-500 to-orange-600 text-black rounded-2xl flex items-center justify-center shadow-xl active:scale-95 transition-all disabled:opacity-50"
           >
              <Send size={22} fill="currentColor" className="rotate-180" />
           </button>
        </form>
      </motion.div>
    </div>
  );
};

export default PrivateChatModal;
