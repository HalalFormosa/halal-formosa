import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Server key: the new `default` secret key (SUPABASE_SECRET_KEYS is a JSON object keyed by key name),
// falling back to the legacy service_role key until that one is deactivated.
function readSecretKey(): string {
  try {
    const key = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default;
    if (typeof key === "string" && key !== "") return key;
  } catch { /* fall through to the legacy key */ }
  return "";
}
const SECRET_KEY = readSecretKey();

const SITE_URL = "https://halalformosa.com";
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  SECRET_KEY || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Static pages with their priorities
const STATIC_PAGES = [
  { path: "/", priority: "1.0", changefreq: "weekly" },
  { path: "/about", priority: "0.8", changefreq: "monthly" },
  { path: "/contact", priority: "0.8", changefreq: "monthly" },
  { path: "/faq", priority: "0.8", changefreq: "monthly" },
  { path: "/news", priority: "0.9", changefreq: "daily" },
  { path: "/privacy", priority: "0.5", changefreq: "yearly" },
  { path: "/terms", priority: "0.5", changefreq: "yearly" },
];

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatDate(date: string): string {
  return new Date(date).toISOString().split("T")[0];
}

Deno.serve(async () => {
  try {
    // Fetch all news articles with slugs
    const { data: articles } = await supabase
      .from("news")
      .select("slug, updated_at, created_at")
      .not("slug", "is", null)
      .order("created_at", { ascending: false });

    const today = new Date().toISOString().split("T")[0];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`;
    xml += `        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"\n`;
    xml += `        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;

    // Static pages
    for (const page of STATIC_PAGES) {
      xml += `  <url>\n`;
      xml += `    <loc>${SITE_URL}${page.path}</loc>\n`;
      xml += `    <lastmod>${today}</lastmod>\n`;
      xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
      xml += `    <priority>${page.priority}</priority>\n`;
      xml += `  </url>\n`;
    }

    // Dynamic article pages
    if (articles) {
      for (const article of articles) {
        const lastmod = formatDate(article.updated_at || article.created_at);
        xml += `  <url>\n`;
        xml += `    <loc>${SITE_URL}/news/${escapeXml(article.slug)}</loc>\n`;
        xml += `    <lastmod>${lastmod}</lastmod>\n`;
        xml += `    <changefreq>weekly</changefreq>\n`;
        xml += `    <priority>0.7</priority>\n`;
        xml += `  </url>\n`;
      }
    }

    xml += `</urlset>`;

    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
        "X-Key-Source": SECRET_KEY ? "secret" : "legacy",
      },
    });
  } catch (e) {
    console.error("Sitemap generation error:", e);
    return new Response("Error generating sitemap", { status: 500 });
  }
});
