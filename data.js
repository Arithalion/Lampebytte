const LAMPS_BUCKET = 'lamp-images';

// ── Helpers ──────────────────────────────────────────────

async function uploadImage(file) {
  const filename = `${Date.now()}-${file.name}`;
  const { error } = await db.storage.from(LAMPS_BUCKET).upload(filename, file);
  if (error) { console.error('uploadImage:', error); return null; }
  const { data } = db.storage.from(LAMPS_BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}

function mapOldLamp(row) {
  return {
    id: row.id,
    name: row.name,
    image: row.image_url,
    oldWatt: row.old_watt,
    lampsPerArmature: row.lamps_per_armature,
    oldBallast: row.old_ballast,
    oldLifespan: row.old_lifespan,
    oldLampPrice: row.old_lamp_price,
    replacementLabour: row.replacement_labour,
    replacements: (row.lamp_replacements || []).map(r => mapNewLamp(r.new_lamps)),
  };
}

function mapNewLamp(row) {
  return {
    id: row.id,
    name: row.name,
    image: row.image_url,
    newWatt: row.new_watt,
    lampsPerArmature: row.lamps_per_armature,
    newLifespan: row.new_lifespan,
    newLampPrice: row.new_lamp_price,
    newLabour: row.new_labour,
    ledInvestment: row.led_investment,
  };
}

// ── Old lamps ─────────────────────────────────────────────

async function getOldLamps() {
  const { data, error } = await db
    .from('old_lamps')
    .select('*, lamp_replacements(new_lamps(*))')
    .order('created_at');
  if (error) { console.error('getOldLamps:', error); return []; }
  return data.map(mapOldLamp);
}

async function addOldLamp(lampData, imageFile) {
  const imageUrl = imageFile ? await uploadImage(imageFile) : null;
  const { data, error } = await db.from('old_lamps').insert({
    name: lampData.name,
    image_url: imageUrl,
    old_watt: lampData.oldWatt,
    lamps_per_armature: lampData.lampsPerArmature,
    old_ballast: lampData.oldBallast,
    old_lifespan: lampData.oldLifespan,
    old_lamp_price: lampData.oldLampPrice,
    replacement_labour: lampData.replacementLabour,
  }).select().single();
  if (error) { console.error('addOldLamp:', error); return null; }
  return mapOldLamp({ ...data, lamp_replacements: [] });
}

async function updateOldLamp(id, lampData, imageFile, existingImageUrl) {
  const imageUrl = imageFile ? await uploadImage(imageFile) : existingImageUrl;
  const { error } = await db.from('old_lamps').update({
    name: lampData.name,
    image_url: imageUrl,
    old_watt: lampData.oldWatt,
    lamps_per_armature: lampData.lampsPerArmature,
    old_ballast: lampData.oldBallast,
    old_lifespan: lampData.oldLifespan,
    old_lamp_price: lampData.oldLampPrice,
    replacement_labour: lampData.replacementLabour,
  }).eq('id', id);
  if (error) console.error('updateOldLamp:', error);
}

async function deleteOldLamp(id) {
  const { error } = await db.from('old_lamps').delete().eq('id', id);
  if (error) console.error('deleteOldLamp:', error);
}

// ── New lamps ─────────────────────────────────────────────

async function getNewLamps() {
  const { data, error } = await db.from('new_lamps').select('*').order('created_at');
  if (error) { console.error('getNewLamps:', error); return []; }
  return data.map(mapNewLamp);
}

async function addNewLamp(lampData, imageFile) {
  const imageUrl = imageFile ? await uploadImage(imageFile) : null;
  const { data, error } = await db.from('new_lamps').insert({
    name: lampData.name,
    image_url: imageUrl,
    new_watt: lampData.newWatt,
    lamps_per_armature: lampData.lampsPerArmature,
    new_lifespan: lampData.newLifespan,
    new_lamp_price: lampData.newLampPrice,
    new_labour: lampData.newLabour,
    led_investment: lampData.ledInvestment,
  }).select().single();
  if (error) { console.error('addNewLamp:', error); return null; }
  return mapNewLamp(data);
}

async function updateNewLamp(id, lampData, imageFile, existingImageUrl) {
  const imageUrl = imageFile ? await uploadImage(imageFile) : existingImageUrl;
  const { error } = await db.from('new_lamps').update({
    name: lampData.name,
    image_url: imageUrl,
    new_watt: lampData.newWatt,
    lamps_per_armature: lampData.lampsPerArmature,
    new_lifespan: lampData.newLifespan,
    new_lamp_price: lampData.newLampPrice,
    new_labour: lampData.newLabour,
    led_investment: lampData.ledInvestment,
  }).eq('id', id);
  if (error) console.error('updateNewLamp:', error);
}

async function deleteNewLamp(id) {
  const { error } = await db.from('new_lamps').delete().eq('id', id);
  if (error) console.error('deleteNewLamp:', error);
}

// ── Replacements (linking) ────────────────────────────────

async function setLampReplacements(oldLampId, newLampIds) {
  await db.from('lamp_replacements').delete().eq('old_lamp_id', oldLampId);
  if (newLampIds.length === 0) return;
  const { error } = await db.from('lamp_replacements').insert(
    newLampIds.map(newLampId => ({ old_lamp_id: oldLampId, new_lamp_id: newLampId }))
  );
  if (error) console.error('setLampReplacements:', error);
}

// ── Settings ──────────────────────────────────────────────

async function getSettings() {
  const { data, error } = await db.from('settings').select('*').eq('id', 1).single();
  if (error) return { kwhPrice: 1.50, annualHours: 3120 };
  return { kwhPrice: data.kwh_price, annualHours: data.annual_hours };
}

async function saveSettings(kwhPrice, annualHours) {
  const { error } = await db.from('settings').upsert({ id: 1, kwh_price: kwhPrice, annual_hours: annualHours });
  if (error) console.error('saveSettings:', error);
}

// ── Offer requests ────────────────────────────────────────

async function submitOfferRequest(lampId, lampName, numArmatures, name, email, phone) {
  const { error } = await db.from('offer_requests').insert({
    lamp_id: lampId,
    lamp_name: lampName,
    num_armatures: numArmatures,
    visitor_name: name,
    email,
    phone: phone || null,
  });
  if (error) console.error('submitOfferRequest:', error);
}

async function getOfferRequests() {
  const { data, error } = await db
    .from('offer_requests')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('getOfferRequests:', error); return []; }
  return data;
}
