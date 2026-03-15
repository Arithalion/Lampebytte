const LAMPS_BUCKET = 'lamp-images';

// Konverterer fra Supabase-format (snake_case) til JS (camelCase)
function mapLamp(row) {
  return {
    id: row.id,
    name: row.name,
    replacement: row.replacement,
    oldWatt: row.old_watt,
    newWatt: row.new_watt,
    lampsPerArmature: row.lamps_per_armature,
    oldBallast: row.old_ballast,
    oldLifespan: row.old_lifespan,
    oldLampPrice: row.old_lamp_price,
    replacementLabour: row.replacement_labour,
    ledInvestment: row.led_investment,
    image: row.image_url,
  };
}

async function getLamps() {
  const { data, error } = await db.from('lamps').select('*').order('created_at');
  if (error) { console.error('getLamps:', error); return []; }
  return data.map(mapLamp);
}

async function getSettings() {
  const { data, error } = await db.from('settings').select('*').eq('id', 1).single();
  if (error) return { kwhPrice: 1.50, annualHours: 3120 };
  return { kwhPrice: data.kwh_price, annualHours: data.annual_hours };
}

async function saveSettings(kwhPrice, annualHours) {
  const { error } = await db
    .from('settings')
    .upsert({ id: 1, kwh_price: kwhPrice, annual_hours: annualHours });
  if (error) console.error('saveSettings:', error);
}

async function uploadImage(file) {
  const filename = `${Date.now()}-${file.name}`;
  const { error } = await db.storage.from(LAMPS_BUCKET).upload(filename, file);
  if (error) { console.error('uploadImage:', error); return null; }
  const { data } = db.storage.from(LAMPS_BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}

async function addLamp(lampData, imageFile) {
  const imageUrl = imageFile ? await uploadImage(imageFile) : null;
  const { data, error } = await db.from('lamps').insert({
    name: lampData.name,
    replacement: lampData.replacement,
    old_watt: lampData.oldWatt,
    new_watt: lampData.newWatt,
    lamps_per_armature: lampData.lampsPerArmature,
    old_ballast: lampData.oldBallast,
    old_lifespan: lampData.oldLifespan,
    old_lamp_price: lampData.oldLampPrice,
    replacement_labour: lampData.replacementLabour,
    led_investment: lampData.ledInvestment,
    image_url: imageUrl,
  }).select().single();
  if (error) { console.error('addLamp:', error); return null; }
  return mapLamp(data);
}

async function updateLamp(id, lampData, imageFile, existingImageUrl) {
  const imageUrl = imageFile ? await uploadImage(imageFile) : existingImageUrl;
  const { error } = await db.from('lamps').update({
    name: lampData.name,
    replacement: lampData.replacement,
    old_watt: lampData.oldWatt,
    new_watt: lampData.newWatt,
    lamps_per_armature: lampData.lampsPerArmature,
    old_ballast: lampData.oldBallast,
    old_lifespan: lampData.oldLifespan,
    old_lamp_price: lampData.oldLampPrice,
    replacement_labour: lampData.replacementLabour,
    led_investment: lampData.ledInvestment,
    image_url: imageUrl,
  }).eq('id', id);
  if (error) console.error('updateLamp:', error);
}

async function deleteLampFromDb(id) {
  const { error } = await db.from('lamps').delete().eq('id', id);
  if (error) console.error('deleteLampFromDb:', error);
}

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
