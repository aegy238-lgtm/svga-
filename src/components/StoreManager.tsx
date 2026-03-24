import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, Timestamp } from 'firebase/firestore';
import { StoreProduct, PRODUCT_CATEGORIES } from '../types';
import { Trash2, Edit, Plus, Save, X } from 'lucide-react';

export const StoreManager: React.FC = () => {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingProduct, setEditingProduct] = useState<StoreProduct | null>(null);
  const [formData, setFormData] = useState<Partial<StoreProduct>>({});

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      setProducts(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as StoreProduct)));
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), {
          ...formData,
          updatedAt: Timestamp.now()
        });
      } else {
        await addDoc(collection(db, 'products'), {
          ...formData,
          createdAt: Timestamp.now()
        });
      }
      setEditingProduct(null);
      setFormData({});
      fetchProducts();
    } catch (error) {
      console.error("Error saving product:", error);
      alert("فشل حفظ المنتج");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا المنتج؟')) return;
    try {
      await deleteDoc(doc(db, 'products', id));
      fetchProducts();
    } catch (error) {
      console.error("Error deleting product:", error);
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold">إدارة المنتجات</h3>
      
      <form onSubmit={handleSave} className="bg-slate-950/50 border border-white/10 rounded-xl p-6 space-y-4">
        <h4 className="font-bold">{editingProduct ? 'تعديل منتج' : 'إضافة منتج جديد'}</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input type="text" placeholder="اسم المنتج" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="bg-slate-900 border border-white/10 rounded-lg px-4 py-2" required />
          <input type="number" placeholder="السعر ($)" value={formData.price || ''} onChange={e => setFormData({...formData, price: Number(e.target.value)})} className="bg-slate-900 border border-white/10 rounded-lg px-4 py-2" required />
          <input type="text" placeholder="رابط الصورة" value={formData.imageUrl || ''} onChange={e => setFormData({...formData, imageUrl: e.target.value})} className="bg-slate-900 border border-white/10 rounded-lg px-4 py-2" />
          <select value={formData.category || ''} onChange={e => setFormData({...formData, category: e.target.value})} className="bg-slate-900 border border-white/10 rounded-lg px-4 py-2" required>
              <option value="">اختر التصنيف</option>
              {PRODUCT_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
          <input type="text" placeholder="رابط الفيديو" value={formData.videoUrl || ''} onChange={e => setFormData({...formData, videoUrl: e.target.value})} className="bg-slate-900 border border-white/10 rounded-lg px-4 py-2" />
          <input type="text" placeholder="الصيغة (مثال: صورة, فيديو)" value={formData.supportedFormats?.join(', ') || ''} onChange={e => setFormData({...formData, supportedFormats: e.target.value.split(',').map(s => s.trim())})} className="bg-slate-900 border border-white/10 rounded-lg px-4 py-2" />
        </div>
        <textarea placeholder="وصف المنتج" value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-2" rows={3} />
        <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-indigo-600 rounded-lg flex items-center gap-2">
                <Save className="w-4 h-4" /> {editingProduct ? 'حفظ التعديلات' : 'إضافة المنتج'}
            </button>
            {editingProduct && <button type="button" onClick={() => {setEditingProduct(null); setFormData({})}} className="px-4 py-2 bg-slate-700 rounded-lg"><X className="w-4 h-4" /></button>}
        </div>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map(product => (
          <div key={product.id} className="bg-slate-950/50 border border-white/10 rounded-lg p-4 flex flex-col gap-2">
            <img src={product.imageUrl} alt={product.name} className="w-full h-32 object-cover rounded-lg" />
            <h5 className="font-bold">{product.name}</h5>
            <p className="text-sm text-slate-400">{product.price} $ - {product.category}</p>
            <div className="flex gap-2 mt-auto">
              <button onClick={() => {setEditingProduct(product); setFormData(product)}} className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg"><Edit className="w-4 h-4" /></button>
              <button onClick={() => handleDelete(product.id)} className="p-2 bg-red-500/20 text-red-400 rounded-lg"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
