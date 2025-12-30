import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
// 1. NUEVA IMPORTACIÓN PARA NOTIFICACIONES
import { getMessaging, isSupported } from "firebase/messaging"; 

const firebaseConfig = {
  apiKey: "AIzaSyAjsZYTF8-17cGGhzD2ZOtANIrtgYcDB-A",
  authDomain: "cjoba-app.firebaseapp.com",
  projectId: "cjoba-app",
  storageBucket: "cjoba-app.firebasestorage.app",
  messagingSenderId: "831383313096",
  appId: "1:831383313096:web:5985c36185fc2ecac623fd",
  measurementId: "G-4HNPNXDBKS"
};

// Lógica Singleton para evitar errores de reinicialización
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Inicializar servicios existentes
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app); 

// 2. INICIALIZAR MESSAGING DE FORMA SEGURA
// Usamos isSupported() porque Messaging necesita Service Workers (no funciona en modo incógnito a veces o navegadores muy viejos)
let messaging: any = null;

isSupported().then(yes => {
  if (yes) {
    messaging = getMessaging(app);
  }
}).catch(err => {
  console.log('Firebase Messaging no es soportado en este navegador:', err);
});

// 3. EXPORTAR SERVICIOS (Agregamos messaging al final)
export { auth, db, storage, messaging };