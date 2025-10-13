// app/home.tsx
import { useFocusEffect, useRouter } from "expo-router";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    Pressable,
    StatusBar,
    Text,
    TextInput,
    View,
} from "react-native";
import { clearUser, getStoredUser, type StoredUser } from "../src/auth-storage";
import { auth } from "../src/firebase";
import { createProject } from "../src/services/projects";
import { fetchSharedProjectsOnce, subscribeSharedProjectsByUid } from "../src/services/projects.members.read";
import {
    fetchOwnedProjectsOnce,
    subscribeOwnedProjectsByUid,
    type ProjectListItem
} from "../src/services/projects.read";

import { SafeAreaView } from "react-native-safe-area-context";
import AppHeader from "../src/components/AppHeader";
import FAB from "../src/components/FAB";
import GreetingBar from "../src/components/GreetingBar";
import ProjectCard from "../src/components/ProjectCard";
import VersionBadge from "../src/components/VersionBadge";
import { colors, radius, spacing } from "../src/theme";



const EMOJI_CHOICES = ["🏠", "👪", "🐶", "🌴", "🛠️", "🧺", "🧾", "🎬", "🎮", "🍔", "✈️", "🚗", "💡", "🔥", "💧", "💳", "📦", "🧸", "🧪", "🧰"];

export default function HomeScreen() {
    const router = useRouter();

    const [items, setItems] = useState<ProjectListItem[]>([]);
    const [sharedItems, setSharedItems] = useState<ProjectListItem[]>([]);

    const [showModal, setShowModal] = useState(false);
    const [name, setName] = useState("");
    const [currency, setCurrency] = useState("ARS");

    const [storedUser, setStoredUser] = useState<StoredUser | null>(null);
    const [loadingUser, setLoadingUser] = useState(true);

    const [authUser, setAuthUser] = useState<User | null>(null);
    const [authReady, setAuthReady] = useState(false);

    const canCreate = useMemo(
        () => name.trim().length > 0 && authReady && !!authUser,
        [name, authReady, authUser]
    );

    const [iconEmoji, setIconEmoji] = useState<string>("🏠"); // por defecto la casitaaa


    // cargar user guardado
    useEffect(() => {
        (async () => {
            const u = await getStoredUser();
            setStoredUser(u);
            setLoadingUser(false);
        })();
    }, []);

    // escuchar auth real
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
            setAuthUser(u);
            setAuthReady(true);
        });
        return () => unsub();
    }, []);

    // proyectos propios
    useEffect(() => {
        if (!authReady || !authUser?.uid) return;
        const unsub = subscribeOwnedProjectsByUid(authUser.uid, setItems);
        return () => unsub && unsub();
    }, [authReady, authUser?.uid]);

    // compartidos
    useEffect(() => {
        if (!authReady || !authUser?.uid) return;
        const unsub = subscribeSharedProjectsByUid(authUser.uid, setSharedItems);
        return () => unsub && unsub();
    }, [authReady, authUser?.uid]);

    useFocusEffect(
        useCallback(() => {
            if (!authReady || !authUser?.uid) return;

            // refresco “instantáneo” al volver a Home
            (async () => {
                try {
                    const [owned, shared] = await Promise.all([
                        fetchOwnedProjectsOnce(authUser.uid),
                        fetchSharedProjectsOnce(authUser.uid),
                    ]);
                    setItems(owned);
                    setSharedItems(shared);
                } catch (e) {
                    console.log("focus refresh error:", e);
                }
            })();
        }, [authReady, authUser?.uid])
    );


    const onCreate = async () => {
        try {
            if (!authReady || !authUser) {
                Alert.alert("Sesión", "Tu sesión todavía se está restaurando. Probá de nuevo en un momento.");
                return;
            }
            const projectName = name.trim();
            if (!projectName) return;

            // 👇 pasa iconEmoji al servicio
            const id = await createProject(projectName, currency, { iconEmoji });

            setItems(prev => {
                const without = prev.filter(p => p.id !== id);
                return [{ id, name: projectName, currency, role: "owner", iconEmoji }, ...without];
            });

            setShowModal(false);
            setName("");
            setIconEmoji("🏠");
        } catch (e: any) {
            Alert.alert("Error", e?.message ?? "No se pudo crear el proyecto");
        }
    };

    const onLogout = async () => {
        try {
            await signOut(auth);
        } finally {
            await clearUser?.();
            router.replace("/");
        }
    };

    const mergedProjects = useMemo(() => {
        // Mapa por id para evitar duplicados
        const byId = new Map<string, ProjectListItem>();

        // Primero los propios (owner)
        for (const p of items) byId.set(p.id, p);

        // Luego los compartidos: si ya existe owner, lo dejamos; si no, agregamos member
        for (const p of sharedItems) {
            const existing = byId.get(p.id);
            if (!existing) byId.set(p.id, p);
            else if (existing.role !== 'owner' && p.role === 'member') byId.set(p.id, p);
        }

        // Orden (opcional): owner primero, luego member; y por nombre
        return Array.from(byId.values()).sort((a, b) => {
            if (a.role !== b.role) return a.role === 'owner' ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
    }, [items, sharedItems]);

    // const reload = async () => {
    //     try {
    //         if (!authReady || !authUser?.uid) return;
    //         const rows = await fetchOwnedProjectsOnce(authUser.uid);
    //         setItems(rows);
    //     } catch (e: any) {
    //         Alert.alert("Lectura", e?.message ?? String(e));
    //     }
    // };

    const renderItem = ({ item }: { item: ProjectListItem & { iconEmoji?: string } }) => (
        <ProjectCard
            name={item.name}
            currency={item.currency}
            role={item.role}
            iconEmoji={item.iconEmoji} // 👈 lo mostramos
            onPress={() => router.push(`/projects/${item.id}`)}
        />
    );

    if (loadingUser) {
        return (
            <View
                style={{
                    flex: 1,
                    backgroundColor: colors.bg,
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <ActivityIndicator color={colors.text} />
                <Text style={{ color: colors.textMuted, marginTop: 8 }}>Cargando…</Text>
            </View>
        );
    }


    const displayName =
        storedUser?.displayName ??
        authUser?.displayName ??
        authUser?.email?.split("@")[0] ??
        "";


    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
            <StatusBar barStyle="light-content" />

            <AppHeader onPressRight={onLogout} />

            <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
                <VersionBadge compact />
            </View>

            <GreetingBar name={displayName} />

            <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, flex: 1 }}>
                {/* Acciones superiores */}
                <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md }}>
                    <Pressable
                        onPress={() => router.push("/join")}
                        style={({ pressed }) => ({
                            flex: 1,
                            backgroundColor: colors.card,
                            paddingVertical: 12,
                            borderRadius: radius.lg,
                            alignItems: "center",
                            borderWidth: 1,
                            borderColor: colors.border,
                            opacity: pressed ? 0.85 : 1,
                        })}
                    >
                        <Text style={{ color: colors.text, fontWeight: "700" }}>Unirme por código</Text>
                    </Pressable>
                </View>

                <FlatList
                    data={mergedProjects}
                    keyExtractor={(it) => it.id}
                    renderItem={renderItem}
                    contentContainerStyle={{ paddingBottom: 120 }}
                    ListEmptyComponent={
                        <Text style={{ color: colors.textMuted }}>
                            {storedUser
                                ? "Todavía no tenés proyectos. Creá el primero arriba."
                                : "Iniciá sesión para ver tus proyectos."}
                        </Text>
                    }
                />

            </View>

            {/* FAB “+” con etiqueta */}
            <FAB onPress={() => setShowModal(true)} label="Crea un proyecto" />

            {/* Modal dark para crear proyecto (con selector de emoji) */}
            <Modal visible={showModal} transparent animationType="slide">
                <View
                    style={{
                        flex: 1,
                        backgroundColor: "rgba(0,0,0,0.55)",
                        justifyContent: "flex-end",
                    }}
                >
                    <View
                        style={{
                            backgroundColor: colors.card,
                            padding: spacing.lg,
                            borderTopLeftRadius: radius.xl,
                            borderTopRightRadius: radius.xl,
                            borderWidth: 1,
                            borderColor: colors.border,
                        }}
                    >
                        <Text
                            style={{
                                color: colors.text,
                                fontSize: 18,
                                fontWeight: "800",
                                marginBottom: spacing.md,
                            }}
                        >
                            Nuevo proyecto
                        </Text>

                        {/* Selector de icono */}
                        <Text style={{ color: colors.textMuted, marginBottom: 6 }}>Icono</Text>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: spacing.md }}>
                            {EMOJI_CHOICES.map((e) => {
                                const selected = iconEmoji === e;
                                return (
                                    <Pressable
                                        key={e}
                                        onPress={() => setIconEmoji(e)}
                                        style={{
                                            width: 44,
                                            height: 44,
                                            borderRadius: 12,
                                            alignItems: "center",
                                            justifyContent: "center",
                                            backgroundColor: selected ? colors.cardAlt : "transparent",
                                            borderWidth: 1,
                                            borderColor: selected ? colors.primary : colors.border,
                                        }}
                                    >
                                        <Text style={{ fontSize: 22 }}>{e}</Text>
                                    </Pressable>
                                );
                            })}
                        </View>

                        <Text style={{ color: colors.textMuted, marginBottom: 6 }}>Nombre</Text>
                        <TextInput
                            value={name}
                            onChangeText={setName}
                            placeholder="Hogar 2025"
                            placeholderTextColor={colors.textMuted}
                            style={{
                                color: colors.text,
                                backgroundColor: colors.cardAlt,
                                borderWidth: 1,
                                borderColor: colors.border,
                                borderRadius: 12,
                                padding: 12,
                                marginBottom: spacing.md,
                            }}
                        />

                        <Text style={{ color: colors.textMuted, marginBottom: 6 }}>Moneda</Text>
                        <TextInput
                            value={currency}
                            onChangeText={setCurrency}
                            placeholder="ARS"
                            autoCapitalize="characters"
                            placeholderTextColor={colors.textMuted}
                            style={{
                                color: colors.text,
                                backgroundColor: colors.cardAlt,
                                borderWidth: 1,
                                borderColor: colors.border,
                                borderRadius: 12,
                                padding: 12,
                                marginBottom: spacing.lg,
                            }}
                        />

                        <View style={{ flexDirection: "row", gap: spacing.sm }}>
                            <Pressable
                                onPress={() => setShowModal(false)}
                                style={({ pressed }) => ({
                                    flex: 1,
                                    paddingVertical: 12,
                                    borderRadius: 12,
                                    alignItems: "center",
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                    backgroundColor: colors.cardAlt,
                                    opacity: pressed ? 0.85 : 1,
                                })}
                            >
                                <Text style={{ color: colors.text }}>Cancelar</Text>
                            </Pressable>

                            <Pressable
                                onPress={onCreate}
                                disabled={!canCreate}
                                style={({ pressed }) => ({
                                    flex: 1,
                                    paddingVertical: 12,
                                    borderRadius: 12,
                                    alignItems: "center",
                                    backgroundColor: colors.primary,
                                    opacity: !canCreate || pressed ? 0.6 : 1,
                                })}
                            >
                                <Text style={{ color: "white", fontWeight: "700" }}>Crear</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );

}
