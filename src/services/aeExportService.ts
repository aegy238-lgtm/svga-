import JSZip from 'jszip';

/**
 * After Effects Export Service (v7.0 ULTRA)
 * Handles the generation of After Effects project files (JSX + manifest.json + assets)
 */

export interface AEExportParams {
    metadata: any;
    originalWidth: number;
    originalHeight: number;
    sprites: any[];
    imagesData: { [key: string]: Uint8Array };
    previewBg?: string | null;
    audioFile?: File | null;
    audioUrl?: string | null;
    bgPos: { x: number; y: number };
    bgScale: number;
    setProgress: (p: number) => void;
}

export const generateAEProject = async (params: AEExportParams) => {
    const { 
        metadata, 
        originalWidth, 
        originalHeight, 
        sprites, 
        imagesData, 
        previewBg, 
        audioFile, 
        audioUrl, 
        bgPos, 
        bgScale, 
        setProgress 
    } = params;
    
    const zip = new JSZip();
    const assetsFolder = zip.folder("assets")!;
    
    const keys = Object.keys(imagesData);
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const fileName = `${key}.png`;
        assetsFolder.file(fileName, imagesData[key]);
        setProgress(Math.floor((i / keys.length) * 30));
    }

    if (previewBg) zip.file(`background.png`, previewBg.split(',')[1], { base64: true });

    // Handle Audio Export
    let audioFilename = '';
    let hasAudio = false;
    if (audioFile) {
        const audioBuffer = await audioFile.arrayBuffer();
        audioFilename = `audio.${audioFile.name.split('.').pop() || 'mp3'}`;
        assetsFolder.file(audioFilename, audioBuffer);
        hasAudio = true;
    } else if (audioUrl) {
        try {
            const response = await fetch(audioUrl);
            const blob = await response.blob();
            const audioBuffer = await blob.arrayBuffer();
            const ext = blob.type.split('/')[1] || 'mp3';
            audioFilename = `audio.${ext}`;
            assetsFolder.file(audioFilename, audioBuffer);
            hasAudio = true;
        } catch (e) {
            console.warn("Failed to fetch audio for export", e);
        }
    }

    const exportFps = metadata.fps || 30;
    const exportFrames = metadata.frames || 0;
    const svgaVersion = "2.0";

    const round = (n: number) => Math.round(n * 1000000) / 1000000;

    const manifest = {
        version: "9.0-QUANTUM-ULTRA",
        format: "SVGA 2.0",
        svgaVersion: svgaVersion,
        width: originalWidth,
        height: originalHeight,
        fps: exportFps,
        frames: exportFrames,
        // Added fields to match user's provided format
        folderName: `${metadata.name.replace('.svga','')}-assets`,
        timestamp: new Date().toISOString(),
        baseFileName: metadata.name.replace('.svga',''),
        totalImages: keys.length,
        totalAudios: hasAudio ? 1 : 0,
        imageKeys: keys,
        audioKeys: hasAudio ? [audioFilename] : [],
        animationInfo: {
            resolution: { width: originalWidth, height: originalHeight },
            frameRate: exportFps,
            duration: Math.round(exportFrames / exportFps)
        },
        adjustments: {
            svga: { pos: {x:0, y:0}, scale: 1 },
            bg: { pos: bgPos, scale: bgScale, exists: !!previewBg },
            wm: { pos: {x:0, y:0}, scale: 1, exists: false },
            audio: { exists: hasAudio, filename: audioFilename }
        },
        sprites: sprites.map((s: any, sIdx: number) => {
            const allFrames: any[] = [];
            
            s.frames.forEach((f: any, fIdx: number) => {
                const currentFrameData = {
                    f: fIdx,
                    a: f.alpha !== undefined ? round(f.alpha) : 1,
                    l: { 
                        x: round(f.layout?.x || 0), 
                        y: round(f.layout?.y || 0), 
                        width: round(f.layout?.width || 0), 
                        height: round(f.layout?.height || 0) 
                    },
                    t: f.transform ? {
                        a: round(f.transform.a),
                        b: round(f.transform.b),
                        c: round(f.transform.c),
                        d: round(f.transform.d),
                        tx: round(f.transform.tx),
                        ty: round(f.transform.ty)
                    } : null
                };
                allFrames.push(currentFrameData);
            });

            return {
                imageKey: s.imageKey || `layer_${sIdx}`,
                matteKey: s.matteKey || null,
                blendMode: s.blendMode || null,
                hasShapes: !!(s.shapes && s.shapes.length > 0),
                keyframes: allFrames
            };
        })
    };

    zip.file("manifest.json", JSON.stringify(manifest));

    const jsxContent = `
/**
 * Quantum SVGA Animation Suite - AE Connector (v9.0 ULTRA)
 * Professional SVGA 2.0 Import/Export Script for After Effects
 */

if (!this.JSON) { this.JSON = {}; }
(function () {
    'use strict';
    var cx = /[\\u0000\\u00ad\\u0600-\\u0604\\u070f\\u17b4\\u17b5\\u200c-\\u200f\\u2028-\\u202f\\u2060-\\u206f\\ufeff\\ufff0-\\uffff]/g;
    
    function f(n) { return n < 10 ? '0' + n : n; }
    if (typeof Date.prototype.toJSON !== 'function') {
        Date.prototype.toJSON = function () {
            return isFinite(this.valueOf()) ? this.getUTCFullYear() + '-' + f(this.getUTCMonth() + 1) + '-' + f(this.getUTCDate()) + 'T' + f(this.getUTCHours()) + ':' + f(this.getUTCMinutes()) + ':' + f(this.getUTCSeconds()) + 'Z' : null;
        };
        String.prototype.toJSON = Number.prototype.toJSON = Boolean.prototype.toJSON = function () { return this.valueOf(); };
    }

    var escapable = /[\\\\\\"\\x00-\\x1f\\x7f-\\x9f\\u00ad\\u0600-\\u0604\\u070f\\u17b4\\u17b5\\u200c-\\u200f\\u2028-\\u202f\\u2060-\\u206f\\ufeff\\ufff0-\\uffff]/g, gap, indent, meta = { '\\b': '\\\\b', '\\t': '\\\\t', '\\n': '\\\\n', '\\f': '\\\\f', '\\r': '\\\\r', '"': '\\\\"', '\\\\': '\\\\\\\\' }, rep;
    function quote(string) { escapable.lastIndex = 0; return escapable.test(string) ? '"' + string.replace(escapable, function (a) { var c = meta[a]; return typeof c === 'string' ? c : '\\\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4); }) + '"' : '"' + string + '"'; }
    function str(key, holder) {
        var i, k, v, length, mind = gap, partial, value = holder[key];
        if (value && typeof value === 'object' && typeof value.toJSON === 'function') { value = value.toJSON(key); }
        if (typeof rep === 'function') { value = rep.call(holder, key, value); }
        switch (typeof value) {
            case 'string': return quote(value);
            case 'number': return isFinite(value) ? String(value) : 'null';
            case 'boolean': case 'null': return String(value);
            case 'object':
                if (!value) { return 'null'; }
                gap += indent; partial = [];
                if (Object.prototype.toString.apply(value) === '[object Array]') {
                    length = value.length;
                    for (i = 0; i < length; i += 1) { partial[i] = str(i, value) || 'null'; }
                    v = partial.length === 0 ? '[]' : gap ? '[\\n' + gap + partial.join(',\\n' + gap) + '\\n' + mind + ']' : '[' + partial.join(',') + ']';
                    gap = mind; return v;
                }
                if (rep && typeof rep === 'object') {
                    length = rep.length;
                    for (i = 0; i < length; i += 1) { if (typeof rep[i] === 'string') { k = rep[i]; v = str(k, value); if (v) { partial.push(quote(k) + (gap ? ': ' : ':') + v); } } }
                } else {
                    for (k in value) { if (Object.prototype.hasOwnProperty.call(value, k)) { v = str(k, value); if (v) { partial.push(quote(k) + (gap ? ': ' : ':') + v); } } }
                }
                v = partial.length === 0 ? '{}' : gap ? '{\\n' + gap + partial.join(',\\n' + gap) + '\\n' + mind + '}' : '{' + partial.join(',') + '}';
                gap = mind; return v;
        }
    }
    if (typeof JSON.stringify !== 'function') {
        JSON.stringify = function (value, replacer, space) {
            var i; gap = ''; indent = '';
            if (typeof space === 'number') { for (i = 0; i < space; i += 1) { indent += ' '; } } else if (typeof space === 'string') { indent = space; }
            rep = replacer;
            if (replacer && typeof replacer !== 'function' && (typeof replacer !== 'object' || typeof replacer.length !== 'number')) { throw new Error('JSON.stringify'); }
            return str('', { '': value });
        };
    }
    if (typeof JSON.parse !== 'function') {
        JSON.parse = function (text) {
            var j; text = String(text); cx.lastIndex = 0;
            if (cx.test(text)) { text = text.replace(cx, function (a) { return '\\\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4); }); }
            j = eval('(' + text + ')'); return j;
        };
    }
}());

(function(thisObj) {
    var scriptFile = new File($.fileName);
    var projectFolder = scriptFile.parent;
    var manifestFile = new File(projectFolder.fsName + "/manifest.json");
    var data = null;

    if (manifestFile.exists) {
        manifestFile.open("r");
        data = JSON.parse(manifestFile.read());
        manifestFile.close();
    }

    function buildUI(container) {
        var panel = (container instanceof Panel) ? container : new Window("palette", "Quantum SVGA v9.0", undefined, {resizeable: true});
        panel.orientation = "column";
        panel.alignChildren = ["fill", "top"];
        panel.spacing = 10;
        panel.margins = 16;

        var header = panel.add("group");
        header.orientation = "column";
        header.alignChildren = ["center", "top"];
        var title = header.add("statictext", undefined, "QUANTUM SVGA ENGINE");
        title.graphics.font = ScriptUI.newFont("Arial", "BOLD", 18);
        
        var status = panel.add("panel", undefined, "File Information");
        status.orientation = "column";
        status.alignChildren = ["left", "top"];
        status.margins = 15;
        
        if (data) {
            status.add("statictext", undefined, "Name: " + "${metadata.name}");
            status.add("statictext", undefined, "Dimensions: " + data.width + "x" + data.height);
            status.add("statictext", undefined, "FPS: " + data.fps);
            status.add("statictext", undefined, "Layers: " + data.sprites.length);
            status.add("statictext", undefined, "Duration: " + (data.frames / data.fps).toFixed(2) + "s");
        }

        var btnGroup = panel.add("group");
        btnGroup.orientation = "column";
        btnGroup.alignChildren = ["fill", "top"];
        
        var importBtn = btnGroup.add("button", undefined, "IMPORT SVGA TO COMP");
        importBtn.preferredSize.height = 40;
        
        var exportBtn = btnGroup.add("button", undefined, "EXPORT TO SVGA 2.0");
        exportBtn.preferredSize.height = 40;

        importBtn.onClick = function() {
            if (!data) return alert("No data to import!");
            importSVGA(data, projectFolder);
        };

        exportBtn.onClick = function() {
            exportSVGA(projectFolder);
        };

        panel.layout.layout(true);
        return panel;
    }

    function exportSVGA(projectFolder) {
        var comp = app.project.activeItem;
        
        if (!comp || !(comp instanceof CompItem)) {
            for (var i = 1; i <= app.project.numItems; i++) {
                if (app.project.item(i) instanceof CompItem) {
                    comp = app.project.item(i);
                    comp.openInViewer();
                    break;
                }
            }
        }

        if (!comp || !(comp instanceof CompItem)) {
            return alert("⚠️ تنبيه: لم يتم العثور على أي مشهد (Composition) في المشروع.\\nيرجى إنشاء مشهد أو استيراد ملف أولاً.");
        }
        
        var exportData = {
            version: "9.0-QUANTUM-ULTRA",
            width: comp.width,
            height: comp.height,
            fps: comp.frameRate,
            frames: Math.floor(comp.duration * comp.frameRate),
            sprites: []
        };

        app.beginSuppressDialogs();
        var progressBar = new Window("palette", "Quantum SVGA Ultra-Fast Export...", undefined);
        var bar = progressBar.add("progressbar", [0, 0, 300, 20], 0, comp.numLayers);
        progressBar.show();

        for (var i = 1; i <= comp.numLayers; i++) {
            bar.value = i;
            var layer = comp.layer(i);
            if (layer.guideLayer) continue;

            var sprite = {
                imageKey: layer.name.indexOf("L") === 0 ? layer.name.split('_')[1] : layer.name,
                matteKey: null,
                blendMode: null,
                keyframes: []
            };

            var layerWidth = 100;
            var layerHeight = 100;
            try {
                if (layer.width) layerWidth = layer.width;
                if (layer.height) layerHeight = layer.height;
            } catch(e) {}

            if (layer.trackMatteType !== TrackMatteType.NO_TRACK_MATTE) {
                if (i > 1) {
                    var matteLayer = comp.layer(i - 1);
                    sprite.matteKey = matteLayer.name.indexOf("L") === 0 ? matteLayer.name.split('_')[1] : matteLayer.name;
                }
            }

            for (var f = 0; f < exportData.frames; f++) {
                var time = f / exportData.fps;
                var op = layer.opacity.valueAtTime(time, false);
                if (!layer.enabled) op = 0; // Handle hidden layers (eye icon)
                
                var pos = layer.position.valueAtTime(time, false);
                var scl = layer.scale.valueAtTime(time, false);
                var rot = layer.rotation.valueAtTime(time, false);

                var rad = rot * Math.PI / 180;
                var cos = Math.cos(rad);
                var sin = Math.sin(rad);
                var a = cos * (scl[0]/100);
                var b = sin * (scl[0]/100);
                var c = -sin * (scl[1]/100);
                var d = cos * (scl[1]/100);

                sprite.keyframes.push({
                    f: f,
                    a: op / 100,
                    l: { x: 0, y: 0, width: layerWidth, height: layerHeight },
                    t: { a: a, b: b, c: c, d: d, tx: pos[0], ty: pos[1] }
                });
            }
            exportData.sprites.push(sprite);
        }
        
        progressBar.close();
        app.endSuppressDialogs(false);
        var file = new File(projectFolder.fsName + "/quantum_export.json");
        file.open("w");
        file.write(JSON.stringify(exportData));
        file.close();
        alert("🚀 تم التصدير فائق السرعة بنجاح!\\n\\nالموقع: " + file.fsName);
    }

    function importSVGA(data, projectFolder) {
        app.beginUndoGroup("Quantum SVGA Ultra-Fast Rebuild");
        app.beginSuppressDialogs();
        
        var compDuration = data.frames / data.fps;
        if (compDuration <= 0) compDuration = 1/data.fps;
        var mainComp = app.project.items.addComp("${metadata.name.replace('.svga','')}", data.width, data.height, 1.0, compDuration, data.fps);
        mainComp.bgColor = [0,0,0];
        mainComp.openInViewer();
        
        var masterNull = mainComp.layers.addNull();
        masterNull.name = "SVGA_ROOT_TRANSFORM";
        masterNull.position.setValue([0, 0]);
        
        var assetsFolder = new Folder(projectFolder.fsName + "/assets");
        var layerMap = {};
        
        for (var i = 0; i < data.sprites.length; i++) {
            var sprite = data.sprites[i];
            var layer = null;
            var footage = null;
            if (sprite.imageKey) {
                var imgFile = File(assetsFolder.fsName + "/" + sprite.imageKey + ".png");
                if (imgFile.exists) {
                    try {
                        footage = app.project.importFile(new ImportOptions(imgFile));
                        layer = mainComp.layers.add(footage);
                        layer.anchorPoint.setValue([0, 0]);
                    } catch(e) {}
                }
            }
            if (!layer) {
                layer = mainComp.layers.addSolid([0.1, 0.1, 0.1], "Layer_" + i, 100, 100, 1.0);
                layer.guideLayer = true;
                layer.anchorPoint.setValue([0, 0]);
            }
            layer.name = "L" + i + "_" + (sprite.imageKey || "Shape");
            layer.parent = masterNull;
            layerMap[i] = layer;
            
            var fd = mainComp.frameDuration;
            var times = [];
            var opacities = [];
            var positions = [];
            var scales = [];
            var rotations = [];

            for (var k = 0; k < sprite.keyframes.length; k++) {
                var kf = sprite.keyframes[k];
                var time = kf.f * fd;
                times.push(time);
                opacities.push(kf.a * 100);
                
                if (kf.t) {
                    var t = kf.t;
                    var sw = (kf.l.width || 1) / (footage ? footage.width : 100);
                    var sh = (kf.l.height || 1) / (footage ? footage.height : 100);
                    
                    var Ma = t.a * sw;
                    var Mb = t.b * sw;
                    var Mc = t.c * sh;
                    var Md = t.d * sh;
                    
                    var scaleX = Math.sqrt(Ma * Ma + Mb * Mb);
                    var det = Ma * Md - Mb * Mc;
                    var scaleY = det / (scaleX || 1e-6);
                    var rot = Math.atan2(Mb, Ma) * 180 / Math.PI;

                    positions.push([t.a * kf.l.x + t.c * kf.l.y + t.tx, t.b * kf.l.x + t.d * kf.l.y + t.ty]);
                    scales.push([scaleX * 100, scaleY * 100]);
                    rotations.push(rot);
                }
            }

            if (times.length > 0) {
                layer.opacity.setValuesAtTimes(times, opacities);
                if (positions.length > 0) {
                    layer.position.setValuesAtTimes(times, positions);
                    layer.scale.setValuesAtTimes(times, scales);
                    layer.rotation.setValuesAtTimes(times, rotations);
                }
            }
        }

        for (var i = 0; i < data.sprites.length; i++) {
            var s = data.sprites[i];
            if (s.matteKey && layerMap[i]) {
                for (var j = 0; j < data.sprites.length; j++) {
                    if (data.sprites[j].imageKey === s.matteKey && layerMap[j]) {
                        var m = layerMap[j].duplicate();
                        m.name = "[MATTE]_" + layerMap[j].name;
                        m.moveBefore(layerMap[i]);
                        layerMap[i].trackMatteType = TrackMatteType.ALPHA;
                        layerMap[j].enabled = false;
                        break;
                    }
                }
            }
        }

        app.endSuppressDialogs(false);
        app.endUndoGroup();
        alert("⚡ تم الاستيراد فائق السرعة بنجاح!");
    }

    var myPanel = buildUI(thisObj);
    if (myPanel instanceof Window) myPanel.show();
})(this);
`;

    const readmeContent = `SVGA to AEP Script Usage Guide (v7.0 ULTRA)
================================

📁 Files Included
-----------------
- ${metadata.name.replace('.svga','')}.jsx - After Effects script file
- manifest.json - Animation data file (DO NOT DELETE)
- assets/ - Exported image and audio files
- README.txt - This file

🚀 Quick Start
--------------
1. Extract the entire ZIP file to a folder.
2. Open Adobe After Effects.
3. Go to File > Scripts > Run Script File.
4. Select ${metadata.name.replace('.svga','')}.jsx script file.
5. The script will automatically find manifest.json and assets/ in the same folder.

✅ Features (v7.0 Updates)
--------------------------
- SVGA 2.0 Engine: Built using the same high-fidelity logic as the SVGA 2.0 export button.
- Original Version Sync: Detects and labels the project with the original SVGA version (2.0 forced).
- Robust Layer Recovery: All layers from the original file are now included. Missing assets are replaced with guide placeholders to maintain animation structure.
- Frame-Perfect Motion: Matches original FPS, frames, and viewBox dimensions exactly.
- Professional Mirroring: Advanced matrix decomposition for flipped/mirrored layers.
- Background & Audio support.

⚠️ Requirements
---------------
- Adobe After Effects CC 2018 or newer.
- Allow Scripts to Write Files and Access Network (Edit > Preferences > Scripting & Expressions).
`;

    const fileName = "eid mubarak";
    zip.file(`${fileName}.jsx`, jsxContent);
    zip.file("README.txt", readmeContent);
    
    const blob = await zip.generateAsync({ type: "blob" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${fileName}_AfterEffects_Project.zip`;
    link.click();
    setProgress(100);
};
