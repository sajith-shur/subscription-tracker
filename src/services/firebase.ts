import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyD71UM8Xlc-PJRkdD873CckIIynsYqFE9o",
  authDomain: "crmsync-43aea.firebaseapp.com",
  projectId: "crmsync-43aea",
  storageBucket: "crmsync-43aea.firebasestorage.app",
  messagingSenderId: "516687285759",
  appId: "1:516687285759:web:dfefe35cf8c3e81fa2ebca"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
