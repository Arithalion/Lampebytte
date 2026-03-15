let oldEditingId = null;
let oldEditingImageUrl = null;
let oldImageFile = null;

let newEditingId = null;
let newEditingImageUrl = null;
let newImageFile = null;

// ── Collapsible sections ───────────────────────────────────

document.querySelectorAll('.section-toggle').forEach(toggle => {
  toggle.addEventListener('click', () => {
    toggle.closest('.section').classList.toggle('collapsed');
  });
});

function expandSection(sectionEl) {
  sectionEl.classList.remove('collapsed');
}

// ── Tooltips (touch support) ───────────────────────────────

document.addEventListener('click', e => {
  const tip = e.target.closest('.tooltip');
  if (tip) {
    e.stopPropagation();
    const wasActive = tip.classList.contains('active');
    document.querySelectorAll('.tooltip.active').forEach(t => t.classList.remove('active'));
    if (!wasActive) tip.classList.add('active');
  } else {
    document.querySelectorAll('.tooltip.active').forEach(t => t.classList.remove('active'));
  }
});

// ── Auth ─────────────────────────────────────────────────

const loginScreen = document.getElementById('login-screen');
const adminPanel = document.getElementById('admin-panel');

function showPanel() {
  loginScreen.style.display = 'none';
  adminPanel.style.display = 'block';
  loadSettings();
  renderOldLampList();
  renderNewLampList();
  renderOfferRequests();
}

function showLogin() {
  loginScreen.style.display = 'flex';
  adminPanel.style.display = 'none';
}

db.auth.getSession().then(({ data: { session } }) => {
  if (session) showPanel(); else showLogin();
});

db.auth.onAuthStateChange((event, session) => {
  if (session) showPanel(); else showLogin();
});

document.getElementById('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const email = document.getElementById('input-email').value.trim();
  const password = document.getElementById('input-password').value;
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) {
    document.getElementById('login-error').style.display = 'block';
    document.getElementById('input-password').value = '';
  }
});

document.getElementById('btn-logout').addEventListener('click', async () => {
  await db.auth.signOut();
});

// ── Settings ─────────────────────────────────────────────

async function loadSettings() {
  const s = await getSettings();
  document.getElementById('setting-kwh').value = s.kwhPrice;
  document.getElementById('setting-hours').value = s.annualHours;
}

document.getElementById('settings-form').addEventListener('submit', async e => {
  e.preventDefault();
  const kwhPrice = parseFloat(document.getElementById('setting-kwh').value);
  const annualHours = parseInt(document.getElementById('setting-hours').value);
  if (!kwhPrice || !annualHours) return;
  await saveSettings(kwhPrice, annualHours);
  showSavedFeedback(e.target.querySelector('button'));
});

function showSavedFeedback(btn) {
  const original = btn.textContent;
  btn.textContent = 'Lagret ✓';
  btn.disabled = true;
  setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 2000);
}

// ── Old lamps ─────────────────────────────────────────────

async function renderOldLampList() {
  const list = document.getElementById('old-lamp-list');
  const empty = document.getElementById('old-lamp-empty');
  list.innerHTML = '<p style="color:#aaa;font-size:0.9rem">Laster…</p>';

  const lamps = await getOldLamps();
  list.innerHTML = '';

  if (lamps.length === 0) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  lamps.forEach(lamp => {
    const row = document.createElement('div');
    row.className = 'lamp-row' + (oldEditingId === lamp.id ? ' editing' : '');
    const thumb = lamp.image ? `<img src="${lamp.image}" alt="${lamp.name}">` : '💡';
    const repNames = lamp.replacements.map(r => r.name).join(', ') || '—';
    row.innerHTML = `
      <div class="lamp-row-thumb">${thumb}</div>
      <div class="lamp-row-info">
        <div class="lamp-row-name">${lamp.name}</div>
        <div class="lamp-row-sub">${lamp.oldWatt}W &nbsp;·&nbsp; ${repNames}</div>
      </div>
      <div class="lamp-row-actions">
        <button class="btn-edit">Rediger</button>
        <button class="btn-delete">Slett</button>
      </div>
    `;
    row.querySelector('.btn-edit').addEventListener('click', () => startEditOldLamp(lamp));
    row.querySelector('.btn-delete').addEventListener('click', () => handleDeleteOldLamp(lamp.id));
    list.appendChild(row);
  });
}

async function handleDeleteOldLamp(id) {
  if (!confirm('Slett denne lampen?')) return;
  if (oldEditingId === id) cancelEditOldLamp();
  await deleteOldLamp(id);
  renderOldLampList();
}

async function startEditOldLamp(lamp) {
  oldEditingId = lamp.id;
  oldEditingImageUrl = lamp.image || null;
  oldImageFile = null;

  document.getElementById('old-lamp-name').value = lamp.name;
  document.getElementById('old-lamp-watt').value = lamp.oldWatt;
  document.getElementById('old-lamp-per-armature').value = lamp.lampsPerArmature || 1;
  document.getElementById('old-lamp-ballast').value = Math.round((lamp.oldBallast || 0) * 100);
  document.getElementById('old-lamp-lifespan').value = lamp.oldLifespan || '';
  document.getElementById('old-lamp-price').value = lamp.oldLampPrice || '';
  document.getElementById('old-lamp-labour').value = lamp.replacementLabour || '';

  const preview = document.getElementById('old-image-preview');
  if (lamp.image) {
    preview.innerHTML = `<img src="${lamp.image}" alt="Forhåndsvisning">`;
    preview.style.display = 'block';
  } else {
    preview.style.display = 'none';
    preview.innerHTML = '';
  }

  document.getElementById('old-lamp-form-title').textContent = 'Rediger gammel lampe';
  document.getElementById('old-lamp-submit').textContent = 'Lagre endringer';
  document.getElementById('old-lamp-cancel').style.display = 'block';

  // Load replacement checkboxes
  await renderReplacementCheckboxes(lamp.replacements.map(r => r.id));

  renderOldLampList();
  expandSection(document.getElementById('old-lamp-section'));
  document.getElementById('old-lamp-section').scrollIntoView({ behavior: 'smooth' });
}

function cancelEditOldLamp() {
  oldEditingId = null;
  oldEditingImageUrl = null;
  oldImageFile = null;
  document.getElementById('old-lamp-form').reset();
  document.getElementById('old-image-preview').style.display = 'none';
  document.getElementById('old-image-preview').innerHTML = '';
  document.getElementById('old-lamp-form-title').textContent = 'Legg til gammel lampe';
  document.getElementById('old-lamp-submit').textContent = 'Legg til';
  document.getElementById('old-lamp-submit').disabled = false;
  document.getElementById('old-lamp-cancel').style.display = 'none';
  document.getElementById('replacement-checkboxes').innerHTML = '';
  renderOldLampList();
}

document.getElementById('old-lamp-cancel').addEventListener('click', cancelEditOldLamp);

document.getElementById('old-lamp-image').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  oldImageFile = file;
  const reader = new FileReader();
  reader.onload = ev => {
    const preview = document.getElementById('old-image-preview');
    preview.innerHTML = `<img src="${ev.target.result}" alt="Forhåndsvisning">`;
    preview.style.display = 'block';
  };
  reader.readAsDataURL(file);
});

async function renderReplacementCheckboxes(selectedIds = []) {
  const container = document.getElementById('replacement-checkboxes');
  const newLamps = await getNewLamps();

  if (newLamps.length === 0) {
    container.innerHTML = '<p style="color:#aaa;font-size:0.85rem">Ingen nye lamper lagt til ennå.</p>';
    return;
  }

  container.innerHTML = '';
  newLamps.forEach(lamp => {
    const label = document.createElement('label');
    label.className = 'checkbox-label';
    label.innerHTML = `
      <input type="checkbox" value="${lamp.id}" ${selectedIds.includes(lamp.id) ? 'checked' : ''}>
      ${lamp.name} (${lamp.newWatt}W)
    `;
    container.appendChild(label);
  });
}

document.getElementById('old-lamp-form').addEventListener('submit', async e => {
  e.preventDefault();
  const name = document.getElementById('old-lamp-name').value.trim();
  const oldWatt = parseInt(document.getElementById('old-lamp-watt').value);
  if (!name || !oldWatt) return;

  const btn = document.getElementById('old-lamp-submit');
  btn.disabled = true;
  btn.textContent = 'Lagrer…';

  try {
    const lampData = {
      name,
      oldWatt,
      lampsPerArmature: parseInt(document.getElementById('old-lamp-per-armature').value) || 1,
      oldBallast: (parseFloat(document.getElementById('old-lamp-ballast').value) || 0) / 100,
      oldLifespan: parseInt(document.getElementById('old-lamp-lifespan').value) || 2000,
      oldLampPrice: parseFloat(document.getElementById('old-lamp-price').value) || 0,
      replacementLabour: parseFloat(document.getElementById('old-lamp-labour').value) || 0,
    };

    const checkedIds = [...document.querySelectorAll('#replacement-checkboxes input:checked')].map(i => i.value);

    if (oldEditingId) {
      await updateOldLamp(oldEditingId, lampData, oldImageFile, oldEditingImageUrl);
      await setLampReplacements(oldEditingId, checkedIds);
      cancelEditOldLamp();
    } else {
      const created = await addOldLamp(lampData, oldImageFile);
      if (created) await setLampReplacements(created.id, checkedIds);
      e.target.reset();
      oldImageFile = null;
      document.getElementById('old-image-preview').style.display = 'none';
      document.getElementById('old-image-preview').innerHTML = '';
      document.getElementById('replacement-checkboxes').innerHTML = '';
    }
  } finally {
    btn.disabled = false;
    btn.textContent = oldEditingId ? 'Lagre endringer' : 'Legg til';
  }

  renderOldLampList();
});

// ── New lamps ─────────────────────────────────────────────

async function renderNewLampList() {
  const list = document.getElementById('new-lamp-list');
  const empty = document.getElementById('new-lamp-empty');
  list.innerHTML = '<p style="color:#aaa;font-size:0.9rem">Laster…</p>';

  const lamps = await getNewLamps();
  list.innerHTML = '';

  if (lamps.length === 0) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  lamps.forEach(lamp => {
    const row = document.createElement('div');
    row.className = 'lamp-row' + (newEditingId === lamp.id ? ' editing' : '');
    const thumb = lamp.image ? `<img src="${lamp.image}" alt="${lamp.name}">` : '💡';
    row.innerHTML = `
      <div class="lamp-row-thumb">${thumb}</div>
      <div class="lamp-row-info">
        <div class="lamp-row-name">${lamp.name}</div>
        <div class="lamp-row-sub">${lamp.newWatt}W &nbsp;·&nbsp; ${lamp.ledInvestment} kr/armatur</div>
      </div>
      <div class="lamp-row-actions">
        <button class="btn-edit">Rediger</button>
        <button class="btn-delete">Slett</button>
      </div>
    `;
    row.querySelector('.btn-edit').addEventListener('click', () => startEditNewLamp(lamp));
    row.querySelector('.btn-delete').addEventListener('click', () => handleDeleteNewLamp(lamp.id));
    list.appendChild(row);
  });
}

async function handleDeleteNewLamp(id) {
  if (!confirm('Slett denne lampen?')) return;
  if (newEditingId === id) cancelEditNewLamp();
  await deleteNewLamp(id);
  renderNewLampList();
}

function startEditNewLamp(lamp) {
  newEditingId = lamp.id;
  newEditingImageUrl = lamp.image || null;
  newImageFile = null;

  document.getElementById('new-lamp-name').value = lamp.name;
  document.getElementById('new-lamp-watt').value = lamp.newWatt;
  document.getElementById('new-lamp-per-armature').value = lamp.lampsPerArmature || 1;
  document.getElementById('new-lamp-lifespan').value = lamp.newLifespan || '';
  document.getElementById('new-lamp-price').value = lamp.newLampPrice || '';
  document.getElementById('new-lamp-labour').value = lamp.newLabour || '';
  document.getElementById('new-lamp-investment').value = lamp.ledInvestment || '';

  const preview = document.getElementById('new-image-preview');
  if (lamp.image) {
    preview.innerHTML = `<img src="${lamp.image}" alt="Forhåndsvisning">`;
    preview.style.display = 'block';
  } else {
    preview.style.display = 'none';
    preview.innerHTML = '';
  }

  document.getElementById('new-lamp-form-title').textContent = 'Rediger ny lampe';
  document.getElementById('new-lamp-submit').textContent = 'Lagre endringer';
  document.getElementById('new-lamp-cancel').style.display = 'block';

  renderNewLampList();
  expandSection(document.getElementById('new-lamp-section'));
  document.getElementById('new-lamp-section').scrollIntoView({ behavior: 'smooth' });
}

function cancelEditNewLamp() {
  newEditingId = null;
  newEditingImageUrl = null;
  newImageFile = null;
  document.getElementById('new-lamp-form').reset();
  document.getElementById('new-image-preview').style.display = 'none';
  document.getElementById('new-image-preview').innerHTML = '';
  document.getElementById('new-lamp-form-title').textContent = 'Legg til ny lampe';
  document.getElementById('new-lamp-submit').textContent = 'Legg til';
  document.getElementById('new-lamp-submit').disabled = false;
  document.getElementById('new-lamp-cancel').style.display = 'none';
  document.getElementById('new-lamp-per-armature').value = 1;
  renderNewLampList();
}

document.getElementById('new-lamp-cancel').addEventListener('click', cancelEditNewLamp);

document.getElementById('new-lamp-image').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  newImageFile = file;
  const reader = new FileReader();
  reader.onload = ev => {
    const preview = document.getElementById('new-image-preview');
    preview.innerHTML = `<img src="${ev.target.result}" alt="Forhåndsvisning">`;
    preview.style.display = 'block';
  };
  reader.readAsDataURL(file);
});

document.getElementById('new-lamp-form').addEventListener('submit', async e => {
  e.preventDefault();
  const name = document.getElementById('new-lamp-name').value.trim();
  const newWatt = parseInt(document.getElementById('new-lamp-watt').value);
  if (!name || !newWatt) return;

  const btn = document.getElementById('new-lamp-submit');
  btn.disabled = true;
  btn.textContent = 'Lagrer…';

  try {
    const lampData = {
      name,
      newWatt,
      lampsPerArmature: parseInt(document.getElementById('new-lamp-per-armature').value) || 1,
      newLifespan: parseInt(document.getElementById('new-lamp-lifespan').value) || null,
      newLampPrice: parseFloat(document.getElementById('new-lamp-price').value) || 0,
      newLabour: parseFloat(document.getElementById('new-lamp-labour').value) || 0,
      ledInvestment: parseFloat(document.getElementById('new-lamp-investment').value) || 0,
    };

    if (newEditingId) {
      await updateNewLamp(newEditingId, lampData, newImageFile, newEditingImageUrl);
      cancelEditNewLamp();
    } else {
      await addNewLamp(lampData, newImageFile);
      e.target.reset();
      newImageFile = null;
      document.getElementById('new-image-preview').style.display = 'none';
      document.getElementById('new-image-preview').innerHTML = '';
    }
  } finally {
    btn.disabled = false;
    btn.textContent = newEditingId ? 'Lagre endringer' : 'Legg til';
  }

  renderNewLampList();
});

// ── Offer requests ────────────────────────────────────────

async function renderOfferRequests() {
  const container = document.getElementById('offer-requests-list');
  const emptyEl = document.getElementById('offers-empty-msg');
  container.innerHTML = '<p style="color:#aaa;font-size:0.9rem">Laster…</p>';

  const requests = await getOfferRequests();
  container.innerHTML = '';

  if (requests.length === 0) { emptyEl.style.display = 'block'; return; }
  emptyEl.style.display = 'none';

  requests.forEach(r => {
    const date = new Date(r.created_at).toLocaleDateString('nb-NO', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    const row = document.createElement('div');
    row.className = 'offer-row';
    row.innerHTML = `
      <div class="offer-info">
        <div class="offer-name">${r.visitor_name}</div>
        <div class="offer-sub">${r.lamp_name} · ${r.num_armatures} stk</div>
      </div>
      <div class="offer-contact">
        <a href="mailto:${r.email}">${r.email}</a>
        ${r.phone ? `<span>${r.phone}</span>` : ''}
      </div>
      <div class="offer-date">${date}</div>
    `;
    container.appendChild(row);
  });
}

document.getElementById('btn-refresh-offers').addEventListener('click', renderOfferRequests);
