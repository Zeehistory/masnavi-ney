/* The Masnavī, Book One — reader logic. Vanilla JS, no dependencies. */
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
    statChapters: document.getElementById("stat-chapters"),
    statWords: document.getElementById("stat-words"),
    crumb: document.getElementById("readerCrumb"),
    // drawer
    drawer: document.getElementById("drawer"),
    drawerScrim: document.getElementById("drawerScrim"),
    drawerList: document.getElementById("drawerList"),
    drawerSearch: document.getElementById("drawerSearch"),
    openDrawer: document.getElementById("openDrawer"),
    closeDrawer: document.getElementById("closeDrawer"),
  };

  let BOOK = null;
  let currentIdx = -1;   // index of chapter currently open in the reader

  const fmt = (n) => n.toLocaleString("en-US");
  const pad2 = (n) => String(n).padStart(2, "0");

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
    BOOK.chapters.forEach((ch, i) => {
      const a = document.createElement("a");
      a.href = "#read/" + ch.id;
      a.className = "toc__item";
      a.dataset.text = (ch.title + " " + (ch.subtitle || "")).toLowerCase();
      a.innerHTML =
        '<span class="toc__num">' + pad2(i + 1) + "</span>" +
        '<span class="toc__body"><span class="toc__title">' + escapeHTML(ch.title) + "</span>" +
        (ch.subtitle ? '<span class="toc__sub">' + escapeHTML(ch.subtitle) + "</span>" : "") +
        "</span>" +
        '<span class="toc__folio">' + pad2(i + 1) + " / " + BOOK.chapters.length + "</span>";
      frag.appendChild(a);
    });
    el.toc.appendChild(frag);
  }

  function filterList(container, sel, q) {
    q = q.trim().toLowerCase();
    container.querySelectorAll(sel).forEach((item) => {
      const match = !q || item.dataset.text.indexOf(q) !== -1;
      item.classList.toggle("is-hidden", !match);
    });
  }

  // -- Drawer (persistent navigator) --------------------------------------
  function buildDrawer() {
    const frag = document.createDocumentFragment();
    BOOK.chapters.forEach((ch, i) => {
      const a = document.createElement("a");
      a.href = "#read/" + ch.id;
      a.className = "drawer__row";
      a.dataset.idx = i;
      a.dataset.text = (ch.title + " " + (ch.subtitle || "")).toLowerCase();
      a.innerHTML =
        '<span class="drawer__rnum">' + pad2(i + 1) + "</span>" +
        '<span class="drawer__rtitle">' + escapeHTML(ch.title) + "</span>";
      a.addEventListener("click", closeDrawer);
      frag.appendChild(a);
    });
    el.drawerList.appendChild(frag);
  }

  function markCurrentInDrawer() {
    el.drawerList.querySelectorAll(".drawer__row").forEach((row) => {
      row.classList.toggle("is-current", Number(row.dataset.idx) === currentIdx);
    });
  }

  function openDrawer() {
    el.drawer.classList.add("is-open");
    el.drawer.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    markCurrentInDrawer();
    const cur = el.drawerList.querySelector(".is-current");
    if (cur) cur.scrollIntoView({ block: "center" });
    setTimeout(() => el.drawerSearch.focus(), 60);
  }
  function closeDrawer() {
    el.drawer.classList.remove("is-open");
    el.drawer.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  // -- Reader --------------------------------------------------------------
  function openChapter(id) {
    const ch = BOOK.chapters.find((c) => c.id === id);
    if (!ch) { location.hash = "#contents"; return; }

    const idx = BOOK.chapters.indexOf(ch);
    currentIdx = idx;
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
    if (el.crumb) el.crumb.textContent = ch.title;
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
  }

  // -- Keyboard: ← / → chapters, Esc closes drawer -------------------------
  function onKey(e) {
    if (e.key === "Escape" && el.drawer.classList.contains("is-open")) {
      closeDrawer(); return;
    }
    // don't hijack arrows while typing in a field
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea") return;
    if (el.reader.classList.contains("is-hidden")) return;
    if (e.key === "ArrowRight" && currentIdx < BOOK.chapters.length - 1) {
      location.hash = "#read/" + BOOK.chapters[currentIdx + 1].id;
    } else if (e.key === "ArrowLeft" && currentIdx > 0) {
      location.hash = "#read/" + BOOK.chapters[currentIdx - 1].id;
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
      buildDrawer();
      route();
    })
    .catch((err) => {
      el.hero.insertAdjacentHTML("beforeend",
        '<p style="color:#f2cf6b;font-family:monospace">Could not load the book (' +
        escapeHTML(err.message) + "). Serve this folder over http, not file://.</p>");
    });

  window.addEventListener("hashchange", route);
  window.addEventListener("scroll", updateProgress, { passive: true });
  window.addEventListener("keydown", onKey);
  el.search.addEventListener("input", (e) => filterList(el.toc, ".toc__item", e.target.value));
  el.drawerSearch.addEventListener("input", (e) => filterList(el.drawerList, ".drawer__row", e.target.value));
  el.openDrawer.addEventListener("click", openDrawer);
  el.closeDrawer.addEventListener("click", closeDrawer);
  el.drawerScrim.addEventListener("click", closeDrawer);
})();
