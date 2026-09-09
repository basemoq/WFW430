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
  const totals={sales:0,services:0,complaints:0,errors:0,systemCases:0,followups:0};
  logs.forEach(x=>Object.keys(totals).forEach(k=>totals[k]+=n(x[k])));
  const diff=closes.reduce((s,x)=>s+n(x.diff),0);
  const activeCount=logs.filter(x=>x.attendance==='مكتمل').length;
  const kpis=[
    ['إجمالي المبيعات',totals.sales,'عملية','success'],['إجمالي الخدمات',totals.services,'خدمة','success'],['الشكاوى',totals.complaints,'حالة','warn'],['الأخطاء',totals.errors,'خطأ',totals.errors>=state.settings.warningErrors?'danger':''],
    ['حالات النظام',totals.systemCases,'حالة',''],['متابعة العملاء',totals.followups,'متابعة',''],['فرق الإغلاق',money(diff),'صافي فروقات اليوم',Math.abs(diff)>1?'danger':Math.abs(diff)>0?'warn':'success'],['موظفون مكتمل دوامهم',activeCount,`من ${activeEmployees().length}`,'']
  ];
  document.getElementById('kpiGrid').innerHTML=kpis.map(([label,value,hint,cls])=>`<div class="kpi ${cls}"><div class="label">${label}</div><div class="value">${value}</div><div class="hint">${hint}</div></div>`).join('');

  const rows=employeesForDate(logs).map(emp=>{
    const mine=logs.filter(x=>x.employee===emp.name);
    const t={sales:0,services:0,complaints:0,errors:0,systemCases:0,followups:0};mine.forEach(x=>Object.keys(t).forEach(k=>t[k]+=n(x[k])));
    const health=employeeHealth(t.errors);
    const inactiveTag=emp.status==='غير نشط'?' <span class="badge neutral" title="غير نشط حاليًا">سابقًا</span>':'';
    return `<tr><td><strong>${esc(emp.name)}</strong>${inactiveTag}</td><td>${t.sales}</td><td>${t.services}</td><td>${t.complaints}</td><td>${t.errors}</td><td>${t.systemCases}</td><td>${t.followups}</td><td><span class="badge ${badgeClass(health)}">${health}</span></td></tr>`;
  }).join('');
  document.getElementById('employeePerformanceBody').innerHTML=rows||`<tr><td colspan="8" class="empty-row">لا يوجد موظفون نشطون</td></tr>`;

  const alerts=[];
  activeEmployees().forEach(emp=>{
    const errs=logs.filter(x=>x.employee===emp.name).reduce((s,x)=>s+n(x.errors),0);
    const health=employeeHealth(errs);
    if(health!=='مستقر') alerts.push({type:health==='مراجعة عاجلة'?'danger':'warn',title:`${emp.name}: ${health}`,text:`${errs} أخطاء في التاريخ المختار`});
  });
  closes.filter(x=>Math.abs(n(x.diff))>1).forEach(x=>alerts.push({type:'danger',title:`فرق إغلاق: ${x.employee}`,text:`${money(x.diff)} — ${x.shift}`}));
  const openCases=state.cases.filter(x=>x.date===date && !['مغلقة','مكررة'].includes(x.status));
  if(openCases.length) alerts.push({type:'warn',title:`${openCases.length} حالة مفتوحة/متابعة`,text:'راجع الحالات قبل نهاية الشفت'});
  if(!alerts.length) alerts.push({type:'success',title:'لا توجد تنبيهات حرجة',text:'لا توجد فروقات أو أخطاء فوق الحدود المسجلة لهذا اليوم'});
  document.getElementById('alertsList').innerHTML=alerts.map(a=>`<div class="alert-item ${a.type}"><div class="alert-icon">${a.type==='success'?'✓':'!'}</div><div><strong>${esc(a.title)}</strong><span>${esc(a.text)}</span></div></div>`).join('');
}

document.getElementById('dashboardDate').addEventListener('change',renderDashboard);

function formObj(form){return Object.fromEntries(new FormData(form).entries());}
function resetKeepDate(form){ const date=form.querySelector('[name=date]')?.value; form.reset(); if(form.querySelector('[name=date]')) form.querySelector('[name=date]').value=date||todayISO(); autoSelects(); }

document.getElementById('dailyForm').addEventListener('submit',e=>{
  e.preventDefault(); const x=formObj(e.currentTarget);
  ['sales','services','complaints','errors','systemCases','followups'].forEach(k=>x[k]=n(x[k]));x.id=uid();x.createdAt=Date.now();state.daily.unshift(x);save();renderDaily();renderDashboard();resetKeepDate(e.currentTarget);toast('تم حفظ المتابعة اليومية');
});
function renderDaily(){
  const body=document.getElementById('dailyBody');
  body.innerHTML=state.daily.map(x=>`<tr><td>${fmtDate(x.date)}</td><td>${esc(x.employee)}</td><td>${x.sales}</td><td>${x.services}</td><td>${x.complaints}</td><td>${x.errors}</td><td>${x.systemCases}</td><td>${x.followups}</td><td>${esc(x.attendance)}</td><td><span class="badge ${badgeClass(x.status)}">${esc(x.status)}</span></td><td><button class="mini-btn danger" data-delete="daily" data-id="${x.id}">حذف</button></td></tr>`).join('')||`<tr><td colspan="11" class="empty-row">لا توجد متابعات حتى الآن</td></tr>`;
}

document.getElementById('caseForm').addEventListener('submit',e=>{
  e.preventDefault(); const x=formObj(e.currentTarget);x.id=uid();x.caseNo=state.cases.length?Math.max(...state.cases.map(c=>n(c.caseNo)))+1:1;x.createdAt=Date.now();state.cases.unshift(x);save();renderCases();renderDashboard();resetKeepDate(e.currentTarget);toast(`تم حفظ الحالة #${x.caseNo}`);
});
document.getElementById('caseSearch').addEventListener('input',renderCases);
function renderCases(){
  const q=document.getElementById('caseSearch').value.trim().toLowerCase();
  const rows=state.cases.filter(x=>!q||JSON.stringify(x).toLowerCase().includes(q)).map(x=>`<tr><td>#${x.caseNo}</td><td>${fmtDate(x.date)}</td><td>${esc(x.employee)}</td><td>${esc(x.operation)}</td><td>${esc(x.classification)}</td><td><span class="badge ${badgeClass(x.status)}">${esc(x.status)}</span></td><td>${esc(x.training)}</td><td><button class="mini-btn danger" data-delete="cases" data-id="${x.id}">حذف</button></td></tr>`).join('');
  document.getElementById('casesBody').innerHTML=rows||`<tr><td colspan="8" class="empty-row">لا توجد حالات مطابقة</td></tr>`;
}

function renderKnowledge(){
  const q=document.getElementById('knowledgeSearch').value.trim().toLowerCase();
  const list=state.knowledge.filter(x=>!q||JSON.stringify(x).toLowerCase().includes(q));
  document.getElementById('knowledgeGrid').innerHTML=list.map(x=>`<article class="knowledge-card"><h3>${esc(x.topic)}</h3><div class="common">${esc(x.common)}</div><div class="steps">${x.checks.map((s,i)=>`<div class="step"><b>${i+1}</b><span>${esc(s)}</span></div>`).join('')}</div><div class="decision"><div><strong>الإجراء:</strong> ${esc(x.action)}</div><div><strong>المشرف:</strong> ${esc(x.supervisor)}</div><div><strong>777:</strong> ${esc(x.support)}</div>${x.note?`<div><strong>ملاحظة:</strong> ${esc(x.note)}</div>`:''}</div></article>`).join('')||`<div class="card">لا توجد نتيجة مطابقة.</div>`;
}
document.getElementById('knowledgeSearch').addEventListener('input',renderKnowledge);

document.getElementById('offerForm').addEventListener('submit',e=>{
  e.preventDefault();const x=formObj(e.currentTarget);x.id=uid();x.createdAt=Date.now();state.offers.unshift(x);save();renderOffers();e.currentTarget.reset();toast('تم حفظ العرض');
});
function renderOffers(){
  document.getElementById('offersBody').innerHTML=state.offers.map(x=>`<tr><td><strong>${esc(x.name)}</strong></td><td><span class="badge ${badgeClass(x.status)}">${esc(x.status)}</span></td><td>${fmtDate(x.startDate)}</td><td>${fmtDate(x.endDate)}</td><td>${esc(x.segment||'—')}</td><td>${esc(x.business)}</td><td>${esc(x.product||'—')}</td><td><button class="mini-btn danger" data-delete="offers" data-id="${x.id}">حذف</button></td></tr>`).join('')||`<tr><td colspan="8" class="empty-row">لا توجد عروض مضافة بعد</td></tr>`;
}

const closingForm=document.getElementById('closingForm');
function calcClosing(){
  const f=formObj(closingForm);const actual=n(f.cash)+n(f.card)+n(f.other), diff=actual-n(f.systemTotal);let status='مطابق';if(diff!==0)status=Math.abs(diff)<=1?'فرق بسيط':'مراجعة عاجلة';
  document.getElementById('actualPreview').textContent=money(actual);document.getElementById('diffPreview').textContent=money(diff);const s=document.getElementById('closingStatusPreview');s.textContent=status;s.className=`badge ${badgeClass(status)}`;return{actual,diff,status};
}
closingForm.addEventListener('input',calcClosing);
closingForm.addEventListener('submit',e=>{e.preventDefault();const x=formObj(e.currentTarget);Object.assign(x,calcClosing());['systemTotal','cash','card','other'].forEach(k=>x[k]=n(x[k]));x.id=uid();x.createdAt=Date.now();state.closings.unshift(x);save();renderClosings();renderDashboard();resetKeepDate(e.currentTarget);calcClosing();toast('تم حفظ إغلاق الشفت');});
function renderClosings(){document.getElementById('closingBody').innerHTML=state.closings.map(x=>`<tr><td>${fmtDate(x.date)}</td><td>${esc(x.employee)}</td><td>${esc(x.shift)}</td><td>${money(x.systemTotal)}</td><td>${money(x.actual)}</td><td>${money(x.diff)}</td><td><span class="badge ${badgeClass(x.status)}">${esc(x.status)}</span></td><td><button class="mini-btn danger" data-delete="closings" data-id="${x.id}">حذف</button></td></tr>`).join('')||`<tr><td colspan="8" class="empty-row">لا توجد إغلاقات مسجلة</td></tr>`;}

document.getElementById('employeeForm').addEventListener('submit',e=>{e.preventDefault();const x=formObj(e.currentTarget);x.id=uid();state.employees.push(x);save();autoSelects();renderEmployees();renderDashboard();e.currentTarget.reset();toast('تمت إضافة الموظف');});
function renderEmployees(){document.getElementById('employeeCards').innerHTML=state.employees.map(e=>`<div class="employee-card"><div><h4>${esc(e.name)}</h4><div class="employee-meta">${esc(e.shift)} · ${e.username?esc(e.username):'بدون يوزر'}${e.startDate?` · بدأ ${fmtDate(e.startDate)}`:''}</div></div><div><span class="badge ${badgeClass(e.status)}">${esc(e.status)}</span><div class="row-actions" style="margin-top:8px"><button class="mini-btn" data-toggle-employee="${e.id}">${e.status==='غير نشط'?'تفعيل':'تعطيل'}</button></div></div></div>`).join('');}

document.getElementById('settingsForm').addEventListener('submit',e=>{e.preventDefault();const x=formObj(e.currentTarget);Object.keys(state.settings).forEach(k=>state.settings[k]=n(x[k]));save();renderDashboard();toast('تم حفظ الإعدادات');});
function renderSettings(){const f=document.getElementById('settingsForm');Object.entries(state.settings).forEach(([k,v])=>{if(f.elements[k])f.elements[k].value=v;});}

document.addEventListener('click',e=>{
  const d=e.target.closest('[data-delete]');if(d){const type=d.dataset.delete,id=d.dataset.id;if(confirm('حذف هذا السجل؟')){state[type]=state[type].filter(x=>x.id!==id);save();renderAll();toast('تم حذف السجل');}return;}
  const t=e.target.closest('[data-toggle-employee]');if(t){const emp=state.employees.find(x=>x.id===t.dataset.toggleEmployee);if(emp){emp.status=emp.status==='غير نشط'?'نشط':'غير نشط';save();autoSelects();renderEmployees();renderDashboard();toast('تم تحديث حالة الموظف');}return;}
});

function download(name,content,type='text/plain'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;document.body.appendChild(a);a.click();URL.revokeObjectURL(a.href);a.remove();}

function activeViewName(){
  const active=document.querySelector('.nav-item.active');
  return active?.dataset.view || 'dashboard';
}

function printView(name=activeViewName()){
  const previous=activeViewName();
  if(name!==previous) switchView(name);
  setMenu(false);
  const title=viewTitles[name]||'تقرير';
  document.getElementById('printHeaderTitle').textContent=title;
  document.getElementById('printHeaderDate').textContent=`تاريخ التصدير: ${new Intl.DateTimeFormat('ar-SA',{year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date())}`;
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
document.getElementById('printCurrentBtn').addEventListener('click',()=>printView(activeViewName()));

function exportBackup(){download(`WFW430_Backup_${todayISO()}.json`,JSON.stringify(state,null,2),'application/json');toast('تم تصدير النسخة الاحتياطية');}
document.getElementById('exportBackupBtn').addEventListener('click',exportBackup);document.getElementById('settingsExportBtn').addEventListener('click',exportBackup);
document.getElementById('importBackupInput').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{const parsed=JSON.parse(await file.text());state=migrate({...cloneDeep(seed),...parsed,settings:{...seed.settings,...parsed.settings}});save();autoSelects();renderAll();toast('تم استيراد النسخة الاحتياطية');}catch{toast('ملف النسخة الاحتياطية غير صالح.','error');}e.target.value='';});
document.getElementById('resetBtn').addEventListener('click',()=>{if(confirm('سيتم حذف جميع السجلات المحلية والعودة للبيانات الأساسية. هل أنت متأكد؟')){state=migrate(cloneDeep(seed));save();autoSelects();renderAll();toast('تمت إعادة ضبط النظام');}});

function renderAll(){renderDaily();renderCases();renderKnowledge();renderOffers();renderClosings();renderEmployees();renderSettings();renderDashboard();calcClosing();}
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
