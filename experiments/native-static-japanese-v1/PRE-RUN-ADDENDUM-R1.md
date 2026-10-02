# 初回native実行前の入力展開上限補足

EXPECTED-R1.jsonを固定した後、Swift sourceの作成/初回native結果前に記載。METHODのnormalize UTF8上限32768Bでは、事前に選んだ4000個の㍿がNFKCで48,000Bに展開するケースを、元の4000scalar/token gateより先に止める。元caseのtoken IDを比較するため、native内部のnormalize UTF8上限を262,144Bへ設定する。入力4000scalar/token4000は維持、crop/greedyなし。

これは未知のnative結果からのgate調整ではなく、固定入力の既知Unicode展開長に対する実装前のbounded設計修正。ID/piece exact、mean/vector/cosine1e-5、top1 exact、near-tie2e-5の比較閾値は変えない。元METHOD/EXPECTED freezeは上書きせず、この補足をSOURCE-R1.jsonへ初回run前に入れる。
