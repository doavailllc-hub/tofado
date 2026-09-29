import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
const tones={blue:[colors.primary,colors.primarySoft],green:[colors.green,colors.greenSoft],orange:[colors.orange,colors.orangeSoft],purple:[colors.purple,colors.purpleSoft]};
export default function StatCard({label,value,icon="stats-chart-outline",tone="blue"}){
 const [accent,soft]=tones[tone]||tones.blue;
 return <View style={styles.card}><View style={styles.top}><View style={[styles.icon,{backgroundColor:soft}]}><Ionicons name={icon} size={18} color={accent}/></View><Text style={styles.label}>{label}</Text></View><Text numberOfLines={1} style={styles.value}>{value??"—"}</Text></View>;
}
const styles=StyleSheet.create({card:{width:"48.5%",minHeight:106,padding:14,borderWidth:1,borderColor:colors.border,borderRadius:18,backgroundColor:colors.white},top:{flexDirection:"row",alignItems:"center",gap:8},icon:{width:34,height:34,alignItems:"center",justifyContent:"center",borderRadius:11},label:{flex:1,color:colors.body,fontSize:10,fontWeight:"700"},value:{marginTop:14,color:colors.ink,fontSize:21,fontWeight:"800",letterSpacing:-.6}});
