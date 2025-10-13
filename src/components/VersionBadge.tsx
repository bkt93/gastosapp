import Constants from "expo-constants";
import { Text, View } from "react-native";

type Props = { compact?: boolean };

export default function VersionBadge({ compact }: Props) {
    const version = Constants.expoConfig?.version ?? "0.0.0";
    const build =
        Constants.expoConfig?.android?.versionCode?.toString() ??
        Constants.expoConfig?.ios?.buildNumber ??
        "";
    const label = compact ? `v${version}` : `v${version}${build ? ` (build ${build})` : ""}`;

    return (
        <View
            style={{
                alignSelf: "flex-end",
                backgroundColor: "#1F1F1F",
                borderRadius: 999,
                paddingHorizontal: 10,
                paddingVertical: 4,
                opacity: 0.85,
            }}
        >
            <Text style={{ color: "#B5B5B5", fontSize: 12, letterSpacing: 0.3 }}>{label}</Text>
        </View>
    );
}
