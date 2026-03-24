import React, { useState, useCallback } from 'react';
import { Upload, Sparkles } from 'lucide-react';
import { SVGAViewer } from './components/SVGAViewer';
import { SVGAFileInfo } from './types';

export default function App() {
  const [fileInfo, setFileInfo] = useState<SVGAFileInfo | null>(null);
  const [originalFile, setOriginalFile] = useState<File | undefined>(undefined);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setFileInfo({ name: file.name, url });
      setOriginalFile(file);
    }
  }, []);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.svga')) {
      const url = URL.createObjectURL(file);
      setFileInfo({ name: file.name, url });
      setOriginalFile(file);
    } else if (file) {
      alert('Please select an SVGA file');
    }
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  const handleDragEnter = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  }, []);

  const handleClear = useCallback(() => {
    if (fileInfo?.url) {
      URL.revokeObjectURL(fileInfo.url);
    }
    setFileInfo(null);
    setOriginalFile(undefined);
  }, [fileInfo]);

  if (fileInfo) {
    return <SVGAViewer file={fileInfo} onClear={handleClear} originalFile={originalFile} />;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e5e5e5] font-sans selection:bg-blue-500/30 flex flex-col" dir="ltr">
      {/* Header */}
      <header className="border-b border-[#262626] bg-[#0a0a0a] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 2L2 22h20L12 2z"/></svg>
            </div>
            <span className="font-bold text-white text-sm">MotionTools</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-xs font-medium text-[#a3a3a3]">Pro Version</div>
            <div className="w-7 h-7 bg-white rounded-full flex items-center justify-center text-black font-bold text-xs">
              A
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6 relative overflow-hidden bg-[#0a0a0a]">
        {/* Background Particles/Network Effect (Simplified) */}
        <div className="absolute inset-0 opacity-30 pointer-events-none">
          <div className="absolute top-[15%] left-[10%] w-1 h-1 bg-purple-500 rounded-full shadow-[0_0_15px_#a855f7]"></div>
          <div className="absolute top-[25%] left-[85%] w-1 h-1 bg-blue-500 rounded-full shadow-[0_0_15px_#3b82f6]"></div>
          <div className="absolute top-[65%] left-[15%] w-1 h-1 bg-purple-400 rounded-full shadow-[0_0_15px_#c084fc]"></div>
          <div className="absolute top-[80%] left-[75%] w-1 h-1 bg-blue-400 rounded-full shadow-[0_0_15px_#60a5fa]"></div>
          <div className="absolute top-[40%] left-[30%] w-0.5 h-0.5 bg-white/20 rounded-full"></div>
          <div className="absolute top-[70%] left-[60%] w-0.5 h-0.5 bg-white/20 rounded-full"></div>
          <div className="absolute top-1/2 left-1/2 w-[800px] h-[800px] bg-purple-900/5 rounded-full blur-[150px] -translate-x-1/2 -translate-y-1/2"></div>
        </div>
        
        <div className="max-w-3xl w-full flex flex-col items-center text-center relative z-10">
          
          {/* Format Tags */}
          <div className="flex flex-wrap justify-center gap-2 mb-10">
            {['PAG', 'SVGA', 'Lottie', 'VAP', 'GIF', 'WebP', 'MP4'].map(tag => (
              <span key={tag} className="px-2 py-0.5 bg-[#1a1a1a] border border-[#333] rounded text-[10px] font-bold text-white uppercase tracking-wider">
                {tag}
              </span>
            ))}
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold mb-8 text-white tracking-tight leading-tight">
            Start Processing Your <br /> Animation
          </h1>
          
          <p className="text-lg md:text-xl text-[#a3a3a3] mb-16 max-w-xl">
            Upload a file to preview, compress, convert and more
          </p>

          {/* Upload Area (Jimi 9 Style) */}
          <div 
            className={`relative cursor-pointer transition-all duration-500 group
              ${isDragging ? 'scale-110' : 'hover:scale-105 active:scale-95'}
            `}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            <div className="w-36 h-36 rounded-full border-2 border-[#262626] flex items-center justify-center relative bg-[#0a0a0a] group-hover:border-purple-500/50 transition-all duration-500 shadow-2xl">
              <div className="absolute inset-0 rounded-full bg-purple-500/5 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative text-[#a3a3a3] group-hover:text-white transition-all duration-500">
                <div className="flex flex-col items-center">
                  <div className="w-14 h-14 rounded-full border-2 border-current flex items-center justify-center mb-1 transition-transform duration-500 group-hover:-translate-y-1">
                    <Upload size={28} />
                  </div>
                  <div className="w-5 h-1 bg-current rounded-full mt-[-4px] transition-all duration-500 group-hover:w-6"></div>
                </div>
              </div>
            </div>
            <input 
              id="file-upload"
              type="file" 
              accept=".svga" 
              className="hidden" 
              onChange={handleFileUpload} 
            />
          </div>

        </div>

        {/* Support Icon */}
        <div className="absolute bottom-8 right-8">
          <div className="w-14 h-14 bg-[#5b45ff] rounded-2xl flex items-center justify-center shadow-2xl cursor-pointer hover:scale-110 active:scale-90 transition-all duration-300">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
            </svg>
          </div>
        </div>
      </main>
    </div>
  );
}
