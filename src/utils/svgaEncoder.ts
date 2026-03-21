
import pako from 'pako';
import protobuf from 'protobufjs';
import { svgaSchema } from '../svga-proto';

const root = protobuf.parse(svgaSchema).root;
const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");

export const parseSVGA = async (file: File): Promise<any> => {
    const buffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(buffer);
    
    // Check if it's a ZIP (SVGA 1.0) or Proto (SVGA 2.0)
    const isZip = uint8Array[0] === 0x50 && uint8Array[1] === 0x4B && uint8Array[2] === 0x03 && uint8Array[3] === 0x04;
    
    if (isZip) {
        throw new Error("SVGA 1.0 (ZIP) is not supported in this editor. Please use SVGA 2.0.");
    }

    const inflated = pako.inflate(uint8Array);
    const message = MovieEntity.decode(inflated);
    return MovieEntity.toObject(message, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        arrays: true,
        objects: true,
        oneofs: true
    } as any);
};

export const encodeSVGA = async (movieData: any): Promise<Blob> => {
    const errMsg = MovieEntity.verify(movieData);
    if (errMsg) throw Error(errMsg);

    const message = MovieEntity.fromObject(movieData);
    const buffer = MovieEntity.encode(message).finish();
    const deflated = pako.deflate(buffer);
    return new Blob([deflated], { type: 'application/octet-stream' });
};

export const scaleMovie = (movie: any, targetW: number, targetH: number): any => {
    const origW = movie.params.viewBoxWidth;
    const origH = movie.params.viewBoxHeight;
    
    if (origW === targetW && origH === targetH) return movie;

    const scaleX = targetW / origW;
    const scaleY = targetH / origH;
    const scale = Math.min(scaleX, scaleY); // Uniform scale to fit

    const offsetX = (targetW - origW * scale) / 2;
    const offsetY = (targetH - origH * scale) / 2;

    const scaledMovie = JSON.parse(JSON.stringify(movie));
    scaledMovie.params.viewBoxWidth = targetW;
    scaledMovie.params.viewBoxHeight = targetH;

    if (scaledMovie.sprites) {
        scaledMovie.sprites.forEach((sprite: any) => {
            if (sprite.frames) {
                sprite.frames.forEach((frame: any) => {
                    if (frame.layout) {
                        frame.layout.x = frame.layout.x * scale + offsetX;
                        frame.layout.y = frame.layout.y * scale + offsetY;
                        frame.layout.width *= scale;
                        frame.layout.height *= scale;
                    }
                    if (frame.transform) {
                        // Apply scale to transform matrix
                        frame.transform.a *= scale;
                        frame.transform.b *= scale;
                        frame.transform.c *= scale;
                        frame.transform.d *= scale;
                        frame.transform.tx = frame.transform.tx * scale + offsetX;
                        frame.transform.ty = frame.transform.ty * scale + offsetY;
                    }
                });
            }
        });
    }

    return scaledMovie;
};
