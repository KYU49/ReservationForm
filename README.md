# オープンソース予約表

**[デモページ](https://kyu49.github.io/ReservationForm/)**

とりあえず、公開したところ。もう少しバグ取りしていると思うので、安定してから使いたい人はもうちょっと待った方がいいかも。

## すっごいところ
* 高機能な予約表のフロントエンド部分。
* OSSで商用でも無料(ライセンス参照)。
* 表示項目はテキストファイルを書き換えるだけで簡単に変更可能。
* 直感的な操作が可能。

## すごくないところ
* 社内・ラボ内向けで、外部公開は前提としていない。
* PC専用でスマホは未対応。
* 置き場所(レンタルサーバーで可; [Static Web Apps](https://learn.microsoft.com/ja-jp/azure/static-web-apps/overview)や[Netlify](https://www.netlify.com/)など)は用意する必要がある。
* バックエンド(Google Apps Scriptでも可)も用意する必要がある。
* アーキテクチャが無茶苦茶なのには目をつぶる必要がある。

大学時代にラボ内向けに作っていた予約表を簡単に書き換えできるようにアップデートしたものです。世界から使いづらい予約表を根絶するために無料(ライセンス参照)で公開しています。自力で導入する場合は自由に使えますが、やり方が分からなくても導入の依頼は受け付けておりません。

# デモ

**[デモページ](https://kyu49.github.io/ReservationForm/)**

にて実際に試してみることができます。  

予約の入力ができますが、アクセスした他の人も閲覧できてしまうため、不適切な内容は入力しないようにしてください。セキュリティ対策に工数をかけられないため、不適切な利用があった場合は法的措置を取る可能性があります(よっぽど悪質でなければ気にしないので、色々触ってみてください)。バグや不具合、使いづらい点が見つかったら[issue](https://github.com/KYU49/ReservationForm/issues)から報告をよろしくお願いいたします。  
テスト用のため、入力内容は**1時間ごとに全部削除**されるようになっています。  

また、サーバーサイドにGoogle Apps Scriptを使った場合の例もあります。
* [予約を管理するスプレッドシート](https://docs.google.com/spreadsheets/d/1HNspuMDIj3M2WjFaglreRMwCTX_Cea8RTsie9v-pWBU/edit)
* [予約の追加を受け取るGoogle Apps Script](https://script.google.com/u/0/home/projects/1_Gs7Fzhgo2cZ3VI0OapHuoLTc8WVYCygSOLW5IlqdhXZbOja6Fa2osZD/edit)  

サーバー側はメインでないのでかなり雑ですし、セキュリティホールありそうなので、そのまま利用する場合はご注意ください。 

# Features
 
* タイムラインをドラッグドロップすれば、時間が自動入力される。
* 一画面でタイムラインと作成中の予約を見比べることが可能。
* 複数日の予約を一気に確認可能。
* 複数の部屋や建物の予約を1ページで管理可能。
* フォームの入力内容はブラウザごとに記憶。
* 予約項目はparameters.txtを書き換えることで自由に変更可能。
* 朝と夜の時間を始まりと終わりの時間を就業時間などに応じて変更可能。
* 既存予約の編集にパスワード保護が可能(サーバー側での実装も必要)。
* 必須入力項目を指定可能。
* OutlookやGoogleカレンダーのオンライン版に予約を登録することが可能。
* HTMLやJavascriptの知識があれば、自由に書き換え可能。
 
# Requirement
 
* htmlファイルを静的にホスティングできるサーバー(レンタルサーバーでOK)
* 予約の管理をする動的なサーバー(Google Apps ScriptでもOK)
 
# Installation

## フロントエンド
`git clone`でローカルに落とすか、以下のファイルをダウンロードして、同じディレクトリに入れてください。
* index.html
* parameters.txt
* reservation.css
* reservation.js

```bash
git clone https://github.com/KYU49/ReservationForm.git
```

parameters.txtをVSCodeやメモ帳で開き、ファイル内の指示に従って、自分の好みの設定を行ってください。  
あとはレンタルサーバーの同じディレクトリにアップロードしたら使用できます。  
レンタルサーバーがよくわからない人はMicrosoftが提供している[Static Web Apps](https://learn.microsoft.com/ja-jp/azure/static-web-apps/overview)か[Netlify](https://www.netlify.com/)は個人や小さな研究室レベルであれば無料で使用できるため、このあたりを使えば問題ないかと思います。


## サーバーサイド

基本的には自分で適当なサーバーでバックエンドのプログラムを作成してください。

よくわからない人用に、サーバーサイドにデモで使っていたGoogle Apps Scriptをそのまま使う方法を以下に示します(ライセンス内容を要確認)。
* [予約を管理するスプレッドシート](https://docs.google.com/spreadsheets/d/1HNspuMDIj3M2WjFaglreRMwCTX_Cea8RTsie9v-pWBU/edit)を開く。
* 「ファイル」→「コピーを作成」で自分のGoogle Driveにコピー。
* 「拡張機能」→「Apps Script」からスクリプトを開く。
* 右上の「デプロイ」→「デプロイを管理」→「デプロイメントの作成」
* 「次のユーザーとして実行: 自分」「アクセスできるユーザー: 全員」に設定(初期状態のまま)。
* 「デプロイ」
* 「アクセスを承認」
* アクセス権を与えることに対する警告ページが表示される。
* 左下の「Advanced」→「Go to ReservationForm (unsafe)」→「Allow」
* 「ウェブアプリのURL」をコピーし、paramerters.txtに記載する。
* スプレッドシートの一番上の行をparamerters.txtに合わせて修正。

また、こちらもあらゆる保証はしませんが、perl用のCGIプログラムも作成しました。  
以下はLinux (Ubuntu)上にApacheのサーバーが動いている前提の例です。  
ファイル構成は各自確認してください。  
* [perl](https://github.com/KYU49/ReservationForm/tree/main/perl)内のファイルを全て`/usr/lib/cgi-bin/reserv`に保存。
* `chmod`でperl.cgiは755, 他は775に設定。
    - 動かなかったら(500エラーが出る)、perl.cgi以外を777にしたら動くが、セキュリティ的によろしくないので、cgi-binの所有者を適切に設定すること。
* `/var/www/html/reserv`に以下のファイルを配置。
    - index.html
    - parameters.txt
    - reservation.css
    - reservation.js
* 古いperlなどだと、JSONやDigestなどのモジュールが標準で入っていない場合があるため、インストールするか`perl.cgi`内に記載されている指示に従うこと。
* ファイルの配置場所が前述の場所と異なる場合は、`paramerters.txt`で相対パス or 絶対パスで`perl.cgi`の場所を指定。
* `reserv.dat`の一番上の行を`parameters.txt`で設定した項目と合わせる(スペースではなく、必ずタブ文字で区切ること)。

同じくあらゆる保証はありませんが、php用のプログラムも作成してあります。
* [php](https://github.com/KYU49/ReservationForm/tree/main/php)内のファイルをperl用のプログラムと同様に設置してください。


## フロントエンドとバックエンドの受け渡し
基本的に全てJSONでやり取りするようにしています。POSTでやりとりされるように設計しています。詳細は以下。
### Fetch
タイムラインの予約リストを読み込む際に使います。
#### フロントエンド → サーバー
サーバー側で以下の形のJSONを受け取れるようにしてください。
```js
{type: "fetch", start: startYmd + "0000", end: endYmd + "0000", group: group};
```
* type: 要求する操作の種類。fetchの場合は指定した予約リストを取得目的。
* start: `yyyymmddhhMM`の形で開始日時を指定。タイムラインで一番上の日付からの予定を取得したいため、`hhMM`の部分には`0000`を指定。
* end: `yyyymmddhhMM`の形で終了日時を指定。parameters.txtで指定した日数後の日付がendYMDに入力される。`hhMM`の部分には最終日の24時にあたる最終日翌日の`0000`を指定。
* group: 左ペインから開いた現在のページの名前をアンダースコアで繋いで指定。以下に例。
```txt:parameters.txt
# 建物名
+ フロア名(階)
* 部屋名
```
とあった場合、groupには`group = "建物名_フロア名(階)"`が入っている。
#### サーバー → フロントエンド
サーバー側で以下のように整形してフロントエンドに返してください。
```js
[
    {
        "id": 100, 
        "group": "ページ名",
        "row": "部屋名", 
        "group": "ページ名",
        "start": "202307071100", 
        "end": "202307071200", 
        "others": {
            "name": "TestTarou", 
            "domain": "GroupA", 
            "contact": "09012345678"
        }
    },
    {...}, 
    ...
]
```
* id: ユニークな予約のID。削除や更新に使う。
* row: どの部屋・機器の予約か。
* start: 予約開始時間をyyyymmddhhMM形式で。
* end: 予約終了時間をyyyymmddhhMM形式で。
* others: 右ペインの入力フォームの内容を連想配列 (= hashmap, dict)で指定。parameters.txtで指定した「ユニークな英数字のid」。上の例はparameters.txtに以下のような表記がある場合。
```txt:parameters.txt
- 名前,name,*+
- 所属,domain,+
- 連絡先,contact,
```
**注意**: サーバーから`password`の値だけは返却しないこと。

### add
予定の新規作成、既存予定の変更を行う際に使います。
#### フロントエンド → サーバー
サーバー側で以下の形のJSONを受け取れるようにしてください。
```js
{
    type: "add", 
    eventId: 100,
    "group": "ページ名",
    "row": "部屋名", 
    "group": "ページ名",
    "start": "202307071100", 
    "end": "202307071200", 
    "others": {
        "name": "TestTarou", 
        "domain": "GroupA", 
        "contact": "09012345678"
    }
    "password": "asdfghjkl"
}
```
基本的にはfetchの時と同じ形です。新規作成の場合には`eventId = -1`でpostされます。othersにはparameters.txtで指定したフォームの項目が全て入るため、適切に処理してください。
#### サーバー → フロントエンド
サーバー側で以下のように整形してフロントエンドに返してください。
```js
["Success", "新規作成 or 更新が成功した旨のメッセージ(alertで表示される)"]
```
失敗した場合は、以下のように返してください。
```js
["Error", "新規作成 or 更新が失敗した旨のメッセージ(alertで表示される); 「既に予定が入っています」など"]
```
### delete
既存予定の削除を行う際に使います。
#### フロントエンド → サーバー
サーバー側で以下の形のJSONを受け取れるようにしてください。
```js
{
    type: "delete", 
    eventId: 100,
    password: "asdfghjkl"
}
```
passwordはparameters.txtで**設定している場合のみ**送信されます。
#### サーバー → フロントエンド
サーバー側で以下のように整形してフロントエンドに返してください。
```js
["Success", "削除が成功した旨のメッセージ(alertで表示される)"]
```
失敗した場合は、以下のように返してください。
```js
["Error", "削除が失敗した旨のメッセージ(alertで表示される); 「既に削除済みです」など"]
```


## 注意
ローカルでhtmlファイルを開いても`fetch`ができず、テストすることができません。ローカルでテストしたい場合は、[VSCode](https://code.visualstudio.com/download)をインストールし、Extensionsから「Live Server」をインストールしてください。ファイルが保存されているディレクトリをVSCodeで開き、右下の「Go Live」を押すことでブラウザでページを表示することができます。

# Note
 
前述の通り、Google Apps Scriptのサーバーはデモ用に適当に作っただけです。基本的には自分で実装することを強くおすすめします。また、ローカル側での処理が多く、対外的に公開するには不向きな面があります。  
作成者はMVCモデルでの勉強のついでにこのプログラムを作成しました。そのため、アーキテクチャはかなり滅茶苦茶なので、参考にしないようにお願いします。
 
# Author
 
* 作成者: KYU
* Twitter: [@kyuphd](https://twitter.com/kyuphd)
* Mastodon: [@kyuphd@fedibird.com ](https://fedibird.com/@kyuphd)
 
# License

This is under [GNU Affero General Public License](https://www.gnu.org/licenses/agpl-3.0.html).  

ライセンス内容と相違があれば、ライセンス内容を優先しますが、以下に簡単にライセンスの説明を記載します。
* 個人用や社内用に使う分には制約は少ない。
* ただし、何か起こっても責任は使用者に帰属する。
* 企業が他社に提供するウェブページなどのサービスで使用する場合は厳しい。
    - ちゃんとライセンス内容と作成者を明示。
    - 提供するサービスも同じライセンスで提供する必要がある。
    - さらにこのシステムを部分的にでも組み込んだシステムのソースコードを開示する義務が発生する。
* 要はこのプログラムをパクって商売しようとするのはある程度制限するけど、その他は自由に使ってね、っていうイメージです。
* 大事なことなのでもう一度言いますが、ライセンス内容が優先です。ライセンス内容に従ってください。
