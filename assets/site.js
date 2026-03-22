import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/+esm";

const config = window.SITE_CONFIG ?? {};
const state = {
  supabase: null,
  session: null,
  rows: [],
  assets: [],
  requests: []
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function isConfigured() {
  return (
    config.supabaseUrl &&
    config.supabaseAnonKey &&
    !String(config.supabaseUrl).includes("YOUR-PROJECT") &&
    !String(config.supabaseAnonKey).includes("YOUR_SUPABASE_ANON_KEY")
  );
}

function getSupabase() {
  if (!isConfigured()) return null;
  if (!state.supabase) {
    state.supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
  }
  return state.supabase;
}

function setStatus(target, kind, message) {
  if (!target) return;
  target.dataset.state = kind;
  target.textContent = message;
}

function escapeCsv(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function toCsv(rows) {
  const header = [
    "id",
    "created_at",
    "full_name",
    "affiliation",
    "email",
    "phone",
    "attendance_type",
    "dietary_restrictions",
    "message",
    "consent"
  ];
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.id,
        row.created_at,
        row.full_name,
        row.affiliation,
        row.email,
        row.phone,
        row.attendance_type,
        row.dietary_restrictions,
        row.message,
        row.consent
      ].map(escapeCsv).join(",")
    );
  }
  return lines.join("\n");
}

function downloadText(filename, text, type = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function adminEmailAllowed(email) {
  const allowlist = (config.adminEmails ?? []).map((item) => String(item).toLowerCase());
  return allowlist.includes(String(email).toLowerCase());
}

function renderConfigBanner() {
  const banner = $("#config-banner");
  if (!banner) return;
  if (isConfigured()) return;
  banner.hidden = false;
  banner.innerHTML = `
    <strong>設定が未完了です。</strong>
    <div class="muted" style="margin-top:8px;">
      <code>assets/config.js</code> の Supabase URL / anon key / 管理者メールを実値に置き換えてください。
    </div>
  `;
}

function wireCommonUi() {
  $$("[data-year]").forEach((node) => {
    node.textContent = String(new Date().getFullYear());
  });

  const currentPage = document.body.dataset.page;
  $$("[data-nav]").forEach((link) => {
    if (link.dataset.nav === currentPage) link.setAttribute("aria-current", "page");
  });

  const eventName = config.eventName || "イベントサイト";
  $$("[data-event-name]").forEach((node) => {
    node.textContent = eventName;
  });
  $$("[data-event-date]").forEach((node) => {
    node.textContent = config.eventDateLabel || "開催予定";
  });
  $$("[data-event-venue]").forEach((node) => {
    node.textContent = config.venueName || "会場調整中";
  });
  $$("[data-contact-email]").forEach((node) => {
    node.textContent = config.contactEmail || "robotics30th@example.ac.jp";
  });
  $$("[data-contact-email-link]").forEach((link) => {
    link.href = `mailto:${config.contactEmail || "robotics30th@example.ac.jp"}`;
  });

  renderConfigBanner();
}

function initHomePage() {
  const facts = [
    "参加登録ページで事前登録を受け付けます。",
    "登録情報は Supabase に保存し、管理画面でのみ確認できるようにします。",
    "寄付は立命館大学の公式寄付ページへご案内します。"
  ];
  const list = $("#home-facts");
  if (list) {
    list.innerHTML = "";
    for (const fact of facts) {
      const li = document.createElement("li");
      li.textContent = fact;
      list.appendChild(li);
    }
  }
}

async function initRegisterPage() {
  const form = $("#registration-form");
  if (!form) return;

  const status = $("#registration-status");
  const submitButton = $("#registration-submit");
  const supabase = getSupabase();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!supabase) {
      setStatus(status, "error", "Supabase の設定が未完了です。assets/config.js を編集してください。");
      status.classList.remove("hidden");
      return;
    }

    const payload = Object.fromEntries(new FormData(form).entries());
    const clean = {
      full_name: String(payload.full_name || "").trim(),
      affiliation: String(payload.affiliation || "").trim(),
      email: String(payload.email || "").trim(),
      phone: String(payload.phone || "").trim(),
      attendance_type: String(payload.attendance_type || "").trim(),
      dietary_restrictions: String(payload.dietary_restrictions || "").trim(),
      message: String(payload.message || "").trim(),
      consent: payload.consent === "on"
    };

    if (!clean.full_name || !clean.email || !clean.attendance_type) {
      setStatus(status, "error", "必須項目を入力してください。");
      status.classList.remove("hidden");
      return;
    }
    if (!clean.consent) {
      setStatus(status, "error", "個人情報の取り扱いに同意してください。");
      status.classList.remove("hidden");
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "送信中...";

    const { error } = await supabase.from("registrations").insert([clean]);
    submitButton.disabled = false;
    submitButton.textContent = "参加登録を送信";

    if (error) {
      setStatus(status, "error", `送信できませんでした。${error.message}`);
      status.classList.remove("hidden");
      return;
    }

    form.reset();
    setStatus(status, "success", "参加登録を受け付けました。確認メールは未送信のため、必要に応じて運営側から個別連絡します。");
    status.classList.remove("hidden");
  });
}

function renderAdminStats(rows) {
  const total = $("#stat-total");
  const online = $("#stat-online");
  const inPerson = $("#stat-inperson");
  const other = $("#stat-other");
  const submittedToday = $("#stat-today");
  const today = new Date().toISOString().slice(0, 10);
  const sameDay = rows.filter((row) => String(row.created_at || "").startsWith(today)).length;
  const onlineCount = rows.filter((row) => row.attendance_type === "オンライン").length;
  const inPersonCount = rows.filter((row) => row.attendance_type === "会場参加").length;
  const otherCount = rows.length - onlineCount - inPersonCount;

  if (total) total.textContent = String(rows.length);
  if (online) online.textContent = String(onlineCount);
  if (inPerson) inPerson.textContent = String(inPersonCount);
  if (other) other.textContent = String(Math.max(otherCount, 0));
  if (submittedToday) submittedToday.textContent = String(sameDay);
}

function renderAdminTable(rows) {
  const tbody = $("#registration-table-body");
  const empty = $("#table-empty");
  if (!tbody) return;

  tbody.innerHTML = "";
  if (!rows.length) {
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  for (const row of rows) {
    const tr = document.createElement("tr");
    const values = [
      row.created_at ? new Date(row.created_at).toLocaleString("ja-JP") : "-",
      row.full_name || "-",
      row.affiliation || "-",
      row.email || "-",
      row.phone || "-",
      row.attendance_type || "-",
      row.dietary_restrictions || "-",
      row.message || "-",
      row.consent ? "Yes" : "No"
    ];
    for (const value of values) {
      const td = document.createElement("td");
      td.textContent = value;
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
}

async function loadRegistrations() {
  const supabase = getSupabase();
  if (!supabase) return;

  const filterText = String($("#admin-filter")?.value || "").trim().toLowerCase();
  const { data, error } = await supabase.from("registrations").select("*").order("created_at", { ascending: false });

  if (error) {
    const banner = $("#admin-status");
    setStatus(banner, "error", `読み込みに失敗しました。${error.message}`);
    banner.classList.remove("hidden");
    return;
  }

  state.rows = data ?? [];
  const filtered = !filterText
    ? state.rows
    : state.rows.filter((row) => {
        const haystack = [
          row.full_name,
          row.affiliation,
          row.email,
          row.phone,
          row.attendance_type,
          row.dietary_restrictions,
          row.message
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(filterText);
      });

  renderAdminStats(filtered);
  renderAdminTable(filtered);
}

async function initAdminPage() {
  const supabase = getSupabase();
  if (!supabase) return;

  const loginCard = $("#admin-login-card");
  const panel = $("#admin-panel");
  const signOutButton = $("#sign-out");
  const reloadButton = $("#reload-registrations");
  const exportButton = $("#export-csv");
  const status = $("#admin-status");
  const form = $("#admin-login-form");
  const filterInput = $("#admin-filter");

  async function showAuthorizedView() {
    const { data } = await supabase.auth.getSession();
    state.session = data.session;
    const email = data.session?.user?.email || "";
    if (!data.session) {
      loginCard.hidden = false;
      panel.hidden = true;
      return;
    }
    if (!adminEmailAllowed(email)) {
      await supabase.auth.signOut();
      setStatus(status, "error", "このアカウントは管理者権限に含まれていません。");
      status.classList.remove("hidden");
      loginCard.hidden = false;
      panel.hidden = true;
      return;
    }
    loginCard.hidden = true;
    panel.hidden = false;
    await loadRegistrations();
  }

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = String($("#admin-email")?.value || "").trim();
    const password = String($("#admin-password")?.value || "").trim();

    if (!email || !password) {
      setStatus(status, "error", "メールアドレスとパスワードを入力してください。");
      status.classList.remove("hidden");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setStatus(status, "error", `ログインできませんでした。${error.message}`);
      status.classList.remove("hidden");
      return;
    }

    setStatus(status, "success", "ログインしました。");
    status.classList.remove("hidden");
    await showAuthorizedView();
  });

  signOutButton?.addEventListener("click", async () => {
    await supabase.auth.signOut();
    state.session = null;
    loginCard.hidden = false;
    panel.hidden = true;
    setStatus(status, "success", "サインアウトしました。");
    status.classList.remove("hidden");
  });

  reloadButton?.addEventListener("click", async () => {
    await loadRegistrations();
  });

  exportButton?.addEventListener("click", () => {
    downloadText(
      `robotics30th-registrations-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(state.rows),
      "text/csv;charset=utf-8"
    );
  });

  filterInput?.addEventListener("input", () => {
    const filterText = String(filterInput.value || "").trim().toLowerCase();
    const filtered = !filterText
      ? state.rows
      : state.rows.filter((row) => {
          const haystack = [
            row.full_name,
            row.affiliation,
            row.email,
            row.phone,
            row.attendance_type,
            row.dietary_restrictions,
            row.message
          ]
            .join(" ")
            .toLowerCase();
          return haystack.includes(filterText);
        });
    renderAdminStats(filtered);
    renderAdminTable(filtered);
  });

  supabase.auth.onAuthStateChange(async () => {
    await showAuthorizedView();
  });

  await showAuthorizedView();
}

function normalizeFolderPath(value) {
  return String(value ?? "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let unitIndex = 0;
  let size = value;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function renderAssetTree(items) {
  const root = $("#asset-tree");
  const empty = $("#asset-empty");
  if (!root) return;

  root.innerHTML = "";
  if (!items.length) {
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  const groups = new Map();
  for (const item of items) {
    const key = item.folder_path || "";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }

  const sortedFolders = [...groups.keys()].sort((a, b) => a.localeCompare(b, "ja"));
  for (const folder of sortedFolders) {
    const card = document.createElement("section");
    card.className = "note";
    const heading = document.createElement("h3");
    heading.textContent = folder || "ルート";
    card.appendChild(heading);

    const list = document.createElement("ul");
    list.style.margin = "0";
    list.style.paddingLeft = "18px";
    const children = groups.get(folder).sort((a, b) => a.file_name.localeCompare(b.file_name, "ja"));
    for (const item of children) {
      const li = document.createElement("li");
      li.textContent = `${item.file_name} (${formatBytes(item.size_bytes)})`;
      list.appendChild(li);
    }
    card.appendChild(list);
    root.appendChild(card);
  }
}

function renderRequestLog(items) {
  const tbody = $("#request-log-body");
  const empty = $("#request-empty");
  if (!tbody) return;

  tbody.innerHTML = "";
  if (!items.length) {
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  for (const item of items) {
    const tr = document.createElement("tr");
    const cols = [
      item.created_at ? new Date(item.created_at).toLocaleString("ja-JP") : "-",
      item.page_name || "-",
      item.request_title || "-",
      item.request_body || "-",
      item.requested_by || "-",
      item.status || "-"
    ];
    for (const value of cols) {
      const td = document.createElement("td");
      td.textContent = value;
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
}

async function initUpdatePage() {
  const supabase = getSupabase();
  if (!supabase) return;

  const loginCard = $("#update-login-card");
  const panel = $("#update-panel");
  const status = $("#update-status");
  const form = $("#update-login-form");
  const uploadForm = $("#asset-upload-form");
  const requestForm = $("#change-request-form");
  const reloadAssets = $("#reload-assets");
  const reloadRequests = $("#reload-requests");
  const signOutButton = $("#update-sign-out");
  const assetFilter = $("#asset-filter");
  const requestFilter = $("#request-filter");
  const assetBucket = config.storageBucket || "ritsrobo-assets";
  const requestTable = config.requestLogTable || "page_change_requests";
  const assetIndexTable = config.assetIndexTable || "uploaded_assets";

  async function loadAssets() {
    const { data, error } = await supabase
      .from(assetIndexTable)
      .select("*")
      .order("folder_path", { ascending: true })
      .order("file_name", { ascending: true });

    if (error) {
      setStatus(status, "error", `ファイル一覧の取得に失敗しました。${error.message}`);
      status.classList.remove("hidden");
      return [];
    }

    const filterText = String(assetFilter?.value || "").trim().toLowerCase();
    const filtered = !filterText
      ? data ?? []
      : (data ?? []).filter((item) => {
          const haystack = [item.path, item.folder_path, item.file_name].join(" ").toLowerCase();
          return haystack.includes(filterText);
        });

    state.assets = filtered;
    renderAssetTree(filtered);
    return filtered;
  }

  async function loadRequests() {
    const { data, error } = await supabase
      .from(requestTable)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setStatus(status, "error", `リクエスト一覧の取得に失敗しました。${error.message}`);
      status.classList.remove("hidden");
      return [];
    }

    const filterText = String(requestFilter?.value || "").trim().toLowerCase();
    const filtered = !filterText
      ? data ?? []
      : (data ?? []).filter((item) => {
          const haystack = [item.page_name, item.request_title, item.request_body, item.requested_by, item.status]
            .join(" ")
            .toLowerCase();
          return haystack.includes(filterText);
        });

    state.requests = filtered;
    renderRequestLog(filtered);
    return filtered;
  }

  async function ensureAdmin() {
    const { data } = await supabase.auth.getSession();
    state.session = data.session;
    const email = data.session?.user?.email || "";
    if (!data.session) {
      loginCard.hidden = false;
      panel.hidden = true;
      return false;
    }
    if (!adminEmailAllowed(email)) {
      await supabase.auth.signOut();
      setStatus(status, "error", "このアカウントは更新権限に含まれていません。");
      status.classList.remove("hidden");
      loginCard.hidden = false;
      panel.hidden = true;
      return false;
    }
    loginCard.hidden = true;
    panel.hidden = false;
    return true;
  }

  async function refreshAll() {
    await loadAssets();
    await loadRequests();
  }

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = String($("#update-email")?.value || "").trim();
    const password = String($("#update-password")?.value || "").trim();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setStatus(status, "error", `ログインできませんでした。${error.message}`);
      status.classList.remove("hidden");
      return;
    }
    setStatus(status, "success", "更新ページへ入室しました。");
    status.classList.remove("hidden");
    if (await ensureAdmin()) {
      await refreshAll();
    }
  });

  uploadForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const fileInput = $("#asset-file");
    const folderInput = $("#asset-folder");
    const file = fileInput?.files?.[0];
    if (!file) {
      setStatus(status, "error", "アップロードするファイルを選んでください。");
      status.classList.remove("hidden");
      return;
    }

    const folderPath = normalizeFolderPath(folderInput?.value || "");
    const targetPath = folderPath ? `${folderPath}/${file.name}` : file.name;
    const { error: uploadError } = await supabase.storage.from(assetBucket).upload(targetPath, file, {
      upsert: true,
      contentType: file.type || "application/octet-stream"
    });

    if (uploadError) {
      setStatus(status, "error", `アップロードに失敗しました。${uploadError.message}`);
      status.classList.remove("hidden");
      return;
    }

    const { error: indexError } = await supabase.from(assetIndexTable).upsert([
      {
        path: targetPath,
        folder_path: folderPath,
        file_name: file.name,
        mime_type: file.type || null,
        size_bytes: file.size,
        uploaded_by: state.session?.user?.email || null
      }
    ]);

    if (indexError) {
      setStatus(status, "error", `インデックス保存に失敗しました。${indexError.message}`);
      status.classList.remove("hidden");
      return;
    }

    uploadForm.reset();
    setStatus(status, "success", `アップロードしました。${targetPath}`);
    status.classList.remove("hidden");
    await loadAssets();
  });

  requestForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const pageName = String($("#request-page")?.value || "").trim();
    const title = String($("#request-title")?.value || "").trim();
    const body = String($("#request-body")?.value || "").trim();
    const requester = String($("#requester")?.value || "").trim();
    const statusValue = String($("#request-status")?.value || "open").trim();

    if (!title || !body) {
      setStatus(status, "error", "修正リクエストのタイトルと本文は必須です。");
      status.classList.remove("hidden");
      return;
    }

    const { error } = await supabase.from(requestTable).insert([
      {
        page_name: pageName || "index",
        request_title: title,
        request_body: body,
        requested_by: requester || state.session?.user?.email || null,
        status: statusValue
      }
    ]);

    if (error) {
      setStatus(status, "error", `リクエストの保存に失敗しました。${error.message}`);
      status.classList.remove("hidden");
      return;
    }

    requestForm.reset();
    setStatus(status, "success", "修正リクエストを保存しました。");
    status.classList.remove("hidden");
    await loadRequests();
  });

  reloadAssets?.addEventListener("click", async () => {
    await loadAssets();
  });

  reloadRequests?.addEventListener("click", async () => {
    await loadRequests();
  });

  signOutButton?.addEventListener("click", async () => {
    await supabase.auth.signOut();
    state.session = null;
    loginCard.hidden = false;
    panel.hidden = true;
  });

  assetFilter?.addEventListener("input", async () => {
    await loadAssets();
  });

  requestFilter?.addEventListener("input", async () => {
    await loadRequests();
  });

  supabase.auth.onAuthStateChange(async () => {
    if (await ensureAdmin()) {
      await refreshAll();
    }
  });

  if (await ensureAdmin()) {
    await refreshAll();
  }
}

function wireDonationLink() {
  $$("[data-donation-url]").forEach((link) => {
    link.href = config.donationUrl || "https://www.ritsumei.ac.jp/giving/125th/";
  });
}

wireCommonUi();
wireDonationLink();

const page = document.body.dataset.page;
if (page === "home") initHomePage();
if (page === "register") initRegisterPage();
if (page === "admin") initAdminPage();
if (page === "update") initUpdatePage();
