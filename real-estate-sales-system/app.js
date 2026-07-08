/* 不動産販売管理システム — フロントエンド専用アプリ
 * データはブラウザの localStorage に保存されます（サーバー不要）。
 */
(function () {
  "use strict";

  const STORAGE_KEY = "re_sales_mgmt_v1";
  const man = (n) => "¥" + Number(n || 0).toLocaleString("ja-JP"); // 円表記
  const uid = () => "id_" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  const todayStr = () => new Date().toISOString().slice(0, 10);
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );

  /* ---------- マスタ定義 ---------- */
  const PROP_TYPES = ["マンション", "戸建", "土地", "収益物件"];
  const PROP_STATUS = [
    { value: "prep", label: "公開前" },
    { value: "active", label: "販売中" },
    { value: "negotiating", label: "商談中" },
    { value: "sold", label: "成約済" },
  ];
  const propStatusMeta = (v) => PROP_STATUS.find((s) => s.value === v) || PROP_STATUS[1];

  const DEAL_STAGE = [
    { value: "inquiry", label: "問合せ", cls: "s-inquiry" },
    { value: "viewing", label: "内見", cls: "s-viewing" },
    { value: "offer", label: "申込", cls: "s-offer" },
    { value: "contract", label: "契約", cls: "s-contract" },
    { value: "closed", label: "成約", cls: "s-closed" },
    { value: "dropped", label: "見送り", cls: "s-dropped" },
  ];
  const dealStageMeta = (v) => DEAL_STAGE.find((s) => s.value === v) || DEAL_STAGE[0];

  /* ---------- データ層 ---------- */
  const defaultData = () => {
    const a1 = uid(), a2 = uid();
    const p1 = uid(), p2 = uid(), p3 = uid(), p4 = uid();
    const c1 = uid(), c2 = uid(), c3 = uid();
    return {
      agents: [
        { id: a1, code: "S-1001", name: "鈴木 一郎", store: "本店", role: "課長" },
        { id: a2, code: "S-1002", name: "田中 花子", store: "駅前支店", role: "営業" },
      ],
      properties: [
        { id: p1, code: "P-2001", name: "グランドレジデンス品川", type: "マンション", address: "東京都港区港南2-1-1", price: 78000000, layout: "3LDK", area: 72.5, status: "active", agentId: a1, photo: "" },
        { id: p2, code: "P-2002", name: "世田谷 新築戸建", type: "戸建", address: "東京都世田谷区成城6-3-2", price: 96800000, layout: "4LDK", area: 105.2, status: "negotiating", agentId: a2, photo: "" },
        { id: p3, code: "P-2003", name: "横浜みなとみらい 事業用地", type: "土地", address: "神奈川県横浜市西区みなとみらい4", price: 250000000, layout: "—", area: 480, status: "prep", agentId: a1, photo: "" },
        { id: p4, code: "P-2004", name: "目黒アーバンフラット", type: "マンション", address: "東京都目黒区中目黒3-2-1", price: 62000000, layout: "2LDK", area: 55.0, status: "sold", agentId: a2, photo: "" },
      ],
      customers: [
        { id: c1, name: "山田 太郎", phone: "090-1234-5678", email: "yamada@example.com", budget: 80000000, wish: "港区・3LDK以上・駅徒歩10分以内" },
        { id: c2, name: "佐藤 恵子", phone: "080-9876-5432", email: "sato@example.com", budget: 100000000, wish: "戸建・4LDK・世田谷区" },
        { id: c3, name: "高橋 健", phone: "070-1111-2222", email: "takahashi@example.com", budget: 65000000, wish: "目黒区・2LDK・築浅" },
      ],
      deals: [
        { id: uid(), title: "山田様 品川MS", customerId: c1, propertyId: p1, agentId: a1, amount: 76000000, stage: "viewing", nextDate: "", closeDate: "" },
        { id: uid(), title: "佐藤様 世田谷戸建", customerId: c2, propertyId: p2, agentId: a2, amount: 95000000, stage: "offer", nextDate: "", closeDate: "" },
        // 成約済（実績サンプル）
        { id: uid(), title: "高橋様 目黒MS", customerId: c3, propertyId: p4, agentId: a2, amount: 61000000, stage: "closed", nextDate: "", closeDate: "2026-06-18" },
        { id: uid(), title: "旧案件A 中央区MS", customerId: c1, propertyId: "", agentId: a1, amount: 84000000, stage: "closed", nextDate: "", closeDate: "2026-05-09" },
        { id: uid(), title: "旧案件B 川崎戸建", customerId: c2, propertyId: "", agentId: a1, amount: 52000000, stage: "closed", nextDate: "", closeDate: "2026-04-22" },
        { id: uid(), title: "旧案件C 横浜MS", customerId: c3, propertyId: "", agentId: a2, amount: 47000000, stage: "closed", nextDate: "", closeDate: "2026-04-05" },
      ],
      viewings: [],
    };
  };

  let data = load();
  save(); // 初回はシード、以降は読み込んだデータを永続化（冪等）

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { console.warn("load failed", e); }
    return defaultData();
  }

  function save(d) {
    data = d || data;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      // 画像を多数添付した場合など、容量超過に備える
      toast("保存に失敗しました（容量超過の可能性）。画像サイズをご確認ください");
      console.warn("save failed", e);
    }
  }

  /* ---------- 共通UI ---------- */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (t.hidden = true), 2600);
  }

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
      const first = this.form.querySelector("input:not([type=hidden]):not([type=file]), select, textarea");
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
    if (f.type === "textarea") {
      return `<div class="field"><label>${esc(f.label)}</label><textarea name="${f.name}" rows="2" placeholder="${esc(f.placeholder || "")}">${esc(val)}</textarea></div>`;
    }
    if (f.type === "photo") {
      return `<div class="field"><label>${esc(f.label)}</label>
        <input type="hidden" name="${f.name}" value="${esc(val)}" />
        <img class="photo-preview" data-photo-preview="${f.name}" ${val ? `src="${esc(val)}"` : 'style="display:none"'} alt="物件写真プレビュー" />
        <input type="file" accept="image/*" data-photo-for="${f.name}" />
        <button type="button" class="btn tiny danger photo-clear" data-photo-clear="${f.name}" ${val ? "" : 'style="display:none"'}>写真を削除</button>
      </div>`;
    }
    const type = f.type || "text";
    const step = type === "number" ? 'step="any"' : "";
    return `<div class="field"><label>${esc(f.label)}</label><input type="${type}" name="${f.name}" value="${esc(val)}" ${step} ${req} placeholder="${esc(f.placeholder || "")}" /></div>`;
  }

  // 写真: 選択されたら 800px 以内に縮小して data URI に変換（localStorage 容量対策）
  function downscaleImage(file, maxDim, cb) {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        const scale = Math.min(1, maxDim / Math.max(width, height));
        width = Math.round(width * scale);
        height = Math.round(height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        try { cb(canvas.toDataURL("image/jpeg", 0.72)); }
        catch (e) { cb(reader.result); }
      };
      img.onerror = () => cb("");
      img.src = reader.result;
    };
    reader.onerror = () => cb("");
    reader.readAsDataURL(file);
  }

  modal.form.addEventListener("change", (e) => {
    const fileInput = e.target.closest("input[data-photo-for]");
    if (!fileInput) return;
    const name = fileInput.dataset.photoFor;
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    downscaleImage(file, 800, (dataUri) => {
      const hidden = modal.form.querySelector(`input[name="${name}"]`);
      const preview = modal.form.querySelector(`[data-photo-preview="${name}"]`);
      const clearBtn = modal.form.querySelector(`[data-photo-clear="${name}"]`);
      if (hidden) hidden.value = dataUri || "";
      if (preview && dataUri) { preview.src = dataUri; preview.style.display = ""; }
      if (clearBtn && dataUri) clearBtn.style.display = "";
    });
  });
  modal.form.addEventListener("click", (e) => {
    const clearBtn = e.target.closest("button[data-photo-clear]");
    if (!clearBtn) return;
    const name = clearBtn.dataset.photoClear;
    const hidden = modal.form.querySelector(`input[name="${name}"]`);
    const preview = modal.form.querySelector(`[data-photo-preview="${name}"]`);
    const fileInput = modal.form.querySelector(`input[data-photo-for="${name}"]`);
    if (hidden) hidden.value = "";
    if (preview) { preview.src = ""; preview.style.display = "none"; }
    if (fileInput) fileInput.value = "";
    clearBtn.style.display = "none";
  });

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
    if (window.confirm(`「${label}」を削除します。よろしいですか？`)) fn();
  }

  const agentName = (id) => (data.agents.find((a) => a.id === id) || {}).name || "—";
  const customerName = (id) => (data.customers.find((c) => c.id === id) || {}).name || "（不明）";
  const propertyName = (id) => (data.properties.find((p) => p.id === id) || {}).name || "（未設定）";

  /* ---------- CSV 出力 ---------- */
  function downloadCSV(filename, headers, rows) {
    const escCell = (v) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines = [headers.map(escCell).join(",")].concat(rows.map((r) => r.map(escCell).join(",")));
    const csv = "﻿" + lines.join("\r\n"); // BOM付きでExcelの日本語文字化けを防止
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
    toast("CSVを出力しました");
  }

  /* ================= 物件管理 ================= */
  function renderProperties() {
    const q = ($("#propertySearch").value || "").toLowerCase();
    const sf = $("#propStatusFilter").value;
    const rows = data.properties
      .filter((p) => !sf || p.status === sf)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || (p.address || "").toLowerCase().includes(q) || p.code.toLowerCase().includes(q))
      .map((p) => {
        const st = propStatusMeta(p.status);
        const unit = p.area > 0 ? Math.round(p.price / p.area) : 0;
        const thumb = p.photo ? `<img class="prop-thumb" src="${esc(p.photo)}" alt="" />` : "";
        return `<tr>
          <td>${esc(p.code)}</td>
          <td><span class="name-cell">${thumb}${esc(p.name)}</span></td>
          <td>${esc(p.type)}</td>
          <td>${esc(p.address)}</td>
          <td class="num">${man(p.price)}</td>
          <td>${esc(p.layout)}</td>
          <td class="num">${Number(p.area || 0).toLocaleString()}</td>
          <td class="num">${unit ? man(unit) : "—"}</td>
          <td>${esc(agentName(p.agentId))}</td>
          <td><span class="badge ${st.value}">${st.label}</span></td>
          <td class="actions-col"><span class="row-actions">
            <button class="btn tiny" data-act="edit" data-id="${p.id}">編集</button>
            <button class="btn tiny danger" data-act="del" data-id="${p.id}">削除</button>
          </span></td>
        </tr>`;
      })
      .join("");
    $("#propertyTable tbody").innerHTML = rows || `<tr><td colspan="11" class="empty">物件がありません</td></tr>`;
  }

  function propertyFields() {
    return [
      { name: "code", label: "物件番号", required: true, placeholder: "例: P-2001" },
      { name: "name", label: "物件名", required: true },
      { name: "type", label: "種別", type: "select", options: PROP_TYPES.map((t) => ({ value: t, label: t })) },
      { name: "address", label: "所在地" },
      { name: "price", label: "販売価格(円)", type: "number", default: 0, required: true },
      { name: "layout", label: "間取り", placeholder: "例: 3LDK" },
      { name: "area", label: "面積(㎡)", type: "number", default: 0 },
      { name: "status", label: "ステータス", type: "select", options: PROP_STATUS.map((s) => ({ value: s.value, label: s.label })) },
      { name: "agentId", label: "担当営業", type: "select", options: [{ value: "", label: "（未割当）" }].concat(data.agents.map((a) => ({ value: a.id, label: a.name }))) },
      { name: "photo", label: "物件写真", type: "photo" },
    ];
  }

  function openPropertyModal(id) {
    const p = id ? data.properties.find((x) => x.id === id) : {};
    modal.open(id ? "物件を編集" : "物件を登録", propertyFields(), p, (v) => {
      if (!v.code || !v.name) { toast("物件番号と物件名は必須です"); return false; }
      if (id) Object.assign(p, v);
      else data.properties.push(Object.assign({ id: uid() }, v));
      save(); renderAll(); toast(id ? "物件を更新しました" : "物件を登録しました");
    });
  }

  $("#btnAddProperty").addEventListener("click", () => openPropertyModal());
  $("#propertySearch").addEventListener("input", renderProperties);
  $("#propStatusFilter").addEventListener("change", renderProperties);
  $("#btnCsvProperties").addEventListener("click", () => {
    downloadCSV("物件一覧-" + todayStr() + ".csv",
      ["物件番号", "物件名", "種別", "所在地", "販売価格", "間取り", "面積(㎡)", "㎡単価", "担当営業", "ステータス"],
      data.properties.map((p) => [p.code, p.name, p.type, p.address, p.price, p.layout, p.area, p.area > 0 ? Math.round(p.price / p.area) : "", agentName(p.agentId), propStatusMeta(p.status).label]));
  });
  $("#propertyTable").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-act]"); if (!btn) return;
    const id = btn.dataset.id, p = data.properties.find((x) => x.id === id); if (!p) return;
    if (btn.dataset.act === "edit") openPropertyModal(id);
    else confirmDelete(p.name, () => {
      data.properties = data.properties.filter((x) => x.id !== id);
      data.deals.forEach((d) => { if (d.propertyId === id) d.propertyId = ""; });
      data.viewings = data.viewings.filter((x) => x.propertyId !== id);
      save(); renderAll(); toast("削除しました");
    });
  });

  /* ================= 顧客・商談 ================= */
  function renderCustomers() {
    const q = ($("#customerSearch").value || "").toLowerCase();
    const list = data.customers.filter((c) => !q || c.name.toLowerCase().includes(q));
    $("#customerTable tbody").innerHTML =
      list.map((c) => `<tr>
        <td>${esc(c.name)}</td><td>${esc(c.phone)}</td><td>${esc(c.email)}</td>
        <td class="num">${man(c.budget)}</td><td>${esc(c.wish)}</td>
        <td class="actions-col"><span class="row-actions">
          <button class="btn tiny" data-act="edit" data-id="${c.id}">編集</button>
          <button class="btn tiny danger" data-act="del" data-id="${c.id}">削除</button>
        </span></td></tr>`).join("") || `<tr><td colspan="6" class="empty">顧客がありません</td></tr>`;

    const deals = data.deals.filter((d) => {
      if (!q) return true;
      return d.title.toLowerCase().includes(q) || customerName(d.customerId).toLowerCase().includes(q) || propertyName(d.propertyId).toLowerCase().includes(q);
    });
    $("#dealTable tbody").innerHTML =
      deals.map((d) => {
        const m = dealStageMeta(d.stage);
        return `<tr>
          <td>${esc(d.title)}</td><td>${esc(customerName(d.customerId))}</td>
          <td>${esc(propertyName(d.propertyId))}</td>
          <td class="num">${man(d.amount)}</td>
          <td><span class="badge ${m.cls}">${m.label}</span></td>
          <td>${esc(d.nextDate || "—")}</td>
          <td class="actions-col"><span class="row-actions">
            <button class="btn tiny" data-act="edit" data-id="${d.id}">編集</button>
            <button class="btn tiny danger" data-act="del" data-id="${d.id}">削除</button>
          </span></td></tr>`;
      }).join("") || `<tr><td colspan="7" class="empty">商談がありません</td></tr>`;
  }

  const customerFields = [
    { name: "name", label: "顧客名", required: true },
    { name: "phone", label: "電話番号" },
    { name: "email", label: "メールアドレス", type: "email" },
    { name: "budget", label: "ご予算(円)", type: "number", default: 0 },
    { name: "wish", label: "希望条件", type: "textarea", placeholder: "エリア・間取り・駅距離など" },
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
    const propOpts = [{ value: "", label: "（未設定）" }].concat(data.properties.map((p) => ({ value: p.id, label: p.code + " " + p.name })));
    return [
      { name: "title", label: "商談名", required: true, placeholder: "例: 山田様 品川MS" },
      { name: "customerId", label: "顧客", type: "select", required: true, options: data.customers.map((c) => ({ value: c.id, label: c.name })) },
      { name: "propertyId", label: "対象物件", type: "select", options: propOpts },
      { name: "agentId", label: "担当営業", type: "select", options: [{ value: "", label: "（未割当）" }].concat(data.agents.map((a) => ({ value: a.id, label: a.name }))) },
      { name: "amount", label: "想定成約価格(円)", type: "number", default: 0 },
      { name: "stage", label: "商談ステージ", type: "select", options: DEAL_STAGE.map((s) => ({ value: s.value, label: s.label })) },
      { name: "nextDate", label: "次アクション日", type: "date" },
      { name: "closeDate", label: "成約日（成約時のみ）", type: "date" },
    ];
  }

  function openDealModal(id) {
    if (data.customers.length === 0) { toast("先に顧客を登録してください"); return; }
    const d = id ? data.deals.find((x) => x.id === id) : {};
    modal.open(id ? "商談を編集" : "商談を追加", dealFields(), d, (v) => {
      if (!v.title) { toast("商談名は必須です"); return false; }
      // 対象物件から担当を自動補完（未指定時）
      if (!v.agentId && v.propertyId) {
        const prop = data.properties.find((p) => p.id === v.propertyId);
        if (prop && prop.agentId) v.agentId = prop.agentId;
      }
      // 成約なのに成約日が空なら本日を補完
      if (v.stage === "closed" && !v.closeDate) v.closeDate = todayStr();
      if (id) Object.assign(d, v);
      else data.deals.push(Object.assign({ id: uid() }, v));
      save(); renderAll(); toast(id ? "商談を更新しました" : "商談を追加しました");
    });
  }

  $("#btnAddCustomer").addEventListener("click", () => openCustomerModal());
  $("#btnAddDeal").addEventListener("click", () => openDealModal());
  $("#customerSearch").addEventListener("input", renderCustomers);
  $("#btnCsvCustomers").addEventListener("click", () => {
    downloadCSV("顧客一覧-" + todayStr() + ".csv",
      ["顧客名", "電話番号", "メール", "予算", "希望条件"],
      data.customers.map((c) => [c.name, c.phone, c.email, c.budget, c.wish]));
  });
  $("#btnCsvDeals").addEventListener("click", () => {
    downloadCSV("商談一覧-" + todayStr() + ".csv",
      ["商談名", "顧客", "対象物件", "担当営業", "想定価格", "ステージ", "次アクション日", "成約日"],
      data.deals.map((d) => [d.title, customerName(d.customerId), propertyName(d.propertyId), agentName(d.agentId), d.amount, dealStageMeta(d.stage).label, d.nextDate, d.closeDate]));
  });
  $("#customerTable").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-act]"); if (!btn) return;
    const id = btn.dataset.id, c = data.customers.find((x) => x.id === id); if (!c) return;
    if (btn.dataset.act === "edit") openCustomerModal(id);
    else confirmDelete(c.name, () => {
      data.customers = data.customers.filter((x) => x.id !== id);
      data.deals = data.deals.filter((x) => x.customerId !== id);
      data.viewings = data.viewings.filter((x) => x.customerId !== id);
      save(); renderAll(); toast("削除しました");
    });
  });
  $("#dealTable").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-act]"); if (!btn) return;
    const id = btn.dataset.id, d = data.deals.find((x) => x.id === id); if (!d) return;
    if (btn.dataset.act === "edit") openDealModal(id);
    else confirmDelete(d.title, () => { data.deals = data.deals.filter((x) => x.id !== id); save(); renderAll(); toast("削除しました"); });
  });

  /* ================= 営業・内見 ================= */
  function renderAgents() {
    const q = ($("#agentSearch").value || "").toLowerCase();
    const list = data.agents.filter((a) => !q || a.name.toLowerCase().includes(q) || (a.store || "").toLowerCase().includes(q));
    $("#agentTable tbody").innerHTML =
      list.map((a) => {
        const cnt = data.properties.filter((p) => p.agentId === a.id).length;
        return `<tr>
          <td>${esc(a.code)}</td><td>${esc(a.name)}</td><td>${esc(a.store)}</td><td>${esc(a.role)}</td>
          <td class="num">${cnt}</td>
          <td class="actions-col"><span class="row-actions">
            <button class="btn tiny" data-act="edit" data-id="${a.id}">編集</button>
            <button class="btn tiny danger" data-act="del" data-id="${a.id}">削除</button>
          </span></td></tr>`;
      }).join("") || `<tr><td colspan="6" class="empty">営業担当がありません</td></tr>`;
    renderViewings();
  }

  function renderViewings() {
    const filter = $("#viewingDate").value;
    const today = todayStr();
    const list = data.viewings
      .filter((v) => !filter || v.date === filter)
      .slice()
      .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
    $("#viewingTable tbody").innerHTML =
      list.map((v) => {
        const done = v.date < today;
        const badge = done ? '<span class="badge v-done">実施済</span>' : '<span class="badge v-scheduled">予定</span>';
        return `<tr>
          <td>${esc(v.date)}</td><td>${esc(v.time || "—")}</td>
          <td>${esc(propertyName(v.propertyId))}</td>
          <td>${esc(customerName(v.customerId))}</td>
          <td>${esc(agentName(v.agentId))}</td>
          <td>${badge}</td>
          <td class="actions-col"><span class="row-actions">
            <button class="btn tiny" data-act="edit" data-id="${v.id}">編集</button>
            <button class="btn tiny danger" data-act="del" data-id="${v.id}">削除</button>
          </span></td></tr>`;
      }).join("") || `<tr><td colspan="7" class="empty">内見予約がありません</td></tr>`;
  }

  const agentFields = [
    { name: "code", label: "社員番号", required: true, placeholder: "例: S-1001" },
    { name: "name", label: "氏名", required: true },
    { name: "store", label: "店舗" },
    { name: "role", label: "役職" },
  ];

  function openAgentModal(id) {
    const a = id ? data.agents.find((x) => x.id === id) : {};
    modal.open(id ? "営業担当を編集" : "営業担当を追加", agentFields, a, (v) => {
      if (!v.code || !v.name) { toast("社員番号と氏名は必須です"); return false; }
      if (id) Object.assign(a, v);
      else data.agents.push(Object.assign({ id: uid() }, v));
      save(); renderAll(); toast(id ? "営業担当を更新しました" : "営業担当を追加しました");
    });
  }

  function viewingFields() {
    return [
      { name: "date", label: "内見日", type: "date", required: true, default: todayStr() },
      { name: "time", label: "時刻", placeholder: "例: 13:30" },
      { name: "propertyId", label: "対象物件", type: "select", options: [{ value: "", label: "（未設定）" }].concat(data.properties.map((p) => ({ value: p.id, label: p.code + " " + p.name }))) },
      { name: "customerId", label: "顧客", type: "select", options: [{ value: "", label: "（未設定）" }].concat(data.customers.map((c) => ({ value: c.id, label: c.name }))) },
      { name: "agentId", label: "担当営業", type: "select", options: [{ value: "", label: "（未割当）" }].concat(data.agents.map((a) => ({ value: a.id, label: a.name }))) },
    ];
  }

  function openViewingModal(id) {
    if (data.properties.length === 0) { toast("先に物件を登録してください"); return; }
    const v0 = id ? data.viewings.find((x) => x.id === id) : {};
    modal.open(id ? "内見予約を編集" : "内見予約を追加", viewingFields(), v0, (v) => {
      if (!v.date) { toast("内見日は必須です"); return false; }
      if (id) Object.assign(v0, v);
      else data.viewings.push(Object.assign({ id: uid() }, v));
      save(); renderAll(); toast(id ? "内見予約を更新しました" : "内見予約を追加しました");
    });
  }

  $("#btnAddAgent").addEventListener("click", () => openAgentModal());
  $("#btnAddViewing").addEventListener("click", () => openViewingModal());
  $("#agentSearch").addEventListener("input", renderAgents);
  $("#viewingDate").addEventListener("change", renderViewings);
  $("#btnClearViewingFilter").addEventListener("click", () => { $("#viewingDate").value = ""; renderViewings(); });

  $("#agentTable").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-act]"); if (!btn) return;
    const id = btn.dataset.id, a = data.agents.find((x) => x.id === id); if (!a) return;
    if (btn.dataset.act === "edit") openAgentModal(id);
    else confirmDelete(a.name, () => {
      data.agents = data.agents.filter((x) => x.id !== id);
      data.properties.forEach((p) => { if (p.agentId === id) p.agentId = ""; });
      data.deals.forEach((d) => { if (d.agentId === id) d.agentId = ""; });
      data.viewings.forEach((v) => { if (v.agentId === id) v.agentId = ""; });
      save(); renderAll(); toast("削除しました");
    });
  });
  $("#viewingTable").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-act]"); if (!btn) return;
    const id = btn.dataset.id, v = data.viewings.find((x) => x.id === id); if (!v) return;
    if (btn.dataset.act === "edit") openViewingModal(id);
    else confirmDelete(`${v.date} 内見`, () => { data.viewings = data.viewings.filter((x) => x.id !== id); save(); renderAll(); toast("削除しました"); });
  });

  /* ================= レポート ================= */
  function closedDeals() {
    return data.deals.filter((d) => d.stage === "closed");
  }
  // 成約の担当者: 明示指定 > 対象物件の担当
  function dealAgentId(d) {
    if (d.agentId) return d.agentId;
    const prop = data.properties.find((p) => p.id === d.propertyId);
    return prop ? prop.agentId : "";
  }

  // 直近nヶ月の成約金額を集計
  function monthlySeries(months) {
    const now = new Date();
    const keys = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      keys.push(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"));
    }
    const map = {};
    keys.forEach((k) => (map[k] = { amount: 0, count: 0 }));
    closedDeals().forEach((d) => {
      const k = (d.closeDate || "").slice(0, 7);
      if (map[k]) { map[k].amount += Number(d.amount || 0); map[k].count += 1; }
    });
    return keys.map((k) => ({ label: k.slice(5) + "月", full: k, amount: map[k].amount, count: map[k].count }));
  }

  // 縦棒グラフ（単一系列・値ラベル直付け）
  function renderBarChart(el, series, opts) {
    opts = opts || {};
    if (!series.length || series.every((s) => s.amount === 0)) {
      el.innerHTML = `<div class="chart-empty">成約データがありません</div>`;
      return;
    }
    const W = Math.max(series.length * 84, 560), H = 240;
    const padL = 8, padR = 8, padB = 40, padT = 26;
    const max = Math.max.apply(null, series.map((s) => s.amount)) || 1;
    const bw = (W - padL - padR) / series.length;
    const barW = Math.min(48, bw * 0.6);
    const plotH = H - padT - padB;
    const bars = series.map((s, i) => {
      const x = padL + bw * i + (bw - barW) / 2;
      const h = Math.round((s.amount / max) * plotH);
      const y = padT + plotH - h;
      const amtLabel = "¥" + (s.amount >= 1e8 ? (s.amount / 1e8).toFixed(1) + "億" : Math.round(s.amount / 1e4).toLocaleString() + "万");
      return `
        <rect class="bar" x="${x}" y="${y}" width="${barW}" height="${Math.max(h, 1)}" rx="4" ry="4"></rect>
        ${s.amount > 0 ? `<text class="val-label" x="${x + barW / 2}" y="${y - 5}" text-anchor="middle">${esc(amtLabel)}</text>` : ""}
        ${opts.showCount && s.count ? `<text class="cnt-label" x="${x + barW / 2}" y="${y - 17}" text-anchor="middle">${s.count}件</text>` : ""}
        <text class="x-label" x="${x + barW / 2}" y="${H - padB + 16}" text-anchor="middle">${esc(s.label)}</text>`;
    }).join("");
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="月次成約金額の棒グラフ">
      <line class="axis-line" x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}"></line>
      ${bars}
    </svg>`;
  }

  // 横棒グラフ（担当者別・単一系列）
  function renderHBarChart(el, rows) {
    if (!rows.length || rows.every((r) => r.amount === 0)) {
      el.innerHTML = `<div class="chart-empty">成約データがありません</div>`;
      return;
    }
    const rowH = 34, padL = 90, padR = 70, padT = 8, padB = 8;
    const W = 520, H = padT + padB + rows.length * rowH;
    const max = Math.max.apply(null, rows.map((r) => r.amount)) || 1;
    const trackW = W - padL - padR;
    const bars = rows.map((r, i) => {
      const y = padT + i * rowH + 6;
      const w = Math.round((r.amount / max) * trackW);
      const amtLabel = "¥" + (r.amount >= 1e8 ? (r.amount / 1e8).toFixed(2) + "億" : Math.round(r.amount / 1e4).toLocaleString() + "万");
      return `
        <text class="x-label" x="${padL - 8}" y="${y + 15}" text-anchor="end">${esc(r.name)}</text>
        <rect class="bar-track" x="${padL}" y="${y}" width="${trackW}" height="20" rx="4" ry="4"></rect>
        <rect class="bar-h" x="${padL}" y="${y}" width="${Math.max(w, 1)}" height="20" rx="4" ry="4"></rect>
        <text class="val-label" x="${padL + trackW + 6}" y="${y + 15}" text-anchor="start">${esc(amtLabel)}</text>`;
    }).join("");
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="担当者別成約金額の横棒グラフ">${bars}</svg>`;
  }

  function agentSalesRows() {
    const closed = closedDeals();
    return data.agents.map((a) => {
      const deals = closed.filter((d) => dealAgentId(d) === a.id);
      return {
        id: a.id, name: a.name, store: a.store,
        props: data.properties.filter((p) => p.agentId === a.id).length,
        count: deals.length,
        amount: deals.reduce((s, d) => s + Number(d.amount || 0), 0),
      };
    }).sort((x, y) => y.amount - x.amount);
  }

  function renderReports() {
    const closed = closedDeals();
    const totalSales = closed.reduce((s, d) => s + Number(d.amount || 0), 0);
    const thisMonth = todayStr().slice(0, 7);
    const monthDeals = closed.filter((d) => (d.closeDate || "").slice(0, 7) === thisMonth);
    const monthSales = monthDeals.reduce((s, d) => s + Number(d.amount || 0), 0);
    const avg = closed.length ? Math.round(totalSales / closed.length) : 0;

    $("#reportKpis").innerHTML = [
      { label: "累計成約件数", value: closed.length + " 件", sub: "全期間" },
      { label: "累計成約金額", value: man(totalSales), sub: "全期間", gold: true },
      { label: "今月の成約", value: monthDeals.length + " 件", sub: man(monthSales) },
      { label: "平均成約単価", value: man(avg), sub: "成約1件あたり" },
    ].map((k) => `<div class="kpi ${k.gold ? "gold" : ""}">
        <div class="k-label">${k.label}</div><div class="k-value">${k.value}</div><div class="k-sub">${k.sub}</div></div>`).join("");

    renderBarChart($("#monthlyChart"), monthlySeries(6), { showCount: true });

    const rows = agentSalesRows();
    renderHBarChart($("#agentChart"), rows);
    $("#agentSalesTable tbody").innerHTML =
      rows.map((r) => `<tr>
        <td>${esc(r.name)}</td><td>${esc(r.store)}</td>
        <td class="num">${r.props}</td><td class="num">${r.count}</td><td class="num">${man(r.amount)}</td>
      </tr>`).join("") || `<tr><td colspan="5" class="empty">営業担当がありません</td></tr>`;
  }

  $("#btnCsvSales").addEventListener("click", () => {
    downloadCSV("担当者別売上-" + todayStr() + ".csv",
      ["担当者", "店舗", "担当物件数", "成約件数", "成約金額"],
      agentSalesRows().map((r) => [r.name, r.store, r.props, r.count, r.amount]));
  });

  /* ================= ダッシュボード ================= */
  function renderDashboard() {
    const activeProps = data.properties.filter((p) => p.status === "active" || p.status === "negotiating");
    const activeValue = activeProps.reduce((s, p) => s + Number(p.price || 0), 0);
    const openDeals = data.deals.filter((d) => d.stage !== "closed" && d.stage !== "dropped");
    const pipeline = openDeals.reduce((s, d) => s + Number(d.amount || 0), 0);
    const soldCount = data.properties.filter((p) => p.status === "sold").length;
    const upcoming = data.viewings.filter((v) => v.date >= todayStr());

    $("#kpiCards").innerHTML = [
      { label: "販売中物件", value: activeProps.length + " 件", sub: "販売総額 " + man(activeValue) },
      { label: "進行中商談", value: openDeals.length + " 件", sub: "見込 " + man(pipeline) },
      { label: "成約済物件", value: soldCount + " 件", sub: "全 " + data.properties.length + " 物件中", gold: true },
      { label: "今後の内見", value: upcoming.length + " 件", sub: "本日以降の予定" },
    ].map((k) => `<div class="kpi ${k.gold ? "gold" : ""}">
        <div class="k-label">${k.label}</div>
        <div class="k-value">${k.value}</div>
        <div class="k-sub">${k.sub}</div></div>`).join("");

    $("#activeProps").innerHTML = activeProps.length
      ? activeProps.slice(0, 6).map((p) => { const st = propStatusMeta(p.status);
          const thumb = p.photo ? `<img class="prop-thumb" src="${esc(p.photo)}" alt="" />` : "";
          return `<div class="mini-item"><span class="mi-main"><span class="name-cell">${thumb}${esc(p.name)}</span><br><span class="mi-sub">${esc(p.type)} / ${esc(p.layout)} / ${esc(p.address)}</span></span>
          <span class="mi-sub">${man(p.price)} <span class="badge ${st.value}">${st.label}</span></span></div>`; }).join("")
      : `<div class="empty">販売中の物件はありません</div>`;

    $("#openDealsList").innerHTML = openDeals.length
      ? openDeals.slice(0, 6).map((d) => { const m = dealStageMeta(d.stage);
          return `<div class="mini-item"><span class="mi-main">${esc(d.title)}<br><span class="mi-sub">${esc(customerName(d.customerId))} / ${esc(propertyName(d.propertyId))}</span></span>
          <span class="mi-sub">${man(d.amount)} <span class="badge ${m.cls}">${m.label}</span></span></div>`; }).join("")
      : `<div class="empty">進行中の商談はありません</div>`;

    const upcomingSorted = upcoming.slice().sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
    $("#upcomingViewings").innerHTML = upcomingSorted.length
      ? upcomingSorted.slice(0, 6).map((v) => `<div class="mini-item">
          <span class="mi-main">${esc(propertyName(v.propertyId))}<br><span class="mi-sub">${esc(customerName(v.customerId))} / 担当 ${esc(agentName(v.agentId))}</span></span>
          <span class="mi-sub">${esc(v.date)} ${esc(v.time || "")}</span></div>`).join("")
      : `<div class="empty">今後の内見予定はありません</div>`;
  }

  /* ================= エクスポート / インポート ================= */
  $("#btnExport").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "re-sales-data-" + todayStr() + ".json";
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
        ["agents", "properties", "customers", "deals", "viewings"].forEach((k) => { if (!Array.isArray(data[k])) data[k] = []; });
        save(); renderAll(); toast("データを読み込みました");
      } catch (err) { toast("読み込みに失敗しました（JSON形式を確認）"); }
      e.target.value = "";
    };
    reader.readAsText(file);
  });

  /* ================= 描画エントリ ================= */
  function renderAll() {
    renderDashboard();
    renderProperties();
    renderCustomers();
    renderAgents();
    renderReports();
  }

  $("#viewingDate").value = "";
  renderAll();
})();
