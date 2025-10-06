// app/expenses/[id]/edit.tsx — Editar / Eliminar (con miembros reales)
import { router, useLocalSearchParams } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from "react-native";
import { CATEGORIES } from "../../../constants/categories";
import { db } from "../../../src/firebase";
import { deleteExpense, updateExpense } from "../../../src/services/expenses";
import {
    subscribeProjectMembers,
    type ProjectMember,
} from "../../../src/services/members.read";
import { toCents } from "../../../src/utils/money";

export default function EditExpense() {
    const [title, setTitle] = useState("");
    const [category, setCategory] = useState<typeof CATEGORIES[number]>(CATEGORIES[0]);
    const [amount, setAmount] = useState("");

    // pagado por (se setea al cargar el documento y/o al tocar chips)
    const [paidByUid, setPaidByUid] = useState<string>("");
    const [paidByName, setPaidByName] = useState<string>("");

    const [loadingDoc, setLoadingDoc] = useState(true);
    const [saving, setSaving] = useState(false);

    // miembros del proyecto
    const [members, setMembers] = useState<ProjectMember[]>([]);
    const [loadingMembers, setLoadingMembers] = useState(true);

    const { id, projectId } = useLocalSearchParams<{ id: string; projectId: string }>();
    if (!projectId) return <Text style={{ padding: 16 }}>Falta projectId</Text>;

    // Cargar gasto
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const snap = await getDoc(doc(db, "projects", String(projectId), "expenses", String(id)));
                const data: any = snap.data();
                if (data && mounted) {
                    setTitle(data.title ?? "");
                    setCategory(data.category ?? CATEGORIES[0]);
                    setAmount(String((data.amountCents ?? 0) / 100));
                    setPaidByUid(data.paidByUid ?? "");
                    setPaidByName(data.paidByName ?? "");
                }
            } finally {
                if (mounted) setLoadingDoc(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, [id, projectId]);

    // Suscribirse a miembros
    useEffect(() => {
        setLoadingMembers(true);
        const unsub = subscribeProjectMembers(String(projectId), (arr) => {
            setMembers(arr || []);
            setLoadingMembers(false);
        });
        return unsub;
    }, [projectId]);

    // Helper para nombre visible (igual que en index.tsx)
    const displayNameOf = (m: ProjectMember) =>
        (m as any).displayName || `Miembro ${m.uid.slice(0, 6)}`;

    // Lista de chips de miembros + fallback si el gasto tiene un uid que no está en la lista
    const memberChips = useMemo(() => {
        const chips = members.map((m) => ({ uid: m.uid, name: displayNameOf(m) }));
        // Inyectar fallback si el gasto tiene algo distinto
        if (paidByUid && !chips.some((c) => c.uid === paidByUid)) {
            chips.unshift({ uid: paidByUid, name: paidByName || `Miembro ${paidByUid.slice(0, 6)}` });
        }
        return chips;
    }, [members, paidByUid, paidByName]);

    async function onSave() {
        const amountCents = toCents(amount);
        if (title.trim().length < 3) return Alert.alert("Título muy corto");
        if (amountCents <= 0) return Alert.alert("Importe inválido");
        if (!paidByUid || !paidByName) return Alert.alert("Falta seleccionar 'Pagado por'");

        try {
            setSaving(true);
            await updateExpense(String(projectId), String(id), {
                title: title.trim(),
                category,
                amountCents,
                paidByUid,
                paidByName, // guardamos también el nombre visible actual
            });
            router.back();
        } catch (e: any) {
            Alert.alert("Error", e?.message ?? "No se pudo guardar");
        } finally {
            setSaving(false);
        }
    }

    async function onDelete() {
        Alert.alert("Eliminar", "¿Querés eliminar este gasto?", [
            { text: "Cancelar" },
            {
                text: "Eliminar",
                style: "destructive",
                onPress: async () => {
                    await deleteExpense(String(projectId), String(id));
                    router.replace({ pathname: "/expenses", params: { projectId: String(projectId) } });
                },
            },
        ]);
    }

    if (loadingDoc) {
        return (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator />
                <Text style={{ marginTop: 8 }}>Cargando…</Text>
            </View>
        );
    }

    return (
        <View style={{ flex: 1, padding: 16, gap: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: "700" }}>Editar gasto</Text>

            <Text>Título</Text>
            <TextInput
                value={title}
                onChangeText={setTitle}
                style={{ backgroundColor: "#111", color: "#fff", padding: 12, borderRadius: 10 }}
            />

            <Text>Categoría</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {CATEGORIES.map((c) => (
                    <Pressable
                        key={c}
                        onPress={() => setCategory(c)}
                        style={{
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: category === c ? "#60a5fa" : "#333",
                            backgroundColor: category === c ? "#1e293b" : "#111",
                        }}
                    >
                        <Text style={{ color: "#fff" }}>{c}</Text>
                    </Pressable>
                ))}
            </View>

            <Text>Importe (ARS)</Text>
            <TextInput
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                style={{ backgroundColor: "#111", color: "#fff", padding: 12, borderRadius: 10 }}
            />

            <Text>Pagado por</Text>
            {loadingMembers ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <ActivityIndicator />
                    <Text style={{ color: "#aaa" }}>Cargando miembros…</Text>
                </View>
            ) : memberChips.length === 0 ? (
                <Text style={{ color: "#aaa" }}>No hay miembros en el proyecto.</Text>
            ) : (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {memberChips.map((m) => (
                        <Pressable
                            key={m.uid}
                            onPress={() => {
                                setPaidByUid(m.uid);
                                setPaidByName(m.name);
                            }}
                            style={{
                                paddingVertical: 8,
                                paddingHorizontal: 12,
                                borderRadius: 999,
                                borderWidth: 1,
                                borderColor: paidByUid === m.uid ? "#60a5fa" : "#333",
                                backgroundColor: paidByUid === m.uid ? "#1e293b" : "#111",
                            }}
                        >
                            <Text style={{ color: "#fff" }}>{m.name}</Text>
                        </Pressable>
                    ))}
                </View>
            )}

            <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
                <Pressable
                    onPress={onSave}
                    disabled={saving}
                    style={{
                        flex: 1,
                        backgroundColor: "#2563eb",
                        padding: 14,
                        borderRadius: 12,
                        alignItems: "center",
                        opacity: saving ? 0.8 : 1,
                    }}
                >
                    <Text style={{ color: "#fff", fontWeight: "700" }}>
                        {saving ? "Guardando…" : "Guardar"}
                    </Text>
                </Pressable>
                <Pressable
                    onPress={onDelete}
                    style={{ width: 120, backgroundColor: "#ef4444", padding: 14, borderRadius: 12, alignItems: "center" }}
                >
                    <Text style={{ color: "#fff", fontWeight: "700" }}>Eliminar</Text>
                </Pressable>
            </View>
        </View>
    );
}
