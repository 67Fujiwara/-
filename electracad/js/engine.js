/* ═══════════════════════════════════════════════════════════════
   ElectraCAD Studio — コアエンジン
   データモデル / ネットリスト解析 / 通電シミュレーション / DRC / 部品表
   ═══════════════════════════════════════════════════════════════ */
"use strict";

const GRID = 5;              // スナップグリッド 5mm
const SHEET = { w: 420, h: 297, margin: 10, cols: 10, rows: 6 }; // A3横

const App = {
  project: null,
  pageIdx: 0,
  selection: new Set(),      // device/wire/text の id
  tool: "select",
  undoStack: [],
  redoStack: [],
  sim: { running: false, states: {}, energized: null, timers: {} },
  clipboard: null,
};

/* ══════════════ ユーティリティ ══════════════ */
let __uid = 1;
function uid(prefix = "e") { return prefix + (Date.now() % 1e7).toString(36) + (__uid++).toString(36); }
function snap(v) { return Math.round(v / GRID) * GRID; }
function ptKey(x, y) { return Math.round(x * 10) + "," + Math.round(y * 10); }
function deepCopy(o) { return JSON.parse(JSON.stringify(o)); }

/* ══════════════ プロジェクト / ページ ══════════════ */
function newProject(name = "無題プロジェクト") {
  return {
    name,
    pages: [newPage("メイン回路", 1)],
  };
}
function newPage(name, no) {
  return { id: uid("p"), no, name, devices: [], wires: [], texts: [] };
}
function curPage() { return App.project.pages[App.pageIdx]; }

/* ══════════════ デバイス ══════════════ */
function pinAbs(dev, pin) {
  const r = (dev.rot || 0) * Math.PI / 180;
  const c = Math.cos(r), s = Math.sin(r);
  return { x: dev.x + pin.x * c - pin.y * s, y: dev.y + pin.x * s + pin.y * c };
}
function devPins(dev) {
  const sym = SYMBOLS_BY_ID[dev.sym];
  return sym.pins.map((p, i) => ({ ...pinAbs(dev, p), name: p.n, idx: i }));
}
function devBounds(dev) {
  const sym = SYMBOLS_BY_ID[dev.sym];
  const [bx, by, bw, bh] = sym.bounds;
  const corners = [[bx, by], [bx + bw, by], [bx, by + bh], [bx + bw, by + bh]]
    .map(([x, y]) => pinAbs(dev, { x, y }));
  const xs = corners.map(p => p.x), ys = corners.map(p => p.y);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

/** 全ページから letter の次の連番タグを生成 (-S1, -K3 …) */
function nextTag(letter) {
  let max = 0;
  const re = new RegExp("^-" + letter + "(\\d+)$");
  App.project.pages.forEach(pg => pg.devices.forEach(d => {
    const m = re.exec(d.tag || "");
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }));
  return "-" + letter + (max + 1);
}

function addDevice(page, symId, x, y, opts = {}) {
  const sym = SYMBOLS_BY_ID[symId];
  const dev = {
    id: uid("d"), sym: symId, x: snap(x), y: snap(y), rot: opts.rot || 0,
    tag: opts.tag !== undefined ? opts.tag : (sym.letter ? nextTag(sym.letter) : ""),
    desc: opts.desc || "", typeRef: opts.typeRef || "", linkTo: opts.linkTo || null,
    props: opts.props || {},
  };
  page.devices.push(dev);
  return dev;
}

function findDevice(id) {
  for (const pg of App.project.pages) {
    const d = pg.devices.find(d => d.id === id);
    if (d) return { dev: d, page: pg };
  }
  return null;
}

/** デバイスの表示タグ (リンクされた補助接点は親コイルのタグを表示) */
function displayTag(dev) {
  if (dev.linkTo) {
    const f = findDevice(dev.linkTo);
    if (f) return f.dev.tag;
  }
  return dev.tag;
}

/** シート上の列番号 (クロスリファレンス用 "ページ.列") */
function sheetCol(x) {
  const inner = SHEET.w - SHEET.margin * 2;
  return Math.max(0, Math.min(SHEET.cols - 1, Math.floor((x - SHEET.margin) / (inner / SHEET.cols))));
}
function devLocation(dev) {
  const f = findDevice(dev.id);
  const pageNo = f ? f.page.no : "?";
  return pageNo + "." + sheetCol(dev.x);
}

/** コイルにリンクされた接点一覧 (接点ミラー / クロスリファレンス) */
function linkedContacts(coilDev) {
  const out = [];
  App.project.pages.forEach(pg => pg.devices.forEach(d => {
    if (d.linkTo === coilDev.id) out.push(d);
  }));
  return out;
}

/* ══════════════ ワイヤ ══════════════ */
function addWire(page, pts, opts = {}) {
  const wire = { id: uid("w"), pts: pts.map(p => [snap(p[0]), snap(p[1])]), num: opts.num || null };
  // 長さ0の連続点を除去
  wire.pts = wire.pts.filter((p, i) => i === 0 || p[0] !== wire.pts[i - 1][0] || p[1] !== wire.pts[i - 1][1]);
  if (wire.pts.length < 2) return null;
  page.wires.push(wire);
  return wire;
}

function ptOnSeg(px, py, x1, y1, x2, y2) {
  const eps = 0.01;
  if (Math.abs(x1 - x2) < eps) { // 垂直
    return Math.abs(px - x1) < eps && py > Math.min(y1, y2) + eps && py < Math.max(y1, y2) - eps;
  }
  if (Math.abs(y1 - y2) < eps) { // 水平
    return Math.abs(py - y1) < eps && px > Math.min(x1, x2) + eps && px < Math.max(x1, x2) - eps;
  }
  return false;
}

/* ══════════════ ネットリスト解析 ══════════════
   Union-Find でページ内の電気的接続をまとめる。
   ノード = ワイヤ端点/角 + デバイスピン。
   ワイヤ区間は常に導通。デバイスは conductivePairs() に従う。      */
function UnionFind() {
  const parent = new Map();
  const find = k => {
    if (!parent.has(k)) parent.set(k, k);
    let r = k;
    while (parent.get(r) !== r) r = parent.get(r);
    let c = k;
    while (parent.get(c) !== c) { const n = parent.get(c); parent.set(c, r); c = n; }
    return r;
  };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };
  return { find, union, parent };
}

/**
 * デバイスが導通させるピンペア。
 * mode:
 *  - "sim":    シミュレーション状態に従う
 *  - "closed": 全接点を閉として扱う (DRC の到達性チェック用)
 *  - "open":   スイッチ要素はすべて開 (配線番号は接点を跨いで伝播しない)
 */
function conductivePairs(dev, mode = "closed") {
  const sym = SYMBOLS_BY_ID[dev.sym];
  switch (sym.sim) {
    case "contact_no":
      if (mode === "open") return [];
      return (mode === "sim" ? simActiveState(dev) : true) ? [[0, 1]] : [];
    case "contact_nc":
      if (mode === "open") return [];
      if (mode === "sim") return simActiveState(dev) ? [] : [[0, 1]];
      return [[0, 1]];
    case "contact3_no":
      if (mode === "open") return [];
      return (mode === "sim" ? simActiveState(dev) : true) ? [[0, 1], [2, 3], [4, 5]] : [];
    case "breaker":
      if (mode === "open") return [];
      return (mode === "sim" && dev.props.open) ? [] : [[0, 1]];
    case "breaker3":
      if (mode === "open") return [];
      return (mode === "sim" && dev.props.open) ? [] : [[0, 1], [2, 3], [4, 5]];
    case "passthru": return sym.pins.length >= 2 ? [[0, 1]] : [];
    default: return []; // coil / load / source は導通しない(消費・供給)
  }
}

/**
 * ページのネットを計算。
 * @returns { uf, nodeNet: Map(ptKey→netRoot), wireNet: Map(wireId→netRoot), pinNet: (dev,pinIdx)→netRoot }
 */
function computeNets(page, mode = "closed") {
  const uf = UnionFind();
  // ワイヤ: 各区間の端点を union
  page.wires.forEach(w => {
    for (let i = 0; i < w.pts.length - 1; i++) {
      uf.union(ptKey(w.pts[i][0], w.pts[i][1]), ptKey(w.pts[i + 1][0], w.pts[i + 1][1]));
    }
  });
  // T接続: ワイヤ端点が他ワイヤの区間中点に載る場合
  page.wires.forEach(w1 => {
    [w1.pts[0], w1.pts[w1.pts.length - 1]].forEach(ep => {
      page.wires.forEach(w2 => {
        if (w1 === w2) return;
        for (let i = 0; i < w2.pts.length - 1; i++) {
          if (ptOnSeg(ep[0], ep[1], w2.pts[i][0], w2.pts[i][1], w2.pts[i + 1][0], w2.pts[i + 1][1])) {
            uf.union(ptKey(ep[0], ep[1]), ptKey(w2.pts[i][0], w2.pts[i][1]));
          }
        }
      });
    });
  });
  // デバイスピン: ピン位置のノードと同一視 + 導通ペア
  page.devices.forEach(dev => {
    const pins = devPins(dev);
    conductivePairs(dev, mode).forEach(([a, b]) => {
      if (pins[a] && pins[b]) uf.union(ptKey(pins[a].x, pins[a].y), ptKey(pins[b].x, pins[b].y));
    });
  });
  const pinNet = (dev, idx) => {
    const pins = devPins(dev);
    return pins[idx] ? uf.find(ptKey(pins[idx].x, pins[idx].y)) : null;
  };
  const wireNet = new Map();
  page.wires.forEach(w => wireNet.set(w.id, uf.find(ptKey(w.pts[0][0], w.pts[0][1]))));
  return { uf, pinNet, wireNet };
}

/** ワイヤ端点がデバイスピンに接続しているか (座標一致) */
function pinAtPoint(page, x, y) {
  for (const dev of page.devices) {
    for (const p of devPins(dev)) {
      if (Math.abs(p.x - x) < 0.01 && Math.abs(p.y - y) < 0.01) return { dev, pin: p };
    }
  }
  return null;
}

/** ジャンクション(T接続)ドット位置の一覧 */
function junctionDots(page) {
  const dots = [];
  const endpointCount = new Map(); // 同一点に3本以上の端点が集まる場合
  page.wires.forEach(w => {
    [w.pts[0], w.pts[w.pts.length - 1]].forEach(ep => {
      const k = ptKey(ep[0], ep[1]);
      endpointCount.set(k, (endpointCount.get(k) || 0) + 1);
      // 他ワイヤの区間中点に載る端点
      page.wires.forEach(w2 => {
        if (w === w2) return;
        for (let i = 0; i < w2.pts.length - 1; i++) {
          if (ptOnSeg(ep[0], ep[1], w2.pts[i][0], w2.pts[i][1], w2.pts[i + 1][0], w2.pts[i + 1][1])) {
            dots.push([ep[0], ep[1]]);
          }
        }
      });
    });
  });
  endpointCount.forEach((n, k) => {
    if (n >= 3) { const [x, y] = k.split(",").map(v => v / 10); dots.push([x, y]); }
  });
  return dots;
}

/* ══════════════ 配線番号の自動付与 ══════════════ */
function autoNumberWires() {
  let n = 10;
  App.project.pages.forEach(page => {
    // "open" モード: 接点・コイルを跨いで番号が伝播しない (実務どおり区間ごとに採番)
    const { pinNet, wireNet } = computeNets(page, "open");
    const netNum = new Map();
    // 電源系ネットには電位名を付ける
    page.devices.forEach(dev => {
      const sym = SYMBOLS_BY_ID[dev.sym];
      if (sym.sim === "psu") {
        const pNet = pinNet(dev, 2), nNet = pinNet(dev, 3);
        if (pNet) netNum.set(pNet, "+24V");
        if (nNet) netNum.set(nNet, "0V");
      }
    });
    // ネットごとに採番し、最も長い区間を持つワイヤ1本だけにラベルを表示
    const bestOfNet = new Map();
    page.wires.forEach(w => {
      const net = wireNet.get(w.id);
      if (!netNum.has(net)) netNum.set(net, String(n++));
      w.num = netNum.get(net);
      w.numShow = false;
      let maxSeg = 0;
      for (let i = 0; i < w.pts.length - 1; i++) {
        maxSeg = Math.max(maxSeg, Math.abs(w.pts[i + 1][0] - w.pts[i][0]) + Math.abs(w.pts[i + 1][1] - w.pts[i][1]));
      }
      const cur = bestOfNet.get(net);
      if (!cur || maxSeg > cur.maxSeg) bestOfNet.set(net, { w, maxSeg });
    });
    bestOfNet.forEach(({ w, maxSeg }) => { if (maxSeg >= 15) w.numShow = true; });
  });
}

/* ══════════════ 通電シミュレーション ══════════════ */
function simActiveState(dev) {
  const sym = SYMBOLS_BY_ID[dev.sym];
  if (sym.sim === "contact_no" || sym.sim === "contact_nc" || sym.sim === "contact3_no") {
    if (dev.linkTo) {
      // コイル連動接点: タイマは遅延を考慮
      const t = App.sim.timers[dev.linkTo];
      if (t) return t.output;
      return !!App.sim.states[dev.linkTo];
    }
    return !!App.sim.states[dev.id]; // 手動操作 (ボタン等)
  }
  return false;
}

/**
 * シミュレーション1ステップ: コイル励磁状態が安定するまで反復。
 * P極(+24V / L)到達ネットと N極(0V / N)到達ネットを求め、
 * コイル/負荷は両極にまたがれば励磁。
 */
function simSolve() {
  const page = curPage();
  for (let iter = 0; iter < 24; iter++) {
    const { pinNet, wireNet } = computeNets(page, "sim");
    const pNets = new Set(), nNets = new Set(), acNets = new Set();
    page.devices.forEach(dev => {
      const sym = SYMBOLS_BY_ID[dev.sym];
      if (sym.sim === "psu") {
        const p = pinNet(dev, 2), n0 = pinNet(dev, 3);
        if (p) pNets.add(p);
        if (n0) nNets.add(n0);
      }
      if (sym.sim === "source3") {
        sym.pins.forEach((_, i) => { const net = pinNet(dev, i); if (net) acNets.add(net); });
      }
    });
    let changed = false;
    const newStates = {};
    page.devices.forEach(dev => {
      const sym = SYMBOLS_BY_ID[dev.sym];
      let en = false;
      if (sym.sim === "coil" || sym.sim === "load") {
        const a = pinNet(dev, 0), b = pinNet(dev, 1);
        en = (pNets.has(a) && nNets.has(b)) || (pNets.has(b) && nNets.has(a));
      } else if (sym.sim === "load3") {
        let hot = 0;
        sym.pins.forEach((_, i) => { if (acNets.has(pinNet(dev, i))) hot++; });
        en = hot >= 2;
      }
      if (sym.sim === "coil" || sym.sim === "load" || sym.sim === "load3") {
        newStates[dev.id] = en;
        if (!!App.sim.states[dev.id] !== en) changed = true;
      }
    });
    Object.assign(App.sim.states, newStates);
    // タイマ処理
    updateTimers();
    if (!changed) {
      App.sim.energized = { pNets, nNets, acNets, wireNet, pinNet };
      return;
    }
  }
  App.sim.energized = null;
}

function updateTimers() {
  const page = curPage();
  const now = performance.now();
  page.devices.forEach(dev => {
    const sym = SYMBOLS_BY_ID[dev.sym];
    if (sym.sim !== "coil" || !sym.timer) return;
    const en = !!App.sim.states[dev.id];
    let t = App.sim.timers[dev.id];
    if (!t) t = App.sim.timers[dev.id] = { output: false, since: null };
    const delay = (parseFloat(dev.props.delay) || 2) * 1000;
    if (sym.timer === "on") {
      if (en) {
        if (t.since === null) t.since = now;
        t.output = (now - t.since) >= delay;
      } else { t.since = null; t.output = false; }
    } else { // off-delay
      if (en) { t.since = null; t.output = true; }
      else if (t.output) {
        if (t.since === null) t.since = now;
        if ((now - t.since) >= delay) { t.output = false; t.since = null; }
      }
    }
  });
}

function simStart() {
  App.sim.running = true;
  App.sim.states = {};
  App.sim.timers = {};
  simSolve();
}
function simStop() {
  App.sim.running = false;
  App.sim.states = {};
  App.sim.timers = {};
  App.sim.energized = null;
}

/* ══════════════ DRC (設計ルールチェック) ══════════════ */
function runDRC() {
  const issues = [];
  const tagSeen = new Map();
  App.project.pages.forEach(page => {
    const { pinNet } = computeNets(page, "closed");
    // ワイヤ端点集合
    const wireEndpoints = new Set();
    page.wires.forEach(w => w.pts.forEach(p => wireEndpoints.add(ptKey(p[0], p[1]))));
    const wireSegs = [];
    page.wires.forEach(w => { for (let i = 0; i < w.pts.length - 1; i++) wireSegs.push([w.pts[i], w.pts[i + 1]]); });

    page.devices.forEach(dev => {
      const sym = SYMBOLS_BY_ID[dev.sym];
      // 1. 未接続ピン
      devPins(dev).forEach(pin => {
        const onWire = wireEndpoints.has(ptKey(pin.x, pin.y)) ||
          wireSegs.some(([a, b]) => ptOnSeg(pin.x, pin.y, a[0], a[1], b[0], b[1])) ||
          page.devices.some(d2 => d2 !== dev && devPins(d2).some(p2 => Math.abs(p2.x - pin.x) < .01 && Math.abs(p2.y - pin.y) < .01));
        if (!onWire) {
          issues.push({ sev: "warn", msg: `${displayTag(dev) || sym.name} のピン ${pin.name || pin.idx + 1} が未接続です`, page: page.no, target: dev.id, loc: devLocation(dev) });
        }
      });
      // 2. タグ重複
      if (dev.tag && !dev.linkTo) {
        if (tagSeen.has(dev.tag)) {
          issues.push({ sev: "err", msg: `デバイスタグ ${dev.tag} が重複しています`, page: page.no, target: dev.id, loc: devLocation(dev) });
        } else tagSeen.set(dev.tag, dev.id);
      }
      // 3. リンク未設定の補助接点
      if (sym.linked && !dev.linkTo) {
        issues.push({ sev: "warn", msg: `${sym.name} ${dev.tag} がコイルにリンクされていません`, page: page.no, target: dev.id, loc: devLocation(dev) });
      }
      // 4. コイル未使用 (接点なし)
      if (sym.sim === "coil" && sym.mirror && linkedContacts(dev).length === 0 && dev.sym !== "plc_di") {
        issues.push({ sev: "warn", msg: `コイル ${dev.tag} に連動する接点がありません`, page: page.no, target: dev.id, loc: devLocation(dev) });
      }
      // 5. 負荷が電源に届かない (全接点閉での静的チェック)
      if (sym.sim === "coil" || sym.sim === "load") {
        const pNets = new Set(), nNets = new Set();
        page.devices.forEach(d2 => {
          const s2 = SYMBOLS_BY_ID[d2.sym];
          if (s2.sim === "psu") { pNets.add(pinNet(d2, 2)); nNets.add(pinNet(d2, 3)); }
        });
        if (pNets.size) {
          const a = pinNet(dev, 0), b = pinNet(dev, 1);
          const ok = (pNets.has(a) && nNets.has(b)) || (pNets.has(b) && nNets.has(a));
          if (!ok) issues.push({ sev: "err", msg: `${displayTag(dev)} が電源(+24V/0V)に接続されていません`, page: page.no, target: dev.id, loc: devLocation(dev) });
        }
      }
    });
  });
  return issues;
}

/* ══════════════ 部品表 (BOM) ══════════════ */
function buildBOM() {
  const rows = new Map();
  App.project.pages.forEach(page => page.devices.forEach(dev => {
    if (dev.linkTo) return; // 連動接点は親デバイスの一部
    const sym = SYMBOLS_BY_ID[dev.sym];
    if (sym.cat === "misc" && sym.id === "link") return;
    const key = dev.sym + "|" + (dev.typeRef || "");
    if (!rows.has(key)) rows.set(key, { name: sym.name, typeRef: dev.typeRef || "—", tags: [] });
    rows.get(key).tags.push(displayTag(dev) || "—");
  }));
  return [...rows.values()].sort((a, b) => (a.tags[0] || "").localeCompare(b.tags[0] || ""));
}

function bomCSV() {
  const rows = buildBOM();
  const esc = s => `"${String(s).replace(/"/g, '""')}"`;
  return "﻿名称,型式,数量,デバイスタグ\n" +
    rows.map(r => [esc(r.name), esc(r.typeRef), r.tags.length, esc(r.tags.join(" "))].join(",")).join("\n");
}

/* ══════════════ 元に戻す / やり直し ══════════════ */
function commit() {
  App.undoStack.push(JSON.stringify(App.project));
  if (App.undoStack.length > 100) App.undoStack.shift();
  App.redoStack.length = 0;
  saveLocal();
}
function undo() {
  if (!App.undoStack.length) return false;
  App.redoStack.push(JSON.stringify(App.project));
  App.project = JSON.parse(App.undoStack.pop());
  App.pageIdx = Math.min(App.pageIdx, App.project.pages.length - 1);
  App.selection.clear();
  saveLocal();
  return true;
}
function redo() {
  if (!App.redoStack.length) return false;
  App.undoStack.push(JSON.stringify(App.project));
  App.project = JSON.parse(App.redoStack.pop());
  App.pageIdx = Math.min(App.pageIdx, App.project.pages.length - 1);
  App.selection.clear();
  saveLocal();
  return true;
}

/* ══════════════ 保存 / 読込 ══════════════ */
const LS_KEY = "electracad.project.v1";
function saveLocal() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(App.project)); } catch (e) { /* 容量超過等は無視 */ }
}
function loadLocal() {
  try {
    const s = localStorage.getItem(LS_KEY);
    if (s) { const p = JSON.parse(s); if (p && p.pages && p.pages.length) return p; }
  } catch (e) { /* 破損データは無視 */ }
  return null;
}
function downloadFile(filename, content, mime = "application/json") {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
