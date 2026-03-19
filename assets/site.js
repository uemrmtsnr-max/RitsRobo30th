import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/+esm";

const config = window.SITE_CONFIG ?? {};
const state = {
  supabase: null,
  session: null,
  rows: []
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
