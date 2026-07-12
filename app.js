/* Ney — reader logic. Vanilla JS, no dependencies. */
(function () {
  "use strict";

  const el = {
    hero: document.getElementById("hero"),
    contents: document.getElementById("contents"),
    reader: document.getElementById("reader"),
    toc: document.getElementById("toc"),
    body: document.getElementById("readerBody"),
    search: document.getElementById("tocSearch"),
    progress: document.getElementById("progress"),
    spineFill: document.getElementById("spineFill"),
    spineHoles: null,
    statChapters: document.getElementById("stat-chapters"),
    statWords: document.getElementById("stat-words"),
  };

  let BOOK = null;

  const fmt = (n) => n.toLocaleString("en-US");
  const romanish = (n) => String(n).padStart(2, "0");

  // -- Views ---------------------------------------------------------------
  function show(view) {
    [el.hero, el.contents, el.reader].forEach((v) => v.classList.add("is-hidden"));
    view.classList.remove("is-hidden");
  }

  function route() {
    const hash = location.hash || "#hero";
    if (hash === "#hero" || hash === "") {
      show(el.hero);
    } else if (hash === "#contents") {
      show(el.contents);
      window.scrollTo(0, 0);
    } else if (hash.startsWith("#read/")) {
      const id = parseInt(hash.slice(6), 10);
      openChapter(id);
    } else {
      show(el.hero);
    }
  }

  // -- Contents ------------------------------------------------------------
  function buildTOC() {
    const frag = document.createDocumentFragment();
    let folio = 1;
    BOOK.chapters.forEach((ch, i) => {
      const a = document.createElement("a");
      a.href = "#read/" + ch.id;
      a.className = "toc__item";
      a.dataset.text = (ch.title + " " + (ch.subtitle || "")).toLowerCase();
      a.innerHTML =
        '<span class="toc__num">' + romanish(i + 1) + "</span>" +
        '<span class="toc__body"><span class="toc__title">' + escapeHTML(ch.title) + "</span>" +
        (ch.subtitle ? '<span class="toc__sub">' + escapeHTML(ch.subtitle) + "</span>" : "") +
        "</span>" +
        '<span class="toc__folio">p. ' + folio + "</span>";
      frag.appendChild(a);
      folio += Math.max(1, Math.round(ch.words / 320));
    });
    el.toc.appendChild(frag);
  }

  function filterTOC(q) {
    q = q.trim().toLowerCase();
    el.toc.querySelectorAll(".toc__item").forEach((item) => {
      const match = !q || item.dataset.text.indexOf(q) !== -1;
      item.classList.toggle("is-hidden", !match);
    });
  }

  // -- Reader --------------------------------------------------------------
  function openChapter(id) {
    const ch = BOOK.chapters.find((c) => c.id === id);
    if (!ch) { show(el.contents); return; }

    const idx = BOOK.chapters.indexOf(ch);
    const prev = BOOK.chapters[idx - 1];
    const next = BOOK.chapters[idx + 1];

    let html = "";
    html += '<div class="chapter__eyebrow">Chapter ' + (idx + 1) +
            " of " + BOOK.chapters.length + "</div>";
    html += '<h1 class="chapter__title">' + escapeHTML(ch.title) + "</h1>";
    if (ch.subtitle) html += '<p class="chapter__sub">' + escapeHTML(ch.subtitle) + "</p>";

    ch.sections.forEach((sec) => {
      html += '<section class="section">';
      if (sec.heading) html += '<h2 class="section__head">' + escapeHTML(sec.heading) + "</h2>";
      sec.paras.forEach((p) => { html += "<p>" + escapeHTML(p) + "</p>"; });
      html += "</section>";
    });

    // nav
    html += '<nav class="chapter__nav">';
    if (prev) {
      html += '<a class="prev" href="#read/' + prev.id + '"><span class="dir">← Previous</span>' +
              '<span class="name">' + escapeHTML(prev.title) + "</span></a>";
    } else {
      html += '<a class="prev is-empty"></a>';
    }
    if (next) {
      html += '<a class="next" href="#read/' + next.id + '"><span class="dir">Next →</span>' +
              '<span class="name">' + escapeHTML(next.title) + "</span></a>";
    } else {
      html += '<a class="next" href="#contents"><span class="dir">End →</span>' +
              '<span class="name">Back to contents</span></a>';
    }
    html += "</nav>";

    el.body.innerHTML = html;
    el.spineHoles = el.reader.querySelectorAll(".spine__hole");
    show(el.reader);
    window.scrollTo(0, 0);
    updateProgress();
  }

  function updateProgress() {
    if (el.reader.classList.contains("is-hidden")) return;
    const doc = document.documentElement;
    const scrollable = doc.scrollHeight - doc.clientHeight;
    const pct = scrollable > 0 ? Math.min(1, doc.scrollTop / scrollable) : 0;
    el.progress.style.width = (pct * 100) + "%";
    if (el.spineFill) el.spineFill.style.height = (pct * 100) + "%";
    if (el.spineHoles) {
      const holes = [0.15, 0.35, 0.55, 0.75, 0.95];
      el.spineHoles.forEach((h, i) => h.classList.toggle("lit", pct >= holes[i]));
    }
  }

  // -- utils ---------------------------------------------------------------
  function escapeHTML(s) {
    return String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // -- init ----------------------------------------------------------------
  fetch("data/book.json")
    .then((r) => r.json())
    .then((data) => {
      BOOK = data;
      if (el.statChapters) el.statChapters.textContent = BOOK.chapters.length;
      if (el.statWords) {
        const words = BOOK.chapters.reduce((s, c) => s + c.words, 0);
        el.statWords.textContent = fmt(Math.round(words / 1000) * 1000);
      }
      buildTOC();
      route();
    })
    .catch((err) => {
      el.hero.insertAdjacentHTML("beforeend",
        '<p style="color:#a63d2e;font-family:monospace">Could not load the book (' +
        escapeHTML(err.message) + "). Serve this folder over http, not file://.</p>");
    });

  window.addEventListener("hashchange", route);
  window.addEventListener("scroll", updateProgress, { passive: true });
  el.search.addEventListener("input", (e) => filterTOC(e.target.value));
})();
