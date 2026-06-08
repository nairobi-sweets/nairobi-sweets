DYNAMIC SEO LOCATION ENGINE - NAIROBI SWEETS

Files included:
1. seo-location.html
   - One dynamic SEO page for many locations.
   - Reads the location from:
     /seo-location.html?location=roysambu
     or from clean URLs when redirects are configured.

2. _redirects-snippet.txt
   - Netlify redirect rules.
   - Paste into your existing _redirects file.
   - This lets /seo/locations/roysambu.html render through seo-location.html.

3. netlify-toml-redirects-snippet.txt
   - Alternative redirect setup for netlify.toml.

4. dynamic-location-sitemap.xml
   - Sitemap for the dynamic location URLs.

UPLOAD GUIDE:
- Upload seo-location.html to your website root.
- Add the redirects to Netlify using either _redirects or netlify.toml.
- Upload or merge dynamic-location-sitemap.xml into location-sitemap.xml.
- Test:
  https://nairobi-sweets.com/seo-location.html?location=roysambu
  https://nairobi-sweets.com/seo/locations/roysambu.html

IMPORTANT:
If you already have real static files inside /seo/locations/, Netlify may serve the static file first depending on deploy order.
Use this engine for new locations or replace old static files if you want one central template.
