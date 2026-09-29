import { createNativeStackNavigator } from "@react-navigation/native-stack";
import FindWholesalersScreen from "../screens/retailer/FindWholesalersScreen";
import RetailerStorefrontScreen from "../screens/retailer/RetailerStorefrontScreen";

const Stack = createNativeStackNavigator();

export default function RetailerMarketplaceStack() {
  return <Stack.Navigator screenOptions={{ headerShown:false }}>
    <Stack.Screen name="MarketplaceHome" component={FindWholesalersScreen} />
    <Stack.Screen name="Storefront" component={RetailerStorefrontScreen} />
  </Stack.Navigator>;
}
