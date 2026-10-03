\set ON_ERROR_STOP on
BEGIN;
-- A temporary table shadows any real table; this test never changes panel data.
CREATE TEMP TABLE system_configs (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
INSERT INTO system_configs (key, value) VALUES
  ('seo_site_url', 'https://incudal.di0.uk/'),
  ('seo_verification_path', '/google3dea696cbb38c37d.html'),
  ('seo_verification_content', 'google-site-verification: google3dea696cbb38c37d.html'),
  ('seo_indexnow_key', '6d5f0c0e9be241a5b35e5d2c6f6a49d1'),
  ('seo_tracking_id', 'G-1HXQL8QTW2'),
  ('seo_tracking_enabled', 'true'),
  ('footer_contact_email', 'incudal@sent.com'),
  ('footer_telegram_link', 'https://t.me/incudal_com'),
  ('brand_name', 'My panel');
\ir ../prisma/migrations/20261003000000_clear_upstream_site_defaults/migration.sql
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM system_configs WHERE key NOT IN ('seo_tracking_enabled', 'brand_name') AND value <> '')
     OR (SELECT value FROM system_configs WHERE key = 'seo_tracking_enabled') <> 'false'
     OR (SELECT value FROM system_configs WHERE key = 'brand_name') <> 'My panel' THEN
    RAISE EXCEPTION 'Inherited defaults were not cleared safely';
  END IF;
END $$;

UPDATE system_configs SET value = 'custom-' || key;
\ir ../prisma/migrations/20261003000000_clear_upstream_site_defaults/migration.sql
\ir ../prisma/migrations/20261003000000_clear_upstream_site_defaults/migration.sql
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM system_configs WHERE value <> 'custom-' || key) THEN
    RAISE EXCEPTION 'Custom settings were overwritten';
  END IF;
END $$;
ROLLBACK;
