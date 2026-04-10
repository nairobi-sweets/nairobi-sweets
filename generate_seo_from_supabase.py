from pathlib import Path
import os, re
from html import escape
import requests

SUPABASE_URL = "https://dkjlvyynvgtijccitvvd.supabase.co"
SUPABASE_KEY = "sb_publishable_LtXESbvWOeL5EiUi1aYXSg_Ynm8qywm"
SITE_URL = "https://nairobi-sweets.com"
SITE_NAME = "Nairobi Sweets"
PLACEHOLDER = "https://via.placeholder.com/1200x1500?text=Nairobi+Sweets"

BASE_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = BASE_DIR / "seo"

def slugify(value: str) -> str:
    value = (value or "").strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"-{2,}", "-", value).strip("-")
    return value or "item"

def write_file(path: Path, content: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")

def fetch_profiles():
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError("Missing SUPABASE_URL or SUPABASE_KEY.")
    url = f"{SUPABASE_URL}/rest/v1/profiles"
    params = {
        "select": "*",
        "status": "eq.active",
        "order": "is_vvip.desc,is_featured.desc,is_vip.desc,id.desc"
    }
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Accept": "application/json"
    }
    resp = requests.get(url, params=params, headers=headers, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    for p in data:
        p["slug"] = p.get("slug") or slugify(p.get("name", "profile"))
    return data

def shell(title: str, description: str, canonical: str, body: str) -> str:
    return f"""<!DOCTYPE html>
<html lang=\"en\">
<head>
<meta charset=\"UTF-8\" />
<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\"/>
<title>{escape(title)}</title>
<meta name=\"description\" content=\"{escape(description)}\" />
<link rel=\"canonical\" href=\"{escape(canonical)}\" />
<meta name=\"robots\" content=\"index,follow\" />
<style>
body{{margin:0;font-family:Arial,Helvetica,sans-serif;background:#0b1224;color:#f8fafc}}
.wrap{{max-width:1100px;margin:0 auto;padding:24px}}
.card{{background:#111a31;border:1px solid rgba(255,255,255,.08);border-radius:24px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,.25)}}
.hero{{display:grid;grid-template-columns:1.1fr 1fr}}
.hero img{{width:100%;height:100%;object-fit:cover;display:block;min-height:420px}}
.content{{padding:28px}}
.badge{{display:inline-block;padding:6px 12px;border-radius:999px;font-size:12px;font-weight:bold;margin:0 8px 8px 0;background:#facc15;color:#111827}}
.badge.featured{{background:#ec4899;color:white}}
.badge.vvip{{background:#fde047;color:#111827}}
.badge.online{{background:#22c55e;color:white}}
.muted{{color:#aeb7c8}}
.btn{{display:inline-block;padding:12px 18px;border-radius:16px;text-decoration:none;font-weight:bold;margin-right:10px}}
.wa{{background:#22c55e;color:white}}
.call{{background:#ec4899;color:white}}
.section{{margin-top:28px}}
.links a{{color:#fde047;text-decoration:none}}
.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}}
.mini{{background:#111a31;border:1px solid rgba(255,255,255,.08);padding:18px;border-radius:18px}}
@media (max-width: 800px){{ .hero{{grid-template-columns:1fr}} .hero img{{min-height:320px}} }}
</style>
</head>
<body>{body}</body>
</html>"""

def profile_page(profile, related_loc, related_cat):
    name = profile.get("name","Profile")
    location = profile.get("location","Nairobi")
    category = profile.get("category","Premium")
    desc = profile.get("description", f"Premium {category} profile in {location}.")
    price = profile.get("price_range","Ask for pricing")
    phone = profile.get("phone","")
    whatsapp = profile.get("whatsapp", phone)
    image = profile.get("image_url") or PLACEHOLDER

    badges = []
    if profile.get("is_vvip"): badges.append('<span class="badge vvip">👑 VVIP</span>')
    if profile.get("is_vip"): badges.append('<span class="badge">VIP</span>')
    if profile.get("is_featured"): badges.append('<span class="badge featured">FEATURED</span>')
    if profile.get("is_online"): badges.append('<span class="badge online">ONLINE</span>')

    related_loc_html = "".join(
        f'<div class="mini"><a href="{SITE_URL}/seo/profiles/{escape(p["slug"])}.html">{escape(p.get("name","Profile"))}</a><div class="muted">{escape(p.get("location",""))}</div></div>'
        for p in related_loc[:4]
    ) or '<div class="muted">No related profiles yet.</div>'

    related_cat_html = "".join(
        f'<div class="mini"><a href="{SITE_URL}/seo/profiles/{escape(p["slug"])}.html">{escape(p.get("name","Profile"))}</a><div class="muted">{escape(p.get("category",""))}</div></div>'
        for p in related_cat[:4]
    ) or '<div class="muted">No related profiles yet.</div>'

    body = f"""
<div class="wrap">
  <div class="card hero">
    <img src="{escape(image)}" alt="{escape(name)}">
    <div class="content">
      <div>{"".join(badges)}</div>
      <h1>{escape(name)}</h1>
      <p class="muted">{escape(category)} in {escape(location)}</p>
      <p>{escape(desc)}</p>
      <p><strong>Price:</strong> {escape(price)}</p>
      <p><strong>Location:</strong> <a href="{SITE_URL}/seo/locations/{slugify(location)}.html">{escape(location)}</a></p>
      <p><strong>Category:</strong> <a href="{SITE_URL}/seo/categories/{slugify(category)}.html">{escape(category)}</a></p>
      <div class="section">
        <a class="btn wa" href="https://wa.me/{escape(str(whatsapp))}" target="_blank">WhatsApp</a>
        <a class="btn call" href="tel:{escape(str(phone))}">Call</a>
      </div>
    </div>
  </div>
  <div class="section">
    <h2>More profiles in {escape(location)}</h2>
    <div class="grid">{related_loc_html}</div>
  </div>
  <div class="section">
    <h2>More {escape(category)} listings</h2>
    <div class="grid">{related_cat_html}</div>
  </div>
  <div class="section links">
    <a href="{SITE_URL}/">Home</a> |
    <a href="{SITE_URL}/booking.html">Booking</a> |
    <a href="{SITE_URL}/featured.html">Featured</a>
  </div>
</div>
"""
    return shell(
        f"{name} | {category} in {location} | {SITE_NAME}",
        f"{name} is a premium {category} listing in {location}. View details and contact directly on {SITE_NAME}.",
        f"{SITE_URL}/seo/profiles/{profile['slug']}.html",
        body
    )

def listing_page(kind, value, profiles):
    slug = slugify(value)
    if kind == "location":
        title = f"{value} Premium Profiles | {SITE_NAME}"
        description = f"Browse premium listings in {value} on {SITE_NAME}."
        h1 = f"Premium Profiles in {value}"
        canonical = f"{SITE_URL}/seo/locations/{slug}.html"
    else:
        title = f"{value} Listings | {SITE_NAME}"
        description = f"Browse {value} listings on {SITE_NAME}."
        h1 = f"{value} Listings"
        canonical = f"{SITE_URL}/seo/categories/{slug}.html"

    cards = "".join(
        f"""
<div class="mini">
  <img src="{escape(p.get('image_url') or PLACEHOLDER)}" alt="{escape(p.get('name','Profile'))}" style="width:100%;aspect-ratio:4/5;object-fit:cover;border-radius:14px;margin-bottom:12px">
  <h3 style="margin:0 0 8px 0">{escape(p.get('name','Profile'))}</h3>
  <div class="muted" style="margin-bottom:8px">{escape(p.get('location',''))} • {escape(p.get('category',''))}</div>
  <a href="{SITE_URL}/seo/profiles/{escape(p['slug'])}.html">View profile</a>
</div>
""" for p in profiles
    ) or '<div class="muted">No listings yet.</div>'

    body = f"""
<div class="wrap">
  <div class="card content">
    <h1>{escape(h1)}</h1>
    <p class="muted">{escape(description)}</p>
  </div>
  <div class="section grid">{cards}</div>
  <div class="section links">
    <a href="{SITE_URL}/">Home</a> |
    <a href="{SITE_URL}/booking.html">Booking</a> |
    <a href="{SITE_URL}/featured.html">Featured</a>
  </div>
</div>
"""
    return shell(title, description, canonical, body)

def homepage_links_block(locations, categories, featured):
    loc_links = "".join(f'<li><a href="/seo/locations/{slugify(v)}.html">{escape(v)} profiles</a></li>' for v in locations)
    cat_links = "".join(f'<li><a href="/seo/categories/{slugify(v)}.html">{escape(v)} listings</a></li>' for v in categories)
    feat_links = "".join(f'<li><a href="/seo/profiles/{escape(p["slug"])}.html">{escape(p.get("name","Profile"))}</a></li>' for p in featured[:10])
    return f"""<section class="glass rounded-3xl p-6 mt-8">
<h2>SEO links block</h2>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:20px">
  <div><h3>Locations</h3><ul>{loc_links}</ul></div>
  <div><h3>Categories</h3><ul>{cat_links}</ul></div>
  <div><h3>Featured profiles</h3><ul>{feat_links}</ul></div>
</div>
</section>"""

def main():
    profiles = fetch_profiles()
    (OUTPUT_DIR / "profiles").mkdir(parents=True, exist_ok=True)
    (OUTPUT_DIR / "locations").mkdir(parents=True, exist_ok=True)
    (OUTPUT_DIR / "categories").mkdir(parents=True, exist_ok=True)

    locations = sorted({p.get("location") for p in profiles if p.get("location")})
    categories = sorted({p.get("category") for p in profiles if p.get("category")})

    urls = []

    for p in profiles:
        related_loc = [x for x in profiles if x["slug"] != p["slug"] and x.get("location") == p.get("location")]
        related_cat = [x for x in profiles if x["slug"] != p["slug"] and x.get("category") == p.get("category")]
        write_file(OUTPUT_DIR / "profiles" / f"{p['slug']}.html", profile_page(p, related_loc, related_cat))
        urls.append(f"{SITE_URL}/seo/profiles/{p['slug']}.html")

    for loc in locations:
        subset = [p for p in profiles if p.get("location") == loc]
        write_file(OUTPUT_DIR / "locations" / f"{slugify(loc)}.html", listing_page("location", loc, subset))
        urls.append(f"{SITE_URL}/seo/locations/{slugify(loc)}.html")

    for cat in categories:
        subset = [p for p in profiles if p.get("category") == cat]
        write_file(OUTPUT_DIR / "categories" / f"{slugify(cat)}.html", listing_page("category", cat, subset))
        urls.append(f"{SITE_URL}/seo/categories/{slugify(cat)}.html")

    sitemap = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    sitemap.extend(f"  <url><loc>{escape(u)}</loc></url>" for u in urls)
    sitemap.append("</urlset>")
    write_file(OUTPUT_DIR / "sitemap.xml", "\n".join(sitemap))
    write_file(OUTPUT_DIR / "robots-seo.txt", "User-agent: *\nAllow: /seo/\n")

    featured = [p for p in profiles if p.get("is_featured") or p.get("is_vvip") or p.get("is_vip")]
    write_file(OUTPUT_DIR / "seo_home_links_block.html", homepage_links_block(locations, categories, featured))
    write_file(OUTPUT_DIR / "root_sitemap_snippet.xml", f'<sitemap><loc>{SITE_URL}/seo/sitemap.xml</loc></sitemap>')

    print("Generated merged SEO content in:", OUTPUT_DIR)
    print("Total profiles pulled:", len(profiles))

if __name__ == "__main__":
    main()
