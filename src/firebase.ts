// src/firebase.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  getReactNativePersistence,
  initializeAuth,
  type Auth,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBTfssmpCqLp_wcEAfOzsyL_ckIgt2o4fw",
  authDomain: "gastosapp-c3507.firebaseapp.com",
  projectId: "gastosapp-c3507",
  storageBucket: "gastosapp-c3507.firebasestorage.app",
  messagingSenderId: "915716074963",
  appId: "1:915716074963:web:3c0d90a6ea2fc988c19326",
  measurementId: "G-PM9JWCE0N4",
};

const app: FirebaseApp = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);

// Evita doble init en hot reload: intenta getAuth y si no existe, initializeAuth
let auth: Auth;
try {
  auth = getAuth(app);
} catch {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
}

export { app, auth };

