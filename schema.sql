-- ============================================================
-- NovaTech Simulation — New Schema
-- Run this in Supabase SQL Editor (Settings → SQL Editor)
-- WARNING: This will DROP old tables!
-- ============================================================

-- Drop old tables (order matters for foreign keys)
DROP TABLE IF EXISTS votes;
DROP TABLE IF EXISTS group_results;
DROP TABLE IF EXISTS group_scores;
DROP TABLE IF EXISTS company_scores;
DROP TABLE IF EXISTS players;
DROP TABLE IF EXISTS game_state;

-- Single source of truth for the entire game
CREATE TABLE public.game_state (
  id integer NOT NULL DEFAULT 1,
  current_step text NOT NULL DEFAULT 'waiting',
  cash integer NOT NULL DEFAULT 50,
  brand integer NOT NULL DEFAULT 50,
  morale integer NOT NULL DEFAULT 50,
  cfo integer NOT NULL DEFAULT 50,
  cmo integer NOT NULL DEFAULT 50,
  coo integer NOT NULL DEFAULT 50,
  chro integer NOT NULL DEFAULT 50,
  clo integer NOT NULL DEFAULT 50,
  history jsonb NOT NULL DEFAULT '[]'::jsonb,
  admin_session_id text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT game_state_pkey PRIMARY KEY (id)
);

-- Players (simplified — just session tracking)
CREATE TABLE public.players (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT players_pkey PRIMARY KEY (id)
);

-- Insert default game state row
INSERT INTO public.game_state (id) VALUES (1);

-- Enable realtime for game_state
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_state;
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
