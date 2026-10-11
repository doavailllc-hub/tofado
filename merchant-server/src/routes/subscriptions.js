import express from 'express';
import { pool } from '../db.js';
import { auth, allow } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/http.js';
import { demoSubscription, subscriptionAccess, subscriptionPlan, subscriptionPlans } from '../utils/subscriptions.js';

const router=express.Router(); router.use(auth,allow('wholesaler'));
const query=async(sql,params=[])=>(await pool.query(sql,params))[0];
async function current(id){
  await query(`INSERT IGNORE INTO merchant_subscriptions(wholesaler_id,plan_code,status,trial_ends_at) VALUES(?,'growth','trialing',DATE_ADD(NOW(),INTERVAL 14 DAY))`,[id]);
  const [row]=await query(`SELECT s.*,(SELECT JSON_OBJECT('status',a.status,'failure_code',a.failure_code,'failure_message',a.failure_message,'attempted_at',a.attempted_at) FROM subscription_payment_attempts a WHERE a.subscription_id=s.id ORDER BY a.id DESC LIMIT 1) latest_attempt FROM merchant_subscriptions s WHERE s.wholesaler_id=?`,[id]);
  const plan=subscriptionPlan(row.plan_code); return {...row,...plan,latest_attempt:typeof row.latest_attempt==='string'?JSON.parse(row.latest_attempt):row.latest_attempt,access:subscriptionAccess(row),billing_mode:process.env.SUBSCRIPTION_PROVIDER?'live':'setup_required'};
}
router.get('/',asyncHandler(async(req,res)=>res.json({subscription:await current(req.user.id),plans:subscriptionPlans})));
router.get('/demo/:scenario',asyncHandler(async(req,res)=>{if(!['trialing','active','past_due','expired','cancelled'].includes(req.params.scenario))return res.status(400).json({message:'Unknown demo scenario.'});res.json({subscription:demoSubscription(req.params.scenario),plans:subscriptionPlans,demo:true})}));
router.put('/plan',asyncHandler(async(req,res)=>{const plan=subscriptionPlan(req.body?.plan_code);if(!plan)return res.status(400).json({message:'Select a valid plan.'});const subscription=await current(req.user.id);if(subscription.billing_mode!=='live')return res.status(503).json({code:'PAYMENT_PROVIDER_REQUIRED',message:'Online subscription payments are not configured yet. Use Demo mode to preview plan changes.'});await query('UPDATE merchant_subscriptions SET plan_code=? WHERE wholesaler_id=?',[plan.code,req.user.id]);res.json({message:'Plan updated.',subscription:await current(req.user.id)})}));
router.post('/cancel',asyncHandler(async(req,res)=>{await current(req.user.id);await query('UPDATE merchant_subscriptions SET cancel_at_period_end=1 WHERE wholesaler_id=?',[req.user.id]);res.json({message:'Cancellation scheduled. Access continues until the current period ends.',subscription:await current(req.user.id)})}));
router.post('/resume',asyncHandler(async(req,res)=>{await current(req.user.id);await query('UPDATE merchant_subscriptions SET cancel_at_period_end=0 WHERE wholesaler_id=?',[req.user.id]);res.json({message:'Subscription renewal resumed.',subscription:await current(req.user.id)})}));
router.post('/retry',asyncHandler(async(req,res)=>{const subscription=await current(req.user.id);if(subscription.billing_mode!=='live')return res.status(503).json({code:'PAYMENT_PROVIDER_REQUIRED',message:'Payment retry needs a configured subscription provider. No charge was attempted.'});return res.status(501).json({message:'Provider retry adapter is not implemented.'})}));
export default router;
