// app/expenses/index.tsx — Listado mensual con filtro por integrante y contribuciones
import { Link, Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    SectionList,
    Text,
    View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import BottomFade from "../../components/BottonFade";
import { getCategoryEmoji } from "../../constants/categories";
import { useMonthExpenses } from "../../hooks/useMonthExpenses";
import AppHeader from "../../src/components/AppHeader";
import FAB from "../../src/components/FAB";
import type { Expense } from "../../src/models";
import {
    subscribeProjectMembers,
    type ProjectMember,
} from "../../src/services/members.read";
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

// usa tus campos Date (date || createdAt)
const getDateValue = (e: Expense): Date => e.date ?? e.createdAt;

export default function ExpensesIndex() {

    const insets = useSafeAreaInsets();

    const { projectId, projectName } = useLocalSearchParams<{
        projectId: string;
        projectName?: string;
    }>();
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

    const {
        items,
        totalCents,
        yearMonth,
        loading,
        error,
        nextMonth,
        prevMonth,
    } = useMonthExpenses(String(projectId));

    // miembros -> mapa uid => displayName (fallback)
    const [members, setMembers] = useState<ProjectMember[]>([]);
    useEffect(
        () => subscribeProjectMembers(String(projectId), setMembers),
        [projectId]
    );

    const nameByUid = useMemo(() => {
        const map = new Map<string, string>();
        members.forEach((m) =>
            map.set(
                m.uid,
                (m as any).displayName || `Miembro ${m.uid.slice(0, 6)}`
            )
        );
        return map;
    }, [members]);

    // ------- NUEVO: filtro por integrante + contribuciones -------
    // UID seleccionado ("ALL" = todos)
    const [selectedUid, setSelectedUid] = useState<string>("ALL");

    // Lista de miembros como {uid, name} para chips
    const memberList = useMemo(
        () =>
            members.map((m) => ({
                uid: m.uid,
                name: (m as any).displayName || `Miembro ${m.uid.slice(0, 6)}`,
            })),
        [members]
    );

    // Totales por integrante + ranking + total general del mes (en cents)
    const contrib = useMemo(() => {
        const map = new Map<string, number>();
        for (const it of items) {
            map.set(it.paidByUid, (map.get(it.paidByUid) || 0) + it.amountCents);
        }
        const arr = [...map.entries()].map(([uid, total]) => ({
            uid,
            name: nameByUid.get(uid) ?? `Miembro ${uid.slice(0, 6)}`,
            total,
        }));
        arr.sort((a, b) => b.total - a.total);
        const totalAll = arr.reduce((s, a) => s + a.total, 0);
        return { totalsByUid: map, sorted: arr, totalAll };
    }, [items, nameByUid]);

    // Aplica filtro por integrante al feed
    const filteredItems = useMemo(
        () =>
            selectedUid === "ALL"
                ? items
                : items.filter((it) => it.paidByUid === selectedUid),
        [items, selectedUid]
    );
    // ------- FIN NUEVO -------

    // Agrupar por día (local) dentro del mes – ahora con filteredItems
    const sections = useMemo(() => {
        const byDay = new Map<string, { date: Date; items: Expense[] }>();

        filteredItems.forEach((it) => {
            const d = getDateValue(it);
            const key = keyFromLocalDate(d);
            if (!byDay.has(key)) byDay.set(key, { date: new Date(d), items: [] });
            byDay.get(key)!.items.push(it);
        });

        // orden días DESC
        const days = Array.from(byDay.values()).sort(
            (a, b) => b.date.getTime() - a.date.getTime()
        );

        return days.map(({ date, items }) => {
            const data = items.sort(
                (a, b) => getDateValue(b).getTime() - getDateValue(a).getTime()
            );
            return {
                title: formatDayHeader(date),
                data,
            };
        });
    }, [filteredItems]);

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Un solo header */}
            <AppHeader
                onPressLeft={() => router.back()}
                leftIcon="chevron-back"
                title="Gastos"
                subtitle={projectName ?? undefined}
            />

            <View style={{ flex: 1, paddingHorizontal: spacing.xl }}>
                <SectionList
                    sections={sections}
                    keyExtractor={(it) => it.id}
                    contentContainerStyle={{
                        paddingBottom: spacing.xl * 6 + insets.bottom + 32, // +32 da aire extra
                    }}
                    ListHeaderComponent={
                        <View style={{ paddingTop: spacing.md, paddingBottom: spacing.md }}>
                            {/* NUEVO: Filtro por integrante */}
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                style={{ marginBottom: spacing.sm }}
                                contentContainerStyle={{ gap: spacing.xs }}
                            >
                                <MemberChip
                                    label="Todos"
                                    selected={selectedUid === "ALL"}
                                    onPress={() => setSelectedUid("ALL")}
                                />
                                {memberList.map((m) => {
                                    const t = contrib.totalsByUid.get(m.uid) || 0;
                                    const pct = contrib.totalAll
                                        ? Math.round((t / contrib.totalAll) * 100)
                                        : 0;
                                    return (
                                        <MemberChip
                                            key={m.uid}
                                            label={`${m.name} ${pct ? `(${pct}%)` : ""}`}
                                            selected={selectedUid === m.uid}
                                            onPress={() => setSelectedUid(m.uid)}
                                        />
                                    );
                                })}
                            </ScrollView>

                            {/* NUEVO: Contribución por integrante */}
                            <View
                                style={{
                                    backgroundColor: colors.card,
                                    borderRadius: radius.lg,
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                    padding: spacing.lg,
                                    gap: spacing.sm,
                                    marginBottom: spacing.sm,
                                }}
                            >
                                <Text
                                    style={{ color: colors.textMuted, fontSize: 12, marginBottom: 2 }}
                                >
                                    Contribución por integrante
                                </Text>

                                {contrib.sorted.length === 0 ? (
                                    <Text style={{ color: colors.textMuted }}>
                                        Sin gastos este mes.
                                    </Text>
                                ) : (
                                    contrib.sorted.map((row) => {
                                        const pct = contrib.totalAll
                                            ? row.total / contrib.totalAll
                                            : 0;
                                        return (
                                            <View key={row.uid} style={{ gap: 4 }}>
                                                <View
                                                    style={{
                                                        flexDirection: "row",
                                                        justifyContent: "space-between",
                                                    }}
                                                >
                                                    <Text style={{ color: colors.text }} numberOfLines={1}>
                                                        {row.name}
                                                    </Text>
                                                    <Text style={{ color: colors.text, fontWeight: "700" }}>
                                                        {formatARS(row.total)} · {(pct * 100).toFixed(0)}%
                                                    </Text>
                                                </View>
                                                <View
                                                    style={{
                                                        height: 6,
                                                        borderRadius: 6,
                                                        backgroundColor: "rgba(255,255,255,0.08)",
                                                        overflow: "hidden",
                                                    }}
                                                >
                                                    <View
                                                        style={{
                                                            width: `${Math.max(5, Math.round(pct * 100))}%`,
                                                            height: "100%",
                                                            backgroundColor: colors.text, // barra con color de texto
                                                            opacity: 0.6,
                                                        }}
                                                    />
                                                </View>
                                            </View>
                                        );
                                    })
                                )}

                                {/* diferencia entre el 1.º y el 2.º en puntos porcentuales */}
                                {contrib.sorted.length >= 2 && (
                                    <Text
                                        style={{
                                            color: colors.textMuted,
                                            marginTop: spacing.xs,
                                            fontSize: 12,
                                        }}
                                    >
                                        Dif. líder vs segundo:{" "}
                                        {(() => {
                                            const p1 = contrib.totalAll
                                                ? contrib.sorted[0].total / contrib.totalAll
                                                : 0;
                                            const p2 = contrib.totalAll
                                                ? contrib.sorted[1].total / contrib.totalAll
                                                : 0;
                                            const delta = Math.abs(p1 - p2) * 100;
                                            return `${delta.toFixed(1)} pp`;
                                        })()}
                                    </Text>
                                )}
                            </View>

                            {/* Selector de mes */}
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

                            {/* Total del mes (general) */}
                            <View
                                style={{
                                    marginTop: spacing.sm,
                                    backgroundColor: colors.card,
                                    borderRadius: radius.lg,
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                    paddingVertical: spacing.md,
                                    paddingHorizontal: spacing.lg,
                                }}
                            >
                                <Text
                                    style={{ color: colors.textMuted, fontSize: 12, marginBottom: 2 }}
                                >
                                    Total del mes
                                </Text>
                                <Text
                                    style={{
                                        color: colors.text,
                                        fontSize: 22,
                                        fontWeight: "800",
                                        letterSpacing: 0.2,
                                    }}
                                >
                                    {formatARS(totalCents)}
                                </Text>
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
                    renderItem={({ item }) => (
                        <Pressable
                            onPress={() =>
                                router.push({
                                    pathname: `/expenses/${item.id}/edit`,
                                    params: { projectId: String(projectId) },
                                })
                            }
                            style={({ pressed }) => ({
                                backgroundColor: colors.card,
                                paddingVertical: spacing.md,
                                paddingHorizontal: spacing.lg,
                                borderRadius: radius.lg,
                                borderWidth: 1,
                                borderColor: colors.border,
                                opacity: pressed ? 0.92 : 1,
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "space-between",
                            })}
                            accessibilityRole="button"
                            accessibilityLabel={`Editar gasto ${item.title}`}
                        >
                            {/* izquierda: título + meta */}
                            <View style={{ flexShrink: 1, paddingRight: spacing.md }}>
                                <Text style={{ color: colors.text, fontWeight: "700" }} numberOfLines={1}>
                                    {item.title}
                                </Text>
                                <Text
                                    style={{ color: colors.textMuted, marginTop: 2 }}
                                    numberOfLines={1}
                                >
                                    {`${getCategoryEmoji(item.category)} ${item.category}`} • {nameByUid.get(item.paidByUid) ?? item.paidByName}
                                </Text>

                            </View>

                            {/* derecha: monto */}
                            <Text style={{ color: colors.text, fontWeight: "700" }}>
                                {formatARS(item.amountCents)}
                            </Text>
                        </Pressable>
                    )}
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
                                    No hay gastos en {yearMonth}.
                                </Text>
                                <Link
                                    href={{
                                        pathname: "/expenses/new",
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

                <BottomFade height={120 + insets.bottom} />

                <FAB
                    onPress={() =>
                        router.push({
                            pathname: "/expenses/new",
                            params: { projectId: String(projectId) },
                        })
                    }
                    label="Añadir gasto"
                />
            </View>
        </SafeAreaView>
    );
}

function NavButton({ label, onPress }: { label: string; onPress: () => void }) {
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

// Chip simple reutilizable (si ya tenés PillChip, podés reemplazarlo)
function MemberChip({
    label,
    selected,
    onPress,
}: {
    label: string;
    selected: boolean;
    onPress: () => void;
}) {
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => ({
                paddingVertical: spacing.xs,
                paddingHorizontal: spacing.md,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: selected ? colors.text : colors.border,
                backgroundColor: selected ? "rgba(255,255,255,0.10)" : colors.card,
                opacity: pressed ? 0.85 : 1,
            })}
            accessibilityRole="button"
            accessibilityState={{ selected }}
        >
            <Text
                style={{
                    color: colors.text,
                    fontWeight: selected ? "700" : "500",
                }}
                numberOfLines={1}
            >
                {label}
            </Text>
        </Pressable>
    );
}
