import { supabase } from './supabase.js';
import { ROLES } from './game-data.js';

const nameInput    = document.getElementById('player-name');
const roleSelect   = document.getElementById('role-select');
const joinBtn      = document.getElementById('join-btn');
const joinError    = document.getElementById('join-error');
const roleTakenMsg = document.getElementById('role-taken-msg');
const joinForm     = document.getElementById('join-form');
const waitingDiv   = document.getElementById('waiting-for-game');
const joinedAsP    = document.getElementById('joined-as');

// ── If already joined, redirect straight to player page ─────
const existingId = localStorage.getItem('novatech_player_id');
if (existingId) {
  window.location.href = 'player.html';
}

// ── Load taken roles and disable them ───────────────────────
async function refreshTakenRoles() {
  const { data } = await supabase.from('players').select('role');
  const taken = (data || []).map(p => p.role);

  for (const opt of roleSelect.options) {
    if (ROLES.includes(opt.value)) {
      opt.disabled = taken.includes(opt.value);
      opt.textContent = opt.textContent.replace(' (taken)', '');
      if (taken.includes(opt.value)) opt.textContent += ' (taken)';
    }
  }
}

refreshTakenRoles();

// ── Join button ──────────────────────────────────────────────
joinBtn.addEventListener('click', async () => {
  const name = nameInput.value.trim();
  const role = roleSelect.value;

  joinError.style.display = 'none';
  roleTakenMsg.style.display = 'none';

  if (!name) { showError('Please enter your name.'); return; }
  if (!role) { showError('Please select a role.'); return; }

  joinBtn.disabled = true;
  joinBtn.textContent = 'Joining...';

  // Double-check role not taken
  const { data: existing } = await supabase.from('players').select('id').eq('role', role);
  if (existing && existing.length > 0) {
    roleTakenMsg.style.display = 'block';
    joinBtn.disabled = false;
    joinBtn.textContent = 'Join Game';
    refreshTakenRoles();
    return;
  }

  // Insert player
  const { data, error } = await supabase
    .from('players')
    .insert({ name, role, kpi_score: 50 })
    .select()
    .single();

  if (error) {
    showError('Failed to join. Please try again.');
    joinBtn.disabled = false;
    joinBtn.textContent = 'Join Game';
    return;
  }

  localStorage.setItem('novatech_player_id', data.id);
  localStorage.setItem('novatech_player_role', data.role);
  localStorage.setItem('novatech_player_name', data.name);

  // Show waiting state
  joinForm.style.display = 'none';
  waitingDiv.style.display = 'block';
  joinedAsP.textContent = `Joined as ${data.name} (${data.role})`;

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
