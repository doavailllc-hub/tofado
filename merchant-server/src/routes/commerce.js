import express from 'express';
import { pool } from '../db.js';
import { auth, allow } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/http.js';
import { creditPassport, expiryAction, groupBuyProgress, gstAnalytics, parseConversationalOrder, rankQuotes, reconcileUpi, reorderRecommendation, supplierTrust } from '../utils/commerce-intelligence.js';

const router = express.Router();
const query = async (sql, params = []) => (await pool.query(sql, params))[0];
const positive = (value, name) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw Object.assign(new Error(`${name} must be greater than zero.`), { status: 400 });
  return parsed;
};

router.use(auth);

router.get('/overview', asyncHandler(async (req, res) => {
  const role = req.user.role;
  const features = [
    ['smart_reorder', 'Smart reorder', 'Predict stock needs from purchase velocity.'],
    ['price_discovery', 'Price discovery', 'Compare landed quote value across suppliers.'],
    ['upi_reconciliation', 'UPI reconciliation', 'Match references and amounts with invoices.'],
    ['credit_passport', 'Credit passport', 'Consent-based, explainable business credit profile.'],
    ['group_buying', 'Group buying', 'Combine retailer demand to unlock bulk pricing.'],
    ['whatsapp_ordering', 'WhatsApp ordering', 'Turn messages into confirmable order drafts.'],
    ['voice_ordering', 'Regional voice ordering', 'Parse English and transliterated Hindi orders.'],
    ['expiry_marketplace', 'Batch and expiry control', 'Protect margin with discount or transfer actions.'],
    ['supplier_trust', 'Supplier trust', 'Transparent fulfilment, delivery and quality scoring.'],
    ['gst_intelligence', 'GST intelligence', 'Live taxable value, GST and margin reporting.'],
  ].map(([id, name, description]) => ({ id, name, description, status: 'active' }));
  let highlights = {};
  if (role === 'retailer') {
    const [[quotes], [groups], [consent]] = await Promise.all([
      query("SELECT COUNT(*) count FROM quote_requests WHERE retailer_id=? AND status='open'", [req.user.id]),
      query("SELECT COUNT(*) count FROM group_buys WHERE status='open' AND closes_at>NOW()"),
      query('SELECT granted FROM credit_consents WHERE retailer_id=?', [req.user.id]),
    ]);
    highlights = { open_quote_requests: quotes?.count || 0, active_group_buys: groups?.count || 0, credit_consent: Boolean(consent?.granted) };
  } else if (role === 'wholesaler') {
    const [[quotes], [batches]] = await Promise.all([
      query("SELECT COUNT(*) count FROM quote_requests WHERE status='open'"),
      query("SELECT COUNT(*) count FROM inventory_batches WHERE wholesaler_id=? AND status IN ('active','discounted') AND expiry_date<=DATE_ADD(CURDATE(),INTERVAL 60 DAY)", [req.user.id]),
    ]);
    highlights = { quote_opportunities: quotes?.count || 0, expiring_batches: batches?.count || 0 };
  }
  res.json({ role, features, highlights });
}));

router.get('/reorder', allow('retailer'), asyncHandler(async (req, res) => {
  const rows = await query(`SELECT inventory.*, COALESCE(history.quantity_90d,0)/90 average_daily_sales
    FROM retailer_inventory inventory
    LEFT JOIN (SELECT o.retailer_id,i.product_name,SUM(i.quantity) quantity_90d FROM purchase_order_items i JOIN purchase_orders o ON o.id=i.order_id WHERE o.created_at>=DATE_SUB(NOW(),INTERVAL 90 DAY) GROUP BY o.retailer_id,i.product_name) history
      ON history.retailer_id=inventory.retailer_id AND LOWER(history.product_name)=LOWER(inventory.product_name)
    WHERE inventory.retailer_id=? ORDER BY inventory.product_name`, [req.user.id]);
  res.json({ recommendations: rows.map(row => ({ ...row, ...reorderRecommendation({ stock: row.current_stock, average_daily_sales: row.average_daily_sales, lead_days: row.lead_days, safety_days: row.safety_days, pack_size: row.pack_size }) })) });
}));

router.put('/inventory', allow('retailer'), asyncHandler(async (req, res) => {
  const name = String(req.body?.product_name || '').trim().slice(0, 180);
  if (!name) return res.status(400).json({ message: 'Product name is required.' });
  await query(`INSERT INTO retailer_inventory(retailer_id,product_name,current_stock,pack_size,lead_days,safety_days) VALUES(?,?,?,?,?,?)
    ON DUPLICATE KEY UPDATE current_stock=VALUES(current_stock),pack_size=VALUES(pack_size),lead_days=VALUES(lead_days),safety_days=VALUES(safety_days)`, [req.user.id, name, Math.max(0, Number(req.body.current_stock)||0), Math.max(1, Number(req.body.pack_size)||1), Math.max(0, Number(req.body.lead_days)||3), Math.max(0, Number(req.body.safety_days)||2)]);
  res.json({ message: 'Inventory level saved.' });
}));

router.get('/quotes', asyncHandler(async (req, res) => {
  const where = req.user.role === 'retailer' ? 'qr.retailer_id=?' : "qr.status='open'";
  const params = req.user.role === 'retailer' ? [req.user.id] : [];
  const requests = await query(`SELECT qr.*,u.business_name retailer_name FROM quote_requests qr JOIN users u ON u.id=qr.retailer_id WHERE ${where} ORDER BY qr.id DESC`, params);
  for (const request of requests) {
    const offers = await query(`SELECT qo.*,u.business_name wholesaler_name,50 trust_score FROM quote_offers qo JOIN users u ON u.id=qo.wholesaler_id WHERE qo.quote_request_id=?`, [request.id]);
    request.offers = rankQuotes(offers.map(offer => ({ ...offer, quantity: request.quantity })));
  }
  res.json({ requests });
}));

router.post('/quotes', allow('retailer'), asyncHandler(async (req, res) => {
  const product = String(req.body?.product_name || '').trim().slice(0, 180);
  if (!product) return res.status(400).json({ message: 'Product name is required.' });
  const result = await query('INSERT INTO quote_requests(retailer_id,product_name,quantity,unit,delivery_pincode,required_date) VALUES(?,?,?,?,?,?)', [req.user.id, product, positive(req.body.quantity, 'Quantity'), String(req.body.unit||'unit').slice(0,30), String(req.body.delivery_pincode||'').trim() || null, req.body.required_date || null]);
  res.status(201).json({ id: result.insertId, message: 'Quote request opened.' });
}));

router.post('/quotes/:id/offers', allow('wholesaler'), asyncHandler(async (req, res) => {
  const requestId = positive(req.params.id, 'Quote request');
  await query(`INSERT INTO quote_offers(quote_request_id,wholesaler_id,unit_price,gst_rate,delivery_fee,delivery_days,credit_days,notes) VALUES(?,?,?,?,?,?,?,?)
    ON DUPLICATE KEY UPDATE unit_price=VALUES(unit_price),gst_rate=VALUES(gst_rate),delivery_fee=VALUES(delivery_fee),delivery_days=VALUES(delivery_days),credit_days=VALUES(credit_days),notes=VALUES(notes)`, [requestId, req.user.id, positive(req.body.unit_price,'Unit price'), Math.max(0,Number(req.body.gst_rate)||0), Math.max(0,Number(req.body.delivery_fee)||0), Math.max(0,Number(req.body.delivery_days)||0), Math.max(0,Number(req.body.credit_days)||0), String(req.body.notes||'').slice(0,500)||null]);
  res.status(201).json({ message: 'Quote offer submitted.' });
}));

router.get('/reconciliation', allow('wholesaler'), asyncHandler(async (req,res)=>{
  const payments=await query(`SELECT id,amount,reference_no FROM payments WHERE wholesaler_id=? AND status='pending' AND method='upi' ORDER BY id DESC LIMIT 100`,[req.user.id]);
  const invoices=await query(`SELECT i.id,i.invoice_no,i.total_amount,i.paid_amount,COALESCE(po.order_no,co.order_no) order_no FROM invoices i LEFT JOIN purchase_orders po ON po.id=i.order_id LEFT JOIN wholesale_catalog_orders co ON co.id=i.catalog_order_id WHERE i.wholesaler_id=? AND i.status NOT IN ('paid','cancelled') ORDER BY i.id DESC LIMIT 300`,[req.user.id]);
  res.json({items:payments.map(payment=>({payment,...reconcileUpi(payment,invoices)}))});
}));

router.put('/credit-consent', allow('retailer'), asyncHandler(async (req, res) => {
  const granted = Boolean(req.body?.granted);
  await query(`INSERT INTO credit_consents(retailer_id,granted,consent_version,granted_at,revoked_at) VALUES(?,?, '2026-01',IF(?,NOW(),NULL),IF(?,NULL,NOW()))
    ON DUPLICATE KEY UPDATE granted=VALUES(granted),consent_version=VALUES(consent_version),granted_at=VALUES(granted_at),revoked_at=VALUES(revoked_at)`, [req.user.id, granted, granted, granted]);
  res.json({ granted });
}));

router.get('/credit-passport', allow('retailer'), asyncHandler(async (req, res) => {
  const [[consent], [metrics]] = await Promise.all([
    query('SELECT granted FROM credit_consents WHERE retailer_id=?', [req.user.id]),
    query(`SELECT AVG(CASE WHEN p.status='approved' AND p.paid_at<=i.due_date THEN 1 ELSE 0 END) on_time_payment_rate, AVG(CASE WHEN o.status='delivered' THEN 1 ELSE 0 END) completed_order_rate, TIMESTAMPDIFF(MONTH,MIN(o.created_at),NOW()) tenure_months, AVG(o.total_amount) average_monthly_purchases, 0 dispute_rate FROM purchase_orders o LEFT JOIN invoices i ON i.order_id=o.id LEFT JOIN payments p ON p.invoice_id=i.id WHERE o.retailer_id=?`, [req.user.id]),
  ]);
  res.json(creditPassport(metrics || {}, Boolean(consent?.granted)));
}));

router.get('/group-buys', asyncHandler(async (req, res) => {
  const rows = await query(`SELECT gb.*,u.business_name wholesaler_name,COALESCE(SUM(CASE WHEN c.status='committed' THEN c.quantity ELSE 0 END),0) committed_quantity FROM group_buys gb JOIN users u ON u.id=gb.wholesaler_id LEFT JOIN group_buy_commitments c ON c.group_buy_id=gb.id WHERE gb.status IN ('open','unlocked') AND gb.closes_at>NOW() GROUP BY gb.id ORDER BY gb.closes_at`);
  res.json({ group_buys: rows.map(row => ({ ...row, ...groupBuyProgress(row) })) });
}));

router.post('/group-buys', allow('wholesaler'), asyncHandler(async (req, res) => {
  const title=String(req.body?.title||'').trim().slice(0,180); if(!title) return res.status(400).json({message:'Title is required.'});
  const result=await query('INSERT INTO group_buys(wholesaler_id,product_id,title,target_quantity,base_price,group_price,closes_at) VALUES(?,?,?,?,?,?,?)',[req.user.id,req.body.product_id||null,title,positive(req.body.target_quantity,'Target quantity'),positive(req.body.base_price,'Base price'),positive(req.body.group_price,'Group price'),req.body.closes_at]);
  res.status(201).json({id:result.insertId,message:'Group buy published.'});
}));

router.post('/group-buys/:id/join', allow('retailer'), asyncHandler(async (req,res)=>{
  await query(`INSERT INTO group_buy_commitments(group_buy_id,retailer_id,quantity) VALUES(?,?,?) ON DUPLICATE KEY UPDATE quantity=VALUES(quantity),status='committed'`,[positive(req.params.id,'Group buy'),req.user.id,positive(req.body.quantity,'Quantity')]);
  res.status(201).json({message:'Group-buy commitment saved.'});
}));

router.post('/conversations/drafts', allow('retailer'), asyncHandler(async (req,res)=>{
  const catalog=await query('SELECT id,name FROM wholesale_products WHERE is_active=1 ORDER BY updated_at DESC LIMIT 500');
  const parsed=parseConversationalOrder(req.body?.text,catalog);
  if(!parsed.source_text) return res.status(400).json({message:'Order message or voice transcript is required.'});
  const channel=['app','voice','whatsapp'].includes(req.body?.channel)?req.body.channel:'app';
  const result=await query('INSERT INTO conversational_order_drafts(retailer_id,channel,language,source_text,parsed_items) VALUES(?,?,?,?,?)',[req.user.id,channel,parsed.language,parsed.source_text,JSON.stringify(parsed.items)]);
  res.status(201).json({id:result.insertId,channel,...parsed});
}));

router.get('/batches', allow('wholesaler'), asyncHandler(async (req,res)=>{
  const rows=await query('SELECT b.*,p.name product_name FROM inventory_batches b JOIN wholesale_products p ON p.id=b.product_id WHERE b.wholesaler_id=? ORDER BY b.expiry_date',[req.user.id]);
  res.json({batches:rows.map(row=>({...row,...expiryAction(row)}))});
}));

router.post('/batches', allow('wholesaler'), asyncHandler(async (req,res)=>{
  const result=await query(`INSERT INTO inventory_batches(wholesaler_id,product_id,batch_no,quantity,cost_price,manufactured_at,expiry_date) VALUES(?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE quantity=VALUES(quantity),cost_price=VALUES(cost_price),manufactured_at=VALUES(manufactured_at),expiry_date=VALUES(expiry_date)`,[req.user.id,positive(req.body.product_id,'Product'),String(req.body.batch_no||'').trim().slice(0,80),positive(req.body.quantity,'Quantity'),Math.max(0,Number(req.body.cost_price)||0),req.body.manufactured_at||null,req.body.expiry_date]);
  res.status(201).json({id:result.insertId,message:'Batch saved.'});
}));

router.get('/trust/:wholesalerId', asyncHandler(async (req,res)=>{
  const id=positive(req.params.wholesalerId,'Wholesaler');
  const [metrics]=await query(`SELECT AVG(CASE WHEN status NOT IN ('cancelled') THEN 1 ELSE 0 END) fulfilment_rate,AVG(CASE WHEN status='delivered' AND (required_date IS NULL OR updated_at<=required_date) THEN 1 ELSE 0 END) on_time_rate FROM purchase_orders WHERE wholesaler_id=?`,[id]);
  const [reviews]=await query('SELECT AVG(quality_rating)/5 quality_acceptance_rate FROM supplier_reviews WHERE wholesaler_id=?',[id]);
  res.json(supplierTrust({...metrics,...reviews,dispute_rate:0}));
}));

router.post('/trust/:wholesalerId/reviews', allow('retailer'), asyncHandler(async (req,res)=>{
  const wholesalerId=positive(req.params.wholesalerId,'Wholesaler');
  const orderId=positive(req.body.order_id,'Order');
  const quality=Math.round(positive(req.body.quality_rating,'Quality rating')); const delivery=Math.round(positive(req.body.delivery_rating,'Delivery rating'));
  if(quality>5||delivery>5)return res.status(400).json({message:'Ratings must be between 1 and 5.'});
  const [order]=await query("SELECT id FROM purchase_orders WHERE id=? AND retailer_id=? AND wholesaler_id=? AND status='delivered'",[orderId,req.user.id,wholesalerId]);
  if(!order)return res.status(403).json({message:'Only a delivered order can be reviewed.'});
  await query(`INSERT INTO supplier_reviews(retailer_id,wholesaler_id,order_id,quality_rating,delivery_rating,comment) VALUES(?,?,?,?,?,?) ON DUPLICATE KEY UPDATE quality_rating=VALUES(quality_rating),delivery_rating=VALUES(delivery_rating),comment=VALUES(comment)`,[req.user.id,wholesalerId,orderId,quality,delivery,String(req.body.comment||'').trim().slice(0,500)||null]);
  res.status(201).json({message:'Verified supplier review saved.'});
}));

router.get('/gst-analytics', asyncHandler(async (req,res)=>{
  const field=req.user.role==='retailer'?'retailer_id':'wholesaler_id';
  const records=await query(`SELECT subtotal,tax_amount,total_amount,0 cost_amount FROM invoices WHERE ${field}=? AND created_at>=DATE_SUB(NOW(),INTERVAL 12 MONTH)`,[req.user.id]);
  res.json(gstAnalytics(records));
}));

export default router;
