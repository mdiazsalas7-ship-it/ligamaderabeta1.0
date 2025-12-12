import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// TUS CREDENCIALES REALES (Ya configuradas)
const firebaseConfig = {
  apiKey: "AIzaSyAjsZYTF8-17cGGhzD2ZOtANIrtgYcDB-A",
  authDomain: "cjoba-app.firebaseapp.com",
  projectId: "cjoba-app",
  storageBucket: "cjoba-app.firebasestorage.app", // Tu bucket correcto
  messagingSenderId: "831383313096",
  appId: "1:831383313096:web:5985c36185fc2ecac623fd",
  measurementId: "G-4HNPNXDBKS"
};

// Lógica para evitar el error "Duplicate App"
// Si ya existe una app, usa esa. Si no, inicializa una nueva.
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Exportar servicios
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);