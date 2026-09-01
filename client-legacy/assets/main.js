/**
 * PCP public site - minimal JS bundle.
 * The HTML references `/assets/main.js`.
 *
 * Responsibilities:
 * - Populate header/footer placeholders
 * - Fetch and render basic stats + latest news (best-effort; fail silently)
 */

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, String(v));
  }
  for (const child of children) node.append(child);
  return node;
}

function setText(id, value) {
  const n = document.getElementById(id);
  if (n) n.textContent = value;
}

function safeUrl(path) {
  // allow running behind a subpath via <base>, but keep current site origin.
  return new URL(path, window.location.origin).toString();
}

function renderHeaderFooter() {
  const header = document.getElementById("site-header");
  const footer = document.getElementById("site-footer");

  if (header) {
    header.innerHTML = "";
    header.append(
      el("div", { class: "container" }, [
        el("div", { class: "nav" }, [
          el("a", { href: "/", class: "brand" }, [document.createTextNode("PCP")]),
          el("nav", { class: "nav-links" }, [
            el("a", { href: "/" }, [document.createTextNode("Acasa")]),
            el("a", { href: "/aderenti.html" }, [document.createTextNode("Aderenti")]),
            el("a", { href: "/program.html" }, [document.createTextNode("Program")]),
            el("a", { href: "/revista/docs/Revista_PCP.html" }, [document.createTextNode("Stiri")]),
            el("a", { href: "/admin.html" }, [document.createTextNode("Admin")])
          ])
        ])
      ])
    );
  }

  if (footer) {
    footer.innerHTML = "";
    footer.append(
      el("div", { class: "container" }, [
        el("div", { class: "footer-grid" }, [
          el("div", {}, [
            el("strong", {}, [document.createTextNode("Partidul Conservator al Seniorilor")]),
            el("div", { class: "muted" }, [document.createTextNode("Platforma oficiala PCP")])
          ]),
          el("div", { class: "footer-links" }, [
            el("a", { href: "/gdpr.html" }, [document.createTextNode("GDPR")]),
            el("a", { href: "/statut.html" }, [document.createTextNode("Statut")]),
            el("a", { href: "/contact.html" }, [document.createTextNode("Contact")])
          ])
        ])
      ])
    );
  }
}

async function fetchJson(path) {
  const res = await fetch(safeUrl(path), { credentials: "include" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function unwrapEnvelope(payload) {
  // tolerate both raw arrays and { data: ... } envelopes
  if (payload && typeof payload === "object" && "data" in payload) return payload.data;
  return payload;
}

async function loadStatsAndNews() {
  // Best-effort: try some plausible endpoints. If none work, keep placeholders.
  const candidates = [
    { stats: "/api/stats/public", news: "/api/news/public?page=1&limit=6" },
    { stats: "/stats/public", news: "/news/public?page=1&limit=6" },
    { stats: "/api/stats", news: "/api/news" }
  ];

  let stats = null;
  let news = null;

  for (const c of candidates) {
    try {
      const s = await fetchJson(c.stats);
      stats = unwrapEnvelope(s);
    } catch {}
    try {
      const n = await fetchJson(c.news);
      news = unwrapEnvelope(n);
    } catch {}

    if (stats || news) break;
  }

  if (stats) {
    // try multiple field names
    const volunteers = stats.volunteers ?? stats.volunteerCount ?? stats.aderenti ?? stats.members ?? null;
    const newsCount = stats.news ?? stats.newsCount ?? stats.comunicate ?? null;

    if (volunteers != null) setText("stat-volunteers", String(volunteers));
    if (newsCount != null) setText("stat-news", String(newsCount));
  }

  if (Array.isArray(news)) {
    renderNews(news);
  } else if (news && Array.isArray(news.items)) {
    renderNews(news.items);
  }
}

function renderNews(items) {
  const status = document.getElementById("news-status");
  const list = document.getElementById("news-list");
  if (!list) return;

  if (status) status.textContent = items.length ? "" : "Nu exista comunicate inca.";

  list.innerHTML = "";
  for (const item of items.slice(0, 6)) {
    const title = item.title ?? item.titlu ?? "Comunicat";
    const excerpt = item.excerpt ?? item.summary ?? item.descriere ?? "";
    const slug = item.slug ?? item.id ?? "";

    const href =
      item.url ??
      (slug ? `/stire.html?id=${encodeURIComponent(String(slug))}` : "/stiri.html");

    list.append(
      el("article", { class: "program-card" }, [
        el("h3", {}, [document.createTextNode(title)]),
        el("p", {}, [document.createTextNode(excerpt)]),
        el("a", { class: "btn-secondary", href }, [document.createTextNode("Citeste")])
      ])
    );
  }
}

function injectExtraCss() {
  // Small additions for header/footer created by JS, without requiring another file.
  const style = document.createElement("style");
  style.textContent = `
    .nav { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:14px 0; }
    .brand { font-weight:800; letter-spacing:.08em; text-transform:uppercase; }
    .nav-links { display:flex; flex-wrap:wrap; gap:10px; }
    .nav-links a { padding:8px 10px; border-radius:999px; border:1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.04); }
    .nav-links a:hover { background: rgba(255,255,255,.08); }
    .footer-grid { display:flex; gap:14px; justify-content:space-between; padding:18px 0; flex-wrap:wrap; }
    .footer-links { display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
    .footer-links a { color: rgba(230,238,252,.85); }
    .muted { color: rgba(184,199,230,.9); margin-top: 6px; }
  `;
  document.head.append(style);
}

renderHeaderFooter();
injectExtraCss();
loadStatsAndNews();
