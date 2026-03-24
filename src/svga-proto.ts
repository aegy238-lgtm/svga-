export const svgaSchema = `
syntax = "proto3";
package com.opensource.svga;

message MovieParams {
    float viewBoxWidth = 1;
    float viewBoxHeight = 2;
    int32 fps = 3;
    int32 frames = 4;
}

message SpriteEntity {
    string imageKey = 1;
    repeated FrameEntity frames = 2;
    string matteKey = 3;
}

message AudioEntity {
    string audioKey = 1;
    int32 startFrame = 2;
    int32 endFrame = 3;
    int32 startTime = 4;
    int32 totalTime = 5;
}

message Layout {
    float x = 1;
    float y = 2;
    float width = 3;
    float height = 4;
}

message Transform {
    float a = 1;
    float b = 2;
    float c = 3;
    float d = 4;
    float tx = 5;
    float ty = 6;
}

message ShapeEntity {
    enum ShapeType {
        SHAPE = 0;
        RECT = 1;
        ELLIPSE = 2;
        KEEP = 3;
    }
    ShapeType type = 1;
    map<string, float> args = 2;
    ShapeStyle styles = 3;
    Transform transform = 4;
}

message ShapeStyle {
    map<string, float> fill = 1;
    map<string, float> stroke = 2;
    float strokeWidth = 3;
    string lineCap = 4;
    string lineJoin = 5;
    float miterLimit = 6;
    repeated float lineDash = 7;
}

message FrameEntity {
    float alpha = 1;
    Layout layout = 2;
    Transform transform = 3;
    string clipPath = 4;
    repeated ShapeEntity shapes = 5;
    string blendMode = 6;
}

message MovieEntity {
    string version = 1;
    MovieParams params = 2;
    map<string, bytes> images = 3;
    repeated SpriteEntity sprites = 4;
    repeated AudioEntity audios = 5;
}
`;
