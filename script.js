const questions = {
  q1: {
    id: "q1",
    step: 1,
    text: "これまでにIT導入補助金の交付決定を受けたことがありますか？",
    yes: { type: "question", next: "q2" },
    no: { type: "result", next: "E" },
  },
  q2: {
    id: "q2",
    step: 2,
    text: "2022〜2025年に「インボイス枠」または「デジタル化基盤導入枠」で交付決定を受けましたか？",
    yes: { type: "question", next: "q3" },
    no: { type: "question", next: "q4" },
  },
  q3: {
    id: "q3",
    step: 3,
    text: "2025年に通常枠で交付決定を受けましたか？",
    yes: { type: "result", next: "A" },
    no: { type: "result", next: "B" },
  },
  q4: {
    id: "q4",
    step: 4,
    text: "2025年に通常枠で交付決定を受けましたか？",
    yes: { type: "result", next: "C" },
    no: { type: "result", next: "D" },
  },
};

const results = {
  A: {
    title: "判定結果 A",
    summary: "直近の交付決定状況により、通常枠は待機期間後、インボイス枠は2026年申請不可です。",
    normal: { symbol: "△", label: "通常枠", detail: "12カ月待機後申請可", tone: "wait" },
    invoice: { symbol: "×", label: "インボイス枠", detail: "2026申請不可", tone: "ng" },
  },
  B: {
    title: "判定結果 B",
    summary: "通常枠・インボイス枠ともに2026年の申請対象です。",
    normal: { symbol: "○", label: "通常枠", detail: "2026申請可", tone: "ok" },
    invoice: { symbol: "○", label: "インボイス枠", detail: "2026申請可", tone: "ok" },
  },
  C: {
    title: "判定結果 C",
    summary: "直近の交付決定状況により、通常枠は待機期間後、インボイス枠は2026年申請不可です。",
    normal: { symbol: "△", label: "通常枠", detail: "12カ月待機後申請可", tone: "wait" },
    invoice: { symbol: "×", label: "インボイス枠", detail: "2026申請不可", tone: "ng" },
  },
  D: {
    title: "判定結果 D",
    summary: "通常枠・インボイス枠ともに2026年の申請対象です。",
    normal: { symbol: "○", label: "通常枠", detail: "2026申請可", tone: "ok" },
    invoice: { symbol: "○", label: "インボイス枠", detail: "2026申請可", tone: "ok" },
  },
  E: {
    title: "判定結果 E",
    summary: "初回申請想定のため、通常枠・インボイス枠ともに2026年の申請対象です。",
    normal: { symbol: "○", label: "通常枠", detail: "2026申請可", tone: "ok" },
    invoice: { symbol: "○", label: "インボイス枠", detail: "2026申請可", tone: "ok" },
  },
};

const legendItems = [
  { symbol: "○", text: "2026申請可" },
  { symbol: "△", text: "12カ月待機後申請可" },
  { symbol: "×", text: "2026申請不可" },
];

const app = document.getElementById("app");
const searchApp = document.getElementById("search-app");
const checkTabButton = document.getElementById("tab-button-check");
const searchTabButton = document.getElementById("tab-button-search");
const checkTabPanel = document.getElementById("tab-panel-check");
const searchTabPanel = document.getElementById("tab-panel-search");
const SEARCH_RESULT_LIMIT = 100;
const SEARCH_DATA_JSON_PATH = "./search-data-2022-2025.json";

const state = {
  currentQuestionId: "q1",
  resultId: null,
  answers: [],
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

function resetState() {
  state.currentQuestionId = "q1";
  state.resultId = null;
  state.answers = [];
  render();
}

function getAnswerLabel(value) {
  return value ? "はい" : "いいえ";
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderProgress(step) {
  const total = 4;
  const ratio = Math.max(1, step) / total;

  return `
    <section class="progress" aria-label="進行状況">
      <div class="progress__meta">
        <strong>質問 ${step} / ${total}</strong>
        <span>回答に応じて次の質問または判定結果を表示します。</span>
      </div>
      <div class="progress__bar" aria-hidden="true">
        <div class="progress__fill" style="width: ${ratio * 100}%"></div>
      </div>
    </section>
  `;
}

function renderQuestion() {
  const question = questions[state.currentQuestionId];

  app.innerHTML = `
    ${renderProgress(question.step)}
    <section class="question-panel" aria-labelledby="question-title">
      <div>
        <p class="question-copy">質問に対して、現在の状況に近い回答を選択してください。</p>
        <h2 id="question-title">${escapeHtml(question.text)}</h2>
      </div>
      <div class="button-row">
        <button
          type="button"
          class="answer-button"
          data-answer="yes"
          aria-label="${escapeHtml(question.text)} はい"
        >
          はい
        </button>
        <button
          type="button"
          class="answer-button"
          data-answer="no"
          aria-label="${escapeHtml(question.text)} いいえ"
        >
          いいえ
        </button>
      </div>
    </section>
  `;

  app.querySelectorAll("[data-answer]").forEach((button) => {
    button.addEventListener("click", () => handleAnswer(button.dataset.answer === "yes"));
  });
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

function renderHistory() {
  return state.answers
    .map((entry) => {
      return `
        <li>
          <strong>Q${entry.step}.</strong>
          ${escapeHtml(entry.text)}<br />
          回答: ${escapeHtml(getAnswerLabel(entry.answer))}
        </li>
      `;
    })
    .join("");
}

function renderLegend() {
  return legendItems
    .map((item) => `<li><strong>${escapeHtml(item.symbol)}</strong>：${escapeHtml(item.text)}</li>`)
    .join("");
}

function renderResult() {
  const result = results[state.resultId];

  app.innerHTML = `
    <section class="result-panel" aria-labelledby="result-title">
      <div>
        <p class="result-copy">回答内容をもとにした簡易判定です。</p>
        <h2 id="result-title">${escapeHtml(result.title)}</h2>
        <p class="result-copy">${escapeHtml(result.summary)}</p>
      </div>

      <div class="result-grid">
        ${renderStatusCard(result.normal)}
        ${renderStatusCard(result.invoice)}
      </div>

      <section class="info-block" aria-labelledby="legend-title">
        <h3 id="legend-title">凡例</h3>
        <ul class="legend-list">
          ${renderLegend()}
        </ul>
      </section>

      <section class="info-block" aria-labelledby="history-title">
        <h3 id="history-title">回答履歴</h3>
        <ul class="history-list">
          ${renderHistory()}
        </ul>
      </section>

      <p class="note">本チェック結果は簡易判定です。実際の申請可否は公募要領・事務局の案内をご確認ください。</p>

      <div class="result-actions">
        <button type="button" class="reset-button" id="reset-button" aria-label="最初からやり直す">
          最初からやり直す
        </button>
      </div>
    </section>
  `;

  document.getElementById("reset-button").addEventListener("click", resetState);
}

function handleAnswer(answer) {
  const question = questions[state.currentQuestionId];
  const branch = answer ? question.yes : question.no;

  state.answers.push({
    id: question.id,
    step: question.step,
    text: question.text,
    answer,
  });

  if (branch.type === "result") {
    state.resultId = branch.next;
  } else {
    state.currentQuestionId = branch.next;
  }

  render();
}

function render() {
  if (state.resultId) {
    renderResult();
    return;
  }

  renderQuestion();
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
  const corporateNumber = columns[0] || "";
  const businessName = columns[1] || "";

  return {
    corporateNumber,
    businessName,
    fiscalYear: columns[2] || "",
    category: columns[3] || "",
    round: columns[4] || "",
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

    const payload = await response.json();
    const sourceRows = Array.isArray(payload?.rows) ? payload.rows : null;

    if (!sourceRows) {
      throw new Error("検索JSONの形式が不正です。");
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
    searchState.error = "2022〜2025年度の検索JSONを読み込めませんでした。GitHub Pages などHTTP配信環境で開いているか確認してください。";
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

  searchState.criteria.corporateNumber = document.getElementById("search-corporate-number").value;
  searchState.criteria.name = document.getElementById("search-business-name").value;

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
  searchState.statusMessage = searchState.loaded
    ? `${searchState.records.length.toLocaleString("ja-JP")}件の2022〜2025年度採択者一覧を検索できます。`
    : "";

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
      <p class="section-heading__lead">
        2018-2025採択者一覧.csv から 2022〜2025年度・必要項目のみを抽出したJSONを使い、
        法人番号または事業者名・個人事業主名・屋号で検索できます。
      </p>
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
