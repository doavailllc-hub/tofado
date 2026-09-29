import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import WholesalerHomeStack from "./WholesalerHomeStack";
import WholesalerOrdersStack from "./WholesalerOrdersStack";
import WholesalerCatalogStack from "./WholesalerCatalogStack";
import WholesalerProfileStack from "./WholesalerProfileStack";
import TabBarIcon from "./TabBarIcon";
import { colors } from "../theme/colors";

const Tab = createBottomTabNavigator();

export default function WholesalerTabs() {
  return (
    <Tab.Navigator screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600", marginBottom: 7 },
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
      <Tab.Screen name="WholesalerHome" component={WholesalerHomeStack} options={{ title: "Home", tabBarIcon: ({ color, size }) => <TabBarIcon name="home-outline" color={color} size={size} /> }} />
      <Tab.Screen name="WholesalerOrders" component={WholesalerOrdersStack} options={{ title: "Orders", tabBarIcon: ({ color, size }) => <TabBarIcon name="bag-handle-outline" color={color} size={size} /> }} />
      <Tab.Screen name="WholesalerCatalog" component={WholesalerCatalogStack} options={{ title: "Catalog", tabBarIcon: ({ color, size }) => <TabBarIcon name="storefront-outline" color={color} size={size} /> }} />
      <Tab.Screen
        name="WholesalerProfile"
        component={WholesalerProfileStack}
        options={{
          title: "Profile",
          popToTopOnBlur: true,
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="person-outline" color={color} size={size} />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: (event) => {
            event.preventDefault();
            navigation.navigate("WholesalerProfile", { screen: "ProfileHome" });
          },
        })}
      />
    </Tab.Navigator>
  );
}
