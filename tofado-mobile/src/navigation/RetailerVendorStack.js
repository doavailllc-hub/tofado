import { createNativeStackNavigator } from "@react-navigation/native-stack";

import RetailerVendorsHomeScreen from "../screens/retailer/RetailerVendorsHomeScreen";
import FindWholesalersScreen from "../screens/retailer/FindWholesalersScreen";
import VendorRequestsScreen from "../screens/retailer/VendorRequestsScreen";

const Stack = createNativeStackNavigator();

export default function RetailerVendorStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="VendorHome"
        component={RetailerVendorsHomeScreen}
      />
      <Stack.Screen
        name="FindWholesalers"
        component={FindWholesalersScreen}
      />
      <Stack.Screen
        name="VendorRequests"
        component={VendorRequestsScreen}
      />
    </Stack.Navigator>
  );
}
