const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const parser=require('../caco-parser.js');

test('golden CACO fixture has 25 displayed rows, 24 transactions and 2699.59 total',()=>{
  const text=fs.readFileSync(path.join(__dirname,'fixtures/caco-golden.csv'),'utf8');
  const result=parser.parseMatrix(parser.parseDelimited(text),{sourceName:'caco-golden.csv'});
  assert.equal(result.displayedRowCount,25);
  assert.equal(result.transactionCount,24);
  assert.equal(result.totalRows.length,1);
  assert.equal(result.computedTotal,2699.59);
  assert.equal(result.reportedTotal,2699.59);
  assert.equal(result.difference,0);
  assert.deepEqual(result.errors,[]);
});

test('Total and Subtotal rows are excluded from transaction count but retained for validation',()=>{
  const matrix=[['Transaction Date','Transaction ID','Description','Amount'],['2026-09-09','T001','Invoice Payment','10'],['','','Subtotal','10']];
  const result=parser.parseMatrix(matrix);
  assert.equal(result.transactionCount,1);
  assert.equal(result.displayedRowCount,2);
  assert.equal(result.reportedTotal,10);
});

test('amount is preserved as reported without inferred VAT decomposition',()=>{
  assert.equal(parser.parseAmount('882.95 SAR'),882.95);
  assert.equal(parser.parseAmount('(12.50)'),-12.5);
});

test('browser XLSX path parses the same golden fixture',()=>{
  const XLSX=require('../vendor/xlsx.full.min.js');
  const text=fs.readFileSync(path.join(__dirname,'fixtures/caco-golden.csv'),'utf8');
  const matrix=parser.parseDelimited(text);
  const workbook=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet(matrix),'CACO');
  const bytes=XLSX.write(workbook,{type:'buffer',bookType:'xlsx'});
  const result=parser.parseWorkbook(bytes,XLSX,{sourceName:'golden.xlsx'});
  assert.equal(result.transactionCount,24);
  assert.equal(result.computedTotal,2699.59);
  assert.equal(result.reportedTotal,2699.59);
});

// --- Real-report-shaped fixture (regression for the "uploaded but 0 transactions" bug) ---
// Mirrors the actual Finance CACO report layout: metadata rows 1-11, the real header at
// row 12 (23 columns, e.g. "User ID", "Payment Order type/Description", "Sub no (MSISDN)",
// "Shop ID"), 24 transaction rows, a total row whose amount sits in column B (not under
// the Amount column), a footer text row, and a stray row with only a bare amount and
// nothing identifying it (date/employee/receipt all blank).
const {buildRealMatrix,HEADER}=require('./fixtures/caco-real-matrix.js');

test('real report structure: header aliases resolve employee/description/amount/msisdn/branch',()=>{
  const header=parser.detectHeader(buildRealMatrix());
  assert.equal(HEADER[header.map.employee],'User ID');
  assert.equal(HEADER[header.map.description],'Payment Order type/Description');
  assert.equal(HEADER[header.map.amount],'Amount');
  assert.equal(HEADER[header.map.msisdn],'Sub no (MSISDN)');
  assert.equal(HEADER[header.map.branch],'Shop ID');
});

test('real report structure yields exactly 24 transactions and total 2699.59',()=>{
  const result=parser.parseMatrix(buildRealMatrix(),{sourceName:'real.xlsx'});
  assert.equal(result.headerDetected,true);
  assert.equal(result.transactionCount,24);
  assert.equal(result.computedTotal,2699.59);
});

test('total row amount is read from column B when the Amount column cell is empty',()=>{
  const result=parser.parseMatrix(buildRealMatrix());
  assert.equal(result.totalRows.length,1);
  assert.equal(result.reportedTotal,2699.59);
  assert.equal(result.difference,0);
});

test('a stray row with only a bare amount and no identifying data is ignored, not counted',()=>{
  const result=parser.parseMatrix(buildRealMatrix());
  assert.equal(result.transactionCount,24);
  assert.equal(result.totalRows.length,1);
  const strayIgnored=result.ignoredRows.find(r=>r.reason.includes('تعريفية'));
  assert.ok(strayIgnored,'expected an ignored row for the row with only a bare amount');
  assert.ok(!result.rows.some(r=>r.amount===882.95),'the bare amount 882.95 must never be counted as a transaction');
});

test('manual column mapping: detectHeader failure is reported without throwing, manualMap bypasses detection',()=>{
  const matrix=[['x','y'],['1','2']];
  const failed=parser.parseMatrix(matrix);
  assert.equal(failed.headerDetected,false);
  assert.equal(failed.errors.length>0,true);
  assert.deepEqual(failed.headerRowCells,['x','y']);

  const manual=parser.parseMatrix(
    [['2026-09-08','Employee.One','Some Description','12.50']],
    {manualMap:{date:0,employee:1,description:2,amount:3}}
  );
  assert.equal(manual.headerDetected,true);
  assert.equal(manual.transactionCount,1);
  assert.equal(manual.rows[0].amount,12.5);
  assert.equal(manual.rows[0].employee,'Employee.One');
});
