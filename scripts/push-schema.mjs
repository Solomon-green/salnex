// Run: SUPABASE_PROJECT=xxx SUPABASE_TOKEN=sbp_xxx node scripts/push-schema.mjs
const PROJECT = process.env.SUPABASE_PROJECT;
const TOKEN = process.env.SUPABASE_TOKEN;
const API = `https://api.supabase.com/v1/projects/${PROJECT}/database/query`;

async function sql(query) {
  const res = await fetch(API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  const data = await res.json();
  if (data.message) throw new Error(data.message);
  return data;
}

const statements = [
  // Enums
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'JobType') THEN
      CREATE TYPE "JobType" AS ENUM ('HOURLY', 'FIXED_PRICE');
    END IF;
  END $$`,

  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ExperienceLevel') THEN
      CREATE TYPE "ExperienceLevel" AS ENUM ('ENTRY', 'INTERMEDIATE', 'EXPERT');
    END IF;
  END $$`,

  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationType') THEN
      CREATE TYPE "NotificationType" AS ENUM ('NEW_JOB', 'SYSTEM', 'ALERT');
    END IF;
  END $$`,

  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationStatus') THEN
      CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');
    END IF;
  END $$`,

  // Users table
  `CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR UNIQUE NOT NULL,
    full_name VARCHAR,
    avatar_url VARCHAR,
    telegram_chat_id VARCHAR,
    telegram_username VARCHAR,
    skills TEXT[] DEFAULT '{}',
    experience_level "ExperienceLevel" NOT NULL DEFAULT 'INTERMEDIATE',
    upwork_profile_url VARCHAR,
    notify_telegram BOOLEAN NOT NULL DEFAULT false,
    notify_email BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // Job filters table
  `CREATE TABLE IF NOT EXISTS job_filters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    skills TEXT[] DEFAULT '{}',
    categories TEXT[] DEFAULT '{}',
    job_types "JobType"[] DEFAULT '{}',
    experience_levels "ExperienceLevel"[] DEFAULT '{}',
    min_budget DECIMAL,
    max_budget DECIMAL,
    min_hourly_rate DECIMAL,
    max_hourly_rate DECIMAL,
    keywords TEXT[] DEFAULT '{}',
    excluded_keywords TEXT[] DEFAULT '{}',
    client_rating_min DECIMAL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // Jobs table
  `CREATE TABLE IF NOT EXISTS jobs (
    id VARCHAR PRIMARY KEY,
    title VARCHAR NOT NULL,
    description TEXT NOT NULL,
    budget DECIMAL,
    hourly_rate_min DECIMAL,
    hourly_rate_max DECIMAL,
    job_type "JobType" NOT NULL DEFAULT 'HOURLY',
    experience_level "ExperienceLevel" NOT NULL DEFAULT 'INTERMEDIATE',
    category VARCHAR,
    subcategory VARCHAR,
    skills_required TEXT[] DEFAULT '{}',
    client_name VARCHAR,
    client_country VARCHAR,
    client_rating DECIMAL,
    client_jobs_posted INTEGER,
    client_hire_rate DECIMAL,
    upwork_url VARCHAR NOT NULL,
    posted_at TIMESTAMPTZ NOT NULL,
    scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // Job matches table
  `CREATE TABLE IF NOT EXISTS job_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id VARCHAR NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    filter_id UUID NOT NULL REFERENCES job_filters(id) ON DELETE CASCADE,
    relevance_score DECIMAL NOT NULL DEFAULT 0,
    is_seen BOOLEAN NOT NULL DEFAULT false,
    is_saved BOOLEAN NOT NULL DEFAULT false,
    is_applied BOOLEAN NOT NULL DEFAULT false,
    is_dismissed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, job_id)
  )`,

  // Notifications table
  `CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id VARCHAR,
    type "NotificationType" NOT NULL,
    title VARCHAR NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    sent_at TIMESTAMPTZ,
    status "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // Proposals table
  `CREATE TABLE IF NOT EXISTS proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id VARCHAR NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    ai_generated BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // Indexes for performance
  `CREATE INDEX IF NOT EXISTS idx_job_matches_user_id ON job_matches(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_job_matches_created_at ON job_matches(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_jobs_posted_at ON jobs(posted_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_job_filters_user_id ON job_filters(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)`,

  // Updated_at trigger function
  `CREATE OR REPLACE FUNCTION update_updated_at_column()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $$ language 'plpgsql'`,

  // Triggers for updated_at
  `DROP TRIGGER IF EXISTS update_users_updated_at ON users;
   CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
   FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,

  `DROP TRIGGER IF EXISTS update_job_filters_updated_at ON job_filters;
   CREATE TRIGGER update_job_filters_updated_at BEFORE UPDATE ON job_filters
   FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,

  `DROP TRIGGER IF EXISTS update_proposals_updated_at ON proposals;
   CREATE TRIGGER update_proposals_updated_at BEFORE UPDATE ON proposals
   FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
];

let passed = 0;
let failed = 0;

for (const stmt of statements) {
  const label = stmt.trim().split("\n")[0].slice(0, 60);
  try {
    await sql(stmt);
    console.log(`  ✓ ${label}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${label}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log(`\nSchema push complete: ${passed} passed, ${failed} failed`);
