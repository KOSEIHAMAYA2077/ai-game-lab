# Glyph Matter — 小窓のmacOS試作

AppKitの小窓に、既存の文字表面のWeb画面を表示する。独自のブラウザ実行環境は同梱せず、macOS標準のWKWebViewを使う。配布ファイルの大きさと、起動後のRAM・CPU・GPU負荷は別に測る。

このフォルダはネイティブの窓だけを担当する。描画・文章の解釈・文字の保存・描画停止は`widget.html`側が担当する。ウィジェット程度の負荷を達成したという宣言ではなく、実測用の別試作。

## ビルドと起動

macOS 13以降、AppleのCommand Line Toolsが必要。追加のパッケージやランタイムはインストールしない。Web側の依存とビルドは別途用意し、`widget.html`を含む完成済みの`dist`を渡す。

```sh
./desktop/glyph-widget/build.sh \
  --web-dir "$PWD/prototypes/glyph-creature/dist" \
  --output "$PWD/.local/Glyph Matter Widget.app"

open "$PWD/.local/Glyph Matter Widget.app"
```

両引数は絶対パス。既存の出力先がある場合は停止するため、比較版は新しい出力先へ作る。既存アプリやWebのソースは削除・上書きしない。生成アプリはローカルのアドホック署名付きで、Appleの公証を受けた配布版ではない。現在のマシンのCPU向けにコンパイルするため、他のCPU向けの配布は別途ビルドと検証が必要。

配布アプリには[ブラウザ依存のライセンスと第三者告知](licenses/README.md)を`Contents/Resources/ThirdPartyLicenses`へ同梱する。Web内のWordNet・KanjiVG等の告知も保つ。この処理は本プロジェクト独自コードのライセンスを新たに指定するものではない。

最初は黒い400×440の小窓。タイトルバーをドラッグして移動、窓の端で大きさを変えられる。EnterやEscape、入力はこのアプリにフォーカスがある時だけ受ける。他アプリの文字入力を監視しない。

メニューの「手前に表示」は最前面表示の切替。「隠す」または閉じるボタンで隠せる。「表示」やDockのアイコンで戻る。終了は「Glyph Matterを終了」または⌘Q。閉じる操作とアプリの終了を分ける。自動起動・ログイン項目・省エネ設定・OSの入力権限は変更しない。

## 停止の橋渡し

ネイティブの窓が隠れる、最小化される、完全に覆われる時、次のイベントをWeb画面へ送る。

```js
window.addEventListener('glyph-widget-lifecycle', event => {
  // falseでは描画の予約そのものを止める。再表示では必要な分だけ再開する。
  const visible = event.detail.visible;
});
```

別のアプリへフォーカスを移しても、小窓が見えていれば動きを続ける。ネイティブ側に周期的なポーリングはない。イベントを受けて実際に描画を停止したかは、Web側のカウンターとアプリ全体の負荷で確認する。

## ローカル配信と保存

`WKWebView`のES module・Workerの読み込みに合わせ、同梱ファイルだけを読む小さなHTTPサーバーを起動する。AppleのNetwork frameworkを使い、**127.0.0.1のみにバインド**する。Bonjour広告もLAN配信もしない。

- GET/HEADのみ。入力を受けるAPIや入力ログはない。
- Hostは起動時の127.0.0.1とポートの一致を要求する。
- パスの`..`、二重エンコード、バックスラッシュ、NUL、同梱フォルダ外へのシンボリックリンクを拒否する。
- JavaScript・WASMを適切なContent-Typeで送る。1リクエストで接続を閉じ、過大なヘッダー・同時接続を制限する。
- 主画面のナビゲーションは同じローカルoriginに限定する。Web側の外部素材・モデル取得はこの制限と別なので、その仕様と実際の通信をWeb側で検証する。

初回は空いているポートを選び、アプリ専用UserDefaultsへ保存する。次回は同じポートを優先するが、使用中なら別のポートへ退避する。WKWebViewのlocalStorageはorigin単位なので、**退避した起動では以前の保存状態が見えないことがある**。完全なアプリ独立保存はこの窓の実装に含まれない。OS全体の設定は変更しない。

## 任意の計測出力

評価時だけ`--metrics-file`へ絶対パスを渡せる。通常起動では診断ファイルを作らない。

```sh
open "$PWD/.local/Glyph Matter Widget.app" --args \
  --metrics-file "$PWD/.local/widget-native-metrics.json"
```

Web側は、描画したフレームの中から必要な間隔で次の橋へ数値を送る。非表示でも動き続けるタイマーを、この出力のために追加しない。

```js
window.webkit?.messageHandlers.widgetMetrics.postMessage({
  frames: 120, renderCount: 120, renderedGlyphs: 800,
  storedGlyphs: 2400, fps: 15, workerActive: false,
  visible: true, paused: false, busy: false
});
```

固定した数値・真偽値のキーだけを採用する。任意のオブジェクト、入力本文、文字列、認証情報は保存しない。Webのメッセージによる書き込みは最大毎秒1回。ネイティブの表示状態変更では即時更新する。ファイルには主PID、表示・最小化・最前面の状態も含む。

主PIDだけではアプリ全体のRAMにならない。WKWebViewのWebContent・Networking・GPUプロセスの帰属を起動前後と終了時に調べ、対象範囲を示す。RSS・physical footprint・GPUメモリ・ダウンロード量を混同しない。

## 確認

```sh
./desktop/glyph-widget/test.sh
```

ルーティング・パス拒否・DNS rebinding対策のHost検査に加え、実際のNetwork frameworkのlistenerへGET/HEADを送り、20項目を確認する。テスト用ファイルは無視対象の`.local`へ残す。

2026-10-03のこのMacではSwift 6.3.2でコンパイル、20項目に合格。WKWebView上でのWebGL・Worker・日本語IME・実際の停止負荷は、完成したWebビルドを同梱したアプリで別途確認する。Windows版と16GBノートPCの測定はこのネイティブ実装には含まれない。

Appleの一次資料: [WKWebView](https://developer.apple.com/documentation/webkit/wkwebview)、[NWListener](https://developer.apple.com/documentation/network/nwlistener)、[requiredLocalEndpoint](https://developer.apple.com/documentation/network/nwparameters/requiredlocalendpoint)、[WKScriptMessage](https://developer.apple.com/documentation/webkit/wkscriptmessage)。
