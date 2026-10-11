export const subscriptionPlans = [
  { code:'starter', name:'Starter', monthly_price:999, product_limit:100, team_limit:2, description:'Core catalog, orders, invoices and payments.' },
  { code:'growth', name:'Growth', monthly_price:2499, product_limit:1000, team_limit:8, description:'Advanced intelligence, automation and priority support.' },
  { code:'scale', name:'Scale', monthly_price:5999, product_limit:null, team_limit:null, description:'Unlimited catalog, team access and assisted onboarding.' },
];
export const subscriptionPlan = code => subscriptionPlans.find(plan => plan.code === code);
export function subscriptionAccess(subscription, now = new Date()) {
  if (!subscription) return { allowed:false, reason:'missing' };
  const grace = subscription.grace_period_ends_at && new Date(subscription.grace_period_ends_at) >= now;
  const trial = subscription.status === 'trialing' && new Date(subscription.trial_ends_at) >= now;
  const active = subscription.status === 'active' && new Date(subscription.current_period_ends_at) >= now;
  return { allowed:Boolean(trial || active || (subscription.status === 'past_due' && grace)), in_grace_period:Boolean(subscription.status === 'past_due' && grace), reason:trial?'trial':active?'active':grace?'grace':subscription.status };
}
export function demoSubscription(scenario, now = new Date()) {
  const add = days => new Date(now.getTime() + days * 86400000).toISOString();
  const base = { id:'demo', plan_code:'growth', plan_name:'Growth', monthly_price:2499, billing_mode:'demo', cancel_at_period_end:false, failed_payment_count:0, current_period_starts_at:add(-2), current_period_ends_at:add(28), trial_ends_at:null, grace_period_ends_at:null };
  if (scenario === 'trialing') return { ...base, status:'trialing', trial_ends_at:add(12), current_period_starts_at:null, current_period_ends_at:null, access:{allowed:true,reason:'trial',in_grace_period:false} };
  if (scenario === 'past_due') return { ...base, status:'past_due', failed_payment_count:1, grace_period_ends_at:add(5), access:{allowed:true,reason:'grace',in_grace_period:true}, latest_attempt:{status:'failed',failure_code:'PAYMENT_DECLINED',failure_message:'The renewal payment was declined by the bank.',attempted_at:now.toISOString()} };
  if (scenario === 'expired') return { ...base, status:'expired', current_period_ends_at:add(-1), access:{allowed:false,reason:'expired',in_grace_period:false} };
  if (scenario === 'cancelled') return { ...base, status:'active', cancel_at_period_end:true, access:{allowed:true,reason:'active',in_grace_period:false} };
  return { ...base, status:'active', access:{allowed:true,reason:'active',in_grace_period:false}, latest_attempt:{status:'successful',attempted_at:add(-2)} };
}
