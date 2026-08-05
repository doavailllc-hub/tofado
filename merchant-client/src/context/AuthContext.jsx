import {createContext,useContext,useEffect,useState} from 'react';
import api from '../services/api';
const AuthContext=createContext(null);
export function AuthProvider({children}){
 const [user,setUser]=useState(()=>JSON.parse(localStorage.getItem('tofado_user')||'null'));
 const [loading,setLoading]=useState(false);
 const login=async(email,password)=>{setLoading(true);try{const {data}=await api.post('/auth/login',{email,password});localStorage.setItem('tofado_token',data.token);localStorage.setItem('tofado_user',JSON.stringify(data.user));setUser(data.user);return data.user;}finally{setLoading(false)}};
 const logout=()=>{localStorage.removeItem('tofado_token');localStorage.removeItem('tofado_user');setUser(null)};
 useEffect(()=>{if(!user)return;api.get('/auth/me').then(({data})=>{setUser(data);localStorage.setItem('tofado_user',JSON.stringify(data))}).catch(logout)},[]);
 return <AuthContext.Provider value={{user,login,logout,loading}}>{children}</AuthContext.Provider>
}
export const useAuth=()=>useContext(AuthContext);
