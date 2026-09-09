// Mirrors the exact structure of a real "Finance CACO report (detailed)" export:
// metadata block (rows 1-11), the real header at row 12 (23 columns), 24 transaction
// rows, a total row whose amount sits in column B (not under Amount), a footer text
// row, and a stray incomplete row with only a bare amount and nothing identifying it.
'use strict';

const HEADER=[
  'User ID','User Full Name','Manager','Shop ID','Contact Person','City','Region',
  'Distribution channel','Partner Name','Account','Prepaid/Postpaid','Sub no (MSISDN)',
  'Time','Date','Receipt No','Amount','Payment Method','Payment Order type/Description',
  'Sales order number','Sales order Status','D2D User Name','D2D User Partner Name',
  'External payment transaction ID'
];

// [userId,userFullName,manager,shopId,contactPerson,city,region,channel,partner,account,
//  prepaidPostpaid,msisdn,time,date,receiptNo,amount,paymentMethod,description,salesOrderNo,salesOrderStatus]
const TX_ROWS=[
  ['Employee.One','Employee.One','Manager.One','WFW430','Contact.One','Mecca','Western Region','FBO Central','Partner X',2000001,'Prepaid','966500000101','9:17 PM','08-Sep-2026','ZN_fixture0001',125.35,'Cash','Flex 109"Add/Remove Add-On - Order Entry"',3000001,'Processed'],
  ['Employee.Two','Employee.Two','Manager.One','WFW430','Contact.One','Mecca','Western Region','FBO South','Partner X',2000002,'Prepaid','966500000102','6:15 PM','08-Sep-2026','ZN_fixture0002','105.01','SPAN Offline','Social Media Unlimited\nSetup Fee Prepaid\nLocal Minutes&SMS 1500\nLocal Data 15GB',3000002,'Processed'],
  ['Employee.Two','Employee.Two','Manager.One','WFW430','Contact.One','Mecca','Western Region','FBO South','Partner X',2000003,'Postpaid','966500000103','10:02 PM','08-Sep-2026','ZN_fixture0003','40.25','SPAN Offline','SIM Replacement Postpaid Fee"SIM Replacement - Order Entry"',3000003,'Processed'],
  ['Employee.Three','Employee.Three','','WFW430','Contact.One','Mecca','Western Region','FBO South','Partner X',2000004,'Postpaid','966500000104','6:04 PM','08-Sep-2026','ZN_fixture0004',10,'SPAN Offline','Setup Fee (MultiSim)',3000004,'Processed'],
  ['Employee.One','Employee.One','Manager.One','WFW430','Contact.One','Mecca','Western Region','FBO Central','Partner X',2000005,'Prepaid','966500000105','5:14 PM','08-Sep-2026','ZN_fixture0005','105.01','Cash','Social Media Unlimited\nSetup Fee Prepaid\nLocal Minutes&SMS 1500\nLocal Data 15GB',3000005,'Processed'],
  ['Employee.One','Employee.One','Manager.One','WFW430','Contact.One','Mecca','Western Region','FBO Central','Partner X',2000006,'Postpaid','966500000106','10:00 PM','08-Sep-2026','ZN_fixture0006',10,'SPAN Offline','Setup Fee (MultiSim)',3000006,'Processed'],
  ['Employee.One','Employee.One','Manager.One','WFW430','Contact.One','Mecca','Western Region','FBO North','Partner X',2000006,'Postpaid','966500000106','9:51 PM','08-Sep-2026','ZN_fixture0007',260,'SPAN Offline','"Change Plan Restriction Service"\n"Deposit Product"\n"Local Data Unlimited Postpaid"\n"Local Minutes Unlimited Postpaid"\n"New Mobile Line: Zain Phone Number - Order Entry"\n"Outgoing Roaming Minutes 100 Min Postpaid"\n"Postpaid 420"\n"RS Setup Fee"\n"Roaming Data 8 GB Postpaid"\n"Setup Fee"\n"eSIM"\nSetup Fee\nRS Setup Fee',3000007,'Processed'],
  ['Employee.Two','Employee.Two','Manager.One','WFW430','Contact.One','Mecca','Western Region','FBO South','Partner X',2000008,'Postpaid','966500000108','6:41 PM','08-Sep-2026','ZN_fixture0008','40.25','SPAN Offline','SIM Replacement Postpaid Fee"SIM Replacement - Order Entry"',3000008,'Processed'],
  ['Employee.Three','Employee.Three','','WFW430','Contact.One','Mecca','Western Region','FBO North','Partner X',2000009,'Postpaid','966500000109','10:13 AM','08-Sep-2026','ZN_fixture0009',50,'SPAN Offline','Setup Fee\nRS Setup Fee',3000009,'Processed'],
  ['Employee.Four','Employee.Four','Manager.One','WFW430','Contact.One','Mecca','Western Region','FBO South','Partner X',2000010,'Postpaid','966500000110','1:59 PM','08-Sep-2026','ZN_fixture0010',10,'Cash','Setup Fee (MultiSim)',3000010,'Processed'],
  ['Employee.Three','Employee.Three','','WFW430','Contact.One','Mecca','Western Region','FBO South','Partner X',2000004,'Postpaid','966500000104','6:01 PM','08-Sep-2026','ZN_fixture0011',10,'SPAN Offline','Setup Fee (MultiSim)',3000011,'Processed'],
  ['Employee.Three','Employee.Three','','WFW430','Contact.One','Mecca','Western Region','FBO South','Partner X',2000012,'Prepaid','966500000112','7:55 PM','08-Sep-2026','ZN_fixture0012','50.25','SPAN Offline','Setup Fee Prepaid\nPre-loaded balance Fee\nPre-loaded balance',3000012,'Processed'],
  ['Employee.One','Employee.One','Manager.One','WFW430','Contact.One','Mecca','Western Region','FBO Central','Partner X',2000013,'Prepaid','966500000113','7:39 PM','08-Sep-2026','ZN_fixture0013','111.01','SPAN Offline','Social Media Unlimited\nLocal Minutes&SMS 500\nLocal Data 30GB',3000013,'Processed'],
  ['Employee.One','Employee.One','Manager.One','WFW430','Contact.One','Mecca','Western Region','FBO Central','Partner X',2000014,'Prepaid','966500000114','6:31 PM','08-Sep-2026','ZN_fixture0014','87.01','SPAN Offline','Social Media Unlimited\nLocal Minutes&SMS 500\nLocal Data 15GB',3000014,'Processed'],
  ['Employee.Two','Employee.Two','Manager.One','WFW430','Contact.One','Mecca','Western Region','FBO South','Partner X',2000015,'Postpaid','966500000115','7:13 PM','08-Sep-2026','ZN_fixture0015',10,'SPAN Offline','Setup Fee (MultiSim)',3000015,'Processed'],
  ['Employee.Four','Employee.Four','Manager.One','WFW430','Contact.One','Mecca','Western Region','','Partner X',2000016,'Postpaid','966500000116','10:51 AM','08-Sep-2026','ZN_fixture0016','106.4','SPAN Offline','Invoice Payment','',''],
  ['Employee.Four','Employee.Four','Manager.One','WFW430','Contact.One','Mecca','Western Region','','Partner X',2000017,'Postpaid','966500000117','1:08 PM','08-Sep-2026','ZN_fixture0017',405,'Cash','Invoice Payment','',''],
  ['Employee.Four','Employee.Four','Manager.One','WFW430','Contact.One','Mecca','Western Region','','Partner X',2000010,'Postpaid','966500000110','1:58 PM','08-Sep-2026','ZN_fixture0018',30,'Cash','Invoice Payment','',''],
  ['Employee.Three','Employee.Three','','WFW430','Contact.One','Mecca','Western Region','','Partner X',2000019,'Postpaid','966500000119','3:51 PM','08-Sep-2026','ZN_fixture0019',220,'SPAN Offline','Invoice Payment','',''],
  ['Employee.Three','Employee.Three','','WFW430','Contact.One','Mecca','Western Region','','Partner X',2000020,'Postpaid','966500000120','5:16 PM','08-Sep-2026','ZN_fixture0020','171.35','Cash','Invoice Payment','',''],
  ['Employee.Two','Employee.Two','Manager.One','WFW430','Contact.One','Mecca','Western Region','','Partner X',2000008,'Postpaid','966500000108','6:43 PM','08-Sep-2026','ZN_fixture0021','171.35','SPAN Offline','Invoice Payment','',''],
  ['Employee.One','Employee.One','Manager.One','WFW430','Contact.One','Mecca','Western Region','','Partner X',2000022,'Postpaid','966500000122','8:11 PM','08-Sep-2026','ZN_fixture0022',200,'Cash','Invoice Payment','',''],
  ['Employee.Three','Employee.Three','','WFW430','Contact.One','Mecca','Western Region','','Partner X',2000023,'Postpaid','966500000123','9:11 PM','08-Sep-2026','ZN_fixture0023',200,'Cash','Invoice Payment','',''],
  ['Employee.Three','Employee.Three','','WFW430','Contact.One','Mecca','Western Region','','Partner X',2000024,'Postpaid','966500000124','9:27 AM','08-Sep-2026','ZN_fixture0024','171.35','SPAN Offline','Invoice Payment','','']
];

function pad23(row){
  const out=row.slice(0,20);
  while(out.length<20)out.push('');
  // append D2D User Name, D2D User Partner Name, External payment transaction ID (unused, blank)
  return [...out,'','',''];
}

function buildRealMatrix(){
  const matrix=[];
  matrix.push(['Finance CACO report (detailed)','','','','','','','']); // row1
  matrix.push(['']); // row2 blank
  matrix.push(['Specified Report Parameters','']); // row3
  matrix.push(['Parameter','Value']); // row4
  matrix.push(['Transaction Date & Time From','2026-09-08 00:00']); // row5
  matrix.push(['Transaction Date & Time To','2026-09-08 23:59']); // row6
  matrix.push(['Shop ID','WFW430']); // row7
  matrix.push(['User ID','All']); // row8
  matrix.push(['Payment Method','Cash']); // row9
  matrix.push([null,'SPAN Offline']); // row10
  matrix.push(['Report Results','25 rows total']); // row11
  matrix.push(HEADER.slice()); // row12 - real header
  TX_ROWS.forEach(row=>matrix.push(pad23(row))); // rows13-36
  const totalRow=new Array(23).fill(null);
  totalRow[0]='Total amount:';
  totalRow[1]=2699.59;
  matrix.push(totalRow); // row37
  const footerRow=new Array(23).fill(null);
  footerRow[0]='25 rows are displayed';
  matrix.push(footerRow); // row38
  matrix.push(['']); // row39 blank
  matrix.push(['']); // row40 blank
  const strayRow=new Array(23).fill(null);
  strayRow[15]=882.95; // bare amount at the Amount-column position, nothing else identifying
  matrix.push(strayRow); // row41
  return matrix;
}

module.exports={HEADER,TX_ROWS,buildRealMatrix};
