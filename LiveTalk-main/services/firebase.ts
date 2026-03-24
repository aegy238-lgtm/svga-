
// Standard Firebase v9 modular imports
import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
    apiKey: "AIzaSyAcSuJmN0Wl8jjrnlRE5xPLcusoTFjYMXQ",
    authDomain: "live-tilk.firebaseapp.com",
    projectId: "live-tilk",
    storageBucket: "live-tilk.firebasestorage.app",
    messagingSenderId: "283461855034",
    appId: "1:283461855034:web:a5a1671ea4baf6366fd203",
    measurementId: "G-8XJSKFXW5X"
};

const app = initializeApp(firebaseConfig);

// تحسين Firestore للتعامل مع تحديثات الويب المكثفة
// تقليل وقت انتظار المزامنة لضمان استجابة أسرع عند إعادة التشغيل
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

export const auth = getAuth(app);
