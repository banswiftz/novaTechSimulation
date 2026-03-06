import { supabase } from './supabase.js';
import { ROLES } from './game-data.js';

const nameInput  = document.getElementById('player-name');
const groupInput = document.getElementById('group-number');
const joinBtn    = document.getElementById('join-btn');
const joinError  = document.getElementById('join-error');
const joinForm   = document.getElementById('join-form');
const waitingDiv = document.getElementById('waiting-for-game');
const joinedAsP  = document.getElementById('joined-as');

// ── If already joined, redirect straight to player page ─────
const existingId = localStorage.getItem('novatech_player_id');
if (existingId) {
  window.location.href = 'player.html';
}

// ── Join button ──────────────────────────────────────────────
joinBtn.addEventListener('click', async () => {
  const name  = nameInput.value.trim();
  const group = parseInt(groupInput.value);

  hideError();

  if (!name)           { showError('กรุณาใส่ชื่อของคุณ'); return; }
  if (!group || group < 1) { showError('กรุณาใส่หมายเลขกลุ่มที่ถูกต้อง'); return; }

  joinBtn.disabled = true;
  joinBtn.textContent = 'กำลังเข้าร่วม...';

  // Count current members in this group (with a lock-style re-check)
  const { data: groupMembers, error: fetchErr } = await supabase
    .from('players')
    .select('id, role')
    .eq('group_number', group)
    .order('created_at');

  if (fetchErr) {
    showError('เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง');
    reset(); return;
  }

  if (groupMembers.length >= 5) {
    showError(`กลุ่มที่ ${group} เต็มแล้ว (5/5 คน) กรุณาเลือกกลุ่มอื่น`);
    reset(); return;
  }

  // Auto-assign next role in order
  // Retry once if a concurrent join caused a unique constraint violation (race condition)
  let assignedRole = ROLES[groupMembers.length];
  let player, insertErr;

  for (let attempt = 0; attempt < 2; attempt++) {
    ({ data: player, error: insertErr } = await supabase
      .from('players')
      .insert({ name, role: assignedRole, group_number: group, kpi_score: 50 })
      .select()
      .single());

    // 23505 = unique_violation — another player took this role simultaneously
    if (insertErr && (insertErr.code === '23505' || insertErr.message?.includes('unique'))) {
      // Re-query group to get updated count and try next role
      const { data: refreshed } = await supabase
        .from('players').select('id, role').eq('group_number', group);
      if ((refreshed?.length ?? 0) >= 5) {
        showError(`กลุ่มที่ ${group} เต็มแล้ว (5/5 คน) กรุณาเลือกกลุ่มอื่น`);
        reset(); return;
      }
      const takenRoles = new Set((refreshed || []).map(p => p.role));
      assignedRole = ROLES.find(r => !takenRoles.has(r));
      if (!assignedRole) {
        showError(`กลุ่มที่ ${group} เต็มแล้ว (5/5 คน) กรุณาเลือกกลุ่มอื่น`);
        reset(); return;
      }
      continue;
    }
    break;
  }

  if (insertErr) {
    showError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
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

  // Show waiting state
  joinForm.style.display    = 'none';
  waitingDiv.style.display  = 'block';
  joinedAsP.textContent = `กลุ่มที่ ${group} — ${player.name} (${player.role})`;

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
    .subscribe();

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
