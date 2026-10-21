(() => {
  const cfg = window.SRM_CONFIG || { API_BASE: "/api", LINKS: {} };
  const $ = id => document.getElementById(id);
  let token = sessionStorage.getItem("srm_token") || "";
  let user = sessionStorage.getItem("srm_user") || "";
  let equipos = [], mantenciones = [], ordenes = [];
  const apiBase = (cfg.API_BASE || "/api").replace(/\/$/, "");

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  }
  function dateText(value) {
    if (!value) return "—";
    const s = String(value).slice(0,10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s.split("-").reverse().join("-") : s;
  }
  function badge(status) {
    const cls = String(status || "").toLowerCase().replace(/\s+/g,"-");
    return `<span class="badge ${escapeHtml(cls)}">${escapeHtml(status || "Sin estado")}</span>`;
  }
  async function api(path, options = {}) {
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${apiBase}${path}`, { ...options, headers });
    const data = response.status === 204 ? null : await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401 && path !== "/login") logout(false);
      throw new Error(data?.error || `Error HTTP ${response.status}`);
    }
    return data;
  }
  function showNotice(message, isError = false) {
    const el = $("notice"); el.textContent = message; el.classList.remove("hidden");
    el.style.background = isError ? "#ffe5e4" : "#e4f7ed";
    el.style.color = isError ? "#b42318" : "#16794b";
    setTimeout(() => el.classList.add("hidden"), 5000);
  }
  function setView(isLoggedIn) {
    $("loginView").classList.toggle("hidden", isLoggedIn);
    $("appView").classList.toggle("hidden", !isLoggedIn);
    if (isLoggedIn) $("currentUser").textContent = `Sesión: ${user}`;
  }
  async function login(event) {
    event.preventDefault(); $("loginError").textContent = "";
    try {
      const data = await api("/login", { method: "POST", body: JSON.stringify({ username: $("username").value.trim(), password: $("password").value }) });
      token = data.token; user = data.username;
      sessionStorage.setItem("srm_token", token); sessionStorage.setItem("srm_user", user);
      $("password").value = ""; setView(true); await loadAll(); navigate("dashboard");
    } catch (e) { $("loginError").textContent = e.message || "No se pudo iniciar sesión."; }
  }
  function logout(show = true) {
    token = ""; user = ""; sessionStorage.removeItem("srm_token"); sessionStorage.removeItem("srm_user");
    setView(false); if (show) $("loginError").textContent = "Sesión cerrada.";
  }
  function navigate(section) {
    document.querySelectorAll(".page-section").forEach(el => el.classList.add("hidden"));
    $(`section-${section}`).classList.remove("hidden");
    document.querySelectorAll(".nav-item").forEach(el => el.classList.toggle("active", el.dataset.section === section));
    const titles = { dashboard:"Inicio", equipos:"Equipos", mantenciones:"Mantenciones", ordenes:"Órdenes de trabajo", reportes:"Reportes" };
    $("pageTitle").textContent = titles[section] || "Inicio";
    if (section === "equipos") renderEquipment();
    if (section === "mantenciones") renderMaintenance();
    if (section === "ordenes") renderOrders();
  }
  function setLinks() {
    const entries = [["linkSolicitudes","solicitudes"],["linkConsumos","consumos"],["linkBaseDatos","baseDatos"]];
    entries.forEach(([id,key]) => {
      const url = cfg.LINKS?.[key] || "#";
      $(id).href = url;
      if (!/^https?:\/\//i.test(url)) $(id).addEventListener("click", e => { e.preventDefault(); showNotice(`Configura la URL real para ${$(id).querySelector("b").textContent}.`, true); });
    });
  }
  async function loadAll() {
    try {
      const [eq, mt, ot] = await Promise.all([api("/equipos"), api("/mantenciones"), api("/ordenes")]);
      equipos = eq.items || []; mantenciones = mt.items || []; ordenes = ot.items || [];
      renderDashboard(); renderEquipment(); renderMaintenance(); renderOrders(); fillEquipmentSelects(); renderReports();
    } catch (e) { showNotice(`No se pudieron cargar los datos: ${e.message}`, true); }
  }
  function renderDashboard() {
    $("statEquipos").textContent = equipos.length;
    $("statOperativos").textContent = equipos.filter(e => e.estado === "Operativo").length;
    $("statMantencion").textContent = equipos.filter(e => e.estado === "En mantención").length;
    $("statOrdenes").textContent = ordenes.filter(o => ["Pendiente","En proceso"].includes(o.estado)).length;
    const rows = equipos.slice(0,6).map(e => `<tr><td>${escapeHtml(e.numero_equipo)}</td><td>${escapeHtml(e.nombre)}</td><td>${escapeHtml(e.ubicacion || "—")}</td><td>${badge(e.estado)}</td><td>${dateText(e.proxima_mantencion)}</td></tr>`).join("");
    $("recentEquipment").innerHTML = rows || `<tr><td colspan="5" class="empty">Todavía no hay equipos. Ingresa a Equipos para registrar el primero.</td></tr>`;
  }
  function renderEquipment() {
    const q = ($("equipmentSearch")?.value || "").toLowerCase();
    const status = $("statusFilter")?.value || "";
    const filtered = equipos.filter(e => (!status || e.estado === status) && [e.numero_equipo,e.nombre,e.ubicacion,e.marca,e.modelo].some(v => String(v || "").toLowerCase().includes(q)));
    $("equipmentRows").innerHTML = filtered.map(e => `<tr><td><b>${escapeHtml(e.numero_equipo)}</b></td><td>${escapeHtml(e.nombre)}</td><td>${escapeHtml([e.marca,e.modelo].filter(Boolean).join(" / ") || "—")}</td><td>${escapeHtml(e.ubicacion || "—")}</td><td>${badge(e.estado)}</td><td>${dateText(e.proxima_mantencion)}</td><td><button class="secondary edit-equipment" data-id="${e.id}">Editar</button></td></tr>`).join("") || `<tr><td colspan="7" class="empty">No hay equipos para mostrar.</td></tr>`;
    document.querySelectorAll(".edit-equipment").forEach(b => b.addEventListener("click", () => openEquipment(equipos.find(e => e.id === Number(b.dataset.id)))));
  }
  function renderMaintenance() {
    $("maintenanceRows").innerHTML = mantenciones.map(m => `<tr><td>${escapeHtml(m.numero_equipo)} · ${escapeHtml(m.equipo_nombre)}</td><td>${escapeHtml(m.tipo)}</td><td>${dateText(m.fecha_programada)}</td><td>${dateText(m.fecha_realizada)}</td><td>${badge(m.estado)}</td><td>${escapeHtml(m.detalle || "—")}</td></tr>`).join("") || `<tr><td colspan="6" class="empty">No hay mantenciones registradas.</td></tr>`;
  }
  function renderOrders() {
    $("orderRows").innerHTML = ordenes.map(o => `<tr><td><b>${escapeHtml(o.numero_orden)}</b></td><td>${escapeHtml(o.numero_equipo)} · ${escapeHtml(o.equipo_nombre)}</td><td>${escapeHtml(o.descripcion)}</td><td>${badge(o.prioridad)}</td><td>${badge(o.estado)}</td><td>${dateText(o.fecha_creacion)}</td></tr>`).join("") || `<tr><td colspan="6" class="empty">No hay órdenes registradas.</td></tr>`;
  }
  function renderReports() {
    $("reportFuera").textContent = equipos.filter(e => e.estado === "Fuera de servicio").length;
    $("reportCompletadas").textContent = ordenes.filter(o => o.estado === "Completada").length;
  }
  function fillEquipmentSelects() {
    const options = equipos.filter(e => e.estado !== "Retirado").map(e => `<option value="${e.id}">${escapeHtml(e.numero_equipo)} — ${escapeHtml(e.nombre)}</option>`).join("");
    $("maintenanceEquipment").innerHTML = options; $("orderEquipment").innerHTML = options;
  }
  function openEquipment(e = null) {
    $("equipmentForm").reset(); $("equipmentFormError").textContent = "";
    $("equipmentDialogTitle").textContent = e ? "Editar equipo" : "Nuevo equipo";
    $("equipmentId").value = e?.id || "";
    $("eqNumber").value = e?.numero_equipo || ""; $("eqName").value = e?.nombre || "";
    $("eqBrand").value = e?.marca || ""; $("eqModel").value = e?.modelo || "";
    $("eqLocation").value = e?.ubicacion || ""; $("eqStatus").value = e?.estado || "Operativo";
    $("eqNext").value = e?.proxima_mantencion ? String(e.proxima_mantencion).slice(0,10) : "";
    $("eqNotes").value = e?.observaciones || ""; $("equipmentDialog").showModal();
  }
  async function saveEquipment(event) {
    event.preventDefault(); $("equipmentFormError").textContent = "";
    const id = $("equipmentId").value;
    const body = { numero_equipo:$("eqNumber").value.trim(), nombre:$("eqName").value.trim(), marca:$("eqBrand").value.trim(), modelo:$("eqModel").value.trim(), ubicacion:$("eqLocation").value.trim(), estado:$("eqStatus").value, proxima_mantencion:$("eqNext").value || null, observaciones:$("eqNotes").value.trim() };
    try { await api(id ? `/equipos/${id}` : "/equipos", { method:id ? "PUT" : "POST", body:JSON.stringify(body) }); $("equipmentDialog").close(); await loadAll(); showNotice("Equipo guardado correctamente."); }
    catch(e) { $("equipmentFormError").textContent = e.message; }
  }
  async function saveMaintenance(event) {
    event.preventDefault(); $("maintenanceFormError").textContent = "";
    try { await api("/mantenciones", { method:"POST", body:JSON.stringify({ equipo_id:Number($("maintenanceEquipment").value), tipo:$("maintenanceType").value, fecha_programada:$("maintenanceDate").value, detalle:$("maintenanceDetail").value.trim() }) }); $("maintenanceDialog").close(); $("maintenanceForm").reset(); await loadAll(); showNotice("Mantención registrada."); }
    catch(e) { $("maintenanceFormError").textContent = e.message; }
  }
  async function saveOrder(event) {
    event.preventDefault(); $("orderFormError").textContent = "";
    try { await api("/ordenes", { method:"POST", body:JSON.stringify({ equipo_id:Number($("orderEquipment").value), descripcion:$("orderDescription").value.trim(), prioridad:$("orderPriority").value, estado:$("orderStatus").value }) }); $("orderDialog").close(); $("orderForm").reset(); await loadAll(); showNotice("Orden de trabajo creada."); }
    catch(e) { $("orderFormError").textContent = e.message; }
  }

  $("loginForm").addEventListener("submit", login);
  $("logoutBtn").addEventListener("click", () => logout());
  document.querySelectorAll(".nav-item").forEach(b => b.addEventListener("click", () => navigate(b.dataset.section)));
  document.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => navigate(b.dataset.go)));
  document.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => $(b.dataset.close).close()));
  $("newEquipmentBtn").addEventListener("click", () => openEquipment());
  $("equipmentForm").addEventListener("submit", saveEquipment);
  $("newMaintenanceBtn").addEventListener("click", () => { $("maintenanceForm").reset(); $("maintenanceFormError").textContent=""; fillEquipmentSelects(); $("maintenanceDialog").showModal(); });
  $("maintenanceForm").addEventListener("submit", saveMaintenance);
  $("newOrderBtn").addEventListener("click", () => { $("orderForm").reset(); $("orderFormError").textContent=""; fillEquipmentSelects(); $("orderDialog").showModal(); });
  $("orderForm").addEventListener("submit", saveOrder);
  $("equipmentSearch").addEventListener("input", renderEquipment);
  $("statusFilter").addEventListener("change", renderEquipment);
  setLinks();
  if (token && user) { setView(true); loadAll(); } else setView(false);
})();
