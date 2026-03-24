import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserRecord, AppSettings } from '../types';
import { LogOut, Settings, ShoppingBag, Image, Video, Layers, Wand2, BadgeCheck, Maximize, Lock, Scissors, Menu, X as CloseIcon } from 'lucide-react';

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
  onCropperOpen: () => void;
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
  onCropperOpen,
  onSvgaExOpen,
  onLoginClick,
  onProfileClick,
  currentTab
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'svga', label: 'SVGA Editor', icon: <Layers className="w-4 h-4" />, onClick: onLogoClick },
    { 
      id: 'svga-ex', 
      label: 'SVGA Editor EX', 
      icon: <Layers className="w-4 h-4" />, 
      onClick: () => {
        if (!currentUser?.hasSvgaExAccess && !isAdmin) {
          alert("عذراً، هذه الميزة مغلقة لحسابك. يرجى التواصل مع الإدارة لتفعيلها.");
          return;
        }
        onSvgaExOpen();
      },
      variant: 'red' as const,
      locked: !currentUser?.hasSvgaExAccess && !isAdmin,
      show: settings?.isSvgaExEnabled || currentUser?.hasSvgaExAccess || isAdmin
    },
    { id: 'converter', label: 'Video Converter', icon: <Video className="w-4 h-4" />, onClick: onConverterOpen },
    { id: 'image-converter', label: 'Image to SVGA', icon: <Image className="w-4 h-4" />, onClick: onImageConverterOpen },
    { id: 'batch', label: 'Batch Compress', icon: <Layers className="w-4 h-4" />, onClick: onBatchOpen },
    { id: 'image-editor', label: 'Image Editor', icon: <Wand2 className="w-4 h-4" />, onClick: onImageEditorOpen },
    { id: 'image-matcher', label: 'Image Matcher', icon: <Maximize className="w-4 h-4" />, onClick: onImageMatcherOpen },
    { id: 'cropper', label: 'Batch Cropper', icon: <Scissors className="w-4 h-4" />, onClick: onCropperOpen },
    { id: 'store', label: 'Store', icon: <ShoppingBag className="w-4 h-4" />, onClick: onStoreOpen },
  ];

  return (
    <>
      <header className="fixed top-0 left-0 right-0 h-20 bg-[#020617]/80 backdrop-blur-md border-b border-white/5 z-[1000] px-4 sm:px-6 flex items-center justify-between">
      {/* Left Side: Profile & New Tools Button (Mobile) or Logo (Desktop) */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Mobile Profile & Tools Button */}
        <div className="flex md:hidden items-center gap-2">
          {currentUser && (
            <>
              <button 
                onClick={onProfileClick}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
              >
                <div className="w-9 h-9 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-500/30 shadow-lg shadow-indigo-500/10">
                  <span className="text-sm font-black text-indigo-400">{currentUser.name.charAt(0).toUpperCase()}</span>
                </div>
              </button>
              
              {/* The Professional Tools Button requested by user */}
              <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="flex items-center gap-2 px-3 py-2 bg-gradient-to-br from-indigo-600/20 to-purple-600/20 hover:from-indigo-600/30 hover:to-purple-600/30 text-indigo-400 rounded-xl border border-indigo-500/30 transition-all active:scale-90 shadow-lg shadow-indigo-500/5 group"
              >
                <Wand2 className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                <span className="text-[10px] font-black uppercase tracking-widest hidden xs:block">الأدوات</span>
              </button>
            </>
          )}
        </div>
        
        {/* Desktop Logo */}
        <button onClick={onLogoClick} className="hidden md:flex items-center gap-3 group">
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
      </div>

      {/* Center: Mobile Logo or Desktop Navigation */}
      <div className="flex-1 flex justify-center md:justify-start md:ml-8">
        {/* Mobile Logo (Site Name) */}
        <button onClick={onLogoClick} className="md:hidden flex flex-col items-center group">
          <h1 className="text-sm font-black text-white tracking-tight truncate max-w-[150px]">
            {settings?.appName || 'Ahmed Designer'}
          </h1>
          <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">Professional Tools</span>
        </button>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.filter(item => item.show !== false).map(item => (
            <NavButton 
              key={item.id}
              active={currentTab === item.id} 
              onClick={item.onClick} 
              icon={item.icon}
              label={item.label}
              variant={item.variant}
              locked={item.locked}
            />
          ))}
        </nav>
      </div>

      {/* Right Side: User Actions & Mobile Logout */}
      <div className="flex items-center gap-1 sm:gap-3">
        {currentUser ? (
          <>
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
            
            <div className="flex items-center gap-1 sm:gap-3 pl-1 sm:pl-3 md:border-l border-white/10">
              {/* Desktop Profile Icon */}
              <button 
                onClick={onProfileClick}
                className="hidden md:flex p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              >
                <div className="w-8 h-8 bg-indigo-500/20 rounded-full flex items-center justify-center border border-indigo-500/30">
                  <span className="text-xs font-bold text-indigo-400">{currentUser.name.charAt(0).toUpperCase()}</span>
                </div>
              </button>

              {/* Logout Button (Visible on Mobile & Desktop) */}
              <button
                onClick={onLogout}
                className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all active:scale-90"
                title="Logout"
              >
                <LogOut className="w-6 h-6 md:w-5 md:h-5" />
              </button>
            </div>
          </>
        ) : (
          <button
            onClick={onLoginClick}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black rounded-xl shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
          >
            تسجيل الدخول
          </button>
        )}
      </div>
    </header>

    {/* Mobile Menu Overlay - Outside header to avoid z-index nesting issues */}
    <AnimatePresence>
      {isMobileMenuOpen && (
        <>
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[9998] md:hidden"
          />
          
          {/* Menu Content */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed inset-0 bg-[#020617] z-[9999] md:hidden overflow-y-auto flex flex-col"
          >
            {/* Close Button Top Right */}
            <div className="absolute top-6 right-6 z-[10000]">
              <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-3 text-white bg-white/10 hover:bg-white/20 rounded-full shadow-xl transition-all active:scale-90"
              >
                <CloseIcon className="w-8 h-8" />
              </button>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-6 pt-20">
              <div className="w-full max-w-md space-y-8">
                <div className="text-center space-y-2 mb-4">
                  <div className="inline-flex w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl items-center justify-center shadow-2xl shadow-indigo-500/40 mb-4">
                    <span className="text-white font-black text-3xl">S</span>
                  </div>
                  <h2 className="text-white text-3xl font-black tracking-tight">قائمة الأدوات</h2>
                  <p className="text-slate-500 text-sm font-bold uppercase tracking-[0.2em]">اختر الأداة التي تريد استخدامها</p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {/* Home / Reset */}
                  <button
                    onClick={() => {
                      onLogoClick();
                      setIsMobileMenuOpen(false);
                    }}
                    className={`flex items-center gap-5 p-6 rounded-[2rem] text-xl font-black transition-all active:scale-95 shadow-xl ${
                      currentTab === 'svga' 
                        ? 'bg-indigo-600 text-white shadow-indigo-600/30'
                        : 'bg-white/5 text-slate-300 border border-white/10'
                    }`}
                  >
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${currentTab === 'svga' ? 'bg-white/20' : 'bg-white/5'}`}>
                      <Layers className="w-7 h-7" />
                    </div>
                    <div className="flex-1 text-right">
                      <span>الرئيسية / المحرر</span>
                    </div>
                  </button>

                  {/* All other nav items */}
                  {navItems.filter(item => item.id !== 'svga' && item.show !== false).map(item => (
                    <button
                      key={item.id}
                      onClick={() => {
                        item.onClick();
                        setIsMobileMenuOpen(false);
                      }}
                      className={`flex items-center gap-5 p-6 rounded-[2rem] text-xl font-black transition-all active:scale-95 shadow-xl ${
                        currentTab === item.id 
                          ? item.variant === 'red'
                            ? 'bg-[#ff0000] text-black shadow-red-500/30'
                            : 'bg-indigo-600 text-white shadow-indigo-600/30'
                          : 'bg-white/5 text-slate-300 border border-white/10'
                      }`}
                    >
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${currentTab === item.id ? 'bg-white/20' : 'bg-white/5'}`}>
                        {React.cloneElement(item.icon as React.ReactElement, { className: 'w-7 h-7' })}
                      </div>
                      <div className="flex-1 text-right">
                        <span>{item.label}</span>
                        {item.locked && <p className="text-[10px] text-amber-500 font-black mt-1">ميزة مقفولة</p>}
                      </div>
                      {item.locked && <Lock className="w-6 h-6 text-amber-500" />}
                    </button>
                  ))}

                  {/* Admin Panel Button for Admins */}
                  {isAdmin && (
                    <button
                      onClick={() => {
                        onAdminToggle();
                        setIsMobileMenuOpen(false);
                      }}
                      className={`flex items-center gap-5 p-6 rounded-[2rem] text-xl font-black transition-all active:scale-95 shadow-xl ${
                        isAdminOpen 
                          ? 'bg-amber-500 text-white shadow-amber-500/30'
                          : 'bg-white/5 text-slate-300 border border-white/10'
                      }`}
                    >
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isAdminOpen ? 'bg-white/20' : 'bg-white/5'}`}>
                        <Settings className="w-7 h-7" />
                      </div>
                      <div className="flex-1 text-right">
                        <span>لوحة التحكم</span>
                      </div>
                      <BadgeCheck className="w-6 h-6 text-amber-500" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="p-10 bg-white/5 border-t border-white/10 flex justify-center mt-auto">
              <div className="w-full max-w-md space-y-6">
                {currentUser ? (
                  <div className="space-y-4">
                    <button
                      onClick={() => {
                        onProfileClick();
                        setIsMobileMenuOpen(false);
                      }}
                      className="flex items-center gap-5 p-6 w-full bg-white/5 rounded-[2rem] border border-white/10 hover:bg-white/10 transition-colors"
                    >
                      <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center border border-indigo-500/30">
                        <span className="text-2xl font-black text-indigo-400">{currentUser.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="flex-1 text-right">
                        <p className="font-black text-white text-xl">{currentUser.name}</p>
                        <p className="text-sm text-slate-500 font-bold">{currentUser.email}</p>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        onLogout();
                        setIsMobileMenuOpen(false);
                      }}
                      className="flex items-center justify-center gap-3 p-6 w-full bg-red-500/10 text-red-400 rounded-[2rem] border border-red-500/20 font-black text-xl hover:bg-red-500/20 transition-colors"
                    >
                      <LogOut className="w-7 h-7" />
                      <span>تسجيل الخروج</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      onLoginClick();
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full py-6 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-[2rem] shadow-2xl shadow-indigo-600/40 text-xl transition-all active:scale-95"
                  >
                    تسجيل الدخول
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  </>
);
};

interface NavButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  variant?: 'default' | 'red';
  locked?: boolean;
}

const NavButton: React.FC<NavButtonProps> = ({ active, onClick, icon, label, variant = 'default', locked = false }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 relative ${
      active 
        ? variant === 'red' 
          ? 'bg-[#ff0000] text-black shadow-glow-red'
          : 'bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/20' 
        : variant === 'red'
          ? 'bg-[#ff0000] text-black hover:bg-red-600'
          : 'text-slate-400 hover:text-white hover:bg-white/5'
    }`}
  >
    {icon}
    <span className={variant === 'red' ? 'text-black font-black' : ''}>{label}</span>
    {locked && (
        <div className="absolute -top-1 -right-1 bg-slate-900 rounded-full p-0.5 border border-white/10">
            <Lock className="w-2.5 h-2.5 text-amber-500" />
        </div>
    )}
  </button>
);
