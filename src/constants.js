// 担当部署の定義。ここを編集すれば部署の追加・名称変更ができる。
// key は保存データのキーになるため、既存データがある状態で変更しないこと。
export const DEPARTMENTS = [
  { key: 'sales', label: '営業', short: '営', color: '#2563eb', soft: '#dbeafe' },
  { key: 'mecha', label: 'メカ', short: '機', color: '#059669', soft: '#d1fae5' },
  { key: 'elec', label: '電気', short: '電', color: '#d97706', soft: '#fef3c7' },
  { key: 'cs', label: 'CS', short: 'CS', color: '#7c3aed', soft: '#ede9fe' },
];

export const DEPT_MAP = Object.fromEntries(DEPARTMENTS.map((d) => [d.key, d]));

export const ZOOM_LEVELS = {
  day: { label: '日', dayWidth: 32 },
  week: { label: '週', dayWidth: 13 },
  month: { label: '月', dayWidth: 5 },
};

export const STORAGE_KEY = 'project-gantt-board:v1';
