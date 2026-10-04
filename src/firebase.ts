import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "soy-site-ncjpc",
  appId: "1:967610876791:web:88176fb4bb5dc9482f1772",
  apiKey: "AIzaSyD7uWoOH-r1DSW2qjJ9D6dG_FTv5AEZBkU",
  authDomain: "soy-site-ncjpc.firebaseapp.com",
  storageBucket: "soy-site-ncjpc.firebasestorage.app",
  messagingSenderId: "967610876791",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, "ai-studio-aipersonaprompts-862f03be-3d64-4079-8ef4-e3d1c6f018eb");
