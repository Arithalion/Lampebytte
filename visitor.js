// ── TCO calculation ──────────────────────────────────────

function calcTCO(oldLamp, newLamp, numArmatures, settings) {
  const { kwhPrice, annualHours } = settings;
  const lamps = oldLamp.lampsPerArmature || 1;
  const ballast = oldLamp.oldBallast || 0;

  const oldPowerKw = (oldLamp.oldWatt * lamps * (1 + ballast) * numArmatures) / 1000;
  const oldKwhAnnual = oldPowerKw * annualHours;
  const oldEnergyCostAnnual = oldKwhAnnual * kwhPrice;

  const yearsPerReplacement = oldLamp.oldLifespan / annualHours;
  const maintenance10yr = (oldLamp.oldLampPrice + oldLamp.replacementLabour) * lamps * numArmatures * (10 / yearsPerReplacement);
  const oldMaintenanceCostAnnual = maintenance10yr / 10;
  const oldAnnualOpCost = oldEnergyCostAnnual + oldMaintenanceCostAnnual;

  const newLamps = newLamp.lampsPerArmature || lamps;
  const newPowerKw = (newLamp.newWatt * newLamps * numArmatures) / 1000;
  const newKwhAnnual = newPowerKw * annualHours;
  const newEnergyCostAnnual = newKwhAnnual * kwhPrice;

  let newMaintenanceCostAnnual = 0;
  if (newLamp.newLifespan) {
    const newYearsPerReplacement = newLamp.newLifespan / annualHours;
    const newMaintenance10yr = ((newLamp.newLampPrice || 0) + (newLamp.newLabour || 0)) * newLamps * numArmatures * (10 / newYearsPerReplacement);
    newMaintenanceCostAnnual = newMaintenance10yr / 10;
  }
  const newAnnualOpCost = newEnergyCostAnnual + newMaintenanceCostAnnual;

  const annualKwhSavings = oldKwhAnnual - newKwhAnnual;
  const energySavingsAnnual = oldEnergyCostAnnual - newEnergyCostAnnual;
  const maintenanceSavingsAnnual = oldMaintenanceCostAnnual - newMaintenanceCostAnnual;
  const annualTotalSavings = oldAnnualOpCost - newAnnualOpCost;

  const totalInvestment = newLamp.ledInvestment * numArmatures;
  const paybackYears = annualTotalSavings > 0 ? totalInvestment / annualTotalSavings : null;
  const co2TonnesAnnual = (annualKwhSavings * 300) / 1_000_000;
  const wattReductionPct = Math.round(((oldLamp.oldWatt - newLamp.newWatt) / oldLamp.oldWatt) * 100);

  return {
    annualKwhSavings: annualKwhSavings.toFixed(0),
    energySavingsAnnual: energySavingsAnnual.toFixed(0),
    maintenanceSavingsAnnual: maintenanceSavingsAnnual.toFixed(0),
    annualTotalSavings: annualTotalSavings.toFixed(0),
    totalInvestment: totalInvestment.toFixed(0),
    paybackYears: paybackYears ? paybackYears.toFixed(1) : '—',
    co2TonnesAnnual: co2TonnesAnnual.toFixed(2),
    wattReductionPct,
  };
}

function nok(val) {
  return Number(val).toLocaleString('nb-NO') + ' kr';
}

// ── Render grid ──────────────────────────────────────────

const grid = document.getElementById('lamp-grid');
const emptyState = document.getElementById('empty-state');

async function renderGrid() {
  grid.innerHTML = '<p style="color:#aaa;padding:20px 0">Laster lamper…</p>';
  const lamps = await getOldLamps();
  grid.innerHTML = '';

  if (lamps.length === 0) {
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';

  lamps.forEach(lamp => {
    const card = document.createElement('div');
    card.className = 'lamp-card';
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', lamp.name);

    card.innerHTML = `
      <div class="lamp-image">${lamp.image ? `<img src="${lamp.image}" alt="${lamp.name}">` : '💡'}</div>
      <div class="lamp-name">${lamp.name}</div>
    `;

    card.addEventListener('click', () => openModal(lamp));
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') openModal(lamp);
    });

    grid.appendChild(card);
  });
}

// ── Modal ────────────────────────────────────────────────

const overlay = document.getElementById('modal-overlay');
const contactForm = document.getElementById('contact-form');
const successMsg = document.getElementById('success-msg');
const actionButtons = document.getElementById('action-buttons');

let currentLamp = null;
let selectedReplacement = null;
let cachedSettings = { kwhPrice: 1.50, annualHours: 3120 };

function openModal(lamp) {
  currentLamp = lamp;
  selectedReplacement = lamp.replacements[0] || null;

  document.getElementById('modal-old-name').textContent = lamp.name;
  document.getElementById('modal-old-image').innerHTML = lamp.image
    ? `<img src="${lamp.image}" alt="${lamp.name}">` : '💡';

  document.getElementById('input-antall').value = 1;

  contactForm.classList.remove('visible');
  successMsg.classList.remove('visible');
  actionButtons.style.display = 'flex';
  document.getElementById('input-name').value = '';
  document.getElementById('input-email').value = '';
  document.getElementById('input-phone').value = '';

  renderReplacementSelector();
  updateEstimate();

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  overlay.classList.remove('open');
  document.body.style.overflow = '';
  currentLamp = null;
  selectedReplacement = null;
}

function renderReplacementSelector() {
  const container = document.getElementById('replacement-selector');
  const replacements = currentLamp?.replacements || [];

  if (replacements.length <= 1) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  container.innerHTML = '<p class="selector-label">Velg erstatning:</p>';

  replacements.forEach(r => {
    const btn = document.createElement('button');
    btn.className = 'replacement-btn' + (r.id === selectedReplacement?.id ? ' active' : '');
    btn.textContent = r.name;
    btn.addEventListener('click', () => {
      selectedReplacement = r;
      container.querySelectorAll('.replacement-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateNewLampImage();
      updateEstimate();
    });
    container.appendChild(btn);
  });

  updateNewLampImage();
}

function updateNewLampImage() {
  document.getElementById('modal-new-name').textContent = selectedReplacement?.name || '—';
  document.getElementById('modal-new-image').innerHTML = selectedReplacement?.image
    ? `<img src="${selectedReplacement.image}" alt="${selectedReplacement.name}">` : '💡';
}

function updateEstimate() {
  if (!currentLamp || !selectedReplacement) {
    document.getElementById('modal-estimate').innerHTML =
      '<p style="color:#aaa;font-size:0.9rem">Ingen erstatning koblet til denne lampen ennå.</p>';
    return;
  }

  const num = Math.max(1, parseInt(document.getElementById('input-antall').value) || 1);
  const s = calcTCO(currentLamp, selectedReplacement, num, cachedSettings);

  document.getElementById('modal-estimate').innerHTML = `
    <h4>Beregnet energibesparelse</h4>
    <div class="estimate-row"><span>Effektreduksjon</span><strong>${s.wattReductionPct}%</strong></div>
    <div class="estimate-row"><span>kWh spart per år</span><strong>${Number(s.annualKwhSavings).toLocaleString('nb-NO')} kWh</strong></div>
    <div class="estimate-row"><span>Energibesparelse per år</span><strong>${nok(s.energySavingsAnnual)}</strong></div>
    <div class="estimate-row"><span>Vedlikeholdsbesparelse per år</span><strong>${nok(s.maintenanceSavingsAnnual)}</strong></div>
    <div class="estimate-row estimate-total"><span>Total driftsbesparelse per år</span><strong>${nok(s.annualTotalSavings)}</strong></div>
    <div class="estimate-row"><span>Investering (estimert)</span><strong>${nok(s.totalInvestment)}</strong></div>
    <div class="estimate-row"><span>Tilbakebetalingstid</span><strong>${s.paybackYears === '—' ? '—' : s.paybackYears + ' år'}</strong></div>
    <div class="estimate-row"><span>CO₂-besparelse per år</span><strong>${s.co2TonnesAnnual} tonn</strong></div>
    <p class="estimate-disclaimer">Beregnet med ${cachedSettings.annualHours} timer/år og ${cachedSettings.kwhPrice.toFixed(2).replace('.', ',')} kr/kWh</p>
  `;
}

document.getElementById('input-antall').addEventListener('input', updateEstimate);
overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
document.getElementById('close-btn').addEventListener('click', closeModal);

document.getElementById('btn-offer').addEventListener('click', () => {
  contactForm.classList.add('visible');
  actionButtons.style.display = 'none';
});

document.getElementById('btn-cancel').addEventListener('click', closeModal);

document.getElementById('btn-back').addEventListener('click', () => {
  contactForm.classList.remove('visible');
  actionButtons.style.display = 'flex';
});

document.getElementById('btn-submit').addEventListener('click', async () => {
  const name = document.getElementById('input-name').value.trim();
  const email = document.getElementById('input-email').value.trim();
  if (!name) { document.getElementById('input-name').focus(); return; }
  if (!email || !email.includes('@')) { document.getElementById('input-email').focus(); return; }

  const antall = parseInt(document.getElementById('input-antall').value) || 1;
  const phone = document.getElementById('input-phone').value.trim();
  await submitOfferRequest(currentLamp.id, currentLamp.name, antall, name, email, phone);

  contactForm.classList.remove('visible');
  successMsg.classList.add('visible');
});

document.getElementById('btn-done').addEventListener('click', closeModal);

// ── Init ─────────────────────────────────────────────────
async function init() {
  cachedSettings = await getSettings();
  await renderGrid();
}

init();
