import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../services/api';
import { colors } from '../../theme/colors';
import MobileHeader from '../../components/MobileHeader';
import ErrorState from '../../components/ErrorState';

const icon={smart_reorder:'refresh-outline',price_discovery:'search-outline',upi_reconciliation:'wallet-outline',credit_passport:'shield-checkmark-outline',group_buying:'people-outline',whatsapp_ordering:'logo-whatsapp',voice_ordering:'mic-outline',expiry_marketplace:'cube-outline',supplier_trust:'star-outline',gst_intelligence:'stats-chart-outline'};
export default function CommerceIntelligenceScreen(){
  const [data,setData]=useState(null),[error,setError]=useState(''),[refreshing,setRefreshing]=useState(false);
  const load=useCallback(async()=>{try{setError('');setData((await api.get('/commerce/overview')).data);}catch(e){setError(e.response?.data?.message||'Unable to load intelligence tools.');}finally{setRefreshing(false);}},[]);
  useFocusEffect(useCallback(()=>{load();},[load]));
  if(error&&!data)return <SafeAreaView style={styles.safe}><ErrorState message={error} onRetry={load}/></SafeAreaView>;
  return <SafeAreaView style={styles.safe} edges={['top']}><ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);load();}}/>}>
    <MobileHeader eyebrow="Tofado Intelligence" title="Smart commerce" subtitle="Ten connected tools for buying, selling, stock, credit, payments and GST."/>
    <View style={styles.banner}><Ionicons name="sparkles" size={23} color="#fff"/><View><Text style={styles.bannerTitle}>AI-assisted, human confirmed</Text><Text style={styles.bannerText}>Every suggestion stays explainable and under your control.</Text></View></View>
    <View style={styles.grid}>{(data?.features||[]).map(feature=><View style={styles.card} key={feature.id}><View style={styles.icon}><Ionicons name={icon[feature.id]||'apps-outline'} size={20} color={colors.primaryDark}/></View><View style={styles.copy}><Text style={styles.active}>● ACTIVE</Text><Text style={styles.title}>{feature.name}</Text><Text style={styles.text}>{feature.description}</Text></View></View>)}</View>
  </ScrollView></SafeAreaView>;
}
const styles=StyleSheet.create({safe:{flex:1,backgroundColor:colors.soft},page:{padding:18,paddingBottom:40},banner:{marginTop:20,flexDirection:'row',alignItems:'center',gap:12,padding:17,borderRadius:18,backgroundColor:colors.purple},bannerTitle:{color:'#fff',fontSize:13,fontWeight:'900'},bannerText:{maxWidth:260,marginTop:3,color:'#EDE9FE',fontSize:10,lineHeight:15},grid:{marginTop:14,gap:10},card:{flexDirection:'row',gap:12,padding:15,borderWidth:1,borderColor:colors.border,borderRadius:17,backgroundColor:'#fff'},icon:{width:42,height:42,alignItems:'center',justifyContent:'center',borderRadius:13,backgroundColor:colors.primarySoft},copy:{flex:1},active:{color:colors.green,fontSize:8,fontWeight:'900',letterSpacing:.8},title:{marginTop:4,color:colors.ink,fontSize:13,fontWeight:'900'},text:{marginTop:3,color:colors.muted,fontSize:10,lineHeight:15}});
