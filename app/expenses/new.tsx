// app/expenses/new.tsx — Crear gasto (miembros reales + date picker, sin /users)
import DateTimePicker from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";

import { CATEGORIES } from "../../constants/categories";
import { createExpense } from "../../src/services/expenses";
import { toCents } from "../../src/utils/money";

import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../src/firebase";
import {
    subscribeProjectMembers,
    type ProjectMember,
} from "../../src/services/members.read";

// extender para permitir displayName opcional
type PM = ProjectMember & { displayName?: string | null };

export default function NewExpense() {
    // --- params ---
    const { projectId } = useLocalSearchParams<{ projectId: string }>();
    if (!projectId) return <Text style={{ padding: 16 }}>Falta projectId</Text>;

    // --- form state ---
    const [title, setTitle] = useState("");
    const [category, setCategory] =
        useState<typeof CATEGORIES[number]>(CATEGORIES[0]);
    const [amount, setAmount] = useState("");
    const [date, setDate] = useState(new Date());
    const [showPicker, setShowPicker] = useState(false);
    const [saving, setSaving] = useState(false);

    // --- members state ---
    const [authUid, setAuthUid] = useState<string | null>(null);
    const [members, setMembers] = useState<PM[]>([]);
    const options = useMemo(
        () =>
            members.map((m) => ({
                uid: m.uid,
                name:
                    m.displayName ??
                    (m.uid === authUid
                        ? auth.currentUser?.displayName ?? "Vos"
                        : `Miembro ${m.uid.slice(0, 6)}`),
            })),
        [members, authUid]
    );
    const [paidByUid, setPaidByUid] = useState<string>("");
    const [paidByName, setPaidByName] = useState<string>("");

    // --- quién soy ---
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setAuthUid(u?.uid ?? null));
        return () => unsub();
    }, []);

    // --- miembros del proyecto (subcolección) ---
    useEffect(() => {
        return subscribeProjectMembers(String(projectId), (rows) =>
            setMembers(rows as PM[])
        );
    }, [projectId]);

    // --- default pagador: yo si estoy, si no el primero de la lista ---
    useEffect(() => {
        if (paidByUid || options.length === 0) return;
        const mine = authUid ? options.find((o) => o.uid === authUid) : undefined;
        const def = mine ?? options[0];
        if (!def) return;
        setPaidByUid(def.uid);
        setPaidByName(def.name);
    }, [authUid, options, paidByUid]);

    const canSave = useMemo(() => {
        const amountCents = toCents(amount);
        return title.trim().length >= 3 && amountCents > 0 && !!paidByUid;
    }, [title, amount, paidByUid]);

    // --- save ---
    async function onSave() {
        const amountCents = toCents(amount);
        if (title.trim().length < 3) return Alert.alert("Título muy corto");
        if (amountCents <= 0) return Alert.alert("Importe inválido");
        if (!paidByUid) return Alert.alert("Pagado por", "Elegí quién pagó");

        try {
            setSaving(true);
            await createExpense(String(projectId), {
                title: title.trim(),
                category,
                amountCents,
                paidByUid,
                paidByName, // guarda el nombre mostrado
                date,
            });
            router.back();
        } catch (e: any) {
            Alert.alert("Error", e?.message ?? "No se pudo guardar");
        } finally {
            setSaving(false);
        }
    }

    // --- UI ---
    return (
        <View style={{ flex: 1, padding: 16, gap: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: "700" }}>Nuevo gasto</Text>

            <Text>Título</Text>
            <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Por ejemplo, Bebidas"
                style={{
                    backgroundColor: "#111",
                    color: "#fff",
                    padding: 12,
                    borderRadius: 10,
                }}
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
                placeholder="0,00"
                style={{
                    backgroundColor: "#111",
                    color: "#fff",
                    padding: 12,
                    borderRadius: 10,
                }}
            />

            <Text>Pagado por</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {options.length === 0 ? (
                    <Text style={{ color: "#94a3b8" }}>Cargando miembros…</Text>
                ) : (
                    options.map((m) => (
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
                    ))
                )}
            </View>

            <Text>Fecha</Text>
            <Pressable
                onPress={() => setShowPicker(true)}
                style={{ backgroundColor: "#111", padding: 12, borderRadius: 10 }}
            >
                <Text style={{ color: "#fff" }}>{date.toLocaleDateString()}</Text>
            </Pressable>
            {showPicker && (
                <DateTimePicker
                    value={date}
                    mode="date"
                    display="default"
                    onChange={(_, d) => {
                        setShowPicker(false);
                        if (d) setDate(d);
                    }}
                />
            )}

            <Pressable
                onPress={onSave}
                disabled={saving || !canSave}
                style={{
                    marginTop: 16,
                    backgroundColor: saving || !canSave ? "#64748b" : "#2563eb",
                    padding: 14,
                    borderRadius: 12,
                    alignItems: "center",
                }}
            >
                <Text style={{ color: "#fff", fontWeight: "700" }}>
                    {saving ? "Guardando…" : "Guardar"}
                </Text>
            </Pressable>
        </View>
    );
}
