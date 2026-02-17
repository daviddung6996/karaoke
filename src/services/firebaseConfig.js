import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

let database = null;
let firebaseReady = false;

try {
    if (firebaseConfig.databaseURL) {
        const app = initializeApp(firebaseConfig);
        database = getDatabase(app);
        firebaseReady = true;
    } else {
        console.warn('[Firebase] databaseURL not configured. Queue sync disabled.');
    }
} catch (err) {
    console.error('[Firebase] Init failed:', err.message);
}

export { database, firebaseReady };
