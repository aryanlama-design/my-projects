function get(id) {
  return document.getElementById(id);
}

function safe(text) {
  return String(text).replace(/[&<>"']/g, function (char) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
  });
}

function priceText(price) {
  return "$" + Number(price || 0).toFixed(2);
}

// Load saved data, or create the starter data.
var users = JSON.parse(localStorage.getItem("ep_users")) || [];
var events = JSON.parse(localStorage.getItem("ep_events")) || [
  { id: "e1", title: "Tech Fest", cat: "Conference", date: "2026-11-10", venue: "Hall A", cap: 50, desc: "Tech talks", org: "u2", status: "Approved", price: 0 },
  { id: "e2", title: "Concert", cat: "Concert", date: "2026-11-30", venue: "Ground", cap: 100, desc: "Music night", org: "u2", status: "Pending", price: 0 }
];
var regs = JSON.parse(localStorage.getItem("ep_regs")) || [];
var currentUser = JSON.parse(localStorage.getItem("ep_session")) || null;
var demoUsers = [
  { id: "u1", name: "Admin", email: "admin@event.com", pass: "admin123", role: "admin" },
  { id: "u2", name: "Org", email: "org@event.com", pass: "org123", role: "organizer" },
  { id: "u3", name: "Alex", email: "alex@event.com", pass: "alex123", role: "attendee" }
];

users.forEach(function (user) {
  user.email = user.email.trim().toLowerCase();
});
demoUsers.forEach(function (demoUser) {
  var savedUser = users.find(function (user) { return user.email === demoUser.email; });
  if (savedUser) savedUser.pass = demoUser.pass;
  else users.push(demoUser);
});
events.forEach(function (event) {
  event.price = Number(event.price) || 0;
});

function saveData() {
  localStorage.setItem("ep_users", JSON.stringify(users));
  localStorage.setItem("ep_events", JSON.stringify(events));
  localStorage.setItem("ep_regs", JSON.stringify(regs));
}

function toast(message, error) {
  var box = get("toast");
  box.textContent = message;
  box.className = error ? "error" : "";
  box.style.display = "block";
  window.setTimeout(function () {
    box.style.display = "none";
  }, 3000);
}

// ----- Accounts and navigation -----
function login(event) {
  event.preventDefault();
  var email = get("loginEmail").value.trim().toLowerCase();
  var password = get("loginPassword").value;
  var user = users.find(function (item) { return item.email === email && item.pass === password; });
  if (!user) {
    get("loginError").textContent = "Wrong email or password";
    return;
  }
  currentUser = user;
  localStorage.setItem("ep_session", JSON.stringify(user));
  get("loginError").textContent = "";
  get("loginForm").reset();
  startApp();
}

function registerAccount(event) {
  event.preventDefault();
  var name = get("regName").value.trim();
  var email = get("regEmail").value.trim().toLowerCase();
  var password = get("regPassword").value;
  if (users.some(function (user) { return user.email === email; })) {
    get("registerError").textContent = "Email taken";
    return;
  }
  if (name.length < 2 || password.length < 6) {
    get("registerError").textContent = "Name min 2, pass min 6";
    return;
  }
  currentUser = {
    id: "u" + Date.now(), name: name, email: email,
    pass: password, role: get("regRole").value
  };
  users.push(currentUser);
  saveData();
  localStorage.setItem("ep_session", JSON.stringify(currentUser));
  get("registerError").textContent = "";
  get("registerForm").reset();
  startApp();
}

function logout() {
  currentUser = null;
  localStorage.removeItem("ep_session");
  get("authSection").hidden = false;
  get("mainNav").hidden = true;
  get("userInfo").hidden = true;
  document.querySelectorAll(".page").forEach(function (page) { page.hidden = true; });
}

get("loginForm").addEventListener("submit", login);
get("registerForm").addEventListener("submit", registerAccount);
get("logoutBtn").addEventListener("click", logout);

function canOpen(page) {
  if (page === "manage") return ["admin", "organizer"].includes(currentUser.role);
  if (page === "users" || page === "reports") return currentUser.role === "admin";
  if (page === "myregs") return currentUser.role === "attendee";
  return ["dashboard", "events", "notifications"].includes(page);
}

function startApp() {
  currentUser = users.find(function (user) { return user.id === currentUser.id; });
  if (!currentUser) return logout();
  localStorage.setItem("ep_session", JSON.stringify(currentUser));
  get("authSection").hidden = true;
  get("mainNav").hidden = false;
  get("userInfo").hidden = false;
  get("userInfo").textContent = currentUser.name + " (" + currentUser.role + ")";
  document.querySelectorAll("#mainNav a[data-page]").forEach(function (link) {
    link.hidden = !canOpen(link.dataset.page);
  });
  showPage(location.hash.slice(1) || "events");
}

function showPage(page) {
  if (!canOpen(page)) page = "events";
  document.querySelectorAll(".page").forEach(function (section) { section.hidden = true; });
  get(page + "Section").hidden = false;
  if (page === "dashboard") renderDashboard();
  if (page === "events") renderEvents();
  if (page === "myregs") renderMyRegs();
  if (page === "manage") renderManage();
  if (page === "users") renderUsers();
  if (page === "reports") renderReports();
  if (page === "notifications") get("notesList").innerHTML = "<li>No notifications yet.</li>";
}

window.addEventListener("hashchange", function () {
  if (currentUser) showPage(location.hash.slice(1) || "events");
});

// ----- Browse and register for events -----
function registrationCount(eventId) {
  return regs.filter(function (reg) {
    return reg.eid === eventId && ["Pending", "Confirmed"].includes(reg.status);
  }).length;
}

function renderEvents() {
  var search = get("searchInput").value.toLowerCase();
  var category = get("categoryFilter").value;
  var visibleEvents = events.filter(function (event) {
    if (currentUser.role !== "admin" && event.status !== "Approved") return false;
    if (category !== "all" && event.cat !== category) return false;
    return (event.title + " " + event.desc + " " + event.venue).toLowerCase().includes(search);
  });

  get("eventList").innerHTML = visibleEvents.map(function (event) {
    var registered = regs.some(function (reg) {
      return reg.eid === event.id && reg.uid === currentUser.id &&
        !["Rejected", "Cancelled"].includes(reg.status);
    });
    var action = "";
    if (currentUser.role === "attendee") {
      if (registered) action = '<span class="badge">Registered</span>';
      else if (registrationCount(event.id) >= Number(event.cap)) action = '<span class="badge">Full</span>';
      else {
        var label = event.price > 0 ? "Pay " + priceText(event.price) + " &amp; Register" : "Register";
        action = '<button class="small-btn" data-action="register" data-id="' +
          safe(event.id) + '">' + label + "</button>";
      }
    } else if (currentUser.role === "admin" && event.status === "Pending") {
      action = '<button class="green-btn small-btn" data-action="approve-event" data-id="' + safe(event.id) +
        '">Approve</button> <button class="red-btn small-btn" data-action="reject-event" data-id="' +
        safe(event.id) + '">Reject</button>';
    }

    return `<article class="event-card">
      <h3>${safe(event.title)} <span class="badge">${safe(event.status)}</span></h3>
      <p>${safe(event.cat)} · ${safe(event.date)} · ${safe(event.venue)}</p>
      <p>Ticket: ${event.price > 0 ? priceText(event.price) : "Free"} · Seats:
        ${registrationCount(event.id)}/${Number(event.cap)}</p>
      <p>${safe(event.desc)}</p>${action}
    </article>`;
  }).join("") || "<p>No events found</p>";
}

function registerForEvent(eventId) {
  var event = events.find(function (item) {
    return item.id === eventId && item.status === "Approved";
  });
  if (!event || currentUser.role !== "attendee") return;
  if (registrationCount(eventId) >= Number(event.cap)) return toast("This event is full.", true);
  if (regs.some(function (reg) {
    return reg.eid === eventId && reg.uid === currentUser.id &&
      !["Rejected", "Cancelled"].includes(reg.status);
  })) return toast("You already registered for this event.", true);

  if (event.price > 0 && !confirm("Confirm demo payment of " + priceText(event.price) +
      "? No real payment will be processed.")) return;
  regs.push({
    id: "r" + Date.now(), eid: event.id, uid: currentUser.id, status: "Pending",
    amount: event.price, paymentStatus: event.price > 0 ? "Demo paid" : "Not required"
  });
  saveData();
  renderEvents();
  toast("Registration sent for approval.");
}

function setEventStatus(eventId, status) {
  var event = events.find(function (item) { return item.id === eventId; });
  if (currentUser.role !== "admin" || !event || event.status !== "Pending") return;
  event.status = status;
  saveData();
  renderEvents();
  renderManage();
}

get("filterBar").addEventListener("submit", function (event) { event.preventDefault(); });
get("searchInput").addEventListener("input", renderEvents);
get("categoryFilter").addEventListener("change", renderEvents);

// ----- Attendee registrations -----
function renderMyRegs() {
  var myRegs = regs.filter(function (reg) { return reg.uid === currentUser.id; });
  get("myRegsBody").innerHTML = myRegs.map(function (reg) {
    var event = events.find(function (item) { return item.id === reg.eid; });
    if (!event) return "";
    var payment = reg.paymentStatus === "Demo paid"
      ? "Demo paid (" + priceText(reg.amount) + ")" : "Not required";
    var cancel = ["Pending", "Confirmed"].includes(reg.status)
      ? `<button class="red-btn small-btn" data-action="cancel-registration" data-id="${safe(reg.id)}">Cancel</button>` : "";
    return `<tr><td>${safe(event.title)}</td><td>${safe(event.date)}</td><td>${safe(event.venue)}</td>
      <td>${safe(reg.status)}</td><td>${payment}</td><td>${cancel}</td></tr>`;
  }).join("") || '<tr><td colspan="6">No registrations</td></tr>';
}

function cancelRegistration(id) {
  var reg = regs.find(function (item) { return item.id === id && item.uid === currentUser.id; });
  if (!reg || !["Pending", "Confirmed"].includes(reg.status)) return;
  reg.status = "Cancelled";
  saveData();
  renderMyRegs();
}

// ----- Organizer and admin event management -----
function canManageEvent(event) {
  return currentUser.role === "admin" ||
    (currentUser.role === "organizer" && event.org === currentUser.id);
}

function renderManage() {
  var managedEvents = events.filter(canManageEvent);
  get("manageEventsBody").innerHTML = managedEvents.map(function (event) {
    var actions = "";
    if (currentUser.role === "admin" && event.status === "Pending") {
      actions += `<button class="green-btn small-btn" data-action="approve-event" data-id="${safe(event.id)}">Approve</button>
        <button class="red-btn small-btn" data-action="reject-event" data-id="${safe(event.id)}">Reject</button>`;
    }
    actions += ` <button class="small-btn" data-action="edit-event" data-id="${safe(event.id)}">Edit</button>
      <button class="red-btn small-btn" data-action="delete-event" data-id="${safe(event.id)}">Delete</button>`;
    return `<tr><td>${safe(event.title)}</td><td>${safe(event.date)}</td><td>${safe(event.venue)}</td>
      <td>${registrationCount(event.id)}/${Number(event.cap)}</td>
      <td>${safe(event.status)} · ${event.price > 0 ? priceText(event.price) : "Free"}</td><td>${actions}</td></tr>`;
  }).join("") || '<tr><td colspan="6">No events</td></tr>';

  var requests = regs.filter(function (reg) {
    var event = events.find(function (item) { return item.id === reg.eid; });
    return event && canManageEvent(event);
  });
  get("manageRegsBody").innerHTML = requests.map(function (reg) {
    var event = events.find(function (item) { return item.id === reg.eid; });
    var attendee = users.find(function (user) { return user.id === reg.uid; });
    var payment = reg.paymentStatus === "Demo paid"
      ? "Demo paid (" + priceText(reg.amount) + ")" : "Not required";
    var actions = reg.status === "Pending"
      ? `<button class="green-btn small-btn" data-action="approve-registration" data-id="${safe(reg.id)}">Approve</button>
         <button class="red-btn small-btn" data-action="reject-registration" data-id="${safe(reg.id)}">Reject</button>` : "";
    return `<tr><td>${safe(attendee ? attendee.name : "Unknown user")}</td><td>${safe(event.title)}</td>
      <td>${payment}</td><td>${safe(reg.status)}</td><td>${actions}</td></tr>`;
  }).join("") || '<tr><td colspan="5">No registration requests</td></tr>';
}

function resetEventForm() {
  get("eventForm").reset();
  get("eventId").value = "";
  get("evPrice").value = "0";
  get("eventFormTitle").textContent = "Create New Event";
  get("eventCancelBtn").hidden = true;
  get("eventError").textContent = "";
}

function editEvent(id) {
  var event = events.find(function (item) { return item.id === id; });
  if (!event || !canManageEvent(event)) return;
  get("eventId").value = event.id;
  get("evTitle").value = event.title;
  get("evCategory").value = event.cat;
  get("evDate").value = event.date;
  get("evVenue").value = event.venue;
  get("evCapacity").value = event.cap;
  get("evPrice").value = event.price;
  get("evDesc").value = event.desc || "";
  get("eventFormTitle").textContent = "Edit Event";
  get("eventCancelBtn").hidden = false;
}

function saveEvent(formEvent) {
  formEvent.preventDefault();
  var id = get("eventId").value;
  var event = events.find(function (item) { return item.id === id; });
  var capacity = Number(get("evCapacity").value);
  var price = Number(get("evPrice").value);
  if (id && (!event || !canManageEvent(event))) return;
  if (capacity < 1 || price < 0 || isNaN(capacity) || isNaN(price)) {
    get("eventError").textContent = "Enter a valid capacity and non-negative price.";
    return;
  }
  if (event && capacity < registrationCount(id)) {
    get("eventError").textContent = "Capacity cannot be below active registrations.";
    return;
  }
  if (!event) {
    event = { id: "e" + Date.now(), org: currentUser.id,
      status: currentUser.role === "admin" ? "Approved" : "Pending" };
    events.push(event);
  }
  event.title = get("evTitle").value.trim();
  event.cat = get("evCategory").value;
  event.date = get("evDate").value;
  event.venue = get("evVenue").value.trim();
  event.cap = capacity;
  event.price = price;
  event.desc = get("evDesc").value.trim();
  saveData();
  resetEventForm();
  renderManage();
  toast(id ? "Event updated." : "Event created.");
}

function deleteEvent(id) {
  var event = events.find(function (item) { return item.id === id; });
  if (!event || !canManageEvent(event) || !confirm("Delete this event and registrations?")) return;
  events = events.filter(function (item) { return item.id !== id; });
  regs = regs.filter(function (reg) { return reg.eid !== id; });
  saveData();
  renderManage();
}

function setRegistrationStatus(id, status) {
  var reg = regs.find(function (item) { return item.id === id; });
  var event = reg && events.find(function (item) { return item.id === reg.eid; });
  if (!reg || reg.status !== "Pending" || !event || !canManageEvent(event)) return;
  reg.status = status;
  saveData();
  renderManage();
}

get("eventForm").addEventListener("submit", saveEvent);
get("eventCancelBtn").addEventListener("click", resetEventForm);

document.addEventListener("click", function (event) {
  var button = event.target.closest("[data-action]");
  if (!button) return;
  var action = button.dataset.action;
  var id = button.dataset.id;
  if (action === "register") registerForEvent(id);
  if (action === "cancel-registration") cancelRegistration(id);
  if (action === "approve-event") setEventStatus(id, "Approved");
  if (action === "reject-event") setEventStatus(id, "Rejected");
  if (action === "edit-event") editEvent(id);
  if (action === "delete-event") deleteEvent(id);
  if (action === "approve-registration") setRegistrationStatus(id, "Confirmed");
  if (action === "reject-registration") setRegistrationStatus(id, "Rejected");
  if (action === "save-role") saveUserRole(button);
});

// ----- Admin user roles and reports -----
function renderUsers() {
  get("usersBody").innerHTML = users.map(function (user) {
    return `<tr><td>${safe(user.name)}</td><td>${safe(user.email)}</td><td>
      <select data-user-role="${safe(user.id)}">
        <option value="attendee" ${user.role === "attendee" ? "selected" : ""}>Attendee</option>
        <option value="organizer" ${user.role === "organizer" ? "selected" : ""}>Organizer</option>
        <option value="admin" ${user.role === "admin" ? "selected" : ""}>Admin</option>
      </select></td><td><button class="small-btn" data-action="save-role" data-id="${safe(user.id)}">Save role</button></td></tr>`;
  }).join("");
}

function saveUserRole(button) {
  if (currentUser.role !== "admin") return;
  var user = users.find(function (item) { return item.id === button.dataset.id; });
  var select = button.parentNode.parentNode.querySelector("[data-user-role]");
  if (!user || !select) return;
  if (user.role === "admin" && select.value !== "admin" &&
      users.filter(function (item) { return item.role === "admin"; }).length === 1) {
    return toast("The last administrator cannot be demoted.", true);
  }
  user.role = select.value;
  saveData();
  if (user.id === currentUser.id) startApp();
  else renderUsers();
}

function renderDashboard() {
  var managed = events.filter(function (event) {
    return currentUser.role === "admin" || event.org === currentUser.id;
  });
  var myRegs = regs.filter(function (reg) { return reg.uid === currentUser.id; });
  var pending = regs.filter(function (reg) {
    var event = events.find(function (item) { return item.id === reg.eid; });
    return reg.status === "Pending" && event && canManageEvent(event);
  }).length;
  var confirmed = regs.filter(function (reg) {
    var event = events.find(function (item) { return item.id === reg.eid; });
    return reg.status === "Confirmed" && event && canManageEvent(event);
  }).length;
  get("dashTitle").textContent = "Welcome, " + currentUser.name;
  get("statCards").innerHTML = currentUser.role === "attendee"
    ? `<div class="stat-card"><h3>${events.filter(function (event) { return event.status === "Approved"; }).length}</h3><p>Available events</p></div>
       <div class="stat-card"><h3>${myRegs.length}</h3><p>My registrations</p></div>`
    : `<div class="stat-card"><h3>${managed.length}</h3><p>Events</p></div>
       <div class="stat-card"><h3>${pending}</h3><p>Pending registrations</p></div>
       <div class="stat-card"><h3>${confirmed}</h3><p>Confirmed registrations</p></div>`;
  if (currentUser.role === "admin") {
    get("statCards").innerHTML += `<div class="stat-card"><h3>${events.filter(function (event) {
      return event.status === "Pending";
    }).length}</h3><p>Pending event approvals</p></div>`;
  }
  var today = new Date().toISOString().slice(0, 10);
  var upcoming = events.filter(function (event) {
    return event.status === "Approved" && event.date >= today &&
      (currentUser.role !== "organizer" || event.org === currentUser.id);
  }).sort(function (a, b) { return a.date.localeCompare(b.date); }).slice(0, 5);
  get("upcomingList").innerHTML = upcoming.map(function (event) {
    return `<li>${safe(event.title)} · ${safe(event.date)} · ${event.price ? priceText(event.price) : "Free"}</li>`;
  }).join("") || "<li>No upcoming events.</li>";
  get("recentNotes").innerHTML = "<li>No new notifications.</li>";
}

function renderReports() {
  get("reportStats").innerHTML = `<div class="stat-card"><h3>${events.length}</h3><p>Total events</p></div>
    <div class="stat-card"><h3>${events.filter(function (event) { return event.status === "Pending"; }).length}</h3><p>Pending event approvals</p></div>
    <div class="stat-card"><h3>${regs.filter(function (reg) { return reg.status === "Confirmed"; }).length}</h3><p>Confirmed registrations</p></div>`;
  get("reportEventsBody").innerHTML = events.map(function (event) {
    var eventRegs = regs.filter(function (reg) { return reg.eid === event.id; });
    return `<tr><td>${safe(event.title)}</td><td>${safe(event.status)}</td>
      <td>${event.price ? priceText(event.price) : "Free"}</td>
      <td>${registrationCount(event.id)}/${Number(event.cap)}</td>
      <td>${eventRegs.filter(function (reg) { return reg.status === "Pending"; }).length}</td>
      <td>${eventRegs.filter(function (reg) { return reg.status === "Confirmed"; }).length}</td>
      <td>${eventRegs.filter(function (reg) { return ["Rejected", "Cancelled"].includes(reg.status); }).length}</td></tr>`;
  }).join("") || '<tr><td colspan="7">No events</td></tr>';
  var counts = {};
  events.forEach(function (event) { counts[event.cat] = (counts[event.cat] || 0) + 1; });
  get("reportCategoryBody").innerHTML = Object.keys(counts).map(function (category) {
    return `<tr><td>${safe(category)}</td><td>${counts[category]}</td></tr>`;
  }).join("") || '<tr><td colspan="2">No events</td></tr>';
}

get("markReadBtn").addEventListener("click", function () {
  toast("All notifications are up to date.");
});

// Fill category lists, then show the correct page.
var categories = ["Conference", "Workshop", "Concert", "Sports", "Social", "Other"];
get("categoryFilter").innerHTML = '<option value="all">All</option>' +
  categories.map(function (category) { return `<option>${category}</option>`; }).join("");
get("evCategory").innerHTML = categories.map(function (category) {
  return `<option>${category}</option>`;
}).join("");
if (currentUser) startApp();
else logout();
saveData();
