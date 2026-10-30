(function () {
  const cfg = window.CV_SUPABASE;
  const sb = window.supabase.createClient(cfg.url, cfg.key);
  const $ = (id) => document.getElementById(id);
  const here = location.origin + location.pathname;

  const authSec = $("authSec"), recSec = $("recSec"), profileSec = $("profileSec");
  let mode = "login";
  let recovering = false;

  function say(el, text, kind) {
    el.textContent = text || "";
    el.className = "msg" + (kind ? " " + kind : "");
  }

  function show(which) {
    authSec.classList.toggle("hidden", which !== "auth");
    recSec.classList.toggle("hidden", which !== "rec");
    profileSec.classList.toggle("hidden", which !== "profile");
  }

  /* ---------- login / signup tabs ---------- */
  function setMode(m) {
    mode = m;
    $("tabLogin").setAttribute("aria-selected", String(m === "login"));
    $("tabSignup").setAttribute("aria-selected", String(m === "signup"));
    $("authBtn").textContent = m === "login" ? "Log in" : "Create account";
    $("password").autocomplete = m === "login" ? "current-password" : "new-password";
    $("pwHint").classList.toggle("hidden", m === "login");
    $("forgot").classList.toggle("hidden", m === "signup");
    say($("authMsg"), "");
  }
  $("tabLogin").addEventListener("click", () => setMode("login"));
  $("tabSignup").addEventListener("click", () => setMode("signup"));

  const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  $("authForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("authMsg");
    const email = $("email").value.trim();
    const password = $("password").value;
    if (!validEmail(email)) return say(msg, "Please enter a valid email address.", "err");
    if (password.length < 8) return say(msg, "Password must be at least 8 characters.", "err");

    const btn = $("authBtn");
    btn.disabled = true;
    say(msg, mode === "login" ? "Logging in..." : "Creating your account...");
    try {
      if (mode === "login") {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        say(msg, "");
      } else {
        const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: here } });
        if (error) throw error;
        if (!data.session) {
          say(msg, "Account created. Check your email and click the confirmation link, then log in.", "ok");
        }
      }
    } catch (err) {
      say(msg, friendly(err), "err");
    } finally {
      btn.disabled = false;
    }
  });

  function friendly(err) {
    const m = String((err && err.message) || err || "");
    if (/invalid login credentials/i.test(m)) return "Wrong email or password.";
    if (/email not confirmed/i.test(m)) return "Please confirm your email first. Check your inbox.";
    if (/already registered|already been registered/i.test(m)) return "This email already has an account. Try logging in.";
    if (/rate limit/i.test(m)) return "Too many emails sent. Please wait a while and try again.";
    if (/password/i.test(m) && /(weak|short|least)/i.test(m)) return "Password is too weak. Use at least 8 characters.";
    return m || "Something went wrong. Please try again.";
  }

  $("forgot").addEventListener("click", async () => {
    const msg = $("authMsg");
    const email = $("email").value.trim();
    if (!validEmail(email)) return say(msg, "Type your email above first, then click Forgot password.", "err");
    say(msg, "Sending reset link...");
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: here });
    if (error) return say(msg, friendly(error), "err");
    say(msg, "If that email has an account, a reset link is on its way.", "ok");
  });

  /* ---------- set new password ---------- */
  $("recForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("recMsg");
    const pw = $("newPass").value;
    if (pw.length < 8) return say(msg, "Password must be at least 8 characters.", "err");
    const { error } = await sb.auth.updateUser({ password: pw });
    if (error) return say(msg, friendly(error), "err");
    recovering = false;
    say(msg, "");
    const { data } = await sb.auth.getSession();
    render(data.session);
  });

  /* ---------- profile ---------- */
  let currentUser = null;

  async function render(session) {
    if (recovering) return;
    if (!session) {
      currentUser = null;
      show("auth");
      return;
    }
    currentUser = session.user;
    show("profile");
    $("who").textContent = "Signed in as " + session.user.email;
    say($("profileMsg"), "Loading your profile...");
    const { data, error } = await sb.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
    if (error) return say($("profileMsg"), "Could not load your profile: " + error.message, "err");
    if (!data) {
      return say($("profileMsg"), "Your profile row was not found. Ask the site admin to check that the database setup (step1_database.sql) was run before you signed up.", "err");
    }
    $("displayName").value = data.display_name || "";
    $("bgmiName").value = data.bgmi_name || "";
    $("bgmiId").value = data.bgmi_id || "";
    $("roleBadge").textContent = data.role;
    $("roleBadge").classList.toggle("badge--admin", data.role === "admin");
    say($("profileMsg"), "");
  }

  $("profileForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("profileMsg");
    if (!currentUser) return;
    const bgmiId = $("bgmiId").value.trim();
    if (bgmiId && !/^[0-9]{5,15}$/.test(bgmiId)) return say(msg, "BGMI ID must be 5 to 15 digits (numbers only).", "err");
    say(msg, "Saving...");
    const { error } = await sb.from("profiles").update({
      display_name: $("displayName").value.trim().slice(0, 40),
      bgmi_name: $("bgmiName").value.trim().slice(0, 40) || null,
      bgmi_id: bgmiId || null,
    }).eq("id", currentUser.id);
    if (error) {
      if (error.code === "23505") return say(msg, "This BGMI ID is already linked to another account.", "err");
      if (error.code === "23514") return say(msg, "Please check your details: the BGMI ID must be 5 to 15 digits.", "err");
      return say(msg, "Could not save: " + error.message, "err");
    }
    say(msg, "Profile saved.", "ok");
  });

  $("logout").addEventListener("click", async () => {
    await sb.auth.signOut();
  });

  /* ---------- auth state ---------- */
  sb.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      recovering = true;
      show("rec");
      return;
    }
    // Do the real work outside the callback to avoid auth deadlocks.
    setTimeout(() => render(session), 0);
  });
  sb.auth.getSession().then(({ data }) => render(data.session));

  setMode("login");
})();
