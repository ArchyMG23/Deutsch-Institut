importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyB5by4S8cvRD6H2HJAcIL7zAldajxH2oqI",
  authDomain: "dia-app-52477.firebaseapp.com",
  projectId: "dia-app-52477",
  storageBucket: "dia-app-52477.firebasestorage.app",
  messagingSenderId: "635020504377",
  appId: "1:635020504377:web:fdaea96f631ec7de818ce8"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo.png',
    data: payload.data,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
