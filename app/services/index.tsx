// app/services/index.tsx — Similar a Expenses: mes, agrupado por día, muestra pendientes y pagados
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Link, Stack, useLocalSearchParams, useRouter } from "expo-router";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    Platform,
    Pressable,
    SectionList,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AppHeader from "../../src/components/AppHeader";
import FAB from "../../src/components/FAB";
import { auth, db } from "../../src/firebase";
import { cancelServiceReminders, scheduleServiceReminders } from "../../src/notifications/services-reminders";
import { subscribeProjectMembers, type ProjectMember } from "../../src/services/members.read";
import { markServiceAsPaid, type Service } from "../../src/services/services";
import { colors, radius, spacing } from "../../src/theme";
import { formatARS } from "../../src/utils/money";

// --- helpers de fecha (local) ---
const pad2 = (n: number) => String(n).padStart(2, "0");
// clave yyyy-mm-dd en **zona local**
const keyFromLocalDate = (d: Date) =>
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const formatDayHeader = (d: Date) =>
    new Intl.DateTimeFormat("es-AR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
    }).format(d);

// rango de mes local
function monthRange(d: Date) {
    const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1, 0, 0, 0, 0);
    return { start, end };
}

export default function ServicesIndex() {
    const { projectId, projectName } = useLocalSearchParams<{ projectId: string; projectName?: string }>();
    const router = useRouter();

    if (!projectId) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
                <View style={{ padding: spacing.xl }}>
                    <Text style={{ color: colors.text }}>Falta projectId</Text>
                </View>
            </SafeAreaView>
        );
    }

    // ===== estado de mes =====
    const [cursor, setCursor] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });
    const { start, end } = useMemo(() => monthRange(cursor), [cursor]);
    const yearMonth = useMemo(
        () =>
            new Intl.DateTimeFormat("es-AR", { year: "numeric", month: "long" }).format(start),
        [start]
    );
    const nextMonth = () => setCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
    const prevMonth = () => setCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));

    // ===== data =====
    const [items, setItems] = useState<Service[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // miembros -> mapa uid => displayName (fallback)
    const [members, setMembers] = useState<ProjectMember[]>([]);
    useEffect(() => subscribeProjectMembers(String(projectId), setMembers), [projectId]);

    const nameByUid = useMemo(() => {
        const map = new Map<string, string>();
        members.forEach((m) =>
            map.set(m.uid, (m as any).displayName || `Miembro ${m.uid.slice(0, 6)}`)
        );
        return map;
    }, [members]);

    // snapshot del mes: incluye pending + paid
    useEffect(() => {
        setLoading(true);
        setError(null);

        // ⚠️ Firestore guarda Timestamp; convertimos a Date
        const col = collection(db, "projects", String(projectId), "services");
        const q = query(
            col,
            where("dueDate", ">=", start),
            where("dueDate", "<", end),
            orderBy("dueDate", "desc") // igual que expenses: días DESC
        );

        const unsub = onSnapshot(
            q,
            async (snap) => {
                const rows: Service[] = snap.docs.map((d) => {
                    const data: any = d.data();
                    return {
                        id: d.id,
                        ...data,
                        dueDate: data.dueDate?.toDate ? data.dueDate.toDate() : new Date(data.dueDate),
                        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
                        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt,
                    };
                });

                setItems(rows);
                setLoading(false);

                // Agendar notis solo para PENDIENTES con vencimiento futuro/hoY
                for (const s of rows) {
                    if (s.status === "paid") continue;
                    const today = new Date(); today.setHours(0, 0, 0, 0);
                    const due = new Date(s.dueDate); due.setHours(0, 0, 0, 0);
                    if (due >= today) {
                        await scheduleServiceReminders(s.id, s.title, s.dueDate, formatARS(s.amountCents));
                    }
                }
            },
            (e) => {
                console.error(e);
                setError(e?.message ?? "Error cargando servicios");
                setLoading(false);
            }
        );

        return () => unsub();
    }, [projectId, start.getTime(), end.getTime()]);

    // Agrupar por día (local) dentro del mes — días DESC como Expenses
    const sections = useMemo(() => {
        const byDay = new Map<string, { date: Date; items: Service[] }>();

        items.forEach((s) => {
            const d = new Date(s.dueDate);
            const key = keyFromLocalDate(d);
            if (!byDay.has(key)) byDay.set(key, { date: new Date(d), items: [] });
            byDay.get(key)!.items.push(s);
        });

        const days = Array.from(byDay.values()).sort(
            (a, b) => b.date.getTime() - a.date.getTime()
        );

        return days.map(({ date, items }) => {
            const data = items.sort(
                (a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()
            );
            return { title: formatDayHeader(date), data };
        });
    }, [items]);

    // ===== Modal pagar minimal =====
    const [modal, setModal] = useState<{ open: boolean; service?: Service }>({ open: false });
    const [paidAt, setPaidAt] = useState(new Date());
    const [paidByUid, setPaidByUid] = useState<string>("");
    const [paidByName, setPaidByName] = useState<string>("");
    const [showPaidPicker, setShowPaidPicker] = useState(false);
    const [savingPaid, setSavingPaid] = useState(false);

    function openPay(s: Service) {
        setModal({ open: true, service: s });
        setShowPaidPicker(false);
        setPaidAt(new Date());
        const uid = s.assignedToUid || s.createdByUid;
        const fallbackName = nameByUid.get(uid) || s.assignedToName || s.createdByName || "Miembro";
        setPaidByUid(uid);
        setPaidByName(fallbackName);
    }

    async function confirmPay() {
        const s = modal.service!;
        if (!paidByUid) {
            Alert.alert("Falta selección", "Elegí quién pagó el servicio.");
            return;
        }
        try {
            setSavingPaid(true);
            await markServiceAsPaid(String(projectId), s.id, {
                paidAt,
                paidByUid,
                paidByName,
                createdByUid: auth.currentUser?.uid || paidByUid,
            });
            await cancelServiceReminders(s.id);
            setSavingPaid(false);
            setModal({ open: false });
            // Se queda en la lista; el snapshot ahora lo mostrará como "Pagado"
        } catch (e: any) {
            setSavingPaid(false);
            Alert.alert("Error", e?.message ?? "No se pudo marcar como pagado");
        }
    }

    const openEdit = useCallback(
        (s: Service) => {
            router.push({
                pathname: `/services/${s.id}/edit`,
                params: { projectId: String(projectId) },
            });
        },
        [projectId, router]
    );

    // ===== UI =====
    if (loading) {
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

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Un solo header */}
            <AppHeader
                onPressLeft={() => router.back()}
                leftIcon="chevron-back"
                title="Servicios"
                subtitle={projectName ?? undefined}
            />

            <View style={{ flex: 1, paddingHorizontal: spacing.xl }}>
                <SectionList
                    sections={sections}
                    keyExtractor={(it) => it.id}
                    contentContainerStyle={{ paddingBottom: spacing.xl * 6 }}
                    ListHeaderComponent={
                        <View style={{ paddingTop: spacing.md, paddingBottom: spacing.md }}>
                            {/* Selector de mes (igual que Expenses) */}
                            <View
                                style={{
                                    backgroundColor: colors.card,
                                    borderRadius: radius.xl,
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                    padding: spacing.xs,
                                    flexDirection: "row",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                }}
                            >
                                <NavButton label="‹" onPress={prevMonth} />
                                <Text
                                    style={{
                                        color: colors.text,
                                        fontWeight: "700",
                                        letterSpacing: 0.3,
                                    }}
                                >
                                    {yearMonth}
                                </Text>
                                <NavButton label="›" onPress={nextMonth} />
                            </View>
                        </View>
                    }
                    ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
                    renderSectionHeader={({ section }) => (
                        <Text
                            style={{
                                marginTop: spacing.lg,
                                marginBottom: spacing.xs,
                                color: colors.textMuted,
                                fontSize: 12,
                            }}
                        >
                            {section.title}
                        </Text>
                    )}
                    renderItem={({ item }) => {
                        const assigned =
                            (item.assignedToUid && nameByUid.get(item.assignedToUid)) ||
                            item.assignedToName ||
                            undefined;
                        const isPaid = item.status === "paid";

                        return (
                            <Pressable
                                onPress={() => openEdit(item)} // Tap en la card → Editar
                                style={({ pressed }) => ({
                                    backgroundColor: colors.card,
                                    paddingVertical: spacing.md,
                                    paddingHorizontal: spacing.lg,
                                    borderRadius: radius.lg,
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                    opacity: pressed ? 0.92 : isPaid ? 0.8 : 1,
                                })}
                                accessibilityRole="button"
                                accessibilityLabel={`Editar servicio ${item.title}`}
                            >
                                {/* fila superior: título + monto / badge */}
                                <View
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                    }}
                                >
                                    {/* izquierda */}
                                    <View style={{ flexShrink: 1, paddingRight: spacing.md }}>
                                        <Text
                                            style={{ color: colors.text, fontWeight: "700" }}
                                            numberOfLines={1}
                                        >
                                            {item.title}
                                        </Text>
                                        <Text
                                            style={{ color: colors.textMuted, marginTop: 2 }}
                                            numberOfLines={1}
                                        >
                                            {item.type} • vence{" "}
                                            {new Intl.DateTimeFormat("es-AR").format(new Date(item.dueDate))}
                                            {assigned ? ` • Asignado: ${assigned}` : ""}
                                        </Text>
                                    </View>

                                    {/* derecha */}
                                    <View style={{ alignItems: "flex-end", gap: 6 }}>
                                        <Text style={{ color: colors.text, fontWeight: "700" }}>
                                            {formatARS(item.amountCents)}
                                        </Text>

                                        {/* acción/badge minimalista */}
                                        {isPaid ? (
                                            <View
                                                style={{
                                                    paddingVertical: 4,
                                                    paddingHorizontal: 10,
                                                    borderRadius: 999,
                                                    backgroundColor: "rgba(76,175,80,0.16)",
                                                    borderWidth: 1,
                                                    borderColor: colors.border,
                                                }}
                                            >
                                                <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>
                                                    Pagado
                                                </Text>
                                            </View>
                                        ) : (
                                            <Pressable
                                                onPress={(e) => {
                                                    e.stopPropagation();
                                                    openPay(item);
                                                }}
                                                style={({ pressed }) => ({
                                                    paddingVertical: 4,
                                                    paddingHorizontal: 10,
                                                    borderRadius: 999,
                                                    borderWidth: 1,
                                                    borderColor: colors.border,
                                                    backgroundColor: pressed ? colors.cardAlt : "transparent",
                                                })}
                                                accessibilityRole="button"
                                                accessibilityLabel="Marcar pagado"
                                                hitSlop={6}
                                            >
                                                <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>
                                                    Pagar
                                                </Text>
                                            </Pressable>
                                        )}
                                    </View>
                                </View>
                            </Pressable>
                        );
                    }}
                    ListEmptyComponent={
                        !loading && !error ? (
                            <View
                                style={{
                                    alignItems: "center",
                                    paddingVertical: spacing.xl,
                                    gap: spacing.xs,
                                }}
                            >
                                <Text style={{ color: colors.textMuted }}>
                                    No hay servicios en {yearMonth}.
                                </Text>
                                <Link
                                    href={{
                                        pathname: "/services/new",
                                        params: { projectId: String(projectId) },
                                    }}
                                    asChild
                                >
                                    <Pressable
                                        style={({ pressed }) => ({
                                            marginTop: spacing.sm,
                                            paddingVertical: spacing.sm,
                                            paddingHorizontal: spacing.lg,
                                            borderRadius: radius.lg,
                                            borderWidth: 1,
                                            borderColor: colors.border,
                                            backgroundColor: colors.card,
                                            opacity: pressed ? 0.85 : 1,
                                        })}
                                    >
                                        <Text style={{ color: colors.text, fontWeight: "700" }}>
                                            Crear el primero
                                        </Text>
                                    </Pressable>
                                </Link>
                            </View>
                        ) : null
                    }
                    ListFooterComponent={
                        <>
                            {loading && (
                                <View style={{ paddingVertical: spacing.lg }}>
                                    <ActivityIndicator color={colors.text} />
                                </View>
                            )}
                            {error && (
                                <Text
                                    style={{
                                        color: colors.danger,
                                        marginTop: spacing.sm,
                                        textAlign: "center",
                                    }}
                                >
                                    {error}
                                </Text>
                            )}
                        </>
                    }
                />

                <FAB
                    onPress={() =>
                        router.push({
                            pathname: "/services/new",
                            params: { projectId: String(projectId) },
                        })
                    }
                    label="Añadir servicio"
                />
            </View>

            {/* Modal pagar (compacto) */}
            <Modal
                visible={modal.open}
                transparent
                animationType="slide"
                onRequestClose={() => setModal({ open: false })}
            >
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
                            gap: spacing.sm,
                        }}
                    >
                        <Text
                            style={{
                                color: colors.text,
                                fontSize: 18,
                                fontWeight: "800",
                                marginBottom: spacing.xs,
                            }}
                        >
                            Confirmar pago
                        </Text>

                        {/* Fecha de pago */}
                        <Text style={{ color: colors.textMuted }}>Fecha de pago</Text>
                        <Pressable
                            onPress={() => setShowPaidPicker(true)}
                            style={{
                                backgroundColor: colors.cardAlt,
                                borderRadius: 12,
                                padding: 12,
                                borderWidth: 1,
                                borderColor: colors.border,
                            }}
                        >
                            <Text style={{ color: colors.text }}>
                                {paidAt.toLocaleDateString("es-AR")}
                            </Text>
                            <Text style={{ color: colors.textMuted, marginTop: 4 }}>
                                Tocar para elegir fecha
                            </Text>
                        </Pressable>

                        {showPaidPicker && (
                            <DateTimePicker
                                value={paidAt}
                                mode="date"
                                display={Platform.OS === "ios" ? "inline" : "default"}
                                onChange={(event: DateTimePickerEvent, date?: Date) => {
                                    if (Platform.OS === "android") setShowPaidPicker(false);
                                    if (event.type === "set" && date) {
                                        setPaidAt(date);
                                        if (Platform.OS === "ios") setShowPaidPicker(false);
                                    } else if (event.type === "dismissed") {
                                        setShowPaidPicker(false);
                                    }
                                }}
                            />
                        )}

                        {/* Pagado por */}
                        <Text style={{ color: colors.textMuted, marginTop: spacing.sm }}>
                            Pagado por
                        </Text>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                            {members.map((m) => {
                                const name =
                                    (m as any).displayName || `Miembro ${m.uid.slice(0, 6)}`;
                                const selected = paidByUid === m.uid;
                                return (
                                    <Pressable
                                        key={m.uid}
                                        onPress={() => {
                                            setPaidByUid(m.uid);
                                            setPaidByName(name);
                                        }}
                                        style={{
                                            paddingVertical: 8,
                                            paddingHorizontal: 12,
                                            borderRadius: 999,
                                            borderWidth: 1,
                                            borderColor: selected ? colors.primary : colors.border,
                                            backgroundColor: selected ? colors.cardAlt : "transparent",
                                        }}
                                    >
                                        <Text style={{ color: colors.text }}>{name}</Text>
                                    </Pressable>
                                );
                            })}
                        </View>

                        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
                            <Pressable
                                onPress={() => setModal({ open: false })}
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
                                onPress={confirmPay}
                                disabled={savingPaid}
                                style={({ pressed }) => ({
                                    flex: 1,
                                    paddingVertical: 12,
                                    borderRadius: 12,
                                    alignItems: "center",
                                    backgroundColor: colors.primary,
                                    opacity: savingPaid || pressed ? 0.6 : 1,
                                })}
                            >
                                <Text style={{ color: "white", fontWeight: "700" }}>
                                    {savingPaid ? "Guardando…" : "Confirmar"}
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

function NavButton({
    label,
    onPress,
}: {
    label: string;
    onPress: () => void;
}) {
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => ({
                paddingVertical: spacing.xs,
                paddingHorizontal: spacing.lg,
                borderRadius: radius.lg,
                backgroundColor: "rgba(255,255,255,0.06)",
                opacity: pressed ? 0.85 : 1,
            })}
            accessibilityRole="button"
            accessibilityLabel={
                label === "‹" ? "Mes anterior" : label === "›" ? "Mes siguiente" : ""
            }
            hitSlop={8}
        >
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700" }}>
                {label}
            </Text>
        </Pressable>
    );
}
