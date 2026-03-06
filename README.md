# NovaTech — Boardroom Crisis Simulation

A real-time web app for running the NovaTech team simulation workshop.

---

## Quick Setup (5 steps)

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project (choose any name, e.g. "novatech-sim")
3. Wait for it to provision (~1 minute)

### 2. Set up the database

In your Supabase project, go to **SQL Editor** and run this SQL:

```sql
-- Game state (single row)
CREATE TABLE game_state (
  id INT PRIMARY KEY DEFAULT 1,
  current_situation_index INT DEFAULT -1,
  phase TEXT DEFAULT 'waiting',
  winning_option TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO game_state (id) VALUES (1);

-- Players
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  kpi_score INT DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Votes
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  situation_index INT NOT NULL,
  choice TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, situation_index)
);

-- Company scores (single row)
CREATE TABLE company_scores (
  id INT PRIMARY KEY DEFAULT 1,
  cash_flow INT DEFAULT 50,
  brand_trust INT DEFAULT 50,
  employee_morale INT DEFAULT 50
);
INSERT INTO company_scores (id) VALUES (1);

-- Enable real-time for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE game_state;
ALTER PUBLICATION supabase_realtime ADD TABLE players;
ALTER PUBLICATION supabase_realtime ADD TABLE votes;
ALTER PUBLICATION supabase_realtime ADD TABLE company_scores;
```

### 3. Add your Supabase credentials

1. In Supabase, go to **Settings → API**
2. Copy your **Project URL** and **anon/public key**
3. Open `js/supabase.js` and replace the placeholders:

```js
const SUPABASE_URL = 'https://your-project-id.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key-here';
```

### 4. (Optional) Change the admin password

Open `js/admin.js` and change this line:

```js
const ADMIN_PASSWORD = 'admin1234';
```

### 5. Deploy to Vercel

1. Push this folder to a GitHub repository
2. Go to [vercel.com](https://vercel.com), import the repo
3. Deploy with default settings (no build command needed)
4. Share the URL with your participants

> **Local testing:** You can also just open `index.html` directly in a browser or use `npx serve .`

---

## How to Run the Workshop

### Before the session
- Reset the game via the Admin Panel (in case of leftover data)
- Test with 2-3 browser tabs to verify real-time works

### During the session

1. **Facilitator** opens `yoursite.com/admin.html` → enters password
2. **Each player** opens `yoursite.com` on their phone/laptop → enters name + picks role
3. Facilitator clicks **"Start Game"** → Situation 1 appears on all player screens
4. Players discuss (out loud), then vote A or B on their screens
5. Facilitator watches votes come in, then clicks **"Reveal Results & Apply Scores"**
6. Scores update instantly on all screens
7. Facilitator clicks **"Advance to Next Situation"** and repeat

### Situation order
| Step | Event |
|------|-------|
| 1 | Situation 1: Cash Flow Crunch |
| 2 | Pop-up 1: Viral Windfall |
| 3 | Situation 2: Legacy System Burnout |
| 4 | Pop-up 2: Angel Investor Grant |
| 5 | Situation 3: Data Breach Scandal |
| 6 | Situation 4: Hostile Takeover |

---

## Pages

| URL | Purpose |
|-----|---------|
| `/` (index.html) | Player join page |
| `/player.html` | Player voting + score view |
| `/admin.html` | Facilitator control panel |

---

## Scoring Rules

- All players start at **KPI = 50** and company metrics start at **50**
- Majority vote (3+ out of 5) decides the outcome; tie = Option A wins
- **Game over** if any company metric drops to **≤ 15**
- A player is **fired** if their personal KPI drops to **0**
- Power cards and hidden agendas are handled as physical cards (not in the app)
