import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, ShieldCheck, Activity, Gift as GiftIcon, ShoppingBag, 
  Crown, Smartphone, Eraser, X, Medal, IdCard, Layout, Zap, Smile, Heart, Building, Image as ImageIcon, UserCircle, Home, Menu, ChevronLeft
} from 'lucide-react';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { User, Room, Gift, StoreItem, GameSettings, VIPPackage } from '../types';

import AdminUsers from './Admin/AdminUsers';
import AdminGames from './Admin/AdminGames';
import AdminGifts from './Admin/AdminGifts';
import AdminStore from './Admin/AdminStore';
import AdminVIP from './Admin/AdminVIP';
import AdminIdentity from './Admin/AdminIdentity';
import AdminMaintenance from './Admin/AdminMaintenance';
import AdminBadges from './Admin/AdminBadges';
import AdminIdBadges from './Admin/AdminIdBadges';
import AdminMicSkins from './Admin/AdminMicSkins';
import AdminAgency from './Admin/AdminAgency';
import AdminHostAgencies from './Admin/AdminHostAgencies';
import AdminEmojis from './Admin/AdminEmojis';
import AdminRelationships from './Admin/AdminRelationships';
import AdminBackgrounds from './Admin/AdminBackgrounds';
import AdminDefaults from './Admin/AdminDefaults';
import AdminRooms from './Admin/AdminRooms';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  users: User[];
  onUpdateUser: (userId: string, data: Partial<User>) => Promise<void>;
  rooms: Room[];
  setRooms: (rooms: Room[]) => void;
  onUpdateRoom: (roomId: string, data: Partial<Room>) => Promise<void>;
  gifts: Gift[];
  storeItems: StoreItem[];
  vipLevels: VIPPackage[];
  gameSettings: GameSettings;
  setGameSettings: (settings: GameSettings) => Promise<void>;
  appBanner: string;
  onUpdateAppBanner: (url: string) => void;
  appLogo: string;
  onUpdateAppLogo: (url: string) => void;
  appName: string;
  onUpdateAppName: (name: string) => void;
  authBackground: string;
  onUpdateAuthBackground: (url: string) => void;
}

const ROOT_ADMIN_EMAIL = 'admin@live-tilk.com';

const compressImage = (base64: string, maxWidth: number, maxHeight: number, quality: number = 0.2): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width; let height = img.height;
      if (width > height) { if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; } }
      else { if (height > maxHeight) { width *= maxHeight / height; height = maxHeight; } }
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'medium';
        ctx.drawImage(img, 0, 0, width, height);
      }
      resolve(canvas.toDataURL('image/webp', quality));
    };
    img.onerror = () => resolve(base64);
  });
};

const AdminPanel: React.FC<AdminPanelProps> = (props) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const currentEmail = (props.currentUser as any).email?.toLowerCase() || '';
  const isIdOne = props.currentUser.customId?.toString() === '1';
  const isRootAdmin = currentEmail === ROOT_ADMIN_EMAIL.toLowerCase() || isIdOne;
  const isModerator = props.currentUser.isSystemModerator;

  const menuItems = [
    { id: 'users', label: 'إدارة الأعضاء', icon: Users, color: 'text-blue-400' },
    { id: 'rooms_manage', label: 'إدارة الغرف', icon: Home, color: 'text-red-500' },
    { id: 'defaults', label: 'صور البداية', icon: UserCircle, color: 'text-indigo-400' },
    { id: 'badges', label: 'أوسمة الشرف', icon: Medal, color: 'text-yellow-500' },
    { id: 'id_badges', label: 'أوسمة الـ ID', icon: IdCard, color: 'text-blue-500' },
    { id: 'host_agency', label: 'وكالات المضيفين', icon: Building, color: 'text-emerald-400' },
    { id: 'room_bgs', label: 'خلفيات الغرف', icon: ImageIcon, color: 'text-indigo-400' },
    { id: 'mic_skins', label: 'أشكال المايكات', icon: Layout, color: 'text-indigo-500' },
    { id: 'emojis', label: 'الإيموشنات', icon: Smile, color: 'text-yellow-400' },
    { id: 'relationships', label: 'نظام الارتباط', icon: Heart, color: 'text-pink-500' },
    { id: 'agency', label: 'الوكالات (شحن)', icon: Zap, color: 'text-orange-500' },
    { id: 'games', label: 'مركز الحظ', icon: Activity, color: 'text-orange-400' },
    { id: 'gifts', label: 'إدارة الهدايا', icon: GiftIcon, color: 'text-pink-400' },
    { id: 'store', label: 'إدارة المتجر', icon: ShoppingBag, color: 'text-cyan-400' },
    { id: 'vip', label: 'إدارة الـ VIP', icon: Crown, color: 'text-amber-400' },
    { id: 'identity', label: 'هوية التطبيق', icon: Smartphone, color: 'text-emerald-400' },
    { id: 'maintenance', label: 'صيانة النظام', icon: Eraser, color: 'text-red-500' },
  ];

  const allowedMenuItems = menuItems.filter(item => {
    if (isRootAdmin) return true;
    if (isModerator && props.currentUser.moderatorPermissions?.includes(item.id)) return true;
    return false;
  });

  const [activeTab, setActiveTab] = useState<string>(allowedMenuItems[0]?.id || 'users');

  if (!props.isOpen || (!isRootAdmin && !isModerator)) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, callback: (url: string) => void, w: number, h: number) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) {
        alert('حجم الملف كبير جداً');
        return;
      }
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const result = ev.target?.result as string;
        if (file.type === 'image/gif' || file.type.startsWith('video/')) {
          callback(result);
        } else {
          const compressed = await compressImage(result, w, h, 0.2);
          callback(compressed);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateGameSettings = async (updates: Partial<GameSettings>) => {
    const newSettings = { ...props.gameSettings, ...updates };
    await props.setGameSettings(newSettings);
  };

  return (
    <div className="fixed inset-0 z-[3000] bg-[#020617] flex flex-col md:flex-row font-cairo overflow-hidden text-right" dir="rtl">
      
      <div className="md:hidden flex items-center justify-between p-4 bg-slate-950 border-b border-white/5 shrink-0 z-[3005]">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 bg-white/5 rounded-xl text-white active:scale-95 transition-transform"
          >
            <Menu size={24} />
          </button>
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-blue-400" />
            <span className="text-xs font-black text-white">{menuItems.find(i => i.id === activeTab)?.label}</span>
          </div>
        </div>
        <button onClick={props.onClose} className="p-2 text-slate-500">
          <X size={24} />
        </button>
      </div>

      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[3010] md:hidden"
          />
        )}
      </AnimatePresence>

      <motion.div 
        className={`fixed md:relative top-0 right-0 h-full w-[280px] md:w-72 bg-slate-950 border-l border-white/5 flex flex-col shrink-0 shadow-2xl z-[3011] transition-transform md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/40">
                  <ShieldCheck size={22} className="text-white" />
               </div>
               <div className="text-right">
                 <p className="font-black text-xs text-white leading-none mb-1">لوحة التحكم</p>
                 <p className="text-[10px] text-slate-500 font-bold uppercase">{isRootAdmin ? 'المدير العام' : 'مشرف نظام'}</p>
               </div>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 text-slate-400">
               <X size={20} />
            </button>
          </div>
        </div>
        
        <nav className="flex-1 overflow-y-auto p-4 space-y-1.5 scrollbar-hide">
          {allowedMenuItems.map(item => (
            <button 
              key={item.id} 
              onClick={() => {
                setActiveTab(item.id);
                setIsSidebarOpen(false);
              }} 
              className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all group ${activeTab === item.id ? 'bg-blue-600/10 text-white border border-blue-500/20' : 'text-slate-500 hover:bg-white/5'}`}
            >
              <div className="flex items-center gap-3">
                <item.icon size={20} className={activeTab === item.id ? item.color : 'group-hover:text-slate-300'} />
                <span className="text-xs font-black">{item.label}</span>
              </div>
              {activeTab === item.id && <ChevronLeft size={14} className="text-blue-500" />}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5">
           <button 
            onClick={props.onClose}
            className="w-full py-3 bg-red-600/10 text-red-500 rounded-xl text-[10px] font-black hover:bg-red-600 hover:text-white transition-all flex items-center justify-center gap-2"
           >
              إغلاق اللوحة <X size={14} />
           </button>
        </div>
      </motion.div>

      <div className="flex-1 bg-[#020617] overflow-y-auto p-4 md:p-10 scrollbar-hide pb-20 md:pb-10 relative">
        <div className="max-w-7xl mx-auto">
            {activeTab === 'users' && <AdminUsers users={props.users} vipLevels={props.vipLevels} onUpdateUser={props.onUpdateUser} currentUser={props.currentUser} />}
            {activeTab === 'rooms_manage' && <AdminRooms rooms={props.rooms} />}
            {activeTab === 'defaults' && <AdminDefaults handleFileUpload={handleFileUpload} />}
            {activeTab === 'badges' && <AdminBadges users={props.users} onUpdateUser={props.onUpdateUser} />}
            {activeTab === 'id_badges' && <AdminIdBadges users={props.users} onUpdateUser={props.onUpdateUser} />}
            {activeTab === 'host_agency' && <AdminHostAgencies users={props.users} onUpdateUser={props.onUpdateUser} />}
            {activeTab === 'room_bgs' && <AdminBackgrounds handleFileUpload={handleFileUpload} />}
            {activeTab === 'mic_skins' && <AdminMicSkins handleFileUpload={handleFileUpload} />}
            {activeTab === 'agency' && <AdminAgency users={props.users} onUpdateUser={props.onUpdateUser} />}
            {activeTab === 'emojis' && <AdminEmojis gameSettings={props.gameSettings} onUpdateGameSettings={handleUpdateGameSettings} handleFileUpload={handleFileUpload} />}
            {activeTab === 'relationships' && <AdminRelationships gameSettings={props.gameSettings} onUpdateGameSettings={handleUpdateGameSettings} handleFileUpload={handleFileUpload} />}
            {activeTab === 'games' && <AdminGames gameSettings={props.gameSettings} onUpdateGameSettings={handleUpdateGameSettings} handleFileUpload={handleFileUpload} />}
            {activeTab === 'gifts' && <AdminGifts gifts={props.gifts} onSaveGift={async (g, d) => { const ref = doc(db, 'gifts', g.id); d ? await deleteDoc(ref) : await setDoc(ref, g); }} handleFileUpload={handleFileUpload} />}
            {activeTab === 'store' && <AdminStore storeItems={props.storeItems} onSaveItem={async (i, d) => { const ref = doc(db, 'store', i.id); d ? await deleteDoc(ref) : await setDoc(ref, i); }} handleFileUpload={handleFileUpload} />}
            {activeTab === 'vip' && <AdminVIP vipLevels={props.vipLevels} onSaveVip={async (v, d) => { const id = `vip_lvl_${v.level}`; const ref = doc(db, 'vip', id); d ? await deleteDoc(ref) : await setDoc(ref, { ...v, id }); }} handleFileUpload={handleFileUpload} />}
            {activeTab === 'identity' && <AdminIdentity appLogo={props.appLogo} appBanner={props.appBanner} appName={props.appName} authBackground={props.authBackground} onUpdateAppLogo={props.onUpdateAppLogo} onUpdateAppBanner={props.onUpdateAppBanner} onUpdateAppName={props.onUpdateAppName} onUpdateAuthBackground={props.onUpdateAuthBackground} handleFileUpload={handleFileUpload} />}
            {activeTab === 'maintenance' && <AdminMaintenance currentUser={props.currentUser} />}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;