import React from 'react';
import { UserRecord } from '../types';

interface StoreProps {
  currentUser: UserRecord | null;
  onLoginRequired: () => void;
}

export const Store: React.FC<StoreProps> = ({ currentUser, onLoginRequired }) => {
  return (
    <div className="w-full h-full flex flex-col text-white">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-black tracking-tight mb-2">المتجر</h2>
          <p className="text-slate-400">تصفح أحدث القوالب والإضافات</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Placeholder Items */}
        {[1, 2, 3].map((item) => (
          <div key={item} className="bg-slate-900/50 border border-white/10 rounded-2xl overflow-hidden group hover:border-indigo-500/30 transition-all duration-300">
            <div className="aspect-video bg-slate-800 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
            <div className="p-5">
              <h3 className="font-bold text-lg mb-1">قالب مميز {item}</h3>
              <p className="text-slate-400 text-sm mb-4">وصف مختصر للمنتج ومميزاته...</p>
              <div className="flex items-center justify-between">
                <span className="text-indigo-400 font-bold">$19.99</span>
                <button 
                  onClick={() => !currentUser ? onLoginRequired() : console.log('Buy')}
                  className="px-4 py-2 bg-white/5 hover:bg-indigo-500 hover:text-white text-slate-300 rounded-lg text-sm font-medium transition-all"
                >
                  شراء الآن
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
