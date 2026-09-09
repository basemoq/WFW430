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
  const matrix=[['Transaction Date','Description','Amount'],['2026-09-09','Invoice Payment','10'],['','Subtotal','10']];
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
