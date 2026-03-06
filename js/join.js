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

  if (!name)           { showError('Please enter your name.'); return; }
  if (!group || group < 1) { showError('Please enter a valid group number.'); return; }

  joinBtn.disabled = true;
  joinBtn.textContent = 'Joining...';

  // Count current members in this group (with a lock-style re-check)
  const { data: groupMembers, error: fetchErr } = await supabase
    .from('players')
    .select('id, role')
    .eq('group_number', group)
    .order('created_at');

  if (fetchErr) {
    showError('Connection error. Please try again.');
    reset(); return;
  }

  if (groupMembers.length >= 5) {
    showError(`Group ${group} is full (5/5). Please choose another group.`);
    reset(); return;
  }

  // Auto-assign next role in order
  const assignedRole = ROLES[groupMembers.length];

  // Insert player
  const { data: player, error: insertErr } = await supabase
    .from('players')
    .insert({ name, role: assignedRole, group_number: group, kpi_score: 50 })
    .select()
    .single();

  if (insertErr) {
    showError('Failed to join. Please try again.');
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
  joinedAsP.textContent = `Group ${group} — ${player.name} (${player.role})`;

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
  joinBtn.textContent = 'Join Game';
}
