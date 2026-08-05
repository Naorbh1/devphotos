/* ==========================================================================
   נאור פיקס · מאתר קודי תקלות – לוגיקה
   ללא ספריות חיצוניות. הנתונים מוזרקים ל-window.NFX_DATA בזמן הבנייה.
   מקור האמת לבחירות הוא שני שדות ה-select הנסתרים (#nfx-brand, #nfx-device);
   הממשק הגרפי הוא תצוגה מעליהם, כך שהטופס נשאר נגיש וניתן למילוי אוטומטי.
   ========================================================================== */
(function () {
  "use strict";

  var D = window.NFX_DATA;
  if (!D) return;

  var root = document.getElementById("nfx-ec");
  if (!root || root.dataset.nfxReady === "1") return;
  root.dataset.nfxReady = "1";

  var $ = function (id) { return root.querySelector("#" + id); };
  var elBrand = $("nfx-brand"), elDevice = $("nfx-device"), elCode = $("nfx-code");
  var elBtn = $("nfx-brand-btn"), elPop = $("nfx-brand-pop"), elQ = $("nfx-brand-q"), elOpts = $("nfx-brand-opts");
  var elDevs = $("nfx-devs"), elList = $("nfx-codes"), elForm = $("nfx-form");
  var elChips = $("nfx-chips"), elChipsL = $("nfx-chips-list"), elResult = $("nfx-result");

  var SEV = { low: "טיפול עצמי אפשרי", med: "נדרשת בדיקה", high: "מומלץ להפסיק שימוש" };

  /* אייקונים וקטוריים – אמינים יותר מאמוג'י, שלא תמיד קיים בכל מכשיר */
  var SVG = '<svg class="nfx-i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
            'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
  var ICON = {
    /* מכונת כביסה – תוף עם גל מים בתוכו */
    washer: SVG + '<rect x="3.5" y="2.5" width="17" height="19" rx="3.5"/><circle cx="12" cy="13.5" r="5.4"/>' +
                  '<path d="M7.4 14.6c1.2-1.1 2.3.9 3.5 0s2.3.9 3.5 0 2.3-1.1 3.5 0"/>' +
                  '<circle cx="6.6" cy="5.7" r=".95" fill="currentColor" stroke="none"/></svg>',
    /* מייבש – תוף עם גלי חום עולים */
    dryer: SVG + '<rect x="3.5" y="2.5" width="17" height="19" rx="3.5"/><circle cx="12" cy="14.5" r="4.6"/>' +
                 '<path d="M10.2 16c.9-.8 1.7.8 2.6 0M10.5 12.7c.9-.8 1.7.8 2.6 0"/>' +
                 '<path d="M6.3 6.6c0-1 1.4-1 1.4-2M9.3 6.6c0-1 1.4-1 1.4-2"/></svg>',
    /* מדיח – צלחת וסכו"ם */
    dishwasher: SVG + '<rect x="3" y="2.5" width="18" height="19" rx="3.5"/><path d="M3 7.4h18"/>' +
                      '<circle cx="10.5" cy="14.8" r="4"/><circle cx="10.5" cy="14.8" r="1.4"/>' +
                      '<path d="M17.4 11.4v7M15.6 11.4v2.4"/></svg>',
    /* תנור – כפתורים למעלה, ידית וחלון */
    oven: SVG + '<rect x="2.5" y="3" width="19" height="18" rx="3.5"/><path d="M2.5 8.2h19"/>' +
                '<path d="M6 11.4h12"/><rect x="6" y="13.4" width="12" height="5.6" rx="1.8"/>' +
                '<circle cx="6.4" cy="5.6" r="1" fill="currentColor" stroke="none"/>' +
                '<circle cx="10" cy="5.6" r="1" fill="currentColor" stroke="none"/></svg>',
    /* מקרר – שתי דלתות וידיות */
    fridge: SVG + '<rect x="5.5" y="2" width="13" height="20" rx="3.2"/><path d="M5.5 9.4h13"/>' +
                  '<path d="M8.6 5.6v2.2M8.6 11.6v3.4"/></svg>',
    /* מיקרוגל – חלון ולוח הפעלה */
    microwave: SVG + '<rect x="2" y="5.5" width="20" height="13" rx="3"/><rect x="4.6" y="8.4" width="10" height="7.6" rx="1.8"/>' +
                     '<path d="M17.6 8.6v3.2"/><circle cx="17.6" cy="14.6" r=".95" fill="currentColor" stroke="none"/></svg>',
    warn: SVG + '<path d="M10.7 3.9 2.6 17.6A1.5 1.5 0 0 0 3.9 20h16.2a1.5 1.5 0 0 0 1.3-2.4L13.3 3.9a1.5 1.5 0 0 0-2.6 0Z"/>' +
                '<path d="M12 9v4M12 16.5v.01"/></svg>',
    check: SVG + '<path d="M3.5 6.5 5 8l2.5-2.5M3.5 12.5 5 14l2.5-2.5M3.5 18.5 5 20l2.5-2.5"/>' +
                 '<path d="M11 7h9.5M11 13h9.5M11 19h9.5"/></svg>',
    tool: SVG + '<path d="M14.6 6.3a3.9 3.9 0 0 0 5.1 5.1l-8.3 8.3a2.2 2.2 0 0 1-3.1-3.1Z"/>' +
                '<path d="M14.6 6.3 17.8 3a4.6 4.6 0 0 1 3.2 3.2Z"/></svg>',
    phone: SVG + '<path d="M6.3 3.5h3l1.4 3.6-1.8 1.3a12 12 0 0 0 5.7 5.7l1.3-1.8 3.6 1.4v3a1.8 1.8 0 0 1-2 1.8A15.5 15.5 0 0 1 4.5 5.5a1.8 1.8 0 0 1 1.8-2Z"/></svg>',
    chat: SVG + '<path d="M20.5 11.6a8 8 0 0 1-11.7 7.1L4 20l1.3-4.7A8 8 0 1 1 20.5 11.6Z"/></svg>'
  };
  function icon(k) { return ICON[k] || ""; }

  /* ---------- עזרי טקסט ---------- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function norm(s) { return String(s || "").toUpperCase().replace(/[\s\-_.:\/]/g, ""); }
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
    return (fam && fam[deviceId]) ? fam[deviceId] : [];
  }
  function familyNote(brandId) {
    var b = brandById(brandId);
    return (b && b.family && D.notes[b.family]) ? D.notes[b.family] : "";
  }

  /* ---------- בחירת יצרן ---------- */
  function buildBrandOptions() {
    elBrand.innerHTML = '<option value="">בחרו יצרן…</option>' + D.brands.map(function (b) {
      return '<option value="' + esc(b.id) + '">' + esc(b.name) + "</option>";
    }).join("");
  }
  function paintOptions(filter) {
    var q = (filter || "").trim().toLowerCase();
    var list = D.brands.filter(function (b) {
      return !q || b.name.toLowerCase().indexOf(q) > -1 || (b.en || "").toLowerCase().indexOf(q) > -1;
    });
    if (!list.length) { elOpts.innerHTML = '<li class="nfx-opt-none">לא נמצא יצרן בשם הזה</li>'; return; }
    elOpts.innerHTML = list.map(function (b) {
      var sel = elBrand.value === b.id ? "true" : "false";
      return '<li><button type="button" class="nfx-opt" role="option" aria-selected="' + sel + '"' +
        ' data-id="' + esc(b.id) + '"><span>' + esc(b.name) + "</span>" +
        (b.en ? "<small>" + esc(b.en) + "</small>" : "") + "</button></li>";
    }).join("");
  }

  function openPop() {
    elPop.hidden = false;
    elBtn.setAttribute("aria-expanded", "true");
    elQ.value = "";
    paintOptions("");
    elQ.focus();
  }
  function closePop() {
    elPop.hidden = true;
    elBtn.setAttribute("aria-expanded", "false");
  }
  function setBrand(id) {
    elBrand.value = id;
    elBrand.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function paintBrandButton() {
    var b = brandById(elBrand.value);
    var val = elBtn.querySelector(".nfx-combo-val");
    if (b) {
      val.innerHTML = esc(b.name) + (b.en ? ' <small>· ' + esc(b.en) + "</small>" : "");
      elBtn.classList.remove("is-empty");
    } else {
      val.textContent = "בחרו יצרן…";
      elBtn.classList.add("is-empty");
    }
  }

  /* ---------- בחירת סוג מכשיר ---------- */
  function paintDevices() {
    var b = brandById(elBrand.value);
    if (!b) {
      elDevs.innerHTML = '<p class="nfx-devs-empty">בחרו קודם יצרן כדי לראות אילו מכשירים זמינים</p>';
      elDevice.innerHTML = "";
      return;
    }
    var ids = (b.devices && b.devices.length) ? b.devices : D.devices.map(function (d) { return d.id; });
    if (b.noData) ids = D.devices.map(function (d) { return d.id; });

    // בנייה מחדש של ה-select מאפסת את הערך, לכן שומרים ומחזירים אותו
    var keep = elDevice.value;
    elDevice.innerHTML = '<option value=""></option>' + ids.map(function (id) {
      var d = deviceById(id);
      return d ? '<option value="' + esc(d.id) + '">' + esc(d.name) + "</option>" : "";
    }).join("");
    if (ids.indexOf(keep) > -1) elDevice.value = keep;

    elDevs.innerHTML = ids.map(function (id) {
      var d = deviceById(id);
      if (!d) return "";
      var on = elDevice.value === d.id;
      return '<button type="button" class="nfx-dev' + (on ? " on" : "") + '" data-id="' + esc(d.id) + '"' +
        ' aria-pressed="' + on + '">' + icon(d.id) + esc(d.name) + "</button>";
    }).join("");
  }
  function setDevice(id) {
    elDevice.value = id;
    elDevice.dispatchEvent(new Event("change", { bubbles: true }));
  }

  /* ---------- קודים נפוצים ---------- */
  function paintCodes() {
    var list = entriesFor(elBrand.value, elDevice.value);
    elList.innerHTML = list.map(function (e) {
      return '<option value="' + esc(e.code) + '">' + esc(e.title) + "</option>";
    }).join("");
    if (!list.length) { elChips.classList.remove("is-on"); elChipsL.innerHTML = ""; return; }
    elChipsL.innerHTML = list.map(function (e) {
      return '<button type="button" class="nfx-chip" data-code="' + esc(e.code) + '">' + esc(e.code) + "</button>";
    }).join("");
    elChips.classList.add("is-on");
  }

  function paintSteps() {
    var done = { 1: !!elBrand.value, 2: !!elDevice.value, 3: !!(elCode.value || "").trim() };
    Array.prototype.forEach.call(root.querySelectorAll("[data-step]"), function (el) {
      el.classList.toggle("is-done", !!done[el.getAttribute("data-step")]);
    });
  }

  /* ---------- חיפוש ---------- */
  function lookup(brandId, deviceId, raw) {
    var list = entriesFor(brandId, deviceId), q = norm(raw), ql = loose(raw), i, j, keys;
    for (i = 0; i < list.length; i++) {
      keys = [list[i].code].concat(list[i].alt || []);
      for (j = 0; j < keys.length; j++) if (norm(keys[j]) === q) return { hit: list[i] };
    }
    for (i = 0; i < list.length; i++) {
      keys = [list[i].code].concat(list[i].alt || []);
      for (j = 0; j < keys.length; j++) if (loose(keys[j]) === ql) return { hit: list[i], fuzzy: true };
    }
    var sugg = list.map(function (e) {
      var best = 99;
      [e.code].concat(e.alt || []).forEach(function (k) { best = Math.min(best, lev(loose(k), ql)); });
      return { e: e, d: best };
    }).filter(function (x) { return x.d <= 2; })
      .sort(function (a, b) { return a.d - b.d; })
      .slice(0, 5).map(function (x) { return x.e; });
    return { hit: null, suggestions: sugg };
  }

  /* ---------- תצוגת התוצאה ---------- */
  function cta(text) {
    var s = D.site, out = '<div class="nfx-cta"><span class="nfx-cta-t">' + esc(text) + "</span>";
    if (s.phoneE164) {
      out += '<a class="nfx-tel" href="tel:' + esc(s.phoneE164) + '">' + icon("phone") + esc(s.phone || "התקשרו") + "</a>";
    }
    if (s.whatsapp) {
      out += '<a class="nfx-wa" target="_blank" rel="noopener" href="https://wa.me/' + esc(s.whatsapp) +
        "?text=" + encodeURIComponent(s.whatsappText || "") + '">' + icon("chat") + "וואטסאפ</a>";
    }
    return out + "</div>";
  }

  function renderHit(e, brandId, deviceId, fuzzy) {
    var b = brandById(brandId), d = deviceById(deviceId), note = familyNote(brandId);
    var h = '<article class="nfx-res"><div class="nfx-res-top">' +
      '<span class="nfx-code-badge">' + esc(e.code) + "</span>" +
      '<div class="nfx-res-h"><h3>' + esc(e.title) + "</h3><p>" + esc(b.name + " · " + d.name) +
      (fuzzy ? " · התאמה קרובה לקוד שהוזן" : "") + "</p></div>" +
      '<span class="nfx-sev ' + esc(e.severity) + '"><i></i>' + esc(SEV[e.severity] || "") + "</span>" +
      '</div><div class="nfx-res-body">' +
      '<p class="nfx-lead">' + esc(e.meaning) + "</p>";

    var cols = "";
    if (e.causes && e.causes.length) {
      cols += '<div class="nfx-box"><h4>' + icon("warn") + " סיבות אפשריות</h4><ul>" +
        e.causes.map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("") + "</ul></div>";
    }
    if (e.steps && e.steps.length) {
      cols += '<div class="nfx-box"><h4>' + icon("check") + " מה לבדוק לפני שמזמינים טכנאי</h4><ol>" +
        e.steps.map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("") + "</ol></div>";
    }
    if (cols) h += '<div class="nfx-cols">' + cols + "</div>";

    if (e.pro) h += '<div class="nfx-pro">' + icon("tool") + "<div><b>מתי צריך טכנאי:</b> " + esc(e.pro) + "</div></div>";
    if (note) h += '<p class="nfx-note">' + esc(note) + "</p>";
    return h + cta("הקוד חוזר גם אחרי הבדיקות? נשמח לעזור.") + "</div></article>";
  }

  function renderMiss(res, brandId, deviceId, raw) {
    var b = brandById(brandId), d = deviceById(deviceId);
    var h = '<div class="nfx-msg"><h4>לא מצאנו את הקוד "' + esc(raw) + '" ל' + esc(b.name + " " + d.name) + "</h4>" +
      "<p>ייתכן שהקוד שייך לדגם ספציפי, או שהוא מוצג בצג בצורה מעט שונה. שלחו לנו את הדגם ואת הקוד ונאתר עבורכם את המשמעות.</p>";
    if (res.suggestions && res.suggestions.length) {
      h += '<div class="nfx-sugg">' + res.suggestions.map(function (e) {
        return '<button type="button" class="nfx-chip" data-code="' + esc(e.code) + '">האם התכוונתם ל-' + esc(e.code) + "?</button>";
      }).join("") + "</div>";
    }
    return h + cta("שלחו לנו את הדגם והקוד:") + "</div>";
  }

  function renderNoData(brandId) {
    var b = brandById(brandId);
    return '<div class="nfx-msg"><h4>' + esc(b.name) + " – עדיין אין אצלנו טבלת קודים</h4>" +
      "<p>חלק גדול מהמכשירים במותג הזה מיוצרים על ידי יצרנים אחרים, ולכן הקודים משתנים מדגם לדגם. שלחו לנו צילום של מדבקת הדגם ואת הקוד שבצג – נאתר עבורכם.</p>" +
      cta("שלחו לנו את פרטי המכשיר:") + "</div>";
  }

  function note(title, body) {
    return '<div class="nfx-msg"><h4>' + esc(title) + "</h4><p>" + esc(body) + "</p></div>";
  }

  function track(brandId, deviceId, code, found) {
    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: "nfx_error_code_lookup", brand: brandId, device: deviceId, code: code, found: !!found });
    } catch (err) { /* לא קריטי */ }
  }

  /* ---------- הרצת חיפוש ---------- */
  function run() {
    var brandId = elBrand.value, deviceId = elDevice.value, raw = (elCode.value || "").trim();
    var b = brandById(brandId);

    if (!brandId) { elResult.innerHTML = note("בחרו יצרן", "כדי לאתר את הקוד, בחרו קודם את יצרן המכשיר."); return; }
    if (b.noData) { elResult.innerHTML = renderNoData(brandId); track(brandId, deviceId, raw, false); return; }
    if (!deviceId) { elResult.innerHTML = note("בחרו סוג מכשיר", "מכונת כביסה, מייבש, מדיח, תנור, מקרר או מיקרוגל."); return; }
    if (!raw) {
      elResult.innerHTML = note("הזינו את קוד השגיאה", "הקוד שמופיע בצג המכשיר, למשל E18. אפשר גם ללחוץ על אחד הקודים הנפוצים שמוצגים למעלה.");
      return;
    }

    var res = lookup(brandId, deviceId, raw);
    elResult.innerHTML = res.hit ? renderHit(res.hit, brandId, deviceId, res.fuzzy) : renderMiss(res, brandId, deviceId, raw);
    track(brandId, deviceId, raw, !!res.hit);
    if (window.history && window.history.replaceState) {
      try { window.history.replaceState(null, "", "#nfx=" + brandId + "|" + deviceId + "|" + encodeURIComponent(raw)); } catch (err) {}
    }
  }

  /* ---------- אירועים ---------- */
  elBrand.addEventListener("change", function () {
    paintBrandButton();
    paintDevices();
    paintCodes();
    paintSteps();
    elResult.innerHTML = "";
    var b = brandById(elBrand.value);
    if (b && b.noData) elResult.innerHTML = renderNoData(b.id);
  });
  elDevice.addEventListener("change", function () {
    paintDevices();
    paintCodes();
    paintSteps();
    elResult.innerHTML = "";
  });

  elBtn.addEventListener("click", function () { elPop.hidden ? openPop() : closePop(); });
  elQ.addEventListener("input", function () { paintOptions(elQ.value); });
  elQ.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") { closePop(); elBtn.focus(); }
    if (ev.key === "ArrowDown") { ev.preventDefault(); var f = elOpts.querySelector(".nfx-opt"); if (f) f.focus(); }
    if (ev.key === "Enter") {
      ev.preventDefault();
      var first = elOpts.querySelector(".nfx-opt");
      if (first) { setBrand(first.getAttribute("data-id")); closePop(); elBtn.focus(); }
    }
  });
  elOpts.addEventListener("keydown", function (ev) {
    var items = Array.prototype.slice.call(elOpts.querySelectorAll(".nfx-opt"));
    var i = items.indexOf(document.activeElement);
    if (ev.key === "ArrowDown") { ev.preventDefault(); (items[i + 1] || items[0]).focus(); }
    if (ev.key === "ArrowUp") { ev.preventDefault(); i <= 0 ? elQ.focus() : items[i - 1].focus(); }
    if (ev.key === "Escape") { closePop(); elBtn.focus(); }
  });
  document.addEventListener("click", function (ev) {
    if (!elPop.hidden && !ev.target.closest(".nfx-combo")) closePop();
  });

  root.addEventListener("click", function (ev) {
    var opt = ev.target.closest(".nfx-opt");
    if (opt) { setBrand(opt.getAttribute("data-id")); closePop(); elBtn.focus(); return; }

    var dev = ev.target.closest(".nfx-dev");
    if (dev) { setDevice(dev.getAttribute("data-id")); elCode.focus(); return; }

    var chip = ev.target.closest(".nfx-chip");
    if (chip) {
      elCode.value = chip.getAttribute("data-code");
      run();
      elResult.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });

  elCode.addEventListener("input", paintSteps);
  elForm.addEventListener("submit", function (ev) { ev.preventDefault(); run(); });

  /* ---------- אתחול ---------- */
  buildBrandOptions();
  paintOptions("");
  paintBrandButton();
  paintDevices();
  paintSteps();

  var m = /#nfx=([^|]+)\|([^|]+)\|(.+)/.exec(window.location.hash || "");
  if (m) {
    setBrand(decodeURIComponent(m[1]));
    setDevice(decodeURIComponent(m[2]));
    elCode.value = decodeURIComponent(m[3]);
    run();
  } else if (root.dataset.brand) {          // דפי נחיתה: data-brand / data-device
    setBrand(root.dataset.brand);
    if (root.dataset.device) setDevice(root.dataset.device);
  }
})();
