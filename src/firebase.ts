import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage"; // Importación clave para imágenes

// TUS CREDENCIALES REALES
const firebaseConfig = {
  apiKey: "AIzaSyAjsZYTF8-17cGGhzD2ZOtANIrtgYcDB-A",
  authDomain: "cjoba-app.firebaseapp.com",
  projectId: "cjoba-app",
  storageBucket: "cjoba-app.firebasestorage.app", // Bucket correcto para Logos
  messagingSenderId: "831383313096",
  appId: "1:831383313096:web:5985c36185fc2ecac623fd",
  measurementId: "G-4HNPNXDBKS"
};

// Lógica Singleton para evitar errores de "Duplicate App" en recargas
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Inicializar servicios
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app); // Inicializamos Storage

// Exportar servicios para usarlos en la app
export { auth, db, storage };