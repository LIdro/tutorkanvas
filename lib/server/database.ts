import 'server-only'

import postgres from 'postgres'

declare global {
  var __tutorkanvas_sql__: ReturnType<typeof postgres> | undefined
  var __tutorkanvas_db_ready__: Promise<void> | undefined
}

function getDatabaseUrl(): string | null {
  return process.env.DATABASE_URL?.trim() || null
}

export function isDatabaseConfigured(): boolean {
  return !!getDatabaseUrl()
}

export function getSql() {
  const databaseUrl = getDatabaseUrl()
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not configured.')
  }

  if (!global.__tutorkanvas_sql__) {
    global.__tutorkanvas_sql__ = postgres(databaseUrl, {
      prepare: false,
      max: 1,
    })
  }

  return global.__tutorkanvas_sql__
}

export async function ensureDatabase() {
  if (!isDatabaseConfigured()) return

  if (!global.__tutorkanvas_db_ready__) {
    global.__tutorkanvas_db_ready__ = (async () => {
      const sql = getSql()

      await sql`
        create table if not exists learner_profiles (
          id text primary key,
          user_id text not null,
          name text not null,
          age integer,
          grade text,
          avatar text,
          topics_attempted jsonb not null default '{}'::jsonb,
          topic_stars jsonb not null default '{}'::jsonb,
          common_errors jsonb not null default '[]'::jsonb,
          preferred_style text not null default 'auto',
          session_count integer not null default 0,
          last_active text not null,
          total_stars integer not null default 0,
          ai_notes jsonb not null default '[]'::jsonb,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        )
      `

      await sql`
        create index if not exists learner_profiles_user_id_idx
        on learner_profiles (user_id)
      `

      await sql`
        create table if not exists learner_sessions (
          id text primary key,
          user_id text not null,
          profile_id text not null,
          name text not null,
          created_at text not null,
          updated_at text not null,
          canvas_state jsonb,
          messages jsonb not null default '[]'::jsonb,
          topics_covered jsonb not null default '[]'::jsonb
        )
      `

      await sql`
        create index if not exists learner_sessions_user_id_idx
        on learner_sessions (user_id)
      `

      await sql`
        create index if not exists learner_sessions_profile_id_idx
        on learner_sessions (profile_id)
      `

      await sql`
        create index if not exists learner_sessions_updated_at_idx
        on learner_sessions (updated_at desc)
      `
    })()
  }

  await global.__tutorkanvas_db_ready__
}
