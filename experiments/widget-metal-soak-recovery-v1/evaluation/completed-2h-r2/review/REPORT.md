# 保存原票の独立監査

凍結R5の旧3形offscreen engineは、今回のR2で要求7200秒に到達して正常終了した、という根拠として使えます。公開30fileのbyte/SHA、終了コード、描画回数、境界追加、記録されたpixel/finite検査の集計、資源の算術に不一致は見つかりませんでした。初回約30分の中断や加速preflightを、この時間へ加算していません。

この監査は完走集計をrootから受領した後、raw未読で項目を固定した事後の独立確認です。helperをsource/rawの構造閲覧後、実行前に固定しました。初回は10/11で、UTCの `Z` をsystem Pythonが読めなかったことだけが失敗です。初回原票とsourceを残し、UTCを `+00:00` に正規化するhelperだけの既知修正後の回帰は11/11でした。元のsoak、公開原票、期待値、閾値は変えていません。

## engineと終了

| 項目 | 独立照合値 |
|---|---:|
| 実時間、ProcessInfo.systemUptimeによるengine区間 | 7200.009156791668秒 |
| command submit / render draw | 108,000 / 108,000 |
| draw/frame | 1 |
| 全区間のsubmit件数 / engine秒 | 14.999980923375回/秒 |
| MTL error / timeout / skipped deadlineの記録 | 0 / 0 / 0 |
| submit p95上側bin / 最大 | 0.23ms / 1.672249985859ms |
| engine PID / sampler PID / supervisor PID | 93049 / 93050 / 93048 |
| engine / sampler終了コード | 0 / 0 |
| supervisorのmonotonic経過 | 7202.620451秒 |

source shaderのSHAは凍結R5と一致し、R5 source6file、harness source3file、校正済み計測C、sampler/supervisorのhashを照合しました。実行物のlaunch hashは保存済みbuild manifestと一致しています。この監査で実行物を再compile/起動していません。

supervisorのUTC差は7202.519491秒で、monotonic区間と0.100960秒異なります。engineのUTC開始/期限は秒精度です。これらの違いからsleep、時計補正等の原因を推測せず、描画計時にはengineのsystemUptime、CPU分母には計測helperのCLOCK_MONOTONICを使います。最初の1frameのprogress actualFPS=1000はsourceの最小分母0.001秒による開始直後の集計で、瞬間的なpresentation FPSの証拠ではありません。

submitはuniform準備からcommitまでで、in-flight待ち、入力時のatlas再構成、画素readback、finite kernel、PNGを含みません。histogram108,000件、95%のrank102,600、0.01msの上側binからp95を再計算しました。上端bucketはceilによる量子化を含むため厳密な20.000ms境界の分類ではありませんが、今回はそのbucketが0件です。

sourceはqueue drain後にfinalを書き、40回のpixel検査では対応するcommandのcompletedを確認しています。ただし各108,000 commandの個別completed counterは原票へ保存していません。MTL error0とdrain後の正常終了を、独立に全件のGPU画質/presentationを確認した結果へ広げません。

## 文字保持と画像

10分ごとの境界は11回で、それぞれ400文字を追加しています。最大境界遅れは0.010016416665秒でした。初期1,536から保存材料5,936へ増え、毎frameの描画は1,536サンプルに制限されています。atlasは22→551種類、1→32row、CPU RGBA bitmapは524,288→16,777,216Bになりました。texture作成は12回です。

旧ID・text・ink・intake seedと旧atlas key/tileの照合は、sourceのguardが通った境界boolean11件を確認しました。個別tupleはrawに保存されていないので、この監査で文字tuple自体を再比較したとはしません。新batchだけに青/黄を付けるのはsourceから確認した挙動です。born/inputIndex、実保存/restore、ユーザー入力の保持は別の証拠です。

40回のpixelはすべて閾値lit>400を満たし、lit countは6,527〜24,519、pixel hashは40種類でした。3形×5地点=15個を各検査で有限判定し、合計600地点です。確認対象はp/du/dvの9 scalar成分で、全描画glyphや全時刻、面のnormal、形の正しさではありません。finiteの個別出力値は保存されておらず、sourceのguardと集計600を照合した証拠に限られます。

sourceの「最初の検査と、その後shapeが変わった検査でPNGを保存する」という条件に対応する13枚について、PNGをCPUで復号しました。RGBAからBGRAを復元したpixel SHA、BGR合計、lit countが各sample記録と完全一致しました。残り27回はPNG未保存で、集計値/hashの整合確認です。見た目の良し悪し、文字の読め方、clipの有無は判定していません。

旧Swift texture objectの弱参照残数はすべて0でした。driver全体のGPUメモリが解放された、リークがない、という保証ではありません。

## 資源の分母

| 項目 | 独立再計算値 |
|---|---:|
| resource行 / 有効行 / 欠測 | 1438 / 1437 / 1 |
| CPU有効区間 | 7197.237200秒 |
| user+system counter差 | 35,916,026,250ns |
| 1コア換算CPU | 0.499025184970% |
| weighted interval平均 | 0.499025184970% |
| sampled peak charged footprint | 133,268,392B = 127.094642639MiB |
| sampled peak RSS | 82,018,304B = 78.218750000MiB |
| process lifetime maximum footprint | 134,759,336B = 128.516517639MiB |

1437有効行のPID93049、start_abstime10229097982432、resource coalition56201、jetsam coalition56202、Mach timebase125/3が一致しました。user/systemは校正済みhelperがnsに変換済みで、再度timebaseを掛けていません。CPUの分母はCLOCK_MONOTONIC nsの最初/最後です。1436区間の算術も保存済みinterval記録と一致しました。

欠測はzero-based index1437の最後の1行です。時刻は21:25:06.196193 UTC、proc_pid_rusageのerrno3で、最後の有効観測21:25:01.181684 UTCからmonotonicで5.014476秒後でした。最後のprogressは107,953frameのrunning snapshotであり、別のfinal108,000frame/completedを上書きしていません。samplerのcompletedはengineFinalを別途読んだ結果です。

engineの実時間と資源の有効区間には2.771956791668秒の差があります。欠測を補間していません。したがって「全7200秒の資源を観測した」とは書けません。UTCの資源区間7197.166639秒とCLOCK_MONOTONIC7197.237200秒も混ぜません。

sampled peak chargedはrow1329、21:16:05.105261 UTCで、packetのengine elapsed6657.601193秒でした。lifetime peakも同じ観測で現れますが、初期準備を含みうる別指標です。RSS peakは終端近く3行で観測されています。CPU compile初期区間は除いており、footprintのlifetime値からcompileを差し引いたわけではありません。

この値は旧3形offscreen engineの明示PIDだけです。supervisor、sampler/計測helper、WindowServer、driver、compiler、rootが並行したCPU buildやnativeUIは加算していません。無負荷PCの評価でも、実小窓全体のCPU/RAMでも、13形や8時間、16GB laptop、Windows、GPU使用率、電力、system unique RAMの達成値でもありません。

## 採用する根拠

このR2は、旧R5 shaderとbody/atlas更新が実時間2時間のoffscreen走行を完了した信頼性の記録として採用できます。実窓の長期使用、IME、保存復帰、現行13/16形renderer、低負荷の目標を達成した根拠はそれぞれ別に必要です。
