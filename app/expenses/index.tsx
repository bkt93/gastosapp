// app/expenses/index.tsx — Listado mensual (UI Fase 4 + theme oficial)
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    SafeAreaView,
    Text,
    View,
} from "react-native";
import { useMonthExpenses } from "../../hooks/useMonthExpenses";
import ProjectTabs from "../../src/components/ProjectTabs";
import {
    subscribeProjectMembers,
    type ProjectMember,
} from "../../src/services/members.read";
import { colors, radius, spacing } from "../../src/theme";
import { formatARS } from "../../src/utils/money";

export default function ExpensesIndex() {
    const { projectId } = useLocalSearchParams<{ projectId: string }>();
    const router = useRouter();

    if (!projectId) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
                <Text style={{ padding: spacing.xl, color: colors.text }}>
                    Falta projectId
                </Text>
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
    useEffect(() => {
        return subscribeProjectMembers(String(projectId), setMembers);
    }, [projectId]);

    const nameByUid = useMemo(() => {
        const map = new Map<string, string>();
        members.forEach((m) =>
            map.set(m.uid, (m as any).displayName || `Miembro ${m.uid.slice(0, 6)}`)
        );
        return map;
    }, [members]);

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
            <View style={{ flex: 1, padding: spacing.xl }}>
                <ProjectTabs projectId={String(projectId)} current="expenses" />

                {/* Header de mes */}
                <View
                    style={{
                        marginTop: spacing.md,
                        backgroundColor: colors.card,
                        borderRadius: radius.lg,
                        borderWidth: 1,
                        borderColor: colors.border,
                        padding: spacing.sm,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                    }}
                >
                    <NavButton label="‹" onPress={prevMonth} />
                    <Text style={{ color: colors.text, fontWeight: "700" }}>{yearMonth}</Text>
                    <NavButton label="›" onPress={nextMonth} />
                </View>

                {/* Total */}
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
                    <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 2 }}>
                        Total del mes
                    </Text>
                    <Text style={{ color: colors.text, fontSize: 20, fontWeight: "700" }}>
                        {formatARS(totalCents)}
                    </Text>
                </View>

                {/* Estados */}
                {loading && (
                    <View style={{ paddingVertical: spacing.lg }}>
                        <ActivityIndicator color={colors.text} />
                    </View>
                )}
                {error && (
                    <Text style={{ color: colors.danger, marginTop: spacing.sm }}>
                        {error}
                    </Text>
                )}
                {!loading && !error && items.length === 0 && (
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
                        <Text style={{ color: colors.textMuted }}>
                            Tocá “Añadir” para crear el primero.
                        </Text>
                    </View>
                )}

                {/* Lista */}
                <FlatList
                    data={items}
                    keyExtractor={(it) => it.id}
                    contentContainerStyle={{ gap: spacing.sm, paddingBottom: 100 }}
                    renderItem={({ item }) => (
                        <Pressable
                            onPress={() =>
                                router.push({
                                    pathname: `/expenses/${item.id}/edit`,
                                    params: { projectId: String(projectId) },
                                })
                            }
                            style={{
                                backgroundColor: colors.card,
                                padding: spacing.lg,
                                borderRadius: radius.lg,
                                borderWidth: 1,
                                borderColor: colors.border,
                            }}
                        >
                            <Text style={{ color: colors.text, fontWeight: "700" }}>
                                {item.title}
                            </Text>
                            <Text style={{ color: colors.textMuted, marginTop: 2 }}>
                                {item.category} • {nameByUid.get(item.paidByUid) ?? item.paidByName}
                            </Text>
                            <Text
                                style={{
                                    color: colors.text,
                                    marginTop: spacing.sm,
                                    fontWeight: "600",
                                }}
                            >
                                {formatARS(item.amountCents)}
                            </Text>
                        </Pressable>
                    )}
                />

                {/* FAB */}
                <Link
                    href={{
                        pathname: "/expenses/new",
                        params: { projectId: String(projectId) },
                    }}
                    asChild
                >
                    <Pressable
                        style={{
                            position: "absolute",
                            right: spacing.xl,
                            bottom: spacing.xl,
                            backgroundColor: colors.primary,
                            paddingVertical: spacing.md,
                            paddingHorizontal: spacing.xl,
                            borderRadius: 999,
                            shadowColor: "#000",
                            shadowOpacity: 0.25,
                            shadowRadius: 6,
                            elevation: 5,
                        }}
                    >
                        <Text style={{ color: "#000", fontWeight: "800" }}>Añadir</Text>
                    </Pressable>
                </Link>
            </View>
        </SafeAreaView>
    );
}

function NavButton({ label, onPress }: { label: string; onPress: () => void }) {
    return (
        <Pressable
            onPress={onPress}
            style={{
                paddingVertical: spacing.xs,
                paddingHorizontal: spacing.lg,
                borderRadius: radius.lg,
                backgroundColor: "rgba(255,255,255,0.06)",
            }}
        >
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700" }}>
                {label}
            </Text>
        </Pressable>
    );
}
