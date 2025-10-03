// app/expenses/index.tsx — Listado mensual (muestra nombres reales)
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    Text,
    View,
} from "react-native";
import { useMonthExpenses } from "../../hooks/useMonthExpenses";
import {
    subscribeProjectMembers,
    type ProjectMember,
} from "../../src/services/members.read";
import { formatARS } from "../../src/utils/money";

export default function ExpensesIndex() {
    const { projectId } = useLocalSearchParams<{ projectId: string }>();
    if (!projectId) return <Text style={{ padding: 16 }}>Falta projectId</Text>;

    const {
        items,
        totalCents,
        yearMonth,
        loading,
        error,
        nextMonth,
        prevMonth,
    } = useMonthExpenses(String(projectId));

    // miembros -> mapa uid => displayName (fallback al uid recortado)
    const [members, setMembers] = useState<ProjectMember[]>([]);
    useEffect(() => {
        return subscribeProjectMembers(String(projectId), setMembers);
    }, [projectId]);

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

    const router = useRouter();

    return (
        <View style={{ flex: 1, padding: 16, gap: 12 }}>
            <View
                style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}
            >
                <Pressable onPress={prevMonth}>
                    <Text style={{ fontSize: 20 }}>‹</Text>
                </Pressable>
                <Text style={{ fontSize: 16, fontWeight: "600" }}>{yearMonth}</Text>
                <Pressable onPress={nextMonth}>
                    <Text style={{ fontSize: 20 }}>›</Text>
                </Pressable>
            </View>

            <Text style={{ fontSize: 18, fontWeight: "700" }}>
                Total: {formatARS(totalCents)}
            </Text>

            {loading && <ActivityIndicator />}
            {error && <Text style={{ color: "red" }}>{error}</Text>}

            <FlatList
                data={items}
                keyExtractor={(it) => it.id}
                contentContainerStyle={{ gap: 8, paddingBottom: 80 }}
                renderItem={({ item }) => (
                    <Pressable
                        onPress={() =>
                            router.push({
                                pathname: `/expenses/${item.id}/edit`,
                                params: { projectId: String(projectId) },
                            })
                        }
                        style={{
                            backgroundColor: "#111",
                            padding: 12,
                            borderRadius: 10,
                            borderColor: "#333",
                            borderWidth: 1,
                        }}
                    >
                        <Text style={{ color: "#fff", fontWeight: "600" }}>
                            {item.title}
                        </Text>
                        <Text style={{ color: "#aaa", marginTop: 2 }}>
                            {item.category} •{" "}
                            {nameByUid.get(item.paidByUid) ?? item.paidByName}
                        </Text>
                        <Text style={{ color: "#fff", marginTop: 6 }}>
                            {formatARS(item.amountCents)}
                        </Text>
                    </Pressable>
                )}
            />

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
                        right: 16,
                        bottom: 24,
                        backgroundColor: "#2563eb",
                        paddingVertical: 14,
                        paddingHorizontal: 20,
                        borderRadius: 999,
                    }}
                >
                    <Text style={{ color: "#fff", fontWeight: "700" }}>Añadir</Text>
                </Pressable>
            </Link>
        </View>
    );
}
