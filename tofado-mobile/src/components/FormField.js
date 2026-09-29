import { forwardRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius } from "../theme/colors";

const FormField = forwardRef(function FormField({ label, required, error, icon, secureTextEntry, multiline, style, ...props }, ref) {
  const [focused,setFocused]=useState(false); const [visible,setVisible]=useState(false);
  return <View style={style}><Text style={styles.label}>{label}{required && <Text style={styles.required}> *</Text>}</Text><View style={[styles.control,focused&&styles.focused,error&&styles.invalid,multiline&&styles.multiline]}>{icon&&<Ionicons name={icon} size={19} color={focused?colors.primary:colors.muted}/>}<TextInput ref={ref} {...props} multiline={multiline} secureTextEntry={secureTextEntry&&!visible} placeholderTextColor={colors.muted} onFocus={(e)=>{setFocused(true);props.onFocus?.(e);}} onBlur={(e)=>{setFocused(false);props.onBlur?.(e);}} style={[styles.input,multiline&&styles.textarea]} underlineColorAndroid="transparent"/>{secureTextEntry&&<Pressable focusable={false} hitSlop={12} onPress={()=>setVisible(v=>!v)} accessibilityLabel={visible?"Hide password":"Show password"}><Ionicons name={visible?"eye-off-outline":"eye-outline"} size={20} color={colors.body}/></Pressable>}</View>{error&&<Text style={styles.error}>{error}</Text>}</View>;
});
export default FormField;
const styles=StyleSheet.create({label:{marginBottom:7,color:colors.ink,fontSize:13,fontWeight:"700"},required:{color:colors.red},control:{minHeight:52,flexDirection:"row",alignItems:"center",gap:10,paddingHorizontal:14,borderWidth:1,borderColor:colors.borderStrong,borderRadius:radius.md,backgroundColor:colors.white},focused:{borderColor:colors.primary,shadowColor:colors.primary,shadowOpacity:.12,shadowRadius:6},invalid:{borderColor:colors.red},multiline:{alignItems:"flex-start",paddingTop:14},input:{flex:1,minHeight:50,color:colors.ink,fontSize:15},textarea:{minHeight:88,textAlignVertical:"top"},error:{marginTop:6,color:colors.red,fontSize:12,lineHeight:17}});
