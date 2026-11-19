/**
 * プロジェクト工程ボードを http:// で開くための、ごく小さなサーバー。
 *
 * ファイルを直接開く（file://）と、ブラウザがフォルダ選択を拒むことがある。
 * http://127.0.0.1 なら通常のページと同じ扱いになるため、その制限を受けない。
 *
 * 追加のインストールは不要（Node.js の標準機能だけで動く）。
 * 自分の PC からしか繋がらないように 127.0.0.1 だけで待ち受ける。
 *
 *   node serve-project-board.mjs [公開するフォルダ] [ポート]
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

const root = resolve(process.argv[2] || '.');
const port = Number(process.argv[3] || 8787);
const INDEX = 'project-board.html';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

const server = createServer(async (req, res) => {
  const send = (code, body, type = 'text/plain; charset=utf-8') => {
    res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
    res.end(body);
  };

  try {
    const { pathname } = new URL(req.url, 'http://127.0.0.1');
    const wanted = decodeURIComponent(pathname === '/' ? `/${INDEX}` : pathname);
    // 公開フォルダの外に出られないようにする
    const file = join(root, normalize(wanted));
    if (file !== root && !file.startsWith(root + sep)) {
      send(403, 'アクセスできません');
      return;
    }
    const body = await readFile(file);
    send(200, body, TYPES[extname(file).toLowerCase()] || 'application/octet-stream');
  } catch {
    send(404, 'ファイルが見つかりません');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log('');
  console.log('  プロジェクト工程ボードを次のアドレスで開けます:');
  console.log('');
  console.log(`      http://127.0.0.1:${port}/`);
  console.log('');
  console.log(`  公開フォルダ: ${root}`);
  console.log('  この窓を閉じると停止します。');
  console.log('');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`ポート ${port} は既に使われています。別のポートを指定してください。`);
  } else {
    console.error(`起動に失敗しました: ${err.message}`);
  }
  process.exit(1);
});
