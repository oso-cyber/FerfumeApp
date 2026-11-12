import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth"; // Standard Auth import
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA65MMRWbkT4H1HnB8bDUF50NFD2jn-D8k",
  authDomain: "ferfume-4457f.firebaseapp.com",
  projectId: "ferfume-4457f",
  storageBucket: "ferfume-4457f.firebasestorage.app",
  messagingSenderId: "692168217074",
  appId: "1:692168217074:web:288beba6b9c70f73765b6b",
  measurementId: "G-X5FFTT58XS"
};

// Initialize Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Standard Auth (No persistence)
export const auth = getAuth(app);

// Initialize Firestore
export const db = getFirestore(app);