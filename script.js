const historyOptions = [
  { value: "none", label: "なし" },
  { value: "2025", label: "2025" },
  { value: "2022-2024", label: "2022〜2024" },
  { value: "2021-or-earlier", label: "2021以前" },
];

const VALID_HISTORY_VALUES = new Set(historyOptions.map((option) => option.value));
const MAX_CORPORATE_NUMBER_LENGTH = 13;
const MAX_NAME_QUERY_LENGTH = 120;
const MAX_RECORD_FIELD_LENGTH = 160;
const MAX_SEARCH_RECORD_COUNT = 300000;

const resultPatterns = {
  A: {
    title: "判定結果 A",
    summary: "インボイス枠・通常枠ともに2026年申請可です。",
    requirementTitle: "申請要件",
    requirementBody: "なし",
    additionalTitle: "加点要件",
    additionalBody:
      "賃金引上げは任意で選択可です。する（3%計画）は計画未達成時の場合に18か月大幅減点注意。しない（1.7%計画）は計画達成必要なし。",
  },
  B: {
    title: "判定結果 B",
    summary: "通常枠は2026年申請可、インボイス枠は2026年申請不可です。",
    requirementTitle: "申請要件",
    requirementBody:
      "賃金引上げが必須です。3.5%計画が未達成の場合に補助金全額返還。",
    additionalTitle: "加点要件",
    additionalBody: "一般加点要件は選択可です。ペナルティなし。",
  },
  C: {
    title: "判定結果 C",
    summary: "通常枠は12カ月待機後申請可、インボイス枠は2026年申請不可です。",
    requirementTitle: "申請要件",
    requirementBody:
      "賃金引上げが必須です。3.5%計画が未達成の場合に補助金全額返還。",
    additionalTitle: "加点要件",
    additionalBody: "一般加点要件は選択可です。ペナルティなし。",
  },
  D: {
    title: "判定結果 D",
    summary: "インボイス枠・通常枠ともに2026年申請可です。",
    requirementTitle: "申請要件",
    requirementBody:
      "賃金引上げが必須です。3.5%計画が未達成の場合に補助金全額返還。",
    additionalTitle: "加点要件",
    additionalBody: "一般加点要件は選択可です。ペナルティなし。",
  },
  E: {
    title: "判定結果 E",
    summary: "インボイス枠は2026年申請可、通常枠は12カ月待機後申請可です。",
    requirementTitle: "申請要件",
    requirementBody:
      "賃金引上げが必須です。3.5%計画が未達成の場合に補助金全額返還。",
    additionalTitle: "加点要件",
    additionalBody: "一般加点要件は選択可です。ペナルティなし。",
  },
};

const app = document.getElementById("app");
const searchApp = document.getElementById("search-app");
const checkTabButton = document.getElementById("tab-button-check");
const searchTabButton = document.getElementById("tab-button-search");
const checkTabPanel = document.getElementById("tab-panel-check");
const searchTabPanel = document.getElementById("tab-panel-search");
const SEARCH_RESULT_LIMIT = 100;
const SEARCH_DATA_JSON_PATH = "./search-data-2022-2025.json";

const state = {
  invoiceHistory: "",
  normalHistory: "",
  resultId: null,
  error: "",
};

const searchState = {
  loading: false,
  loaded: false,
  error: "",
  statusMessage: "",
  sourceLabel: "2022〜2025検索JSON 未読込",
  records: [],
  lastResults: [],
  criteria: {
    corporateNumber: "",
    name: "",
  },
};

const uiState = {
  activeTab: "check",
};

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isValidHistoryValue(value) {
  return VALID_HISTORY_VALUES.has(value);
}

function toSafeText(value, maxLength = MAX_RECORD_FIELD_LENGTH) {
  const text = typeof value === "string" ? value : String(value ?? "");
  return text.trim().slice(0, maxLength);
}

function sanitizeCorporateNumberInput(value) {
  return normalizeCorporateNumber(toSafeText(value, MAX_CORPORATE_NUMBER_LENGTH)).slice(0, MAX_CORPORATE_NUMBER_LENGTH);
}

function sanitizeNameInput(value) {
  return toSafeText(value, MAX_NAME_QUERY_LENGTH);
}

function resetState() {
  state.invoiceHistory = "";
  state.normalHistory = "";
  state.resultId = null;
  state.error = "";
  render();
}

function getInvoiceStatus(history) {
  if (history === "none" || history === "2021-or-earlier") {
    return { symbol: "○", label: "インボイス枠", detail: "2026申請可", tone: "ok" };
  }

  return { symbol: "×", label: "インボイス枠", detail: "2026申請不可", tone: "ng" };
}

function getNormalStatus(history) {
  if (history === "2025") {
    return { symbol: "△", label: "通常枠", detail: "12カ月待機後申請可", tone: "wait" };
  }

  return { symbol: "○", label: "通常枠", detail: "2026申請可", tone: "ok" };
}

function determineResultId(invoiceHistory, normalHistory) {
  const invoiceAllowed = invoiceHistory === "none" || invoiceHistory === "2021-or-earlier";

  if (invoiceAllowed) {
    if (normalHistory === "2025") {
      return "E";
    }

    if (normalHistory === "2022-2024") {
      return "D";
    }

    return "A";
  }

  if (normalHistory === "2025") {
    return "C";
  }

  return "B";
}

function renderStatusCard(item) {
  return `
    <article class="status-card status-card--${item.tone}" aria-label="${escapeHtml(item.label)} ${escapeHtml(item.symbol)} ${escapeHtml(item.detail)}">
      <div class="status-card__header">
        <span class="status-card__symbol" aria-hidden="true">${escapeHtml(item.symbol)}</span>
        <h3>${escapeHtml(item.label)}</h3>
      </div>
      <p>${escapeHtml(item.detail)}</p>
    </article>
  `;
}

function renderHistoryOptionSelect({ id, label, value }) {
  const optionMarkup = historyOptions
    .map((option) => {
      return `<option value="${escapeHtml(option.value)}" ${option.value === value ? "selected" : ""}>${escapeHtml(option.label)}</option>`;
    })
    .join("");

  return `
    <div class="field">
      <label for="${escapeHtml(id)}">${escapeHtml(label)}</label>
      <select id="${escapeHtml(id)}" name="${escapeHtml(id)}" aria-label="${escapeHtml(label)}">
        <option value="">選択してください</option>
        ${optionMarkup}
      </select>
    </div>
  `;
}

function renderResult() {
  if (!state.resultId) {
    return `
      <section class="info-block" aria-labelledby="guide-title">
        <h3 id="guide-title">判定方法</h3>
        <ul class="history-list">
          <li>① デジタル化枠 / インボイス枠の交付決定歴を選択してください。</li>
          <li>② 通常枠の交付決定歴を選択してください。</li>
          <li>A〜E の判定結果を表示します。</li>
        </ul>
      </section>
    `;
  }

  const result = resultPatterns[state.resultId];
  const invoiceStatus = getInvoiceStatus(state.invoiceHistory);
  const normalStatus = getNormalStatus(state.normalHistory);

  return `
    <section class="result-panel" aria-labelledby="result-title">
      <div>
        <h2 id="result-title">${escapeHtml(result.title)}</h2>
        <p class="result-copy">${escapeHtml(result.summary)}</p>
      </div>

      <div class="result-grid">
        ${renderStatusCard(invoiceStatus)}
        ${renderStatusCard(normalStatus)}
      </div>

      <section class="info-block" aria-labelledby="requirement-title">
        <h3 id="requirement-title">${escapeHtml(result.requirementTitle)}</h3>
        <p class="result-copy">${escapeHtml(result.requirementBody)}</p>
      </section>

      <section class="info-block" aria-labelledby="additional-title">
        <h3 id="additional-title">${escapeHtml(result.additionalTitle)}</h3>
        <p class="result-copy">${escapeHtml(result.additionalBody)}</p>
      </section>

      <p class="note">本チェック結果は簡易判定です。実際の申請可否は公募要領・事務局の最新案内をご確認ください。</p>
    </section>
  `;
}

function render() {
  app.innerHTML = `
    <section class="check-panel" aria-labelledby="check-title">
      <div class="section-heading">
        <p class="section-heading__eyebrow">申請可否チェック</p>
        <h2 id="check-title">交付決定歴から 申請可否（ A〜E ）を判定</h2>
        <p class="section-heading__lead">
          交付決定歴を2項目選ぶだけで通常枠・インボイス枠の申請可否を確認できます。
        </p>
      </div>

      <form class="decision-form" id="decision-form">
        <div class="search-form__grid">
          ${renderHistoryOptionSelect({
            id: "invoice-history",
            label: "デジタル化枠 / インボイス枠の交付決定歴",
            value: state.invoiceHistory,
          })}
          ${renderHistoryOptionSelect({
            id: "normal-history",
            label: "通常枠の交付決定歴",
            value: state.normalHistory,
          })}
        </div>

        <div class="search-actions">
          <button type="submit" class="search-button">判定する</button>
          <button type="button" class="secondary-button" id="reset-button">リセット</button>
        </div>

        ${state.error ? `<p class="search-status" role="alert">${escapeHtml(state.error)}</p>` : ""}
      </form>

      ${renderResult()}
    </section>
  `;

  document.getElementById("decision-form").addEventListener("submit", (event) => {
    event.preventDefault();

    const invoiceHistory = document.getElementById("invoice-history").value;
    const normalHistory = document.getElementById("normal-history").value;

    state.invoiceHistory = invoiceHistory;
    state.normalHistory = normalHistory;

    if (!invoiceHistory || !normalHistory) {
      state.resultId = null;
      state.error = "2項目とも選択してください。";
      render();
      return;
    }

    if (!isValidHistoryValue(invoiceHistory) || !isValidHistoryValue(normalHistory)) {
      state.resultId = null;
      state.error = "入力値が不正です。画面から選択し直してください。";
      render();
      return;
    }

    state.error = "";
    state.resultId = determineResultId(invoiceHistory, normalHistory);
    render();
  });

  document.getElementById("reset-button").addEventListener("click", resetState);
}

function setActiveTab(tabName) {
  uiState.activeTab = tabName;

  const isCheckTab = tabName === "check";

  checkTabButton.classList.toggle("is-active", isCheckTab);
  searchTabButton.classList.toggle("is-active", !isCheckTab);

  checkTabButton.setAttribute("aria-selected", String(isCheckTab));
  searchTabButton.setAttribute("aria-selected", String(!isCheckTab));

  checkTabButton.tabIndex = isCheckTab ? 0 : -1;
  searchTabButton.tabIndex = isCheckTab ? -1 : 0;

  checkTabPanel.hidden = !isCheckTab;
  searchTabPanel.hidden = isCheckTab;
}

function initializeTabs() {
  checkTabButton.addEventListener("click", () => setActiveTab("check"));
  searchTabButton.addEventListener("click", () => setActiveTab("search"));

  checkTabButton.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      setActiveTab("search");
      searchTabButton.focus();
    }
  });

  searchTabButton.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      setActiveTab("check");
      checkTabButton.focus();
    }
  });

  setActiveTab(uiState.activeTab);
}

function normalizeText(value) {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
}

function normalizeCorporateNumber(value) {
  return value.replace(/[^\d]/g, "");
}

function mapJsonRowToRecord(columns) {
  if (!Array.isArray(columns)) {
    throw new Error("検索JSONの行データ形式が不正です。");
  }

  const corporateNumber = sanitizeCorporateNumberInput(columns[0]);
  const businessName = toSafeText(columns[1]);

  return {
    corporateNumber,
    businessName,
    fiscalYear: toSafeText(columns[2], 20),
    category: toSafeText(columns[3], 80),
    round: toSafeText(columns[4], 40),
    normalizedCorporateNumber: normalizeCorporateNumber(corporateNumber),
    normalizedBusinessName: normalizeText(businessName),
  };
}

function waitForNextTick() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

async function prepareSearchData() {
  if (searchState.loaded || searchState.loading) {
    return;
  }

  searchState.loading = true;
  searchState.error = "";
  searchState.statusMessage = "2022〜2025年度の検索JSONを読み込んでいます。初回のみ少し時間がかかります。";
  renderSearch();

  try {
    const response = await fetch(SEARCH_DATA_JSON_PATH);

    if (!response.ok) {
      throw new Error(`検索JSONの取得に失敗しました: ${response.status}`);
    }
    const responseText = await response.text();
    let payload;

    try {
      payload = JSON.parse(responseText);
    } catch (parseError) {
      if (responseText.trimStart().startsWith("<")) {
        throw new Error("検索JSONの代わりにHTMLが返されました。GitHub Pages の公開対象に JSON ファイルが含まれているか確認してください。");
      }

      throw new Error("検索JSONを解析できませんでした。");
    }

    const sourceRows = Array.isArray(payload?.rows) ? payload.rows : null;

    if (!sourceRows) {
      throw new Error("検索JSONの形式が不正です。");
    }

    if (sourceRows.length > MAX_SEARCH_RECORD_COUNT) {
      throw new Error("検索JSONの件数が想定を超えています。");
    }

    const preparedRecords = [];
    const chunkSize = 5000;
    const total = sourceRows.length;

    for (let start = 0; start < total; start += chunkSize) {
      const end = Math.min(start + chunkSize, total);

      for (let index = start; index < end; index += 1) {
        preparedRecords.push(mapJsonRowToRecord(sourceRows[index]));
      }

      if (end < total) {
        searchState.statusMessage = `検索データを準備しています。${end.toLocaleString("ja-JP")} / ${total.toLocaleString("ja-JP")} 件`;
        renderSearch();
        await waitForNextTick();
      }
    }

    searchState.records = preparedRecords;
    searchState.loaded = true;
    searchState.sourceLabel = `2022〜2025検索JSON ${preparedRecords.length.toLocaleString("ja-JP")}件`;
    searchState.statusMessage = `${preparedRecords.length.toLocaleString("ja-JP")}件の2022〜2025年度採択者一覧を検索できます。`;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "";
    searchState.error = errorMessage || "2022〜2025年度の検索JSONを読み込めませんでした。GitHub Pages などHTTP配信環境で開いているか確認してください。";
    searchState.statusMessage = "検索データを読み込めませんでした。";
  } finally {
    searchState.loading = false;
    renderSearch();
  }
}

function searchRecords() {
  const corporateNumberQuery = normalizeCorporateNumber(searchState.criteria.corporateNumber);
  const nameQuery = normalizeText(searchState.criteria.name);

  if (!corporateNumberQuery && !nameQuery) {
    searchState.lastResults = [];
    searchState.statusMessage = "法人番号または事業者名・個人事業主名・屋号を入力してください。";
    renderSearch();
    return;
  }

  const matched = searchState.records.filter((record) => {
    const matchedCorporateNumber =
      !corporateNumberQuery || record.normalizedCorporateNumber.includes(corporateNumberQuery);
    const matchedName =
      !nameQuery || record.normalizedBusinessName.includes(nameQuery);

    return matchedCorporateNumber && matchedName;
  });

  searchState.lastResults = matched.slice(0, SEARCH_RESULT_LIMIT);

  if (matched.length === 0) {
    searchState.statusMessage = "一致する採択者は見つかりませんでした。";
  } else if (matched.length > SEARCH_RESULT_LIMIT) {
    searchState.statusMessage = `${matched.length.toLocaleString("ja-JP")}件見つかりました。先頭${SEARCH_RESULT_LIMIT}件を表示しています。`;
  } else {
    searchState.statusMessage = `${matched.length.toLocaleString("ja-JP")}件見つかりました。`;
  }

  renderSearch();
}

async function handleSearchSubmit(event) {
  event.preventDefault();

  searchState.criteria.corporateNumber = sanitizeCorporateNumberInput(
    document.getElementById("search-corporate-number").value,
  );
  searchState.criteria.name = sanitizeNameInput(document.getElementById("search-business-name").value);

  if (!searchState.loaded) {
    await prepareSearchData();
  }

  if (!searchState.error) {
    searchRecords();
  }
}

function resetSearch() {
  searchState.criteria.corporateNumber = "";
  searchState.criteria.name = "";
  searchState.lastResults = [];
  searchState.statusMessage = "";

  renderSearch();
}

function renderResultsTable() {
  if (searchState.lastResults.length === 0) {
    const message = searchState.error
      ? "検索データを読み込めなかったため、検索結果を表示できません。"
      : (searchState.criteria.corporateNumber || searchState.criteria.name)
        ? "検索条件に一致する採択者は見つかりませんでした。"
        : "検索条件を入力すると、ここに採択者一覧が表示されます。";

    return `<p class="empty-state">${escapeHtml(message)}</p>`;
  }

  const rows = searchState.lastResults
    .map((record) => {
      return `
        <tr>
          <td>${escapeHtml(record.corporateNumber || "-")}</td>
          <td>${escapeHtml(record.businessName || "-")}</td>
          <td>${escapeHtml(record.fiscalYear || "-")}</td>
          <td>${escapeHtml(record.category || "-")}</td>
          <td>${escapeHtml(record.round || "-")}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <div class="results-table-wrap">
      <table class="results-table">
        <thead>
          <tr>
            <th scope="col">法人番号</th>
            <th scope="col">事業者名・個人事業主名・屋号</th>
            <th scope="col">年度</th>
            <th scope="col">類型</th>
            <th scope="col">締切回</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

function renderSearch() {
  searchApp.innerHTML = `
    <div class="section-heading">
      <p class="section-heading__eyebrow">採択者検索</p>
      <h2 id="search-title">2022-2025採択者一覧 検索</h2>
    </div>

    <section class="search-panel" aria-labelledby="search-form-title">
      <div class="info-block">
        <h3 id="search-form-title">検索条件</h3>
        <form class="search-form" id="search-form">
          <div class="search-form__grid">
            <div class="field">
              <label for="search-corporate-number">法人番号</label>
              <input
                id="search-corporate-number"
                name="corporateNumber"
                type="text"
                inputmode="numeric"
                maxlength="32"
                placeholder="例: 1234567890123"
                value="${escapeHtml(searchState.criteria.corporateNumber)}"
                aria-label="法人番号で検索"
              />
              <p class="field__hint">ハイフンや空白が入っていても検索できます。</p>
            </div>

            <div class="field">
              <label for="search-business-name">事業者名・個人事業主名・屋号</label>
              <input
                id="search-business-name"
                name="businessName"
                type="text"
                maxlength="${MAX_NAME_QUERY_LENGTH}"
                placeholder="例: 株式会社○○ / ○○商店"
                value="${escapeHtml(searchState.criteria.name)}"
                aria-label="事業者名・個人事業主名・屋号で検索"
              />
              <p class="field__hint">全角半角の違いを吸収して部分一致で検索します。</p>
            </div>
          </div>

          <div class="search-actions">
            <button
              type="submit"
              class="search-button"
              aria-label="採択者一覧を検索"
              ${searchState.loading ? "disabled" : ""}
            >
              ${searchState.loading ? "読込中..." : "検索する"}
            </button>
            <button type="button" class="secondary-button" id="search-reset-button" aria-label="検索条件をクリア">
              条件をクリア
            </button>
          </div>
        </form>
      </div>

      ${searchState.error || searchState.statusMessage
        ? `<p class="search-status" role="status">${escapeHtml(searchState.error || searchState.statusMessage)}</p>`
        : ""}

      <section class="search-results" aria-labelledby="search-results-title">
        <h3 id="search-results-title">検索結果</h3>
        ${searchState.lastResults.length > 0 ? `<p class="search-summary">${escapeHtml(searchState.statusMessage)}</p>` : ""}
        ${renderResultsTable()}
      </section>
    </section>
  `;

  document.getElementById("search-form").addEventListener("submit", handleSearchSubmit);
  document.getElementById("search-reset-button").addEventListener("click", resetSearch);
}

render();
renderSearch();
initializeTabs();
