# 小窓v0.14.2のproductionと配布確認

2026-10-03。旧版と旧データを保持し、widget-v3 / 独立保存key / 独立native bundle IDを追加する。

- 統合8acd4f3を隔離したR1 productionと、公開前review修正c016661を隔離したR2 productionの両方を残す。後者のwidget sourceには種類上限の追加0でdraft/形/停止状態を保持する修正、色previewの優先順位修正がある。
- 型確認と既存174単体テスト成功。双方のproductionで32,000保存/1,536描画まで人工入力を加え、容量末尾の全文保存とreloadの全batch/旧色/形一致を確認。外部通信・pageerrorは0、built asset hash不変。
- [R1容量原票](raw-capacity-result.json)、[R2容量原票](raw-capacity-r2-result.json)。ハーネスはv2から適応した容量回帰で、独立意味評価や新規汎化評価ではない。input fillとEnterを使う実WebGL UI、Japanese IME全体ではない。
- 独立担当の[公開前レビュー](../widget-v3-release-review-v1/)は別の入力・種類上限・選択色・60形・tiny・旧保存keyを確認。初回不具合の原票と修正後を分ける。
- 新しいmacOS arm64のR1/R2 appを別名でbuild、BuildInfoのsourceCommit/native source/web SHAを照合。R2 appVersion0.14.2/build2/bundle dev.glyphmatter.companion.widget-v3。R1と旧appを変更しない。
- R2 ZIPは新しい場所へ展開してstrict ad-hoc署名とweb全40ファイルhash一致を確認。未notarizedの研究試作である。[配布原票](native-build-r2.json)。ZIP8,968,845 bytes、SHA256 `b1566bfa757bedcd2880c60c288b73673498203cd6dbe748409b1afa315d1d2c`。
- R2 nativeではEnter、人工の日本語paste、青いメビウスの表面、再起動後の641保存/描画、通常15fpsの表示状態を実AX/スクリーンショットとnative metricsで確認した。最初の起動の黒い画面も記録に保持し、その画面だけを描画成功とは扱わない。再起動後の画面で採択を確認した。IME変換操作の試験ではない。

Pause/hideを実操作し、非表示中はunpausedのままでframes/updates不変、再表示後に同じ641文字で描画再開を確認した。[停止](native-pause-smoke.json)・[非表示](native-hidden-smoke.json)・[再表示](native-visible-smoke.json)の短い原票を分けた。短いsmokeを90秒の関連全PID資源比較や16GBノートPCの快適性と呼ばない。動的atlasで小さくなった画像の論理容量を、nativeアプリ全体のRAM削減としない。

再現はR1/R2を新しいdistへbuildし、次を実行する。原票の上書きを拒否するため、新しいoutput名を選ぶ。

```sh
node experiments/widget-v3-release-verification-v1/raw-capacity-check.mjs http://127.0.0.1:4268/widget.html .local/widget-v3-capacity-replay.json .local/widget-v3-release-source-r2/prototypes/glyph-creature/dist
```

人工入力のみ。アプリ使用中の全入力連動は、この配布版に含まれない。
