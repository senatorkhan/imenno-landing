(() => {
  "use strict";

  const root = document.querySelector("#demo");
  const demo = window.imennoQuizDemo;
  if (!root || !demo) return;

  const find = id => root.querySelector("#" + id);
  const scenarioButtons = Array.from(root.querySelectorAll("[data-quiz-scenario]"));
  const panels = Array.from(root.querySelectorAll("[data-quiz-step]"));
  const progress = Array.from(find("quiz-progress").querySelectorAll("[data-progress-step]"));
  const questions = find("quiz-questions");
  const clues = find("quiz-clues");
  const history = find("quiz-history");
  const baseline = find("quiz-baseline");
  const back = find("quiz-back");
  const next = find("quiz-next");
  const result = find("quiz-result");
  const resultContent = find("quiz-result-content");
  const resultDetails = find("quiz-result-details");
  const match = find("quiz-match");
  const empty = find("quiz-empty");
  const edit = find("quiz-edit");
  const replace = find("quiz-replace");
  const status = find("quiz-status");
  const photo = find("quiz-photo");
  const resultTitle = find("quiz-result-title");
  const emptyTitle = find("quiz-empty-title");
  const resultPrice = find("quiz-result-price");
  const fit = find("quiz-fit");
  const occasionReason = find("quiz-occasion-reason");
  const budgetReason = find("quiz-budget-reason");
  const excludedRow = find("quiz-excluded-row");
  const excluded = find("quiz-excluded");
  const check = find("quiz-check");
  const imageScript = find("quiz-image-data") || document.getElementById("quiz-image-data");
  const images = JSON.parse(imageScript?.textContent || "{}");
  const money = new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  const list = new Intl.ListFormat("ru-RU", { style: "long", type: "conjunction" });
  const nextLabel = next.textContent.trim() || "Дальше";
  const chosenScenario = scenarioButtons.find(button => button.getAttribute("aria-pressed") === "true");
  const lastStep = panels.length - 1;
  const states = Object.fromEntries(Object.keys(demo.scenarios).map(key => [
    key,
    { step: 0, clue: "", occasion: "", budget: 0, excluded: new Set() },
  ]));

  let scenarioKey = chosenScenario?.dataset.quizScenario || scenarioButtons[0].dataset.quizScenario;
  let activeGift;

  function getState() {
    return states[scenarioKey];
  }

  function getScenario() {
    return demo.scenarios[scenarioKey];
  }

  function makeOption(name, value, label, type) {
    const option = document.createElement("label");
    const input = document.createElement("input");
    const text = document.createElement("span");
    option.className = "quiz-option";
    input.name = name;
    input.value = value;
    input.type = type;
    text.textContent = label;
    option.append(input, text);
    return option;
  }

  function renderChoices() {
    const scenario = getScenario();
    clues.replaceChildren(...scenario.clues.map(({ id, label }) =>
      makeOption("quiz-clue", id, label, "radio")
    ));
    history.replaceChildren(...scenario.gifts.map(({ id, historyLabel }) =>
      makeOption("quiz-history", id, historyLabel, "checkbox")
    ));
    baseline.textContent = scenario.baselineHistory || "";
    baseline.hidden = !scenario.baselineHistory;
  }

  function syncAnswers() {
    const state = getState();
    for (const input of questions.querySelectorAll('input[type="radio"], input[type="checkbox"]')) {
      switch (input.name) {
        case "quiz-clue":
          input.checked = input.value === state.clue;
          break;
        case "quiz-occasion":
          input.checked = input.value === state.occasion;
          break;
        case "quiz-budget":
          input.checked = Number(input.value) === state.budget;
          break;
        case "quiz-history":
          input.checked = state.excluded.has(input.value);
          break;
      }
    }
  }

  function currentStepHasAnswer(state) {
    if (state.step === 0) return Boolean(state.clue);
    if (state.step === 1) return Boolean(state.occasion && state.budget);
    return true;
  }

  function updateControls() {
    const state = getState();
    back.hidden = state.step === 0;
    next.disabled = !currentStepHasAnswer(state);
    next.textContent = state.step === lastStep ? "Показать подарок" : nextLabel;
  }

  function updateProgress() {
    const { step } = getState();
    for (const item of progress) {
      const index = Number(item.dataset.progressStep);
      const current = index === step;
      item.dataset.state = index < step ? "complete" : current ? "current" : "upcoming";
      if (current) item.setAttribute("aria-current", "step");
      else item.removeAttribute("aria-current");
    }
  }

  function renderQuestion({ moveFocus = false } = {}) {
    const { step } = getState();
    for (const panel of panels) {
      const inactive = Number(panel.dataset.quizStep) !== step;
      panel.hidden = inactive;
      panel.inert = inactive;
    }
    syncAnswers();
    updateControls();
    updateProgress();
    if (moveFocus) {
      const panel = panels.find(question => Number(question.dataset.quizStep) === step);
      panel?.querySelector("[data-quiz-heading]")?.focus({ preventScroll: true });
    }
  }

  function writeExcluded(scenario, state) {
    const notes = [];
    if (scenario.baselineHistory) notes.push(scenario.baselineHistory);
    const titles = scenario.gifts
      .filter(gift => state.excluded.has(gift.id))
      .map(gift => "«" + gift.historyLabel + "»");
    if (titles.length) notes.push("Из подбора убрали " + list.format(titles) + ".");
    excluded.textContent = notes.join(" ");
    excludedRow.hidden = notes.length === 0;
  }

  function renderResult() {
    const state = getState();
    const scenario = getScenario();
    const answers = {
      clue: state.clue,
      occasion: state.occasion,
      budget: state.budget,
      excluded: Array.from(state.excluded),
    };
    activeGift = demo.rank(scenarioKey, answers)[0];
    match.hidden = !activeGift;
    empty.hidden = Boolean(activeGift);
    replace.hidden = !activeGift;
    if (!activeGift) return;

    const image = images[activeGift.photo];
    photo.hidden = !image;
    if (image) photo.src = image;
    else photo.removeAttribute("src");
    photo.alt = activeGift.alt;
    resultTitle.textContent = activeGift.title;
    resultPrice.textContent = money.format(activeGift.price);
    fit.textContent = activeGift.fit[state.clue].text;
    occasionReason.textContent = activeGift.occasions[state.occasion].text;
    const preferred = demo.rank(scenarioKey, {
      ...answers,
      budget: Math.max(...scenario.gifts.map(gift => gift.price)),
    })[0];
    const tradeoff = preferred?.price > state.budget
      ? " «" + preferred.title + "» выходит за этот лимит."
      : "";
    budgetReason.textContent = "Укладывается в лимит до " + money.format(state.budget) + "." + tradeoff;
    writeExcluded(scenario, state);
    check.textContent = activeGift.check;
  }

  function focusResult() {
    resultContent.scrollTop = 0;
    const heading = activeGift ? resultTitle : emptyTitle;
    heading.focus({ preventScroll: true });
  }

  function openResult() {
    renderResult();
    resultDetails.open = false;
    result.returnValue = "";
    result.showModal();
    focusResult();
    if (activeGift) {
      result.dispatchEvent(new CustomEvent("imenno:quiz-celebrate", { bubbles: true }));
    }
  }

  function changeScenario(button) {
    const key = button.dataset.quizScenario;
    if (result.open || scenarioKey === key || !states[key]) return;
    scenarioKey = key;
    for (const choice of scenarioButtons) choice.setAttribute("aria-pressed", String(choice === button));
    renderChoices();
    renderQuestion();
    const position = "Вопрос " + (getState().step + 1) + " из " + panels.length + ".";
    status.textContent = button.textContent.trim() + ". " + position;
  }

  function advance() {
    const state = getState();
    if (result.open || !currentStepHasAnswer(state)) return;
    if (state.step === lastStep) {
      openResult();
      return;
    }
    state.step += 1;
    renderQuestion({ moveFocus: true });
  }

  questions.addEventListener("change", event => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    const state = getState();
    switch (input.name) {
      case "quiz-clue":
        state.clue = input.value;
        break;
      case "quiz-occasion":
        state.occasion = input.value;
        break;
      case "quiz-budget":
        state.budget = Number(input.value);
        break;
      case "quiz-history":
        if (input.checked) state.excluded.add(input.value);
        else state.excluded.delete(input.value);
        break;
      default:
        return;
    }
    updateControls();
  });

  for (const button of scenarioButtons) button.addEventListener("click", () => changeScenario(button));
  next.addEventListener("click", event => {
    event.preventDefault();
    advance();
  });
  back.addEventListener("click", event => {
    event.preventDefault();
    const state = getState();
    if (result.open || state.step === 0) return;
    state.step -= 1;
    renderQuestion({ moveFocus: true });
  });
  edit.addEventListener("click", event => {
    event.preventDefault();
    if (result.open) result.close("edit");
  });
  replace.addEventListener("click", event => {
    event.preventDefault();
    if (!result.open || !activeGift) return;
    getState().excluded.add(activeGift.id);
    syncAnswers();
    renderResult();
    focusResult();
  });
  result.addEventListener("close", () => {
    result.dispatchEvent(new CustomEvent("imenno:quiz-clear", { bubbles: true }));
    if (result.returnValue === "edit") {
      getState().step = 0;
      renderQuestion({ moveFocus: true });
    } else {
      next.focus({ preventScroll: true });
    }
  });

  resultTitle.tabIndex = -1;
  emptyTitle.tabIndex = -1;
  renderChoices();
  renderQuestion();
})();
