"use strict";

(() => {
  const state = {
    author: "",
    category: "",
    currentSpotlightQuote: null,
    categories: [],
    totalQuotes: 100,
  };

  // DOM Elements
  const spotlightTextEl = document.getElementById("spotlight-text");
  const spotlightAuthorEl = document.getElementById("spotlight-author");
  const spotlightCategoriesEl = document.getElementById("spotlight-categories");
  const spotlightPoolBadgeEl = document.getElementById("spotlight-pool-badge");
  const newRandomBtn = document.getElementById("new-random-btn");
  const copyQuoteBtn = document.getElementById("copy-quote-btn");

  const authorSearchInput = document.getElementById("author-search-input");
  const authorsDatalist = document.getElementById("authors-datalist");
  const categoryPillsContainer = document.getElementById("category-pills");
  const clearFiltersBtn = document.getElementById("clear-filters-btn");

  const resultsSummaryEl = document.getElementById("results-summary");
  const quotesGridEl = document.getElementById("quotes-grid");
  const emptyStateEl = document.getElementById("empty-state");
  const emptyResetBtn = document.getElementById("empty-reset-btn");

  let debounceTimer = null;

  /**
   * Build URLSearchParams for the active filters.
   */
  function buildFilterParams(extraParams = {}) {
    const params = new URLSearchParams();
    if (state.author.trim()) {
      params.set("author", state.author.trim());
    }
    if (state.category.trim()) {
      params.set("category", state.category.trim());
    }
    for (const [key, value] of Object.entries(extraParams)) {
      if (value !== undefined && value !== null && value !== "") {
        params.set(key, String(value));
      }
    }
    return params;
  }

  /**
   * Render category chips inside a container.
   */
  function renderCategoryChips(container, categories) {
    container.replaceChildren();
    categories.forEach((cat) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "tag-chip";
      chip.textContent = cat;
      chip.title = `Filter by category: ${cat}`;
      chip.addEventListener("click", () => {
        setCategoryFilter(cat);
      });
      container.appendChild(chip);
    });
  }

  /**
   * Render the spotlight card with a single quote.
   */
  function renderSpotlight(quote, totalMatching) {
    state.currentSpotlightQuote = quote;

    if (!quote) {
      spotlightTextEl.textContent =
        "No quotes match the current filter to pick a random quote from.";
      spotlightAuthorEl.textContent = "";
      spotlightCategoriesEl.replaceChildren();
      spotlightPoolBadgeEl.textContent = "0 matching quotes";
      newRandomBtn.disabled = true;
      copyQuoteBtn.disabled = true;
      return;
    }

    newRandomBtn.disabled = false;
    copyQuoteBtn.disabled = false;

    spotlightTextEl.textContent = quote.text;
    spotlightAuthorEl.textContent = `— ${quote.author}`;
    spotlightAuthorEl.title = `Search quotes by ${quote.author}`;
    renderCategoryChips(spotlightCategoriesEl, quote.categories);

    const hasActiveFilter = Boolean(state.author.trim() || state.category.trim());
    if (hasActiveFilter) {
      spotlightPoolBadgeEl.textContent = `Drawing from ${totalMatching} filtered quote${totalMatching === 1 ? "" : "s"}`;
    } else {
      spotlightPoolBadgeEl.textContent = `Drawing from all ${state.totalQuotes} quotes`;
    }
  }

  /**
   * Fetch and display a random quote from the backend.
   */
  async function fetchRandomQuote() {
    const excludeId = state.currentSpotlightQuote
      ? state.currentSpotlightQuote.id
      : null;
    const params = buildFilterParams({ exclude_id: excludeId });

    try {
      const response = await fetch(`/api/quotes/random?${params.toString()}`);
      if (response.status === 404) {
        renderSpotlight(null, 0);
        return;
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      renderSpotlight(data.quote, data.total_matching);
    } catch (error) {
      console.error("Failed to fetch random quote:", error);
    }
  }

  /**
   * Render the category filter bar pills.
   */
  function renderCategoryPills() {
    categoryPillsContainer.replaceChildren();

    const allPill = document.createElement("button");
    allPill.type = "button";
    allPill.className = "category-pill";
    allPill.setAttribute("aria-pressed", state.category === "" ? "true" : "false");
    allPill.textContent = "All Categories ";

    const allCount = document.createElement("span");
    allCount.className = "pill-count";
    allCount.textContent = `(${state.totalQuotes})`;
    allPill.appendChild(allCount);
    allPill.addEventListener("click", () => setCategoryFilter(""));
    categoryPillsContainer.appendChild(allPill);

    state.categories.forEach(({ name, count }) => {
      const pill = document.createElement("button");
      pill.type = "button";
      pill.className = "category-pill";
      const isSelected = state.category.toLowerCase() === name.toLowerCase();
      pill.setAttribute("aria-pressed", isSelected ? "true" : "false");
      pill.textContent = `${name} `;

      const countSpan = document.createElement("span");
      countSpan.className = "pill-count";
      countSpan.textContent = `(${count})`;
      pill.appendChild(countSpan);

      pill.addEventListener("click", () => {
        setCategoryFilter(isSelected ? "" : name);
      });
      categoryPillsContainer.appendChild(pill);
    });
  }

  /**
   * Render the matching quotes grid.
   */
  function renderQuotesGrid(quotes) {
    quotesGridEl.replaceChildren();

    const hasFilters = Boolean(state.author.trim() || state.category.trim());
    clearFiltersBtn.hidden = !hasFilters;

    const filterDescriptions = [];
    if (state.author.trim()) {
      filterDescriptions.push(`author matching "${state.author.trim()}"`);
    }
    if (state.category.trim()) {
      filterDescriptions.push(`category "${state.category.trim()}"`);
    }

    if (filterDescriptions.length > 0) {
      resultsSummaryEl.textContent = `Showing ${quotes.length} of ${state.totalQuotes} quotes (${filterDescriptions.join(" and ")})`;
    } else {
      resultsSummaryEl.textContent = `Showing all ${quotes.length} quotes`;
    }

    if (quotes.length === 0) {
      emptyStateEl.hidden = false;
      return;
    }

    emptyStateEl.hidden = true;

    const fragment = document.createDocumentFragment();
    quotes.forEach((quote) => {
      const card = document.createElement("article");
      card.className = "quote-card";

      const textP = document.createElement("p");
      textP.className = "quote-card-text";
      textP.textContent = `“${quote.text}”`;

      const footer = document.createElement("div");
      footer.className = "quote-card-footer";

      const authorBtn = document.createElement("button");
      authorBtn.type = "button";
      authorBtn.className = "quote-card-author-btn";
      authorBtn.textContent = `— ${quote.author}`;
      authorBtn.title = `Filter by author: ${quote.author}`;
      authorBtn.addEventListener("click", () => {
        setAuthorFilter(quote.author);
      });

      const tagsDiv = document.createElement("div");
      tagsDiv.className = "tag-list";
      renderCategoryChips(tagsDiv, quote.categories);

      footer.appendChild(authorBtn);
      footer.appendChild(tagsDiv);

      card.appendChild(textP);
      card.appendChild(footer);
      fragment.appendChild(card);
    });

    quotesGridEl.appendChild(fragment);
  }

  /**
   * Fetch filtered quotes and update both the grid and the spotlight if needed.
   */
  async function applyFilters({ refreshSpotlight = true } = {}) {
    renderCategoryPills();
    const params = buildFilterParams();

    try {
      const response = await fetch(`/api/quotes?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      renderQuotesGrid(data.quotes);

      if (refreshSpotlight) {
        await fetchRandomQuote();
      }
    } catch (error) {
      console.error("Failed to fetch quotes:", error);
    }
  }

  function setCategoryFilter(categoryName) {
    state.category = categoryName;
    applyFilters({ refreshSpotlight: true });
  }

  function setAuthorFilter(authorName) {
    state.author = authorName;
    authorSearchInput.value = authorName;
    applyFilters({ refreshSpotlight: true });
  }

  function resetAllFilters() {
    state.author = "";
    state.category = "";
    authorSearchInput.value = "";
    applyFilters({ refreshSpotlight: true });
  }

  /**
   * Load initial metadata (authors & categories) and initial quotes.
   */
  async function init() {
    try {
      const metaRes = await fetch("/api/metadata");
      if (metaRes.ok) {
        const meta = await metaRes.json();
        state.categories = meta.categories || [];
        state.totalQuotes = meta.total_quotes || 100;

        authorsDatalist.replaceChildren();
        (meta.authors || []).forEach((author) => {
          const option = document.createElement("option");
          option.value = author;
          authorsDatalist.appendChild(option);
        });
      }
    } catch (error) {
      console.error("Failed to load metadata:", error);
    }

    await applyFilters({ refreshSpotlight: true });
  }

  // Event Listeners
  newRandomBtn.addEventListener("click", () => {
    fetchRandomQuote();
  });

  copyQuoteBtn.addEventListener("click", async () => {
    if (!state.currentSpotlightQuote) return;
    const formatted = `"${state.currentSpotlightQuote.text}" — ${state.currentSpotlightQuote.author}`;
    try {
      await navigator.clipboard.writeText(formatted);
      const originalLabel = copyQuoteBtn.textContent;
      copyQuoteBtn.textContent = "Copied!";
      setTimeout(() => {
        copyQuoteBtn.textContent = originalLabel;
      }, 1500);
    } catch {
      // Fallback if clipboard permission is unavailable
      copyQuoteBtn.textContent = "Copy unavailable";
    }
  });

  spotlightAuthorEl.addEventListener("click", () => {
    if (state.currentSpotlightQuote) {
      setAuthorFilter(state.currentSpotlightQuote.author);
    }
  });

  authorSearchInput.addEventListener("input", (event) => {
    const value = event.target.value;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      state.author = value;
      applyFilters({ refreshSpotlight: true });
    }, 180);
  });

  clearFiltersBtn.addEventListener("click", resetAllFilters);
  emptyResetBtn.addEventListener("click", resetAllFilters);

  init();
})();
