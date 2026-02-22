/* =====================================================================
   FULLINTEL — REVIEW REPORT FEATURE
   Supabase Schema  |  J&J Innovative Medicine — Japan
   Run this entire file in your Supabase SQL Editor
   ===================================================================== */

-- ──────────────────────────────────────────────────────────────────────
-- HELPER: auto-update updated_at on any row change
-- ──────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


-- ══════════════════════════════════════════════════════════════════════
-- 1.  OUTLETS  (referenced by articles)
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS outlets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  url         TEXT,
  country     TEXT,
  language    TEXT,
  media_type  TEXT,   -- Print | Online | Broadcast | Social
  created_at  TIMESTAMPTZ DEFAULT NOW()
);


-- ══════════════════════════════════════════════════════════════════════
-- 2.  CONTACTS  (referenced by articles)
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name   TEXT NOT NULL,
  email       TEXT,
  phone       TEXT,
  company     TEXT,
  role        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);


-- ══════════════════════════════════════════════════════════════════════
-- 3.  ARTICLES  (core table — matches Fullintel Add Article form)
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS articles (

  -- ── Identity ───────────────────────────────────────────────────────
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),

  -- ── Article Tab — Basic Info ────────────────────────────────────────
  heading               TEXT        NOT NULL,          -- "Heading" (title/headline)
  article_url           TEXT,                          -- "Article URL"
  published_date        DATE        NOT NULL,          -- "Published Date" (required *)
  banner_image          TEXT,                          -- "Banner Image" (URL/path)
  views                 INTEGER     DEFAULT 0,         -- "Views"
  related_tweets        TEXT,                          -- "Related Tweets"
  article_media_type    TEXT,                          -- "Article MediaType"
                                                       --   e.g. Print | Online | Broadcast | Social

  -- ── Article Tab — Metrics ───────────────────────────────────────────
  article_reach         NUMERIC(15,2),                 -- "Article Reach"
  national_reach        BOOLEAN     DEFAULT FALSE,     -- "National Reach" checkbox
  ave                   NUMERIC(15,2),                 -- "AVE" (Advertising Value Equivalency)
  national_ave          BOOLEAN     DEFAULT FALSE,     -- "National AVE" checkbox
  media_impact_score    NUMERIC(10,4),                 -- "Media Impact Score"

  -- ── Article Tab — Boolean Flags ─────────────────────────────────────
  is_important          BOOLEAN     DEFAULT FALSE,     -- "Mark as Important"
  behind_paywall        BOOLEAN     DEFAULT FALSE,     -- "Behind PayWall"
  key_sources           BOOLEAN     DEFAULT FALSE,     -- "Key Sources"
  hero_brief            BOOLEAN     DEFAULT FALSE,     -- "hero (Brief)"
  share_article_content BOOLEAN     DEFAULT FALSE,     -- "Share Article Content"
  peripheral_mention    BOOLEAN     DEFAULT FALSE,     -- "Peripheral Mention"
  gilead_article        BOOLEAN     DEFAULT FALSE,     -- "Gilead Article"
  webapp_article        BOOLEAN     DEFAULT FALSE,     -- "Webapp Article"
  hero_topic            BOOLEAN     DEFAULT FALSE,     -- "hero (Topic)"

  -- ── Article Tab — Website Article Category ─────────────────────────
  -- Radio: Article | Press Release | Corporate Newsroom
  website_article_category TEXT DEFAULT 'Article'
    CHECK (website_article_category IN ('Article','Press Release','Corporate Newsroom')),

  -- ── Article Tab — Full Article Content ─────────────────────────────
  full_article          TEXT        NOT NULL,          -- "Full Article *" (rich text / HTML)

  -- ── Content Tagging Tab — Content Categories ───────────────────────
  -- Multi-select checkboxes grouped by type.
  -- Stored as an array of string keys matching the values below.
  --
  --  Company News group:
  --    corporate | finance
  --
  --  Products News group:
  --    cardiovascular_metabolism | immunology | infectious_diseases_vaccines
  --    neuroscience | oncology | pulmonary_hypertension | others_products
  --
  --  Competitors News group:
  --    daiichi_sankyo | takeda | astrazeneca | merck | pfizer
  --
  --  Industry News group:
  --    pharma_trends | drug_pricing | politics_policy | regulatory | rnd
  --
  content_categories    TEXT[]      DEFAULT '{}',

  -- ── Content Tagging Tab — Content Type ─────────────────────────────
  -- Single radio selection.
  -- Values: company_news_ja | company_news_en
  --         product_news_ja | product_news_en
  --         competitor_news_ja | competitor_news_en
  --         industry_news_ja | industry_news_en
  --         competitor_news_names
  content_type          TEXT,

  -- ── Status ─────────────────────────────────────────────────────────
  status                TEXT        DEFAULT 'active'
    CHECK (status IN ('active','archived','draft'))

);

-- Trigger
CREATE OR REPLACE TRIGGER articles_updated_at
  BEFORE UPDATE ON articles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS articles_published_date_idx   ON articles(published_date DESC);
CREATE INDEX IF NOT EXISTS articles_status_idx           ON articles(status);
CREATE INDEX IF NOT EXISTS articles_content_type_idx     ON articles(content_type);
CREATE INDEX IF NOT EXISTS articles_categories_idx       ON articles USING gin(content_categories);
CREATE INDEX IF NOT EXISTS articles_heading_search_idx   ON articles USING gin(to_tsvector('english', heading));
CREATE INDEX IF NOT EXISTS articles_is_important_idx     ON articles(is_important) WHERE is_important = TRUE;


-- ══════════════════════════════════════════════════════════════════════
-- 4.  ARTICLE_OUTLETS  (M:M — articles ↔ outlets)
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS article_outlets (
  article_id  UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  outlet_id   UUID NOT NULL REFERENCES outlets(id)  ON DELETE CASCADE,
  PRIMARY KEY (article_id, outlet_id)
);


-- ══════════════════════════════════════════════════════════════════════
-- 5.  ARTICLE_CONTACTS  (M:M — articles ↔ contacts)
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS article_contacts (
  article_id  UUID NOT NULL REFERENCES articles(id)  ON DELETE CASCADE,
  contact_id  UUID NOT NULL REFERENCES contacts(id)  ON DELETE CASCADE,
  PRIMARY KEY (article_id, contact_id)
);


-- ══════════════════════════════════════════════════════════════════════
-- 6.  REPORTS
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS reports (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT        NOT NULL,
  client_name     TEXT        NOT NULL,
  description     TEXT,
  period_start    DATE,
  period_end      DATE,
  report_type     TEXT        DEFAULT 'weekly'
    CHECK (report_type IN ('daily','weekly','monthly','quarterly','annual','custom')),
  notes           TEXT,
  status          TEXT        DEFAULT 'draft'
    CHECK (status IN ('draft','pending','reviewing','approved','rejected')),
  ai_score        INTEGER     CHECK (ai_score BETWEEN 0 AND 100),
  article_count   INTEGER     DEFAULT 0,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER reports_updated_at
  BEFORE UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS reports_status_idx     ON reports(status);
CREATE INDEX IF NOT EXISTS reports_client_idx     ON reports(client_name);
CREATE INDEX IF NOT EXISTS reports_created_idx    ON reports(created_at DESC);


-- ══════════════════════════════════════════════════════════════════════
-- 7.  REPORT_ARTICLES  (join: reports ↔ articles + review data)
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS report_articles (
  id                  UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id           UUID      NOT NULL REFERENCES reports(id)  ON DELETE CASCADE,
  article_id          UUID      NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  order_index         INTEGER   DEFAULT 0,
  article_status      TEXT      DEFAULT 'pending'
    CHECK (article_status IN ('pending','approved','rejected')),
  reviewer_note       TEXT,
  ai_score            INTEGER   CHECK (ai_score BETWEEN 0 AND 100),
  verification_data   JSONB,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (report_id, article_id)
);

CREATE OR REPLACE TRIGGER report_articles_updated_at
  BEFORE UPDATE ON report_articles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS ra_report_id_idx   ON report_articles(report_id);
CREATE INDEX IF NOT EXISTS ra_article_id_idx  ON report_articles(article_id);
CREATE INDEX IF NOT EXISTS ra_status_idx      ON report_articles(article_status);


-- ══════════════════════════════════════════════════════════════════════
-- 8.  ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════════════
ALTER TABLE outlets           ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_outlets   ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_contacts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports           ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_articles   ENABLE ROW LEVEL SECURITY;

-- Development: open access — tighten per-user policies before going to production
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['outlets','contacts','articles','article_outlets','article_contacts','reports','report_articles']
  LOOP
    EXECUTE format($f$
      CREATE POLICY "anon_all_%s"  ON %I FOR ALL TO anon          USING (true) WITH CHECK (true);
      CREATE POLICY "auth_all_%s"  ON %I FOR ALL TO authenticated  USING (true) WITH CHECK (true);
    $f$, tbl, tbl, tbl, tbl);
  END LOOP;
END;
$$;


-- ══════════════════════════════════════════════════════════════════════
-- 9.  REFERENCE DATA — Content Category Lookup
--     (not a foreign key constraint; kept as reference / UI dropdown source)
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS content_category_lookup (
  key         TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  group_name  TEXT NOT NULL,
  sort_order  INTEGER
);

INSERT INTO content_category_lookup (key, label, group_name, sort_order) VALUES
  -- Company News
  ('corporate',                    'Corporate',                         'Company News',      1),
  ('finance',                      'Finance',                           'Company News',      2),
  -- Products News
  ('cardiovascular_metabolism',    'Cardiovascular & Metabolism',       'Products News',    10),
  ('immunology',                   'Immunology',                        'Products News',    11),
  ('infectious_diseases_vaccines', 'Infectious Diseases and Vaccines',  'Products News',    12),
  ('neuroscience',                 'Neuroscience',                      'Products News',    13),
  ('oncology',                     'Oncology',                          'Products News',    14),
  ('pulmonary_hypertension',       'Pulmonary Hypertension',            'Products News',    15),
  ('others_products',              'Others',                            'Products News',    16),
  -- Competitors News
  ('daiichi_sankyo',               'Daiichi Sankyo',                    'Competitors News', 20),
  ('takeda',                       'Takeda',                            'Competitors News', 21),
  ('astrazeneca',                  'AstraZeneca',                       'Competitors News', 22),
  ('merck',                        'Merck',                             'Competitors News', 23),
  ('pfizer',                       'Pfizer',                            'Competitors News', 24),
  -- Industry News
  ('pharma_trends',                'Pharma Trends',                     'Industry News',    30),
  ('drug_pricing',                 'Drug Pricing',                      'Industry News',    31),
  ('politics_policy',              'Politics/Policy',                   'Industry News',    32),
  ('regulatory',                   'Regulatory',                        'Industry News',    33),
  ('rnd',                          'R&D',                               'Industry News',    34)
ON CONFLICT (key) DO NOTHING;


CREATE TABLE IF NOT EXISTS content_type_lookup (
  key         TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  sort_order  INTEGER
);

INSERT INTO content_type_lookup (key, label, sort_order) VALUES
  ('company_news_ja',        'Company News - Japanese',    1),
  ('company_news_en',        'Company News - English',     2),
  ('product_news_ja',        'Product News - Japanese',    3),
  ('product_news_en',        'Product News - English',     4),
  ('competitor_news_ja',     'Competitor News - Japanese', 5),
  ('competitor_news_en',     'Competitor News - English',  6),
  ('industry_news_ja',       'Industry News - Japanese',   7),
  ('industry_news_en',       'Industry News - English',    8),
  ('competitor_news_names',  'Competitor News Names',      9)
ON CONFLICT (key) DO NOTHING;


-- ══════════════════════════════════════════════════════════════════════
-- 10. SEED DATA — Sample outlets, contacts, and articles for testing
-- ══════════════════════════════════════════════════════════════════════

-- Sample Outlets
INSERT INTO outlets (name, url, country, language, media_type) VALUES
  ('Pharma Times',        'https://pharmatimes.com',      'UK',    'English',  'Online'),
  ('Nikkei Healthcare',   'https://nikkei.com',           'Japan', 'Japanese', 'Online'),
  ('Japan Medical Review','https://jmr.example.com',      'Japan', 'English',  'Print'),
  ('The Lancet',          'https://thelancet.com',         'UK',    'English',  'Online'),
  ('Reuters Health',      'https://reuters.com/health',   'USA',   'English',  'Online')
ON CONFLICT (name) DO NOTHING;

-- Sample Contacts
INSERT INTO contacts (full_name, email, company, role) VALUES
  ('Kenji Nakamura',  'kenji@example.jp',   'Pharma Times',      'Journalist'),
  ('Yuki Tanaka',     'yuki@nikkei.co.jp',  'Nikkei Healthcare', 'Editor'),
  ('Dr. Sarah Chen',  'schen@thelancet.com','The Lancet',        'Reviewer')
ON CONFLICT DO NOTHING;

-- Newsletter & Distribution
CREATE TABLE IF NOT EXISTS newsletters (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  title                 TEXT        NOT NULL,
  template_name         TEXT        DEFAULT 'New - Media Imp',
  subject_type          TEXT        DEFAULT 'Custom',
  banner_date           DATE,
  heading_type          TEXT        DEFAULT 'Default',
  report_id             UUID        REFERENCES reports(id) ON DELETE SET NULL,
  published_on          DATE,
  distribution_list     TEXT        DEFAULT 'DEFAULT',
  status                TEXT        DEFAULT 'draft' CHECK (status IN ('draft','sent','archived'))
);

CREATE TABLE IF NOT EXISTS newsletter_articles (
  newsletter_id         UUID        REFERENCES newsletters(id) ON DELETE CASCADE,
  article_id            UUID        REFERENCES articles(id) ON DELETE CASCADE,
  order_index           INTEGER     DEFAULT 0,
  PRIMARY KEY (newsletter_id, article_id)
);

-- Standards Table for AI Review
CREATE TABLE IF NOT EXISTS standards (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  title                 TEXT        NOT NULL,
  content               TEXT        NOT NULL,
  is_active             BOOLEAN     DEFAULT TRUE,
  version               TEXT        DEFAULT '1.0'
);

-- Enable RLS
ALTER TABLE newsletters ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE standards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for development - newsletters"          ON newsletters          FOR ALL USING (true);
CREATE POLICY "Allow all for development - newsletter_articles" ON newsletter_articles FOR ALL USING (true);
CREATE POLICY "Allow all for development - standards"           ON standards           FOR ALL USING (true);

-- Sample Standards
INSERT INTO standards (title, content, version)
VALUES 
('AP Style - Headlines', 'All article headings must follow AP style: Capitalize only the first word and proper nouns, plus words with four or more letters (optional depending on specific client track).', '1.0'),
('Summary Conciseness', 'Article summaries should not exceed 150 words and must maintain a professional, neutral tone.', '1.0')
ON CONFLICT DO NOTHING;

-- Sample Newsletter
INSERT INTO newsletters (title, banner_date, published_on)
VALUES ('J&J Innovative Medicine Japan Media Impact Report', '2026-02-19', '2026-02-20')
ON CONFLICT DO NOTHING;

-- Sample Articles (matching the new schema)
INSERT INTO articles (
  heading, article_url, published_date,
  article_reach, national_reach,
  ave, national_ave,
  media_impact_score,
  is_important, behind_paywall,
  website_article_category,
  full_article,
  content_categories, content_type, status
) VALUES
(
  'J&J Expands Oncology Pipeline with New Drug Approval in Japan',
  'https://example.com/jj-oncology-japan',
  '2026-02-15',
  250000, TRUE, 18000.00, TRUE, 7.42,
  TRUE, FALSE,
  'Press Release',
  '<p>Johnson &amp; Johnson has received regulatory approval from Japan''s PMDA for its groundbreaking oncology treatment. This approval marks a significant milestone in the company''s Asia-Pacific expansion strategy, with potential to reach over 120,000 patients annually. The drug demonstrated a 45% improvement in progression-free survival in Phase III trials. The approval was expedited under Japan''s Sakigake designation. Executives forecast revenues of ~$800M in Japan within three years.</p>',
  ARRAY['oncology','corporate'],
  'product_news_ja',
  'active'
),
(
  'Healthcare Innovation Summit 2026: Key Takeaways from Tokyo',
  'https://example.com/healthcare-summit-tokyo',
  '2026-02-10',
  180000, FALSE, 12500.00, FALSE, 5.80,
  FALSE, FALSE,
  'Article',
  '<p>The 2026 Healthcare Innovation Summit in Tokyo gathered 3,000+ professionals from 45 countries. Topics included AI diagnostics, precision medicine, and digital therapeutics. Japan''s medtech sector grew 12% YoY. J&amp;J presented wearable-sensor pilot results. The summit also addressed APAC regulatory harmonisation and public-private partnership opportunities.</p>',
  ARRAY['pharma_trends','corporate'],
  'industry_news_ja',
  'active'
),
(
  'Generic Drug Market in Japan: Pressure on Branded Pharma',
  NULL,
  '2026-02-05',
  95000, FALSE, 6200.00, FALSE, 3.15,
  FALSE, FALSE,
  'Article',
  '<p>Japan''s Ministry of Health is targeting 80% generic penetration by 2027. Branded manufacturers could see 15-25% revenue declines in some areas. J&amp;J is responding with accelerated innovation and premium pricing strategies. Mergers and acquisitions are increasing as companies seek scale. Patient groups welcome lower costs but raise concerns over innovation incentives.</p>',
  ARRAY['drug_pricing','regulatory','finance'],
  'industry_news_en',
  'active'
),
(
  'Clinical Trial: Immunotherapy Combo Shows 67% Response Rate',
  'https://example.com/immunotherapy-results',
  '2026-01-28',
  420000, TRUE, 31000.00, TRUE, 9.20,
  TRUE, TRUE,
  'Press Release',
  '<p>A Phase III trial published in The Lancet shows 67% overall response rate for a novel combination immunotherapy vs 31% for standard-of-care in advanced NSCLC. The trial enrolled 1,247 patients across 18 countries including Japan. J&amp;J is a co-developer. Regulatory submissions are planned for Q2 2026 with FDA Priority Review granted.</p>',
  ARRAY['oncology','immunology'],
  'product_news_en',
  'active'
),
(
  'Supply Chain Disruptions Impact Pharmaceutical Distribution in APAC',
  'https://example.com/supply-chain-pharma',
  '2026-02-18',
  160000, FALSE, 9800.00, FALSE, 4.55,
  FALSE, FALSE,
  'Article',
  '<p>Lead times for active pharmaceutical ingredients have risen 35% vs pre-pandemic levels. J&amp;J has built strategic inventory reserves and diversified Southeast Asian suppliers. Japan is especially exposed due to dependence on imported APIs. Government and industry are building domestic manufacturing resilience, with several new facilities announced.</p>',
  ARRAY['pharma_trends','regulatory'],
  'industry_news_en',
  'active'
)
ON CONFLICT DO NOTHING;
