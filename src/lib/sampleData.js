import { DEFAULT_DEPARTMENTS } from '../constants.js';
import { addDays, today, toISO } from './date.js';
import { createId, normalizeProject } from './project.js';

// 初回起動時に表示するサンプル。今日を基準に日付を作るので、いつ開いても見た目が崩れない。
export function sampleProjects() {
  const departments = () => DEFAULT_DEPARTMENTS.map((d) => ({ ...d }));
  const base = today();
  const d = (offset) => toISO(addDays(base, offset));
  const todo = (text, done = false, dept = '', start = '', end = '') => ({
    id: createId('t'),
    text,
    done,
    dept,
    start,
    end,
  });

  return [
    {
      name: '自動検査装置 A ライン',
      client: '株式会社サンプル製作所',
      note: '最優先案件。立ち上げ日は客先の稼働開始に合わせて調整済み。',
      // 工程はプロジェクトごとなので、この案件にだけ「修正対応」を足してある
      departments: [...DEFAULT_DEPARTMENTS, { id: 'fix_sample', label: '修正対応', color: '#db2777' }],
      launchDate: d(52),
      phases: {
        sales: { owner: '山田', start: d(-30), end: d(-5), progress: 100 },
        mecha: { owner: '佐藤', start: d(-10), end: d(25), progress: 60 },
        elec: { owner: '鈴木', start: d(5), end: d(40), progress: 20 },
        cs: { owner: '田中', start: d(38), end: d(55), progress: 0 },
        fix_sample: { owner: '小林', start: d(45), end: d(58), progress: 0 },
      },
      todos: [
        todo('客先仕様の最終確認', true, 'sales', d(-30), d(-20)),
        todo('見積提出', true, 'sales', d(-18), d(-6)),
        todo('架台図面の出図', false, 'mecha', d(-4), d(6)),
        todo('搬送部の詳細設計', true, 'mecha', d(-10), d(-1)),
        todo('制御盤の部品手配', false, 'elec', d(6), d(12)),
        todo('取扱説明書ドラフト作成', false, 'cs', d(38), d(45)),
      ],
    },
    {
      name: '搬送コンベア更新',
      client: '東西マシナリー',
      note: '既存設備の置き換え。停止期間は年末年始のみ。',
      launchDate: d(48),
      phases: {
        sales: { owner: '高橋', start: d(-15), end: d(5), progress: 80 },
        mecha: { owner: '佐藤', start: d(3), end: d(35), progress: 15 },
        elec: { owner: '伊藤', start: d(20), end: d(45), progress: 0 },
        cs: { owner: '', start: '', end: '', progress: 0 },
      },
      todos: [
        todo('現地調査（レイアウト実測）', true, 'sales', d(-15), d(-10)),
        todo('見積再提出', false, 'sales', d(-2), d(4)),
      ],
    },
    {
      name: '包装機オプション追加',
      client: 'みなみ食品',
      note: '',
      launchDate: '',
      phases: {
        sales: { owner: '山田', start: d(0), end: d(14), progress: 30 },
        mecha: { owner: '中村', start: d(12), end: d(30), progress: 0 },
        elec: { owner: '鈴木', start: d(25), end: d(42), progress: 0 },
        cs: { owner: '田中', start: d(43), end: d(50), progress: 0 },
      },
      todos: [todo('オプション仕様のヒアリング', false, 'sales', d(0), d(3))],
    },
    {
      name: '試験機 レトロフィット',
      client: '北陸テック',
      note: '2024年度案件。無事に検収完了。',
      launchDate: d(-45),
      phases: {
        sales: { owner: '高橋', start: d(-120), end: d(-95), progress: 100 },
        mecha: { owner: '中村', start: d(-100), end: d(-70), progress: 100 },
        elec: { owner: '伊藤', start: d(-80), end: d(-50), progress: 100 },
        cs: { owner: '田中', start: d(-50), end: d(-40), progress: 100 },
      },
      todos: [
        todo('検収書の受領', true, 'sales', d(-45), d(-40)),
        todo('保守部品リスト送付', true, 'cs', d(-44), d(-40)),
      ],
      completedAt: d(-38),
    },
  ].map((p) => normalizeProject({ ...p, id: createId(), departments: p.departments ?? departments() }));
}
