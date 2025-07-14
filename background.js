// == background.js ==
// 拡張機能をリロードするためのサービスワーカー
// メッセージを受け取ったらreloadするだけだよ

chrome.runtime.onMessage.addListener((msg) => {
  if (msg === "reload_extension") {
    chrome.runtime.reload();
  }
});

// 拡張機能が更新された直後に実行されるよ
// kintaiページを開いているタブがあったら再読み込みするよ
chrome.runtime.onInstalled.addListener(() => {
  // 取得したいURLパターンを設定
  chrome.tabs.query({ url: "https://kintai.jinjer.biz/*" }, (tabs) => {
    for (const tab of tabs) {
      chrome.tabs.reload(tab.id);
    }
  });
});
