import test from 'node:test';
import assert from 'node:assert/strict';
import { demoSubscription, subscriptionAccess, subscriptionPlan } from '../src/utils/subscriptions.js';

const now=new Date('2026-10-11T12:00:00.000Z');
test('subscription access supports trial, active and payment grace periods',()=>{
  assert.equal(subscriptionAccess({status:'trialing',trial_ends_at:'2026-10-20'},now).allowed,true);
  assert.equal(subscriptionAccess({status:'active',current_period_ends_at:'2026-11-11'},now).allowed,true);
  const grace=subscriptionAccess({status:'past_due',grace_period_ends_at:'2026-10-16'},now);
  assert.equal(grace.allowed,true); assert.equal(grace.in_grace_period,true);
  assert.equal(subscriptionAccess({status:'expired',current_period_ends_at:'2026-10-10'},now).allowed,false);
});
test('billing demo exposes failure and cancellation without payment data',()=>{
  const failed=demoSubscription('past_due',now);
  assert.equal(failed.status,'past_due'); assert.equal(failed.latest_attempt.status,'failed'); assert.equal(failed.access.allowed,true);
  const cancelling=demoSubscription('cancelled',now);
  assert.equal(cancelling.cancel_at_period_end,true); assert.equal(cancelling.status,'active');
  assert.equal(subscriptionPlan('growth').monthly_price,1999);
  assert.equal('card_number' in failed,false);
});
