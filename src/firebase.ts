import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, enableIndexedDbPersistence } from 'firebase/firestore';
import { getMessaging } from 'firebase/messaging';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Enable offline persistence for better performance on mobile networks (Orange/MTN)
/*
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn("Multiple tabs open, persistence can only be enabled in one tab at a time.");
    } else if (err.code === 'unimplemented') {
      console.warn("The current browser does not support all of the features required to enable persistence.");
    }
  });
}
*/

export const messaging = typeof window !== 'undefined' ? getMessaging(app) : null;

// Test connection to Firestore
async function testConnection() {
  try {
    // Try to read a dummy document to verify connection
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firebase connection verified successfully.");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Firebase connection failed: The client is offline. Please check your Firebase configuration.");
    } else {
      // Other errors are expected if the document doesn't exist, but connection is still working
      console.log("Firebase connection established (test read attempted).");
    }
  }
}

testConnection();

export default app;
