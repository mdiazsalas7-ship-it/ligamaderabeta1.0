// src/firebase.ts

// --- 1. Importar los módulos de Firebase ---
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"; // Módulo para la Base de Datos (Datos de equipos)
import { getAuth } from "firebase/auth"; // Módulo para la Autenticación (Login de Admin/Delegados)

// --- 2. Configuración de tu Proyecto FIREBASE ---
// (Estos son los datos específicos que proporcionaste)
const firebaseConfig = {
  apiKey: "AIzaSyAjsZYTF8-17cGGhzD2ZOtANIrtgYcDB-A",
  authDomain: "cjoba-app.firebaseapp.com",
  projectId: "cjoba-app",
  storageBucket: "cjoba-app.firebasestorage.app",
  messagingSenderId: "831383313096",
  appId: "1:831383313096:web:5a95fdb1815e8c78c623fd",
  measurementId: "G-5Z805GBY6E"
};

// 3. Inicializar la aplicación principal
const app = initializeApp(firebaseConfig);

// 4. Exportar los servicios que usaremos en la aplicación

// Exportamos la Base de Datos (db)
export const db = getFirestore(app);

// Exportamos el servicio de Autenticación (auth)
export const auth = getAuth(app);

// Fin del archivo src/firebase.ts