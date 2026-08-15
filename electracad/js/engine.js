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
    desc: opts.desc || "", typeRef: opts.typeRef !== undefined ? opts.typeRef : (sym.typ || ""), linkTo: opts.linkTo || null,
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
    case "passthru": return sym.pins.length >= 2 ? [[0, 1]] : []; // 端子: 線番も通す
    case "fuse":
      // ヒューズ: 導通するが線番は跨がない (実務では番号が変わる)
      return mode === "open" ? [] : [[0, 1]];
    case "passthru3":
      // サーマルリレー主回路: 導通するが線番は跨がない (2L1 → U1)
      return mode === "open" ? [] : [[0, 1], [2, 3], [4, 5]];
    default: return []; // coil / load / trafo(絶縁) / source は導通しない(消費・供給)
  }
}

/** 電位リンクのタグから極性を判定 (+24V/L+ → P極, 0V/M/N → N極) */
function linkPolarity(dev) {
  const t = (dev.tag || "").replace(/^-/, "").toUpperCase();
  if (["+24V", "24V", "L+", "P24"].includes(t)) return "P";
  if (["0V", "M", "N", "-V", "GND"].includes(t)) return "N";
  return null;
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
  // デバイスピン: ワイヤ区間の中間に載っているピンをその区間へ接続
  page.devices.forEach(dev => {
    devPins(dev).forEach(pin => {
      page.wires.forEach(w => {
        for (let i = 0; i < w.pts.length - 1; i++) {
          if (ptOnSeg(pin.x, pin.y, w.pts[i][0], w.pts[i][1], w.pts[i + 1][0], w.pts[i + 1][1])) {
            uf.union(ptKey(pin.x, pin.y), ptKey(w.pts[i][0], w.pts[i][1]));
          }
        }
      });
    });
  });
  // デバイスの導通ペア
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
    // 1) 電源系ネット・電位リンクには電位名を付ける
    page.devices.forEach(dev => {
      const sym = SYMBOLS_BY_ID[dev.sym];
      if (sym.sim === "psu") {
        const pNet = pinNet(dev, 2), nNet = pinNet(dev, 3);
        if (pNet) netNum.set(pNet, "+24V");
        if (nNet) netNum.set(nNet, "0V");
      }
      if (sym.sim === "link" && dev.tag) {
        const net = pinNet(dev, 0);
        if (net) netNum.set(net, dev.tag.replace(/^-/, ""));
      }
    });
    // 2) 固定番号 (主回路の相名 L1/U1 等、手動で付けた線番) を尊重
    page.wires.forEach(w => {
      if (w.fixed && w.num) netNum.set(wireNet.get(w.id), w.num);
    });
    // 3) 残りに連番を振り、ネットごとに最長区間のワイヤ1本にだけラベルを表示
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
    bestOfNet.forEach(({ w }) => { w.numShow = true; }); // 全ネット必ず1箇所は表示
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
 * シミュレーション1ステップ: 全ページを対象に、コイル励磁状態が安定するまで反復。
 * P極(+24V / L)到達ネットと N極(0V / N)到達ネットを求め、
 * コイル/負荷は両極にまたがれば励磁。ページを跨ぐ連動 (制御回路のコイル →
 * 主回路の接触器) はリンク接点の状態参照で成立する。
 */
function simSolvePage(page) {
  const { pinNet, wireNet } = computeNets(page, "sim");
  const pNets = new Set(), nNets = new Set(), acNets = new Set();
  page.devices.forEach(dev => {
    const sym = SYMBOLS_BY_ID[dev.sym];
    if (sym.sim === "psu") {
      const p = pinNet(dev, 2), n0 = pinNet(dev, 3);
      if (p) pNets.add(p);
      if (n0) nNets.add(n0);
    }
    if (sym.sim === "link") {
      // 電位リンク: タグで極性を宣言 (PSUの無いページでも給電できる)
      const pol = linkPolarity(dev);
      const net = pinNet(dev, 0);
      if (net && pol === "P") pNets.add(net);
      if (net && pol === "N") nNets.add(net);
    }
    if (sym.sim === "source3") {
      sym.pins.forEach((_, i) => { const net = pinNet(dev, i); if (net) acNets.add(net); });
    }
  });
  let changed = false;
  page.devices.forEach(dev => {
    const sym = SYMBOLS_BY_ID[dev.sym];
    let en = false;
    if (sym.sim === "coil" || sym.sim === "load") {
      const a = pinNet(dev, 0), b = pinNet(dev, 1);
      en = (pNets.has(a) && nNets.has(b)) || (pNets.has(b) && nNets.has(a));
    } else if (sym.sim === "load3") {
      let hot = 0;
      sym.pins.forEach((pin, i) => { if (pin.n !== "PE" && acNets.has(pinNet(dev, i))) hot++; });
      en = hot >= 2;
    }
    if (sym.sim === "coil" || sym.sim === "load" || sym.sim === "load3") {
      if (!!App.sim.states[dev.id] !== en) changed = true;
      App.sim.states[dev.id] = en;
    }
  });
  return { changed, energized: { pNets, nNets, acNets, wireNet, pinNet } };
}

function simSolve() {
  for (let iter = 0; iter < 24; iter++) {
    let changed = false;
    const byPage = new Map();
    App.project.pages.forEach(page => {
      const r = simSolvePage(page);
      if (r.changed) changed = true;
      byPage.set(page.id, r.energized);
    });
    if (updateTimers()) changed = true;
    if (!changed) {
      App.sim.energizedByPage = byPage;
      App.sim.energized = byPage.get(curPage().id) || null;
      return;
    }
  }
  App.sim.energized = null;
  App.sim.energizedByPage = null;
}

function updateTimers() {
  const now = performance.now();
  let changed = false;
  App.project.pages.forEach(page => page.devices.forEach(dev => {
    const sym = SYMBOLS_BY_ID[dev.sym];
    if (sym.sim !== "coil" || !sym.timer) return;
    const en = !!App.sim.states[dev.id];
    let t = App.sim.timers[dev.id];
    if (!t) t = App.sim.timers[dev.id] = { output: false, since: null };
    const before = t.output;
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
    if (t.output !== before) changed = true;
  }));
  return changed;
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
const DRC_RULES = [
  "未接続ピン", "宙吊り配線端点", "デバイスタグ重複", "コイル未リンク接点",
  "接点なしコイル", "接点数超過", "電源未到達負荷", "無開閉直結コイル", "電源短絡",
];

function drcSources(page, pinNet) {
  const pNets = new Set(), nNets = new Set();
  page.devices.forEach(d => {
    const s = SYMBOLS_BY_ID[d.sym];
    if (s.sim === "psu") { pNets.add(pinNet(d, 2)); nNets.add(pinNet(d, 3)); }
    if (s.sim === "link") {
      const pol = linkPolarity(d);
      const net = pinNet(d, 0);
      if (net && pol === "P") pNets.add(net);
      if (net && pol === "N") nNets.add(net);
    }
  });
  return { pNets, nNets };
}

function runDRC() {
  const issues = [];
  const tagSeen = new Map();
  App.project.pages.forEach(page => {
    const closed = computeNets(page, "closed");
    const open = computeNets(page, "open");
    const srcClosed = drcSources(page, closed.pinNet);
    const srcOpen = drcSources(page, open.pinNet);

    // ワイヤ端点集合 / 区間集合
    const wireEndpoints = new Map(); // key → count
    page.wires.forEach(w => w.pts.forEach(p => {
      const k = ptKey(p[0], p[1]);
      wireEndpoints.set(k, (wireEndpoints.get(k) || 0) + 1);
    }));
    const wireSegs = [];
    page.wires.forEach(w => { for (let i = 0; i < w.pts.length - 1; i++) wireSegs.push([w.pts[i], w.pts[i + 1], w.id]); });
    const allPins = [];
    page.devices.forEach(d => devPins(d).forEach(p => allPins.push(p)));

    // 電源短絡 (+24V と 0V が閉状態で同一ネット)
    for (const p of srcClosed.pNets) {
      if (p && srcClosed.nNets.has(p)) {
        issues.push({ sev: "err", msg: "+24V と 0V が短絡しています (接点閉時)", page: page.no, target: null, loc: `${page.no}.-` });
        break;
      }
    }

    // 宙吊り配線端点 (ピンにも他ワイヤにも接続しない末端)。stub=意図的な引込線/レール端は除外
    page.wires.forEach(w => {
      if (w.stub) return;
      [w.pts[0], w.pts[w.pts.length - 1]].forEach(ep => {
        const k = ptKey(ep[0], ep[1]);
        const attached =
          (wireEndpoints.get(k) || 0) >= 2 ||
          allPins.some(p => Math.abs(p.x - ep[0]) < .01 && Math.abs(p.y - ep[1]) < .01) ||
          wireSegs.some(([a, b, wid]) => wid !== w.id && ptOnSeg(ep[0], ep[1], a[0], a[1], b[0], b[1]));
        if (!attached) {
          issues.push({ sev: "warn", msg: `配線の端点 (${ep[0]}, ${ep[1]}) がどこにも接続していません`, page: page.no, target: w.id, loc: `${page.no}.${sheetCol(ep[0])}` });
        }
      });
    });

    page.devices.forEach(dev => {
      const sym = SYMBOLS_BY_ID[dev.sym];
      // 未接続ピン
      devPins(dev).forEach(pin => {
        const onWire = wireEndpoints.has(ptKey(pin.x, pin.y)) ||
          wireSegs.some(([a, b]) => ptOnSeg(pin.x, pin.y, a[0], a[1], b[0], b[1])) ||
          page.devices.some(d2 => d2 !== dev && devPins(d2).some(p2 => Math.abs(p2.x - pin.x) < .01 && Math.abs(p2.y - pin.y) < .01));
        if (!onWire) {
          issues.push({ sev: "warn", msg: `${displayTag(dev) || sym.name} のピン ${pin.name || pin.idx + 1} が未接続です`, page: page.no, target: dev.id, loc: devLocation(dev) });
        }
      });
      // タグ重複
      if (dev.tag && !dev.linkTo) {
        if (tagSeen.has(dev.tag)) {
          issues.push({ sev: "err", msg: `デバイスタグ ${dev.tag} が重複しています`, page: page.no, target: dev.id, loc: devLocation(dev) });
        } else tagSeen.set(dev.tag, dev.id);
      }
      // リンク未設定の補助接点
      if (sym.linked && !dev.linkTo) {
        issues.push({ sev: "warn", msg: `${sym.name} ${dev.tag} がコイルにリンクされていません`, page: page.no, target: dev.id, loc: devLocation(dev) });
      }
      if (sym.mirror) {
        const contacts = linkedContacts(dev);
        // 接点なしコイル
        if (sym.sim === "coil" && contacts.length === 0 && dev.sym !== "plc_di") {
          issues.push({ sev: "warn", msg: `コイル ${dev.tag} に連動する接点がありません`, page: page.no, target: dev.id, loc: devLocation(dev) });
        }
        // 接点数超過 (物理リレーの接点残数)
        const max = dev.props.maxContacts || sym.maxContacts || 4;
        if (contacts.length > max) {
          issues.push({ sev: "err", msg: `${dev.tag} の連動接点が ${contacts.length} 点あり、実装可能数 ${max} 点を超えています`, page: page.no, target: dev.id, loc: devLocation(dev) });
        }
      }
      if (sym.sim === "coil" || sym.sim === "load") {
        const a = closed.pinNet(dev, 0), b = closed.pinNet(dev, 1);
        // 電源未到達 (全接点閉でも電源に届かない)
        if (srcClosed.pNets.size) {
          const ok = (srcClosed.pNets.has(a) && srcClosed.nNets.has(b)) || (srcClosed.pNets.has(b) && srcClosed.nNets.has(a));
          if (!ok) issues.push({ sev: "err", msg: `${displayTag(dev)} が電源 (+24V/0V) に接続されていません`, page: page.no, target: dev.id, loc: devLocation(dev) });
        }
        // 無開閉直結 (接点を1つも介さず両極に直結 → 電源投入と同時に動作)
        const ao = open.pinNet(dev, 0), bo = open.pinNet(dev, 1);
        const direct = (srcOpen.pNets.has(ao) && srcOpen.nNets.has(bo)) || (srcOpen.pNets.has(bo) && srcOpen.nNets.has(ao));
        if (direct) {
          issues.push({ sev: "err", msg: `${displayTag(dev)} が開閉要素なしで電源間に直結しています (投入と同時に動作)`, page: page.no, target: dev.id, loc: devLocation(dev) });
        }
      }
    });
  });
  return issues;
}

/* ══════════════ 部品表 (BOM) ══════════════ */
const BOM_EXCLUDE = new Set(["link", "supply3", "earth"]); // 購買部品でないもの
function buildBOM() {
  const rows = new Map();
  App.project.pages.forEach(page => page.devices.forEach(dev => {
    if (dev.linkTo) return; // 連動接点は親デバイスの一部
    const sym = SYMBOLS_BY_ID[dev.sym];
    if (BOM_EXCLUDE.has(sym.id)) return;
    // 端子は本数だけ数える (タグ -X1:n を -X1 に集約)
    const baseTag = sym.id === "terminal" ? (dev.tag || "-X1").split(":")[0] : null;
    const key = sym.id === "terminal" ? "terminal|" + baseTag : dev.sym + "|" + (dev.typeRef || "");
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

/** PLC アドレス一覧 */
function buildPLCList() {
  const rows = [];
  App.project.pages.forEach(page => page.devices.forEach(dev => {
    if (dev.sym === "plc_di" || dev.sym === "plc_do") {
      rows.push({ tag: dev.tag, addr: dev.desc || "—", kind: dev.sym === "plc_di" ? "入力" : "出力", loc: devLocation(dev) });
    }
  }));
  return rows.sort((a, b) => a.addr.localeCompare(b.addr));
}

/** 接続 (ワイヤ) リスト: 線番ごとに接続先デバイス:ピンを列挙 */
function buildConnectionList() {
  const rows = [];
  App.project.pages.forEach(page => {
    const { pinNet, wireNet } = computeNets(page, "open");
    const netName = new Map();
    page.wires.forEach(w => { if (w.num) netName.set(wireNet.get(w.id), w.num); });
    const netPins = new Map();
    page.devices.forEach(dev => {
      devPins(dev).forEach(pin => {
        const net = pinNet(dev, pin.idx);
        if (!net) return;
        if (!netPins.has(net)) netPins.set(net, []);
        netPins.get(net).push(`${displayTag(dev) || SYMBOLS_BY_ID[dev.sym].name}:${pin.name || pin.idx + 1}`);
      });
    });
    netPins.forEach((pins, net) => {
      if (pins.length >= 2) rows.push({ page: page.no, num: netName.get(net) || "—", pins });
    });
  });
  return rows.sort((a, b) => a.page - b.page || String(a.num).localeCompare(String(b.num), undefined, { numeric: true }));
}
function connectionCSV() {
  const esc = s => `"${String(s).replace(/"/g, '""')}"`;
  return "﻿ページ,線番,接続先\n" +
    buildConnectionList().map(r => [r.page, esc(r.num), esc(r.pins.join(" ⇔ "))].join(",")).join("\n");
}

/** 端子表: 端子ごとの内部/外部接続 */
function buildTerminalList() {
  const rows = [];
  App.project.pages.forEach(page => {
    const { pinNet, wireNet } = computeNets(page, "open");
    const netName = new Map();
    page.wires.forEach(w => { if (w.num) netName.set(wireNet.get(w.id), w.num); });
    const pinsOfNet = new Map();
    page.devices.forEach(dev => devPins(dev).forEach(pin => {
      const net = pinNet(dev, pin.idx);
      if (!net) return;
      if (!pinsOfNet.has(net)) pinsOfNet.set(net, []);
      pinsOfNet.get(net).push({ dev, pin });
    }));
    page.devices.forEach(dev => {
      if (dev.sym !== "terminal") return;
      const side = i => {
        const net = pinNet(dev, i);
        const others = (pinsOfNet.get(net) || []).filter(e => e.dev !== dev)
          .map(e => `${displayTag(e.dev) || SYMBOLS_BY_ID[e.dev.sym].name}:${e.pin.name || e.pin.idx + 1}`);
        return { num: netName.get(net) || "", others };
      };
      rows.push({ tag: dev.tag || "-X?", page: page.no, a: side(0), b: side(1) });
    });
  });
  return rows.sort((a, b) => String(a.tag).localeCompare(String(b.tag), undefined, { numeric: true }));
}
function terminalCSV() {
  const esc = s => `"${String(s).replace(/"/g, '""')}"`;
  return "﻿端子,ページ,内部側 線番,内部側 接続,外部側 線番,外部側 接続\n" +
    buildTerminalList().map(r => [esc(r.tag), r.page, esc(r.a.num), esc(r.a.others.join(" ")), esc(r.b.num), esc(r.b.others.join(" "))].join(",")).join("\n");
}

/* ══════════════ 元に戻す / やり直し ══════════════ */
function commit() {
  App.undoStack.push(JSON.stringify(App.project));
  if (App.undoStack.length > 100) App.undoStack.shift();
  App.redoStack.length = 0;
  saveLocal();
}
/** Undo/Redo 後も、まだ存在するオブジェクトの選択は維持する */
function retainSelection() {
  const alive = new Set();
  App.project.pages.forEach(pg => {
    pg.devices.forEach(d => alive.add(d.id));
    pg.wires.forEach(w => alive.add(w.id));
    pg.texts.forEach(t => alive.add(t.id));
  });
  [...App.selection].forEach(id => { if (!alive.has(id)) App.selection.delete(id); });
}
function undo() {
  if (App.sim.running) return false;
  if (!App.undoStack.length) return false;
  App.redoStack.push(JSON.stringify(App.project));
  App.project = JSON.parse(App.undoStack.pop());
  App.pageIdx = Math.min(App.pageIdx, App.project.pages.length - 1);
  retainSelection();
  saveLocal();
  return true;
}
function redo() {
  if (App.sim.running) return false;
  if (!App.redoStack.length) return false;
  App.undoStack.push(JSON.stringify(App.project));
  App.project = JSON.parse(App.redoStack.pop());
  App.pageIdx = Math.min(App.pageIdx, App.project.pages.length - 1);
  retainSelection();
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
