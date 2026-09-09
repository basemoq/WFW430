(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  if(root) root.CACOParser=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const HEADER_ALIASES={
    date:['date','transaction date','created date','creation date','business date','التاريخ','تاريخ العملية'],
    time:['time','transaction time','created time','الوقت','وقت العملية'],
    employee:['employee','employee name','user','user name','username','user login','login id','created by','cashier','cashier id','agent','agent id','dealer','dealer name','salesman','sales representative','الموظف','اسم الموظف','المستخدم'],
    msisdn:['msisdn','mobile number','subscriber number','service number','رقم الجوال','رقم الخدمة'],
    transactionId:['transaction id','transaction no','transaction number','reference','reference no','order id','receipt no','رقم العملية','المرجع'],
    description:['description','item description','transaction','transaction type','transaction name','action type','operation','operation name','product','product name','service','service name','item','details','الوصف','العملية','نوع العملية','المنتج','الخدمة','التفاصيل'],
    amount:['amount','transaction amount','total amount','gross amount','net amount','price','value','total value','amount with vat','value with vat','amount incl vat','amount including vat','المبلغ','الإجمالي','القيمة','السعر'],
    simType:['sim type','sim','subscription type','نوع الشريحة','الشريحة'],
    branch:['branch','outlet','store','shop','location','الفرع','المعرض']
  };

  function normalizeDigits(value){
    return String(value??'').replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
  }
  function normalizeText(value){
    return normalizeDigits(value).trim().toLowerCase().replace(/[\u200e\u200f\u202a-\u202e]/g,'').replace(/[_\-\/\\.:()]+/g,' ').replace(/\s+/g,' ');
  }
  function canonicalHeader(value){
    const normalized=normalizeText(value);
    for(const [key,aliases] of Object.entries(HEADER_ALIASES)){
      if(aliases.some(alias=>normalized===normalizeText(alias))) return key;
    }
    return null;
  }
  function parseAmount(value){
    if(typeof value==='number'&&Number.isFinite(value)) return value;
    let text=normalizeDigits(value).trim();
    if(!text) return null;
    const negative=/^\(.*\)$/.test(text);
    text=text.replace(/[()]/g,'').replace(/\s/g,'').replace(/ر\.?(?:س)?|sar|﷼/gi,'');
    if(text.includes(',')&&text.includes('.')) text=text.replace(/,/g,'');
    else if((text.match(/,/g)||[]).length===1&&!text.includes('.')){
      const parts=text.split(',');
      text=parts[1].length<=2?`${parts[0]}.${parts[1]}`:parts.join('');
    }else text=text.replace(/,/g,'');
    text=text.replace(/[^0-9.+-]/g,'');
    const amount=Number(text);
    if(!Number.isFinite(amount)) return null;
    return negative?-Math.abs(amount):amount;
  }
  function roundMoney(value){ return Math.round((Number(value)+Number.EPSILON)*100)/100; }
  function isBlankRow(row){ return !row.some(cell=>String(cell??'').trim()!==''); }
  function isTotalLabel(value){
    const text=normalizeText(value);
    return /^(grand )?total$|^subtotal$|^sub total$|^total amount$|^الإجمالي$|^الاجمالي$|^المجموع$|^المجموع الكلي$/.test(text);
  }
  function isTotalRow(row,headerMap){
    return row.some(isTotalLabel);
  }
  function detectHeader(matrix){
    let best={index:-1,score:-1,map:{}};
    matrix.slice(0,30).forEach((row,index)=>{
      const map={};
      row.forEach((cell,col)=>{const key=canonicalHeader(cell);if(key&&map[key]===undefined)map[key]=col;});
      let score=Object.keys(map).length;
      if(map.amount!==undefined)score+=3;
      if(map.description!==undefined)score+=2;
      if(map.employee!==undefined)score+=1;
      if(score>best.score)best={index,score,map};
    });
    return best;
  }
  function dateToISO(value){
    if(value instanceof Date&&!Number.isNaN(value.valueOf())) return value.toISOString().slice(0,10);
    const text=normalizeDigits(value).trim();
    if(!text)return '';
    const iso=text.match(/\b(20\d{2})[-\/]([01]?\d)[-\/]([0-3]?\d)\b/);
    if(iso)return `${iso[1]}-${iso[2].padStart(2,'0')}-${iso[3].padStart(2,'0')}`;
    const dmy=text.match(/\b([0-3]?\d)[-\/]([01]?\d)[-\/](20\d{2})\b/);
    if(dmy)return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;
    const shortDmy=text.match(/\b([0-3]?\d)[-\/]([01]?\d)[-\/](\d{2})\b/);
    if(shortDmy)return `20${shortDmy[3]}-${shortDmy[2].padStart(2,'0')}-${shortDmy[1].padStart(2,'0')}`;
    return text;
  }
  function parseDelimited(text,delimiter){
    const sample=String(text??'').split(/\r?\n/).slice(0,5).join('\n');
    const chosen=delimiter||(['\t',';',','].sort((a,b)=>(sample.split(b).length-sample.split(a).length))[0]);
    const rows=[];let row=[],cell='',quoted=false;
    const source=String(text??'').replace(/^\uFEFF/,'');
    for(let i=0;i<source.length;i++){
      const ch=source[i];
      if(ch==='"'){
        if(quoted&&source[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;
      }else if(ch===chosen&&!quoted){row.push(cell);cell='';}
      else if((ch==='\n'||ch==='\r')&&!quoted){
        if(ch==='\r'&&source[i+1]==='\n')i++;
        row.push(cell);rows.push(row);row=[];cell='';
      }else cell+=ch;
    }
    if(cell!==''||row.length){row.push(cell);rows.push(row);}
    return rows;
  }
  function parseMatrix(inputMatrix,options={}){
    const matrix=(inputMatrix||[]).map(row=>Array.isArray(row)?row:[row]).filter(row=>!isBlankRow(row));
    const header=detectHeader(matrix);
    const errors=[],warnings=[];
    if(header.index<0||header.map.amount===undefined||header.map.description===undefined){
      return {rows:[],totalRows:[],displayedRowCount:0,transactionCount:0,computedTotal:0,reportedTotal:null,difference:null,errors:['تعذر العثور على أعمدة الوصف والمبلغ في الملف.'],warnings,header};
    }
    if(header.map.employee===undefined)warnings.push('لم يُعثر على عمود الموظف؛ ستحتاج مراجعة ربط الموظفين قبل التكامل.');
    const rows=[],totalRows=[];
    matrix.slice(header.index+1).forEach((raw,offset)=>{
      if(isBlankRow(raw))return;
      const sourceRow=header.index+offset+2;
      const amount=parseAmount(raw[header.map.amount]);
      const description=String(raw[header.map.description]??'').trim();
      const record={
        sourceRow,
        date:dateToISO(header.map.date!==undefined?raw[header.map.date]:''),
        time:String(header.map.time!==undefined?raw[header.map.time]??'':'').trim(),
        employee:String(header.map.employee!==undefined?raw[header.map.employee]??'':'').trim(),
        msisdn:String(header.map.msisdn!==undefined?raw[header.map.msisdn]??'':'').trim(),
        transactionId:String(header.map.transactionId!==undefined?raw[header.map.transactionId]??'':'').trim(),
        description,
        amount,
        simType:String(header.map.simType!==undefined?raw[header.map.simType]??'':'').trim(),
        branch:String(header.map.branch!==undefined?raw[header.map.branch]??'':'').trim(),
        raw:raw.slice()
      };
      if(isTotalRow(raw,header.map)){totalRows.push(record);return;}
      if(!description&&amount===null){warnings.push(`تم تجاهل الصف ${sourceRow} لأنه لا يحتوي وصفًا أو مبلغًا.`);return;}
      if(amount===null)errors.push(`المبلغ غير صالح في الصف ${sourceRow}.`);
      rows.push(record);
    });
    const computedTotal=roundMoney(rows.reduce((sum,row)=>sum+(row.amount===null?0:row.amount),0));
    const reported=totalRows.length?totalRows[totalRows.length-1].amount:null;
    const reportedTotal=reported===null?null:roundMoney(reported);
    const difference=reportedTotal===null?null:roundMoney(computedTotal-reportedTotal);
    if(!totalRows.length)warnings.push('لا يوجد صف Total/Subtotal للتحقق الحسابي.');
    else if(difference!==0)errors.push(`فرق التحقق الحسابي ${difference.toFixed(2)} بين مجموع العمليات وصف الإجمالي.`);
    return {
      rows,totalRows,displayedRowCount:rows.length+totalRows.length,transactionCount:rows.length,
      computedTotal,reportedTotal,difference,errors,warnings,header,sourceName:options.sourceName||''
    };
  }
  function parseWorkbook(arrayBuffer,XLSX,options={}){
    if(!XLSX||typeof XLSX.read!=='function')throw new Error('مكتبة قراءة Excel غير متاحة.');
    const workbook=XLSX.read(arrayBuffer,{type:'array',cellDates:true,raw:false});
    const sheetName=options.sheetName||workbook.SheetNames[0];
    if(!sheetName)throw new Error('ملف Excel لا يحتوي أوراق عمل.');
    const matrix=XLSX.utils.sheet_to_json(workbook.Sheets[sheetName],{header:1,defval:'',blankrows:false,raw:false});
    return parseMatrix(matrix,{...options,sheetName});
  }
  async function parseFile(file,XLSX){
    const name=file?.name||'';const lower=name.toLowerCase();
    if(/\.(csv|tsv|txt)$/.test(lower))return parseMatrix(parseDelimited(await file.text(),lower.endsWith('.tsv')?'\t':undefined),{sourceName:name});
    if(/\.(xlsx|xls|xlsm)$/.test(lower))return parseWorkbook(await file.arrayBuffer(),XLSX,{sourceName:name});
    throw new Error('صيغة الملف غير مدعومة. استخدم XLSX أو XLS أو CSV أو TSV.');
  }
  return {HEADER_ALIASES,normalizeText,parseAmount,roundMoney,parseDelimited,detectHeader,parseMatrix,parseWorkbook,parseFile,isTotalRow,dateToISO};
});
