const savedClients = JSON.parse(localStorage.getItem('airheat_clients') || 'null');
const savedTheme = localStorage.getItem('airheat_theme') || 'light';

const EQUIPMENT_PRESETS = [
  'BAXI Luna Platinum', 'BAXI Luna Duo-tec', 'BAXI Duo-tec Compact', 'BAXI Nuvola Platinum',
  'Viessmann Vitodens 050-W', 'Viessmann Vitodens 100-W', 'Wolf CGW-2',
  'Samsung EHS', 'Midea M-Thermal', 'Midea Versati IV', 'CTC EcoAir', 'Kita įranga'
];

const state = {
  view: 'dashboard', query: '', serviceFilter: 'all', selectedClientId: null, theme: savedTheme,
  clients: savedClients || [{
    id: crypto.randomUUID(), type: 'Fizinis asmuo', name: 'Jonas Jonaitis', phone: '+370 600 00000',
    email: 'jonas@example.lt', city: 'Vilnius', address: 'Pavyzdžio g. 1, Vilnius', latitude: 54.6872,
    longitude: 25.2797, notes: 'Pavyzdinis klientas', createdAt: '2026-07-01', commissioningDate: '2026-07-01',
    warrantyYears: 5, equipmentName: 'BAXI Luna Platinum',
    services: [{ id: crypto.randomUUID(), date: '2026-07-01', equipmentName: 'BAXI Luna Platinum', serviceKind: 'Paleidimas', status: 'completed', notes: 'Pirmas paleidimas' }],
    properties: [{ id: crypto.randomUUID(), name: 'Namas', address: 'Pavyzdžio g. 1, Vilnius', latitude: 54.6872, longitude: 25.2797,
      equipment: [{ id: crypto.randomUUID(), type: 'Dujinis katilas', manufacturer: 'BAXI', model: 'Luna Platinum', serialNumber: 'DEMO-001', installedAt: '2026-07-01', warrantyUntil: '2031-07-01' }] }]
  }]
};

function today() { return new Date().toISOString().slice(0, 10); }
function save() { localStorage.setItem('airheat_clients', JSON.stringify(state.clients)); }
function migrate() {
  state.clients.forEach(c => {
    c.createdAt ||= today(); c.services ||= []; c.properties ||= []; c.address ||= c.properties[0]?.address || '';
    c.commissioningDate ||= c.createdAt; c.warrantyYears = Number(c.warrantyYears || 5);
    c.equipmentName ||= firstEquipmentName(c) || '';
    c.services.forEach(s => { s.equipmentName ||= c.equipmentName || firstEquipmentName(c) || s.type || 'Įranga'; s.serviceKind ||= s.type || 'Metinis aptarnavimas'; });
  });
  save();
}
function firstEquipmentName(c) {
  const e = (c.properties || []).flatMap(p => p.equipment || [])[0];
  return e ? `${e.manufacturer || ''} ${e.model || ''}`.trim() : '';
}
function applyTheme() { document.documentElement.dataset.theme = state.theme; localStorage.setItem('airheat_theme', state.theme); }
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v]) => { if (k === 'class') node.className = v; else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v); else if (v !== null && v !== undefined) node.setAttribute(k,v); });
  (Array.isArray(children) ? children : [children]).forEach(ch => { if (ch !== null && ch !== undefined) node.append(ch.nodeType ? ch : document.createTextNode(String(ch))); });
  return node;
}
function nav(label, view, icon) { return el('button', { class: state.view === view ? 'active' : '', onclick: () => { state.view=view; state.selectedClientId=null; render(); } }, `${icon} ${label}`); }
function shell(content) {
  const app=document.getElementById('app'); app.innerHTML='';
  app.append(el('div',{class:'app-shell'},[
    el('aside',{class:'sidebar'},[
      el('div',{class:'brand'},[el('div',{class:'brand-mark'},'A'),el('div',{},[el('div',{class:'brand-title'},'AIRHEAT'),el('div',{class:'brand-sub'},'ŠVOK valdymo sistema')])]),
      el('nav',{class:'nav'},[nav('Pagrindinis','dashboard','🏠'),nav('Klientai','clients','👥'),nav('Aptarnavimai','services','📅'),nav('Objektai','properties','🏡'),nav('Įranga','equipment','🔧')])
    ]),
    el('main',{class:'main'},content),
    el('nav',{class:'mobile-nav'},[nav('Pradžia','dashboard','🏠'),nav('Klientai','clients','👥'),nav('Aptarn.','services','📅'),nav('Objektai','properties','🏡'),nav('Įranga','equipment','🔧')])
  ]));
}
const header=(title,subtitle,actions=[])=>el('div',{class:'topbar'},[el('div',{},[el('h1',{},title),el('p',{},subtitle)]),el('div',{class:'actions'},[...actions,el('button',{class:'btn',onclick:toggleTheme},state.theme==='light'?'🌙 Tamsi':'☀️ Šviesi')])]);
const stat=(label,value,color='')=>el('div',{class:'card'},[el('div',{class:'muted'},label),el('div',{class:`stat-value ${color}`},value)]);
function toggleTheme(){state.theme=state.theme==='light'?'dark':'light';applyTheme();render();}
function allServices(){return state.clients.flatMap(client=>(client.services||[]).map(service=>({client,service})));}
function latestCompleted(c){return (c.services||[]).filter(s=>s.status==='completed'&&s.serviceKind!=='Paleidimas').sort((a,b)=>b.date.localeCompare(a.date))[0];}
function nextPlanned(c){return (c.services||[]).filter(s=>s.status!=='completed'&&s.date>=today()).sort((a,b)=>a.date.localeCompare(b.date))[0];}
function yearsBetween(start, years){const d=new Date(start+'T12:00:00');d.setFullYear(d.getFullYear()+years);return d.toISOString().slice(0,10);}
function serviceYearStatus(c, yearNo) {
  const start=c.commissioningDate||c.createdAt; if(!start) return 'unknown';
  const periodStart=yearsBetween(start,yearNo-1), periodEnd=yearsBetween(start,yearNo);
  const done=(c.services||[]).some(s=>s.status==='completed'&&s.serviceKind!=='Paleidimas'&&s.date>=periodStart&&s.date<periodEnd);
  if(done) return 'done'; if(today()>=periodEnd) return 'missed'; if(today()>=periodStart) return 'due'; return 'future';
}
function warrantyDots(c, compact=false) {
  const years=Math.max(1,Math.min(10,Number(c.warrantyYears||5)));
  return el('div',{class:`warranty-dots ${compact?'compact':''}`},Array.from({length:years},(_,i)=>{
    const n=i+1,status=serviceYearStatus(c,n),start=c.commissioningDate||c.createdAt;
    const label=`${n} m. · ${yearsBetween(start,n-1)}–${yearsBetween(start,n)} · ${status==='done'?'aptarnavimas atliktas':status==='missed'?'aptarnavimas neatliktas':status==='due'?'aptarnavimas laukia':'dar neatėjo laikas'}`;
    return el('span',{class:`year-dot ${status}`,title:label},String(n));
  }));
}
function dashboard(){
  const props=state.clients.flatMap(c=>c.properties||[]),eq=props.flatMap(p=>p.equipment||[]),due=allServices().filter(x=>x.service.status!=='completed').length;
  return [header('Labas, Dariau 👋','AirHeat v0.3 – pilna aptarnavimų kontrolė',[el('button',{class:'btn btn-primary',onclick:openClient},'➕ Naujas klientas')]),
    el('div',{class:'grid cols4'},[stat('Klientai',state.clients.length,'blue'),stat('Objektai',props.length,'orange'),stat('Įrenginiai',eq.length,'green'),stat('Laukia aptarnavimo',due,'red')]),
    el('div',{class:'card',style:'margin-top:16px'},[el('h3',{},'Aptarnavimų modulis'),el('div',{class:'muted'},'Geolokacija, Google Maps / Waze, įrangos pavadinimas ir visa garantinio laikotarpio metinių aptarnavimų istorija.'),el('div',{class:'actions',style:'margin-top:12px'},[el('button',{class:'btn btn-primary',onclick:()=>{state.view='services';render();}},'📅 Atidaryti aptarnavimus')])])];
}
function matches(c,q){return [c.name,c.phone,c.email,c.city,c.address,c.notes,c.equipmentName,...(c.properties||[]).flatMap(p=>[p.name,p.address,...(p.equipment||[]).flatMap(e=>[e.type,e.manufacturer,e.model,e.serialNumber])])].join(' ').toLowerCase().includes(q.toLowerCase());}
function clients(){if(state.selectedClientId)return clientDetail();const visible=state.clients.filter(c=>matches(c,state.query)).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));return [header('Klientai','Visi klientai ir jų garantinio aptarnavimo istorija',[el('button',{class:'btn btn-primary',onclick:openClient},'➕ Naujas klientas')]),el('div',{class:'toolbar'},[el('input',{class:'search',placeholder:'Ieškoti pagal klientą, adresą ar įrangą...',value:state.query,oninput:e=>{state.query=e.target.value;render();}})]),visible.length?el('div',{class:'list'},visible.map(clientRow)):el('div',{class:'empty'},'Klientų nerasta.')];}
function clientRow(c){const last=latestCompleted(c),next=nextPlanned(c);return el('div',{class:'list-item client-service-card'},[
  el('div',{onclick:()=>{state.selectedClientId=c.id;render();}},[el('div',{class:'list-title'},c.name),el('div',{class:'list-meta'},`${c.phone||'Nėra telefono'} · ${c.address||c.city||'Adresas nenurodytas'}`),el('div',{class:'equipment-name'},`🔥 ${c.equipmentName||firstEquipmentName(c)||'Įranga nenurodyta'}`),warrantyDots(c,true),el('div',{class:'tags'},[last?el('span',{class:'tag tag-done'},`Paskutinis: ${last.date}`):el('span',{class:'tag tag-alert'},'Dar neaptarnauta'),next?el('span',{class:'tag tag-next'},`Suplanuota: ${next.date}`):null])]),
  el('div',{class:'actions'},[c.phone?el('a',{class:'btn',href:`tel:${c.phone}`},'📞'):null,mapButton(c,'Google'),mapButton(c,'Waze'),el('button',{class:'btn',onclick:()=>openService(c.id)},'➕ Aptarnavimas'),el('button',{class:'btn',onclick:()=>{state.selectedClientId=c.id;render();}},'Atidaryti')])
]);}
function mapUrl(c, provider){const has=Number.isFinite(Number(c.latitude))&&Number.isFinite(Number(c.longitude));const target=has?`${c.latitude},${c.longitude}`:encodeURIComponent(c.address||c.city||'');return provider==='Waze'?`https://waze.com/ul?q=${target}&navigate=yes`:`https://www.google.com/maps/dir/?api=1&destination=${target}`;}
function mapButton(c,provider){if(!c.address&&!c.latitude)return null;return el('a',{class:'btn map-mini',href:mapUrl(c,provider),target:'_blank',rel:'noopener'},provider==='Waze'?'Waze':'Maps');}
function servicesView(){
  let clients=[...state.clients]; if(state.serviceFilter==='pending')clients=clients.filter(c=>serviceYearStatus(c,currentWarrantyYear(c))==='due'||nextPlanned(c));if(state.serviceFilter==='overdue')clients=clients.filter(c=>Array.from({length:c.warrantyYears||5},(_,i)=>serviceYearStatus(c,i+1)).includes('missed'));if(state.serviceFilter==='completed')clients=clients.filter(c=>latestCompleted(c));
  clients.sort((a,b)=>(nextRelevantDate(a)||'9999').localeCompare(nextRelevantDate(b)||'9999'));
  return [header('Aptarnavimai','Kiekvienam klientui matomi visi garantijos metai ir aptarnavimo būsena',[el('button',{class:'btn btn-primary',onclick:openClient},'➕ Naujas klientas')]),
    el('div',{class:'legend'},[el('span',{},[el('i',{class:'legend-dot done'}),' Atlikta']),el('span',{},[el('i',{class:'legend-dot missed'}),' Neatlikta']),el('span',{},[el('i',{class:'legend-dot due'}),' Reikia atlikti']),el('span',{},[el('i',{class:'legend-dot future'}),' Ateityje'])]),
    el('div',{class:'toolbar filterbar'},[filterButton('Visi','all'),filterButton('Laukia','pending'),filterButton('Praleisti','overdue'),filterButton('Turintys istoriją','completed')]),
    clients.length?el('div',{class:'service-table wide'},[el('div',{class:'service-row service-head'},['Klientas / įranga','Adresas','Garantijos aptarnavimai','Paskutinis / kitas','Veiksmai'].map(x=>el('div',{},x))),...clients.map(serviceClientRow)]):el('div',{class:'empty'},'Pagal pasirinktą filtrą klientų nėra.')];
}
function currentWarrantyYear(c){const start=new Date((c.commissioningDate||c.createdAt)+'T12:00:00'),now=new Date();return Math.max(1,Math.min(c.warrantyYears||5,now.getFullYear()-start.getFullYear()+1));}
function nextRelevantDate(c){return nextPlanned(c)?.date||yearsBetween(c.commissioningDate||c.createdAt,currentWarrantyYear(c));}
function serviceClientRow(c){const last=latestCompleted(c),next=nextPlanned(c);return el('div',{class:'service-row'},[
  el('div',{'data-label':'Klientas / įranga'},[el('strong',{},c.name),el('small',{},c.equipmentName||firstEquipmentName(c)||'Įranga nenurodyta')]),
  el('div',{'data-label':'Adresas'},c.address||'—'),
  el('div',{'data-label':'Garantijos aptarnavimai'},warrantyDots(c)),
  el('div',{'data-label':'Paskutinis / kitas'},[el('small',{},last?`Atlikta: ${last.date}`:'Atlikta: —'),el('small',{},next?`Suplanuota: ${next.date}`:'Suplanuota: —')]),
  el('div',{class:'actions','data-label':'Veiksmai'},[el('button',{class:'btn btn-primary',onclick:()=>openService(c.id)},'➕ Aptarnavimas'),mapButton(c,'Google'),mapButton(c,'Waze'),el('button',{class:'btn',onclick:()=>{state.view='clients';state.selectedClientId=c.id;render();}},'Klientas')])
]);}
function filterButton(label,value){return el('button',{class:`btn ${state.serviceFilter===value?'selected':''}`,onclick:()=>{state.serviceFilter=value;render();}},label);}
function clientDetail(){const c=state.clients.find(x=>x.id===state.selectedClientId);return [el('button',{class:'btn',onclick:()=>{state.selectedClientId=null;render();}},'← Atgal'),el('div',{class:'card',style:'margin-top:14px'},[el('div',{class:'detail-head'},[el('div',{},[el('div',{class:'detail-title'},c.name),el('div',{class:'muted',style:'margin-top:6px'},`${c.phone||''}${c.email?' · '+c.email:''}`),el('div',{class:'muted',style:'margin-top:4px'},c.address||c.city||''),el('div',{class:'equipment-name'},`🔥 ${c.equipmentName||firstEquipmentName(c)||'Įranga nenurodyta'}`),warrantyDots(c)]),el('div',{class:'actions'},[c.phone?el('a',{class:'btn',href:`tel:${c.phone}`},'📞 Skambinti'):null,mapButton(c,'Google'),mapButton(c,'Waze'),el('button',{class:'btn btn-primary',onclick:()=>openService(c.id)},'➕ Aptarnavimas'),el('button',{class:'btn',onclick:()=>openProperty(c.id)},'➕ Objektas')])]),c.notes?el('p',{class:'muted'},c.notes):null]),
  el('h2',{class:'section-title'},'Aptarnavimo istorija'),(c.services||[]).length?el('div',{class:'list'},[...c.services].sort((a,b)=>b.date.localeCompare(a.date)).map(s=>el('div',{class:'list-item'},[el('div',{},[el('div',{class:'list-title'},`${s.date} · ${s.equipmentName||c.equipmentName}`),el('div',{class:'list-meta'},`${s.serviceKind||'Aptarnavimas'} · ${s.notes||''}`)]),el('div',{},s.status==='completed'?'✅':'⏳')]))):el('div',{class:'empty'},'Aptarnavimo įrašų dar nėra.'),
  el('h2',{class:'section-title'},'Objektai'),(c.properties||[]).length?el('div',{class:'list'},c.properties.map(p=>propertyCard(c,p))):el('div',{class:'empty'},'Šis klientas dar neturi objektų.')];}
function propertyCard(c,p){return el('div',{class:'card'},[el('div',{class:'detail-head'},[el('div',{},[el('div',{class:'list-title'},p.name||'Objektas'),el('div',{class:'list-meta'},p.address||'Adresas nenurodytas')]),el('div',{class:'actions'},[p.address?el('a',{class:'btn',href:`https://www.google.com/maps/dir/?api=1&destination=${p.latitude&&p.longitude?`${p.latitude},${p.longitude}`:encodeURIComponent(p.address)}`,target:'_blank'},'🧭 Maps'):null,el('button',{class:'btn',onclick:()=>openEquipment(c.id,p.id)},'➕ Įranga')])]),el('div',{class:'tags'},(p.equipment||[]).map(e=>el('span',{class:'tag'},`${e.type}: ${e.manufacturer||''} ${e.model||''}`.trim()))),(p.equipment||[]).length?null:el('div',{class:'muted',style:'margin-top:10px'},'Įrangos dar nėra.')]);}
function properties(){const rows=state.clients.flatMap(c=>(c.properties||[]).map(p=>({c,p})));return [header('Objektai','Visi klientų objektai'),rows.length?el('div',{class:'list'},rows.map(({c,p})=>el('div',{class:'list-item'},[el('div',{},[el('div',{class:'list-title'},p.name||'Objektas'),el('div',{class:'list-meta'},`${p.address||'Adresas nenurodytas'} · ${c.name}`)]),el('button',{class:'btn',onclick:()=>{state.view='clients';state.selectedClientId=c.id;render();}},'Atidaryti')]))):el('div',{class:'empty'},'Objektų dar nėra.')];}
function equipment(){const rows=state.clients.flatMap(c=>(c.properties||[]).flatMap(p=>(p.equipment||[]).map(e=>({c,p,e}))));return [header('Įranga','Visa sumontuota įranga viename registre'),rows.length?el('div',{class:'list'},rows.map(({c,p,e})=>el('div',{class:'list-item'},[el('div',{},[el('div',{class:'list-title'},`${e.manufacturer||''} ${e.model||''}`.trim()||e.type),el('div',{class:'list-meta'},`${e.type} · ${p.address} · ${c.name}`)]),el('button',{class:'btn',onclick:()=>{state.view='clients';state.selectedClientId=c.id;render();}},'Objektas')]))):el('div',{class:'empty'},'Įrangos dar nėra.')];}
function modal(title,body,onSave){const backdrop=el('div',{class:'modal-backdrop'}),box=el('div',{class:'modal'}),close=()=>backdrop.remove();box.append(el('div',{class:'modal-header'},[el('h2',{},title),el('button',{class:'close',onclick:close},'×')]),body,el('div',{class:'modal-footer'},[el('button',{class:'btn',onclick:close},'Atšaukti'),el('button',{class:'btn btn-primary',onclick:()=>{if(onSave())close();}},'Išsaugoti')]));backdrop.append(box);document.body.append(backdrop);}
function field(label,name,type='text',full=false,placeholder='',value=''){return el('div',{class:`field ${full?'full':''}`},[el('label',{},label),el('input',{name,type,placeholder,value})]);}
function select(label,name,options,full=false){return el('div',{class:`field ${full?'full':''}`},[el('label',{},label),el('select',{name},options.map(o=>el('option',{value:o},o)))]);}
function equipmentInput(label='Šilumos siurblio / dujinio katilo pavadinimas',value=''){const id='equipment-presets-'+crypto.randomUUID();const input=el('input',{name:'equipmentName',list:id,placeholder:'Pasirink arba įrašyk savo modelį',value});return el('div',{class:'field full'},[el('label',{},label),input,el('datalist',{id},EQUIPMENT_PRESETS.map(x=>el('option',{value:x}))) ]);}
function locationFields(form){const status=el('div',{class:'location-status muted'},'Adresą gali įrašyti ranka arba nuskaityti dabartinę vietą.');const lat=el('input',{type:'hidden',name:'latitude'}),lng=el('input',{type:'hidden',name:'longitude'});const button=el('button',{type:'button',class:'btn',onclick:()=>captureLocation(form,status,button)},'📍 Naudoti mano vietą');return [el('div',{class:'field full location-box'},[el('label',{},'Geolokacija'),el('div',{class:'actions'},[button]),status,lat,lng])];}
async function captureLocation(form,status,button){if(!navigator.geolocation){status.textContent='Šiame įrenginyje geolokacija nepalaikoma.';return;}button.disabled=true;status.textContent='Nustatoma vieta…';navigator.geolocation.getCurrentPosition(async pos=>{const lat=pos.coords.latitude,lng=pos.coords.longitude;form.elements.latitude.value=lat;form.elements.longitude.value=lng;status.textContent=`Vieta išsaugota: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;try{const r=await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,{headers:{'Accept-Language':'lt'}});if(r.ok){const data=await r.json();if(data.display_name){form.elements.address.value=data.display_name;status.textContent='Vieta ir adresas nustatyti automatiškai.';}}}catch(e){}button.disabled=false;},err=>{status.textContent=err.code===1?'Neleista naudoti vietos. Patikrink naršyklės leidimus.':'Nepavyko nustatyti vietos.';button.disabled=false;},{enableHighAccuracy:true,timeout:12000,maximumAge:30000});}
function openClient(){const f=el('form',{class:'form-grid'},[select('Kliento tipas','type',['Fizinis asmuo','Įmonė']),field('Vardas / įmonė','name'),field('Telefonas','phone','tel'),field('El. paštas','email','email'),field('Pilnas adresas','address','text',true,'Gatvė, namo nr., miestas'),...locationFields(),field('Miestas','city'),field('Paleidimo / garantijos pradžios data','commissioningDate','date',false,'',today()),select('Garantijos trukmė','warrantyYears',['2','3','5','6','10']),equipmentInput(),field('Pastabos','notes','text',true)]);modal('Naujas klientas',f,()=>{const d=Object.fromEntries(new FormData(f));if(!d.name.trim())return alert('Įrašyk kliento vardą arba įmonę.');if(!d.equipmentName.trim())return alert('Įrašyk šilumos siurblio arba dujinio katilo pavadinimą.');const prop=d.address.trim()?[{id:crypto.randomUUID(),name:'Pagrindinis objektas',address:d.address.trim(),latitude:Number(d.latitude)||null,longitude:Number(d.longitude)||null,equipment:[]}]:[];state.clients.unshift({id:crypto.randomUUID(),...d,name:d.name.trim(),address:d.address.trim(),latitude:Number(d.latitude)||null,longitude:Number(d.longitude)||null,createdAt:today(),commissioningDate:d.commissioningDate||today(),warrantyYears:Number(d.warrantyYears),equipmentName:d.equipmentName.trim(),services:[],properties:prop});save();state.view='services';render();return true;});}
function openService(clientId){const c=state.clients.find(x=>x.id===clientId);const f=el('form',{class:'form-grid'},[field('Aptarnavimo data','date','date',false,'',today()),equipmentInput('Aptarnaujamas įrenginys',c.equipmentName||firstEquipmentName(c)),select('Darbo tipas','serviceKind',['Metinis aptarnavimas','Paleidimas','Garantinis remontas','Gedimas','Profilaktika','Kita']),select('Būsena','status',['Atlikta','Suplanuota']),field('Pastabos / atlikti darbai','notes','text',true)]);modal('Aptarnavimo įrašas',f,()=>{const d=Object.fromEntries(new FormData(f));if(!d.date)return alert('Pasirink datą.');if(!d.equipmentName.trim())return alert('Įrašyk įrangos pavadinimą.');c.services.push({id:crypto.randomUUID(),date:d.date,equipmentName:d.equipmentName.trim(),serviceKind:d.serviceKind,status:d.status==='Atlikta'?'completed':'pending',notes:d.notes.trim()});c.equipmentName ||= d.equipmentName.trim();save();render();return true;});}
function openProperty(clientId){const f=el('form',{class:'form-grid'},[field('Objekto pavadinimas','name','text',false,'Namas, butas, biuras...'),field('Adresas','address','text',true),...locationFields()]);modal('Naujas objektas',f,()=>{const d=Object.fromEntries(new FormData(f));if(!d.address.trim())return alert('Įrašyk objekto adresą arba naudok dabartinę vietą.');state.clients.find(c=>c.id===clientId).properties.push({id:crypto.randomUUID(),name:d.name.trim()||'Objektas',address:d.address.trim(),latitude:Number(d.latitude)||null,longitude:Number(d.longitude)||null,equipment:[]});save();render();return true;});}
function openEquipment(clientId,propertyId){const f=el('form',{class:'form-grid'},[select('Įrangos tipas','type',['Dujinis katilas','Šilumos siurblys','Rekuperatorius','Kondicionierius','Boileris','Cirkuliacinis siurblys','Vandens filtras','Kita'],true),field('Gamintojas','manufacturer'),field('Modelis','model'),field('Serijos numeris','serialNumber','text',true),field('Sumontavimo data','installedAt','date'),field('Garantija iki','warrantyUntil','date')]);modal('Pridėti įrangą',f,()=>{const d=Object.fromEntries(new FormData(f));if(!d.model.trim()&&!d.manufacturer.trim())return alert('Įrašyk gamintoją arba modelį.');const c=state.clients.find(x=>x.id===clientId);c.properties.find(p=>p.id===propertyId).equipment.push({id:crypto.randomUUID(),...d});c.equipmentName ||= `${d.manufacturer} ${d.model}`.trim();save();render();return true;});}
function render(){applyTheme();const content=state.view==='dashboard'?dashboard():state.view==='clients'?clients():state.view==='services'?servicesView():state.view==='properties'?properties():equipment();shell(content);}
migrate();if('serviceWorker'in navigator)addEventListener('load',()=>navigator.serviceWorker.register('service-worker.js').catch(()=>{}));render();
