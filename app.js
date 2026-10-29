// Fernway CRM demo — a fictional CRM used as a prop in a hob browser video.
// No backend. All state lives in this browser's localStorage under KEY.
// Nothing here sends a message or calls an external service.
(() => {
  'use strict';

  const KEY = 'fernway-crm-demo:v2';
  const SCHEMA = 2;
  // The call notes are dated Thu, Oct 29, 2026, so the demo's "today" is fixed to
  // that day by default. ?today=YYYY-MM-DD picks another day; ?today=live uses the clock.
  const DEMO_TODAY = '2026-10-29';
  const STAGE_RULE = 'Move to Negotiation only after the security review is complete.';
  const DEFAULT_RECORD = '#/contacts';
  const STAGES = ['Lead', 'Discovery', 'Proposal', 'Negotiation', 'Closed won', 'Closed lost'];
  const SAVE_DELAY_MS = 450;

  // ---------- dates ----------
  const pad = (n) => String(n).padStart(2, '0');
  const isoLocal = (dt) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
  const parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const dt = parseISO(s); dt.setDate(dt.getDate() + n); return isoLocal(dt); };
  const isISODate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !Number.isNaN(parseISO(s).getTime());
  const today = () => (state && state.pinnedToday) || isoLocal(new Date());
  const nowStamp = () => { const n = new Date(); return `${today()}T${pad(n.getHours())}:${pad(n.getMinutes())}`; };
  const dayDiff = (a, b) => Math.round((parseISO(a) - parseISO(b)) / 86400000);

  function fmtDay(iso) {
    const diff = dayDiff(iso, today());
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    const opts = { weekday: 'short', month: 'short', day: 'numeric' };
    if (parseISO(iso).getFullYear() !== parseISO(today()).getFullYear()) opts.year = 'numeric';
    return parseISO(iso).toLocaleDateString('en-US', opts);
  }
  // Task due labels always name the weekday so "Friday" reads on camera.
  const fmtDue = (iso) => (dayDiff(iso, today()) === 0 ? 'Today' : parseISO(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }));
  const fmtDate = (iso) => (isISODate(iso) ? parseISO(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '—');
  const fmtLongDay = (iso) => parseISO(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  function fmtTime(hm) {
    const [h, m] = hm.split(':').map(Number);
    return `${((h + 11) % 12) + 1}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`;
  }
  function fmtStamp(stamp) {
    const [day, hm] = stamp.split('T');
    return `${fmtDay(day)}, ${fmtTime(hm || '00:00')}`;
  }

  // ---------- state ----------
  let state = null;

  // pin: an ISO date, 'live' for the real clock, or empty for DEMO_TODAY.
  function seedState(pin) {
    const pinnedToday = pin === 'live' ? null : (pin || DEMO_TODAY);
    const base = window.FERNWAY_SEED(pinnedToday || isoLocal(new Date()), addDays);
    return { schema: SCHEMA, seededAt: new Date().toISOString(), pinnedToday, signedIn: true, ...base };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.schema === SCHEMA) return parsed;
      }
    } catch (_) { /* fall through to a fresh seed */ }
    return seedState(null);
  }

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) { /* private mode: keep in memory */ }
  }

  function resetDemo(pinnedToday) {
    state = seedState(pinnedToday);
    persist();
    ui = freshUI();
  }

  // URL controls: ?reset=1, ?today=YYYY-MM-DD (used with reset), ?signedout=1
  function applyUrlControls() {
    const params = new URLSearchParams(location.search);
    if (![...params.keys()].length) return;
    const t = params.get('today');
    const pin = t === 'live' || isISODate(t) ? t : null;
    if (params.has('reset')) resetDemo(pin);
    if (params.has('signedout')) { state.signedIn = false; persist(); }
    history.replaceState(null, '', location.pathname + (location.hash || ''));
  }

  const nextId = (prefix) => `${prefix}${state.nextId++}`;
  const contactById = (id) => state.contacts.find((c) => c.id === id);
  const accountById = (id) => state.accounts.find((a) => a.id === id);
  const initials = (name) => name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();

  // ---------- transient UI state ----------
  function freshUI() {
    return { editing: false, saving: false, addingTask: false, savingTask: false, errors: {}, draft: null, taskDraft: null, savedFields: [], savedAt: null, confirmReset: false };
  }
  let ui = freshUI();

  // ---------- helpers ----------
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name) => `<svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><use href="#i-${name}"/></svg>`;

  function route() {
    const hash = location.hash || '#/contacts';
    const [path, query] = hash.slice(1).split('?');
    const parts = path.split('/').filter(Boolean);
    return { parts, query: new URLSearchParams(query || '') };
  }

  let toastTimer = null;
  function toast(message) {
    const el = document.getElementById('toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }

  // ---------- shell ----------
  function renderShell() {
    const app = document.getElementById('app');
    if (!state.signedIn) {
      app.innerHTML = renderSignIn();
      document.title = 'Sign in · Fernway CRM';
      return;
    }
    const { parts } = route();
    const section = parts[0] || 'contacts';
    const navItem = (href, key, label, ic) =>
      `<a href="${href}" class="nav-item${section === key ? ' active' : ''}"${section === key ? ' aria-current="page"' : ''}>${icon(ic)}<span>${label}</span></a>`;
    const openTasks = state.tasks.filter((t) => !t.done && t.assignee === state.user.name).length;
    app.innerHTML = `
      <div class="shell">
        <aside class="sidebar" aria-label="Main">
          <div class="brand">${logo()}<span>Fernway</span></div>
          <nav class="nav" aria-label="Primary">
            ${navItem('#/contacts', 'contacts', 'Contacts', 'users')}
            ${navItem('#/accounts', 'accounts', 'Accounts', 'building')}
            <a href="#/tasks" class="nav-item${section === 'tasks' ? ' active' : ''}"${section === 'tasks' ? ' aria-current="page"' : ''}>${icon('check')}<span>My tasks</span><span class="count" aria-label="${openTasks} open">${openTasks}</span></a>
          </nav>
          <div class="sidebar-foot">
            ${navItem('#/demo', 'demo', 'Demo data', 'reset')}
            <p class="fiction">Fictional demo CRM. All data is made up and stays in this browser.</p>
          </div>
        </aside>
        <div class="main">
          <header class="topbar">
            <form class="search" role="search" data-form="search">
              ${icon('search')}
              <label class="sr-only" for="global-search">Search contacts</label>
              <input id="global-search" name="q" type="search" placeholder="Search contacts" autocomplete="off">
            </form>
            <div class="me">
              <span class="avatar sm" aria-hidden="true">${initials(state.user.name)}</span>
              <span class="me-name">${esc(state.user.name)}</span>
              <button type="button" class="btn ghost sm" data-action="sign-out">Sign out</button>
            </div>
          </header>
          <main id="view" class="view" tabindex="-1"></main>
        </div>
      </div>
      <div id="toast" class="toast" role="status" aria-live="polite"></div>`;
    renderView();
  }

  function renderView() {
    const view = document.getElementById('view');
    if (!view) return;
    const { parts, query } = route();
    let html;
    let title;
    if (parts[0] === 'contacts' && parts[1]) {
      const c = contactById(parts[1]);
      html = c ? renderContact(c) : renderMissing();
      title = c ? c.name : 'Not found';
    } else if (parts[0] === 'accounts') {
      html = renderAccounts(); title = 'Accounts';
    } else if (parts[0] === 'tasks') {
      html = renderTasks(); title = 'My tasks';
    } else if (parts[0] === 'demo') {
      html = renderDemo(); title = 'Demo data';
    } else {
      html = renderContacts(query.get('q') || ''); title = 'Contacts';
    }
    view.innerHTML = html;
    document.title = `${title} · Fernway CRM`;
  }

  function logo() {
    return `<svg class="logo" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="var(--accent)"/><path d="M10 23c0-8 5-13 13-14-1 8-6 13-13 14Zm0 0 7-7" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  // ---------- sign in ----------
  function renderSignIn() {
    return `
      <main class="signin">
        <form class="signin-card" data-form="sign-in" aria-labelledby="signin-h">
          <div class="brand center">${logo()}<span>Fernway</span></div>
          <h1 id="signin-h">Sign in to your workspace</h1>
          <label for="signin-email">Email</label>
          <input id="signin-email" name="email" type="email" autocomplete="username" value="${esc(state.user.email)}" required>
          <label for="signin-password">Password</label>
          <input id="signin-password" name="password" type="password" autocomplete="current-password" required>
          <p class="error" id="signin-error" role="alert"></p>
          <button type="submit" class="btn primary block">Sign in</button>
          <p class="hint">Demo workspace. Any password works, and nothing leaves this browser.</p>
        </form>
      </main>`;
  }

  // ---------- contacts list ----------
  function lastActivity(contactId) {
    const items = state.activities.filter((a) => a.contactId === contactId && a.at.split('T')[0] <= today());
    items.sort((a, b) => b.at.localeCompare(a.at));
    return items[0];
  }

  function renderContacts(q) {
    const needle = q.trim().toLowerCase();
    const rows = state.contacts.filter((c) => {
      if (!needle) return true;
      const acct = accountById(c.accountId);
      return [c.name, c.role, c.email, acct && acct.name].some((v) => (v || '').toLowerCase().includes(needle));
    });
    return `
      <div class="page-head">
        <div><h1>Contacts</h1><p class="sub">${rows.length} of ${state.contacts.length} contacts</p></div>
        <form class="filter" data-form="filter" role="search">
          <label class="sr-only" for="contact-filter">Filter contacts</label>
          <input id="contact-filter" name="q" type="search" placeholder="Filter by name, role or account" value="${esc(q)}">
        </form>
      </div>
      <div class="card table-card">
        <table class="table">
          <thead><tr><th scope="col">Name</th><th scope="col">Role</th><th scope="col">Account</th><th scope="col">Status</th><th scope="col">Owner</th><th scope="col">Last activity</th></tr></thead>
          <tbody>
            ${rows.map((c) => {
              const acct = accountById(c.accountId);
              const last = lastActivity(c.id);
              return `<tr>
                <td><a class="person" href="#/contacts/${c.id}"><span class="avatar sm" aria-hidden="true">${initials(c.name)}</span>${esc(c.name)}</a></td>
                <td>${esc(c.role)}</td>
                <td>${esc(acct ? acct.name : '—')}</td>
                <td><span class="pill ${statusClass(c.status)}">${esc(c.status)}</span></td>
                <td>${esc(c.owner)}</td>
                <td class="muted">${last ? esc(fmtDay(last.at.split('T')[0])) : '—'}</td>
              </tr>`;
            }).join('') || `<tr><td colspan="6" class="empty">No contacts match “${esc(q)}”.</td></tr>`}
          </tbody>
        </table>
      </div>`;
  }

  const statusClass = (s) => ({ Customer: 'green', Opportunity: 'blue', Lead: 'amber' }[s] || '');
  const stageClass = (s) => ({ 'Closed won': 'green', 'Closed lost': 'red', Negotiation: 'violet', Proposal: 'blue', Discovery: 'amber' }[s] || '');

  // ---------- accounts ----------
  function renderAccounts() {
    return `
      <div class="page-head"><div><h1>Accounts</h1><p class="sub">${state.accounts.length} accounts</p></div></div>
      <div class="card table-card">
        <table class="table">
          <thead><tr><th scope="col">Account</th><th scope="col">Industry</th><th scope="col">Location</th><th scope="col" class="num">Licensed</th><th scope="col" class="num">Proposed</th><th scope="col">Deal stage</th><th scope="col">Contacts</th></tr></thead>
          <tbody>
            ${state.accounts.map((a) => {
              const people = state.contacts.filter((c) => c.accountId === a.id);
              return `<tr>
                <td><span class="acct-name"><span class="acct-mark" aria-hidden="true">${esc(a.name[0])}</span>${esc(a.name)}</span></td>
                <td>${esc(a.industry)}</td>
                <td>${esc(a.location)}</td>
                <td class="num">${esc(a.licensedSeats)}</td>
                <td class="num">${esc(a.proposedSeats)}</td>
                <td><span class="pill ${stageClass(a.stage)}">${esc(a.stage)}</span></td>
                <td>${people.map((p) => `<a href="#/contacts/${p.id}">${esc(p.name)}</a>`).join(', ') || '—'}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  }

  // ---------- contact record ----------
  function renderContact(c) {
    const acct = accountById(c.accountId);
    const open = state.tasks.filter((t) => t.contactId === c.id && !t.done).sort((a, b) => a.due.localeCompare(b.due));
    const done = state.tasks.filter((t) => t.contactId === c.id && t.done).sort((a, b) => b.doneAt.localeCompare(a.doneAt));
    // Newest first; entries saved in the same minute keep their save order (latest on top).
    const acts = state.activities.map((a, i) => [a, i]).filter(([a]) => a.contactId === c.id)
      .sort(([a, i], [b, j]) => b.at.localeCompare(a.at) || j - i).map(([a]) => a);
    return `
      <nav class="crumbs" aria-label="Breadcrumb"><a href="#/contacts">Contacts</a><span aria-hidden="true">/</span><span aria-current="page">${esc(c.name)}</span></nav>
      <header class="record-head">
        <span class="avatar lg" aria-hidden="true">${initials(c.name)}</span>
        <div class="record-title">
          <h1>${esc(c.name)}</h1>
          <p class="sub" data-testid="contact-summary">${esc(c.role)} · ${esc(acct ? acct.name : '—')}</p>
          <p class="meta"><span class="pill ${statusClass(c.status)}">${esc(c.status)}</span><span>Owner ${esc(c.owner)}</span><span>Updated <time datetime="${esc(c.updatedAt)}">${esc(fmtStamp(c.updatedAt))}</time></span></p>
        </div>
        <div class="head-actions">
          <button type="button" class="btn" data-action="edit"${ui.editing ? ' disabled' : ''}>${icon('edit')}Edit details</button>
          <button type="button" class="btn primary" data-action="add-task"${ui.addingTask ? ' disabled' : ''}>${icon('plus')}Add task</button>
        </div>
      </header>
      <div class="record-grid">
        ${renderDetails(c, acct)}
        <div class="stack">
          ${renderContactTasks(c, open, done)}
          ${renderActivity(c, acts)}
        </div>
      </div>`;
  }

  // Editable deal fields on the contact record. key → [label, kind]
  const DEAL_FIELDS = [
    ['licensedSeats', 'Licensed seats', 'int'],
    ['proposedSeats', 'Proposed seats', 'int'],
    ['stage', 'Deal stage', 'stage'],
    ['decisionDate', 'Decision date', 'date'],
    ['rolloutPlan', 'Rollout plan', 'text'],
    ['nextStep', 'Next step', 'text'],
    ['blockers', 'Blockers', 'text'],
  ];
  const showValue = (kind, v) => (kind === 'date' ? fmtDate(v) : (v === '' || v == null ? '—' : String(v)));

  function renderDetails(c, acct) {
    const saved = (f) => (ui.savedFields.includes(f) ? ' just-saved' : '');
    const status = ui.saving ? 'Saving…' : ui.savedAt ? `Saved · ${fmtStamp(ui.savedAt)}` : '';
    const a = acct || {};
    if (!ui.editing) {
      const teamTitle = (name) => ((state.team || []).find((m) => m.name === name) || {}).title || '';
      return `
        <section class="card details" aria-labelledby="details-h">
          <div class="card-head"><h2 id="details-h">Details</h2><p class="saved-note" role="status" id="details-status" data-testid="details-status">${esc(status)}</p></div>
          <h3 class="group">Contact</h3>
          <dl class="fields">
            <div class="field${saved('role')}"><dt>Role</dt><dd data-testid="field-role">${esc(c.role)}</dd></div>
            <div class="field"><dt>Phone</dt><dd>${esc(c.phone)}</dd></div>
            <div class="field wide"><dt>Email</dt><dd>${esc(c.email)}</dd></div>
          </dl>
          <h3 class="group">Deal · ${esc(a.dealName || '—')}</h3>
          <dl class="fields">
            <div class="field${saved('accountId')}"><dt>Account</dt><dd data-testid="field-account">${esc(a.name || '—')}</dd></div>
            <div class="field${saved('stage')}"><dt>Deal stage</dt><dd data-testid="field-stage"><span class="pill ${stageClass(a.stage)}">${esc(a.stage || '—')}</span></dd></div>
            <div class="field${saved('licensedSeats')}"><dt>Licensed seats</dt><dd data-testid="field-licensed-seats">${esc(showValue('int', a.licensedSeats))}</dd></div>
            <div class="field${saved('proposedSeats')}"><dt>Proposed seats</dt><dd data-testid="field-proposed-seats">${esc(showValue('int', a.proposedSeats))}</dd></div>
            <div class="field wide${saved('decisionDate')}"><dt>Decision date</dt><dd data-testid="field-decision-date">${esc(fmtDate(a.decisionDate))}</dd></div>
            <div class="field wide${saved('rolloutPlan')}"><dt>Rollout plan</dt><dd data-testid="field-rollout-plan">${esc(showValue('text', a.rolloutPlan))}</dd></div>
            <div class="field wide${saved('nextStep')}"><dt>Next step</dt><dd data-testid="field-next-step">${esc(showValue('text', a.nextStep))}</dd></div>
            <div class="field wide${saved('blockers')}"><dt>Blockers</dt><dd data-testid="field-blockers"${a.blockers ? ' class="blocker"' : ''}>${esc(showValue('text', a.blockers))}</dd></div>
          </dl>
          <p class="rule" data-testid="stage-rule">${icon('info')}<span><strong>Stage rule:</strong> ${esc(STAGE_RULE)}</span></p>
          <h3 class="group">Account team</h3>
          <ul class="team" aria-label="Team members">
            ${(state.team || []).map((m) => `<li><span class="avatar xs" aria-hidden="true">${initials(m.name)}</span><span class="team-name">${esc(m.name)}</span><span class="muted">${esc(m.title)}</span></li>`).join('')}
          </ul>
          <p class="hint">Owner: ${esc(c.owner)}${teamTitle(c.owner) ? ` (${esc(teamTitle(c.owner))})` : ''}</p>
        </section>`;
    }
    const v = ui.draft || {
      role: c.role, accountId: c.accountId,
      licensedSeats: String(a.licensedSeats ?? ''), proposedSeats: String(a.proposedSeats ?? ''),
      stage: a.stage || '', decisionDate: a.decisionDate || '', rolloutPlan: a.rolloutPlan || '', nextStep: a.nextStep || '', blockers: a.blockers || '',
    };
    const err = (k) => (ui.errors[k] ? `<p class="error" id="err-${k}">${esc(ui.errors[k])}</p>` : '');
    const inv = (k) => (ui.errors[k] ? ` aria-invalid="true" aria-describedby="err-${k}"` : '');
    const dis = ui.saving ? ' disabled' : '';
    return `
      <section class="card details editing" aria-labelledby="details-h">
        <div class="card-head"><h2 id="details-h">Edit details</h2><p class="saved-note" role="status" id="details-status" data-testid="details-status">${esc(status)}</p></div>
        <form data-form="details" aria-label="Edit contact details" novalidate>
          <h3 class="group">Contact</h3>
          <label for="f-role">Role</label>
          <input id="f-role" name="role" type="text" value="${esc(v.role)}"${inv('role')}${dis}>
          ${err('role')}
          <h3 class="group">Deal · ${esc(a.dealName || '—')}</h3>
          <div class="row2">
            <div>
              <label for="f-account">Account</label>
              <select id="f-account" name="accountId"${dis}>
                ${state.accounts.map((x) => `<option value="${x.id}"${x.id === v.accountId ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}
              </select>
            </div>
            <div>
              <label for="f-stage">Deal stage</label>
              <select id="f-stage" name="stage" aria-describedby="f-stage-rule"${dis}>
                ${STAGES.map((x) => `<option${x === v.stage ? ' selected' : ''}>${esc(x)}</option>`).join('')}
              </select>
            </div>
          </div>
          <p class="hint" id="f-stage-rule">${esc(STAGE_RULE)}</p>
          <div class="row2">
            <div>
              <label for="f-licensed">Licensed seats</label>
              <input id="f-licensed" name="licensedSeats" type="number" min="0" step="1" inputmode="numeric" value="${esc(v.licensedSeats)}" aria-describedby="f-licensed-hint"${inv('licensedSeats')}${dis}>
              <p class="hint" id="f-licensed-hint">Seats under a signed order.</p>
              ${err('licensedSeats')}
            </div>
            <div>
              <label for="f-proposed">Proposed seats</label>
              <input id="f-proposed" name="proposedSeats" type="number" min="0" step="1" inputmode="numeric" value="${esc(v.proposedSeats)}" aria-describedby="f-proposed-hint"${inv('proposedSeats')}${dis}>
              <p class="hint" id="f-proposed-hint">Total seats in this deal.</p>
              ${err('proposedSeats')}
            </div>
          </div>
          <label for="f-decision">Decision date</label>
          <input id="f-decision" name="decisionDate" type="date" value="${esc(v.decisionDate)}"${inv('decisionDate')}${dis}>
          ${err('decisionDate')}
          <label for="f-rollout">Rollout plan</label>
          <textarea id="f-rollout" name="rolloutPlan" rows="2"${dis}>${esc(v.rolloutPlan)}</textarea>
          <label for="f-next">Next step</label>
          <textarea id="f-next" name="nextStep" rows="2"${dis}>${esc(v.nextStep)}</textarea>
          <label for="f-blockers">Blockers</label>
          <textarea id="f-blockers" name="blockers" rows="2"${dis}>${esc(v.blockers)}</textarea>
          <div class="form-actions">
            <button type="button" class="btn ghost" data-action="cancel-edit"${dis}>Cancel</button>
            <button type="submit" class="btn primary"${dis}>${ui.saving ? 'Saving…' : 'Save changes'}</button>
          </div>
        </form>
      </section>`;
  }

  function renderContactTasks(c, open, done) {
    const dueClass = (t) => { const diff = dayDiff(t.due, today()); return diff < 0 ? 'red' : diff === 0 ? 'amber' : ''; };
    const item = (t) => `
      <li class="task${t.done ? ' done' : ''}${t.id === ui.newTaskId ? ' just-saved' : ''}" data-testid="task-${t.id}">
        <input type="checkbox" id="cb-${t.id}" data-action="toggle-task" data-id="${t.id}"${t.done ? ' checked' : ''}>
        <label for="cb-${t.id}" class="task-title"><span class="sr-only">${t.done ? 'Reopen' : 'Mark complete'}: </span>${esc(t.title)}</label>
        <span class="task-meta"><span class="pill ${t.done ? '' : dueClass(t)}" title="${esc(fmtLongDay(t.due))}">${icon('calendar')}${esc(fmtDue(t.due))}</span><span class="muted">${esc(t.assignee)}</span></span>
      </li>`;
    return `
      <section class="card" aria-labelledby="tasks-h">
        <div class="card-head"><h2 id="tasks-h">Tasks <span class="count">${open.length}</span></h2></div>
        ${ui.addingTask ? renderTaskForm(c) : ''}
        ${open.length ? `<ul class="tasks" aria-label="Open tasks">${open.map(item).join('')}</ul>` : `<p class="empty">No open tasks for ${esc(c.name.split(' ')[0])}.</p>`}
        ${done.length ? `<details class="completed"><summary>Completed (${done.length})</summary><ul class="tasks" aria-label="Completed tasks">${done.map(item).join('')}</ul></details>` : ''}
      </section>`;
  }

  function renderTaskForm(c) {
    const v = ui.taskDraft || { title: '', due: '', assignee: state.user.name };
    const err = (k) => (ui.errors[k] ? `<p class="error" id="err-${k}">${esc(ui.errors[k])}</p>` : '');
    const inv = (k) => (ui.errors[k] ? ` aria-invalid="true" aria-describedby="err-${k}"` : '');
    const dis = ui.savingTask ? ' disabled' : '';
    const people = (state.team || []).map((m) => m.name);
    return `
      <form class="task-form" data-form="task" aria-label="New task" novalidate>
        <label for="t-title">Task title</label>
        <input id="t-title" name="title" type="text" placeholder="e.g. Send revised quote" value="${esc(v.title)}"${inv('title')}${dis}>
        ${err('title')}
        <div class="row2">
          <div>
            <label for="t-due">Due date</label>
            <input id="t-due" name="due" type="date" value="${esc(v.due)}"${inv('due')}${dis} aria-describedby="t-due-hint">
            <p class="hint" id="t-due-hint">${v.due && isISODate(v.due) ? esc(fmtLongDay(v.due)) : 'Pick a date'}</p>
            ${err('due')}
          </div>
          <div>
            <label for="t-assignee">Assignee</label>
            <select id="t-assignee" name="assignee"${dis}>
              ${people.map((p) => `<option value="${esc(p)}"${p === v.assignee ? ' selected' : ''}>${esc(p)}</option>`).join('')}
            </select>
          </div>
        </div>
        <input type="hidden" name="contactId" value="${esc(c.id)}">
        <div class="form-actions">
          <button type="button" class="btn ghost" data-action="cancel-task"${dis}>Cancel</button>
          <button type="submit" class="btn primary"${dis}>${ui.savingTask ? 'Saving…' : 'Save task'}</button>
        </div>
      </form>`;
  }

  function renderActivity(c, acts) {
    const typeIcon = { call: 'phone', email: 'mail', meeting: 'calendar', note: 'note', task: 'check', update: 'edit', created: 'user' };
    return `
      <section class="card" aria-labelledby="activity-h">
        <div class="card-head"><h2 id="activity-h">Activity</h2></div>
        <form class="note-form" data-form="note" aria-label="Add note">
          <label for="n-body" class="sr-only">Note text</label>
          <textarea id="n-body" name="body" rows="2" placeholder="Log a call or add a note about ${esc(c.name.split(' ')[0])}…"></textarea>
          <input type="hidden" name="contactId" value="${esc(c.id)}">
          <div class="form-actions">
            <p class="error" id="err-note" role="alert">${esc(ui.errors.note || '')}</p>
            <label for="n-type" class="inline-label">Activity type</label>
            <select id="n-type" name="type" class="sm-select"><option value="note">Note</option><option value="call">Call</option><option value="meeting">Meeting</option></select>
            <button type="submit" class="btn sm">Add note</button>
          </div>
        </form>
        <ol class="timeline" aria-label="Activity history">
          ${acts.map((a) => `
            <li class="event ev-${a.type}${a.id === ui.newActivityId ? ' just-saved' : ''}">
              <span class="event-icon" aria-hidden="true">${icon(typeIcon[a.type] || 'note')}</span>
              <div class="event-body">
                <p class="event-title">${esc(a.title)}</p>
                ${a.changes ? `<ul class="changes">${a.changes.map((ch) => `<li><span class="ch-field">${esc(ch.field)}</span><span class="ch-from">${esc(ch.from)}</span><span class="ch-arrow" aria-label="changed to">→</span><span class="ch-to">${esc(ch.to)}</span></li>`).join('')}</ul>` : ''}
                ${a.body ? `<p class="event-text">${esc(a.body)}</p>` : ''}
                <p class="event-meta"><time datetime="${esc(a.at)}">${esc(fmtStamp(a.at))}</time> · ${esc(a.author)}</p>
              </div>
            </li>`).join('')}
        </ol>
      </section>`;
  }

  // ---------- my tasks ----------
  function renderTasks() {
    const mine = state.tasks.filter((t) => !t.done && t.assignee === state.user.name).sort((a, b) => a.due.localeCompare(b.due));
    const t0 = today();
    const groups = [
      ['Overdue', (t) => t.due < t0],
      ['Today', (t) => t.due === t0],
      ['Tomorrow', (t) => t.due === addDays(t0, 1)],
      ['Next 7 days', (t) => t.due > addDays(t0, 1) && t.due <= addDays(t0, 7)],
      ['Later', (t) => t.due > addDays(t0, 7)],
    ];
    const row = (t) => {
      const c = contactById(t.contactId);
      const acct = c && accountById(c.accountId);
      return `<li class="task row${t.id === ui.newTaskId ? ' just-saved' : ''}" data-testid="task-${t.id}">
        <input type="checkbox" id="mt-${t.id}" data-action="toggle-task" data-id="${t.id}">
        <label for="mt-${t.id}" class="task-title"><span class="sr-only">Mark complete: </span>${esc(t.title)}</label>
        <span class="task-meta">${c ? `<a href="#/contacts/${c.id}">${esc(c.name)}</a><span class="muted">${esc(acct ? acct.name : '')}</span>` : ''}<span class="pill" title="${esc(fmtLongDay(t.due))}">${icon('calendar')}${esc(fmtDue(t.due))}</span></span>
      </li>`;
    };
    return `
      <div class="page-head"><div><h1>My tasks</h1><p class="sub">${mine.length} open · assigned to ${esc(state.user.name)}</p></div></div>
      ${groups.map(([label, test]) => {
        const items = mine.filter(test);
        if (!items.length) return '';
        return `<section class="card task-group" aria-labelledby="g-${label.replace(/\W/g, '')}"><div class="card-head"><h2 id="g-${label.replace(/\W/g, '')}">${label} <span class="count">${items.length}</span></h2></div><ul class="tasks" aria-label="${label} tasks">${items.map(row).join('')}</ul></section>`;
      }).join('') || '<div class="card"><p class="empty">No open tasks.</p></div>'}`;
  }

  // ---------- demo data ----------
  function renderDemo() {
    return `
      <div class="page-head"><div><h1>Demo data</h1><p class="sub">Fernway is a fictional CRM. It has no server; every change is stored in this browser only.</p></div></div>
      <section class="card demo-card" aria-labelledby="reset-h">
        <h2 id="reset-h">Reset</h2>
        <p>Restores the seeded contacts, accounts, tasks and activity.</p>
        <p class="muted">Seeded ${esc(new Date(state.seededAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }))}${state.pinnedToday ? ` · “Today” pinned to ${esc(fmtLongDay(state.pinnedToday))}` : ''}</p>
        ${ui.confirmReset
          ? `<div class="confirm" role="group" aria-label="Confirm reset"><p>Replace all changes in this browser with the seed data?</p><button type="button" class="btn danger" data-action="reset-confirm">Reset demo data</button><button type="button" class="btn ghost" data-action="reset-cancel">Cancel</button></div>`
          : `<button type="button" class="btn" data-action="reset-ask">${icon('reset')}Reset demo data…</button>`}
        <p class="hint">Shortcut: open the page with <code>?reset=1</code>, for example <code>${esc(location.origin + location.pathname)}?reset=1#/contacts</code>. The demo treats Thu, Oct 29, 2026 as today, to match the call notes. Add <code>&amp;today=YYYY-MM-DD</code> to pick another day, or <code>&amp;today=live</code> to use the real date.</p>
      </section>`;
  }

  function renderMissing() {
    return `<div class="card"><h1>Contact not found</h1><p><a href="#/contacts">Back to contacts</a></p></div>`;
  }

  // ---------- actions ----------
  function startEdit() {
    ui.editing = true; ui.errors = {}; ui.draft = null; ui.savedFields = []; ui.savedAt = null;
    renderView();
    const el = document.getElementById('f-role');
    if (el) el.focus();
  }

  function saveDetails(form) {
    const c = contactById(route().parts[1]);
    if (!c) return;
    const fd = new FormData(form);
    const val = (k) => String(fd.get(k) || '').trim();
    const draft = { role: val('role'), accountId: val('accountId') };
    DEAL_FIELDS.forEach(([k]) => { draft[k] = val(k); });
    const errors = {};
    if (!draft.role) errors.role = 'Enter a role.';
    ['licensedSeats', 'proposedSeats'].forEach((k) => { if (!/^\d+$/.test(draft[k])) errors[k] = 'Enter a whole number, 0 or more.'; });
    if (draft.decisionDate && !isISODate(draft.decisionDate)) errors.decisionDate = 'Enter a date.';
    ui.draft = draft; ui.errors = errors;
    if (Object.keys(errors).length) { renderView(); focusFirstInvalid(); return; }

    ui.saving = true;
    renderView();
    setTimeout(() => {
      const oldAcct = accountById(c.accountId);
      const newAcct = accountById(draft.accountId);
      const changes = [];
      const fields = [];
      if (draft.role !== c.role) { changes.push({ field: 'Role', from: c.role, to: draft.role }); fields.push('role'); c.role = draft.role; }
      if (draft.accountId !== c.accountId) { changes.push({ field: 'Account', from: oldAcct ? oldAcct.name : '—', to: newAcct.name }); fields.push('accountId'); c.accountId = draft.accountId; }
      if (newAcct) {
        DEAL_FIELDS.forEach(([k, label, kind]) => {
          const next = kind === 'int' ? Number(draft[k]) : draft[k];
          const prev = newAcct[k] == null ? '' : newAcct[k];
          if (next === prev) return;
          changes.push({ field: label, from: showValue(kind, prev), to: showValue(kind, next) });
          fields.push(k);
          newAcct[k] = next;
        });
      }
      const stamp = nowStamp();
      ui.newActivityId = null;
      if (changes.length) {
        c.updatedAt = stamp;
        const id = nextId('a');
        state.activities.push({ id, contactId: c.id, type: 'update', at: stamp, author: state.user.name, title: 'Details updated', body: '', changes });
        ui.newActivityId = id;
      }
      persist();
      ui.saving = false; ui.editing = false; ui.draft = null; ui.errors = {};
      ui.savedFields = fields; ui.savedAt = changes.length ? stamp : null;
      renderView();
      toast(changes.length ? `Saved ${changes.length} change${changes.length > 1 ? 's' : ''} to ${c.name}` : 'No changes to save');
      const btn = document.querySelector('[data-action="edit"]');
      if (btn) btn.focus();
    }, SAVE_DELAY_MS);
  }

  function startTask() {
    ui.addingTask = true; ui.errors = {}; ui.taskDraft = null;
    renderView();
    const el = document.getElementById('t-title');
    if (el) el.focus();
  }

  function saveTask(form) {
    const fd = new FormData(form);
    const draft = {
      title: String(fd.get('title') || '').trim(),
      due: String(fd.get('due') || ''),
      assignee: String(fd.get('assignee') || state.user.name),
      contactId: String(fd.get('contactId') || ''),
    };
    const errors = {};
    if (!draft.title) errors.title = 'Enter a task.';
    if (!isISODate(draft.due)) errors.due = 'Choose a due date.';
    ui.taskDraft = draft; ui.errors = errors;
    if (Object.keys(errors).length) { renderView(); focusFirstInvalid(); return; }

    ui.savingTask = true;
    renderView();
    setTimeout(() => {
      const stamp = nowStamp();
      const id = nextId('t');
      state.tasks.push({ id, contactId: draft.contactId, title: draft.title, due: draft.due, assignee: draft.assignee, done: false, createdAt: stamp });
      const aid = nextId('a');
      state.activities.push({ id: aid, contactId: draft.contactId, type: 'task', at: stamp, author: state.user.name, title: `Task created: ${draft.title}`, body: `Due ${fmtLongDay(draft.due)} · Assigned to ${draft.assignee}` });
      persist();
      ui.savingTask = false; ui.addingTask = false; ui.taskDraft = null; ui.errors = {};
      ui.newTaskId = id; ui.newActivityId = aid;
      renderShell();
      toast(`Task added · Due ${fmtDue(draft.due)}`);
    }, SAVE_DELAY_MS);
  }

  function toggleTask(id, checked) {
    const t = state.tasks.find((x) => x.id === id);
    if (!t) return;
    const stamp = nowStamp();
    t.done = checked;
    t.doneAt = checked ? stamp : null;
    const aid = nextId('a');
    state.activities.push({ id: aid, contactId: t.contactId, type: 'task', at: stamp, author: state.user.name, title: `${checked ? 'Task completed' : 'Task reopened'}: ${t.title}`, body: '' });
    persist();
    ui.newActivityId = aid; ui.newTaskId = null;
    renderShell();
    toast(checked ? 'Task completed' : 'Task reopened');
  }

  function addNote(form) {
    const fd = new FormData(form);
    const body = String(fd.get('body') || '').trim();
    if (!body) { ui.errors = { note: 'Write a note first.' }; renderView(); return; }
    const id = nextId('a');
    const type = ['note', 'call', 'meeting'].includes(fd.get('type')) ? fd.get('type') : 'note';
    const title = { note: 'Note', call: 'Call summary', meeting: 'Meeting notes' }[type];
    state.activities.push({ id, contactId: String(fd.get('contactId')), type, at: nowStamp(), author: state.user.name, title, body });
    persist();
    ui.errors = {}; ui.newActivityId = id;
    renderView();
    toast(type === 'note' ? 'Note added' : `${title} logged`);
  }

  function focusFirstInvalid() {
    const el = document.querySelector('[aria-invalid="true"]');
    if (el) el.focus();
  }

  // ---------- events ----------
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    if (action === 'toggle-task') return; // handled on change
    e.preventDefault();
    switch (action) {
      case 'edit': startEdit(); break;
      case 'cancel-edit': ui.editing = false; ui.draft = null; ui.errors = {}; renderView(); break;
      case 'add-task': startTask(); break;
      case 'cancel-task': ui.addingTask = false; ui.taskDraft = null; ui.errors = {}; renderView(); break;
      case 'sign-out': state.signedIn = false; persist(); ui = freshUI(); renderShell(); break;
      case 'reset-ask': ui.confirmReset = true; renderView(); break;
      case 'reset-cancel': ui.confirmReset = false; renderView(); break;
      case 'reset-confirm': resetDemo(state.pinnedToday || 'live'); renderShell(); toast('Demo data reset'); break;
      default: break;
    }
  });

  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.matches('[data-action="toggle-task"]')) toggleTask(el.dataset.id, el.checked);
  });

  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.id === 't-due') {
      const hint = document.getElementById('t-due-hint');
      if (hint) hint.textContent = isISODate(el.value) ? fmtLongDay(el.value) : 'Pick a date';
    }
  });

  document.addEventListener('submit', (e) => {
    const form = e.target;
    const kind = form.dataset.form;
    if (!kind) return;
    e.preventDefault();
    if (kind === 'details' && !ui.saving) saveDetails(form);
    else if (kind === 'task' && !ui.savingTask) saveTask(form);
    else if (kind === 'note') addNote(form);
    else if (kind === 'search' || kind === 'filter') {
      const q = String(new FormData(form).get('q') || '').trim();
      location.hash = q ? `#/contacts?q=${encodeURIComponent(q)}` : '#/contacts';
    } else if (kind === 'sign-in') {
      const fd = new FormData(form);
      if (!String(fd.get('email') || '').trim() || !String(fd.get('password') || '')) {
        document.getElementById('signin-error').textContent = 'Enter your email and password.';
        return;
      }
      state.signedIn = true; persist();
      if (!location.hash || location.hash === '#/' || location.hash === '#') location.hash = DEFAULT_RECORD;
      renderShell();
    }
  });

  window.addEventListener('hashchange', () => {
    ui = freshUI();
    if (!state.signedIn) { renderShell(); return; }
    renderShell();
    const view = document.getElementById('view');
    if (view) view.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  });

  // Keep two tabs or panes on the same origin in step.
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    state = loadState();
    if (!ui.editing && !ui.addingTask) renderShell();
  });

  // ---------- boot ----------
  state = loadState();
  persist();
  applyUrlControls();
  renderShell();
})();
