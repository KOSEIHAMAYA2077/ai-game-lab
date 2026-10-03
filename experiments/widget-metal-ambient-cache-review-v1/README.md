# Ambient incremental cache 独立レビュー

候補未読で12人工sessionと14親wirecaseを固定した。初回cache R1は通常session12/12一致、wireは15attempt中14合格・時計巻戻りW12が1不合格だった。作者が別source/appとして修正したcache R2は、同じ固定caseの**既知回帰**でsession12/12・wire15/15を通った。未見の新精度や全アプリ採用を主張しない。

[最終報告](REPORT-R2.md)、[初回不合格](REPORT-R1.md)、[事前METHOD](METHOD-R1.md)、[独立case](CASES-R1.json)、[事前freeze](FREEZE-R1.json)、[確認したsourceの範囲](SOURCE-AUDIT-R2.md)、[再現方法](REPRO.md)を分けた。source・固定artifact・出力のSHAは返却manifestにまとめる。

| 母数・範囲 | 初回candidate R1 | 修正candidate R2 |
|---|---:|---:|
| 独立人工session | 12/12 | 同12/12 |
| 非reset stepの旧版一致 | 66/66 | 同66/66 |
| 親wirecase / 展開attempt | 14 / 15 | 同14 / 15 |
| wire attempt合格 | 14/15、W12不合格 | 15/15、既知回帰 |
| CPU instance records | 804 bitwise一致 | 同804 bitwise一致 |
| bridge no-growth body転送0のstep | 53 | 同53 |

804instanceの規定80B fieldはFloat32 12,864個とUInt32 3,216個を旧本物CPU builderとbitwise比較した。擬似atlas・人工時刻のCPU試験で、実字体・GPU・実窓画素は確認していない。

固定66stepの応答component UTF8byteは旧57,684Bから新36,972B（metadata25,585B＋delta11,387B）だった。**転送のidle metadata-only**を確認したが、既存coreのshape windowはbounded body slicesを読む。growth deltaも全body走査後に新IDrangeだけを転送する。O(delta)時間、全processRAM・CPU・電力・快適性の改善ではない。

R3だけが素材bodyとIDを作り、host cacheはvolatile描画viewである。全入力が素材という用途を全入力が形命令という意味に広げない。既存ambient形判定はsphere/box/ringの3字句に限る。専用editorの人工確定経路だけで、OS監視・実IME・モデル・新download・GPU/UI・全窓resource測定は本レビューで0。
