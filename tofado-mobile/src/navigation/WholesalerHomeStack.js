import { createNativeStackNavigator } from "@react-navigation/native-stack";
import WholesalerHomeScreen from "../screens/wholesaler/WholesalerHomeScreen";
import WholesalerNotificationsScreen from "../screens/wholesaler/WholesalerNotificationsScreen";

const Stack = createNativeStackNavigator();

export default function WholesalerHomeStack() {
  return <Stack.Navigator screenOptions={{ headerShown:false }}>
    <Stack.Screen name="WholesalerHomeDashboard" component={WholesalerHomeScreen} />
    <Stack.Screen name="WholesalerNotifications" component={WholesalerNotificationsScreen} />
  </Stack.Navigator>;
}
