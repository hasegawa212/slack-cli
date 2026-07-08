/* キーエンス管理システム — フロントエンド専用アプリ
 * データはブラウザの localStorage に保存されます（サーバー不要）。
 */
(function () {
  "use strict";

  const STORAGE_KEY = "keyence_mgmt_v1";
  const yen = (n) => "¥" + Number(n || 0).toLocaleString("ja-JP");
  const uid = () => "id_" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  const todayStr = () => new Date().toISOString().slice(0, 10);
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );

  /* ---------- データ層 ---------- */
  const defaultData = () => ({
    products: [
      { id: uid(), code: "FS-N40", name: "デジタルファイバセンサ", category: "センサ", stock: 42, reorder: 20, price: 18000 },
      { id: uid(), code: "IV3-500CA", name: "AI搭載画像判別センサ", category: "画像処理", stock: 8, reorder: 10, price: 120000 },
      { id: uid(), code: "GT2-71MCN", name: "接触式デジタルセンサ", category: "測定器", stock: 0, reorder: 5, price: 45000 },
      { id: uid(), code: "SR-X300", name: "1次元/2次元コードリーダ", category: "コードリーダ", stock: 25, reorder: 15, price: 98000 },
    ],
    customers: [
      { id: uid(), name: "山田製作所", contact: "山田 太郎", phone: "06-1234-5678", email: "yamada@example.co.jp" },
      { id: uid(), name: "東西エレクトロニクス", contact: "佐藤 花子", phone: "03-9876-5432", email: "sato@example.co.jp" },
    ],
    deals: [],
    employees: [
      { id: uid(), empno: "K-1001", name: "鈴木 一郎", dept: "営業部", role: "主任" },
      { id: uid(), empno: "K-1002", name: "田中 二郎", dept: "技術部", role: "エンジニア" },
    ],
    attendance: [],
  });

  let data = load();
  save(); // 初回起動時はシードを、以降は読み込んだデータを永続化（冪等）

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { console.warn("load failed", e); }
    const seed = defaultData();
    // 初期案件をシード（顧客ID参照のため後付け）
    seed.deals = [
      { id: uid(), title: "画像センサ導入案件", customerId: seed.customers[0].id, amount: 480000, status: "negotiation", nextDate: "" },
      { id: uid(), title: "検査ライン更新", customerId: seed.customers[1].id, amount: 1200000, status: "quote", nextDate: "" },
    ];
    return seed;
  }

  function save(d) {
    data = d || data;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  /* ---------- 共通UI ---------- */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (t.hidden = true), 2200);
  }

  /* タブ切替 */
  $$("#tabs .tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $$("#tabs .tab").forEach((t) => t.classList.remove("active"));
      $$(".view").forEach((v) => v.classList.remove("active"));
      tab.classList.add("active");
      $("#view-" + tab.dataset.view).classList.add("active");
      renderAll();
    });
  });

  /* ---------- モーダル ---------- */
  const modal = {
    backdrop: $("#modalBackdrop"),
    form: $("#modalForm"),
    title: $("#modalTitle"),
    onSave: null,
    open(title, fields, values, onSave) {
      this.title.textContent = title;
      this.form.innerHTML = fields.map((f) => fieldHTML(f, values[f.name])).join("");
      this.onSave = onSave;
      this.backdrop.hidden = false;
      const first = this.form.querySelector("input, select, textarea");
      if (first) first.focus();
    },
    close() {
      this.backdrop.hidden = true;
      this.form.innerHTML = "";
      this.onSave = null;
    },
    collect() {
      const out = {};
      $$("[name]", this.form).forEach((el) => {
        out[el.name] = el.type === "number" ? (el.value === "" ? "" : Number(el.value)) : el.value.trim();
      });
      return out;
    },
  };

  function fieldHTML(f, val) {
    val = val == null ? (f.default != null ? f.default : "") : val;
    const req = f.required ? "required" : "";
    if (f.type === "select") {
      const opts = f.options
        .map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(val) ? "selected" : ""}>${esc(o.label)}</option>`)
        .join("");
      return `<div class="field"><label>${esc(f.label)}</label><select name="${f.name}" ${req}>${opts}</select></div>`;
    }
    const type = f.type || "text";
    const step = type === "number" ? 'step="any"' : "";
    return `<div class="field"><label>${esc(f.label)}</label><input type="${type}" name="${f.name}" value="${esc(val)}" ${step} ${req} placeholder="${esc(f.placeholder || "")}" /></div>`;
  }

  $("#modalClose").addEventListener("click", () => modal.close());
  $("#modalCancel").addEventListener("click", () => modal.close());
  modal.backdrop.addEventListener("click", (e) => { if (e.target === modal.backdrop) modal.close(); });
  modal.form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (modal.onSave) {
      const ok = modal.onSave(modal.collect());
      if (ok !== false) modal.close();
    }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.backdrop.hidden) modal.close(); });

  function confirmDelete(label, fn) {
    if (window.confirm(`「${label}」を削除します。よろしいですか？`)) { fn(); }
  }

  /* ================= 在庫・製品 ================= */
  function stockStatus(p) {
    if (p.stock <= 0) return { cls: "out", label: "欠品" };
    if (p.stock <= p.reorder) return { cls: "low", label: "要発注" };
    return { cls: "ok", label: "適正" };
  }

  function renderInventory() {
    const q = ($("#inventorySearch").value || "").toLowerCase();
    const rows = data.products
      .filter((p) => !q || p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q))
      .map((p) => {
        const st = stockStatus(p);
        return `<tr>
          <td>${esc(p.code)}</td><td>${esc(p.name)}</td><td>${esc(p.category)}</td>
          <td class="num">${p.stock.toLocaleString()}</td>
          <td class="num">${p.reorder.toLocaleString()}</td>
          <td class="num">${yen(p.price)}</td>
          <td class="num">${yen(p.stock * p.price)}</td>
          <td><span class="badge ${st.cls}">${st.label}</span></td>
          <td class="actions-col"><span class="row-actions">
            <button class="btn tiny" data-act="in" data-id="${p.id}">入庫</button>
            <button class="btn tiny" data-act="out" data-id="${p.id}">出庫</button>
            <button class="btn tiny" data-act="edit" data-id="${p.id}">編集</button>
            <button class="btn tiny danger" data-act="del" data-id="${p.id}">削除</button>
          </span></td>
        </tr>`;
      })
      .join("");
    $("#inventoryTable tbody").innerHTML = rows || `<tr><td colspan="9" class="empty">製品がありません</td></tr>`;
  }

  const productFields = [
    { name: "code", label: "型番", required: true, placeholder: "例: FS-N40" },
    { name: "name", label: "製品名", required: true },
    { name: "category", label: "カテゴリ", placeholder: "センサ / 画像処理 など" },
    { name: "stock", label: "在庫数", type: "number", default: 0, required: true },
    { name: "reorder", label: "発注点", type: "number", default: 0, required: true },
    { name: "price", label: "単価(円)", type: "number", default: 0, required: true },
  ];

  function openProductModal(id) {
    const p = id ? data.products.find((x) => x.id === id) : {};
    modal.open(id ? "製品を編集" : "製品を追加", productFields, p, (v) => {
      if (!v.code || !v.name) { toast("型番と製品名は必須です"); return false; }
      if (id) Object.assign(p, v);
      else data.products.push(Object.assign({ id: uid() }, v));
      save(); renderAll(); toast(id ? "製品を更新しました" : "製品を追加しました");
    });
  }

  $("#btnAddProduct").addEventListener("click", () => openProductModal());
  $("#inventorySearch").addEventListener("input", renderInventory);
  $("#inventoryTable").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-act]"); if (!btn) return;
    const id = btn.dataset.id, act = btn.dataset.act;
    const p = data.products.find((x) => x.id === id); if (!p) return;
    if (act === "edit") openProductModal(id);
    else if (act === "del") confirmDelete(p.name, () => { data.products = data.products.filter((x) => x.id !== id); save(); renderAll(); toast("削除しました"); });
    else if (act === "in" || act === "out") {
      const n = parseInt(window.prompt(`${act === "in" ? "入庫" : "出庫"}数量を入力`, "1"), 10);
      if (!n || n < 0) return;
      p.stock = Math.max(0, p.stock + (act === "in" ? n : -n));
      save(); renderAll(); toast(`${p.code}: ${act === "in" ? "+" : "-"}${n}（在庫 ${p.stock}）`);
    }
  });

  /* ================= 顧客・案件 ================= */
  const DEAL_STATUS = [
    { value: "lead", label: "リード", cls: "s-lead" },
    { value: "negotiation", label: "商談中", cls: "s-negotiation" },
    { value: "quote", label: "見積提出", cls: "s-quote" },
    { value: "won", label: "受注", cls: "s-won" },
    { value: "lost", label: "失注", cls: "s-lost" },
  ];
  const dealStatusMeta = (v) => DEAL_STATUS.find((s) => s.value === v) || DEAL_STATUS[0];
  const customerName = (cid) => (data.customers.find((c) => c.id === cid) || {}).name || "（不明）";

  function renderCustomers() {
    const q = ($("#customerSearch").value || "").toLowerCase();
    const list = data.customers.filter((c) => !q || c.name.toLowerCase().includes(q) || (c.contact || "").toLowerCase().includes(q));
    $("#customerTable tbody").innerHTML =
      list.map((c) => `<tr>
        <td>${esc(c.name)}</td><td>${esc(c.contact)}</td><td>${esc(c.phone)}</td><td>${esc(c.email)}</td>
        <td class="actions-col"><span class="row-actions">
          <button class="btn tiny" data-act="edit" data-id="${c.id}">編集</button>
          <button class="btn tiny danger" data-act="del" data-id="${c.id}">削除</button>
        </span></td></tr>`).join("") || `<tr><td colspan="5" class="empty">顧客がありません</td></tr>`;

    const deals = data.deals.filter((d) => {
      if (!q) return true;
      return d.title.toLowerCase().includes(q) || customerName(d.customerId).toLowerCase().includes(q);
    });
    $("#dealTable tbody").innerHTML =
      deals.map((d) => {
        const m = dealStatusMeta(d.status);
        return `<tr>
          <td>${esc(d.title)}</td><td>${esc(customerName(d.customerId))}</td>
          <td class="num">${yen(d.amount)}</td>
          <td><span class="badge ${m.cls}">${m.label}</span></td>
          <td>${esc(d.nextDate || "—")}</td>
          <td class="actions-col"><span class="row-actions">
            <button class="btn tiny" data-act="edit" data-id="${d.id}">編集</button>
            <button class="btn tiny danger" data-act="del" data-id="${d.id}">削除</button>
          </span></td></tr>`;
      }).join("") || `<tr><td colspan="6" class="empty">案件がありません</td></tr>`;
  }

  const customerFields = [
    { name: "name", label: "顧客名", required: true },
    { name: "contact", label: "担当者名" },
    { name: "phone", label: "電話番号" },
    { name: "email", label: "メールアドレス", type: "email" },
  ];

  function openCustomerModal(id) {
    const c = id ? data.customers.find((x) => x.id === id) : {};
    modal.open(id ? "顧客を編集" : "顧客を追加", customerFields, c, (v) => {
      if (!v.name) { toast("顧客名は必須です"); return false; }
      if (id) Object.assign(c, v);
      else data.customers.push(Object.assign({ id: uid() }, v));
      save(); renderAll(); toast(id ? "顧客を更新しました" : "顧客を追加しました");
    });
  }

  function dealFields() {
    return [
      { name: "title", label: "案件名", required: true },
      { name: "customerId", label: "顧客", type: "select", required: true,
        options: data.customers.map((c) => ({ value: c.id, label: c.name })) },
      { name: "amount", label: "金額(円)", type: "number", default: 0 },
      { name: "status", label: "ステータス", type: "select", options: DEAL_STATUS.map((s) => ({ value: s.value, label: s.label })) },
      { name: "nextDate", label: "次アクション日", type: "date" },
    ];
  }

  function openDealModal(id) {
    if (data.customers.length === 0) { toast("先に顧客を登録してください"); return; }
    const d = id ? data.deals.find((x) => x.id === id) : {};
    modal.open(id ? "案件を編集" : "案件を追加", dealFields(), d, (v) => {
      if (!v.title) { toast("案件名は必須です"); return false; }
      if (id) Object.assign(d, v);
      else data.deals.push(Object.assign({ id: uid() }, v));
      save(); renderAll(); toast(id ? "案件を更新しました" : "案件を追加しました");
    });
  }

  $("#btnAddCustomer").addEventListener("click", () => openCustomerModal());
  $("#btnAddDeal").addEventListener("click", () => openDealModal());
  $("#customerSearch").addEventListener("input", renderCustomers);
  $("#customerTable").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-act]"); if (!btn) return;
    const id = btn.dataset.id, c = data.customers.find((x) => x.id === id); if (!c) return;
    if (btn.dataset.act === "edit") openCustomerModal(id);
    else confirmDelete(c.name, () => {
      data.customers = data.customers.filter((x) => x.id !== id);
      data.deals = data.deals.filter((x) => x.customerId !== id);
      save(); renderAll(); toast("削除しました");
    });
  });
  $("#dealTable").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-act]"); if (!btn) return;
    const id = btn.dataset.id, d = data.deals.find((x) => x.id === id); if (!d) return;
    if (btn.dataset.act === "edit") openDealModal(id);
    else confirmDelete(d.title, () => { data.deals = data.deals.filter((x) => x.id !== id); save(); renderAll(); toast("削除しました"); });
  });

  /* ================= 従業員・勤怠 ================= */
  function calcHours(rec) {
    if (!rec.in || !rec.out) return null;
    const [ih, im] = rec.in.split(":").map(Number);
    const [oh, om] = rec.out.split(":").map(Number);
    let mins = oh * 60 + om - (ih * 60 + im);
    if (mins < 0) mins += 24 * 60;
    return Math.round((mins / 60) * 10) / 10;
  }

  function todayRecordFor(empId) {
    return data.attendance.find((a) => a.empId === empId && a.date === todayStr());
  }

  function renderEmployees() {
    const q = ($("#employeeSearch").value || "").toLowerCase();
    const list = data.employees.filter((e) => !q || e.name.toLowerCase().includes(q) || (e.dept || "").toLowerCase().includes(q));
    $("#employeeTable tbody").innerHTML =
      list.map((e) => {
        const rec = todayRecordFor(e.id);
        let stateBadge = '<span class="badge off">未出勤</span>';
        let action = `<button class="btn tiny" data-act="clockin" data-id="${e.id}">出勤</button>`;
        if (rec && rec.in && !rec.out) {
          stateBadge = '<span class="badge working">勤務中</span>';
          action = `<button class="btn tiny" data-act="clockout" data-id="${e.id}">退勤</button>`;
        } else if (rec && rec.in && rec.out) {
          stateBadge = '<span class="badge in">退勤済</span>';
          action = `<span class="mi-sub">${rec.in}–${rec.out}</span>`;
        }
        return `<tr>
          <td>${esc(e.empno)}</td><td>${esc(e.name)}</td><td>${esc(e.dept)}</td><td>${esc(e.role)}</td>
          <td>${stateBadge}</td>
          <td class="actions-col"><span class="row-actions">
            ${action}
            <button class="btn tiny" data-act="edit" data-id="${e.id}">編集</button>
            <button class="btn tiny danger" data-act="del" data-id="${e.id}">削除</button>
          </span></td></tr>`;
      }).join("") || `<tr><td colspan="6" class="empty">従業員がありません</td></tr>`;

    renderAttendance();
  }

  function empName(id) { return (data.employees.find((e) => e.id === id) || {}).name || "（不明）"; }

  function renderAttendance() {
    const filter = $("#attendanceDate").value;
    const list = data.attendance
      .filter((a) => !filter || a.date === filter)
      .slice()
      .sort((a, b) => (b.date + (b.in || "")).localeCompare(a.date + (a.in || "")));
    $("#attendanceTable tbody").innerHTML =
      list.map((a) => {
        const h = calcHours(a);
        return `<tr>
          <td>${esc(a.date)}</td><td>${esc(empName(a.empId))}</td>
          <td>${esc(a.in || "—")}</td><td>${esc(a.out || "—")}</td>
          <td class="num">${h == null ? "—" : h.toFixed(1)}</td>
          <td class="actions-col"><span class="row-actions">
            <button class="btn tiny" data-act="editrec" data-id="${a.id}">編集</button>
            <button class="btn tiny danger" data-act="delrec" data-id="${a.id}">削除</button>
          </span></td></tr>`;
      }).join("") || `<tr><td colspan="6" class="empty">記録がありません</td></tr>`;
  }

  const employeeFields = [
    { name: "empno", label: "社員番号", required: true, placeholder: "例: K-1001" },
    { name: "name", label: "氏名", required: true },
    { name: "dept", label: "部署" },
    { name: "role", label: "役職" },
  ];

  function openEmployeeModal(id) {
    const emp = id ? data.employees.find((x) => x.id === id) : {};
    modal.open(id ? "従業員を編集" : "従業員を追加", employeeFields, emp, (v) => {
      if (!v.empno || !v.name) { toast("社員番号と氏名は必須です"); return false; }
      if (id) Object.assign(emp, v);
      else data.employees.push(Object.assign({ id: uid() }, v));
      save(); renderAll(); toast(id ? "従業員を更新しました" : "従業員を追加しました");
    });
  }

  function nowHM() {
    const d = new Date();
    return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }

  function openRecordModal(id) {
    const rec = data.attendance.find((x) => x.id === id); if (!rec) return;
    modal.open("勤怠記録を編集",
      [
        { name: "date", label: "日付", type: "date", required: true },
        { name: "in", label: "出勤時刻 (HH:MM)", placeholder: "09:00" },
        { name: "out", label: "退勤時刻 (HH:MM)", placeholder: "18:00" },
      ], rec, (v) => {
        Object.assign(rec, v); save(); renderAll(); toast("記録を更新しました");
      });
  }

  $("#btnAddEmployee").addEventListener("click", () => openEmployeeModal());
  $("#employeeSearch").addEventListener("input", renderEmployees);
  $("#attendanceDate").addEventListener("change", renderAttendance);
  $("#btnClearAttendanceFilter").addEventListener("click", () => { $("#attendanceDate").value = ""; renderAttendance(); });

  $("#employeeTable").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-act]"); if (!btn) return;
    const id = btn.dataset.id, act = btn.dataset.act;
    const emp = data.employees.find((x) => x.id === id); if (!emp) return;
    if (act === "edit") openEmployeeModal(id);
    else if (act === "del") confirmDelete(emp.name, () => {
      data.employees = data.employees.filter((x) => x.id !== id);
      data.attendance = data.attendance.filter((x) => x.empId !== id);
      save(); renderAll(); toast("削除しました");
    });
    else if (act === "clockin") {
      let rec = todayRecordFor(id);
      if (rec) { rec.in = rec.in || nowHM(); }
      else data.attendance.push({ id: uid(), empId: id, date: todayStr(), in: nowHM(), out: "" });
      save(); renderAll(); toast(`${emp.name} 出勤打刻 ${nowHM()}`);
    } else if (act === "clockout") {
      const rec = todayRecordFor(id);
      if (rec) { rec.out = nowHM(); save(); renderAll(); toast(`${emp.name} 退勤打刻 ${nowHM()}`); }
    }
  });

  $("#attendanceTable").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-act]"); if (!btn) return;
    const id = btn.dataset.id, rec = data.attendance.find((x) => x.id === id); if (!rec) return;
    if (btn.dataset.act === "editrec") openRecordModal(id);
    else confirmDelete(`${empName(rec.empId)} ${rec.date}`, () => { data.attendance = data.attendance.filter((x) => x.id !== id); save(); renderAll(); toast("削除しました"); });
  });

  /* ================= ダッシュボード ================= */
  function renderDashboard() {
    const totalStockValue = data.products.reduce((s, p) => s + p.stock * p.price, 0);
    const low = data.products.filter((p) => p.stock <= p.reorder);
    const openDeals = data.deals.filter((d) => d.status !== "won" && d.status !== "lost");
    const pipeline = openDeals.reduce((s, d) => s + Number(d.amount || 0), 0);
    const workingNow = data.employees.filter((e) => { const r = todayRecordFor(e.id); return r && r.in && !r.out; }).length;

    $("#kpiCards").innerHTML = [
      { label: "登録製品数", value: data.products.length, sub: "在庫金額 " + yen(totalStockValue) },
      { label: "在庫アラート", value: low.length + " 件", sub: "発注点以下", warn: low.length > 0 },
      { label: "進行中案件", value: openDeals.length + " 件", sub: "見込 " + yen(pipeline) },
      { label: "本日勤務中", value: workingNow + " 名", sub: "従業員 " + data.employees.length + " 名" },
    ].map((k) => `<div class="kpi ${k.warn ? "warn" : ""}">
        <div class="k-label">${k.label}</div>
        <div class="k-value">${k.value}</div>
        <div class="k-sub">${k.sub}</div></div>`).join("");

    $("#lowStockList").innerHTML = low.length
      ? low.map((p) => `<div class="mini-item"><span class="mi-main">${esc(p.code)} ${esc(p.name)}</span>
          <span class="mi-sub">在庫 ${p.stock} / 発注点 ${p.reorder}</span></div>`).join("")
      : `<div class="empty">アラートはありません</div>`;

    $("#openDealsList").innerHTML = openDeals.length
      ? openDeals.slice(0, 6).map((d) => { const m = dealStatusMeta(d.status);
          return `<div class="mini-item"><span class="mi-main">${esc(d.title)}<br><span class="mi-sub">${esc(customerName(d.customerId))}</span></span>
          <span class="mi-sub">${yen(d.amount)} <span class="badge ${m.cls}">${m.label}</span></span></div>`; }).join("")
      : `<div class="empty">進行中の案件はありません</div>`;

    const todays = data.attendance.filter((a) => a.date === todayStr());
    $("#todayAttendance").innerHTML = todays.length
      ? todays.map((a) => `<div class="mini-item"><span class="mi-main">${esc(empName(a.empId))}</span>
          <span class="mi-sub">${a.in || "—"} 〜 ${a.out || "勤務中"}</span></div>`).join("")
      : `<div class="empty">本日の打刻はありません</div>`;
  }

  /* ================= エクスポート / インポート ================= */
  $("#btnExport").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "keyence-data-" + todayStr() + ".json";
    a.click();
    URL.revokeObjectURL(a.href);
    toast("データを書き出しました");
  });
  $("#btnImport").addEventListener("click", () => $("#importFile").click());
  $("#importFile").addEventListener("change", (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const d = JSON.parse(reader.result);
        if (!d || typeof d !== "object") throw new Error("bad");
        data = Object.assign(defaultData(), d);
        // 未定義配列を保険で補完
        ["products", "customers", "deals", "employees", "attendance"].forEach((k) => { if (!Array.isArray(data[k])) data[k] = []; });
        save(); renderAll(); toast("データを読み込みました");
      } catch (err) { toast("読み込みに失敗しました（JSON形式を確認）"); }
      e.target.value = "";
    };
    reader.readAsText(file);
  });

  /* ================= 描画エントリ ================= */
  function renderAll() {
    renderDashboard();
    renderInventory();
    renderCustomers();
    renderEmployees();
  }

  $("#attendanceDate").value = "";
  renderAll();
})();
