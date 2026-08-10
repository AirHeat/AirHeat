import { readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { createServerAdminClient } from '../backend/supabase-client.js';

const args = new Set(process.argv.slice(2));
const inputArg = process.argv.slice(2).find(value => !value.startsWith('--'));
const apply = args.has('--apply');
const sourceSystem = 'airheat-legacy-localstorage';

function fail(message) { throw new Error(message); }
function requiredText(value, path) {
  if (typeof value !== 'string' || !value.trim()) fail(`${path} is required.`);
  return value.trim();
}
function optionalDate(value, path) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail(`${path} must be YYYY-MM-DD.`);
  return value;
}
function coordinates(latitude, longitude, path) {
  const bothEmpty = (latitude === null || latitude === '' || latitude === undefined) && (longitude === null || longitude === '' || longitude === undefined);
  if (bothEmpty) return { latitude: null, longitude: null };
  const lat = Number(latitude), lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) fail(`${path} has invalid or partial coordinates.`);
  return { latitude: lat, longitude: lng };
}
function warrantyStatus(client) {
  if (['active', 'expired', 'two_year', 'declined'].includes(client.warrantyStatus)) return client.warrantyStatus;
  return Number(client.warrantyYears) === 2 ? 'two_year' : 'active';
}
function serviceStatus(service) {
  if (['future', 'pending', 'missed', 'completed', 'cancelled'].includes(service.status)) return service.status;
  fail(`Service ${service.id || '(missing id)'} has unsupported status ${service.status}.`);
}
function serviceDates(service) {
  const date = optionalDate(service.date, `service ${service.id}.date`);
  if (!date) fail(`service ${service.id}.date is required.`);
  return service.status === 'completed' ? { scheduled_date: null, completed_date: date } : { scheduled_date: date, completed_date: null };
}
function validateLegacy(clients) {
  if (!Array.isArray(clients)) fail('Input must be a JSON array of legacy customers/installations.');
  const ids = new Set(), importKeys = new Set();
  const counts = { customers: clients.length, properties: 0, equipment: 0, services: 0, warranties: 0 };
  clients.forEach((client, ci) => {
    requiredText(client.id, `clients[${ci}].id`); requiredText(client.name, `clients[${ci}].name`);
    if (ids.has(client.id)) fail(`Duplicate legacy customer id: ${client.id}`); ids.add(client.id);
    if (client.importKey) { if (importKeys.has(client.importKey)) fail(`Duplicate importKey: ${client.importKey}`); importKeys.add(client.importKey); }
    (client.properties || []).forEach((property, pi) => {
      requiredText(property.id, `clients[${ci}].properties[${pi}].id`);
      requiredText(property.address || client.address, `clients[${ci}].properties[${pi}].address`);
      coordinates(property.latitude, property.longitude, `property ${property.id}`);
      counts.properties += 1;
      (property.equipment || []).forEach((equipment, ei) => {
        requiredText(equipment.id, `property ${property.id}.equipment[${ei}].id`);
        if (![equipment.manufacturer, equipment.model, equipment.serialNumber].some(value => String(value || '').trim())) fail(`equipment ${equipment.id} has no identifying field.`);
        optionalDate(equipment.installedAt, `equipment ${equipment.id}.installedAt`);
        optionalDate(equipment.warrantyUntil, `equipment ${equipment.id}.warrantyUntil`);
        counts.equipment += 1; counts.warranties += 1;
      });
    });
    (client.services || []).forEach((service, si) => {
      requiredText(service.id, `clients[${ci}].services[${si}].id`);
      serviceStatus(service); serviceDates(service); counts.services += 1;
    });
  });
  return counts;
}
async function mappedId(supabase, entityType, legacyId) {
  const { data, error } = await supabase.from('legacy_id_map').select('target_id').eq('source_system', sourceSystem).eq('entity_type', entityType).eq('legacy_id', legacyId).maybeSingle();
  if (error) fail(error.message); return data?.target_id || null;
}
async function insertMapped(supabase, batchId, entityType, legacyId, table, row) {
  const existing = await mappedId(supabase, entityType, legacyId);
  const targetId = existing || randomUUID();
  if (!existing) {
    const { error: mapError } = await supabase.from('legacy_id_map').insert({ import_batch_id: batchId, source_system: sourceSystem, entity_type: entityType, legacy_id: legacyId, target_table: table, target_id: targetId });
    if (mapError) fail(`legacy_id_map/${legacyId}: ${mapError.message}`);
  }
  const { error } = await supabase.from(table).upsert({ id: targetId, ...row }, { onConflict: 'id', ignoreDuplicates: true });
  if (error) fail(`${table}/${legacyId}: ${error.message}`);
  return targetId;
}

if (!inputArg) {
  console.log('Usage: node scripts/import-legacy.mjs <legacy-export.json> [--apply]');
  console.log('Dry-run is the default. The input must be an explicit JSON export, not clients-data.js.');
  process.exit(0);
}

const raw = await readFile(inputArg, 'utf8');
const clients = JSON.parse(raw);
const counts = validateLegacy(clients);
const checksum = createHash('sha256').update(raw).digest('hex');
console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', source: inputArg, checksum, counts }, null, 2));
if (!apply) process.exit(0);
if (process.env.AIRHEAT_IMPORT_TARGET !== 'staging' || process.env.AIRHEAT_IMPORT_CONFIRM !== 'IMPORT_TO_STAGING_ONLY') fail('Apply is locked to staging. Set both documented staging confirmation variables.');
if (!String(process.env.SUPABASE_URL || '').startsWith('https://')) fail('SUPABASE_URL must be an HTTPS staging project URL.');

const supabase = createServerAdminClient();
const { data: existingBatch, error: batchLookupError } = await supabase.from('import_batches').select('id,status').eq('source_checksum', checksum).maybeSingle();
if (batchLookupError) fail(batchLookupError.message);
if (existingBatch?.status === 'completed') { console.log(`Import ${checksum} already completed; no changes made.`); process.exit(0); }
let batchId = existingBatch?.id;
if (!batchId) {
  const { data, error } = await supabase.from('import_batches').insert({ source_system: sourceSystem, source_name: inputArg, source_checksum: checksum, status: 'validated', record_counts: counts }).select('id').single();
  if (error) fail(error.message); batchId = data.id;
}

try {
  for (const client of clients) {
    const customerLegacyId = client.importKey || client.id;
    const customerId = await insertMapped(supabase, batchId, 'customer', customerLegacyId, 'customers', {
      customer_kind: client.type === 'Įmonė' ? 'company' : 'person', name: client.name, phone: client.phone || null,
      email: client.email || null, address_summary: client.address || null, notes: client.notes || null
    });
    const equipmentContexts = [];
    for (const property of client.properties || []) {
      const gps = coordinates(property.latitude, property.longitude, `property ${property.id}`);
      const propertyId = await insertMapped(supabase, batchId, 'property', property.id, 'properties', {
        customer_id: customerId, name: property.name || 'Objektas', full_address: property.address || client.address, ...gps
      });
      for (const equipment of property.equipment || []) {
        const equipmentId = await insertMapped(supabase, batchId, 'equipment', equipment.id, 'equipment', {
          property_id: propertyId, category: equipment.type || 'Kita', manufacturer: equipment.manufacturer || null,
          model: equipment.model || null, serial_number: equipment.serialNumber || null,
          installed_at: optionalDate(equipment.installedAt, `equipment ${equipment.id}.installedAt`),
          commissioned_at: optionalDate(client.commissioningDate, `client ${client.id}.commissioningDate`)
        });
        equipmentContexts.push({ legacy: equipment, propertyId, equipmentId });
        await insertMapped(supabase, batchId, 'warranty', `${equipment.id}-warranty`, 'warranties', {
          equipment_id: equipmentId, status: warrantyStatus(client), starts_on: optionalDate(client.commissioningDate, `client ${client.id}.commissioningDate`),
          ends_on: optionalDate(equipment.warrantyUntil, `equipment ${equipment.id}.warrantyUntil`), duration_years: Number(client.warrantyYears) || null,
          declined_reason: client.warrantyStatus === 'declined' ? (client.notes || 'Legacy import: warranty declined') : null
        });
      }
    }
    for (const service of client.services || []) {
      let context = service.equipmentId ? equipmentContexts.find(item => item.legacy.id === service.equipmentId) : null;
      if (!context && service.equipmentName) context = equipmentContexts.find(item => `${item.legacy.manufacturer || ''} ${item.legacy.model || ''}`.trim().toLocaleLowerCase('lt-LT') === service.equipmentName.trim().toLocaleLowerCase('lt-LT'));
      context ||= equipmentContexts.length === 1 ? equipmentContexts[0] : null;
      if (!context) fail(`Service ${service.id} cannot be assigned unambiguously to equipment.`);
      await insertMapped(supabase, batchId, 'service', service.id, 'services', {
        equipment_id: context.equipmentId, service_kind: service.serviceKind || service.type || 'Kita', status: serviceStatus(service),
        ...serviceDates(service), service_year: service.serviceYear || null, notes: service.notes || null
      });
    }
  }
  const { error } = await supabase.from('import_batches').update({ status: 'completed', completed_at: new Date().toISOString(), record_counts: counts }).eq('id', batchId);
  if (error) fail(error.message);
  console.log(`Completed idempotent staging import ${batchId}.`);
} catch (error) {
  await supabase.from('import_batches').update({ status: 'failed', error_details: { message: error.message } }).eq('id', batchId);
  throw error;
}
