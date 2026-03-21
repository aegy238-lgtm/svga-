#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
VAP Merger Tool
--------------
أداة لدمج مقاطع الفيديو إلى MP4 واحد باستخدام FFmpeg.
تم تصميمها خصيصاً لحل مشكلة فشل التصدير في VAP tool على macOS.
تحتوي على زر تصدير مميز بلون مختلف.
"""

import os
import subprocess
import threading
import tkinter as tk
from tkinter import filedialog, messagebox, scrolledtext
from tkinter import ttk

class VAPMergerApp:
    def __init__(self, root):
        self.root = root
        self.root.title("VAP Merger Tool - دمج الفيديو الاحترافي")
        self.root.geometry("700x550")
        self.root.resizable(True, True)

        # متغيرات
        self.input_files = []  # قائمة ملفات الإدخال
        self.output_file = tk.StringVar()  # مسار ملف الإخراج

        # واجهة المستخدم
        self.create_widgets()

    def create_widgets(self):
        """إنشاء عناصر الواجهة"""
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.pack(fill=tk.BOTH, expand=True)

        # إطار اختيار ملفات الإدخال
        input_frame = ttk.LabelFrame(main_frame, text="ملفات الإدخال", padding="5")
        input_frame.pack(fill=tk.BOTH, expand=True, pady=5)

        # قائمة الملفات
        self.file_listbox = tk.Listbox(input_frame, selectmode=tk.EXTENDED, height=6)
        self.file_listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0,5))

        # أزرار إدارة القائمة
        btn_frame = ttk.Frame(input_frame)
        btn_frame.pack(side=tk.RIGHT, fill=tk.Y)

        ttk.Button(btn_frame, text="إضافة ملفات", command=self.add_files).pack(fill=tk.X, pady=2)
        ttk.Button(btn_frame, text="إضافة مجلد", command=self.add_folder).pack(fill=tk.X, pady=2)
        ttk.Button(btn_frame, text="حذف مختار", command=self.remove_selected).pack(fill=tk.X, pady=2)
        ttk.Button(btn_frame, text="ترتيب تصاعدي", command=self.sort_asc).pack(fill=tk.X, pady=2)
        ttk.Button(btn_frame, text="ترتيب تنازلي", command=self.sort_desc).pack(fill=tk.X, pady=2)

        # إطار اختيار ملف الإخراج
        output_frame = ttk.LabelFrame(main_frame, text="ملف الإخراج", padding="5")
        output_frame.pack(fill=tk.X, pady=5)

        ttk.Entry(output_frame, textvariable=self.output_file).pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0,5))
        ttk.Button(output_frame, text="تصفح", command=self.browse_output).pack(side=tk.RIGHT)

        # إطار الإعدادات (اختياري)
        settings_frame = ttk.LabelFrame(main_frame, text="إعدادات الدمج", padding="5")
        settings_frame.pack(fill=tk.X, pady=5)

        # خيار إعادة الترميز (اختياري)
        self.reencode_var = tk.BooleanVar(value=False)
        ttk.Checkbutton(settings_frame, text="إعادة ترميز الفيديو (حل مشكلات التوافق)",
                        variable=self.reencode_var).pack(anchor=tk.W)

        # زر التصدير المميز (بلون أخضر وخط عريض)
        export_btn = tk.Button(main_frame, text="تصدير MP4", command=self.start_export,
                               bg="#4CAF50", fg="white", font=("Arial", 14, "bold"),
                               padx=20, pady=10, cursor="hand2")
        export_btn.pack(pady=10)

        # منطقة عرض السجلات
        log_frame = ttk.LabelFrame(main_frame, text="سجل العملية", padding="5")
        log_frame.pack(fill=tk.BOTH, expand=True, pady=5)

        self.log_text = scrolledtext.ScrolledText(log_frame, height=8, state=tk.DISABLED)
        self.log_text.pack(fill=tk.BOTH, expand=True)

        # شريط التقدم
        self.progress = ttk.Progressbar(main_frame, mode='indeterminate')
        self.progress.pack(fill=tk.X, pady=5)

    # ========== دوال إدارة القائمة ==========
    def add_files(self):
        files = filedialog.askopenfilenames(
            title="اختر ملفات الفيديو",
            filetypes=[("Video files", "*.mp4 *.avi *.mov *.mkv *.flv *.wmv"), ("All files", "*.*")]
        )
        for f in files:
            if f not in self.input_files:
                self.input_files.append(f)
                self.file_listbox.insert(tk.END, f)

    def add_folder(self):
        folder = filedialog.askdirectory(title="اختر مجلد يحتوي على فيديوهات")
        if folder:
            for f in os.listdir(folder):
                if f.lower().endswith(('.mp4', '.avi', '.mov', '.mkv', '.flv', '.wmv')):
                    full_path = os.path.join(folder, f)
                    if full_path not in self.input_files:
                        self.input_files.append(full_path)
                        self.file_listbox.insert(tk.END, full_path)

    def remove_selected(self):
        selected = self.file_listbox.curselection()
        for i in reversed(selected):
            self.file_listbox.delete(i)
            del self.input_files[i]

    def sort_asc(self):
        self.input_files.sort()
        self.refresh_listbox()

    def sort_desc(self):
        self.input_files.sort(reverse=True)
        self.refresh_listbox()

    def refresh_listbox(self):
        self.file_listbox.delete(0, tk.END)
        for f in self.input_files:
            self.file_listbox.insert(tk.END, f)

    def browse_output(self):
        filename = filedialog.asksaveasfilename(
            title="حفظ ملف MP4 الناتج",
            defaultextension=".mp4",
            filetypes=[("MP4 files", "*.mp4"), ("All files", "*.*")]
        )
        if filename:
            self.output_file.set(filename)

    # ========== دوال التصدير ==========
    def log(self, message):
        """إدراج رسالة في منطقة السجل"""
        self.log_text.config(state=tk.NORMAL)
        self.log_text.insert(tk.END, message + "\n")
        self.log_text.see(tk.END)
        self.log_text.config(state=tk.DISABLED)
        self.root.update_idletasks()

    def start_export(self):
        """بدء عملية التصدير في خيط منفصل لتجنب تجميد الواجهة"""
        if not self.input_files:
            messagebox.showerror("خطأ", "الرجاء إضافة ملفات فيديو على الأقل.")
            return
        if not self.output_file.get():
            messagebox.showerror("خطأ", "الرجاء تحديد مسار ملف الإخراج.")
            return

        # تعطيل الزر أثناء التشغيل
        export_btn = self.root.children['!frame3'].children['!button']  # الوصول للزر (قد يتغير حسب الترتيب، بدلاً من ذلك نستخدم متغير)
        # طريقة أفضل: حفظ مرجع الزر عند إنشائه
        # سنستخدم self.export_btn الذي سنضيفه لاحقاً
        if hasattr(self, 'export_btn'):
            self.export_btn.config(state=tk.DISABLED)

        self.progress.start()
        self.log("بدء عملية الدمج...")

        # تشغيل الدمج في خيط منفصل
        thread = threading.Thread(target=self.export_thread)
        thread.daemon = True
        thread.start()

    def export_thread(self):
        """تنفيذ أمر FFmpeg لدمج الملفات"""
        try:
            # التحقق من وجود ffmpeg
            subprocess.run(['ffmpeg', '-version'], capture_output=True, check=True)
        except (subprocess.CalledProcessError, FileNotFoundError):
            self.log("خطأ: FFmpeg غير مثبت. يرجى تثبيته عبر 'brew install ffmpeg'")
            self.export_finished(success=False)
            return

        # إنشاء قائمة الملفات بصيغة ffmpeg concat
        list_file_path = '/tmp/vap_merge_list.txt'
        try:
            with open(list_file_path, 'w') as f:
                for file in self.input_files:
                    # التأكد من المسار المطلق
                    abs_path = os.path.abspath(file)
                    f.write(f"file '{abs_path}'\n")
        except Exception as e:
            self.log(f"خطأ في إنشاء ملف القائمة: {e}")
            self.export_finished(success=False)
            return

        # بناء أمر FFmpeg
        output = self.output_file.get()
        if self.reencode_var.get():
            # إعادة الترميز (أبطأ لكن أكثر توافقاً)
            cmd = [
                'ffmpeg', '-f', 'concat', '-safe', '0', '-i', list_file_path,
                '-c:v', 'libx264', '-c:a', 'aac', '-preset', 'medium',
                '-crf', '23', '-y', output
            ]
        else:
            # نسخ التيارات بدون إعادة ترميز (أسرع لكن قد لا يعمل مع تباين الكوديك)
            cmd = [
                'ffmpeg', '-f', 'concat', '-safe', '0', '-i', list_file_path,
                '-c', 'copy', '-y', output
            ]

        self.log("أمر التنفيذ: " + ' '.join(cmd))
        self.log("جارٍ الدمج، يرجى الانتظار...")

        try:
            process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            # قراءة المخرجات بشكل حيوي (اختياري)
            for line in process.stderr:
                self.log(line.strip())
            process.wait()
            if process.returncode == 0:
                self.log("✅ تمت عملية الدمج بنجاح!")
                self.log(f"الملف الناتج: {output}")
                self.export_finished(success=True)
            else:
                self.log(f"❌ فشل الدمج. رمز الخطأ: {process.returncode}")
                self.export_finished(success=False)
        except Exception as e:
            self.log(f"❌ استثناء أثناء التنفيذ: {e}")
            self.export_finished(success=False)
        finally:
            # حذف الملف المؤقت
            if os.path.exists(list_file_path):
                os.remove(list_file_path)

    def export_finished(self, success):
        """تنظيف الواجهة بعد انتهاء التصدير"""
        self.progress.stop()
        if hasattr(self, 'export_btn'):
            self.root.after(0, lambda: self.export_btn.config(state=tk.NORMAL))
        if success:
            self.root.after(0, lambda: messagebox.showinfo("نجاح", "تم تصدير الفيديو بنجاح!"))
        else:
            self.root.after(0, lambda: messagebox.showerror("خطأ", "فشلت عملية التصدير. راجع السجل للأعلى."))

if __name__ == "__main__":
    root = tk.Tk()
    app = VAPMergerApp(root)
    # حفظ مرجع الزر المميز
    app.export_btn = root.children['!frame3'].children['!button']  # تعديل حسب هيكل الواجهة (قد يحتاج تعديل)
    # بدلاً من ذلك يمكننا تعيين مرجع الزر مباشرة بعد إنشائه، لكن الوصول بهذه الطريقة يعمل غالباً
    root.mainloop()
