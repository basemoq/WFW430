(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  if(root) root.CACOClassifier=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const clean=value=>String(value??'').replace(/[\u200e\u200f\u202a-\u202e]/g,' ').replace(/[_\/\\-]+/g,' ').replace(/\s+/g,' ').trim();
  const lower=value=>clean(value).toLowerCase();
  const has=(text,...patterns)=>patterns.some(pattern=>typeof pattern==='string'?text.includes(pattern):pattern.test(text));
  function extractPlan(text){
    const postpaid=text.match(/\bpostpaid\s*([0-9]+(?:\.[0-9]+)?)\b/i);
    if(postpaid)return `Postpaid ${postpaid[1]}`;
    const flex=text.match(/\bflex\s*([0-9]+(?:\.[0-9]+)?)\b/i);
    if(flex)return `Flex ${flex[1]}`;
    return '';
  }
  function extractSimType(text,explicit){
    const all=`${text} ${explicit||''}`;
    if(/\besim\b/i.test(all))return 'eSIM';
    if(/\bphysical\s*sim\b|\busim\b/i.test(all))return 'Physical SIM';
    return clean(explicit);
  }
  function baseResult(row){
    return {...row,transactionType:'unknown',lineType:'unknown',productFamily:'unknown',plan:'',simType:extractSimType(row.description,row.simType),attributes:[],classification:'unknown',countable:true,needsReview:true,reviewReason:'UNKNOWN_PATTERN'};
  }
  function classifyRow(row){
    const result=baseResult(row);
    const text=lower(`${row.description||''} ${row.raw?row.raw.join(' '):''}`);
    const setupPrepaid=has(text,'setup fee prepaid');
    const setupGeneric=/(?:^|[+;,])\s*setup fee\s*(?=$|[+;,])/.test(text)&&!setupPrepaid&&!has(text,'setup fee multisim');
    const rs=has(text,'rs setup fee');
    const postpaid=has(text,'postpaid');
    const shabab=has(text,'بصمة شباب','بصمه شباب','صمم','صمّم','shabab');
    const flex109=has(text,/\bflex\s*109\b/);
    const addOn=has(text,'add/remove add-on','add remove add on','add on');
    if(rs)result.attributes.push('RS discount');

    if(has(text,'invoice payment')){
      return {...result,transactionType:'invoice_payment',lineType:'not_applicable',productFamily:'Invoice Payment',classification:'invoice_payment',countable:true,needsReview:false,reviewReason:''};
    }
    if(has(text,'sim replacement')){
      return {...result,transactionType:'operation',lineType:'unknown',productFamily:'SIM Replacement',classification:'sim_replacement',countable:true,needsReview:false,reviewReason:''};
    }
    if(has(text,'setup fee multisim','setup fee (multisim)')){
      return {...result,transactionType:'operation',lineType:postpaid?'postpaid':'unknown',productFamily:'MultiSim',classification:'additional_sim',countable:true,needsReview:false,reviewReason:''};
    }
    if(setupPrepaid&&has(text,'pre-loaded balance','pre loaded balance')){
      return {...result,transactionType:'sale',lineType:'prepaid',productFamily:'Zain Line',classification:'new_prepaid_line',countable:true,needsReview:false,reviewReason:''};
    }
    if(setupPrepaid&&shabab){
      return {...result,transactionType:'sale',lineType:'prepaid',productFamily:'Shabab',classification:'new_shabab',countable:true,needsReview:false,reviewReason:''};
    }
    if(setupPrepaid){
      return {...result,transactionType:'sale',lineType:'prepaid',productFamily:'Prepaid',classification:'new_prepaid',countable:true,needsReview:false,reviewReason:''};
    }
    if(shabab){
      return {...result,transactionType:'operation',lineType:'prepaid',productFamily:'Shabab',classification:'shabab_renewal',countable:true,needsReview:false,reviewReason:''};
    }
    if(flex109&&addOn){
      return {...result,transactionType:'operation',lineType:'prepaid',productFamily:'Flex',plan:'Flex 109',classification:'flex_renewal_or_addon',countable:true,needsReview:false,reviewReason:''};
    }
    if(has(text,'new mobile line')&&postpaid){
      return {...result,transactionType:'sale',lineType:'postpaid',productFamily:'Mobile Line',plan:extractPlan(text),classification:'new_postpaid',countable:true,needsReview:false,reviewReason:''};
    }
    if(setupGeneric&&rs){
      return {...result,transactionType:'sale',lineType:'postpaid',productFamily:'Mobile Line',plan:extractPlan(text),classification:'new_postpaid_discounted',countable:true,needsReview:false,reviewReason:''};
    }
    if(rs){
      return {...result,transactionType:'attribute',lineType:postpaid?'postpaid':'unknown',productFamily:'Postpaid Discount',plan:extractPlan(text),classification:'rs_discount_attribute',countable:false,needsReview:true,reviewReason:'RS_ATTRIBUTE_WITHOUT_CONFIRMED_PARENT'};
    }
    return result;
  }
  function roundMoney(value){return Math.round((Number(value)+Number.EPSILON)*100)/100;}
  function summarize(classifiedRows){
    const rows=classifiedRows||[];
    const base=()=>({transactions:0,sales:0,operations:0,invoicePayments:0,attributeOnly:0,unknown:0,salesOperationsAmount:0,invoicePaymentAmount:0,attributeAmount:0,unknownAmount:0,totalAmount:0});
    const summary=base();const employees={};const branches={};
    const apply=(target,row)=>{
      const amount=Number(row.amount)||0;target.transactions++;target.totalAmount+=amount;
      if(row.transactionType==='invoice_payment'){target.invoicePayments++;target.invoicePaymentAmount+=amount;}
      else if(row.transactionType==='sale'){target.sales++;target.salesOperationsAmount+=amount;}
      else if(row.transactionType==='operation'){target.operations++;target.salesOperationsAmount+=amount;}
      else if(row.transactionType==='attribute'){target.attributeOnly++;target.attributeAmount+=amount;}
      else{target.unknown++;target.unknownAmount+=amount;}
    };
    rows.forEach(row=>{
      apply(summary,row);
      const emp=row.employee||'غير محدد';const branch=row.branch||'غير محدد';
      if(!employees[emp])employees[emp]=base();if(!branches[branch])branches[branch]=base();
      apply(employees[emp],row);apply(branches[branch],row);
    });
    [summary,...Object.values(employees),...Object.values(branches)].forEach(x=>Object.keys(x).filter(k=>k.endsWith('Amount')).forEach(k=>x[k]=roundMoney(x[k])));
    return {branch:summary,employees,branches,reviewRows:rows.filter(row=>row.needsReview)};
  }
  function classify(rows){const classified=(rows||[]).map(classifyRow);return {rows:classified,summary:summarize(classified)};}
  return {classifyRow,classify,summarize,extractPlan,extractSimType};
});
