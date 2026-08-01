// build:single のあと、出力された index.html を配布しやすい名前に変える。
import { readdir, rename, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';

const OUT_DIR = 'dist-single';
const FILE_NAME = 'project-board.html';

const src = join(OUT_DIR, 'index.html');
const dest = join(OUT_DIR, FILE_NAME);

await rename(src, dest);

// 埋め込み済みで不要になった空フォルダ（assets など）を片付ける
for (const entry of await readdir(OUT_DIR)) {
  const path = join(OUT_DIR, entry);
  if (entry === FILE_NAME) continue;
  const info = await stat(path);
  if (info.isDirectory() && (await readdir(path)).length === 0) {
    await rm(path, { recursive: true });
  }
}

const { size } = await stat(dest);
console.log(`\n✓ ${dest} を作成しました（${(size / 1024).toFixed(0)} KB）`);
console.log('  このファイル1つをダイレクトクラウドに置き、ダブルクリックで開けます。\n');
