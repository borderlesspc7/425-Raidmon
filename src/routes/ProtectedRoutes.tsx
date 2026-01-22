import React from "react";
import { View, Text, ActivityIndicator } from "react-native";
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
            navigation.navigate(paths.login);
        }
    }, [loading, user, navigation]);

    if(loading){
        return (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                <ActivityIndicator size="large" color="#0000ff" />
                <Text>Loading...</Text>
            </View>
        )
    }

    if(!user){
        return null;
    }

    return <>{children}</>;
}           