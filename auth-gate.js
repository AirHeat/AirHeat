import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.2/+esm';

const app = document.getElementById('app');
const config = window.AIRHEAT_SUPABASE_CONFIG;

if (!config?.url || !config?.publishableKey) {
  renderMessage('Staging konfigūracija nerasta', 'Sugeneruok runtime-config.js iš SUPABASE_URL ir SUPABASE_ANON_KEY aplinkos kintamųjų.');
  throw new Error('Missing AIRHEAT_SUPABASE_CONFIG');
}

const supabase = createClient(config.url, config.publishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

let applicationLoaded = false;
let passwordRecovery = false;

window.AirHeatAuth = {
  mode: 'supabase',
  currentUser: null,
  signOut: async () => {
    await supabase.auth.signOut();
    location.reload();
  }
};

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY') {
    passwordRecovery = true;
    renderPasswordUpdate();
    return;
  }
  if (event === 'SIGNED_OUT') renderLogin();
  if (session && !passwordRecovery) void enterApplication(session);
});

const { data: { session }, error: sessionError } = await supabase.auth.getSession();
if (sessionError) renderMessage('Nepavyko patikrinti prisijungimo', sessionError.message);
else if (session) await enterApplication(session);
else renderLogin();

function renderLogin(message = '') {
  applicationLoaded = false;
  app.innerHTML = `
    <main class="auth-page">
      <section class="auth-card">
        <div class="brand auth-brand"><div class="brand-mark">A</div><div><div class="brand-title">AIRHEAT</div><div class="brand-sub">Saugi staging aplinka</div></div></div>
        <h1>Prisijungimas</h1>
        <p class="muted">Klientų duomenys pasiekiami tik aktyviems AirHeat vartotojams.</p>
        ${message ? `<div class="error-banner" role="alert">${escapeHtml(message)}</div>` : ''}
        <form id="login-form" class="auth-form">
          <label>El. paštas<input name="email" type="email" autocomplete="username" required></label>
          <label>Slaptažodis<input name="password" type="password" autocomplete="current-password" required></label>
          <button class="btn btn-primary" type="submit">Prisijungti</button>
        </form>
        <button id="reset-password" class="btn auth-secondary" type="button">Nustatyti arba atkurti slaptažodį</button>
      </section>
    </main>`;

  document.getElementById('login-form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button');
    const values = Object.fromEntries(new FormData(event.currentTarget));
    button.disabled = true;
    const { error } = await supabase.auth.signInWithPassword(values);
    if (error) renderLogin('Prisijungti nepavyko. Patikrink el. paštą ir slaptažodį.');
  });

  document.getElementById('reset-password').addEventListener('click', async () => {
    const email = app.querySelector('input[name="email"]').value.trim();
    if (!email) return renderLogin('Pirmiausia įrašyk el. pašto adresą.');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}${location.pathname}`
    });
    renderLogin(error ? error.message : 'Užklausa priimta. Jei laiško nėra, patikrink šlamšto aplanką ir palauk, kol atsinaujins Supabase el. laiškų limitas.');
  });
}

function renderPasswordUpdate() {
  app.innerHTML = `
    <main class="auth-page"><section class="auth-card">
      <h1>Naujas slaptažodis</h1>
      <p class="muted">Naudok unikalų slaptažodį, kurio nenaudoji kitose paskyrose.</p>
      <form id="password-form" class="auth-form">
        <label>Naujas slaptažodis<input name="password" type="password" minlength="12" autocomplete="new-password" required></label>
        <button class="btn btn-primary" type="submit">Išsaugoti slaptažodį</button>
      </form>
    </section></main>`;
  document.getElementById('password-form').addEventListener('submit', async event => {
    event.preventDefault();
    const password = new FormData(event.currentTarget).get('password');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return renderMessage('Nepavyko išsaugoti slaptažodžio', error.message);
    passwordRecovery = false;
    const { data: { session } } = await supabase.auth.getSession();
    await enterApplication(session);
  });
}

async function enterApplication(session) {
  if (!session || applicationLoaded) return;
  renderMessage('Tikrinama prieiga…', 'Kraunamas saugus AirHeat staging profilis.');

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('id,email,display_name,role,active')
    .eq('id', session.user.id)
    .single();

  if (profileError || !profile?.active) {
    await supabase.auth.signOut();
    return renderLogin('Ši paskyra neturi aktyvios AirHeat prieigos.');
  }

  const { data: customers, error: customersError } = await supabase
    .from('customers')
    .select('*, properties(*, equipment(*, services(*), warranties(*)))')
    .order('created_at', { ascending: true });

  if (customersError) return renderMessage('Nepavyko gauti duomenų', customersError.message);

  window.AirHeatAuth.currentUser = profile;
  window.AIRHEAT_IMPORTED_CLIENTS = mapCustomers(customers || []);
  window.AIRHEAT_IMPORT_VERSION = '';
  window.AIRHEAT_SUPABASE_READ_ONLY = true;
  applicationLoaded = true;
  await loadScript('domain.js');
  await loadScript('app.js');
}

function mapCustomers(customers) {
  return customers.map(customer => {
    const properties = (customer.properties || []).map(property => ({
      id: property.id,
      name: property.name,
      address: property.full_address,
      latitude: property.latitude,
      longitude: property.longitude,
      equipment: (property.equipment || []).map(item => ({
        id: item.id,
        type: item.category,
        manufacturer: item.manufacturer || '',
        model: item.model || '',
        serialNumber: item.serial_number || '',
        installedAt: item.installed_at || item.commissioned_at || '',
        warrantyUntil: (Array.isArray(item.warranties) ? item.warranties[0] : item.warranties)?.ends_on || ''
      }))
    }));
    const services = (customer.properties || []).flatMap(property =>
      (property.equipment || []).flatMap(item =>
        (item.services || []).map(service => ({
          id: service.id,
          propertyId: property.id,
          equipmentId: item.id,
          date: service.completed_date || service.scheduled_date,
          serviceKind: service.service_kind,
          status: service.status,
          notes: service.notes || ''
        }))
      )
    );
    return {
      id: customer.id,
      type: customer.customer_kind === 'company' ? 'Įmonė' : 'Fizinis asmuo',
      name: customer.name,
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address_summary || '',
      notes: customer.notes || '',
      createdAt: customer.created_at?.slice(0, 10) || '',
      services,
      properties
    };
  });
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.body.append(script);
  });
}

function renderMessage(title, message) {
  app.innerHTML = `<main class="auth-page"><section class="auth-card"><h1>${escapeHtml(title)}</h1><p class="muted">${escapeHtml(message)}</p></section></main>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}
