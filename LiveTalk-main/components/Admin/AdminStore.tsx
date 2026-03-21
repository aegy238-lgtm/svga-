import React, { useState } from 'react';
import { Plus, ShoppingBag, Edit3, Trash2, X, Upload, Image as ImageIcon, Video, Wand2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { StoreItem } from '../../types';

interface AdminStoreProps {
  storeItems: StoreItem[];
  onSaveItem: (item: StoreItem, isDelete?: boolean) => Promise<void>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>, callback: (url: string) => void, w: number, h: number) => void;
}

const AdminStore: React.FC<AdminStoreProps> = ({ storeItems, onSaveItem, handleFileUpload }) => {
  const [editingStoreItem, setEditingStoreItem] = useState<Partial<StoreItem> | null>(null);
  const [isUploadingThumb, setIsUploadingThumb] = useState(false);
  const [isUploadingUrl, setIsUploadingUrl] = useState(false);

  const handleFinalSave = async () => {
    if (!editingStoreItem) return;
    try {
      await onSaveItem(editingStoreItem as StoreItem);
      setEditingStoreItem(null);
    } catch (error) {
      console.error("Error saving store item:", error);
      alert("حدث خطأ أثناء حفظ العنصر");
    }
  };

  return (
    <div className="space-y-6 text-right font-cairo" dir="rtl">
      <div className="flex items-center justify-between bg-slate-950/40 p-6 rounded-[2rem] border border-white/5 shadow-xl">
        <div>
          <h3 className="text-2xl font-black text-white flex items-center gap-2">
            <ShoppingBag className="text-cyan-500" /> إدارة المتجر الشاملة
          </h3>
          <p className="text-slate-500 text-xs font-bold mt-1">إضافة وتعديل الإطارات، الفقاعات، والدخوليات الملكية.</p>
        </div>
        <button 
          onClick={() => setEditingStoreItem({ id: 'item_' + Date.now(), name: '', type: 'frame', price: 500, url: '', thumbnailUrl: '' })} 
          className="px-6 py-3 bg-cyan-600 text-white rounded-2xl font-black text-xs flex items-center gap-2 shadow-xl active:scale-95 transition-all"
        >
          <Plus size={18}/> إضافة عنصر جديد
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {storeItems.map(item => (
          <div key={item.id} className="bg-slate-950/60 p-4 rounded-[2.5rem] border border-white/10 flex flex-col items-center gap-2 group relative overflow-hidden">
            <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <button onClick={() => setEditingStoreItem(item)} className="p-2 bg-blue-600 rounded-xl text-white shadow-lg"><Edit3 size={12}/></button>
              <button onClick={() => { if(confirm('حذف هذا العنصر نهائياً؟')) onSaveItem(item, true) }} className="p-2 bg-red-600 rounded-xl text-white shadow-lg"><Trash2 size={12}/></button>
            </div>
            <div className="w-20 h-20 bg-black/40 rounded-3xl flex items-center justify-center overflow-hidden mb-1">
               {item.type === 'entry' ? (
                 <div className="relative w-full h-full">
                    <img src={item.thumbnailUrl || item.url} className="w-full h-full object-cover" alt="" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><Video size={20} className="text-white opacity-60" /></div>
                 </div>
               ) : (
                 <img src={item.url} className="w-full h-full object-contain p-2" alt={item.name} />
               )}
            </div>
            <span className="text-xs font-black text-white truncate w-full text-center">{item.name}</span>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-yellow-500 font-bold">{item.price.toLocaleString()}</span>
              <span className="text-[8px] text-slate-500 uppercase">{item.type}</span>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {editingStoreItem && (
          <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-slate-900 border border-white/10 rounded-[3rem] w-full max-w-lg p-8 shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-black text-white flex items-center gap-2 text-right"><ShoppingBag className="text-cyan-500 ml-2"/> إعداد عنصر المتجر</h3>
                <button onClick={() => setEditingStoreItem(null)} className="p-2 bg-white/5 rounded-full"><X size={24} className="text-slate-500" /></button>
              </div>
              
              <div className="space-y-8">
                {/* معاينة العنصر */}
                <div className="flex flex-col items-center gap-4 p-8 bg-black/30 rounded-[2.5rem] border border-white/5 relative group">
                  <div className="w-32 h-32 flex items-center justify-center bg-slate-800 rounded-[2rem] border border-white/10 shadow-inner overflow-hidden relative">
                    {editingStoreItem.thumbnailUrl || (editingStoreItem.type !== 'entry' && editingStoreItem.url) ? (
                      <img src={editingStoreItem.thumbnailUrl || editingStoreItem.url} className="w-full h-full object-contain" alt="" />
                    ) : (
                      <ImageIcon className="text-slate-700" size={48} />
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 gap-2 w-full">
                     <label className="bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 px-6 py-3 rounded-2xl text-xs font-black cursor-pointer flex items-center justify-center gap-2 transition-all active:scale-95">
                        <Upload size={16} /> {isUploadingThumb ? 'جاري الرفع...' : 'رفع صورة المعاينة (أيقونة)'}
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => { setIsUploadingThumb(true); handleFileUpload(e, (url) => { setEditingStoreItem({...editingStoreItem, thumbnailUrl: url}); setIsUploadingThumb(false); }, 300, 300); }} />
                     </label>

                     {editingStoreItem.type === 'entry' && (
                        <label className="bg-blue-600 text-white px-6 py-3 rounded-2xl text-xs font-black cursor-pointer flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all">
                           <Video size={16} /> {isUploadingUrl ? 'جاري الرفع...' : 'رفع فيديو الدخولية (MP4)'}
                           <input type="file" accept="video/mp4" className="hidden" onChange={(e) => { setIsUploadingUrl(true); handleFileUpload(e, (url) => { setEditingStoreItem({...editingStoreItem, url: url}); setIsUploadingUrl(false); }, 1080, 1920); }} />
                        </label>
                     )}

                     {editingStoreItem.type !== 'entry' && (
                        <label className="bg-indigo-600 text-white px-6 py-3 rounded-2xl text-xs font-black cursor-pointer flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all">
                           <ImageIcon size={16} /> {isUploadingUrl ? 'جاري الرفع...' : 'رفع صورة الإطار/الفقاعة'}
                           <input type="file" accept="image/*" className="hidden" onChange={(e) => { setIsUploadingUrl(true); handleFileUpload(e, (url) => { setEditingStoreItem({...editingStoreItem, url: url}); setIsUploadingUrl(false); }, 400, 400); }} />
                        </label>
                     )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase pr-2">اسم العنصر</label>
                      <input type="text" value={editingStoreItem.name} onChange={e => setEditingStoreItem({...editingStoreItem, name: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white text-xs font-bold outline-none focus:border-cyan-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase pr-2">سعر البيع</label>
                      <input type="number" value={editingStoreItem.price} onChange={e => setEditingStoreItem({...editingStoreItem, price: parseInt(e.target.value) || 0})} className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-yellow-500 font-black text-xs outline-none focus:border-yellow-500" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase pr-2">نوع البند</label>
                    <div className="grid grid-cols-3 gap-2">
                       {['frame', 'bubble', 'entry'].map(type => (
                         <button 
                           key={type} 
                           onClick={() => setEditingStoreItem({...editingStoreItem, type: type as any})}
                           className={`py-3 rounded-xl text-[10px] font-black border transition-all ${editingStoreItem.type === type ? 'bg-cyan-600 border-cyan-500 text-white shadow-lg' : 'bg-black/40 border-white/5 text-slate-500'}`}
                         >
                           {type === 'frame' ? 'إطار' : type === 'bubble' ? 'فقاعة' : 'دخولية'}
                         </button>
                       ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 pr-2">رابط المحتوى المباشر (اختياري)</label>
                    <input type="text" value={editingStoreItem.url} onChange={e => setEditingStoreItem({...editingStoreItem, url: e.target.value})} placeholder="أو الصق الرابط هنا..." className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-blue-400 font-bold text-[10px] outline-none" dir="ltr" />
                  </div>
                </div>

                <button 
                  onClick={handleFinalSave} 
                  className="w-full py-5 bg-gradient-to-r from-cyan-600 to-indigo-700 text-white font-black rounded-3xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Wand2 size={20} /> حفظ ونشر في المتجر
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminStore;