import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import RetailerHomeStack from "./RetailerHomeStack";
import RetailerOrdersStack from "./RetailerOrdersStack";
import RetailerMoreStack from "./RetailerMoreStack";
import TabBarIcon from "./TabBarIcon";
import { colors } from "../theme/colors";
import RetailerMarketplaceStack from "./RetailerMarketplaceStack";

const Tab = createBottomTabNavigator();

export default function RetailerTabs() {
  return (
    <Tab.Navigator screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600", marginBottom: 7 },
        tabBarIconStyle: { marginTop: 6 },
        tabBarStyle: {
          height: 74,
          paddingTop: 2,
          borderTopWidth: 1,
          borderTopColor: "#E8EAED",
          backgroundColor: colors.white,
          elevation: 12,
          shadowColor: "#202124",
          shadowOpacity: 0.08,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: -4 },
        },
      }}>
      <Tab.Screen name="RetailerMarketplace" component={RetailerMarketplaceStack} options={{ title: "Marketplace", tabBarIcon: ({ color, size }) => <TabBarIcon name="storefront-outline" color={color} size={size} /> }} />
      <Tab.Screen name="RetailerHome" component={RetailerHomeStack} options={{ title: "Home", tabBarIcon: ({ color, size }) => <TabBarIcon name="home-outline" color={color} size={size} /> }} />
      <Tab.Screen name="RetailerOrders" component={RetailerOrdersStack} options={{ title: "Orders", tabBarIcon: ({ color, size }) => <TabBarIcon name="bag-handle-outline" color={color} size={size} /> }} />
      <Tab.Screen name="RetailerMore" component={RetailerMoreStack} options={{ title: "More", tabBarIcon: ({ color, size }) => <TabBarIcon name="grid-outline" color={color} size={size} /> }} />
    </Tab.Navigator>
  );
}
