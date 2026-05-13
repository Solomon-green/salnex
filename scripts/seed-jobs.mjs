// Run: SUPABASE_PROJECT=xxx SUPABASE_TOKEN=sbp_xxx node scripts/seed-jobs.mjs
const PROJECT = process.env.SUPABASE_PROJECT || "YOUR_PROJECT_REF";
const TOKEN = process.env.SUPABASE_TOKEN || "YOUR_SUPABASE_TOKEN";
const API = `https://api.supabase.com/v1/projects/${PROJECT}/database/query`;

const sql = (query) =>
  fetch(API, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  }).then((r) => r.json());

// Dollar-quote helper to safely embed any string in SQL
const dq = (s) => `$$${String(s ?? "").replace(/\$\$/g, "$ $")}$$`;
const arr = (a) => `ARRAY[${a.map((s) => `'${s.replace(/'/g, "''")}'`).join(",")}]::TEXT[]`;
const maybeNull = (v) => (v == null ? "NULL" : String(v));

const jobs = [
  {
    id: "demo_001",
    title: "React + Next.js Developer for SaaS Dashboard",
    description:
      "We need an experienced React/Next.js developer to build a modern SaaS dashboard. The project involves creating reusable components, integrating REST APIs, and implementing authentication. You should have strong TypeScript skills and experience with Tailwind CSS. This is an ongoing contract with 20+ hours per week.",
    budget: null,
    hourly_rate_min: 35,
    hourly_rate_max: 65,
    job_type: "HOURLY",
    experience_level: "INTERMEDIATE",
    category: "Web Development",
    skills: ["React", "Next.js", "TypeScript", "Tailwind CSS", "REST API"],
    client_country: "United States",
    client_rating: 4.9,
    upwork_url: "https://www.upwork.com/jobs/~01demo001",
    minutes_ago: 8,
  },
  {
    id: "demo_002",
    title: "Full Stack Node.js + PostgreSQL Backend Developer",
    description:
      "Looking for a backend developer to build scalable REST APIs using Node.js and PostgreSQL. The project involves designing database schemas, writing efficient queries, and deploying on AWS. Experience with Docker and CI/CD pipelines is a plus. Strong testing skills required.",
    budget: 1500,
    hourly_rate_min: null,
    hourly_rate_max: null,
    job_type: "FIXED_PRICE",
    experience_level: "EXPERT",
    category: "Web Development",
    skills: ["Node.js", "PostgreSQL", "AWS", "Docker", "REST API"],
    client_country: "Canada",
    client_rating: 4.8,
    upwork_url: "https://www.upwork.com/jobs/~01demo002",
    minutes_ago: 22,
  },
  {
    id: "demo_003",
    title: "Python Django Developer for E-commerce Platform",
    description:
      "We are building a multi-vendor e-commerce platform using Django and need an experienced Python developer. Tasks include building product catalog APIs, payment integration with Stripe, and admin panel customisation. Knowledge of Celery and Redis is a plus.",
    budget: 2500,
    hourly_rate_min: null,
    hourly_rate_max: null,
    job_type: "FIXED_PRICE",
    experience_level: "INTERMEDIATE",
    category: "Web Development",
    skills: ["Python", "Django", "PostgreSQL", "Stripe", "REST API"],
    client_country: "United Kingdom",
    client_rating: 4.7,
    upwork_url: "https://www.upwork.com/jobs/~01demo003",
    minutes_ago: 45,
  },
  {
    id: "demo_004",
    title: "React Native Mobile App Developer for Food Delivery",
    description:
      "Need a React Native developer to build iOS and Android apps for a food delivery startup. The app requires real-time order tracking, push notifications, and payment processing. Previous food-tech or marketplace experience is preferred. Strong UI/UX sense required.",
    budget: null,
    hourly_rate_min: 40,
    hourly_rate_max: 70,
    job_type: "HOURLY",
    experience_level: "EXPERT",
    category: "Mobile Development",
    skills: ["React Native", "TypeScript", "Firebase", "Stripe", "Push Notifications"],
    client_country: "Australia",
    client_rating: 5.0,
    upwork_url: "https://www.upwork.com/jobs/~01demo004",
    minutes_ago: 67,
  },
  {
    id: "demo_005",
    title: "Vue.js and Laravel Full Stack Developer Needed",
    description:
      "We are looking for a full-stack developer experienced in Vue.js and Laravel to maintain and extend our existing web application. This is an ongoing contract with 20-30 hours per week commitment. You should be comfortable with both frontend and backend work.",
    budget: null,
    hourly_rate_min: 25,
    hourly_rate_max: 45,
    job_type: "HOURLY",
    experience_level: "INTERMEDIATE",
    category: "Web Development",
    skills: ["Vue.js", "Laravel", "PHP", "MySQL", "REST API"],
    client_country: "Netherlands",
    client_rating: 4.6,
    upwork_url: "https://www.upwork.com/jobs/~01demo005",
    minutes_ago: 95,
  },
];

console.log("Seeding jobs...");
let ok = 0;
for (const j of jobs) {
  const q = `
    INSERT INTO jobs (
      id, title, description, budget, hourly_rate_min, hourly_rate_max,
      job_type, experience_level, category, skills_required,
      client_country, client_rating, upwork_url, posted_at, scraped_at
    ) VALUES (
      '${j.id}',
      ${dq(j.title)},
      ${dq(j.description)},
      ${maybeNull(j.budget)},
      ${maybeNull(j.hourly_rate_min)},
      ${maybeNull(j.hourly_rate_max)},
      '${j.job_type}',
      '${j.experience_level}',
      ${dq(j.category)},
      ${arr(j.skills)},
      ${dq(j.client_country)},
      ${maybeNull(j.client_rating)},
      ${dq(j.upwork_url)},
      NOW() - INTERVAL '${j.minutes_ago} minutes',
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET scraped_at = NOW()
  `;
  const r = await sql(q);
  if (r.message) {
    console.error("  x", j.id, r.message);
  } else {
    console.log("  +", j.title.slice(0, 55));
    ok++;
  }
}
console.log(`\nDone: ${ok}/${jobs.length} jobs seeded.`);
