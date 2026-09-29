import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "../../context/AuthContext";
import { colors } from "../../theme/colors";
import { IS_WHOLESALER_APP } from "../../config/appVariant";

export default function WrongAppScreen() {
  const { logout } = useAuth();
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.page}>
        <View style={styles.icon}><Ionicons name="storefront-outline" size={34} color={colors.primary} /></View>
        <Text style={styles.title}>{IS_WHOLESALER_APP ? "Business accounts only" : "Retailer accounts only"}</Text>
        <Text style={styles.copy}>{IS_WHOLESALER_APP ? "This is Tofado Wholesaler. Use Tofado Retailer for a retailer account." : "This is Tofado Retailer. Use Tofado Wholesaler for a wholesaler account."}</Text>
        <Pressable onPress={logout} style={styles.button}><Text style={styles.buttonText}>Use another account</Text></Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles=StyleSheet.create({safe:{flex:1,backgroundColor:"#FFFFFF"},page:{flex:1,alignItems:"center",justifyContent:"center",padding:28},icon:{width:76,height:76,alignItems:"center",justifyContent:"center",borderRadius:25,backgroundColor:colors.primarySoft},title:{marginTop:22,color:colors.ink,fontSize:24,fontWeight:"900",textAlign:"center"},copy:{maxWidth:340,marginTop:10,color:colors.body,fontSize:12,lineHeight:19,textAlign:"center"},button:{minHeight:52,marginTop:24,paddingHorizontal:22,alignItems:"center",justifyContent:"center",borderRadius:15,backgroundColor:colors.primary},buttonText:{color:colors.white,fontSize:11,fontWeight:"900"}});
