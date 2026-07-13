/* The Masnavī, Book One — reader logic. Vanilla JS, no dependencies. */
(function () {
  "use strict";

  const el = {
    hero: document.getElementById("hero"),      // the home/library view
    books: document.getElementById("books"),
    contents: document.getElementById("contents"),
    reader: document.getElementById("reader"),
    toc: document.getElementById("toc"),
    body: document.getElementById("readerBody"),
    search: document.getElementById("tocSearch"),
    progress: document.getElementById("progress"),
    statChapters: document.getElementById("stat-chapters"),
    crumb: document.getElementById("readerCrumb"),
    // drawer
    drawer: document.getElementById("drawer"),
    drawerScrim: document.getElementById("drawerScrim"),
    drawerList: document.getElementById("drawerList"),
    drawerSearch: document.getElementById("drawerSearch"),
    openDrawer: document.getElementById("openDrawer"),
    closeDrawer: document.getElementById("closeDrawer"),
    drawerHome: document.getElementById("drawerHome"),
    // Rumi modal
    rumiBtn: document.getElementById("rumiBtn"),
    rumiModal: document.getElementById("rumiModal"),
    rumiScrim: document.getElementById("rumiScrim"),
    rumiClose: document.getElementById("rumiClose"),
  };

  let BOOK = null;
  let currentIdx = -1;   // index of chapter currently open in the reader

  const fmt = (n) => n.toLocaleString("en-US");
  const pad2 = (n) => String(n).padStart(2, "0");

  // The six Books (daftars) of the Masnavī. Only Book One has text so far.
  const DAFTARS = [
    { n: 1, name: "Book One",   ar: "دفتر اول",  desc: "The reed's lament, the king and the maid, and the parables of the soul's return.", live: true },
    { n: 2, name: "Book Two",   ar: "دفتر دوم",  desc: "On companionship, sincerity, and the trials of the seeker.", live: false },
    { n: 3, name: "Book Three", ar: "دفتر سوم",  desc: "Knowledge, striving, and the wisdom hidden in hardship.", live: false },
    { n: 4, name: "Book Four",  ar: "دفتر چهارم", desc: "Love as the astrolabe of the mysteries of God.", live: false },
    { n: 5, name: "Book Five",  ar: "دفتر پنجم", desc: "Discipline of the self and the stations of the heart.", live: false },
    { n: 6, name: "Book Six",   ar: "دفتر ششم",  desc: "The final ascent — union, and the return of the reed to the reed-bed.", live: false },
  ];

  function buildBooks() {
    const frag = document.createDocumentFragment();
    DAFTARS.forEach((d) => {
      const li = document.createElement("li");
      li.className = "book " + (d.live ? "book--live" : "book--soon");
      const status = d.live
        ? '<span class="book__status">' + BOOK.chapters.length + " chapters →</span>"
        : '<span class="book__status">Coming soon</span>';
      li.innerHTML =
        '<span class="book__num">' + d.n + "</span>" +
        '<div class="book__meta">' +
          '<p class="book__name">' + d.name +
            '<span class="book__ar" lang="ar" dir="rtl">' + d.ar + "</span></p>" +
          '<p class="book__desc">' + escapeHTML(d.desc) + "</p>" +
        "</div>" + status;
      if (d.live) {
        li.tabIndex = 0;
        li.setAttribute("role", "link");
        const go = () => { location.hash = "#contents"; };
        li.addEventListener("click", go);
        li.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); }
        });
      }
      frag.appendChild(li);
    });
    el.books.appendChild(frag);
  }

  // -- Views ---------------------------------------------------------------
  function show(view) {
    [el.hero, el.contents, el.reader].forEach((v) => v.classList.add("is-hidden"));
    view.classList.remove("is-hidden");
  }

  function route() {
    const hash = location.hash || "#hero";
    // In-page anchors (footnotes) — scroll, don't route.
    if (/^#fn-\d+$/.test(hash) || /^#fnref-\d+$/.test(hash)) {
      const target = document.getElementById(hash.slice(1));
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        target.classList.add("is-flash");
        setTimeout(() => target.classList.remove("is-flash"), 1200);
      }
      return;
    }
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

  // -- Rumi modal ----------------------------------------------------------
  function openRumi() {
    el.rumiModal.classList.add("is-open");
    el.rumiModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    setTimeout(() => el.rumiClose.focus(), 60);
  }
  function closeRumi() {
    el.rumiModal.classList.remove("is-open");
    el.rumiModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (el.rumiBtn) el.rumiBtn.focus();
  }

  // -- Reader --------------------------------------------------------------
  function openChapter(id) {
    const ch = BOOK.chapters.find((c) => c.id === id);
    if (!ch) { location.hash = "#contents"; return; }

    const idx = BOOK.chapters.indexOf(ch);
    currentIdx = idx;
    const prev = BOOK.chapters[idx - 1];
    const next = BOOK.chapters[idx + 1];

    const notes = [];   // collected footnotes for this chapter

    let html = "";
    html += '<div class="chapter__eyebrow">Chapter ' + (idx + 1) +
            " of " + BOOK.chapters.length + "</div>";
    html += '<h1 class="chapter__title">' + escapeHTML(ch.title) + "</h1>";
    if (ch.subtitle) html += '<p class="chapter__sub">' + escapeHTML(ch.subtitle) + "</p>";

    ch.sections.forEach((sec) => {
      html += '<section class="section">';
      if (sec.heading) html += '<h2 class="section__head">' + escapeHTML(sec.heading) + "</h2>";
      sec.paras.forEach((p) => { html += renderParagraph(p, notes); });
      html += "</section>";
    });

    // Footnotes, gathered cleanly at the end of the chapter
    if (notes.length) {
      html += '<section class="notes"><h2 class="notes__head">Notes</h2><ol class="notes__list">';
      notes.forEach((n, i) => {
        html += '<li id="fn-' + (i + 1) + '" class="notes__item">' + n +
                ' <a class="notes__back" href="#fnref-' + (i + 1) + '" aria-label="Back to text">↩</a></li>';
      });
      html += "</ol></section>";
    }

    // Minimal prev / next
    html += '<nav class="chapter__nav">';
    html += prev
      ? '<a class="prev" href="#read/' + prev.id + '"><span class="dir">← Previous</span>' +
        '<span class="name">' + escapeHTML(prev.title) + "</span></a>"
      : '<span class="prev is-empty"></span>';
    html += next
      ? '<a class="next" href="#read/' + next.id + '"><span class="dir">Next →</span>' +
        '<span class="name">' + escapeHTML(next.title) + "</span></a>"
      : '<a class="next" href="#contents"><span class="dir">End →</span>' +
        '<span class="name">Back to contents</span></a>';
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
    if (e.key === "Escape" && el.rumiModal.classList.contains("is-open")) {
      closeRumi(); return;
    }
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

  // -- Text formatting: Qur'anic citations & footnotes --------------------

  // A parenthetical that names a sura or gives an N:N ayah reference.
  const CITATION = /\(([^()]*(?:S(?:u|ū)rah?|Qur[’']?an|Quran|[Aa]yat|\d+\s*[:;]\s*\d+)[^()]*)\)/g;
  // A bracketed translator's note (long enough to be a real note, not an aside).
  const FOOTNOTE = /\[([^\]]{16,})\]/g;

  const AR_PARTICLES = new Set(("wa al bil min an fa il ith inna inn maa mai un ala alaa " +
    "lil lit li zaati huwa hum ilaihi bisultaan bin fii ala ‘ala hal la laa illa wal alas " +
    "ith idh ilman ladunna").split(" "));
  // small connector words allowed to sit inside a transliterated run
  const AR_GLUE = new Set(["a", "an", "al", "il", "the", "of", "and", "min", "wa", "fa", "li"]);

  // Common English words that would otherwise trip the Arabic heuristics
  // (digraphs like "th", possessive "'s", doubled vowels in "cave"/"see").
  const EN_STOP = new Set(("the of and to in a an is was that this with for his her him " +
    "they them their god gods lord thee thou you your our we he she it as at by on or " +
    "not but from which who whom whose when then than there here").split(" "));

  // Score how "Arabic" a single word looks. Possessive 's and ordinary English
  // are explicitly excluded so English never scores.
  function arScore(w) {
    const raw = w.toLowerCase();
    // strip a trailing possessive so "God's" -> "god"
    const base = raw.replace(/[’‘']s$/, "");
    const wl = base.replace(/[’‘'\-]/g, "");
    if (EN_STOP.has(wl)) return 0;
    if (/^[A-Z]/.test(w) && !AR_PARTICLES.has(wl)) return 0;  // Capitalized English
    let s = 0;
    if (AR_PARTICLES.has(wl)) s += 2;
    // interior hamza only (not a trailing possessive, already stripped)
    if (/[a-z][’‘'][a-z]/i.test(base)) s += 2;
    if (/(aa|ii|uu)/.test(wl)) s += 2;          // doubled vowels — strong tell
    if (/(dh|kh|gh|zh)/.test(wl)) s += 1;       // Arabic digraphs (not plain "th")
    return s;
  }
  const isWordChar = (ch) => /[a-zā-ūA-Z’‘'\-]/.test(ch);

  // Sweep a paragraph and italicize every maximal run of transliterated words,
  // wherever it appears (after a quote, mid-sentence, before a citation…).
  function markTransliterations(escaped) {
    // tokenize into words and the gaps between them
    const tokens = [];
    let i = 0;
    while (i < escaped.length) {
      if (isWordChar(escaped[i])) {
        let j = i; while (j < escaped.length && isWordChar(escaped[j])) j++;
        tokens.push({ w: true, t: escaped.slice(i, j) });
        i = j;
      } else {
        let j = i; while (j < escaped.length && !isWordChar(escaped[j])) j++;
        tokens.push({ w: false, t: escaped.slice(i, j) });
        i = j;
      }
    }
    const words = tokens.filter((x) => x.w);
    // score each word
    words.forEach((x) => { x.sc = arScore(x.t); });
    // find runs
    let out = "";
    let run = [];      // indices into `words`
    const flush = () => {
      if (!run.length) return;
      // trim leading/trailing glue-only words from the run
      let a = 0, b = run.length - 1;
      const isGlue = (k) => AR_GLUE.has(words[k].t.toLowerCase()) && words[k].sc < 2;
      while (a <= b && isGlue(run[a])) a++;
      while (b >= a && isGlue(run[b])) b--;
      const core = run.slice(a, b + 1);
      let total = 0, strong = 0;
      core.forEach((k) => { total += words[k].sc; if (words[k].sc >= 2) strong++; });
      if (core.length >= 2 && strong >= 2 && total >= core.length + 2) {
        words[core[0]].openI = true;
        words[core[core.length - 1]].closeI = true;
      }
      run = [];
    };
    for (let k = 0; k < words.length; k++) {
      const glue = AR_GLUE.has(words[k].t.toLowerCase());
      if (words[k].sc >= 1 || (glue && run.length)) run.push(k);
      else flush();
    }
    flush();
    // rebuild, inserting <i> around marked runs
    let wi = -1;
    for (const tok of tokens) {
      if (!tok.w) { out += tok.t; continue; }
      wi++;
      const wd = words[wi];
      if (wd.openI) out += '<i class="translit">';
      out += tok.t;
      if (wd.closeI) out += "</i>";
    }
    return out;
  }

  // Format inline: footnotes, transliterations, then citations.
  function formatInline(text, notes) {
    let s = escapeHTML(text);

    // 1) Footnotes → superscript markers, text gathered into `notes`
    s = s.replace(FOOTNOTE, (_, body) => {
      notes.push(body.trim());
      const n = notes.length;
      return '<sup class="fnref" id="fnref-' + n + '">' +
             '<a href="#fn-' + n + '">' + n + "</a></sup>";
    });

    // 2) Arabic transliterations → italic, wherever they appear
    s = markTransliterations(s);

    // 3) Qur'anic references → one harmonized, clearly separated citation
    s = s.replace(CITATION, (m, body) => {
      if (body.length > 60 && !/\d+\s*[:;]\s*\d+/.test(body)) return m;
      const ref = normalizeRef(body);
      if (!ref) return m;
      return '<cite class="ref"><span class="ref__book">Qurʼān</span>' +
             '<span class="ref__loc">' + ref + "</span></cite>";
    });

    return s;
  }

  // Harmonize every citation to a single clean form: "Name chapter:verse".
  // Strips the inconsistent "Surah"/"Quran" prefixes, tidies spacing.
  function normalizeRef(raw) {
    let s = raw.trim();
    s = s.replace(/^\s*Qur[’']?an\s*[:\-]?\s*/i, "");
    s = s.replace(/\bS(?:u|ū)rah?\s*[:\-]?\s*/gi, "");
    s = s.replace(/;/g, ":");
    s = s.replace(/\s{2,}/g, " ").trim().replace(/^[:\-\s]+/, "");
    // Split into a name part and a numeric part.
    const m = s.match(/^([^\d]*?)[\s:\-]*(\d.*)$/);
    if (m) {
      const name = m[1].trim().replace(/[:\-\s]+$/, "");
      // numbers: tidy "ch : vs" -> "ch:vs", ", " between verses, " & "
      const nums = m[2].trim()
        .replace(/\s*:\s*/g, ":")
        .replace(/\s*,\s*/g, ", ")
        .replace(/\s*&\s*/g, " & ");
      return name ? name + " " + nums : nums;   // always a space after the name
    }
    return s.replace(/\s*:\s*/g, ":").replace(/,\s*/g, ", ");
  }

  // Decide whether a paragraph is essentially a standalone Qur'anic
  // quotation (→ blockquote). Kept strict so ordinary commentary that merely
  // cites a verse stays as prose.
  function renderParagraph(text, notes) {
    const html = formatInline(text, notes);
    const t = text.trim();
    // Must be a self-contained quote: opens with a quote mark, and the
    // closing quote sits near the end (right before its citation), and it
    // carries a Qur'anic reference, and it's longer than ~3 lines.
    const opensQuote = /^[“"]/.test(t);
    const closesLate = /[”"]\s*(?:\([^)]*\)|—[^—]*)?\s*[.。]?\s*$/.test(t);
    const hasRef = CITATION.test(t); CITATION.lastIndex = 0;
    const longEnough = t.length > 200;
    if (opensQuote && closesLate && hasRef && longEnough) {
      return '<blockquote class="ayah">' + html + "</blockquote>";
    }
    return "<p>" + html + "</p>";
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
      if (el.statChapters) el.statChapters.textContent = "· " + BOOK.chapters.length + " chapters";
      buildBooks();
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
  el.drawerHome.addEventListener("click", closeDrawer);
  el.rumiBtn.addEventListener("click", openRumi);
  el.rumiClose.addEventListener("click", closeRumi);
  el.rumiScrim.addEventListener("click", closeRumi);
})();
