export const xml = v => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
// RFC-style quoted fields; reject malformed rows instead of silently dropping data.
export function parseCSV(text) {
 if(new TextEncoder().encode(text).length>1000000)throw Error('1MB以内のCSVを使ってください。');
 const rows=[];let row=[],field='',quoted=false,closed=false; text=text.replace(/^\uFEFF/,'');
 for(let i=0;i<text.length;i++) { const c=text[i];
  if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;continue;}
  if(c==='"'){if(field||closed)throw Error('引用符の位置を確認してください。');quoted=true;continue;}
  if(c===','||c==='\r'||c==='\n'){row.push(field);field='';closed=false;if(c!==','){if(c==='\r'&&text[i+1]==='\n')i++;rows.push(row);row=[];}continue;}
  if(closed)throw Error('閉じた引用符の後には区切りを入れてください。');field+=c;
 }
 if(quoted)throw Error('閉じていない引用符があります。');
 if(field||row.length||closed) {row.push(field);rows.push(row);}
 while(rows.length&&rows.at(-1).every(x=>x===''))rows.pop();
 if(rows.length<2)throw Error('先頭の列名と、1件以上のデータが必要です。');
 if(rows.length>201)throw Error('無料見本は200件までです。');
 const header=rows[0].map(x=>x.trim());if(header.some(x=>!x)||new Set(header).size!==header.length)throw Error('列名は空欄や重複をなくしてください。');
 if(header.length>30)throw Error('30列以内でお試しください。');
 for(let i=1;i<rows.length;i++)if(rows[i].length!==header.length)throw Error(`${i+1}行目の列数が列名と一致しません。`);
 return {header,rows:rows.slice(1)};
}
export function normalizeProducts(data,map) {
 const errors=[],seen=new Set(),changes=[];
 const required=['sku','name','price'];if(required.some(k=>!Number.isInteger(map[k])||map[k]<0||map[k]>=data.header.length))throw Error('商品コード・商品名・価格の列を指定してください。');
 const ids=Object.values(map).filter(x=>Number.isInteger(x)&&x>=0);if(new Set(ids).size!==ids.length)throw Error('同じ列を複数の項目に指定できません。');
 const rows=data.rows.map((row,i)=>{
  const sku=row[map.sku].trim(),name=row[map.name].trim(),raw=row[map.price].trim();
  const normalized=raw.normalize('NFKC').replace(/^[¥￥]\s*/,'').replace(/円$/,'').trim();
  const valid=/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(normalized);
  const price=valid?Number(normalized.replaceAll(',','')):NaN;
  const url=map.url>=0?row[map.url].trim():'';
  if(!sku)errors.push(`${i+2}行目：商品コードが空欄`);else if(seen.has(sku))errors.push(`${i+2}行目：商品コード「${sku}」が重複`);seen.add(sku);
  if(!name)errors.push(`${i+2}行目：商品名が空欄`);
  if(!valid||!Number.isSafeInteger(price))errors.push(`${i+2}行目：価格を0以上の整数で確認`);
  if(url){try{const u=new URL(url);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw Error();}catch{errors.push(`${i+2}行目：商品URLは認証情報のないhttp(s)で指定`);}}
  if(valid&&raw!==String(price))changes.push(`${i+2}行目：価格 ${raw} → ${price}`);
  return [sku,name,valid?String(price):raw,url];
 });
 return {rows,errors,changes};
}
export function toCSV(rows){let guarded=0;const text=rows.map(row=>row.map(value=>{let s=String(value);if(/^[\s]*[=+\-@]|^[\t\r\n]/.test(s)){s="'"+s;guarded++;}return '"'+s.replaceAll('"','""')+'"';}).join(',')).join('\r\n');return {text:'\uFEFF'+text+'\r\n',guarded};}
const text=(x,y,t,size,more='')=>`<text x="${x}" y="${y}" font-size="${size}" ${more}>${xml(t)}</text>`;
const line=(y,color='#cec8b9')=>`<path d="M110 ${y}H1090" stroke="${color}"/>`;
const font='font-family="Arial, Hiragino Kaku Gothic ProN, Yu Gothic, sans-serif"';
export function wrapText(value,maxUnits,maxLines){const lines=[];for(const original of String(value).split('\n')){let s='',n=0;for(const c of original){const w=/[\u0020-\u007e]/.test(c)?0.6:1;if(n+w>maxUnits){lines.push(s);s='';n=0;}s+=c;n+=w;}lines.push(s);}if(lines.length>maxLines)throw Error(`文字を短くしてください（最大${maxLines}行）。`);return lines;}
export function menuSVG({brand,subtitle,items,note,theme}) {
 if(!brand.trim())throw Error('お店の名前を入れてください。');
 const entries=items.trim().split('\n').filter(x=>x.trim()).map(row=>row.split('|').map(x=>x.trim()));
 if(!entries.length||entries.length>10||entries.some(x=>x.length!==2||!x[0]||!x[1]||[...x[0]].length>20||[...x[1]].length>12))throw Error('1〜10品を「品名 | 価格」で入力してください。品名20文字・価格12文字まで。');
 const dark=theme==='ink',bg=dark?'#173d36':'#f5f0e5',fg=dark?'#f5f0e5':'#173d36',sub=dark?'#b6cec3':'#66746b';
 const title=wrapText(brand,18,2),subLines=wrapText(subtitle,28,2),notes=wrapText(note,36,3);
 const top=420,gap=Math.min(106,900/entries.length);
 return `<svg xmlns="http://www.w3.org/2000/svg" width="2480" height="3508" viewBox="0 0 1200 1697" ${font} fill="${fg}"><rect width="1200" height="1697" fill="${bg}"/><path d="M110 110h66v66" fill="none" stroke="${fg}" stroke-width="3"/>${text(1090,130,'MENU / 01',22,'text-anchor="end" letter-spacing="3"')}${title.map((t,i)=>text(110,235+i*65,t,54,'font-weight="600"')).join('')}${subLines.map((t,i)=>text(112,345+i*30,t,22,`fill="${sub}"`)).join('')}${line(397,sub)}${entries.map(([n,p],i)=>text(110,top+70+i*gap,n,30)+text(1090,top+70+i*gap,p,29,'text-anchor="end"')+line(top+100+i*gap,dark?'#44665c':'#d7d3c8')).join('')}${notes.map((t,i)=>text(110,1495+i*32,t,23,`fill="${sub}"`)).join('')}${text(110,1600,'ごゆっくり、お楽しみください。',21)}<circle cx="1080" cy="1590" r="12" fill="${fg}"/></svg>`;
}
export function bannerSVG({brand,title,detail,date,theme},format='square'){
 const wide=format==='wide',w=wide?1200:1080,h=wide?628:1080;
 if(!title.trim())throw Error('見出しを入れてください。');
 const light=theme==='paper',bg=light?'#f4eddd':'#1e4239',fg=light?'#293f32':'#f4eddd',accent=light?'#b44b34':'#d1dd96';
 const lines=wrapText(title,wide?12:11,3),description=wrapText(detail,wide?22:20,2),dateLines=wrapText(date,wide?32:25,2);
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" ${font} fill="${fg}"><rect width="${w}" height="${h}" fill="${bg}"/><path d="M${w-320} 0v${h}m80-${h}v${h}m80-${h}v${h}m80-${h}v${h}" stroke="${accent}" opacity=".18" stroke-width="1"/><circle cx="${w-118}" cy="${wide?180:220}" r="${wide?92:130}" fill="none" stroke="${accent}" stroke-width="2"/><path d="M${w-230} ${wide?210:250}h${wide?200:245}" stroke="${accent}" stroke-width="2"/>${text(65,76,brand,21,'letter-spacing="2"')}${lines.map((t,i)=>text(60,(wide?195:300)+i*(wide?72:102),t,wide?62:86,'font-weight="600"')).join('')}${description.map((t,i)=>text(65,(wide?440:740)+i*32,t,25)).join('')}<path d="M65 ${h-125}H${w-65}" stroke="${fg}" opacity=".5"/>${dateLines.map((t,i)=>text(65,h-78+i*28,t,22)).join('')}${text(w-66,h-45,'↗',34,'text-anchor="end"')}</svg>`;
}
