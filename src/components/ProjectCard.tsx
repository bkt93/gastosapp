import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { colors, radius, spacing } from "../theme";

export type ProjectCardProps = {
    name: string;
    currency: string;
    role: "owner" | "member";
    onPress: () => void;
    iconEmoji?: string; // 👈 nuevo
};

export default function ProjectCard({
    name,
    currency,
    role,
    onPress,
    iconEmoji,
}: ProjectCardProps) {
    const badgeBg = role === "owner" ? "#163D7A" : "#2a2a2c";
    const badgeText = role === "owner" ? "#93C5FD" : colors.textMuted;

    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => ({
                opacity: pressed ? 0.9 : 1,
                backgroundColor: colors.card,
                padding: spacing.lg,
                borderRadius: radius.xl,
                marginBottom: spacing.md,
                borderWidth: 1,
                borderColor: colors.border,
            })}
        >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View
                    style={{
                        
                        width: 60,
                        height: 60,
                        borderRadius: 14,
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: spacing.md,
                    }}
                >
                    {iconEmoji ? (
                        <Text style={{ fontSize: 50 }}>{iconEmoji}</Text>
                    ) : (
                        <Ionicons name="home" size={26} color="#4CAF50" />
                    )}
                </View>

                <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700" }}>
                        {name}
                    </Text>

                    <View style={{ flexDirection: "row", marginTop: 6, alignItems: "center" }}>
                        <View
                            style={{
                                paddingHorizontal: 10,
                                paddingVertical: 4,
                                borderRadius: 999,
                                backgroundColor: badgeBg,
                                marginRight: 8,
                                borderWidth: 1,
                                borderColor: colors.border,
                            }}
                        >
                            <Text style={{ color: badgeText, fontSize: 12, fontWeight: "700" }}>
                                {role === "owner" ? "Propietario" : "Miembro"}
                            </Text>
                        </View>

                        <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                            Moneda: {currency}
                        </Text>
                    </View>
                </View>

                <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
            </View>
        </Pressable>
    );
}
