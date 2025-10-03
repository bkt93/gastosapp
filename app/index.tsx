import { router } from "expo-router";
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    updateProfile,
} from "firebase/auth";
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    Text,
    TextInput,
    View,
} from "react-native";
import { saveUser } from "../src/auth-storage";
import { auth } from "../src/firebase";

export default function AuthScreen() {
    const [mode, setMode] = useState<"login" | "register">("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [busy, setBusy] = useState(false);

    const onRegister = async () => {
        if (!email || !password || !displayName)
            return Alert.alert("Completá todos los campos");
        setBusy(true);
        try {
            const cred = await createUserWithEmailAndPassword(
                auth,
                email.trim(),
                password
            );
            await updateProfile(cred.user, { displayName: displayName.trim() });

            // Guardar usuario en AsyncStorage
            await saveUser({
                uid: cred.user.uid,
                email: cred.user.email!,
                displayName: cred.user.displayName,
            });
            router.replace("/home");

        } catch (e: any) {
            Alert.alert("Error al registrarse", e?.message ?? String(e));
        } finally {
            setBusy(false);
        }

    };

    const onLogin = async () => {
        if (!email || !password) return Alert.alert("Completá email y contraseña");
        setBusy(true);
        try {
            const cred = await signInWithEmailAndPassword(
                auth,
                email.trim(),
                password
            );

            // Guardar usuario en AsyncStorage
            await saveUser({
                uid: cred.user.uid,
                email: cred.user.email!,
                displayName: cred.user.displayName,
            });
            router.replace("/home");
        } catch (e: any) {
            Alert.alert("Error al iniciar sesión", e?.message ?? String(e));
        } finally {
            setBusy(false);
        }
    };

    return (
        <View style={{ flex: 1, padding: 24, gap: 12, justifyContent: "center" }}>
            <Text style={{ fontSize: 24, fontWeight: "600", marginBottom: 8 }}>
                {mode === "register" ? "Crear cuenta" : "Iniciar sesión"}
            </Text>

            {mode === "register" && (
                <TextInput
                    placeholder="Tu nombre"
                    autoCapitalize="words"
                    value={displayName}
                    onChangeText={setDisplayName}
                    style={{
                        borderWidth: 1,
                        borderColor: "#ccc",
                        borderRadius: 8,
                        padding: 12,
                    }}
                />
            )}

            <TextInput
                placeholder="Email"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                style={{
                    borderWidth: 1,
                    borderColor: "#ccc",
                    borderRadius: 8,
                    padding: 12,
                }}
            />

            <TextInput
                placeholder="Contraseña"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                style={{
                    borderWidth: 1,
                    borderColor: "#ccc",
                    borderRadius: 8,
                    padding: 12,
                }}
            />

            <Pressable
                onPress={mode === "register" ? onRegister : onLogin}
                disabled={busy}
                style={{
                    backgroundColor: "#111",
                    padding: 14,
                    borderRadius: 10,
                    alignItems: "center",
                    opacity: busy ? 0.7 : 1,
                }}
            >
                {busy ? (
                    <ActivityIndicator />
                ) : (
                    <Text style={{ color: "white", fontWeight: "600" }}>
                        {mode === "register" ? "Registrarme" : "Iniciar sesión"}
                    </Text>
                )}
            </Pressable>

            <Pressable
                onPress={() => setMode(mode === "register" ? "login" : "register")}
            >
                <Text style={{ textAlign: "center", marginTop: 8 }}>
                    {mode === "register"
                        ? "¿Ya tenés cuenta? Inicia sesión"
                        : "¿No tenés cuenta? Crear cuenta"}
                </Text>
            </Pressable>
        </View>
    );
}
