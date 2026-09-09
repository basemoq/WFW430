const test=require('node:test');
const assert=require('node:assert/strict');
const classifier=require('../caco-classifier.js');

const row=description=>({description,amount:100,employee:'منصور',raw:[description]});

test('Invoice Payment is separated from sales',()=>{
  const x=classifier.classifyRow(row('Invoice Payment'));
  assert.equal(x.transactionType,'invoice_payment');
  assert.equal(x.classification,'invoice_payment');
});

test('SIM Replacement and MultiSim stay distinct operations',()=>{
  assert.equal(classifier.classifyRow(row('SIM Replacement')).classification,'sim_replacement');
  assert.equal(classifier.classifyRow(row('Setup Fee (MultiSim)')).classification,'additional_sim');
});

test('new postpaid extracts plan, SIM type and RS attribute',()=>{
  const x=classifier.classifyRow({...row('New Mobile Line + Postpaid 420 + RS Setup Fee + eSIM'),simType:''});
  assert.equal(x.classification,'new_postpaid');
  assert.equal(x.lineType,'postpaid');
  assert.equal(x.plan,'Postpaid 420');
  assert.equal(x.simType,'eSIM');
  assert.deepEqual(x.attributes,['RS discount']);
});

test('RS Setup Fee alone is an attribute-only review row, not an independent operation',()=>{
  const x=classifier.classifyRow(row('RS Setup Fee'));
  assert.equal(x.transactionType,'attribute');
  assert.equal(x.countable,false);
  assert.equal(x.needsReview,true);
});

test('prepaid, Shabab, Flex and Zain Line patterns follow approved rules',()=>{
  assert.equal(classifier.classifyRow(row('Setup Fee Prepaid + بصمة شباب')).classification,'new_shabab');
  assert.equal(classifier.classifyRow(row('بصمة شباب')).classification,'shabab_renewal');
  assert.equal(classifier.classifyRow(row('Flex 109 + Add/Remove Add-On')).classification,'flex_renewal_or_addon');
  assert.equal(classifier.classifyRow(row('Setup Fee Prepaid + Pre-loaded balance')).classification,'new_prepaid_line');
  assert.equal(classifier.classifyRow(row('Setup Fee + RS Setup Fee + Postpaid 420')).classification,'new_postpaid_discounted');
  assert.equal(classifier.classifyRow(row('Setup Fee + RS Setup Fee')).classification,'new_postpaid_discounted');
});

test('duplicate MSISDN and close timestamps are never merged',()=>{
  const rows=[
    {...row('SIM Replacement'),msisdn:'966500000000',time:'10:00'},
    {...row('Setup Fee (MultiSim)'),msisdn:'966500000000',time:'10:01'}
  ];
  assert.equal(classifier.classify(rows).rows.length,2);
});

test('unknown patterns are retained for review and amounts remain unchanged',()=>{
  const x=classifier.classifyRow({...row('Unmapped Offer'),amount:882.95});
  assert.equal(x.amount,882.95);
  assert.equal(x.needsReview,true);
  assert.equal(x.reviewReason,'UNKNOWN_PATTERN');
});

test('real report multi-line new-postpaid-line description stays one sale with RS discount attribute',()=>{
  const {buildRealMatrix}=require('./fixtures/caco-real-matrix.js');
  const parser=require('../caco-parser.js');
  const parsed=parser.parseMatrix(buildRealMatrix());
  const classified=classifier.classify(parsed.rows);
  const newLineRows=classified.rows.filter(r=>r.description.includes('New Mobile Line'));
  assert.equal(newLineRows.length,1);
  assert.equal(newLineRows[0].classification,'new_postpaid');
  assert.equal(newLineRows[0].transactionType,'sale');
  assert.deepEqual(newLineRows[0].attributes,['RS discount']);
});

test('invoice payment rows are excluded from sales/operations totals in summarize()',()=>{
  const {buildRealMatrix}=require('./fixtures/caco-real-matrix.js');
  const parser=require('../caco-parser.js');
  const parsed=parser.parseMatrix(buildRealMatrix());
  const classified=classifier.classify(parsed.rows);
  const invoiceRows=classified.rows.filter(r=>r.transactionType==='invoice_payment');
  assert.equal(invoiceRows.length,9);
  const expectedInvoiceAmount=Math.round(invoiceRows.reduce((sum,r)=>sum+r.amount,0)*100)/100;
  assert.equal(classified.summary.branch.invoicePaymentAmount,expectedInvoiceAmount);
  assert.equal(classified.summary.branch.invoicePayments,invoiceRows.length);
  const nonInvoiceRows=classified.rows.filter(r=>r.transactionType!=='invoice_payment');
  assert.ok(!nonInvoiceRows.some(r=>r.transactionType==='invoice_payment'));
});

test('summary reconciles classified buckets without treating 882.95 as a rule',()=>{
  const result=classifier.classify([
    {...row('Invoice Payment'),amount:882.95},
    {...row('SIM Replacement'),amount:34.5},
    {...row('Unmapped Offer'),amount:3.14}
  ]);
  assert.equal(result.summary.branch.invoicePaymentAmount,882.95);
  assert.equal(result.summary.branch.salesOperationsAmount,34.5);
  assert.equal(result.summary.branch.unknownAmount,3.14);
  assert.equal(result.summary.branch.totalAmount,920.59);
});
