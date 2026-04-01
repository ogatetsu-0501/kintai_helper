// ====== page_hook.js ======

// ★ このファイルはページ本体の世界で動くよ
// ★ fetch と XHR を見て、月次勤怠レスポンスだけを content.js に知らせるよ

(() => {
  // ★ 同じ監視を二重で入れないための印だよ
  if (window.__kintaiHelperScheduleHookInstalled) {
    return;
  }
  window.__kintaiHelperScheduleHookInstalled = true;


  // ★ 今読み込まれている script タグから設定を受け取るよ
  const currentScript = document.currentScript;
  const eventName =
    currentScript?.dataset?.eventName || "kintai-helper:schedule-month";
  const targetPath =
    currentScript?.dataset?.apiPath ||
    "/v1/dashboard/time_cards/time_cards_schedule_month";

  // ★ URL を安全に読むよ
  function parseUrl(url) {
    try {
      return new URL(url, location.href);
    } catch (error) {
      return null;
    }
  }

  // ★ 対象の API かどうかを、URL のパスで判定するよ
  function isTargetUrl(url) {
    const parsed = parseUrl(url);
    if (!parsed) {
      return false;
    }

    return parsed.pathname === targetPath;
  }

  // ★ content.js 側へイベントで知らせるよ
  function notify(url, payload) {
    try {
      document.dispatchEvent(
        new CustomEvent(eventName, {
          detail: JSON.stringify({
            url,
            payload,
          }),
        }),
      );
    } catch (error) {
      // ★ 送れなかったときは何もしないよ
    }
  }

  // ★ レスポンス文字列を JSON にして、対象なら送るよ
  function handleResponseText(url, text) {
    if (!isTargetUrl(url)) {
      return;
    }

    if (typeof text !== "string" || text.trim() === "") {
      return;
    }

    try {
      const payload = JSON.parse(text);


      notify(url, payload);
    } catch (error) {
      // ★ JSON ではないときは何もしないよ
    }
  }

  // ★ fetch を横から見て、対象レスポンスを拾うよ
  const originalFetch = window.fetch;
  if (typeof originalFetch === "function") {
    window.fetch = async function (...args) {
      const response = await originalFetch.apply(this, args);

      try {
        const requestUrl =
          typeof args[0] === "string"
            ? args[0]
            : args[0] && typeof args[0].url === "string"
              ? args[0].url
              : "";

        if (isTargetUrl(requestUrl)) {

          response
            .clone()
            .text()
            .then((text) => {
              handleResponseText(requestUrl, text);
            })
            .catch(() => {
              // ★ 読めなかったときは何もしないよ
            });
        }
      } catch (error) {
        // ★ ここで失敗しても本来の fetch はそのままだよ
      }

      return response;
    };
  }

  // ★ XHR も横から見て、対象レスポンスを拾うよ
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__kintaiHelperRequestUrl = url;
    return originalOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener("load", () => {
      try {
        const requestUrl = this.__kintaiHelperRequestUrl || "";

        if (!isTargetUrl(requestUrl)) {
          return;
        }


        if (typeof this.responseText !== "string") {
          return;
        }

        handleResponseText(requestUrl, this.responseText);
      } catch (error) {
        // ★ ここで失敗しても本来の通信はそのままだよ
      }
    });

    return originalSend.apply(this, args);
  };
})();
