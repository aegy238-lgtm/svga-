import protobuf from 'protobufjs';
import pako from 'pako';

const svgaProtoJson = {
  nested: {
    com: {
      nested: {
        opensource: {
          nested: {
            svga: {
              nested: {
                MovieParams: {
                  fields: {
                    viewBoxWidth: { type: "float", id: 1 },
                    viewBoxHeight: { type: "float", id: 2 },
                    fps: { type: "int32", id: 3 },
                    frames: { type: "int32", id: 4 }
                  }
                },
                SpriteEntity: {
                  fields: {
                    imageKey: { type: "string", id: 1 },
                    frames: { rule: "repeated", type: "FrameEntity", id: 2 },
                    matteKey: { type: "string", id: 3 }
                  }
                },
                AudioEntity: {
                  fields: {
                    audioKey: { type: "string", id: 1 },
                    startFrame: { type: "int32", id: 2 },
                    endFrame: { type: "int32", id: 3 },
                    startTime: { type: "int32", id: 4 },
                    totalTime: { type: "int32", id: 5 }
                  }
                },
                Layout: {
                  fields: {
                    x: { type: "float", id: 1 },
                    y: { type: "float", id: 2 },
                    width: { type: "float", id: 3 },
                    height: { type: "float", id: 4 }
                  }
                },
                Transform: {
                  fields: {
                    a: { type: "float", id: 1 },
                    b: { type: "float", id: 2 },
                    c: { type: "float", id: 3 },
                    d: { type: "float", id: 4 },
                    tx: { type: "float", id: 5 },
                    ty: { type: "float", id: 6 }
                  }
                },
                ShapeEntity: {
                    fields: {
                        type: { type: "ShapeType", id: 1 },
                        args: { type: "ShapeArgs", id: 2 }, // simplified
                        transform: { type: "Transform", id: 3 },
                        styles: { type: "ShapeStyle", id: 4 } // simplified
                    }
                },
                FrameEntity: {
                  fields: {
                    alpha: { type: "float", id: 1 },
                    layout: { type: "Layout", id: 2 },
                    transform: { type: "Transform", id: 3 },
                    clipPath: { type: "string", id: 4 },
                    shapes: { rule: "repeated", type: "ShapeEntity", id: 5 }
                  }
                },
                MovieEntity: {
                  fields: {
                    version: { type: "string", id: 1 },
                    params: { type: "MovieParams", id: 2 },
                    sprites: { rule: "repeated", type: "SpriteEntity", id: 3 },
                    audios: { rule: "repeated", type: "AudioEntity", id: 4 },
                    images: { keyType: "string", type: "bytes", id: 5 }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};

export interface SvgaFrameData {
    image: string; // base64 or blob url
    width: number;
    height: number;
}

export async function createSvga(
    frames: SvgaFrameData[],
    fps: number,
    width: number,
    height: number
): Promise<Uint8Array> {
    const root = protobuf.Root.fromJSON(svgaProtoJson);
    const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");

    const images: Record<string, Uint8Array> = {};
    const sprites: any[] = [];
    
    // Create a sprite for the sequence
    // In SVGA, usually we can have one sprite that changes its imageKey per frame,
    // or multiple sprites. But SVGA 1.x/2.x doesn't support changing imageKey per frame easily 
    // without multiple sprites or complex logic.
    // However, a common trick is to have one sprite, and use different frames.
    // Actually, SVGA structure: Sprite -> Frames. Each Frame has layout/transform/alpha.
    // The Sprite has ONE imageKey.
    // So for an image sequence, we need MULTIPLE sprites (one per image) and toggle their alpha.
    // OR, we can use one sprite and just swap the image content? No, imageKey is on Sprite, not Frame.
    
    // Wait, if I have 10 images and want to play them in sequence:
    // Frame 0: Show Sprite 0 (Image 0), Hide others
    // Frame 1: Show Sprite 1 (Image 1), Hide others
    // ...
    
    // Let's implement this "Flipbook" approach.
    
    frames.forEach((frame, index) => {
        const key = `img_${index}`;
        // Convert base64/url to Uint8Array
        // We assume frame.image is a data URL
        const base64 = frame.image.split(',')[1];
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        images[key] = bytes;

        const spriteFrames: any[] = [];
        for (let i = 0; i < frames.length; i++) {
            if (i === index) {
                spriteFrames.push({
                    alpha: 1,
                    layout: { x: 0, y: 0, width: width, height: height },
                    transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }
                });
            } else {
                spriteFrames.push({
                    alpha: 0, // Hide
                    layout: { x: 0, y: 0, width: width, height: height },
                    transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }
                });
            }
        }

        sprites.push({
            imageKey: key,
            frames: spriteFrames
        });
    });

    const payload = {
        version: "2.0",
        params: {
            viewBoxWidth: width,
            viewBoxHeight: height,
            fps: fps,
            frames: frames.length
        },
        sprites: sprites,
        images: images
    };

    const errMsg = MovieEntity.verify(payload);
    if (errMsg) throw Error(errMsg);

    const message = MovieEntity.create(payload);
    const buffer = MovieEntity.encode(message).finish();

    // Compress with pako (zlib)
    const compressed = pako.deflate(buffer);
    return compressed;
}
