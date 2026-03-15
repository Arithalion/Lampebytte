const LAMPS_BUCKET = 'lamp-images';
const IMAGE_MAX_PX = 800;
const IMAGE_QUALITY = 0.8;

// ── Helpers ──────────────────────────────────────────────

function resizeImage(file) {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > IMAGE_MAX_PX || height > IMAGE_MAX_PX) {
        if (width > height) {
          height = Math.round(height * IMAGE_MAX_PX / width);
          width = IMAGE_MAX_PX;
        } else {
          width = Math.round(width * IMAGE_MAX_PX / height);
          height = IMAGE_MAX_PX;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob(resolve, 'image/jpeg', IMAGE_QUALITY);
    };
    img.src = url;
  });
}

async function uploadImage(file) {
  const resized = await resizeImage(file);
  const filename = `${Date.now()}.jpg`;
  const { error } = await db.storage.from(LAMPS_BUCKET).upload(filename, resized, { contentType: 'image/jpeg' });
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
  if (error) return { kwhPrice: 1.50, annualHours: 3120, co2Factor: 17 };
  return { kwhPrice: data.kwh_price, annualHours: data.annual_hours, co2Factor: data.co2_factor ?? 17 };
}

async function saveSettings(kwhPrice, annualHours, co2Factor) {
  const { error } = await db.from('settings').upsert({ id: 1, kwh_price: kwhPrice, annual_hours: annualHours, co2_factor: co2Factor });
  if (error) console.error('saveSettings:', error);
}

// ── Building categories ───────────────────────────────────

async function getBuildingCategories() {
  const { data, error } = await db.from('building_categories').select('*').order('hours');
  if (error) { console.error('getBuildingCategories:', error); return []; }
  return data;
}

async function addBuildingCategory(catData) {
  const { data, error } = await db.from('building_categories').insert({
    hours: catData.hours,
    category: catData.category,
  }).select().single();
  if (error) { console.error('addBuildingCategory:', error); return null; }
  return data;
}

async function updateBuildingCategory(id, catData) {
  const { error } = await db.from('building_categories').update({
    hours: catData.hours,
    category: catData.category,
  }).eq('id', id);
  if (error) console.error('updateBuildingCategory:', error);
}

async function deleteBuildingCategory(id) {
  const { error } = await db.from('building_categories').delete().eq('id', id);
  if (error) console.error('deleteBuildingCategory:', error);
}

async function submitOfferRequest(lampId, lampName, replacementName, numArmatures, name, email, phone, kwhPrice, annualHours) {
  const { error } = await db.from('offer_requests').insert({
    lamp_id: lampId,
    lamp_name: lampName,
    replacement_name: replacementName,
    num_armatures: numArmatures,
    visitor_name: name,
    email,
    phone: phone || null,
    kwh_price: kwhPrice,
    annual_hours: annualHours,
  });
  if (error) console.error('submitOfferRequest:', error);
}

async function deleteOfferRequest(id) {
  const { error } = await db.from('offer_requests').delete().eq('id', id);
  if (error) console.error('deleteOfferRequest:', error);
}

async function getOfferRequests() {
  const { data, error } = await db
    .from('offer_requests')
    .select('*, old_lamps(image_url)')
    .order('created_at', { ascending: false });
  if (error) { console.error('getOfferRequests:', error); return []; }
  return data;
}

async function updateRequestStatus(id, status) {
  const { error } = await db.from('offer_requests').update({ status }).eq('id', id);
  if (error) console.error('updateRequestStatus:', error);
}

async function createOffer(requestId) {
  const { data, error } = await db.from('offers').insert({ request_id: requestId }).select().single();
  if (error) { console.error('createOffer:', error); return null; }
  return data;
}

async function getOffers() {
  const { data, error } = await db
    .from('offers')
    .select('*, offer_requests(visitor_name, lamp_name, replacement_name, email, num_armatures)')
    .order('created_at', { ascending: false });
  if (error) { console.error('getOffers:', error); return []; }
  return data;
}

async function updateOffer(id, { offerStatus, notes }) {
  const { error } = await db.from('offers').update({
    offer_status: offerStatus,
    notes,
    updated_at: new Date().toISOString(),
  }).eq('id', id);
  if (error) console.error('updateOffer:', error);
}
