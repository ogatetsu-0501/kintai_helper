# 勤務実績補助拡張

この拡張はjinjer勤怠の入力をお手伝いするChrome拡張です。ボタンを押すだけで残業時間や理由を素早く入力できます。設定の保存と復元もできるので、環境を簡単に引き継げます。

## 主な機能
- ボタンをクリックするだけで勤務情報を入力
- ボタンの並び替え・追加・削除が可能
- 申請取消時に入力内容を自動保存し、次回起動時に復元
- 設定のエクスポートとインポート
- Github上の更新をチェックして通知

## ファイル構成
- `manifest.json` : 拡張機能の設定
- `content.js` : 画面で動くメインスクリプト
- `background.js` : 更新後にタブを再読み込みするサービスワーカー
- `default_config.json` : 初期ボタン設定
- `update/` : 更新用スクリプトが入ったフォルダ

## インストール方法
1. [GitHubダウンロードリンク](https://github.com/ogatetsu-0501/kintai_helper)このリポジトリを好きな場所に展開します。
2. Chromeの拡張機能ページを開き、右上の**デベロッパーモード**をONにします。
3. 「**パッケージ化されていない拡張機能を読み込む**」を選び、展開したフォルダを指定します。
4. jinjer勤怠のページを開くと、画面上部にボタンが表示されます。

## 更新手順
1. 画面右上に更新案内が表示されたら`update`フォルダのスクリプトを実行します。
   - Windows: `update/win/update.exe`
   - Mac: `update/mac/update.command`(権限付与難易度が高いため、GitHubからのダウンロードを推奨)
   - WindowsでPowerShellが見つからないときは、次の場所を順番に探します。
     1. `C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`
     2. `C:\\Users\\<ユーザー名>\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Windows PowerShell\\powershell.exe`
     見つからなくても`tar`コマンドでZIPを解凍して処理を続けます。
2. スクリプト実行後、Chromeの拡張機能ページで**更新**ボタンを押してください。

### 書き込みできないときは
`update.command` を実行して「read-only」と表示された場合、フォルダに書き込めない状態になっています。次の手順で権限を確認し、必要に応じて変更してください。

1. **フォルダに移動する**
   ```bash
   cd パス/to/kintai_helper
   ```
   *ターミナルにフォルダをドラッグアンドドロップすると、上の`cd`の後に自動でパスが入力されます。*
2. **今の権限を確認する**
   ```bash
   ls -ld .
   ```
   表示結果に `w` がなければ書き込み不可です。
3. **書き込み権限を付ける**
   ```bash
   chmod -R u+w .
   ```
   失敗するときは `sudo` を付けて再実行します。
4. **スクリプトの実行権を付ける**
   ```bash
   chmod +x update/mac/update.command
   ```
この後にもう一度 `update.command` を試してみてください。

## ライセンス
MIT License
