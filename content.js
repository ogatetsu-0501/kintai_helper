// == content.js ==

// == 更新チェック ==
// Githubの最新コミット日時と手元の更新日時を比べるよ
const commitApiUrl =
  "https://api.github.com/repos/ogatetsu-0501/kintai_helper/commits/main";
const localUpdateUrl = chrome.runtime.getURL("last_update.txt");

// ★ 更新方法を知らせる通知を作る関数
function showUpdateNotice(folder, script) {
  // 表示用の入れ物を作るよ
  const box = document.createElement("div");
  box.id = "kintai-update-notice";
  box.style.position = "fixed";
  box.style.top = "10px";
  box.style.right = "10px";
  box.style.zIndex = "10000";
  box.style.background = "#fff";
  box.style.border = "1px solid #000";
  box.style.padding = "10px";
  box.style.fontSize = "14px";
  // ここで実行してほしいファイルのパスを教えるよ
  box.textContent = `拡張機能が更新されています。kintai_helper\\update\\${folder}\\${script} をダブルクリックで実行して下さい`;
  // そのまま画面に出すだけでOK
  document.body.appendChild(box);
}

// ★ ボタンの共通スタイルを設定する関数だよ
function applyDefaultButtonStyle(btn) {
  // 背景や文字色をそろえるよ
  btn.style.backgroundColor = "#ffffff";
  btn.style.color = "#7cdcea";
  btn.style.border = "1px solid #66d3e4";
  // サイズ感を合わせるための設定
  btn.style.fontSize = "13px";
  // 文字が折り返さないようにして横幅を自動調整するよ
  btn.style.padding = "0.5em 1em";
  btn.style.whiteSpace = "nowrap";
  // 角を少し丸くして中央ぞろえにする
  btn.style.borderRadius = "2px";
  btn.style.display = "inline-block";
  btn.style.verticalAlign = "middle";
  btn.style.textAlign = "center";
  btn.style.marginLeft = "6px";
  btn.style.marginRight = "6px";
}

Promise.all([
  fetch(localUpdateUrl)
    .then((r) => r.text())
    .catch(() => ""),
  fetch(commitApiUrl)
    .then((r) => r.json())
    .catch(() => null),
])
  .then(([localText, remote]) => {
    if (!remote) return;
    const localTime = Date.parse(localText.trim());
    const remoteTime = Date.parse(remote.commit.committer.date);
    if (isNaN(localTime) || remoteTime > localTime) {
      const isWin = navigator.userAgent.includes("Windows");
      // Windowsならwinフォルダ、それ以外ならmacフォルダを使うよ
      const folder = isWin ? "win" : "mac";
      // 実行するスクリプト名もOSで分けるよ
      const script = isWin ? "update.bat" : "update.command";
      // 自動でタブを開くのではなく通知を表示するよ
      showUpdateNotice(folder, script);
    }
  })
  .catch((e) => console.error("更新チェックに失敗しました", e));
// == 更新チェックここまで ==

// 0. 初期フラグ
let previousVisible = false; // 勤怠実績UIが描画済みか
let tempSaveInitialized = false; // 一時保存処理を設定したか
let tempDataRestored = false; // 一時保存データを復元したかどうか
let restoredReason = ""; // 復元した理由テキスト
// 初期ボタンの設定を入れる箱をつくるよ
// デフォルト設定の入れ物を作るよ
// title: ボタンの上に書く見出し
// workTypes: 勤務種類ボタンの一覧
// reasons: 理由ボタンの一覧
let defaultConfig = { title: "", workTypes: [], reasons: [] };

// default_config.json から設定を読みこむよ
fetch(chrome.runtime.getURL("default_config.json"))
  .then((res) => res.json())
  .then((data) => {
    // 読みこめたら箱に入れるよ
    defaultConfig = data;
  })
  .catch(() => {
    // もし失敗したら、からっぽのままにしておくよ
    console.error("default_config.jsonを読み込めませんでした");
  });

// ====== スクロール＆ハイライト処理 ======
// 表が出てくるまで待ってからスクロールし、勤務予定の行をハイライトする関数
function watchTableAndScroll() {
  // ① テーブルを入れているスクロールボックスを探すよ
  const box = document.querySelector("div.table-scroll-box");
  if (box) {
    // ② テーブルの行（tbody内のtr）を全部取ってくるよ
    const rows = box.querySelectorAll("tbody tr");

    // ③ それぞれの行を順番にチェックするよ
    for (const row of rows) {
      // └ この行の「勤務状況」のセルを探すよ
      const statusCell = row.querySelector("td.status span");
      const statusText = statusCell ? statusCell.textContent.trim() : "";

      // ④ ステータスが「勤務予定」なら、その行をハイライトして、前の行をスクロール
      if (statusCell && statusText === "勤務予定") {
        // ◇ この行の各セルを薄い黄色にしてハイライトするよ
        const cells = row.querySelectorAll("td");
        cells.forEach((cell) => {
          cell.style.backgroundColor = "lightyellow"; // セル単位で色を設定
        });

        // ◇ さらに、その前の行をスクロールボックス内で一番上に合わせる
        const prev = row.previousElementSibling;
        if (prev) {
          prev.scrollIntoView({
            behavior: "auto",
            block: "start",
            inline: "nearest",
          });
        } else {
        }
        break; // 見つけたらもう終わり
      }
    }

    return true; // スクロールとハイライト完了
  }

  // ⑤ まだテーブルがなかったとき
  return false; // 再試行が必要
}

// ====== ページ読み込み後の監視処理 ======
window.addEventListener("load", () => {
  // まず一度だけ試してみるよ
  if (watchTableAndScroll()) {
    return;
  }

  // テーブルがまだ無いときは、DOMの変化をずっと見張るよ
  const observer = new MutationObserver((mutations, obs) => {
    if (watchTableAndScroll()) {
      obs.disconnect();
    }
  });

  // body配下の要素追加・削除を監視
  observer.observe(document.body, { childList: true, subtree: true });
});

// 1. 500msごとに監視
setInterval(() => {
  // ■ 「申請取消」ボタン＆ユーザー名＆日付テキストを探す（常に実行）
  const cancelApplyBtn = document.querySelector(
    "button.jsubmit-cancle-create-timecard"
  );
  const nameP = document.querySelector("a.dropdown-toggle.username p");
  const dateSpan = document.querySelector("div.floatLeft.jdate span");

  // 初期設定がまだ読み込めていなければ何もしないよ
  if (
    defaultConfig.workTypes.length === 0 ||
    defaultConfig.reasons.length === 0 ||
    !defaultConfig.title
  ) {
    return;
  }

  // 保存キーを作る関数を定義
  function makeStorageKey() {
    const name = nameP ? nameP.textContent.trim() : "";
    const date = dateSpan ? dateSpan.textContent.trim() : "";
    return `tempSave:${name}|${date}`;
  }

  // 保存されたデータを画面に復元する関数
  function restoreTempData() {
    if (tempDataRestored) return; // 既に復元済みなら何もしない
    chrome.storage.local.get([makeStorageKey()], (res) => {
      const obj = res[makeStorageKey()];
      if (obj) {
        try {
          // 🌟 保存したHTMLを丸ごと復元
          if (obj.hourWorkHtml) {
            const hourWork = document.querySelector(".hour-work");
            if (hourWork) {
              hourWork.outerHTML = obj.hourWorkHtml;
              // 復元した要素の入力欄を使えるようにする
              const newHourWork = document.querySelector(".hour-work");
              if (newHourWork) {
                newHourWork.querySelectorAll("input").forEach((inp) => {
                  inp.disabled = false;
                });
                // セレクトも使えるようにするよ
                newHourWork.querySelectorAll("select").forEach((sel) => {
                  sel.disabled = false;
                });
              }
            }
          }

          // 入力欄へ保存した値を入れる
          const workInputs = document.querySelectorAll(
            '.timecards_hidden_data input[type="number"]'
          );
          obj.work.forEach((v, i) => {
            if (workInputs[i]) workInputs[i].value = v;
          });

          const breakInputs = document.querySelectorAll(
            '.break-times-data input[type="number"]'
          );
          obj.break.forEach((v, i) => {
            if (breakInputs[i]) breakInputs[i].value = v;
          });

          // セレクトのHTMLと値を戻すよ
          if (obj.shiftHtml) {
            const selOrg = document.getElementById(
              "shift_template_collection_for_timecard_cf"
            );
            if (selOrg) selOrg.outerHTML = obj.shiftHtml;
          }
          const selNew = document.getElementById(
            "shift_template_collection_for_timecard_cf"
          );
          if (selNew) {
            selNew.disabled = false;
            selNew.value = obj.shiftValue || "";
          }

          // 理由テキストは後で上書きするため保持しておく
          restoredReason = obj.reason || "";
          const textarea = document.getElementById("update_reason");
          if (textarea && !textarea.disabled) {
            textarea.value = obj.reason;
          }
          tempDataRestored = true;
          // 復元したらもう使わないので消しておくよ
          chrome.storage.local.remove(makeStorageKey());
        } catch (e) {}
      }
    });
  }

  // ■ 一時保存の処理を一度だけ設定
  if (!tempSaveInitialized && cancelApplyBtn && nameP && dateSpan) {
    tempSaveInitialized = true;

    // 入力したデータをしまっておく簡単な関数
    function saveTempData(showAlert) {
      const workInputs = document.querySelectorAll(
        '.timecards_hidden_data input[type="number"]'
      );
      const breakInputs = document.querySelectorAll(
        '.break-times-data  input[type="number"]'
      );
      const workValues = Array.from(workInputs).map((i) => i.value);
      const breakValues = Array.from(breakInputs).map((i) => i.value);
      const textarea = document.getElementById("update_reason");
      const reasonText = textarea ? textarea.value : "";
      const hourWork = document.querySelector(".hour-work");
      const hourWorkHtml = hourWork ? hourWork.outerHTML : "";
      // シフトテンプレートのセレクトを見つけておくよ
      const shiftSel = document.getElementById(
        "shift_template_collection_for_timecard_cf"
      );
      const shiftValue = shiftSel ? shiftSel.value : "";
      const shiftHtml = shiftSel ? shiftSel.outerHTML : "";

      // 保存するデータオブジェクト
      const data = {
        work: workValues, // 勤務時間
        break: breakValues, // 休憩時間
        reason: reasonText, // 理由テキスト
        hourWorkHtml: hourWorkHtml, // hour-work 全体
        shiftHtml: shiftHtml, // セレクトのHTML
        shiftValue: shiftValue, // セレクトの値
      };

      // chrome.storage.local に保存
      chrome.storage.local.set({ [makeStorageKey()]: data }, () => {
        if (showAlert) alert("一時保存しました");
      });
    }

    // 申請取消ボタンを押したときにも自動保存
    cancelApplyBtn.addEventListener("click", () => {
      saveTempData(false);
    });
  }

  // ■ 勤怠実績UI の表示判定
  const textarea = document.getElementById("update_reason");
  // 理由欄全体の箱をクラス名で探すよ
  const targetDiv = document.querySelector(
    "div.rightContent.staff_time_cards_month"
  );
  const isVisible = textarea && targetDiv && targetDiv.offsetParent !== null;

  // ■ 非表示 or disabled ならUIをリセットして終了
  if (!isVisible || textarea.disabled) {
    previousVisible = false;
    tempDataRestored = false; // 復元フラグをリセット
    return;
  }

  // 2. 勤怠実績UI の初回描画
  if (!previousVisible) {
    previousVisible = true;

    // ────────────────
    // 2-1. リスト & 状態変数
    // ────────────────
    // JSON から読んだ初期値をここで使うよ
    const defaultWorkTypes = [...defaultConfig.workTypes];
    const defaultReasons = [...defaultConfig.reasons];
    const defaultTitle = defaultConfig.title;
    let tempWorkTypes = [];
    let tempReasons = [];
    let selectedWorkType = "";
    let selectedReasons = [];
    let editMode = false;
    let preSelectedWorkType = "";
    let preSelectedReasons = [];
    let preReasonVisible = false;

    // 見出しの文字を入れておく変数
    let titleText = defaultTitle;
    let tempTitleText = titleText;

    // ローカルストレージからタイトルを読みこむよ
    chrome.storage.local.get(["title"], (data) => {
      if (typeof data.title === "string") {
        titleText = data.title;
      } else {
        chrome.storage.local.set({ title: titleText });
      }
      tempTitleText = titleText;
      textarea.value = titleText; // 最初の行をセット
      // 初期値入力後に一時保存データを復元
      restoreTempData();
    });

    // ────────────────
    // 2-2. DOMコンテナ
    // ────────────────
    const wrapper = document.createElement("div");
    wrapper.id = "custom-button-wrapper";
    wrapper.style.position = "relative";
    wrapper.style.marginTop = "10px";
    wrapper.style.display = "flex";
    wrapper.style.flexDirection = "column";
    wrapper.style.height = "auto";

    const workTypeWrapper = document.createElement("div");
    workTypeWrapper.style.display = "flex";
    workTypeWrapper.style.flexWrap = "wrap";
    workTypeWrapper.style.gap = "8px";
    // 仕事の種類ボタンの下に少しゆとりを作るよ
    workTypeWrapper.style.marginBottom = "12px";

    const reasonWrapper = document.createElement("div");
    reasonWrapper.style.display = "none";
    reasonWrapper.style.flexWrap = "wrap";
    reasonWrapper.style.gap = "6px";
    // 理由ボタン群の下にもゆとりを入れるね
    reasonWrapper.style.marginBottom = "12px";

    // 見出しを編集する入力欄だよ
    const titleInput = document.createElement("input");
    titleInput.style.marginBottom = "6px";
    titleInput.style.padding = "4px";
    titleInput.style.display = "none";
    titleInput.value = tempTitleText;
    titleInput.addEventListener("input", () => {
      tempTitleText = titleInput.value;
      updateTextarea();
    });

    // ────────────────
    // 2-3. 編集／確定／キャンセルボタン
    // ────────────────
    const editBtn = document.createElement("button");
    editBtn.textContent = "設定";
    applyDefaultButtonStyle(editBtn); // 共通の見た目を付けるよ
    editBtn.style.position = "absolute";
    editBtn.style.top = "0";
    editBtn.style.right = "0";
    // 横幅は自動で決めてもらうよ
    editBtn.style.width = "auto";
    editBtn.style.background = "#888";
    editBtn.style.color = "#fff";
    editBtn.style.border = "none";
    editBtn.style.cursor = "pointer";

    const saveBtn = document.createElement("button");
    saveBtn.textContent = "確定";
    applyDefaultButtonStyle(saveBtn); // 共通の見た目を付けるよ
    // 横幅は自動で決めてもらうよ
    saveBtn.style.width = "auto";
    saveBtn.style.background = "#28a745";
    saveBtn.style.color = "#fff";
    saveBtn.style.border = "none";
    saveBtn.style.cursor = "pointer";
    saveBtn.style.display = "none";

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "キャンセル";
    applyDefaultButtonStyle(cancelBtn); // 共通の見た目を付けるよ
    // 横幅は自動で決めてもらうよ
    cancelBtn.style.width = "auto";
    cancelBtn.style.background = "#aaa";
    cancelBtn.style.color = "#fff";
    cancelBtn.style.border = "none";
    cancelBtn.style.cursor = "pointer";
    cancelBtn.style.display = "none";

    // 設定をダウンロードするボタンも作るよ
    const exportBtn = document.createElement("button");
    exportBtn.textContent = "設定ダウンロード";
    applyDefaultButtonStyle(exportBtn); // 共通の見た目を付けるよ
    // 横幅は自動で決めてもらうよ
    exportBtn.style.width = "auto";
    exportBtn.style.background = "#007bff";
    exportBtn.style.color = "#fff";
    exportBtn.style.border = "none";
    exportBtn.style.cursor = "pointer";
    exportBtn.style.display = "inline-block";
    // 他のボタンと少し離すため上側に余白を付けるよ
    exportBtn.style.marginTop = "12px";

    // ────────────────
    // 2-4. 下部中央に確定/キャンセルグループ
    // ────────────────
    const actionGroup = document.createElement("div");
    actionGroup.style.display = "flex";
    actionGroup.style.justifyContent = "center";
    actionGroup.style.gap = "10px";
    actionGroup.style.marginTop = "auto";
    actionGroup.append(saveBtn, cancelBtn, exportBtn);

    // ────────────────
    // 2-5. テキスト更新
    // ────────────────
    function updateTextarea() {
      // 最初の行は保存したタイトルを書くよ
      let text = editMode ? tempTitleText : titleText;

      // 仕事の種類を選んだら2行目に書くよ
      if (selectedWorkType) text += `\n${selectedWorkType}`;

      // 理由が1つ以上あるときだけ3行目に「理由:」を付けて書くよ
      if (selectedReasons.length) {
        text += `\n理由:${selectedReasons.join(",")}`;
      }

      // 作った文章をテキストエリアに入れるよ
      textarea.value = text;
    }

    // ────────────────
    // 2-6. ボタン群描画
    // ────────────────
    function renderButtons(list, container, type) {
      container.innerHTML = "";
      list.forEach((name, idx) => {
        const index = idx; // 並び順を覚えておく
        const btn = document.createElement("button");
        btn.textContent = name;
        // 見た目をそろえるため共通のスタイルを当てるよ
        applyDefaultButtonStyle(btn);
        btn.style.cursor = "pointer";
        btn.style.position = "relative";

        if (editMode) {
          // ドラッグで動かせるようにする
          btn.draggable = true;
          btn.addEventListener("dragstart", (e) => {
            e.dataTransfer.setData("index", index);
          });
          btn.addEventListener("dragover", (e) => {
            e.preventDefault();
          });
          btn.addEventListener("drop", (e) => {
            e.preventDefault();
            const from = parseInt(e.dataTransfer.getData("index"));
            if (!isNaN(from) && from !== index) {
              const moved = list.splice(from, 1)[0];
              list.splice(index, 0, moved);
              renderAll();
            }
          });
          const del = document.createElement("span");
          del.textContent = "×";
          del.style.color = "red";
          del.style.position = "absolute";
          del.style.right = "4px";
          del.style.top = "2px";
          del.style.cursor = "pointer";
          del.addEventListener("click", (e) => {
            e.stopPropagation();
            list.splice(idx, 1);
            renderAll();
          });
          btn.appendChild(del);

          btn.addEventListener("click", () => {
            const input = document.createElement("input");
            input.value = name;
            input.style.padding = "4px";
            input.style.margin = "2px";
            btn.replaceWith(input);
            input.focus();
            input.addEventListener("keydown", (e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                input.blur();
              }
            });
            input.addEventListener("blur", () => {
              list[idx] = input.value.trim() || name;
              renderAll();
            });
          });
        } else {
          if (type === "work") {
            btn.style.background =
              selectedWorkType === name ? "#28a745" : "#0b79d0";
            btn.style.color = "#fff";
            // 色付きボタンなので枠線はいらないよ
            btn.style.border = "none";
            btn.addEventListener("click", () => {
              selectedWorkType = selectedWorkType === name ? "" : name;
              if (!selectedWorkType) selectedReasons = [];
              reasonWrapper.style.display = selectedWorkType ? "flex" : "none";
              renderAll();
              updateTextarea();
            });
          } else {
            const selIdx = selectedReasons.indexOf(name);
            if (selIdx >= 0) {
              btn.style.background = "#ffc107";
              btn.style.color = "#000";
              // 選ばれたときは色が付くから枠線はいらないね
              btn.style.border = "none";
            }
            btn.addEventListener("click", () => {
              const i2 = selectedReasons.indexOf(name);
              if (i2 >= 0) selectedReasons.splice(i2, 1);
              else selectedReasons.push(name);
              renderAll();
              updateTextarea();
            });
          }
        }
        container.appendChild(btn);
      });
      if (editMode) {
        const addBtn = document.createElement("button");
        addBtn.textContent = "＋追加";
        applyDefaultButtonStyle(addBtn); // 共通の見た目を付けるよ
        // 横幅は自動で決めてもらうよ
        addBtn.style.width = "auto"; // 既存のボタンと同じデザインにする
        addBtn.style.background = "#0b79d0";
        addBtn.style.color = "#fff";
        addBtn.addEventListener("click", () => {
          const input = document.createElement("input");
          input.placeholder = "新しい名前";
          input.style.padding = "4px";
          input.style.margin = "2px";
          container.appendChild(input);
          input.focus();
          input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.stopPropagation();
              input.blur();
            }
          });
          input.addEventListener("blur", () => {
            const v = input.value.trim();
            if (v) list.push(v);
            renderAll();
          });
        });
        container.appendChild(addBtn);
      }
    }

    // ────────────────
    // 2-7. 全要素再描画
    // ────────────────
    function renderAll() {
      // 編集モードかどうかでボタンを出し分けるよ
      if (editMode) {
        editBtn.style.display = "none";
        saveBtn.style.display = "inline-block";
        exportBtn.style.display = "none";
        cancelBtn.style.display = "inline-block";
        titleInput.style.display = "block";
        titleInput.value = tempTitleText;
      } else {
        editBtn.style.display = "inline-block";
        saveBtn.style.display = "none";
        exportBtn.style.display = "inline-block";
        cancelBtn.style.display = "none";
        titleInput.style.display = "none";
      }
      renderButtons(tempWorkTypes, workTypeWrapper, "work");
      if (editMode) reasonWrapper.style.display = "flex";
      renderButtons(tempReasons, reasonWrapper, "reason");
      updateTextarea();
    }

    // ────────────────
    // 2-8. chrome.storage.localから読み込み＆初回描画
    // ────────────────
    function loadAndRender(callback) {
      chrome.storage.local.get(["workTypes", "reasons", "title"], (data) => {
        if (Array.isArray(data.workTypes)) tempWorkTypes = [...data.workTypes];
        else {
          tempWorkTypes = [...defaultWorkTypes];
          chrome.storage.local.set({ workTypes: tempWorkTypes });
        }
        if (Array.isArray(data.reasons)) tempReasons = [...data.reasons];
        else {
          tempReasons = [...defaultReasons];
          chrome.storage.local.set({ reasons: tempReasons });
        }
        if (typeof data.title === "string") titleText = data.title;
        else {
          titleText = defaultTitle;
          chrome.storage.local.set({ title: titleText });
        }
        tempTitleText = titleText;
        renderAll();
        if (callback) callback();
      });
    }

    // ────────────────
    // 2-9. 編集開始時に事前状態を保存
    // ────────────────
    editBtn.addEventListener("click", () => {
      preSelectedWorkType = selectedWorkType;
      preSelectedReasons = [...selectedReasons];
      preReasonVisible = reasonWrapper.style.display !== "none";
      tempTitleText = titleText; // 今のタイトルをコピー
      editMode = true;
      renderAll();
    });

    // 確定：保存＆復元
    saveBtn.addEventListener("click", () => {
      chrome.storage.local.set(
        {
          workTypes: tempWorkTypes,
          reasons: tempReasons,
          title: tempTitleText,
        },
        () => {
          editMode = false;
          titleText = tempTitleText; // 変更を確定
          selectedWorkType = preSelectedWorkType;
          selectedReasons = [...preSelectedReasons];
          loadAndRender(() => {
            reasonWrapper.style.display = preReasonVisible ? "flex" : "none";
          });
        }
      );
    });

    // キャンセル：復元
    cancelBtn.addEventListener("click", () => {
      editMode = false;
      selectedWorkType = preSelectedWorkType;
      selectedReasons = [...preSelectedReasons];
      tempTitleText = titleText; // タイトルを元に戻す
      loadAndRender(() => {
        reasonWrapper.style.display = preReasonVisible ? "flex" : "none";
      });
    });

    // 現在の設定を JSON にしてダウンロードするよ
    exportBtn.addEventListener("click", () => {
      const data = {
        title: tempTitleText,
        workTypes: tempWorkTypes,
        reasons: tempReasons,
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "default_config.json";
      a.click();
      URL.revokeObjectURL(url);
    });

    // ────────────────
    // 2-10. DOMへ挿入＆ロード
    // ────────────────
    wrapper.append(
      editBtn,
      titleInput,
      workTypeWrapper,
      reasonWrapper,
      actionGroup
    );
    textarea.parentElement.appendChild(wrapper);
    loadAndRender(() => {
      if (tempDataRestored && restoredReason) {
        textarea.value = restoredReason;
      }
    });
  }
}, 500);
