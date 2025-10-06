import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";

type Props = {
    projectId: string;
    current: "expenses" | "services";
};

export default function ProjectTabs({ projectId, current }: Props) {
    function pill(isActive: boolean) {
        return {
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: isActive ? "#60a5fa" : "#333",
            backgroundColor: isActive ? "#1e293b" : "#111",
        };
    }

    const text = { color: "#fff", fontWeight: "600" as const };

    return (
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
            <Link href={{ pathname: "/expenses", params: { projectId } }} asChild>
                <Pressable style={pill(current === "expenses")}>
                    <Text style={text}>Gastos</Text>
                </Pressable>
            </Link>

            <Link href={{ pathname: "/services", params: { projectId } }} asChild>
                <Pressable style={pill(current === "services")}>
                    <Text style={text}>Servicios</Text>
                </Pressable>
            </Link>
        </View>
    );
}
