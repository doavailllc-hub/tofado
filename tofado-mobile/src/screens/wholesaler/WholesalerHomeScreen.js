import { createNativeStackNavigator } from "@react-navigation/native-stack";
import DashboardScreen from "../common/DashboardScreen";
import WholesalerNotificationsScreen from "./WholesalerNotificationsScreen";

const Stack = createNativeStackNavigator();
function WholesalerDashboard() { return <DashboardScreen role="wholesaler" />; }
export default function WholesalerHomeScreen() {
  return <Stack.Navigator screenOptions={{ headerShown:false }}>
    <Stack.Screen name="WholesalerDashboard" component={WholesalerDashboard}/>
    <Stack.Screen name="WholesalerNotifications" component={WholesalerNotificationsScreen}/>
  </Stack.Navigator>;
}
