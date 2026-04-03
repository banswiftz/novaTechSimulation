import { supabase } from './supabase.js';
import {
  SITUATIONS, ROLES,
  INITIAL_COMPANY,
  GAME_OVER_THRESHOLD, FIRED_THRESHOLD,
  applyScores, SPECIAL_CARDS
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

// ── State ────────────────────────────────────────────────────
let gameState   = null;
let players     = [];      // all players across all groups
let groupScores = {};      // group_number -> {cash_flow, brand_trust, employee_morale}
let groupResults = {};     // group_number -> { situation_index -> winning_option }
let votes       = [];      // votes for current situation
let allGroupCards = {};    // group_number -> [{card_type, is_used, ...}]
let isRevealing = false;   // lock to prevent double-reveal

// ── DOM refs ─────────────────────────────────────────────────
const jumpSelect       = document.getElementById('jump-select');
const revealBtn        = document.getElementById('reveal-btn');
const resetBtn         = document.getElementById('reset-btn');
const backBtn          = document.getElementById('back-btn');
const startNextBtn     = document.getElementById('start-next-btn');
const phaseIndicator   = document.getElementById('phase-indicator');
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
const groupsTable      = document.getElementById('groups-table');
const groupsThead      = document.getElementById('groups-thead');
const groupsTbody      = document.getElementById('groups-tbody');
const noGroupsMsg      = document.getElementById('no-groups-msg');
const adminGameOver    = document.getElementById('admin-game-over');
const adminGoReason    = document.getElementById('admin-go-reason');

// ── Detail panel toggle ───────────────────────────────────────
sitToggleBtn.addEventListener('click', () => {
  const open = sitDetailPanel.style.display !== 'none';
  sitDetailPanel.style.display = open ? 'none' : 'block';
  sitToggleBtn.textContent = open ? '▼ รายละเอียด' : '▲ ซ่อน';
});

// Check auth automatically if returning to page
if (checkAuth()) initAdmin();

// ── Init ─────────────────────────────────────────────────────
async function initAdmin() {
  // Show loading
  const ls = document.getElementById('loading-screen');
  if (ls) ls.classList.remove('hide');

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

  // Hide loading screen
  if (ls) ls.classList.add('hide');
}

async function loadAll() {
  const [gsRes, playersRes, scoresRes, resultsRes, cardsRes] = await Promise.all([
    supabase.from('game_state').select('*').eq('id', 1).single(),
    supabase.from('players').select('*').order('group_number').order('created_at'),
    supabase.from('group_scores').select('*'),
    supabase.from('group_results').select('*'),
    supabase.from('group_cards').select('*'),
  ]);
  gameState = gsRes.data;
  players   = playersRes.data || [];

  allGroupCards = {};
  for (const c of (cardsRes.data || [])) {
    if (!allGroupCards[c.group_number]) allGroupCards[c.group_number] = [];
    allGroupCards[c.group_number].push(c);
  }

  groupScores = {};
  for (const s of (scoresRes.data || [])) groupScores[s.group_number] = s;

  groupResults = {};
  for (const r of (resultsRes.data || [])) {
    if (!groupResults[r.group_number]) groupResults[r.group_number] = {};
    groupResults[r.group_number][r.situation_index] = r.winning_option;
  }

  // Ensure group_scores exist for all current groups to prevent silent update failures
  const groupsToProvision = new Set(players.map(p => p.group_number));
  const missingProvisions = [];
  for (const gNum of groupsToProvision) {
    if (!groupScores[gNum]) {
      groupScores[gNum] = { cash_flow: 50, brand_trust: 50, employee_morale: 50, };
      missingProvisions.push(
        supabase.from('group_scores').upsert(
          { group_number: gNum, cash_flow: 50, brand_trust: 50, employee_morale: 50, },
          { onConflict: 'group_number' }
        )
      );
    }
  }
  if (missingProvisions.length > 0) await Promise.all(missingProvisions);

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
  renderGroupTable();
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

  // Count groups where the voter has already voted
  const groups = getGroups();
  const voterIds = new Set(players.filter(p => p.is_voter).map(p => p.id));
  const groupsVoted = votes.filter(v => voterIds.has(v.player_id)).length;
  totalVotesBar.textContent    = groupsVoted;
  totalPossibleBar.textContent = groups.length;
}

function getGroups() {
  const groupNums = [...new Set(players.map(p => p.group_number))].sort((a, b) => a - b);
  return groupNums;
}

function renderGroupTable() {
  const groups = getGroups();
  noGroupsMsg.style.display   = groups.length === 0 ? 'block' : 'none';
  groupsTable.style.display   = groups.length === 0 ? 'none'  : 'table';

  // Header
  groupsThead.innerHTML = `
    <tr>
      <th style="white-space:nowrap; text-align:left;">กลุ่ม</th>
      ${SITUATIONS.map(sit => `<th style="text-align:center;">${sit.type === 'popup' ? `P${sit.number}` : `S${sit.number}`}</th>`).join('')}
      <th style="text-align:center;">เงินสด</th>
      <th style="text-align:center;">แบรนด์</th>
      <th style="text-align:center;">ขวัญ</th>
      ${ROLES.map(r => `<th style="text-align:center;">${r}</th>`).join('')}
    </tr>`;

  // Rows
  groupsTbody.innerHTML = '';
  for (const gNum of groups) {
    groupsTbody.appendChild(buildGroupRow(gNum));
  }
}

function buildGroupRow(gNum) {
  const sitIdx = gameState?.current_situation_index ?? -1;
  const phase  = gameState?.phase ?? 'waiting';
  const gs     = groupScores[gNum] || { cash_flow: 50, brand_trust: 50, employee_morale: 50 };
  const groupPlayers = players.filter(p => p.group_number === gNum);
  const tr = document.createElement('tr');

  // Situation cells
  const sitCells = SITUATIONS.map(sit => {
    const si  = sit.index;
    const res = groupResults[gNum]?.[si];
    if (res !== undefined) {
      const color = res === 'A' ? 'var(--CFO)' : res === 'B' ? 'var(--warn)' : 'var(--danger)';
      return `<td style="text-align:center;"><span style="font-weight:700; color:${color};">${res}</span></td>`;
    }
    if (si === sitIdx && phase === 'voting') {
      const voter     = groupPlayers.find(p => p.is_voter);
      const voterVote = voter ? votes.find(v => v.player_id === voter.id) : null;
      if (voterVote) {
        const color = voterVote.choice === 'A' ? 'var(--CFO)' : 'var(--warn)';
        return `<td style="text-align:center;"><span style="font-weight:700; color:${color};">${voterVote.choice}</span></td>`;
      }
      return `<td style="text-align:center; color:var(--text-muted); font-size:18px; line-height:1;">?</td>`;
    }
    return `<td></td>`;
  }).join('');

  // Company metric cells (editable)
  const metricKeys = ['cash_flow', 'brand_trust', 'employee_morale'];
  const metricCells = metricKeys.map(key => {
    const val = gs[key];
    return `<td style="text-align:center;">
      <input type="number" class="edit-metric" data-group="${gNum}" data-key="${key}"
        value="${val}" style="width:50px; text-align:center; font-weight:700; color:${metricColor(val)};
        background:transparent; border:1px solid transparent; border-radius:4px; padding:2px;
        font-size:13px;" onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='transparent'" />
    </td>`;
  }).join('');

  // Role KPI cells (editable) + player name underneath
  const roleCells = ROLES.map(role => {
    const p = groupPlayers.find(pl => pl.role === role);
    if (!p) return `<td style="text-align:center; color:#ccc;">—</td>`;
    const fired = p.kpi_score <= FIRED_THRESHOLD;
    const voterMark = p.is_voter ? ' ★' : '';
    return `<td style="text-align:center;">
      <input type="number" class="edit-kpi" data-player-id="${p.id}" data-group="${gNum}"
        value="${p.kpi_score}" title="${p.name}${voterMark}"
        style="width:50px; text-align:center; font-weight:700; color:${scoreColor(p.kpi_score)};
        ${fired ? 'text-decoration:line-through;' : ''}
        background:transparent; border:1px solid transparent; border-radius:4px; padding:2px;
        font-size:13px;" onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='transparent'" />
      <button class="remove-player-btn" data-id="${p.id}" style="background:none;border:none;cursor:pointer;color:var(--danger);font-size:10px;padding:0 0 0 2px;opacity:0.5;" title="นำ ${p.name} ออก">✕</button>
      <div style="font-size:10px; color:var(--text-muted); margin-top:1px; opacity:0.7;">${p.name}${voterMark}</div>
    </td>`;
  }).join('');


  // Cards display
  const cards = allGroupCards[gNum] || [];
  const cardTags = cards.map(c => {
    const card = SPECIAL_CARDS[c.card_type];
    if (!card) return '';
    const status = c.is_used ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : '';
    return `<span title="${card.nameTh}${c.is_used ? ' (ใช้แล้ว)' : ''}" style="display:inline-flex; align-items:center; gap:1px; opacity:${c.is_used ? '0.45' : '1'};"><span style="display:inline-flex; width:14px; height:14px;">${card.icon}</span>${status}</span>`;
  }).join(' ');
  const cardDisplay = cardTags ? ` <span style="margin-left:4px;">${cardTags}</span>` : '';

  tr.innerHTML = `<td style="font-weight:700; white-space:nowrap; padding-right:8px;">กลุ่ม ${gNum}${cardDisplay}</td>${sitCells}${metricCells}${roleCells}`;

  tr.querySelectorAll('.remove-player-btn').forEach(btn => {
    btn.addEventListener('click', () => removePlayer(btn.dataset.id));
  });

  return tr;
}

function renderGameOver() {
  adminGameOver.classList.remove('show');
}

function updateButtons() {
  const sitIdx = gameState?.current_situation_index ?? -1;
  const phase  = gameState?.phase ?? 'waiting';
  // Sync the select to current state
  jumpSelect.value = String(sitIdx);
  jumpSelect.disabled = phase === 'voting';

  revealBtn.disabled = phase !== 'voting' || sitIdx < 0;

  // Back button: enabled when revealed, or when voting and not at first situation
  backBtn.disabled = !(
    (phase === 'revealed' && sitIdx >= 0) ||
    (phase === 'voting' && sitIdx > 0)
  );

  // Start/Next button
  if (sitIdx === -1) {
    // Game not started
    startNextBtn.textContent = '▶ เริ่มเกม';
    startNextBtn.disabled = false;
    startNextBtn.className = 'btn btn-primary';
  } else if (phase === 'revealed' && sitIdx < SITUATIONS.length - 1) {
    // Revealed, more situations ahead
    startNextBtn.textContent = '⏭ สถานการณ์ถัดไป';
    startNextBtn.disabled = false;
    startNextBtn.className = 'btn btn-primary';
  } else if (phase === 'revealed' && sitIdx === SITUATIONS.length - 1) {
    // Last situation revealed → end game
    startNextBtn.textContent = '🏁 จบเกม';
    startNextBtn.disabled = false;
    startNextBtn.className = 'btn btn-primary';
  } else {
    // Voting in progress or game ended
    startNextBtn.textContent = sitIdx >= SITUATIONS.length ? '🏁 เกมจบแล้ว' : '⏭ สถานการณ์ถัดไป';
    startNextBtn.disabled = true;
    startNextBtn.className = 'btn btn-ghost btn-sm';
  }
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
  }
  jumpSelect.disabled = false;
});

// ── Start / Next button ──────────────────────────────────────
startNextBtn.addEventListener('click', async () => {
  const sitIdx = gameState?.current_situation_index ?? -1;
  const phase  = gameState?.phase ?? 'waiting';
  let targetIdx;

  if (sitIdx === -1) {
    targetIdx = 0; // Start → S1
  } else if (phase === 'revealed') {
    targetIdx = sitIdx + 1; // Next situation (or end game)
  } else {
    return;
  }

  startNextBtn.disabled = true;
  const { error } = await supabase.from('game_state').update({
    current_situation_index: targetIdx,
    phase: targetIdx >= SITUATIONS.length ? 'ended' : 'voting',
    updated_at: new Date().toISOString(),
  }).eq('id', 1);

  if (error) {
    showToast('เกิดข้อผิดพลาด', 'error');
  } else {
    votes = [];
    const label = targetIdx >= SITUATIONS.length ? 'จบเกม' : SITUATIONS[targetIdx].title;
    showToast(`เปลี่ยนไป: ${label}`, 'success');
  }
  startNextBtn.disabled = false;
});

revealBtn.addEventListener('click', async () => {
  if (isRevealing) return;  // prevent double-reveal
  const sitIdx = gameState?.current_situation_index ?? -1;
  if (sitIdx < 0 || sitIdx >= SITUATIONS.length) return;
  isRevealing = true;
  revealBtn.disabled = true;

  await loadVotes(sitIdx);

  // ── Guard: check which groups already have results (double-score prevention)
  const { data: existingResults } = await supabase
    .from('group_results').select('group_number').eq('situation_index', sitIdx);
  const alreadyRevealed = new Set((existingResults || []).map(r => r.group_number));

  const groups = getGroups();
  const errors = [];

  // ── Guard: warn about groups where voter hasn't voted yet
  const voterIds = new Set(players.filter(p => p.is_voter).map(p => p.id));
  const votedVoterIds = new Set(votes.filter(v => voterIds.has(v.player_id)).map(v => v.player_id));
  const notYetVoted = groups.filter(gNum => {
    const voter = players.find(p => p.group_number === gNum && p.is_voter);
    return voter && !votedVoterIds.has(voter.id);
  });

  const warnings = [];
  if (notYetVoted.length > 0)
    warnings.push(`ยังไม่โหวต: ${notYetVoted.map(g => `กลุ่ม ${g}`).join(', ')}`);
  if (alreadyRevealed.size > 0)
    warnings.push(`เปิดผลไปแล้ว (จะถูกข้าม): ${[...alreadyRevealed].map(g => `กลุ่ม ${g}`).join(', ')}`);

  if (warnings.length > 0 && !confirm(`คำเตือน:\n${warnings.join('\n')}\n\nดำเนินการต่อหรือไม่?`)) {
    isRevealing = false;
    revealBtn.disabled = false;
    return;
  }

  for (const gNum of groups) {
    // Skip groups already scored for this situation
    if (alreadyRevealed.has(gNum)) continue;

    const groupPlayers = players.filter(p => p.group_number === gNum);
    const voter = groupPlayers.find(p => p.is_voter);

    // Skip groups with no voter registered
    if (!voter) {
      showToast(`กลุ่ม ${gNum}: ไม่มีผู้โหวตในกลุ่มนี้ — ข้ามกลุ่มนี้`, 'error');
      continue;
    }

    const voterVote = votes.find(v => v.player_id === voter.id);
    const currentCompany = groupScores[gNum] || { ...INITIAL_COMPANY };

    let newCompany, newPlayerScores, winner, playerUpdates;

    // Snapshot who is already fired BEFORE applying scores
    const alreadyFiredIds = new Set(
      groupPlayers.filter(p => p.kpi_score <= FIRED_THRESHOLD).map(p => p.id)
    );

    if (!voterVote) {
      // No-vote penalty (X): company -10 each, KPI unchanged
      winner = 'X';
      newCompany      = {
        cash_flow:       currentCompany.cash_flow - 10,
        brand_trust:     currentCompany.brand_trust - 10,
        employee_morale: currentCompany.employee_morale - 10,
      };
      newPlayerScores = null;
      playerUpdates   = [];
      showToast(`กลุ่ม ${gNum}: ผู้โหวตไม่โหวตทันเวลา — หักคะแนนบริษัท -10`, 'error');
    } else {
      winner = voterVote.choice;
      const currentKpis = {};
      for (const p of groupPlayers) currentKpis[p.role] = p.kpi_score;
      ({ newCompany, newPlayerScores } = applyScores(sitIdx, winner, currentKpis, currentCompany));

      // Apply new scores to local state first (so layoff uses post-situation scores)
      // If personal KPI drops ≤ 0 → clamp to FIRED_THRESHOLD (auto-fired)
      for (const p of groupPlayers) {
        if (p.kpi_score > FIRED_THRESHOLD) {
          p.kpi_score = newPlayerScores[p.role];
          if (p.kpi_score <= FIRED_THRESHOLD) p.kpi_score = FIRED_THRESHOLD;
        }
      }
    }

    // Check if any company KPI went ≤ 0 → auto-layoff lowest KPI player → then reset to 5
    let autoLayoff = false;
    let layoffPlayerId = null;
    let layoffReason = null;
    if (newCompany.cash_flow <= GAME_OVER_THRESHOLD ||
        newCompany.brand_trust <= GAME_OVER_THRESHOLD ||
        newCompany.employee_morale <= GAME_OVER_THRESHOLD) {
      autoLayoff = true;
      const reasons = [];
      if (newCompany.cash_flow <= GAME_OVER_THRESHOLD) reasons.push('กระแสเงินสด');
      if (newCompany.brand_trust <= GAME_OVER_THRESHOLD) reasons.push('ความเชื่อมั่นแบรนด์');
      if (newCompany.employee_morale <= GAME_OVER_THRESHOLD) reasons.push('ขวัญกำลังใจ');

      // Auto-layoff: fire the player with lowest KPI (using post-situation scores)
      // If tied, pick randomly among the lowest
      const alive = groupPlayers.filter(p => p.kpi_score > FIRED_THRESHOLD);
      if (alive.length > 0) {
        const minScore = Math.min(...alive.map(p => p.kpi_score));
        const tied = alive.filter(p => p.kpi_score === minScore);
        const lowest = tied[Math.floor(Math.random() * tied.length)];
        const reasonText = reasons.join(', ');
        lowest.kpi_score = FIRED_THRESHOLD;
        layoffPlayerId = lowest.id;
        layoffReason = `${reasonText} ติดลบ → ถูก lay off เนื่องจาก KPI ต่ำที่สุดในกลุ่ม`;
        showToast(`กลุ่ม ${gNum}: ${reasonText} ติดลบ → ${lowest.name} (${lowest.role}) ถูก lay off (KPI ต่ำสุด)`, 'error');
      } else {
        showToast(`กลุ่ม ${gNum}: ${reasons.join(', ')} ติดลบ → ไม่มีสมาชิกเหลือให้ lay off`, 'error');
      }

      // Reset negative company metrics to 5 AFTER layoff
      if (newCompany.cash_flow <= GAME_OVER_THRESHOLD) newCompany.cash_flow = 5;
      if (newCompany.brand_trust <= GAME_OVER_THRESHOLD) newCompany.brand_trust = 5;
      if (newCompany.employee_morale <= GAME_OVER_THRESHOLD) newCompany.employee_morale = 5;
    }

    // Build player DB updates — skip players who were already fired before this round
    playerUpdates = groupPlayers
      .filter(p => !alreadyFiredIds.has(p.id))
      .map(p => {
        const update = { kpi_score: p.kpi_score };
        if (p.id === layoffPlayerId) update.layoff_reason = layoffReason;
        return supabase.from('players').update(update).eq('id', p.id);
      });

    const currentFireCount = (groupScores[gNum]?.fire_count ?? 0);
    const [companyRes, resultRes, ...playerResults] = await Promise.all([
      supabase.from('group_scores').upsert({
        group_number:    gNum,
        cash_flow:       newCompany.cash_flow,
        brand_trust:     newCompany.brand_trust,
        employee_morale: newCompany.employee_morale,
        fire_count:      autoLayoff ? currentFireCount + 1 : currentFireCount,
      }, { onConflict: 'group_number' }),
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
      if (!groupResults[gNum]) groupResults[gNum] = {};
      groupResults[gNum][sitIdx] = winner;
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

  isRevealing = false;
  renderGroupTable();
  renderGameOver();
});

const resetModal        = document.getElementById('reset-modal');
const resetModalConfirm = document.getElementById('reset-modal-confirm');
const resetModalCancel  = document.getElementById('reset-modal-cancel');

resetBtn.addEventListener('click', () => {
  resetModal.style.display = 'flex';
});

resetModalCancel.addEventListener('click', () => {
  resetModal.style.display = 'none';
});

resetModalConfirm.addEventListener('click', async () => {
  resetModal.style.display = 'none';

  await Promise.all([
    supabase.from('votes').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    supabase.from('players').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    supabase.from('group_scores').delete().neq('group_number', -999),
    supabase.from('group_results').delete().neq('group_number', -999),
    supabase.from('group_cards').delete().neq('id', -999),
    supabase.from('game_state').update({
      current_situation_index: -1,
      phase: 'waiting',
      updated_at: new Date().toISOString(),
    }).eq('id', 1),
  ]);

  players      = [];
  votes        = [];
  groupScores  = {};
  groupResults = {};
  allGroupCards = {};
  gameState    = { id: 1, current_situation_index: -1, phase: 'waiting' };
  renderAll();
  showToast('รีเซ็ตเกมเรียบร้อยแล้ว', 'success');
});

// ── Remove player ─────────────────────────────────────────────
async function removePlayer(playerId) {
  if (!confirm('นำผู้เล่นออกจากเกม? โหวตของผู้เล่นคนนี้จะถูกลบด้วย')) return;

  await supabase.from('votes').delete().eq('player_id', playerId);
  await supabase.from('players').delete().eq('id', playerId);

  players = players.filter(p => p.id !== playerId);
  renderGroupTable();
  renderSituationBar();
  showToast('นำผู้เล่นออกเรียบร้อยแล้ว', 'success');
}

// ── Editable stats (delegated events) ─────────────────────────
document.addEventListener('change', async (e) => {
  // Company metric edit
  if (e.target.classList.contains('edit-metric')) {
    const gNum = parseInt(e.target.dataset.group);
    const key  = e.target.dataset.key;
    const val  = parseInt(e.target.value);
    if (isNaN(val)) return;

    const { error } = await supabase.from('group_scores')
      .update({ [key]: val }).eq('group_number', gNum);
    if (error) {
      showToast('ไม่สามารถอัปเดตคะแนนได้', 'error');
    } else {
      if (groupScores[gNum]) groupScores[gNum][key] = val;
      showToast(`กลุ่ม ${gNum}: อัปเดต ${key} = ${val}`, 'success');
      renderGameOver();
    }
  }

  // Player KPI edit
  if (e.target.classList.contains('edit-kpi')) {
    const playerId = e.target.dataset.playerId;
    const val = parseInt(e.target.value);
    if (isNaN(val)) return;

    const { error } = await supabase.from('players')
      .update({ kpi_score: val }).eq('id', playerId);
    if (error) {
      showToast('ไม่สามารถอัปเดต KPI ได้', 'error');
    } else {
      const p = players.find(pl => pl.id === playerId);
      if (p) p.kpi_score = val;
      showToast(`อัปเดต KPI: ${val}`, 'success');
    }
  }
});

// ── Back button ───────────────────────────────────────────────
backBtn.addEventListener('click', async () => {
  const sitIdx = gameState?.current_situation_index ?? -1;
  const phase  = gameState?.phase ?? 'waiting';

  // Can go back if: current index > 0 OR (index 0 and revealed)
  // We go back to the previous situation in voting phase
  let targetIdx;
  if (phase === 'revealed') {
    // Go back to same situation in voting phase — undo the reveal
    targetIdx = sitIdx;
  } else if (phase === 'voting' && sitIdx > 0) {
    // Go back to previous situation
    targetIdx = sitIdx - 1;
  } else {
    return;
  }

  if (!confirm(`ย้อนกลับ${phase === 'revealed' ? ' (ยกเลิกการเปิดผล)' : ''}?`)) return;
  backBtn.disabled = true;

  if (phase === 'revealed') {
    // Undo reveal: revert scores for all groups for this situation
    const groups = getGroups();
    for (const gNum of groups) {
      const result = groupResults[gNum]?.[sitIdx];
      if (result === undefined) continue;

      const groupPlayers = players.filter(p => p.group_number === gNum);
      const sit = SITUATIONS[sitIdx];

      if (result !== 'X') {
        // Reverse the score changes
        const opt = result === 'A' ? sit.optionA : sit.optionB;
        const gs = groupScores[gNum];

        // Reverse company scores
        await supabase.from('group_scores').upsert({
          group_number:    gNum,
          cash_flow:       (gs.cash_flow ?? 50)       - (opt.company.cash_flow ?? 0),
          brand_trust:     (gs.brand_trust ?? 50)     - (opt.company.brand_trust ?? 0),
          employee_morale: (gs.employee_morale ?? 50) - (opt.company.employee_morale ?? 0),
        }, { onConflict: 'group_number' });

        // Reverse player KPIs
        for (const p of groupPlayers) {
          const delta = opt.kpi[p.role] ?? 0;
          await supabase.from('players').update({ kpi_score: p.kpi_score - delta }).eq('id', p.id);
          p.kpi_score -= delta;
        }

        // Update local state
        gs.cash_flow       -= (opt.company.cash_flow ?? 0);
        gs.brand_trust     -= (opt.company.brand_trust ?? 0);
        gs.employee_morale -= (opt.company.employee_morale ?? 0);
      } else {
        // Reverse X penalty (+10 each)
        const gs = groupScores[gNum];
        await supabase.from('group_scores').upsert({
          group_number:    gNum,
          cash_flow:       gs.cash_flow + 10,
          brand_trust:     gs.brand_trust + 10,
          employee_morale: gs.employee_morale + 10,
        }, { onConflict: 'group_number' });
        gs.cash_flow += 10;
        gs.brand_trust += 10;
        gs.employee_morale += 10;
      }

      // Delete the group result
      await supabase.from('group_results').delete()
        .eq('group_number', gNum).eq('situation_index', sitIdx);
      if (groupResults[gNum]) delete groupResults[gNum][sitIdx];
    }

    // Set phase back to voting
    await supabase.from('game_state').update({
      phase: 'voting',
      updated_at: new Date().toISOString(),
    }).eq('id', 1);

    showToast('ยกเลิกการเปิดผลเรียบร้อย', 'success');
  } else {
    // Go back to previous situation — also need to undo that situation's results if revealed
    // First check if the previous situation was revealed
    const prevResult = Object.values(groupResults).some(gr => gr[targetIdx] !== undefined);

    if (prevResult) {
      // Undo the previous situation's reveal too
      const groups = getGroups();
      for (const gNum of groups) {
        const result = groupResults[gNum]?.[targetIdx];
        if (result === undefined) continue;

        const groupPlayers = players.filter(p => p.group_number === gNum);
        const sit = SITUATIONS[targetIdx];

        if (result !== 'X') {
          const opt = result === 'A' ? sit.optionA : sit.optionB;
          const gs = groupScores[gNum];

          await supabase.from('group_scores').upsert({
            group_number:    gNum,
            cash_flow:       (gs.cash_flow ?? 50)       - (opt.company.cash_flow ?? 0),
            brand_trust:     (gs.brand_trust ?? 50)     - (opt.company.brand_trust ?? 0),
            employee_morale: (gs.employee_morale ?? 50) - (opt.company.employee_morale ?? 0),
            }, { onConflict: 'group_number' });

          for (const p of groupPlayers) {
            const delta = opt.kpi[p.role] ?? 0;
            await supabase.from('players').update({ kpi_score: p.kpi_score - delta }).eq('id', p.id);
            p.kpi_score -= delta;
          }

          gs.cash_flow       -= (opt.company.cash_flow ?? 0);
          gs.brand_trust     -= (opt.company.brand_trust ?? 0);
          gs.employee_morale -= (opt.company.employee_morale ?? 0);
          } else {
          const gs = groupScores[gNum];
          await supabase.from('group_scores').upsert({
            group_number:    gNum,
            cash_flow:       gs.cash_flow + 10,
            brand_trust:     gs.brand_trust + 10,
            employee_morale: gs.employee_morale + 10,
            }, { onConflict: 'group_number' });
          gs.cash_flow += 10;
          gs.brand_trust += 10;
          gs.employee_morale += 10;
        }

        await supabase.from('group_results').delete()
          .eq('group_number', gNum).eq('situation_index', targetIdx);
        if (groupResults[gNum]) delete groupResults[gNum][targetIdx];
      }
    }

    // Delete votes for current situation
    await supabase.from('votes').delete().eq('situation_index', sitIdx);

    // Move to previous situation in voting phase
    await supabase.from('game_state').update({
      current_situation_index: targetIdx,
      phase: 'voting',
      updated_at: new Date().toISOString(),
    }).eq('id', 1);

    votes = [];
    showToast(`ย้อนกลับไป: ${SITUATIONS[targetIdx].title}`, 'success');
  }

  await loadAll();
  renderAll();
});

// ── Subscriptions ─────────────────────────────────────────────
function subscribeToChanges() {
  let playersFetchTimeout = null;

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
    .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => {
      if (playersFetchTimeout) clearTimeout(playersFetchTimeout);
      playersFetchTimeout = setTimeout(async () => {
        const { data } = await supabase.from('players').select('*').order('group_number').order('created_at');
        players = data || [];
        renderGroupTable();
        renderSituationBar();
      }, 300);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, async () => {
      if (gameState && gameState.current_situation_index >= 0) {
        await loadVotes(gameState.current_situation_index);
        renderGroupTable();
        renderSituationBar();
        updateButtons();
      }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'group_scores' }, payload => {
      if (payload.new?.group_number != null) {
        groupScores[payload.new.group_number] = payload.new;
        renderGroupTable();
        renderGameOver();
      }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'group_results' }, payload => {
      if (payload.new?.group_number != null) {
        if (!groupResults[payload.new.group_number]) groupResults[payload.new.group_number] = {};
        groupResults[payload.new.group_number][payload.new.situation_index] = payload.new.winning_option;
        renderGroupTable();
      }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'group_cards' }, async () => {
      const { data } = await supabase.from('group_cards').select('*');
      allGroupCards = {};
      for (const c of (data || [])) {
        if (!allGroupCards[c.group_number]) allGroupCards[c.group_number] = [];
        allGroupCards[c.group_number].push(c);
      }
      renderGroupTable();
    })
    .subscribe((status, err) => {
      console.log('[Admin Realtime]', status, err || '');
      if (status === 'SUBSCRIBED') {
        console.log('[Admin Realtime] Connected');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error('[Admin Realtime] Connection failed:', status, err);
        showToast('การเชื่อมต่อหลุด — กำลังเชื่อมต่อใหม่...', 'error');
        setTimeout(() => {
          supabase.removeChannel(supabase.channel('admin-watch'));
          subscribeToChanges();
          loadAll().then(() => renderAll());
        }, 3000);
      }
    });
}

// ── Helpers ───────────────────────────────────────────────────
function scoreColor(v) {
  if (v <= FIRED_THRESHOLD) return 'var(--text-muted)';
  if (v <= 20) return 'var(--danger)';
  if (v <= 35) return 'var(--warn)';
  return 'var(--success)';
}
function metricColor(v) {
  if (v <= GAME_OVER_THRESHOLD) return 'var(--danger)';
  if (v <= 25) return 'var(--warn)';
  return 'var(--text)';
}
function showToast(msg, type = '') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}
