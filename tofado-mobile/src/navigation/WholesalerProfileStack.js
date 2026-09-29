import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ProfileScreen from "../screens/common/ProfileScreen";
import WholesalerRetailersStack from "./WholesalerRetailersStack";
import WholesalerDeliveriesScreen from "../screens/wholesaler/WholesalerDeliveriesScreen";
import WholesalerInvoicesScreen from "../screens/wholesaler/WholesalerInvoicesScreen";
import WholesalerInvoiceDetailsScreen from "../screens/wholesaler/WholesalerInvoiceDetailsScreen";
import WholesalerPaymentsScreen from "../screens/wholesaler/WholesalerPaymentsScreen";
import WholesalerPaymentDetailsScreen from "../screens/wholesaler/WholesalerPaymentDetailsScreen";

const Stack = createNativeStackNavigator();

export default function WholesalerProfileStack() {
  return <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ProfileHome" component={ProfileScreen} />
    <Stack.Screen name="RetailerTools" component={WholesalerRetailersStack} />
    <Stack.Screen name="Deliveries" component={WholesalerDeliveriesScreen} />
    <Stack.Screen name="WholesalerInvoices" component={WholesalerInvoicesScreen} />
    <Stack.Screen name="WholesalerInvoiceDetails" component={WholesalerInvoiceDetailsScreen} />
    <Stack.Screen name="WholesalerPayments" component={WholesalerPaymentsScreen} />
    <Stack.Screen name="WholesalerPaymentDetails" component={WholesalerPaymentDetailsScreen} />
  </Stack.Navigator>;
}
