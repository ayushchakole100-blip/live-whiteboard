// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBaaCB1L4zavUXkd3kmoiwqTMTDz632Fio",
  authDomain: "live-whiteboard-8e87f.firebaseapp.com",
  projectId: "live-whiteboard-8e87f",
  storageBucket: "live-whiteboard-8e87f.firebasestorage.app",
  messagingSenderId: "174660362620",
  appId: "1:174660362620:web:cf8a4fa1699f83396744f9",
  measurementId: "G-9D1PV79HZH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export const auth = getAuth(app);