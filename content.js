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
  if (shiftSel && shiftSel !== shiftSelectElement) {
    shiftSelectElement = shiftSel;

    // ★ テンプレートを復元する関数だよ
    function restoreTemplateInputs(tpl) {
      const root = shiftSel.closest(".hour-work");
      if (!root) return;
      const inputs = Array.from(root.querySelectorAll("input"));
      tpl.inputs.forEach((v, i) => {
        const inp = inputs[i];
        if (!inp) return;
        if (inp.type === "radio" || inp.type === "checkbox") {
          inp.checked = v.checked;
        } else {
          inp.value = v.value;
        }
      });
      const selects = Array.from(root.querySelectorAll("select")).filter(
        (s) => s.id !== "shift_template_collection_for_timecard_cf"
      );
      tpl.selects.forEach((val, i) => {
        if (selects[i]) selects[i].value = val;
      });
    }

    // ★ テンプレートの選択肢を増やす関数だよ
    function addTemplateOption(name) {
      // ★ 今あるセレクトをもう一度さがすよ
      const sel = document.getElementById(
        "shift_template_collection_for_timecard_cf"
      );
      if (!sel) return;
      const value = `local_template:${name}`;
      const exists = Array.from(sel.options).some((o) => o.value === value);
      if (!exists) {
        const opt = document.createElement("option");
        opt.value = value;
        opt.textContent = name;
        sel.appendChild(opt);
        // ★ ちゃんと追加できたか確かめるよ
        console.log("テンプレ追加:", name);
      }
    }

    // ★ 今の入力をしまうボタンを作るよ
    const saveBtn = document.createElement("button");
    saveBtn.textContent = "今の入力を保存";
    applyDefaultButtonStyle(saveBtn);
    saveBtn.style.marginBottom = "6px";
    // ★ テンプレ一覧をひらくボタンもつくるよ
    const toggleListBtn = document.createElement("button");
    toggleListBtn.textContent = "テンプレ一覧表示";
    applyDefaultButtonStyle(toggleListBtn);
    toggleListBtn.style.marginBottom = "6px";
    // ★ ボタンをどこに置くか決めるよ
    const wrapper =
      shiftSel.closest(".row_1") || shiftSel.parentElement.parentElement;
    wrapper.appendChild(saveBtn);
    wrapper.appendChild(toggleListBtn);

    // ★ 保存したテンプレを見せる準備だよ
    // ★ みんなのテンプレのタイトルだよ
    const listTitle = document.createElement("div");
    listTitle.textContent = "保存したテンプレート";
    listTitle.style.marginTop = "6px";
    listTitle.style.display = "none";
    wrapper.appendChild(listTitle);
    // ★ テンプレをならべる箱だよ
    const templateListDiv = document.createElement("div");
    templateListDiv.style.marginTop = "4px";
    templateListDiv.style.display = "none";
    wrapper.appendChild(templateListDiv);

    // ★ 保存したテンプレートを画面に出すよ
    function renderTemplateList() {
      // ★ いったん中身を空っぽにするよ
      templateListDiv.innerHTML = "";
      const user = getCurrentUserName();
      const key = `timecardTemplates_${user}`;
      chrome.storage.local.get([key], (res) => {
        const list = res[key] || [];
        list.forEach((tpl) => {
          // ★ 1つぶんの行を作るよ
          const row = document.createElement("div");
          row.style.display = "flex";
          row.style.alignItems = "center";
          // ★ 名前を書いておくよ
          const nameSpan = document.createElement("span");
          nameSpan.textContent = tpl.name;
          nameSpan.style.flex = "1";
          // ★ 消すためのボタンだよ
          const delBtn = document.createElement("button");
          delBtn.textContent = "削除";
          applyDefaultButtonStyle(delBtn);
          delBtn.style.marginLeft = "6px";
          delBtn.addEventListener("click", () => {
            // ★ このテンプレだけ取り除くよ
            chrome.storage.local.get([key], (res2) => {
              const list2 = res2[key] || [];
              const newList = list2.filter((t) => t.name !== tpl.name);
              chrome.storage.local.set({ [key]: newList }, () => {
                // ★ 今あるセレクトをもう一度さがすよ
                const sel = document.getElementById(
                  "shift_template_collection_for_timecard_cf"
                );
                if (sel) {
                  // ★ 選ぶところからも消しておくよ
                  Array.from(sel.options).forEach((o) => {
                    if (o.value === `local_template:${tpl.name}`) o.remove();
                  });
                }
                renderTemplateList();
              });
            });
          });
          row.appendChild(nameSpan);
          row.appendChild(delBtn);
          templateListDiv.appendChild(row);
        });
      });
    }

    // ★ テンプレ一覧ボタンを押したら見せたり隠したりするよ
    toggleListBtn.addEventListener("click", () => {
      const hidden = templateListDiv.style.display === "none";
      if (hidden) {
        renderTemplateList();
        listTitle.style.display = "block";
        templateListDiv.style.display = "block";
        toggleListBtn.textContent = "一覧を隠す";
      } else {
        listTitle.style.display = "none";
        templateListDiv.style.display = "none";
        toggleListBtn.textContent = "テンプレ一覧表示";
      }
    });

    // ★ ボタンを押したときの動きだよ
    saveBtn.addEventListener("click", () => {
      const name = prompt("テンプレートの名前");
      if (!name) return;
      // ★ 今あるセレクトをもう一度さがすよ
      const sel = document.getElementById(
        "shift_template_collection_for_timecard_cf"
      );
      if (!sel) return;
      // ★ セレクトのまわりにある入力欄の箱を見つけるよ
      const root = sel.closest(".hour-work");
      if (!root) return;
      const inputs = Array.from(root.querySelectorAll("input"));
      const inputData = inputs.map((inp) => ({
        type: inp.type,
        checked: inp.checked,
        value: inp.value,
      }));
      const selects = Array.from(root.querySelectorAll("select"))
        .filter((s) => s.id !== "shift_template_collection_for_timecard_cf")
        .map((s) => s.value);
      const templateData = { inputs: inputData, selects };
      const user = getCurrentUserName();
      const key = `timecardTemplates_${user}`;
      chrome.storage.local.get([key], (res) => {
        const list = res[key] || [];
        const exist = list.find((t) => t.name === name);
        if (exist) exist.data = templateData;
        else list.push({ name, data: templateData });
        chrome.storage.local.set({ [key]: list }, () => {
          addTemplateOption(name);
          renderTemplateList();
          alert("テンプレートを保存しました");
        });
      });
    });

    // ★ 休憩の入力欄が無かったら作る関数だよ
    function ensureBreakBlock() {
      // ★ 今あるセレクトをもう一度さがすよ
      const sel = document.getElementById(
        "shift_template_collection_for_timecard_cf"
      );
      if (!sel) return;
      // ★ 勤務時間の箱をさがすよ
      const root = sel.closest(".hour-work");
      if (!root) return;
      // ★ すでに休憩の箱があるか見るよ
      let outer = root.querySelector(".break-times.time_card_container");
      // ★ 箱があって中に入力欄があるなら何もしないよ
      if (outer && outer.querySelector(".break-times-data")) return;
      // ★ 箱がなければ新しく作るよ
      if (!outer) {
        outer = document.createElement("div");
        outer.className = "break-times time_card_container";
      } else {
        // ★ 箱だけあって中身が空なら中身をきれいにするよ
        outer.innerHTML = "";
      }
      // ★ 本物の休憩の箱をつくるよ
      const wrap = document.createElement("div");
      wrap.id = "pScroll";
      wrap.className = "oneColumn time-break jnormal";
      // ★ タイトルの箱をつくるよ
      const titleDiv = document.createElement("div");
      titleDiv.className = "break-times-title";
      const titleSpan = document.createElement("span");
      titleSpan.className = "title ftlg12 FONT666666 type_break_meal_1";
      titleSpan.textContent = "休憩1";
      const radioWrap = document.createElement("div");
      radioWrap.className = "radioCheckWrapper ps10 break_time";
      radioWrap.style.height = "10px";
      titleSpan.appendChild(radioWrap);
      titleDiv.appendChild(titleSpan);
      wrap.appendChild(titleDiv);
      // ★ 入力欄の箱をつくるよ
      const dataDiv = document.createElement("div");
      dataDiv.className = "break-times-data";
      // ★ 休憩開始の時間を入れる箱だよ
      const h1 = document.createElement("input");
      h1.type = "number";
      h1.min = "0";
      h1.max = "48";
      h1.className = "ftlg12 FONT666666 jnormal hour-1-break-1";
      dataDiv.appendChild(h1);
      const sp1 = document.createElement("span");
      sp1.className = "ftlg14 FONT666666";
      sp1.textContent = "：";
      dataDiv.appendChild(sp1);
      const m1 = document.createElement("input");
      m1.type = "number";
      m1.min = "0";
      m1.max = "59";
      m1.className = "ftlg12 FONT666666 jnormal minute-1-break-1";
      dataDiv.appendChild(m1);
      const sp2 = document.createElement("span");
      sp2.className = "ftlg10 FONT666666";
      sp2.innerHTML = "&nbsp;〜&nbsp;";
      dataDiv.appendChild(sp2);
      // ★ 休憩おわりの時間を入れる箱だよ
      const h2 = document.createElement("input");
      h2.type = "number";
      h2.min = "0";
      h2.max = "48";
      h2.className = "ftlg12 FONT666666 jnormal hour-2-break-1";
      dataDiv.appendChild(h2);
      const sp3 = document.createElement("span");
      sp3.className = "ftlg14 FONT666666";
      sp3.textContent = "：";
      dataDiv.appendChild(sp3);
      const m2 = document.createElement("input");
      m2.type = "number";
      m2.min = "0";
      m2.max = "59";
      m2.className = "ftlg12 FONT666666 jnormal minute-2-break-1";
      dataDiv.appendChild(m2);
      // ★ 入力を消すためのボタンだよ
      const link = document.createElement("a");
      link.href = "javascript:void(0);";
      link.className = "shiftDelete";
      link.setAttribute(
        "onclick",
        "AppUtils.clearInputValue(this, 'break-times-data');"
      );
      const img = document.createElement("img");
      img.src = "/assets/common/img/icon/icon_close.svg";
      img.width = 10;
      img.height = 10;
      link.appendChild(img);
      dataDiv.appendChild(link);
      wrap.appendChild(dataDiv);
      // ★ レイアウトを整えるための箱だよ
      const clearDiv = document.createElement("div");
      clearDiv.className = "clearfix";
      wrap.appendChild(clearDiv);
      // ★ 外側の箱に休憩の箱を入れるよ
      outer.appendChild(wrap);
      // ★ 出来上がった休憩の箱を画面に出すよ
      root.appendChild(outer);
    }

    // ★ セレクトが変わったときの動きだよ
    shiftSel.addEventListener("change", () => {
      const user = getCurrentUserName();
      const val = shiftSel.value;
      // ★ どのテンプレをえらんだか文字で出すよ
      console.log("選んだテンプレ:", val);
      chrome.storage.local.set(
        { [`savedShiftTemplate_${user}`]: val },
        () => {}
      );
      if (val.startsWith("local_template:")) {
        const name = val.replace("local_template:", "");
        const key = `timecardTemplates_${user}`;
        chrome.storage.local.get([key], (res) => {
          const list = res[key] || [];
          const tpl = list.find((t) => t.name === name);
          if (tpl) restoreTemplateInputs(tpl.data);
        });
      }
      // ★ 休憩欄がなかったらここで作るよ
      ensureBreakBlock();
    });

    // ★ えらべるテンプレを新しくする関数だよ
    function refreshTemplateOptions() {
      const user = getCurrentUserName();
      const key = `timecardTemplates_${user}`;
      chrome.storage.local.get([key, `savedShiftTemplate_${user}`], (data) => {
        const list = data[key] || [];
        // ★ まず前に入ってる自分のテンプレを全部けすよ
        Array.from(shiftSel.options).forEach((o) => {
          if (o.value.startsWith("local_template:")) o.remove();
        });
        // ★ 保存してあるテンプレをぜんぶ足すよ
        list.forEach((t) => addTemplateOption(t.name));
        const saved = data[`savedShiftTemplate_${user}`];
        // ★ 前にえらんでいたテンプレの名前だよ
        console.log("保存されてたテンプレ:", saved);
        if (!saved) return;
        // ★ セレクトにそのテンプレがあるか調べるよ
        const hasOption = Array.from(shiftSel.options).some(
          (o) => o.value === saved
        );
        console.log("選択肢にあるかな?:", hasOption);
        if (hasOption) {
          // ★ あったら自分でそのテンプレを選ぶよ
          shiftSel.value = saved;
          shiftSel.dispatchEvent(new Event("change", { bubbles: true }));
        } else {
          // ★ ないときは注意を出すよ
          console.warn("保存されたテンプレが選択肢にないよ");
        }
      });
    }

    // ★ まずは一回だけ新しくするよ
    refreshTemplateOptions();
    // ★ 選択肢が書きかわったらまた新しくするよ
    const optionObserver = new MutationObserver(() => {
      refreshTemplateOptions();
    });
    optionObserver.observe(shiftSel, { childList: true });
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
            // ★ ローカルストレージからテンプレートを読み込むよ
            const user = getCurrentUserName();
            const key = `timecardTemplates_${user}`;
            chrome.storage.local.get([key], (res) => {
              const list = res[key] || [];
              list.forEach((t) => {
                const value = `local_template:${t.name}`;
                const exists = Array.from(selNew.options).some(
                  (o) => o.value === value
                );
                if (!exists) {
                  // ★ 新しい選択肢をつくるよ
                  const opt = document.createElement("option");
                  opt.value = value;
                  opt.textContent = t.name;
                  selNew.appendChild(opt);
                }
              });
              // ★ 選択肢を入れたあとで自動で選ぶよ
              selNew.disabled = false;
              selNew.value = obj.shiftValue || "";
              selNew.dispatchEvent(new Event("change", { bubbles: true }));
            });
          }
          restoredReason = obj.reason || "";
          const textarea = document.getElementById("update_reason");
          if (textarea && !textarea.disabled) {
            textarea.value = obj.reason;
          }
          tempDataRestored = true;
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
