import { createNativeStackNavigator } from "@react-navigation/native-stack";
import WholesalerOrdersScreen from "../screens/wholesaler/WholesalerOrdersScreen";
import WholesalerOrderDetailsScreen from "../screens/wholesaler/WholesalerOrderDetailsScreen";
const Stack = createNativeStackNavigator();
export default function WholesalerOrdersStack() {
  return <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="WholesalerOrdersHome" component={WholesalerOrdersScreen} />
    <Stack.Screen name="WholesalerOrderDetails" component={WholesalerOrderDetailsScreen} />
  </Stack.Navigator>;
}
