import type {Brief,Quote,Evidence,RecallResult,Comparison,CandidateResult,MemoryRecord} from '@/domain/types';
import {dateAfter} from '@/domain/fixtures';
import {storeDate} from '@/domain/date';
export function compareEvidence(brief:Brief,quotes:Quote[],evidence:Evidence[],recall:RecallResult,asOf:string):Comparison{
  const day=asOf.length===10?asOf:storeDate(asOf);
  const superseded=new Set(recall.memories.map(m=>m.supersedesId));
  const memories=recall.memories.filter(m=>!superseded.has(m.id)&&(!m.purpose||m.purpose===brief.purpose));
  const preference=memories.filter(m=>m.kind==='preference'&&m.purpose===brief.purpose&&m.facts?.priority).sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt)||b.id.localeCompare(a.id))[0];
  const priority=preference?.facts?.priority??(brief.purpose==='launch'?'reliability':'price');
  const candidates:CandidateResult[]=[];const excluded:Comparison['excluded']=[];
  const quoteBySupplier=new Map<string,Quote>();for(const q of quotes.filter(q=>q.briefId===brief.id)){const current=quoteBySupplier.get(q.supplierId);if(!current||(q.confirmedAt??'')>(current.confirmedAt??''))quoteBySupplier.set(q.supplierId,q);}
  for(const q of quoteBySupplier.values()){
    const failures:string[]=[];const questions:string[]=[];
    if(q.specification.trim().toLowerCase()!==brief.specification.trim().toLowerCase())failures.push('Specification does not match the sourcing brief.');
    if(q.quantity!==brief.quantity)failures.push('Quoted quantity does not match.');
    if(q.currency!=='USD')failures.push('Only USD quotes can be compared.');
    if(q.expiry&&q.expiry<day)failures.push('Quote has expired.');
    if(q.minimumOrder!==null&&q.minimumOrder>brief.quantity)failures.push('Minimum order is above the requested quantity.');
    if(!q.confirmedAt)questions.push('Review and confirm the quote.');
    if(!q.quotedAt)questions.push('Confirm when this quote was issued.');
    if(q.quotedAt&&q.quotedAt>day)failures.push('Quote issue date is in the future.');
    if(!q.expiry)questions.push('Confirm quote expiry.');
    if(q.minimumOrder===null)questions.push('Confirm the minimum order quantity.');
    if(q.unitPriceCents===null)questions.push('Confirm the unit price.');
    if(q.shippingCents===null)questions.push('Confirm shipping costs.');
    if(q.taxCents===null)questions.push('Confirm applicable tax.');
    const total=q.unitPriceCents!==null&&q.shippingCents!==null&&q.taxCents!==null?q.quantity*q.unitPriceCents+q.shippingCents+q.taxCents:null;
    if(total!==null&&total>brief.budgetCents)failures.push('Known total exceeds your budget.');
    const arrival=q.productionDays!==null&&q.transitDays!==null&&q.deliveryDaysKind==='calendar'?dateAfter(day,q.productionDays+q.transitDays):null;
    if(arrival&&arrival>brief.neededBy)failures.push('Promised delivery would miss your needed-by date.');
    if(!arrival)questions.push('Confirm production and transit in calendar days.');
    const sources=q.evidenceIds.filter(id=>evidence.some(e=>e.id===id&&e.supplierId===q.supplierId&&e.kind==='quote'));
    if(!sources.length)questions.push('Attach the source quote.');
    const history=memories.filter(m=>m.supplierId===q.supplierId&&m.kind==='outcome'&&m.facts?.actualDays!==undefined&&m.facts.promisedDays!==undefined);
    const late=history.filter(m=>m.facts!.actualDays!>m.facts!.promisedDays!);
    const quality=memories.filter(m=>m.supplierId===q.supplierId&&m.kind==='outcome'&&m.facts?.qualityIssue===true&&!m.facts.resolved);
    const reasons:CandidateResult['reasons']=[{text:total===null?'Delivered cost is incomplete.':`Quoted total: $${(total/100).toFixed(2)} for ${q.quantity} units.`,evidenceIds:sources,memoryIds:[]}];
    if(history.length)reasons.push({text:`${late.length} late deliveries in ${history.length} recorded ${history.length===1?'order':'orders'} (${history.map(m=>m.occurredAt.slice(0,10)).join(', ')}).`,evidenceIds:[],memoryIds:history.map(m=>m.id)});
    else reasons.push({text:'No observed delivery history yet.',evidenceIds:[],memoryIds:[]});
    if(quality.length)reasons.push({text:'An unresolved quality issue needs a follow-up.',evidenceIds:[],memoryIds:quality.map(m=>m.id)});
    if(arrival)reasons.push({text:`Quoted arrival: ${arrival}. This is a supplier promise, not a delivery guarantee.`,evidenceIds:sources,memoryIds:[]});
    if(failures.length)excluded.push({supplierId:q.supplierId,reasons:failures});
    candidates.push({supplierId:q.supplierId,totalCents:total,arrival,lateCount:late.length,observationCount:history.length,reasons,questions,eligible:!failures.length});
  }
  const risk=(c:CandidateResult)=>c.observationCount?c.lateCount/c.observationCount:0.5;
  const valid=candidates.filter(c=>c.eligible).sort((a,b)=>{
    if(priority==='reliability'&&risk(a)!==risk(b))return risk(a)-risk(b);
    const cost=(a.totalCents??Infinity)-(b.totalCents??Infinity);return Number.isNaN(cost)||cost===0?a.supplierId.localeCompare(b.supplierId):cost;
  });
  const questions=[...new Set(valid.flatMap(c=>c.questions))];if(recall.status!=='complete')questions.push('Memory could not be fully retrieved. Retry before making a final decision.');
  const reasons=valid[0]?.reasons??[];
  if(preference)reasons.push(preferenceReason(preference));
  return {briefId:brief.id,status:!valid.length?'blocked':questions.length>0||recall.status!=='complete'?'provisional':'ready',rankedSupplierIds:valid.map(c=>c.supplierId),excluded,candidates,reasons,questions,recalledMemoryIds:memories.map(m=>m.id),memoryStatus:recall.status};
}
function preferenceReason(m:MemoryRecord){return {text:`Your ${m.purpose} preference: ${m.text}`,evidenceIds:[],memoryIds:[m.id]};}
