import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// mode=single のときは、JS/CSS を1つの HTML に埋め込んで出力する。
// ファイルサーバーやオンラインストレージに置いて、ダブルクリックで開く運用向け。
export default defineConfig(({ mode }) => {
  const single = mode === 'single';

  return {
    // file:// で開いても読み込めるよう相対パスにする
    base: './',
    plugins: [react(), ...(single ? [viteSingleFile()] : [])],
    build: single
      ? {
          outDir: 'dist-single',
          cssCodeSplit: false,
          assetsInlineLimit: 100_000_000,
          chunkSizeWarningLimit: 4000,
        }
      : {},
    server: {
      host: true,
      port: 5173,
    },
  };
});
