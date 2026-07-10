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

  // 間取り文字列から居室数を推定（3LDK→3, ワンルーム→1）
  function layoutRooms(layout) {
    const m = String(layout || "").match(/(\d+)\s*[SLDK]/i);
    if (m) return parseInt(m[1], 10);
    if (/ワンルーム|1R|1K/i.test(layout || "")) return 1;
    return 0;
  }

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
        { id: p1, code: "P-2001", name: "グランドレジデンス品川", type: "マンション", address: "東京都港区港南2-1-1", price: 78000000, layout: "3LDK", area: 72.5, status: "active", agentId: a1, media: [] },
        { id: p2, code: "P-2002", name: "世田谷 新築戸建", type: "戸建", address: "東京都世田谷区成城6-3-2", price: 96800000, layout: "4LDK", area: 105.2, status: "negotiating", agentId: a2, media: [] },
        { id: p3, code: "P-2003", name: "横浜みなとみらい 事業用地", type: "土地", address: "神奈川県横浜市西区みなとみらい4", price: 250000000, layout: "—", area: 480, status: "prep", agentId: a1, media: [] },
        { id: p4, code: "P-2004", name: "目黒アーバンフラット", type: "マンション", address: "東京都目黒区中目黒3-2-1", price: 62000000, layout: "2LDK", area: 55.0, status: "sold", agentId: a2, media: [] },
      ],
      customers: [
        { id: c1, name: "山田 太郎", phone: "090-1234-5678", email: "yamada@example.com", budget: 80000000, prefArea: "港区,品川", prefType: "マンション", minRooms: 3, wish: "駅徒歩10分以内" },
        { id: c2, name: "佐藤 恵子", phone: "080-9876-5432", email: "sato@example.com", budget: 100000000, prefArea: "世田谷", prefType: "戸建", minRooms: 4, wish: "新築希望" },
        { id: c3, name: "高橋 健", phone: "070-1111-2222", email: "takahashi@example.com", budget: 65000000, prefArea: "目黒", prefType: "マンション", minRooms: 2, wish: "築浅" },
      ],
      deals: [
        { id: uid(), title: "山田様 品川MS", customerId: c1, propertyId: p1, agentId: a1, amount: 76000000, stage: "viewing", createdDate: "2026-06-25", nextDate: "", closeDate: "" },
        { id: uid(), title: "佐藤様 世田谷戸建", customerId: c2, propertyId: p2, agentId: a2, amount: 95000000, stage: "offer", createdDate: "2026-06-10", nextDate: "", closeDate: "" },
        { id: uid(), title: "高橋様 目黒MS", customerId: c3, propertyId: p4, agentId: a2, amount: 61000000, stage: "closed", createdDate: "2026-05-20", nextDate: "", closeDate: "2026-06-18" },
        { id: uid(), title: "旧案件A 中央区MS", customerId: c1, propertyId: "", agentId: a1, amount: 84000000, stage: "closed", createdDate: "2026-04-10", nextDate: "", closeDate: "2026-05-09" },
        { id: uid(), title: "旧案件B 川崎戸建", customerId: c2, propertyId: "", agentId: a1, amount: 52000000, stage: "closed", createdDate: "2026-03-15", nextDate: "", closeDate: "2026-04-22" },
        { id: uid(), title: "旧案件C 横浜MS", customerId: c3, propertyId: "", agentId: a2, amount: 47000000, stage: "closed", createdDate: "2026-03-20", nextDate: "", closeDate: "2026-04-05" },
      ],
      viewings: [],
      settings: { monthlyTarget: 150000000 },
    };
  };

  let data = load();
  save(); // 初回はシード、以降は読み込んだデータを永続化（冪等）

  // 旧バージョンのデータ形式を移行（単一 photo → media 配列 など）
  function migrate(d) {
    (d.properties || []).forEach((p) => {
      if (!Array.isArray(p.media)) {
        p.media = p.photo ? [{ id: uid(), url: p.photo, type: "写真" }] : [];
      }
      delete p.photo;
    });
    (d.customers || []).forEach((c) => {
      if (c.prefArea == null) c.prefArea = "";
      if (c.prefType == null) c.prefType = "";
      if (c.minRooms == null) c.minRooms = 0;
      if (c.wish == null) c.wish = "";
    });
    (d.deals || []).forEach((dl) => {
      // 旧データにリードタイム算出用の作成日が無ければ補完（成約日→なければ今日）
      if (dl.createdDate == null || dl.createdDate === "") dl.createdDate = dl.closeDate || todayStr();
    });
    if (!d.settings || typeof d.settings !== "object") d.settings = { monthlyTarget: 150000000 };
    if (d.settings.monthlyTarget == null) d.settings.monthlyTarget = 150000000;
    return d;
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return migrate(JSON.parse(raw));
    } catch (e) { console.warn("load failed", e); }
    return defaultData();
  }

  function save(d) {
    data = d || data;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      toast("保存に失敗しました（容量超過の可能性）。画像の枚数やサイズをご確認ください");
      console.warn("save failed", e);
    }
  }

  /* ---------- 共通UI ---------- */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  function toast(msg, undoFn) {
    const t = $("#toast");
    t.innerHTML = "";
    t.appendChild(document.createTextNode(msg));
    if (undoFn) {
      const btn = document.createElement("button");
      btn.className = "toast-undo";
      btn.textContent = "取り消す";
      btn.addEventListener("click", () => { t.hidden = true; undoFn(); });
      t.appendChild(btn);
    }
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (t.hidden = true), undoFn ? 6000 : 2600);
  }

  const TAB_KEY = "re_tab";
  function activateTab(view) {
    const tab = $(`#tabs .tab[data-view="${view}"]`) || $("#tabs .tab");
    $$("#tabs .tab").forEach((t) => t.classList.remove("active"));
    $$(".view").forEach((v) => v.classList.remove("active"));
    tab.classList.add("active");
    $("#view-" + tab.dataset.view).classList.add("active");
    try { localStorage.setItem(TAB_KEY, tab.dataset.view); } catch (e) {}
    renderAll();
  }
  $$("#tabs .tab").forEach((tab) => {
    tab.addEventListener("click", () => activateTab(tab.dataset.view));
  });

  /* ---------- テーマ（ダークモード） ---------- */
  const THEME_KEY = "re_theme";
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const btn = $("#btnTheme");
    if (btn) { btn.textContent = theme === "dark" ? "☀️" : "🌙"; btn.title = theme === "dark" ? "ライトモードに切替" : "ダークモードに切替"; }
  }
  (function initTheme() {
    let saved = "light";
    try { saved = localStorage.getItem(THEME_KEY) || "light"; } catch (e) {}
    applyTheme(saved);
  })();
  $("#btnTheme").addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    applyTheme(next);
  });

  /* ---------- モーダル ---------- */
  const modal = {
    backdrop: $("#modalBackdrop"),
    form: $("#modalForm"),
    title: $("#modalTitle"),
    saveBtn: $("#modalSave"),
    cancelBtn: $("#modalCancel"),
    onSave: null,
    open(title, fields, values, onSave) {
      this.title.textContent = title;
      this.form.innerHTML = fields.map((f) => fieldHTML(f, values[f.name])).join("");
      this.onSave = onSave;
      this.saveBtn.style.display = "";
      this.cancelBtn.textContent = "キャンセル";
      this.backdrop.hidden = false;
      const first = this.form.querySelector("input:not([type=hidden]):not([type=file]), select, textarea");
      if (first) first.focus();
    },
    // 読み取り専用の情報モーダル（保存ボタン非表示）
    openInfo(title, html) {
      this.title.textContent = title;
      this.form.innerHTML = html;
      this.onSave = null;
      this.saveBtn.style.display = "none";
      this.cancelBtn.textContent = "閉じる";
      this.backdrop.hidden = false;
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
    if (f.type === "gallery") {
      return `<div class="field"><label>${esc(f.label)}</label>
        <div class="gallery-controls">
          <input type="file" accept="image/*" multiple data-gallery-add />
          <select data-gallery-type><option value="写真">写真として追加</option><option value="図面">図面として追加</option></select>
        </div>
        <div class="gallery-grid" data-gallery-grid></div>
        <input type="hidden" name="${f.name}" />
      </div>`;
    }
    const type = f.type || "text";
    const step = type === "number" ? 'step="any"' : "";
    return `<div class="field"><label>${esc(f.label)}</label><input type="${type}" name="${f.name}" value="${esc(val)}" ${step} ${req} placeholder="${esc(f.placeholder || "")}" /></div>`;
  }

  // 画像を maxDim 以内に縮小して data URI に変換（localStorage 容量対策）
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

  /* ---------- ギャラリー編集（物件モーダル内） ---------- */
  let galleryItems = [];
  function renderGallery() {
    const grid = modal.form.querySelector("[data-gallery-grid]");
    const hidden = modal.form.querySelector('input[name="media"]');
    if (!grid || !hidden) return;
    grid.innerHTML = galleryItems.map((m, i) => `
      <div class="gallery-cell">
        <span class="g-kind ${m.type === "図面" ? "zumen" : ""}" data-gallery-kind="${i}" title="クリックで写真/図面を切替">${esc(m.type)}</span>
        <button type="button" class="g-del" data-gallery-del="${i}" aria-label="削除">×</button>
        <img src="${esc(m.url)}" data-gallery-view="${i}" alt="${esc(m.type)}" />
      </div>`).join("");
    hidden.value = JSON.stringify(galleryItems);
  }

  modal.form.addEventListener("change", (e) => {
    const add = e.target.closest("input[data-gallery-add]");
    if (!add) return;
    const typeSel = modal.form.querySelector("[data-gallery-type]");
    const kind = typeSel ? typeSel.value : "写真";
    const files = Array.from(add.files || []);
    let pending = files.length;
    files.forEach((file) => {
      downscaleImage(file, 1000, (dataUri) => {
        if (dataUri) galleryItems.push({ id: uid(), url: dataUri, type: kind });
        if (--pending <= 0) renderGallery();
      });
    });
    add.value = "";
  });
  modal.form.addEventListener("click", (e) => {
    const del = e.target.closest("[data-gallery-del]");
    const kind = e.target.closest("[data-gallery-kind]");
    const view = e.target.closest("[data-gallery-view]");
    if (del) { galleryItems.splice(Number(del.dataset.galleryDel), 1); renderGallery(); }
    else if (kind) { const i = Number(kind.dataset.galleryKind); galleryItems[i].type = galleryItems[i].type === "図面" ? "写真" : "図面"; renderGallery(); }
    else if (view) { openLightbox(galleryItems, Number(view.dataset.galleryView)); }
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

  // 削除は確認ダイアログの代わりに、取り消し可能なトーストで実行（操作性向上）
  function confirmDelete(label, fn) {
    const snapshot = JSON.parse(JSON.stringify(data));
    fn(); // 呼び出し側で mutations + save + renderAll を実施
    toast(`「${label}」を削除しました`, () => {
      data = snapshot; save(); renderAll(); toast("削除を取り消しました");
    });
  }

  const agentName = (id) => (data.agents.find((a) => a.id === id) || {}).name || "—";
  const agentOf = (id) => data.agents.find((a) => a.id === id) || null;
  const customerName = (id) => (data.customers.find((c) => c.id === id) || {}).name || "（不明）";
  const propertyName = (id) => (data.properties.find((p) => p.id === id) || {}).name || "（未設定）";
  const firstPhoto = (p) => { const m = (p.media || []).find((x) => x.type === "写真") || (p.media || [])[0]; return m ? m.url : ""; };

  /* ---------- ライトボックス ---------- */
  const lb = { items: [], idx: 0 };
  function openLightbox(items, idx) {
    lb.items = items.filter((m) => m && m.url);
    lb.idx = idx || 0;
    if (!lb.items.length) return;
    updateLightbox();
    $("#lightbox").hidden = false;
  }
  function updateLightbox() {
    const m = lb.items[lb.idx];
    if (!m) return;
    $("#lbImg").src = m.url;
    $("#lbCaption").textContent = `${m.type || "写真"}（${lb.idx + 1}/${lb.items.length}）`;
  }
  function stepLightbox(dir) {
    lb.idx = (lb.idx + dir + lb.items.length) % lb.items.length;
    updateLightbox();
  }
  $("#lbClose").addEventListener("click", () => ($("#lightbox").hidden = true));
  $("#lbPrev").addEventListener("click", () => stepLightbox(-1));
  $("#lbNext").addEventListener("click", () => stepLightbox(1));
  $("#lightbox").addEventListener("click", (e) => { if (e.target.id === "lightbox") $("#lightbox").hidden = true; });
  document.addEventListener("keydown", (e) => {
    if ($("#lightbox").hidden) return;
    if (e.key === "Escape") $("#lightbox").hidden = true;
    else if (e.key === "ArrowLeft") stepLightbox(-1);
    else if (e.key === "ArrowRight") stepLightbox(1);
  });

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
        const ph = firstPhoto(p);
        const count = (p.media || []).length;
        const thumb = ph ? `<img class="prop-thumb" src="${esc(ph)}" data-act="gallery" data-id="${p.id}" alt="" />` : "";
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
          <td data-sortvalue="${PROP_STATUS.findIndex((s) => s.value === p.status)}">
            <select class="inline-select" data-inline-status data-id="${p.id}" title="ステータスを変更">
              ${PROP_STATUS.map((s) => `<option value="${s.value}" ${s.value === p.status ? "selected" : ""}>${s.label}</option>`).join("")}
            </select></td>
          <td class="actions-col"><span class="row-actions">
            <button class="btn tiny" data-act="gallery" data-id="${p.id}">ギャラリー${count ? "(" + count + ")" : ""}</button>
            <button class="btn tiny" data-act="flyer" data-id="${p.id}">チラシ</button>
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
      { name: "media", label: "写真・図面ギャラリー（複数可・写真/図面を切替可）", type: "gallery" },
    ];
  }

  function parseMedia(v) {
    if (Array.isArray(v)) return v;
    try { const a = JSON.parse(v || "[]"); return Array.isArray(a) ? a : []; } catch (e) { return []; }
  }

  function openPropertyModal(id) {
    const p = id ? data.properties.find((x) => x.id === id) : {};
    galleryItems = (p.media || []).map((m) => Object.assign({}, m));
    modal.open(id ? "物件を編集" : "物件を登録", propertyFields(), p, (v) => {
      if (!v.code || !v.name) { toast("物件番号と物件名は必須です"); return false; }
      v.media = parseMedia(v.media);
      if (id) Object.assign(p, v);
      else data.properties.push(Object.assign({ id: uid() }, v));
      save(); renderAll(); toast(id ? "物件を更新しました" : "物件を登録しました");
    });
    renderGallery();
  }

  $("#btnAddProperty").addEventListener("click", () => openPropertyModal());
  $("#propertySearch").addEventListener("input", renderProperties);
  $("#propStatusFilter").addEventListener("change", renderProperties);
  $("#btnCsvProperties").addEventListener("click", () => {
    downloadCSV("物件一覧-" + todayStr() + ".csv",
      ["物件番号", "物件名", "種別", "所在地", "販売価格", "間取り", "面積(㎡)", "㎡単価", "担当営業", "ステータス", "画像枚数"],
      data.properties.map((p) => [p.code, p.name, p.type, p.address, p.price, p.layout, p.area, p.area > 0 ? Math.round(p.price / p.area) : "", agentName(p.agentId), propStatusMeta(p.status).label, (p.media || []).length]));
  });
  $("#propertyTable").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act]"); if (!btn) return;
    const id = btn.dataset.id, p = data.properties.find((x) => x.id === id); if (!p) return;
    const act = btn.dataset.act;
    if (act === "edit") openPropertyModal(id);
    else if (act === "gallery") openPropertyGallery(p);
    else if (act === "flyer") printFlyer(p);
    else if (act === "del") confirmDelete(p.name, () => {
      data.properties = data.properties.filter((x) => x.id !== id);
      data.deals.forEach((d) => { if (d.propertyId === id) d.propertyId = ""; });
      data.viewings = data.viewings.filter((x) => x.propertyId !== id);
      save(); renderAll(); toast("削除しました");
    });
  });

  // 一覧からステータスをインライン変更
  $("#propertyTable").addEventListener("change", (e) => {
    const sel = e.target.closest("[data-inline-status]"); if (!sel) return;
    const p = data.properties.find((x) => x.id === sel.dataset.id); if (!p) return;
    p.status = sel.value; save(); renderAll(); toast(`${p.name} を「${propStatusMeta(p.status).label}」に変更`);
  });

  function openPropertyGallery(p) {
    const media = p.media || [];
    if (!media.length) { toast("この物件には画像が登録されていません"); return; }
    openLightbox(media, 0);
  }

  /* ---------- 印刷用チラシ（別ウィンドウ→PDF保存） ---------- */
  function printFlyer(p) {
    const w = window.open("", "_blank");
    if (!w) { toast("ポップアップがブロックされました。ブラウザの設定をご確認ください"); return; }
    const photos = (p.media || []).filter((m) => m.type === "写真");
    const plans = (p.media || []).filter((m) => m.type === "図面");
    const hero = (photos[0] || (p.media || [])[0] || {}).url || "";
    const subPhotos = photos.slice(1, 4);
    const ag = agentOf(p.agentId);
    const unit = p.area > 0 ? Math.round(p.price / p.area) : 0;
    const spec = (k, v) => `<tr><th>${esc(k)}</th><td>${v}</td></tr>`;
    const doc = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><title>${esc(p.name)} 物件チラシ</title>
    <style>
      @page { size: A4; margin: 12mm; }
      * { box-sizing: border-box; }
      body { font-family: "Hiragino Kaku Gothic ProN","Yu Gothic","Meiryo",sans-serif; color:#1b2b28; margin:0; }
      .flyer { width: 186mm; }
      .fl-head { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:3px solid #0f6e5e; padding-bottom:8px; }
      .fl-brand { font-weight:800; letter-spacing:2px; color:#0f6e5e; font-size:20px; }
      .fl-brand small { display:block; font-size:11px; letter-spacing:1px; color:#6a7a76; font-weight:600; }
      .fl-type { background:#0f6e5e; color:#fff; padding:4px 12px; border-radius:999px; font-size:13px; font-weight:700; }
      .fl-title { font-size:26px; font-weight:800; margin:14px 0 2px; }
      .fl-addr { color:#6a7a76; font-size:14px; margin-bottom:12px; }
      .fl-hero { width:100%; height:78mm; object-fit:cover; border-radius:8px; background:#eef2f1; }
      .fl-subs { display:flex; gap:6px; margin-top:6px; }
      .fl-subs img { width:33%; height:34mm; object-fit:cover; border-radius:6px; background:#eef2f1; }
      .fl-price { font-size:30px; font-weight:800; color:#0f6e5e; margin:14px 0 4px; }
      .fl-price small { font-size:14px; color:#6a7a76; font-weight:600; }
      table.fl-spec { width:100%; border-collapse:collapse; margin-top:8px; font-size:14px; }
      table.fl-spec th, table.fl-spec td { border:1px solid #e1e8e6; padding:8px 10px; text-align:left; }
      table.fl-spec th { background:#f2f7f5; width:28%; color:#6a7a76; }
      .fl-plan { margin-top:12px; }
      .fl-plan h3 { font-size:14px; color:#0f6e5e; margin:0 0 6px; }
      .fl-plan img { max-width:100%; max-height:90mm; object-fit:contain; border:1px solid #e1e8e6; border-radius:6px; }
      .fl-foot { margin-top:16px; border-top:1px solid #e1e8e6; padding-top:10px; font-size:13px; color:#1b2b28; display:flex; justify-content:space-between; }
      .fl-note { font-size:11px; color:#9aa8a4; margin-top:6px; }
      @media print { .noprint { display:none; } }
    </style></head><body>
    <div class="flyer">
      <div class="fl-head">
        <div class="fl-brand">RE SALES<small>不動産販売</small></div>
        <div class="fl-type">${esc(p.type)}</div>
      </div>
      <div class="fl-title">${esc(p.name)}</div>
      <div class="fl-addr">${esc(p.address || "")}　（物件番号 ${esc(p.code)}）</div>
      ${hero ? `<img class="fl-hero" src="${esc(hero)}" alt="">` : `<div class="fl-hero"></div>`}
      ${subPhotos.length ? `<div class="fl-subs">${subPhotos.map((m) => `<img src="${esc(m.url)}" alt="">`).join("")}</div>` : ""}
      <div class="fl-price">${man(p.price)} <small>（${unit ? man(unit) + " / ㎡" : "—"}）</small></div>
      <table class="fl-spec">
        ${spec("種別", esc(p.type))}
        ${spec("間取り", esc(p.layout || "—"))}
        ${spec("専有面積", (Number(p.area || 0).toLocaleString()) + " ㎡")}
        ${spec("所在地", esc(p.address || "—"))}
        ${spec("販売状況", propStatusMeta(p.status).label)}
      </table>
      ${plans.length ? `<div class="fl-plan"><h3>間取り図</h3><img src="${esc(plans[0].url)}" alt="間取り図"></div>` : ""}
      <div class="fl-foot">
        <div><strong>お問い合わせ</strong><br>担当: ${esc(ag ? ag.name : "—")}${ag && ag.store ? "（" + esc(ag.store) + "）" : ""}</div>
        <div style="text-align:right">RE SALES 不動産販売<br>${esc(todayStr())} 現在</div>
      </div>
      <div class="fl-note">※本チラシは社内管理データから自動生成した参考資料です。最新の販売条件は担当までお問い合わせください。</div>
      <div class="noprint" style="margin-top:16px;text-align:center;">
        <button onclick="window.print()" style="padding:8px 20px;font-size:14px;cursor:pointer;">印刷 / PDF保存</button>
      </div>
    </div>
    <script>window.onload=function(){setTimeout(function(){window.print();},300);};<\/script>
    </body></html>`;
    w.document.open();
    w.document.write(doc);
    w.document.close();
    toast("チラシを別ウィンドウで開きました（印刷ダイアログでPDF保存できます）");
  }

  /* ================= 顧客・商談 ================= */
  function renderCustomers() {
    const q = ($("#customerSearch").value || "").toLowerCase();
    const list = data.customers.filter((c) => !q || c.name.toLowerCase().includes(q));
    $("#customerTable tbody").innerHTML =
      list.map((c) => {
        const cond = [c.prefArea, c.prefType, c.minRooms ? c.minRooms + "LDK以上" : "", c.wish].filter(Boolean).join(" / ");
        return `<tr>
          <td>${esc(c.name)}</td><td>${esc(c.phone)}</td><td>${esc(c.email)}</td>
          <td class="num">${man(c.budget)}</td><td>${esc(cond)}</td>
          <td class="actions-col"><span class="row-actions">
            <button class="btn tiny" data-act="match" data-id="${c.id}">物件提案</button>
            <button class="btn tiny" data-act="edit" data-id="${c.id}">編集</button>
            <button class="btn tiny danger" data-act="del" data-id="${c.id}">削除</button>
          </span></td></tr>`;
      }).join("") || `<tr><td colspan="6" class="empty">顧客がありません</td></tr>`;

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
          <td data-sortvalue="${DEAL_STAGE.findIndex((s) => s.value === d.stage)}">
            <select class="inline-select" data-inline-stage data-id="${d.id}" title="ステージを変更">
              ${DEAL_STAGE.map((s) => `<option value="${s.value}" ${s.value === d.stage ? "selected" : ""}>${s.label}</option>`).join("")}
            </select></td>
          <td>${esc(d.nextDate || "—")}</td>
          <td class="actions-col"><span class="row-actions">
            <button class="btn tiny" data-act="edit" data-id="${d.id}">編集</button>
            <button class="btn tiny danger" data-act="del" data-id="${d.id}">削除</button>
          </span></td></tr>`;
      }).join("") || `<tr><td colspan="7" class="empty">商談がありません</td></tr>`;
  }

  const customerFields = () => [
    { name: "name", label: "顧客名", required: true },
    { name: "phone", label: "電話番号" },
    { name: "email", label: "メールアドレス", type: "email" },
    { name: "budget", label: "ご予算(円)", type: "number", default: 0 },
    { name: "prefArea", label: "希望エリア（カンマ区切りで複数可）", placeholder: "例: 港区,目黒,品川" },
    { name: "prefType", label: "希望種別", type: "select", options: [{ value: "", label: "指定なし" }].concat(PROP_TYPES.map((t) => ({ value: t, label: t }))) },
    { name: "minRooms", label: "希望最低間取り（居室数）", type: "number", default: 0, placeholder: "例: 3（3LDK以上）" },
    { name: "wish", label: "その他希望条件（メモ）", type: "textarea", placeholder: "駅距離・築年数など" },
  ];

  function openCustomerModal(id) {
    const c = id ? data.customers.find((x) => x.id === id) : {};
    modal.open(id ? "顧客を編集" : "顧客を追加", customerFields(), c, (v) => {
      if (!v.name) { toast("顧客名は必須です"); return false; }
      if (id) Object.assign(c, v);
      else data.customers.push(Object.assign({ id: uid() }, v));
      save(); renderAll(); toast(id ? "顧客を更新しました" : "顧客を追加しました");
    });
  }

  /* ---------- 物件マッチング（希望条件と物件の自動突合） ---------- */
  function matchProperties(c) {
    const areas = String(c.prefArea || "").split(/[,、\s]+/).map((s) => s.trim()).filter(Boolean);
    return data.properties
      .filter((p) => p.status !== "sold")
      .map((p) => {
        let score = 0; const reasons = [];
        // 予算（最大45点）
        if (c.budget > 0) {
          if (p.price <= c.budget) { score += 45; reasons.push({ t: "予算内", warn: false }); }
          else if (p.price <= c.budget * 1.1) { score += 22; reasons.push({ t: "予算+10%以内", warn: true }); }
          else { reasons.push({ t: "予算オーバー", warn: true }); }
        }
        // エリア（最大25点）
        const hitArea = areas.find((a) => (p.address || "").includes(a) || (p.name || "").includes(a));
        if (hitArea) { score += 25; reasons.push({ t: "エリア一致: " + hitArea, warn: false }); }
        else if (areas.length) { reasons.push({ t: "希望エリア外", warn: true }); }
        // 種別（最大20点）
        if (c.prefType) {
          if (p.type === c.prefType) { score += 20; reasons.push({ t: "種別一致", warn: false }); }
          else { reasons.push({ t: "種別: " + p.type, warn: true }); }
        }
        // 間取り（最大10点）
        if (c.minRooms > 0 && layoutRooms(p.layout) > 0) {
          if (layoutRooms(p.layout) >= c.minRooms) { score += 10; reasons.push({ t: "間取り条件を満たす", warn: false }); }
          else { reasons.push({ t: "間取り不足", warn: true }); }
        }
        // 満点（設定された条件のみ加点対象）
        let maxScore = 0;
        if (c.budget > 0) maxScore += 45;
        if (areas.length) maxScore += 25;
        if (c.prefType) maxScore += 20;
        if (c.minRooms > 0) maxScore += 10;
        const pct = maxScore ? Math.round((score / maxScore) * 100) : 0;
        return { p, score, pct, reasons };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score);
  }

  function openMatchModal(id) {
    const c = data.customers.find((x) => x.id === id); if (!c) return;
    const results = matchProperties(c);
    const condLine = [
      c.budget ? "予算 " + man(c.budget) : "",
      c.prefArea ? "エリア " + c.prefArea : "",
      c.prefType || "",
      c.minRooms ? c.minRooms + "LDK以上" : "",
    ].filter(Boolean).join(" ／ ") || "希望条件が未設定です";
    const body = results.length
      ? `<div class="match-list">` + results.map((r) => {
          const ph = firstPhoto(r.p);
          const thumb = ph ? `<img class="prop-thumb" src="${esc(ph)}" alt="" />` : "";
          return `<div class="match-item">
            <div class="match-head">
              <span class="match-name">${thumb}${esc(r.p.name)}</span>
              <span class="match-price">${man(r.p.price)}</span>
            </div>
            <div class="match-meta">${esc(r.p.type)} / ${esc(r.p.layout || "—")} / ${Number(r.p.area || 0).toLocaleString()}㎡ / ${esc(r.p.address || "")}　<b>適合度 ${r.pct}%</b></div>
            <div class="match-score-bar"><div class="match-score-fill" style="width:${r.pct}%"></div></div>
            <div class="match-reasons">${r.reasons.map((x) => `<span class="match-reason ${x.warn ? "warn" : ""}">${esc(x.t)}</span>`).join("")}</div>
          </div>`;
        }).join("") + `</div>`
      : `<div class="empty">条件に合致する物件が見つかりませんでした（成約済は除外されます）。</div>`;
    modal.openInfo(`物件提案 — ${esc(c.name)} 様`, `<div class="match-meta" style="margin-bottom:10px;">希望条件: ${esc(condLine)}</div>${body}`);
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
      if (!v.agentId && v.propertyId) {
        const prop = data.properties.find((p) => p.id === v.propertyId);
        if (prop && prop.agentId) v.agentId = prop.agentId;
      }
      if (v.stage === "closed" && !v.closeDate) v.closeDate = todayStr();
      if (id) Object.assign(d, v);
      else data.deals.push(Object.assign({ id: uid(), createdDate: todayStr() }, v));
      save(); renderAll(); toast(id ? "商談を更新しました" : "商談を追加しました");
    });
  }

  $("#btnAddCustomer").addEventListener("click", () => openCustomerModal());
  $("#btnAddDeal").addEventListener("click", () => openDealModal());
  $("#customerSearch").addEventListener("input", renderCustomers);
  $("#btnCsvCustomers").addEventListener("click", () => {
    downloadCSV("顧客一覧-" + todayStr() + ".csv",
      ["顧客名", "電話番号", "メール", "予算", "希望エリア", "希望種別", "最低間取り", "メモ"],
      data.customers.map((c) => [c.name, c.phone, c.email, c.budget, c.prefArea, c.prefType, c.minRooms, c.wish]));
  });
  $("#btnCsvDeals").addEventListener("click", () => {
    downloadCSV("商談一覧-" + todayStr() + ".csv",
      ["商談名", "顧客", "対象物件", "担当営業", "想定価格", "ステージ", "次アクション日", "成約日"],
      data.deals.map((d) => [d.title, customerName(d.customerId), propertyName(d.propertyId), agentName(d.agentId), d.amount, dealStageMeta(d.stage).label, d.nextDate, d.closeDate]));
  });
  $("#customerTable").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-act]"); if (!btn) return;
    const id = btn.dataset.id, c = data.customers.find((x) => x.id === id); if (!c) return;
    const act = btn.dataset.act;
    if (act === "edit") openCustomerModal(id);
    else if (act === "match") openMatchModal(id);
    else if (act === "del") confirmDelete(c.name, () => {
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
  // 一覧からステージをインライン変更
  $("#dealTable").addEventListener("change", (e) => {
    const sel = e.target.closest("[data-inline-stage]"); if (!sel) return;
    setDealStage(sel.dataset.id, sel.value);
  });

  // 商談ステージを変更（成約時は成約日を自動補完）
  function setDealStage(id, stage) {
    const d = data.deals.find((x) => x.id === id); if (!d) return;
    d.stage = stage;
    if (stage === "closed" && !d.closeDate) d.closeDate = todayStr();
    save(); renderAll(); toast(`「${d.title}」を「${dealStageMeta(stage).label}」に変更`);
  }

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
  function closedDeals() { return data.deals.filter((d) => d.stage === "closed"); }
  function dealAgentId(d) {
    if (d.agentId) return d.agentId;
    const prop = data.properties.find((p) => p.id === d.propertyId);
    return prop ? prop.agentId : "";
  }

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

  function renderBarChart(el, series, opts) {
    opts = opts || {};
    if (!series.length || series.every((s) => s.amount === 0)) {
      el.innerHTML = `<div class="chart-empty">成約データがありません</div>`; return;
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
      <line class="axis-line" x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}"></line>${bars}</svg>`;
  }

  function renderHBarChart(el, rows) {
    if (!rows.length || rows.every((r) => r.amount === 0)) {
      el.innerHTML = `<div class="chart-empty">成約データがありません</div>`; return;
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

    renderTargetMeter(monthSales);
    renderLeadTime();
    renderBarChart($("#monthlyChart"), monthlySeries(6), { showCount: true });

    const rows = agentSalesRows();
    renderHBarChart($("#agentChart"), rows);
    $("#agentSalesTable tbody").innerHTML =
      rows.map((r) => `<tr>
        <td>${esc(r.name)}</td><td>${esc(r.store)}</td>
        <td class="num">${r.props}</td><td class="num">${r.count}</td><td class="num">${man(r.amount)}</td>
      </tr>`).join("") || `<tr><td colspan="5" class="empty">営業担当がありません</td></tr>`;
  }

  // 今月の売上目標 達成率メーター
  function renderTargetMeter(monthSales) {
    const target = Number((data.settings && data.settings.monthlyTarget) || 0);
    const pct = target > 0 ? Math.round((monthSales / target) * 100) : 0;
    const over = pct >= 100;
    const remain = Math.max(0, target - monthSales);
    $("#targetMeter").innerHTML = `
      <div class="meter-figures">
        <div class="meter-pct ${over ? "over" : "under"}">${target > 0 ? pct + "%" : "—"}</div>
        <div class="meter-target">今月実績 <b>${man(monthSales)}</b><br>目標 ${target > 0 ? man(target) : "未設定"}</div>
      </div>
      <div class="meter-bar"><div class="meter-fill ${over ? "over" : ""}" style="width:${Math.min(100, pct)}%"></div></div>
      <div class="meter-sub">
        <span>${over ? "🎉 目標達成！" : target > 0 ? "残り " + man(remain) : "「目標設定」から月次目標を登録してください"}</span>
        <span>${todayStr().slice(0, 7)}</span>
      </div>`;
  }

  // 成約リードタイム（問合せ→成約の日数）
  function daysBetween(a, b) {
    const d1 = new Date(a + "T00:00:00"), d2 = new Date(b + "T00:00:00");
    if (isNaN(d1) || isNaN(d2)) return null;
    return Math.round((d2 - d1) / 86400000);
  }
  function renderLeadTime() {
    const spans = closedDeals()
      .map((d) => (d.createdDate && d.closeDate ? daysBetween(d.createdDate, d.closeDate) : null))
      .filter((n) => n != null && n >= 0);
    if (!spans.length) {
      $("#leadTimeStats").innerHTML = `<div class="leadtime-note">成約データ（作成日・成約日）がありません</div>`;
      return;
    }
    const avg = Math.round(spans.reduce((s, n) => s + n, 0) / spans.length);
    const min = Math.min.apply(null, spans), max = Math.max.apply(null, spans);
    $("#leadTimeStats").innerHTML = `
      <div class="lt-stat"><div class="lt-value">${avg}<small> 日</small></div><div class="lt-label">平均リードタイム</div></div>
      <div class="lt-stat"><div class="lt-value">${min}<small> 日</small></div><div class="lt-label">最短</div></div>
      <div class="lt-stat"><div class="lt-value">${max}<small> 日</small></div><div class="lt-label">最長</div></div>
      <div class="leadtime-note">成約 ${spans.length} 件の商談作成日から成約日までの日数を集計</div>`;
  }

  $("#btnSetTarget").addEventListener("click", () => {
    modal.open("月次売上目標の設定",
      [{ name: "monthlyTarget", label: "月次売上目標（円）", type: "number", default: (data.settings && data.settings.monthlyTarget) || 0 }],
      { monthlyTarget: (data.settings && data.settings.monthlyTarget) || 0 },
      (v) => {
        if (!data.settings) data.settings = {};
        data.settings.monthlyTarget = Number(v.monthlyTarget) || 0;
        save(); renderAll(); toast("月次目標を更新しました");
      });
  });

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
        <div class="k-label">${k.label}</div><div class="k-value">${k.value}</div><div class="k-sub">${k.sub}</div></div>`).join("");

    $("#activeProps").innerHTML = activeProps.length
      ? activeProps.slice(0, 6).map((p) => { const st = propStatusMeta(p.status);
          const ph = firstPhoto(p);
          const thumb = ph ? `<img class="prop-thumb" src="${esc(ph)}" alt="" />` : "";
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
        migrate(data);
        save(); renderAll(); toast("データを読み込みました");
      } catch (err) { toast("読み込みに失敗しました（JSON形式を確認）"); }
      e.target.value = "";
    };
    reader.readAsText(file);
  });

  /* ================= 商談ボード（カンバン） ================= */
  $("#btnAddDeal2").addEventListener("click", () => openDealModal());

  function renderKanban() {
    const board = $("#kanbanBoard");
    board.innerHTML = DEAL_STAGE.map((s) => {
      const list = data.deals.filter((d) => d.stage === s.value);
      const sum = list.reduce((a, d) => a + Number(d.amount || 0), 0);
      const cards = list.map((d) => `
        <div class="kb-card" draggable="true" data-id="${d.id}">
          <div class="kc-title">${esc(d.title)}</div>
          <div class="kc-sub">${esc(customerName(d.customerId))} / ${esc(propertyName(d.propertyId))}</div>
          <div class="kc-amount">${man(d.amount)}</div>
        </div>`).join("") || `<div class="kb-empty">なし</div>`;
      return `<div class="kb-col" data-stage="${s.value}">
        <div class="kb-col-head"><span><span class="badge ${s.cls}">${s.label}</span> <span class="kb-count">${list.length}</span></span><span class="kb-sum">${sum ? man(sum) : ""}</span></div>
        <div class="kb-list">${cards}</div>
      </div>`;
    }).join("");
  }

  let dragDealId = null;
  $("#kanbanBoard").addEventListener("dragstart", (e) => {
    const card = e.target.closest(".kb-card"); if (!card) return;
    dragDealId = card.dataset.id;
    card.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", dragDealId);
  });
  $("#kanbanBoard").addEventListener("dragend", (e) => {
    const card = e.target.closest(".kb-card"); if (card) card.classList.remove("dragging");
    $$(".kb-col").forEach((c) => c.classList.remove("drop-hover"));
  });
  $("#kanbanBoard").addEventListener("dragover", (e) => {
    const col = e.target.closest(".kb-col"); if (!col) return;
    e.preventDefault(); e.dataTransfer.dropEffect = "move";
    $$(".kb-col").forEach((c) => c.classList.toggle("drop-hover", c === col));
  });
  $("#kanbanBoard").addEventListener("drop", (e) => {
    const col = e.target.closest(".kb-col"); if (!col) return;
    e.preventDefault();
    const id = dragDealId || e.dataTransfer.getData("text/plain");
    const d = data.deals.find((x) => x.id === id);
    if (d && d.stage !== col.dataset.stage) setDealStage(id, col.dataset.stage);
    dragDealId = null;
    $$(".kb-col").forEach((c) => c.classList.remove("drop-hover"));
  });
  // スマホ等: カードをタップで編集モーダル（クリックはドラッグ後には発火しない）
  $("#kanbanBoard").addEventListener("click", (e) => {
    const card = e.target.closest(".kb-card"); if (!card) return;
    openDealModal(card.dataset.id);
  });

  /* ================= グローバル検索 ================= */
  const gInput = $("#globalSearch"), gResults = $("#globalResults");
  function runGlobalSearch() {
    const q = (gInput.value || "").trim().toLowerCase();
    if (!q) { gResults.hidden = true; gResults.innerHTML = ""; return; }
    const hit = (s) => String(s || "").toLowerCase().includes(q);
    const groups = [];
    const props = data.properties.filter((p) => hit(p.name) || hit(p.code) || hit(p.address));
    if (props.length) groups.push({ label: "物件", view: "properties", input: "#propertySearch", items: props.map((p) => ({ main: p.name, sub: `${p.code} / ${p.type} / ${man(p.price)}`, term: p.name })) });
    const custs = data.customers.filter((c) => hit(c.name) || hit(c.phone) || hit(c.email));
    if (custs.length) groups.push({ label: "顧客", view: "customers", input: "#customerSearch", items: custs.map((c) => ({ main: c.name, sub: `${c.phone || ""} ${c.email || ""}`, term: c.name })) });
    const dls = data.deals.filter((d) => hit(d.title) || hit(customerName(d.customerId)));
    if (dls.length) groups.push({ label: "商談", view: "customers", input: "#customerSearch", items: dls.map((d) => ({ main: d.title, sub: `${customerName(d.customerId)} / ${dealStageMeta(d.stage).label}`, term: d.title })) });
    const ags = data.agents.filter((a) => hit(a.name) || hit(a.store) || hit(a.code));
    if (ags.length) groups.push({ label: "営業担当", view: "agents", input: "#agentSearch", items: ags.map((a) => ({ main: a.name, sub: `${a.code} / ${a.store || ""}`, term: a.name })) });

    gResults.innerHTML = groups.length
      ? groups.map((g) => `<div class="gr-group">${g.label}（${g.items.length}）</div>` +
          g.items.slice(0, 6).map((it) => `<div class="gr-item" data-view="${g.view}" data-input="${g.input}" data-term="${esc(it.term)}">
            <div>${esc(it.main)}</div><div class="gr-sub">${esc(it.sub)}</div></div>`).join("")).join("")
      : `<div class="gr-empty">「${esc(q)}」に一致する項目はありません</div>`;
    gResults.hidden = false;
  }
  gInput.addEventListener("input", runGlobalSearch);
  gInput.addEventListener("focus", () => { if (gInput.value.trim()) runGlobalSearch(); });
  gResults.addEventListener("click", (e) => {
    const item = e.target.closest(".gr-item"); if (!item) return;
    activateTab(item.dataset.view);
    const inp = $(item.dataset.input);
    if (inp) { inp.value = item.dataset.term; inp.dispatchEvent(new Event("input")); }
    gResults.hidden = true; gInput.value = "";
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".global-search-wrap")) gResults.hidden = true;
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") gResults.hidden = true; });

  /* ================= 表の並び替え（汎用・DOMベース） ================= */
  const sortState = {}; // tableId -> { col, dir }
  const numOf = (raw) => {
    const m = String(raw).replace(/[^0-9.\-]/g, "");
    return m === "" || m === "-" || m === "." ? NaN : parseFloat(m);
  };
  function sortTableDom(table) {
    const st = sortState[table.id]; if (!st) return;
    const tbody = table.tBodies[0]; if (!tbody) return;
    const rows = Array.from(tbody.rows).filter((r) => !r.querySelector("td.empty"));
    if (rows.length < 2) return;
    const val = (r) => { const td = r.cells[st.col]; if (!td) return ""; return td.dataset.sortvalue != null ? td.dataset.sortvalue : td.textContent.trim(); };
    rows.sort((a, b) => {
      const va = val(a), vb = val(b), na = numOf(va), nb = numOf(vb);
      let c;
      if (!isNaN(na) && !isNaN(nb)) c = na - nb;
      else c = String(va).localeCompare(String(vb), "ja");
      return st.dir === "desc" ? -c : c;
    });
    rows.forEach((r) => tbody.appendChild(r));
  }
  function makeSortable() {
    $$("table.data-table").forEach((table) => {
      Array.from(table.tHead.rows[0].cells).forEach((th, idx) => {
        if (th.classList.contains("actions-col") || th.classList.contains("no-sort")) return;
        th.classList.add("sortable");
        if (!th.querySelector(".sort-ind")) { const s = document.createElement("span"); s.className = "sort-ind"; th.appendChild(s); }
        th.addEventListener("click", () => {
          const cur = sortState[table.id];
          const dir = cur && cur.col === idx && cur.dir === "asc" ? "desc" : "asc";
          sortState[table.id] = { col: idx, dir };
          Array.from(table.tHead.rows[0].cells).forEach((h) => h.classList.remove("sorted-asc", "sorted-desc"));
          th.classList.add(dir === "asc" ? "sorted-asc" : "sorted-desc");
          sortTableDom(table);
        });
      });
    });
  }
  function reapplySorts() {
    Object.keys(sortState).forEach((tid) => { const t = document.getElementById(tid); if (t) sortTableDom(t); });
  }

  /* ================= 描画エントリ ================= */
  function renderAll() {
    renderDashboard();
    renderProperties();
    renderCustomers();
    renderKanban();
    renderAgents();
    renderReports();
    reapplySorts();
  }

  $("#viewingDate").value = "";
  makeSortable();
  // 前回開いていたタブを復元
  let lastTab = "dashboard";
  try { lastTab = localStorage.getItem(TAB_KEY) || "dashboard"; } catch (e) {}
  if ($(`#tabs .tab[data-view="${lastTab}"]`)) activateTab(lastTab);
  else renderAll();
})();
