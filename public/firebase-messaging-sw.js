importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Pega aquí TU MISMA CONFIGURACIÓN de firebase.ts (solo los datos)
const firebaseConfig = {
  // ⚠️ COPIA ESTO DE TU PROYECTO EN FIREBASE CONSOLE O DE TU ARCHIVO firebase.ts
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

// Esto maneja las notificaciones cuando la app está CERRADA (Background)
messaging.onBackgroundMessage(function(payload) {
  console.log('Mensaje recibido en background:', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/vite.svg' // O tu logo del toro
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});