# Metal v4 — 魚・鳥・蛇の文字表面

**独立native比較の16形候補。** 元Webの60作者形を保持し、native13形へ魚4bone／鳥7bone／蛇9boneを追加した。既存形の数式・文字本文・旧色・IDを保つ。未知語から新メッシュを生成する機能ではない。

CPUは6,045 assertions、GPU R2は792 assertions合格。元TSの12,060frames／5,559patch points／48palette／1,656influencesと比較し、position・骨格・weight・正則接線を確認した。[詳細結果](REPORT.md)では、Float差分R1の失敗とpoleのrawdv倍率差を分けている。

**旧13形は白1536／time24／400×440 offscreen PNGが全13 byte完全一致。** [証拠](LEGACY-OFFSCREEN-R2.json)。新3形の文字数1／2／385／1536、4動作時刻、3姿勢、白と新旧色の[288条件](DENSITY-R2.json)もclip／visible ink gate違反0。密度R1はsettled条件を満たさないharnessだったため[invalid原票](DENSITY-R1-INVALID.json)を保持し、吸収飛行中の2clipを解決済みにしない。

[Geometry R3 source](GEOMETRY-R3-SOURCE.json)／[app manifest](GEOMETRY-R3-APP.json)はimmutable。appはignored work/Glyph Matter 0.4.0 Geometry R3.app。bundle org.glyphmatter.metallab.v4、version0.4.0、16形popup、Enter入力、停止／隠す／再表示、floor30／元blue paletteを継承する。source/build/testは[desktop入口](../../desktop/glyph-metal-lab-v4/README.md)。

実窓視認性と通常窓CPU／RAMはroot所有の別評価。本folderから実UI／OS取得を行っていない。1200Bは追加fixed palette componentで、全process RAMの減少／増加測定ではない。Windows16GB／電力／8時間v4常用／快適性／生産性は未検証。原13形のblue readability課題も保持する。

rootのnative16実操作attempt時点でMac locked。解除せず、実UI／通常窓資源は**未確認**として返却する。open attemptや相対metrics引数の失敗を操作成功へ読み替えない。

- [実行前METHOD](METHOD.md)、[freeze SHA](METHOD-FROZEN-R1.json)、[教師fixture SHA](REFERENCE.json)、[参照source](SOURCE-REVIEW.json)
- [CPU原票](R4-cpu-report.json)、[GPU原票](R2-gpu-report.json)、[GPU R1失敗](GPU-R1-FAIL.json)、[解析接線のR2 method](GPU-METHOD-R2.md)
- [camera上界](CAMERA-PROOF.md)、[新TS vertex frustum結果](R4-creature-camera-cpu-report.json)、[旧source不変](OLD-V3-IMMUTABLE-R1.json)
- [数値とpilotの履歴](PILOT-HISTORY.md)、[実行gate履歴](EXECUTION.md)、[資源予算freeze](RESOURCE-METHOD-R1.md)
- [再現手順](REPRODUCE.md)、[生成画像](evidence/14-1536-t24.png)

rootの通常窓資源計測終了後にCPUを開始し、R5終了の明示通知後にGPUを開始した。Git／共有doc／旧source／旧保存を変更せず、OS全入力取得・ambient接続・新モデル・依存downloadは追加しない。
