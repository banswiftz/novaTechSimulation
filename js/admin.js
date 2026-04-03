import { supabase } from './supabase.js';
import {
  SITUATIONS, ROLES,
  INITIAL_COMPANY,
  GAME_OVER_THRESHOLD, FIRED_THRESHOLD,
  applyScores
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

// ── DOM refs ─────────────────────────────────────────────────
const jumpSelect       = document.getElementById('jump-select');
const revealBtn        = document.getElementById('reveal-btn');
const resetBtn         = document.getElementById('reset-btn');
const backBtn          = document.getElementById('back-btn');
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
  const [gsRes, playersRes, scoresRes, resultsRes] = await Promise.all([
    supabase.from('game_state').select('*').eq('id', 1).single(),
    supabase.from('players').select('*').order('group_number').order('created_at'),
    supabase.from('group_scores').select('*'),
    supabase.from('group_results').select('*'),
  ]);
  gameState = gsRes.data;
  players   = playersRes.data || [];

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
      groupScores[gNum] = { cash_flow: 50, brand_trust: 50, employee_morale: 50, pending_fire: false };
      missingProvisions.push(
        supabase.from('group_scores').upsert(
          { group_number: gNum, cash_flow: 50, brand_trust: 50, employee_morale: 50, pending_fire: false },
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
  const pendingFire = gs.pending_fire;

  const tr = document.createElement('tr');
  if (pendingFire) tr.style.background = 'rgba(245,158,11,0.12)';

  // Situation cells
  const sitCells = SITUATIONS.map(sit => {
    const si  = sit.index;
    const res = groupResults[gNum]?.[si];
    if (res !== undefined) {
      const color = res === 'A' ? '#4f8ef7' : res === 'B' ? '#f59e0b' : '#f05252';
      return `<td style="text-align:center;"><span style="font-weight:700; color:${color};">${res}</span></td>`;
    }
    if (si === sitIdx && phase === 'voting') {
      const voter     = groupPlayers.find(p => p.is_voter);
      const voterVote = voter ? votes.find(v => v.player_id === voter.id) : null;
      if (voterVote) {
        const color = voterVote.choice === 'A' ? '#4f8ef7' : '#f59e0b';
        return `<td style="text-align:center;"><span style="font-weight:700; color:${color};">${voterVote.choice}</span></td>`;
      }
      return `<td style="text-align:center; color:#8892a4; font-size:18px; line-height:1;">?</td>`;
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

  // Role KPI cells (editable)
  const roleCells = ROLES.map(role => {
    const p = groupPlayers.find(pl => pl.role === role);
    if (!p) return `<td style="text-align:center; color:#444;">—</td>`;
    const fired = p.kpi_score <= FIRED_THRESHOLD;
    const voterMark = p.is_voter ? ' ★' : '';
    return `<td style="text-align:center;">
      <input type="number" class="edit-kpi" data-player-id="${p.id}" data-group="${gNum}"
        value="${p.kpi_score}" title="${p.name}${voterMark}"
        style="width:50px; text-align:center; font-weight:700; color:${scoreColor(p.kpi_score)};
        ${fired ? 'text-decoration:line-through;' : ''}
        background:transparent; border:1px solid transparent; border-radius:4px; padding:2px;
        font-size:13px;" onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='transparent'" />
      <button class="remove-player-btn" data-id="${p.id}" style="background:none;border:none;cursor:pointer;color:#f05252;font-size:10px;padding:0 0 0 2px;opacity:0.5;" title="นำ ${p.name} ออก">✕</button>
    </td>`;
  }).join('');

  const fireTag = pendingFire ? ' <span style="color:#f59e0b; font-size:11px; font-weight:600;">⚠ รอไล่ออก</span>' : '';
  tr.innerHTML = `<td style="font-weight:700; white-space:nowrap; padding-right:8px;">กลุ่ม ${gNum}${fireTag}</td>${sitCells}${metricCells}${roleCells}`;

  tr.querySelectorAll('.remove-player-btn').forEach(btn => {
    btn.addEventListener('click', () => removePlayer(btn.dataset.id));
  });

  return tr;
}

function renderGameOver() {
  const fireVoteGroups = Object.entries(groupScores).filter(([, gs]) =>
    gs.pending_fire
  ).map(([gNum]) => `กลุ่ม ${gNum}`);

  if (fireVoteGroups.length > 0) {
    adminGameOver.classList.add('show');
    adminGoReason.textContent = `รอโหวตไล่ออก: ${fireVoteGroups.join(', ')}`;
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

  // Back button: enabled when revealed, or when voting and not at first situation
  backBtn.disabled = !(
    (phase === 'revealed' && sitIdx >= 0) ||
    (phase === 'voting' && sitIdx > 0)
  );
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

      playerUpdates = groupPlayers
        .filter(p => p.kpi_score > FIRED_THRESHOLD)  // freeze KPI for fired players
        .map(p =>
          supabase.from('players').update({ kpi_score: newPlayerScores[p.role] }).eq('id', p.id)
        );
    }

    // Check if any company KPI went ≤ 0 → reset to +5 and trigger fire vote
    let needsFireVote = false;
    if (newCompany.cash_flow <= GAME_OVER_THRESHOLD ||
        newCompany.brand_trust <= GAME_OVER_THRESHOLD ||
        newCompany.employee_morale <= GAME_OVER_THRESHOLD) {
      needsFireVote = true;
      const reasons = [];
      if (newCompany.cash_flow <= GAME_OVER_THRESHOLD) { reasons.push('กระแสเงินสด'); newCompany.cash_flow = 5; }
      if (newCompany.brand_trust <= GAME_OVER_THRESHOLD) { reasons.push('ความเชื่อมั่นแบรนด์'); newCompany.brand_trust = 5; }
      if (newCompany.employee_morale <= GAME_OVER_THRESHOLD) { reasons.push('ขวัญกำลังใจ'); newCompany.employee_morale = 5; }
      showToast(`กลุ่ม ${gNum}: ${reasons.join(', ')} ติดลบ → รีเซ็ตเป็น 5 — ต้องไล่ออก 1 คน`, 'error');
    }

    const [companyRes, resultRes, ...playerResults] = await Promise.all([
      supabase.from('group_scores').upsert({
        group_number:    gNum,
        cash_flow:       newCompany.cash_flow,
        brand_trust:     newCompany.brand_trust,
        employee_morale: newCompany.employee_morale,
        pending_fire:    needsFireVote,
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
      if (newPlayerScores) {
        for (const p of groupPlayers) {
          if (p.kpi_score > FIRED_THRESHOLD) p.kpi_score = newPlayerScores[p.role];
        }
      }
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

  renderGroupTable();
  renderGameOver();
});

resetBtn.addEventListener('click', async () => {
  if (!confirm('รีเซ็ตเกมทั้งหมด? การดำเนินการนี้จะลบผู้เล่น โหวต และคะแนนทั้งหมด')) return;

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

        // Reverse company scores + clear pending_fire
        await supabase.from('group_scores').upsert({
          group_number:    gNum,
          cash_flow:       (gs.cash_flow ?? 50)       - (opt.company.cash_flow ?? 0),
          brand_trust:     (gs.brand_trust ?? 50)     - (opt.company.brand_trust ?? 0),
          employee_morale: (gs.employee_morale ?? 50) - (opt.company.employee_morale ?? 0),
          pending_fire:    false,
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
        gs.pending_fire     = false;
      } else {
        // Reverse X penalty (+10 each)
        const gs = groupScores[gNum];
        await supabase.from('group_scores').upsert({
          group_number:    gNum,
          cash_flow:       gs.cash_flow + 10,
          brand_trust:     gs.brand_trust + 10,
          employee_morale: gs.employee_morale + 10,
          pending_fire:    false,
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
            pending_fire:    false,
          }, { onConflict: 'group_number' });

          for (const p of groupPlayers) {
            const delta = opt.kpi[p.role] ?? 0;
            await supabase.from('players').update({ kpi_score: p.kpi_score - delta }).eq('id', p.id);
            p.kpi_score -= delta;
          }

          gs.cash_flow       -= (opt.company.cash_flow ?? 0);
          gs.brand_trust     -= (opt.company.brand_trust ?? 0);
          gs.employee_morale -= (opt.company.employee_morale ?? 0);
          gs.pending_fire     = false;
        } else {
          const gs = groupScores[gNum];
          await supabase.from('group_scores').upsert({
            group_number:    gNum,
            cash_flow:       gs.cash_flow + 10,
            brand_trust:     gs.brand_trust + 10,
            employee_morale: gs.employee_morale + 10,
            pending_fire:    false,
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
    .subscribe((status, err) => {
      console.log('[Admin Realtime]', status, err || '');
      if (status === 'SUBSCRIBED') {
        console.log('[Admin Realtime] ✅ Connected — realtime is working');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error('[Admin Realtime] ❌ Connection failed:', status, err);
        showToast('Realtime ไม่สามารถเชื่อมต่อได้ — กรุณารีเฟรช', 'error');
      }
    });
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
