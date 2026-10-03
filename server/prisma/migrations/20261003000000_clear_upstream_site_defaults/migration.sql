-- Disable analytics only when it still uses the inherited tracking ID.
UPDATE "system_configs"
SET "value" = 'false', "updated_at" = CURRENT_TIMESTAMP
WHERE "key" = 'seo_tracking_enabled'
  AND EXISTS (
    SELECT 1 FROM "system_configs"
    WHERE "key" = 'seo_tracking_id' AND btrim("value") = 'G-1HXQL8QTW2'
  );

-- Clear known upstream defaults, preserving the operator's custom settings.
UPDATE "system_configs" AS config
SET "value" = '', "updated_at" = CURRENT_TIMESTAMP
FROM (VALUES
  ('seo_site_url', 'https://incudal.di0.uk'),
  ('seo_site_url', 'https://incudal.di0.uk/'),
  ('seo_verification_path', '/google3dea696cbb38c37d.html'),
  ('seo_verification_content', 'google-site-verification: google3dea696cbb38c37d.html'),
  ('seo_indexnow_key', '6d5f0c0e9be241a5b35e5d2c6f6a49d1'),
  ('seo_tracking_id', 'G-1HXQL8QTW2'),
  ('footer_contact_email', 'incudal@sent.com'),
  ('footer_telegram_link', 'https://t.me/incudal_com')
) AS defaults(key, value)
WHERE config."key" = defaults.key AND btrim(config."value") = defaults.value;
