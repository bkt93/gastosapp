import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: 'AIzaSyBTfssmpCqLp_wcEAfOzsyL_ckIgt2o4fw',
  authDomain: 'gastosapp-c3507.firebaseapp.com',
  projectId: 'gastosapp-c3507',
  storageBucket: 'gastosapp-c3507.firebasestorage.app', // (ver nota abajo)
  messagingSenderId: '915716074963',
  appId: '1:915716074963:web:3c0d90a6ea2fc988c19326',
  measurementId: 'G-PM9JWCE0N4',
};

const app: FirebaseApp = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);

let auth: Auth;
if (Platform.OS === 'web') {
  // Web: getAuth normal
  auth = getAuth(app);
} else {
  // RN/Expo: initializeAuth con AsyncStorage (¡sin llamar getAuth antes!)
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
}

const db: Firestore = getFirestore(app);

export { app, auth, db };

