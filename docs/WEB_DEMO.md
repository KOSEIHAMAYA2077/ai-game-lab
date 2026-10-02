# ブラウザで試す

[文字のかたちを開く](https://koseihamaya2077.github.io/glyph-matter/) / [執筆モード](https://koseihamaya2077.github.io/glyph-matter/?write)。インストールやアカウントは不要。WebGL2対応ブラウザで動く静的Web版です。

## 操作

Enterで入力欄を開き、文字や文章を入れてEnter。少なければ「＋文字」で追加します。`表面 鳥`、`表面 魚`、`表面 蛇`で骨格の動きを、`表面 メビウスの輪`で帯の変形を試せます。入力した文字が表面の材料として残ります。「? HELP」で色・動き・個数、停止、自動の形変更を選べます。

## 公開した版

公開元は保存済みのタグ[`glyph-creature-p0-v0.11.0-rigs.1`](https://github.com/KOSEIHAMAYA2077/glyph-matter/tree/glyph-creature-p0-v0.11.0-rigs.1)、コミット`67f7a30e2e01a142ba092b4cd2e756bcf3d5757f`です。60形の根性版に鳥・魚・蛇の骨格を追加した試作で、モデル推論や外部生成APIは使いません。[実装と確認記録](https://github.com/KOSEIHAMAYA2077/glyph-matter/blob/glyph-creature-p0-v0.11.0-rigs.1/experiments/creature-rigs-v1/README.md)。公開中の版はWebサイトの[`version.json`](https://koseihamaya2077.github.io/glyph-matter/version.json)でも確認できます。

今後の目標は、軽量モデルを使って曖昧な文章からその場で3Dの形を作り、蓄積した文字を表面へ流すことです。任意の形の生成を達成した版ではありません。Codexの複数サブエージェントで研究調査・実装・レビュー・検証を分担しています。

## 原稿・日記の保存

入力した原稿と日記は、そのブラウザ内へ保存します。本文をサーバーへ送ったり、GitHubへ公開したりする機能はありません。アカウント同期はありません。ブラウザの保存データを消すと失われるため、必要な日記はJSONで書き出してください。

公開版はlocalhostで動かす版とは保存領域が異なり、自動で移りません。既存版を削除せず、日記のJSON書き出し・読み込みで移せます。GitHub Pagesの同じユーザー配下ではWebの保存領域を共有するため、別の試作を同時公開する際は保存キーを分ける必要があります。

## 公開を更新する

[公開ワークフロー](../.github/workflows/playable-pages.yml)は、main内の以前の試作コードではなく、`PLAYABLE_REF`に指定した保存済みのタグをチェックアウトします。依存はロックファイルから導入し、単体テスト・型検査・ビルドが通った配布ファイルだけをGitHub Pagesへ公開します。研究資料、添付本・画像、ローカルの原稿・日記、開発用フォルダは配布に含めません。素材のライセンスは配布ファイルに同梱します。

更新時は新しいタグを保存し、`PLAYABLE_REF`とこの文書の公開版を新しいコミットで更新します。以前のタグとブランチは保持します。手動の再公開はGitHub Actionsの「Publish playable prototype」から行えます。

参照: [GitHub Pages公式の公開ワークフロー](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

## 名称の変更 — 2026-10-02

リポジトリ名を `glyph-matter`、作品名を **Glyph Matter** に変更しました。GitHubの履歴・タグ・ブランチと公開元の版は保持しています。ローカルの以前のフォルダ名は変更していません。Web版のURLは上記の新しいURLです。旧GitHub URLは転送されますが、GitHub Pagesの旧URLは転送対象ではありません。[GitHub公式の改名説明](https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository)。
