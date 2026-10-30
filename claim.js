(function () {
  const cfg = window.CV_SUPABASE;
  const sb = window.supabase.createClient(cfg.url, cfg.key);
  const $ = (id) => document.getElementById(id);

  // ===== Edit these two lines each season =====
  const CURRENT_SEASON = "S1";
  const TIERS = ["Crown", "Ace", "Ace Master", "Ace Dominator", "Conqueror"];
  // ============================================

  const MAX_BYTES = 3 * 1024 * 1024;
  const CODE_MINUTES = 30; // must match the 30 minutes in step2b_security.sql
  const EXT = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "");

  function say(el, text, kind) {
    el.textContent = text || "";
    el.className = "msg" + (kind ? " " + kind : "");
  }
  function el(tag, props, ...kids) {
    const n = document.createElement(tag);
    if (props) for (const k in props) n.setAttribute(k, props[k]);
    kids.forEach((c) => n.append(c));
    return n;
  }
  const td = (v) => el("td", null, v == null || v === "" ? "—" : String(v));

  let user = null;
  let busy = false;
  let claimCode = null;
  let codeExpiresAt = 0;
  let codeTimer = null;

  /* ---------- verification code ---------- */
  function clearCode() {
    claimCode = null;
    codeExpiresAt = 0;
    if (codeTimer) { clearInterval(codeTimer); codeTimer = null; }
    $("codeBox").classList.add("hidden");
    $("codeText").textContent = "";
    $("codeTime").textContent = "";
  }

  function tickCode() {
    const left = codeExpiresAt - Date.now();
    if (left <= 0) {
      clearCode();
      say($("claimMsg"), "Your code expired. Get a new code and take a fresh screenshot.", "err");
      return;
    }
    const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
    $("codeTime").textContent = "expires in " + m + ":" + String(s).padStart(2, "0");
  }

  $("getCode").addEventListener("click", async () => {
    const msg = $("claimMsg");
    say(msg, "");
    $("getCode").disabled = true;
    try {
      const { data, error } = await sb.rpc("new_claim_code");
      if (error) throw error;
      claimCode = String(data);
      codeExpiresAt = Date.now() + CODE_MINUTES * 60000;
      $("codeText").textContent = claimCode;
      $("codeBox").classList.remove("hidden");
      if (codeTimer) clearInterval(codeTimer);
      tickCode();
      codeTimer = setInterval(tickCode, 1000);
    } catch (err) {
      const m = String((err && err.message) || err || "");
      if (/too many codes/i.test(m)) say(msg, "You asked for too many codes. Please try again in a while.", "err");
      else say(msg, "Could not get a code: " + m + " (did you run step2b_security.sql?)", "err");
    } finally {
      $("getCode").disabled = false;
    }
  });

  /* ---------- page setup ---------- */
  async function gate() {
    const gateMsg = $("gateMsg");
    const { data } = await sb.auth.getSession();
    if (!data.session) {
      say(gateMsg, "Please log in first.", "err");
      gateMsg.append(" ", el("a", { href: "account.html", class: "linkbtn" }, "Go to login"));
      return;
    }
    user = data.session.user;
    const { data: prof, error } = await sb.from("profiles").select("bgmi_id").eq("id", user.id).maybeSingle();
    if (error || !prof) {
      say(gateMsg, "Could not load your profile. Please try again later.", "err");
      return;
    }
    if (!prof.bgmi_id) {
      say(gateMsg, "Add your BGMI character ID to your profile before claiming.", "err");
      gateMsg.append(" ", el("a", { href: "account.html", class: "linkbtn" }, "Open my profile"));
      return;
    }
    gateMsg.classList.add("hidden");
    $("claimBody").classList.remove("hidden");
    $("seasonBadge").textContent = CURRENT_SEASON;
    const sel = $("tier");
    TIERS.forEach((t) => sel.append(el("option", { value: t }, t)));
    await loadMine();
  }

  async function loadMine() {
    const { data, error } = await sb.from("tier_claims")
      .select("season,tier,points,status,admin_note,created_at")
      .eq("user_id", user.id).order("created_at", { ascending: false });
    const body = $("myClaims");
    body.replaceChildren();
    if (error) return body.append(el("tr", null, el("td", { colspan: "6" }, "Could not load your claims: " + error.message)));
    if (!data.length) return body.append(el("tr", null, el("td", { colspan: "6" }, "You have not sent any claims yet.")));
    data.forEach((c) => body.append(el("tr", null,
      td(c.season), td(c.tier), td(c.points), td(c.status), td(c.admin_note), td(fmtDate(c.created_at)))));
  }

  /* ---------- submit ---------- */
  $("claimForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy || !user) return;
    const msg = $("claimMsg");
    const tier = $("tier").value;
    const ptsRaw = $("points").value.trim();
    const file = $("proof").files[0];

    if (!claimCode) return say(msg, "First press 'Get my verification code' and write the code in your BGMI profile.", "err");
    if (!TIERS.includes(tier)) return say(msg, "Choose a tier.", "err");
    let points = null;
    if (ptsRaw !== "") {
      points = Number(ptsRaw);
      if (!Number.isInteger(points) || points < 0 || points > 100000) return say(msg, "Points must be a whole number from 0 to 100000.", "err");
    }
    if (!file) return say(msg, "Please choose a screenshot.", "err");
    if (!EXT[file.type]) return say(msg, "The screenshot must be a PNG, JPG or WebP image.", "err");
    if (file.size > MAX_BYTES) return say(msg, "The screenshot is larger than 3 MB. Please use a smaller image.", "err");

    busy = true;
    $("claimBtn").disabled = true;
    say(msg, "Uploading your screenshot...");
    try {
      const rand = Math.random().toString(36).slice(2, 10);
      const path = `${user.id}/${Date.now()}-${rand}.${EXT[file.type]}`;
      const up = await sb.storage.from("rank-proofs").upload(path, file, { contentType: file.type, upsert: false });
      if (up.error) throw up.error;

      say(msg, "Submitting your claim...");
      const { error } = await sb.from("tier_claims").insert({
        user_id: user.id, season: CURRENT_SEASON, tier, points, proof_path: path, verify_code: claimCode,
      });
      if (error) throw error;

      $("claimForm").reset();
      clearCode();
      say(msg, "Claim sent. An admin will review it soon.", "ok");
      await loadMine();
    } catch (err) {
      const m = String((err && err.message) || err || "");
      if (err && err.code === "23505") say(msg, "You already have a pending or approved claim for this tier this season, or this code was already used.", "err");
      else if (/too many pending/i.test(m)) say(msg, "You have too many pending claims. Wait for them to be reviewed first.", "err");
      else if (/row-level security|violates/i.test(m)) say(msg, "This claim was not allowed. Your code may have expired: get a new code, and make sure your BGMI ID is saved in your profile.", "err");
      else say(msg, "Could not send the claim: " + m, "err");
    } finally {
      busy = false;
      $("claimBtn").disabled = false;
    }
  });

  sb.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") location.href = "account.html";
  });
  gate();
})();
