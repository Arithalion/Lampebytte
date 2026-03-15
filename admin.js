const ADMIN_PASSWORD = 'Hrs1234567890!';
const SESSION_KEY = 'lampebytte_admin_session';

let editingId = null;
let editingImageUrl = null; // existing image URL when editing
let uploadedImageFile = null; // new file selected by admin

// ── Auth ─────────────────────────────────────────────────

const loginScreen = document.getElementById('login-screen');
const adminPanel = document.getElementById('admin-panel');

function isLoggedIn() {
  return sessionStorage.getItem(SESSION_KEY) === 'yes';
}

async function showPanel() {
  loginScreen.style.display = 'none';
  adminPanel.style.display = 'block';
  await Promise.all([loadSettings(), renderLampList(), renderOfferRequests()]);
}

function showLogin() {
  loginScreen.style.display = 'flex';
  adminPanel.style.display = 'none';
}

if (isLoggedIn()) {
  showPanel();
} else {
  showLogin();
}

document.getElementById('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const pw = document.getElementById('input-password').value;
  if (pw === ADMIN_PASSWORD) {
    sessionStorage.setItem(SESSION_KEY, 'yes');
    await showPanel();
  } else {
    document.getElementById('login-error').style.display = 'block';
    document.getElementById('input-password').value = '';
    document.getElementById('input-password').focus();
  }
});

document.getElementById('btn-logout').addEventListener('click', () => {
  sessionStorage.removeItem(SESSION_KEY);
  showLogin();
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
  setTimeout(() => {
    btn.textContent = original;
    btn.disabled = false;
  }, 2000);
}

// ── Lamp list ────────────────────────────────────────────

const lampList = document.getElementById('lamp-list');
const emptyMsg = document.getElementById('empty-msg');

async function renderLampList() {
  lampList.innerHTML = '<p style="color:#aaa;font-size:0.9rem">Laster…</p>';
  const lamps = await getLamps();
  lampList.innerHTML = '';

  if (lamps.length === 0) {
    emptyMsg.style.display = 'block';
    return;
  }

  emptyMsg.style.display = 'none';

  lamps.forEach(lamp => {
    const row = document.createElement('div');
    row.className = 'lamp-row';
    if (editingId === lamp.id) row.classList.add('editing');

    const thumb = lamp.image
      ? `<img src="${lamp.image}" alt="${lamp.name}">`
      : '<span class="thumb-placeholder">💡</span>';

    row.innerHTML = `
      <div class="lamp-row-thumb">${thumb}</div>
      <div class="lamp-row-info">
        <div class="lamp-row-name">${lamp.name}</div>
        <div class="lamp-row-sub">${lamp.oldWatt}W → ${lamp.newWatt}W &nbsp;·&nbsp; ${lamp.replacement}</div>
      </div>
      <div class="lamp-row-actions">
        <button class="btn-edit">Rediger</button>
        <button class="btn-delete">Slett</button>
      </div>
    `;

    row.querySelector('.btn-edit').addEventListener('click', () => startEdit(lamp));
    row.querySelector('.btn-delete').addEventListener('click', () => handleDelete(lamp.id));
    lampList.appendChild(row);
  });
}

async function handleDelete(id) {
  if (!confirm('Slett denne lampen?')) return;
  if (editingId === id) cancelEdit();
  await deleteLampFromDb(id);
  await renderLampList();
}

// ── Edit mode ────────────────────────────────────────────

const formTitle = document.getElementById('form-title');
const submitBtn = document.getElementById('btn-submit-lamp');
const cancelBtn = document.getElementById('btn-cancel-edit');

function startEdit(lamp) {
  editingId = lamp.id;
  editingImageUrl = lamp.image || null;
  uploadedImageFile = null;

  document.getElementById('input-name').value = lamp.name;
  document.getElementById('input-replacement').value = lamp.replacement;
  document.getElementById('input-old-watt').value = lamp.oldWatt;
  document.getElementById('input-new-watt').value = lamp.newWatt;
  document.getElementById('input-lamps-per-armature').value = lamp.lampsPerArmature || 1;
  document.getElementById('input-ballast').value = Math.round((lamp.oldBallast || 0) * 100);
  document.getElementById('input-old-lifespan').value = lamp.oldLifespan || '';
  document.getElementById('input-lamp-price').value = lamp.oldLampPrice || '';
  document.getElementById('input-labour').value = lamp.replacementLabour || '';
  document.getElementById('input-led-investment').value = lamp.ledInvestment || '';

  const preview = document.getElementById('image-preview');
  if (lamp.image) {
    preview.innerHTML = `<img src="${lamp.image}" alt="Forhåndsvisning">`;
    preview.style.display = 'block';
  } else {
    preview.style.display = 'none';
    preview.innerHTML = '';
  }

  formTitle.textContent = 'Rediger lampe';
  submitBtn.textContent = 'Lagre endringer';
  cancelBtn.style.display = 'block';

  renderLampList();
  document.getElementById('add-lamp-section').scrollIntoView({ behavior: 'smooth' });
}

function cancelEdit() {
  editingId = null;
  editingImageUrl = null;
  uploadedImageFile = null;
  document.getElementById('add-lamp-form').reset();
  document.getElementById('image-preview').style.display = 'none';
  document.getElementById('image-preview').innerHTML = '';
  formTitle.textContent = 'Legg til lampe';
  submitBtn.textContent = 'Legg til lampe';
  cancelBtn.style.display = 'none';
  renderLampList();
}

cancelBtn.addEventListener('click', cancelEdit);

// ── Image upload ─────────────────────────────────────────

document.getElementById('input-image').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  uploadedImageFile = file;
  const preview = document.getElementById('image-preview');
  const reader = new FileReader();
  reader.onload = ev => {
    preview.innerHTML = `<img src="${ev.target.result}" alt="Forhåndsvisning">`;
    preview.style.display = 'block';
  };
  reader.readAsDataURL(file);
});

// ── Add / Save lamp form ──────────────────────────────────

document.getElementById('add-lamp-form').addEventListener('submit', async e => {
  e.preventDefault();

  const name = document.getElementById('input-name').value.trim();
  const replacement = document.getElementById('input-replacement').value.trim();
  const oldWatt = parseInt(document.getElementById('input-old-watt').value);
  const newWatt = parseInt(document.getElementById('input-new-watt').value);

  if (!name || !replacement || !oldWatt || !newWatt) return;

  submitBtn.disabled = true;
  submitBtn.textContent = 'Lagrer…';

  const lampData = {
    name,
    replacement,
    oldWatt,
    newWatt,
    lampsPerArmature: parseInt(document.getElementById('input-lamps-per-armature').value) || 1,
    oldBallast: (parseFloat(document.getElementById('input-ballast').value) || 0) / 100,
    oldLifespan: parseInt(document.getElementById('input-old-lifespan').value) || 2000,
    oldLampPrice: parseFloat(document.getElementById('input-lamp-price').value) || 0,
    replacementLabour: parseFloat(document.getElementById('input-labour').value) || 0,
    ledInvestment: parseFloat(document.getElementById('input-led-investment').value) || 0,
  };

  if (editingId) {
    await updateLamp(editingId, lampData, uploadedImageFile, editingImageUrl);
    cancelEdit();
  } else {
    await addLamp(lampData, uploadedImageFile);
    e.target.reset();
    uploadedImageFile = null;
    document.getElementById('image-preview').style.display = 'none';
    document.getElementById('image-preview').innerHTML = '';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Legg til lampe';
  }

  await renderLampList();
  document.getElementById('lamp-list-section').scrollIntoView({ behavior: 'smooth' });
});

// ── Offer requests ────────────────────────────────────────

async function renderOfferRequests() {
  const container = document.getElementById('offer-requests-list');
  const emptyEl = document.getElementById('offers-empty-msg');
  container.innerHTML = '<p style="color:#aaa;font-size:0.9rem">Laster…</p>';

  const requests = await getOfferRequests();
  container.innerHTML = '';

  if (requests.length === 0) {
    emptyEl.style.display = 'block';
    return;
  }

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
