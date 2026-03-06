import { supabase } from './supabase.js';
import {
  SITUATIONS, ROLE_KPI_NAMES,
  GAME_OVER_THRESHOLD, FIRED_THRESHOLD, fmtDelta
} from './game-data.js';

// ── Player session ───────────────────────────────────────────
const playerId   = localStorage.getItem('novatech_player_id');
const playerRole = localStorage.getItem('novatech_player_role');
const playerName = localStorage.getItem('novatech_player_name');
const groupNumber= parseInt(localStorage.getItem('novatech_group_number') || '1');

if (!playerId || !playerRole) {
  window.location.href = 'index.html';
}

// ── DOM refs ─────────────────────────────────────────────────
const nameDisplay  = document.getElementById('player-name-display');
const roleBadge    = document.getElementById('role-badge');
const kpiValue     = document.getElementById('kpi-value');
const kpiLabel     = document.getElementById('kpi-label');
const firedNotice  = document.getElementById('fired-notice');
const cashVal      = document.getElementById('cash-val');
const brandVal     = document.getElementById('brand-val');
const moraleVal    = document.getElementById('morale-val');
const metricCash   = document.getElementById('metric-cash');
const metricBrand  = document.getElementById('metric-brand');
const metricMorale = document.getElementById('metric-morale');
const gameOverBanner = document.getElementById('game-over-banner');
const gameOverReason = document.getElementById('game-over-reason');

const stateLobby    = document.getElementById('state-lobby');
const stateVoting   = document.getElementById('state-voting');
const stateRevealed = document.getElementById('state-revealed');
const stateEnd      = document.getElementById('state-end');

const progressSteps = document.querySelectorAll('.progress-step');

// ── Init header ───────────────────────────────────────────────
nameDisplay.textContent = `${playerName} · กลุ่ม ${groupNumber}`;
roleBadge.textContent   = playerRole || '';
roleBadge.className     = `role-badge role-${playerRole}`;
kpiLabel.textContent    = ROLE_KPI_NAMES[playerRole] || 'KPI Score';

// ── Logout ────────────────────────────────────────────────────
document.getElementById('logout-btn').addEventListener('click', async () => {
  if (!confirm('ออกจากเกม? คุณจะต้องเข้าร่วมใหม่อีกครั้ง')) return;
  await supabase.from('votes').delete().eq('player_id', playerId);
  await supabase.from('players').delete().eq('id', playerId);
  clearSession();
  window.location.href = 'index.html';
});

function clearSession() {
  localStorage.removeItem('novatech_player_id');
  localStorage.removeItem('novatech_player_role');
  localStorage.removeItem('novatech_player_name');
  localStorage.removeItem('novatech_group_number');
}

function showRemovedScreen(headline, sub) {
  clearSession();
  const overlay = document.getElementById('removed-overlay');
  document.getElementById('removed-headline').textContent = headline;
  document.getElementById('removed-sub').textContent = sub;
  overlay.style.display = 'flex';
}

// ── Local state ──────────────────────────────────────────────
let currentSitIdx   = -1;
let myVote          = null;
let lastRevealedIdx = -1;
let myKpiScore      = 50;

// ── Init ─────────────────────────────────────────────────────
async function init() {
  const [{ data: player }, { data: company }, { data: gameState }] = await Promise.all([
    supabase.from('players').select('*').eq('id', playerId).single(),
    supabase.from('group_scores').select('*').eq('group_number', groupNumber).single(),
    supabase.from('game_state').select('*').eq('id', 1).single(),
  ]);

  if (player)    updateKpi(player.kpi_score);
  if (company)   updateCompany(company);
  if (gameState) await applyGameState(gameState, company, player);

  subscribeToChanges();
}

// ── Subscriptions ─────────────────────────────────────────────
function subscribeToChanges() {
  supabase.channel('player-watch')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'game_state' }, async payload => {
      const gs = payload.new;
      // On game reset, check if we still exist
      if (gs.current_situation_index === -1) {
        const { data: stillExists } = await supabase.from('players').select('id').eq('id', playerId).maybeSingle();
        if (!stillExists) {
          showRemovedScreen('เกมถูกรีเซ็ต', 'ผู้ดำเนินเกมได้รีเซ็ตเกมแล้ว กรุณาเข้าร่วมใหม่อีกครั้ง');
          return;
        }
      }
      const [{ data: company }, { data: player }] = await Promise.all([
        supabase.from('group_scores').select('*').eq('group_number', groupNumber).single(),
        supabase.from('players').select('*').eq('id', playerId).single(),
      ]);
      await applyGameState(gs, company, player);
    })
    // Detect when this player is removed by admin
    .on('postgres_changes', {
      event: 'DELETE', schema: 'public', table: 'players',
      filter: `id=eq.${playerId}`
    }, () => {
      showRemovedScreen('คุณถูกนำออกจากเกม', 'ผู้ดำเนินเกมได้นำคุณออกจากเกมแล้ว คุณสามารถเข้าร่วมกลุ่มใหม่ได้');
    })
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'group_scores',
      filter: `group_number=eq.${groupNumber}`
    }, payload => {
      updateCompany(payload.new);
    })
    .on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'players',
      filter: `id=eq.${playerId}`
    }, payload => {
      updateKpi(payload.new.kpi_score);
    })
    // Watch group_results for our group — triggers revealed screen
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'group_results',
      filter: `group_number=eq.${groupNumber}`
    }, async payload => {
      const result = payload.new;
      if (result.situation_index === currentSitIdx && lastRevealedIdx !== currentSitIdx) {
        lastRevealedIdx = currentSitIdx;
        const { data: company } = await supabase.from('group_scores').select('*').eq('group_number', groupNumber).single();
        const { data: player }  = await supabase.from('players').select('*').eq('id', playerId).single();
        showRevealed(SITUATIONS[currentSitIdx], result.winning_option, company, player);
      }
    })
    .subscribe();
}

// ── Apply game state ──────────────────────────────────────────
async function applyGameState(gs, company, player) {
  currentSitIdx = gs.current_situation_index;
  updateProgress(currentSitIdx);

  if (currentSitIdx === -1) { showState('lobby'); return; }
  if (currentSitIdx >= SITUATIONS.length) { showEndScreen(player, company); return; }

  const sit = SITUATIONS[currentSitIdx];

  if (gs.phase === 'voting') {
    myVote = null;
    const { data: existingVote } = await supabase
      .from('votes')
      .select('choice')
      .eq('player_id', playerId)
      .eq('situation_index', currentSitIdx)
      .maybeSingle();

    if (existingVote) myVote = existingVote.choice;
    showVoting(sit, myVote);

  } else if (gs.phase === 'revealed') {
    if (lastRevealedIdx !== currentSitIdx) {
      // Look up this group's result
      const { data: result } = await supabase
        .from('group_results')
        .select('winning_option')
        .eq('group_number', groupNumber)
        .eq('situation_index', currentSitIdx)
        .maybeSingle();

      if (result) {
        lastRevealedIdx = currentSitIdx;
        showRevealed(sit, result.winning_option, company, player);
      }
    }
  }
}

// ── UI: Show state ────────────────────────────────────────────
function showState(name) {
  stateLobby.style.display    = name === 'lobby'    ? 'block' : 'none';
  stateVoting.style.display   = name === 'voting'   ? 'block' : 'none';
  stateRevealed.style.display = name === 'revealed' ? 'block' : 'none';
  stateEnd.style.display      = name === 'end'      ? 'block' : 'none';
}

// ── UI: Voting ────────────────────────────────────────────────
function showVoting(sit, alreadyVoted) {
  showState('voting');

  const typeEl = document.getElementById('sit-type');
  typeEl.textContent = sit.type === 'popup' ? `เหตุการณ์พิเศษ ${sit.number}` : `สถานการณ์ ${sit.number}`;
  typeEl.className = `situation-type${sit.type === 'popup' ? ' popup' : ''}`;

  document.getElementById('sit-title').textContent    = sit.title;
  document.getElementById('sit-desc').textContent     = sit.description;
  document.getElementById('opt-a-title').textContent  = sit.optionA.label;
  document.getElementById('opt-a-desc').textContent   = sit.optionA.description;
  document.getElementById('opt-b-title').textContent  = sit.optionB.label;
  document.getElementById('opt-b-desc').textContent   = sit.optionB.description;

  const btnA = document.getElementById('btn-a');
  const btnB = document.getElementById('btn-b');
  const votedNotice = document.getElementById('voted-notice');

  btnA.className = 'option-btn';
  btnB.className = 'option-btn';

  // Fired players cannot vote
  if (myKpiScore <= FIRED_THRESHOLD) {
    btnA.disabled = true; btnB.disabled = true;
    votedNotice.style.display = 'block';
    votedNotice.textContent = 'คุณถูกไล่ออกแล้ว — ไม่สามารถโหวตได้';
    return;
  }

  votedNotice.textContent = 'ส่งโหวตแล้ว รอผลจากสมาชิกคนอื่น...';

  if (alreadyVoted) {
    btnA.disabled = true; btnB.disabled = true;
    votedNotice.style.display = 'block';
    (alreadyVoted === 'A' ? btnA : btnB).classList.add('selected');
  } else {
    btnA.disabled = false; btnB.disabled = false;
    votedNotice.style.display = 'none';
    btnA.onclick = () => submitVote('A');
    btnB.onclick = () => submitVote('B');
  }
}

async function submitVote(choice) {
  const btnA = document.getElementById('btn-a');
  const btnB = document.getElementById('btn-b');
  btnA.disabled = true; btnB.disabled = true;

  const { error } = await supabase.from('votes').upsert({
    player_id: playerId,
    situation_index: currentSitIdx,
    choice,
  }, { onConflict: 'player_id,situation_index' });

  if (error) {
    showToast('ไม่สามารถส่งโหวตได้ กรุณาลองใหม่อีกครั้ง', 'error');
    btnA.disabled = false; btnB.disabled = false;
    return;
  }

  myVote = choice;
  document.getElementById('voted-notice').style.display = 'block';
  (choice === 'A' ? btnA : btnB).classList.add('selected');
  showToast('ส่งโหวตเรียบร้อยแล้ว!', 'success');
}

// ── UI: Revealed ──────────────────────────────────────────────
function showRevealed(sit, winningOption, company, player) {
  showState('revealed');

  const typeEl = document.getElementById('sit-type-r');
  typeEl.textContent = sit.type === 'popup' ? `เหตุการณ์พิเศษ ${sit.number}` : `สถานการณ์ ${sit.number}`;
  typeEl.className = `situation-type${sit.type === 'popup' ? ' popup' : ''}`;
  document.getElementById('sit-title-r').textContent = sit.title;

  document.getElementById('res-a-title').textContent = sit.optionA.label;
  document.getElementById('res-b-title').textContent = sit.optionB.label;

  const rBtnA = document.getElementById('result-btn-a');
  const rBtnB = document.getElementById('result-btn-b');
  rBtnA.className = `option-btn ${winningOption === 'A' ? 'winner' : 'loser'}`;
  rBtnB.className = `option-btn ${winningOption === 'B' ? 'winner' : 'loser'}`;

  const chosenBtn = winningOption === 'A' ? rBtnA : rBtnB;
  chosenBtn.querySelector('.opt-label').textContent = `ตัวเลือก ${winningOption} — กลุ่มของคุณเลือก`;

  // My KPI delta
  const opt = winningOption === 'A' ? sit.optionA : sit.optionB;
  const myDelta = opt.kpi[playerRole] ?? 0;
  const myDeltaEl = document.getElementById('my-delta');
  myDeltaEl.innerHTML = '';
  const chip = document.createElement('span');
  chip.className = `delta-chip ${myDelta > 0 ? 'pos' : myDelta < 0 ? 'neg' : 'neu'}`;
  chip.textContent = `${playerRole}: ${fmtDelta(myDelta)}`;
  myDeltaEl.appendChild(chip);

  // Company deltas
  const companyDeltasEl = document.getElementById('company-deltas');
  companyDeltasEl.innerHTML = '';
  for (const [label, key] of [['กระแสเงินสด', 'cash_flow'], ['ความเชื่อมั่นแบรนด์', 'brand_trust'], ['ขวัญกำลังใจ', 'employee_morale']]) {
    const val = opt.company[key] ?? 0;
    const c = document.createElement('span');
    c.className = `delta-chip ${val > 0 ? 'pos' : val < 0 ? 'neg' : 'neu'}`;
    c.textContent = `${label}: ${fmtDelta(val)}`;
    companyDeltasEl.appendChild(c);
  }
}

// ── UI: End screen ─────────────────────────────────────────────
async function showEndScreen(player, company) {
  showState('end');

  // Show only this group's players
  const { data: groupPlayers } = await supabase
    .from('players').select('*')
    .eq('group_number', groupNumber)
    .order('kpi_score', { ascending: false });

  const companyOk = company &&
    company.cash_flow > GAME_OVER_THRESHOLD &&
    company.brand_trust > GAME_OVER_THRESHOLD &&
    company.employee_morale > GAME_OVER_THRESHOLD;
  const noFired  = (groupPlayers || []).every(p => p.kpi_score > FIRED_THRESHOLD);
  const survived = companyOk && noFired;

  document.getElementById('end-headline').textContent = survived ? 'NovaTech รอดพ้น!' : 'NovaTech ล้มเหลว';
  document.getElementById('end-sub').textContent = survived
    ? 'กลุ่มของคุณผ่านพ้นวิกฤตทั้งหมดได้ ยอดเยี่ยมมาก!'
    : !companyOk
      ? 'กลุ่มของคุณไม่สามารถรักษาดัชนีชี้วัดของบริษัทไว้ได้'
      : 'มีผู้บริหารถูกไล่ออก — ทีมไม่สมบูรณ์';

  const container = document.getElementById('final-scores');
  container.innerHTML = `<div class="card-title" style="margin-bottom:10px;">กลุ่ม ${groupNumber} — คะแนน KPI สุดท้าย</div>`;
  for (const p of (groupPlayers || [])) {
    const fired = p.kpi_score <= FIRED_THRESHOLD;
    const row = document.createElement('div');
    row.className = `score-row ${fired ? 'fired' : ''}`;
    row.innerHTML = `
      <span class="player-name">${p.name} <span style="font-size:12px;color:#8892a4;">(${p.role})</span>
        ${fired ? '<span class="fired-tag">ถูกไล่ออก</span>' : ''}
      </span>
      <span class="score-num" style="color:${kpiColor(p.kpi_score)}">${p.kpi_score}</span>
    `;
    container.appendChild(row);
  }

  if (company) {
    document.getElementById('end-company-result').textContent =
      `กลุ่ม ${groupNumber} ผลสุดท้าย — เงินสด: ${company.cash_flow} | แบรนด์: ${company.brand_trust} | ขวัญกำลังใจ: ${company.employee_morale}`;
  }
}

// ── Update KPI ────────────────────────────────────────────────
function updateKpi(score) {
  myKpiScore = score;
  kpiValue.textContent = score;
  const cls = score <= FIRED_THRESHOLD ? 'dead' : score <= 20 ? 'low' : score <= 35 ? 'medium' : 'high';
  kpiValue.className = `kpi-value ${cls}`;
  firedNotice.style.display = score <= FIRED_THRESHOLD ? 'block' : 'none';
}

function kpiColor(score) {
  if (score <= FIRED_THRESHOLD) return '#666';
  if (score <= 20) return '#f05252';
  if (score <= 35) return '#f59e0b';
  return '#22c55e';
}

// ── Update company metrics ─────────────────────────────────────
function updateCompany(company) {
  if (!company) return;
  cashVal.textContent   = company.cash_flow;
  brandVal.textContent  = company.brand_trust;
  moraleVal.textContent = company.employee_morale;

  metricCash.classList.toggle('danger',   company.cash_flow <= 25);
  metricBrand.classList.toggle('danger',  company.brand_trust <= 25);
  metricMorale.classList.toggle('danger', company.employee_morale <= 25);

  cashVal.style.color   = valColor(company.cash_flow);
  brandVal.style.color  = valColor(company.brand_trust);
  moraleVal.style.color = valColor(company.employee_morale);

  const gameOver = company.cash_flow <= GAME_OVER_THRESHOLD ||
                   company.brand_trust <= GAME_OVER_THRESHOLD ||
                   company.employee_morale <= GAME_OVER_THRESHOLD;
  if (gameOver) {
    gameOverBanner.classList.add('show');
    const reasons = [];
    if (company.cash_flow <= GAME_OVER_THRESHOLD)       reasons.push('กระแสเงินสด');
    if (company.brand_trust <= GAME_OVER_THRESHOLD)     reasons.push('ความเชื่อมั่นแบรนด์');
    if (company.employee_morale <= GAME_OVER_THRESHOLD) reasons.push('ขวัญกำลังใจ');
    gameOverReason.textContent = `ดัชนีชี้วัดวิกฤตต่ำกว่า ${GAME_OVER_THRESHOLD}: ${reasons.join(', ')}`;
  }
}

function valColor(v) {
  if (v <= GAME_OVER_THRESHOLD) return '#f05252';
  if (v <= 25) return '#f59e0b';
  return '#e8eaf0';
}

// ── Progress steps ────────────────────────────────────────────
function updateProgress(idx) {
  progressSteps.forEach(step => {
    const stepIdx = parseInt(step.dataset.idx);
    step.classList.remove('active', 'done');
    if (stepIdx === idx) step.classList.add('active');
    else if (stepIdx < idx) step.classList.add('done');
  });
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg, type = '') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

init();
