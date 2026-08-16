/* ═══════════════════════════════════════════════════════════════
   ElectraCAD Studio — シンボルデータベース (JIS C 0617 / IEC 60617)
   使用頻度の低い規格記号を収蔵する。編集メニュー「シンボルデータベース…」
   から検索し、「パレットに追加」で左のライブラリ (データベース分類) に
   いつでも引き出せる。jis: 図記号番号
   ═══════════════════════════════════════════════════════════════ */
"use strict";

const DB_DEFAULT_PINNED = [
  "cable_core", "plug_socket", "insul_end", "prot_earth", "func_earth",
  "elb2", "elb3", "inverter_box", "ps_box", "plc_box", "fan",
];

const DB_SYMBOLS = [

  /* ── 導体・接続部品 (JIS C 0617-3) ── */
  {
    id: "cable_core", db: true, group: "導体・接続", jis: "03-01-09", cat: "db", letter: "W",
    name: "多芯ケーブル (心線囲み)", nameEn: "Cable cores", desc: "並走する心線を楕円で囲む。ケーブル種別は機能テキストに (例 CVV-1.25sq-4C)",
    pins: [], sim: "none", bounds: [-6,0, 12, 34],
    body: `<path d="M0,2 A5,15 0 1 0 0,32 A5,15 0 1 0 0,2"/>`,
  },
  {
    id: "twist_joint", db: true, group: "導体・接続", jis: "03-01-08", cat: "db", letter: "W",
    name: "撚り合わせ接続", nameEn: "Twisted connection", desc: "導体群の上に重ねて撚り合わせを表す",
    pins: [], sim: "none", bounds: [-10,-2, 20, 22],
    body: `<path d="M-8,18 L8,0 M8,0 L10,2 M-8,18 L-10,16"/>`,
  },
  {
    id: "insul_end", db: true, group: "導体・接続", jis: "03-01-15", cat: "db", letter: "W",
    name: "絶縁処理した端末", nameEn: "Insulated conductor end", desc: "特別な絶縁処理した未接続導体・ケーブル端",
    pins: [{x:0,y:20,n:""}], sim: "none", bounds: [-7,0, 14, 20],
    body: `<path d="M0,20 V8 A3.2,3.2 0 1 1 -3,11.4"/>`,
  },
  {
    id: "plug_socket", db: true, group: "導体・接続", jis: "03-03-05", cat: "db", letter: "X",
    name: "プラグおよびソケット", nameEn: "Plug and socket", desc: "着脱可能な接続 (プラグ=黒・ソケット=半円)",
    pins: [{x:0,y:0,n:""},{x:0,y:20,n:""}], sim: "passthru", bounds: [-6,0, 12, 20],
    body: `<path d="M0,0 V6"/><path d="M-4,6 A4,4 0 0 0 4,6"/><rect x="-2.5" y="8.5" width="5" height="5.5" fill="currentColor"/><path d="M0,14 V20"/>`,
  },

  /* ── 接地 (JIS C 0617-3) ── */
  {
    id: "prot_earth", db: true, group: "接地", jis: "03-02-03", cat: "db", letter: "E",
    name: "保護接地 (PE)", nameEn: "Protective earth", desc: "保護接地。接地記号を円で囲む",
    pins: [{x:0,y:0,n:"PE"}], sim: "none", bounds: [-8,0, 16, 15],
    body: `<circle cx="0" cy="8.2" r="6.2"/><path d="M0,0 V4.5 M-4,4.5 H4 M-2.6,6.7 H2.6 M-1.2,8.9 H1.2"/>`,
  },
  {
    id: "func_earth", db: true, group: "接地", jis: "03-02-01", cat: "db", letter: "E",
    name: "機能接地 (FE)", nameEn: "Functional earth", desc: "機能接地。一般接地記号+用途注記で表す",
    pins: [{x:0,y:0,n:"FE"}], sim: "none", bounds: [-7,0, 14, 12],
    body: `<path d="M0,0 V5 M-6,5 H6 M-4,8 H4 M-2,11 H2"/>`,
  },
  {
    id: "chassis_earth", db: true, group: "接地", jis: "03-02-06", cat: "db", letter: "E",
    name: "フレーム接続 (シャーシ)", nameEn: "Frame / chassis", desc: "機器フレーム・シャーシへの接続",
    pins: [{x:0,y:0,n:""}], sim: "none", bounds: [-7,0, 14, 11],
    body: `<path d="M0,0 V5 M-6,5 H6 M-6,5 L-8.5,8.5 M-1.5,5 L-4,8.5 M3,5 L0.5,8.5 M6,5 L3.5,8.5"/>`,
  },

  /* ── 受動部品 (JIS C 0617-4) ── */
  {
    id: "resistor", db: true, group: "受動部品", jis: "04-01-01", cat: "db", letter: "R",
    name: "抵抗器", nameEn: "Resistor", desc: "固定抵抗器",
    pins: [{x:0,y:0,n:"1"},{x:0,y:20,n:"2"}], sim: "load", bounds: [-4,0, 8, 20],
    body: `<path d="M0,0 V5 M0,20 V15"/><rect x="-2.5" y="5" width="5" height="10"/>`,
  },
  {
    id: "var_resistor", db: true, group: "受動部品", jis: "04-01-03", cat: "db", letter: "R",
    name: "可変抵抗器", nameEn: "Variable resistor", desc: "斜め矢印つき抵抗器",
    pins: [{x:0,y:0,n:"1"},{x:0,y:20,n:"2"}], sim: "load", bounds: [-7,0, 14, 20],
    body: `<path d="M0,0 V5 M0,20 V15"/><rect x="-2.5" y="5" width="5" height="10"/><path d="M-5,16 L5,4 M5,4 L3,4.4 M5,4 L4.6,6"/>`,
  },
  {
    id: "capacitor", db: true, group: "受動部品", jis: "04-02-01", cat: "db", letter: "C",
    name: "コンデンサ", nameEn: "Capacitor", desc: "無極性コンデンサ",
    pins: [{x:0,y:0,n:"1"},{x:0,y:20,n:"2"}], sim: "none", bounds: [-6,0, 12, 20],
    body: `<path d="M0,0 V8.5 M0,20 V11.5 M-5,8.5 H5 M-5,11.5 H5"/>`,
  },
  {
    id: "cap_pol", db: true, group: "受動部品", jis: "04-02-02", cat: "db", letter: "C",
    name: "有極性コンデンサ", nameEn: "Polarized capacitor", desc: "電解コンデンサ。+側を明示",
    pins: [{x:0,y:0,n:"+"},{x:0,y:20,n:"-"}], sim: "none", bounds: [-8,0, 16, 20],
    body: `<path d="M0,0 V8.5 M0,20 V11.5 M-5,8.5 H5"/><path d="M-5,11.5 H5" stroke-width="2"/><path d="M4,3 H7.6 M5.8,1.2 V4.8"/>`,
  },
  {
    id: "inductor", db: true, group: "受動部品", jis: "04-03-01", cat: "db", letter: "L",
    name: "インダクタ (コイル)", nameEn: "Inductor", desc: "空心コイル",
    pins: [{x:0,y:0,n:"1"},{x:0,y:20,n:"2"}], sim: "passthru", bounds: [-5,0, 10, 20],
    body: `<path d="M0,0 V2.5"/><path d="M0,2.5 A2.9,2.9 0 0 1 0,8.3 A2.9,2.9 0 0 1 0,14.1 A2.9,2.9 0 0 1 0,17.5" /><path d="M0,17.5 V20"/>`,
  },
  {
    id: "inductor_core", db: true, group: "受動部品", jis: "04-03-02", cat: "db", letter: "L",
    name: "鉄心入りインダクタ", nameEn: "Iron-core inductor", desc: "リアクトル・チョークコイル",
    pins: [{x:0,y:0,n:"1"},{x:0,y:20,n:"2"}], sim: "passthru", bounds: [-7,0, 14, 20],
    body: `<path d="M0,0 V2.5"/><path d="M0,2.5 A2.9,2.9 0 0 1 0,8.3 A2.9,2.9 0 0 1 0,14.1 A2.9,2.9 0 0 1 0,17.5"/><path d="M0,17.5 V20"/><path d="M5,3 V17"/>`,
  },

  /* ── 半導体 (JIS C 0617-5) ── */
  {
    id: "diode", db: true, group: "半導体", jis: "05-03-01", cat: "db", letter: "V",
    name: "ダイオード", nameEn: "Diode", desc: "整流用ダイオード (上→下が順方向)",
    pins: [{x:0,y:0,n:"A"},{x:0,y:20,n:"K"}], sim: "none", bounds: [-6,0, 12, 20],
    body: `<path d="M0,0 V6 M0,20 V14 M-4.5,6 L4.5,6 L0,14 Z M-4.5,14 H4.5"/>`,
  },
  {
    id: "led", db: true, group: "半導体", jis: "05-03-02", cat: "db", letter: "V",
    name: "発光ダイオード (LED)", nameEn: "LED", desc: "ダイオード+光の矢印2本",
    pins: [{x:0,y:0,n:"A"},{x:0,y:20,n:"K"}], sim: "none", bounds: [-6,0, 17, 20],
    body: `<path d="M0,0 V6 M0,20 V14 M-4.5,6 L4.5,6 L0,14 Z M-4.5,14 H4.5"/><path d="M5,7 L9.5,4 M9.5,4 L7.7,4.2 M9.5,4 L9,5.7 M6.5,10.5 L11,7.5 M11,7.5 L9.2,7.7 M11,7.5 L10.5,9.2"/>`,
  },
  {
    id: "zener", db: true, group: "半導体", jis: "05-03-08", cat: "db", letter: "V",
    name: "定電圧ダイオード (ツェナー)", nameEn: "Zener diode", desc: "カソードバーに折り返し",
    pins: [{x:0,y:0,n:"A"},{x:0,y:20,n:"K"}], sim: "none", bounds: [-7,0, 14, 20],
    body: `<path d="M0,0 V6 M0,20 V14 M-4.5,6 L4.5,6 L0,14 Z M-4.5,14 H4.5 M4.5,14 L6.5,12"/>`,
  },
  {
    id: "thyristor", db: true, group: "半導体", jis: "05-04-04", cat: "db", letter: "V",
    name: "サイリスタ", nameEn: "Thyristor", desc: "逆阻止3端子サイリスタ",
    pins: [{x:0,y:0,n:"A"},{x:0,y:20,n:"K"},{x:10,y:20,n:"G"}], sim: "none", bounds: [-6,0, 18, 20],
    body: `<path d="M0,0 V6 M0,20 V14 M-4.5,6 L4.5,6 L0,14 Z M-4.5,14 H4.5"/><path d="M10,20 V17 L2.2,10.5"/>`,
  },
  {
    id: "tr_npn", db: true, group: "半導体", jis: "05-05-01", cat: "db", letter: "V",
    name: "トランジスタ (NPN)", nameEn: "NPN transistor", desc: "エミッタ矢印は外向き",
    pins: [{x:-10,y:10,n:"B"},{x:0,y:0,n:"C"},{x:0,y:20,n:"E"}], sim: "none", bounds: [-12,0, 20, 20],
    body: `<circle cx="0" cy="10" r="7.5"/><path d="M-10,10 H-3 M-3,5.5 V14.5 M-3,8 L0,3 M0,3 V0 M-3,12 L0,17 M0,17 V20 M-1.2,15 L0,17 L-2.4,16.6"/>`,
  },

  /* ── 電源・変換 (JIS C 0617-6) ── */
  {
    id: "battery", db: true, group: "電源・変換", jis: "06-15-01", cat: "db", letter: "G",
    name: "電池", nameEn: "Battery", desc: "長線=+、短線=−",
    pins: [{x:0,y:0,n:"+"},{x:0,y:20,n:"-"}], sim: "none", bounds: [-7,0, 14, 20],
    body: `<path d="M0,0 V8.5 M0,20 V12 M-6,8.5 H6 M-2.8,12 H2.8"/><path d="M4.5,3 H7.5 M6,1.5 V4.5"/>`,
  },
  {
    id: "autotrafo", db: true, group: "電源・変換", jis: "06-09-08", cat: "db", letter: "T",
    name: "単巻変圧器", nameEn: "Autotransformer", desc: "共通巻線+タップ",
    pins: [{x:0,y:0,n:"1"},{x:0,y:20,n:"2"},{x:10,y:10,n:"3"}], sim: "trafo", bounds: [-5,0, 17, 20],
    body: `<path d="M0,0 V2.5"/><path d="M0,2.5 A2.9,2.9 0 0 1 0,8.3 A2.9,2.9 0 0 1 0,14.1 A2.9,2.9 0 0 1 0,17.5"/><path d="M0,17.5 V20 M2.9,10 H10"/>`,
  },
  {
    id: "ct", db: true, group: "電源・変換", jis: "06-09-11", cat: "db", letter: "T",
    name: "変流器 (CT)", nameEn: "Current transformer", desc: "一次貫通導体+二次巻線円",
    pins: [{x:0,y:0,n:"P1"},{x:0,y:20,n:"P2"},{x:10,y:15,n:"S"}], sim: "passthru", bounds: [-7,0, 18, 20],
    body: `<path d="M0,0 V20"/><circle cx="0" cy="10" r="5.5"/><path d="M5.5,12 L10,15"/>`,
  },
  {
    id: "rectifier", db: true, group: "電源・変換", jis: "06-10-01", cat: "db", letter: "U",
    name: "整流器", nameEn: "Rectifier", desc: "箱+ダイオード記号 (AC→DC)",
    pins: [{x:-5,y:0,n:"~"},{x:5,y:0,n:"~"},{x:-5,y:30,n:"+"},{x:5,y:30,n:"-"}], sim: "none", horizontalPins: true, bounds: [-13,0, 26, 30],
    body: `<path d="M-5,0 V5 M5,0 V5 M-5,30 V25 M5,25 V30"/><rect x="-12" y="5" width="24" height="20"/><path d="M12,5 L-12,25"/><path d="M-9,9 L-4,9 M-8,7 L-6.5,11 L-5,7 Z" transform="translate(1,1)"/><path d="M4,21 H9 M5,19 V23"/>`,
  },
  {
    id: "inverter_box", db: true, group: "電源・変換", cat: "db", letter: "U",
    name: "インバータ (INV)", nameEn: "Inverter / VFD", desc: "可変周波数駆動装置 R/S/T→U/V/W",
    typ: "FR-D720", horizontalPins: true,
    pins: [{x:-10,y:0,n:"R"},{x:0,y:0,n:"S"},{x:10,y:0,n:"T"},{x:-10,y:30,n:"U"},{x:0,y:30,n:"V"},{x:10,y:30,n:"W"}],
    sim: "none", bounds: [-16,0, 32, 30],
    body: `<path d="M-10,0 V5 M0,0 V5 M10,0 V5 M-10,30 V25 M0,25 V30 M10,25 V30"/><rect x="-15" y="5" width="30" height="20"/><path d="M15,5 L-15,25"/><text x="-8" y="13" font-size="4.6" text-anchor="middle" fill="currentColor" stroke="none" font-family="monospace">~</text><text x="8" y="22.5" font-size="4.6" text-anchor="middle" fill="currentColor" stroke="none" font-family="monospace">~</text><text x="0" y="16.5" font-size="4" text-anchor="middle" fill="currentColor" stroke="none" font-family="sans-serif">INV</text>`,
  },
  {
    id: "ps_box", db: true, group: "電源・変換", cat: "db", letter: "G",
    name: "電源装置 (PS)", nameEn: "Power supply unit", desc: "汎用電源ボックス。出力電圧は機能テキストに",
    typ: "", horizontalPins: true,
    pins: [{x:-10,y:0,n:"L"},{x:10,y:0,n:"N"},{x:-10,y:30,n:"+V"},{x:10,y:30,n:"-V"}],
    sim: "psu", bounds: [-16,0, 32, 30],
    body: `<path d="M-10,0 V5 M10,0 V5 M-10,30 V25 M10,25 V30"/><rect x="-15" y="5" width="30" height="20"/><text x="0" y="17.5" font-size="5" text-anchor="middle" fill="currentColor" stroke="none" font-family="sans-serif">PS</text>`,
  },

  /* ── 開閉・保護 (JIS C 0617-7) ── */
  {
    id: "elb2", db: true, group: "開閉・保護", cat: "db", letter: "F",
    name: "漏電遮断器 (ELB) 2P", nameEn: "Earth-leakage breaker 2P", desc: "零相変流器つき遮断器 (単相用)", typ: "NV32-SV 2P",
    pins: [{x:0,y:0,n:"1"},{x:0,y:20,n:"2"},{x:10,y:0,n:"3"},{x:10,y:20,n:"4"}],
    sim: "breaker2", bounds: [-9,-2, 24, 26],
    body: `<g><path d="M0,0 V7 M0,20 V13 M0,13 L-6,5"/><path d="M-1.8,11.2 L1.8,14.8 M-1.8,14.8 L1.8,11.2"/></g><g transform="translate(10,0)"><path d="M0,0 V7 M0,20 V13 M0,13 L-6,5"/><path d="M-1.8,11.2 L1.8,14.8 M-1.8,14.8 L1.8,11.2"/></g><path d="M-3,9 L7,9" stroke-dasharray="1.6 1.6"/><path d="M5,22.5 A9.5,3.5 0 1 0 5,15.6 A9.5,3.5 0 1 0 5,22.5" transform="translate(0,-0.5)"/>`,
  },
  {
    id: "elb3", db: true, group: "開閉・保護", cat: "db", letter: "F",
    name: "漏電遮断器 (ELB) 3P", nameEn: "Earth-leakage breaker 3P", desc: "零相変流器つき遮断器 (三相用)", typ: "NV63-CV 3P",
    pins: [{x:0,y:0,n:"1"},{x:0,y:20,n:"2"},{x:10,y:0,n:"3"},{x:10,y:20,n:"4"},{x:20,y:0,n:"5"},{x:20,y:20,n:"6"}],
    sim: "breaker3", bounds: [-9,-2, 34, 26],
    body: `<g><path d="M0,0 V7 M0,20 V13 M0,13 L-6,5"/><path d="M-1.8,11.2 L1.8,14.8 M-1.8,14.8 L1.8,11.2"/></g><g transform="translate(10,0)"><path d="M0,0 V7 M0,20 V13 M0,13 L-6,5"/><path d="M-1.8,11.2 L1.8,14.8 M-1.8,14.8 L1.8,11.2"/></g><g transform="translate(20,0)"><path d="M0,0 V7 M0,20 V13 M0,13 L-6,5"/><path d="M-1.8,11.2 L1.8,14.8 M-1.8,14.8 L1.8,11.2"/></g><path d="M-3,9 L17,9" stroke-dasharray="1.6 1.6"/><path d="M10,22.5 A13,3.5 0 1 0 10,15.6 A13,3.5 0 1 0 10,22.5" transform="translate(0,-0.5)"/>`,
  },
  {
    id: "disconnector", db: true, group: "開閉・保護", jis: "07-13-06", cat: "db", letter: "Q",
    name: "断路器", nameEn: "Disconnector", desc: "無負荷開閉用",
    pins: [{x:0,y:0,n:"1"},{x:0,y:20,n:"2"}], sim: "breaker", bounds: [-8,-2, 12, 24],
    body: `<path d="M0,0 V7 M-3,7 H3 M0,20 V13 M0,13 L-6,5"/>`,
  },
  {
    id: "changeover", db: true, group: "開閉・保護", jis: "07-07-01", cat: "db", letter: "S",
    name: "切替接点 (c接点)", nameEn: "Changeover contact", desc: "1回路2接点 (共通は下)",
    pins: [{x:0,y:20,n:"COM"},{x:0,y:0,n:"NC"},{x:10,y:0,n:"NO"}], sim: "none", bounds: [-8,-2, 20, 24],
    body: `<path d="M0,20 V13 M0,0 V7 M0,7 H-5 M10,0 V7 M0,13 L-6,3.6 M0,13 L8,5.5"/>`,
  },
  {
    id: "arrester", db: true, group: "開閉・保護", jis: "07-15-08", cat: "db", letter: "F",
    name: "避雷器 (アレスタ)", nameEn: "Surge arrester", desc: "サージ保護デバイス",
    pins: [{x:0,y:0,n:"1"},{x:0,y:20,n:"2"}], sim: "none", bounds: [-5,0, 10, 20],
    body: `<path d="M0,0 V4 M0,20 V16"/><rect x="-3.5" y="4" width="7" height="12"/><path d="M0,5.5 V12 M0,14.5 L-1.8,11.5 H1.8 L0,14.5 Z"/>`,
  },

  /* ── 計器・信号 (JIS C 0617-8) ── */
  {
    id: "voltmeter", db: true, group: "計器・信号", jis: "08-02-01", cat: "db", letter: "P",
    name: "電圧計", nameEn: "Voltmeter",  desc: "指示計器 V",
    pins: [{x:0,y:0,n:"1"},{x:0,y:20,n:"2"}], sim: "none", bounds: [-7,0, 14, 20],
    body: `<path d="M0,0 V4 M0,20 V16"/><circle cx="0" cy="10" r="6"/><text x="0" y="12.3" font-size="6" text-anchor="middle" fill="currentColor" stroke="none" font-family="sans-serif" font-style="italic">V</text>`,
  },
  {
    id: "ammeter", db: true, group: "計器・信号", jis: "08-02-01", cat: "db", letter: "P",
    name: "電流計", nameEn: "Ammeter", desc: "指示計器 A",
    pins: [{x:0,y:0,n:"1"},{x:0,y:20,n:"2"}], sim: "none", bounds: [-7,0, 14, 20],
    body: `<path d="M0,0 V4 M0,20 V16"/><circle cx="0" cy="10" r="6"/><text x="0" y="12.3" font-size="6" text-anchor="middle" fill="currentColor" stroke="none" font-family="sans-serif" font-style="italic">A</text>`,
  },
  {
    id: "hour_meter", db: true, group: "計器・信号", jis: "08-04-01", cat: "db", letter: "P",
    name: "時間計 (アワメータ)", nameEn: "Hour meter", desc: "運転時間の積算計",
    pins: [{x:0,y:0,n:"1"},{x:0,y:20,n:"2"}], sim: "load", bounds: [-7,0, 14, 20],
    body: `<path d="M0,0 V4 M0,20 V16"/><rect x="-6" y="4" width="12" height="12"/><text x="0" y="12.6" font-size="5.5" text-anchor="middle" fill="currentColor" stroke="none" font-family="sans-serif" font-style="italic">h</text>`,
  },
  {
    id: "bell", db: true, group: "計器・信号", jis: "08-10-01", cat: "db", letter: "P",
    name: "ベル", nameEn: "Bell", desc: "電鈴",
    pins: [{x:0,y:0,n:"1"},{x:0,y:20,n:"2"}], sim: "load", bounds: [-8,0, 16, 20],
    body: `<path d="M0,0 V6 M0,20 V14"/><path d="M-7,14 A7,7 0 0 1 7,14"/><path d="M-7,14 H7"/>`,
  },
  {
    id: "horn", db: true, group: "計器・信号", jis: "08-10-05", cat: "db", letter: "P",
    name: "ホーン (サイレン)", nameEn: "Horn", desc: "音響信号装置",
    pins: [{x:0,y:0,n:"1"},{x:0,y:20,n:"2"}], sim: "load", bounds: [-9,0, 18, 20],
    body: `<path d="M0,0 V6 M0,20 V14"/><rect x="-3" y="6" width="6" height="8"/><path d="M3,6 L8,3 V17 L3,14"/>`,
  },

  /* ── 実務機器 (盤設計でよく使う非規格ボックス) ── */
  {
    id: "plc_box", db: true, group: "実務機器", cat: "db", letter: "A",
    name: "PLC 本体", nameEn: "PLC unit", desc: "入力 I0〜I3 / 出力 Q0〜Q3 の小型PLCボックス", typ: "FX5U",
    horizontalPins: true,
    pins: [{x:-15,y:0,n:"I0"},{x:-5,y:0,n:"I1"},{x:5,y:0,n:"I2"},{x:15,y:0,n:"I3"},
           {x:-15,y:30,n:"Q0"},{x:-5,y:30,n:"Q1"},{x:5,y:30,n:"Q2"},{x:15,y:30,n:"Q3"}],
    sim: "none", bounds: [-21,0, 42, 30],
    body: `<path d="M-15,0 V5 M-5,0 V5 M5,0 V5 M15,0 V5 M-15,30 V25 M-5,25 V30 M5,25 V30 M15,25 V30"/><rect x="-20" y="5" width="40" height="20"/><text x="0" y="17.5" font-size="5.5" text-anchor="middle" fill="currentColor" stroke="none" font-family="monospace">PLC</text>`,
  },
  {
    id: "fan", db: true, group: "実務機器", cat: "db", letter: "M",
    name: "換気ファン (FAN)", nameEn: "Fan", desc: "盤用換気扇", typ: "MF-950",
    pins: [{x:0,y:0,n:"1"},{x:0,y:32,n:"2"}], sim: "load", bounds: [-9,0, 18, 32],
    body: `<path d="M0,0 V8 M0,32 V24"/><circle cx="0" cy="16" r="8"/><path d="M0,16 C-2,11 2,11 0,8.5 M0,16 C5,14 5,18 7.4,16 M0,16 C2,21 -2,21 0,23.5 M0,16 C-5,18 -5,14 -7.4,16"/>`,
  },
];

/* パレットに引き出されているDBシンボル (localStorage) */
function dbPinnedList() {
  try {
    const s = localStorage.getItem("electracad.dbPinned");
    if (s) return JSON.parse(s);
  } catch (e) { /* 破損は既定に戻す */ }
  return [...DB_DEFAULT_PINNED];
}
function dbSetPinned(list) {
  try { localStorage.setItem("electracad.dbPinned", JSON.stringify(list)); } catch (e) { }
}

// 全シンボル辞書へ統合 (描画・配置・部品表・DXFすべてで使える)
DB_SYMBOLS.forEach(s => { SYMBOLS_BY_ID[s.id] = s; });
