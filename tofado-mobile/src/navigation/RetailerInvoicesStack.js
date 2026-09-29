import { createNativeStackNavigator } from "@react-navigation/native-stack";
import RetailerInvoicesScreen from "../screens/retailer/RetailerInvoicesScreen";
import RetailerInvoiceDetailsScreen from "../screens/retailer/RetailerInvoiceDetailsScreen";
const Stack = createNativeStackNavigator();
export default function RetailerInvoicesStack() {
  return <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="RetailerInvoicesHome" component={RetailerInvoicesScreen} />
    <Stack.Screen name="RetailerInvoiceDetails" component={RetailerInvoiceDetailsScreen} />
  </Stack.Navigator>;
}
