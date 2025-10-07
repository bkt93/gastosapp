// app/expenses/index.tsx — Listado mensual, agrupado por día (usa Date del modelo)
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    SectionList,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMonthExpenses } from "../../hooks/useMonthExpenses";
import AppHeader from "../../src/components/AppHeader";
import {
    subscribeProjectMembers,
    type ProjectMember,
} from "../../src/services/members.read";
import { colors, radius, spacing } from "../../src/theme";
import { formatARS } from "../../src/utils/money";

import { Stack } from "expo-router";
import FAB from "../../src/components/FAB";
import type { Expense } from "../../src/models";

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
    useEffect(() => subscribeProjectMembers(String(projectId), setMembers), [projectId]);

    const nameByUid = useMemo(() => {
        const map = new Map<string, string>();
        members.forEach((m) =>
            map.set(m.uid, (m as any).displayName || `Miembro ${m.uid.slice(0, 6)}`)
        );
        return map;
    }, [members]);

    // Agrupar por día (local) dentro del mes
    const sections = useMemo(() => {
        const byDay = new Map<string, { date: Date; items: Expense[] }>();

        items.forEach((it) => {
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
    }, [items]);

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
                    contentContainerStyle={{ paddingBottom: spacing.xl * 6 }}
                    ListHeaderComponent={
                        <View style={{ paddingTop: spacing.md, paddingBottom: spacing.md }}>
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

                            {/* Total del mes */}
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
                                    {item.category} • {nameByUid.get(item.paidByUid) ?? item.paidByName}
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
