import { supabase } from './supabase.js';
import { SPECIAL_CARDS, ALL_CARD_IDS, MAX_CARDS_PER_GROUP } from './game-data.js';

const nameInput  = document.getElementById('player-name');
const roleSelect = document.getElementById('role-select');
const groupInput = document.getElementById('group-number');
const joinBtn    = document.getElementById('join-btn');
const joinError  = document.getElementById('join-error');
const joinForm   = document.getElementById('join-form');
const waitingDiv = document.getElementById('waiting-for-game');
const joinedAsP  = document.getElementById('joined-as');

const accessSelect    = document.getElementById('access-mode');
const cardSelection   = document.getElementById('card-selection');
const cardGrid        = document.getElementById('card-grid');
const confirmCardsBtn = document.getElementById('confirm-cards-btn');
const cardError       = document.getElementById('card-error');
const selectedCardsDisplay = document.getElementById('selected-cards-display');

// ── If already joined, redirect straight to player page ───────
const existingId = localStorage.getItem('novatech_player_id');
if (existingId) {
  window.location.href = 'player.html';
}

// ── Card selection state ──────────────────────────────────────
let selectedCards = new Set();
let joinedGroup  = null;

// ── Join button ───────────────────────────────────────────────
joinBtn.addEventListener('click', async () => {
  const name    = nameInput.value.trim();
  const role    = roleSelect.value;
  const group   = parseInt(groupInput.value);
  const isVoter = accessSelect.value === 'voter';

  hideError();

  if (!name)               { showError('กรุณาใส่ชื่อของคุณ'); return; }
  if (!role)               { showError('กรุณาเลือกตำแหน่งของคุณ'); return; }
  if (!group || group < 1) { showError('กรุณาใส่หมายเลขกลุ่มที่ถูกต้อง'); return; }

  joinBtn.disabled = true;
  joinBtn.textContent = 'กำลังเข้าร่วม...';

  // Check if this role is already taken in this group
  const { data: existingRole, error: checkErr } = await supabase
    .from('players')
    .select('id')
    .eq('group_number', group)
    .eq('role', role)
    .maybeSingle();

  if (checkErr) {
    showError('เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง');
    reset(); return;
  }

  if (existingRole) {
    showError(`ตำแหน่ง ${role} ในกลุ่ม ${group} มีผู้เล่นแล้ว กรุณาเลือกตำแหน่งอื่น`);
    reset(); return;
  }

  // Check if voter slot is already taken (only one voter per group)
  if (isVoter) {
    const { data: existingVoter } = await supabase
      .from('players')
      .select('id')
      .eq('group_number', group)
      .eq('is_voter', true)
      .maybeSingle();

    if (existingVoter) {
      showError(`กลุ่ม ${group} มีผู้โหวตแล้ว ไม่สามารถเพิ่มผู้โหวตได้อีก`);
      reset(); return;
    }
  }

  // Insert player
  const { data: player, error: insertErr } = await supabase
    .from('players')
    .insert({ name, role, group_number: group, kpi_score: 50, is_voter: isVoter })
    .select()
    .single();

  if (insertErr) {
    if (insertErr.code === '23505' || insertErr.message?.includes('unique')) {
      showError(`ตำแหน่ง ${role} ในกลุ่ม ${group} มีผู้เล่นแล้ว กรุณาเลือกตำแหน่งอื่น`);
    } else {
      showError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    }
    reset(); return;
  }

  // Ensure group_scores row exists
  await supabase.from('group_scores').upsert(
    { group_number: group, cash_flow: 50, brand_trust: 50, employee_morale: 50 },
    { onConflict: 'group_number', ignoreDuplicates: true }
  );

  // Persist session
  localStorage.setItem('novatech_player_id',    player.id);
  localStorage.setItem('novatech_player_role',  player.role);
  localStorage.setItem('novatech_player_name',  player.name);
  localStorage.setItem('novatech_group_number', String(group));
  localStorage.setItem('novatech_is_voter',     String(isVoter));

  joinedGroup = group;

  if (isVoter) {
    // Check if cards already selected for this group (e.g. page refresh)
    const { data: existingCards } = await supabase
      .from('group_cards')
      .select('card_type')
      .eq('group_number', group);

    if (existingCards && existingCards.length >= MAX_CARDS_PER_GROUP) {
      // Cards already selected — skip to waiting
      showWaitingScreen(player, group, isVoter, existingCards.map(c => c.card_type));
    } else {
      // Show card selection
      joinForm.style.display = 'none';
      cardSelection.style.display = 'block';
      renderCardGrid();
    }
  } else {
    // Viewer — go straight to waiting, show cards if already selected
    const { data: existingCards } = await supabase
      .from('group_cards')
      .select('card_type')
      .eq('group_number', group);

    showWaitingScreen(player, group, isVoter, existingCards?.map(c => c.card_type) || []);
  }
});

// ── Card Selection Grid ──────────────────────────────────────
function renderCardGrid() {
  cardGrid.innerHTML = '';
  for (const cardId of ALL_CARD_IDS) {
    const card = SPECIAL_CARDS[cardId];
    const el = document.createElement('div');
    el.className = 'special-card';
    el.dataset.cardId = cardId;
    el.innerHTML = `
      <div class="special-card-icon">${card.icon}</div>
      <div class="special-card-name">${card.nameTh}</div>
      <div class="special-card-desc">${card.description}</div>
    `;
    el.addEventListener('click', () => toggleCard(cardId, el));
    cardGrid.appendChild(el);
  }
}

function toggleCard(cardId, el) {
  if (selectedCards.has(cardId)) {
    selectedCards.delete(cardId);
    el.classList.remove('selected');
  } else {
    if (selectedCards.size >= MAX_CARDS_PER_GROUP) return; // max 2
    selectedCards.add(cardId);
    el.classList.add('selected');
  }
  confirmCardsBtn.disabled = selectedCards.size !== MAX_CARDS_PER_GROUP;
  confirmCardsBtn.textContent = `ยืนยันการ์ด (${selectedCards.size}/${MAX_CARDS_PER_GROUP})`;
}

// ── Confirm Cards ─────────────────────────────────────────────
confirmCardsBtn.addEventListener('click', async () => {
  if (selectedCards.size !== MAX_CARDS_PER_GROUP) return;
  confirmCardsBtn.disabled = true;
  confirmCardsBtn.textContent = 'กำลังบันทึก...';

  const group = joinedGroup;
  const inserts = [...selectedCards].map(cardType => ({
    group_number: group,
    card_type: cardType,
    is_used: false,
  }));

  const { error } = await supabase.from('group_cards').upsert(inserts, {
    onConflict: 'group_number,card_type',
  });

  if (error) {
    cardError.textContent = 'ไม่สามารถบันทึกการ์ดได้ กรุณาลองใหม่';
    cardError.style.display = 'block';
    confirmCardsBtn.disabled = false;
    confirmCardsBtn.textContent = `ยืนยันการ์ด (${selectedCards.size}/${MAX_CARDS_PER_GROUP})`;
    return;
  }

  const playerId   = localStorage.getItem('novatech_player_id');
  const playerName = localStorage.getItem('novatech_player_name');
  const playerRole = localStorage.getItem('novatech_player_role');
  const isVoter    = localStorage.getItem('novatech_is_voter') === 'true';

  cardSelection.style.display = 'none';
  showWaitingScreen(
    { id: playerId, name: playerName, role: playerRole },
    group,
    isVoter,
    [...selectedCards]
  );
});

// ── Waiting Screen ────────────────────────────────────────────
function showWaitingScreen(player, group, isVoter, cardTypes) {
  joinForm.style.display      = 'none';
  cardSelection.style.display = 'none';
  waitingDiv.style.display    = 'block';

  const accessTag = isVoter ? '(ผู้โหวต)' : '(ผู้ชม)';
  joinedAsP.textContent = `กลุ่มที่ ${group} — ${player.name} (${player.role}) ${accessTag}`;

  // Show selected cards
  renderSelectedCards(cardTypes);

  // For viewers — subscribe to card updates
  if (!isVoter) {
    supabase.channel('join-cards-watch')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'group_cards',
        filter: `group_number=eq.${group}`
      }, async () => {
        const { data } = await supabase.from('group_cards').select('card_type').eq('group_number', group);
        renderSelectedCards(data?.map(c => c.card_type) || []);
      })
      .subscribe();
  }

  // Subscribe to game_state — redirect when game starts
  const channel = supabase
    .channel('join-watch')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'game_state' }, payload => {
      const gs = payload.new;
      if (gs && gs.current_situation_index >= 0) {
        channel.unsubscribe();
        window.location.href = 'player.html';
      }
    })
    .subscribe((status, err) => {
      console.log('[Join Realtime]', status, err || '');
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error('[Join Realtime] Connection failed:', status, err);
      }
    });

  // Also check if game already started
  supabase.from('game_state').select('*').eq('id', 1).single().then(({ data: gs }) => {
    if (gs && gs.current_situation_index >= 0) {
      window.location.href = 'player.html';
    }
  });
}

function renderSelectedCards(cardTypes) {
  if (!cardTypes || cardTypes.length === 0) {
    selectedCardsDisplay.innerHTML = '<p style="font-size:12px; color:#8892a4;">ยังไม่ได้เลือกการ์ดพิเศษ</p>';
    return;
  }
  selectedCardsDisplay.innerHTML = '<p style="font-size:12px; color:#8892a4; margin-bottom:8px;">การ์ดพิเศษของกลุ่ม:</p>' +
    cardTypes.map(ct => {
      const card = SPECIAL_CARDS[ct];
      return card ? `<span class="card-badge">${card.icon} ${card.nameTh}</span>` : '';
    }).join(' ');
}

// ── Helpers ───────────────────────────────────────────────────
function showError(msg) {
  joinError.textContent = msg;
  joinError.style.display = 'block';
}
function hideError() {
  joinError.style.display = 'none';
}
function reset() {
  joinBtn.disabled = false;
  joinBtn.textContent = 'เข้าร่วมเกม';
}
