import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import AppButton from "./AppButton";
export default function ErrorState({ title="Something went wrong", message="We couldn't load this information. Please try again.", onRetry }){return <View style={styles.wrap}><View style={styles.icon}><Ionicons name="cloud-offline-outline" size={28} color={colors.red}/></View><Text style={styles.title}>{title}</Text><Text style={styles.message}>{message}</Text>{onRetry&&<AppButton label="Try again" icon="refresh" variant="ghost" onPress={onRetry} style={styles.button}/>}</View>}
const styles=StyleSheet.create({wrap:{minHeight:280,alignItems:"center",justifyContent:"center",padding:28},icon:{width:60,height:60,alignItems:"center",justifyContent:"center",borderRadius:20,backgroundColor:colors.redSoft},title:{marginTop:14,color:colors.ink,fontSize:17,fontWeight:"800"},message:{maxWidth:300,marginTop:6,color:colors.body,fontSize:13,lineHeight:20,textAlign:"center"},button:{marginTop:18,minWidth:140}});
