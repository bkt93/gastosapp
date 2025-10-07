// app/index.tsx
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
    Image,
    Pressable,
    StatusBar,
    Text,
    TextInput,
    View,
} from "react-native";
import { saveUser } from "../src/auth-storage";
import { auth } from "../src/firebase";
import { colors, radius, spacing } from "../src/theme"; // 👈 tu theme oficial

export default function AuthScreen() {
    const [mode, setMode] = useState<"login" | "register">("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [busy, setBusy] = useState(false);
    const [showPass, setShowPass] = useState(false);

    const onRegister = async () => {
        if (!email || !password || !displayName)
            return Alert.alert("Faltan datos", "Completá nombre, email y contraseña");
        setBusy(true);
        try {
            const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
            await updateProfile(cred.user, { displayName: displayName.trim() });
            await saveUser({
                uid: cred.user.uid,
                email: cred.user.email!,
                displayName: cred.user.displayName,
            });
            router.replace("/home");
        } catch (e: any) {
            handleAuthError(e);
        } finally {
            setBusy(false);
        }
    };

    const onLogin = async () => {
        if (!email || !password)
            return Alert.alert("Faltan datos", "Completá email y contraseña");
        setBusy(true);
        try {
            const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
            await saveUser({
                uid: cred.user.uid,
                email: cred.user.email!,
                displayName: cred.user.displayName,
            });
            router.replace("/home");
        } catch (e: any) {
            handleAuthError(e);
        } finally {
            setBusy(false);
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
            <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
            <View
                style={{
                    flex: 1,
                    paddingHorizontal: spacing.xl,
                    paddingTop: spacing.xl * 2.5,
                    paddingBottom: spacing.xl,
                    justifyContent: "center",
                    gap: spacing.lg,
                }}
            >
                {/* Logo + Marca */}
                <View style={{ alignItems: "center", marginBottom: spacing.sm }}>
                    <Image
                        source={require("../assets/logo-home.png")}
                        style={{ width: 300, height: 88, marginBottom: spacing.sm }}
                        resizeMode="contain"
                    />
                    <Text style={{ color: colors.textMuted, marginTop: 4 }}>
                        Compartí y gestioná tus gastos
                    </Text>
                </View>

                {/* Tabs simples */}
                <View
                    style={{
                        backgroundColor: colors.card,
                        borderRadius: radius.lg,
                        padding: 6,
                        flexDirection: "row",
                        borderWidth: 1,
                        borderColor: colors.border,
                    }}
                >
                    <Tab
                        label="Iniciar sesión"
                        active={mode === "login"}
                        onPress={() => setMode("login")}
                    />
                    <Tab
                        label="Crear cuenta"
                        active={mode === "register"}
                        onPress={() => setMode("register")}
                    />
                </View>

                {/* Card del formulario */}
                <View
                    style={{
                        backgroundColor: colors.card,
                        borderRadius: radius.lg,
                        padding: spacing.lg,
                        gap: spacing.sm,
                        borderWidth: 1,
                        borderColor: colors.border,
                    }}
                >
                    {mode === "register" && (
                        <TextInput
                            placeholder="Tu nombre"
                            placeholderTextColor={colors.textMuted}
                            autoCapitalize="words"
                            value={displayName}
                            onChangeText={setDisplayName}
                            style={inputStyle}
                            returnKeyType="next"
                        />
                    )}

                    <TextInput
                        placeholder="Email"
                        placeholderTextColor={colors.textMuted}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        value={email}
                        onChangeText={setEmail}
                        style={inputStyle}
                        returnKeyType="next"
                    />

                    <View style={{ position: "relative" }}>
                        <TextInput
                            placeholder="Contraseña"
                            placeholderTextColor={colors.textMuted}
                            secureTextEntry={!showPass}
                            value={password}
                            onChangeText={setPassword}
                            style={inputStyle}
                            returnKeyType={mode === "login" ? "done" : "next"}
                            onSubmitEditing={mode === "login" ? onLogin : undefined}
                        />
                        <Pressable
                            onPress={() => setShowPass((s) => !s)}
                            style={{ position: "absolute", right: spacing.sm, top: 14 }}
                        >
                            <Text style={{ color: colors.textMuted }}>
                                {showPass ? "Ocultar" : "Mostrar"}
                            </Text>
                        </Pressable>
                    </View>

                    <Pressable
                        onPress={mode === "register" ? onRegister : onLogin}
                        disabled={busy}
                        style={{
                            backgroundColor: colors.primary, // 👈 azul marca
                            paddingVertical: spacing.md,
                            borderRadius: radius.lg,
                            alignItems: "center",
                            opacity: busy ? 0.7 : 1,
                            marginTop: 4,
                        }}
                    >
                        {busy ? (
                            <ActivityIndicator color="#000" />
                        ) : (
                            <Text style={{ color: "#000", fontWeight: "700" }}>
                                {mode === "register" ? "Registrarme" : "Iniciar sesión"}
                            </Text>
                        )}
                    </Pressable>

                    {mode === "login" && (
                        <Pressable
                            onPress={() =>
                                Alert.alert("Próximamente", "Recuperar contraseña")
                            }
                        >
                            <Text
                                style={{
                                    color: colors.textMuted,
                                    textAlign: "center",
                                    marginTop: spacing.xs,
                                }}
                            >
                                ¿Olvidaste tu contraseña?
                            </Text>
                        </Pressable>
                    )}
                </View>

                {/* Switch */}
                <Pressable
                    onPress={() => setMode(mode === "register" ? "login" : "register")}
                >
                    <Text
                        style={{
                            color: colors.textMuted,
                            textAlign: "center",
                            marginTop: spacing.sm,
                        }}
                    >
                        {mode === "register"
                            ? "¿Ya tenés cuenta? Iniciá sesión"
                            : "¿No tenés cuenta? Crear cuenta"}
                    </Text>
                </Pressable>

                <Text
                    style={{
                        color: colors.textMuted,
                        fontSize: 12,
                        textAlign: "center",
                        marginTop: spacing.sm,
                    }}
                >
                    Al continuar aceptás nuestros Términos y Política de Privacidad.
                </Text>
            </View>
        </View>
    );
}

function Tab({
    label,
    active,
    onPress,
}: {
    label: string;
    active: boolean;
    onPress: () => void;
}) {
    return (
        <Pressable
            onPress={onPress}
            style={{
                flex: 1,
                paddingVertical: spacing.sm,
                borderRadius: radius.lg,
                alignItems: "center",
                backgroundColor: active ? "rgba(255,255,255,0.08)" : "transparent",
            }}
        >
            <Text
                style={{
                    color: active ? colors.text : colors.textMuted,
                    fontWeight: active ? "700" : "500",
                }}
            >
                {label}
            </Text>
        </Pressable>
    );
}

const inputStyle = {
    backgroundColor: colors.cardAlt,
    color: colors.text,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
} as const;

// --- helpers ---
function handleAuthError(e: any) {
    const code = e?.code ?? "";
    if (code.includes("auth/invalid-email")) {
        Alert.alert("Email inválido", "Revisá el formato del correo.");
    } else if (code.includes("auth/weak-password")) {
        Alert.alert("Contraseña muy débil", "Usá al menos 6 caracteres.");
    } else if (code.includes("auth/email-already-in-use")) {
        Alert.alert("Ya existe una cuenta", "Probá iniciar sesión.");
    } else if (code.includes("auth/invalid-credential")) {
        Alert.alert("Credenciales inválidas", "Verificá email y contraseña.");
    } else {
        Alert.alert("Ups", e?.message ?? String(e));
    }
}
