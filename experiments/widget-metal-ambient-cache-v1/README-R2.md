# Ambient cache R2 candidate

現在の採択候補は **R2 host clock guard 版**です。独立 frozen W12 が見つけた転送 metadata の時刻巻戻りを、旧 R1 source/app/原票を残したまま修正しました。実 UI・実 IME・小窓全体の資源は未確認で、Mac locked / OS取得0 / GPU0 のままです。root の独立再検算後に公開候補を選びます。

- [R2 REPORT](REPORT-R2.md)、[clock事前METHOD](CLOCK-METHOD-R2.json)、[clock8 known expected](fixtures/clock8-r2-known.json)、[source freeze](CLOCK-SOURCE-FREEZE-R2.json)。
- [R2 app/source/compiled Swift pins](CACHE-CANDIDATE-R2.json)、[R1保存監査](R1-PRESERVATION-AFTER-R2.json)。
- [時計境界 R1原失敗4/8](results-clock-r1-known.json) → [同期待 R2 8/8](results-clock-r2-known.json)。
- [元native14/core3/wire8同期待回帰](results-native-r2/cpu-report-r1.json)、[Unicode既知上限回帰](results-boundary-r2-known.json)。harnessのversion文字列はR1のままで、source/app R2とはmanifestで分離しています。
- [R1 README](README.md)・[R1 REPORT](REPORT.md)・[R1 public manifest](PUBLIC-MANIFEST-R1.json) は履歴として不変です。R1 timingをR2の速度値へ書き換えていません。

新 immutable app は `work/GlyphMatter-Ambient-Cache-R2.app`。新 namespace `org.glyphmatter.metalambientcache.v1.r2`、JavaScript bundle と shader は R1 と同一 byte。本文追加・取消・一 body/ID・native16描画式・15fps/pause/hidden方針は変更していません。

repo rootからの新app build は `bash desktop/glyph-metal-ambient-cache-v1/build-r2.sh --output experiments/widget-metal-ambient-cache-v1/work/GlyphMatter-Ambient-Cache-R2-New.app`。CPU CLIは[再現手順](REPRODUCE.md)のsource列で `Projection.swift / ReceiverBridge.swift` を `Projection-r2.swift / ReceiverBridge-r2.swift` へ置換して同じ人工fixturesを通します。既存出力は上書きしません。
