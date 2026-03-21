# SVGA Export System - Technical Architecture & Pipeline

## 1. System Overview
**Definition:** SVGA (Scalable Vector Graphics Animation) in this context refers to a lightweight, portable animation format used primarily for high-fidelity stickers, gifts, and UI effects in mobile apps (Telegram, Live Streaming Apps).
**Goal:** Create a browser-based pipeline to convert static images and videos into optimized `.svga` files.

## 2. Architecture Design

The system follows a **Client-Side Processing** architecture to ensure data privacy and reduce server load.

### Core Modules:
1.  **Input Processor (Ingest):** Handles File I/O, validation, and initial decoding.
2.  **Effect Engine (The "Juice"):**
    *   *Image Mode:* Generates procedural animations (Shine, Pulse, Float) using Canvas 2D.
    *   *Video Mode:* Performs pixel manipulation (Chroma Key, Alpha Composition).
3.  **Frame Compositor:** Flattens layers and effects into a sequence of `Uint8Array` buffers (RGBA).
4.  **Encoder Bridge:**
    *   **Protobuf Serializer:** Maps internal state to `com.opensource.svga.MovieEntity`.
    *   **Compression Layer:** Uses `pako` (zlib) to deflate the binary payload.

---

## 3. Pipeline 1: Image to SVGA (The "Animator")

### Workflow:
1.  **Input:** Single or Multiple Images (PNG/JPG/WEBP).
2.  **Configuration:**
    *   User selects **Effect Preset** (e.g., "Breathing", "Flash", "Shake").
    *   User sets **Duration** and **FPS**.
3.  **Processing (Frame Generation):**
    *   The system creates an off-screen `<canvas>`.
    *   For each frame `i` from `0` to `totalFrames`:
        *   Apply `TransformMatrix` (Scale/Rotate/Translate) based on the selected effect function `f(t)`.
        *   Apply `GlobalCompositeOperation` for lighting effects (e.g., "overlay" for Shine).
        *   Capture the canvas state as a raw buffer.
4.  **Sprite Optimization:**
    *   Instead of saving every frame as a full image, we can use **SVGA Sprites**:
        *   Save the *source image* once.
        *   Record only the *transform properties* (matrix, alpha) for each frame in the `SpriteEntity`.
        *   *Note:* For pixel-level effects (like Shine), we must bake frames (Raster Sequence). For geometric effects (Shake, Zoom), we use Vector Transforms (lighter file size).

### Supported Effects (v1):
*   **Pulse/Breathing:** Sinusoidal scale modulation.
*   **Shake:** Random x/y translation noise.
*   **Flash:** Alpha/Brightness modulation.
*   **Spin:** Rotation transform.

---

## 4. Pipeline 2: Video to SVGA (The "Converter")

### Workflow:
1.  **Input:** Video File (MP4/WEBM) - ideally with Green Screen.
2.  **Preprocessing (Chroma Key):**
    *   Extract frames using `<video>` element seeking.
    *   **Shader/Pixel Shader:** Iterate through pixels. If `pixel.color` ≈ `green`, set `pixel.alpha = 0`.
    *   *Optimization:* Remove "Black" background (Luma Key) if requested.
3.  **Vectorization Strategy (Critical Decision):**
    *   *Approach A (True Vector):* Trace bitmaps to SVG paths using `potrace` (Heavy, lossy for complex video).
    *   *Approach B (Raster Sequence - Recommended):* Treat the video as a sequence of PNGs wrapped in SVGA.
        *   **Pros:** Perfect fidelity, handles complex gradients/blur.
        *   **Cons:** Larger file size.
        *   **Mitigation:** Downscale resolution and limit FPS (e.g., 15-24 FPS).
4.  **Encoding:**
    *   Map each processed frame to a `SpriteEntity` key.
    *   Define a `FrameEntity` sequence where each frame is visible for exactly 1 tick.

---

## 5. Data Structure (Protobuf Schema)

We utilize the standard SVGA 2.0 Proto definition:

```protobuf
message MovieEntity {
    string version = 1;
    MovieParams params = 2;
    map<string, bytes> images = 3; // Key: "img_0", Value: PNG Buffer
    repeated SpriteEntity sprites = 4; // The actors
    repeated AudioEntity audios = 5; // Sound FX
}

message SpriteEntity {
    string imageKey = 1; // Refers to images map
    repeated FrameEntity frames = 2; // Animation timeline
}

message FrameEntity {
    float alpha = 1;
    Transform transform = 3; // Matrix (a, b, c, d, tx, ty)
    Layout layout = 2; // x, y, width, height
}
```

## 6. Technical Stack & Libraries

*   **Frontend:** React + TypeScript (UI/State).
*   **Serialization:** `protobufjs` (Handling .proto schema).
*   **Compression:** `pako` (Deflate/Gzip).
*   **Graphics:** HTML5 Canvas API (2D Context) for composition.
*   **Animation:** `requestAnimationFrame` for preview.

## 7. Comparison: SVG vs. SVGA

| Feature | SVG | SVGA |
| :--- | :--- | :--- |
| **Type** | Static Vector (mostly) | Animated Vector/Raster Hybrid |
| **Runtime** | Browser Native (DOM) | Requires Player (Canvas/WebGL) |
| **Use Case** | Icons, Logos | Gifts, Stickers, UI Effects |
| **Audio** | No | Yes |
| **Binary** | Text (XML) | Binary (Protobuf + Gzip) |
