import { supabase } from './supabase.js';

const nameInput  = document.getElementById('player-name');
const roleSelect = document.getElementById('role-select');
const joinBtn    = document.getElementById('join-btn');
const joinError  = document.getElementById('join-error');
const joinForm   = document.getElementById('join-form');
const waitingDiv = document.getElementById('waiting-for-game');
const joinedAsP  = document.getElementById('joined-as');

// If already joined, redirect to player page
const existingId = localStorage.getItem('novatech_player_id');
if (existingId) {
  window.location.href = 'player.html';
}

// Join button
joinBtn.addEventListener('click', async () => {
  const name = nameInput.value.trim();
  const role = roleSelect.value;

  hideError();

  if (!name) { showError('กรุณาใส่ชื่อของคุณ'); return; }
  if (!role) { showError('กรุณาเลือกตำแหน่งของคุณ'); return; }

  joinBtn.disabled = true;
  joinBtn.textContent = 'กำลังเข้าร่วม...';

  const { data: player, error: insertErr } = await supabase
    .from('players')
    .insert({ name, role })
    .select()
    .single();

  if (insertErr) {
    showError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    reset();
    return;
  }

  // Persist session
  localStorage.setItem('novatech_player_id', player.id);
  localStorage.setItem('novatech_player_role', player.role);
  localStorage.setItem('novatech_player_name', player.name);

  // Show waiting state
  joinForm.style.display   = 'none';
  waitingDiv.style.display = 'block';
  joinedAsP.textContent    = `${player.name} (${player.role})`;

  // Subscribe to game_state — redirect when game starts
  const channel = supabase
    .channel('join-watch')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'game_state' }, payload => {
      const gs = payload.new;
      if (gs && gs.current_step !== 'waiting') {
        channel.unsubscribe();
        window.location.href = 'player.html';
      }
    })
    .subscribe();

  // Also check if game already started
  const { data: gs } = await supabase.from('game_state').select('*').eq('id', 1).single();
  if (gs && gs.current_step !== 'waiting') {
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
