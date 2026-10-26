(function () {
  const cfg = window.CV_SUPABASE;
  const sb = window.supabase.createClient(cfg.url, cfg.key);
  const $ = (id) => document.getElementById(id);
  const STATUSES = ["promised", "received", "allocated", "paid_out"];
  const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "");

  function say(el, text, kind) {
    el.textContent = text || "";
    el.className = "msg" + (kind ? " " + kind : "");
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

  async function gate() {
    const gateMsg = $("gateMsg");
    const { data } = await sb.auth.getSession();
    if (!data.session) {
      say(gateMsg, "Please log in first.", "err");
      gateMsg.append(" ", el("a", { href: "account.html", class: "linkbtn" }, "Go to login"));
      return;
    }
    const { data: me, error } = await sb.from("profiles").select("role").eq("id", data.session.user.id).maybeSingle();
    if (error || !me || me.role !== "admin") {
      say(gateMsg, "Access denied. This page is for admins only.", "err");
      return;
    }
    gateMsg.classList.add("hidden");
    $("adminBody").classList.remove("hidden");
    await Promise.all([loadFunds(), loadPlayers()]);
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
    if (event === "SIGNED_OUT") location.href = "account.html";
  });
  gate();
})();
