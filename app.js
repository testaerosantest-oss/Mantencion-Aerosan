```javascript
(() => {
  "use strict";

  // =========================================================
  // CONFIGURACIÓN
  // =========================================================
  const cfg = window.SRM_CONFIG || {
    API_BASE:
      "https://srm-aerosan-api-e8etf6hmegfga5an.brazilsouth-01.azurewebsites.net/api",
    LINKS: {}
  };

  const $ = id => document.getElementById(id);

  const apiBase = (cfg.API_BASE ||
    "https://srm-aerosan-api-e8etf6hmegfga5an.brazilsouth-01.azurewebsites.net/api"
  ).replace(/\/+$/, "");

  let token = "";
  let user = "Modo de prueba";

  let equipos = [];
  let mantenciones = [];
  let ordenes = [];

  // =========================================================
  // UTILIDADES
  // =========================================================
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c]));
  }

  function dateText(value) {
    if (!value) return "—";

    const s = String(value).slice(0, 10);

    return /^\d{4}-\d{2}-\d{2}$/.test(s)
      ? s.split("-").reverse().join("-")
      : s;
  }

  function badge(status) {
    const value = status || "Sin estado";
    const cls = String(value)
      .toLowerCase()
      .replace(/\s+/g, "-");

    return `<span class="badge ${escapeHtml(cls)}">${escapeHtml(value)}</span>`;
  }

  function showNotice(message, isError = false) {
    const el = $("notice");
    if (!el) return;

    el.textContent = message;
    el.classList.remove("hidden");
    el.style.background = isError ? "#ffe5e4" : "#e4f7ed";
    el.style.color = isError ? "#b42318" : "#16794b";

    window.setTimeout(() => {
      el.classList.add("hidden");
    }, 6000);
  }

  function showFormError(id, message) {
    const el = $(id);
    if (el) el.textContent = message;
  }

  // =========================================================
  // CONEXIÓN A AZURE FUNCTIONS
  // =========================================================
  async function api(path, options = {}) {
    const headers = {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    let response;

    try {
      response = await fetch(`${apiBase}${path}`, {
        ...options,
        headers
      });
    } catch (error) {
      console.error("No se pudo conectar con la API:", error);

      throw new Error(
        "No se pudo conectar con Azure Functions. Verifica la dirección de la API y la configuración CORS."
      );
    }

    const raw = await response.text();
    let data = null;

    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = { mensaje: raw };
      }
    }

    if (!response.ok) {
      const detail = data?.detalle ? ` ${data.detalle}` : "";
      const message =
        data?.error ||
        data?.mensaje ||
        `Error HTTP ${response.status}`;

      throw new Error(`${message}${detail}`);
    }

    return data;
  }

  // =========================================================
  // VISTAS Y NAVEGACIÓN
  // =========================================================
  function setView() {
    $("loginView")?.classList.add("hidden");
    $("appView")?.classList.remove("hidden");

    if ($("currentUser")) {
      $("currentUser").textContent = user;
    }

    $("logoutBtn")?.classList.add("hidden");
  }

  function logout() {
    setView();
    showNotice("El inicio de sesión está desactivado en el modo de prueba.");
  }

  function navigate(section) {
    document.querySelectorAll(".page-section").forEach(el => {
      el.classList.add("hidden");
    });

    const target = $(`section-${section}`);
    if (target) target.classList.remove("hidden");

    document.querySelectorAll(".nav-item").forEach(el => {
      el.classList.toggle("active", el.dataset.section === section);
    });

    const titles = {
      dashboard: "Inicio",
      equipos: "Equipos",
      mantenciones: "Mantenciones",
      ordenes: "Órdenes de trabajo",
      reportes: "Reportes"
    };

    if ($("pageTitle")) {
      $("pageTitle").textContent = titles[section] || "Inicio";
    }

    if (section === "equipos") renderEquipment();
    if (section === "mantenciones") renderMaintenance();
    if (section === "ordenes") renderOrders();
    if (section === "reportes") renderReports();
  }

  function setLinks() {
    const entries = [
      ["linkSolicitudes", "solicitudes"],
      ["linkConsumos", "consumos"],
      ["linkBaseDatos", "baseDatos"]
    ];

    entries.forEach(([id, key]) => {
      const el = $(id);
      if (!el) return;

      const url = cfg.LINKS?.[key] || "";
      el.href = url || "#";

      if (!url) {
        el.addEventListener("click", event => {
          event.preventDefault();

          showNotice(
            `Falta configurar la URL de ${
              el.querySelector("b")?.textContent || key
            }.`,
            true
          );
        });
      }
    });
  }

  // =========================================================
  // CARGAR EQUIPOS, MANTENCIONES Y ÓRDENES
  // =========================================================
  async function loadAll() {
    try {
      const [eq, mt, ot] = await Promise.all([
        api("/equipos"),
        api("/mantenciones"),
        api("/ordenes")
      ]);

      const eqRows = Array.isArray(eq) ? eq : (eq?.items || []);
      const mtRows = Array.isArray(mt) ? mt : (mt?.items || []);
      const otRows = Array.isArray(ot) ? ot : (ot?.items || []);

      equipos = eqRows.map(e => ({
        id: e.EquipoID ?? e.id,
        numero_equipo: e.Codigo ?? e.numero_equipo ?? "",
        nombre: e.Nombre ?? e.nombre ?? "",
        ubicacion: e.Ubicacion ?? e.ubicacion ?? "",
        sector: e.Sector ?? e.sector ?? "",
        estado: e.Estado ?? e.estado ?? "",
        marca: e.Marca ?? e.marca ?? "",
        modelo: e.Modelo ?? e.modelo ?? "",
        proxima_mantencion:
          e.ProximaMantencion ??
          e.proxima_mantencion ??
          e.FechaProgramada ??
          null,
        observaciones: e.Observaciones ?? e.observaciones ?? ""
      }));

      mantenciones = mtRows.map(m => ({
        id: m.MantencionID ?? m.id,
        equipo_id: m.EquipoID ?? m.equipo_id,
        numero_equipo: m.Codigo ?? m.numero_equipo ?? "",
        equipo_nombre: m.NombreEquipo ?? m.equipo_nombre ?? "",
        tipo: m.TipoMantencion ?? m.tipo ?? "",
        fecha_programada:
          m.FechaProgramada ?? m.fecha_programada ?? null,
        fecha_realizada:
          m.FechaRealizada ?? m.fecha_realizada ?? null,
        estado: m.Estado ?? m.estado ?? "",
        detalle: m.Descripcion ?? m.detalle ?? "",
        responsable: m.Responsable ?? m.responsable ?? "",
        observaciones: m.Observaciones ?? m.observaciones ?? ""
      }));

      ordenes = otRows.map(o => ({
        id: o.OrdenID ?? o.id,
        numero_orden: o.OrdenID ?? o.numero_orden ?? "",
        equipo_id: o.EquipoID ?? o.equipo_id,
        numero_equipo: o.Codigo ?? o.numero_equipo ?? "",
        equipo_nombre: o.NombreEquipo ?? o.equipo_nombre ?? "",
        descripcion:
          o.TrabajoRealizado ??
          o.Descripcion ??
          o.descripcion ??
          "",
        prioridad: o.Prioridad ?? o.prioridad ?? "Media",
        estado: o.Estado ?? o.estado ?? "",
        fecha_creacion:
          o.FechaInicio ??
          o.FechaCreacion ??
          o.fecha_creacion ??
          null
      }));

      renderDashboard();
      renderEquipment();
      renderMaintenance();
      renderOrders();
      fillEquipmentSelects();
      renderReports();

    } catch (error) {
      console.error("Error cargando información de la API:", error);

      showNotice(
        `No se pudieron cargar los datos desde la API: ${error.message}. El panel permanece disponible.`,
        true
      );
    }
  }

  // =========================================================
  // PANEL PRINCIPAL
  // =========================================================
  function renderDashboard() {
    if ($("statEquipos")) {
      $("statEquipos").textContent = equipos.length;
    }

    if ($("statOperativos")) {
      $("statOperativos").textContent = equipos.filter(e =>
        ["Activo", "Operativo"].includes(e.estado)
      ).length;
    }

    if ($("statMantencion")) {
      $("statMantencion").textContent = equipos.filter(e =>
        ["En mantención", "En mantenimiento"].includes(e.estado)
      ).length;
    }

    if ($("statOrdenes")) {
      $("statOrdenes").textContent = ordenes.filter(o =>
        ["Pendiente", "En proceso", "Abierta"].includes(o.estado)
      ).length;
    }

    const rows = equipos.slice(0, 6).map(e => `
      <tr>
        <td>${escapeHtml(e.numero_equipo)}</td>
        <td>${escapeHtml(e.nombre)}</td>
        <td>${escapeHtml(e.ubicacion || "—")}</td>
        <td>${badge(e.estado)}</td>
        <td>${dateText(e.proxima_mantencion)}</td>
      </tr>
    `).join("");

    if ($("recentEquipment")) {
      $("recentEquipment").innerHTML = rows ||
        `<tr><td colspan="5" class="empty">No hay equipos cargados.</td></tr>`;
    }
  }

  // =========================================================
  // INVENTARIO DE EQUIPOS
  // =========================================================
  function renderEquipment() {
    const q = ($("equipmentSearch")?.value || "").toLowerCase();
    const status = $("statusFilter")?.value || "";

    const filtered = equipos.filter(e => {
      const matchesStatus = !status ||
        e.estado === status ||
        (status === "Operativo" && e.estado === "Activo");

      const matchesSearch = [
        e.numero_equipo,
        e.nombre,
        e.ubicacion,
        e.sector,
        e.marca,
        e.modelo
      ].some(value =>
        String(value || "").toLowerCase().includes(q)
      );

      return matchesStatus && matchesSearch;
    });

    if ($("equipmentRows")) {
      $("equipmentRows").innerHTML = filtered.map(e => `
        <tr>
          <td><b>${escapeHtml(e.numero_equipo)}</b></td>
          <td>${escapeHtml(e.nombre)}</td>
          <td>${escapeHtml(
            [e.marca, e.modelo].filter(Boolean).join(" / ") || "—"
          )}</td>
          <td>${escapeHtml(e.ubicacion || "—")}</td>
          <td>${badge(e.estado)}</td>
          <td>${dateText(e.proxima_mantencion)}</td>
          <td>
            <button
              class="secondary edit-equipment"
              data-id="${escapeHtml(e.id)}"
              type="button"
            >Ver</button>
          </td>
        </tr>
      `).join("") || `
        <tr><td colspan="7" class="empty">No hay equipos para mostrar.</td></tr>
      `;

      document.querySelectorAll(".edit-equipment").forEach(button => {
        button.addEventListener("click", () => {
          const equipo = equipos.find(e =>
            String(e.id) === button.dataset.id
          );

          if (equipo) {
            openEquipment(equipo);
          }
        });
      });
    }
  }

  function openEquipment(e = null) {
    $("equipmentForm")?.reset();
    showFormError("equipmentFormError", "");

    $("equipmentDialogTitle").textContent =
      e ? "Detalle del equipo" : "Nuevo equipo";

    $("equipmentId").value = e?.id ?? "";
    $("eqNumber").value = e?.numero_equipo ?? "";
    $("eqName").value = e?.nombre ?? "";
    $("eqBrand").value = e?.marca ?? "";
    $("eqModel").value = e?.modelo ?? "";
    $("eqLocation").value = e?.ubicacion ?? "";
    $("eqStatus").value = e?.estado ?? "Operativo";

    $("eqNext").value = e?.proxima_mantencion
      ? String(e.proxima_mantencion).slice(0, 10)
      : "";

    $("eqNotes").value = e?.observaciones ?? "";

    // La API actual aún no tiene PUT para editar.
    // En modo consulta, los campos se muestran deshabilitados.
    const readOnly = Boolean(e);

    [
      "eqNumber",
      "eqName",
      "eqBrand",
      "eqModel",
      "eqLocation",
      "eqStatus",
      "eqNext",
      "eqNotes"
    ].forEach(id => {
      if ($(id)) $(id).disabled = readOnly;
    });

    const submitButton = $("equipmentForm")
      ?.querySelector('button[type="submit"]');

    if (submitButton) {
      submitButton.classList.toggle("hidden", readOnly);
    }

    $("equipmentDialog")?.showModal();
  }

  async function saveEquipment(event) {
    event.preventDefault();
    showFormError("equipmentFormError", "");

    const id = $("equipmentId").value;

    if (id) {
      showFormError(
        "equipmentFormError",
        "La edición aún no está disponible. Por ahora puedes consultar el equipo y registrar equipos nuevos."
      );
      return;
    }

    const body = {
      Codigo: $("eqNumber").value.trim(),
      Nombre: $("eqName").value.trim(),
      Ubicacion: $("eqLocation").value.trim() || null,
      Sector: null,
      Estado: $("eqStatus").value === "Operativo"
        ? "Activo"
        : $("eqStatus").value
    };

    if (!body.Codigo || !body.Nombre) {
      showFormError(
        "equipmentFormError",
        "Completa el número y el nombre del equipo."
      );
      return;
    }

    try {
      await api("/equipos", {
        method: "POST",
        body: JSON.stringify(body)
      });

      $("equipmentDialog")?.close();

      await loadAll();

      showNotice("Equipo registrado correctamente.");

    } catch (error) {
      console.error("Error registrando equipo:", error);

      showFormError(
        "equipmentFormError",
        error.message
      );
    }
  }

  // =========================================================
  // MANTENCIONES
  // =========================================================
  function renderMaintenance() {
    if (!$("maintenanceRows")) return;

    $("maintenanceRows").innerHTML = mantenciones.map(m => `
      <tr>
        <td>${escapeHtml(
          [m.numero_equipo, m.equipo_nombre].filter(Boolean).join(" · ") || "—"
        )}</td>
        <td>${escapeHtml(m.tipo)}</td>
        <td>${dateText(m.fecha_programada)}</td>
        <td>${dateText(m.fecha_realizada)}</td>
        <td>${badge(m.estado)}</td>
        <td>${escapeHtml(m.detalle || "—")}</td>
      </tr>
    `).join("") || `
      <tr><td colspan="6" class="empty">No hay mantenciones registradas.</td></tr>
    `;
  }

  function fillEquipmentSelects() {
    const options = equipos
      .filter(e => !["Retirado"].includes(e.estado))
      .map(e => `
        <option value="${escapeHtml(e.id)}">
          ${escapeHtml(e.numero_equipo)} — ${escapeHtml(e.nombre)}
        </option>
      `).join("");

    if ($("maintenanceEquipment")) {
      $("maintenanceEquipment").innerHTML =
        `<option value="">Selecciona un equipo</option>${options}`;
    }

    if ($("orderEquipment")) {
      $("orderEquipment").innerHTML =
        `<option value="">Selecciona un equipo</option>${options}`;
    }
  }

  async function saveMaintenance(event) {
    event.preventDefault();

    showFormError(
      "maintenanceFormError",
      "El registro de mantenciones todavía no está implementado en la API. No se guardó ningún dato."
    );
  }

  // =========================================================
  // ÓRDENES DE TRABAJO
  // =========================================================
  function renderOrders() {
    if (!$("orderRows")) return;

    $("orderRows").innerHTML = ordenes.map(o => `
      <tr>
        <td><b>${escapeHtml(o.numero_orden)}</b></td>
        <td>${escapeHtml(
          [o.numero_equipo, o.equipo_nombre].filter(Boolean).join(" · ") || "—"
        )}</td>
        <td>${escapeHtml(o.descripcion || "—")}</td>
        <td>${badge(o.prioridad)}</td>
        <td>${badge(o.estado)}</td>
        <td>${dateText(o.fecha_creacion)}</td>
      </tr>
    `).join("") || `
      <tr><td colspan="6" class="empty">No hay órdenes registradas.</td></tr>
    `;
  }

  async function saveOrder(event) {
    event.preventDefault();

    showFormError(
      "orderFormError",
      "El registro de órdenes todavía no está implementado en la API. No se guardó ningún dato."
    );
  }

  // =========================================================
  // EVENTOS
  // =========================================================
  $("loginForm")?.addEventListener("submit", event => {
    event.preventDefault();
  });

  $("logoutBtn")?.addEventListener("click", logout);

  document.querySelectorAll(".nav-item").forEach(button => {
    button.addEventListener("click", () => {
      navigate(button.dataset.section);
    });
  });

  document.querySelectorAll("[data-go]").forEach(button => {
    button.addEventListener("click", () => {
      navigate(button.dataset.go);
    });
  });

  document.querySelectorAll("[data-close]").forEach(button => {
    button.addEventListener("click", () => {
      $(button.dataset.close)?.close();
    });
  });

  $("newEquipmentBtn")?.addEventListener("click", () => {
    openEquipment();
  });

  $("equipmentForm")?.addEventListener("submit", saveEquipment);

  $("newMaintenanceBtn")?.addEventListener("click", () => {
    $("maintenanceForm")?.reset();
    showFormError("maintenanceFormError", "");
    fillEquipmentSelects();
    $("maintenanceDialog")?.showModal();
  });

  $("maintenanceForm")?.addEventListener("submit", saveMaintenance);

  $("newOrderBtn")?.addEventListener("click", () => {
    $("orderForm")?.reset();
    showFormError("orderFormError", "");
    fillEquipmentSelects();
    $("orderDialog")?.showModal();
  });

  $("orderForm")?.addEventListener("submit", saveOrder);

  $("equipmentSearch")?.addEventListener("input", renderEquipment);
  $("statusFilter")?.addEventListener("change", renderEquipment);

  // =========================================================
  // INICIALIZACIÓN
  // =========================================================
  setLinks();
  setView();
  navigate("dashboard");
  loadAll();

})();
```
