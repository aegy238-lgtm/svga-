#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
الحل البرمجي لمشكلة VAP Tool 2.0.6 على Mac
يقوم بتحويل أي فيديو MP4 أو SVGA إلى صيغة VAP مع نص "TOP 6"
المؤلف: مساعد ذكي
"""

import os
import sys
import subprocess
import shutil
from pathlib import Path
import argparse
from PIL import Image, ImageDraw, ImageFont
import cv2
import numpy as np

# ------------------ الإعدادات الثابتة ------------------
VAP_TOOL_PATH = "/path/to/vap_tool/mac_folder"  # غيّر هذا المسار إلى مجلد الأداة لديك
FPS = 24                                         # معدل الإطارات
VIDEO_SIZE = (720, 1280)                         # حجم الفيديو (غيّره حسب الحاجة)
TEXT = "TOP\n6"                                   # النص المطلوب
TEXT_POSITION_RATIO = 0.15                        # 15% من الأعلى
# -------------------------------------------------------

class VAPSolution:
    def __init__(self, input_file, output_dir="vap_output"):
        self.input_file = input_file
        self.output_dir = output_dir
        self.frames_dir = os.path.join(output_dir, "frames")
        self.mask_dir = os.path.join(output_dir, "mask")
        self.temp_dir = os.path.join(output_dir, "temp")
        
    def prepare_directories(self):
        """إنشاء المجلدات المطلوبة"""
        for dir_path in [self.output_dir, self.frames_dir, self.mask_dir, self.temp_dir]:
            os.makedirs(dir_path, exist_ok=True)
        print("✅ تم إنشاء المجلدات بنجاح")
    
    def extract_frames_from_mp4(self):
        """استخراج إطارات الفيديو من ملف MP4"""
        print("📽️ جاري استخراج الإطارات من الفيديو...")
        cap = cv2.VideoCapture(self.input_file)
        frame_count = 0
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            # حفظ الإطار بصيغة PNG مع الترقيم المطلوب (000.png, 001.png, ...)
            frame_filename = os.path.join(self.frames_dir, f"{frame_count:03d}.png")
            cv2.imwrite(frame_filename, frame)
            frame_count += 1
            
            if frame_count % 50 == 0:
                print(f"   تم استخراج {frame_count} إطار...")
        
        cap.release()
        print(f"✅ تم استخراج {frame_count} إطار بنجاح")
        return frame_count
    
    def extract_frames_from_svga(self):
        """استخراج إطارات من ملف SVGA (يتطلب مكتبة svga)"""
        try:
            from svga.player import SVGAProto
            print("🎨 جاري استخراج الإطارات من ملف SVGA...")
            
            # قراءة ملف SVGA
            with open(self.input_file, 'rb') as f:
                proto_data = f.read()
            
            svga = SVGAProto()
            svga.parse(proto_data)
            
            # استخراج الإطارات
            for i, frame in enumerate(svga.frames):
                # تحويل الإطار إلى صورة
                img = Image.fromarray(frame)
                img.save(os.path.join(self.frames_dir, f"{i:03d}.png"))
                
                if i % 50 == 0:
                    print(f"   تم استخراج {i} إطار...")
            
            print(f"✅ تم استخراج {len(svga.frames)} إطار من SVGA")
            return len(svga.frames)
            
        except ImportError:
            print("❌ مكتبة svga غير مثبتة. قم بتثبيتها بـ: pip install svga")
            sys.exit(1)
        except Exception as e:
            print(f"❌ فشل استخراج إطارات SVGA: {e}")
            sys.exit(1)
    
    def create_mask_frames(self, num_frames):
        """إنشاء صور الماسك (mask) لإضافة نص TOP 6"""
        print("🎭 جاري إنشاء صور الماسك...")
        
        # الحصول على حجم أول إطار
        first_frame = os.path.join(self.frames_dir, "000.png")
        if os.path.exists(first_frame):
            img = Image.open(first_frame)
            width, height = img.size
        else:
            width, height = VIDEO_SIZE
        
        # حساب حجم الخط المناسب
        font_size = int(height * 0.1)  # 10% من ارتفاع الفيديو
        
        try:
            # محاولة استخدام خط Arial (موجود على Mac)
            font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", font_size)
        except:
            try:
                font = ImageFont.truetype("Arial Bold", font_size)
            except:
                font = ImageFont.load_default()
        
        # إنشاء ماسك لكل إطار
        for i in range(num_frames):
            # صورة ماسك جديدة بخلفية شفافة
            mask = Image.new('RGBA', (width, height), (0, 0, 0, 0))
            draw = ImageDraw.Draw(mask)
            
            # رسم النص باللون الأسود (المناطق السوداء هي التي ستظهر)
            text_y = int(height * TEXT_POSITION_RATIO)
            
            # رسم "TOP"
            draw.text((width//2, text_y), "TOP", fill=(0, 0, 0, 255), font=font, anchor="mm")
            
            # رسم "6" أسفلها
            draw.text((width//2, text_y + font_size), "6", fill=(0, 0, 0, 255), font=font, anchor="mm")
            
            # حفظ الماسك بنفس ترقيم الإطارات
            mask_filename = os.path.join(self.mask_dir, f"{i:03d}.png")
            mask.save(mask_filename)
            
            if i % 50 == 0:
                print(f"   تم إنشاء {i} ماسك...")
        
        print(f"✅ تم إنشاء {num_frames} ماسك بنجاح")
    
    def create_vap_config(self, num_frames, has_audio=True):
        """إنشاء ملف التهيئة المطلوب لأداة VAP"""
        config = {
            "codec": "h264",
            "fps": FPS,
            "quality": {
                "type": "bitrate",
                "value": "2000k"
            },
            "alpha_scale": 0.5,  # مهم للفيديو المدمج [citation:1]
            "frames_path": self.frames_dir,
            "audio": "audio.mp3" if has_audio else None,
            "fusion_masks": [
                {
                    "source_tag": "text_top6",
                    "source_type": "text",
                    "fit_type": "centerCrop",
                    "mask_path": self.mask_dir,
                    "text_color": "#FFFFFF",
                    "text_bold": True
                }
            ]
        }
        
        # حفظ التهيئة كملف JSON
        import json
        config_path = os.path.join(self.output_dir, "vap_config.json")
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2)
        
        print(f"✅ تم إنشاء ملف التهيئة: {config_path}")
        return config_path
    
    def extract_audio(self):
        """استخراج الصوت من الفيديو إذا وجد"""
        audio_path = os.path.join(self.output_dir, "audio.mp3")
        
        try:
            # استخدام ffmpeg لاستخراج الصوت
            cmd = [
                "ffmpeg", "-i", self.input_file,
                "-q:a", "0", "-map", "a",
                audio_path, "-y"
            ]
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0 and os.path.exists(audio_path):
                print("✅ تم استخراج الصوت بنجاح")
                return audio_path
            else:
                print("⚠️ لا يوجد صوت في الفيديو أو فشل استخراجه")
                return None
        except Exception as e:
            print(f"⚠️ فشل استخراج الصوت: {e}")
            return None
    
    def check_vap_tool(self):
        """التحقق من وجود أداة VAP وصلاحياتها"""
        if not os.path.exists(VAP_TOOL_PATH):
            print(f"❌ مجلد أداة VAP غير موجود: {VAP_TOOL_PATH}")
            print("الرجاء تعديل المتغير VAP_TOOL_PATH في الكود")
            return False
        
        # التحقق من صلاحيات التنفيذ [citation:1]
        ffmpeg_path = os.path.join(VAP_TOOL_PATH, "ffmpeg")
        mp4edit_path = os.path.join(VAP_TOOL_PATH, "mp4edit")
        start_script = os.path.join(VAP_TOOL_PATH, "mac_start.sh")
        
        for tool in [ffmpeg_path, mp4edit_path, start_script]:
            if os.path.exists(tool):
                # منح صلاحية التنفيذ
                os.chmod(tool, 0o755)
        
        print("✅ تم التحقق من أداة VAP وصلاحياتها")
        return True
    
    def run_vap_tool(self, config_path):
        """تشغيل أداة VAP عبر سطر الأوامر (الحل الرسمي لمشاكل Mac) [citation:1]"""
        print("🚀 جاري تشغيل أداة VAP...")
        
        # إنشاء سكريبت التشغيل
        run_script = os.path.join(self.output_dir, "run_vap.sh")
        with open(run_script, 'w') as f:
            f.write(f"""#!/bin/bash
cd "{VAP_TOOL_PATH}"
./mac_start.sh --config "{config_path}"
""")
        os.chmod(run_script, 0o755)
        
        # تشغيل الأداة
        try:
            result = subprocess.run(
                [run_script],
                capture_output=True,
                text=True,
                timeout=300  # 5 دقائق كحد أقصى
            )
            
            if result.returncode == 0:
                print("✅ تم تشغيل أداة VAP بنجاح")
                
                # البحث عن الفيديو الناتج
                output_video = os.path.join(VAP_TOOL_PATH, "video.mp4")
                if os.path.exists(output_video):
                    final_video = os.path.join(self.output_dir, "vap_rocket_reward_6.mp4")
                    shutil.copy2(output_video, final_video)
                    print(f"✅ تم إنشاء الفيديو النهائي: {final_video}")
                    return final_video
                else:
                    print("⚠️ لم يتم العثور على الفيديو الناتج")
            else:
                print("❌ فشل تشغيل أداة VAP")
                print("الخطأ:", result.stderr)
                
        except subprocess.TimeoutExpired:
            print("❌ انتهت المهلة الزمنية لتشغيل الأداة")
        except Exception as e:
            print(f"❌ خطأ في تشغيل الأداة: {e}")
        
        return None
    
    def process(self):
        """الدالة الرئيسية لتنفيذ جميع الخطوات"""
        print("=" * 60)
        print("بدء معالجة الملف:", self.input_file)
        print("=" * 60)
        
        # 1. تحضير المجلدات
        self.prepare_directories()
        
        # 2. استخراج الإطارات حسب نوع الملف
        ext = os.path.splitext(self.input_file)[1].lower()
        if ext == '.mp4':
            num_frames = self.extract_frames_from_mp4()
        elif ext == '.svga':
            num_frames = self.extract_frames_from_svga()
        else:
            print(f"❌ صيغة غير مدعومة: {ext}")
            return False
        
        if not num_frames:
            print("❌ فشل استخراج الإطارات")
            return False
        
        # 3. إنشاء صور الماسك
        self.create_mask_frames(num_frames)
        
        # 4. استخراج الصوت (إن وجد)
        audio_path = self.extract_audio()
        
        # 5. إنشاء ملف تهيئة VAP
        config_path = self.create_vap_config(num_frames, audio_path is not None)
        
        # 6. التحقق من أداة VAP
        if not self.check_vap_tool():
            return False
        
        # 7. تشغيل أداة VAP
        final_video = self.run_vap_tool(config_path)
        
        if final_video:
            print("\n" + "=" * 60)
            print("✅ تمت المعالجة بنجاح!")
            print(f"📁 الفيديو النهائي: {final_video}")
            print("=" * 60)
            return True
        else:
            print("\n❌ فشلت المعالجة")
            return False

def main():
    parser = argparse.ArgumentParser(description='حل مشكلة VAP Tool على Mac')
    parser.add_argument('input_file', help='ملف الإدخال (MP4 أو SVGA)')
    parser.add_argument('--output', '-o', default='vap_output', help='مجلد الإخراج (اختياري)')
    
    args = parser.parse_args()
    
    if not os.path.exists(args.input_file):
        print(f"❌ الملف غير موجود: {args.input_file}")
        return
    
    # تشغيل الحل
    solution = VAPSolution(args.input_file, args.output)
    solution.process()

if __name__ == "__main__":
    main()
