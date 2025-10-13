import { LinearGradient } from "expo-linear-gradient";
import { View } from "react-native";
import { colors } from "../theme";

function BottomFade({ height = 120 }: { height?: number }) {
    return (
        <View
            pointerEvents="none"
            style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height,
            }}
        >
            <LinearGradient
                style={{ flex: 1 }}
                colors={["rgba(0,0,0,0)", colors.bg]} // transparente → fondo
                locations={[0, 1]}
            />
        </View>
    );
}

export default BottomFade;
