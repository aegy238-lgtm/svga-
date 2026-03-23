import React, { useEffect, useRef } from 'react';
import { Player, Parser } from 'svga.lite';

interface SVGAPlayerProps {
  data: any;
  className?: string;
}

const SVGAPlayer: React.FC<SVGAPlayerProps> = ({ data, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);

  useEffect(() => {
    if (!containerRef.current || !data) return;

    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    containerRef.current.appendChild(canvas);

    const parser = new Parser();
    const player = new Player(canvas);
    playerRef.current = player;

    const init = async () => {
      try {
        // svga.lite Parser.do expects a URL or ArrayBuffer
        // Since we have the data as an object, we might need to stringify it or 
        // if it's already the parsed structure, we might need a different approach.
        // Actually, SVGA 2.0 data is usually a binary format, but AE export might be JSON.
        // Let's assume the data needs to be parsed if it's JSON.
        
        const svgaData = await parser.do(data);
        await player.mount(svgaData);
        player.start();
      } catch (error) {
        console.error('Failed to load SVGA:', error);
      }
    };

    init();

    return () => {
      player.destroy();
      if (containerRef.current && canvas.parentNode === containerRef.current) {
        containerRef.current.removeChild(canvas);
      }
    };
  }, [data]);

  return <div ref={containerRef} className={className} id="svga-container" />;
};

export default SVGAPlayer;
