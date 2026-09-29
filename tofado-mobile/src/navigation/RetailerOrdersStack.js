import { createNativeStackNavigator } from "@react-navigation/native-stack";
import RetailerOrdersScreen from "../screens/retailer/RetailerOrdersScreen";
import CreateOrderScreen from "../screens/retailer/CreateOrderScreen";
import RetailerOrderDetailsScreen from "../screens/retailer/RetailerOrderDetailsScreen";
const Stack = createNativeStackNavigator();
export default function RetailerOrdersStack() {
  return <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="RetailerOrdersHome" component={RetailerOrdersScreen} />
    <Stack.Screen name="CreateOrder" component={CreateOrderScreen} />
    <Stack.Screen name="RetailerOrderDetails" component={RetailerOrderDetailsScreen} />
  </Stack.Navigator>;
}
