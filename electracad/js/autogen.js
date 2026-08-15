/* ═══════════════════════════════════════════════════════════════
   ElectraCAD Studio — AI 自動作図エンジン
   インプット機器 / ロジック機器 / アウトプット機器の選択から、
   電気設計のセオリー(JIS/IEC)に基づいた制御回路を自動合成する。
   ─ 安全チェーン(非常停止・サーモ)は電源直下に直列配置
   ─ 起動入力は並列、停止入力は直列 (自己保持回路の定石)
   ─ 三相モータは主回路ページを自動生成し、接触器・遮断器を自動追加
   ─ PLC選択時は入出力を1点ずつ割付け、アドレスを自動採番
   すべての座標は 5mm グリッドに整列させる (スナップずれ防止)。
   ═══════════════════════════════════════════════════════════════ */
"use strict";

const AI_L = {
  psuX: 55, psuY: 25,      // 電源ユニット位置 (ピンが x±10 に出る)
  topRailY: 65,            // +24V レール y
  botRailY: 235,           // 0V レール y
  railEndPad: 20,          // レール終端の右余白
  safetyX: 75,             // 安全チェーンの x
  rungX0: 115,             // 最初のラングの x
  rungGapMin: 45,          // ラング最小間隔
  bodyTopY: 195,           // 標準負荷(高さ20)の上端 y → 下端215 → 0Vへ
  slotPitch: 30,           // 直列要素の縦ピッチ (要素20 + 配線10)
};

const AI_SAFETY_IDS = new Set(["estop", "thermo"]);
const AI_STOP_IDS = new Set(["pb_nc"]);

function aiExpand(list) {
  const out = [];
  (list || []).forEach(it => { for (let i = 0; i < (it.qty || 1); i++) out.push(it.id); });
  return out;
}

/** シンボルのピン軸から左右への張り出し量 (並列分岐の衝突回避用) */
function symExtents(symId) {
  const s = SYMBOLS_BY_ID[symId];
  const [bx, , bw] = s.bounds;
  return { left: Math.max(0, -bx), right: Math.max(0, bx + bw) };
}
function gridUp(v) { return Math.ceil(v / GRID) * GRID; }

/**
 * メイン生成関数
 * @param sel { inputs:[{id,qty}], logics:[{id,qty}], outputs:[{id,qty}], opts:{selfHold,lampFb,autoNum} }
 */
function aiGenerate(sel) {
  const report = [];
  const L = AI_L;
  const project = App.project;

  const inputs = aiExpand(sel.inputs);
  const logics = aiExpand(sel.logics);
  const outputs = aiExpand(sel.outputs);
  const opts = sel.opts || {};

  const safeties = inputs.filter(id => AI_SAFETY_IDS.has(id));
  const stops = inputs.filter(id => AI_STOP_IDS.has(id));
  const starts = inputs.filter(id => !AI_SAFETY_IDS.has(id) && !AI_STOP_IDS.has(id));

  const motors3 = outputs.filter(id => id === "motor3");
  const ctrlOutputs = outputs.filter(id => id !== "motor3");

  const plcMode = logics.some(id => id === "plc_di" || id === "plc_do");
  const coilSyms = logics.filter(id => ["coil", "cont_coil", "timer_on", "timer_off", "safety_relay"].includes(id));

  // ── AI 設計判断 ──
  if (motors3.length && !coilSyms.includes("cont_coil")) {
    for (let i = 0; i < motors3.length; i++) coilSyms.push("cont_coil");
    report.push(`三相モータ検出 → 電磁接触器コイルを ${motors3.length} 台自動追加`);
  }
  if (!coilSyms.length && !plcMode && ctrlOutputs.length && starts.length) {
    report.push("ロジック機器なし → 入力接点による直接制御回路を生成");
  }
  if (safeties.length) report.push(`安全機器 ${safeties.length} 点を電源直下の安全チェーンに直列配置`);
  if (opts.selfHold && (coilSyms.length || plcMode)) report.push("自己保持回路(3ワイヤ制御)を適用 — 起動は並列・停止は直列");

  // ── 制御回路ページ ──
  const page = newPage("制御回路", project.pages.length + 1);
  project.pages.push(page);
  const pageIdxs = [project.pages.length - 1];

  // 電源ユニット + AC引込
  addDevice(page, "psu24", L.psuX, L.psuY, { desc: "制御電源" });
  addWire(page, [[L.psuX - 10, L.psuY - 10], [L.psuX - 10, L.psuY]]);
  addWire(page, [[L.psuX + 10, L.psuY - 10], [L.psuX + 10, L.psuY]]);
  page.texts.push({ id: uid("t"), x: L.psuX - 10, y: L.psuY - 13, text: "L", size: 3.6 });
  page.texts.push({ id: uid("t"), x: L.psuX + 10, y: L.psuY - 13, text: "N", size: 3.6 });
  page.texts.push({ id: uid("t"), x: L.psuX, y: L.psuY - 19, text: "AC100V", size: 4 });

  // ── 安全チェーン ──
  let ctrlRailY = L.topRailY;
  if (safeties.length) {
    let y = L.topRailY + 15;
    addWire(page, [[L.safetyX, L.topRailY], [L.safetyX, y]]);
    safeties.forEach((id, i) => {
      addDevice(page, id, L.safetyX, y, { desc: id === "estop" ? "非常停止" : "温度異常" });
      y += 20;
      if (i < safeties.length - 1) { addWire(page, [[L.safetyX, y], [L.safetyX, y + 10]]); y += 10; }
    });
    ctrlRailY = y + 15;
    addWire(page, [[L.safetyX, y], [L.safetyX, ctrlRailY]]);
    page.texts.push({ id: uid("t"), x: L.safetyX + 14, y: ctrlRailY - 3, text: "安全回路", size: 3.4 });
  }

  /* ── ラング構築 ─────────────────────────────
     series: [{id, linkTo, desc, tag}]  … 上から直列 (停止・駆動接点)
     startGroup: [{id, linkTo, desc}]   … 並列起動グループ (幅を考慮して自動オフセット)
     body: {id, desc, h}                … コイル/負荷 (下端は 0V レールへ)          */
  let xCursor = L.rungX0;
  const rungXs = [];
  function buildRung({ series = [], startGroup = [], body, funcText = "" }) {
    const x = xCursor;
    rungXs.push(x);
    const bodyH = body.h || 20;
    const bodyTop = L.bodyTopY - (bodyH - 20);
    const nAbove = series.length + (startGroup.length ? 1 : 0);
    let rightMost = 20; // このラングの右占有幅

    // スロット y (上から)
    const slotY = i => bodyTop - L.slotPitch * (nAbove - i);
    const firstY = nAbove ? slotY(0) : bodyTop;
    // レール → 最初の要素
    addWire(page, [[x, ctrlRailY], [x, firstY]]);

    let made = [];
    series.forEach((el, i) => {
      const y = slotY(i);
      const d = addDevice(page, el.id, x, y, { tag: el.tag, linkTo: el.linkTo || null, desc: el.desc || "" });
      made.push(d);
      addWire(page, [[x, y + 20], [x, y + L.slotPitch]]);
    });
    // 並列起動グループ (最後のスロット)
    if (startGroup.length) {
      const gy = slotY(nAbove - 1);
      let off = 0, prevRight = 0;
      startGroup.forEach((el, k) => {
        if (k > 0) {
          const ext = symExtents(el.id);
          off = gridUp(off + Math.max(15, prevRight + ext.left + 4));
          addWire(page, [[x, gy], [x + off, gy]]);
          addWire(page, [[x + off, gy + 20], [x, gy + 20]]);
        }
        const d = addDevice(page, el.id, x + off, gy, { tag: el.tag, linkTo: el.linkTo || null, desc: el.desc || "" });
        made.push(d);
        prevRight = symExtents(el.id).right;
        rightMost = Math.max(rightMost, off + prevRight);
      });
      addWire(page, [[x, gy + 20], [x, gy + L.slotPitch]]);
    }
    // 本体
    const bd = addDevice(page, body.id, x, bodyTop, { desc: body.desc || "", linkTo: body.linkTo || null, tag: body.tag });
    made.push(bd);
    addWire(page, [[x, bodyTop + bodyH], [x, L.botRailY]]);
    if (funcText) page.texts.push({ id: uid("t"), x, y: L.botRailY + 10, text: funcText, size: 3.8 });

    xCursor = x + Math.max(L.rungGapMin, gridUp(rightMost + 25));
    return bd;
  }

  // ── ロジック段 / 出力段 ──
  const coils = [];
  const startQueue = [...starts];
  const stopQueue = [...stops];
  const inputDescs = { pb_no: "起動", sel_sw: "切替", limit_sw: "位置検出", prox: "在荷検出", photo: "通過検出", press_sw: "圧力検出", float_sw: "レベル検出" };

  if (plcMode) {
    let di = 0, qo = 0;
    inputs.filter(id => !AI_SAFETY_IDS.has(id)).forEach(id => {
      const addr = "I0." + (di++);
      buildRung({
        startGroup: [{ id, desc: inputDescs[id] || (AI_STOP_IDS.has(id) ? "停止" : "") }],
        body: { id: "plc_di", desc: addr }, funcText: addr,
      });
    });
    ctrlOutputs.forEach(id => {
      const addr = "Q0." + (qo++);
      buildRung({
        series: [{ id: "plc_do", tag: "", desc: addr }],
        body: { id, h: id === "motor1" ? 40 : 20 }, funcText: addr,
      });
    });
    motors3.forEach(() => {
      const addr = "Q0." + (qo++);
      const q = buildRung({
        series: [{ id: "plc_do", tag: "", desc: addr }],
        body: { id: "cont_coil", desc: "モータ運転" }, funcText: addr,
      });
      coils.push(q);
    });
    report.push(`PLC入出力を自動割付 (入力 ${di} 点 / 出力 ${qo} 点)`);
  } else {
    const funcNames = { coil: "制御リレー", cont_coil: "モータ運転", timer_on: "遅延制御", timer_off: "遅延復帰", safety_relay: "安全リレー" };
    coilSyms.forEach(symId => {
      const series = stopQueue.length ? [{ id: stopQueue.shift(), desc: "停止" }] : [];
      const startGroup = [];
      if (startQueue.length) startGroup.push({ id: startQueue.shift() });
      if (startQueue.length && startGroup.length < 2) startGroup.push({ id: startQueue.shift() });
      startGroup.forEach(el => el.desc = inputDescs[el.id] || "起動");
      if (opts.selfHold && startGroup.length) startGroup.push({ id: "aux_no", tag: "", linkTo: "__self__", desc: "自己保持" });
      const body = buildRung({
        series, startGroup,
        body: { id: symId, desc: funcNames[symId] || "" },
        funcText: funcNames[symId] || "",
      });
      page.devices.forEach(d => { if (d.linkTo === "__self__") d.linkTo = body.id; });
      coils.push(body);
    });
    // 余った起動入力 → 中継リレー
    let extra = 0;
    while (startQueue.length) {
      const id = startQueue.shift();
      const body = buildRung({
        startGroup: [{ id, desc: inputDescs[id] || "入力" }],
        body: { id: "coil", desc: "入力中継" }, funcText: "入力中継",
      });
      coils.push(body); extra++;
    }
    if (extra) report.push(`未割付の入力 ${extra} 点に中継リレーを自動追加`);

    // ── 出力段 (駆動接点はコイルにリンクした補助接点を直列挿入) ──
    const outNames = { lamp: "運転表示", buzzer: "警報", sol_valve: "バルブ開閉", heater: "加熱", motor1: "モータ運転" };
    ctrlOutputs.forEach((id, i) => {
      const bodyH = id === "motor1" ? 40 : 20;
      if (coils.length) {
        const coil = coils[i % coils.length];
        const drvId = (coil.sym === "timer_on" || coil.sym === "timer_off") ? "aux_ton_no" : "aux_no";
        buildRung({
          series: [{ id: drvId, tag: "", linkTo: coil.id }],
          body: { id, h: bodyH }, funcText: outNames[id] || "",
        });
      } else {
        const drv = starts.length ? starts[i % starts.length] : null;
        buildRung({
          startGroup: drv ? [{ id: drv, desc: inputDescs[drv] || "" }] : [],
          body: { id, h: bodyH }, funcText: outNames[id] || "",
        });
      }
    });

    if (opts.lampFb) {
      coils.forEach(coil => {
        const drvId = (coil.sym === "timer_on" || coil.sym === "timer_off") ? "aux_ton_no" : "aux_no";
        buildRung({
          series: [{ id: drvId, tag: "", linkTo: coil.id }],
          body: { id: "lamp", desc: "動作表示" }, funcText: "動作表示",
        });
      });
      report.push("各コイルに動作表示灯を自動追加");
    }
  }

  // ── 電源レール (ラング右端まで) ──
  const railEndX = Math.min(SHEET.w - SHEET.margin - 5, Math.max(xCursor - L.rungGapMin + L.railEndPad, 200));
  const pPinX = L.psuX - 10, nPinX = L.psuX + 10, pinBotY = L.psuY + 30;
  addWire(page, [[pPinX, pinBotY], [pPinX, L.topRailY], [railEndX, L.topRailY]]);
  addWire(page, [[nPinX, pinBotY], [nPinX, L.botRailY], [railEndX, L.botRailY]]);
  if (ctrlRailY !== L.topRailY) addWire(page, [[L.safetyX, ctrlRailY], [railEndX, ctrlRailY]]);
  page.texts.push({ id: uid("t"), x: pPinX - 12, y: L.topRailY - 3, text: "+24V", size: 4.2 });
  page.texts.push({ id: uid("t"), x: nPinX + 14, y: L.botRailY - 3, text: "0V", size: 4.2 });

  // ── 主回路ページ (三相モータ) ──
  if (motors3.length) {
    const pw = newPage("主回路", project.pages.length + 1);
    project.pages.push(pw);
    pageIdxs.push(project.pages.length - 1);
    const contCoils = coils.filter(c => c.sym === "cont_coil");
    motors3.forEach((_, mi) => {
      const bx = 70 + mi * 80;
      addDevice(pw, "supply3", bx + 10, 25, { tag: "", desc: "" });
      pw.texts.push({ id: uid("t"), x: bx + 10, y: 16, text: "AC200V 3φ", size: 4 });
      [0, 10, 20].forEach(o => addWire(pw, [[bx + o, 35], [bx + o, 55]]));
      addDevice(pw, "mcb3", bx, 55, { desc: "主回路保護" });
      [0, 10, 20].forEach(o => addWire(pw, [[bx + o, 75], [bx + o, 105]]));
      const coil = contCoils[mi % Math.max(1, contCoils.length)] || null;
      addDevice(pw, "main_cont", bx, 105, { tag: "", linkTo: coil ? coil.id : null, desc: "" });
      [0, 10, 20].forEach(o => addWire(pw, [[bx + o, 125], [bx + o, 155]]));
      addDevice(pw, "motor3", bx + 10, 155, { desc: "電動機" });
      addWire(pw, [[bx + 10, 190], [bx + 10, 200]]);
      addDevice(pw, "earth", bx + 10, 200, { tag: "", desc: "" });
      pw.texts.push({ id: uid("t"), x: bx + 10, y: 222, text: `モータ回路 ${mi + 1}`, size: 3.8 });
    });
    report.push(`主回路ページを自動生成 (三相モータ ${motors3.length} 台 + 遮断器 + 接触器 + 接地)`);
  }

  // ── 仕上げ ──
  if (opts.autoNum !== false) {
    autoNumberWires();
    report.push("配線番号を自動付与 (接点を跨がない区間採番)");
  }
  report.push(`生成完了: デバイス ${page.devices.length} 点 / 配線 ${page.wires.length} 本`);
  return { report, pageIdxs };
}
