
(() => {
  "use strict";

  // =========================================================
  // CONFIGURACION
  // =========================================================
  const cfg = window.SRM_CONFIG || {
    API_BASE: "https://srm-aerosan-api-e8etf6hmegfga5an.brazilsouth-01.azurewebsites.net/api",
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
    return String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  }

  function dateText(value) {
    if (!value) return "—";

    const date = String(value).slice(0, 10);

    return /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date.split("-").reverse().join("-")
      : date;
  }

  function badge(status) {
    const value = status || "Sin estado";
    const cls = String(value).toLowerCase().replace(/\s+/g, "-");

    return `<span class="badge ${escapeHtml(cls)}">${escapeHtml(value)}</span>`;
  }

  function showNotice(message, isError = false) {
    const el = $("notice");

    if (!el) {
      if (isError) console.error(message);
      else console.log(message);
      return;
    }

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

  function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value ?? "";
  }

  // =========================================================
  // CONEXION A AZURE FUNCTIONS
  // =========================================================
  async function api(path, options = {}) {
    const headers = {
      Accept: "application/json",
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
      console.error("Error de conexion con Azure Functions:", error);

      throw new Error(
        "No se pudo conectar con Azure Functions. Comprueba CORS y la direccion de la API."
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

  function rowsFrom(response) {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.items)) return response.items;
    if (Array.isArray(response?.value)) return response.value;
    return [];
  }

  // =========================================================
  // VISTAS Y NAVEGACION
  // =========================================================
  function setView() {
    $("loginView")?.classList.add("hidden");
    $("appView")?.classList.remove("hidden");

    setText("currentUser", user);
    $("logoutBtn")?.classList.add("hidden");
  }

  function logout() {
    setView();
    showNotice("El inicio de sesion esta desactivado en el modo de prueba.");
  }

  function navigate(section) {
    document.querySelectorAll(".page-section").forEach(el => {
      el.classList.add("hidden");
    });

    const target = $(`section-${section}`);

    if (target) {
      target.classList.remove("hidden");
    } else {
      console.warn(`No se encontro la seccion section-${section}`);
    }

    document.querySelectorAll(".nav-item").forEach(el => {
      el.classList.toggle("active", el.dataset.section === section);
    });

    const titles = {
      dashboard: "Inicio",
      equipos: "Equipos",
      mantenciones: "Mantenciones",
      ordenes: "Ordenes de trabajo",
      reportes: "Reportes"
    };

    setText("pageTitle", titles[section] || "Inicio");

    if (section === "dashboard") renderDashboard();
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

      if (url && /^https?:\/\//i.test(url)) {
        el.href = url;
        el.target = "_blank";
        el.rel = "noopener noreferrer";
      } else {
        el.href = "#";

        el.addEventListener("click", event => {
          event.preventDefault();
          showNotice(`La URL de ${key} todavia no esta configurada.`, true);
        });
      }
    });
  }

  // =========================================================
  // CARGAR DATOS
  // =========================================================
  async function loadAll() {
    const results = await Promise.allSettled([
      api("/equipos"),
      api("/mantenciones"),
      api("/ordenes")
    ]);

    let errors = 0;

    if (results[0].status === "fulfilled") {
      const rows = rowsFrom(results[0].value);

      equipos = rows.map(e => ({
        id: e.EquipoID ?? e.id ?? e.equipo_id,
        numero_equipo: e.Codigo ?? e.numero_equipo ?? e.codigo ?? "",
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
          e.fecha_programada ??
          null,
        observaciones: e.Observaciones ?? e.observaciones ?? ""
      }));
    } else {
      errors++;
      console.error("Error cargando equipos:", results[0].reason);
    }

    if (results[1].status === "fulfilled") {
      const rows = rowsFrom(results[1].value);

      mantenciones = rows.map(m => ({
        id: m.MantencionID ?? m.id,
        equipo_id: m.EquipoID ?? m.equipo_id,
        numero_equipo: m.Codigo ?? m.numero_equipo ?? "",
        equipo_nombre: m.NombreEquipo ?? m.equipo_nombre ?? "",
        tipo: m.TipoMantencion ?? m.tipo ?? "",
        fecha_programada: m.FechaProgramada ?? m.fecha_programada ?? null,
        fecha_realizada: m.FechaRealizada ?? m.fecha_realizada ?? null,
        estado: m.Estado ?? m.estado ?? "",
        detalle: m.Descripcion ?? m.detalle ?? "",
        responsable: m.Responsable ?? m.responsable ?? "",
        observaciones: m.Observaciones ?? m.observaciones ?? ""
      }));
    } else {
      errors++;
      console.error("Error cargando mantenciones:", results[1].reason);
    }

    if (results[2].status === "fulfilled") {
      const rows = rowsFrom(results[2].value);

      ordenes = rows.map(o => ({
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
    } else {
      errors++;
      console.error("Error cargando ordenes:", results[2].reason);
    }

    renderDashboard();
    renderEquipment();
    renderMaintenance();
    renderOrders();
    fillEquipmentSelects();
    renderReports();

    if (errors === 0) {
      showNotice("Datos actualizados correctamente.");
    } else {
      showNotice(
        `No se pudieron cargar ${errors} de las 3 secciones. Revisa la API y CORS.`,
        true
      );
    }
  }

  // =========================================================
  // PANEL PRINCIPAL
  // =========================================================
  function renderDashboard() {
    setText("statEquipos", equipos.length);

    setText(
      "statOperativos",
      equipos.filter(e =>
        ["Activo", "Operativo"].includes(e.estado)
      ).length
    );

    setText(
      "statMantencion",
      equipos.filter(e =>
        ["En mantencion", "En mantenimiento"].includes(e.estado)
      ).length
    );

    setText(
      "statOrdenes",
      ordenes.filter(o =>
        ["Pendiente", "En proceso", "Abierta"].includes(o.estado)
      ).length
    );

    const rows = equipos.slice(0, 6).map(e => `
      <tr>
        <td>${escapeHtml(e.numero_equipo)}</td>
        <td>${escapeHtml(e.nombre)}</td>
        <td>${escapeHtml(e.ubicacion || "—")}</td>
        <td>${badge(e.estado)}</td>
        <td>${dateText(e.proxima_mantencion)}</td>
      </tr>
    `).join("");

    const recent = $("recentEquipment");

    if (recent) {
      recent.innerHTML = rows ||
        `<tr><td colspan="5" class="empty">No hay equipos cargados.</td></tr>`;
    }
  }

  // =========================================================
  // EQUIPOS
  // =========================================================
  function renderEquipment() {
    const query = ($("equipmentSearch")?.value || "").toLowerCase().trim();
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
        String(value || "").toLowerCase().includes(query)
      );

      return matchesStatus && matchesSearch;
    });

    const table = $("equipmentRows");
    if (!table) return;

    table.innerHTML = filtered.map(e => `
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
          <button class="secondary edit-equipment"
                  data-id="${escapeHtml(e.id)}"
                  type="button">Ver</button>
        </td>
      </tr>
    `).join("") || `
      <tr><td colspan="7" class="empty">No hay equipos para mostrar.</td></tr>
    `;

    table.querySelectorAll(".edit-equipment").forEach(button => {
      button.addEventListener("click", () => {
        const equipo = equipos.find(e =>
          String(e.id) === button.dataset.id
        );

        if (equipo) openEquipment(equipo);
      });
    });
  }

  function openEquipment(e = null) {
    const form = $("equipmentForm");
    form?.reset();

    showFormError("equipmentFormError", "");

    setText(
      "equipmentDialogTitle",
      e ? "Detalle del equipo" : "Nuevo equipo"
    );

    if ($("equipmentId")) $("equipmentId").value = e?.id ?? "";
    if ($("eqNumber")) $("eqNumber").value = e?.numero_equipo ?? "";
    if ($("eqName")) $("eqName").value = e?.nombre ?? "";
    if ($("eqBrand")) $("eqBrand").value = e?.marca ?? "";
    if ($("eqModel")) $("eqModel").value = e?.modelo ?? "";
    if ($("eqLocation")) $("eqLocation").value = e?.ubicacion ?? "";
    if ($("eqStatus")) {
      $("eqStatus").value = e?.estado ?? "Operativo";
    }
    if ($("eqNext")) {
      $("eqNext").value = e?.proxima_mantencion
        ? String(e.proxima_mantencion).slice(0, 10)
        : "";
    }
    if ($("eqNotes")) $("eqNotes").value = e?.observaciones ?? "";

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

    const submitButton = form?.querySelector('button[type="submit"]');

    if (submitButton) {
      submitButton.classList.toggle("hidden", readOnly);
    }

    $("equipmentDialog")?.showModal();
  }

  async function saveEquipment(event) {
    event.preventDefault();

    showFormError("equipmentFormError", "");

    const body = {
      Codigo: $("eqNumber")?.value.trim() || "",
      Nombre: $("eqName")?.value.trim() || "",
      Ubicacion: $("eqLocation")?.value.trim() || null,
      Sector: null,
      Estado: $("eqStatus")?.value === "Operativo"
        ? "Activo"
        : ($("eqStatus")?.value || "Activo")
    };

    if (!body.Codigo || !body.Nombre) {
      showFormError(
        "equipmentFormError",
        "Completa el numero y el nombre del equipo."
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
      showFormError("equipmentFormError", error.message);
    }
  }

  // =========================================================
  // MANTENCIONES
  // =========================================================
  function renderMaintenance() {
    const table = $("maintenanceRows");
    if (!table) return;

    table.innerHTML = mantenciones.map(m => `
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
      .filter(e => e.estado !== "Retirado")
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
      "El registro de mantenciones aun no esta implementado en la API. No se guardo ningun dato."
    );
  }

  // =========================================================
  // ORDENES DE TRABAJO
  // =========================================================
  function renderOrders() {
    const table = $("orderRows");
    if (!table) return;

    table.innerHTML = ordenes.map(o => `
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
      <tr><td colspan="6" class="empty">No hay ordenes registradas.</td></tr>
    `;
  }

  async function saveOrder(event) {
    event.preventDefault();

    showFormError(
      "orderFormError",
      "El registro de ordenes aun no esta implementado en la API. No se guardo ningun dato."
    );
  }

  // =========================================================
  // REPORTES
  // =========================================================
  function renderReports() {
    const total = equipos.length;
    const activos = equipos.filter(e =>
      ["Activo", "Operativo"].includes(e.estado)
    ).length;
    const enMantencion = equipos.filter(e =>
      ["En mantencion", "En mantenimiento"].includes(e.estado)
    ).length;
    const totalMantenciones = mantenciones.length;
    const totalOrdenes = ordenes.length;

    setText("reportTotalEquipos", total);
    setText("reportEquiposActivos", activos);
    setText("reportEquiposMantencion", enMantencion);
    setText("reportTotalMantenciones", totalMantenciones);
    setText("reportTotalOrdenes", totalOrdenes);

    const summary = $("reportSummary");

    if (summary) {
      summary.innerHTML = `
        <p><strong>Equipos registrados:</strong> ${total}</p>
        <p><strong>Equipos activos:</strong> ${activos}</p>
        <p><strong>Equipos en mantencion:</strong> ${enMantencion}</p>
        <p><strong>Mantenciones registradas:</strong> ${totalMantenciones}</p>
        <p><strong>Ordenes de trabajo:</strong> ${totalOrdenes}</p>
      `;
    }
  }

  // =========================================================
  // EVENTOS
  // =========================================================
  $("loginForm")?.addEventListener("submit", event => {
    event.preventDefault();
    setView();
    showNotice("Modo de prueba activo.");
  });

  $("logoutBtn")?.addEventListener("click", event => {
    event.preventDefault();
    logout();
  });

  document.querySelectorAll(".nav-item").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      navigate(button.dataset.section);
    });
  });

  document.querySelectorAll("[data-go]").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      navigate(button.dataset.go);
    });
  });

  document.querySelectorAll("[data-close]").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
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
  // INICIALIZACION
  // =========================================================
  setLinks();
  setView();
  navigate("dashboard");

  loadAll().catch(error => {
    console.error("Error inesperado al iniciar la aplicacion:", error);
    showNotice("No se pudieron cargar los datos. Puedes seguir navegando.", true);
  });

})();
