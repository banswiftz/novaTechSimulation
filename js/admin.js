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
    authError.textContent = 'รหัสผ่านไม่ถูกต้อง';
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

// ── Timer ─────────────────────────────────────────────────────
// Discussion time per situation type (seconds)
const SIT_DURATION = { situation: 10 * 60, popup: 5 * 60 };
let timerInterval = null;
let timerEndsAt   = null;

// ── DOM refs ─────────────────────────────────────────────────
const jumpSelect       = document.getElementById('jump-select');
const revealBtn        = document.getElementById('reveal-btn');
const resetBtn         = document.getElementById('reset-btn');
const phaseIndicator   = document.getElementById('phase-indicator');
const timerDisplay     = document.getElementById('timer-display');
const adminProgress    = document.getElementById('admin-progress');
const sitSummaryBar    = document.getElementById('sit-summary-bar');
const sitTypeBar       = document.getElementById('sit-type-bar');
const sitTitleBar      = document.getElementById('sit-title-bar');
const sitDescBar       = document.getElementById('sit-desc-bar');
const sitOptABar       = document.getElementById('sit-opt-a-bar');
const sitOptADescBar   = document.getElementById('sit-opt-a-desc-bar');
const sitOptBBar       = document.getElementById('sit-opt-b-bar');
const sitOptBDescBar   = document.getElementById('sit-opt-b-desc-bar');
const sitDetailPanel   = document.getElementById('sit-detail-panel');
const sitToggleBtn     = document.getElementById('sit-toggle-btn');
const totalVotesBar    = document.getElementById('total-votes-bar');
const totalPossibleBar = document.getElementById('total-possible-bar');
const groupsGrid       = document.getElementById('groups-grid');
const noGroupsMsg      = document.getElementById('no-groups-msg');
const adminGameOver    = document.getElementById('admin-game-over');
const adminGoReason    = document.getElementById('admin-go-reason');

// ── Detail panel toggle ───────────────────────────────────────
sitToggleBtn.addEventListener('click', () => {
  const open = sitDetailPanel.style.display !== 'none';
  sitDetailPanel.style.display = open ? 'none' : 'block';
  sitToggleBtn.textContent = open ? '▼ รายละเอียด' : '▲ ซ่อน';
});

// ── Init ─────────────────────────────────────────────────────
async function initAdmin() {
  // Populate situation selector once
  SITUATIONS.forEach(sit => {
    const opt = document.createElement('option');
    opt.value = sit.index;
    opt.textContent = sit.type === 'popup'
      ? `เหตุการณ์พิเศษ ${sit.number}: ${sit.title}`
      : `สถานการณ์ ${sit.number}: ${sit.title}`;
    jumpSelect.appendChild(opt);
  });
  // "End game" option
  const endOpt = document.createElement('option');
  endOpt.value = SITUATIONS.length;
  endOpt.textContent = '— จบเกม —';
  jumpSelect.appendChild(endOpt);

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

  phaseIndicator.textContent = sitIdx === -1 ? 'ยังไม่เริ่ม' :
    sitIdx >= SITUATIONS.length ? 'เกมจบแล้ว' :
    `ระยะ: ${phase === 'voting' ? 'โหวต' : phase === 'revealed' ? 'เปิดผล' : phase}`;

  if (sitIdx < 0 || sitIdx >= SITUATIONS.length) {
    sitSummaryBar.style.display = 'none';
    stopTimer();
    return;
  }

  const sit = SITUATIONS[sitIdx];
  sitSummaryBar.style.display = 'block';
  sitTypeBar.textContent  = sit.type === 'popup' ? `เหตุการณ์พิเศษ ${sit.number}` : `สถานการณ์ ${sit.number}`;
  sitTypeBar.className    = `situation-type${sit.type === 'popup' ? ' popup' : ''}`;
  sitTitleBar.textContent = sit.title;

  // Populate detail panel
  sitDescBar.textContent     = sit.description;
  sitOptABar.textContent     = sit.optionA.label;
  sitOptADescBar.textContent = sit.optionA.description;
  sitOptBBar.textContent     = sit.optionB.label;
  sitOptBDescBar.textContent = sit.optionB.description;

  const totalPossible = players.length;
  const totalVoted    = votes.length;
  totalVotesBar.textContent    = totalVoted;
  totalPossibleBar.textContent = totalPossible;
}

// ── Timer ──────────────────────────────────────────────────────
function startTimer(sit) {
  stopTimer();
  const durationSec = SIT_DURATION[sit.type] ?? SIT_DURATION.situation;
  timerEndsAt = Date.now() + durationSec * 1000;
  timerDisplay.style.display = 'inline';
  tickTimer();
  timerInterval = setInterval(tickTimer, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  timerEndsAt   = null;
  timerDisplay.style.display = 'none';
}

function tickTimer() {
  if (!timerEndsAt) return;
  const remaining = Math.max(0, Math.round((timerEndsAt - Date.now()) / 1000));
  const m = String(Math.floor(remaining / 60)).padStart(2, '0');
  const s = String(remaining % 60).padStart(2, '0');
  timerDisplay.textContent = `⏱ ${m}:${s}`;
  timerDisplay.style.color = remaining <= 120 ? '#f05252' : remaining <= 300 ? '#f59e0b' : 'var(--text)';
  if (remaining === 0) stopTimer();
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
      <div style="font-size:16px; font-weight:700;">กลุ่ม ${gNum}</div>
      <div style="font-size:12px; color:var(--text-muted);">${groupPlayers.length}/5 คน</div>
    </div>

    <!-- Company scores -->
    <div class="metrics-row" style="margin-bottom:12px;">
      <div class="metric-card ${cashDanger ? 'danger' : ''}" style="padding:10px 8px;">
        <div class="danger-badge">!</div>
        <div class="metric-val" style="font-size:20px; color:${metricColor(gs.cash_flow)}">${gs.cash_flow}</div>
        <div class="metric-name">เงินสด</div>
      </div>
      <div class="metric-card ${brandDanger ? 'danger' : ''}" style="padding:10px 8px;">
        <div class="danger-badge">!</div>
        <div class="metric-val" style="font-size:20px; color:${metricColor(gs.brand_trust)}">${gs.brand_trust}</div>
        <div class="metric-name">แบรนด์</div>
      </div>
      <div class="metric-card ${moraleDanger ? 'danger' : ''}" style="padding:10px 8px;">
        <div class="danger-badge">!</div>
        <div class="metric-val" style="font-size:20px; color:${metricColor(gs.employee_morale)}">${gs.employee_morale}</div>
        <div class="metric-name">ขวัญกำลังใจ</div>
      </div>
    </div>

    <!-- Vote tally (only during active situation) -->
    ${sitIdx >= 0 && sitIdx < SITUATIONS.length ? `
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; font-size:13px;">
      <span style="color:var(--text-muted);">โหวต: ${voted}/${groupPlayers.length}</span>
      <span style="display:flex; align-items:center; gap:6px;">
        ${countA === countB && voted > 0 ? '<span style="background:#f59e0b; color:#000; font-size:11px; font-weight:700; padding:2px 7px; border-radius:4px;">⚖ เสมอกัน</span>' : ''}
        <span class="vote-badge a">A: ${countA}</span>
        <span class="vote-badge b">B: ${countB}</span>
      </span>
    </div>` : ''}

    <!-- Players table -->
    <table class="vote-table" style="margin-bottom:8px;">
      <thead>
        <tr>
          <th>ชื่อ</th>
          <th>ตำแหน่ง</th>
          <th>KPI</th>
          ${sitIdx >= 0 && sitIdx < SITUATIONS.length ? '<th>โหวต</th>' : ''}
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
                  นำออก
                </button>
              </td>
            </tr>`;
        }).join('')}
        ${groupPlayers.length === 0 ? '<tr><td colspan="5" style="color:#8892a4; text-align:center;">ยังไม่มีสมาชิก</td></tr>' : ''}
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
  ).map(([gNum]) => `กลุ่ม ${gNum}`);

  if (collapsingGroups.length > 0) {
    adminGameOver.classList.add('show');
    adminGoReason.textContent = `ล้มละลาย: ${collapsingGroups.join(', ')}`;
  } else {
    adminGameOver.classList.remove('show');
  }
}

function updateButtons() {
  const sitIdx = gameState?.current_situation_index ?? -1;
  const phase  = gameState?.phase ?? 'waiting';

  // Sync the select to current state
  jumpSelect.value = String(sitIdx);
  jumpSelect.disabled = phase === 'voting';

  revealBtn.disabled = phase !== 'voting' || sitIdx < 0;
}

// ── Jump to situation ─────────────────────────────────────────
jumpSelect.addEventListener('change', async () => {
  const targetIdx = parseInt(jumpSelect.value);
  if (isNaN(targetIdx)) return;

  const currentIdx = gameState?.current_situation_index ?? -1;
  if (targetIdx === currentIdx) return;

  jumpSelect.disabled = true;
  const { error } = await supabase.from('game_state').update({
    current_situation_index: targetIdx,
    phase: targetIdx >= SITUATIONS.length ? 'ended' : targetIdx === -1 ? 'waiting' : 'voting',
    updated_at: new Date().toISOString(),
  }).eq('id', 1);

  if (error) {
    showToast('เกิดข้อผิดพลาด ไม่สามารถเปลี่ยนสถานการณ์ได้', 'error');
    jumpSelect.value = String(currentIdx);
  } else {
    votes = [];
    const label = targetIdx >= SITUATIONS.length ? 'จบเกม' :
      targetIdx === -1 ? 'ยังไม่เริ่ม' : SITUATIONS[targetIdx].title;
    showToast(`เปลี่ยนไป: ${label}`, 'success');
    // Start countdown when entering a voting situation
    if (targetIdx >= 0 && targetIdx < SITUATIONS.length) {
      startTimer(SITUATIONS[targetIdx]);
    } else {
      stopTimer();
    }
  }
  jumpSelect.disabled = false;
});

revealBtn.addEventListener('click', async () => {
  const sitIdx = gameState?.current_situation_index ?? -1;
  if (sitIdx < 0 || sitIdx >= SITUATIONS.length) return;
  revealBtn.disabled = true;

  await loadVotes(sitIdx);

  // ── Guard: check which groups already have results (double-score prevention)
  const { data: existingResults } = await supabase
    .from('group_results').select('group_number').eq('situation_index', sitIdx);
  const alreadyRevealed = new Set((existingResults || []).map(r => r.group_number));

  const groups = getGroups();
  const errors = [];

  // ── Guard: warn about under-voted or already-revealed groups
  const underVoted  = groups.filter(gNum => {
    const gPlayers = players.filter(p => p.group_number === gNum);
    const gVotes   = votes.filter(v => new Set(gPlayers.map(p => p.id)).has(v.player_id));
    return gVotes.length > 0 && gVotes.length < gPlayers.length;
  });
  const warnings = [];
  if (underVoted.length > 0)
    warnings.push(`โหวตยังไม่ครบ: ${underVoted.map(g => `กลุ่ม ${g}`).join(', ')}`);
  if (alreadyRevealed.size > 0)
    warnings.push(`เปิดผลไปแล้ว (จะถูกข้าม): ${[...alreadyRevealed].map(g => `กลุ่ม ${g}`).join(', ')}`);

  if (warnings.length > 0 && !confirm(`⚠️ คำเตือน:\n${warnings.join('\n')}\n\nดำเนินการต่อหรือไม่?`)) {
    revealBtn.disabled = false;
    return;
  }

  for (const gNum of groups) {
    // Skip groups already scored for this situation
    if (alreadyRevealed.has(gNum)) continue;

    const groupPlayers  = players.filter(p => p.group_number === gNum);
    const groupPlayerIds = new Set(groupPlayers.map(p => p.id));
    const groupVotes    = votes.filter(v => groupPlayerIds.has(v.player_id));

    const countA = groupVotes.filter(v => v.choice === 'A').length;
    const countB = groupVotes.filter(v => v.choice === 'B').length;

    // Skip groups with zero votes
    if (countA + countB === 0) {
      showToast(`กลุ่ม ${gNum}: ยังไม่มีโหวต — ข้ามกลุ่มนี้`, 'error');
      continue;
    }

    let winner;
    if (countA === countB) {
      let choice = '';
      while (choice !== 'A' && choice !== 'B') {
        choice = (prompt(
          `กลุ่ม ${gNum}: โหวตเสมอกัน (A: ${countA}, B: ${countB})\nกรุณาพิมพ์ A หรือ B เพื่อตัดสินผลของกลุ่มนี้:`
        ) || '').trim().toUpperCase();
        if (choice !== 'A' && choice !== 'B') alert('กรุณาพิมพ์ A หรือ B เท่านั้น');
      }
      winner = choice;
    } else {
      winner = getWinner(countA, countB);
    }

    const currentKpis = {};
    for (const p of groupPlayers) currentKpis[p.role] = p.kpi_score;
    const currentCompany = groupScores[gNum] || { ...INITIAL_COMPANY };

    const { newPlayerScores, newCompany } = applyScores(sitIdx, winner, currentKpis, currentCompany);

    const playerUpdates = groupPlayers.map(p =>
      supabase.from('players').update({ kpi_score: newPlayerScores[p.role] }).eq('id', p.id)
    );

    const [companyRes, resultRes, ...playerResults] = await Promise.all([
      supabase.from('group_scores').update({
        cash_flow:       newCompany.cash_flow,
        brand_trust:     newCompany.brand_trust,
        employee_morale: newCompany.employee_morale,
      }).eq('group_number', gNum),
      supabase.from('group_results').upsert({
        group_number:    gNum,
        situation_index: sitIdx,
        winning_option:  winner,
      }, { onConflict: 'group_number,situation_index' }),
      ...playerUpdates,
    ]);

    const groupErrors = [companyRes, resultRes, ...playerResults].filter(r => r.error);
    if (groupErrors.length > 0) errors.push(`กลุ่ม ${gNum}`);
    else {
      groupScores[gNum] = newCompany;
      for (const p of groupPlayers) p.kpi_score = newPlayerScores[p.role];
    }
  }

  await supabase.from('game_state').update({
    phase: 'revealed',
    updated_at: new Date().toISOString(),
  }).eq('id', 1);

  if (errors.length > 0) {
    showToast(`เกิดข้อผิดพลาดกับคะแนน: ${errors.join(', ')}`, 'error');
  } else {
    showToast(`เปิดผลเรียบร้อย ทั้ง ${groups.length} กลุ่ม!`, 'success');
  }

  renderGroupCards();
  renderGameOver();
});

resetBtn.addEventListener('click', async () => {
  if (!confirm('รีเซ็ตเกมทั้งหมด? การดำเนินการนี้จะลบผู้เล่น โหวต และคะแนนทั้งหมด')) return;

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
  showToast('รีเซ็ตเกมเรียบร้อยแล้ว', 'success');
});

// ── Remove player ─────────────────────────────────────────────
async function removePlayer(playerId) {
  if (!confirm('นำผู้เล่นออกจากเกม? โหวตของผู้เล่นคนนี้จะถูกลบด้วย')) return;

  await supabase.from('votes').delete().eq('player_id', playerId);
  await supabase.from('players').delete().eq('id', playerId);

  players = players.filter(p => p.id !== playerId);
  renderGroupCards();
  renderSituationBar();
  showToast('นำผู้เล่นออกเรียบร้อยแล้ว', 'success');
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
