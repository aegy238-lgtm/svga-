import React from 'react';
import { FileMetadata, AppSettings, UserRecord } from '../types';
import { SVGAViewer } from './SVGAViewer';
import { motion } from 'motion/react';
import { X } from 'lucide-react';

interface WorkspaceProps {
  metadata: FileMetadata;
  onCancel: () => void;
  settings: AppSettings | null;
  currentUser: UserRecord | null;
  onLoginRequired: () => void;
  onSubscriptionRequired: () => void;
  globalQuality: 'low' | 'medium' | 'high';
  onFileReplace: (files: File[]) => void;
  mode: 'editor' | 'viewer';
}

export const EditorWorkspace: React.FC<WorkspaceProps> = ({
  metadata,
  onCancel,
  settings,
  currentUser,
  onLoginRequired,
  onSubscriptionRequired,
  globalQuality,
  onFileReplace,
  mode
}) => {
  const fileInfo = {
    url: metadata.fileUrl || '',
    name: metadata.name
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-slate-950 flex flex-col"
      id="workspace-container"
    >
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-slate-900/50 backdrop-blur-xl" id="workspace-header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold border border-emerald-500/30">
            {mode === 'editor' ? 'EX' : 'VW'}
          </div>
          <div>
            <h2 className="text-white font-semibold leading-tight">{metadata.name}</h2>
            <p className="text-slate-400 text-xs">
              {(metadata.size / 1024 / 1024).toFixed(2)} MB • {mode === 'editor' ? 'SVGA 2.0 EX Editor' : 'SVGA Viewer'}
            </p>
          </div>
        </div>
        
        <button 
          onClick={onCancel}
          className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          id="close-workspace-btn"
        >
          <X size={24} />
        </button>
      </div>

      <div className="flex-1 overflow-hidden relative" id="workspace-content">
        <SVGAViewer 
          file={fileInfo} 
          onClear={onCancel} 
          originalFile={metadata.originalFile}
        />
      </div>
    </motion.div>
  );
};
