import { createNativeStackNavigator } from "@react-navigation/native-stack";
import RetailerHomeScreen from "../screens/retailer/RetailerHomeScreen";
import RetailerVendorsHomeScreen from "../screens/retailer/RetailerVendorsHomeScreen";
import FindWholesalersScreen from "../screens/retailer/FindWholesalersScreen";
import VendorRequestsScreen from "../screens/retailer/VendorRequestsScreen";
import RetailerDeliveriesScreen from "../screens/retailer/RetailerDeliveriesScreen";
import RetailerOrderDetailsScreen from "../screens/retailer/RetailerOrderDetailsScreen";
import RetailerNotificationsScreen from "../screens/retailer/RetailerNotificationsScreen";

const Stack = createNativeStackNavigator();

export default function RetailerHomeStack() {
  return <Stack.Navigator screenOptions={{ headerShown:false }}>
    <Stack.Screen name="RetailerHomeDashboard" component={RetailerHomeScreen} />
    <Stack.Screen name="VendorHome" component={RetailerVendorsHomeScreen} />
    <Stack.Screen name="FindWholesalers" component={FindWholesalersScreen} />
    <Stack.Screen name="VendorRequests" component={VendorRequestsScreen} />
    <Stack.Screen name="RetailerDeliveries" component={RetailerDeliveriesScreen} />
    <Stack.Screen name="RetailerOrderDetails" component={RetailerOrderDetailsScreen} />
    <Stack.Screen name="RetailerNotifications" component={RetailerNotificationsScreen} />
  </Stack.Navigator>;
}
