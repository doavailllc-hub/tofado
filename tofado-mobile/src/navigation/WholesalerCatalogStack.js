import { createNativeStackNavigator } from "@react-navigation/native-stack";
import CatalogProductsScreen from "../screens/wholesaler/CatalogProductsScreen";
import ProductEditorScreen from "../screens/wholesaler/ProductEditorScreen";

const Stack = createNativeStackNavigator();

export default function WholesalerCatalogStack() {
  return <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="CatalogHome" component={CatalogProductsScreen} />
    <Stack.Screen name="ProductEditor" component={ProductEditorScreen} />
  </Stack.Navigator>;
}
