/* ═══════════════════════════════════════════════════════════════
   ElectraCAD Studio — UI 層
   パレット / メニュー / ページタブ / プロパティ / DRC / BOM / AIウィザード
   ═══════════════════════════════════════════════════════════════ */
"use strict";

const UI = {};

/* ══════════════ 汎用 ══════════════ */
UI.setMsg = (msg) => {
  const el = document.getElementById("stMsg");
  if (el) { el.textContent = msg; clearTimeout(UI._msgT); UI._msgT = setTimeout(() => el.textContent = "", 4000); }
};
UI.toast = (html, ms = 3200) => {
  const el = document.getElementById("hintToast");
  el.innerHTML = html;
  el.classList.remove("hidden");
  clearTimeout(UI._toastT);
  UI._toastT = setTimeout(() => el.classList.add("hidden"), ms);
};

function h(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

/* ══════════════ シンボルパレット ══════════════ */
UI.buildPalette = (filter = "") => {
  const tree = document.getElementById("symTree");
  tree.innerHTML = "";
  const f = filter.trim().toLowerCase();
  Object.entries(SYM_CATS).forEach(([catId, cat]) => {
    const syms = SYMBOLS.filter(s => s.cat === catId &&
      (!f || s.name.toLowerCase().includes(f) || s.nameEn.toLowerCase().includes(f) || (s.desc || "").toLowerCase().includes(f)));
    if (!syms.length) return;
    const el = h(`<div class="sym-cat ${f || catId !== "misc" ? "open" : ""}">
      <div class="sym-cat-head">
        <span class="cat-arrow">▶</span>
        <span class="cat-dot" style="background:${cat.color}"></span>
        <span>${cat.name}</span>
        <span class="cat-count">${syms.length}</span>
      </div>
      <div class="sym-cat-body"></div>
    </div>`);
    el.querySelector(".sym-cat-head").addEventListener("click", () => el.classList.toggle("open"));
    const body = el.querySelector(".sym-cat-body");
    syms.forEach(sym => {
      const item = h(`<div class="sym-item" title="${sym.name} (${sym.nameEn})&#10;${sym.desc}">
        <div class="sym-thumb">${symThumbSVG(sym)}</div>
        <div class="sym-name">${sym.name}</div>
      </div>`);
      item.addEventListener("mousedown", e => {
        if (e.button !== 0) return;
        e.preventDefault();
        startGhost(sym.id);
        UI.setMsg(`${sym.name} — クリックで配置、右クリックでキャンセル`);
      });
      item.addEventListener("dblclick", () => {
        startGhost(sym.id);
      });
      body.appendChild(item);
    });
    tree.appendChild(el);
  });
};

/* ══════════════ ページタブ ══════════════ */
UI.buildPageTabs = () => {
  const wrap = document.getElementById("pageTabs");
  wrap.innerHTML = "";
  App.project.pages.forEach((pg, i) => {
    const el = h(`<div class="ptab ${i === App.pageIdx ? "active" : ""}">
      <span class="ptab-no">${pg.no}</span><span>${pg.name}</span>
      ${App.project.pages.length > 1 ? '<span class="ptab-close" title="ページを削除">×</span>' : ""}
    </div>`);
    el.addEventListener("click", e => {
      if (e.target.classList.contains("ptab-close")) {
        if (!confirm(`ページ「${pg.name}」を削除しますか？`)) return;
        commit();
        App.project.pages.splice(i, 1);
        App.project.pages.forEach((p, k) => p.no = k + 1);
        App.pageIdx = Math.max(0, Math.min(App.pageIdx, App.project.pages.length - 1));
        App.selection.clear();
        UI.refresh();
        return;
      }
      App.pageIdx = i;
      App.selection.clear();
      UI.refresh();
    });
    el.addEventListener("dblclick", e => {
      if (e.target.classList.contains("ptab-close")) return;
      const name = prompt("ページ名", pg.name);
      if (name) { commit(); pg.name = name; UI.refresh(); }
    });
    wrap.appendChild(el);
  });
};

/* ══════════════ プロパティパネル ══════════════ */
UI.showProps = (focusTag = false) => {
  const pane = document.getElementById("pane-props");
  UI.activateRightTab("props");
  const page = curPage();
  const selDevs = page.devices.filter(d => App.selection.has(d.id));
  const selWires = page.wires.filter(w => App.selection.has(w.id));
  const selTexts = page.texts.filter(t => App.selection.has(t.id));

  if (selDevs.length === 1) {
    const dev = selDevs[0];
    const sym = SYMBOLS_BY_ID[dev.sym];
    const cat = SYM_CATS[sym.cat];
    const coils = [];
    App.project.pages.forEach(pg => pg.devices.forEach(d => {
      if (SYMBOLS_BY_ID[d.sym].mirror) coils.push(d);
    }));
    pane.innerHTML = `
      <div class="prop-head">
        <div class="prop-thumb">${symThumbSVG(sym, 34)}</div>
        <div class="prop-head-txt">
          <div class="t1">${sym.name}</div>
          <div class="t2">${sym.nameEn}<span class="cat-pill" style="background:${cat.color}22;color:${cat.color}">${cat.name}</span></div>
        </div>
      </div>
      <div class="prop-row"><label>デバイスタグ (DT)</label><input id="pTag" class="mono" value="${dev.linkTo ? displayTag(dev) : (dev.tag || "")}" ${dev.linkTo ? "disabled" : ""}/></div>
      <div class="prop-row"><label>機能テキスト</label><input id="pDesc" value="${(dev.desc || "").replace(/"/g, "&quot;")}"/></div>
      <div class="prop-row"><label>型式 (部品表用)</label><input id="pType" class="mono" value="${(dev.typeRef || "").replace(/"/g, "&quot;")}" placeholder="例: MY2N-D2 DC24"/></div>
      <div class="prop-grid2">
        <div class="prop-row"><label>X (mm)</label><input id="pX" class="mono" type="number" step="5" value="${dev.x}"/></div>
        <div class="prop-row"><label>Y (mm)</label><input id="pY" class="mono" type="number" step="5" value="${dev.y}"/></div>
      </div>
      ${SYMBOLS_BY_ID[dev.sym].linked || sym.sim?.startsWith("contact") ? `
      <div class="prop-row"><label>コイルにリンク (クロスリファレンス)</label>
        <select id="pLink"><option value="">— リンクなし —</option>
        ${coils.map(c => `<option value="${c.id}" ${dev.linkTo === c.id ? "selected" : ""}>${c.tag} (${SYMBOLS_BY_ID[c.sym].name})</option>`).join("")}
        </select></div>` : ""}
      ${sym.timer ? `<div class="prop-row"><label>遅延時間 (秒)</label><input id="pDelay" class="mono" type="number" step="0.5" min="0" value="${dev.props.delay || 2}"/></div>` : ""}
      ${sym.mirror ? UI.mirrorHTML(dev) : ""}
    `;
    const bind = (id, fn) => {
      const el = pane.querySelector(id);
      if (el) el.addEventListener("change", () => { commit(); fn(el.value); UI.refresh(false); });
    };
    bind("#pTag", v => dev.tag = v.trim());
    bind("#pDesc", v => dev.desc = v.trim());
    bind("#pType", v => dev.typeRef = v.trim());
    bind("#pX", v => dev.x = snap(parseFloat(v) || dev.x));
    bind("#pY", v => dev.y = snap(parseFloat(v) || dev.y));
    bind("#pLink", v => dev.linkTo = v || null);
    bind("#pDelay", v => dev.props.delay = parseFloat(v) || 2);
    if (focusTag) { const t = pane.querySelector("#pTag"); if (t && !t.disabled) { t.focus(); t.select(); } }
    pane.querySelectorAll(".xref-item").forEach(el => {
      el.addEventListener("click", () => UI.jumpToDevice(el.dataset.target));
    });
  } else if (selDevs.length > 1 || selWires.length || selTexts.length) {
    const total = selDevs.length + selWires.length + selTexts.length;
    pane.innerHTML = `
      <div class="prop-empty">
        <div style="font-size:22px;font-weight:700;color:var(--text)">${total}</div>
        個のオブジェクトを選択中<br><br>
        デバイス ${selDevs.length} ・ 配線 ${selWires.length} ・ テキスト ${selTexts.length}
      </div>`;
  } else if (selWires.length === 1) {
    const w = selWires[0];
    pane.innerHTML = `
      <div class="prop-head"><div class="prop-head-txt"><div class="t1">配線</div><div class="t2">${w.pts.length - 1} セグメント</div></div></div>
      <div class="prop-row"><label>配線番号</label><input id="pNum" class="mono" value="${w.num || ""}"/></div>`;
    pane.querySelector("#pNum").addEventListener("change", e => { commit(); w.num = e.target.value.trim() || null; UI.refresh(false); });
  } else {
    pane.innerHTML = `
      <div class="prop-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4l16 8-7 1.5L16 20l-3 1-2.6-6L4 18V4z"/></svg><br>
        オブジェクトを選択すると<br>プロパティが表示されます<br><br>
        <b style="color:var(--text-dim)">F2</b> で AI 自動作図
      </div>`;
  }
};

UI.mirrorHTML = (coilDev) => {
  const contacts = linkedContacts(coilDev);
  if (!contacts.length) return `<div class="prop-sect">連動接点</div><div style="font-size:11.5px;color:var(--text-faint)">リンクされた接点はありません</div>`;
  return `<div class="prop-sect">連動接点 (${contacts.length})</div>
    <div class="xref-list">
      ${contacts.map(c => `<div class="xref-item" data-target="${c.id}">
        <span class="xr-tag">${SYMBOLS_BY_ID[c.sym].name}</span>
        <span class="xr-loc">${devLocation(c)}</span>
      </div>`).join("")}
    </div>`;
};

UI.jumpToDevice = (devId) => {
  const f = findDevice(devId);
  if (!f) return;
  App.pageIdx = App.project.pages.indexOf(f.page);
  App.selection.clear();
  App.selection.add(devId);
  UI.refresh();
  // ズームしてセンタリング
  const r = Editor.svg.getBoundingClientRect();
  const s = Editor.view.s;
  Editor.view.tx = r.width / 2 - f.dev.x * s;
  Editor.view.ty = r.height / 2 - f.dev.y * s;
  requestRender();
};

UI.activateRightTab = (name) => {
  document.querySelectorAll(".rtab").forEach(t => t.classList.toggle("active", t.dataset.rtab === name));
  document.querySelectorAll(".rpane").forEach(p => p.classList.toggle("active", p.id === "pane-" + name));
};

/* ══════════════ DRC パネル ══════════════ */
UI.runDRC = () => {
  UI.activateRightTab("drc");
  const pane = document.getElementById("pane-drc");
  const issues = runDRC();
  let html = `<div class="drc-run-row"><button class="btn-solid primary" id="drcRerun">再チェック</button></div>`;
  if (!issues.length) {
    html += `<div class="drc-ok"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 12.5l3 3 5-6"/></svg><br>問題は見つかりませんでした</div>`;
  } else {
    const errs = issues.filter(i => i.sev === "err").length;
    html += `<div style="font-size:11.5px;color:var(--text-dim);margin-bottom:10px">エラー ${errs} ・ 警告 ${issues.length - errs}</div>`;
    issues.forEach((iss, i) => {
      html += `<div class="drc-item ${iss.sev}" data-i="${i}">
        <span class="drc-ico">${iss.sev === "err"
          ? '<svg width="14" height="14" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="currentColor"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="#fff" stroke-width="1.6"/></svg>'
          : '<svg width="14" height="14" viewBox="0 0 16 16"><path d="M8 1.5L15 14H1L8 1.5z" fill="currentColor"/><path d="M8 6v3.5M8 11.5v1.5" stroke="#3a2b12" stroke-width="1.4"/></svg>'}</span>
        <div><div class="drc-msg">${iss.msg}</div><div class="drc-loc">ページ ${iss.page} ・ 位置 ${iss.loc}</div></div>
      </div>`;
    });
  }
  pane.innerHTML = html;
  pane.querySelector("#drcRerun").addEventListener("click", UI.runDRC);
  pane.querySelectorAll(".drc-item").forEach(el => {
    el.addEventListener("click", () => {
      const iss = issues[+el.dataset.i];
      if (iss.target) UI.jumpToDevice(iss.target);
    });
  });
  UI.setMsg(issues.length ? `DRC: ${issues.length} 件の指摘` : "DRC: 問題なし");
};

/* ══════════════ BOM パネル ══════════════ */
UI.showBOM = () => {
  UI.activateRightTab("bom");
  const pane = document.getElementById("pane-bom");
  const rows = buildBOM();
  if (!rows.length) {
    pane.innerHTML = `<div class="prop-empty">デバイスを配置すると<br>部品表が自動生成されます</div>`;
    return;
  }
  pane.innerHTML = `
    <table class="bom-table">
      <thead><tr><th>名称</th><th>型式</th><th>数</th></tr></thead>
      <tbody>${rows.map(r => `<tr title="${r.tags.join(", ")}"><td>${r.name}</td><td class="mono">${r.typeRef}</td><td>${r.tags.length}</td></tr>`).join("")}</tbody>
    </table>
    <div class="bom-actions"><button class="btn-solid" id="bomCsv">CSV 出力</button></div>`;
  pane.querySelector("#bomCsv").addEventListener("click", () => {
    downloadFile(App.project.name + "_部品表.csv", bomCSV(), "text/csv");
    UI.setMsg("部品表CSVを出力しました");
  });
};

/* ══════════════ メニュー ══════════════ */
const MENUS = {
  file: [
    { label: "新規プロジェクト", key: "", fn: () => UI.newProject() },
    { label: "開く (JSON)…", key: "", fn: () => UI.openFile() },
    { sep: true },
    { label: "保存 (ブラウザ)", key: "Ctrl+S", fn: () => { saveLocal(); UI.setMsg("ブラウザに保存しました"); } },
    { label: "エクスポート (JSON)", key: "", fn: () => downloadFile(App.project.name + ".ecad.json", JSON.stringify(App.project, null, 1)) },
    { label: "エクスポート (SVG)", key: "", fn: () => downloadFile(App.project.name + "_p" + curPage().no + ".svg", exportSheetSVG(), "image/svg+xml") },
    { sep: true },
    { label: "印刷…", key: "Ctrl+P", fn: () => UI.print() },
  ],
  edit: [
    { label: "元に戻す", key: "Ctrl+Z", fn: () => { if (undo()) UI.refresh(); } },
    { label: "やり直し", key: "Ctrl+Y", fn: () => { if (redo()) UI.refresh(); } },
    { sep: true },
    { label: "コピー", key: "Ctrl+C", fn: copySelection },
    { label: "貼り付け", key: "Ctrl+V", fn: pasteClipboard },
    { label: "削除", key: "Del", fn: deleteSelection },
    { label: "回転", key: "R", fn: rotateSelection },
    { sep: true },
    { label: "すべて選択", key: "Ctrl+A", fn: () => UI.selectAll() },
  ],
  view: [
    { label: "全体表示", key: "F", fn: zoomFit },
    { label: "100%", key: "", fn: () => { Editor.view.s = 2.2; requestRender(); updateZoomLabel(); } },
    { label: "拡大", key: "+", fn: () => UI.zoomCenter(1.25) },
    { label: "縮小", key: "−", fn: () => UI.zoomCenter(0.8) },
  ],
  insert: [
    { label: "AI自動作図…", key: "F2", fn: () => UI.openWizard() },
    { sep: true },
    { label: "ページを追加", key: "", fn: () => UI.addPage() },
    { label: "テキスト", key: "T", fn: () => UI.setTool("text") },
  ],
  project: [
    { label: "設計ルールチェック (DRC)", key: "", fn: () => UI.runDRC() },
    { label: "部品表 (BOM)", key: "", fn: () => UI.showBOM() },
    { label: "配線番号の自動付与", key: "", fn: () => { commit(); autoNumberWires(); UI.refresh(false); UI.setMsg("配線番号を付与しました"); } },
    { sep: true },
    { label: "通電シミュレーション", key: "F5", fn: () => UI.toggleSim() },
  ],
  help: [
    { label: "キーボードショートカット", key: "", fn: () => UI.showShortcuts() },
    { label: "クイックスタート", key: "", fn: () => UI.showQuickstart() },
  ],
};

UI.setupMenus = () => {
  document.querySelectorAll("#menubar .menu").forEach(m => {
    m.addEventListener("click", e => {
      e.stopPropagation();
      UI.closeDropdown();
      const items = MENUS[m.dataset.menu];
      if (!items) return;
      m.classList.add("open");
      const r = m.getBoundingClientRect();
      const dd = h(`<div class="dropdown" style="left:${r.left}px;top:${r.bottom + 4}px"></div>`);
      items.forEach(it => {
        if (it.sep) { dd.appendChild(h('<div class="dd-sep"></div>')); return; }
        const el = h(`<div class="dd-item"><span>${it.label}</span>${it.key ? `<span class="dd-key">${it.key}</span>` : ""}</div>`);
        el.addEventListener("click", () => { UI.closeDropdown(); it.fn(); });
        dd.appendChild(el);
      });
      document.getElementById("overlay-root").appendChild(dd);
      UI._openMenu = m;
    });
  });
  document.addEventListener("click", () => UI.closeDropdown());
};
UI.closeDropdown = () => {
  document.querySelectorAll(".dropdown").forEach(d => d.remove());
  if (UI._openMenu) { UI._openMenu.classList.remove("open"); UI._openMenu = null; }
};

/* ══════════════ ツール切替 ══════════════ */
UI.setTool = (tool) => {
  App.tool = tool;
  cancelDraft();
  UI.syncToolButtons();
  const modeNames = { select: "選択モード", wire: "配線モード — クリックで配線開始", pan: "パンモード", text: "テキストモード — クリックで文字入力" };
  document.getElementById("stMode").textContent = modeNames[tool] || tool;
  const cv = document.getElementById("canvas");
  cv.setAttribute("class", "tool-" + tool + (App.sim.running ? " simmode" : ""));
};
UI.syncToolButtons = () => {
  document.querySelectorAll(".rbtn.tool").forEach(b => b.classList.toggle("active", b.dataset.tool === App.tool));
};

/* ══════════════ シミュレーション ══════════════ */
UI.toggleSim = () => {
  if (App.sim.running) {
    simStop();
    document.getElementById("btnSim").classList.remove("active");
    document.getElementById("simBanner").classList.add("hidden");
    clearInterval(UI._simT);
    UI.setTool("select");
    UI.setMsg("シミュレーションを終了しました");
  } else {
    App.selection.clear();
    cancelDraft();
    simStart();
    document.getElementById("btnSim").classList.add("active");
    document.getElementById("simBanner").classList.remove("hidden");
    document.getElementById("canvas").classList.add("simmode");
    UI._simT = setInterval(() => { simSolve(); requestRender(); }, 120);
    UI.setMsg("シミュレーション実行中");
  }
  requestRender();
};

/* ══════════════ ページ / プロジェクト操作 ══════════════ */
UI.addPage = () => {
  commit();
  const pg = newPage("ページ " + (App.project.pages.length + 1), App.project.pages.length + 1);
  App.project.pages.push(pg);
  App.pageIdx = App.project.pages.length - 1;
  App.selection.clear();
  UI.refresh();
};
UI.newProject = () => {
  if (!confirm("現在のプロジェクトを破棄して新規作成しますか？\n(ブラウザ保存済みデータも上書きされます)")) return;
  App.project = newProject();
  App.pageIdx = 0;
  App.selection.clear();
  App.undoStack.length = 0;
  App.redoStack.length = 0;
  saveLocal();
  UI.refresh();
  zoomFit();
};
UI.openFile = () => {
  const inp = document.createElement("input");
  inp.type = "file";
  inp.accept = ".json,.ecad.json";
  inp.addEventListener("change", () => {
    const f = inp.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const p = JSON.parse(rd.result);
        if (!p.pages) throw new Error("bad");
        commit();
        App.project = p;
        App.pageIdx = 0;
        App.selection.clear();
        document.getElementById("projectName").value = p.name;
        UI.refresh();
        zoomFit();
        UI.setMsg("プロジェクトを読み込みました");
      } catch (e) { alert("読み込みに失敗しました: 不正なファイル形式です"); }
    };
    rd.readAsText(f);
  });
  inp.click();
};
UI.selectAll = () => {
  const page = curPage();
  App.selection.clear();
  page.devices.forEach(d => App.selection.add(d.id));
  page.wires.forEach(w => App.selection.add(w.id));
  page.texts.forEach(t => App.selection.add(t.id));
  UI.showProps();
  requestRender();
};
UI.zoomCenter = (f) => {
  const r = Editor.svg.getBoundingClientRect();
  zoomAt(r.left + r.width / 2, r.top + r.height / 2, f);
};
UI.print = () => {
  const svg = exportSheetSVG();
  const win = window.open("", "_blank");
  win.document.write(`<html><head><title>${App.project.name}</title><style>body{margin:0}svg{width:100vw;height:100vh}</style></head><body>${svg}</body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 300);
};

/* ══════════════ テキスト入力 (キャンバス上) ══════════════ */
UI.openTextInput = (clientX, clientY, wx, wy, existing = null) => {
  const root = document.getElementById("overlay-root");
  const inp = h(`<input style="position:fixed;left:${clientX}px;top:${clientY - 14}px;z-index:300;
    background:var(--panel-2);border:1px solid var(--accent);border-radius:6px;color:var(--text);
    font-size:13px;padding:5px 9px;outline:none;min-width:140px" placeholder="テキストを入力…"/>`);
  if (existing) inp.value = existing.text;
  root.appendChild(inp);
  inp.focus();
  const done = (save) => {
    const v = inp.value.trim();
    inp.remove();
    if (save && v) {
      commit();
      if (existing) existing.text = v;
      else curPage().texts.push({ id: uid("t"), x: wx, y: wy, text: v, size: 4 });
      UI.refresh(false);
    }
    UI.setTool("select");
  };
  inp.addEventListener("keydown", e => {
    if (e.key === "Enter") done(true);
    if (e.key === "Escape") done(false);
    e.stopPropagation();
  });
  inp.addEventListener("blur", () => done(true));
};

/* ══════════════ モーダル ══════════════ */
UI.openModal = ({ title, sub = "", body, foot = "", onclose = null, wide = false }) => {
  const root = document.getElementById("overlay-root");
  const bk = h(`<div class="modal-backdrop">
    <div class="modal" style="${wide ? "width:min(1020px,96vw)" : ""}">
      <div class="modal-head">
        <div><div class="m-title">${title}</div>${sub ? `<div class="m-sub">${sub}</div>` : ""}</div>
        <button class="modal-close">✕</button>
      </div>
      <div class="modal-body"></div>
      <div class="modal-foot" style="${foot ? "" : "display:none"}"></div>
    </div>
  </div>`);
  bk.querySelector(".modal-body").append(body);
  if (foot) bk.querySelector(".modal-foot").append(foot);
  const close = () => { bk.remove(); if (onclose) onclose(); };
  bk.querySelector(".modal-close").addEventListener("click", close);
  bk.addEventListener("mousedown", e => { if (e.target === bk) close(); });
  root.appendChild(bk);
  return { close, el: bk };
};

UI.showShortcuts = () => {
  const rows = [
    ["V / Esc", "選択ツール"], ["W", "配線ツール"], ["H / Space", "パン"], ["T", "テキスト"],
    ["R", "回転"], ["Del", "削除"], ["F", "全体表示"], ["+ / −", "ズーム"],
    ["Ctrl+Z / Y", "元に戻す / やり直し"], ["Ctrl+C / V", "コピー / 貼り付け"],
    ["Ctrl+A", "すべて選択"], ["Ctrl+S", "保存"], ["F2", "AI自動作図"], ["F5", "シミュレーション"],
    ["矢印キー", "選択を5mm移動"], ["ホイール", "ズーム"], ["中ボタンドラッグ", "パン"],
  ];
  const body = h(`<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 26px">
    ${rows.map(([k, d]) => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line-soft)">
      <span style="color:var(--text-dim)">${d}</span><kbd style="font-family:var(--mono);font-size:11px;background:var(--panel-3);border:1px solid var(--line);border-radius:4px;padding:2px 7px">${k}</kbd></div>`).join("")}
  </div>`);
  UI.openModal({ title: "キーボードショートカット", body });
};

UI.showQuickstart = () => {
  const body = h(`<div style="line-height:1.9;font-size:13px">
    <p><b style="color:var(--accent)">① AI自動作図 (推奨)</b><br>
    右上の「AI自動作図」から <b>インプット機器 → ロジック機器 → アウトプット機器</b> を選ぶだけで、電気設計のセオリーに則った回路が自動生成されます。</p>
    <p><b style="color:var(--accent)">② 手動作図</b><br>
    左のライブラリからシンボルをクリック → キャンバスに配置。<kbd>W</kbd> で配線モードにして赤いピン同士を接続します。</p>
    <p><b style="color:var(--accent)">③ シミュレーション</b><br>
    <kbd>F5</kbd> で通電シミュレーション。ボタンやスイッチをクリックすると、通電経路が緑色で表示され、リレーやランプが動作します。</p>
    <p><b style="color:var(--accent)">④ 検図・出力</b><br>
    DRCで設計ミスを自動検出。部品表CSV・SVG図面を出力できます。</p>
  </div>`);
  UI.openModal({ title: "クイックスタート", sub: "3分でわかる ElectraCAD Studio", body });
};

/* ══════════════ AI 自動作図ウィザード ══════════════ */
UI.openWizard = () => {
  const state = {
    step: 0,
    inputs: new Map(), logics: new Map(), outputs: new Map(),
    opts: { selfHold: true, lampFb: false, autoNum: true },
  };
  const stepsDef = [
    { key: "inputs", title: "インプット機器", sub: "操作スイッチ・センサなど、回路の入力となる機器を選択", cat: "input" },
    { key: "logics", title: "ロジック機器", sub: "リレー・タイマ・PLCなど、制御の中枢となる機器を選択 (省略可)", cat: "logic" },
    { key: "outputs", title: "アウトプット機器", sub: "モータ・ランプ・バルブなど、動作させたい機器を選択", cat: "output" },
    { key: "confirm", title: "AI 生成", sub: "選択内容を確認して回路を自動生成" },
  ];
  // ウィザードに出すシンボル (ロジックはコイル系のみ)
  const wizSyms = {
    input: SYMBOLS.filter(s => s.cat === "input"),
    logic: SYMBOLS.filter(s => ["coil", "cont_coil", "timer_on", "timer_off", "safety_relay", "plc_di"].includes(s.id))
      .map(s => s.id === "plc_di" ? { ...s, name: "PLC制御", desc: "入出力をPLCに割付け" } : s),
    output: SYMBOLS.filter(s => s.cat === "output" && s.id !== "main_cont"),
  };

  const body = h(`<div></div>`);
  const foot = h(`<div style="display:flex;gap:10px;width:100%">
    <button class="btn-solid" id="wzBack">戻る</button>
    <span style="flex:1"></span>
    <button class="btn-solid" id="wzSkip">スキップ</button>
    <button class="btn-solid primary" id="wzNext">次へ →</button>
  </div>`);
  const modal = UI.openModal({
    title: `<svg width="17" height="17" viewBox="0 0 16 16" style="vertical-align:-2px;margin-right:6px"><path d="M8 1l1.8 4.2L14 7l-4.2 1.8L8 13 6.2 8.8 2 7l4.2-1.8L8 1zm5 9l.9 2.1L16 13l-2.1.9L13 16l-.9-2.1L10 13l2.1-.9L13 10z" fill="#4da3ff"/></svg>AI 自動作図`,
    sub: "機器を選ぶだけで、電気設計のセオリーに基づいた回路図を自動生成します",
    body, foot, wide: true,
  });

  function stepsHTML() {
    return `<div class="wiz-steps">${stepsDef.map((s, i) => `
      <div class="wiz-step ${i === state.step ? "active" : ""} ${i < state.step ? "done" : ""}">
        <div class="ws-dot">${i < state.step ? "✓" : i + 1}</div>
        <div class="ws-label">${s.title}</div>
      </div>`).join("")}</div>`;
  }

  function cardsHTML(catKey, selMap) {
    return `<div class="wiz-cards">${wizSyms[catKey].map(sym => {
      const qty = selMap.get(sym.id) || 0;
      return `<div class="wiz-card ${qty ? "sel" : ""}" data-id="${sym.id}">
        <span class="wc-qty">${qty}</span>
        <div class="wc-thumb">${symThumbSVG(sym, 52)}</div>
        <div class="wc-name">${sym.name}</div>
        <div class="wc-desc">${sym.desc}</div>
        <div class="wiz-qtyrow"><button data-q="-1">−</button><button data-q="1">＋</button></div>
      </div>`;
    }).join("")}</div>`;
  }

  function render() {
    const def = stepsDef[state.step];
    let inner = stepsHTML();
    inner += `<div style="margin-bottom:12px"><div style="font-size:14px;font-weight:700">${def.title}</div>
      <div style="font-size:12px;color:var(--text-dim);margin-top:3px">${def.sub}</div></div>`;
    if (def.key === "confirm") {
      const sum = (map, label) => {
        const items = [...map.entries()].filter(([, q]) => q > 0);
        if (!items.length) return `<div class="wiz-sum-row"><span style="font-size:11.5px;color:var(--text-faint)">${label}: なし</span></div>`;
        return `<div class="wiz-sum-row">${items.map(([id, q]) =>
          `<span class="wiz-pill">${SYMBOLS_BY_ID[id] ? SYMBOLS_BY_ID[id].name : id} <b>×${q}</b></span>`).join("")}</div>`;
      };
      inner += `<div class="wiz-summary">
        <h4>選択内容</h4>
        ${sum(state.inputs, "インプット")}${sum(state.logics, "ロジック")}${sum(state.outputs, "アウトプット")}
      </div>
      <div class="wiz-ai-note">
        <svg viewBox="0 0 16 16"><path d="M8 1l1.8 4.2L14 7l-4.2 1.8L8 13 6.2 8.8 2 7l4.2-1.8L8 1z" fill="currentColor"/></svg>
        <div>AIが以下のセオリーを適用します: 非常停止・保護機器は<b>電源直下の安全チェーン</b>に直列配置 /
        起動入力は<b>並列</b>・停止入力は<b>直列</b> / 三相モータには<b>主回路ページ・遮断器・接触器を自動追加</b> /
        デバイスタグ・配線番号・クロスリファレンスを自動採番。</div>
      </div>
      <div class="wiz-opts">
        <div class="wiz-opt ${state.opts.selfHold ? "sel" : ""}" data-opt="selfHold"><span class="wo-check"></span><span class="wo-txt"><span class="t">自己保持回路</span><br><span class="d">押しボタン起動を保持 (3ワイヤ制御)</span></span></div>
        <div class="wiz-opt ${state.opts.lampFb ? "sel" : ""}" data-opt="lampFb"><span class="wo-check"></span><span class="wo-txt"><span class="t">動作表示灯を追加</span><br><span class="d">各コイルの動作をランプ表示</span></span></div>
        <div class="wiz-opt ${state.opts.autoNum ? "sel" : ""}" data-opt="autoNum"><span class="wo-check"></span><span class="wo-txt"><span class="t">配線番号の自動付与</span><br><span class="d">ネット単位で線番を採番</span></span></div>
      </div>`;
    } else {
      inner += cardsHTML(def.cat, state[def.key]);
    }
    body.innerHTML = inner;

    // カードイベント
    body.querySelectorAll(".wiz-card").forEach(card => {
      const id = card.dataset.id;
      const map = state[stepsDef[state.step].key];
      card.addEventListener("click", e => {
        const qbtn = e.target.closest("[data-q]");
        if (qbtn) {
          const nq = Math.max(0, Math.min(9, (map.get(id) || 0) + parseInt(qbtn.dataset.q)));
          if (nq === 0) map.delete(id); else map.set(id, nq);
        } else {
          if (map.has(id)) map.delete(id); else map.set(id, 1);
        }
        render();
      });
    });
    body.querySelectorAll(".wiz-opt").forEach(opt => {
      opt.addEventListener("click", () => {
        state.opts[opt.dataset.opt] = !state.opts[opt.dataset.opt];
        render();
      });
    });
    // フッター
    foot.querySelector("#wzBack").style.visibility = state.step === 0 ? "hidden" : "visible";
    foot.querySelector("#wzSkip").style.display = stepsDef[state.step].key === "logics" ? "" : "none";
    foot.querySelector("#wzNext").textContent = state.step === stepsDef.length - 1 ? "⚡ 回路を生成" : "次へ →";
  }

  foot.querySelector("#wzBack").addEventListener("click", () => { if (state.step > 0) { state.step--; render(); } });
  foot.querySelector("#wzSkip").addEventListener("click", () => { state.step++; render(); });
  foot.querySelector("#wzNext").addEventListener("click", () => {
    if (state.step < stepsDef.length - 1) {
      // 入力チェック
      if (stepsDef[state.step].key === "inputs" && ![...state.inputs.values()].some(v => v > 0)) {
        UI.toast("⚠ インプット機器を1つ以上選択してください");
        return;
      }
      if (stepsDef[state.step].key === "outputs" && ![...state.outputs.values()].some(v => v > 0)) {
        UI.toast("⚠ アウトプット機器を1つ以上選択してください");
        return;
      }
      state.step++;
      render();
    } else {
      // 生成実行
      body.innerHTML = `${stepsHTML()}<div class="wiz-generating">
        <div class="gen-ring"></div>
        <div class="gen-msg">AI が回路を設計しています…</div>
        <div class="gen-sub" id="genSub">回路トポロジを解析中</div>
      </div>`;
      foot.style.visibility = "hidden";
      const msgs = ["回路トポロジを解析中", "安全チェーンを構成中", "ラング配置を最適化中", "デバイスタグを採番中", "配線番号を付与中", "クロスリファレンスを生成中"];
      let mi = 0;
      const msgT = setInterval(() => {
        const el = body.querySelector("#genSub");
        if (el && mi < msgs.length) el.textContent = msgs[mi++];
      }, 260);
      setTimeout(() => {
        clearInterval(msgT);
        commit();
        const sel = {
          inputs: [...state.inputs.entries()].map(([id, qty]) => ({ id, qty })),
          logics: [...state.logics.entries()].map(([id, qty]) => ({ id, qty })),
          outputs: [...state.outputs.entries()].map(([id, qty]) => ({ id, qty })),
          opts: state.opts,
        };
        let result;
        try {
          result = aiGenerate(sel);
        } catch (err) {
          console.error(err);
          modal.close();
          UI.toast("⚠ 生成中にエラーが発生しました: " + err.message, 5000);
          return;
        }
        App.pageIdx = result.pageIdxs[0];
        App.selection.clear();
        modal.close();
        UI.refresh();
        zoomFit();
        UI.toast(`✨ AI回路生成が完了しました — ${result.report[result.report.length - 1]}`, 4500);
        // レポートモーダル
        const rbody = h(`<div style="line-height:1.9;font-size:12.5px">
          <div style="font-weight:700;margin-bottom:8px;color:var(--ok)">✓ 生成完了</div>
          <ul style="padding-left:18px;color:var(--text-dim)">${result.report.map(r => `<li>${r}</li>`).join("")}</ul>
          <div style="margin-top:12px;padding:10px 13px;background:var(--panel-2);border-radius:8px;font-size:12px">
            💡 <b>F5</b> で通電シミュレーションを実行して動作を確認できます。DRC で検図も可能です。
          </div></div>`);
        UI.openModal({ title: "AI 設計レポート", body: rbody });
      }, 1700);
    }
  });

  render();
};

/* ══════════════ キーボード ══════════════ */
UI.setupKeys = () => {
  window.addEventListener("keydown", e => {
    const inInput = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName);
    if (inInput) return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key === "z") { e.preventDefault(); if (undo()) UI.refresh(); return; }
    if (ctrl && (e.key === "y" || (e.shiftKey && e.key === "Z"))) { e.preventDefault(); if (redo()) UI.refresh(); return; }
    if (ctrl && e.key === "c") { copySelection(); return; }
    if (ctrl && e.key === "v") { pasteClipboard(); return; }
    if (ctrl && e.key === "a") { e.preventDefault(); UI.selectAll(); return; }
    if (ctrl && e.key === "s") { e.preventDefault(); saveLocal(); UI.setMsg("ブラウザに保存しました"); return; }
    if (ctrl && e.key === "p") { e.preventDefault(); UI.print(); return; }
    switch (e.key) {
      case "Delete": case "Backspace": deleteSelection(); break;
      case "Escape":
        if (App.sim.running) { UI.toggleSim(); break; }
        if (Editor.wireDraft || Editor.ghost) cancelDraft();
        else { App.selection.clear(); UI.showProps(); requestRender(); }
        UI.setTool("select");
        break;
      case "v": case "V": UI.setTool("select"); break;
      case "w": case "W": UI.setTool("wire"); break;
      case "h": case "H": UI.setTool("pan"); break;
      case "t": case "T": UI.setTool("text"); break;
      case "r": case "R": rotateSelection(); break;
      case "f": case "F": zoomFit(); break;
      case "+": case "=": UI.zoomCenter(1.25); break;
      case "-": UI.zoomCenter(0.8); break;
      case "F2": e.preventDefault(); UI.openWizard(); break;
      case "F5": e.preventDefault(); UI.toggleSim(); break;
      case "ArrowLeft": if (App.selection.size) { e.preventDefault(); nudgeSelection(-GRID, 0); } break;
      case "ArrowRight": if (App.selection.size) { e.preventDefault(); nudgeSelection(GRID, 0); } break;
      case "ArrowUp": if (App.selection.size) { e.preventDefault(); nudgeSelection(0, -GRID); } break;
      case "ArrowDown": if (App.selection.size) { e.preventDefault(); nudgeSelection(0, GRID); } break;
      case " ":
        if (!Editor.spaceHeld) { Editor.spaceHeld = true; document.getElementById("canvas").style.cursor = "grab"; }
        e.preventDefault();
        break;
    }
  });
  window.addEventListener("keyup", e => {
    if (e.key === " ") { Editor.spaceHeld = false; document.getElementById("canvas").style.cursor = ""; }
  });
};

/* ══════════════ リフレッシュ / ブート ══════════════ */
UI.refresh = (rebuildTabs = true) => {
  if (rebuildTabs !== false) UI.buildPageTabs();
  UI.showProps();
  requestRender();
};

function boot() {
  App.project = loadLocal() || demoProject();
  document.getElementById("projectName").value = App.project.name;
  document.getElementById("projectName").addEventListener("change", e => {
    App.project.name = e.target.value.trim() || "無題プロジェクト";
    saveLocal();
    requestRender();
  });

  setupEditor();
  UI.buildPalette();
  UI.buildPageTabs();
  UI.setupMenus();
  UI.setupKeys();
  UI.showProps();

  document.getElementById("symSearch").addEventListener("input", e => UI.buildPalette(e.target.value));
  document.querySelectorAll(".rbtn.tool").forEach(b => b.addEventListener("click", () => UI.setTool(b.dataset.tool)));
  document.getElementById("btnUndo").addEventListener("click", () => { if (undo()) UI.refresh(); });
  document.getElementById("btnRedo").addEventListener("click", () => { if (redo()) UI.refresh(); });
  document.getElementById("btnRotate").addEventListener("click", rotateSelection);
  document.getElementById("btnDelete").addEventListener("click", deleteSelection);
  document.getElementById("btnWireNum").addEventListener("click", () => { commit(); autoNumberWires(); UI.refresh(false); UI.setMsg("配線番号を付与しました"); });
  document.getElementById("btnDRC").addEventListener("click", UI.runDRC);
  document.getElementById("btnBOM").addEventListener("click", UI.showBOM);
  document.getElementById("btnSim").addEventListener("click", UI.toggleSim);
  document.getElementById("btnSave").addEventListener("click", () => { saveLocal(); UI.setMsg("ブラウザに保存しました"); });
  document.getElementById("btnAIWizard").addEventListener("click", UI.openWizard);
  document.getElementById("btnZoomIn").addEventListener("click", () => UI.zoomCenter(1.25));
  document.getElementById("btnZoomOut").addEventListener("click", () => UI.zoomCenter(0.8));
  document.getElementById("btnZoomFit").addEventListener("click", zoomFit);
  document.getElementById("zoomLabel").addEventListener("click", () => { Editor.view.s = 2.2; requestRender(); updateZoomLabel(); });
  document.getElementById("btnAddPage").addEventListener("click", UI.addPage);
  document.querySelectorAll(".rtab").forEach(t => t.addEventListener("click", () => {
    if (t.dataset.rtab === "drc") UI.runDRC();
    else if (t.dataset.rtab === "bom") UI.showBOM();
    else UI.activateRightTab("props");
  }));

  UI.setTool("select");
  zoomFit();

  // 初回のみクイックスタートのヒント
  if (!localStorage.getItem("electracad.seen")) {
    localStorage.setItem("electracad.seen", "1");
    setTimeout(() => UI.toast(`ようこそ！ <b>AI自動作図</b> ボタン (または <kbd>F2</kbd>) で回路を自動生成できます`, 6000), 600);
  }
}

/** 初回起動用のデモプロジェクト (AI生成のサンプル) */
function demoProject() {
  App.project = newProject("サンプル — コンベア制御盤");
  try {
    aiGenerate({
      inputs: [{ id: "estop", qty: 1 }, { id: "pb_no", qty: 1 }, { id: "pb_nc", qty: 1 }, { id: "prox", qty: 1 }],
      logics: [{ id: "coil", qty: 1 }, { id: "cont_coil", qty: 1 }],
      outputs: [{ id: "lamp", qty: 1 }, { id: "motor3", qty: 1 }],
      opts: { selfHold: true, lampFb: false, autoNum: true },
    });
    // デモでは生成ページのみ残す
    App.project.pages.shift();
    App.project.pages.forEach((p, i) => p.no = i + 1);
  } catch (e) {
    console.error("demo generation failed", e);
  }
  App.pageIdx = 0;
  return App.project;
}

window.addEventListener("DOMContentLoaded", boot);
