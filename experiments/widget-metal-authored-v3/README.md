# Metal v3 — 13形の作者定義文字表面

球/箱/メビウスのv2を別版に保ち、Webの10作者形をCPU referenceとMetalへ移した。現段階の採用は独立比較版のgeometryと通常の窓復帰修正まで。既定60形、6 Program、ambient入力、モデル既定採用とは別母数・別契約である。

- [実装・失敗を含む結果と未確認](REPORT.md)
- [実行前方針と数値候補の推移](METHOD.md)
- [再現と出所](REPRODUCE.md)
- [表示版の操作・保存仕様](../../desktop/glyph-metal-lab-v3/README.md)
- [TS fixture A](REFERENCE.json)、[TS fixture B](REFERENCE-B.json)
- [Stage B GPU/offscreen](stage-b-singular-policy-results/gpu-report.json)
- [Stage C CPU/camera](stage-c-reopen-camera-floor-results/cpu-report.json)
- [明るさの人工対比較](lighting-paired-results/lighting-report.json)
- [最終source凍結](FINAL-SOURCE.json)、[最終app/sign/hash](FINAL-APP.json)
- [最終CPU/camera](stage-e-final-cpu-results/cpu-report.json)
- [旧3形/R2保持の分類](LEGACY-PRESERVATION-CLASSIFIED.json)、[GPU検証とのsource対応](GPU-PROVENANCE.json)

最終候補は旧depth floor .30を保持する。rootの同一blue261/mobius/t24実窓対比較ではfloor .45の差が小さく、視認性や快適性の改善とせず別候補に残した。最終appは通常のhide/reopen修正と任意の固定時刻起動pauseを含み、BuildInfoのSource/Info SHAと返却時sourceは一致した。

13形は黒い400×440の1body draw/1,536instanceでoffscreen通過。Double位置は実TSに1.333e-15以内、GPU位置は5.153e-6以内。蝶の退化20点は一意normalを持たず、正則normalの精度とは分けてWebの代替軸を検査した。payloadのinstance80B/uniform336Bを全体RAMに読み替えない。

`work/`はignoredのimmutable app/source snapshotと人工test用。新しいoutput名でbuildする。旧版・旧snapshotの削除/上書き、OS取得、UI操作、外部送信は本担当の実装に含めない。実UIと通常窓資源の原票はroot所有の別folderにある。
