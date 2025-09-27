# GastosApp – Fase 1

## 🎯 Objetivos de la Fase 1
- Crear y configurar el proyecto base con **Expo + Firebase**.
- Implementar un sistema de autenticación con **Email + Contraseña**.
- Permitir al usuario **registrarse, iniciar sesión, cerrar sesión**.
- Mostrar un **nombre de usuario (displayName)** en el panel tras el login.
- Manejar la navegación entre pantallas con **Expo Router**.
- Implementar **persistencia manual con AsyncStorage** para recordar la sesión.

---

## ⚙️ Configuración inicial
1. Crear proyecto con Expo:
   ```bash
   npx create-expo-app gastosapp
   cd gastosapp
   ```

2. Instalar dependencias mínimas:
   ```bash
   npm install firebase
   npx expo install @react-native-async-storage/async-storage react-native-safe-area-context
   ```

3. Configurar Firebase en `src/firebase.ts`:
   ```ts
   import { initializeApp, getApps } from "firebase/app";
   import { getAuth } from "firebase/auth";

   const firebaseConfig = {
     apiKey: "…",
     authDomain: "…",
     projectId: "…",
     storageBucket: "…",
     messagingSenderId: "…",
     appId: "…",
     measurementId: "…",
   };

   const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
   export const auth = getAuth(app);
   export default app;
   ```

---

## 📂 Estructura del proyecto
```
gastosapp/
  app/
    _layout.tsx      → Maneja rutas y chequea sesión guardada
    index.tsx        → Pantalla de Auth (registro/login)
    home.tsx         → Panel del usuario (tras login)
  src/
    firebase.ts      → Configuración de Firebase
    auth-storage.ts  → Persistencia manual de sesión con AsyncStorage
  App.tsx            → Entry que carga Expo Router
```

---

## 🔑 Persistencia manual de sesión
Dado que Expo Go no soporta `firebase/auth/react-native`, implementamos persistencia con `AsyncStorage`.

### `src/auth-storage.ts`
```ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const USER_KEY = "gastosapp:user";

export type StoredUser = {
  uid: string;
  email: string;
  displayName?: string | null;
};

export async function saveUser(user: StoredUser) {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function getStoredUser(): Promise<StoredUser | null> {
  const raw = await AsyncStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function clearUser() {
  await AsyncStorage.removeItem(USER_KEY);
}
```

---

## 🖥 Pantallas principales

### `app/index.tsx` – AuthScreen
- Permite **crear cuenta** y **loguearse**.
- Guarda el usuario en AsyncStorage tras login/registro.
- Redirige al `home` usando `router.replace("/home")`.

### `app/home.tsx` – PanelScreen
- Muestra saludo con `displayName`.
- Botón **Cerrar sesión** → ejecuta `signOut(auth)` + `clearUser()` + redirige al login.

### `app/_layout.tsx`
- Al iniciar la app, lee `AsyncStorage` para ver si hay sesión previa.
- Si existe → va a `home`.
- Si no → va a `index`.

---

## 📦 Dependencias utilizadas en Fase 1
- `expo`
- `expo-router`
- `firebase@^10.14.1`
- `@react-native-async-storage/async-storage`
- `react-native-safe-area-context`

---

## 🚀 Estado de Fase 1
✅ Proyecto base configurado  
✅ Firebase integrado  
✅ Registro, login y logout funcionando  
✅ Persistencia manual con AsyncStorage  
✅ Navegación con Expo Router  
✅ UI básica para testear flujo de auth  

---

👉 Con esto **Fase 1 queda completada**.  
Siguiente paso (**Fase 2**) será definir la **estructura de datos de gastos** y empezar a guardar/listar gastos en Firestore.
