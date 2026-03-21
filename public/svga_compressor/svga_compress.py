import zipfile
import os
import tempfile
import shutil
from PIL import Image

def compress_image(img_path, quality=85):
    """
    ضغط صورة فردية مع الحفاظ على أبعادها.
    - للصور ذات الشفافية: تحويلها إلى لوحة ألوان (Palette) مع الحفاظ على alpha.
    - للصور بدون شفافية: تحويلها إلى لوحة ألوان (256 لون) أو ضبط جودة JPEG.
    """
    with Image.open(img_path) as img:
        original_format = img.format

        # التعامل مع الصور التي تحتوي على شفافية
        if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
            img = img.convert('RGBA')
            # تقليل الألوان مع الحفاظ على قناة الشفافية
            img = img.quantize(colors=256, method=Image.MEDIANCUT)
        else:
            # صور بدون شفافية
            img = img.convert('RGB')
            if original_format == 'JPEG':
                # حفظ JPEG بجودة أقل وتحسين الضغط
                img.save(img_path, 'JPEG', quality=quality, optimize=True)
                return
            # للصور الأخرى (مثل PNG) نحولها إلى لوحة ألوان
            img = img.quantize(colors=256, method=Image.MEDIANCUT)

        # حفظ بصيغة PNG مع أقصى ضغط
        img.save(img_path, 'PNG', optimize=True, compress_level=9)

def compress_svga(input_path, output_path, quality=85):
    """
    ضغط ملف SVGA:
    - فك الضغط إلى مجلد مؤقت
    - البحث عن جميع الصور وضغطها
    - إعادة التجميع إلى ملف SVGA جديد
    """
    with tempfile.TemporaryDirectory() as temp_dir:
        # 1. استخراج محتويات ملف SVGA (ZIP)
        with zipfile.ZipFile(input_path, 'r') as zip_ref:
            zip_ref.extractall(temp_dir)

        # 2. البحث عن جميع ملفات الصور (PNG, JPG, JPEG)
        image_extensions = ('.png', '.jpg', '.jpeg')
        images = []
        for root, dirs, files in os.walk(temp_dir):
            for file in files:
                if file.lower().endswith(image_extensions):
                    images.append(os.path.join(root, file))

        if not images:
            print("لم يتم العثور على صور داخل الملف. سيتم نسخ الملف كما هو.")
            shutil.copy2(input_path, output_path)
            return

        # 3. ضغط كل صورة
        for img_path in images:
            try:
                compress_image(img_path, quality)
                print(f"تم ضغط: {os.path.basename(img_path)}")
            except Exception as e:
                print(f"فشل ضغط {img_path}: {e}")

        # 4. إعادة إنشاء ملف SVGA (ZIP) مع الضغط
        with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zip_out:
            for root, dirs, files in os.walk(temp_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, temp_dir)
                    zip_out.write(file_path, arcname)

        print(f"تم إنشاء الملف المضغوط: {output_path}")

if __name__ == "__main__":
    import sys
    if len(sys.argv) != 3:
        print("الاستخدام: python svga_compress.py <ملف_الإدخال.svga> <ملف_الإخراج.svga>")
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2]

    if not os.path.exists(input_file):
        print("ملف الإدخال غير موجود!")
        sys.exit(1)

    compress_svga(input_file, output_file)
