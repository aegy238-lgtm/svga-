import React from 'react';
import { StoreProduct } from '../types';
import { X, Play, MessageCircle } from 'lucide-react';

interface ProductModalProps {
  product: StoreProduct;
  whatsappNumber: string;
  onClose: () => void;
}

export const ProductModal: React.FC<ProductModalProps> = ({ product, whatsappNumber, onClose }) => {
  const handleBuy = () => {
    const message = `أريد شراء المنتج: ${product.name} - السعر: ${product.price}$`;
    window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-white/10">
          <h3 className="text-xl font-bold">{product.name}</h3>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-6">
          {product.videoUrl && (
            <div className="bg-black rounded-lg overflow-hidden flex items-center justify-center" style={{ maxHeight: '400px' }}>
              {(product.videoUrl.includes('youtube.com') || product.videoUrl.includes('youtu.be')) ? (
                <iframe 
                  src={product.videoUrl.replace('watch?v=', 'embed/')} 
                  className="w-full aspect-video"
                  title={product.name}
                  allowFullScreen
                />
              ) : (
                <video 
                  controls 
                  className="max-h-[400px] w-auto"
                  preload="metadata"
                  src={product.videoUrl}
                >
                  متصفحك لا يدعم تشغيل الفيديو.
                </video>
              )}
            </div>
          )}
          <p className="text-slate-300">{product.description}</p>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-indigo-400">${product.price}</span>
            <button 
              onClick={handleBuy}
              className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold flex items-center gap-2 transition-all"
            >
              <MessageCircle className="w-5 h-5" /> شراء عبر واتساب
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
