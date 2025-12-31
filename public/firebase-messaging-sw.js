importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Configuración (Tus datos)
const firebaseConfig = {
  apiKey: "AIzaSyAjsZYTF8-17cGGhzD2ZOtANIrtgYcDB-A",
  authDomain: "cjoba-app.firebaseapp.com",
  projectId: "cjoba-app",
  storageBucket: "cjoba-app.firebasestorage.app",
  messagingSenderId: "831383313096",
  appId: "1:831383313096:web:5985c36185fc2ecac623fd",
  measurementId: "G-4HNPNXDBKS"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// NOTA IMPORTANTE:
// Hemos borrado 'onBackgroundMessage' porque Firebase SDK ya maneja 
// automáticamente las notificaciones cuando vienen con título y cuerpo.
// Al quitarlo, desaparece el duplicado.