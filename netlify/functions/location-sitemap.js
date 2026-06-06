exports.handler = async () => {
  const locations = [
    "nairobi",
    "kilimani",
    "westlands",
    "lavington",
    "ngong-road",
    "embakasi",
    "south-b",
    "south-c",
    "parklands",
    "karen",
    "rongai",
    "kitengela",
    "kasarani",
    "roysambu",
    "ruaka",
    "ruiru",
    "kiambu",
    "thika",
    "juja",
    "zimmerman",
    "mirema",
    "trm",
    "githurai",
    "donholm",
    "umoja",
    "buruburu",
    "fedha",
    "syokimau",
    "athi-river",
    "thindigua",
    "kiambu-road",
    "kahawa-west",
    "kahawa-sukari",
    "juja-farm",
    "kimbo"
  ];

  const urls = locations.map((loc) => {
    return `  <url>
    <loc>https://nairobi-sweets.com/seo/locations/${loc}.html</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`;
  }).join("\n");

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300"
    },
    body: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`
  };
};
