import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Music, Clock, Save } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface AudioDurationModalProps {
  isOpen: boolean;
  onClose: () => void;
  audioFile: File | null;
  svgaDuration: number; // in seconds
  onSave: (startTime: number, duration: number) => void;
}

export function AudioDurationModal({ isOpen, onClose, audioFile, svgaDuration, onSave }: AudioDurationModalProps) {
  const { t, dir } = useLanguage();
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [startTime, setStartTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(svgaDuration);

  useEffect(() => {
    if (audioFile) {
      const url = URL.createObjectURL(audioFile);
      const audio = new Audio(url);
      audio.onloadedmetadata = () => {
        setAudioDuration(audio.duration);
        setDuration(Math.min(svgaDuration, audio.duration));
        URL.revokeObjectURL(url);
      };
    }
  }, [audioFile, svgaDuration]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(startTime, duration);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" dir={dir}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-md bg-[#1a1b1e] rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
        >
          <div className="flex items-center justify-between p-6 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center border border-red-500/30">
                <Music className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">{t('audioDurationSettings') || 'إعدادات مدة الصوت'}</h2>
                <p className="text-xs text-white/50">{audioFile?.name}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-white/5 text-white/50 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-medium text-white/70">{t('svgaDuration') || 'مدة ملف SVGA'}</span>
                </div>
                <div className="text-2xl font-black text-white">{svgaDuration.toFixed(2)} <span className="text-sm font-normal text-white/50">s</span></div>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <Music className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-medium text-white/70">{t('audioDuration') || 'مدة الصوت الأصلي'}</span>
                </div>
                <div className="text-2xl font-black text-white">{audioDuration.toFixed(2)} <span className="text-sm font-normal text-white/50">s</span></div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-white/70 mb-2">
                  {t('audioStartTime') || 'وقت بدء الصوت (بالثواني)'}
                </label>
                <input
                  type="number"
                  min="0"
                  max={Math.max(0, audioDuration - duration)}
                  step="0.1"
                  value={startTime}
                  onChange={(e) => setStartTime(Number(e.target.value))}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500/50 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-red-400 mb-2">
                  {t('targetAudioDuration') || 'المدة المطلوبة للصوت (بالثواني)'}
                </label>
                <input
                  type="number"
                  min="0.1"
                  max={audioDuration}
                  step="0.1"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 transition-colors"
                />
                <p className="text-[10px] text-white/40 mt-2">
                  {t('durationMatchHint') || 'يُفضل أن تكون مطابقة لمدة ملف SVGA الأصلي'}
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-white/5 bg-black/20">
            <button
              onClick={handleSave}
              className="w-full flex items-center justify-center gap-2 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition-colors"
            >
              <Save className="w-5 h-5" />
              {t('saveAudioSettings') || 'حفظ إعدادات الصوت'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
