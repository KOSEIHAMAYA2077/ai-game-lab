# 13形native測定の独立監査

事前にrootのMETHOD / validator / FINAL-APP / candidate FREEZE / BuildInfo と旧v2独立報告を読んだ。原票・実測summaryはまだ読まない。計測中はbuild / GPU / test / UI / 新しいOS計測を行わない。

独立条件は [METHOD-INDEPENDENT-R1.json](METHOD-INDEPENDENT-R1.json)。rootの計測が開始済みであり、この独立計画をroot実測そのものの事前計画とは扱わない。独立数値の結果を見る前に監査項目を固定したもの。

次はrootの終了通知・公開用原票の返却後に、まずbyte hashを固定し、小さい保存値の算術監査を行う。既存のgate・原票・validator・sourceを変更しない。

root終了後、公開27fileをhash固定して読んだ。独立helperの実行前hashも保存。6phaseの帰属・source chain・数値で不一致0、元gate6PASSを保持した。rootの現行ROOT-VALUES / REPORTの表値も一致。rootが報告した公開前の手転記修正を、数値harnessの失敗には加算しない。

報告・独立code・原票hash・結果を完成しrootへ所有を返す。このfolder以外は変更せず、UI / OS計測 / GPU / build / Git操作は行っていない。これ以降は新しい指示なしに編集しない。
