import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing } from "../theme";

type Props = {
    onPressRight?: () => void;
    rightIcon?: keyof typeof Ionicons.glyphMap;
};

export default function AppHeader({ onPressRight, rightIcon = "exit-outline" }: Props) {
    const insets = useSafeAreaInsets();

    return (
        <View
            style={{
                paddingTop: insets.top + 6,
                paddingHorizontal: spacing.lg,
                paddingBottom: spacing.md,
                backgroundColor: colors.bg,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
            }}
        >
            <Image
                source={require("../../assets/logo-home.png")}
                style={{ width: 280, height: 60, resizeMode: "contain" }}
            />
            {onPressRight ? (
                <Pressable onPress={onPressRight} hitSlop={10}>
                    <Ionicons name={rightIcon} size={22} color={colors.text} />
                </Pressable>
            ) : <View style={{ width: 22, height: 22 }} />}
        </View>
    );
}
