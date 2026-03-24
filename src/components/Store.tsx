import React, { useState, useEffect } from 'react';
import { UserRecord, StoreProduct, PRODUCT_CATEGORIES, AppSettings } from '../types';
import { db } from '../lib/firebase';
import { collection, getDocs, query, orderBy, getDoc, doc } from 'firebase/firestore';
import { ProductModal } from './ProductModal';

interface StoreProps {
  currentUser: UserRecord | null;
  onLoginRequired: () => void;
}

export const Store: React.FC<StoreProps> = ({ currentUser, onLoginRequired }) => {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>(PRODUCT_CATEGORIES[0]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [productsSnap, settingsSnap] = await Promise.all([
          getDocs(query(collection(db, 'products'), orderBy('createdAt', 'desc'))),
          getDoc(doc(db, 'settings', 'global'))
        ]);
        setProducts(productsSnap.docs.map(d => ({ id: d.id, ...d.data() } as StoreProduct)));
        if (settingsSnap.exists()) setSettings(settingsSnap.data() as AppSettings);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredProducts = activeCategory === 'القسم الرئيسي' 
    ? products 
    : products.filter(p => p.category === activeCategory);

  return (
    <div className="w-full h-full flex flex-col text-white">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-black tracking-tight mb-2">المتجر</h2>
          <p className="text-slate-400">تصفح أحدث القوالب والإضافات</p>
        </div>
      </div>
      
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
        {PRODUCT_CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeCategory === cat ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center p-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <div key={product.id} className="bg-slate-900/50 border border-white/10 rounded-2xl overflow-hidden group hover:border-indigo-500/30 transition-all duration-300">
              <div className="aspect-video bg-slate-800 relative overflow-hidden cursor-pointer" onClick={() => setSelectedProduct(product)}>
                <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <span className="text-white font-bold">معاينة</span>
                </div>
              </div>
              <div className="p-5">
                <h3 className="font-bold text-lg mb-1">{product.name}</h3>
                <p className="text-slate-400 text-sm mb-4">{product.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-indigo-400 font-bold">${product.price}</span>
                  <button 
                    onClick={() => setSelectedProduct(product)}
                    className="px-4 py-2 bg-white/5 hover:bg-indigo-500 hover:text-white text-slate-300 rounded-lg text-sm font-medium transition-all"
                  >
                    تفاصيل وشراء
                  </button>
                </div>
              </div>
            </div>
          ))}
          {filteredProducts.length === 0 && (
            <div className="col-span-full text-center py-20 text-slate-500">لا توجد منتجات في هذا التصنيف</div>
          )}
        </div>
      )}

      {selectedProduct && (
        <ProductModal 
          product={selectedProduct} 
          whatsappNumber={settings?.whatsappNumber || ''} 
          onClose={() => setSelectedProduct(null)} 
        />
      )}
    </div>
  );
};
