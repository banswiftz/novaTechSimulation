import { supabase } from './supabase.js';

const nameInput  = document.getElementById('player-name');
const roleSelect = document.getElementById('role-select');
const groupInput = document.getElementById('group-number');
const joinBtn    = document.getElementById('join-btn');
const joinError  = document.getElementById('join-error');
const joinForm   = document.getElementById('join-form');
const waitingDiv = document.getElementById('waiting-for-game');
const joinedAsP  = document.getElementById('joined-as');

// ── Voter/Viewer selection from form dropdown ───────────────────
const accessSelect = document.getElementById('access-mode');

// ── If already joined, redirect straight to player page ───────
const existingId = localStorage.getItem('novatech_player_id');
if (existingId) {
  window.location.href = 'player.html';
}

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

  // Insert player (unique constraint on group_number+role handles race condition)
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

  // Ensure group_scores row exists for this group
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

  // Show waiting state
  joinForm.style.display   = 'none';
  waitingDiv.style.display = 'block';
  const accessTag = isVoter ? '(ผู้โหวต)' : '(ผู้ชม)';
  joinedAsP.textContent = `กลุ่มที่ ${group} — ${player.name} (${player.role}) ${accessTag}`;

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
        console.error('[Join Realtime] ❌ Connection failed:', status, err);
      }
    });

  // Also check if game already started
  const { data: gs } = await supabase.from('game_state').select('*').eq('id', 1).single();
  if (gs && gs.current_situation_index >= 0) {
    window.location.href = 'player.html';
  }
});

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
