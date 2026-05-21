// Firebase client initialization (modular SDK v9+)
import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported as analyticsIsSupported } from 'firebase/analytics';
import { getDatabase } from 'firebase/database';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyAHnb4hdTMkZpd5cWwbTBlIN-Dm1YNOWdY",
  authDomain: "apifaculdade.firebaseapp.com",
  databaseURL: "https://apifaculdade-default-rtdb.firebaseio.com",
  projectId: "apifaculdade",
  storageBucket: "apifaculdade.firebasestorage.app",
  messagingSenderId: "1064072295404",
  appId: "1:1064072295404:web:3dbcfd9d6ed14d39e746c9",
  measurementId: "G-0BHR81893G"
};

// Initialize app
const app = initializeApp(firebaseConfig);

// Analytics is only supported in browser environments; guard for SSR
let analytics = null;
(async () => {
  if (typeof window !== 'undefined' && await analyticsIsSupported()) {
    analytics = getAnalytics(app);
  }
})();

const database = getDatabase(app);
const auth = getAuth(app);

export { app, analytics, database, auth };
