import { createNativeStackNavigator } from "@react-navigation/native-stack";
import WholesalerMoreScreen from "../screens/wholesaler/WholesalerMoreScreen";
import WholesalerRetailersStack from "./WholesalerRetailersStack";
import WholesalerDeliveriesScreen from "../screens/wholesaler/WholesalerDeliveriesScreen";
import WholesalerInvoicesScreen from "../screens/wholesaler/WholesalerInvoicesScreen";
import WholesalerPaymentsScreen from "../screens/wholesaler/WholesalerPaymentsScreen";
import WholesalerPaymentDetailsScreen from "../screens/wholesaler/WholesalerPaymentDetailsScreen";
import WholesalerInvoiceDetailsScreen from "../screens/wholesaler/WholesalerInvoiceDetailsScreen";
import ProfileScreen from "../screens/common/ProfileScreen";
import CommerceIntelligenceScreen from "../screens/common/CommerceIntelligenceScreen";
import WholesalerSubscriptionScreen from "../screens/wholesaler/WholesalerSubscriptionScreen";
const Stack = createNativeStackNavigator();
export default function WholesalerMoreStack() {
  return <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="MoreHome" component={WholesalerMoreScreen} />
    <Stack.Screen name="RetailerTools" component={WholesalerRetailersStack} />
    <Stack.Screen name="Deliveries" component={WholesalerDeliveriesScreen} />
    <Stack.Screen name="WholesalerInvoices" component={WholesalerInvoicesScreen} />
    <Stack.Screen name="WholesalerInvoiceDetails" component={WholesalerInvoiceDetailsScreen} />
    <Stack.Screen name="WholesalerPayments" component={WholesalerPaymentsScreen} />
    <Stack.Screen name="WholesalerPaymentDetails" component={WholesalerPaymentDetailsScreen} />
    <Stack.Screen name="Profile" component={ProfileScreen} />
    <Stack.Screen name="CommerceIntelligence" component={CommerceIntelligenceScreen} />
    <Stack.Screen name="Subscription" component={WholesalerSubscriptionScreen} />
  </Stack.Navigator>;
}
