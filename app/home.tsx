import { router } from "expo-router";
import { signOut } from "firebase/auth";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { clearUser } from "../src/auth-storage";
import { auth } from "../src/firebase";

export default function PanelScreen() {
    const [busy, setBusy] = useState(false);
    const name = auth.currentUser?.displayName ?? "usuario";

    const onLogout = async () => {
        try {
            setBusy(true);
            await signOut(auth);       // cierra sesión en Firebase
            await clearUser();         // borra AsyncStorage
            router.replace("/");       // navega al login (index.tsx)
        } finally {
            setBusy(false);
        }
    };

    return (
        <View style={{ flex: 1, padding: 24, gap: 16, justifyContent: "center", alignItems: "center" }}>
            <Text style={{ fontSize: 22 }}>
                Hola, <Text style={{ fontWeight: "700" }}>{name}</Text> 👋
            </Text>

            <Pressable onPress={onLogout} disabled={busy}
                style={{ backgroundColor: "#ef4444", padding: 12, borderRadius: 10, opacity: busy ? 0.6 : 1 }}>
                {busy ? <ActivityIndicator /> : (
                    <Text style={{ color: "white", fontWeight: "600" }}>Cerrar sesión</Text>
                )}
            </Pressable>
        </View>
    );
}
