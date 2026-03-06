import { supabase } from './supabase.js';
import {
  SITUATIONS, ROLES,
  INITIAL_COMPANY,
  GAME_OVER_THRESHOLD, FIRED_THRESHOLD,
  getWinner, applyScores
} from './game-data.js';

// ── Auth ─────────────────────────────────────────────────────
const ADMIN_PASSWORD = 'admin'; // Change this before your workshop!

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
let gameState  = null;
let players    = [];      // all players across all groups
let groupScores = {};     // group_number -> {cash_flow, brand_trust, employee_morale}
let votes      = [];      // votes for current situation

// ── DOM refs ─────────────────────────────────────────────────
const advanceBtn       = document.getElementById('advance-btn');
const revealBtn        = document.getElementById('reveal-btn');
const resetBtn         = document.getElementById('reset-btn');
const phaseIndicator   = document.getElementById('phase-indicator');
const adminProgress    = document.getElementById('admin-progress');
const sitSummaryBar    = document.getElementById('sit-summary-bar');
const sitTypeBar       = document.getElementById('sit-type-bar');
const sitTitleBar      = document.getElementById('sit-title-bar');
const totalVotesBar    = document.getElementById('total-votes-bar');
const totalPossibleBar = document.getElementById('total-possible-bar');
const groupsGrid       = document.getElementById('groups-grid');
const noGroupsMsg      = document.getElementById('no-groups-msg');
const adminGameOver    = document.getElementById('admin-game-over');
const adminGoReason    = document.getElementById('admin-go-reason');

// ── Init ─────────────────────────────────────────────────────
async function initAdmin() {
  await loadAll();
  renderAll();
  subscribeToChanges();
}

async function loadAll() {
  const [gsRes, playersRes, scoresRes] = await Promise.all([
    supabase.from('game_state').select('*').eq('id', 1).single(),
    supabase.from('players').select('*').order('group_number').order('created_at'),
    supabase.from('group_scores').select('*'),
  ]);
  gameState = gsRes.data;
  players   = playersRes.data || [];

  groupScores = {};
  for (const s of (scoresRes.data || [])) groupScores[s.group_number] = s;

  if (gameState && gameState.current_situation_index >= 0) {
    await loadVotes(gameState.current_situation_index);
  }
}

async function loadVotes(sitIdx) {
  const { data } = await supabase.from('votes').select('*, players(group_number)').eq('situation_index', sitIdx);
  votes = data || [];
}

// ── Render ────────────────────────────────────────────────────
function renderAll() {
  renderProgress();
  renderSituationBar();
  renderGroupCards();
  updateButtons();
  renderGameOver();
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

function renderSituationBar() {
  const sitIdx = gameState?.current_situation_index ?? -1;
  const phase  = gameState?.phase ?? 'waiting';

  phaseIndicator.textContent = sitIdx === -1 ? 'Not started' :
    sitIdx >= SITUATIONS.length ? 'Game ended' :
    `Phase: ${phase.charAt(0).toUpperCase() + phase.slice(1)}`;

  if (sitIdx < 0 || sitIdx >= SITUATIONS.length) {
    sitSummaryBar.style.display = 'none';
    return;
  }

  const sit = SITUATIONS[sitIdx];
  sitSummaryBar.style.display = 'block';
  sitTypeBar.textContent  = sit.type === 'popup' ? `Pop-up Event ${sit.number}` : `Situation ${sit.number}`;
  sitTypeBar.className    = `situation-type${sit.type === 'popup' ? ' popup' : ''}`;
  sitTitleBar.textContent = sit.title;

  const totalPossible = players.length;
  const totalVoted    = votes.length;
  totalVotesBar.textContent    = totalVoted;
  totalPossibleBar.textContent = totalPossible;
}

function getGroups() {
  const groupNums = [...new Set(players.map(p => p.group_number))].sort((a, b) => a - b);
  return groupNums;
}

function renderGroupCards() {
  const groups = getGroups();
  noGroupsMsg.style.display  = groups.length === 0 ? 'block' : 'none';
  groupsGrid.style.display   = groups.length === 0 ? 'none'  : 'grid';

  // Rebuild all group cards (simple approach — fine for ≤20 groups)
  groupsGrid.innerHTML = '';

  for (const gNum of groups) {
    const card = buildGroupCard(gNum);
    groupsGrid.appendChild(card);
  }
}

function buildGroupCard(gNum) {
  const sitIdx = gameState?.current_situation_index ?? -1;

  const groupPlayers = players.filter(p => p.group_number === gNum).sort((a, b) => {
    return ROLES.indexOf(a.role) - ROLES.indexOf(b.role);
  });

  const gs = groupScores[gNum] || { cash_flow: 50, brand_trust: 50, employee_morale: 50 };
  // Re-filter using player IDs for reliability
  const groupPlayerIds = new Set(groupPlayers.map(p => p.id));
  const groupVotesList = votes.filter(v => groupPlayerIds.has(v.player_id));
  const voteMap = {};
  for (const v of groupVotesList) voteMap[v.player_id] = v.choice;

  const countA = groupVotesList.filter(v => v.choice === 'A').length;
  const countB = groupVotesList.filter(v => v.choice === 'B').length;
  const voted  = groupVotesList.length;

  // Company danger
  const cashDanger   = gs.cash_flow <= GAME_OVER_THRESHOLD;
  const brandDanger  = gs.brand_trust <= GAME_OVER_THRESHOLD;
  const moraleDanger = gs.employee_morale <= GAME_OVER_THRESHOLD;
  const anyDanger    = cashDanger || brandDanger || moraleDanger;

  const card = document.createElement('div');
  card.className = `card group-card ${anyDanger ? 'group-card-danger' : ''}`;
  card.dataset.group = gNum;

  card.innerHTML = `
    <!-- Header -->
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
      <div style="font-size:16px; font-weight:700;">Group ${gNum}</div>
      <div style="font-size:12px; color:var(--text-muted);">${groupPlayers.length}/5 members</div>
    </div>

    <!-- Company scores -->
    <div class="metrics-row" style="margin-bottom:12px;">
      <div class="metric-card ${cashDanger ? 'danger' : ''}" style="padding:10px 8px;">
        <div class="danger-badge">!</div>
        <div class="metric-val" style="font-size:20px; color:${metricColor(gs.cash_flow)}">${gs.cash_flow}</div>
        <div class="metric-name">Cash</div>
      </div>
      <div class="metric-card ${brandDanger ? 'danger' : ''}" style="padding:10px 8px;">
        <div class="danger-badge">!</div>
        <div class="metric-val" style="font-size:20px; color:${metricColor(gs.brand_trust)}">${gs.brand_trust}</div>
        <div class="metric-name">Brand</div>
      </div>
      <div class="metric-card ${moraleDanger ? 'danger' : ''}" style="padding:10px 8px;">
        <div class="danger-badge">!</div>
        <div class="metric-val" style="font-size:20px; color:${metricColor(gs.employee_morale)}">${gs.employee_morale}</div>
        <div class="metric-name">Morale</div>
      </div>
    </div>

    <!-- Vote tally (only during active situation) -->
    ${sitIdx >= 0 && sitIdx < SITUATIONS.length ? `
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; font-size:13px;">
      <span style="color:var(--text-muted);">Votes: ${voted}/${groupPlayers.length}</span>
      <span>
        <span class="vote-badge a">A: ${countA}</span>
        &nbsp;
        <span class="vote-badge b">B: ${countB}</span>
      </span>
    </div>` : ''}

    <!-- Players table -->
    <table class="vote-table" style="margin-bottom:8px;">
      <thead>
        <tr>
          <th>Name</th>
          <th>Role</th>
          <th>KPI</th>
          ${sitIdx >= 0 && sitIdx < SITUATIONS.length ? '<th>Vote</th>' : ''}
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${groupPlayers.map(p => {
          const choice = voteMap[p.id];
          const fired  = p.kpi_score <= FIRED_THRESHOLD;
          return `
            <tr>
              <td style="font-weight:600; ${fired ? 'text-decoration:line-through;color:#666;' : ''}">${p.name}</td>
              <td><span class="role-badge role-${p.role}" style="font-size:10px;">${p.role}</span></td>
              <td style="font-weight:700; color:${scoreColor(p.kpi_score)}">${p.kpi_score}</td>
              ${sitIdx >= 0 && sitIdx < SITUATIONS.length ? `
              <td>${choice
                ? `<span class="vote-badge ${choice.toLowerCase()}">${choice}</span>`
                : '<span class="vote-badge wait">⏳</span>'
              }</td>` : ''}
              <td>
                <button class="btn btn-danger btn-sm remove-player-btn" data-id="${p.id}" style="padding:3px 8px; font-size:11px;">
                  Remove
                </button>
              </td>
            </tr>`;
        }).join('')}
        ${groupPlayers.length === 0 ? '<tr><td colspan="5" style="color:#8892a4; text-align:center;">No members yet</td></tr>' : ''}
      </tbody>
    </table>
  `;

  // Attach remove button events
  card.querySelectorAll('.remove-player-btn').forEach(btn => {
    btn.addEventListener('click', () => removePlayer(btn.dataset.id));
  });

  return card;
}

function renderGameOver() {
  const collapsingGroups = Object.entries(groupScores).filter(([, gs]) =>
    gs.cash_flow <= GAME_OVER_THRESHOLD ||
    gs.brand_trust <= GAME_OVER_THRESHOLD ||
    gs.employee_morale <= GAME_OVER_THRESHOLD
  ).map(([gNum]) => `Group ${gNum}`);

  if (collapsingGroups.length > 0) {
    adminGameOver.classList.add('show');
    adminGoReason.textContent = `Collapsed: ${collapsingGroups.join(', ')}`;
  } else {
    adminGameOver.classList.remove('show');
  }
}

function updateButtons() {
  const sitIdx = gameState?.current_situation_index ?? -1;
  const phase  = gameState?.phase ?? 'waiting';
  const ended  = sitIdx >= SITUATIONS.length;

  advanceBtn.textContent = sitIdx === -1 ? 'Start Game' :
    ended ? 'Game Ended' : 'Advance to Next Situation';
  advanceBtn.disabled = ended || phase === 'voting';

  revealBtn.disabled = phase !== 'voting' || sitIdx < 0;
}

// ── Button handlers ───────────────────────────────────────────
advanceBtn.addEventListener('click', async () => {
  const sitIdx  = gameState?.current_situation_index ?? -1;
  const nextIdx = sitIdx + 1;

  advanceBtn.disabled = true;
  const { error } = await supabase.from('game_state').update({
    current_situation_index: nextIdx,
    phase: nextIdx >= SITUATIONS.length ? 'ended' : 'voting',
    updated_at: new Date().toISOString(),
  }).eq('id', 1);

  if (error) { showToast('Failed to advance.', 'error'); advanceBtn.disabled = false; }
  else {
    votes = [];
    const label = nextIdx < SITUATIONS.length ? SITUATIONS[nextIdx].title : 'Game Ended';
    showToast(`Advanced to: ${label}`, 'success');
  }
});

revealBtn.addEventListener('click', async () => {
  const sitIdx = gameState?.current_situation_index ?? -1;
  if (sitIdx < 0 || sitIdx >= SITUATIONS.length) return;
  revealBtn.disabled = true;

  await loadVotes(sitIdx);

  const groups = getGroups();
  const errors = [];

  for (const gNum of groups) {
    const groupPlayers = players.filter(p => p.group_number === gNum);
    const groupPlayerIds = new Set(groupPlayers.map(p => p.id));
    const groupVotes = votes.filter(v => groupPlayerIds.has(v.player_id));

    const countA = groupVotes.filter(v => v.choice === 'A').length;
    const countB = groupVotes.filter(v => v.choice === 'B').length;
    const winner = getWinner(countA, countB);

    const currentKpis = {};
    for (const p of groupPlayers) currentKpis[p.role] = p.kpi_score;
    const currentCompany = groupScores[gNum] || { ...INITIAL_COMPANY };

    const { newPlayerScores, newCompany } = applyScores(sitIdx, winner, currentKpis, currentCompany);

    // Update all players in this group
    const playerUpdates = groupPlayers.map(p =>
      supabase.from('players').update({ kpi_score: newPlayerScores[p.role] }).eq('id', p.id)
    );

    const [companyRes, resultRes, ...playerResults] = await Promise.all([
      supabase.from('group_scores').update({
        cash_flow:       newCompany.cash_flow,
        brand_trust:     newCompany.brand_trust,
        employee_morale: newCompany.employee_morale,
      }).eq('group_number', gNum),
      // Record the winning option for this group so player pages can show it
      supabase.from('group_results').upsert({
        group_number:     gNum,
        situation_index:  sitIdx,
        winning_option:   winner,
      }, { onConflict: 'group_number,situation_index' }),
      ...playerUpdates,
    ]);

    const groupErrors = [companyRes, resultRes, ...playerResults].filter(r => r.error);
    if (groupErrors.length > 0) errors.push(`Group ${gNum}`);
    else {
      // Update local state
      groupScores[gNum] = newCompany;
      for (const p of groupPlayers) p.kpi_score = newPlayerScores[p.role];
    }
  }

  // Mark game state as revealed
  await supabase.from('game_state').update({
    phase: 'revealed',
    updated_at: new Date().toISOString(),
  }).eq('id', 1);

  if (errors.length > 0) {
    showToast(`Score errors for: ${errors.join(', ')}`, 'error');
  } else {
    showToast(`Results revealed for all ${groups.length} groups!`, 'success');
  }

  renderGroupCards();
  renderGameOver();
});

resetBtn.addEventListener('click', async () => {
  if (!confirm('Reset the entire game? This deletes ALL players, votes, and scores.')) return;

  await Promise.all([
    supabase.from('votes').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    supabase.from('players').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    supabase.from('group_scores').delete().neq('group_number', -999),
    supabase.from('group_results').delete().neq('group_number', -999),
    supabase.from('game_state').update({
      current_situation_index: -1,
      phase: 'waiting',
      updated_at: new Date().toISOString(),
    }).eq('id', 1),
  ]);

  players     = [];
  votes       = [];
  groupScores = {};
  gameState   = { id: 1, current_situation_index: -1, phase: 'waiting' };
  renderAll();
  showToast('Game reset.', 'success');
});

// ── Remove player ─────────────────────────────────────────────
async function removePlayer(playerId) {
  if (!confirm('Remove this player? Their votes will also be deleted.')) return;

  await supabase.from('votes').delete().eq('player_id', playerId);
  await supabase.from('players').delete().eq('id', playerId);

  players = players.filter(p => p.id !== playerId);
  renderGroupCards();
  renderSituationBar();
  showToast('Player removed.', 'success');
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
      const { data } = await supabase.from('players').select('*').order('group_number').order('created_at');
      players = data || [];
      renderGroupCards();
      renderSituationBar();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, async () => {
      if (gameState && gameState.current_situation_index >= 0) {
        await loadVotes(gameState.current_situation_index);
        renderGroupCards();
        renderSituationBar();
        updateButtons();
      }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'group_scores' }, payload => {
      if (payload.new?.group_number != null) {
        groupScores[payload.new.group_number] = payload.new;
        renderGroupCards();
        renderGameOver();
      }
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
  setTimeout(() => toast.remove(), 3500);
}
