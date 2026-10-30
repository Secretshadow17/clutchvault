(function () {
  const cfg = window.CV_SUPABASE;
  const sb = window.supabase.createClient(cfg.url, cfg.key);
  const $ = (id) => document.getElementById(id);
  const STATUSES = ["promised", "received", "allocated", "paid_out"];
  const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "");

  function say(elm, text, kind) {
    elm.textContent = text || "";
    elm.className = "msg" + (kind ? " " + kind : "");
  }

  // Safe DOM builder: all text goes in via textContent, never innerHTML.
  function el(tag, props, ...kids) {
    const n = document.createElement(tag);
    if (props) for (const k in props) {
      if (k === "class") n.className = props[k];
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), props[k]);
      else n.setAttribute(k, props[k]);
    }
    kids.forEach((c) => n.append(c));
    return n;
  }
  const td = (v) => el("td", null, v == null || v === "" ? "—" : String(v));

  let busy = false;
  let adminId = null;

  /* ---------- which screen is showing ---------- */
  function screen(which) {
    $("gateMsg").classList.toggle("hidden", which !== "gate");
    $("loginSec").classList.toggle("hidden", which !== "login");
    $("deniedSec").classList.toggle("hidden", which !== "denied");
    $("adminBody").classList.toggle("hidden", which !== "admin");
    $("logoutBtn").classList.toggle("hidden", which !== "admin");
  }

  async function gate() {
    screen("gate");
    say($("gateMsg"), "Checking access...");
    const { data } = await sb.auth.getSession();
    if (!data.session) return screen("login");
    const { data: me, error } = await sb.from("profiles").select("role").eq("id", data.session.user.id).maybeSingle();
    if (error || !me || me.role !== "admin") return screen("denied");
    adminId = data.session.user.id;
    screen("admin");
    await Promise.all([loadClaims(), loadFunds(), loadPlayers()]);
  }

  /* ---------- login / logout ---------- */
  $("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("loginMsg");
    const email = $("aEmail").value.trim();
    const password = $("aPass").value;
    if (!email || !password) return say(msg, "Enter your admin email and password.", "err");
    $("loginBtn").disabled = true;
    say(msg, "Logging in...");
    const { error } = await sb.auth.signInWithPassword({ email, password });
    $("loginBtn").disabled = false;
    if (error) {
      return say(msg, /invalid login/i.test(error.message) ? "Wrong email or password." : error.message, "err");
    }
    $("aPass").value = "";
    say(msg, "");
    await gate();
  });

  async function logout() {
    await sb.auth.signOut();
    screen("login");
  }
  $("logoutBtn").addEventListener("click", logout);
  $("deniedLogout").addEventListener("click", logout);

  /* ---------- tabs ---------- */
  const TABS = { tabClaims: "paneClaims", tabFunds: "paneFunds", tabPlayers: "panePlayers" };
  Object.keys(TABS).forEach((tabId) => {
    $(tabId).addEventListener("click", () => {
      Object.keys(TABS).forEach((t) => {
        $(t).setAttribute("aria-selected", String(t === tabId));
        $(TABS[t]).classList.toggle("hidden", t !== tabId);
      });
    });
  });

  /* ---------- tier reward claims ---------- */
  $("claimFilter").addEventListener("change", loadClaims);

  async function loadClaims() {
    const msg = $("claimMsg");
    const filter = $("claimFilter").value;
    let q = sb.from("tier_claims").select("*").order("created_at", { ascending: false }).limit(200);
    if (filter !== "all") q = q.eq("status", filter);
    const { data, error } = await q;
    const body = $("claimRows");
    body.replaceChildren();
    if (error) {
      body.append(el("tr", null, el("td", { colspan: "9" }, "Could not load claims: " + error.message + " (did you run step2_database.sql and step2b_security.sql?)")));
      return;
    }
    if (!data.length) {
      body.append(el("tr", null, el("td", { colspan: "9" }, "No claims in this view.")));
      return;
    }
    const ids = [...new Set(data.map((c) => c.user_id))];
    const { data: profs } = await sb.from("profiles").select("id,display_name,bgmi_name,bgmi_id").in("id", ids);
    const byId = {};
    (profs || []).forEach((p) => { byId[p.id] = p; });

    data.forEach((c) => {
      const p = byId[c.user_id] || {};
      const who = (p.display_name || "—") + (p.bgmi_name ? " (" + p.bgmi_name + ")" : "");
      const actions = el("td");

      const view = el("button", { class: "del", type: "button" }, "View proof");
      view.addEventListener("click", async () => {
        const w = window.open("about:blank", "_blank");
        const { data: signed, error: e } = await sb.storage.from("rank-proofs").createSignedUrl(c.proof_path, 120);
        if (e || !signed) {
          if (w) w.close();
          return say(msg, "Could not open the screenshot: " + (e ? e.message : "unknown error"), "err");
        }
        if (w) w.location.href = signed.signedUrl;
      });
      actions.append(view);

      const act = (label, status, promptText) => {
        const b = el("button", { class: "del", type: "button" }, label);
        b.addEventListener("click", async () => {
          const note = promptText ? prompt(promptText, c.admin_note || "") : null;
          if (promptText && note === null) return; // cancelled
          const { error: e } = await sb.from("tier_claims").update({
            status,
            admin_note: note ? note.trim().slice(0, 300) : null,
            reviewed_by: adminId,
            reviewed_at: new Date().toISOString(),
          }).eq("id", c.id);
          if (e) say(msg, "Could not update the claim: " + e.message, "err");
          else say(msg, "Claim updated.", "ok");
          await loadClaims();
        });
        actions.append(" ", b);
      };
      if (c.status === "pending") {
        act("Approve", "approved", "Note for the player (optional):");
        act("Reject", "rejected", "Reason for rejecting (the player will see this):");
      } else if (c.status === "approved") {
        act("Mark paid", "paid", "Payout note, e.g. UPI ref or UC code ID (optional):");
      }

      body.append(el("tr", null,
        td(who), td(p.bgmi_id), td(c.verify_code), td(c.tier), td(c.points), td(c.season),
        td(fmtDate(c.created_at)), td(c.status), actions));
    });
  }

  /* ---------- sponsor funds ---------- */
  async function loadFunds() {
    const { data, error } = await sb.from("sponsor_funds").select("*").order("created_at", { ascending: false });
    if (error) return say($("fundMsg"), "Could not load sponsor entries: " + error.message, "err");
    renderStats(data);
    const body = $("fundRows");
    body.replaceChildren();
    if (!data.length) {
      body.append(el("tr", null, el("td", { colspan: "6" }, "No entries yet. Add your first sponsor above.")));
      return;
    }
    data.forEach((f) => {
      const sel = el("select", { class: "inline-select", "aria-label": "Status for " + f.sponsor_name });
      STATUSES.forEach((s) => {
        const o = el("option", { value: s }, s);
        if (s === f.status) o.selected = true;
        sel.append(o);
      });
      sel.addEventListener("change", async () => {
        const { error: e } = await sb.from("sponsor_funds").update({ status: sel.value }).eq("id", f.id);
        if (e) say($("fundMsg"), "Could not update status: " + e.message, "err");
        await loadFunds();
      });
      const del = el("button", { class: "del", type: "button" }, "Delete");
      del.addEventListener("click", async () => {
        if (!confirm("Delete the entry for " + f.sponsor_name + "?")) return;
        const { error: e } = await sb.from("sponsor_funds").delete().eq("id", f.id);
        if (e) say($("fundMsg"), "Could not delete: " + e.message, "err");
        await loadFunds();
      });
      const purpose = f.notes ? (f.purpose || "") + (f.purpose ? " — " : "") + f.notes : f.purpose;
      body.append(el("tr", null,
        td(f.sponsor_name), td(inr(f.amount_inr)), td(purpose), el("td", null, sel), td(fmtDate(f.created_at)), el("td", null, del)));
    });
  }

  function renderStats(rows) {
    const totals = { promised: 0, received: 0, allocated: 0, paid_out: 0 };
    rows.forEach((r) => { if (r.status in totals) totals[r.status] += Number(r.amount_inr) || 0; });
    const box = $("stats");
    box.replaceChildren();
    STATUSES.forEach((s) => box.append(el("div", { class: "stat" }, el("b", null, inr(totals[s])), el("span", null, s.replace("_", " ")))));
  }

  $("fundForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy) return;
    const msg = $("fundMsg");
    const sponsor = $("fSponsor").value.trim();
    const amount = Number($("fAmount").value);
    if (!sponsor) return say(msg, "Enter the sponsor name.", "err");
    if (!Number.isFinite(amount) || amount < 0 || $("fAmount").value === "") return say(msg, "Enter a valid amount (0 or more).", "err");
    busy = true;
    say(msg, "Saving...");
    const { error } = await sb.from("sponsor_funds").insert({
      sponsor_name: sponsor,
      amount_inr: amount,
      purpose: $("fPurpose").value.trim() || null,
      status: $("fStatus").value,
      notes: $("fNotes").value.trim() || null,
    });
    busy = false;
    if (error) return say(msg, "Could not save: " + error.message, "err");
    $("fundForm").reset();
    say(msg, "Entry added.", "ok");
    await loadFunds();
  });

  /* ---------- players ---------- */
  async function loadPlayers() {
    const { data, error } = await sb.from("profiles")
      .select("display_name,bgmi_name,bgmi_id,role,created_at")
      .order("created_at", { ascending: false }).limit(200);
    const body = $("playerRows");
    body.replaceChildren();
    if (error) {
      body.append(el("tr", null, el("td", { colspan: "5" }, "Could not load players: " + error.message)));
      return;
    }
    $("playerCount").textContent = String(data.length);
    if (!data.length) {
      body.append(el("tr", null, el("td", { colspan: "5" }, "No players yet.")));
      return;
    }
    data.forEach((p) => body.append(el("tr", null,
      td(p.display_name), td(p.bgmi_name), td(p.bgmi_id), td(p.role), td(fmtDate(p.created_at)))));
  }

  sb.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") screen("login");
  });
  gate();
})();
