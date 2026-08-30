import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
export async function auth(req,res,next){const token=req.headers.authorization?.replace('Bearer ','');if(!token)return res.status(401).json({message:'Authentication required'});try{const payload=jwt.verify(token,process.env.JWT_SECRET||'dev-secret');const [[user]]=await pool.query("SELECT id,role,status FROM users WHERE id=? LIMIT 1",[payload.id]);if(!user||user.status!=='active')return res.status(401).json({message:'This account is no longer approved'});req.user={...payload,id:user.id,role:user.role};next()}catch{return res.status(401).json({message:'Invalid or expired session'})}}
export const allow=(...roles)=>(req,res,next)=>roles.includes(req.user.role)?next():res.status(403).json({message:'Access denied'});
