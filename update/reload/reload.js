// このページを開くと拡張機能をリロードするよ
chrome.runtime.sendMessage("reload_extension", () => {
  window.close();
});
