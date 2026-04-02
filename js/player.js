import { supabase } from './supabase.js';
import {
  STEPS, STEP_DATA, KPI_FIELDS, KPI_LABELS, ROLE_FIELDS,
  ROLE_KPI_NAMES, getStepLabel, fmtDelta,
} from './game-data.js';

// ── Player session ──────────────────────────────────────────
const playerId   = localStorage.getItem('novatech_player_id');
const playerRole = localStorage.getItem('novatech_player_role');
const playerName = localStorage.getItem('novatech_player_name');

if (!playerId || !playerRole) {
  window.location.href = 'index.html';
}

// ── DOM refs ────────────────────────────────────────────────
const nameDisplay  = document.getElementById('player-name-display');
const roleBadge    = document.getElementById('role-badge');
const kpiValue     = document.getElementById('kpi-value');
const kpiLabel     = document.getElementById('kpi-label');
const playerKpiGrid = document.getElementById('player-kpi-grid');

const stateLobby     = document.getElementById('state-lobby');
const stateSituation = document.getElementById('state-situation');
const stateEnd       = document.getElementById('state-end');
const progressSteps  = document.getElementById('progress-steps');

// ── Init header ─────────────────────────────────────────────
nameDisplay.textContent = playerName || '';
roleBadge.textContent   = playerRole;
roleBadge.className     = `role-badge role-${playerRole}`;
kpiLabel.textContent    = ROLE_KPI_NAMES[playerRole] || 'KPI Score';

// ── Logout ──────────────────────────────────────────────────
document.getElementById('logout-btn').addEventListener('click', async () => {
  if (!confirm('ออกจากเกม?')) return;
  await supabase.from('players').delete().eq('id', playerId);
  clearSession();
  window.location.href = 'index.html';
});

function clearSession() {
  localStorage.removeItem('novatech_player_id');
  localStorage.removeItem('novatech_player_role');
  localStorage.removeItem('novatech_player_name');
}

function showRemovedScreen(headline, sub) {
  clearSession();
  const overlay = document.getElementById('removed-overlay');
  document.getElementById('removed-headline').textContent = headline;
  document.getElementById('removed-sub').textContent = sub;
  overlay.style.display = 'flex';
}

// ── Init ────────────────────────────────────────────────────
async function init() {
  const { data: gs } = await supabase.from('game_state').select('*').eq('id', 1).single();
  if (gs) renderGameState(gs);
  subscribeToChanges();
}

// ── Subscriptions ───────────────────────────────────────────
function subscribeToChanges() {
  supabase.channel('player-watch')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'game_state' }, async payload => {
      const gs = payload.new;

      // On reset, check if player still exists
      if (gs.current_step === 'waiting') {
        const { data: stillExists } = await supabase.from('players').select('id').eq('id', playerId).maybeSingle();
        if (!stillExists) {
          showRemovedScreen('เกมถูกรีเซ็ต', 'ผู้ดำเนินเกมได้รีเซ็ตเกมแล้ว กรุณาเข้าร่วมใหม่อีกครั้ง');
          return;
        }
      }

      renderGameState(gs);
    })
    .on('postgres_changes', {
      event: 'DELETE', schema: 'public', table: 'players',
      filter: `id=eq.${playerId}`
    }, () => {
      showRemovedScreen('คุณถูกนำออกจากเกม', 'ผู้ดำเนินเกมได้นำคุณออกจากเกมแล้ว');
    })
    .subscribe();
}

// ── Render game state ───────────────────────────────────────
function renderGameState(gs) {
  const step = gs.current_step ?? 'waiting';

  // Update KPIs
  renderKpis(gs);
  updateProgress(step);

  // Show correct state
  stateLobby.style.display     = step === 'waiting' ? 'block' : 'none';
  stateSituation.style.display = (step !== 'waiting' && step !== 'ended') ? 'block' : 'none';
  stateEnd.style.display       = step === 'ended' ? 'block' : 'none';

  if (step !== 'waiting' && step !== 'ended') {
    renderSituation(step);
  }

  if (step === 'ended') {
    renderEndScreen(gs);
  }
}

function renderKpis(gs) {
  // Personal KPI
  const roleField = playerRole.toLowerCase();
  const myScore = gs[roleField] ?? 50;
  kpiValue.textContent = myScore;
  kpiValue.className = `kpi-value ${myScore <= 0 ? 'dead' : myScore <= 20 ? 'low' : myScore <= 35 ? 'medium' : 'high'}`;

  // All KPIs grid
  playerKpiGrid.innerHTML = '';
  for (const field of KPI_FIELDS) {
    const val = gs[field] ?? 50;
    const isMyKpi = field === roleField;
    const color = val <= 0 ? '#f05252' : val <= 25 ? '#f59e0b' : '#e8eaf0';
    const el = document.createElement('div');
    el.style.cssText = `text-align:center; padding:8px; border-radius:6px; ${isMyKpi ? 'background:rgba(79,142,247,0.1); border:1px solid rgba(79,142,247,0.3);' : ''}`;
    el.innerHTML = `
      <div style="font-size:10px; color:var(--text-muted); text-transform:uppercase;">${KPI_LABELS[field]}</div>
      <div style="font-size:18px; font-weight:700; color:${color};">${val}</div>
    `;
    playerKpiGrid.appendChild(el);
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
}

function renderEndScreen(gs) {
  const history = gs.history || [];

  // Determine outcome
  const companyOk = gs.cash > 0 && gs.brand > 0 && gs.morale > 0;
  const myScore = gs[playerRole.toLowerCase()] ?? 50;
  const survived = companyOk && myScore > 0;

  document.getElementById('end-headline').textContent = survived ? 'NovaTech รอดพ้น!' : 'NovaTech ล้มเหลว';
  document.getElementById('end-sub').textContent = survived
    ? 'ทีมผู้บริหารผ่านพ้นวิกฤตทั้งหมดได้!'
    : !companyOk
      ? 'ดัชนีชี้วัดบริษัทตกต่ำเกินไป'
      : 'KPI ของคุณลดลงถึง 0';

  const container = document.getElementById('final-scores');
  container.innerHTML = '<div class="card-title" style="margin-bottom:12px;">คะแนนสุดท้าย</div>';

  for (const field of KPI_FIELDS) {
    const val = gs[field] ?? 50;
    const isMyKpi = field === playerRole.toLowerCase();
    const color = val <= 0 ? '#f05252' : val <= 25 ? '#f59e0b' : '#22c55e';
    const row = document.createElement('div');
    row.className = 'score-row';
    row.style.cssText = isMyKpi ? 'background:rgba(79,142,247,0.1); border-radius:6px;' : '';
    row.innerHTML = `
      <span class="player-name">${KPI_LABELS[field]} ${isMyKpi ? '<span style="color:#4f8ef7; font-size:11px;">(คุณ)</span>' : ''}</span>
      <span class="score-num" style="color:${color};">${val}</span>
    `;
    container.appendChild(row);
  }
}

function updateProgress(currentStep) {
  progressSteps.innerHTML = '';
  const currentIdx = STEPS.indexOf(currentStep);

  STEPS.forEach((stepId, i) => {
    const step = STEP_DATA[stepId];
    const el = document.createElement('div');
    el.className = 'progress-step';
    el.textContent = step.type === 'popup' ? `P${step.number}` : `S${step.number}`;
    if (i === currentIdx) el.classList.add('active');
    else if (i < currentIdx || currentStep === 'ended') el.classList.add('done');
    progressSteps.appendChild(el);
  });
}

init();
