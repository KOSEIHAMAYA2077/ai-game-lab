# 実行段階

METHOD.md／METHOD-FROZEN-R1.jsonはread-only設計時点の凍結で、実行開始前の文を後から編集していない。rootが通常窓計測終了を通知し、CPU実装・教師生成・test/buildを許可した後に新v4へv3をcopyした。GPUは旧R5 soak終了の明示通知を待つ。

CPU R2は6,041 assertions、固定palette cacheの追加をR3で確認、旧16×16遷移＋実TS生き物vertexのfrustum検査をR4で追加して6,045 assertions合格。R4のsnapshotはGPU-PREEXECUTION-R1.json。R1の語彙回帰失敗とloader失敗はPILOT-HISTORY.mdに保持。shaderはまだGPU未実行。

教師は既存Node26.4.0／Rolldown1.2.11のTS syntax変換／Three0.186.1。原TSと原Threeは読み取りだけ。教師fixtureを結果に合わせて更新していない。TS位置がDouble計算でも、bone paletteは原ThreeのFloat32Array量子化を使う点をCPU参照でも保持。

CPU確認は3形を別集計し、どれも採否の同じ基準を使う。GPUと実UI／資源のgateが未完了なので、16形採用とはまだ書かない。Candidate R1/R2 appは新ignored work内の比較物。R1 plist版が旧0.3.0だった点も保持し、R2でbundle version0.4.0とBuildInfoを揃えた。
