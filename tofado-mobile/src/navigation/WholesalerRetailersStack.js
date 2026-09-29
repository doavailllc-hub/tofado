import { createNativeStackNavigator } from "@react-navigation/native-stack";
import WholesalerRetailersScreen from "../screens/wholesaler/WholesalerRetailersScreen";
import RetailerRequestsScreen from "../screens/wholesaler/RetailerRequestsScreen";
import WholesalerRetailerDetailsScreen from "../screens/wholesaler/WholesalerRetailerDetailsScreen";
const Stack = createNativeStackNavigator();
export default function WholesalerRetailersStack() {
  return <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="WholesalerRetailersHome" component={WholesalerRetailersScreen} />
    <Stack.Screen name="RetailerRequests" component={RetailerRequestsScreen} />
    <Stack.Screen name="WholesalerRetailerDetails" component={WholesalerRetailerDetailsScreen} />
  </Stack.Navigator>;
}
