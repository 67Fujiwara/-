# Planner / Generator / Evaluator サブエージェント

短いプロンプトから製品を自動開発するための3エージェント構成です。

## 開発ループ

```
ユーザーの一文
   │
   ▼
planner ──▶ docs/spec.md（機能一覧・スプリント計画・受け入れ基準）
   │
   ▼  スプリントごとに繰り返し
generator ──▶ 実装 + 自己評価を docs/progress.md に追記
   │
   ▼
evaluator ──▶ Playwright MCP で実操作テスト → docs/evaluation.md に合否
   │
   ├─ 合格 → 次のスプリントへ（generator を再起動）
   └─ 不合格 → フィードバックを添えて generator に修正させ、再評価
```

## 使い方

サブエージェント同士は直接呼び合えないため、メインの Claude セッションがオーケストレーターとして順番に起動します。例:

```
「2Dレトロゲームメーカーを作って」を planner に渡して仕様書を作り、
その後スプリントごとに generator → evaluator のループを
全スプリント合格まで回してください。
```

引き渡しはすべて `docs/` 配下のファイル経由で行います:

| ファイル | 書き手 | 読み手 |
| --- | --- | --- |
| `docs/spec.md` | planner | generator / evaluator |
| `docs/progress.md` | generator | evaluator / generator（次回） |
| `docs/evaluation.md` | evaluator | generator（修正時） |

## 役割分担の原則

- **planner** は「何を作るか」だけを決める。技術選定・DB 設計を仕様書に書くと、間違いが全スプリントに伝播するため禁止
- **generator** は 1 回の起動で 1 スプリント（＝1機能）だけ実装する
- **evaluator** はコードを読むだけでなく必ず実際にアプリを操作し、閾値を 1 つでも下回ればスプリントを不合格にする。コードの修正は行わない

## 前提

- evaluator のブラウザ操作には Playwright MCP サーバーの接続が必要です（未接続の場合は curl 等での代替検証にフォールバックします）
