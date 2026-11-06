// Bikin "struk belanja" dari aktivitas GitHub, hasilnya receipt.svg
// Jalan otomatis lewat GitHub Actions. Tanpa dependency, cukup Node 18+.

const fs = require("fs");

const USER = process.env.GH_USER || "SatriaMhr";
const NAME = process.env.DISPLAY_NAME || "Satria Mahardika";
const TOKEN = process.env.GITHUB_TOKEN;
const DAYS = 30;

const QUERY = `
query($login:String!,$from:DateTime!){
  user(login:$login){
    followers{ totalCount }
    repositories(first:100, ownerAffiliations:OWNER, privacy:PUBLIC, isFork:false){
      totalCount
      nodes{ primaryLanguage{ name } }
    }
    contributionsCollection(from:$from){
      totalCommitContributions
      totalPullRequestContributions
      totalIssueContributions
      commitContributionsByRepository(maxRepositories:6){
        repository{ name }
        contributions{ totalCount }
      }
    }
  }
}`;

async function getData() {
  if (!TOKEN && process.env.MOCK) {
    return {
      followers: { totalCount: 5 },
      repositories: { totalCount: 17, nodes: [
        ...Array(6).fill({ primaryLanguage: { name: "Java" } }),
        ...Array(4).fill({ primaryLanguage: { name: "HTML" } }),
        ...Array(3).fill({ primaryLanguage: { name: "JavaScript" } }),
        { primaryLanguage: null },
      ] },
      contributionsCollection: {
        totalCommitContributions: 42,
        totalPullRequestContributions: 3,
        totalIssueContributions: 1,
        commitContributionsByRepository: [
          { repository: { name: "PBO" }, contributions: { totalCount: 18 } },
          { repository: { name: "Pert02-PrakDesWeb_A-SatriaMahardika" }, contributions: { totalCount: 12 } },
          { repository: { name: "web-latihan" }, contributions: { totalCount: 9 } },
        ],
      },
    };
  }
  if (!TOKEN) throw new Error("GITHUB_TOKEN tidak ada");
  const from = new Date(Date.now() - DAYS * 86400000).toISOString();
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `bearer ${TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": "profile-receipt",
    },
    body: JSON.stringify({ query: QUERY, variables: { login: USER, from } }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data.user;
}

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

const QUOTES = [
  ["Barang yang sudah di-merge", "tidak dapat dikembalikan."],
  ["Bug bukan kesalahan kasir,", "itu fitur yang belum dijual."],
  ["Commit dulu, mikir belakangan."],
  ["Kalau error, restart dulu ya."],
  ["Works on my machine."],
  ["Kopi habis, kode jalan terus."],
];

(async () => {
  const d = await getData();
  const c = d.contributionsCollection;

  const now = new Date();
  const fmt = (o) =>
    new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", ...o }).format(now);
  const tgl = fmt({ day: "2-digit", month: "2-digit", year: "numeric" });
  const jam = fmt({ hour: "2-digit", minute: "2-digit", hour12: false }).replace(".", ":");

  // bahasa terbanyak
  const langCount = {};
  for (const r of d.repositories.nodes) {
    const n = r.primaryLanguage && r.primaryLanguage.name;
    if (n) langCount[n] = (langCount[n] || 0) + 1;
  }
  const langTotal = Object.values(langCount).reduce((a, b) => a + b, 0) || 1;
  const langs = Object.entries(langCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([n, v]) => [n, Math.round((v / langTotal) * 100) + "%"]);

  // ---------- susun baris ----------
  const W = 384, PAD = 30, LH = 22;
  const rows = []; // {t:'c'|'lr'|'dash'|'gap', ...}
  const C = (text, o = {}) => rows.push({ t: "c", text, ...o });
  const LR = (l, r, o = {}) => rows.push({ t: "lr", l, r, ...o });
  const DASH = () => rows.push({ t: "dash" });

  C(NAME.toUpperCase(), { size: 19, bold: true });
  C(`TOKO KODE  @${USER}`);
  C("Jl. GitHub No. 1, Internet", { muted: true });
  DASH();
  LR("TGL", tgl);
  LR("JAM", jam + " WIB");
  LR("KASIR", "GitHub Actions");
  DASH();
  LR(`ITEM (${DAYS} HARI)`, "QTY", { bold: true });
  const items = c.commitContributionsByRepository;
  if (items.length === 0) {
    C("(belum ada transaksi)", { muted: true });
  } else {
    for (const it of items)
      LR(cut(it.repository.name, 20), `${it.contributions.totalCount} commit`);
  }
  DASH();
  LR("TOTAL COMMIT", c.totalCommitContributions, { bold: true });
  LR("PULL REQUEST", c.totalPullRequestContributions);
  LR("ISSUE", c.totalIssueContributions);
  DASH();
  LR("REPO PUBLIK", d.repositories.totalCount);
  LR("PENGIKUT", d.followers.totalCount);
  if (langs.length) {
    LR("BAHAN BAKU", "", { bold: true });
    for (const [n, p] of langs) LR("  " + n, p);
  }
  DASH();
  LR("BAYAR", "Kopi & begadang");
  LR("KEMBALI", "Ilmu baru");
  DASH();
  const q = QUOTES[Math.floor(now.getTime() / 86400000) % QUOTES.length];
  q.forEach((line) => C(line, { muted: true }));

  // ---------- gambar ----------
  const INK = "#2b2b2b", MUTED = "#7a7466", PAPER = "#f7f3e9";
  let y = 46;
  let body = "";
  for (const r of rows) {
    if (r.t === "dash") {
      body += `<line x1="${PAD}" x2="${W - PAD}" y1="${y - 6}" y2="${y - 6}" stroke="${MUTED}" stroke-width="1" stroke-dasharray="5 4"/>`;
      y += 14;
      continue;
    }
    const fill = r.muted ? MUTED : INK;
    const weight = r.bold ? "700" : "400";
    const size = r.size || 14;
    if (r.t === "c") {
      body += `<text x="${W / 2}" y="${y}" text-anchor="middle" font-size="${size}" font-weight="${weight}" fill="${fill}">${esc(r.text)}</text>`;
      y += size > 16 ? LH + 4 : LH;
    } else {
      body += `<text x="${PAD}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" xml:space="preserve">${esc(r.l)}</text>`;
      if (r.r !== "")
        body += `<text x="${W - PAD}" y="${y}" text-anchor="end" font-size="${size}" font-weight="${weight}" fill="${fill}">${esc(r.r)}</text>`;
      y += LH;
    }
  }

  // barcode dari seed username + tanggal
  let seed = 0;
  for (const ch of USER + tgl) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  let bx = PAD + 20, bars = "";
  y += 4;
  const barY = y;
  while (bx < W - PAD - 20) {
    const w = 1 + Math.floor(rand() * 3);
    bars += `<rect x="${bx}" y="${y}" width="${w}" height="38" fill="${INK}"/>`;
    bx += w + 1 + Math.floor(rand() * 3);
  }
  y += 56;
  const thanks = `<text x="${W / 2}" y="${y}" text-anchor="middle" font-size="14" font-weight="700" fill="${INK}">*** TERIMA KASIH ***</text>`;
  y += 34;

  const H = y;
  const T = 6, N = W / 12;
  let zig = `M0,${T}`;
  for (let i = 0; i < N; i++) zig += ` L${i * 12 + 6},0 L${i * 12 + 12},${T}`;
  zig += ` L${W},${H - T}`;
  for (let i = N; i > 0; i--) zig += ` L${i * 12 - 6},${H} L${i * 12 - 12},${H - T}`;
  zig += " Z";

  const scanDist = W - 2 * PAD - 28;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W + 40}" height="${H + 90}" viewBox="-20 -50 ${W + 40} ${H + 90}" font-family="'Courier New', Courier, 'Liberation Mono', monospace">
  <title>Struk GitHub ${esc(USER)}</title>
  <defs>
    <filter id="s" x="-10%" y="-5%" width="120%" height="115%"><feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000" flood-opacity="0.28"/></filter>
    <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#57534e"/><stop offset="1" stop-color="#292524"/></linearGradient>
    <clipPath id="slot"><rect x="-30" y="-8" width="${W + 60}" height="${H + 70}"/></clipPath>
  </defs>
  <style>
    .paper { animation: feed 14s infinite; }
    .led   { animation: blink 1.4s ease-in-out infinite; }
    .laser { animation: scan 2.2s ease-in-out infinite alternate; }
    @keyframes feed {
      0%   { transform: translateY(-${H + 16}px); animation-timing-function: steps(42, end); }
      30%  { transform: translateY(0);            animation-timing-function: linear; }
      90%  { transform: translateY(0);            animation-timing-function: ease-in; }
      100% { transform: translateY(-${H + 16}px); }
    }
    @keyframes blink { 0%, 100% { opacity: .35; } 50% { opacity: 1; } }
    @keyframes scan  { from { transform: translateX(0); } to { transform: translateX(${scanDist}px); } }
    @media (prefers-reduced-motion: reduce) { .paper, .led, .laser { animation: none; } }
  </style>

  <g clip-path="url(#slot)">
    <g class="paper">
      <path d="${zig}" fill="${PAPER}" filter="url(#s)"/>
      ${body}
      ${bars}
      <rect class="laser" x="${PAD + 14}" y="${barY - 5}" width="2" height="48" fill="#c0553f" opacity="0.8"/>
      ${thanks}
    </g>
  </g>

  <!-- mesin printer -->
  <rect x="-16" y="-44" width="${W + 32}" height="40" rx="10" fill="url(#pg)"/>
  <rect x="2" y="-14" width="${W - 4}" height="7" rx="3.5" fill="#050505"/>
  <text x="14" y="-24" font-size="10" font-weight="700" letter-spacing="2" fill="#a8a29e">SATRIA-POS 58MM</text>
  <circle class="led" cx="${W - 14}" cy="-27" r="4" fill="#86b37b"/>
</svg>
`;
  fs.writeFileSync("receipt.svg", svg);
  console.log("receipt.svg ditulis,", H, "px tinggi");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
