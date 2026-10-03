# R2 host clock guard / known regressions

独立 reviewer が source/作者fixture未読で凍結した12session＋14wire親case/15attemptを、real JSC / Swift helperへ通しました。R1 は手書き12session一致、wire14pass/1fail。W12 は同session/body2/gen2/nextId3/presented2/shapeを保ち、metadata `aggregate.now=110→109`、deltaなし。Bridge と Projection の両方が受理し、glyphsが不変でも `bridge.lastMetadata` が109に巻き戻りました。これは host 転送境界の人工 fault で、producer の command-at 単調 guardとは別です。実IME/実窓/OSで発生したと主張しません。独立初回原票は reviewer 所有の別 folder に保持されています。

作者の [CLOCK-METHOD-R2](CLOCK-METHOD-R2.json) と手書きclock8を修正前にfreezeし、R1で追加境界を再現しました。4/8: rollback metadata-only、rollback bodygrowth、negative初回、Number.MAX_SAFE_INTEGER超過初回がFAIL。原票は [R1 known](results-clock-r1-known.json)。同時刻・増加・明示newsession reset0・不正delta後にclock未更新の4件は通りました。これはW12を知った後の感度/既知回帰であり、fresh独立8件と数えません。

新 source `ReceiverBridge-r2.swift / Projection-r2.swift` だけに `aggregate.now>=0 && <=9007199254740991 && >=previous successfully accepted clock` を追加しました。同時刻は許可し、全 metadata/delta の検証に成功してからclockを記録します。Projectionにreadonly `observedAt:Int?`を追加。新 core/session＋空projectionへの明示bindはclock0で開始できます。自動 rebase、body reset、input取消の改善は入れません。AppMain-r2は診断version名だけ、新Info/build scriptは別appのnamespace/executableを指定します。

作者の同じclock8は **8/8**、実JSC fakewire→本物Bridge と typedpacket→本物Projection の双方が期待どおり。rollback+bodygrowthではdelta取得を開始せずbody/cache不変。bad deltaでclockが先に進まないこと、続く同時刻の正しいdeltaを受理することも確認しました。fakewireはhost fault probe専用で、生成した擬似bundleをappには入れていません。appのJavaScriptCoreは同じR3実bundleです。

元のnative14 **14/14**、pure-core3 **3/3**、invalidwire8 **8/8**、instance15,908対80B一致、native16有限96/96を **同じ期待の既知修正回帰**として再実行。metadata/body転送数と表示内容はR1と一致しました。65536 UTF-16の既知上限回帰も別原票を保存しています。

R1 source freeze29・candidate/app/compiled41 pinsと元public rowsを変更していません。元Core R3、JSbundle42,266B、OwnEditor R2、shader、renderer、geometry/camera/material/weights/densityは同じbytes。R2appのcompile/sign/strict verifyは成功。全compiled Swiftは [R2 manifest](CACHE-CANDIDATE-R2.json) でpinしています。元fastMathEnabled deprecation warningをそのまま保存し、新public copyだけtrace privatepathを置換します。

局所timing初回/再計測は **cache source R1** の測定です。R2は時刻guardを加えたcandidateで、このspeed値をR2の再測定値としません。同じ意味/転送gateを保持したことと、wholewidget CPU/RAM/実fps/人間快適性は別です。real UI/IME/resourceは未確認。rootのmostly-idle別CLI観測もこのappの資源に換算しません。

時刻guardで任意改ざんを全て検出する契約へは拡大していません。同期直列call、SHA-pinned immutable append R3、bounded session/gen/count/next/presented、正しいnewdeltaが前提です。同じ時刻・同bodyの任意の内部core mutationはfingerprintなしでは検出できません。host viewはvolatile rendering cache、本文/IDのownerはR3のみ。off exportに本文/ID列/色順/session/window/query/fingerprintを入れません。

R2の最終採否は独立同期待回帰の結果とsourceレビューをrootが合わせて決めます。作者の限定CPU候補合格を実窓/OS連動/軽量常駐達成へ読み替えません。

## Transfer is separate from core enumeration

独立 source review から、idle metadata-only は **bridge転送** の保証と明確にする補足を受領しました。元の shape-only `advance` は bounded recent/chunkText の body slices を読みます。内部body enumeration0、内部処理停止、完全なO(1)idleを主張しません。growth時の `readBody(state)` も全bodyを走査してから `id>afterId` を選別しており、転送がnewrangeだけであることとO(delta)の走査時間は別です。256上限のR3/body windowを保った有限機構で、source改変はしていません。15fps時に省いたのはfull JSON転送・UTF-8decode・Swift全prefix検算であり、全体のCPUや意味解釈処理が消えたわけではありません。

## Independent R2 gate

独立担当はsource/作者fixturesを読む前に期待を固定し、同じ12session/14wire親case・15attemptを **R2既知修正回帰**として再実行しました。12session/66通常stepが旧immutableR5と一致、15/15wire attempt合格、W12はBridge/Projection両経路でrejectしclock110/body/glyphを保持。別に実CPU builderの804instance全80Bがbitwise一致しました。転送値もR1から不変。独立原票は別所有で、[INDEPENDENT-GATE](INDEPENDENT-GATE-R2.json)に相対path/SHAを記録しています。helperのR3名とcandidate R2を分けて記録し、元R1 14/15の失敗を更新していません。

この独立境界レビューでは追加source blockerは報告されませんでした。R2を限定CPU/source接続候補として返却します。実UI/IME、whole-window CPU/RAM/energy、快適さ、OS取得、GPU同等性の新測定は採択に含みません。
