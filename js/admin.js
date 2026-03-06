import { supabase } from './supabase.js';
import {
  SITUATIONS, ROLES, ROLE_KPI_NAMES,
  INITIAL_KPI, INITIAL_COMPANY,
  GAME_OVER_THRESHOLD, FIRED_THRESHOLD,
  getWinner, applyScores, fmtDelta
} from './game-data.js';

// ── Auth ─────────────────────────────────────────────────────
const ADMIN_PASSWORD = 'admin1234'; // Change this before your workshop!

const authScreen = document.getElementById('auth-screen');
const adminUi    = document.getElementById('admin-ui');
const authBtn    = document.getElementById('auth-btn');
const authError  = document.getElementById('auth-error');
const passInput  = document.getElementById('admin-password');

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
    authError.textContent = 'Incorrect password.';
    authError.style.display = 'block';
  }
});
passInput.addEventListener('keydown', e => { if (e.key === 'Enter') authBtn.click(); });

if (checkAuth()) initAdmin();

// ── State ────────────────────────────────────────────────────
let gameState    = null;
let players      = [];
let company      = null;
let votes        = [];
let voteChannel  = null;

// ── DOM refs ─────────────────────────────────────────────────
const advanceBtn       = document.getElementById('advance-btn');
const revealBtn        = document.getElementById('reveal-btn');
const resetBtn         = document.getElementById('reset-btn');
const phaseIndicator   = document.getElementById('phase-indicator');
const adminProgress    = document.getElementById('admin-progress');
const adminSitType     = document.getElementById('admin-sit-type');
const adminSitTitle    = document.getElementById('admin-sit-title');
const votesTbody       = document.getElementById('votes-tbody');
const voteTally        = document.getElementById('vote-tally');
const voteCountSummary = document.getElementById('vote-count-summary');
const playerScoresDiv  = document.getElementById('admin-player-scores');
const adminCash        = document.getElementById('admin-cash-val');
const adminBrand       = document.getElementById('admin-brand-val');
const adminMorale      = document.getElementById('admin-morale-val');
const adminMetricCash  = document.getElementById('admin-metric-cash');
const adminMetricBrand = document.getElementById('admin-metric-brand');
const adminMetricMorale= document.getElementById('admin-metric-morale');
const adminGameOver    = document.getElementById('admin-game-over');
const adminGoReason    = document.getElementById('admin-go-reason');
const sitDetailCard    = document.getElementById('sit-detail-card');
const playerOverrides  = document.getElementById('player-overrides');

// ── Init ─────────────────────────────────────────────────────
async function initAdmin() {
  await loadAll();
  renderAll();
  setupOverrideButtons();
  subscribeToChanges();
}

async function loadAll() {
  const [gsRes, playersRes, companyRes] = await Promise.all([
    supabase.from('game_state').select('*').eq('id', 1).single(),
    supabase.from('players').select('*').order('created_at'),
    supabase.from('company_scores').select('*').eq('id', 1).single(),
  ]);
  gameState = gsRes.data;
  players   = playersRes.data || [];
  company   = companyRes.data;

  if (gameState && gameState.current_situation_index >= 0) {
    await loadVotes(gameState.current_situation_index);
  }
}

async function loadVotes(sitIdx) {
  const { data } = await supabase.from('votes').select('*').eq('situation_index', sitIdx);
  votes = data || [];
}

// ── Render ────────────────────────────────────────────────────
function renderAll() {
  renderProgress();
  renderSituationInfo();
  renderVotes();
  renderPlayerScores();
  renderCompany();
  renderOverrideInputs();
  updateButtons();
}

function renderProgress() {
  adminProgress.innerHTML = '';
  const sitIdx = gameState?.current_situation_index ?? -1;
  SITUATIONS.forEach(sit => {
    const step = document.createElement('div');
    step.className = 'progress-step';
    step.textContent = sit.type === 'popup' ? `P${sit.number}` : `S${sit.number}`;
    if (sit.index === sitIdx) step.classList.add('active');
    else if (sit.index < sitIdx) step.classList.add('done');
    adminProgress.appendChild(step);
  });
}

function renderSituationInfo() {
  const sitIdx = gameState?.current_situation_index ?? -1;
  const phase  = gameState?.phase ?? 'waiting';

  phaseIndicator.textContent = sitIdx === -1 ? 'Not started' :
    sitIdx >= SITUATIONS.length ? 'Game ended' :
    `Phase: ${phase.charAt(0).toUpperCase() + phase.slice(1)}`;

  if (sitIdx < 0 || sitIdx >= SITUATIONS.length) {
    adminSitType.textContent  = '';
    adminSitTitle.textContent = sitIdx < 0 ? 'Game not started' : 'All situations complete';
    sitDetailCard.style.display = 'none';
    return;
  }

  const sit = SITUATIONS[sitIdx];
  adminSitType.textContent  = sit.type === 'popup' ? `Pop-up Event ${sit.number}` : `Situation ${sit.number}`;
  adminSitType.className    = `situation-type${sit.type === 'popup' ? ' popup' : ''}`;
  adminSitTitle.textContent = sit.title;

  // Situation detail card
  sitDetailCard.style.display = 'block';
  document.getElementById('detail-a-title').textContent = sit.optionA.label;
  document.getElementById('detail-b-title').textContent = sit.optionB.label;

  function renderImpacts(container, opt) {
    container.innerHTML = '';
    const all = [
      ...ROLES.map(r => ({ label: r, val: opt.kpi[r] ?? 0 })),
      { label: 'Cash', val: opt.company.cash_flow ?? 0 },
      { label: 'Brand', val: opt.company.brand_trust ?? 0 },
      { label: 'Morale', val: opt.company.employee_morale ?? 0 },
    ];
    for (const item of all) {
      const chip = document.createElement('span');
      chip.className = `delta-chip ${item.val > 0 ? 'pos' : item.val < 0 ? 'neg' : 'neu'}`;
      chip.textContent = `${item.label}: ${fmtDelta(item.val)}`;
      container.appendChild(chip);
    }
  }
  renderImpacts(document.getElementById('detail-a-impacts'), sit.optionA);
  renderImpacts(document.getElementById('detail-b-impacts'), sit.optionB);
}

function renderVotes() {
  votesTbody.innerHTML = '';
  const sitIdx = gameState?.current_situation_index ?? -1;

  if (sitIdx < 0 || sitIdx >= SITUATIONS.length) {
    votesTbody.innerHTML = '<tr><td colspan="3" style="color:#8892a4; padding:12px 8px;">No active situation.</td></tr>';
    voteTally.textContent = '';
    voteCountSummary.textContent = '';
    return;
  }

  const voteMap = {};
  for (const v of votes) voteMap[v.player_id] = v.choice;

  let countA = 0, countB = 0, countTotal = players.length;
  for (const v of votes) {
    if (v.choice === 'A') countA++;
    else if (v.choice === 'B') countB++;
  }

  for (const p of players) {
    const choice = voteMap[p.id];
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight:600;">${p.name}</td>
      <td><span class="role-badge role-${p.role}" style="font-size:11px;">${p.role}</span></td>
      <td>${choice
        ? `<span class="vote-badge ${choice.toLowerCase()}">${choice}</span>`
        : '<span class="vote-badge wait">⏳</span>'
      }</td>
    `;
    votesTbody.appendChild(tr);
  }

  const voted = Object.keys(voteMap).length;
  voteTally.textContent = `${voted}/${countTotal} voted`;
  voteCountSummary.textContent = `A: ${countA} | B: ${countB}`;
}

function renderPlayerScores() {
  playerScoresDiv.innerHTML = '';
  const sorted = [...players].sort((a, b) => b.kpi_score - a.kpi_score);
  for (const p of sorted) {
    const fired = p.kpi_score <= FIRED_THRESHOLD;
    const row = document.createElement('div');
    row.className = `score-row ${fired ? 'fired' : ''}`;
    row.innerHTML = `
      <span>
        <span class="player-name">${p.name}</span>
        <span class="role-badge role-${p.role}" style="font-size:10px; margin-left:6px;">${p.role}</span>
        ${fired ? '<span class="fired-tag">FIRED</span>' : ''}
      </span>
      <span class="score-num" style="color:${scoreColor(p.kpi_score)}">${p.kpi_score}</span>
    `;
    playerScoresDiv.appendChild(row);
  }
  if (players.length === 0) {
    playerScoresDiv.innerHTML = '<p style="color:#8892a4; font-size:13px;">No players have joined yet.</p>';
  }
}

function renderCompany() {
  if (!company) return;
  adminCash.textContent   = company.cash_flow;
  adminBrand.textContent  = company.brand_trust;
  adminMorale.textContent = company.employee_morale;
  adminMetricCash.classList.toggle('danger',   company.cash_flow   <= 25);
  adminMetricBrand.classList.toggle('danger',  company.brand_trust <= 25);
  adminMetricMorale.classList.toggle('danger', company.employee_morale <= 25);

  adminCash.style.color   = metricColor(company.cash_flow);
  adminBrand.style.color  = metricColor(company.brand_trust);
  adminMorale.style.color = metricColor(company.employee_morale);

  const isGameOver = company.cash_flow <= GAME_OVER_THRESHOLD ||
                     company.brand_trust <= GAME_OVER_THRESHOLD ||
                     company.employee_morale <= GAME_OVER_THRESHOLD;
  adminGameOver.classList.toggle('show', isGameOver);
  if (isGameOver) {
    const reasons = [];
    if (company.cash_flow <= GAME_OVER_THRESHOLD)       reasons.push('Cash Flow');
    if (company.brand_trust <= GAME_OVER_THRESHOLD)     reasons.push('Brand Trust');
    if (company.employee_morale <= GAME_OVER_THRESHOLD) reasons.push('Employee Morale');
    adminGoReason.textContent = `Critical threshold reached: ${reasons.join(', ')}`;
  }
}

function renderOverrideInputs() {
  playerOverrides.innerHTML = '';
  for (const p of players) {
    const row = document.createElement('div');
    row.className = 'override-row';
    row.innerHTML = `
      <label style="font-size:13px;">${p.name} <span style="color:#8892a4;">(${p.role})</span></label>
      <input class="override-input" type="number" min="0" max="100" value="${p.kpi_score}" id="ov-player-${p.id}" />
      <button class="btn btn-ghost btn-sm" data-player-id="${p.id}">Set</button>
    `;
    playerOverrides.appendChild(row);
  }

  // Attach events
  playerOverrides.querySelectorAll('button[data-player-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const pid = btn.dataset.playerId;
      const val = parseInt(document.getElementById(`ov-player-${pid}`).value);
      if (isNaN(val)) return;
      const { error } = await supabase.from('players').update({ kpi_score: Math.max(0, val) }).eq('id', pid);
      if (!error) {
        showToast('Score updated', 'success');
        const p = players.find(x => x.id === pid);
        if (p) p.kpi_score = Math.max(0, val);
        renderPlayerScores();
      } else {
        showToast('Update failed', 'error');
      }
    });
  });

  // Set current company values in override inputs
  if (company) {
    document.getElementById('ov-cash').value  = company.cash_flow;
    document.getElementById('ov-brand').value = company.brand_trust;
    document.getElementById('ov-morale').value= company.employee_morale;
  }
}

function updateButtons() {
  const sitIdx = gameState?.current_situation_index ?? -1;
  const phase  = gameState?.phase ?? 'waiting';
  const ended  = sitIdx >= SITUATIONS.length;

  advanceBtn.textContent = sitIdx === -1 ? 'Start Game' :
    ended ? 'Game Ended' : 'Advance to Next Situation';
  advanceBtn.disabled = ended || phase === 'voting';

  const hasVotes = votes.length > 0;
  revealBtn.disabled = phase !== 'voting';
}

// ── Button handlers ───────────────────────────────────────────
advanceBtn.addEventListener('click', async () => {
  const sitIdx = gameState?.current_situation_index ?? -1;
  const nextIdx = sitIdx + 1;

  if (nextIdx >= SITUATIONS.length) {
    // End game
    await supabase.from('game_state').update({ current_situation_index: SITUATIONS.length, phase: 'ended', updated_at: new Date().toISOString() }).eq('id', 1);
    return;
  }

  advanceBtn.disabled = true;
  const { error } = await supabase.from('game_state').update({
    current_situation_index: nextIdx,
    phase: 'voting',
    winning_option: null,
    updated_at: new Date().toISOString(),
  }).eq('id', 1);

  if (error) {
    showToast('Failed to advance game.', 'error');
    advanceBtn.disabled = false;
  } else {
    votes = [];
    showToast(`Advanced to ${SITUATIONS[nextIdx].title}`, 'success');
  }
});

revealBtn.addEventListener('click', async () => {
  const sitIdx = gameState?.current_situation_index ?? -1;
  if (sitIdx < 0 || sitIdx >= SITUATIONS.length) return;

  revealBtn.disabled = true;

  // Tally votes
  await loadVotes(sitIdx);
  let countA = 0, countB = 0;
  for (const v of votes) {
    if (v.choice === 'A') countA++;
    else countB++;
  }
  const winner = getWinner(countA, countB);

  // Compute new scores
  const currentKpis = {};
  for (const p of players) currentKpis[p.role] = p.kpi_score;
  const { newPlayerScores, newCompany } = applyScores(sitIdx, winner, currentKpis, company);

  // Apply all updates
  const playerUpdates = players.map(p =>
    supabase.from('players').update({ kpi_score: newPlayerScores[p.role] }).eq('id', p.id)
  );

  const [companyRes, ...playerResults] = await Promise.all([
    supabase.from('company_scores').update({
      cash_flow: newCompany.cash_flow,
      brand_trust: newCompany.brand_trust,
      employee_morale: newCompany.employee_morale,
    }).eq('id', 1),
    ...playerUpdates,
  ]);

  const errors = [companyRes, ...playerResults].filter(r => r.error);
  if (errors.length > 0) {
    showToast('Some score updates failed. Check console.', 'error');
    console.error(errors);
    revealBtn.disabled = false;
    return;
  }

  // Update game state
  await supabase.from('game_state').update({
    phase: 'revealed',
    winning_option: winner,
    updated_at: new Date().toISOString(),
  }).eq('id', 1);

  showToast(`Results revealed! Option ${winner} won (A:${countA}, B:${countB})`, 'success');
});

resetBtn.addEventListener('click', async () => {
  if (!confirm('Reset the entire game? This will delete all players, votes, and scores.')) return;

  await Promise.all([
    supabase.from('votes').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    supabase.from('players').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    supabase.from('company_scores').update(INITIAL_COMPANY).eq('id', 1),
    supabase.from('game_state').update({
      current_situation_index: -1,
      phase: 'waiting',
      winning_option: null,
      updated_at: new Date().toISOString(),
    }).eq('id', 1),
  ]);

  players = [];
  votes   = [];
  company = { ...INITIAL_COMPANY, id: 1 };
  gameState = { id: 1, current_situation_index: -1, phase: 'waiting', winning_option: null };
  renderAll();
  showToast('Game reset successfully.', 'success');
});

// ── Override buttons for company ─────────────────────────────
function setupOverrideButtons() {
  document.querySelectorAll('button[data-table="company"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const field = btn.dataset.field;
      const inputMap = { cash_flow: 'ov-cash', brand_trust: 'ov-brand', employee_morale: 'ov-morale' };
      const val = parseInt(document.getElementById(inputMap[field])?.value);
      if (isNaN(val)) return;
      const { error } = await supabase.from('company_scores').update({ [field]: Math.max(0, val) }).eq('id', 1);
      if (!error) {
        showToast(`${field} updated`, 'success');
        if (company) company[field] = Math.max(0, val);
        renderCompany();
      } else {
        showToast('Update failed', 'error');
      }
    });
  });
}

// ── Subscriptions ─────────────────────────────────────────────
function subscribeToChanges() {
  supabase.channel('admin-watch')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'game_state' }, async payload => {
      gameState = payload.new;
      if (gameState.current_situation_index >= 0 && gameState.current_situation_index < SITUATIONS.length) {
        await loadVotes(gameState.current_situation_index);
      } else {
        votes = [];
      }
      renderAll();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, async () => {
      const { data } = await supabase.from('players').select('*').order('created_at');
      players = data || [];
      renderPlayerScores();
      renderOverrideInputs();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, async () => {
      if (gameState && gameState.current_situation_index >= 0) {
        await loadVotes(gameState.current_situation_index);
        renderVotes();
        updateButtons();
      }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'company_scores' }, payload => {
      company = payload.new;
      renderCompany();
      renderOverrideInputs();
    })
    .subscribe();
}

// ── Helpers ───────────────────────────────────────────────────
function scoreColor(v) {
  if (v <= FIRED_THRESHOLD) return '#666';
  if (v <= 20) return '#f05252';
  if (v <= 35) return '#f59e0b';
  return '#22c55e';
}
function metricColor(v) {
  if (v <= GAME_OVER_THRESHOLD) return '#f05252';
  if (v <= 25) return '#f59e0b';
  return '#e8eaf0';
}
function showToast(msg, type = '') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
