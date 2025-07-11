// 要素が現れるまで繰り返しチェック（SPA対応）
const checkInterval = setInterval(() => {
    const textarea = document.getElementById("update_reason");

    // 対象の親divが表示されているか確認
    const targetDiv = document.evaluate(
        '/html/body/div[7]/div/div[2]/div[3]/div[3]',
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
    ).singleNodeValue;

    if (textarea && targetDiv && targetDiv.offsetParent !== null) {
        // 初回のみ実行（2重登録防止）
        if (!textarea.dataset.injected) {
            textarea.value = "勤怠実績";
            textarea.dataset.injected = "true";

            // ボタン生成
            const button = document.createElement("button");
            button.textContent = "残業に変更";
            button.style.marginTop = "10px";
            button.style.display = "block";
            button.style.background = "#0b79d0";
            button.style.color = "#fff";
            button.style.border = "none";
            button.style.padding = "6px 10px";
            button.style.cursor = "pointer";

            button.addEventListener("click", () => {
                textarea.value = "残業";
            });

            // テキストエリアの下にボタンを追加
            textarea.parentElement.appendChild(button);
        }

        // チェックを止める
        clearInterval(checkInterval);
    }
}, 500);
