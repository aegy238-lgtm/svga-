import React from 'react';
import { UserRecord, AppSettings } from '../types';
import { LogOut, Settings, ShoppingBag, Image, Video, Layers, Wand2, BadgeCheck, Maximize } from 'lucide-react';

interface HeaderProps {
  onLogoClick: () => void;
  isAdmin: boolean;
  currentUser: UserRecord | null;
  settings: AppSettings | null;
  onAdminToggle: () => void;
  onLogout: () => void;
  isAdminOpen: boolean;
  onBatchOpen: () => void;
  onStoreOpen: () => void;
  onConverterOpen: () => void;
  onImageConverterOpen: () => void;
  onImageEditorOpen: () => void;
  onImageMatcherOpen: () => void;
  onSvgaExOpen: () => void;
  onLoginClick: () => void;
  onProfileClick: () => void;
  currentTab: string;
}

export const Header: React.FC<HeaderProps> = ({
  onLogoClick,
  isAdmin,
  currentUser,
  settings,
  onAdminToggle,
  onLogout,
  isAdminOpen,
  onBatchOpen,
  onStoreOpen,
  onConverterOpen,
  onImageConverterOpen,
  onImageEditorOpen,
  onImageMatcherOpen,
  onSvgaExOpen,
  onLoginClick,
  onProfileClick,
  currentTab
}) => {
  return (
    <header className="fixed top-0 left-0 right-0 h-20 bg-[#020617]/80 backdrop-blur-md border-b border-white/5 z-50 px-4 sm:px-6 flex items-center justify-between">
      <div className="flex items-center gap-8">
        {/* Logo */}
        <button onClick={onLogoClick} className="flex items-center gap-3 group">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-300">
            <span className="text-white font-black text-xl">S</span>
          </div>
          <div className="flex flex-col items-start">
            <h1 className="text-lg font-bold text-white tracking-tight group-hover:text-indigo-400 transition-colors">
              {settings?.appName || 'SVGA Studio'}
            </h1>
            <span className="text-[10px] text-slate-400 font-medium tracking-widest uppercase">Professional Tools</span>
          </div>
        </button>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          <NavButton 
            active={currentTab === 'svga'} 
            onClick={onLogoClick} 
            icon={<Layers className="w-4 h-4" />}
            label="SVGA Editor"
          />
          <NavButton 
            active={currentTab === 'svga-ex'} 
            onClick={onSvgaExOpen} 
            icon={<Layers className="w-4 h-4" />}
            label="SVGA Editor EX"
            variant="red"
          />
          <NavButton 
            active={currentTab === 'converter'} 
            onClick={onConverterOpen} 
            icon={<Video className="w-4 h-4" />}
            label="Video Converter"
          />
          <NavButton 
            active={currentTab === 'image-converter'} 
            onClick={onImageConverterOpen} 
            icon={<Image className="w-4 h-4" />}
            label="Image to SVGA"
          />
          <NavButton 
            active={currentTab === 'batch'} 
            onClick={onBatchOpen} 
            icon={<Layers className="w-4 h-4" />} // Reusing Layers for batch, could be different
            label="Batch Compress"
          />
           <NavButton 
            active={currentTab === 'image-editor'} 
            onClick={onImageEditorOpen} 
            icon={<Wand2 className="w-4 h-4" />}
            label="Image Editor"
          />
          <NavButton 
            active={currentTab === 'image-matcher'} 
            onClick={onImageMatcherOpen} 
            icon={<Maximize className="w-4 h-4" />}
            label="Image Matcher"
          />
          <NavButton 
            active={currentTab === 'store'} 
            onClick={onStoreOpen} 
            icon={<ShoppingBag className="w-4 h-4" />}
            label="Store"
          />
        </nav>
      </div>

      {/* User Actions */}
      <div className="flex items-center gap-4">
        {currentUser ? (
          <div className="flex items-center gap-3">
            {isAdmin && (
              <button
                onClick={onAdminToggle}
                className={`p-2 rounded-lg transition-colors ${
                  isAdminOpen ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
                title="Admin Panel"
              >
                <Settings className="w-5 h-5" />
              </button>
            )}
            
            <div className="flex items-center gap-3 pl-3 border-l border-white/10">
              <button 
                onClick={onProfileClick}
                className="text-right hidden sm:block hover:bg-white/5 p-2 rounded-lg transition-colors group"
              >
                <div className="flex items-center gap-1 justify-end">
                  <p className="text-sm font-medium text-white group-hover:text-indigo-400 transition-colors">{currentUser.name}</p>
                  {currentUser.isVIP && <BadgeCheck className="w-3 h-3 text-blue-500" />}
                </div>
                <p className="text-xs text-slate-400">{currentUser.email}</p>
              </button>
              <button
                onClick={onLogout}
                className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={onLoginClick}
            className="px-5 py-2 bg-white/5 hover:bg-white/10 text-white text-sm font-medium rounded-lg border border-white/10 transition-all hover:scale-105"
          >
            تسجيل الدخول
          </button>
        )}
      </div>
    </header>
  );
};

interface NavButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  variant?: 'default' | 'red';
}

const NavButton: React.FC<NavButtonProps> = ({ active, onClick, icon, label, variant = 'default' }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
      active 
        ? (variant === 'red' ? 'bg-red-500/10 text-red-400 ring-1 ring-red-500/20' : 'bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/20')
        : (variant === 'red' ? 'text-red-400/70 hover:text-red-400 hover:bg-red-500/5' : 'text-slate-400 hover:text-white hover:bg-white/5')
    }`}
  >
    {icon}
    <span>{label}</span>
  </button>
);
