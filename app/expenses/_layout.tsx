// app/expenses/_layout.tsx — layout simple opcional
import { Stack } from "expo-router";
export default function ExpensesLayout() {
    return (
        <Stack screenOptions={{ headerStyle: { backgroundColor: "#000" }, headerTintColor: "#fff" }}>
            <Stack.Screen name="index" options={{ title: "Gastos" }} />
            <Stack.Screen name="new" options={{ title: "Añadir gasto" }} />
            <Stack.Screen name="[id]/edit" options={{ title: "Editar gasto" }} />
        </Stack>
    );
}