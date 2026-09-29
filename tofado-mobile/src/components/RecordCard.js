import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import StatusBadge from "./StatusBadge";
export default function RecordCard({icon="cube-outline",title,subtitle,meta,amount,status,onPress,children}){
 const Body=onPress?Pressable:View;
 return <Body onPress={onPress} style={({pressed})=>[styles.row,pressed&&onPress?styles.pressed:null]}>
   <View style={styles.leading}><Ionicons name={icon} size={19} color={colors.primary}/></View>
   <View style={styles.copy}><Text numberOfLines={1} style={styles.title}>{title}</Text>{!!subtitle&&<Text numberOfLines={1} style={styles.subtitle}>{subtitle}</Text>}{!!meta&&<Text numberOfLines={1} style={styles.meta}>{meta}</Text>}</View>
   <View style={styles.trailing}>{!!amount&&<Text style={styles.amount}>{amount}</Text>}{!!status&&<StatusBadge status={status}/>}{!!onPress&&<Ionicons name="chevron-forward" size={17} color={colors.muted}/>}</View>
   {children}
 </Body>;
}
const styles=StyleSheet.create({row:{minHeight:70,flexDirection:"row",alignItems:"center",gap:11,paddingVertical:12,paddingHorizontal:2,borderBottomWidth:1,borderBottomColor:colors.border,backgroundColor:colors.white},pressed:{opacity:.65},leading:{width:42,height:42,alignItems:"center",justifyContent:"center",borderRadius:13,backgroundColor:colors.primarySoft},copy:{flex:1,minWidth:0},title:{color:colors.ink,fontSize:12,fontWeight:"800"},subtitle:{marginTop:3,color:colors.body,fontSize:9},meta:{marginTop:4,color:colors.muted,fontSize:8},trailing:{alignItems:"flex-end",gap:4},amount:{color:colors.ink,fontSize:10,fontWeight:"800"}});
