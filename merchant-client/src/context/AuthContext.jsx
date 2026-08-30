import {createContext,useContext,useEffect,useState} from 'react';
import api from '../services/api';
const AuthContext=createContext(null);
export function AuthProvider({children}){
 const [user,setUser]=useState(()=>JSON.parse(localStorage.getItem('tofado_user')||'null'));
 const [loading,setLoading]=useState(false);
 const saveSession=(data)=>{localStorage.setItem('tofado_token',data.token);localStorage.setItem('tofado_user',JSON.stringify(data.user));setUser(data.user);return data.user};
 const requestEmailCode=async(email)=>{const {data}=await api.post('/auth/email/request',{email:String(email||'').trim().toLowerCase()});return data};
 const verifyEmailCode=async(email,code,role)=>{setLoading(true);try{const {data}=await api.post('/auth/email/verify',{email:String(email||'').trim().toLowerCase(),code:String(code||'').trim(),role:role||undefined});return saveSession(data)}finally{setLoading(false)}};
 const googleLogin=async(idToken,role)=>{setLoading(true);try{const {data}=await api.post('/auth/google',{id_token:idToken,role:role||undefined});return saveSession(data)}finally{setLoading(false)}};
 const logout=()=>{localStorage.removeItem('tofado_token');localStorage.removeItem('tofado_user');setUser(null)};
 useEffect(()=>{if(!user)return;api.get('/auth/me').then(({data})=>{setUser(data);localStorage.setItem('tofado_user',JSON.stringify(data))}).catch(logout)},[]);
 return <AuthContext.Provider value={{user,requestEmailCode,verifyEmailCode,googleLogin,logout,loading}}>{children}</AuthContext.Provider>
}
export const useAuth=()=>useContext(AuthContext);
