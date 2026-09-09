'use strict';

const STORAGE_KEY = 'wfw430-control-center-v1';
const todayISO = () => new Date().toISOString().slice(0,10);
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
const n = v => Number(v || 0);
const money = v => `${n(v).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})} ر.س`;
const fmtDate = v => v ? new Intl.DateTimeFormat('ar-SA',{year:'numeric',month:'short',day:'numeric'}).format(new Date(`${v}T12:00:00`)) : '—';
const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

// structuredClone isn't available on every older browser/WebView. Falling back to a
// JSON round-trip keeps loadState() from throwing inside its own error handler (which
// used to be able to crash the whole app on load with a blank screen).
function cloneDeep(obj){
  if(typeof structuredClone === 'function'){
    try{ return structuredClone(obj); }catch{ /* fall through to JSON clone */ }
  }
  return JSON.parse(JSON.stringify(obj));
}

// Bump SCHEMA_VERSION and add a migration step below whenever the *shape* of stored
// data needs to change. Never delete/overwrite user data here — only reshape it.
const SCHEMA_VERSION = 1;
function migrate(data){
  let fromVersion = Number(data.schemaVersion) || 0;
  // Example for the future:
  // if(fromVersion === 0){ /* transform `data` in place */ fromVersion = 1; }
  data.schemaVersion = SCHEMA_VERSION;
  return data;
}

const seed = {
  settings:{salesWeight:.40,servicesWeight:.25,qualityWeight:.35,complaintPenalty:10,errorPenalty:3,warningErrors:3,dangerErrors:6},
  classifications:['خطأ موظف','نقص معرفة/تدريب','مشكلة نظام','إجراء/تعليمات الشركة','مشكلة عميل','مشكلة تشغيلية بالمعرض','غير محدد'],
  caseStatuses:['مفتوحة','قيد المتابعة','مغلقة','مكررة','مرجع معرفة'],
  employees:[
    {id:'emp-mansour',name:'منصور',username:'',shift:'صباحي',status:'نشط',startDate:'',note:''},
    {id:'emp-ali',name:'علي',username:'',shift:'صباحي',status:'نشط',startDate:'',note:''},
    {id:'emp-malik',name:'مالك',username:'',shift:'صباحي',status:'نشط',startDate:'',note:''},
    {id:'emp-badr',name:'بدر',username:'',shift:'مسائي',status:'جديد',startDate:'',note:''}
  ],
  knowledge:[
    {topic:'تفعيل باقة',common:'تعذر التفعيل',signal:'',checks:['تأكد من الخيارات','تحقق من المربع الأحمر','اقرأ رسالة الخطأ'],action:'طبّق الإجراء الظاهر بالنظام',supervisor:'إذا لم تُحل بعد خطوات التحقق',support:'إذا كانت الحالة تتطلب دعمًا',note:'يمكن إرفاق Screenshot في سجل الأخطاء'},
    {topic:'OTP',common:'لم تصل الرسالة',signal:'',checks:['تأكد من الرقم','تحقق من إعادة الإرسال','تحقق من حالة العميل'],action:'إعادة المحاولة وفق الإجراء المعتمد',supervisor:'إذا تكرر بعد التحقق',support:'عند الحاجة لدعم الشركة',note:''},
    {topic:'إضافة جهاز لعقد',common:'ظهور خطأ مديونية',signal:'',checks:['راجع مديونية العميل','تحقق من شرط 500 ريال','راجع الرسالة'],action:'اتبع شروط العقد/النظام',supervisor:'إذا كان الخطأ غير واضح',support:'إذا كانت المشكلة نظامية',note:'لا يُصنف تلقائيًا كخطأ موظف'},
    {topic:'عرض منتهي',common:'العميل يطلب عرضًا غير موجود',signal:'',checks:['تحقق من آخر تعميم','راجع صفحة العرض','تحقق من تاريخ الصلاحية'],action:'وضح للعميل عدم توفر العرض',supervisor:'عند وجود تعارض بين الأنظمة والتعميم',support:'إذا كان هناك خلل بالنظام',note:''},
    {topic:'رسوم باقة',common:'العميل يعترض على الزيادة',signal:'',checks:['راجع الباقة','راجع الخدمات المفعلة','راجع الفاتورة'],action:'طباعة/عرض تفاصيل الاحتساب',supervisor:'إذا لم يكن السبب واضحًا',support:'عند الحاجة لرفع طلب',note:'الأسباب الشائعة: خدمات، مكالمات، استهلاك بعد انتهاء الباقة، متجر'},
    {topic:'سداد',common:'السداد أو التقفيلة غير مطابقة',signal:'',checks:['تحقق من المبلغ','تحقق من العميل','تحقق من العملية'],action:'صحح قبل الإغلاق',supervisor:'إذا ظهر فرق غير مفسر',support:'إذا كانت المشكلة نظامية',note:''}
  ],
  daily:[], cases:[], offers:[], closings:[]
};

let state = loadState();
function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return migrate(cloneDeep(seed));
    const parsed = JSON.parse(raw);
    return migrate({...cloneDeep(seed),...parsed,settings:{...seed.settings,...parsed.settings}});
  }catch{ return migrate(cloneDeep(seed)); }
}
function save(){ localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); }
function toast(msg,type=''){ const el=document.getElementById('toast'); el.textContent=msg; el.className=`toast show${type?` ${type}`:''}`; clearTimeout(toast.t); toast.t=setTimeout(()=>el.classList.remove('show'),2200); }

const viewTitles={dashboard:'لوحة التحكم',daily:'المتابعة اليومية',cases:'الحالات والأخطاء',knowledge:'قاعدة المعرفة',offers:'العروض',closing:'إغلاق الشفت',employees:'الموظفون',settings:'الإعدادات'};
const sidebar=document.getElementById('sidebar');
const menuBtn=document.getElementById('menuBtn');
const sidebarCloseBtn=document.getElementById('sidebarCloseBtn');
const sidebarBackdrop=document.getElementById('sidebarBackdrop');

const mainRegion=document.querySelector('.main');
function setMenu(open){
  const shouldOpen=Boolean(open) && window.matchMedia('(max-width: 900px)').matches;
  const wasOpen=sidebar.classList.contains('open');
  sidebar.classList.toggle('open',shouldOpen);
  document.body.classList.toggle('menu-open',shouldOpen);
  menuBtn.setAttribute('aria-expanded',String(shouldOpen));
  // Keep keyboard/screen-reader users from tabbing into content hidden behind the backdrop.
  if(mainRegion) mainRegion.toggleAttribute('inert',shouldOpen);
  if(shouldOpen && !wasOpen) sidebarCloseBtn.focus();
  else if(!shouldOpen && wasOpen) menuBtn.focus();
}

function switchView(name){
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${name}`));
  document.querySelectorAll('.nav-item').forEach(b=>{
    const active=b.dataset.view===name;
    b.classList.toggle('active',active);
    if(active) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current');
  });
  document.getElementById('viewTitle').textContent=viewTitles[name]||'WFW430';
  syncPrintButton(name);
  setMenu(false);
  if(name==='dashboard') renderDashboard();
}

document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
document.querySelectorAll('[data-view-jump]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.viewJump)));
menuBtn.addEventListener('click',()=>setMenu(!sidebar.classList.contains('open')));
sidebarCloseBtn.addEventListener('click',()=>setMenu(false));
sidebarBackdrop.addEventListener('click',()=>setMenu(false));
document.addEventListener('keydown',e=>{if(e.key==='Escape')setMenu(false);});
window.addEventListener('resize',()=>{if(window.innerWidth>900)setMenu(false);});
setMenu(false);

document.getElementById('todayChip').textContent=new Intl.DateTimeFormat('ar-SA',{weekday:'long',year:'numeric',month:'long',day:'numeric'}).format(new Date());

document.querySelectorAll('input[type=date]').forEach(i=>{ if(!i.value) i.value=todayISO(); });
document.getElementById('dashboardDate').value=todayISO();

autoSelects();
function activeEmployees(){ return state.employees.filter(e=>e.status!=='غير نشط'); }
// Currently-active employees, PLUS anyone (even later deactivated) who actually has
// activity in `logs`. Without this, a deactivated employee's rows silently vanish from
// past-date reports even though their numbers are still counted in the KPI totals above.
function employeesForDate(logs){
  const byName=new Map(activeEmployees().map(e=>[e.name,e]));
  logs.forEach(x=>{
    if(!byName.has(x.employee)){
      byName.set(x.employee, state.employees.find(e=>e.name===x.employee) || {name:x.employee,status:'غير نشط'});
    }
  });
  return [...byName.values()];
}
function autoSelects(){
  const opts=activeEmployees().map(e=>`<option value="${esc(e.name)}">${esc(e.name)}</option>`).join('');
  document.querySelectorAll('select[name=employee]').forEach(s=>{const current=s.value;s.innerHTML=opts;if([...s.options].some(o=>o.value===current))s.value=current;});
  document.getElementById('classificationSelect').innerHTML=state.classifications.map(x=>`<option>${esc(x)}</option>`).join('');
  document.getElementById('caseStatusSelect').innerHTML=state.caseStatuses.map(x=>`<option>${esc(x)}</option>`).join('');
}

/* ---------------------------------------------------------------------------
 * Shift-closing business logic (تقفيلة_المبيعات_الاجمالي_للموظف.xlsx, page 1)
 * Pure functions — safe to unit test in isolation if a test runner is ever added.
 * ------------------------------------------------------------------------- */
function computeClosingTotals(f){
  const paymentTotal=n(f.paymentTotal), salesTotal=n(f.salesTotal), rechargeTotal=n(f.rechargeTotal),
        bss=n(f.bss), spanTotal=n(f.spanTotal), actualCash=n(f.actualCash);
  const kaakoTotal=paymentTotal+salesTotal+bss+rechargeTotal;
  const requiredCash=kaakoTotal-spanTotal;
  const difference=actualCash-requiredCash;
  return {kaakoTotal,requiredCash,difference,actualCash};
}
function closingStatus(difference){
  if(difference===0) return 'مطابق';
  if(Math.abs(difference)<=1) return 'فرق بسيط';
  return 'مراجعة عاجلة';
}
// difference > 0 = فائض (surplus) -> amber; < 0 = عجز (deficit) -> red; 0 -> green.
function diffBadgeClass(difference){
  if(difference===0) return 'success';
  if(difference>0) return 'warn';
  return 'danger';
}

// New schema field names introduced by this record shape. Anything in a stored record
// that is NOT one of these (plus id/createdAt/updatedAt) is an old-schema field kept as-is.
const CLOSING_NEW_FIELDS=['date','employee','shift','paymentTotal','salesTotal','rechargeTotal','bss','spanTotal','requiredCash','actualCash','difference','kaakoTotal','status','notes'];

// Normalizes any stored closing record (old or new schema) into a display-ready shape.
// Never mutates or deletes fields on the original record — old fields stay in localStorage
// untouched so a rollback or an older build reading the same data loses nothing.
// Returns null-marked ("غير متوفر") for anything that cannot be losslessly reconstructed.
function normalizeClosing(x){
  const isLegacy = x.paymentTotal===undefined && x.salesTotal===undefined && x.bss===undefined
    && (x.systemTotal!==undefined || x.cash!==undefined || x.card!==undefined || x.other!==undefined || x.actual!==undefined || x.diff!==undefined);
  if(!isLegacy){
    const t=computeClosingTotals(x);
    return {
      date:x.date, employee:x.employee, shift:x.shift,
      paymentTotal:n(x.paymentTotal), salesTotal:n(x.salesTotal), rechargeTotal:n(x.rechargeTotal), bss:n(x.bss), spanTotal:n(x.spanTotal),
      kaakoTotal:t.kaakoTotal, requiredCash:t.requiredCash, actualCash:n(x.actualCash), difference:t.difference,
      status:x.status||closingStatus(t.difference), notes:x.notes||'', isLegacy:false
    };
  }
  // Legacy record: systemTotal/cash/card/other/actual/diff.
  // `actual` (cash+card+other) maps losslessly to actualCash.
  // `diff` (actual-systemTotal) maps losslessly to difference — same definition, actual-required.
  // `systemTotal` played the same role as requiredCash (the target/expected cash) so it maps there,
  // but it CANNOT be split back into paymentTotal/salesTotal/bss/rechargeTotal — those stay unknown,
  // and kaakoTotal (which depends on spanTotal, also unknown) is left unknown rather than guessed.
  const actualCash = x.actualCash!==undefined ? n(x.actualCash) : (x.actual!==undefined ? n(x.actual) : n(x.cash)+n(x.card)+n(x.other));
  const requiredCash = x.systemTotal!==undefined ? n(x.systemTotal) : undefined;
  const difference = x.diff!==undefined ? n(x.diff) : (requiredCash!==undefined ? actualCash-requiredCash : undefined);
  return {
    date:x.date, employee:x.employee, shift:x.shift,
    paymentTotal:undefined, salesTotal:undefined, rechargeTotal:undefined, bss:undefined, spanTotal:undefined,
    kaakoTotal:undefined, requiredCash, actualCash, difference,
    status:x.status||(difference!==undefined?closingStatus(difference):'—'), notes:x.notes||x.note||'', isLegacy:true
  };
}
const naOr=(v,fmt=money)=>v===undefined||v===null||Number.isNaN(v)?'غير متوفر':fmt(v);

const badgeClass=status=>{
  if(['نشط','مطابق','مغلقة','مكتملة','مستقر','فعال'].includes(status)) return 'success';
  if(['مراجعة عاجلة','تحتاج مراجعة','غير نشط','منتهي'].includes(status)) return 'danger';
  if(['تنبيه/تدريب','فرق بسيط','قيد المتابعة','ناقص','موقوف'].includes(status)) return 'warn';
  if(['جديد','مفتوحة','قادم','مرجع معرفة'].includes(status)) return 'info';
  return 'neutral';
};

function employeeHealth(errors){
  if(errors>=n(state.settings.dangerErrors)) return 'مراجعة عاجلة';
  if(errors>=n(state.settings.warningErrors)) return 'تنبيه/تدريب';
  return 'مستقر';
}

function renderDashboard(){
  const date=document.getElementById('dashboardDate').value||todayISO();
  const logs=state.daily.filter(x=>x.date===date);
  const closes=state.closings.filter(x=>x.date===date);
  const totals={sales:0,services:0,complaints:0,errors:0,systemCases:0};
  logs.forEach(x=>Object.keys(totals).forEach(k=>totals[k]+=n(x[k])));
  const diff=closes.reduce((s,x)=>s+(n(normalizeClosing(x).difference)||0),0);
  const activeCount=logs.filter(x=>x.attendance==='مكتمل').length;
  const kpis=[
    ['إجمالي المبيعات',totals.sales,'عملية','success'],['إجمالي الخدمات',totals.services,'خدمة','success'],['الشكاوى',totals.complaints,'حالة','warn'],['الأخطاء',totals.errors,'خطأ',totals.errors>=state.settings.warningErrors?'danger':''],
    ['حالات النظام',totals.systemCases,'حالة',''],['فرق الإغلاق',money(diff),'صافي فروقات اليوم',Math.abs(diff)>1?'danger':Math.abs(diff)>0?'warn':'success'],['موظفون مكتمل دوامهم',activeCount,`من ${activeEmployees().length}`,'']
  ];
  document.getElementById('kpiGrid').innerHTML=kpis.map(([label,value,hint,cls])=>`<div class="kpi ${cls}"><div class="label">${label}</div><div class="value">${value}</div><div class="hint">${hint}</div></div>`).join('');

  const rows=employeesForDate(logs).map(emp=>{
    const mine=logs.filter(x=>x.employee===emp.name);
    const t={sales:0,services:0,complaints:0,errors:0,systemCases:0};mine.forEach(x=>Object.keys(t).forEach(k=>t[k]+=n(x[k])));
    const health=employeeHealth(t.errors);
    const inactiveTag=emp.status==='غير نشط'?' <span class="badge neutral" title="غير نشط حاليًا">سابقًا</span>':'';
    return `<tr><td data-label="الموظف"><strong>${esc(emp.name)}</strong>${inactiveTag}</td><td data-label="المبيعات">${t.sales}</td><td data-label="الخدمات">${t.services}</td><td data-label="الشكاوى">${t.complaints}</td><td data-label="الأخطاء">${t.errors}</td><td data-label="حالات النظام">${t.systemCases}</td><td data-label="الحالة"><span class="badge ${badgeClass(health)}">${health}</span></td></tr>`;
  }).join('');
  document.getElementById('employeePerformanceBody').innerHTML=rows||`<tr><td colspan="7" class="empty-row">لا يوجد موظفون نشطون</td></tr>`;

  const alerts=[];
  activeEmployees().forEach(emp=>{
    const errs=logs.filter(x=>x.employee===emp.name).reduce((s,x)=>s+n(x.errors),0);
    const health=employeeHealth(errs);
    if(health!=='مستقر') alerts.push({type:health==='مراجعة عاجلة'?'danger':'warn',title:`${emp.name}: ${health}`,text:`${errs} أخطاء في التاريخ المختار`});
  });
  closes.map(normalizeClosing).filter(x=>x.difference!==undefined && Math.abs(n(x.difference))>1).forEach(x=>alerts.push({type:'danger',title:`فرق إغلاق: ${x.employee}`,text:`${money(x.difference)} — ${x.shift}`}));
  const openCases=state.cases.filter(x=>x.date===date && !['مغلقة','مكررة'].includes(x.status));
  if(openCases.length) alerts.push({type:'warn',title:`${openCases.length} حالة مفتوحة/متابعة`,text:'راجع الحالات قبل نهاية الشفت'});
  if(!alerts.length) alerts.push({type:'success',title:'لا توجد تنبيهات حرجة',text:'لا توجد فروقات أو أخطاء فوق الحدود المسجلة لهذا اليوم'});
  document.getElementById('alertsList').innerHTML=alerts.map(a=>`<div class="alert-item ${a.type}"><div class="alert-icon">${a.type==='success'?'✓':'!'}</div><div><strong>${esc(a.title)}</strong><span>${esc(a.text)}</span></div></div>`).join('');
}

document.getElementById('dashboardDate').addEventListener('change',renderDashboard);

function formObj(form){return Object.fromEntries(new FormData(form).entries());}
function resetKeepDate(form){ const date=form.querySelector('[name=date]')?.value; form.reset(); if(form.querySelector('[name=date]')) form.querySelector('[name=date]').value=date||todayISO(); autoSelects(); }

// -------- generic edit-in-place state (one active edit id per section at a time) --------
const editState={daily:null,cases:null,offers:null,closings:null,employees:null};
function rowActionButtons(type,id){
  return `<button class="mini-btn" data-edit="${type}" data-id="${id}">تعديل</button><button class="mini-btn danger" data-delete="${type}" data-id="${id}">حذف</button>`;
}

// -------- Sales auto-fill from matching shift closing (same employee + same date) --------
// Returns the salesTotal (new schema) of the most recently-created matching closing, or
// undefined if none matches. Old-schema closings never have salesTotal, so they're excluded
// on purpose — they cannot supply this value.
function findClosingSales(employee,date){
  if(!employee || !date) return undefined;
  const matches=state.closings.filter(x=>x.employee===employee && x.date===date && x.salesTotal!==undefined);
  if(!matches.length) return undefined;
  matches.sort((a,b)=>n(b.createdAt)-n(a.createdAt));
  return n(matches[0].salesTotal);
}
function autofillDailySales(){
  const form=document.getElementById('dailyForm');
  const employee=form.elements.employee.value, date=form.elements.date.value;
  const found=findClosingSales(employee,date);
  form.elements.sales.value = found ? found : '';
  document.getElementById('salesAutoHint').hidden = found===undefined;
}
document.getElementById('dailyForm').elements.date.addEventListener('change',autofillDailySales);
document.getElementById('dailyForm').elements.employee.addEventListener('change',autofillDailySales);

document.getElementById('dailyForm').addEventListener('submit',e=>{
  e.preventDefault(); const form=e.currentTarget; const x=formObj(form);
  ['sales','services','complaints','errors','systemCases'].forEach(k=>x[k]=n(x[k]));
  const editingId=editState.daily;
  if(editingId){
    const existing=state.daily.find(r=>r.id===editingId);
    Object.assign(existing,x);existing.updatedAt=Date.now();
    editState.daily=null;delete form.dataset.editingId;
  }else{
    x.id=uid();x.createdAt=Date.now();state.daily.unshift(x);
  }
  save();renderDaily();renderDashboard();resetKeepDate(form);autofillDailySales();fillEditButtons(form,'daily');toast('تم حفظ المتابعة اليومية');
});
document.getElementById('dailyCancelEditBtn').addEventListener('click',()=>{
  const form=document.getElementById('dailyForm');editState.daily=null;delete form.dataset.editingId;resetKeepDate(form);autofillDailySales();fillEditButtons(form,'daily');
});
function editDaily(id){
  const rec=state.daily.find(x=>x.id===id);if(!rec)return;
  const form=document.getElementById('dailyForm');
  ['date','employee','sales','services','complaints','errors','systemCases','attendance','status','note','source'].forEach(k=>{if(form.elements[k]) form.elements[k].value=rec[k]??'';});
  editState.daily=id;form.dataset.editingId=id;
  document.getElementById('salesAutoHint').hidden=true; // manual value from the record, not an auto-fetch
  fillEditButtons(form,'daily');
  switchView('daily');form.scrollIntoView({behavior:'smooth',block:'start'});
}
function renderDaily(){
  const body=document.getElementById('dailyBody');
  body.innerHTML=state.daily.map(x=>`<tr><td data-label="التاريخ">${fmtDate(x.date)}</td><td data-label="الموظف">${esc(x.employee)}</td><td data-label="مبيعات">${x.sales}</td><td data-label="خدمات">${x.services}</td><td data-label="شكاوى">${x.complaints}</td><td data-label="أخطاء">${x.errors}</td><td data-label="نظام">${x.systemCases}</td><td data-label="دوام">${esc(x.attendance)}</td><td data-label="الحالة"><span class="badge ${badgeClass(x.status)}">${esc(x.status)}</span></td><td data-label="إجراء" class="row-actions">${rowActionButtons('daily',x.id)}</td></tr>`).join('')||`<tr><td colspan="10" class="empty-row">لا توجد متابعات حتى الآن</td></tr>`;
}

document.getElementById('caseForm').addEventListener('submit',e=>{
  e.preventDefault(); const form=e.currentTarget; const x=formObj(form);
  const editingId=editState.cases;
  if(editingId){
    const existing=state.cases.find(r=>r.id===editingId);
    Object.assign(existing,x);existing.updatedAt=Date.now();
    editState.cases=null;delete form.dataset.editingId;
    save();renderCases();renderDashboard();resetKeepDate(form);fillEditButtons(form,'case');toast(`تم تحديث الحالة #${existing.caseNo}`);
  }else{
    x.id=uid();x.caseNo=state.cases.length?Math.max(...state.cases.map(c=>n(c.caseNo)))+1:1;x.createdAt=Date.now();state.cases.unshift(x);
    save();renderCases();renderDashboard();resetKeepDate(form);toast(`تم حفظ الحالة #${x.caseNo}`);
  }
});
document.getElementById('caseCancelEditBtn').addEventListener('click',()=>{
  const form=document.getElementById('caseForm');editState.cases=null;delete form.dataset.editingId;resetKeepDate(form);fillEditButtons(form,'case');
});
function editCase(id){
  const rec=state.cases.find(x=>x.id===id);if(!rec)return;
  const form=document.getElementById('caseForm');
  ['date','employee','operation','classification','description','employeeAction','supervisor','status','ticket','training','finalAction','result'].forEach(k=>{if(form.elements[k]) form.elements[k].value=rec[k]??'';});
  editState.cases=id;form.dataset.editingId=id;fillEditButtons(form,'case');
  switchView('cases');form.scrollIntoView({behavior:'smooth',block:'start'});
}
document.getElementById('caseSearch').addEventListener('input',renderCases);
function renderCases(){
  const q=document.getElementById('caseSearch').value.trim().toLowerCase();
  const rows=state.cases.filter(x=>!q||JSON.stringify(x).toLowerCase().includes(q)).map(x=>`<tr><td data-label="#">#${x.caseNo}</td><td data-label="التاريخ">${fmtDate(x.date)}</td><td data-label="الموظف">${esc(x.employee)}</td><td data-label="العملية">${esc(x.operation)}</td><td data-label="التصنيف">${esc(x.classification)}</td><td data-label="الحالة"><span class="badge ${badgeClass(x.status)}">${esc(x.status)}</span></td><td data-label="تدريب">${esc(x.training)}</td><td data-label="إجراء" class="row-actions">${rowActionButtons('cases',x.id)}</td></tr>`).join('');
  document.getElementById('casesBody').innerHTML=rows||`<tr><td colspan="8" class="empty-row">لا توجد حالات مطابقة</td></tr>`;
}

function renderKnowledge(){
  const q=document.getElementById('knowledgeSearch').value.trim().toLowerCase();
  const list=state.knowledge.filter(x=>!q||JSON.stringify(x).toLowerCase().includes(q));
  document.getElementById('knowledgeGrid').innerHTML=list.map(x=>`<article class="knowledge-card"><h3>${esc(x.topic)}</h3><div class="common">${esc(x.common)}</div><div class="steps">${x.checks.map((s,i)=>`<div class="step"><b>${i+1}</b><span>${esc(s)}</span></div>`).join('')}</div><div class="decision"><div><strong>الإجراء:</strong> ${esc(x.action)}</div><div><strong>المشرف:</strong> ${esc(x.supervisor)}</div><div><strong>777:</strong> ${esc(x.support)}</div>${x.note?`<div><strong>ملاحظة:</strong> ${esc(x.note)}</div>`:''}</div></article>`).join('')||`<div class="card">لا توجد نتيجة مطابقة.</div>`;
}
document.getElementById('knowledgeSearch').addEventListener('input',renderKnowledge);

document.getElementById('offerForm').addEventListener('submit',e=>{
  e.preventDefault();const form=e.currentTarget;const x=formObj(form);
  const editingId=editState.offers;
  if(editingId){
    const existing=state.offers.find(r=>r.id===editingId);
    Object.assign(existing,x);existing.updatedAt=Date.now();
    editState.offers=null;delete form.dataset.editingId;
    save();renderOffers();fillEditButtons(form,'offer');form.reset();toast('تم تحديث العرض');
  }else{
    x.id=uid();x.createdAt=Date.now();state.offers.unshift(x);
    save();renderOffers();form.reset();toast('تم حفظ العرض');
  }
});
document.getElementById('offerCancelEditBtn').addEventListener('click',()=>{
  const form=document.getElementById('offerForm');editState.offers=null;delete form.dataset.editingId;form.reset();fillEditButtons(form,'offer');
});
function editOffer(id){
  const rec=state.offers.find(x=>x.id===id);if(!rec)return;
  const form=document.getElementById('offerForm');
  ['name','status','startDate','endDate','segment','business','product','verification','condition','note'].forEach(k=>{if(form.elements[k]) form.elements[k].value=rec[k]??'';});
  editState.offers=id;form.dataset.editingId=id;fillEditButtons(form,'offer');
  switchView('offers');form.scrollIntoView({behavior:'smooth',block:'start'});
}
function renderOffers(){
  document.getElementById('offersBody').innerHTML=state.offers.map(x=>`<tr><td data-label="العرض"><strong>${esc(x.name)}</strong></td><td data-label="الحالة"><span class="badge ${badgeClass(x.status)}">${esc(x.status)}</span></td><td data-label="من">${fmtDate(x.startDate)}</td><td data-label="إلى">${fmtDate(x.endDate)}</td><td data-label="العميل">${esc(x.segment||'—')}</td><td data-label="أعمال">${esc(x.business)}</td><td data-label="المنتج">${esc(x.product||'—')}</td><td data-label="إجراء" class="row-actions">${rowActionButtons('offers',x.id)}</td></tr>`).join('')||`<tr><td colspan="8" class="empty-row">لا توجد عروض مضافة بعد</td></tr>`;
}

const closingForm=document.getElementById('closingForm');
function calcClosing(){
  const f=formObj(closingForm);
  const t=computeClosingTotals(f);
  const status=closingStatus(t.difference);
  document.getElementById('kaakoPreview').textContent=money(t.kaakoTotal);
  document.getElementById('requiredCashPreview').textContent=money(t.requiredCash);
  document.getElementById('diffPreview').textContent=money(t.difference);
  const s=document.getElementById('closingStatusPreview');s.textContent=status;s.className=`badge ${diffBadgeClass(t.difference)}`;
  return {...t,status};
}
closingForm.addEventListener('input',calcClosing);
closingForm.addEventListener('submit',e=>{
  const form=e.currentTarget;e.preventDefault();const x=formObj(form);
  ['paymentTotal','salesTotal','rechargeTotal','bss','spanTotal','actualCash'].forEach(k=>x[k]=n(x[k]));
  Object.assign(x,calcClosing());
  const editingId=editState.closings;
  if(editingId){
    const existing=state.closings.find(r=>r.id===editingId);
    Object.assign(existing,x);existing.updatedAt=Date.now();
    editState.closings=null;delete form.dataset.editingId;
    save();renderClosings();renderDashboard();resetKeepDate(form);calcClosing();fillEditButtons(form,'closing');toast('تم تحديث إغلاق الشفت');
  }else{
    x.id=uid();x.createdAt=Date.now();state.closings.unshift(x);
    save();renderClosings();renderDashboard();resetKeepDate(form);calcClosing();toast('تم حفظ إغلاق الشفت');
  }
  autofillDailySales(); // a saved/updated closing may change what daily-tracking should show
});
document.getElementById('closingCancelEditBtn').addEventListener('click',()=>{
  const form=closingForm;editState.closings=null;delete form.dataset.editingId;resetKeepDate(form);calcClosing();fillEditButtons(form,'closing');
});
function editClosing(id){
  const rec=state.closings.find(x=>x.id===id);if(!rec)return;
  const form=closingForm;
  ['date','employee','shift','paymentTotal','salesTotal','rechargeTotal','bss','spanTotal','actualCash','notes'].forEach(k=>{if(form.elements[k]) form.elements[k].value=rec[k]??'';});
  editState.closings=id;form.dataset.editingId=id;calcClosing();fillEditButtons(form,'closing');
  switchView('closing');form.scrollIntoView({behavior:'smooth',block:'start'});
}
function renderClosings(){
  document.getElementById('closingBody').innerHTML=state.closings.map(raw=>{
    const x=normalizeClosing(raw);
    return `<tr><td data-label="التاريخ">${fmtDate(x.date)}</td><td data-label="الموظف">${esc(x.employee)}</td><td data-label="الشفت">${esc(x.shift)}</td><td data-label="المطلوب">${naOr(x.requiredCash)}</td><td data-label="الفعلي">${naOr(x.actualCash)}</td><td data-label="الفرق">${naOr(x.difference)}</td><td data-label="الحالة"><span class="badge ${badgeClass(x.status)}">${esc(x.status)}</span></td><td data-label="إجراء" class="row-actions">${rowActionButtons('closings',raw.id)}</td></tr>`;
  }).join('')||`<tr><td colspan="8" class="empty-row">لا توجد إغلاقات مسجلة</td></tr>`;
}

/* ---------------------------------------------------------------------------
 * Calculator modal (span + cash denominations) — scratch state only, not a saved record.
 * ------------------------------------------------------------------------- */
const CASH_DENOMS=[500,200,100,50,20,10,5,1];
const CALC_SCRATCH_KEY='wfw430-calculator-scratch-v1';
function loadCalcScratch(){ try{return JSON.parse(localStorage.getItem(CALC_SCRATCH_KEY))||{};}catch{return {};} }
function saveCalcScratch(data){ try{localStorage.setItem(CALC_SCRATCH_KEY,JSON.stringify(data));}catch{/* ignore quota errors */} }

const calcBackdrop=document.getElementById('calcModalBackdrop');
const calcSpanCount=document.getElementById('calcSpanCount');
const calcSpanValue=document.getElementById('calcSpanValue');
const calcCashBody=document.getElementById('calcCashBody');

function buildCashRows(){
  calcCashBody.innerHTML=CASH_DENOMS.map(d=>`<tr><td data-label="الفئة">${d}</td><td data-label="العدد"><input inputmode="decimal" type="number" placeholder="0" data-denom="${d}" /></td><td data-label="المجموع" data-subtotal="${d}">0.00 ر.س</td></tr>`).join('');
}
buildCashRows();

function calcSpanTotal(){ return n(calcSpanCount.value)*n(calcSpanValue.value); }
function calcCashTotal(){
  let total=0;
  calcCashBody.querySelectorAll('input[data-denom]').forEach(inp=>{
    const d=n(inp.dataset.denom), count=n(inp.value), sub=d*count;
    total+=sub;
    calcCashBody.querySelector(`[data-subtotal="${d}"]`).textContent=money(sub);
  });
  return total;
}
function renderCalcTotals(){
  document.getElementById('calcSpanTotal').textContent=money(calcSpanTotal());
  document.getElementById('calcCashTotal').textContent=money(calcCashTotal());
}
function persistCalcScratch(){
  const denoms={};calcCashBody.querySelectorAll('input[data-denom]').forEach(inp=>{denoms[inp.dataset.denom]=inp.value;});
  saveCalcScratch({spanCount:calcSpanCount.value,spanValue:calcSpanValue.value,denoms});
}
function restoreCalcScratch(){
  const s=loadCalcScratch();
  if(s.spanCount!==undefined) calcSpanCount.value=s.spanCount;
  if(s.spanValue!==undefined) calcSpanValue.value=s.spanValue;
  if(s.denoms) calcCashBody.querySelectorAll('input[data-denom]').forEach(inp=>{ if(s.denoms[inp.dataset.denom]!==undefined) inp.value=s.denoms[inp.dataset.denom]; });
  renderCalcTotals();
}
document.querySelector('.modal-body').addEventListener('input',()=>{renderCalcTotals();persistCalcScratch();});

function openCalculator(){ restoreCalcScratch();calcBackdrop.hidden=false;calcSpanCount.focus(); }
function closeCalculator(){ calcBackdrop.hidden=true; }
document.getElementById('openCalculatorBtn').addEventListener('click',openCalculator);
document.getElementById('calcCloseBtn').addEventListener('click',closeCalculator);
calcBackdrop.addEventListener('click',e=>{ if(e.target===calcBackdrop) closeCalculator(); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape' && !calcBackdrop.hidden) closeCalculator(); });
document.getElementById('useSpanTotalBtn').addEventListener('click',()=>{
  closingForm.elements.spanTotal.value=calcSpanTotal()||'';calcClosing();closeCalculator();toast('تم استخدام إجمالي الإسبان');
});
document.getElementById('useCashTotalBtn').addEventListener('click',()=>{
  closingForm.elements.actualCash.value=calcCashTotal()||'';calcClosing();closeCalculator();toast('تم استخدام إجمالي الكاش');
});

document.getElementById('employeeForm').addEventListener('submit',e=>{
  const form=e.currentTarget;e.preventDefault();const x=formObj(form);
  const editingId=editState.employees;
  if(editingId){
    const existing=state.employees.find(r=>r.id===editingId);
    Object.assign(existing,x);existing.updatedAt=Date.now();
    editState.employees=null;delete form.dataset.editingId;
    save();autoSelects();renderEmployees();renderDashboard();fillEditButtons(form,'employee');form.reset();toast('تم تحديث بيانات الموظف');
  }else{
    x.id=uid();state.employees.push(x);
    save();autoSelects();renderEmployees();renderDashboard();form.reset();toast('تمت إضافة الموظف');
  }
});
document.getElementById('employeeCancelEditBtn').addEventListener('click',()=>{
  const form=document.getElementById('employeeForm');editState.employees=null;delete form.dataset.editingId;form.reset();fillEditButtons(form,'employee');
});
function editEmployee(id){
  const rec=state.employees.find(x=>x.id===id);if(!rec)return;
  const form=document.getElementById('employeeForm');
  ['name','username','shift','status','startDate','note'].forEach(k=>{if(form.elements[k]) form.elements[k].value=rec[k]??'';});
  editState.employees=id;form.dataset.editingId=id;fillEditButtons(form,'employee');
  switchView('employees');form.scrollIntoView({behavior:'smooth',block:'start'});
}
function renderEmployees(){document.getElementById('employeeCards').innerHTML=state.employees.map(e=>`<div class="employee-card"><div><h4>${esc(e.name)}</h4><div class="employee-meta">${esc(e.shift)} · ${e.username?esc(e.username):'بدون يوزر'}${e.startDate?` · بدأ ${fmtDate(e.startDate)}`:''}</div></div><div><span class="badge ${badgeClass(e.status)}">${esc(e.status)}</span><div class="row-actions" style="margin-top:8px"><button class="mini-btn" data-toggle-employee="${e.id}">${e.status==='غير نشط'?'تفعيل':'تعطيل'}</button><button class="mini-btn" data-edit="employees" data-id="${e.id}">تعديل</button></div></div></div>`).join('');}

document.getElementById('settingsForm').addEventListener('submit',e=>{e.preventDefault();const x=formObj(e.currentTarget);Object.keys(state.settings).forEach(k=>state.settings[k]=n(x[k]));save();renderDashboard();toast('تم حفظ الإعدادات');});
function renderSettings(){const f=document.getElementById('settingsForm');Object.entries(state.settings).forEach(([k,v])=>{if(f.elements[k])f.elements[k].value=v;});}

const editFns={daily:editDaily,cases:editCase,offers:editOffer,closings:editClosing,employees:editEmployee};
document.addEventListener('click',e=>{
  const ed=e.target.closest('[data-edit]');if(ed){const fn=editFns[ed.dataset.edit];if(fn)fn(ed.dataset.id);return;}
  const d=e.target.closest('[data-delete]');if(d){const type=d.dataset.delete,id=d.dataset.id;if(confirm('حذف هذا السجل؟')){state[type]=state[type].filter(x=>x.id!==id);save();renderAll();toast('تم حذف السجل');}return;}
  const t=e.target.closest('[data-toggle-employee]');if(t){const emp=state.employees.find(x=>x.id===t.dataset.toggleEmployee);if(emp){emp.status=emp.status==='غير نشط'?'نشط':'غير نشط';save();autoSelects();renderEmployees();renderDashboard();toast('تم تحديث حالة الموظف');}return;}
});

function download(name,content,type='text/plain'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;document.body.appendChild(a);a.click();URL.revokeObjectURL(a.href);a.remove();}

function activeViewName(){
  const active=document.querySelector('.nav-item.active');
  return active?.dataset.view || 'dashboard';
}

// Page orientation per report. Wide, many-column tables get landscape; document-style
// reports (cards, narrow tables) get portrait. Change a value here to flip a report.
const printOrientation={
  dashboard:'landscape', // 4 KPIs across + 8-column table
  daily:'landscape',     // widest table (10 data columns)
  cases:'landscape',     // 7 data columns, some long text
  offers:'landscape',    // 7 data columns incl. dates
  closing:'portrait',    // 7 narrow numeric columns — fits portrait, reads like a handover sheet
  employees:'portrait',
  knowledge:'portrait',
  settings:'portrait'
};

// Views that own a "تصدير التقرير PDF" button inside the section itself. On these the
// generic topbar button is hidden so there is exactly one obvious export control.
const viewsWithOwnPrintBtn=new Set([...document.querySelectorAll('[data-print-view]')].map(b=>b.dataset.printView));
const printCurrentBtn=document.getElementById('printCurrentBtn');
function syncPrintButton(name){
  printCurrentBtn.hidden=viewsWithOwnPrintBtn.has(name);
}

function printView(name=activeViewName()){
  const previous=activeViewName();
  if(name!==previous) switchView(name);
  setMenu(false);
  const title=viewTitles[name]||'تقرير';
  document.getElementById('printHeaderTitle').textContent=title;
  document.getElementById('printHeaderDate').textContent=`تاريخ التصدير: ${new Intl.DateTimeFormat('ar-SA',{year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date())}`;
  // @page can't be toggled by a class, so the rule is written per report right before printing.
  document.getElementById('printPageStyle').textContent=
    `@page{size:A4 ${printOrientation[name]||'portrait'};margin:12mm 10mm}`;
  const oldTitle=document.title;
  document.title=`WFW430_${name}_${todayISO()}`;

  // window.print() is asynchronous on Android Chrome (it opens the system share/save-as-PDF
  // sheet and returns immediately) — restoring the previous view right after calling it used
  // to risk capturing the wrong page in the exported PDF. `afterprint` fires once the
  // print/share flow has actually finished on both desktop and Android; the timeout below is
  // only a safety net for the rare browser/WebView that never fires it.
  let restored=false;
  const restore=()=>{
    if(restored) return; restored=true;
    document.title=oldTitle;
    if(name!==previous) switchView(previous);
    window.removeEventListener('afterprint',restore);
  };
  window.addEventListener('afterprint',restore);
  setTimeout(restore,4000);

  setTimeout(()=>window.print(),80);
}

document.querySelectorAll('[data-print-view]').forEach(b=>b.addEventListener('click',()=>printView(b.dataset.printView)));
printCurrentBtn.addEventListener('click',()=>printView(activeViewName()));
syncPrintButton(activeViewName()); // dashboard now has its own button, so hide the generic one on load

function exportBackup(){download(`WFW430_Backup_${todayISO()}.json`,JSON.stringify(state,null,2),'application/json');toast('تم تصدير النسخة الاحتياطية');}
document.getElementById('exportBackupBtn').addEventListener('click',exportBackup);document.getElementById('settingsExportBtn').addEventListener('click',exportBackup);
document.getElementById('importBackupInput').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{const parsed=JSON.parse(await file.text());state=migrate({...cloneDeep(seed),...parsed,settings:{...seed.settings,...parsed.settings}});save();autoSelects();renderAll();toast('تم استيراد النسخة الاحتياطية');}catch{toast('ملف النسخة الاحتياطية غير صالح.','error');}e.target.value='';});
document.getElementById('resetBtn').addEventListener('click',()=>{if(confirm('سيتم حذف جميع السجلات المحلية والعودة للبيانات الأساسية. هل أنت متأكد؟')){state=migrate(cloneDeep(seed));save();autoSelects();renderAll();toast('تمت إعادة ضبط النظام');}});

['daily','case','offer','closing','employee'].forEach(label=>{
  const btn=document.getElementById(`${label}SubmitBtn`);
  if(btn) btn.dataset.defaultLabel=btn.textContent;
});
function fillEditButtons(form,label){
  const btn=document.getElementById(`${label}SubmitBtn`);
  btn.textContent = form.dataset.editingId ? 'حفظ التعديلات' : btn.dataset.defaultLabel;
  document.getElementById(`${label}CancelEditBtn`).hidden = !form.dataset.editingId;
}
function renderAll(){renderDaily();renderCases();renderKnowledge();renderOffers();renderClosings();renderEmployees();renderSettings();renderDashboard();calcClosing();autofillDailySales();}
renderAll();

if('serviceWorker' in navigator){
  window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
  // With the network-first fetch strategy above this mainly confirms an update landed;
  // it does not affect data or require a hard refresh, so a toast is enough (no reload forced).
  let controllerSeen=Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(controllerSeen) toast('تم تحديث النظام لأحدث نسخة');
    controllerSeen=true;
  });
}
