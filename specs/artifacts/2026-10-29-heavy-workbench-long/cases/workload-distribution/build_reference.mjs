// Complete author reference, not candidate code or an official GDPval answer.
import fs from 'node:fs/promises';
import path from 'node:path';
import { FileBlob, SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const [factsPath, outputDir, variant = 'reference'] = process.argv.slice(2);
const source = JSON.parse(await fs.readFile(factsPath, 'utf8'));
await fs.mkdir(outputDir, { recursive: true });
const raw = variant === 'drop-unregistered'
  ? source.raw.filter(r => source.registry.some(p => p[0] === r[1])) : source.raw;
const wb = Workbook.create();
for (const name of ['Departments', 'People', 'Projects', 'Stakeholder Registry', 'Inputs', 'Raw']) wb.worksheets.add(name);
const sheet = n => wb.worksheets.getItem(n);
const put = (n, at, data) => sheet(n).getRange(at).write(data);
const formula = (n, at, f) => sheet(n).getRange(at).formulas = [[f]];
function table(name, title, headers, values) {
  put(name, 'A2', [[title]]);
  put(name, 'A5', [headers, ...values]);
  const last = String.fromCharCode(64 + headers.length);
  const range = sheet(name).getRange(`A1:${last}${Math.max(6 + values.length, 12)}`);
  range.format.font.name = 'Arial'; range.format.font.size = 10;
  range.format.rowHeight = 21; range.format.columnWidth = 15;
  sheet(name).getRange(`A5:${last}5`).format.fill = '#334155';
  sheet(name).getRange(`A5:${last}5`).format.font.color = '#FFFFFF';
  sheet(name).getRange(`A5:${last}5`).format.font.bold = true;
  sheet(name).getRange(`A5:${last}5`).format.rowHeight = 30;
  sheet(name).getRange('A2').format.font.size = 14;
  sheet(name).getRange('A:A').format.columnWidth = 29;
  sheet(name).showGridLines = false;
  sheet(name).freezePanes.freezeRows(5);
}
table('Inputs', 'March capacity and budget inputs', ['input', 'value'], [
  ['working_days', 21], ['project_capacity_share', .85], ['individual_under', .6],
  ['individual_over', .9], ['department_under', .95], ['department_over', 1.05],
  ['FT_hours_per_day', 8], ['PT_hours_per_day', 4],
]);
// Inputs begin at row6. Use a single driver for each quantity.
put('Inputs', 'A17', [['project', 'budget_h'], ...source.budgets]);
sheet('Inputs').getRange('A:A').format.columnWidth = 53;
sheet('Inputs').getRange('B6:B13').format.fill = '#FFF2CC';
put('Inputs', 'A29', [['Source: original personnel registry, four weekly timekeeping sheets and March budget.'],
 ['Calendar: 21 weekdays; no March31 activity is supplied. Recorded ratios are not final actual month utilization.'],
 ['Mapping: Wrike Transition Intiative → Wrike Transition Initiative. Admin is excluded from individual project hours.'],
 ['Unregistered employee: retain all hours; obtain department and employment type before estimating capacity.']]);

table('Stakeholder Registry', 'Registered employee capacity',
 ['person', 'role', 'department', 'employment', 'nominal_h'], source.registry.map(r => [...r, null]));
for (let i = 0; i < source.registry.length; i++) {
  const row = i + 6;
  formula('Stakeholder Registry', `E${row}`, `=IF(D${row}="FT",Inputs!$B$6*Inputs!$B$12,Inputs!$B$6*Inputs!$B$13)`);
}
sheet('Stakeholder Registry').getRange('B:C').format.columnWidth = 30;
table('Raw', 'Supplied March booking records', ['week', 'person', 'source_project', 'project', 'hours'], raw);
sheet('Raw').getRange('B:B').format.columnWidth = 23;
sheet('Raw').getRange('C:D').format.columnWidth = 51;

const names = [...source.registry.map(r => r[0]), ...new Set(source.raw.filter(r => !source.registry.some(p => p[0] === r[1])).map(r => r[1]))];
table('People', 'Recorded project allocation',
 ['person', 'department', 'employment', 'nominal_h', 'project_capacity_h', 'project_h', 'admin_h', 'total_h', 'allocation', 'status'],
 names.map(n => [n, null, null, null, null, null, null, null, null, null]));
const end = raw.length + 5, personEnd = names.length + 5;
for (let i = 0; i < names.length; i++) {
  const row = i + 6, known = i < source.registry.length;
  if (known) {
    for (const [dest, src] of [['B', 'C'], ['C', 'D'], ['D', 'E']])
      formula('People', `${dest}${row}`, `='Stakeholder Registry'!${src}${row}`);
    formula('People', `E${row}`, `=D${row}*Inputs!$B$7`);
    formula('People', `I${row}`, `=F${row}/E${row}`);
    formula('People', `J${row}`, `=IF(I${row}<Inputs!$B$8,"under",IF(I${row}>Inputs!$B$9,"over","within"))`);
  } else {
    put('People', `B${row}`, [['unknown', 'unknown', null, null]]);
    put('People', `J${row}`, [['unknown']]);
  }
  formula('People', `G${row}`, `=SUMIFS(Raw!$E$6:$E$${end},Raw!$B$6:$B$${end},A${row},Raw!$D$6:$D$${end},"Admin")`);
  formula('People', `H${row}`, `=SUMIF(Raw!$B$6:$B$${end},A${row},Raw!$E$6:$E$${end})`);
  formula('People', `F${row}`, `=H${row}-G${row}`);
}
sheet('People').getRange('B:B').format.columnWidth = 26;
sheet('People').getRange('E:E').format.columnWidth = 22;
sheet('People').getRange(`D6:H${personEnd}`).setNumberFormat('0.0');
sheet('People').getRange(`I6:I${personEnd}`).setNumberFormat('0.0%');
put('People', 'A33', [['Registered hours'], ['Unassigned hours'], ['All recorded hours']]);
formula('People', 'H33', `=SUMIF(B6:B${personEnd},"<>unknown",H6:H${personEnd})`);
formula('People', 'H34', `=SUMIF(B6:B${personEnd},"unknown",H6:H${personEnd})`);
formula('People', 'H35', `=SUM(H6:H${personEnd})`);

const deps = [...new Set(source.registry.map(r => r[2]))];
table('Departments', 'Recorded utilization of registered staff', ['department', 'nominal_h', 'total_h', 'utilization', 'status'], deps.map(n => [n, null, null, null, null]));
for (let i = 0; i < deps.length; i++) {
  const row = i + 6;
  formula('Departments', `B${row}`, `=SUMIF(People!$B$6:$B$${personEnd},A${row},People!$D$6:$D$${personEnd})`);
  formula('Departments', `C${row}`, `=SUMIF(People!$B$6:$B$${personEnd},A${row},People!$H$6:$H$${personEnd})`);
  formula('Departments', `D${row}`, `=C${row}/B${row}`);
  formula('Departments', `E${row}`, `=IF(D${row}<Inputs!$B$10,"under",IF(D${row}>Inputs!$B$11,"over","within"))`);
}
sheet('Departments').getRange('D6:D10').setNumberFormat('0.0%');
formula('Departments', 'A13', '="Unassigned recorded hours: "&People!H34&". Obtain the missing HR record before assigning capacity."');
put('Departments', 'A14', [['Department flags above cover registered staff only.'],
 ['Missing March31 activity limits final month conclusions.']]);

table('Projects', 'Recorded project budget comparison', ['project', 'budget_h', 'actual_h', 'excess_h', 'status'], source.budgets.map(r => [r[0], null, null, null, null]));
sheet('Projects').getRange('A:A').format.columnWidth = 51;
for (let i = 0; i < source.budgets.length; i++) {
  const row = i + 6;
  formula('Projects', `B${row}`, `=Inputs!B${i + 18}`);
  formula('Projects', `C${row}`, `=SUMIF(Raw!$D$6:$D$${end},A${row},Raw!$E$6:$E$${end})`);
  formula('Projects', `D${row}`, `=C${row}-B${row}`);
  formula('Projects', `E${row}`, `=IF(D${row}>0,"over","within")`);
}
for (const name of ['People', 'Departments', 'Projects']) {
  const col = name === 'People' ? 'J' : 'E';
  sheet(name).getRange(`${col}6:${col}${name === 'People' ? personEnd : name === 'Departments' ? 10 : 14}`)
    .conditionalFormats.add('containsText', { text: 'over', format: { fill: '#FCE4D6' } });
}
wb.recalculate();
const output = await SpreadsheetFile.exportXlsx(wb);
const target = path.join(outputDir, 'tracker.xlsx'); await output.save(target);
// Refresh check on a disposable import, with original output untouched.
const imported = await SpreadsheetFile.importXlsx(await FileBlob.load(target));
const p = imported.worksheets.getItem('People');
const before = p.getRange('F6').values[0][0];
const beforeDepartment = imported.worksheets.getItem('Departments').getRange('C6').values[0][0];
const beforeProject = imported.worksheets.getItem('Projects').getRange('C6').values[0][0];
const input = imported.worksheets.getItem('Raw').getRange('E6');
input.values = [[input.values[0][0] + 1]]; imported.recalculate();
const after = p.getRange('F6').values[0][0];
const refresh = { input: 'Raw!E6 +1 project hour', before, after, delta: after - before,
 department_delta: imported.worksheets.getItem('Departments').getRange('C6').values[0][0] - beforeDepartment,
 project_delta: imported.worksheets.getItem('Projects').getRange('C6').values[0][0] - beforeProject };
imported.worksheets.getItem('Inputs').getRange('B6').values = [[20]]; imported.recalculate();
refresh.capacity_change = { working_days: 20, person_nominal_h: p.getRange('D6').values[0][0],
 department_nominal_h: imported.worksheets.getItem('Departments').getRange('B6').values[0][0] };
await fs.writeFile(path.join(outputDir, 'refresh.json'), JSON.stringify(refresh, null, 2));
if (refresh.delta !== 1 || refresh.department_delta !== 1 || refresh.project_delta !== 1
 || refresh.capacity_change.person_nominal_h !== 160 || refresh.capacity_change.department_nominal_h !== 640)
 throw new Error('REFRESH_CONTRACT_MISMATCH');
// Original, unmodified workbook views.
for (const [name, range] of (variant === 'reference' ? [['Departments','A1:E16'],['People','A1:J35'],['Projects','A1:E15'],['Stakeholder Registry','A1:E29'],['Inputs','A1:D33'],['Raw','A1:E14']] : [])) {
  const preview = await wb.render({ sheetName: name, range, scale: 1.4, format: 'png' });
  await fs.writeFile(path.join(outputDir, `${name.replaceAll(' ', '-')}.png`), new Uint8Array(await preview.arrayBuffer()));
}
console.log(JSON.stringify({ target, variant, refresh }));
