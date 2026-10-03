# Task student preview: independent code and build review

2026-10-03。担当 `/root/task_student_preview_v1`。最終統合コードと生成済み production の read-only 点検。本文の評価データ・評価予測は読まず、source / build / workflow を変更していない。本書だけを追加した。新しい操作試験や実装を写したテスト、スクリーンショット撮影は行っていない。

## 結果

点検範囲で、公開を止める source の機能不具合は見つからなかった。材料を先に追加する順序、非同期 reset の世代確認、hold の形・変形保持、static encoder の共有、描画 hidden 停止、7 つの既存公開 ref / route の維持を確認した。

公開前に残る確認は **最新 `build-preview.mjs` による再 build と配布 license の同梱**。点検開始時の `.local/bonsai-task-student-v1/web-build/` は 19:03 の出力で、`licenses/` と `version.json` がなかった。現在の build script には両方を作る処理があり、これは source の修正漏れではなく、古い生成物の再生成・確認が必要な状態。root へ先に通知済み。この担当は read-only のため再 build していない。

## 入力・非同期状態

`preview.ts:159-192` の `submit()` は busy / empty / material input boundary を先に判定する。`Matter.add()`、`scene.sync()`、描画 invalidate を行ってから prediction を await するため、hold や model load failure でも受け付けた glyph は残る。色は `interpret()` が返した `ink` をその batch の `Matter.add()` にだけ渡し、形や次 batch の global ink へ書き込まない。

`sequence` は submit と reset が更新する。await 後に token が異なる submit は場面・status・busy を更新しない。reset 自体が busy を解除して @、neutral deformation、空の結果へ戻すため、古い fetch の完了が新しい場面を上書きしない。比較にも同じ世代確認があり、同じ文字を 6 経路へ渡すだけで `Matter.add()` / scene spec を呼ばない。

hold は `scene.setDeformation()` を呼ばず、`matter.spec` の既存 shape を保持する。明示された motion だけは同じ shape のまま反映できる。学生が予測した attribute を shape hold 中に適用する経路はない。材料は 32,000、表示は 1,536 に制限し、保存 API / localStorage はこの preview にない。

## static runtime と production asset

`getEncoder()` は単一 Promise を両 static provider で共有する。初回 fetch の成功後に同じ encoder を再利用し、失敗時だけ Promise を捨てる。head は provider ごとの Promise cache。text の外部 HTTP prediction はなく、fetch は固定した model / tokenizer / table の取得のみ。

production HTML は `./assets/preview-BQf5evL7.js` と `./assets/preview-B_tiuid7.css` を指し、bundle 内の各 model / table / tokenizer URL は `import.meta.url` から同じ assets directory へ解決する。Vite `base: './'` と Pages の `/task-student-v1/index.html` への HTML copy の組み合わせはこの相対関係を保つ。7 個の参照 asset がすべて存在し、source との SHA256 一致を確認した。

| production asset | bytes | source SHA256 |
| --- | ---: | --- |
| table-128-float16-BNGZ_ZSa.bin | 8,388,608 | `65122d239d6c9fd804deee853736446415dc815134277c87adb9978f7b9e2201` |
| tokenizer-BRgXzjj0.json | 2,127,941 | `833add01c9eb44e78ffb2d9195caace320de0fcf64d1f4d95bc541b6e30a9fc9` |
| static-seed-model-C3IYXYtH.json | 51,721 | `627f5b224ed351f0f55de6efd3ebf940ed1d7c0350eedc638ef808ac9ba597df` |
| static-bonsai8-model-0k_kMC1r.json | 51,714 | `97b9ee054e4afae15995e75a9b69868e0597c2c91421a763ba94cecc07d50889` |
| student-model-B587DloT.json | 1,516,980 | `dfab621131dfe2858bbbd04aaabde95e06194c2539530a0578ef331684f283b0` |
| seed-model-D3vzqRzn.json | 1,516,975 | `be6db7dacbc6e6ea4c567dedd1da2eef764f9bb86f5dd2780da59c9dbee24f7d` |
| bonsai4-model-BbK8A2ST.json | 1,516,975 | `938296396ff9471edf500cd4f574015b0010a9317b7e4d3f8e857f23e585ac21` |

固定 2 asset のサイズと SHA256 検査は source と production bundle に含まれる。別 endpoint の同名 model に切り替える処理はない。default は source の select 第一 option と fallback の両方で `static-seed`。HELP 内に「実験用。否定文にも反応することがあります。」があり、production にも同文を確認した。この注意は閉じた HELP の中に置かれる仕様で、常時表示ではない。

## hidden / idle の範囲

`WidgetScheduler` の calm / transient はともに 15fps。document visibility と native `glyph-widget-lifecycle` の AND 条件を接続し、hidden で既存 timer / RAF を取消し、新しい予約を作らない。`pagehide` は stop、`pageshow` は visibility を再確認して start。paused 中は明示 invalidate の単発 redraw だけを許す。

idle frame に prediction 呼び出しはない。予測は submit と手動 compare のみ。ただし **encoder と読み込んだ head は reset / hidden / idle でも Promise cache に保持する**。`pagehide` も描画 timer を止めるだけで、encoder / GPU resource の明示 dispose はない。hidden でメモリを解放した、全 widget RAM を達成した、とは本点検から報告できない。共有した固定表を保持する設計として読む。

## workflow と利用条件

`playable-pages.yml` の working-tree diff は `TASK_STUDENT_REF: glyph-matter-v0.15.0-task-student.1` と独立 checkout / check / build / subdirectory copy の追加だけ。既存 PLAYABLE / SKELETON / PROGRAM / TWIST / WIDGET / WIDGET_BUDGET / WIDGET_ATLAS の 7 refs と build / copy route は変更されていない。新しい出力を `dist/task-student-v1/` にだけ置き、保存した root app を置き換える処理はない。点検時点では新 tag はローカル未作成で、root の公開作業に残る段階。

最新 `build-preview.mjs` は build 完了後に以下を `licenses/` へコピーし、ref / default / scope の `version.json` を生成する。5 つの copy 元はすべて現在の checkout に存在する。

- Three.js MIT license。
- static model の MIT 表記・permission text。
- 固定 upstream revision と 128 truncate / F16 変換の asset NOTICE。
- standalone tokenizer adaptation の NOTICE。
- tokenizers Apache-2.0 license。

Pages job は新 tag の clean checkout でこの script を呼び、`web-build/.` 全体を新 route へコピーするため、script が成功すれば license も upload artifact に含まれる。現在の古いローカル build の欠落確認と、CI 成功後の配布確認は区別する。CI / public URL の成功は本担当では未確認。

## 既存証拠と未確認

root は統合後の IAB 操作（Enter、日本語 paste、花瓶と色、6 経路比較、追加 glyph、errors 0）を報告している。これは root の操作確認であり、本担当の独立実操作として再記述しない。実 IME 一般、ブラウザ whole-process memory、省電力、意味精度は今回点検していない。

既存 `experiments/bonsai-task-student-v1/evidence/surface-rules-before-static.png` は意味 encoder 統合前の rules 試遊画像。root が保存・公開する場合はその段階の画像と明示する。新しい screenshot は作成していない。
