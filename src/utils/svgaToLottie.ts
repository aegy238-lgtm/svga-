
interface LottieKeyframe {
  t: number;
  s: any[];
  i?: { x: number[]; y: number[] };
  o?: { x: number[]; y: number[] };
}

interface LottieLayer {
  ty: number;
  nm: string;
  refId?: string;
  ind: number;
  parent?: number;
  tt?: number; // Track matte type
  ks: {
    a: { a: 0; k: number[] };
    p: { a: number; k: any };
    s: { a: number; k: any };
    r: { a: number; k: any };
    o: { a: number; k: any };
  };
  ip: number;
  op: number;
  st: number;
  bm: number;
  sr: number;
  hd?: boolean; // Hidden
  tm?: any; // Time remapping
}

interface LottieAsset {
  id: string;
  w: number;
  h: number;
  u: string;
  p: string;
  e: number;
}

interface LottieJSON {
  v: string;
  w: number;
  h: number;
  fr: number;
  ip: number;
  op: number;
  assets: LottieAsset[];
  layers: LottieLayer[];
}

/**
 * Optimized keyframe helper to avoid redundant data while maintaining 'hold' behavior
 */
function addKeyframe(keyframes: LottieKeyframe[], time: number, value: any[]) {
  if (keyframes.length > 0) {
    const last = keyframes[keyframes.length - 1];
    const isSame = JSON.stringify(last.s) === JSON.stringify(value);
    
    if (isSame) return;

    // If there's a gap since the last keyframe, we need to add a "hold" keyframe
    // at the frame just before this one to maintain the previous value.
    if (time > last.t + 1) {
      keyframes.push({
        t: time - 1,
        s: last.s,
        i: { x: [0.833], y: [0.833] },
        o: { x: [0.167], y: [0.167] }
      });
    }
  }
  
  keyframes.push({
    t: time,
    s: value,
    i: { x: [0.833], y: [0.833] },
    o: { x: [0.167], y: [0.167] }
  });
}

/**
 * Decomposes a 2D matrix into translation, scale, and rotation.
 * Optimized for Lottie's transform order (Anchor -> Scale -> Rotation -> Position).
 */
/**
 * Decomposes a 2D matrix into translation, scale, and rotation.
 * Optimized for Lottie's transform order (Anchor -> Scale -> Rotation -> Position).
 * Using [0,0] anchor for SVGA compatibility.
 */
function decomposeMatrix(
  matrix: { a: number; b: number; c: number; d: number; tx: number; ty: number },
  assetSize: { w: number; h: number }
) {
  const { a, b, c, d, tx, ty } = matrix || { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
  
  // Calculate scaleX and scaleY
  const sx = Math.sqrt(a * a + b * b);
  const det = a * d - b * c;
  const sy = (sx !== 0) ? (det / sx) : 0;
  
  // Calculate rotation (in degrees)
  const rotation = Math.atan2(b, a) * (180 / Math.PI);

  // Using [0,0] anchor to match SVGA coordinate system
  const anchorX = 0;
  const anchorY = 0;
  
  // Position of the anchor point in movie space
  // ScreenPos = Matrix * [AnchorX, AnchorY, 1]
  const posX = tx;
  const posY = ty;

  return {
    x: posX,
    y: posY,
    scaleX: sx * 100,
    scaleY: sy * 100,
    rotation: rotation,
    anchorX,
    anchorY
  };
}

const BLEND_MODE_MAP: Record<string, number> = {
  'normal': 0,
  'multiply': 1,
  'screen': 2,
  'overlay': 3,
  'darken': 4,
  'lighten': 5,
  'color-dodge': 6,
  'color-burn': 7,
  'hard-light': 8,
  'soft-light': 9,
  'difference': 10,
  'exclusion': 11,
  'hue': 12,
  'saturation': 13,
  'color': 14,
  'luminosity': 15
};

export async function convertSvgaToLottie(svgaData: any): Promise<LottieJSON> {
  const { params, images, sprites } = svgaData;
  
  console.log(`Converting SVGA to Lottie: ${sprites.length} sprites, ${params.frames} frames`);

  const width = params.viewBoxWidth || 0;
  const height = params.viewBoxHeight || 0;
  const fps = params.fps || 30;
  const frames = params.frames || 0;
  
  const lottie: LottieJSON = {
    v: "5.7.1", // Updated version
    w: width,
    h: height,
    fr: fps,
    ip: 0,
    op: frames,
    assets: [],
    layers: []
  };
  
  const imageMap: Record<string, { id: string; w: number; h: number }> = {};
  let assetIdCount = 0;
  
  // Process images
  for (const [key, data] of Object.entries(images)) {
    let base64 = "";
    let imgW = 0;
    let imgH = 0;

    if (data instanceof Uint8Array) {
      let binary = "";
      const len = data.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(data[i]);
      }
      base64 = btoa(binary);
    } else if (typeof data === 'string') {
      base64 = data.startsWith('data:') ? data.split(',')[1] : data;
    } else if (data instanceof HTMLImageElement || data instanceof HTMLCanvasElement) {
      imgW = data instanceof HTMLImageElement ? data.naturalWidth : data.width;
      imgH = data instanceof HTMLImageElement ? data.naturalHeight : data.height;
      const canvas = document.createElement('canvas');
      canvas.width = imgW;
      canvas.height = imgH;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(data, 0, 0);
        base64 = canvas.toDataURL('image/png').split(',')[1];
      }
    }

    if (!base64) continue;

    // Try to get dimensions
    if (imgW === 0 || imgH === 0) {
      try {
        const img = new Image();
        img.src = `data:image/png;base64,${base64}`;
        await new Promise((resolve) => {
          img.onload = () => {
            imgW = img.naturalWidth;
            imgH = img.naturalHeight;
            resolve(null);
          };
          img.onerror = () => resolve(null);
        });
      } catch (e) {}
    }
    
    if (imgW === 0 || imgH === 0) {
      const sprite = sprites.find((s: any) => s.imageKey === key);
      if (sprite && sprite.layout) {
        imgW = sprite.layout.width;
        imgH = sprite.layout.height;
      }
    }
    
    const id = `image_${assetIdCount++}`;
    imageMap[key] = { id, w: imgW || 1, h: imgH || 1 };
    
    lottie.assets.push({
      id: id,
      w: imgW || 1,
      h: imgH || 1,
      u: "",
      p: base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`,
      e: 1
    });
  }
  
  // Process audios if they exist in svgaData
  if (svgaData.audios && Array.isArray(svgaData.audios)) {
    svgaData.audios.forEach((audio: any, index: number) => {
      const audioId = `audio_${index}`;
      lottie.assets.push({
        id: audioId,
        w: 0,
        h: 0,
        u: "",
        p: audio.audioKey, 
        e: 1
      } as any);
    });
  }
  
  // First pass: Identify all sprites that act as masks
  const maskTemplates: Record<string, any> = {};
  sprites.forEach((sprite: any) => {
    const isMask = sprites.some((s: any) => s.matteKey === sprite.imageKey);
    if (isMask) {
      maskTemplates[sprite.imageKey] = sprite;
    }
  });

  // Process sprites
  // In SVGA, sprites[0] is bottom-most.
  // In Lottie, layers[0] is top-most.
  // So we reverse the sprites array.
  const reversedSprites = [...sprites].reverse();
  
  let currentInd = 1;

  // Add audio layers first if they exist
  if (svgaData.audios && Array.isArray(svgaData.audios)) {
    svgaData.audios.forEach((audio: any, index: number) => {
      lottie.layers.push({
        ty: 6, // Audio layer
        nm: `Audio: ${audio.audioKey}`,
        refId: `audio_${index}`,
        ind: currentInd++,
        ks: {
          a: { a: 0, k: [0, 0, 0] },
          p: { a: 0, k: [0, 0, 0] },
          s: { a: 0, k: [100, 100, 100] },
          r: { a: 0, k: [0] },
          o: { a: 0, k: [100] }
        },
        ip: audio.startFrame || 0,
        op: frames,
        st: audio.startFrame || 0,
        bm: 0,
        sr: 1
      } as any);
    });
  }

  reversedSprites.forEach((sprite: any) => {
    // Check if this sprite is ONLY a mask template
    const isMaskTemplate = !!maskTemplates[sprite.imageKey] && !sprite.matteKey;
    // If it's a mask template, we don't add it as a normal layer.
    // It will be added as a duplicate above the layers that use it.
    if (isMaskTemplate) return;

    const createLayer = (s: any, ind: number, isMask: boolean = false) => {
      const a = imageMap[s.imageKey];
      const aSize = a || { w: (s.layout?.width || 1), h: (s.layout?.height || 1) };
      
      const isAllHidden = s.frames.every((f: any) => (f.alpha !== undefined ? f.alpha : 1) === 0);
      
      // Find actual in/out points based on alpha
      let ip = 0;
      let op = frames;
      const firstVisible = s.frames.findIndex((f: any) => (f.alpha !== undefined ? f.alpha : 1) > 0);
      const lastVisible = [...s.frames].reverse().findIndex((f: any) => (f.alpha !== undefined ? f.alpha : 1) > 0);
      
      if (firstVisible !== -1) ip = firstVisible;
      if (lastVisible !== -1) op = frames - lastVisible;

      const l: LottieLayer = {
        ty: a ? 2 : 3,
        nm: (isMask ? "Mask: " : "") + (s.name || s.imageKey || `layer_${ind}`),
        ind: ind,
        ks: {
          a: { a: 0, k: [0, 0, 0] }, // Anchor [0,0] for SVGA
          p: { a: 1, k: [] },
          s: { a: 1, k: [] },
          r: { a: 1, k: [] },
          o: { a: 1, k: [] }
        },
        ip: ip,
        op: op,
        st: 0,
        bm: typeof s.blendMode === 'string' ? (BLEND_MODE_MAP[s.blendMode] || 0) : (s.blendMode || 0),
        sr: 1,
        hd: s.hidden || isAllHidden || false
      };

      if (a) {
        l.refId = a.id;
      }

      const posK: LottieKeyframe[] = [];
      const scaleK: LottieKeyframe[] = [];
      const rotK: LottieKeyframe[] = [];
      const opacityK: LottieKeyframe[] = [];

      s.frames.forEach((frame: any, fIndex: number) => {
        const alpha = (frame.alpha !== undefined ? frame.alpha : 1) * 100;
        const matrix = frame.transform || { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
        const decomp = decomposeMatrix(matrix, aSize);
        
        addKeyframe(posK, fIndex, [decomp.x, decomp.y, 0]);
        addKeyframe(scaleK, fIndex, [decomp.scaleX, decomp.scaleY, 100]);
        addKeyframe(rotK, fIndex, [decomp.rotation]);
        addKeyframe(opacityK, fIndex, [alpha]);
      });

      // Clean up last keyframes
      [posK, scaleK, rotK, opacityK].forEach(kfArray => {
        if (kfArray.length > 0) {
          const last = kfArray[kfArray.length - 1];
          delete last.i;
          delete last.o;
        }
      });

      l.ks.p.k = posK.length > 1 ? posK : (posK[0]?.s || [0, 0, 0]);
      l.ks.p.a = posK.length > 1 ? 1 : 0;
      l.ks.s.k = scaleK.length > 1 ? scaleK : (scaleK[0]?.s || [100, 100, 100]);
      l.ks.s.a = scaleK.length > 1 ? 1 : 0;
      l.ks.r.k = rotK.length > 1 ? rotK : (rotK[0]?.s[0] || 0);
      l.ks.r.a = rotK.length > 1 ? 1 : 0;
      l.ks.o.k = opacityK.length > 1 ? opacityK : (opacityK[0]?.s[0] || 100);
      l.ks.o.a = opacityK.length > 1 ? 1 : 0;

      return l;
    };

    // If this layer is masked
    if (sprite.matteKey) {
      const maskSprite = maskTemplates[sprite.matteKey];
      if (maskSprite) {
        // Add mask layer first (above)
        const maskLayer = createLayer(maskSprite, currentInd++, true);
        lottie.layers.push(maskLayer);
        
        // Add masked layer
        const maskedLayer = createLayer(sprite, currentInd++);
        // tt: 1 = Alpha, 2 = Inverted Alpha
        maskedLayer.tt = (sprite.matteType === 'inverted' || sprite.inverted) ? 2 : 1;
        lottie.layers.push(maskedLayer);
      } else {
        lottie.layers.push(createLayer(sprite, currentInd++));
      }
    } else {
      lottie.layers.push(createLayer(sprite, currentInd++));
    }
  });
  
  return lottie;
}

/**
 * Converts a sequence of pre-rendered image frames into a Lottie JSON.
 * This ensures perfect visual fidelity by treating the animation as a high-quality image sequence.
 */
export async function convertFramesToLottieSequence(
  frames: { data: string; w: number; h: number }[],
  fps: number
): Promise<LottieJSON> {
  if (frames.length === 0) throw new Error("No frames provided");

  const width = frames[0].w;
  const height = frames[0].h;
  const totalFrames = frames.length;

  const lottie: LottieJSON = {
    v: "5.7.1",
    w: width,
    h: height,
    fr: fps,
    ip: 0,
    op: totalFrames,
    assets: [],
    layers: []
  };

  // Process frames into assets
  frames.forEach((frame, index) => {
    const id = `img_${index}`;
    const base64 = frame.data.startsWith('data:') ? frame.data.split(',')[1] : frame.data;
    
    lottie.assets.push({
      id: id,
      w: width,
      h: height,
      u: "",
      p: `data:image/png;base64,${base64}`,
      e: 1
    });

    // Create a layer for each frame that only exists for 1 frame duration
    lottie.layers.push({
      ty: 2,
      nm: `Frame_${index}`,
      refId: id,
      ind: totalFrames - index, // Reverse order for correct stacking if needed, though only one is visible
      ks: {
        a: { a: 0, k: [width / 2, height / 2, 0] },
        p: { a: 0, k: [width / 2, height / 2, 0] },
        s: { a: 0, k: [100, 100, 100] },
        r: { a: 0, k: [0] },
        o: { a: 0, k: [100] }
      },
      ip: index,
      op: index + 1,
      st: 0,
      bm: 0,
      sr: 1
    });
  });

  return lottie;
}





