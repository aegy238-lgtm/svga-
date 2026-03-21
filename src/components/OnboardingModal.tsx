import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, Globe, Zap, Image, Video, Layers, ShoppingBag, Upload } from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const features = [
  {
    icon: <Upload className="w-12 h-12 text-blue-500" />,
    titleAr: "رفع الملفات بسهولة",
    titleEn: "Easy File Upload",
    descAr: "قم برفع ملفاتك بسرعة وسهولة لبدء المعالجة. ندعم مختلف الصيغ والأحجام.",
    descEn: "Upload your files quickly and easily to start processing. We support various formats and sizes."
  },
  {
    icon: <Zap className="w-12 h-12 text-yellow-500" />,
    titleAr: "ضغط الملفات المجمع",
    titleEn: "Batch Compressor",
    descAr: "قم بضغط مجموعة من الصور والفيديوهات دفعة واحدة مع الحفاظ على الجودة.",
    descEn: "Compress a batch of images and videos at once while maintaining quality."
  },
  {
    icon: <Video className="w-12 h-12 text-purple-500" />,
    titleAr: "محول الفيديو",
    titleEn: "Video Converter",
    descAr: "حول فيديوهاتك إلى صيغ مختلفة مثل MP4, WEBM, GIF وغيرها بكل سهولة.",
    descEn: "Convert your videos to different formats like MP4, WEBM, GIF and more with ease."
  },
  {
    icon: <Layers className="w-12 h-12 text-green-500" />,
    titleAr: "تحويل الصور إلى SVGA",
    titleEn: "Image to SVGA",
    descAr: "حول صورك الثابتة إلى رسوم متحركة بصيغة SVGA لاستخدامها في تطبيقاتك.",
    descEn: "Convert your static images into SVGA animations for use in your applications."
  },
  {
    icon: <Image className="w-12 h-12 text-pink-500" />,
    titleAr: "محرر الصور",
    titleEn: "Image Editor",
    descAr: "عدل صورك، أضف فلاتر، وقص الصور باستخدام أدوات تحرير متقدمة.",
    descEn: "Edit your images, add filters, and crop using advanced editing tools."
  },
  {
    icon: <ShoppingBag className="w-12 h-12 text-orange-500" />,
    titleAr: "المتجر",
    titleEn: "Store",
    descAr: "تصفح واشترِ قوالب وأصول جاهزة لتحسين مشاريعك.",
    descEn: "Browse and buy ready-made templates and assets to enhance your projects."
  }
];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [lang, setLang] = useState<'ar' | 'en'>('ar');

  if (!isOpen) return null;

  const nextStep = () => {
    if (currentStep < features.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="bg-[#0f172a] border border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl relative"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-900/50">
            <button 
              onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition-colors"
            >
              <Globe className="w-4 h-4" />
              <span>{lang === 'ar' ? 'English' : 'العربية'}</span>
            </button>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-8 min-h-[400px] flex flex-col items-center justify-center text-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center gap-6 max-w-lg"
              >
                <div className="p-6 bg-slate-800/50 rounded-full mb-4 ring-1 ring-slate-700 shadow-lg shadow-blue-500/10">
                  {features[currentStep].icon}
                </div>
                
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
                  {lang === 'ar' ? features[currentStep].titleAr : features[currentStep].titleEn}
                </h2>
                
                <p className="text-slate-400 text-lg leading-relaxed">
                  {lang === 'ar' ? features[currentStep].descAr : features[currentStep].descEn}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer / Navigation */}
          <div className="p-6 border-t border-slate-700 bg-slate-900/50 flex items-center justify-between">
            <div className="flex gap-2">
              {features.map((_, idx) => (
                <div 
                  key={idx}
                  className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                    idx === currentStep ? 'bg-blue-500 w-8' : 'bg-slate-600'
                  }`}
                />
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={prevStep}
                disabled={currentStep === 0}
                className={`p-3 rounded-xl flex items-center justify-center transition-all ${
                  currentStep === 0 
                    ? 'text-slate-600 cursor-not-allowed' 
                    : 'bg-slate-800 text-white hover:bg-slate-700'
                }`}
              >
                {lang === 'ar' ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
              </button>
              
              <button
                onClick={nextStep}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium flex items-center gap-2 transition-all shadow-lg shadow-blue-600/20"
              >
                <span>
                  {currentStep === features.length - 1 
                    ? (lang === 'ar' ? 'ابدأ الآن' : 'Get Started') 
                    : (lang === 'ar' ? 'التالي' : 'Next')}
                </span>
                {currentStep !== features.length - 1 && (
                  lang === 'ar' ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
