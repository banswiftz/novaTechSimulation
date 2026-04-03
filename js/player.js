import { supabase } from './supabase.js';
import {
  SITUATIONS, ROLE_KPI_NAMES, SPECIAL_CARDS,
  GAME_OVER_THRESHOLD, FIRED_THRESHOLD, fmtDelta
} from './game-data.js';

// ── Player session ───────────────────────────────────────────
const playerId   = localStorage.getItem('novatech_player_id');
const playerRole = localStorage.getItem('novatech_player_role');
const playerName = localStorage.getItem('novatech_player_name');
const groupNumber= parseInt(localStorage.getItem('novatech_group_number') || '1');
const isVoter    = localStorage.getItem('novatech_is_voter') === 'true';

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

// Cards DOM
const cardsPanel   = document.getElementById('cards-panel');
const cardsSlots   = document.getElementById('cards-slots');
const cardModal    = document.getElementById('card-modal');
const cardModalTitle   = document.getElementById('card-modal-title');
const cardModalDesc    = document.getElementById('card-modal-desc');
const cardModalBody    = document.getElementById('card-modal-body');
const cardModalConfirm = document.getElementById('card-modal-confirm');
const cardModalCancel  = document.getElementById('card-modal-cancel');

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
  localStorage.removeItem('novatech_is_voter');
}

function showRemovedScreen(headline, sub) {
  clearSession();
  const overlay = document.getElementById('removed-overlay');
  document.getElementById('removed-headline').textContent = headline;
  document.getElementById('removed-sub').textContent = sub;
  overlay.style.display = 'flex';
}

// Fired popup DOM
const firedPopup     = document.getElementById('fired-popup');
const firedPopupMsg  = document.getElementById('fired-popup-msg');
const firedPopupClose = document.getElementById('fired-popup-close');

firedPopupClose.addEventListener('click', () => {
  firedPopup.style.display = 'none';
});

// ── Local state ──────────────────────────────────────────────
let currentSitIdx   = -1;
let myVote          = null;
let lastRevealedIdx = -1;
let myKpiScore      = 50;
let groupCards      = [];  // [{card_type, is_used, used_at_situation, card_metadata}]
let firedPopupShown = false;
let initialized     = false;

// ── Init ─────────────────────────────────────────────────────
async function init() {
  const [{ data: player }, { data: company }, { data: gameState }, { data: cards }] = await Promise.all([
    supabase.from('players').select('*').eq('id', playerId).single(),
    supabase.from('group_scores').select('*').eq('group_number', groupNumber).single(),
    supabase.from('game_state').select('*').eq('id', 1).single(),
    supabase.from('group_cards').select('*').eq('group_number', groupNumber),
  ]);

  groupCards = cards || [];
  if (player)    updateKpi(player.kpi_score);
  if (company)   updateCompany(company);
  renderCardsPanel();
  if (gameState) await applyGameState(gameState, company, player);

  initialized = true;
  subscribeToChanges();
}

// ── Subscriptions ─────────────────────────────────────────────
function subscribeToChanges() {
  supabase.channel('player-watch')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'game_state' }, async payload => {
      const gs = payload.new;
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
    // Watch card changes
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'group_cards',
      filter: `group_number=eq.${groupNumber}`
    }, async () => {
      const { data } = await supabase.from('group_cards').select('*').eq('group_number', groupNumber);
      groupCards = data || [];
      renderCardsPanel();
      // If consulting report was just used, show deltas on voting screen
      const consultingUsed = groupCards.find(c => c.card_type === 'consulting_report' && c.is_used);
      if (consultingUsed && currentSitIdx >= 0 && currentSitIdx < SITUATIONS.length) {
        showConsultingDeltas();
      }
    })
    .subscribe((status, err) => {
      console.log('[Player Realtime]', status, err || '');
      if (status === 'SUBSCRIBED') {
        console.log('[Player Realtime] Connected');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error('[Player Realtime] Connection failed:', status, err);
        showToast('Realtime ไม่สามารถเชื่อมต่อได้ — กรุณารีเฟรช', 'error');
      }
    });
}

// ── Cards Panel ──────────────────────────────────────────────
function renderCardsPanel() {
  if (groupCards.length === 0) {
    cardsPanel.style.display = 'none';
    return;
  }
  cardsPanel.style.display = 'block';
  cardsSlots.innerHTML = '';

  for (const gc of groupCards) {
    const card = SPECIAL_CARDS[gc.card_type];
    if (!card) continue;

    const el = document.createElement('div');
    el.className = `special-card-slot ${gc.is_used ? 'used' : 'available'}`;

    const canActivate = isVoter && !gc.is_used && currentSitIdx >= 0 && currentSitIdx < SITUATIONS.length;

    el.innerHTML = `
      <div class="special-card-slot-icon">${card.icon}</div>
      <div class="special-card-slot-info">
        <div class="special-card-slot-name">${card.nameTh}</div>
        <div class="special-card-slot-status">${gc.is_used ? 'ใช้แล้ว' : 'พร้อมใช้งาน'}</div>
      </div>
      ${canActivate ? `<button class="btn btn-sm btn-primary activate-card-btn" data-card-type="${gc.card_type}">ใช้งาน</button>` : ''}
    `;

    const btn = el.querySelector('.activate-card-btn');
    if (btn) {
      btn.addEventListener('click', () => activateCard(gc.card_type));
    }

    cardsSlots.appendChild(el);
  }
}

// ── Card Activation ──────────────────────────────────────────
async function activateCard(cardType) {
  const card = SPECIAL_CARDS[cardType];
  if (!card) return;

  if (cardType === 'consulting_report') {
    activateConsultingReport();
  } else if (cardType === 'global_pr') {
    activateGlobalPR();
  }
}

// -- Consulting Firm Report --
function activateConsultingReport() {
  const sit = SITUATIONS[currentSitIdx];
  if (!sit) return;

  cardModalTitle.textContent = '📊 Consulting Firm Report';
  cardModalDesc.textContent = 'ยืนยันเปิดเผยผลกระทบ KPI บริษัทของทั้ง 2 ตัวเลือกให้ทั้งกลุ่มเห็น?';
  cardModalBody.innerHTML = '<p style="color:#4f8ef7; font-size:13px;">ข้อมูลจะแสดงบนหน้าโหวตของทุกคนในกลุ่ม</p>';

  showCardModal(async () => {
    await markCardUsed('consulting_report');
    showConsultingDeltas(); // Show immediately for voter
    showToast('📊 เปิดเผยข้อมูลจากที่ปรึกษาแล้ว — ทุกคนในกลุ่มเห็น', 'success');
  });
}

/** Show company KPI deltas on option A/B buttons */
function showConsultingDeltas() {
  const sit = SITUATIONS[currentSitIdx];
  if (!sit) return;

  const labels = { cash_flow: 'เงินสด', brand_trust: 'แบรนด์', employee_morale: 'ขวัญกำลังใจ' };
  const deltasA = document.getElementById('opt-a-deltas');
  const deltasB = document.getElementById('opt-b-deltas');
  if (!deltasA || !deltasB) return;

  for (const [el, opt] of [[deltasA, sit.optionA], [deltasB, sit.optionB]]) {
    el.innerHTML = '<div style="font-size:11px; color:#4f8ef7; font-weight:700; margin-bottom:4px;">📊 ผลกระทบบริษัท:</div>';
    for (const [key, name] of Object.entries(labels)) {
      const val = opt.company[key] ?? 0;
      const cls = val > 0 ? 'pos' : val < 0 ? 'neg' : 'neu';
      el.innerHTML += `<span class="delta-chip ${cls}" style="margin:2px; font-size:11px;">${name}: ${fmtDelta(val)}</span>`;
    }
  }
}

/** Clear consulting deltas from option buttons */
function clearConsultingDeltas() {
  const deltasA = document.getElementById('opt-a-deltas');
  const deltasB = document.getElementById('opt-b-deltas');
  if (deltasA) deltasA.innerHTML = '';
  if (deltasB) deltasB.innerHTML = '';
}

// -- Global PR Blitz --
function activateGlobalPR() {
  cardModalTitle.textContent = '📢 Global PR Blitz';
  cardModalDesc.textContent = 'เลือก KPI บริษัท 1 ตัวเพื่อเพิ่ม +20 ทันที:';

  const options = [
    { key: 'cash_flow', label: 'กระแสเงินสด' },
    { key: 'brand_trust', label: 'ความเชื่อมั่นแบรนด์' },
    { key: 'employee_morale', label: 'ขวัญกำลังใจ' },
  ];

  cardModalBody.innerHTML = options.map(o =>
    `<label style="display:flex; align-items:center; gap:8px; padding:8px; cursor:pointer; border-radius:6px; margin-bottom:4px; background:var(--surface2);">
      <input type="radio" name="pr-target" value="${o.key}" style="accent-color:var(--primary);" />
      <span style="font-size:14px;">${o.label} +20</span>
    </label>`
  ).join('');

  showCardModal(async () => {
    const selected = cardModalBody.querySelector('input[name="pr-target"]:checked');
    if (!selected) { showToast('กรุณาเลือก KPI ที่ต้องการเพิ่ม', 'error'); return; }
    const targetKpi = selected.value;

    // Get current score and add +20
    const { data: gs } = await supabase.from('group_scores').select('*').eq('group_number', groupNumber).single();
    if (!gs) return;

    const newVal = (gs[targetKpi] ?? 50) + 20;
    await supabase.from('group_scores').update({ [targetKpi]: newVal }).eq('group_number', groupNumber);
    await markCardUsed('global_pr', { target_kpi: targetKpi });

    const label = options.find(o => o.key === targetKpi)?.label || targetKpi;
    showToast(`📢 ${label} +20 เรียบร้อย!`, 'success');
  });
}

// -- Card modal helpers --
function showCardModal(onConfirm) {
  cardModal.style.display = 'flex';
  cardModalConfirm.onclick = async () => {
    cardModalConfirm.disabled = true;
    await onConfirm();
    cardModal.style.display = 'none';
    cardModalConfirm.disabled = false;
  };
  cardModalCancel.onclick = () => {
    cardModal.style.display = 'none';
  };
}

async function markCardUsed(cardType, metadata = null) {
  const update = {
    is_used: true,
    used_at_situation: currentSitIdx,
  };
  if (metadata) update.card_metadata = metadata;

  await supabase.from('group_cards')
    .update(update)
    .eq('group_number', groupNumber)
    .eq('card_type', cardType);

  // Update local state
  const gc = groupCards.find(c => c.card_type === cardType);
  if (gc) {
    gc.is_used = true;
    gc.used_at_situation = currentSitIdx;
    if (metadata) gc.card_metadata = metadata;
  }
  renderCardsPanel();
}

// ── Apply game state ──────────────────────────────────────────
async function applyGameState(gs, company, player) {
  currentSitIdx = gs.current_situation_index;
  updateProgress(currentSitIdx);
  renderCardsPanel(); // re-render cards with current situation context

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

  // Check if Consulting Report card is used → show deltas for all members
  clearConsultingDeltas();
  const consultingCard = groupCards.find(c => c.card_type === 'consulting_report' && c.is_used);
  if (consultingCard) {
    showConsultingDeltas();
  }

  const optionsGrid = document.getElementById('options-grid');
  const btnA = document.getElementById('btn-a');
  const btnB = document.getElementById('btn-b');
  const votedNotice = document.getElementById('voted-notice');

  btnA.className = 'option-btn';
  btnB.className = 'option-btn';

  if (!isVoter) {
    optionsGrid.style.display = 'none';
    votedNotice.style.display = 'block';
    votedNotice.textContent = 'กำลังรอผลการโหวตจากผู้โหวตของกลุ่ม...';
    return;
  }

  optionsGrid.style.display = '';

  votedNotice.textContent = 'ส่งโหวตแล้ว — รอผู้ดำเนินเกมเปิดผล';

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

  // Backup: send vote to Google Form
  const sit = SITUATIONS[currentSitIdx];
  const scenLabel = sit.type === 'popup' ? `P${sit.number}` : `S${sit.number}`;
  const formBody = new URLSearchParams();
  formBody.append('entry.973482943', String(groupNumber));
  formBody.append('entry.1638356131', scenLabel);
  formBody.append('entry.1554458861', choice);
  fetch('https://docs.google.com/forms/d/e/1FAIpQLSfoBvjzVBohTmTaYp2YLV8Yvsvv_to-_Ok9DMwTAMFWnaLwcw/formResponse', {
    method: 'POST', mode: 'no-cors', body: formBody,
  }).catch(() => {});
}

// ── UI: Revealed ──────────────────────────────────────────────
function showRevealed(sit, winningOption, company, player) {
  showState('revealed');

  const typeEl = document.getElementById('sit-type-r');
  typeEl.textContent = sit.type === 'popup' ? `เหตุการณ์พิเศษ ${sit.number}` : `สถานการณ์ ${sit.number}`;
  typeEl.className = `situation-type${sit.type === 'popup' ? ' popup' : ''}`;
  document.getElementById('sit-title-r').textContent = sit.title;

  const rBtnA = document.getElementById('result-btn-a');
  const rBtnB = document.getElementById('result-btn-b');

  if (winningOption === 'X') {
    rBtnA.className = 'option-btn loser';
    rBtnB.className = 'option-btn loser';
    document.getElementById('res-a-title').textContent = sit.optionA.label;
    document.getElementById('res-b-title').textContent = sit.optionB.label;

    const myDeltaEl = document.getElementById('my-delta');
    myDeltaEl.innerHTML = '<span class="delta-chip neu">ไม่มีการโหวต — KPI ไม่เปลี่ยนแปลง</span>';

    const companyDeltasEl = document.getElementById('company-deltas');
    companyDeltasEl.innerHTML = '';
    for (const label of ['กระแสเงินสด', 'ความเชื่อมั่นแบรนด์', 'ขวัญกำลังใจ']) {
      const c = document.createElement('span');
      c.className = 'delta-chip neg';
      c.textContent = `${label}: -10`;
      companyDeltasEl.appendChild(c);
    }
    return;
  }

  document.getElementById('res-a-title').textContent = sit.optionA.label;
  document.getElementById('res-b-title').textContent = sit.optionB.label;

  rBtnA.className = `option-btn ${winningOption === 'A' ? 'winner' : 'loser'}`;
  rBtnB.className = `option-btn ${winningOption === 'B' ? 'winner' : 'loser'}`;

  const chosenBtn = winningOption === 'A' ? rBtnA : rBtnB;
  chosenBtn.querySelector('.opt-label').textContent = `ตัวเลือก ${winningOption} — กลุ่มของคุณเลือก`;

  const opt = winningOption === 'A' ? sit.optionA : sit.optionB;
  const myDelta = opt.kpi[playerRole] ?? 0;
  const myDeltaEl = document.getElementById('my-delta');
  myDeltaEl.innerHTML = '';
  const chip = document.createElement('span');
  chip.className = `delta-chip ${myDelta > 0 ? 'pos' : myDelta < 0 ? 'neg' : 'neu'}`;
  chip.textContent = `${playerRole}: ${fmtDelta(myDelta)}`;
  myDeltaEl.appendChild(chip);

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
  const wasFired = myKpiScore <= FIRED_THRESHOLD;
  const nowFired = score <= FIRED_THRESHOLD;

  myKpiScore = score;
  kpiValue.textContent = score;
  const cls = nowFired ? 'dead' : score <= 20 ? 'low' : score <= 35 ? 'medium' : 'high';
  kpiValue.className = `kpi-value ${cls}`;
  firedNotice.style.display = nowFired ? 'block' : 'none';

  // Show fired popup once on transition (not on initial page load)
  if (initialized && nowFired && !wasFired && !firedPopupShown) {
    firedPopupMsg.textContent = `คุณ ${playerName} ตำแหน่ง ${playerRole} ถูกไล่ออกเนื่องจาก KPI ต่ำกว่าที่กำหนด`;
    firedPopup.style.display = 'flex';
    firedPopupShown = true;
  }

  // If admin edits KPI back to positive → reset fired status so popup can trigger again later
  if (!nowFired && wasFired) {
    firedPopupShown = false;
  }
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
  } else {
    gameOverBanner.classList.remove('show');
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
