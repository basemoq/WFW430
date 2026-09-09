(function(){
  'use strict';

  const parser=window.CACOParser;
  const classifier=window.CACOClassifier;
  const integration=window.WFW430Integration;
  const fileInput=document.getElementById('cacoFileInput');
  if(!parser||!classifier||!integration||!fileInput)return;

  const el=id=>document.getElementById(id);
  const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const formatMoney=value=>integration.money(Number(value)||0);
  const typeLabels={sale:'مبيعات',operation:'عملية/خدمة',invoice_payment:'سداد فاتورة',attribute:'خاصية فقط',unknown:'غير معروف'};
  const lineLabels={postpaid:'مفوتر',prepaid:'مسبق الدفع',not_applicable:'لا ينطبق',unknown:'غير محدد'};
  const classLabels={
    invoice_payment:'سداد فاتورة',sim_replacement:'بدل فاقد/استبدال شريحة',additional_sim:'شريحة إضافية',
    new_postpaid:'شريحة جديدة مفوتر',new_postpaid_discounted:'إصدار مفوتر جديد بخصم',
    new_prepaid:'شريحة جديدة مسبقة الدفع',new_prepaid_line:'إصدار Zain Line مسبق الدفع',
    new_shabab:'إصدار شباب جديد',shabab_renewal:'تجديد شباب',
    flex_renewal_or_addon:'تجديد/إضافة Flex',rs_discount_attribute:'خاصية خصم RS',unknown:'غير معروف'
  };
  let analysis=null;

  el('cacoIntegrationDate').value=integration.todayISO();

  function resolveEmployeeName(raw){
    const matched=integration.resolveEmployee(raw);
    return matched?matched.name:'';
  }
  function employeeDate(rawEmployee){
    const dates=analysis.classified.rows.filter(row=>row.employee===rawEmployee&&row.date).map(row=>row.date);
    return dates[0]||el('cacoIntegrationDate').value||integration.todayISO();
  }
  function statusBadge(text,kind='neutral'){
    return `<span class="badge ${kind}">${escapeHtml(text)}</span>`;
  }
  function renderKpis(){
    const p=analysis.parsed,s=analysis.classified.summary.branch;
    const kpis=[
      ['الصفوف الظاهرة',p.displayedRowCount,'تشمل صف الإجمالي',p.displayedRowCount===25?'success':''],
      ['العمليات',p.transactionCount,'بعد استبعاد Total/Subtotal',p.transactionCount===24?'success':''],
      ['مجموع المصدر',formatMoney(p.computedTotal),'المبلغ كما ورد',p.difference===0?'success':''],
      ['مبيعات وعمليات',formatMoney(s.salesOperationsAmount),`${s.sales+s.operations} سجل`,''],
      ['سداد فواتير',formatMoney(s.invoicePaymentAmount),`${s.invoicePayments} سجل`,'info'],
      ['تحتاج مراجعة',analysis.classified.summary.reviewRows.length,'لا تُرحّل تلقائيًا',analysis.classified.summary.reviewRows.length?'warn':'success']
    ];
    el('cacoKpis').innerHTML=kpis.map(([label,value,hint,kind])=>`<div class="kpi ${kind}"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div><div class="hint">${escapeHtml(hint)}</div></div>`).join('');
  }
  function renderValidation(){
    const p=analysis.parsed;
    const items=[];
    if(p.reportedTotal===null)items.push({kind:'warn',title:'صف الإجمالي غير موجود',text:'العمليات مصنفة، لكن لا يمكن مطابقة المجموع مع Total/Subtotal.'});
    else if(p.difference===0)items.push({kind:'success',title:'التحقق الحسابي مطابق',text:`مجموع العمليات يساوي صف الإجمالي: ${formatMoney(p.reportedTotal)}.`});
    else items.push({kind:'danger',title:'فرق في الإجمالي',text:`المحسوب ${formatMoney(p.computedTotal)} مقابل المصدر ${formatMoney(p.reportedTotal)}.`});
    if(p.displayedRowCount===25&&p.transactionCount===24&&p.computedTotal===2699.59){
      items.push({kind:'success',title:'Golden Fixture مطابق',text:'25 صفًا ظاهرًا = 24 عملية + صف إجمالي، والمجموع 2699.59.'});
    }else{
      items.push({kind:'neutral',title:'ملف تشغيل مختلف عن العينة المرجعية',text:'مرجع الاختبار 24 عملية ومجموع 2699.59؛ لا يُعد اختلاف تقرير يوم آخر خطأً بحد ذاته.'});
    }
    if(p.rows.some(row=>row.amount===882.95))items.push({kind:'neutral',title:'ظهرت القيمة 882.95',text:'استُخدمت للتحقق فقط ولم تتحول إلى قاعدة تصنيف.'});
    p.errors.forEach(text=>items.push({kind:'danger',title:'خطأ Parser',text}));
    p.warnings.forEach(text=>items.push({kind:'warn',title:'تنبيه Parser',text}));
    analysis.classified.summary.reviewRows.forEach(row=>items.push({kind:'warn',title:`الصف ${row.sourceRow} يحتاج مراجعة`,text:`${row.description||'بدون وصف'} — ${row.reviewReason}`}));
    el('cacoValidation').innerHTML=items.map(item=>`<div class="validation-item ${item.kind}"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.text)}</span></div>`).join('');
  }

  function renderEmployeeSummary(){
    const entries=Object.entries(analysis.classified.summary.employees);
    el('cacoEmployeeBody').innerHTML=entries.map(([raw,s])=>{
      const resolved=resolveEmployeeName(raw);
      const review=s.unknown+s.attributeOnly;
      const name=resolved?escapeHtml(resolved):`${escapeHtml(raw)} ${statusBadge('غير مربوط','warn')}`;
      return `<tr><td data-label="الموظف"><strong>${name}</strong></td><td data-label="العمليات">${s.transactions}</td><td data-label="مبيعات">${s.sales}</td><td data-label="خدمات">${s.operations}</td><td data-label="سداد">${s.invoicePayments}</td><td data-label="مبيعات/عمليات">${formatMoney(s.salesOperationsAmount)}</td><td data-label="سداد فواتير">${formatMoney(s.invoicePaymentAmount)}</td><td data-label="مراجعة">${review}</td></tr>`;
    }).join('')||'<tr><td colspan="8" class="empty-row">لا توجد بيانات موظفين</td></tr>';
    el('cacoClosingEmployee').innerHTML=entries.map(([raw])=>{
      const resolved=resolveEmployeeName(raw);
      return `<option value="${escapeHtml(raw)}">${escapeHtml(resolved||raw)}${resolved?'':' — غير مربوط'}</option>`;
    }).join('');
  }
  function renderBranchSummary(){
    el('cacoBranchBody').innerHTML=Object.entries(analysis.classified.summary.branches).map(([branch,s])=>`<tr><td data-label="المعرض">${escapeHtml(branch)}</td><td data-label="العمليات">${s.transactions}</td><td data-label="مبيعات/عمليات">${formatMoney(s.salesOperationsAmount)}</td><td data-label="سداد فواتير">${formatMoney(s.invoicePaymentAmount)}</td><td data-label="غير معروف">${s.unknown+s.attributeOnly}</td></tr>`).join('')||'<tr><td colspan="5" class="empty-row">لا توجد بيانات معرض</td></tr>';
  }
  function filteredRows(){
    const filter=el('cacoResultFilter').value;
    if(filter==='invoice_payment')return analysis.classified.rows.filter(row=>row.transactionType==='invoice_payment');
    if(filter==='sales_operations')return analysis.classified.rows.filter(row=>['sale','operation'].includes(row.transactionType));
    if(filter==='review')return analysis.classified.rows.filter(row=>row.needsReview);
    return analysis.classified.rows;
  }
  function renderRows(){
    el('cacoResultBody').innerHTML=filteredRows().map(row=>`<tr class="${row.needsReview?'review-row':''}">
      <td data-label="الصف">${row.sourceRow}</td>
      <td data-label="الموظف">${escapeHtml(resolveEmployeeName(row.employee)||row.employee||'غير محدد')}</td>
      <td data-label="الوصف" class="description-cell">${escapeHtml(row.description||'—')}</td>
      <td data-label="نوع العملية">${escapeHtml(typeLabels[row.transactionType]||row.transactionType)}</td>
      <td data-label="نوع الخط">${escapeHtml(lineLabels[row.lineType]||row.lineType)}</td>
      <td data-label="العائلة">${escapeHtml(row.productFamily||'—')}</td>
      <td data-label="الخطة">${escapeHtml(row.plan||'—')}</td>
      <td data-label="SIM">${escapeHtml(row.simType||'—')}</td>
      <td data-label="المبلغ">${row.amount===null?statusBadge('غير صالح','danger'):formatMoney(row.amount)}</td>
      <td data-label="الخصائص">${escapeHtml(row.attributes.join('، ')||'—')}</td>
      <td data-label="المراجعة">${row.needsReview?statusBadge(classLabels[row.classification]||'مراجعة','warn'):statusBadge(classLabels[row.classification]||'مصنف','success')}</td>
    </tr>`).join('')||'<tr><td colspan="11" class="empty-row">لا توجد نتائج مطابقة للفلتر</td></tr>';
  }
  function render(){
    el('cacoResults').hidden=false;
    renderKpis();
    renderValidation();
    renderEmployeeSummary();
    renderBranchSummary();
    renderRows();
    const unresolved=Object.keys(analysis.classified.summary.employees).filter(raw=>!resolveEmployeeName(raw));
    el('cacoToDailyBtn').disabled=!Object.keys(analysis.classified.summary.employees).length;
    el('cacoToClosingBtn').disabled=!el('cacoClosingEmployee').options.length;
    if(unresolved.length){
      el('cacoFileStatus').textContent=`اكتمل التحليل. يوجد ${unresolved.length} اسم موظف غير مربوط؛ سيُستبعد من التكامل حتى تتم إضافته أو تعديل اليوزر في دليل الموظفين.`;
    }
  }
  async function analyzeFile(file){
    if(!file)return;
    el('cacoFileStatus').textContent=`جارٍ تحليل ${file.name}…`;
    el('cacoResults').hidden=true;
    try{
      const parsed=await parser.parseFile(file,window.XLSX);
      const classified=classifier.classify(parsed.rows);
      analysis={file,parsed,classified};
      const dates=parsed.rows.map(row=>row.date).filter(Boolean);
      if(dates.length)el('cacoIntegrationDate').value=dates[0];
      el('cacoFileStatus').textContent=`تم تحليل ${file.name}: ${parsed.transactionCount} عملية.`;
      render();
    }catch(error){
      analysis=null;
      el('cacoResults').hidden=true;
      el('cacoFileStatus').textContent=error?.message||'تعذر تحليل الملف.';
      integration.showToast('تعذر تحليل ملف CACO','error');
    }
  }

  fileInput.addEventListener('change',event=>analyzeFile(event.target.files[0]));
  el('cacoResultFilter').addEventListener('change',()=>{if(analysis)renderRows();});

  const drop=el('cacoDropZone');
  ['dragenter','dragover'].forEach(name=>drop.addEventListener(name,event=>{
    event.preventDefault();
    drop.classList.add('dragging');
  }));
  ['dragleave','drop'].forEach(name=>drop.addEventListener(name,event=>{
    event.preventDefault();
    drop.classList.remove('dragging');
  }));
  drop.addEventListener('drop',event=>{
    const file=event.dataTransfer.files[0];
    if(file)analyzeFile(file);
  });

  el('cacoToDailyBtn').addEventListener('click',()=>{
    if(!analysis)return;
    const records=Object.entries(analysis.classified.summary.employees).map(([employee,s])=>({
      employee,date:employeeDate(employee),sales:s.sales,operations:s.operations,unknown:s.unknown+s.attributeOnly,
      salesOperationsAmount:s.salesOperationsAmount,invoicePaymentAmount:s.invoicePaymentAmount
    }));
    const result=integration.importDaily(records,analysis.file.name);
    integration.showToast(`أضيف ${result.added} وتجاوز ${result.skipped} سجل`,result.added?'success':'');
  });
  el('cacoToClosingBtn').addEventListener('click',()=>{
    if(!analysis)return;
    const employee=el('cacoClosingEmployee').value;
    const s=analysis.classified.summary.employees[employee];
    const result=integration.prefillClosing({
      employee,date:employeeDate(employee),invoicePaymentAmount:s.invoicePaymentAmount,
      salesOperationsAmount:s.salesOperationsAmount,unknown:s.unknown+s.attributeOnly
    },analysis.file.name);
    if(!result.ok)integration.showToast(result.reason,'error');
    else integration.showToast('تمت تعبئة التقفيلة للمراجعة قبل الحفظ','success');
  });
})();
