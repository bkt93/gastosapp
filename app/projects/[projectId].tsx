// app/projects/[projectId].tsx
import { useLocalSearchParams, useRouter } from "expo-router";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
    Share,
    StatusBar,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../../src/firebase";

import {
    generateInvite,
    revokeInvite,
    subscribePendingInvites,
    type PendingInvite,
} from "../../src/services/invites";

import {
    subscribeProjectMembers,
    type ProjectMember,
} from "../../src/services/members.read";

import { deleteProjectDeep, updateProject } from "../../src/services/projects";

import AppHeader from "../../src/components/AppHeader";
import { colors, radius, spacing } from "../../src/theme";

// KPIs
import { listenMonthExpenses } from "../../src/services/expenses";
import { ensureSelfMembership } from "../../src/services/members.write";
import { listenPendingServices } from "../../src/services/services";
import { toYearMonth } from "../../src/utils/date";

// ---------------- FeatureTile (interno para este screen) ----------------
function FeatureTile({
    icon,
    title,
    subtitle,
    onPress,
}: {
    icon?: string;
    title: string;
    subtitle?: string;
    onPress?: () => void;
}) {
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => ({
                backgroundColor: colors.card,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                paddingVertical: spacing.lg,
                paddingHorizontal: spacing.lg,
                opacity: pressed ? 0.92 : 1,
            })}
        >
            <View
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                    {!!icon && <Text style={{ fontSize: 28, marginRight: 10 }}>{icon}</Text>}
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
                        {title}
                    </Text>
                </View>
                <Text style={{ color: colors.textMuted, fontSize: 22, marginLeft: 8 }}>›</Text>
            </View>

            {!!subtitle && (
                <Text style={{ color: colors.textMuted, marginTop: 6 }}>{subtitle}</Text>
            )}
        </Pressable>
    );
}
// ------------------------------------------------------------------------

type ProjectDoc = {
    name: string;
    currency: string;
    ownerUid: string;
    iconEmoji?: string;
};

// Alias local con displayName opcional
type PM = ProjectMember & { displayName?: string | null };

export default function ProjectScreen() {
    const { projectId } = useLocalSearchParams<{ projectId: string }>();
    const router = useRouter();

    const [project, setProject] = useState<ProjectDoc | null>(null);
    const [loadErr, setLoadErr] = useState<string | null>(null);

    const [authUser, setAuthUser] = useState<User | null>(null);
    const isOwner = !!authUser?.uid && project?.ownerUid === authUser.uid;

    // edición
    const [editOpen, setEditOpen] = useState(false);
    const [name, setName] = useState("");
    const [currency, setCurrency] = useState("ARS");

    // modales nuevos
    const [membersOpen, setMembersOpen] = useState(false);
    const [invitesOpen, setInvitesOpen] = useState(false);

    // invites
    const [pending, setPending] = useState<PendingInvite[]>([]);
    const currentInvite = pending[0] ?? null;

    // miembros
    const [members, setMembers] = useState<PM[]>([]);

    // KPIs
    const [monthTotalCents, setMonthTotalCents] = useState(0);
    const [pendingCount, setPendingCount] = useState(0);
    const [nextDue, setNextDue] = useState<Date | null>(null);

    useEffect(() => {
        const unsubAuth = onAuthStateChanged(auth, setAuthUser);
        return () => unsubAuth();
    }, []);

    // Proyecto
    useEffect(() => {
        if (!projectId) return;
        const unsub = onSnapshot(
            doc(db, "projects", String(projectId)),
            (snap) => {
                const d = snap.data() as any;
                if (d) {
                    setProject({
                        name: d.name,
                        currency: d.currency,
                        ownerUid: d.ownerUid,
                        iconEmoji: d.iconEmoji,
                    });
                    setLoadErr(null);
                } else {
                    setLoadErr("Proyecto no encontrado");
                }
            },
            (err) => {
                console.log("project onSnapshot error:", err);
                setLoadErr("No tenés permiso para ver este proyecto o fue eliminado.");
            }
        );
        return () => unsub();
    }, [projectId]);

    // Miembros
    useEffect(() => {
        if (!projectId) return;
        const unsub = subscribeProjectMembers(String(projectId), (rows: PM[]) => {
            setMembers(rows);
        });
        ensureSelfMembership(String(projectId)).catch(() => {});
        return () => unsub();
    }, [projectId]);

    // Invites
    useEffect(() => {
        if (!projectId) return;
        const unsub = subscribePendingInvites(String(projectId), (rows) => {
            const sorted = [...rows].sort(
                (a, b) => b.expiresAt.getTime() - a.expiresAt.getTime()
            );
            setPending(sorted);
        });
        return () => unsub();
    }, [projectId]);

    // KPIs: gastos del mes actual
    useEffect(() => {
        if (!projectId) return;
        const ym = toYearMonth(new Date());
        const unsub = listenMonthExpenses(String(projectId), ym, (rows) => {
            const total = rows.reduce((acc, it) => acc + (it.amountCents ?? 0), 0);
            setMonthTotalCents(total);
        });
        return () => unsub && unsub();
    }, [projectId]);

    // KPIs: servicios pendientes
    useEffect(() => {
        if (!projectId) return;
        const unsub = listenPendingServices(String(projectId), (rows) => {
            setPendingCount(rows.length);
            if (rows.length > 0) {
                const sorted = [...rows].sort(
                    (a, b) => a.dueDate.getTime() - b.dueDate.getTime()
                );
                setNextDue(sorted[0].dueDate);
            } else {
                setNextDue(null);
            }
        });
        return () => unsub && unsub();
    }, [projectId]);

    // ------- acciones -------
    const openEdit = () => {
        if (!project) return;
        setName(project.name);
        setCurrency(project.currency);
        setEditOpen(true);
    };

    const saveEdit = async () => {
        try {
            await updateProject(String(projectId), {
                name: name.trim(),
                currency: currency.trim(),
            });
        } catch (e: any) {
            Alert.alert("Error", e?.message ?? "No se pudo actualizar");
        } finally {
            setEditOpen(false);
        }
    };

    const confirmDelete = () => {
        Alert.alert(
            "Eliminar proyecto",
            "Esta acción no se puede deshacer. ¿Querés eliminar el proyecto y sus invitaciones/miembros?",
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Eliminar",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await deleteProjectDeep(String(projectId));
                            router.replace("/home");
                        } catch (e: any) {
                            Alert.alert("Error", e?.message ?? "No se pudo eliminar");
                        }
                    },
                },
            ]
        );
    };

    const onGenerate = async () => {
        try {
            await generateInvite(String(projectId));
        } catch (e: any) {
            Alert.alert("Invitar", e?.message ?? "No se pudo generar la invitación");
        }
    };

    const onShare = async () => {
        if (!currentInvite) return;
        const msg =
            `Sumate a mi proyecto en GastosApp.\n` +
            `Código: ${currentInvite.code}\n\n` +
            `Abrí la app y usá "Unirme por código".`;
        try {
            await Share.share({ message: msg });
        } catch { }
    };

    const onRevoke = async () => {
        if (!currentInvite) return;
        try {
            await revokeInvite(currentInvite.id);
        } catch (e: any) {
            Alert.alert("Invitar", e?.message ?? "No se pudo revocar la invitación");
        }
    };

    // helpers visuales
    const roleBadge = useMemo(() => {
        const label = isOwner ? "Propietario" : "Miembro";
        const bg = colors.cardAlt;
        const border = colors.border;
        const text = colors.textMuted;
        return { label, bg, border, text };
    }, [isOwner]);

    const currencyCode = project?.currency || "ARS";
    const monthSubtitle = useMemo(() => {
        try {
            const formatted = new Intl.NumberFormat("es-AR", {
                style: "currency",
                currency: currencyCode,
                maximumFractionDigits: 2,
            }).format(monthTotalCents / 100);
            return `Total mes: ${formatted}`;
        } catch {
            return `Total mes: ${currencyCode} ${(monthTotalCents / 100).toFixed(2)}`;
        }
    }, [monthTotalCents, currencyCode]);

    const servicesSubtitle = useMemo(() => {
        const base = `${pendingCount} pendiente${pendingCount === 1 ? "" : "s"}`;
        return nextDue
            ? `${base} · Próximo: ${nextDue.toLocaleDateString()}`
            : base;
    }, [pendingCount, nextDue]);

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
            <StatusBar barStyle="light-content" />
            <AppHeader />

            <View
                style={{
                    flex: 1,
                    paddingHorizontal: spacing.lg,
                    paddingTop: spacing.md,
                }}
            >
                {/* Loading / Error */}
                {!project && !loadErr ? (
                    <View
                        style={{
                            flex: 1,
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                        }}
                    >
                        <ActivityIndicator color={colors.text} />
                        <Text style={{ color: colors.textMuted }}>Cargando…</Text>
                    </View>
                ) : null}

                {loadErr ? (
                    <View
                        style={{
                            backgroundColor: colors.card,
                            borderRadius: radius.lg,
                            borderWidth: 1,
                            borderColor: colors.border,
                            padding: spacing.lg,
                        }}
                    >
                        <Text style={{ color: colors.danger, fontWeight: "700" }}>
                            {loadErr}
                        </Text>
                    </View>
                ) : null}

                {project && !loadErr ? (
                    <>
                        {/* Header del proyecto */}
                        <View
                            style={{
                                backgroundColor: colors.card,
                                borderRadius: radius.lg,
                                borderWidth: 1,
                                borderColor: colors.border,
                                padding: spacing.lg,
                                marginBottom: spacing.md,
                            }}
                        >
                            <View
                                style={{
                                    flexDirection: "row",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                }}
                            >
                                <View style={{ flexDirection: "row", alignItems: "center" }}>
                                    {!!project.iconEmoji && (
                                        <Text style={{ fontSize: 26, marginRight: 8 }}>
                                            {project.iconEmoji}
                                        </Text>
                                    )}
                                    <Text
                                        style={{
                                            color: colors.text,
                                            fontSize: 20,
                                            fontWeight: "800",
                                        }}
                                    >
                                        {project.name}
                                    </Text>
                                </View>

                                <View
                                    style={{
                                        paddingHorizontal: 10,
                                        paddingVertical: 4,
                                        borderRadius: 999,
                                        backgroundColor: roleBadge.bg,
                                        borderWidth: 1,
                                        borderColor: roleBadge.border,
                                    }}
                                >
                                    <Text
                                        style={{
                                            color: roleBadge.text,
                                            fontSize: 12,
                                            fontWeight: "700",
                                        }}
                                    >
                                        {roleBadge.label}
                                    </Text>
                                </View>
                            </View>

                            <Text style={{ color: colors.textMuted, marginTop: 6 }}>
                                Moneda: {project.currency}
                            </Text>

                            {/* Fila 1 (acciones owner) */}
                            {isOwner ? (
                                <View
                                    style={{
                                        flexDirection: "row",
                                        gap: spacing.sm,
                                        marginTop: spacing.md,
                                    }}
                                >
                                    <Pressable
                                        onPress={openEdit}
                                        style={({ pressed }) => ({
                                            flex: 1,
                                            paddingVertical: 12,
                                            borderRadius: 12,
                                            alignItems: "center",
                                            backgroundColor: colors.cardAlt,
                                            borderWidth: 1,
                                            borderColor: colors.border,
                                            opacity: pressed ? 0.85 : 1,
                                        })}
                                    >
                                        <Text style={{ color: colors.text, fontWeight: "700" }}>
                                            Editar
                                        </Text>
                                    </Pressable>

                                    <Pressable
                                        onPress={confirmDelete}
                                        style={({ pressed }) => ({
                                            flex: 1,
                                            paddingVertical: 12,
                                            borderRadius: 12,
                                            alignItems: "center",
                                            borderWidth: 1,
                                            borderColor: colors.danger,
                                            backgroundColor: "transparent",
                                            opacity: pressed ? 0.85 : 1,
                                        })}
                                    >
                                        <Text style={{ color: colors.danger, fontWeight: "700" }}>
                                            Eliminar
                                        </Text>
                                    </Pressable>
                                </View>
                            ) : null}

                            {/* Fila 2 (modales: miembros + invitaciones) */}
                            <View
                                style={{
                                    flexDirection: "row",
                                    gap: spacing.sm,
                                    marginTop: spacing.sm,
                                }}
                            >
                                <Pressable
                                    onPress={() => setMembersOpen(true)}
                                    style={({ pressed }) => ({
                                        flex: isOwner ? 1 : 1,
                                        paddingVertical: 12,
                                        borderRadius: 12,
                                        alignItems: "center",
                                        backgroundColor: colors.cardAlt,
                                        borderWidth: 1,
                                        borderColor: colors.border,
                                        opacity: pressed ? 0.85 : 1,
                                    })}
                                >
                                    <Text style={{ color: colors.text, fontWeight: "700" }}>
                                        👥 Miembros
                                    </Text>
                                </Pressable>

                                {isOwner ? (
                                    <Pressable
                                        onPress={() => setInvitesOpen(true)}
                                        style={({ pressed }) => ({
                                            flex: 1,
                                            paddingVertical: 12,
                                            borderRadius: 12,
                                            alignItems: "center",
                                            backgroundColor: colors.cardAlt,
                                            borderWidth: 1,
                                            borderColor: colors.border,
                                            opacity: pressed ? 0.85 : 1,
                                        })}
                                    >
                                        <Text style={{ color: colors.text, fontWeight: "700" }}>
                                            ✉️ Invitaciones
                                        </Text>
                                    </Pressable>
                                ) : null}
                            </View>
                        </View>

                        {/* Feature Tiles */}
                        <View style={{ flexDirection: "column", gap: spacing.sm }}>
                            <FeatureTile
                                icon="💸"
                                title="Gastos"
                                subtitle={monthSubtitle}
                                onPress={() =>
                                    router.push({
                                        pathname: "/expenses",
                                        params: { projectId: String(projectId) },
                                    })
                                }
                            />
                            <FeatureTile
                                icon="💡"
                                title="Servicios"
                                subtitle={servicesSubtitle}
                                onPress={() =>
                                    router.push({
                                        pathname: "/services",
                                        params: { projectId: String(projectId) },
                                    })
                                }
                            />
                        </View>
                    </>
                ) : null}
            </View>

            {/* Modal Editar (dark) */}
            <Modal visible={editOpen} transparent animationType="slide">
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
                            Editar proyecto
                        </Text>

                        <Text style={{ color: colors.textMuted, marginBottom: 6 }}>Nombre</Text>
                        <TextInput
                            value={name}
                            onChangeText={setName}
                            placeholder="Mi hogar"
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
                            autoCapitalize="characters"
                            placeholder="ARS"
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
                                onPress={() => setEditOpen(false)}
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
                                onPress={saveEdit}
                                style={({ pressed }) => ({
                                    flex: 1,
                                    paddingVertical: 12,
                                    borderRadius: 12,
                                    alignItems: "center",
                                    backgroundColor: colors.primary,
                                    opacity: pressed ? 0.85 : 1,
                                })}
                            >
                                <Text style={{ color: "white", fontWeight: "700" }}>Guardar</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Modal Miembros */}
            <Modal visible={membersOpen} transparent animationType="slide">
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
                            maxHeight: "80%",
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
                            Miembros del proyecto
                        </Text>

                        {members.length === 0 ? (
                            <Text style={{ color: colors.textMuted }}>No hay miembros aún.</Text>
                        ) : (
                            <View>
                                {members
                                    .slice()
                                    .sort(
                                        (a, b) =>
                                            (a.role === "owner" ? -1 : 1) -
                                            (b.role === "owner" ? -1 : 1) ||
                                            (a.displayName ?? "").localeCompare(b.displayName ?? "")
                                    )
                                    .map((m) => {
                                        const isSelf = m.uid === authUser?.uid;
                                        const name = m.displayName?.trim() || m.uid.slice(0, 6) + "…";
                                        return (
                                            <View
                                                key={m.uid}
                                                style={{
                                                    paddingVertical: 10,
                                                    borderBottomWidth: 1,
                                                    borderBottomColor: colors.border,
                                                }}
                                            >
                                                <View
                                                    style={{
                                                        flexDirection: "row",
                                                        justifyContent: "space-between",
                                                        alignItems: "center",
                                                    }}
                                                >
                                                    <Text style={{ color: colors.text, fontWeight: "700" }}>
                                                        {name}
                                                        {isSelf ? " (vos)" : ""}
                                                    </Text>
                                                    <Text
                                                        style={{
                                                            color: colors.textMuted,
                                                            fontSize: 12,
                                                            fontWeight: "600",
                                                        }}
                                                    >
                                                        {m.role === "owner" ? "Propietario" : "Miembro"}
                                                    </Text>
                                                </View>
                                                {m.joinedAt && (
                                                    <Text
                                                        style={{
                                                            color: colors.textMuted,
                                                            marginTop: 2,
                                                            fontSize: 12,
                                                        }}
                                                    >
                                                        Se unió: {m.joinedAt.toLocaleDateString()}{" "}
                                                        {m.joinedAt.toLocaleTimeString()}
                                                    </Text>
                                                )}
                                            </View>
                                        );
                                    })}
                            </View>
                        )}

                        <View style={{ marginTop: spacing.lg }}>
                            <Pressable
                                onPress={() => setMembersOpen(false)}
                                style={({ pressed }) => ({
                                    paddingVertical: 12,
                                    borderRadius: 12,
                                    alignItems: "center",
                                    backgroundColor: colors.cardAlt,
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                    opacity: pressed ? 0.85 : 1,
                                })}
                            >
                                <Text style={{ color: colors.text, fontWeight: "700" }}>Cerrar</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Modal Invitaciones (solo owner) */}
            <Modal visible={invitesOpen} transparent animationType="slide">
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
                            Invitaciones
                        </Text>

                        {currentInvite ? (
                            <>
                                <Text style={{ color: colors.textMuted, marginBottom: 6 }}>
                                    Código vigente:
                                </Text>
                                <Text
                                    style={{
                                        color: colors.text,
                                        fontSize: 22,
                                        fontWeight: "900",
                                        letterSpacing: 2,
                                        marginBottom: 6,
                                    }}
                                >
                                    {currentInvite.code}
                                </Text>
                                <Text style={{ color: colors.textMuted, marginBottom: spacing.md }}>
                                    Expira: {currentInvite.expiresAt.toLocaleDateString()}{" "}
                                    {currentInvite.expiresAt.toLocaleTimeString()}
                                </Text>

                                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                                    <Pressable
                                        onPress={onShare}
                                        style={({ pressed }) => ({
                                            flex: 1,
                                            paddingVertical: 12,
                                            borderRadius: 12,
                                            alignItems: "center",
                                            backgroundColor: colors.primary,
                                            opacity: pressed ? 0.85 : 1,
                                        })}
                                    >
                                        <Text style={{ color: "white", fontWeight: "700" }}>
                                            Compartir
                                        </Text>
                                    </Pressable>

                                    <Pressable
                                        onPress={onRevoke}
                                        style={({ pressed }) => ({
                                            flex: 1,
                                            paddingVertical: 12,
                                            borderRadius: 12,
                                            alignItems: "center",
                                            borderWidth: 1,
                                            borderColor: colors.danger,
                                            opacity: pressed ? 0.85 : 1,
                                        })}
                                    >
                                        <Text style={{ color: colors.danger, fontWeight: "700" }}>
                                            Revocar
                                        </Text>
                                    </Pressable>
                                </View>
                            </>
                        ) : (
                            <>
                                <Text style={{ color: colors.textMuted, marginBottom: spacing.md }}>
                                    No hay invitaciones pendientes. Generá un código nuevo.
                                </Text>
                                <Pressable
                                    onPress={onGenerate}
                                    style={({ pressed }) => ({
                                        paddingVertical: 12,
                                        borderRadius: 12,
                                        alignItems: "center",
                                        backgroundColor: colors.primary,
                                        opacity: pressed ? 0.85 : 1,
                                    })}
                                >
                                    <Text style={{ color: "white", fontWeight: "700" }}>
                                        Generar invitación
                                    </Text>
                                </Pressable>
                            </>
                        )}

                        <View style={{ marginTop: spacing.lg }}>
                            <Pressable
                                onPress={() => setInvitesOpen(false)}
                                style={({ pressed }) => ({
                                    paddingVertical: 12,
                                    borderRadius: 12,
                                    alignItems: "center",
                                    backgroundColor: colors.cardAlt,
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                    opacity: pressed ? 0.85 : 1,
                                })}
                            >
                                <Text style={{ color: colors.text, fontWeight: "700" }}>Cerrar</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
