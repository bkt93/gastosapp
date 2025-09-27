// src/auth-storage.ts
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
