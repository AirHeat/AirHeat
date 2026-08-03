const savedClients = JSON.parse(localStorage.getItem('airheat_clients') || 'null');
const savedTheme = localStorage.getItem('airheat_theme') || 'light';

const state = {
  view: 'dashboard',
  query: '',
  serviceFilter: 'all',
  selectedClientId: null,
  theme: savedTheme,
  clients: savedClients || [{
    id: crypto.randomUUID(),
    type: 'Fizinis asmuo',
    name: 'Jonas Jonaitis',
    phone: '+370 600 00000',
    email: 'jonas@example.lt',
    city: 'Vilnius',
    address: 'Pavyzdžio g. 1, Vilnius',
    notes: 'Pavyzdinis klientas',
    createdAt: '2026-07-01',
    services: [{
      id: crypto.randomUUID(),
      date: '2026-07-01',
      type: 'Paleidimas',
      status: 'completed',
      notes: 'Pirmas paleidimas'
    }],
    properties: [{
      id: crypto.randomUUID(),
      name: 'Namas',
      address: 'Pavyzdžio g. 1, Vilnius',
      equipment: [{
        id: crypto.randomUUID(),
        type: 'Dujinis katilas',
        manufacturer: 'BAXI',
        model: 'Luna Platinum',
        serialNumber: 'DEMO-001',
        installedAt: '2026-07-01',
        warrantyUntil: '2028-07-01'
      }]
    }]
  }]
};

function migrate() {
  state.clients.forEach(c => {
    c.createdAt ||= new Date().toISOString().slice(0, 10);
    c.services ||= [];
    c.properties ||= [];
    c.address ||= c.properties[0]?.address || '';
  });
  save();
}

function save() {
  localStorage.setItem('airheat_clients', JSON.stringify(state.clients));
}

function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  localStorage.setItem('airheat_theme', state.theme);
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (key === 'class') node.className = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value !== null && value !== undefined) node.setAttribute(key, value);
  });
  (Array.isArray(children) ? children : [children]).forEach(child => {
    if (child !== null && child !== undefined) node.append(child.nodeType ? child : document.createTextNode(String(child)));
  });
  return node;
}

function nav(label, view, icon) {
  return el('button', {
    class: state.view === view ? 'active' : '',
    onclick: () => { state.view = view; state.selectedClientId = null; render(); }
  }, `${icon} ${label}`);
}

function shell(content) {
  const app = document.getElementById('app');
  app.innerHTML = '';
  app.append(el('div', { class: 'app-shell' }, [
    el('aside', { class: 'sidebar' }, [
      el('div', { class: 'brand' }, [
        el('div', { class: 'brand-mark' }, 'A'),
        el('div', {}, [el('div', { class: 'brand-title' }, 'AIRHEAT'), el('div', { class: 'brand-sub' }, 'ŠVOK valdymo sistema')])
      ]),
      el('nav', { class: 'nav' }, [
        nav('Pagrindinis', 'dashboard', '🏠'),
        nav('Klientai', 'clients', '👥'),
        nav('Aptarnavimai', 'services', '📅'),
        nav('Objektai', 'properties', '🏡'),
        nav('Įranga', 'equipment', '🔧')
      ])
    ]),
    el('main', { class: 'main' }, content),
    el('nav', { class: 'mobile-nav' }, [
      nav('Pradžia', 'dashboard', '🏠'),
      nav('Klientai', 'clients', '👥'),
      nav('Aptarn.', 'services', '📅'),
      nav('Objektai', 'properties', '🏡'),
      nav('Įranga', 'equipment', '🔧')
    ])
  ]));
}

const header = (title, subtitle, actions = []) => el('div', { class: 'topbar' }, [
  el('div', {}, [el('h1', {}, title), el('p', {}, subtitle)]),
  el('div', { class: 'actions' }, [
    ...actions,
    el('button', { class: 'btn', onclick: toggleTheme }, state.theme === 'light' ? '🌙 Tamsi' : '☀️ Šviesi')
  ])
]);

const stat = (label, value, color = '') => el('div', { class: 'card' }, [
  el('div', { class: 'muted' }, label),
  el('div', { class: `stat-value ${color}` }, value)
]);

function toggleTheme() {
  state.theme = state.theme === 'light' ? 'dark' : 'light';
  applyTheme();
  render();
}

function allServices() {
  return state.clients.flatMap(client => (client.services || []).map(service => ({ client, service })));
}

function latestCompleted(client) {
  return (client.services || []).filter(s => s.status === 'completed').sort((a, b) => b.date.localeCompare(a.date))[0];
}

function nextPlanned(client) {
  const today = new Date().toISOString().slice(0, 10);
  return (client.services || []).filter(s => s.status !== 'completed' && s.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
}

function dashboard() {
  const props = state.clients.flatMap(c => c.properties || []);
  const eq = props.flatMap(p => p.equipment || []);
  const due = allServices().filter(({ service }) => service.status !== 'completed').length;
  return [
    header('Labas, Dariau 👋', 'AirHeat v0.2 – klientai ir aptarnavimų kontrolė', [
      el('button', { class: 'btn btn-primary', onclick: openClient }, '➕ Naujas klientas')
    ]),
    el('div', { class: 'grid cols4' }, [
      stat('Klientai', state.clients.length, 'blue'),
      stat('Objektai', props.length, 'orange'),
      stat('Įrenginiai', eq.length, 'green'),
      stat('Laukia aptarnavimo', due, 'red')
    ]),
    el('div', { class: 'grid cols2', style: 'margin-top:16px' }, [
      el('div', { class: 'card' }, [
        el('h3', {}, 'Greiti veiksmai'),
        el('div', { class: 'actions' }, [
          el('button', { class: 'btn', onclick: openClient }, '👤 Pridėti klientą'),
          el('button', { class: 'btn', onclick: () => { state.view = 'services'; render(); } }, '📅 Aptarnavimų sąrašas')
        ])
      ]),
      el('div', { class: 'card' }, [
        el('h3', {}, 'Nauja šioje versijoje'),
        el('div', { class: 'muted' }, 'Pilnas adresas kuriant klientą, šviesi tema, aptarnavimų registras ir atlikimo žymėjimas.')
      ])
    ])
  ];
}

function matches(client, q) {
  return [client.name, client.phone, client.email, client.city, client.address, client.notes,
    ...(client.properties || []).flatMap(p => [p.name, p.address, ...(p.equipment || []).flatMap(e => [e.type, e.manufacturer, e.model, e.serialNumber])])
  ].join(' ').toLowerCase().includes(q.toLowerCase());
}

function clients() {
  if (state.selectedClientId) return clientDetail();
  const visible = state.clients.filter(c => matches(c, state.query)).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return [
    header('Klientai', 'Visi klientai, surikiuoti nuo naujausio', [el('button', { class: 'btn btn-primary', onclick: openClient }, '➕ Naujas klientas')]),
    el('div', { class: 'toolbar' }, [
      el('input', { class: 'search', placeholder: 'Ieškoti pagal vardą, telefoną, adresą ar įrangą...', value: state.query, oninput: e => { state.query = e.target.value; render(); } })
    ]),
    visible.length ? el('div', { class: 'list' }, visible.map(clientRow)) : el('div', { class: 'empty' }, 'Klientų nerasta.')
  ];
}

function clientRow(c) {
  const eq = (c.properties || []).flatMap(p => p.equipment || []);
  const last = latestCompleted(c);
  const next = nextPlanned(c);
  return el('div', { class: 'list-item' }, [
    el('div', { onclick: () => { state.selectedClientId = c.id; render(); } }, [
      el('div', { class: 'list-title' }, c.name),
      el('div', { class: 'list-meta' }, `${c.phone || 'Nėra telefono'} · ${c.address || c.city || 'Adresas nenurodytas'}`),
      el('div', { class: 'tags' }, [
        el('span', { class: 'tag' }, `Sukurta ${c.createdAt || '—'}`),
        last ? el('span', { class: 'tag tag-done' }, `Paskutinis: ${last.date}`) : el('span', { class: 'tag tag-alert' }, 'Neaptarnauta'),
        next ? el('span', { class: 'tag tag-next' }, `Kitas: ${next.date}`) : null,
        el('span', { class: 'tag' }, `${eq.length} įreng.`)
      ])
    ]),
    el('div', { class: 'actions' }, [
      c.phone ? el('a', { class: 'btn', href: `tel:${c.phone}` }, '📞') : null,
      el('button', { class: 'btn', onclick: () => openService(c.id) }, '➕ Aptarnavimas'),
      el('button', { class: 'btn', onclick: () => { state.selectedClientId = c.id; render(); } }, 'Atidaryti')
    ])
  ]);
}

function servicesView() {
  const today = new Date().toISOString().slice(0, 10);
  let rows = allServices();
  if (state.serviceFilter === 'pending') rows = rows.filter(x => x.service.status !== 'completed');
  if (state.serviceFilter === 'completed') rows = rows.filter(x => x.service.status === 'completed');
  if (state.serviceFilter === 'overdue') rows = rows.filter(x => x.service.status !== 'completed' && x.service.date < today);
  rows.sort((a, b) => b.service.date.localeCompare(a.service.date));

  const noService = state.clients.filter(c => !(c.services || []).length);
  return [
    header('Aptarnavimai', 'Excel tipo registras pagal datą su atlikimo žymėjimu'),
    el('div', { class: 'toolbar filterbar' }, [
      filterButton('Visi', 'all'), filterButton('Laukiantys', 'pending'), filterButton('Vėluoja', 'overdue'), filterButton('Atlikti', 'completed')
    ]),
    rows.length ? el('div', { class: 'service-table' }, [
      el('div', { class: 'service-row service-head' }, ['Data', 'Klientas', 'Adresas', 'Tipas', 'Būsena', 'Veiksmai'].map(x => el('div', {}, x))),
      ...rows.map(({ client, service }) => serviceRow(client, service))
    ]) : el('div', { class: 'empty' }, 'Pagal pasirinktą filtrą aptarnavimų nėra.'),
    noService.length ? el('div', { class: 'card', style: 'margin-top:18px' }, [
      el('h3', {}, `Klientai be aptarnavimo įrašo (${noService.length})`),
      el('div', { class: 'tags' }, noService.map(c => el('button', { class: 'tag tag-button', onclick: () => openService(c.id) }, `➕ ${c.name}`)))
    ]) : null
  ];
}

function filterButton(label, value) {
  return el('button', { class: `btn ${state.serviceFilter === value ? 'selected' : ''}`, onclick: () => { state.serviceFilter = value; render(); } }, label);
}

function serviceRow(client, service) {
  return el('div', { class: `service-row ${service.status === 'completed' ? 'completed' : ''}` }, [
    el('div', { 'data-label': 'Data' }, service.date || '—'),
    el('div', { 'data-label': 'Klientas' }, client.name),
    el('div', { 'data-label': 'Adresas' }, client.address || client.properties?.[0]?.address || '—'),
    el('div', { 'data-label': 'Tipas' }, service.type || 'Aptarnavimas'),
    el('div', { 'data-label': 'Būsena' }, service.status === 'completed' ? '✅ Atlikta' : '⏳ Laukia'),
    el('div', { class: 'actions', 'data-label': 'Veiksmai' }, [
      service.status !== 'completed' ? el('button', { class: 'btn btn-success', onclick: () => completeService(client.id, service.id) }, 'Pažymėti atlikta') : null,
      el('button', { class: 'btn', onclick: () => { state.view = 'clients'; state.selectedClientId = client.id; render(); } }, 'Klientas')
    ])
  ]);
}

function completeService(clientId, serviceId) {
  const service = state.clients.find(c => c.id === clientId).services.find(s => s.id === serviceId);
  service.status = 'completed';
  service.completedAt = new Date().toISOString().slice(0, 10);
  save(); render();
}

function clientDetail() {
  const c = state.clients.find(x => x.id === state.selectedClientId);
  return [
    el('button', { class: 'btn', onclick: () => { state.selectedClientId = null; render(); } }, '← Atgal'),
    el('div', { class: 'card', style: 'margin-top:14px' }, [
      el('div', { class: 'detail-head' }, [
        el('div', {}, [
          el('div', { class: 'detail-title' }, c.name),
          el('div', { class: 'muted', style: 'margin-top:6px' }, `${c.phone || ''}${c.email ? ' · ' + c.email : ''}`),
          el('div', { class: 'muted', style: 'margin-top:4px' }, c.address || c.city || '')
        ]),
        el('div', { class: 'actions' }, [
          c.phone ? el('a', { class: 'btn', href: `tel:${c.phone}` }, '📞 Skambinti') : null,
          c.address ? el('a', { class: 'btn', href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address)}`, target: '_blank' }, '🧭 Naviguoti') : null,
          el('button', { class: 'btn', onclick: () => openService(c.id) }, '➕ Aptarnavimas'),
          el('button', { class: 'btn', onclick: () => openProperty(c.id) }, '➕ Objektas')
        ])
      ]),
      c.notes ? el('p', { class: 'muted' }, c.notes) : null
    ]),
    el('h2', { class: 'section-title' }, 'Aptarnavimo istorija'),
    (c.services || []).length ? el('div', { class: 'list' }, [...c.services].sort((a,b)=>b.date.localeCompare(a.date)).map(s => el('div', { class: 'list-item' }, [
      el('div', {}, [el('div', { class: 'list-title' }, `${s.date} · ${s.type}`), el('div', { class: 'list-meta' }, s.notes || (s.status === 'completed' ? 'Atlikta' : 'Laukia'))]),
      el('div', {}, s.status === 'completed' ? '✅' : '⏳')
    ]))) : el('div', { class: 'empty' }, 'Aptarnavimo įrašų dar nėra.'),
    el('h2', { class: 'section-title' }, 'Objektai'),
    (c.properties || []).length ? el('div', { class: 'list' }, c.properties.map(p => propertyCard(c, p))) : el('div', { class: 'empty' }, 'Šis klientas dar neturi objektų.')
  ];
}

function propertyCard(c, p) {
  return el('div', { class: 'card' }, [
    el('div', { class: 'detail-head' }, [
      el('div', {}, [el('div', { class: 'list-title' }, p.name || 'Objektas'), el('div', { class: 'list-meta' }, p.address || 'Adresas nenurodytas')]),
      el('div', { class: 'actions' }, [
        p.address ? el('a', { class: 'btn', href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address)}`, target: '_blank' }, '🧭 Naviguoti') : null,
        el('button', { class: 'btn', onclick: () => openEquipment(c.id, p.id) }, '➕ Įranga')
      ])
    ]),
    el('div', { class: 'tags' }, (p.equipment || []).map(e => el('span', { class: 'tag' }, `${e.type}: ${e.manufacturer || ''} ${e.model || ''}`.trim()))),
    (p.equipment || []).length ? null : el('div', { class: 'muted', style: 'margin-top:10px' }, 'Įrangos dar nėra.')
  ]);
}

function properties() {
  const rows = state.clients.flatMap(c => (c.properties || []).map(p => ({ c, p })));
  return [header('Objektai', 'Visi klientų objektai'), rows.length ? el('div', { class: 'list' }, rows.map(({ c, p }) => el('div', { class: 'list-item' }, [
    el('div', {}, [el('div', { class: 'list-title' }, p.name || 'Objektas'), el('div', { class: 'list-meta' }, `${p.address || 'Adresas nenurodytas'} · ${c.name}`)]),
    el('button', { class: 'btn', onclick: () => { state.view = 'clients'; state.selectedClientId = c.id; render(); } }, 'Atidaryti')
  ]))) : el('div', { class: 'empty' }, 'Objektų dar nėra.')];
}

function equipment() {
  const rows = state.clients.flatMap(c => (c.properties || []).flatMap(p => (p.equipment || []).map(e => ({ c, p, e }))));
  return [header('Įranga', 'Visa sumontuota įranga viename registre'), rows.length ? el('div', { class: 'list' }, rows.map(({ c, p, e }) => el('div', { class: 'list-item' }, [
    el('div', {}, [el('div', { class: 'list-title' }, `${e.manufacturer || ''} ${e.model || ''}`.trim() || e.type), el('div', { class: 'list-meta' }, `${e.type} · ${p.address} · ${c.name}`), el('div', { class: 'tags' }, [e.serialNumber ? el('span', { class: 'tag' }, `S/N ${e.serialNumber}`) : null, e.installedAt ? el('span', { class: 'tag' }, `Sumontuota ${e.installedAt}`) : null])]),
    el('button', { class: 'btn', onclick: () => { state.view = 'clients'; state.selectedClientId = c.id; render(); } }, 'Objektas')
  ]))) : el('div', { class: 'empty' }, 'Įrangos dar nėra.')];
}

function modal(title, body, onSave) {
  const backdrop = el('div', { class: 'modal-backdrop' });
  const box = el('div', { class: 'modal' });
  const close = () => backdrop.remove();
  box.append(el('div', { class: 'modal-header' }, [el('h2', {}, title), el('button', { class: 'close', onclick: close }, '×')]), body,
    el('div', { class: 'modal-footer' }, [el('button', { class: 'btn', onclick: close }, 'Atšaukti'), el('button', { class: 'btn btn-primary', onclick: () => { if (onSave()) close(); } }, 'Išsaugoti')]));
  backdrop.append(box); document.body.append(backdrop);
}

function field(label, name, type = 'text', full = false, placeholder = '', value = '') {
  return el('div', { class: `field ${full ? 'full' : ''}` }, [el('label', {}, label), el('input', { name, type, placeholder, value })]);
}
function select(label, name, options, full = false) {
  return el('div', { class: `field ${full ? 'full' : ''}` }, [el('label', {}, label), el('select', { name }, options.map(o => el('option', { value: o }, o)))]);
}

function openClient() {
  const f = el('form', { class: 'form-grid' }, [
    select('Tipas', 'type', ['Fizinis asmuo', 'Įmonė']),
    field('Vardas / įmonė', 'name'),
    field('Telefonas', 'phone', 'tel'),
    field('El. paštas', 'email', 'email'),
    field('Pilnas adresas', 'address', 'text', true, 'Gatvė, namo nr., miestas'),
    field('Miestas', 'city'),
    field('Kliento sukūrimo / paleidimo data', 'createdAt', 'date', false, '', new Date().toISOString().slice(0, 10)),
    field('Pastabos', 'notes', 'text', true)
  ]);
  modal('Naujas klientas', f, () => {
    const d = Object.fromEntries(new FormData(f));
    if (!d.name.trim()) return alert('Įrašyk kliento vardą arba įmonę.');
    const property = d.address.trim() ? [{ id: crypto.randomUUID(), name: 'Pagrindinis objektas', address: d.address.trim(), equipment: [] }] : [];
    state.clients.unshift({ id: crypto.randomUUID(), ...d, name: d.name.trim(), address: d.address.trim(), services: [], properties: property });
    save(); state.view = 'clients'; render(); return true;
  });
}

function openService(clientId) {
  const f = el('form', { class: 'form-grid' }, [
    field('Data', 'date', 'date', false, '', new Date().toISOString().slice(0, 10)),
    select('Tipas', 'type', ['Metinis aptarnavimas', 'Paleidimas', 'Garantinis remontas', 'Gedimas', 'Profilaktika', 'Kita']),
    select('Būsena', 'status', ['Laukia', 'Atlikta']),
    field('Pastabos / atlikti darbai', 'notes', 'text', true)
  ]);
  modal('Naujas aptarnavimas', f, () => {
    const d = Object.fromEntries(new FormData(f));
    if (!d.date) return alert('Pasirink datą.');
    state.clients.find(c => c.id === clientId).services.push({ id: crypto.randomUUID(), date: d.date, type: d.type, status: d.status === 'Atlikta' ? 'completed' : 'pending', notes: d.notes.trim() });
    save(); render(); return true;
  });
}

function openProperty(clientId) {
  const f = el('form', { class: 'form-grid' }, [field('Objekto pavadinimas', 'name', 'text', false, 'Namas, butas, biuras...'), field('Adresas', 'address', 'text', true)]);
  modal('Naujas objektas', f, () => {
    const d = Object.fromEntries(new FormData(f));
    if (!d.address.trim()) return alert('Įrašyk objekto adresą.');
    state.clients.find(c => c.id === clientId).properties.push({ id: crypto.randomUUID(), name: d.name.trim() || 'Objektas', address: d.address.trim(), equipment: [] });
    save(); render(); return true;
  });
}

function openEquipment(clientId, propertyId) {
  const f = el('form', { class: 'form-grid' }, [
    select('Įrangos tipas', 'type', ['Dujinis katilas', 'Šilumos siurblys', 'Rekuperatorius', 'Kondicionierius', 'Boileris', 'Cirkuliacinis siurblys', 'Vandens filtras', 'Kita'], true),
    field('Gamintojas', 'manufacturer'), field('Modelis', 'model'), field('Serijos numeris', 'serialNumber', 'text', true), field('Sumontavimo data', 'installedAt', 'date'), field('Garantija iki', 'warrantyUntil', 'date')
  ]);
  modal('Pridėti įrangą', f, () => {
    const d = Object.fromEntries(new FormData(f));
    if (!d.model.trim() && !d.manufacturer.trim()) return alert('Įrašyk gamintoją arba modelį.');
    state.clients.find(c => c.id === clientId).properties.find(p => p.id === propertyId).equipment.push({ id: crypto.randomUUID(), ...d });
    save(); render(); return true;
  });
}

function render() {
  applyTheme();
  const content = state.view === 'dashboard' ? dashboard() : state.view === 'clients' ? clients() : state.view === 'services' ? servicesView() : state.view === 'properties' ? properties() : equipment();
  shell(content);
}

migrate();
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('service-worker.js').catch(() => {}));
render();
