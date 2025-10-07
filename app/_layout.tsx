// app/_layout.tsx
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StatusBar, Text, View } from "react-native";
import { getStoredUser, StoredUser } from "../src/auth-storage";
import { colors } from "../src/theme";

export default function RootLayout() {
    const [user, setUser] = useState<StoredUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            const stored = await getStoredUser();
            setUser(stored);
            setLoading(false);
        })();
    }, []);

    if (loading) {
        return (
            <View
                style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                    backgroundColor: colors.bg, // 👈 fondo oscuro también en loading
                }}
            >
                <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
                <ActivityIndicator color={colors.text} />
                <Text style={{ marginTop: 8, color: colors.textMuted }}>Cargando…</Text>
            </View>
        );
    }

    return (
        <>
            <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
            <Stack
                screenOptions={{
                    headerShown: false,
                    // 👇 Asegura el fondo en TODAS las pantallas del stack
                    contentStyle: { backgroundColor: colors.bg },
                    // Si en algún momento volvés a mostrar header:
                    headerStyle: { backgroundColor: colors.bg },
                    headerTintColor: colors.text,
                }}
            >
                {user ? <Stack.Screen name="home" /> : <Stack.Screen name="index" />}
            </Stack>
        </>
    );
}
