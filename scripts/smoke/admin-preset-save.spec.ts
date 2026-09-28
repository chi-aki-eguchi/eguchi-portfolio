import { test, expect } from "./fixtures.ts";
import {loginAsAdmin,gotoAdminTab,chooseSettingsSection} from './helpers';

test('capture presets: pending save locks keyboard and waits for refreshed list',async({page})=>{
 const settings:Record<string,string>={setupCompleted:'true',metaPresetsCamera:'["Existing camera"]',metaPresetsLens:'[]'};
 let writes=0;let releaseSave!:()=>void;let releaseRead!:()=>void;let holdRead=false;
 const saved=new Promise<void>(resolve=>{releaseSave=resolve;});
 const refreshed=new Promise<void>(resolve=>{releaseRead=resolve;});
 await page.route('**/api/settings',async route=>{
  if(holdRead)await refreshed;
  await route.fulfill({json:settings});
 });
 await page.route('**/api/admin/settings',async route=>{
  writes++;await saved;Object.assign(settings,route.request().postDataJSON());holdRead=true;
  await route.fulfill({json:{ok:true}});
 });
 await loginAsAdmin(page);await gotoAdminTab(page,'settings');await chooseSettingsSection(page,'presets');
 const entry=page.locator('input[placeholder="例: Hasselblad 500C/M"]');
 try{
  await entry.fill('Camera A');await entry.press('Enter');
  await expect.poll(()=>writes).toBe(1);
  await expect(entry).toBeDisabled({timeout:1000});
  releaseSave();await expect.poll(()=>holdRead).toBe(true);
  await expect(entry).toBeDisabled();
  releaseRead();await expect(entry).toBeEnabled();await expect(entry).toHaveValue('');
  await expect(page.getByRole('button',{name:'Camera A を削除',exact:true})).toBeVisible();
  await entry.fill('Camera B');await entry.press('Enter');
  await expect.poll(()=>writes).toBe(2);
  await expect.poll(()=>JSON.parse(settings.metaPresetsCamera)).toEqual(['Existing camera','Camera A','Camera B']);
 }finally{releaseSave();releaseRead();}
});

test('capture presets: failed save keeps the draft for retry',async({page})=>{
 const settings:Record<string,string>={setupCompleted:'true',metaPresetsCamera:'[]',metaPresetsLens:'[]'};
 let fail=true;let writes=0;
 await page.route('**/api/settings',route=>route.fulfill({json:settings}));
 await page.route('**/api/admin/settings',async route=>{
  writes++;
  if(fail){await route.fulfill({status:500,json:{error:'Artificial failure'}});return;}
  Object.assign(settings,route.request().postDataJSON());await route.fulfill({json:{ok:true}});
 });
 await loginAsAdmin(page);await gotoAdminTab(page,'settings');await chooseSettingsSection(page,'presets');
 const entry=page.locator('input[placeholder="例: Hasselblad 500C/M"]');
 await entry.fill('Retry camera');await entry.press('Enter');
 await expect(page.getByRole('alert')).toBeVisible();await expect(entry).toBeEnabled();
 await expect(entry).toHaveValue('Retry camera');
 fail=false;await entry.press('Enter');
 await expect(page.getByRole('button',{name:'Retry camera を削除',exact:true})).toBeVisible();
 await expect(entry).toHaveValue('');expect(writes).toBe(2);
});

test('capture preset and preview controls have distinct usable hit areas',async({page},info)=>{
 await loginAsAdmin(page);await gotoAdminTab(page,'settings');await chooseSettingsSection(page,'presets');
 const touch=info.project.use.hasTouch;const minimum=touch?40:32;
 for(const selector of ['.admin-preset-remove','.studio-preview-status button','.studio-preview-status select']){
  const controls=page.locator(selector);if(selector.includes('preset'))expect(await controls.count()).toBeGreaterThan(0);
  for(const control of await controls.all()){
   if(!await control.isVisible())continue;
   const box=await control.boundingBox();expect(box).not.toBeNull();expect(box!.width,selector).toBeGreaterThanOrEqual(minimum);expect(box!.height,selector).toBeGreaterThanOrEqual(minimum);
  }
 }
 await page.screenshot({path:`scratch/backlog-audit/settings-${info.project.name}.png`,fullPage:true});
});
