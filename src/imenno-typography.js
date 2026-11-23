(() => {
  const nbsp = "\u00a0";
  const copySelector = "h1, h2, h3, p, figcaption, dt, dd, legend, label, button, summary, a, .quiz-progress li, .process-tag";
  const forwardWords = /(?<![\p{L}\p{N}‑-])(?:а|без|в|вдоль|вместо|вне|внутри|во|вокруг|да|для|до|если|за|и|из|из-за|из-под|изо|или|к|как|ко|кроме|либо|между|на|над|не|ни|но|о|об|обо|около|от|ото|перед|по|под|после|при|про|против|ради|с|со|среди|у|через|что|чтобы) (?=[\p{L}\p{N}«„“"(])/giu;
  const trailingParticles = /(?<=[\p{L}\p{N}»”]) (?=(?:б|бы|ж|же|ли|ль)(?![\p{L}\p{N}‑-]))/giu;
  const numericSpaces = /(?<=\d) (?=\d{3}(?!\d)|[₽%]|(?:кг|г|л|мл|мм|см|м|мин|ч)(?!\p{L}))/giu;
  const punctuationSpaces = /(?<=\S) (?=—(?:\s|$))/gu;

  function withNonbreakingSpaces(text) {
    return text
      .replace(forwardWords, match => match.slice(0, -1) + nbsp)
      .replace(trailingParticles, nbsp)
      .replace(numericSpaces, nbsp)
      .replace(punctuationSpaces, nbsp);
  }

  function typeset(element) {
    if (element.closest(".sr-only")) return;
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    const original = nodes.map(node => node.data).join("");
    const formatted = withNonbreakingSpaces(original);
    if (formatted === original) return;

    // Each replacement preserves length, so inline elements keep their boundaries.
    let offset = 0;
    for (const node of nodes) {
      const next = offset + node.length;
      const value = formatted.slice(offset, next);
      if (node.data !== value) node.data = value;
      offset = next;
    }
  }

  document.querySelectorAll(copySelector).forEach(typeset);

  const observer = new MutationObserver(records => {
    const changed = new Set();
    for (const record of records) {
      const element = record.target.nodeType === Node.TEXT_NODE ? record.target.parentElement : record.target;
      const copy = element?.closest(copySelector);
      if (copy) changed.add(copy);

      for (const node of record.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (node.matches(copySelector)) changed.add(node);
        node.querySelectorAll(copySelector).forEach(item => changed.add(item));
      }
    }
    changed.forEach(typeset);
  });

  // These regions are rewritten by the gift, quiz and notification form.
  document.querySelectorAll(".gift-note, .why-dialog, .quiz-questions, .quiz-result-copy, .launch-form").forEach(element => {
    observer.observe(element, { childList: true, characterData: true, subtree: true });
  });
})();
