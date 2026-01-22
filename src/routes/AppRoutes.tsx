import {NavigationContainer} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { paths } from "./paths";
import { ProtectedRoutes } from "./ProtectedRoutes";
import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import DashboardScreen from "../screens/DashboardScreen";

const Stack = createNativeStackNavigator();

export const AppRoutes = () => {
    return (
        <NavigationContainer>
            <Stack.Navigator initialRouteName={paths.login} screenOptions={{headerShown: false}}>
                <Stack.Screen name={paths.login} component={LoginScreen} />
                <Stack.Screen name={paths.register} component={RegisterScreen} />
                <Stack.Screen name={paths.dashboard} component={DashboardScreen} />
            </Stack.Navigator>
        </NavigationContainer>
    )
}