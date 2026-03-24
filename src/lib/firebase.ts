
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyD8xkXoFeeh4dzbvSEQdFrkG6lcsvah1bQ",
  authDomain: "svga33-53cb4.firebaseapp.com",
  projectId: "svga33-53cb4",
  storageBucket: "svga33-53cb4.firebasestorage.app",
  messagingSenderId: "843792729959",
  appId: "1:843792729959:web:74ebc06495746fecd011c2"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
