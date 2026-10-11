import { useEffect, useState } from 'react';
import { BadgeIndianRupee, Bot, Boxes, BrainCircuit, ChartNoAxesCombined, CheckCircle2, Clock3, Languages, MessageCircleMore, PackageSearch, RefreshCw, ShieldCheck, Sparkles, UsersRound } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import './CommerceIntelligence.css';

const icons = { smart_reorder: RefreshCw, price_discovery: PackageSearch, upi_reconciliation: BadgeIndianRupee, credit_passport: ShieldCheck, group_buying: UsersRound, whatsapp_ordering: MessageCircleMore, voice_ordering: Languages, expiry_marketplace: Boxes, supplier_trust: CheckCircle2, gst_intelligence: ChartNoAxesCombined };

export default function CommerceIntelligence() {
  const { user } = useAuth();
  const [data,setData]=useState(null); const [error,setError]=useState(''); const [text,setText]=useState(''); const [draft,setDraft]=useState(null); const [busy,setBusy]=useState(false);
  const load=async()=>{try{setError('');setData((await api.get('/commerce/overview')).data);}catch(e){setError(e.response?.data?.message||'Unable to load intelligence workspace.');}};
  useEffect(()=>{load();},[]);
  const createDraft=async()=>{if(!text.trim())return;setBusy(true);try{setDraft((await api.post('/commerce/conversations/drafts',{text,channel:'app'})).data);}catch(e){setError(e.response?.data?.message||'Could not understand this order.');}finally{setBusy(false);}};
  if(error&&!data)return <div className="ci-state"><BrainCircuit/><h2>Intelligence workspace unavailable</h2><p>{error}</p><button onClick={load}>Try again</button></div>;
  if(!data)return <div className="ci-state"><RefreshCw className="ci-spin"/><p>Preparing business intelligence...</p></div>;
  return <div className="ci-page">
    <header className="ci-hero"><div><span><Sparkles size={15}/> TOFADO INTELLIGENCE</span><h1>AI-assisted commerce control centre</h1><p>Ten connected tools for smarter buying, selling, payments, inventory and GST decisions.</p></div><div className="ci-live"><i/><strong>Live workspace</strong><small>{user?.business_name||user?.name}</small></div></header>
    <section className="ci-highlights">{Object.entries(data.highlights||{}).map(([key,value])=><article key={key}><small>{key.replaceAll('_',' ')}</small><strong>{typeof value==='boolean'?(value?'Enabled':'Not enabled'):value}</strong></article>)}</section>
    <section className="ci-grid">{data.features.map(feature=>{const Icon=icons[feature.id]||Bot;return <article key={feature.id} className="ci-card"><div className="ci-icon"><Icon size={21}/></div><div><span className="ci-status"><i/> Active</span><h2>{feature.name}</h2><p>{feature.description}</p></div></article>;})}</section>
    {user?.role==='retailer'&&<section className="ci-assistant"><div className="ci-assistant-copy"><span><Bot size={16}/> ORDER ASSISTANT</span><h2>Type or dictate your purchase list</h2><p>Supports Indian English and transliterated Hindi. Nothing is ordered until you confirm the draft.</p></div><div className="ci-composer"><textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Example: do carton Rice and 5 kg Sugar"/><button disabled={busy||!text.trim()} onClick={createDraft}>{busy?'Understanding...':'Create safe draft'}</button></div>{draft&&<div className="ci-draft"><div><CheckCircle2 size={18}/><strong>Draft ready for confirmation</strong><span>{draft.language}</span></div>{draft.items.map((item,index)=><p key={`${item.product_id||item.product_name}-${index}`}><b>{item.quantity} {item.unit}</b> {item.product_name}<small>{item.matched?'Catalog matched':'Review product name'}</small></p>)}</div>}</section>}
    <footer className="ci-note"><Clock3 size={17}/><p><strong>Human confirmation stays in control.</strong> Recommendations, credit factors, quote rankings and conversational orders remain explainable and reviewable.</p></footer>
  </div>;
}
