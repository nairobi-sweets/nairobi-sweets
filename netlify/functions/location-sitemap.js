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
  "kasarani",
  "ruaka",
  "ruiru",
  "kiambu",
  "thika",
  "juja",
  "kitengela",
  "rongai",
  "karen",
  "roysambu"
];

const urls = locations.map(loc => `
<url>
  <loc>https://nairobi-sweets.com/seo/locations/${loc}.html</loc>
  <changefreq>daily</changefreq>
  <priority>0.8</priority>
</url>`).join("");

return {
  statusCode: 200,
  headers: {
    "Content-Type": "application/xml"
  },
  body: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`
};

};
