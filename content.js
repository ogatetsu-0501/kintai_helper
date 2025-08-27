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
  .catch(() => {
    // エラーが出てもここでは何もしないよ
  });

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
    // 読み込みに失敗しても黙っておくよ
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
    const val = el.value.trim(); // ★ 入力された数字だよ
    const padded = val ? val.padStart(2, "0") : "00"; // ★ 2けたにそろえるよ
    return { selector: `input.${cls}`, value: padded };
  });
  const breakInputs = Array.from(
    document.querySelectorAll('div.break-times-data input[type="number"]')
  ).map((el) => {
    const cls = Array.from(el.classList).find(
      (c) => c.includes("hour") || c.includes("minute")
    );
    const val = el.value.trim(); // ★ 入力された数字だよ
    const padded = val ? val.padStart(2, "0") : "00"; // ★ 2けたにそろえるよ
    return { selector: `input.${cls}`, value: padded };
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

// ★ 保存したテンプレートを画面に反映するよ
  function applyShiftTemplate(name) {
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
    });
  }

// ★ 日付の下に保存ボタンを置くよ
function addShiftTemplateSaveButton(sel) {
  if (document.getElementById("save-shift-template-btn")) return; // ★ もうあるなら作らないよ
  const btn = document.createElement("button"); // ★ ボタンを作るよ
  btn.id = "save-shift-template-btn"; // ★ ボタンに名前をつけるよ
  btn.textContent = "テンプレート保存"; // ★ ボタンに文字を書くよ
  applyDefaultButtonStyle(btn); // ★ ボタンをいつもの見た目にするよ
  btn.style.background = "#65d3e4"; // ★ 空の色で目立たせるよ
  btn.style.color = "#ffffff"; // ★ 文字は白だよ
  btn.style.border = "1px solid #65d3e4"; // ★ ふちも同じ色だよ
  btn.style.width = "auto"; // ★ ボタンの横幅を自動にするよ

  const delBtn = document.createElement("button"); // ★ 消すボタンも作るよ
  delBtn.id = "delete-shift-template-btn"; // ★ ボタンに名前をつけるよ
  delBtn.textContent = "テンプレート削除"; // ★ 消すボタンの文字だよ
  applyDefaultButtonStyle(delBtn); // ★ ボタンをいつもの見た目にするよ
  delBtn.style.background = "#ff7978"; // ★ まっ赤で注意を出すよ
  delBtn.style.color = "#ffffff"; // ★ 文字は白だよ
  delBtn.style.border = "1px solid #ff7978"; // ★ ふちも赤にするよ
  delBtn.style.width = "auto"; // ★ 横幅を自動にするよ

  btn.addEventListener("click", () => {
    // ★ まずは画面を暗くするよ
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.right = "0";
    overlay.style.bottom = "0";
    overlay.style.background = "rgba(0,0,0,0.5)";
    overlay.style.zIndex = "10000";

    // ★ 真ん中に置く箱をつくるよ
    const box = document.createElement("div");
    box.style.background = "#fff";
    box.style.padding = "0 10px 10px"; // ★ 上のすき間をなくして題名を見えるようにするよ
    box.style.margin = "50px auto";
    box.style.width = "300px";
    box.style.textAlign = "center";

    // ★ 箱の上にタイトルをかざるよ
    const header = document.createElement("div");
    header.className = "popUpTitle editTime cf"; // ★ 見た目をサイトと同じにするよ
    header.style.background = "#34495e"; // ★ 見出しをくらい色にするよ
    header.style.padding = "15px 0"; // ★ 上と下にすき間をつくるよ
    header.style.textAlign = "center"; // ★ 文字をまんなかにするよ
    header.style.margin = "0 0 10px"; // ★ 下にちょっとすき間をあけるよ
    header.style.position = "sticky"; // ★ スクロールしても題名が上にくっつくよ
    header.style.top = "0"; // ★ いちばん上に固定するよ
    header.style.zIndex = "1"; // ★ ほかの部分より前に出すよ
    const ttl = document.createElement("div");
    ttl.className = "ttl"; // ★ 文字を入れる場所だよ
    ttl.textContent = "テンプレート保存"; // ★ モーダルの題名だよ
    ttl.style.color = "#ffffff"; // ★ 文字は白で見やすくするよ
    header.appendChild(ttl);
    box.appendChild(header);

    // ★ 名前を入れる場所だよ
    const input = document.createElement("input");
    input.type = "text";
    input.style.width = "100%";
    input.style.boxSizing = "border-box";
    input.style.marginBottom = "10px";
    box.appendChild(input);

    // ★ 保存ボタンを作るよ
    const okBtn = document.createElement("button");
    okBtn.textContent = "保存";
    applyDefaultButtonStyle(okBtn); // ★ ボタンをいつもの見た目にするよ
    okBtn.style.background = "#65d3e4"; // ★ 空の色で目立たせるよ
    okBtn.style.color = "#ffffff"; // ★ 文字は白だよ
    okBtn.style.border = "1px solid #65d3e4"; // ★ ふちも同じ色だよ
    okBtn.style.width = "auto"; // ★ 横幅を自動にするよ

    // ★ キャンセルボタンを作るよ
    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "キャンセル";
    applyDefaultButtonStyle(cancelBtn); // ★ ボタンをいつもの見た目にするよ
    cancelBtn.style.background = "#f7f8fa"; // ★ うすい灰色で静かにするよ
    cancelBtn.style.color = "#667083"; // ★ 文字はねずみ色だよ
    cancelBtn.style.border = "1px solid #dde2ed"; // ★ ふちはうすい灰色だよ
    cancelBtn.style.width = "auto"; // ★ 横幅を自動にするよ

    // ★ ボタンを横にならべる箱だよ
    const btnWrap = document.createElement("div");
    btnWrap.style.display = "flex";
    btnWrap.style.justifyContent = "center";
    btnWrap.style.gap = "10px";
    btnWrap.appendChild(okBtn);
    btnWrap.appendChild(cancelBtn);
    box.appendChild(btnWrap);

    overlay.appendChild(box);
    document.body.appendChild(overlay); // ★ 画面に出すよ

    cancelBtn.addEventListener("click", () => {
      overlay.remove(); // ★ 何もしないで閉じるよ
    });

    okBtn.addEventListener("click", () => {
      const name = input.value.trim(); // ★ 入力された名前を取るよ
      if (!name) return; // ★ からっぽなら終わりだよ
      const data = collectShiftTemplateData(); // ★ 今の入力を集めるよ
      const user = getCurrentUserName(); // ★ ユーザー名を調べるよ
      chrome.storage.local.get(`customShiftTemplates_${user}`, (res) => {
        const templates = res[`customShiftTemplates_${user}`] || {}; // ★ 前のデータを取るよ
        templates[name] = data; // ★ 新しいデータを入れるよ
        chrome.storage.local.set(
          { [`customShiftTemplates_${user}`]: templates },
          () => {
            const existOpt = Array.from(sel.options).find(
              (o) => o.value === `__ext_${name}`
            ); // ★ もうある選択肢をさがすよ
            if (!existOpt) {
              const opt = document.createElement("option"); // ★ 新しい選択肢を作るよ
              opt.value = `__ext_${name}`; // ★ データの名前を入れるよ
              opt.textContent = name; // ★ 目に見える名前を入れるよ
              sel.appendChild(opt); // ★ 選べるようにするよ
            } else {
              existOpt.textContent = name; // ★ 文字を新しくするよ
            }
            sel.value = `__ext_${name}`; // ★ 今の選択を新しいものにするよ
            sel.dispatchEvent(new Event("change", { bubbles: true })); // ★ 変わったことを知らせるよ
            overlay.remove(); // ★ 保存したら画面を閉じるよ
          }
        );
      });
    });
  });

  delBtn.addEventListener("click", () => {
    const user = getCurrentUserName(); // ★ ユーザー名を調べるよ
    chrome.storage.local.get(`customShiftTemplates_${user}`, (res) => {
      const templates = res[`customShiftTemplates_${user}`] || {}; // ★ 保存したテンプレートを取るよ
      const names = Object.keys(templates); // ★ 名前を全部集めるよ
      if (names.length === 0) {
        alert("消すテンプレートがないよ"); // ★ なければ教えるよ
        return; // ★ おしまい
      }

      const overlay = document.createElement("div"); // ★ 画面を暗くする箱だよ
      overlay.style.position = "fixed";
      overlay.style.top = "0";
      overlay.style.left = "0";
      overlay.style.right = "0";
      overlay.style.bottom = "0";
      overlay.style.background = "rgba(0,0,0,0.5)";
      overlay.style.zIndex = "10000";

      const box = document.createElement("div"); // ★ チェックを書く箱だよ
      box.style.background = "#fff";
      box.style.padding = "0 10px 10px"; // ★ 上のすき間をなくして題名を見えるようにするよ
      box.style.margin = "50px auto";
      box.style.width = "300px";
      box.style.maxHeight = "80%";
      box.style.overflowY = "auto";
      box.style.textAlign = "center";

      // ★ 箱の上にタイトルをかざるよ
      const header = document.createElement("div");
      header.className = "popUpTitle editTime cf"; // ★ 見た目をそろえるよ
      header.style.background = "#34495e"; // ★ 見出しをくらい色にするよ
      header.style.padding = "15px 0"; // ★ 上と下にすき間をつくるよ
      header.style.textAlign = "center"; // ★ 文字をまんなかにするよ
      header.style.margin = "0 0 10px"; // ★ 下にすき間をあけるよ
      header.style.position = "sticky"; // ★ スクロールしても題名が上にくっつくよ
      header.style.top = "0"; // ★ いちばん上に固定するよ
      header.style.zIndex = "1"; // ★ ほかの部分より前に出すよ
      const ttl = document.createElement("div");
      ttl.className = "ttl"; // ★ 文字を入れるよ
      ttl.textContent = "テンプレート削除"; // ★ モーダルの題名だよ
      ttl.style.color = "#ffffff"; // ★ 文字は白で見やすくするよ
      header.appendChild(ttl);
      box.appendChild(header);

      const styleId = "template-delete-style"; // ★ スタイルの名前だよ
      if (!document.getElementById(styleId)) {
        const style = document.createElement("style"); // ★ 見た目をきめるよ
        style.id = styleId; // ★ 同じものを二度作らないための札だよ
        style.textContent = `
          .template-delete-list {
            display: grid; /* ★ 横に二列ならべるよ */
            grid-template-columns: 1fr 1fr; /* ★ ひとしく二つに分けるよ */
            gap: 8px 16px; /* ★ すき間をあけるよ */
            justify-content: center; /* ★ まんなかに置くよ */
            justify-items: start; /* ★ 左そろえにするよ */
            align-items: center; /* ★ たてのまんなかにするよ */
            margin-bottom: 10px; /* ★ 下にちょっとすき間を作るよ */
          }
          .template-delete-item {
            position: relative; /* ★ 中の配置の基準だよ */
            display: inline-flex; /* ★ 横に文字と丸をならべるよ */
            align-items: center; /* ★ 上下まんなかにそろえるよ */
          }
          .template-delete-item input[type="checkbox"] {
            position: absolute; /* ★ 本当のチェックを隠すよ */
            opacity: 0; /* ★ 見えなくするけど働くよ */
            width: 30px; /* ★ 丸の横幅だよ */
            height: 30px; /* ★ 丸の高さだよ */
            left: 0; /* ★ 左にくっつけるよ */
            top: 50%; /* ★ たてのまんなかに置くよ */
            margin-top: -15px; /* ★ まんなかに見えるようにするよ */
          }
          .template-delete-item span {
            position: relative; /* ★ 疑似要素の置き場だよ */
            padding-left: 42px; /* ★ 丸(30px)とすき間だよ */
            line-height: 30px; /* ★ 文字の高さを丸に合わせるよ */
          }
          .template-delete-item span::before {
            content: ""; /* ★ からの箱で丸を作るよ */
            position: absolute; /* ★ 文字の左に置くよ */
            left: 0; /* ★ いちばん左だよ */
            top: 50%; /* ★ たてのまんなかだよ */
            width: 30px; /* ★ 丸の横幅だよ */
            height: 30px; /* ★ 丸の高さだよ */
            margin-top: -15px; /* ★ まんなかに見えるようにするよ */
            background: #fff; /* ★ うしろは白だよ */
            border: 1px solid #dee2e5; /* ★ うすい灰色のふちだよ */
            border-radius: 50%; /* ★ まん丸にするよ */
            box-sizing: border-box; /* ★ はみ出さないようにするよ */
          }
          .template-delete-item input[type="checkbox"]:checked + span::before {
            border: 1px solid #6bd5e5; /* ★ えらんだら青いふちだよ */
          }
          .template-delete-item input[type="checkbox"]:checked + span::after {
            content: ""; /* ★ チェックの形を描くよ */
            position: absolute; /* ★ 位置を決めるよ */
            top: 50%; /* ★ たてのまんなかだよ */
            left: 8px; /* ★ 丸の内側に置くよ */
            width: 12px; /* ★ チェックの横幅だよ */
            height: 6px; /* ★ チェックの高さだよ */
            margin-top: -3px; /* ★ まんなかに見えるようにするよ */
            border-right: 2px solid #6bd5e5; /* ★ 右の線だよ */
            border-bottom: 2px solid #6bd5e5; /* ★ 下の線だよ */
            transform: rotate(45deg); /* ★ 斜めにしてチェックにするよ */
            box-sizing: border-box; /* ★ にじみを防ぐよ */
          }
        `;
        box.appendChild(style); // ★ スタイルを箱に入れるよ
      }

      const listWrap = document.createElement("div"); // ★ チェックの一覧を入れる箱だよ
      listWrap.className = "template-delete-list"; // ★ 二列にするためのクラスだよ

      names.forEach((n) => {
        const label = document.createElement("label"); // ★ 名前と丸を一つのセットにするよ
        label.className = "template-delete-item"; // ★ 見た目を決めるクラスだよ
        const chk = document.createElement("input"); // ★ 本当のチェックだよ
        chk.type = "checkbox"; // ★ 何個でも選べるようにするよ
        chk.value = n; // ★ 名前を値として持たせるよ
        const span = document.createElement("span"); // ★ 名前を書く場所だよ
        span.textContent = n; // ★ 文字を入れるよ
        label.appendChild(chk); // ★ 丸をセットに入れるよ
        label.appendChild(span); // ★ 名前もセットに入れるよ
        listWrap.appendChild(label); // ★ 作ったセットを一覧に足すよ
      });
      box.appendChild(listWrap); // ★ 一覧を箱に入れるよ

      // ★ ボタンを横にならべる箱だよ
      const btnWrap = document.createElement("div");
      btnWrap.style.marginTop = "10px";
      btnWrap.style.display = "flex";
      btnWrap.style.justifyContent = "space-between"; // ★ 左右のはしに置くよ
      btnWrap.style.gap = "10px";
      btnWrap.style.width = "100%"; // ★ 箱いっぱいの横幅にするよ

      const okBtn = document.createElement("button"); // ★ 消すボタンだよ
      okBtn.textContent = "削除";
      applyDefaultButtonStyle(okBtn); // ★ ボタンをいつもの見た目にするよ
      okBtn.style.background = "#ff7978"; // ★ まっ赤で注意するよ
      okBtn.style.color = "#ffffff"; // ★ 文字は白だよ
      okBtn.style.border = "1px solid #ff7978"; // ★ ふちも赤だよ
      okBtn.style.width = "auto"; // ★ 横幅を自動にするよ

      const cancelBtn = document.createElement("button"); // ★ やめるボタンだよ
      cancelBtn.textContent = "キャンセル";
      applyDefaultButtonStyle(cancelBtn); // ★ ボタンをいつもの見た目にするよ
      cancelBtn.style.background = "#f7f8fa"; // ★ うすい灰色で静かにするよ
      cancelBtn.style.color = "#667083"; // ★ 文字はねずみ色だよ
      cancelBtn.style.border = "1px solid #dde2ed"; // ★ ふちはうすい灰色だよ
      cancelBtn.style.width = "auto"; // ★ 横幅を自動にするよ

      btnWrap.appendChild(okBtn);
      btnWrap.appendChild(cancelBtn);
      box.appendChild(btnWrap);

      overlay.appendChild(box);
      document.body.appendChild(overlay); // ★ 画面に出すよ

      cancelBtn.addEventListener("click", () => {
        overlay.remove(); // ★ 画面から消すよ
      });

      okBtn.addEventListener("click", () => {
        const checked = Array.from(
          box.querySelectorAll("input[type='checkbox']:checked")
        ).map((c) => c.value); // ★ えらんだ名前を集めるよ
        if (checked.length === 0) {
          overlay.remove(); // ★ 何もえらばなければ終わり
          return;
        }
        checked.forEach((name) => {
          delete templates[name]; // ★ ひとつずつ消すよ
        });
        chrome.storage.local.set(
          { [`customShiftTemplates_${user}`]: templates },
          () => {
            chrome.storage.local.get(
              `savedShiftTemplate_${user}`,
              (d) => {
                const saved = d[`savedShiftTemplate_${user}`];
                checked.forEach((name) => {
                  const opt = Array.from(sel.options).find(
                    (o) => o.value === `__ext_${name}`
                  ); // ★ プルダウンの項目をさがすよ
                  if (opt) opt.remove(); // ★ 見つけたら消すよ
                  if (saved === `__ext_${name}`) {
                    chrome.storage.local.remove(
                      `savedShiftTemplate_${user}`
                    ); // ★ えらんでた記録も消すよ
                  }
                  if (sel.value === `__ext_${name}`) {
                    sel.value = ""; // ★ いまえらんでいたら空にするよ
                    sel.dispatchEvent(
                      new Event("change", { bubbles: true })
                    ); // ★ 変わったよって知らせるよ
                  }
                });
              }
            );
          }
        );
        overlay.remove(); // ★ 終わったら画面を消すよ
      });
    });
  });

  const jdate = document.querySelector("div.floatLeft.jdate"); // ★ 日付の場所を見つけるよ
  if (jdate) {
    jdate.style.display = "inline-block"; // ★ 横に並べても変にならないようにするよ
    jdate.style.verticalAlign = "middle"; // ★ ボタンと真ん中を合わせるよ
    jdate.insertAdjacentElement("afterend", btn); // ★ 日付の下に保存ボタンを置くよ
    btn.insertAdjacentElement("afterend", delBtn); // ★ その横に削除ボタンを置くよ
    const btnHeight = btn.offsetHeight; // ★ ボタンの背の高さを調べるよ
    jdate.style.lineHeight = `${btnHeight}px`; // ★ 日付の文字も同じ高さにそろえるよ
    jdate.style.height = `${btnHeight}px`; // ★ 日付の箱も同じ高さにするよ
  } else {
    sel.parentElement.appendChild(btn); // ★ 見つからなければ元の場所に置くよ
    sel.parentElement.appendChild(delBtn); // ★ 削除ボタンも置くよ
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
      // ★ 保存したテンプレートをもう一度入れるおまじないだよ
      function loadCustomTemplates() {
        chrome.storage.local.get(`customShiftTemplates_${user}`, (res) => {
          const templates = res[`customShiftTemplates_${user}`] || {}; // ★ 保存したテンプレートを全部取るよ
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
            }
          });
          chrome.storage.local.get(`savedShiftTemplate_${user}`, (data) => {
            const saved = data[`savedShiftTemplate_${user}`];
            if (saved) {
              const submitBtn = document.querySelector(
                "button.jsubmit-edit-timecard"
              ); // ★ 「提出」ボタンがあるかさがすよ
              if (!submitBtn) {
                // ★ ボタンがないときは復元しないよ
                return; // ★ ここでおしまいだよ
              }
              const name = saved.replace("__ext_", ""); // ★ 名前だけを取り出すよ
              if (saved.startsWith("__ext_") && !templates[name]) {
                // ★ カスタムテンプレートがなくなったときは記録を消すよ
                chrome.storage.local.remove(
                  `savedShiftTemplate_${user}`,
                  () => {
                    // ★ もう無いテンプレートは記録から消すだけだよ
                  }
                );
                return; // ★ ここでおしまいだよ
              }
              let has = Array.from(shiftSel.options).some(
                (o) => o.value === saved
              ); // ★ 同じ値があるか調べるよ
              if (!has && !saved.startsWith("__ext_")) {
                const opt = document.createElement("option"); // ★ 新しい選択肢を作るよ
                opt.value = saved;
                opt.textContent = saved;
                shiftSel.appendChild(opt); // ★ プルダウンに入れるよ
                has = true; // ★ 追加したからあることにするよ
              }
              if (has) {
                if (shiftSel.value !== saved) {
                  // ★ いまのえらびと違うときだけ動かすよ
                  shiftSel.value = saved; // ★ 前にえらんだものを入れるよ
                  shiftSel.dispatchEvent(
                    new Event("change", { bubbles: true })
                  ); // ★ 変わったよって知らせるよ
                }
              }
            }
          });
        });
      }
      if (shiftSel !== shiftSelectElement) {
        shiftSelectElement = shiftSel;
        dropdownCheckLogged = true; // ★ もうさがしたよ
        addShiftTemplateSaveButton(shiftSel); // ★ シフトを保存するボタンをつけるよ
        shiftSel.addEventListener("change", () => {
          const user = getCurrentUserName();
          chrome.storage.local.set(
            { [`savedShiftTemplate_${user}`]: shiftSel.value },
            () => {}
          );
          if (shiftSel.value.startsWith("__ext_")) {
            const name = shiftSel.value.replace("__ext_", "");
            applyShiftTemplate(name); // ★ 選んだテンプレートで画面を作りなおすよ
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
          // ★ 一時保存したデータを使うよ
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
              selNew.value = obj.shiftValue || ""; // ★ 以前の値を入れるよ
              selNew.dispatchEvent(new Event("change", { bubbles: true }));
            }
            restoredReason = obj.reason || "";
            const textarea = document.getElementById("update_reason");
            if (textarea && !textarea.disabled) {
              textarea.value = obj.reason;
            }
            tempDataRestored = true; // ★ 復元が終わったよ
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

// ===== ラジオボタンの重なりを直すよ =====
(function () {
  // ラジオボタンとそのラベルの間にすきまをあける関数だよ
  function fixRadioSpacing(root = document) {
    // まず root の中にある全部のラジオボタンを探すよ
    const radios = root.querySelectorAll('input[type="radio"]');
    radios.forEach((radio) => {
      // ラジオボタンのすぐ後ろにあるラベルを見つけるよ
      const label = radio.nextElementSibling;
      if (label && label.tagName === 'LABEL') {
        // ラジオボタンとラベルが重ならないように余白をつけるよ
        radio.style.marginRight = '4px';
        label.style.marginLeft = '0px';
        label.style.marginRight = '10px';
        label.style.display = 'inline-block';
      }
    });
    // 何個なおしたか教えるログだよ
    console.log(`ラジオボタンのすきまを${radios.length}個直したよ`);
  }

  // ページが読み込まれたときに一度だけすきまを直すよ
  fixRadioSpacing();

  // 新しいラジオボタンが追加されたら気づいて直す見張り番だよ
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((m) => {
      m.addedNodes.forEach((node) => {
        if (node.nodeType === 1) {
          // 追加されたものがラジオボタンなら、その場所を直すよ
          if (node.matches && node.matches('input[type="radio"]')) {
            // 新しいラジオボタンを見つけたときのログだよ
            console.log('新しいラジオボタンを見つけたよ');
            fixRadioSpacing(node.parentNode);
          } else {
            // そうでなければ中にラジオボタンがないか調べて直すよ
            console.log('新しい場所にラジオボタンがあるか調べるよ');
            fixRadioSpacing(node);
          }
        }
      });
    });
  });

  // ページ全体を見張って、新しいラジオボタンを見つけたら教えてもらうよ
  observer.observe(document.body, { childList: true, subtree: true });
})();

// ===== ラジオは「擬似要素の丸」を表示、文字と重ならないように整えるよ =====
// ★ 既存HTML/JSは一切変えず、見た目だけを後勝ちCSSで直すよ
(function () {
  // ① 1回だけ入れるための印だよ
  const STYLE_ID = "kintai-radio-use-original-circle";

  // ② 後勝ちで効くCSSだよ（!important で確実に上書きするよ）
  //   ・.radioCheckWrapper の height:10px を打ち消して自動に戻す
  //   ・狭い幅では折り返し（wrap）で物理的な重なりを防ぐ
  //   ・label の左パディング/行高を「元デザイン（丸30px）」に合わせる
  //   ・以前の「content:none !important」を上書きして、擬似要素を“出す”
  //   ・ネイティブ input は視覚的に隠して二重表示を防ぐ（クリックは label でOK）
  const CSS = `
    /* ─ ラッパー：高さ不足を解消し、狭幅では折り返す ─ */
    .type_absent .radioCheckWrapper {
      display: flex !important;          /* 横に並べるよ */
      align-items: center !important;    /* 上下まんなかにそろえるよ */
      flex-wrap: wrap !important;        /* せまい時は次の行におりかえすよ */
      height: auto !important;           /* inline の height:10px を打ち消すよ */
      min-height: 32px !important;       /* 丸(30px)がつぶれない高さだよ */
      gap: 6px 16px !important;          /* 要素どうしのすき間だよ */
    }

    /* ─ ネイティブ input は見えないだけにして機能は残す（ダブル表示を防ぐ）─ */
    .type_absent .radioCheckWrapper input[type="radio"] {
      position: absolute !important;     /* レイアウトから外すよ */
      opacity: 0 !important;             /* 透明にするよ */
      width: 1px !important;
      height: 1px !important;
      margin: 0 !important;
      pointer-events: none !important;   /* クリックはラベルに任せるよ */
      appearance: none !important;
      -webkit-appearance: none !important;
      -moz-appearance: none !important;
      clip: rect(0 0 0 0) !important;
      clip-path: inset(50%) !important;
    }

    /* ─ ラベル：元デザインの丸(30px)に合わせて左余白と行高をそろえる ─ */
    .type_absent .radioCheckWrapper input[type="radio"] + label {
      position: relative !important;
      display: inline-block !important;
      padding-left: 42px !important;     /* ← 既存CSSどおり（丸30px + 余白） */
      line-height: 30px !important;      /* ← 丸と同じ高さにするよ */
      vertical-align: middle !important;
      /* 既存の .mr40 はそのまま使う（ここでは上書きしない） */
      white-space: normal !important;    /* せまい時は折り返せるようにするよ */
    }

    /* ── ここがポイント：擬似要素を“出す”指定（元デザインを維持）── */
    /* 外枠の丸：サイト既存の見た目に合わせて 30px / 白背景 / 灰枠 */
    .type_absent .radioCheckWrapper input[type="radio"] + label::before {
      content: "" !important;            /* 以前の content:none を打ち消すよ */
      position: absolute;
      left: 0;
      top: 50%;
      width: 30px;
      height: 30px;
      margin-top: -15px;                 /* 上下まんなかに置くよ */
      background: #fff;
      border: 1px solid #dee2e5;         /* 既存CSSと同じ枠色だよ */
      border-radius: 50%;
      box-sizing: border-box;
    }
    
    /* 選ばれたときは枠を水色にするよ */
    .type_absent .radioCheckWrapper input[type="radio"]:checked + label::before,
    .type_absent .radioCheckWrapper input[type="checkbox"]:checked + label::before {
      border: 1px solid #6bd5e5;         /* 枠を水色にするよ */
    }

    /* キーボード操作のフォーカス枠（元にあるならそちらが勝つよ） */
    .type_absent .radioCheckWrapper input[type="radio"]:focus + label::before {
      outline: 2px solid #2196f3;
      outline-offset: 2px;
    }

    /* ここから追加：チェックマークを描くだけだよ */
    .type_absent .radioCheckWrapper input[type="radio"]:checked + label::after {
      /* 小さなチェックを描くよ */
      content: "" !important;            /* 疑似要素を出すよ */
      position: absolute;                /* ラベルの中で位置を決めるよ */
      top: 50%;                          /* たてのまんなかに置くよ */
      left: 8px;                         /* 30px丸の内側でちょうどいい位置だよ */
      width: 12px;                       /* チェックの横幅だよ */
      height: 6px;                       /* チェックの高さだよ */
      margin-top: -3px;                  /* まんなかに見えるよう微調整するよ */
      border-right: 2px solid #6bd5e5;   /* 右の線だよ（既定色） */
      border-bottom: 2px solid #6bd5e5;  /* 下の線だよ（既定色） */
      transform: rotate(45deg);          /* 斜めにしてチェックにするよ */
      box-sizing: border-box;            /* にじみを少なくするよ */
      pointer-events: none;              /* クリックできなくするよ */
      background: transparent;           /* うしろを透明にするよ */
      border-radius: 0;                  /* 四角いままにするよ */
      z-index: 1;                        /* 外の丸より前に出すよ */
    }
  `;

  // ③ CSS を 1 回だけ入れるよ
  function injectCssOnce() {
    const exists = document.getElementById(STYLE_ID);
    if (exists) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    // <head> がなくても確実に効くように <html> 直下に入れるよ
    document.documentElement.appendChild(style);
  }

  // ④ いまある要素にも高さの直しをするよ
  function fixInlineHeight(root = document) {
    const wrappers = root.querySelectorAll(".type_absent .radioCheckWrapper");
    wrappers.forEach((w) => {
      w.style.setProperty("height", "auto", "important");
      w.style.setProperty("min-height", "32px", "important");
      w.style.setProperty("display", "flex", "important");
      w.style.setProperty("align-items", "center", "important");
      w.style.setProperty("flex-wrap", "wrap", "important");
      w.style.setProperty("gap", "6px 16px", "important");
    });
  }

  // ⑤ 今すぐ適用するよ
  function applyNow(root = document) {
    injectCssOnce();
    fixInlineHeight(root);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => applyNow());
  } else {
    applyNow();
  }

  // ⑥ あとから追加された要素にも自動で適用する見張り番だよ
  const mo = new MutationObserver((muts) => {
    for (const m of muts) {
      for (const n of m.addedNodes) {
        if (n && n.nodeType === 1) applyNow(n);
      }
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });
})();
// ===== 元デザインの「✔」で表示し、重なりだけ直す 最小追記 =====
// ★ 小学生でもわかるコメント付きだよ
(function () {
  // ① 今回使うスタイルの名前だよ
  const ID = "kintai-radio-keep-default-v3";
  // ② 同じ名前のスタイルがすでにあったら何もしないよ
  if (document.getElementById(ID)) return;

  // ③ CSSを書いた紙を作るよ
  const style = document.createElement("style");
  style.id = ID;
  style.textContent = `
    /* ── .type_absent の中だけ直すよ（ほかに迷惑をかけないため）── */

    /* A) ラッパーが高さ10pxでつぶれないようにするよ */
    .type_absent .radioCheckWrapper{
      height: auto !important;         /* 高さは自動にするよ */
      min-height: 32px !important;     /* 丸(30px)より少し余裕を持たせるよ */
    }

    /* B) ラベルの行高を丸(30px)に合わせて重なりを防ぐよ */
    .type_absent .radioCheckWrapper input[type="radio"] + label{
      line-height: 30px !important;    /* 文字が丸にかぶらないようにするよ */
      /* 既存の padding-left:42px はサイトのCSSに任せるよ（そのままでOK） */
    }

    /* C) 選ばれたときは枠を水色にするよ */
    .type_absent .radioCheckWrapper input[type="radio"]:checked + label::before,
    .type_absent .radioCheckWrapper input[type="checkbox"]:checked + label::before {
      border: 1px solid #6bd5e5;      /* 枠を水色にするよ */
    }

    /* D) 中央のチェックマークだけを描くよ（参考に頂いた方式そのまま） */
    .type_absent .radioCheckWrapper input[type="radio"]:checked + label::after,
    .type_absent .radioCheckWrapper input[type="checkbox"]:checked + label::after{
      content: "";                 /* 疑似要素を出すよ */
      position: absolute;          /* ぴったり場所を決めるよ */
      top: 50%;                    /* たての真ん中に置くよ */
      left: 8px;                   /* 左から少しの位置だよ */
      width: 14px;                 /* ✔の横幅だよ */
      height: 8px;                 /* ✔の高さだよ */
      margin-top: -6px;            /* 真ん中に見えるようにするよ */
      box-sizing: border-box;      /* 太さでずれないようにするよ */
      border-left: 2px solid #65d3e4;  /* 左の線の色と太さだよ */
      border-bottom: 2px solid #65d3e4;/* 下の線の色と太さだよ */
      -webkit-transform: rotate(-45deg); /* 斜めにして✔の形にするよ */
      -ms-transform: rotate(-45deg);
      transform: rotate(-45deg);
      pointer-events: none;        /* クリックの邪魔をしないよ */
      z-index: 1;                  /* 一番前に出すよ */
    }

    /* E) 古い「●ドット」が残っていても消すよ */
    .type_absent .radioCheckWrapper input[type="radio"]:checked + label::after{
      background: none !important;
      border-right: none !important;
    }
  `;
  document.documentElement.appendChild(style);

  // ④ すでにある要素の高さを直すよ
  document.querySelectorAll(".type_absent .radioCheckWrapper").forEach((w) => {
    w.style.setProperty("height", "auto", "important");    // 10pxをやめるよ
    w.style.setProperty("min-height", "32px", "important"); // 少し余裕を持たせるよ
  });
})();
