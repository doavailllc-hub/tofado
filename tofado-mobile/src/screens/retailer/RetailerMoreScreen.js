import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";

const items = [
  ["Tofado Intelligence", "sparkles-outline", "CommerceIntelligence"],
  ["Invoices & balances", "receipt-outline", "RetailerInvoices"],
  ["Business profile", "person-outline", "Profile"],
];

export default function RetailerMoreScreen({ navigation }) {
  return <SafeAreaView style={styles.safe} edges={["top"]}><ScrollView contentContainerStyle={styles.page}>
    <Text style={styles.eyebrow}>BUSINESS TOOLS</Text><Text style={styles.title}>More</Text><Text style={styles.subtitle}>Finance and account settings in one place.</Text>
    <View style={styles.list}>{items.map(([label,icon,route])=><Pressable key={label} onPress={()=>navigation.navigate(route)} style={({pressed})=>[styles.item,pressed&&styles.pressed]}><View style={styles.icon}><Ionicons name={icon} size={21} color={colors.primaryDark}/></View><Text style={styles.label}>{label}</Text><Ionicons name="chevron-forward" size={18} color={colors.muted}/></Pressable>)}</View>
  </ScrollView></SafeAreaView>;
}
const styles=StyleSheet.create({safe:{flex:1,backgroundColor:"#F9F7FC"},page:{padding:18,paddingBottom:34},eyebrow:{marginTop:16,color:colors.primaryDark,fontSize:9,fontWeight:"900",letterSpacing:1},title:{marginTop:6,color:colors.ink,fontSize:29,fontWeight:"900"},subtitle:{marginTop:6,color:colors.muted,fontSize:11},list:{marginTop:24,overflow:"hidden",borderWidth:1,borderColor:colors.border,borderRadius:20,backgroundColor:colors.white},item:{minHeight:72,flexDirection:"row",alignItems:"center",gap:12,paddingHorizontal:14,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},pressed:{backgroundColor:colors.primarySoft},icon:{width:43,height:43,alignItems:"center",justifyContent:"center",borderRadius:14,backgroundColor:colors.primarySoft},label:{flex:1,color:colors.ink,fontSize:12,fontWeight:"900"}});
