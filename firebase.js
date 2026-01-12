import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDs8qrwvopw8pShCYvOepgA3yjFHfMWBrM",
  authDomain: "rodrigues-d6566.firebaseapp.com",
  projectId: "rodrigues-d6566",
  storageBucket: "rodrigues-d6566.firebasestorage.app",
  messagingSenderId: "1010835711502",
  appId: "1:1010835711502:web:794d59b10eb64f67d6be5f"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export { auth, db, googleProvider };