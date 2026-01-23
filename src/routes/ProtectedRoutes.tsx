import React from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { useAuth } from "../hooks/useAuth";
import { paths } from "./paths";
import { useNavigation } from "@react-navigation/native";
import type {ReactNode} from "react";

interface ProtectedRoutesProps {
    children: ReactNode;
}

export function ProtectedRoutes({ children }: ProtectedRoutesProps) {
    const {user, loading} = useAuth();
    const navigation = useNavigation<any>();

    React.useEffect(() => {
        if(!loading && !user){
            navigation.navigate(paths.login as never);
        }
    }, [loading, user, navigation]);

    if(loading){
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#6366F1" />
                <Text style={styles.loadingText}>Carregando...</Text>
            </View>
        )
    }

    if(!user){
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#6366F1" />
            </View>
        );
    }

    return <>{children}</>;
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#F8F9FA",
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: "#6B7280",
    },
});           