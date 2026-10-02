# 同一processへの将来設計（未実装）

今回CLIが検証したのはJSON人工fixture→同一bundle→結果だけ。native app / Metal renderer / browser textareaへは接続していない。将来の入口は次の境界で設計できる候補となった。

1. 1つのJSContextにprivate R3 stateを1つ作る。bodyとnextIdはR3だけが持つ。Swift側でMatter.add、segment、同字dedupe、別ID allocatorを作らない。JSContext操作は一つのserial execution ownerから行い、同時mutateしない。
2. native側producerは版付きgrammar/source/session/seq/epochs/document version/operation tupleを明示し、R3.receiveへdataとして渡す。証拠品質を勝手にknowncommitへ上げない。実OS/APIやIMEの確定証拠・permissionsは今回未調査/未接続。
3. ACKはR3が全eventをbodyへ加えた後。nativeがrendererへ渡すまでACKを遅らせない。temporary no-ACKは原eventを一slotだけ不変に保ち、同tupleでretry。新しい入力競合やgapはunsupportedを出し、本文baselineからmissing bodyを復活させない。
4. 表示側はreadBody由来の有限readonly snapshotをそのframeで取り、元id/text/inkとpresentedCountを使う。Swiftの表示配列やGPU tileは一時projectionでありbodyの所有者ではない。画面seedは元idから派生。placeholder @はmaterial0。本文/ID/色順はvolatile、永続exportへ混ぜない。
5. shapeRequestは候補tokenだけを取り出す。focusEpoch/policyEpoch/generation/windowRevision/TTL/worker seqをR3で照合し、遅延した答えを無条件applyしない。回答が来なくても材料追加は続ける。今の候補は球/箱/輪の字句機構であり一般意味モデルではない。
6. pause/hiddenはrendererのframeを止め、R3 visibility/pause controlへ伝える。materialのbounded admissionとshape/revealの実行を分ける。復帰はR3の有限少量reveal。native app全体の停止/タイマ/資源を別途実測する。
7. 保存offは元R3.exportReceiver + strict validatorのaggregateだけ。renderer glyph/ID列/color順/window/query/fingerprintをexportしない。人体験/実本文採取の研究同意や保存設計を、このCLIの人工on caseで承認されたと扱わない。

将来の公開bridgeはprivate-stateを隠した受信/advance/read-presented-view/token/offexportの最小関数に限定する。このfixture evaluatorが返すinspect/histories/raw bodyは合成検証専用で、native product APIとして公開しない。native JSValueからSwiftへsnapshotを複写する際のlifetimes、GC、string/textureメモリ、shape token stale race、app resource budgetはまだ未確認。
