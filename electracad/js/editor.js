/* ═══════════════════════════════════════════════════════════════
   ElectraCAD Studio — エディタ (SVGレンダリング & インタラクション)
   ═══════════════════════════════════════════════════════════════ */
"use strict";

const INK = "#1b2334";        // シート上の描画色
const INK_SOFT = "#5a6579";   // 補助テキスト
const SEL = "#1f7ae0";        // 選択色
const SIM_P = "#0aa64b";      // 通電(+)
const SIM_N = "#2f6fd6";      // 通電(0V)

const Editor = {
  svg: null,
  view: { tx: 40, ty: 30, s: 2.2 },
  layers: {},
  hover: { devId: null, pin: null },
  drag: null,            // 進行中の操作
  wireDraft: null,       // 配線作図中 { pts:[[x,y]...], cur:[x,y] }
  ghost: null,           // ライブラリからの配置ゴースト { symId, x, y, rot }
  renderQueued: false,
};

/* ══════════════ 座標変換 ══════════════ */
function screenToWorld(clientX, clientY) {
  const r = Editor.svg.getBoundingClientRect();
  const { tx, ty, s } = Editor.view;
  return { x: (clientX - r.left - tx) / s, y: (clientY - r.top - ty) / s };
}
function zoomAt(clientX, clientY, factor) {
  const r = Editor.svg.getBoundingClientRect();
  const v = Editor.view;
  const px = clientX - r.left, py = clientY - r.top;
  const ns = Math.max(0.35, Math.min(12, v.s * factor));
  v.tx = px - (px - v.tx) * (ns / v.s);
  v.ty = py - (py - v.ty) * (ns / v.s);
  v.s = ns;
  requestRender();
  updateZoomLabel();
}
function zoomFit() {
  const r = Editor.svg.getBoundingClientRect();
  const pad = 36;
  const s = Math.min((r.width - pad * 2) / SHEET.w, (r.height - pad * 2) / SHEET.h);
  Editor.view.s = s;
  Editor.view.tx = (r.width - SHEET.w * s) / 2;
  Editor.view.ty = (r.height - SHEET.h * s) / 2;
  requestRender();
  updateZoomLabel();
}
function updateZoomLabel() {
  const el = document.getElementById("zoomLabel");
  if (el) el.textContent = Math.round(Editor.view.s / 2.2 * 100) + "%";
}

/* ══════════════ レンダリング ══════════════ */
function requestRender() {
  if (Editor.renderQueued) return;
  Editor.renderQueued = true;
  requestAnimationFrame(() => { Editor.renderQueued = false; renderAll(); });
}

function renderAll() {
  const svg = Editor.svg;
  if (!svg) return;
  const page = curPage();
  const { tx, ty, s } = Editor.view;
  const world = svg.querySelector("#world");
  world.setAttribute("transform", `translate(${tx},${ty}) scale(${s})`);
  Editor.layers.sheet.innerHTML = sheetSVG(page);
  Editor.layers.wires.innerHTML = wiresSVG(page);
  Editor.layers.devices.innerHTML = devicesSVG(page);
  Editor.layers.texts.innerHTML = textsSVG(page);
  Editor.layers.overlay.innerHTML = overlaySVG(page);
  updateStatusCount();
}

/* ── シート (図枠 + グリッド + 表題欄) ── */
function sheetSVG(page) {
  const { w, h, margin: m, cols, rows } = SHEET;
  let out = "";
  // 影 + 用紙
  out += `<rect x="2.5" y="3.5" width="${w}" height="${h}" fill="rgba(0,0,0,.45)" rx="1"/>`;
  out += `<rect x="0" y="0" width="${w}" height="${h}" fill="#f7f8f5" rx="0.5"/>`;
  // グリッド
  let grid = "";
  for (let x = m; x <= w - m; x += GRID) grid += `M${x},${m} V${h - m}`;
  for (let y = m; y <= h - m; y += GRID) grid += `M${m},${y} H${w - m}`;
  out += `<path d="${grid}" stroke="rgba(30,50,90,.055)" stroke-width="0.3" fill="none"/>`;
  let grid2 = "";
  for (let x = m; x <= w - m; x += GRID * 4) grid2 += `M${x},${m} V${h - m}`;
  for (let y = m; y <= h - m; y += GRID * 4) grid2 += `M${m},${y} H${w - m}`;
  out += `<path d="${grid2}" stroke="rgba(30,50,90,.09)" stroke-width="0.3" fill="none"/>`;
  // 図枠 (二重線)
  out += `<rect x="${m}" y="${m}" width="${w - 2 * m}" height="${h - 2 * m}" fill="none" stroke="${INK}" stroke-width="0.7"/>`;
  out += `<rect x="${m - 5}" y="${m - 5}" width="${w - 2 * m + 10}" height="${h - 2 * m + 10}" fill="none" stroke="${INK}" stroke-width="0.35"/>`;
  // 列参照 (0-9) / 行参照 (A-F)
  const cw = (w - 2 * m) / cols, rh = (h - 2 * m) / rows;
  for (let i = 0; i < cols; i++) {
    const cx = m + cw * i + cw / 2;
    out += `<text x="${cx}" y="${m - 1.2}" font-size="3.4" text-anchor="middle" fill="${INK_SOFT}" font-family="monospace">${i}</text>`;
    out += `<text x="${cx}" y="${h - m + 4}" font-size="3.4" text-anchor="middle" fill="${INK_SOFT}" font-family="monospace">${i}</text>`;
    if (i) out += `<path d="M${m + cw * i},${m - 5} V${m}" stroke="${INK_SOFT}" stroke-width="0.25"/><path d="M${m + cw * i},${h - m} V${h - m + 5}" stroke="${INK_SOFT}" stroke-width="0.25"/>`;
  }
  for (let i = 0; i < rows; i++) {
    const cy = m + rh * i + rh / 2 + 1.2;
    const ch = String.fromCharCode(65 + i);
    out += `<text x="${m - 2.6}" y="${cy}" font-size="3.4" text-anchor="middle" fill="${INK_SOFT}" font-family="monospace">${ch}</text>`;
    out += `<text x="${w - m + 2.6}" y="${cy}" font-size="3.4" text-anchor="middle" fill="${INK_SOFT}" font-family="monospace">${ch}</text>`;
    if (i) out += `<path d="M${m - 5},${m + rh * i} H${m}" stroke="${INK_SOFT}" stroke-width="0.25"/><path d="M${w - m},${m + rh * i} H${w - m + 5}" stroke="${INK_SOFT}" stroke-width="0.25"/>`;
  }
  // 表題欄
  const tbW = 130, tbH = 26, tbX = w - m - tbW, tbY = h - m - tbH;
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  out += `<g font-family="sans-serif">
    <rect x="${tbX}" y="${tbY}" width="${tbW}" height="${tbH}" fill="#fff" stroke="${INK}" stroke-width="0.5"/>
    <path d="M${tbX},${tbY + 9} H${tbX + tbW} M${tbX + 44},${tbY} V${tbY + tbH} M${tbX + 96},${tbY + 9} V${tbY + tbH} M${tbX + 96},${tbY + 17.5} H${tbX + tbW} M${tbX + 44},${tbY + 17.5} H${tbX + 96}" stroke="${INK}" stroke-width="0.3"/>
    <text x="${tbX + 3}" y="${tbY + 6.2}" font-size="4.4" fill="${INK}" font-weight="bold">${escXML(App.project.name)}</text>
    <text x="${tbX + 3}" y="${tbY + 15}" font-size="2.7" fill="${INK_SOFT}">作成</text>
    <text x="${tbX + 3}" y="${tbY + 18.6}" font-size="3.2" fill="${INK}">${dateStr}</text>
    <text x="${tbX + 3}" y="${tbY + 24}" font-size="2.7" fill="${INK_SOFT}">ElectraCAD Studio</text>
    <text x="${tbX + 47}" y="${tbY + 15}" font-size="2.7" fill="${INK_SOFT}">ページ名</text>
    <text x="${tbX + 47}" y="${tbY + 20.5}" font-size="3.8" fill="${INK}" font-weight="bold">${escXML(page.name)}</text>
    <text x="${tbX + 99}" y="${tbY + 15}" font-size="2.7" fill="${INK_SOFT}">ページ</text>
    <text x="${tbX + 99}" y="${tbY + 24}" font-size="5" fill="${INK}" font-weight="bold">${page.no} / ${App.project.pages.length}</text>
    <text x="${tbX + 99 + 17}" y="${tbY + 24}" font-size="2.9" fill="${INK_SOFT}">A3</text>
  </g>`;
  return out;
}

/* ── ワイヤ ── */
function wiresSVG(page) {
  let out = "";
  const sim = App.sim.running ? App.sim.energized : null;
  page.wires.forEach(w => {
    const d = "M" + w.pts.map(p => p[0] + "," + p[1]).join(" L");
    let color = INK, sw = 0.55;
    if (sim && sim.wireNet) {
      const net = sim.wireNet.get(w.id);
      if (sim.pNets.has(net) || sim.acNets.has(net)) { color = SIM_P; sw = 0.9; }
      else if (sim.nNets.has(net)) { color = SIM_N; sw = 0.9; }
    }
    const selected = App.selection.has(w.id);
    if (selected) out += `<path d="${d}" stroke="${SEL}" stroke-width="2.2" fill="none" opacity="0.28" stroke-linecap="round"/>`;
    out += `<path d="${d}" stroke="${color}" stroke-width="${sw}" fill="none" data-id="${w.id}" class="wire"/>`;
    // 当たり判定用の太い透明パス
    out += `<path d="${d}" stroke="rgba(0,0,0,0)" stroke-width="4" fill="none" data-id="${w.id}" class="wire-hit"/>`;
    // 配線番号 (numShow=false のワイヤはネット内の代表ワイヤに表示を譲る)
    if (w.num && w.numShow !== false) {
      const [mx, my, horiz] = wireLabelPos(w);
      out += `<text x="${mx}" y="${my}" font-size="3" fill="#7a4ec2" font-family="monospace" text-anchor="middle"${horiz ? "" : ` transform="rotate(-90 ${mx} ${my})"`}>${escXML(w.num)}</text>`;
    }
  });
  // ジャンクションドット
  junctionDots(page).forEach(([x, y]) => {
    let color = INK;
    if (sim && sim.wireNet) { /* 色はワイヤに追従させる程度で省略 */ }
    out += `<circle cx="${x}" cy="${y}" r="1.05" fill="${color}"/>`;
  });
  return out;
}
function wireLabelPos(w) {
  // 最長区間の中点にラベル
  let best = 0, bi = 0;
  for (let i = 0; i < w.pts.length - 1; i++) {
    const len = Math.abs(w.pts[i + 1][0] - w.pts[i][0]) + Math.abs(w.pts[i + 1][1] - w.pts[i][1]);
    if (len > best) { best = len; bi = i; }
  }
  const a = w.pts[bi], b = w.pts[bi + 1];
  const horiz = Math.abs(b[1] - a[1]) < 0.01;
  return [(a[0] + b[0]) / 2 + (horiz ? 0 : -1.8), (a[1] + b[1]) / 2 - 1.4, horiz];
}

/* ── デバイス ── */
function devicesSVG(page) {
  let out = "";
  const simOn = App.sim.running;
  page.devices.forEach(dev => {
    const sym = SYMBOLS_BY_ID[dev.sym];
    if (!sym) return;
    const selected = App.selection.has(dev.id);
    const hovered = Editor.hover.devId === dev.id;
    let color = INK;
    let extra = "";
    if (simOn) {
      const st = simDevVisual(dev, sym);
      if (st.color) color = st.color;
      extra = st.extra || "";
    }
    out += `<g transform="translate(${dev.x},${dev.y}) rotate(${dev.rot || 0})" data-id="${dev.id}" class="device" style="color:${color}">`;
    if (selected || hovered) {
      const [bx, by, bw, bh] = sym.bounds;
      out += `<rect x="${bx - 2}" y="${by - 2}" width="${bw + 4}" height="${bh + 4}" fill="${selected ? "rgba(31,122,224,.10)" : "rgba(31,122,224,.05)"}" stroke="${SEL}" stroke-width="${selected ? 0.5 : 0.3}" stroke-dasharray="${selected ? "none" : "1.5 1.2"}" rx="1"/>`;
    }
    out += extra;
    out += symBodySVG(sym, { strokeWidth: 1.15 * 0.42 }); // 画面上で約0.5mm相当
    out += `</g>`;
    // タグ・機能テキスト (回転に追従させず水平表示)
    out += devLabelsSVG(dev, sym);
    // コイルの接点ミラー
    if (sym.mirror) out += mirrorSVG(dev);
  });
  return out;
}

function simDevVisual(dev, sym) {
  const en = !!App.sim.states[dev.id];
  const t = App.sim.timers[dev.id];
  switch (sym.sim) {
    case "contact_no": case "contact_nc": case "contact3_no": {
      const act = simActiveState(dev);
      return { color: act ? SIM_P : null };
    }
    case "coil":
      return { color: (t ? t.output : en) ? SIM_P : null };
    case "load": {
      if (!en) return {};
      if (dev.sym === "lamp") return { color: "#c77b00", extra: `<circle cx="0" cy="10" r="7.5" fill="rgba(255,190,60,.4)"/>` };
      return { color: "#c77b00" };
    }
    case "load3":
      return en ? { color: "#c77b00", extra: `<circle cx="0" cy="21" r="11.5" fill="rgba(255,190,60,.28)"/>` } : {};
    default: return {};
  }
}

function devLabelsSVG(dev, sym) {
  const b = devBounds(dev);
  const tag = displayTag(dev);
  let out = "";
  const labelX = b.x - 2.2, labelYc = b.y + b.h / 2;
  if (tag) {
    out += `<text x="${labelX}" y="${labelYc - 0.6}" font-size="3.6" text-anchor="end" fill="${INK}" font-weight="600" font-family="monospace">${escXML(tag)}</text>`;
  }
  if (dev.desc) {
    out += `<text x="${labelX}" y="${labelYc + (tag ? 3.4 : 0.8)}" font-size="2.8" text-anchor="end" fill="${INK_SOFT}">${escXML(dev.desc)}</text>`;
  }
  // リンク接点のクロスリファレンス (親コイル位置)
  if (dev.linkTo) {
    const f = findDevice(dev.linkTo);
    if (f) {
      out += `<text x="${b.x + b.w + 2}" y="${labelYc + 1}" font-size="2.6" fill="#7a4ec2" font-family="monospace">${devLocation(f.dev)}</text>`;
    }
  }
  return out;
}

/** コイル下の接点ミラー (EPLAN流クロスリファレンス表) */
function mirrorSVG(coilDev) {
  const contacts = linkedContacts(coilDev);
  if (!contacts.length) return "";
  const x = coilDev.x, y0 = coilDev.y + 24;
  let out = `<g font-family="monospace">`;
  out += `<path d="M${x},${coilDev.y + 20} V${y0}" stroke="${INK_SOFT}" stroke-width="0.2" stroke-dasharray="1 1"/>`;
  contacts.slice(0, 4).forEach((c, i) => {
    const cy = y0 + i * 4.4;
    const csym = SYMBOLS_BY_ID[c.sym];
    // ミニ接点グリフ
    if (csym.sim === "contact_nc") {
      out += `<path d="M${x - 3.5},${cy + 1.5} h2.2 l2.6,-2.8 m0,2.8 h-0.6" stroke="${INK_SOFT}" stroke-width="0.35" fill="none"/>`;
    } else {
      out += `<path d="M${x - 3.5},${cy + 1.5} h2.2 l2.6,-2.8 m0.6,2.8 h-0.6" stroke="${INK_SOFT}" stroke-width="0.35" fill="none"/>`;
    }
    out += `<text x="${x + 2.6}" y="${cy + 2.4}" font-size="2.6" fill="${INK_SOFT}">${devLocation(c)}</text>`;
  });
  out += `</g>`;
  return out;
}

/* ── テキスト ── */
function textsSVG(page) {
  let out = "";
  page.texts.forEach(t => {
    const selected = App.selection.has(t.id);
    if (selected) {
      const wApprox = (t.text.length * (t.size || 4)) * 0.62 + 2;
      out += `<rect x="${t.x - wApprox / 2}" y="${t.y - (t.size || 4)}" width="${wApprox}" height="${(t.size || 4) + 2.5}" fill="rgba(31,122,224,.1)" stroke="${SEL}" stroke-width="0.35" rx="0.8"/>`;
    }
    out += `<text x="${t.x}" y="${t.y}" font-size="${t.size || 4}" text-anchor="${t.anchor || "middle"}" fill="${INK}" data-id="${t.id}" class="cadtext" font-family="sans-serif">${escXML(t.text)}</text>`;
  });
  return out;
}

/* ── オーバーレイ (ピン / 作図中ワイヤ / ゴースト / ラバーバンド) ── */
function overlaySVG(page) {
  let out = "";
  const toolWire = App.tool === "wire";
  // 未接続ピン = 赤丸 (EPLAN流)。配線ツール中は全ピン表示
  const wireEndpoints = new Set();
  page.wires.forEach(w => w.pts.forEach(p => wireEndpoints.add(ptKey(p[0], p[1]))));
  const wireSegs = [];
  page.wires.forEach(w => { for (let i = 0; i < w.pts.length - 1; i++) wireSegs.push([w.pts[i], w.pts[i + 1]]); });
  page.devices.forEach(dev => {
    devPins(dev).forEach(pin => {
      const connected = wireEndpoints.has(ptKey(pin.x, pin.y)) ||
        wireSegs.some(([a, b]) => ptOnSeg(pin.x, pin.y, a[0], a[1], b[0], b[1])) ||
        page.devices.some(d2 => d2 !== dev && devPins(d2).some(p2 => Math.abs(p2.x - pin.x) < .01 && Math.abs(p2.y - pin.y) < .01));
      if (!connected) {
        out += `<circle cx="${pin.x}" cy="${pin.y}" r="0.9" fill="#d43f3f"/>`;
      } else if (toolWire) {
        out += `<circle cx="${pin.x}" cy="${pin.y}" r="0.8" fill="none" stroke="#1f7ae0" stroke-width="0.3"/>`;
      }
    });
  });
  // ホバー中のピン強調
  if (Editor.hover.pin) {
    const p = Editor.hover.pin;
    out += `<circle cx="${p.x}" cy="${p.y}" r="1.8" fill="none" stroke="#1f7ae0" stroke-width="0.5"/>`;
  }
  // 作図中ワイヤ
  if (Editor.wireDraft) {
    const d = Editor.wireDraft;
    const pts = [...d.pts, ...(d.cur ? routeOrtho(d.pts[d.pts.length - 1], d.cur) : [])];
    if (pts.length >= 2) {
      out += `<path d="M${pts.map(p => p[0] + "," + p[1]).join(" L")}" stroke="${SEL}" stroke-width="0.55" fill="none" stroke-dasharray="2 1.4"/>`;
    }
    out += `<circle cx="${d.pts[0][0]}" cy="${d.pts[0][1]}" r="1" fill="${SEL}"/>`;
  }
  // 配置ゴースト
  if (Editor.ghost) {
    const g = Editor.ghost;
    const sym = SYMBOLS_BY_ID[g.symId];
    out += `<g transform="translate(${g.x},${g.y}) rotate(${g.rot || 0})" opacity="0.55" style="color:${SEL}">${symBodySVG(sym, { strokeWidth: 0.55 })}</g>`;
    devPinsOf(g).forEach(p => { out += `<circle cx="${p.x}" cy="${p.y}" r="0.9" fill="${SEL}"/>`; });
  }
  // ラバーバンド
  if (Editor.drag && Editor.drag.type === "rubber") {
    const { x0, y0, x1, y1 } = Editor.drag;
    out += `<rect x="${Math.min(x0, x1)}" y="${Math.min(y0, y1)}" width="${Math.abs(x1 - x0)}" height="${Math.abs(y1 - y0)}" fill="rgba(31,122,224,.08)" stroke="${SEL}" stroke-width="0.35" stroke-dasharray="2 1.5"/>`;
  }
  return out;
}
function devPinsOf(ghost) {
  const sym = SYMBOLS_BY_ID[ghost.symId];
  return sym.pins.map(p => pinAbs({ x: ghost.x, y: ghost.y, rot: ghost.rot || 0 }, p));
}

/** 直交ルーティング: a→b を L字で結ぶ (水平優先/垂直優先を自動判定) */
function routeOrtho(a, b) {
  if (Math.abs(a[0] - b[0]) < 0.01 || Math.abs(a[1] - b[1]) < 0.01) return [b];
  const dx = Math.abs(b[0] - a[0]), dy = Math.abs(b[1] - a[1]);
  return dx > dy ? [[b[0], a[1]], b] : [[a[0], b[1]], b];
}

function escXML(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* ══════════════ ヒットテスト ══════════════ */
function hitTest(wx, wy) {
  const page = curPage();
  // テキスト
  for (let i = page.texts.length - 1; i >= 0; i--) {
    const t = page.texts[i];
    const w = t.text.length * (t.size || 4) * 0.62 + 2, h = (t.size || 4) + 2;
    if (wx > t.x - w / 2 && wx < t.x + w / 2 && wy > t.y - h && wy < t.y + 1.5) return { type: "text", obj: t };
  }
  // デバイス
  for (let i = page.devices.length - 1; i >= 0; i--) {
    const d = page.devices[i];
    const b = devBounds(d);
    if (wx > b.x - 1.5 && wx < b.x + b.w + 1.5 && wy > b.y - 1.5 && wy < b.y + b.h + 1.5) return { type: "device", obj: d };
  }
  // ワイヤ
  for (let i = page.wires.length - 1; i >= 0; i--) {
    const w = page.wires[i];
    for (let j = 0; j < w.pts.length - 1; j++) {
      if (distToSeg(wx, wy, w.pts[j], w.pts[j + 1]) < 1.6) return { type: "wire", obj: w };
    }
  }
  return null;
}
function distToSeg(px, py, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - a[0]) * dx + (py - a[1]) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = a[0] + t * dx, cy = a[1] + t * dy;
  return Math.hypot(px - cx, py - cy);
}
/** 近傍ピン検索 */
function findPinNear(wx, wy, radius = 3) {
  const page = curPage();
  let best = null, bd = radius;
  page.devices.forEach(dev => {
    devPins(dev).forEach(pin => {
      const d = Math.hypot(pin.x - wx, pin.y - wy);
      if (d < bd) { bd = d; best = { ...pin, dev }; }
    });
  });
  return best;
}

/* ══════════════ 操作 (マウス) ══════════════ */
function setupEditor() {
  const svg = document.getElementById("canvas");
  Editor.svg = svg;
  svg.innerHTML = `<g id="world">
    <g id="lySheet"></g><g id="lyWires"></g><g id="lyDevices"></g><g id="lyTexts"></g><g id="lyOverlay"></g>
  </g>`;
  Editor.layers = {
    sheet: svg.querySelector("#lySheet"),
    wires: svg.querySelector("#lyWires"),
    devices: svg.querySelector("#lyDevices"),
    texts: svg.querySelector("#lyTexts"),
    overlay: svg.querySelector("#lyOverlay"),
  };

  svg.addEventListener("wheel", e => {
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 1 / 1.12);
  }, { passive: false });

  svg.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
  svg.addEventListener("dblclick", onDblClick);
  svg.addEventListener("contextmenu", e => { e.preventDefault(); cancelDraft(); });
  window.addEventListener("resize", requestRender);
}

function cancelDraft() {
  if (Editor.wireDraft) { Editor.wireDraft = null; requestRender(); }
  if (Editor.ghost) { Editor.ghost = null; requestRender(); }
}

function onMouseDown(e) {
  const svg = Editor.svg;
  svg.focus();
  const w = screenToWorld(e.clientX, e.clientY);
  const sx = snap(w.x), sy = snap(w.y);

  // 中ボタン or パンツール or Space → パン
  if (e.button === 1 || App.tool === "pan" || Editor.spaceHeld) {
    Editor.drag = { type: "pan", startX: e.clientX, startY: e.clientY, tx0: Editor.view.tx, ty0: Editor.view.ty };
    e.preventDefault();
    return;
  }
  if (e.button !== 0) return;

  // ゴースト配置中 → 配置確定
  if (Editor.ghost) {
    placeGhost();
    return;
  }

  // シミュレーションモード → 入力機器の操作
  if (App.sim.running) {
    const hit = hitTest(w.x, w.y);
    if (hit && hit.type === "device") {
      const sym = SYMBOLS_BY_ID[hit.obj.sym];
      if ((sym.sim === "contact_no" || sym.sim === "contact_nc") && !hit.obj.linkTo) {
        if (sym.momentary) {
          App.sim.states[hit.obj.id] = true;
          Editor.drag = { type: "simhold", devId: hit.obj.id };
        } else {
          App.sim.states[hit.obj.id] = !App.sim.states[hit.obj.id];
        }
        simSolve();
        requestRender();
      }
    }
    return;
  }

  if (App.tool === "wire") {
    const pin = findPinNear(w.x, w.y);
    const px = pin ? pin.x : sx, py = pin ? pin.y : sy;
    if (!Editor.wireDraft) {
      Editor.wireDraft = { pts: [[px, py]], cur: null };
    } else {
      const last = Editor.wireDraft.pts[Editor.wireDraft.pts.length - 1];
      const seg = routeOrtho(last, [px, py]);
      Editor.wireDraft.pts.push(...seg);
      // ピン上 or 既存ワイヤ上でクリックしたら完了
      const onWire = curPage().wires.some(wr => {
        for (let i = 0; i < wr.pts.length - 1; i++) {
          if (ptOnSeg(px, py, wr.pts[i][0], wr.pts[i][1], wr.pts[i + 1][0], wr.pts[i + 1][1])) return true;
          if (Math.abs(wr.pts[i][0] - px) < .01 && Math.abs(wr.pts[i][1] - py) < .01) return true;
        }
        return false;
      });
      if (pin || onWire) finishWireDraft();
    }
    requestRender();
    return;
  }

  if (App.tool === "text") {
    UI.openTextInput(e.clientX, e.clientY, sx, sy);
    return;
  }

  // 選択ツール
  const hit = hitTest(w.x, w.y);
  if (hit) {
    const id = hit.obj.id;
    if (e.shiftKey) {
      if (App.selection.has(id)) App.selection.delete(id); else App.selection.add(id);
    } else if (!App.selection.has(id)) {
      App.selection.clear();
      App.selection.add(id);
    }
    // 移動ドラッグ準備
    Editor.drag = {
      type: "move", startW: w, moved: false,
      snapshot: JSON.stringify(App.project),
      attach: buildMoveAttachment(),
    };
    UI.showProps();
    requestRender();
  } else {
    if (!e.shiftKey) App.selection.clear();
    Editor.drag = { type: "rubber", x0: w.x, y0: w.y, x1: w.x, y1: w.y, additive: e.shiftKey };
    UI.showProps();
    requestRender();
  }
}

/** 移動対象デバイスのピンに接続するワイヤ端点を記録 */
function buildMoveAttachment() {
  const page = curPage();
  const map = []; // {wire, ptIdx, devId, dx, dy}  … dx,dy はピンからの相対(常に0)
  const selDevs = page.devices.filter(d => App.selection.has(d.id));
  const selWires = page.wires.filter(w => App.selection.has(w.id));
  selDevs.forEach(dev => {
    devPins(dev).forEach(pin => {
      page.wires.forEach(wire => {
        if (App.selection.has(wire.id)) return; // 選択ワイヤは丸ごと動く
        wire.pts.forEach((p, i) => {
          if ((i === 0 || i === wire.pts.length - 1) && Math.abs(p[0] - pin.x) < .01 && Math.abs(p[1] - pin.y) < .01) {
            map.push({ wireId: wire.id, ptIdx: i });
          }
        });
      });
    });
  });
  return {
    devIds: selDevs.map(d => ({ id: d.id, x0: d.x, y0: d.y })),
    wireIds: selWires.map(w => ({ id: w.id, pts0: deepCopy(w.pts) })),
    endpoints: map,
    textIds: page.texts.filter(t => App.selection.has(t.id)).map(t => ({ id: t.id, x0: t.x, y0: t.y })),
  };
}

function onMouseMove(e) {
  const w = screenToWorld(e.clientX, e.clientY);
  updateStatusCoords(w);

  if (Editor.ghost) {
    Editor.ghost.x = snap(w.x); Editor.ghost.y = snap(w.y);
    requestRender();
    return;
  }
  if (Editor.wireDraft) {
    const pin = findPinNear(w.x, w.y);
    Editor.hover.pin = pin || null;
    Editor.wireDraft.cur = pin ? [pin.x, pin.y] : [snap(w.x), snap(w.y)];
    requestRender();
    return;
  }

  const d = Editor.drag;
  if (!d) {
    // ホバー
    if (App.tool === "select" || App.sim.running) {
      const hit = hitTest(w.x, w.y);
      const newHover = hit && hit.type === "device" ? hit.obj.id : null;
      if (newHover !== Editor.hover.devId) { Editor.hover.devId = newHover; requestRender(); }
      if (App.sim.running && hit && hit.type === "device") {
        const sym = SYMBOLS_BY_ID[hit.obj.sym];
        Editor.svg.style.cursor = ((sym.sim === "contact_no" || sym.sim === "contact_nc") && !hit.obj.linkTo) ? "pointer" : "default";
      }
    } else if (App.tool === "wire") {
      const pin = findPinNear(w.x, w.y);
      if ((pin && !Editor.hover.pin) || (!pin && Editor.hover.pin) ||
          (pin && Editor.hover.pin && (pin.x !== Editor.hover.pin.x || pin.y !== Editor.hover.pin.y))) {
        Editor.hover.pin = pin;
        requestRender();
      }
    }
    return;
  }

  if (d.type === "pan") {
    Editor.view.tx = d.tx0 + (e.clientX - d.startX);
    Editor.view.ty = d.ty0 + (e.clientY - d.startY);
    requestRender();
    return;
  }
  if (d.type === "rubber") {
    d.x1 = w.x; d.y1 = w.y;
    requestRender();
    return;
  }
  if (d.type === "move") {
    const dx = snap(w.x - d.startW.x), dy = snap(w.y - d.startW.y);
    if (dx === 0 && dy === 0 && !d.moved) return;
    d.moved = true;
    applyMove(d.attach, dx, dy);
    requestRender();
  }
}

function applyMove(attach, dx, dy) {
  const page = curPage();
  attach.devIds.forEach(({ id, x0, y0 }) => {
    const dev = page.devices.find(d => d.id === id);
    if (dev) { dev.x = x0 + dx; dev.y = y0 + dy; }
  });
  attach.textIds.forEach(({ id, x0, y0 }) => {
    const t = page.texts.find(t => t.id === id);
    if (t) { t.x = x0 + dx; t.y = y0 + dy; }
  });
  attach.wireIds.forEach(({ id, pts0 }) => {
    const wr = page.wires.find(w => w.id === id);
    if (wr) wr.pts = pts0.map(p => [p[0] + dx, p[1] + dy]);
  });
  // 接続ワイヤ端点の追従 + 直交補正
  attach.endpoints.forEach(ep => {
    const wr = page.wires.find(w => w.id === ep.wireId);
    if (!wr) return;
    if (ep.orig === undefined) ep.orig = deepCopy(wr.pts);
    const pts = deepCopy(ep.orig);
    const idx = ep.ptIdx;
    const old = pts[idx];
    const np = [old[0] + dx, old[1] + dy];
    pts[idx] = np;
    const adjIdx = idx === 0 ? 1 : pts.length - 2;
    if (adjIdx >= 0 && adjIdx < pts.length && adjIdx !== idx) {
      const adj = pts[adjIdx];
      const wasVert = Math.abs(ep.orig[idx][0] - ep.orig[adjIdx][0]) < 0.01;
      if (pts.length === 2) {
        // 2点ワイヤが斜めになるなら L 字に折る
        if (Math.abs(np[0] - adj[0]) > 0.01 && Math.abs(np[1] - adj[1]) > 0.01) {
          pts.length = 0;
          if (idx === 0) pts.push(np, wasVert ? [np[0], adj[1]] : [adj[0], np[1]], adj);
          else pts.push(adj, wasVert ? [np[0], adj[1]] : [adj[0], np[1]], np);
        }
      } else {
        // 多点ワイヤ: 隣接点をずらして直交を維持
        if (wasVert) adj[0] = np[0]; else adj[1] = np[1];
      }
    }
    wr.pts = pts.filter((p, i) => i === 0 || Math.abs(p[0] - pts[i - 1][0]) > .001 || Math.abs(p[1] - pts[i - 1][1]) > .001);
  });
}

function onMouseUp(e) {
  const d = Editor.drag;
  if (!d) return;
  Editor.drag = null;
  if (d.type === "simhold") {
    App.sim.states[d.devId] = false;
    simSolve();
    requestRender();
    return;
  }
  if (d.type === "rubber") {
    const page = curPage();
    const x0 = Math.min(d.x0, d.x1), x1 = Math.max(d.x0, d.x1);
    const y0 = Math.min(d.y0, d.y1), y1 = Math.max(d.y0, d.y1);
    if (x1 - x0 > 1 || y1 - y0 > 1) {
      if (!d.additive) App.selection.clear();
      page.devices.forEach(dev => {
        const b = devBounds(dev);
        if (b.x >= x0 && b.x + b.w <= x1 && b.y >= y0 && b.y + b.h <= y1) App.selection.add(dev.id);
      });
      page.wires.forEach(w => {
        if (w.pts.every(p => p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1)) App.selection.add(w.id);
      });
      page.texts.forEach(t => {
        if (t.x >= x0 && t.x <= x1 && t.y >= y0 && t.y <= y1) App.selection.add(t.id);
      });
      UI.showProps();
    }
    requestRender();
    return;
  }
  if (d.type === "move" && d.moved) {
    // 移動確定 → Undo 履歴
    App.undoStack.push(d.snapshot);
    if (App.undoStack.length > 100) App.undoStack.shift();
    App.redoStack.length = 0;
    saveLocal();
    UI.setMsg("移動しました");
    requestRender();
  }
}

function onDblClick(e) {
  const w = screenToWorld(e.clientX, e.clientY);
  if (App.tool === "wire" && Editor.wireDraft) {
    finishWireDraft();
    return;
  }
  const hit = hitTest(w.x, w.y);
  if (hit && hit.type === "text") {
    UI.openTextInput(e.clientX, e.clientY, hit.obj.x, hit.obj.y, hit.obj);
  } else if (hit && hit.type === "device") {
    App.selection.clear();
    App.selection.add(hit.obj.id);
    UI.showProps(true);
    requestRender();
  }
}

function finishWireDraft() {
  const d = Editor.wireDraft;
  Editor.wireDraft = null;
  if (d && d.pts.length >= 2) {
    commit();
    addWire(curPage(), d.pts);
    UI.setMsg("配線を作成しました");
  }
  requestRender();
}

/* ── ゴースト配置 (ライブラリから) ── */
function startGhost(symId, rot = 0) {
  App.tool = "select";
  UI.syncToolButtons();
  Editor.ghost = { symId, x: -1000, y: -1000, rot };
  Editor.svg.style.cursor = "copy";
}
function placeGhost() {
  const g = Editor.ghost;
  if (!g) return;
  commit();
  const dev = addDevice(curPage(), g.symId, g.x, g.y, { rot: g.rot });
  App.selection.clear();
  App.selection.add(dev.id);
  UI.setMsg(`${SYMBOLS_BY_ID[g.symId].name} ${dev.tag} を配置しました`);
  // 連続配置: Shift 押下中は続ける
  Editor.ghost = null;
  Editor.svg.style.cursor = "";
  UI.showProps();
  requestRender();
}

/* ══════════════ 編集操作 ══════════════ */
function deleteSelection() {
  if (!App.selection.size) return;
  commit();
  const page = curPage();
  page.devices = page.devices.filter(d => !App.selection.has(d.id));
  page.wires = page.wires.filter(w => !App.selection.has(w.id));
  page.texts = page.texts.filter(t => !App.selection.has(t.id));
  // リンク切れ解消
  App.project.pages.forEach(pg => pg.devices.forEach(d => {
    if (d.linkTo && !findDevice(d.linkTo)) d.linkTo = null;
  }));
  App.selection.clear();
  UI.setMsg("削除しました");
  UI.showProps();
  requestRender();
}

function rotateSelection() {
  const page = curPage();
  const devs = page.devices.filter(d => App.selection.has(d.id));
  if (!devs.length) return;
  commit();
  devs.forEach(d => { d.rot = ((d.rot || 0) + 90) % 360; });
  UI.setMsg("回転しました");
  requestRender();
}

function copySelection() {
  const page = curPage();
  const devs = page.devices.filter(d => App.selection.has(d.id));
  const wires = page.wires.filter(w => App.selection.has(w.id));
  const texts = page.texts.filter(t => App.selection.has(t.id));
  if (!devs.length && !wires.length && !texts.length) return;
  App.clipboard = deepCopy({ devs, wires, texts });
  UI.setMsg(`${devs.length + wires.length + texts.length} 個をコピーしました`);
}

function pasteClipboard() {
  if (!App.clipboard) return;
  commit();
  const page = curPage();
  const idMap = {};
  App.selection.clear();
  App.clipboard.devs.forEach(d0 => {
    const d = deepCopy(d0);
    idMap[d.id] = d.id = uid("d");
    d.x += 10; d.y += 10;
    page.devices.push(d);
    App.selection.add(d.id);
  });
  // linkTo の再マップ / タグ振り直し
  App.clipboard.devs.forEach((d0, i) => {
    const d = page.devices[page.devices.length - App.clipboard.devs.length + i];
    if (d.linkTo && idMap[d.linkTo]) d.linkTo = idMap[d.linkTo];
    if (d.tag && !d.linkTo) {
      const sym = SYMBOLS_BY_ID[d.sym];
      if (sym.letter) d.tag = nextTag(sym.letter);
    }
  });
  App.clipboard.wires.forEach(w0 => {
    const w = deepCopy(w0);
    w.id = uid("w");
    w.pts = w.pts.map(p => [p[0] + 10, p[1] + 10]);
    w.num = null;
    page.wires.push(w);
    App.selection.add(w.id);
  });
  App.clipboard.texts.forEach(t0 => {
    const t = deepCopy(t0);
    t.id = uid("t");
    t.x += 10; t.y += 10;
    page.texts.push(t);
    App.selection.add(t.id);
  });
  UI.setMsg("貼り付けました");
  requestRender();
}

function nudgeSelection(dx, dy) {
  if (!App.selection.size) return;
  commit();
  const attach = buildMoveAttachment();
  applyMove(attach, dx, dy);
  requestRender();
}

/* ══════════════ ステータスバー ══════════════ */
function updateStatusCoords(w) {
  const el = document.getElementById("stCoords");
  if (el) el.textContent = `X: ${w.x.toFixed(1)}  Y: ${w.y.toFixed(1)}`;
}
function updateStatusCount() {
  const el = document.getElementById("stCount");
  if (!el) return;
  const page = curPage();
  el.textContent = `デバイス ${page.devices.length} ・ 配線 ${page.wires.length}` +
    (App.selection.size ? ` ・ 選択 ${App.selection.size}` : "");
}

/* ══════════════ SVG エクスポート ══════════════ */
function exportSheetSVG() {
  const page = curPage();
  const body =
    `<g>${sheetSVG(page)}</g><g>${wiresSVG(page)}</g><g>${devicesSVG(page)}</g><g>${textsSVG(page)}</g>`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="-5 -5 ${SHEET.w + 10} ${SHEET.h + 10}" font-family="sans-serif">${body}</svg>`;
}
