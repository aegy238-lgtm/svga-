
// Standard Firebase v9 modular imports
import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// تحسين Firestore للتعامل مع تحديثات الويب المكثفة
// تقليل وقت انتظار المزامنة لضمان استجابة أسرع عند إعادة التشغيل
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

export const auth = getAuth(app);
