# ============================================================
# NAIROBI SWEETS
# NETLIFY CONFIGURATION
# https://nairobi-sweets.com
# ============================================================


# ============================================================
# BUILD
# ============================================================

[build]
publish = "."
functions = "netlify/functions"


[functions]
node_bundler = "esbuild"


# ============================================================
# SITEMAPS
# IMPORTANT:
# These MUST stay above general redirects / fallback rules.
# ============================================================


# ------------------------------------------------------------
# MASTER SITEMAP INDEX
# https://nairobi-sweets.com/sitemap.xml
# ------------------------------------------------------------

[[redirects]]
from = "/sitemap.xml"
to = "/.netlify/functions/generate-sitemaps"
status = 200
force = true


# ------------------------------------------------------------
# DYNAMIC PROFILE SITEMAP
# ------------------------------------------------------------

[[redirects]]
from = "/dynamic-profile-sitemap.xml"
to = "/.netlify/functions/dynamic-profile-sitemap"
status = 200
force = true


# ------------------------------------------------------------
# DYNAMIC LOCATION SITEMAP
# ------------------------------------------------------------

[[redirects]]
from = "/dynamic-location-sitemap.xml"
to = "/.netlify/functions/dynamic-location-sitemap"
status = 200
force = true


# ------------------------------------------------------------
# DYNAMIC CATEGORY SITEMAP
# ------------------------------------------------------------

[[redirects]]
from = "/dynamic-category-sitemap.xml"
to = "/.netlify/functions/generate-sitemaps?type=categories"
status = 200
force = true


# ------------------------------------------------------------
# DYNAMIC STATIC SITEMAP
# ------------------------------------------------------------

[[redirects]]
from = "/dynamic-static-sitemap.xml"
to = "/.netlify/functions/generate-sitemaps?type=static"
status = 200
force = true


# ------------------------------------------------------------
# GENERAL DYNAMIC SITEMAP INDEX
# ------------------------------------------------------------

[[redirects]]
from = "/dynamic-sitemap.xml"
to = "/.netlify/functions/generate-sitemaps"
status = 200
force = true


# ============================================================
# FRIENDLY PAGE ROUTES
# ============================================================

[[redirects]]
from = "/join"
to = "/join.html"
status = 200


[[redirects]]
from = "/login"
to = "/login.html"
status = 200


[[redirects]]
from = "/profile"
to = "/profile.html"
status = 200


[[redirects]]
from = "/trending"
to = "/trending.html"
status = 200


[[redirects]]
from = "/shorts"
to = "/shorts.html"
status = 200


[[redirects]]
from = "/reels"
to = "/reel.html"
status = 200


[[redirects]]
from = "/reel"
to = "/reel.html"
status = 200


[[redirects]]
from = "/forgot-password"
to = "/forgot-password.html"
status = 200


[[redirects]]
from = "/reset-password"
to = "/reset-password.html"
status = 200


[[redirects]]
from = "/payment-status"
to = "/payment-status.html"
status = 200


[[redirects]]
from = "/signup-payment"
to = "/public-signup-payment-page.html"
status = 200


# ============================================================
# ADMIN / VAULT PAGE ROUTES
# ============================================================

[[redirects]]
from = "/vault-login"
to = "/vault-login.html"
status = 200


[[redirects]]
from = "/vault"
to = "/vault-8472.html"
status = 200


[[redirects]]
from = "/vault-analytics"
to = "/vault-analytics.html"
status = 200


# ============================================================
# GENERAL API
# ============================================================

[[redirects]]
from = "/api/ai-search"
to = "/.netlify/functions/ai-search"
status = 200


[[redirects]]
from = "/api/track-event"
to = "/.netlify/functions/track-event"
status = 200


[[redirects]]
from = "/api/profile-share"
to = "/.netlify/functions/profile-share"
status = 200


[[redirects]]
from = "/api/test-alive"
to = "/.netlify/functions/test-alive"
status = 200


# ============================================================
# M-PESA
# ============================================================

[[redirects]]
from = "/api/mpesa/stk-push"
to = "/.netlify/functions/mpesa-stk-push"
status = 200


[[redirects]]
from = "/api/mpesa/callback"
to = "/.netlify/functions/mpesa-callback"
status = 200


[[redirects]]
from = "/api/payment-status"
to = "/.netlify/functions/payment-status"
status = 200


[[redirects]]
from = "/api/renew-profile-after-payment"
to = "/.netlify/functions/renew-profile-after-payment"
status = 200


# ============================================================
# ADMIN AUTH
# ============================================================

[[redirects]]
from = "/api/admin/login"
to = "/.netlify/functions/admin-login"
status = 200


[[redirects]]
from = "/api/admin/me"
to = "/.netlify/functions/admin-me"
status = 200


[[redirects]]
from = "/api/admin/bootstrap-owner"
to = "/.netlify/functions/admin-bootstrap-owner"
status = 200


[[redirects]]
from = "/api/admin/set-password"
to = "/.netlify/functions/set-admin-password"
status = 200


[[redirects]]
from = "/api/admin/debug-auth"
to = "/.netlify/functions/debug-admin-auth"
status = 200


# ============================================================
# ADMIN PROFILE MANAGEMENT
# ============================================================

[[redirects]]
from = "/api/admin/profiles"
to = "/.netlify/functions/admin-list-profiles"
status = 200


[[redirects]]
from = "/api/admin/add-profile"
to = "/.netlify/functions/admin-add-profile"
status = 200


[[redirects]]
from = "/api/admin/create-profile"
to = "/.netlify/functions/admin-add-profile"
status = 200


[[redirects]]
from = "/api/admin/approve-profile"
to = "/.netlify/functions/admin-approve-profile"
status = 200


[[redirects]]
from = "/api/admin/delete-profile"
to = "/.netlify/functions/admin-delete-profile"
status = 200


[[redirects]]
from = "/api/admin/renew-profile"
to = "/.netlify/functions/admin-renew-profile"
status = 200


[[redirects]]
from = "/api/admin/go-live-profile"
to = "/.netlify/functions/admin-go-live-profile"
status = 200


[[redirects]]
from = "/api/admin/toggle-payment"
to = "/.netlify/functions/admin-toggle-payment"
status = 200


# ============================================================
# ADMIN USER MANAGEMENT
# ============================================================

[[redirects]]
from = "/api/admin/users"
to = "/.netlify/functions/admin-list-users"
status = 200


[[redirects]]
from = "/api/admin/create-user"
to = "/.netlify/functions/admin-create-user"
status = 200


[[redirects]]
from = "/api/admin/update-user"
to = "/.netlify/functions/admin-update-user"
status = 200


[[redirects]]
from = "/api/admin/delete-user"
to = "/.netlify/functions/admin-delete-user"
status = 200


# ============================================================
# ADMIN ROLE MANAGEMENT
# ============================================================

[[redirects]]
from = "/api/admin/list-admin-users"
to = "/.netlify/functions/admin-list-admin-users"
status = 200


[[redirects]]
from = "/api/admin/update-role"
to = "/.netlify/functions/admin-update-admin-role"
status = 200


[[redirects]]
from = "/api/admin/upsert-admin-user"
to = "/.netlify/functions/admin-upsert-admin-user"
status = 200


[[redirects]]
from = "/api/admin/deactivate-admin-user"
to = "/.netlify/functions/admin-deactivate-admin-user"
status = 200


# ============================================================
# ADMIN AUDIT / DASHBOARD
# ============================================================

[[redirects]]
from = "/api/admin/audit-list"
to = "/.netlify/functions/admin-audit-list"
status = 200


[[redirects]]
from = "/api/admin/audit-logs"
to = "/.netlify/functions/admin-list-audit-logs"
status = 200


[[redirects]]
from = "/api/admin/vault-audit-log"
to = "/.netlify/functions/vault-audit-log"
status = 200


[[redirects]]
from = "/api/admin/dashboard-stats"
to = "/.netlify/functions/admin-dashboard-stats"
status = 200


# ============================================================
# CLIENT LOGIN MANAGEMENT
# ============================================================

[[redirects]]
from = "/api/admin/create-client-login"
to = "/.netlify/functions/admin-create-client-login"
status = 200


[[redirects]]
from = "/api/admin/get-client-login"
to = "/.netlify/functions/admin-get-client-login"
status = 200


[[redirects]]
from = "/api/admin/enable-client-login"
to = "/.netlify/functions/admin-enable-client-login"
status = 200


[[redirects]]
from = "/api/admin/disable-client-login"
to = "/.netlify/functions/admin-disable-client-login"
status = 200


[[redirects]]
from = "/api/admin/reset-client-password"
to = "/.netlify/functions/admin-reset-client-password"
status = 200


# ============================================================
# AUTOMATION / PROFILE EXPIRATION
# ============================================================

[[redirects]]
from = "/api/auto-expire-profiles"
to = "/.netlify/functions/auto-expire-profiles"
status = 200


[[redirects]]
from = "/api/auto-renew-check"
to = "/.netlify/functions/auto-renew-check"
status = 200


[[redirects]]
from = "/api/auto-renew"
to = "/.netlify/functions/auto-renew"
status = 200


[[redirects]]
from = "/api/renewal-worker"
to = "/.netlify/functions/renewal-worker"
status = 200


[[redirects]]
from = "/api/send-renewal-reminders"
to = "/.netlify/functions/send-renewal-reminders"
status = 200


[[redirects]]
from = "/api/renewal-reminder-worker"
to = "/.netlify/functions/renewal-reminder-worker"
status = 200


[[redirects]]
from = "/api/retry-failed-payments"
to = "/.netlify/functions/retry-failed-payments"
status = 200


# ============================================================
# TRENDING / SCORES
# ============================================================

[[redirects]]
from = "/api/refresh-trending"
to = "/.netlify/functions/refresh-trending"
status = 200


[[redirects]]
from = "/api/refresh-trending-scores"
to = "/.netlify/functions/refresh-trending-scores"
status = 200


# ============================================================
# WHATSAPP WORKERS
# ============================================================

[[redirects]]
from = "/api/whatsapp/enqueue"
to = "/.netlify/functions/whatsapp-enqueue"
status = 200


[[redirects]]
from = "/api/whatsapp/sender-worker"
to = "/.netlify/functions/whatsapp-sender-worker"
status = 200


# ============================================================
# SEO LOCATION ROUTES
# ============================================================

[[redirects]]
from = "/locations/:location"
to = "/seo/locations/:location.html"
status = 200


# ============================================================
# SECURITY HEADERS
# ============================================================

[[headers]]
for = "/*"

  [headers.values]
  X-Content-Type-Options = "nosniff"
  X-Frame-Options = "SAMEORIGIN"
  Referrer-Policy = "strict-origin-when-cross-origin"
  Permissions-Policy = "camera=(), microphone=(), geolocation=(self)"
  X-XSS-Protection = "1; mode=block"


# ============================================================
# SITEMAP HEADERS
# ============================================================

[[headers]]
for = "/*.xml"

  [headers.values]
  Content-Type = "application/xml; charset=UTF-8"
  Cache-Control = "public, max-age=300"


# ============================================================
# STATIC ASSET CACHE
# ============================================================

[[headers]]
for = "/assets/*"

  [headers.values]
  Cache-Control = "public, max-age=31536000, immutable"


# ============================================================
# HTML CACHE
# Keep HTML relatively fresh because profiles change often.
# ============================================================

[[headers]]
for = "/*.html"

  [headers.values]
  Cache-Control = "public, max-age=0, must-revalidate"


# ============================================================
# 404
# IMPORTANT:
# Keep this LAST.
# Do not put a generic /* -> index.html rule above this.
# ============================================================

[[redirects]]
from = "/*"
to = "/404.html"
status = 404
