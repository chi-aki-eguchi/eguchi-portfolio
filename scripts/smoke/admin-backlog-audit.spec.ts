import { test, expect } from "./fixtures.ts";
import { ADMIN_TABS, gotoAdminTab, loginAsAdmin, chooseSettingsSection } from './helpers';
import { mkdirSync, writeFileSync } from 'node:fs';

test('backlog: visible controls have accessible labels', async ({ page }, info) => {
 test.setTimeout(120_000);
 await loginAsAdmin(page);
 const reports: {tab:string;controls:{name:string|null|undefined;[key:string]:unknown}[]}[]=[];
 for (const tab of ADMIN_TABS) {
  await gotoAdminTab(page,tab);
  if(tab==='settings')await chooseSettingsSection(page,'presets');
  reports.push({tab,controls:await page.locator('.admin-atelier').evaluate(root=>Array.from(root.querySelectorAll('button,input,select,textarea')).flatMap(el=>{
   const r=el.getBoundingClientRect();if(!r.width||!r.height||getComputedStyle(el).visibility==='hidden')return [];
   const input=el as HTMLInputElement;
   const name=el.getAttribute('aria-label')||el.getAttribute('title')||(el.getAttribute('aria-labelledby')||'').split(' ').map(id=>document.getElementById(id)?.textContent||'').join('').trim()||(input.labels?Array.from(input.labels).map(l=>l.textContent).join('').trim():'')||(el.tagName==='BUTTON'?el.textContent?.trim():'');
   return !name||r.width<24||r.height<24?[{tag:el.tagName,type:input.type,name,html:el.outerHTML.slice(0,450),w:r.width,h:r.height}]:[];
  }))});
 }
 mkdirSync('scratch/backlog-audit',{recursive:true});
 writeFileSync(`scratch/backlog-audit/${info.project.name}.json`,JSON.stringify(reports,null,2));
 expect(reports.flatMap(report=>report.controls.filter(control=>!control.name).map(control=>({tab:report.tab,...control})))).toEqual([]);
});
