importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

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

// Mantenemos esto porque tu sistema lo necesita para despertar
messaging.onBackgroundMessage(function(payload) {
  console.log('Mensaje recibido en background:', payload);
  
  // OJO: Aquí leemos de 'data' o 'notification' para asegurar compatibilidad
  const titulo = payload.notification?.title || payload.data?.title || "Notificación";
  const cuerpo = payload.notification?.body || payload.data?.body || "Nueva información";
  
  const notificationOptions = {
    body: cuerpo,
    icon: 'https://i.postimg.cc/Hx1t81vH/FORMA-21-MORICHAL.jpg' // Tu logo fijo
  };

  self.registration.showNotification(titulo, notificationOptions);
});