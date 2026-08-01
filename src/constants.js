// 工程（担当区分）の初期値。アプリ内の「工程の設定」から追加・変更・削除できる。
// id は保存データのキーになるので、既存データがある状態で変更しないこと。
export const DEFAULT_DEPARTMENTS = [
  { id: 'sales', label: '営業', color: '#2563eb' },
  { id: 'mecha', label: 'メカ', color: '#059669' },
  { id: 'elec', label: '電気', color: '#d97706' },
  { id: 'cs', label: 'CS', color: '#7c3aed' },
];

// 工程を追加したときに順番に割り当てる色
export const DEPT_COLOR_PALETTE = [
  '#2563eb',
  '#059669',
  '#d97706',
  '#7c3aed',
  '#db2777',
  '#0891b2',
  '#65a30d',
  '#dc2626',
  '#4f46e5',
  '#0f766e',
];

export const ZOOM_LEVELS = {
  day: { label: '日', dayWidth: 32 },
  week: { label: '週', dayWidth: 13 },
  month: { label: '月', dayWidth: 5 },
};

// ガント1行のレイアウト（工程が増えた分だけ行を高くする）
export const LANE_HEIGHT = 12;
export const LANE_GAP = 3;
export const ROW_PADDING = 34;

export const STORAGE_KEY = 'project-gantt-board:v1';
export const SCHEMA_VERSION = 2;
