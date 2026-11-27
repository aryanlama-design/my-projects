const get = (id) => document.getElementById(id);

// ----- 1. Data & Storage -----
let users = JSON.parse(localStorage.getItem("ep_users")) || [
  { id: "u1", name: "Admin", email: "admin@event.com", pass: "admin123", role: "admin" },
  { id: "u2", name: "Org", email: "org@event.com", pass: "org123", role: "organizer" },
  { id: "u3", name: "Alex", email: "alex@event.com", pass: "alex123", role: "attendee" }
];

let events = JSON.parse(localStorage.getItem("ep_events")) || [
  { id: "e1", title: "Tech Fest", cat: "Conference", date: "2026-11-10", venue: "Hall A", cap: 50, desc: "Tech talks", org: "u2", status: "Approved" },
  { id: "e2", title: "Concert", cat: "Concert", date: "2026-11-30", venue: "Ground", cap: 100, desc: "Music night", org: "u2", status: "Pending" }
];

let regs = JSON.parse(localStorage.getItem("ep_regs")) || [];
let currentUser = JSON.parse(localStorage.getItem("ep_session")) || null;

// Make sure the three pre-set accounts always exist (in case stale
// localStorage from an older version lost them)
const defaultUsers = [
  { id: "u1", name: "Admin", email: "admin@event.com", pass: "admin123", role: "admin" },
  { id: "u2", name: "Org", email: "org@event.com", pass: "org123", role: "organizer" },
  { id: "u3", name: "Alex", email: "alex@event.com", pass: "alex123", role: "attendee" }
];
defaultUsers.forEach(d => {
  if (!users.some(u => String(u.email).toLowerCase() === d.email)) users.push(d);
});
save();

function save() {
  localStorage.setItem("ep_users", JSON.stringify(users));
  localStorage.setItem("ep_events", JSON.stringify(events));
  localStorage.setItem("ep_regs", JSON.stringify(regs));
}

// ----- 2. Authentication -----
function doLogin(e) {
  if (e) e.preventDefault();
  const email = get("loginEmail").value.trim().toLowerCase();
  const pass = get("loginPassword").value.trim();
  const user = users.find(u => String(u.email).toLowerCase() === email && String(u.pass) === pass);

  if (!user) return (get("loginError").textContent = "Wrong email or password");

  get("loginError").textContent = "";
  currentUser = user;
  localStorage.setItem("ep_session", JSON.stringify(user));
  get("loginForm").reset();
  startApp();
}

function doRegister(e) {
  if (e) e.preventDefault();
  const name = get("regName").value.trim();
  const email = get("regEmail").value.trim().toLowerCase();
  const pass = get("regPassword").value;
  const role = get("regRole").value;

  if (users.some(u => u.email === email)) return (get("registerError").textContent = "Email taken");
  if (name.length < 2 || pass.length < 6) return (get("registerError").textContent = "Name min 2, pass min 6");

  get("registerError").textContent = "";
  const newUser = { id: "u" + Date.now(), name, email, pass, role };
  users.push(newUser);
  save();

  currentUser = newUser;
  localStorage.setItem("ep_session", JSON.stringify(newUser));
  get("registerForm").reset();
  startApp();
}

function doLogout() {
  currentUser = null;
  localStorage.removeItem("ep_session");
  get("authSection").hidden = false;
  get("mainNav").hidden = true;
  get("userInfo").hidden = true;
  document.querySelectorAll(".page").forEach(p => p.hidden = true);
}

// Connect Login, Register, and Logout buttons/forms
if (get("loginForm")) get("loginForm").addEventListener("submit", doLogin);
if (get("registerForm")) get("registerForm").addEventListener("submit", doRegister);
if (get("logoutBtn")) get("logoutBtn").addEventListener("click", doLogout);

// ----- 3. Navigation (Supports both onclick and #hash links) -----
function startApp() {
  get("authSection").hidden = true;
  get("mainNav").hidden = false;
  get("userInfo").hidden = false;
  get("userInfo").textContent = `${currentUser.name} (${currentUser.role})`;

  get("mainNav").querySelectorAll("a[data-page]").forEach(link => {
    const page = link.getAttribute("data-page");
    link.hidden = currentUser.role === "attendee" && ["manage", "reports", "users"].includes(page);
  });

  showPage(window.location.hash.slice(1) || "events");
}

function showPage(pageId) {
  document.querySelectorAll(".page").forEach(p => p.hidden = true);
  const target = get(pageId + "Section") || get("eventsSection");
  if (target) target.hidden = false;

  if (pageId === "events") renderEvents();
  if (pageId === "myregs") renderMyRegs();
  if (pageId === "manage") renderManage();
  if (pageId === "dashboard") get("dashTitle").textContent = "Welcome, " + currentUser.name;
}

window.addEventListener("hashchange", () => {
  if (currentUser) showPage(window.location.hash.slice(1) || "events");
});

// ----- 4. Browse & Register -----
function renderEvents() {
  const search = (get("searchInput")?.value || "").toLowerCase();
  const cat = get("categoryFilter")?.value || "all";

  const filtered = events.filter(ev => {
    if (currentUser.role !== "admin" && ev.status !== "Approved") return false;
    if (cat !== "all" && ev.cat !== cat) return false;
    return ev.title.toLowerCase().includes(search);
  });

  get("eventList").innerHTML = filtered.map(ev => {
    const taken = regs.filter(r => r.eid === ev.id).length;
    const isReg = regs.some(r => r.eid === ev.id && r.uid === currentUser.id);

    let btn = "";
    if (currentUser.role === "attendee") {
      btn = isReg ? `<span class="badge">Registered</span>` : `<button class="small-btn" onclick="doReg('${ev.id}')">Register</button>`;
    } else if (currentUser.role === "admin" && ev.status === "Pending") {
      btn = `<button class="green-btn small-btn" onclick="approve('${ev.id}')">Approve</button>`;
    }

    return `<div class="event-card">
      <h3>${ev.title} (${ev.status})</h3>
      <p>${ev.cat} · ${ev.date} · ${ev.venue} · Seats: ${taken}/${ev.cap}</p>
      <p>${ev.desc}</p>
      ${btn}
    </div>`;
  }).join("") || "<p>No events found</p>";
}

function doReg(eid) {
  regs.push({ id: "r" + Date.now(), eid, uid: currentUser.id, status: "Confirmed" });
  save();
  alert("Registered!");
  renderEvents();
}

function approve(id) {
  events.find(e => e.id === id).status = "Approved";
  save();
  renderEvents();
}

// ----- 5. My Registrations -----
function renderMyRegs() {
  const myRegs = regs.filter(r => r.uid === currentUser.id);
  get("myRegsBody").innerHTML = myRegs.map(r => {
    const ev = events.find(e => e.id === r.eid);
    return ev ? `<tr><td>${ev.title}</td><td>${ev.date}</td><td>${ev.venue}</td><td>${r.status}</td>
      <td><button class="red-btn small-btn" onclick="cancelReg('${r.id}')">Cancel</button></td></tr>` : "";
  }).join("") || '<tr><td colspan="5">No registrations</td></tr>';
}

function cancelReg(id) {
  regs = regs.filter(r => r.id !== id);
  save();
  renderMyRegs();
}

// ----- 6. Manage Events (Create / Delete) -----
function renderManage() {
  const myEvents = events.filter(e => currentUser.role === "admin" || e.org === currentUser.id);
  get("manageEventsBody").innerHTML = myEvents.map(ev => `
    <tr>
      <td>${ev.title}</td><td>${ev.date}</td><td>${ev.venue}</td><td>${ev.cap}</td><td>${ev.status}</td>
      <td><button class="red-btn small-btn" onclick="del('${ev.id}')">Delete</button></td>
    </tr>`).join("") || '<tr><td colspan="6">No events</td></tr>';
}

if (get("eventForm")) {
  get("eventForm").onsubmit = function(e) {
    e.preventDefault();
    events.push({
      id: "e" + Date.now(),
      title: get("evTitle").value.trim(),
      cat: get("evCategory").value,
      date: get("evDate").value,
      venue: get("evVenue").value.trim(),
      cap: +get("evCapacity").value,
      desc: get("evDesc").value.trim(),
      org: currentUser.id,
      status: currentUser.role === "admin" ? "Approved" : "Pending"
    });
    save();
    get("eventForm").reset();
    renderManage();
  };
}

if (get("eventCancelBtn")) {
  get("eventCancelBtn").onclick = () => get("eventForm").reset();
}

function del(id) {
  if (!window.confirm("Delete this event?")) return;
  events = events.filter(e => e.id !== id);
  regs = regs.filter(r => r.eid !== id);
  save();
  renderManage();
}

// ----- 7. Initialize App -----
const cats = ["Conference", "Workshop", "Concert", "Sports", "Social", "Other"];
if (get("categoryFilter")) get("categoryFilter").innerHTML = '<option value="all">All</option>' + cats.map(c => `<option value="${c}">${c}</option>`).join("");
if (get("evCategory")) get("evCategory").innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join("");

// Set initial logged-out view if no session exists
if (!currentUser) {
  doLogout();
} else {
  startApp();
}

save();