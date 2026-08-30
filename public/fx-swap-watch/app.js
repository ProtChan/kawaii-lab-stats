const PAIRS = ["USDJPY", "EURJPY", "GBPJPY", "AUDJPY", "NZDJPY", "TRYJPY", "MXNJPY", "ZARJPY", "HUFJPY"];
let latestRows = [];

const fmt = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 4 });

function displayValue(value) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "number") return fmt.format(value);
  return value;
}

function renderRows(rows) {
  const tbody = document.querySelector("#latest-table tbody");
  tbody.innerHTML = "";
  const visible = rows.filter((row) => !row.error && row.pair);
  if (!visible.length) {
    tbody.innerHTML = '<tr><td colspan="8">表示できるデータがありません。</td></tr>';
    return;
  }
  for (const row of visible) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.broker}</td>
      <td>${row.pair}</td>
      <td>${row.side === "buy" ? "買" : "売"}</td>
      <td>${displayValue(row.swap_points)}</td>
      <td>${displayValue(row.days)}</td>
      <td>${displayValue(row.unit)}</td>
      <td>${displayValue(row.normalized_swap_per_10k_per_day)}</td>
      <td><a href="${row.source_url}" target="_blank" rel="noopener">公式</a></td>
    `;
    tbody.appendChild(tr);
  }
}

function renderPairRanking(rows) {
  const container = document.getElementById("pair-ranking");
  container.innerHTML = "";
  const buyRows = rows.filter((row) => row.side === "buy" && row.pair && !row.error);
  for (const pair of PAIRS) {
    const ranked = buyRows
      .filter((row) => row.pair === pair)
      .sort((a, b) => (b.normalized_swap_per_10k_per_day ?? -Infinity) - (a.normalized_swap_per_10k_per_day ?? -Infinity));
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `<h3>${pair}</h3>` + (ranked.length
      ? `<ol>${ranked.slice(0, 5).map((row) => `<li>${row.broker}: ${displayValue(row.normalized_swap_per_10k_per_day)}</li>`).join("")}</ol>`
      : "<p>データなし</p>");
    container.appendChild(card);
  }
}

function fallbackGroup(rows) {
  const grouped = new Map();
  for (const row of rows.filter((item) => item.pair && !item.error)) {
    if (!grouped.has(row.broker)) grouped.set(row.broker, []);
    grouped.get(row.broker).push(row);
  }
  return grouped;
}

function renderBrokerList(rows) {
  const container = document.getElementById("broker-list");
  container.innerHTML = "";
  const grouped = Map.groupBy ? Map.groupBy(rows.filter((row) => row.pair && !row.error), (row) => row.broker) : fallbackGroup(rows);
  for (const [broker, brokerRows] of grouped.entries()) {
    const pairs = [...new Set(brokerRows.map((row) => row.pair))].sort();
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `<h3>${broker}</h3><p>${brokerRows.length}件 / ${pairs.length}通貨ペア</p><ul>${pairs.map((pair) => `<li>${pair}</li>`).join("")}</ul>`;
    container.appendChild(card);
  }
  if (!container.children.length) container.innerHTML = '<p>データなし</p>';
}

function renderErrors(errors) {
  const panel = document.getElementById("errors-panel");
  const list = document.getElementById("errors");
  list.innerHTML = "";
  if (!errors?.length) {
    panel.classList.add("hidden");
    return;
  }
  panel.classList.remove("hidden");
  for (const error of errors) {
    const li = document.createElement("li");
    li.textContent = `${error.broker}: ${error.message}`;
    list.appendChild(li);
  }
}

function applySearch() {
  const query = document.getElementById("search").value.trim().toLowerCase();
  const filtered = latestRows.filter((row) => `${row.broker} ${row.pair}`.toLowerCase().includes(query));
  renderRows(filtered);
}

function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ""; }
    else if (ch === '\n') { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell.replace(/\r$/, "")); rows.push(row); }
  const headers = rows.shift() || [];
  const numeric = new Set(["swap_points", "days", "unit", "normalized_swap_per_10k", "normalized_swap_per_10k_per_day"]);
  return rows.filter((r) => r.some(Boolean)).map((r) => Object.fromEntries(headers.map((h, i) => {
    const value = r[i] ?? "";
    return [h, numeric.has(h) && value !== "" ? Number(value) : value];
  })));
}

async function loadPayload() {
  try {
    const response = await fetch("data/latest.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    return JSON.parse(text.replace(/\bNaN\b/g, "null"));
  } catch (_) {
    const response = await fetch("data/latest.csv", { cache: "no-store" });
    if (!response.ok) throw new Error(`CSV HTTP ${response.status}`);
    const rows = parseCsv(await response.text());
    const capturedAt = rows.find((row) => row.captured_at)?.captured_at || null;
    const errors = rows.filter((row) => row.error).map((row) => ({ broker: row.broker, message: row.error }));
    return { captured_at: capturedAt, data: rows, errors, downloads: { history_csv: "data/latest.csv", daily_csv: "data/latest.csv" } };
  }
}

async function main() {
  try {
    const payload = await loadPayload();
    latestRows = payload.data || [];
    document.getElementById("last-updated").textContent = payload.captured_at || "未収集";
    document.getElementById("history-link").href = (payload.downloads?.history_csv || "data/latest.csv").replace(/^\.\.\//, "");
    if (payload.downloads?.daily_csv) {
      const daily = document.getElementById("daily-link");
      daily.href = payload.downloads.daily_csv.replace(/^\.\.\//, "");
      daily.removeAttribute("aria-disabled");
    }
    renderRows(latestRows);
    renderPairRanking(latestRows);
    renderBrokerList(latestRows);
    renderErrors(payload.errors || []);
  } catch (error) {
    document.getElementById("last-updated").textContent = "読み込み失敗";
    renderErrors([{ broker: "site", message: error.message }]);
  }
}

document.getElementById("search").addEventListener("input", applySearch);
main();
