// == content.js ==

// 0. 初期フラグ
let previousVisible = false; // 勤怠実績UIが描画済みか
let tempSaveInitialized = false; // 一時保存ボタンが追加済みか
let tempDataRestored = false; // 一時保存データを復元したかどうか
let restoredReason = ""; // 復元した理由テキスト

// 1. 500msごとに監視
setInterval(() => {
  // ■ 「申請取消」ボタン＆ユーザー名＆日付テキストを探す（常に実行）
  const cancelApplyBtn = document.querySelector(
    "button.jsubmit-cancle-create-timecard"
  );
  const nameP = document.querySelector("a.dropdown-toggle.username p");
  const dateSpan = document.querySelector("div.floatLeft.jdate span");

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
              }
            }
            console.log("【復元HTML】", obj.hourWorkHtml);
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

          // 理由テキストは後で上書きするため保持しておく
          restoredReason = obj.reason || "";
          const textarea = document.getElementById("update_reason");
          if (textarea && !textarea.disabled) {
            textarea.value = obj.reason;
          }
          console.log("【復元完了】", obj);
          tempDataRestored = true;
          // 復元したらもう使わないので消しておくよ
          chrome.storage.local.remove(makeStorageKey());
        } catch (e) {
          console.error("復元エラー:", e);
        }
      }
    });
  }

  // ■ 一時保存ボタンが未追加かつ要素が揃ったら追加
  if (!tempSaveInitialized && cancelApplyBtn && nameP && dateSpan) {
    tempSaveInitialized = true;

    // 一時保存ボタンを作成
    const tempSaveBtn = document.createElement("button");
    tempSaveBtn.textContent = "一時保存";
    tempSaveBtn.style.marginLeft = "8px";
    tempSaveBtn.style.padding = "6px 12px";
    tempSaveBtn.style.background = "#ff9800";
    tempSaveBtn.style.color = "#fff";
    tempSaveBtn.style.border = "none";
    tempSaveBtn.style.cursor = "pointer";
    cancelApplyBtn.insertAdjacentElement("afterend", tempSaveBtn);


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

      // 保存するデータオブジェクト
      const data = {
        work: workValues, // 勤務時間
        break: breakValues, // 休憩時間
        reason: reasonText, // 理由テキスト
        hourWorkHtml: hourWorkHtml, // hour-work 全体
      };

      // chrome.storage.local に保存
      chrome.storage.local.set({ [makeStorageKey()]: data }, () => {
        console.log("【一時保存データ】", data); // 保存内容を表示
        if (showAlert) alert("一時保存しました");
      });
    }

    // 一時保存ボタンを押したとき
    tempSaveBtn.addEventListener("click", () => {
      saveTempData(true);
    });

    // 申請取消ボタンを押したときにも自動保存
    cancelApplyBtn.addEventListener("click", () => {
      saveTempData(false);
    });

  }

  // ■ 勤怠実績UI の表示判定
  const textarea = document.getElementById("update_reason");
  const targetDiv = document.evaluate(
    "/html/body/div[7]/div/div[2]/div[3]/div[3]",
    document,
    null,
    XPathResult.FIRST_ORDERED_NODE_TYPE,
    null
  ).singleNodeValue;
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
    const defaultWorkTypes = ["残業", "早出", "早出残業"];
    const defaultReasons = [
      "通常業務",
      "交換作業",
      "版出し",
      "製版予定調整",
      "青焼",
      "第三者校正",
      "変換",
      "トラブル対応",
      "その他",
    ];
    let tempWorkTypes = [];
    let tempReasons = [];
    let selectedWorkType = "";
    let selectedReasons = [];
    let editMode = false;
    let preSelectedWorkType = "";
    let preSelectedReasons = [];
    let preReasonVisible = false;

    // 初期文字
    textarea.value = "勤務実績";
    // 初期値入力後に一時保存データを復元
    restoreTempData();

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

    const reasonWrapper = document.createElement("div");
    reasonWrapper.style.display = "none";
    reasonWrapper.style.flexWrap = "wrap";
    reasonWrapper.style.gap = "6px";

    // ────────────────
    // 2-3. 編集／確定／キャンセルボタン
    // ────────────────
    const editBtn = document.createElement("button");
    editBtn.textContent = "ボタン編集";
    editBtn.style.position = "absolute";
    editBtn.style.top = "0";
    editBtn.style.right = "0";
    editBtn.style.padding = "6px 12px";
    editBtn.style.background = "#888";
    editBtn.style.color = "#fff";
    editBtn.style.border = "none";
    editBtn.style.cursor = "pointer";

    const saveBtn = document.createElement("button");
    saveBtn.textContent = "確定";
    saveBtn.style.padding = "6px 12px";
    saveBtn.style.background = "#28a745";
    saveBtn.style.color = "#fff";
    saveBtn.style.border = "none";
    saveBtn.style.cursor = "pointer";
    saveBtn.style.display = "none";

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "キャンセル";
    cancelBtn.style.padding = "6px 12px";
    cancelBtn.style.background = "#aaa";
    cancelBtn.style.color = "#fff";
    cancelBtn.style.border = "none";
    cancelBtn.style.cursor = "pointer";
    cancelBtn.style.display = "none";

    // ────────────────
    // 2-4. 下部中央に確定/キャンセルグループ
    // ────────────────
    const actionGroup = document.createElement("div");
    actionGroup.style.display = "flex";
    actionGroup.style.justifyContent = "center";
    actionGroup.style.gap = "10px";
    actionGroup.style.marginTop = "auto";
    actionGroup.append(saveBtn, cancelBtn);

    // ────────────────
    // 2-5. テキスト更新
    // ────────────────
    function updateTextarea() {
      // 最初の行はいつも固定で書くよ
      let text = "勤務実績";

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
        const btn = document.createElement("button");
        btn.textContent = name;
        btn.style.padding = "6px 10px";
        btn.style.margin = "2px";
        btn.style.cursor = "pointer";
        btn.style.position = "relative";

        if (editMode) {
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
        addBtn.style.padding = "6px 10px";
        addBtn.style.margin = "2px";
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
      if (editMode) {
        editBtn.style.display = "none";
        saveBtn.style.display = "inline-block";
        cancelBtn.style.display = "inline-block";
      } else {
        editBtn.style.display = "inline-block";
        saveBtn.style.display = "none";
        cancelBtn.style.display = "none";
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
      chrome.storage.local.get(["workTypes", "reasons"], (data) => {
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
      editMode = true;
      renderAll();
    });

    // 確定：保存＆復元
    saveBtn.addEventListener("click", () => {
      chrome.storage.local.set(
        {
          workTypes: tempWorkTypes,
          reasons: tempReasons,
        },
        () => {
          editMode = false;
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
      loadAndRender(() => {
        reasonWrapper.style.display = preReasonVisible ? "flex" : "none";
      });
    });

    // ────────────────
    // 2-10. DOMへ挿入＆ロード
    // ────────────────
    wrapper.append(editBtn, workTypeWrapper, reasonWrapper, actionGroup);
    textarea.parentElement.appendChild(wrapper);
    loadAndRender(() => {
      if (tempDataRestored && restoredReason) {
        textarea.value = restoredReason;
      }
    });
  }
}, 500);
