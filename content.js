// == content.js ==

// == 更新チェック ==
const commitApiUrl =
  "https://api.github.com/repos/ogatetsu-0501/kintai_helper/commits/main";
const localUpdateUrl = chrome.runtime.getURL("last_update.txt");

// ★ 更新方法を知らせる通知
function showUpdateNotice(folder, script) {
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
  box.textContent = `拡張機能が更新されています。kintai_helper\\update\\${folder}\\${script} をダブルクリックで実行して下さい`;
  document.body.appendChild(box);
}

// ★ ボタン共通スタイル
function applyDefaultButtonStyle(btn) {
  btn.style.backgroundColor = "#ffffff";
  btn.style.color = "#7cdcea";
  btn.style.border = "1px solid #66d3e4";
  btn.style.fontSize = "13px";
  btn.style.padding = "0.5em 1em";
  btn.style.whiteSpace = "nowrap";
  btn.style.borderRadius = "2px";
  btn.style.display = "inline-block";
  btn.style.verticalAlign = "middle";
  btn.style.textAlign = "center";
  btn.style.marginLeft = "6px";
  btn.style.marginRight = "6px";
}

// ★ ユーザー名取得
function getCurrentUserName() {
  const nameP = document.querySelector("a.dropdown-toggle.username p");
  return nameP ? nameP.textContent.trim() : "unknown_user";
}

// === 更新チェック実行 ===
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
      const folder = isWin ? "win" : "mac";
      const script = isWin ? "update.exe" : "update.command";
      showUpdateNotice(folder, script);
    }
  })
  .catch((e) => console.error("更新チェックに失敗しました", e));

// ===== 初期フラグ =====
let previousVisible = false;
let tempSaveInitialized = false;
let tempDataRestored = false;
let restoredReason = "";
let shiftSelectElement = null;
let dropdownCheckLogged = false; // ★ プルダウンをさがしたか覚えるよ
let defaultConfig = { title: "", workTypes: [], reasons: [] };

// default_config.json 読み込み
fetch(chrome.runtime.getURL("default_config.json"))
  .then((res) => res.json())
  .then((data) => {
    defaultConfig = data;
  })
  .catch(() => {
    console.error("default_config.jsonを読み込めませんでした");
  });

// ★ 今の入力を全部集めるよ
function collectShiftTemplateData() {
  const absentHTML = document.querySelector("div.type_absent")?.outerHTML || "";
  const inoutHTML = document.querySelector("span.type_in_out_break")?.outerHTML || "";
  const workHTML = document.querySelector(
    "div.timecards_hidden_data.staff_time_cards_month"
  )?.outerHTML || "";
  const breakHTML = document.querySelector(
    "div.break-times.time_card_container"
  )?.outerHTML || "";
  const absentValue = document.querySelector(
    'input[name="absent"]:checked'
  )?.value || "";
  const checkinValue = document.querySelector(
    'input[name="checkin"]:checked'
  )?.value || "";
  const checkoutValue = document.querySelector(
    'input[name="checkout"]:checked'
  )?.value || "";
  const workInputs = Array.from(
    document.querySelectorAll('div.timecards_hidden_data input[type="number"]')
  ).map((el) => {
    const cls = Array.from(el.classList).find(
      (c) => c.includes("hour") || c.includes("minute")
    );
    return { selector: `input.${cls}`, value: el.value };
  });
  const breakInputs = Array.from(
    document.querySelectorAll('div.break-times-data input[type="number"]')
  ).map((el) => {
    const cls = Array.from(el.classList).find(
      (c) => c.includes("hour") || c.includes("minute")
    );
    return { selector: `input.${cls}`, value: el.value };
  });
  return {
    absentHTML,
    inoutHTML,
    workHTML,
    breakHTML,
    absentValue,
    checkinValue,
    checkoutValue,
    workInputs,
    breakInputs,
  };
}

// ★ 要素を入れ替えたり作ったりするよ
function replaceOrCreate(selector, html, parentSelector) {
  const target = document.querySelector(selector);
  if (target) {
    target.outerHTML = html;
  } else {
    const parent = document.querySelector(parentSelector);
    if (parent) parent.insertAdjacentHTML("beforeend", html);
  }
}

// ★ 保存したテンプレを画面に反映するよ
  function applyShiftTemplate(name) {
    console.log(`テンプレート${name}で値を復元するよ`); // ★ どのテンプレを使うか言うよ
    const user = getCurrentUserName();
    chrome.storage.local.get(`customShiftTemplates_${user}`, (res) => {
      const templates = res[`customShiftTemplates_${user}`] || {};
      const data = templates[name];
      if (!data) return;
      replaceOrCreate("div.type_absent", data.absentHTML, ".row_1");
    replaceOrCreate(
      "span.type_in_out_break",
      data.inoutHTML,
      "div.title.staff_time_cards_month"
    );
    replaceOrCreate(
      "div.timecards_hidden_data.staff_time_cards_month",
      data.workHTML,
      ".time_card_container"
    );
    replaceOrCreate(
      "div.break-times.time_card_container",
      data.breakHTML,
      ".time_card_container"
    );
    if (data.absentValue) {
      const r = document.querySelector(
        `input[name="absent"][value="${data.absentValue}"]`
      );
      if (r) r.checked = true;
    }
    if (data.checkinValue) {
      const r = document.querySelector(
        `input[name="checkin"][value="${data.checkinValue}"]`
      );
      if (r) r.checked = true;
    }
    if (data.checkoutValue) {
      const r = document.querySelector(
        `input[name="checkout"][value="${data.checkoutValue}"]`
      );
      if (r) r.checked = true;
    }
    data.workInputs.forEach((w) => {
      const inp = document.querySelector(w.selector);
      if (inp) inp.value = w.value;
    });
      data.breakInputs.forEach((b) => {
        const inp = document.querySelector(b.selector);
        if (inp) inp.value = b.value;
      });
      console.log(`テンプレート${name}の値を復元したよ`); // ★ 復元が終わったよ
    });
  }

// ★ 日付の下に保存ボタンを置くよ
function addShiftTemplateSaveButton(sel) {
  if (document.getElementById("save-shift-template-btn")) return; // ★ もうあるなら作らないよ
  const btn = document.createElement("button"); // ★ ボタンを作るよ
  btn.id = "save-shift-template-btn"; // ★ ボタンに名前をつけるよ
  btn.textContent = "テンプレ保存"; // ★ ボタンに文字を書くよ
  applyDefaultButtonStyle(btn); // ★ ボタンの見た目をそろえるよ
  btn.style.width = "auto"; // ★ ボタンの横幅を自動にするよ
  btn.addEventListener("click", () => {
    const name = prompt("テンプレート名を入力"); // ★ 名前を聞くよ
    if (!name) return; // ★ 名前がないなら終わりだよ
    const data = collectShiftTemplateData(); // ★ 今の入力を集めるよ
    const user = getCurrentUserName(); // ★ ユーザー名を調べるよ
    chrome.storage.local.get(`customShiftTemplates_${user}`, (res) => {
      const templates = res[`customShiftTemplates_${user}`] || {}; // ★ 前のデータを取るよ
      templates[name] = data; // ★ 新しいデータを入れるよ
      chrome.storage.local.set(
        { [`customShiftTemplates_${user}`]: templates },
        () => {
          if (
            !Array.from(sel.options).some(
              (o) => o.value === `__ext_${name}`
            )
          ) {
            const opt = document.createElement("option"); // ★ 新しい選択肢を作るよ
            opt.value = `__ext_${name}`; // ★ データの名前を入れるよ
            opt.textContent = name; // ★ 目に見える名前を入れるよ
            sel.appendChild(opt); // ★ 選べるようにするよ
          }
          sel.value = `__ext_${name}`; // ★ 今の選択を新しいものにするよ
          sel.dispatchEvent(new Event("change", { bubbles: true })); // ★ 変わったことを知らせるよ
        }
      );
    });
  });
  const jdate = document.querySelector("div.floatLeft.jdate"); // ★ 日付の場所を見つけるよ
  if (jdate) {
    jdate.insertAdjacentElement("afterend", btn); // ★ 日付の下にボタンを置くよ
  } else {
    sel.parentElement.appendChild(btn); // ★ 見つからなければ元の場所に置くよ
  }
}

// ====== テーブル監視 ======
function watchTableAndScroll() {
  const box = document.querySelector("div.table-scroll-box");
  if (box) {
    // ★ 表の上を画面のいちばん上に合わせるよ
    box.scrollIntoView({
      behavior: "auto",
      block: "start",
    });
    const rows = box.querySelectorAll("tbody tr");
    for (const row of rows) {
      const statusCell = row.querySelector("td.status span");
      const statusText = statusCell ? statusCell.textContent.trim() : "";
      if (statusCell && statusText === "勤務予定") {
        const cells = row.querySelectorAll("td");
        cells.forEach((cell) => {
          cell.style.backgroundColor = "lightyellow";
        });
        const prev = row.previousElementSibling;
        if (prev) {
          prev.scrollIntoView({
            behavior: "auto",
            block: "start",
            inline: "nearest",
          });
        }
        break;
      }
    }
    return true;
  }
  return false;
}

// ====== ページ監視 ======
window.addEventListener("load", () => {
  if (watchTableAndScroll()) return;
  const observer = new MutationObserver((m, obs) => {
    if (watchTableAndScroll()) obs.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });
});

// ====== 500msごとに監視 ======
setInterval(() => {
  const cancelApplyBtn = document.querySelector(
    "button.jsubmit-cancle-create-timecard"
  );
  const dateSpan = document.querySelector("div.floatLeft.jdate span");

  // シフトセレクト監視
    const shiftSel = document.getElementById(
      "shift_template_collection_for_timecard_cf"
    );
    if (shiftSel) {
      // ★ カスタムのえらびがあるか見るよ
      const hasCustomOption = Array.from(shiftSel.options).some((o) =>
        o.value.startsWith("__ext_")
      );
      const user = getCurrentUserName();
      // ★ 保存したテンプレをもう一度入れるおまじないだよ
      function loadCustomTemplates() {
        chrome.storage.local.get(`customShiftTemplates_${user}`, (res) => {
          const templates = res[`customShiftTemplates_${user}`] || {}; // ★ 保存したテンプレを全部取るよ
          Object.keys(templates).forEach((name) => {
            if (
              !Array.from(shiftSel.options).some(
                (o) => o.value === `__ext_${name}`
              )
            ) {
              const opt = document.createElement("option");
              opt.value = `__ext_${name}`;
              opt.textContent = name;
              shiftSel.appendChild(opt);
              console.log(`テンプレート${name}をプルダウンに追加したよ`); // ★ 追加したことを知らせるよ
            }
          });
          chrome.storage.local.get(`savedShiftTemplate_${user}`, (data) => {
            const saved = data[`savedShiftTemplate_${user}`];
            if (saved) {
              const submitBtn = document.querySelector(
                "button.jsubmit-edit-timecard"
              ); // ★ 「提出」ボタンがあるかさがすよ
              if (!submitBtn) {
                console.log(
                  "提出ボタンがないので前の選択を戻さないよ"
                ); // ★ ボタンがないときは復元しないよ
                return; // ★ ここでおしまいだよ
              }
              const name = saved.replace("__ext_", ""); // ★ 名前だけを取り出すよ
              if (!templates[name]) {
                chrome.storage.local.remove(
                  `savedShiftTemplate_${user}`,
                  () => {
                    console.log(
                      `${saved}を忘れるよ`
                    ); // ★ もう無いテンプレは記録から消すよ
                  }
                );
                return; // ★ ここでおしまいだよ
              }
              const has = Array.from(shiftSel.options).some(
                (o) => o.value === saved
              );
              if (has) {
                shiftSel.value = saved;
                console.log(`前に選んだ${saved}を復元したよ`); // ★ 前の選択を戻したよ
                shiftSel.dispatchEvent(
                  new Event("change", { bubbles: true })
                );
              }
            }
          });
        });
      }
      if (shiftSel !== shiftSelectElement) {
        console.log("プルダウンリストを見つけたよ"); // ★ 見つかったら言うよ
        shiftSelectElement = shiftSel;
        dropdownCheckLogged = true; // ★ もうさがしたよ
        addShiftTemplateSaveButton(shiftSel); // ★ シフトを保存するボタンをつけるよ
        shiftSel.addEventListener("change", () => {
          console.log(`プルダウンで${shiftSel.value}を選んだよ`); // ★ 何を選んだか言うよ
          const user = getCurrentUserName();
          chrome.storage.local.set(
            { [`savedShiftTemplate_${user}`]: shiftSel.value },
            () => {}
          );
          if (shiftSel.value.startsWith("__ext_")) {
            const name = shiftSel.value.replace("__ext_", "");
            console.log(`プルダウンの値に合わせて${name}を復元するよ`); // ★ 選んだテンプレで復元するよ
            applyShiftTemplate(name); // ★ 選んだテンプレで画面を作りなおすよ
          }
        });
        if (!hasCustomOption) {
          loadCustomTemplates(); // ★ まだなら入れてあげるよ
        }
      } else if (!hasCustomOption) {
        loadCustomTemplates(); // ★ 無くなったら入れ直すよ
      }
    } else {
      if (!dropdownCheckLogged) {
        console.log("プルダウンリストがまだ見つからないよ"); // ★ まだないことを知らせるよ
        dropdownCheckLogged = true; // ★ 一回だけ言うよ
      }
      shiftSelectElement = null; // ★ 見つからなかったら忘れるよ
    }

  if (
    defaultConfig.workTypes.length === 0 ||
    defaultConfig.reasons.length === 0 ||
    !defaultConfig.title
  ) {
    return;
  }

  // 保存キー作成
  function makeStorageKey() {
    const user = getCurrentUserName();
    const date = dateSpan ? dateSpan.textContent.trim() : "";
    return `tempSave_${user}_${date}`;
  }

  // 復元
  function restoreTempData() {
    if (tempDataRestored) return;
      chrome.storage.local.get([makeStorageKey()], (res) => {
        const obj = res[makeStorageKey()];
        if (obj) {
          console.log("一時保存したデータを見つけたよ"); // ★ みつけたよ
          try {
          if (obj.hourWorkHtml) {
            const hourWork = document.querySelector(".hour-work");
            if (hourWork) {
              hourWork.outerHTML = obj.hourWorkHtml;
              const newHourWork = document.querySelector(".hour-work");
              if (newHourWork) {
                newHourWork.querySelectorAll("input").forEach((inp) => {
                  inp.disabled = false;
                });
                newHourWork.querySelectorAll("select").forEach((sel) => {
                  sel.disabled = false;
                });
              }
            }
          }
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
              console.log(`プルダウンリストの値を${selNew.value}に戻したよ`); // ★ 以前の値を戻すよ
              selNew.dispatchEvent(new Event("change", { bubbles: true }));
            }
          restoredReason = obj.reason || "";
          const textarea = document.getElementById("update_reason");
          if (textarea && !textarea.disabled) {
            textarea.value = obj.reason;
          }
            tempDataRestored = true;
            console.log("一時保存したデータからいろんな値を復元したよ"); // ★ 復元できたよ
            chrome.storage.local.remove(makeStorageKey());
          } catch (e) {}
        }
      });
    }

  // 一時保存処理
  if (!tempSaveInitialized && cancelApplyBtn && dateSpan) {
    tempSaveInitialized = true;
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
      const shiftSel = document.getElementById(
        "shift_template_collection_for_timecard_cf"
      );
      const shiftValue = shiftSel ? shiftSel.value : "";
      const shiftHtml = shiftSel ? shiftSel.outerHTML : "";
      const data = {
        work: workValues,
        break: breakValues,
        reason: reasonText,
        hourWorkHtml: hourWorkHtml,
        shiftHtml: shiftHtml,
        shiftValue: shiftValue,
      };
      chrome.storage.local.set({ [makeStorageKey()]: data }, () => {
        if (showAlert) alert("一時保存しました");
      });
    }
    cancelApplyBtn.addEventListener("click", () => {
      saveTempData(false);
    });
  }

  // 勤怠UIの可視判定
  const textarea = document.getElementById("update_reason");
  const targetDiv = document.querySelector(
    "div.rightContent.staff_time_cards_month"
  );
  const isVisible = textarea && targetDiv && targetDiv.offsetParent !== null;

  if (!isVisible || textarea.disabled) {
    previousVisible = false;
    tempDataRestored = false;
    return;
  }

  // ===== 初回描画 =====
  if (!previousVisible) {
    previousVisible = true;

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
    let titleText = defaultTitle;
    let tempTitleText = titleText;

    const user = getCurrentUserName();

    // 設定読み込み
    chrome.storage.local.get(
      [`workTypes_${user}`, `reasons_${user}`, `title_${user}`],
      (data) => {
        if (Array.isArray(data[`workTypes_${user}`])) {
          tempWorkTypes = [...data[`workTypes_${user}`]];
        } else {
          tempWorkTypes = [...defaultWorkTypes];
          chrome.storage.local.set({ [`workTypes_${user}`]: tempWorkTypes });
        }
        if (Array.isArray(data[`reasons_${user}`])) {
          tempReasons = [...data[`reasons_${user}`]];
        } else {
          tempReasons = [...defaultReasons];
          chrome.storage.local.set({ [`reasons_${user}`]: tempReasons });
        }
        if (typeof data[`title_${user}`] === "string") {
          titleText = data[`title_${user}`];
        } else {
          titleText = defaultTitle;
          chrome.storage.local.set({ [`title_${user}`]: titleText });
        }
        tempTitleText = titleText;
        textarea.value = titleText;
        restoreTempData();
        renderAll();
      }
    );

    // DOM構築
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
    workTypeWrapper.style.marginBottom = "12px";

    const reasonWrapper = document.createElement("div");
    reasonWrapper.style.display = "none";
    reasonWrapper.style.flexWrap = "wrap";
    reasonWrapper.style.gap = "6px";
    reasonWrapper.style.marginBottom = "12px";

    const titleInput = document.createElement("input");
    titleInput.style.marginBottom = "6px";
    titleInput.style.padding = "4px";
    titleInput.style.display = "none";
    titleInput.value = tempTitleText;
    titleInput.addEventListener("input", () => {
      tempTitleText = titleInput.value;
      updateTextarea();
    });

    const editBtn = document.createElement("button");
    editBtn.textContent = "設定";
    applyDefaultButtonStyle(editBtn);
    editBtn.style.position = "absolute";
    editBtn.style.top = "0";
    editBtn.style.right = "0";
    editBtn.style.width = "auto";
    editBtn.style.background = "#888";
    editBtn.style.color = "#fff";
    editBtn.style.border = "none";
    editBtn.style.cursor = "pointer";

    const saveBtn = document.createElement("button");
    saveBtn.textContent = "確定";
    applyDefaultButtonStyle(saveBtn);
    saveBtn.style.width = "auto";
    saveBtn.style.background = "#28a745";
    saveBtn.style.color = "#fff";
    saveBtn.style.border = "none";
    saveBtn.style.cursor = "pointer";
    saveBtn.style.display = "none";

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "キャンセル";
    applyDefaultButtonStyle(cancelBtn);
    cancelBtn.style.width = "auto";
    cancelBtn.style.background = "#aaa";
    cancelBtn.style.color = "#fff";
    cancelBtn.style.border = "none";
    cancelBtn.style.cursor = "pointer";
    cancelBtn.style.display = "none";

    const exportBtn = document.createElement("button");
    exportBtn.textContent = "設定ダウンロード";
    applyDefaultButtonStyle(exportBtn);
    exportBtn.style.width = "auto";
    exportBtn.style.background = "#007bff";
    exportBtn.style.color = "#fff";
    exportBtn.style.border = "none";
    exportBtn.style.cursor = "pointer";
    exportBtn.style.marginTop = "12px";

    const actionGroup = document.createElement("div");
    actionGroup.style.display = "flex";
    actionGroup.style.justifyContent = "center";
    actionGroup.style.gap = "10px";
    actionGroup.style.marginTop = "auto";
    actionGroup.append(saveBtn, cancelBtn, exportBtn);

    function updateTextarea() {
      let text = editMode ? tempTitleText : titleText;
      if (selectedWorkType) text += `\n${selectedWorkType}`;
      if (selectedReasons.length) {
        text += `\n理由:${selectedReasons.join(",")}`;
      }
      textarea.value = text;
    }

    function renderButtons(list, container, type) {
      container.innerHTML = "";
      list.forEach((name, idx) => {
        const btn = document.createElement("button");
        btn.textContent = name;
        applyDefaultButtonStyle(btn);
        btn.style.cursor = "pointer";
        btn.style.position = "relative";
        if (editMode) {
          btn.draggable = true;
          btn.addEventListener("dragstart", (e) => {
            e.dataTransfer.setData("index", idx);
          });
          btn.addEventListener("dragover", (e) => e.preventDefault());
          btn.addEventListener("drop", (e) => {
            e.preventDefault();
            const from = parseInt(e.dataTransfer.getData("index"));
            if (!isNaN(from) && from !== idx) {
              const moved = list.splice(from, 1)[0];
              list.splice(idx, 0, moved);
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
              if (e.key === "Enter") input.blur();
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
        applyDefaultButtonStyle(addBtn);
        addBtn.style.width = "auto";
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
            if (e.key === "Enter") input.blur();
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

    function renderAll() {
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

    editBtn.addEventListener("click", () => {
      preSelectedWorkType = selectedWorkType;
      preSelectedReasons = [...selectedReasons];
      preReasonVisible = reasonWrapper.style.display !== "none";
      tempTitleText = titleText;
      editMode = true;
      renderAll();
    });

    saveBtn.addEventListener("click", () => {
      chrome.storage.local.set(
        {
          [`workTypes_${user}`]: tempWorkTypes,
          [`reasons_${user}`]: tempReasons,
          [`title_${user}`]: tempTitleText,
        },
        () => {
          editMode = false;
          titleText = tempTitleText;
          selectedWorkType = preSelectedWorkType;
          selectedReasons = [...preSelectedReasons];
          renderAll();
          reasonWrapper.style.display = preReasonVisible ? "flex" : "none";
        }
      );
    });

    cancelBtn.addEventListener("click", () => {
      editMode = false;
      selectedWorkType = preSelectedWorkType;
      selectedReasons = [...preSelectedReasons];
      tempTitleText = titleText;
      renderAll();
      reasonWrapper.style.display = preReasonVisible ? "flex" : "none";
    });

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

    wrapper.append(
      editBtn,
      titleInput,
      workTypeWrapper,
      reasonWrapper,
      actionGroup
    );
    textarea.parentElement.appendChild(wrapper);
  }
}, 500);
