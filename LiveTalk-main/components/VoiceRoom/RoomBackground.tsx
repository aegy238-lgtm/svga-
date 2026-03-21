import React from 'react';

interface RoomBackgroundProps {
  background: string;
}

const RoomBackground: React.FC<RoomBackgroundProps> = ({ background }) => {
  const isImage = background?.includes('http') || background?.includes('data:image');

  return (
    <div className="absolute inset-0 z-0">
      {isImage ? (
        <img 
          src={background} 
          className="w-full h-full object-cover" 
          alt="Room Background" 
        />
      ) : (
        <div className="w-full h-full" style={{ background: background || '#020617' }}></div>
      )}
      
      {/* تم إزالة طبقات التعتيم (bg-black/40) والبلور (backdrop-blur) بناءً على طلبك 
          لضمان ظهور الخلفية بأعلى درجة من النقاء والوضوح والجودة الأصلية */}
    </div>
  );
};

export default RoomBackground;