import { supabase } from './supabase.js';
import {
  STEPS, STEP_DATA, KPI_FIELDS, KPI_LABELS, COMPANY_FIELDS, ROLE_FIELDS,
  applyChoice, getNextStep, getStepLabel, fmtDelta,
} from './game-data.js';

// ── Config ──────────────────────────────────────────────────
const ADMIN_PASSWORD = 'admin';
const SESSION_ID = crypto.randomUUID();

// ── DOM refs ────────────────────────────────────────────────
const authScreen   = document.getElementById('auth-screen');
const adminUi      = document.getElementById('admin-ui');
const authBtn      = document.getElementById('auth-btn');
const authError    = document.getElementById('auth-error');
const passInput    = document.getElementById('admin-password');
const lockBanner   = document.getElementById('lock-banner');

const phaseIndicator = document.getElementById('phase-indicator');
const adminProgress  = document.getElementById('admin-progress');
const kpiDashboard   = document.getElementById('kpi-dashboard');
const playerCount    = document.getElementById('player-count');
const playersList    = document.getElementById('players-list');

const stateWaiting   = document.getElementById('state-waiting');
const stateSituation = document.getElementById('state-situation');
const stateEnded     = document.getElementById('state-ended');

const startBtn = document.getElementById('start-btn');
const backBtn  = document.getElementById('back-btn');
const resetBtn = document.getElementById('reset-btn');
const btnA     = document.getElementById('btn-a');
const btnB     = document.getElementById('btn-b');

// ── State ───────────────────────────────────────────────────
let gameState = null;
let players   = [];
let isLocked  = false;    // true = another admin controls
let debouncing = false;

// ── Auth ────────────────────────────────────────────────────
function checkAuth() {
  if (sessionStorage.getItem('novatech_admin') === '1') {
    authScreen.style.display = 'none';
    adminUi.style.display    = 'block';
    return true;
  }
  return false;
}

authBtn.addEventListener('click', () => {
  if (passInput.value === ADMIN_PASSWORD) {
    sessionStorage.setItem('novatech_admin', '1');
    authScreen.style.display = 'none';
    adminUi.style.display    = 'block';
    initAdmin();
  } else {
    authError.textContent = 'รหัสผ่านไม่ถูกต้อง';
    authError.style.display = 'block';
  }
});
passInput.addEventListener('keydown', e => { if (e.key === 'Enter') authBtn.click(); });

if (checkAuth()) initAdmin();

// ── Init ────────────────────────────────────────────────────
async function initAdmin() {
  await loadAll();
  await acquireLock();
  renderAll();
  subscribeToChanges();
}

async function loadAll() {
  const [gsRes, playersRes] = await Promise.all([
    supabase.from('game_state').select('*').eq('id', 1).single(),
    supabase.from('players').select('*').order('created_at'),
  ]);
  gameState = gsRes.data;
  players   = playersRes.data || [];
}

// ── Admin lock ──────────────────────────────────────────────
async function acquireLock() {
  if (!gameState) return;

  // If no admin is controlling, claim it
  if (!gameState.admin_session_id) {
    const { error } = await supabase.from('game_state')
      .update({ admin_session_id: SESSION_ID })
      .eq('id', 1)
      .is('admin_session_id', null);
    if (!error) {
      gameState.admin_session_id = SESSION_ID;
      isLocked = false;
    } else {
      isLocked = true;
    }
  } else if (gameState.admin_session_id === SESSION_ID) {
    isLocked = false;
  } else {
    isLocked = true;
  }

  lockBanner.style.display = isLocked ? 'block' : 'none';
  updateControlState();
}

function updateControlState() {
  const disabled = isLocked;
  startBtn.disabled = disabled;
  btnA.disabled     = disabled;
  btnB.disabled     = disabled;
  backBtn.disabled  = disabled || !gameState?.history?.length;
  resetBtn.disabled = disabled;
}

// ── Render ──────────────────────────────────────────────────
function renderAll() {
  renderProgress();
  renderKpiDashboard();
  renderMainState();
  renderPlayers();
  updateControlState();
}

function renderProgress() {
  adminProgress.innerHTML = '';
  const currentStep = gameState?.current_step ?? 'waiting';
  const currentIdx  = STEPS.indexOf(currentStep);

  STEPS.forEach((stepId, i) => {
    const step = STEP_DATA[stepId];
    const el = document.createElement('div');
    el.className = 'progress-step';
    el.textContent = step.type === 'popup' ? `P${step.number}` : `S${step.number}`;
    if (i === currentIdx) el.classList.add('active');
    else if (i < currentIdx || currentStep === 'ended') el.classList.add('done');
    adminProgress.appendChild(el);
  });

  phaseIndicator.textContent = currentStep === 'waiting' ? 'ยังไม่เริ่ม'
    : currentStep === 'ended' ? 'เกมจบแล้ว'
    : getStepLabel(currentStep);
}

function renderKpiDashboard() {
  if (!gameState) return;
  kpiDashboard.innerHTML = '';

  for (const field of KPI_FIELDS) {
    const val = gameState[field] ?? 50;
    const el = document.createElement('div');
    el.style.cssText = 'background:var(--surface); border-radius:8px; padding:12px; text-align:center;';
    const color = val <= 0 ? '#f05252' : val <= 25 ? '#f59e0b' : '#e8eaf0';
    el.innerHTML = `
      <div style="font-size:11px; color:var(--text-muted); margin-bottom:4px; text-transform:uppercase;">${KPI_LABELS[field]}</div>
      <div style="font-size:22px; font-weight:700; color:${color};">${val}</div>
    `;
    kpiDashboard.appendChild(el);
  }
}

function renderMainState() {
  const step = gameState?.current_step ?? 'waiting';

  stateWaiting.style.display   = step === 'waiting' ? 'block' : 'none';
  stateSituation.style.display = (step !== 'waiting' && step !== 'ended') ? 'block' : 'none';
  stateEnded.style.display     = step === 'ended' ? 'block' : 'none';

  if (step !== 'waiting' && step !== 'ended') {
    renderSituation(step);
  }

  if (step === 'ended') {
    renderEndSummary();
  }
}

function renderSituation(stepId) {
  const step = STEP_DATA[stepId];
  if (!step) return;

  const typeEl = document.getElementById('sit-type');
  typeEl.textContent = getStepLabel(stepId);
  typeEl.className = `situation-type${step.type === 'popup' ? ' popup' : ''}`;

  document.getElementById('sit-title').textContent = step.title;
  document.getElementById('sit-desc').textContent  = step.description;

  document.getElementById('opt-a-title').textContent = step.optionA.label;
  document.getElementById('opt-a-desc').textContent  = step.optionA.description;
  document.getElementById('opt-b-title').textContent = step.optionB.label;
  document.getElementById('opt-b-desc').textContent  = step.optionB.description;

  // Show deltas preview
  renderDeltaPreview('opt-a-deltas', step.optionA.deltas);
  renderDeltaPreview('opt-b-deltas', step.optionB.deltas);
}

function renderDeltaPreview(elId, deltas) {
  const el = document.getElementById(elId);
  el.innerHTML = '';
  for (const field of KPI_FIELDS) {
    const d = deltas[field] ?? 0;
    if (d === 0) continue;
    const span = document.createElement('span');
    span.className = `delta-chip ${d > 0 ? 'pos' : 'neg'}`;
    span.textContent = `${KPI_LABELS[field]}: ${fmtDelta(d)}`;
    span.style.cssText = 'margin:2px; font-size:11px;';
    el.appendChild(span);
  }
}

function renderEndSummary() {
  const el = document.getElementById('end-summary');
  if (!gameState) return;

  const history = gameState.history || [];
  let html = '<div style="margin-bottom:16px;">';
  html += '<div style="font-weight:700; margin-bottom:8px;">ประวัติการตัดสินใจ:</div>';
  for (const snap of history) {
    const step = STEP_DATA[snap.stepId];
    const label = step ? getStepLabel(snap.stepId) : snap.stepId;
    const opt = snap.decision === 'A' ? step?.optionA : step?.optionB;
    html += `<div style="margin-bottom:6px; font-size:13px;">
      <strong>${label}</strong>: เลือก <span style="color:${snap.decision === 'A' ? '#4f8ef7' : '#f59e0b'}; font-weight:700;">${snap.decision}</span>
      ${opt ? `— ${opt.label}` : ''}
    </div>`;
  }
  html += '</div>';

  html += '<div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:8px;">';
  for (const field of KPI_FIELDS) {
    const val = gameState[field] ?? 50;
    const color = val <= 0 ? '#f05252' : val <= 25 ? '#f59e0b' : '#22c55e';
    html += `<div style="background:var(--surface); border-radius:6px; padding:10px; text-align:center;">
      <div style="font-size:11px; color:var(--text-muted);">${KPI_LABELS[field]}</div>
      <div style="font-size:18px; font-weight:700; color:${color};">${val}</div>
    </div>`;
  }
  html += '</div>';

  el.innerHTML = html;
}

function renderPlayers() {
  playerCount.textContent = players.length;
  if (players.length === 0) {
    playersList.textContent = 'ยังไม่มีผู้เล่น';
    return;
  }
  playersList.innerHTML = players.map(p =>
    `<span style="display:inline-block; background:var(--surface); border-radius:4px; padding:4px 8px; margin:3px; font-size:12px;">
      ${p.name} <span style="color:var(--primary); font-weight:600;">(${p.role})</span>
    </span>`
  ).join('');
}

// ── Actions ─────────────────────────────────────────────────

// Start game
startBtn.addEventListener('click', async () => {
  if (isLocked) return;
  startBtn.disabled = true;

  const { error } = await supabase.from('game_state').update({
    current_step: STEPS[0],
    updated_at: new Date().toISOString(),
  }).eq('id', 1);

  if (error) {
    showToast('ไม่สามารถเริ่มเกมได้', 'error');
    startBtn.disabled = false;
  } else {
    showToast('เริ่มเกมแล้ว!', 'success');
  }
});

// Choose A or B
btnA.addEventListener('click', () => handleChoice('A'));
btnB.addEventListener('click', () => handleChoice('B'));

async function handleChoice(choice) {
  if (isLocked || debouncing) return;
  debouncing = true;
  btnA.disabled = true;
  btnB.disabled = true;

  const currentStep = gameState.current_step;
  const stepData = STEP_DATA[currentStep];
  if (!stepData) { debouncing = false; return; }

  // 1. Save snapshot to history
  const snapshot = {
    stepId: currentStep,
    kpis: {},
    decision: choice,
  };
  for (const f of KPI_FIELDS) snapshot.kpis[f] = gameState[f] ?? 50;

  const newHistory = [...(gameState.history || []), snapshot];

  // 2. Apply KPI changes
  const newKpis = applyChoice(gameState, currentStep, choice);

  // 3. Move to next step
  const nextStep = getNextStep(currentStep);

  // 4. Update Supabase
  const update = {
    current_step: nextStep,
    history: newHistory,
    updated_at: new Date().toISOString(),
    ...newKpis,
  };

  const { error } = await supabase.from('game_state').update(update).eq('id', 1);

  if (error) {
    showToast('เกิดข้อผิดพลาด', 'error');
  } else {
    const opt = choice === 'A' ? stepData.optionA : stepData.optionB;
    showToast(`เลือก ${choice}: ${opt.label}`, 'success');
  }

  debouncing = false;
}

// Back button
backBtn.addEventListener('click', async () => {
  if (isLocked || debouncing) return;
  const history = gameState?.history || [];
  if (history.length === 0) return;

  debouncing = true;
  backBtn.disabled = true;

  // Pop last snapshot
  const lastSnap = history[history.length - 1];
  const newHistory = history.slice(0, -1);

  // Restore KPIs and step from snapshot
  const update = {
    current_step: lastSnap.stepId,
    history: newHistory,
    updated_at: new Date().toISOString(),
  };
  for (const f of KPI_FIELDS) {
    update[f] = lastSnap.kpis[f];
  }

  const { error } = await supabase.from('game_state').update(update).eq('id', 1);

  if (error) {
    showToast('ไม่สามารถย้อนกลับได้', 'error');
  } else {
    showToast(`ย้อนกลับไป: ${getStepLabel(lastSnap.stepId)}`, 'success');
  }

  debouncing = false;
});

// Reset game
resetBtn.addEventListener('click', async () => {
  if (isLocked) return;
  if (!confirm('รีเซ็ตเกมทั้งหมด? จะลบผู้เล่นและรีเซ็ตคะแนนทั้งหมด')) return;

  await Promise.all([
    supabase.from('players').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    supabase.from('game_state').update({
      current_step: 'waiting',
      cash: 50, brand: 50, morale: 50,
      cfo: 50, cmo: 50, coo: 50, chro: 50, clo: 50,
      history: [],
      admin_session_id: SESSION_ID,
      updated_at: new Date().toISOString(),
    }).eq('id', 1),
  ]);

  players = [];
  showToast('รีเซ็ตเกมเรียบร้อยแล้ว', 'success');
});

// ── Subscriptions ───────────────────────────────────────────
function subscribeToChanges() {
  supabase.channel('admin-watch')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'game_state' }, payload => {
      gameState = payload.new;
      // Re-check lock
      if (gameState.admin_session_id && gameState.admin_session_id !== SESSION_ID) {
        isLocked = true;
      } else {
        isLocked = false;
      }
      lockBanner.style.display = isLocked ? 'block' : 'none';
      renderAll();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, async () => {
      const { data } = await supabase.from('players').select('*').order('created_at');
      players = data || [];
      renderPlayers();
    })
    .subscribe();
}

// ── Helpers ─────────────────────────────────────────────────
function showToast(msg, type = '') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}
