/* ==========================================================================
   נאור פיקס – מאתר קודי תקלות (לוגיקה)
   אין תלות בספריות חיצוניות. הנתונים מוזרקים ל-window.NFX_DATA בזמן הבנייה.
   ========================================================================== */
(function () {
  "use strict";

  var D = window.NFX_DATA;
  if (!D) return;

  var root = document.getElementById("nfx-ec");
  if (!root || root.dataset.nfxReady === "1") return;
  root.dataset.nfxReady = "1";

  var elBrand  = root.querySelector("#nfx-brand");
  var elDevice = root.querySelector("#nfx-device");
  var elCode   = root.querySelector("#nfx-code");
  var elList   = root.querySelector("#nfx-codes");
  var elForm   = root.querySelector("#nfx-form");
  var elChips  = root.querySelector("#nfx-chips");
  var elChipsL = root.querySelector("#nfx-chips-list");
  var elResult = root.querySelector("#nfx-result");

  var SEV = { low: "טיפול עצמי אפשרי", med: "נדרשת בדיקה", high: "מומלץ להפסיק שימוש" };

  /* ---------- עזרי טקסט ---------- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  // נרמול קשיח: אותיות גדולות, בלי רווחים/מקפים/נקודות/נקודתיים
  function norm(s) {
    return String(s || "").toUpperCase().replace(/[\s\-_.:\/]/g, "");
  }
  // נרמול רך: מטפל בבלבול נפוץ בין O ל-0, I ל-1, ובאפסים מובילים (E01 = E1)
  function loose(s) {
    return norm(s).replace(/O/g, "0").replace(/I/g, "1").replace(/(^|[^0-9])0+(\d)/g, "$1$2");
  }
  function lev(a, b) {
    if (a === b) return 0;
    var m = a.length, n = b.length, i, j, prev = [], cur = [];
    for (j = 0; j <= n; j++) prev[j] = j;
    for (i = 1; i <= m; i++) {
      cur[0] = i;
      for (j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur.slice();
    }
    return prev[n];
  }

  /* ---------- גישה לנתונים ---------- */
  function brandById(id) {
    for (var i = 0; i < D.brands.length; i++) if (D.brands[i].id === id) return D.brands[i];
    return null;
  }
  function deviceById(id) {
    for (var i = 0; i < D.devices.length; i++) if (D.devices[i].id === id) return D.devices[i];
    return null;
  }
  function entriesFor(brandId, deviceId) {
    var b = brandById(brandId);
    if (!b || !b.family) return [];
    var fam = D.codes[b.family];
    if (!fam || !fam[deviceId]) return [];
    return fam[deviceId];
  }
  function familyNote(brandId) {
    var b = brandById(brandId);
    return b && b.family && D.notes[b.family] ? D.notes[b.family] : "";
  }

  /* ---------- אכלוס תפריטים ---------- */
  function fillBrands() {
    var html = '<option value="">בחרו יצרן…</option>';
    D.brands.forEach(function (b) {
      html += '<option value="' + esc(b.id) + '">' + esc(b.name) + (b.en ? " · " + esc(b.en) : "") + "</option>";
    });
    elBrand.innerHTML = html;
  }
  function fillDevices() {
    var b = brandById(elBrand.value);
    if (!b) {
      elDevice.innerHTML = '<option value="">בחרו קודם יצרן</option>';
      elDevice.disabled = true;
      return;
    }
    var list = (b.devices && b.devices.length) ? b.devices : D.devices.map(function (d) { return d.id; });
    var html = '<option value="">בחרו סוג מכשיר…</option>';
    list.forEach(function (id) {
      var d = deviceById(id);
      if (d) html += '<option value="' + esc(d.id) + '">' + esc(d.emoji + " " + d.name) + "</option>";
    });
    elDevice.innerHTML = html;
    elDevice.disabled = false;
  }
  function fillCodeHints() {
    var list = entriesFor(elBrand.value, elDevice.value);
    elList.innerHTML = list.map(function (e) { return '<option value="' + esc(e.code) + '">' + esc(e.title) + "</option>"; }).join("");

    if (!list.length) { elChips.classList.remove("is-on"); elChipsL.innerHTML = ""; return; }
    elChipsL.innerHTML = list.map(function (e) {
      return '<button type="button" class="nfx-chip" data-code="' + esc(e.code) + '">' + esc(e.code) + "</button>";
    }).join("");
    elChips.classList.add("is-on");
  }

  /* ---------- חיפוש ---------- */
  function lookup(brandId, deviceId, raw) {
    var list = entriesFor(brandId, deviceId);
    var q = norm(raw), ql = loose(raw), i, j, keys;

    for (i = 0; i < list.length; i++) {                    // התאמה מדויקת
      keys = [list[i].code].concat(list[i].alt || []);
      for (j = 0; j < keys.length; j++) if (norm(keys[j]) === q) return { hit: list[i] };
    }
    for (i = 0; i < list.length; i++) {                    // התאמה גמישה (0/O, 1/I, אפס מוביל)
      keys = [list[i].code].concat(list[i].alt || []);
      for (j = 0; j < keys.length; j++) if (loose(keys[j]) === ql) return { hit: list[i], fuzzy: true };
    }
    var sugg = list.map(function (e) {                     // הצעות קרובות
      var best = 99;
      [e.code].concat(e.alt || []).forEach(function (k) { best = Math.min(best, lev(loose(k), ql)); });
      return { e: e, d: best };
    }).filter(function (x) { return x.d <= 2; })
      .sort(function (a, b) { return a.d - b.d; })
      .slice(0, 5)
      .map(function (x) { return x.e; });
    return { hit: null, suggestions: sugg };
  }

  /* ---------- תצוגה ---------- */
  function ctaHtml(text) {
    var s = D.site, out = '<div class="nfx-cta"><span class="nfx-cta-text">' + esc(text) + "</span>";
    if (s.phoneE164) out += '<a class="nfx-call" href="tel:' + esc(s.phoneE164) + '">📞 ' + esc(s.phone || "התקשרו אלינו") + "</a>";
    if (s.whatsapp) out += '<a class="nfx-wa" target="_blank" rel="noopener" href="https://wa.me/' + esc(s.whatsapp) + "?text=" + encodeURIComponent(s.whatsappText || "") + '">💬 וואטסאפ</a>';
    return out + "</div>";
  }

  function renderHit(e, brandId, deviceId, fuzzy) {
    var b = brandById(brandId), d = deviceById(deviceId), note = familyNote(brandId);
    var h = '<article class="nfx-res"><div class="nfx-res-head">' +
      '<span class="nfx-res-code">' + esc(e.code) + "</span>" +
      '<h3 class="nfx-res-title">' + esc(e.title) + "</h3>" +
      '<span class="nfx-badge ' + esc(e.severity) + '">' + esc(SEV[e.severity] || "") + "</span>" +
      "</div><div class=\"nfx-res-body\">";

    h += '<div class="nfx-sec"><h4>' + esc(b.name + " · " + d.name) + (fuzzy ? " (התאמה קרובה)" : "") + "</h4><p>" + esc(e.meaning) + "</p></div>";

    if (e.causes && e.causes.length) {
      h += '<div class="nfx-sec"><h4>סיבות אפשריות</h4><ul>' +
        e.causes.map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("") + "</ul></div>";
    }
    if (e.steps && e.steps.length) {
      h += '<div class="nfx-sec"><h4>מה כדאי לנסות לפני שמזמינים טכנאי</h4><ol>' +
        e.steps.map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("") + "</ol></div>";
    }
    if (e.pro) h += '<div class="nfx-pro"><strong>מתי צריך טכנאי:</strong> ' + esc(e.pro) + "</div>";
    if (note) h += '<p class="nfx-note">' + esc(note) + "</p>";

    h += ctaHtml("הקוד חוזר גם אחרי הבדיקות? נשמח לעזור.");
    return h + "</div></article>";
  }

  function renderMiss(res, brandId, deviceId, raw) {
    var b = brandById(brandId), d = deviceById(deviceId);
    var h = '<div class="nfx-msg"><h4>לא מצאנו את הקוד "' + esc(raw) + '" ל' + esc(b.name + " " + d.name) + "</h4>" +
      "<p>ייתכן שהקוד שייך לדגם ספציפי או שהוא מוצג בצורה קצת שונה בצג. שלחו לנו את הדגם והקוד ונאתר לכם את המשמעות.</p>";
    if (res.suggestions && res.suggestions.length) {
      h += '<div class="nfx-sugg">' + res.suggestions.map(function (e) {
        return '<button type="button" class="nfx-chip" data-code="' + esc(e.code) + '">האם התכוונתם ל-' + esc(e.code) + "?</button>";
      }).join("") + "</div>";
    }
    return h + ctaHtml("שלחו לנו את הדגם והקוד:") + "</div>";
  }

  function renderNoData(brandId) {
    var b = brandById(brandId);
    return '<div class="nfx-msg"><h4>' + esc(b.name) + " – עדיין אין אצלנו טבלת קודים</h4>" +
      "<p>הרבה מכשירים מהמותג הזה מיוצרים על ידי יצרנים אחרים, ולכן הקודים משתנים בין דגם לדגם. שלחו לנו צילום של מדבקת הדגם ואת הקוד שמופיע בצג – נאתר עבורכם.</p>" +
      ctaHtml("שלחו לנו את פרטי המכשיר:") + "</div>";
  }

  function track(brandId, deviceId, code, found) {
    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: "nfx_error_code_lookup", brand: brandId, device: deviceId, code: code, found: !!found });
    } catch (err) { /* לא קריטי */ }
  }

  /* ---------- אירועים ---------- */
  function run() {
    var brandId = elBrand.value, deviceId = elDevice.value, raw = (elCode.value || "").trim();
    var b = brandById(brandId);

    if (!brandId) { elResult.innerHTML = '<div class="nfx-msg"><h4>בחרו יצרן</h4><p>כדי שנוכל לאתר את הקוד, בחרו קודם את יצרן המכשיר.</p></div>'; return; }
    if (b && b.noData) { elResult.innerHTML = renderNoData(brandId); track(brandId, deviceId, raw, false); return; }
    if (!deviceId) { elResult.innerHTML = '<div class="nfx-msg"><h4>בחרו סוג מכשיר</h4><p>מכונת כביסה, מדיח, מייבש, תנור או מקרר.</p></div>'; return; }
    if (!raw) { elResult.innerHTML = '<div class="nfx-msg"><h4>הזינו את קוד השגיאה</h4><p>הקוד שמופיע בצג המכשיר, למשל E18. אפשר גם ללחוץ על אחד הקודים הנפוצים למעלה.</p></div>'; return; }

    var res = lookup(brandId, deviceId, raw);
    elResult.innerHTML = res.hit ? renderHit(res.hit, brandId, deviceId, res.fuzzy) : renderMiss(res, brandId, deviceId, raw);
    track(brandId, deviceId, raw, !!res.hit);
    if (window.history && window.history.replaceState) {
      try { window.history.replaceState(null, "", "#nfx=" + brandId + "|" + deviceId + "|" + encodeURIComponent(raw)); } catch (err) {}
    }
  }

  elBrand.addEventListener("change", function () { fillDevices(); fillCodeHints(); elResult.innerHTML = ""; });
  elDevice.addEventListener("change", function () { fillCodeHints(); elResult.innerHTML = ""; });
  elForm.addEventListener("submit", function (ev) { ev.preventDefault(); run(); });
  root.addEventListener("click", function (ev) {
    var chip = ev.target.closest && ev.target.closest(".nfx-chip");
    if (!chip) return;
    elCode.value = chip.getAttribute("data-code");
    run();
    elResult.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  /* ---------- אתחול ---------- */
  fillBrands();
  fillDevices();

  var m = /#nfx=([^|]+)\|([^|]+)\|(.+)/.exec(window.location.hash || "");
  if (m) {
    elBrand.value = decodeURIComponent(m[1]); fillDevices();
    elDevice.value = decodeURIComponent(m[2]); fillCodeHints();
    elCode.value = decodeURIComponent(m[3]);
    run();
  } else if (root.dataset.brand) {          // שימוש בדפי נחיתה: data-brand / data-device
    elBrand.value = root.dataset.brand; fillDevices();
    if (root.dataset.device) { elDevice.value = root.dataset.device; }
    fillCodeHints();
  }
})();
