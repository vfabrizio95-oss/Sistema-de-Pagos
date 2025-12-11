/* ═══════════════════════════════════════════════════════════════════
   FINANCIERA BASHE - SISTEMA UNIFICADO v4.0
   JavaScript principal con todas las funcionalidades

   CORRECCIÓN FINAL: Se asegura la actualización del objeto 'prestamo'
   en el array global y el refresco total de la UI después de un pago
   aprobado por Mercado Pago, ya que no se utiliza un backend.
   ═══════════════════════════════════════════════════════════════ */

// ═══════ CONFIGURACIÓN ═══════
const CONFIG = {
    API_TOKEN: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6Inhpb21hcmF2ZXJhcGVyZXoyNkBnbWFpbC5jb20ifQ.4xtw1x9_oL0eTFr3M50L-gUlFZMDL_eB2mFhmCUWo4E',
    API_BASE: 'https://dniruc.apisperu.com/api/v1',
    EMPRESA: 'FINANCIERA BASHE S.A.C.',
    RUC_EMPRESA: '24568912345',
    TEA_MAXIMA: 115.14,
    MORA_MENSUAL: 0.01, // 1% mensual sobre saldo
    DIRECCION_FISCAL: 'Av. Los Libertadores Nro. 150 - San Isidro, Lima'
};

// Cargos para detección PEP
const CARGOS_PEP = [
    'presidente', 'vicepresidente', 'ministro', 'viceministro',
    'congresista', 'alcalde', 'regidor', 'gobernador',
    'juez', 'fiscal', 'embajador', 'general', 'almirante',
    'director general', 'contralor', 'superintendente'
];

// ═══════ ESTADO GLOBAL ═══════
let clienteActual = null;
let prestamos = [];
let pagos = [];
let caja = { efectivo: 0, cuenta: 0 };
let cierresCaja = [];
let tipoConsulta = 'dni';
let prestamoEnPago = null;
let prestamoEnCronograma = null;
let busquedaActual = '';
let cierreEnDetalle = null;

// ═══════ INICIALIZACIÓN ═══════
document.addEventListener('DOMContentLoaded', () => {
    cargarDatos();

    // Si regresamos de Mercado Pago, mostrar el resultado y salir del flujo normal
    if (checkMercadoPagoReturn()) {
        initUI(); // Inicializar UI si regresamos a la página principal
        return;
    }

    initUI();

    // Verificar sesión existente
    if (localStorage.getItem('basheUser')) {
        mostrarPanel();
    }

    // Año en footer
    const footerYear = document.getElementById('footerYear');
    if (footerYear) footerYear.textContent = new Date().getFullYear();
});

function initUI() {
    const hoy = new Date().toISOString().split('T')[0];
    const fechaReg = document.getElementById('regFecha');
    if (fechaReg) {
        // Solo ponemos un valor inicial (hoy), pero SIN restricciones
        fechaReg.value = hoy;
        // No usamos min ni max para permitir cualquier fecha
    }

    // Actualizar TEM inicial
    actualizarTEMSimulador();
    actualizarTEMRegistro();

    // Event listeners para TEA
    const simTEA = document.getElementById('simTEA');
    if (simTEA) simTEA.addEventListener('input', actualizarTEMSimulador);

    const regTEA = document.getElementById('regTEA');
    if (regTEA) regTEA.addEventListener('input', actualizarTEMRegistro);
}

// ═══════ NAVEGACIÓN ENTRE VISTAS ═══════
function scrollTo(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
}

function mostrarLogin() {
    document.getElementById('viewLanding').classList.add('hidden');
    document.getElementById('viewLogin').classList.remove('hidden');
    document.getElementById('viewPanel').classList.add('hidden');
}

function volverLanding() {
    document.getElementById('viewLanding').classList.remove('hidden');
    document.getElementById('viewLogin').classList.add('hidden');
    document.getElementById('viewPanel').classList.add('hidden');
}

function mostrarPanel() {
    document.getElementById('viewLanding').classList.add('hidden');
    document.getElementById('viewLogin').classList.add('hidden');
    document.getElementById('viewPanel').classList.remove('hidden');

    const user = localStorage.getItem('basheUser') || 'Admin';
    const panelUserName = document.getElementById('panelUserName');
    if (panelUserName) panelUserName.textContent = `— ${user}`;

    actualizarEstadisticas();
    renderPrestamos();
    renderPagos();
    renderCaja();
}

function switchTab(tabId) {
    // Ocultar todos los tabs
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

    // Mostrar tab seleccionado
    const tabContent = document.getElementById('tab-' + tabId);
    if (tabContent) tabContent.classList.add('active');

    const tabBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if (tabBtn) tabBtn.classList.add('active');
}

// ═══════ AUTENTICACIÓN ═══════
function hacerLogin(e) {
    e.preventDefault();

    const user = document.getElementById('loginUser').value.trim();
    const pass = document.getElementById('loginPass').value;
    const msg = document.getElementById('loginMsg');
    const btnText = document.getElementById('btnLoginText');
    const btnSpinner = document.getElementById('btnLoginSpinner');

    if (!user) {
        mostrarAlerta(msg, 'Ingrese un usuario', 'error');
        return false;
    }

    // >>> CAMBIO 1: El usuario debe ser 'admin'
    if (user !== 'admin') {
        mostrarAlerta(msg, '❌ Usuario incorrecto', 'error');
        return false;
    }
    
    // Mostrar loading
    btnText.textContent = 'Verificando...';
    btnSpinner.classList.remove('hidden');

    setTimeout(() => {
        if (pass !== 'admin123') {
            mostrarAlerta(msg, '❌ Contraseña incorrecta', 'error');
            btnText.textContent = 'Iniciar Sesión';
            btnSpinner.classList.add('hidden');
            return;
        }

        // Login exitoso
        localStorage.setItem('basheUser', user);
        mostrarAlerta(msg, '✅ Acceso correcto. Redirigiendo...', 'success');

        setTimeout(() => {
            mostrarPanel();
            btnText.textContent = 'Iniciar Sesión';
            btnSpinner.classList.add('hidden');
            msg.classList.add('hidden');
        }, 500);
    }, 500);

    return false;
}

function cerrarSesion() {
    if (confirm('¿Cerrar sesión?')) {
        localStorage.removeItem('basheUser');
        volverLanding();
    }
}

// ═══════ UTILIDADES ═══════
function PEN(valor) {
    return 'S/ ' + (Math.round((valor || 0) * 100) / 100).toLocaleString('es-PE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatFecha(iso) {
    if (!iso) return '-';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
}

function obtenerHoyLocalISO() {
    const hoy = new Date();
    const anio = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`; // formato YYYY-MM-DD en hora local
}


function esDNI(v) {
    return /^\d{8}$/.test(String(v || '').trim());
}

function esRUC(v) {
    return /^\d{11}$/.test(String(v || '').trim());
}

// Nueva función de validación de formato de email
function esEmailValido(email) {
    // Regex estándar para validación básica de formato de correo
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function calcularCuotaFrances(monto, teaAnual, plazoMeses) {
    const i = Math.pow(1 + teaAnual / 100, 1 / 12) - 1; // TEM
    if (i === 0) return monto / plazoMeses;
    return monto * (i * Math.pow(1 + i, plazoMeses)) / (Math.pow(1 + i, plazoMeses) - 1);
}

function calcularTEM(tea) {
    return Math.pow(1 + tea / 100, 1 / 12) - 1;
}

function sumarMeses(fechaISO, meses) {
    const d = new Date(fechaISO + 'T00:00:00');
    d.setMonth(d.getMonth() + meses);
    return d.toISOString().split('T')[0];
}

function diffMeses(fecha1, fecha2) {
    const d1 = new Date(fecha1 + 'T00:00:00');
    const d2 = new Date(fecha2 + 'T00:00:00');
    let meses = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
    if (d2.getDate() > d1.getDate()) meses++;
    return Math.max(0, meses);
}

function esPosiblePEP(nombre) {
    if (!nombre) return false;
    const n = nombre.toLowerCase();
    return CARGOS_PEP.some(c => n.includes(c));
}

function mostrarAlerta(el, msg, tipo) {
    if (!el) return;
    el.textContent = msg;
    el.className = `alert alert-${tipo}`;
    el.classList.remove('hidden');
}

function ocultarAlerta(el) {
    if (el) el.classList.add('hidden');
}

function generarId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// ═══════ PERSISTENCIA EN LOCALSTORAGE ═══════
function cargarDatos() {
    prestamos = JSON.parse(localStorage.getItem('bashePrestamos') || '[]');
    pagos = JSON.parse(localStorage.getItem('bashePagos') || '[]');
    caja = JSON.parse(localStorage.getItem('basheCaja') || '{"efectivo":0,"cuenta":0}');
    cierresCaja = JSON.parse(localStorage.getItem('basheCierres') || '[]');
}

function guardarDatos() {
    localStorage.setItem('bashePrestamos', JSON.stringify(prestamos));
    localStorage.setItem('bashePagos', JSON.stringify(pagos));
    localStorage.setItem('basheCaja', JSON.stringify(caja));
    localStorage.setItem('basheCierres', JSON.stringify(cierresCaja));
}

// ═══════ SIMULADOR ═══════
function actualizarTEMSimulador() {
    const tea = parseFloat(document.getElementById('simTEA')?.value) || 0;
    const tem = calcularTEM(tea) * 100;
    const simTEM = document.getElementById('simTEM');
    if (simTEM) simTEM.textContent = tem.toFixed(2) + '%';
}

function actualizarTEMRegistro() {
    const tea = parseFloat(document.getElementById('regTEA')?.value) || 0;
    const tem = calcularTEM(tea) * 100;
    const regTEM = document.getElementById('regTEM');
    if (regTEM) regTEM.textContent = tem.toFixed(2) + '%';
}

function calcularSimulador() {
    const monto = parseFloat(document.getElementById('simMonto').value) || 0;
    const plazo = parseInt(document.getElementById('simPlazo').value) || 0;
    const tea = parseFloat(document.getElementById('simTEA').value) || 0;

    const resultado = document.getElementById('simResultado');
    const cuotaTexto = document.getElementById('simCuotaTexto');
    const detalleTexto = document.getElementById('simDetalleTexto');

    // Validar TEA máxima
    if (tea > CONFIG.TEA_MAXIMA) {
        cuotaTexto.textContent = '⚠️ TEA excede límite BCRP';
        detalleTexto.textContent = `Máximo permitido: ${CONFIG.TEA_MAXIMA}%`;
        resultado.classList.remove('hidden');
        return;
    }

    if (monto <= 0 || plazo <= 0 || tea <= 0) {
        cuotaTexto.textContent = 'Complete los datos';
        detalleTexto.textContent = '';
        resultado.classList.remove('hidden');
        return;
    }

    const cuota = calcularCuotaFrances(monto, tea, plazo);
    const total = cuota * plazo;
    const interes = total - monto;
    const tem = calcularTEM(tea) * 100;

    cuotaTexto.textContent = PEN(cuota) + ' / mes';
    detalleTexto.textContent = `Total: ${PEN(total)} | Interés: ${PEN(interes)} | TEM: ${tem.toFixed(2)}%`;
    resultado.classList.remove('hidden');
}

// === MODIFICADA: MEJORA DE CRONOGRAMA SIMULADOR ===
function generarCronogramaSimulador() {
    const monto = parseFloat(document.getElementById('simMonto').value) || 0;
    const plazo = parseInt(document.getElementById('simPlazo').value) || 0;
    const tea = parseFloat(document.getElementById('simTEA').value) || 0;

    const container = document.getElementById('cronogramaSimulador');
    const tbody = document.querySelector('#tablaCronograma tbody');

    if (monto <= 0 || plazo <= 0 || tea <= 0) {
        alert('Complete los datos correctamente');
        return;
    }

    if (tea > CONFIG.TEA_MAXIMA) {
        alert(`TEA excede el límite BCRP de ${CONFIG.TEA_MAXIMA}%`);
        return;
    }

    const cuota = calcularCuotaFrances(monto, tea, plazo);
    const tem = calcularTEM(tea);
    let saldo = monto;

    tbody.innerHTML = '';

    for (let i = 1; i <= plazo; i++) {
        const fecha = sumarMeses(obtenerHoyLocalISO(), i); // Usamos hoy como fecha de desembolso simulada
        const interes = saldo * tem;
        let amort = cuota - interes;
        const cuotaReal = amort + interes;

        if (i === plazo) {
            amort = saldo;
            saldo = 0;
        } else {
            saldo = Math.max(0, saldo - amort);
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
      <td>${i}</td>
      <td>${PEN(cuotaReal)}</td>
      <td>${PEN(interes)}</td>
      <td>${PEN(amort)}</td>
      <td>${PEN(saldo)}</td>
    `;
        tbody.appendChild(tr);
    }

    container.classList.remove('hidden');
}

// ═══════ VERIFICACIÓN DE CLIENTE ═══════
function cambiarTipoConsulta(tipo) {
    tipoConsulta = tipo;

    document.getElementById('tabDNI').classList.toggle('active', tipo === 'dni');
    document.getElementById('tabRUC').classList.toggle('active', tipo === 'ruc');
    document.getElementById('seccionDNI').classList.toggle('hidden', tipo !== 'dni');
    document.getElementById('seccionRUC').classList.toggle('hidden', tipo !== 'ruc');

    limpiarVerificacion();
}

function limpiarVerificacion() {
    clienteActual = null;
    document.getElementById('clienteVerificado').classList.add('hidden');
    document.getElementById('alertaPEP').classList.add('hidden');
    document.getElementById('btnRegistrar').disabled = true;
    ocultarAlerta(document.getElementById('verificacionMsg'));
}

async function verificarCliente() {
    const valor = tipoConsulta === 'dni'
        ? document.getElementById('inputDNI').value.trim()
        : document.getElementById('inputRUC').value.trim();

    const msg = document.getElementById('verificacionMsg');
    const btnText = document.getElementById('btnVerificarText');
    const btnSpinner = document.getElementById('btnVerificarSpinner');
    const btn = document.getElementById('btnVerificar');

    // Validar formato
    if (tipoConsulta === 'dni' && !esDNI(valor)) {
        mostrarAlerta(msg, '❌ DNI debe tener 8 dígitos', 'error');
        return;
    }
    if (tipoConsulta === 'ruc' && !esRUC(valor)) {
        mostrarAlerta(msg, '❌ RUC debe tener 11 dígitos', 'error');
        return;
    }

    // Mostrar loading
    btnText.textContent = 'Consultando...';
    btnSpinner.classList.remove('hidden');
    btn.disabled = true;

    try {
        const url = `${CONFIG.API_BASE}/${tipoConsulta}/${valor}?token=${CONFIG.API_TOKEN}`;
        const res = await fetch(url);

        if (!res.ok) throw new Error(`Error ${res.status}`);

        const data = await res.json();
        if (data.error) throw new Error(data.error);

        // Procesar respuesta según tipo
        if (tipoConsulta === 'dni') {
            const nombre = [data.nombres, data.apellidoPaterno, data.apellidoMaterno]
                .filter(Boolean).join(' ').trim();
            clienteActual = {
                nombre: nombre || 'Sin nombres',
                documento: valor,
                tipo: 'Persona Natural',
                direccion: data.direccion || 'No disponible',
                origen: 'api',
                esPEP: esPosiblePEP(nombre)
            };
        } else {
            clienteActual = {
                nombre: data.razonSocial || 'Sin razón social',
                documento: valor,
                tipo: 'Persona Jurídica',
                direccion: data.direccion || 'No disponible',
                origen: 'api',
                esPEP: esPosiblePEP(data.razonSocial)
            };
        }

        mostrarClienteVerificado();
        mostrarAlerta(msg, '✅ Cliente verificado correctamente', 'success');

    } catch (error) {
        console.error('Error API:', error);
        mostrarAlerta(msg, `❌ Error: ${error.message}. Use registro manual.`, 'error');
        clienteActual = null;
        limpiarVerificacion();
    } finally {
        btnText.textContent = '🔍 Verificar API';
        btnSpinner.classList.add('hidden');
        btn.disabled = false;
    }
}

function mostrarClienteVerificado() {
    if (!clienteActual) return;

    document.getElementById('vNombre').textContent = clienteActual.nombre;
    document.getElementById('vDocumento').textContent = clienteActual.documento;
    document.getElementById('vTipo').textContent = clienteActual.tipo;
    document.getElementById('vDireccion').textContent = clienteActual.direccion;

    // Mostrar badge manual si aplica
    const origenManual = document.getElementById('vOrigenManual');
    if (origenManual) {
        origenManual.classList.toggle('hidden', clienteActual.origen !== 'manual');
    }

    // Mostrar alerta PEP
    const alertaPEP = document.getElementById('alertaPEP');
    if (alertaPEP) {
        alertaPEP.classList.toggle('hidden', !clienteActual.esPEP);
    }

    document.getElementById('clienteVerificado').classList.remove('hidden');
    document.getElementById('btnRegistrar').disabled = false;
}

// ═══════ REGISTRO MANUAL ═══════
function abrirModalManual() {
    document.getElementById('modalManual').classList.add('active');
}

function cerrarModalManual() {
    document.getElementById('modalManual').classList.remove('active');
}

function registrarManual() {
    const tipo = document.getElementById('manualTipo').value;
    const documento = document.getElementById('manualDocumento').value.trim();
    const nombre = document.getElementById('manualNombre').value.trim();
    const direccion = document.getElementById('manualDireccion').value.trim() || 'No especificada';

    // Validaciones
    if (!documento || !nombre) {
        alert('Complete documento y nombre');
        return;
    }

    if (tipo === 'DNI' && !esDNI(documento)) {
        alert('DNI debe tener 8 dígitos');
        return;
    }

    if (tipo === 'RUC' && !esRUC(documento)) {
        alert('RUC debe tener 11 dígitos');
        return;
    }

    clienteActual = {
        nombre: nombre,
        documento: documento,
        tipo: tipo === 'DNI' ? 'Persona Natural' : 'Persona Jurídica',
        direccion: direccion,
        origen: 'manual',
        esPEP: esPosiblePEP(nombre)
    };

    mostrarClienteVerificado();
    cerrarModalManual();

    // Limpiar formulario
    document.getElementById('manualDocumento').value = '';
    document.getElementById('manualNombre').value = '';
    document.getElementById('manualDireccion').value = '';

    mostrarAlerta(document.getElementById('verificacionMsg'), '✅ Cliente registrado manualmente', 'success');
}

// ═══════ REGISTRO DE PRÉSTAMO ═══════
function registrarPrestamo() {
    if (!clienteActual) {
        alert('Primero verifique un cliente');
        return;
    }

    const monto = parseFloat(document.getElementById('regMonto').value) || 0;
    const tea = parseFloat(document.getElementById('regTEA').value) || 0;
    const plazo = parseInt(document.getElementById('regPlazo').value) || 0;
    const fecha = document.getElementById('regFecha').value;
    const analista = document.getElementById('regAnalista').value.trim();
    const celular = document.getElementById('regCelular').value.trim();
    const correo = document.getElementById('regCorreo').value.trim();
    const terminos = document.getElementById('regTerminos').checked;

    const msg = document.getElementById('registroMsg');

    // 1. Validaciones de Monto, Tasa y Plazo
    if (monto <= 0) {
        mostrarAlerta(msg, '❌ Ingrese un monto válido', 'error');
        return;
    }

    if (tea > CONFIG.TEA_MAXIMA) {
        mostrarAlerta(msg, `❌ TEA excede límite BCRP de ${CONFIG.TEA_MAXIMA}%`, 'error');
        return;
    }

    if (plazo <= 0) {
        mostrarAlerta(msg, '❌ Ingrese un plazo válido', 'error');
        return;
    }

    if (!fecha || !analista || !terminos) {
        mostrarAlerta(msg, '❌ Complete los campos obligatorios (Fecha, Analista, Términos)', 'error');
        return;
    }
    const MONTO_MINIMO = 0;
    const MONTO_MAXIMO = 10000;
    const PLAZO_MAXIMO_MESES = 60; // Límite de 60 meses (5 años)

    // 1. Validaciones
    if (monto < MONTO_MINIMO) {
        alert(`❌ Error: El monto mínimo a prestar es de ${PEN(MONTO_MINIMO)}.`);
        return;
    }

    if (monto > MONTO_MAXIMO) {
        alert(`❌ Error: El monto máximo a prestar es de ${PEN(MONTO_MAXIMO)}. Para montos mayores, contacte a un administrador.`);
        return;
    }

    if (plazo > PLAZO_MAXIMO_MESES) {
        alert(`❌ Error: El plazo máximo permitido para un préstamo es de ${PLAZO_MAXIMO_MESES} meses.`);
        return;
    }

    // 2. NUEVA VALIDACIÓN: Celular (9 dígitos)
    if (!/^\d{9}$/.test(celular)) {
        mostrarAlerta(msg, '❌ El celular debe contener exactamente 9 dígitos numéricos', 'error');
        return;
    }

    // 3. NUEVA VALIDACIÓN: Correo
    if (correo && !esEmailValido(correo)) {
        mostrarAlerta(msg, '❌ Ingrese un formato de correo electrónico válido', 'error');
        return;
    }

    // Verificar si cliente ya tiene préstamo activo
    const prestamoActivo = prestamos.find(p =>
        p.documento === clienteActual.documento && !p.cancelado
    );

    if (prestamoActivo) {
        mostrarAlerta(msg, '❌ Este cliente ya tiene un préstamo activo', 'error');
        return;
    }

    // Calcular cuota
    const cuota = calcularCuotaFrances(monto, tea, plazo);
    
    // >>> CAMBIO 2: Validar que Analista solo contenga letras y espacios
    const regexSoloLetras = /^[a-zA-Z\s]+$/;
    if (!regexSoloLetras.test(analista)) {
        mostrarAlerta(msg, '❌ El campo Analista solo debe contener letras y espacios', 'error');
        return;
    }
    // Crear préstamo
    const prestamo = {
        id: 'P' + generarId(),
        fechaRegistro: new Date().toISOString(),
        fechaDesembolso: fecha,
        cliente: clienteActual.nombre,
        documento: clienteActual.documento,
        tipoCliente: clienteActual.tipo,
        direccion: clienteActual.direccion,
        esPEP: clienteActual.esPEP,
        celular: celular,
        correo: correo,
        analista: analista,
        montoOriginal: monto,
        saldo: monto,
        tea: tea,
        tem: calcularTEM(tea) * 100,
        plazoOriginal: plazo,
        cuotaBase: cuota,
        cuotasPagadas: 0,
        moraAcumulada: 0,
        cancelado: false,
        fechaCancelacion: null
    };

    prestamos.push(prestamo);
    guardarDatos();

    // Limpiar formulario
    document.getElementById('regMonto').value = '';
    document.getElementById('regAnalista').value = '';
    document.getElementById('regCelular').value = '';
    document.getElementById('regCorreo').value = '';
    document.getElementById('regTerminos').checked = false;

    // Limpiar cliente
    clienteActual = null;
    limpiarVerificacion();
    document.getElementById('inputDNI').value = '';
    document.getElementById('inputRUC').value = '';

    // Actualizar UI
    actualizarEstadisticas();
    renderPrestamos();

    mostrarAlerta(msg, '✅ Préstamo registrado exitosamente', 'success');
    setTimeout(() => ocultarAlerta(msg), 3000);
}

// ═══════ ESTADÍSTICAS ═══════
function actualizarEstadisticas() {
    const activos = prestamos.filter(p => !p.cancelado);
    const cancelados = prestamos.filter(p => p.cancelado);
    const capitalActivo = activos.reduce((sum, p) => sum + p.saldo, 0);

    const statTotal = document.getElementById('statTotal');
    const statActivos = document.getElementById('statActivos');
    const statCancelados = document.getElementById('statCancelados');
    const statCapital = document.getElementById('statCapital');

    if (statTotal) statTotal.textContent = prestamos.length;
    if (statActivos) statActivos.textContent = activos.length;
    if (statCancelados) statCancelados.textContent = cancelados.length;
    if (statCapital) statCapital.textContent = PEN(capitalActivo);
}

// ═══════ RENDER PRÉSTAMOS ═══════
function renderPrestamos() {
    const container = document.getElementById('listaPrestamos');
    const contador = document.getElementById('contadorPrestamos');

    if (!container) return;

    // Filtrar por búsqueda
    let lista = [...prestamos];
    if (busquedaActual) {
        const q = busquedaActual.toLowerCase();
        lista = lista.filter(p =>
            p.cliente.toLowerCase().includes(q) ||
            p.documento.includes(q) ||
            p.celular.includes(q) ||
            p.analista.toLowerCase().includes(q)
        );
    }

    // Ordenar: activos primero, luego por fecha
    lista.sort((a, b) => {
        if (a.cancelado !== b.cancelado) return a.cancelado ? 1 : -1;
        return new Date(b.fechaDesembolso) - new Date(a.fechaDesembolso);
    });

    if (contador) contador.textContent = lista.length;

    if (lista.length === 0) {
        container.innerHTML = '<p class="muted" style="text-align:center;padding:var(--space-lg);">No hay préstamos registrados</p>';
        return;
    }

    container.innerHTML = lista.map(p => `
    <div class="loan-card ${p.cancelado ? 'cancelado' : ''}">
      <div class="loan-header">
        <span class="loan-client">
          ${p.cliente}
          ${p.esPEP ? '<span class="badge" style="background:var(--error-bg);color:var(--error);margin-left:8px;">⚠️ PEP</span>' : ''}
        </span>
        <div class="loan-badges">
          ${p.cancelado ? '<span class="badge" style="background:var(--success-bg);color:var(--success);">✅ CANCELADO</span>' : ''}
        </div>
      </div>
      <div class="loan-grid">
        <div><strong>Doc:</strong> ${p.documento}</div>
        <div><strong>Celular:</strong> ${p.celular}</div>
        <div><strong>Analista:</strong> ${p.analista}</div>
        <div><strong>Desembolso:</strong> ${formatFecha(p.fechaDesembolso)}</div>
        <div><strong>Monto:</strong> ${PEN(p.montoOriginal)}</div>
        <div><strong>Saldo:</strong> ${PEN(p.saldo)}</div>
        <div><strong>TEA:</strong> ${p.tea}%</div>
        <div><strong>Cuota:</strong> ${PEN(p.cuotaBase)}</div>
        <div><strong>Pagadas:</strong> ${p.cuotasPagadas}/${p.plazoOriginal}</div>
      </div>
      <div class="loan-actions">
        <button class="btn btn-sm btn-outline" onclick="verCronograma('${p.id}')">📋 Cronograma</button>
        ${!p.cancelado ? `<button class="btn btn-sm btn-primary" onclick="abrirModalPago('${p.id}')">💵 Pagar</button>` : ''}
        <button class="btn btn-sm btn-danger" onclick="eliminarPrestamo('${p.id}')">🗑️</button>
      </div>
    </div>
  `).join('');
}

function filtrarPrestamos() {
    busquedaActual = document.getElementById('buscarPrestamo')?.value.trim() || '';
    renderPrestamos();
}

function eliminarPrestamo(id) {
    if (!confirm('¿Eliminar este préstamo? Esta acción no se puede deshacer.')) return;

    const index = prestamos.findIndex(p => p.id === id);
    if (index > -1) {
        prestamos.splice(index, 1);
        guardarDatos();
        actualizarEstadisticas();
        renderPrestamos();
    }
}

// === MODIFICADA: MEJORA DE CRONOGRAMA MODAL ===
function verCronograma(id) {
    const prestamo = prestamos.find(p => p.id === id);
    if (!prestamo) return;

    prestamoEnCronograma = prestamo;

    document.getElementById('cronogramaModalId').textContent = prestamo.id;

    // Info del préstamo mejorada
    const info = document.getElementById('cronogramaInfo');
    if (info) {
        info.innerHTML = `
      <p style="margin-bottom: var(--space-xs);">
        <strong>Cliente:</strong> ${prestamo.cliente} (Doc: ${prestamo.documento}) | 
        <strong>Analista:</strong> ${prestamo.analista}
      </p>
      <p>
        <strong>Monto Desembolsado:</strong> ${PEN(prestamo.montoOriginal)} | 
        <strong>TEA:</strong> ${prestamo.tea}% | 
        <strong>TEM:</strong> ${prestamo.tem.toFixed(2)}% | 
        <strong>Cuota Fija:</strong> ${PEN(prestamo.cuotaBase)}
      </p>
    `;
    }

    // Generar tabla
    const tbody = document.querySelector('#tablaCronogramaModal tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    const cuota = prestamo.cuotaBase;
    const tem = calcularTEM(prestamo.tea);
    let saldo = prestamo.montoOriginal;

    for (let i = 1; i <= prestamo.plazoOriginal; i++) {
        const fecha = sumarMeses(prestamo.fechaDesembolso, i);

        let interes = saldo * tem;
        let amort = cuota - interes;
        let cuotaReal = cuota;
        let estado = 'Pendiente';
        let color = 'var(--text-muted)';

        // Ajuste de la última cuota para cuadrar a cero
        if (i === prestamo.plazoOriginal) {
            amort = saldo;
            cuotaReal = interes + amort;
        }

        // Actualización del saldo proyectado (usando toFixed(2) y luego parseFloat para evitar errores de coma flotante)
        let saldoProyectado = parseFloat((saldo - amort).toFixed(2));
        saldoProyectado = Math.max(0, saldoProyectado);

        // Detección de cuota pagada
        if (i <= prestamo.cuotasPagadas) {
            estado = '✅ Pagado';
            color = 'var(--success)';

            if (i === prestamo.cuotasPagadas) {
                saldo = prestamo.saldo; // Esto es una aproximación para entornos de demostración.
            }
        } else {
            saldo = saldoProyectado;
        }

        const saldoMostrado = (i <= prestamo.cuotasPagadas) ? 'Pagado' : PEN(saldoProyectado);

        const tr = document.createElement('tr');
        tr.style.color = color;
        tr.style.opacity = i <= prestamo.cuotasPagadas ? '0.7' : '1';

        tr.innerHTML = `
      <td>${i}</td>
      <td>${formatFecha(fecha)}</td>
      <td>${PEN(cuotaReal)}</td>
      <td>${PEN(interes)}</td>
      <td>${PEN(amort)}</td>
      <td>${(i === prestamo.plazoOriginal && saldoProyectado < 0.01) ? PEN(0) : saldoMostrado}</td>
      <td><span style="font-weight:700;">${estado}</span></td>
    `;
        tbody.appendChild(tr);
    }

    document.getElementById('modalCronograma').classList.add('active');
}

function cerrarModalCronograma() {
    document.getElementById('modalCronograma').classList.remove('active');
    prestamoEnCronograma = null;
}

// === FUNCIÓN: IMPRIMIR CRONOGRAMA ===
function imprimirCronograma() {
    const modalContent = document.getElementById('modalCronograma').querySelector('.modal');
    if (!modalContent) return;

    // Extraer el contenido relevante para la impresión
    const header = modalContent.querySelector('.modal-header h3').textContent;
    const info = modalContent.querySelector('#cronogramaInfo').innerHTML;
    const tableHtml = modalContent.querySelector('#tablaCronogramaModal').outerHTML;

    const printContent = `
        <div style="font-family: sans-serif; color: #000; padding: 20px;">
            <div style="text-align: center; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px;">
                <h2 style="color: #000; margin-bottom: 5px;">${CONFIG.EMPRESA}</h2>
                <h4 style="color: #000;">${header}</h4>
            </div>
            ${info.replace(/var\(--gold\)/g, '#000').replace(/var\(--text-light\)/g, '#333').replace(/var\(--text-muted\)/g, '#555')}
            <div style="margin-top: 20px;">
                ${tableHtml.replace(/background: rgba\(255, 255, 255, 0.05\)/g, 'background: #f0f0f0')}
            </div>
            <p style="margin-top: 30px; font-size: 0.8em; text-align: center; color: #555;">
                Generado el: ${formatFecha(obtenerHoyLocalISO())}. Documento no contractual.
            </p>
        </div>
    `;

    const printWindow = window.open('', 'PrintWindow', 'width=800,height=600');
    printWindow.document.write('<html><head><title>Cronograma de Pagos</title>');

    // Incluir estilos básicos de impresión y resetear estilos de fondo oscuros
    printWindow.document.write(`
        <style>
            body { font-family: sans-serif; background: white; color: #000; padding: 20px; }
            table { width: 100%; border-collapse: collapse; font-size: 10pt; margin-top: 15px; }
            th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
            th { background-color: #f0f0f0; color: #333; }
            p { color: #333; }
        </style>
    `);
    printWindow.document.write('</head><body>');
    printWindow.document.write(printContent);
    printWindow.document.write('</body></html>');
    printWindow.document.close();

    printWindow.focus();
    // Usamos setTimeout para dar tiempo al navegador de renderizar y aplicar estilos
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 500);

    cerrarModalCronograma();
}

// ═══════ SISTEMA DE PAGOS ═══════
function abrirModalPago(id) {
    const prestamo = prestamos.find(p => p.id === id);
    if (!prestamo || prestamo.cancelado) return;

    prestamoEnPago = prestamo;

    const hoy = obtenerHoyLocalISO();

    const pagoFecha = document.getElementById('pagoFecha');
    if (pagoFecha) {
        pagoFecha.value = hoy;   // Mostrar por defecto la fecha de hoy
        pagoFecha.min = hoy;     // Bloquear todas las fechas pasadas
        // No se coloca max, así que permite hoy y cualquier fecha futura
    }

    document.getElementById('pagoCuotaBase').value = prestamo.cuotaBase.toFixed(2);


    // Calcular mora: 1% mensual sobre saldo por meses de atraso
    const cuotasPagadas = prestamo.cuotasPagadas || 0;
    const fechaVenc = sumarMeses(prestamo.fechaDesembolso, cuotasPagadas + 1);
    const mesesAtraso = diffMeses(fechaVenc, hoy);
    const mora = mesesAtraso > 0 ? prestamo.saldo * CONFIG.MORA_MENSUAL * mesesAtraso : 0;

    document.getElementById('pagoMora').value = mora.toFixed(2);

    const moraDetalle = document.getElementById('pagoMoraDetalle');
    if (moraDetalle) {
        moraDetalle.textContent = mesesAtraso === 0
            ? 'Sin atraso, no hay mora'
            : `${mesesAtraso} mes(es) de atraso desde ${formatFecha(fechaVenc)}. Mora = 1% mensual sobre saldo.`;
    }

    const totalSugerido = prestamo.cuotaBase + mora;
    document.getElementById('pagoTotal').value = totalSugerido.toFixed(2);
    document.getElementById('pagoEfectivo').value = totalSugerido.toFixed(2);
    document.getElementById('pagoCuenta').value = '0';

    // Info del préstamo
    const info = document.getElementById('pagoInfo');
    if (info) {
        info.innerHTML = `<strong>${prestamo.cliente}</strong> | Saldo: ${PEN(prestamo.saldo)} | Cuota ${cuotasPagadas + 1}/${prestamo.plazoOriginal}`;
    }

    ocultarAlerta(document.getElementById('pagoDistError'));
    document.getElementById('modalPago').classList.add('active');

    // Por defecto se muestra la sección efectivo
    selectPaymentMethodInModal('efectivo');
}

function cerrarModalPago() {
    document.getElementById('modalPago').classList.remove('active');
    prestamoEnPago = null;
}

function validarDistribucion() {
    const total = parseFloat(document.getElementById('pagoTotal').value) || 0;
    const efectivo = parseFloat(document.getElementById('pagoEfectivo').value) || 0;
    const cuenta = parseFloat(document.getElementById('pagoCuenta').value) || 0;
    const suma = efectivo + cuenta;

    const error = document.getElementById('pagoDistError');

    if (Math.abs(suma - total) > 0.01) {
        mostrarAlerta(error, `Diferencia: ${PEN(Math.abs(suma - total))}. Efectivo + Cuenta debe ser igual al total.`, 'error');
    } else {
        ocultarAlerta(error);
    }
}

function registrarPagoEnSistema(fecha, total, mora, efectivo, cuenta) {
    if (!prestamoEnPago) return;

    // Buscar el índice del préstamo en el array global para modificarlo por referencia
    const prestamoIndex = prestamos.findIndex(p => p.id === prestamoEnPago.id);
    if (prestamoIndex === -1) return;

    // Usar la referencia directa del array global para modificar el objeto
    const currentLoan = prestamos[prestamoIndex];

    const capitalPagado = Math.min(total - mora, currentLoan.saldo);

    // Actualizar préstamo (modificando currentLoan, que es una referencia al array global)
    currentLoan.saldo = Math.max(0, currentLoan.saldo - capitalPagado);
    currentLoan.cuotasPagadas++;
    currentLoan.moraAcumulada += mora;

    // Verificar si se canceló
    if (currentLoan.saldo <= 0) {
        currentLoan.cancelado = true;
        currentLoan.fechaCancelacion = fecha;
    }

    // Actualizar caja
    caja.efectivo += efectivo;
    caja.cuenta += cuenta;

    // Registrar pago
    const pago = {
        id: 'PG' + generarId(),
        prestamoId: currentLoan.id,
        cliente: currentLoan.cliente,
        documento: currentLoan.documento,
        fecha: fecha,
        cuotaNumero: currentLoan.cuotasPagadas,
        total: total,
        mora: mora,
        capital: capitalPagado,
        efectivo: efectivo,
        cuenta: cuenta,
        saldoDespues: currentLoan.saldo,
        reciboNumero: 'R-' + String(pagos.length + 1).padStart(5, '0')
    };

    pagos.push(pago);

    // **Aseguramos la persistencia INMEDIATA**
    guardarDatos();

    // Cerrar modal de pago
    cerrarModalPago();

    // Actualizar UI
    actualizarEstadisticas();
    renderPrestamos();
    renderPagos();
    renderCaja();

    // Mostrar comprobante
    mostrarComprobante(pago);
}

function confirmarPago() {
    if (!prestamoEnPago) return;

    const fecha = document.getElementById('pagoFecha').value;
    const total = parseFloat(document.getElementById('pagoTotal').value) || 0;
    const mora = parseFloat(document.getElementById('pagoMora').value) || 0;
    const efectivo = parseFloat(document.getElementById('pagoEfectivo').value) || 0;
    const cuenta = parseFloat(document.getElementById('pagoCuenta').value) || 0;

    const error = document.getElementById('pagoDistError');

    // Validaciones
    if (!fecha) {
        mostrarAlerta(error, 'Seleccione fecha de pago', 'error');
        return;
    }

    if (total <= 0) {
        mostrarAlerta(error, 'El total debe ser mayor a 0', 'error');
        return;
    }

    const suma = efectivo + cuenta;
    if (Math.abs(suma - total) > 0.01) {
        mostrarAlerta(error, 'Efectivo + Cuenta debe ser igual al total', 'error');
        return;
    }

    // Llamar a la función de registro de pago
    registrarPagoEnSistema(fecha, total, mora, efectivo, cuenta);
}

// =========================================================================
// FUNCIONES AUXILIARES (Añadir estas dos funciones en app.js)
// =========================================================================

// Función auxiliar para determinar la forma de pago
const formaPago = (pago) => {
    // Usaremos los datos que ya tienes en el objeto pago
    if (pago.efectivo > 0 && pago.cuenta > 0) return 'Efectivo y Transferencia';
    if (pago.efectivo > 0) return 'Efectivo';
    if (pago.cuenta > 0) return 'Transferencia/Tarjeta';
    return 'N/A';
};

// =========================================================================
// FUNCIÓN CORREGIDA Y COMPLETA: CONVERSIÓN DE NÚMERO A LETRAS
// =========================================================================

function numeroALetras(num) {
    // Si el número viene como string (ej. "S/ 518.86"), lo limpiamos y convertimos a flotante
    if (typeof num === 'string') {
        num = parseFloat(num.replace(/[^0-9.]/g, ''));
    }
    
    // Si no es un número válido o es cero
    if (isNaN(num) || num <= 0) return 'CERO SOLES';

    const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
    const decenas = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
    const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];
    const especiales = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
    const veintenas = ['VEINTE', 'VEINTIÚN', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];


    function convertirGrupos(n) {
        let literal = '';
        if (n === 100) return 'CIEN';
        
        let c = Math.floor(n / 100);
        let d = Math.floor((n % 100) / 10);
        let u = n % 10;

        // Centenas
        if (c > 0) {
            literal += centenas[c] + ' ';
        }

        // Decenas y Unidades
        if (d === 1) { // 10 a 19
            literal += especiales[u] + ' ';
        } else if (d === 2) { // 20 a 29
            literal += veintenas[u] + ' ';
        } else if (d > 2) { // 30 a 99
            literal += decenas[d] + (u > 0 ? (' Y ' + unidades[u]) : '') + ' ';
        } else if (u > 0) { // 1 a 9
            literal += unidades[u] + ' ';
        }
        
        return literal.trim();
    }

    // Parte entera y decimal
    const parteEntera = Math.floor(num);
    // Redondeamos los céntimos para evitar problemas de coma flotante (ej: 0.86)
    const céntimos = Math.round((num - parteEntera) * 100); 
    const céntimosStr = céntimos.toString().padStart(2, '0');

    let literalEntera = '';
    let grupos = [];

    // Dividir la parte entera en grupos de tres dígitos (millones, miles, unidades)
    let temp = parteEntera;
    let divisor = 1000;
    
    // Hasta 999'999.99
    if (temp >= 1000000) {
        grupos[2] = Math.floor(temp / 1000000); // Millones
        temp %= 1000000;
    } else {
        grupos[2] = 0;
    }
    
    grupos[1] = Math.floor(temp / 1000); // Miles
    grupos[0] = temp % 1000; // Unidades

    // Procesar grupos
    if (grupos[2] > 0) {
        if (grupos[2] === 1) {
            literalEntera += 'UN MILLÓN ';
        } else {
            literalEntera += convertirGrupos(grupos[2]) + ' MILLONES ';
        }
    }

    if (grupos[1] > 0) {
        literalEntera += (grupos[1] === 1 ? 'MIL ' : convertirGrupos(grupos[1]) + ' MIL ');
    }

    if (grupos[0] > 0) {
        literalEntera += convertirGrupos(grupos[0]);
    }
    
    // Formato final
    literalEntera = literalEntera.trim().toUpperCase();
    if (literalEntera.length === 0) {
         literalEntera = 'CERO';
    }

    // Concatenar el resultado final (ej: QUINIENTOS DIECIOCHO CON 86/100 SOLES)
    return `${literalEntera} CON ${céntimosStr}/100 SOLES`;
}

// =========================================================================
// FIN FUNCIÓN NUMERO A LETRAS
// =========================================================================

function mostrarComprobante(pago) {
    const contenido = document.getElementById('comprobanteContenido');
    if (!contenido) return;

    // Obtener los datos del emisor del CONFIG (FINANCIERA BASHE S.A.C.)
    const empresa = CONFIG.EMPRESA;
    const rucEmpresa = CONFIG.RUC_EMPRESA;
    const direccionEmpresa = CONFIG.DIRECCION_FISCAL;
    
    // Obtener datos del pago
    const reciboNumero = pago.reciboNumero; 
    const fechaEmision = formatFecha(pago.fecha);
    const cliente = pago.cliente;
    const documento = pago.documento; // Asumiendo DNI/12345678
    const totalPagado = pago.total;
    // Se suma Capital e Intereses/Mora para el detalle
    const totalCapitalMora = pago.capital + pago.mora; 
    const formaDePago = formaPago(pago);
    const cuotaNumero = pago.cuotaNumero || 'N/A';
    const numEnLetras = numeroALetras(totalPagado);
    
    // Intentar separar Tipo y Número de Documento (si el formato es "DNI/12345678")
    const docParts = documento.split('/'); 
    const docType = docParts.length > 1 ? docParts[0] : 'DNI/RUC';
    const docNumber = docParts.length > 1 ? docParts[1] : documento;

    contenido.innerHTML = `
    <div class="comprobante boleta-electronica-style">
      
      <div class="boleta-header-empresa">
        <h3>${empresa}</h3>
        <p>R.U.C. N° ${rucEmpresa}</p>
        <p>${direccionEmpresa}</p>
      </div>
      
      <div class="boleta-header-documento">
        <p class="doc-type-label">BOLETA DE VENTA ELECTRÓNICA</p>
        <p class="doc-number-value">B001-${reciboNumero}</p>
      </div>

      <div class="boleta-datos-cliente-box">
        <h4>DATOS DEL CLIENTE</h4>
        <div class="dato-row">
            <span class="dato-label">Tipo/N° Documento:</span>
            <span class="dato-value">${docType}/${docNumber}</span>
        </div>
        <div class="dato-row">
            <span class="dato-label">Apellidos y Nombres:</span>
            <span class="dato-value">${cliente}</span>
        </div>
        <div class="dato-row">
            <span class="dato-label">Fecha de Emisión:</span>
            <span class="dato-value">${fechaEmision}</span>
        </div>
      </div>
      
      <div class="boleta-detalle-box">
        <h4>DETALLE DE LA OPERACIÓN</h4>
        <table class="boleta-detalle">
          <thead>
              <tr>
                  <th style="width: 50%;">DESCRIPCIÓN</th>
                  <th style="width: 25%;">VALOR VENTA</th>
                  <th style="width: 25%;">IMPORTE</th>
              </tr>
          </thead>
          <tbody>
              <tr>
                  <td>AMORTIZACIÓN PRÉSTAMO 1<br> Capital e Intereses - Cuota N° ${cuotaNumero}</td>
                  <td class="align-right">${PEN(totalCapitalMora)}</td>
                  <td class="align-right">${PEN(totalCapitalMora)}</td>
              </tr>
          </tbody>
        </table>
      </div>
      
      <div class="boleta-totales">
        <div class="total-row">
            <span class="total-label">SUBTOTAL</span>
            <span class="total-value">${PEN(totalCapitalMora)}</span>
        </div>
        <div class="total-row">
            <span class="total-label">IGV (0%)</span>
            <span class="total-value">${PEN(0.00)}</span>
        </div>
        <div class="total-row total-final">
            <span class="total-label">IMPORTE TOTAL S/</span>
            <span class="total-value">${PEN(totalPagado)}</span>
        </div>
      </div>

      <div class="boleta-footer-info">
        <p class="amount-in-words">SON: ${numEnLetras}</p>
        <div class="payment-info">
          <span class="dato-label">Forma de Pago:</span>
          <span class="dato-value">${formaDePago}</span>
        </div>
        <p style="margin-top: 15px; font-size: 0.8em;">Representación impresa de la Boleta de Venta Electrónica.</p>
      </div>
    </div>
  `;

    document.getElementById('modalComprobante').classList.add('active');
}

function cerrarModalComprobante() {
    document.getElementById('modalComprobante').classList.remove('active');
}

// === FUNCIÓN CORREGIDA: IMPRIMIR BOLETA/COMPROBANTE ===
// === FUNCIÓN CORREGIDA: IMPRIMIR BOLETA/COMPROBANTE (USANDO IFRAME) ===
function imprimirComprobante() {
    const comprobanteContent = document.getElementById('comprobanteContenido').innerHTML;
    if (!comprobanteContent) return;

    // --- 1. Crear el Iframe Temporal ---
    const iframe = document.createElement('iframe');
    iframe.id = 'print-iframe';
    // Ocultar el iframe
    iframe.style.position = 'absolute';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.left = '-10000px';

    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow.document;

    // --- 2. Iniciar la escritura de contenido y estilos ---
    iframeDoc.open();
    iframeDoc.write('<html><head><title>Comprobante de Pago</title>');
    
    // =================================================================================
    // INYECCIÓN DE ESTILOS DETALLADOS PARA LA BOLETA ELECTRÓNICA Y LA IMPRESIÓN
    // (Este bloque de estilos es el mismo que en la respuesta anterior, pero optimizado 
    // y necesario dentro del iframe para que el formato se mantenga al imprimir)
    // =================================================================================
    iframeDoc.write(`
        <style>
            /* Estilos generales (ajustados para el Iframe) */
            .comprobante.boleta-electronica-style {
                width: 400px; 
                margin: 20px auto;
                padding: 20px;
                border: 1px solid #ccc; 
                font-family: Arial, sans-serif;
                color: #000;
                box-shadow: 0 0 10px rgba(0,0,0,0.1);
                background-color: #fff;
                line-height: 1.4;
            }
            .boleta-header-empresa { text-align: center; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #000; }
            .boleta-header-empresa h3 { margin: 0; font-size: 1.6em; text-transform: uppercase; }
            .boleta-header-empresa p { margin: 2px 0; font-size: 0.85em; }
            .boleta-header-documento { text-align: center; border: 1px solid #000; padding: 10px; margin-bottom: 20px; background-color: #f9f9f9; }
            .boleta-header-documento .doc-type-label { font-size: 1.1em; font-weight: bold; margin: 0; }
            .boleta-header-documento .doc-number-value { font-size: 1.5em; font-weight: bold; color: #cc0000; margin: 5px 0 0 0; }
            .boleta-datos-cliente-box, .boleta-detalle-box { margin-bottom: 20px; }
            .boleta-datos-cliente-box h4, .boleta-detalle-box h4 { background-color: #eee; padding: 5px 10px; margin: 0 0 10px 0; font-size: 1em; border-left: 5px solid #000; font-weight: bold; }
            .boleta-datos-cliente-box .dato-row { display: flex; justify-content: space-between; padding: 3px 10px; font-size: 0.9em; border-bottom: 1px dashed #ddd; }
            .boleta-datos-cliente-box .dato-label { font-weight: bold; min-width: 150px; }
            .boleta-datos-cliente-box .dato-value { flex-grow: 1; text-align: right; }
            
            /* Tabla de Detalle */
            .boleta-detalle { width: 100%; border-collapse: collapse; font-size: 0.9em; }
            .boleta-detalle thead th { border: 1px solid #000; padding: 8px; text-align: center; background-color: #ddd; }
            .boleta-detalle tbody td { border: 1px solid #000; padding: 8px; vertical-align: top; line-height: 1.3; }
            .boleta-detalle .align-right { text-align: right; font-weight: bold; }

            /* Totales */
            .boleta-totales { border: 2px solid #000; padding: 10px; margin-bottom: 20px; }
            .boleta-totales .total-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 1em; }
            .boleta-totales .total-final { margin-top: 5px; border-top: 1px solid #999; padding-top: 5px; font-size: 1.2em; font-weight: bold; }
            .boleta-totales .total-value { min-width: 100px; text-align: right; }

            /* Footer */
            .boleta-footer-info { text-align: center; }
            .boleta-footer-info .amount-in-words { font-weight: bold; font-size: 1em; margin: 0 0 15px 0; text-align: left; padding: 0 10px; border-bottom: 1px solid #000; padding-bottom: 5px; }
            .boleta-footer-info .payment-info { display: flex; justify-content: flex-start; padding: 0 10px; margin-bottom: 15px; }
            .boleta-footer-info .payment-info .dato-label { font-weight: bold; margin-right: 5px; }


            /* ============================================== */
            /* ESTILOS ESPECÍFICOS PARA IMPRESIÓN (media print) */
            /* ============================================== */
            @media print {
                #imprimirBoton, button { display: none !important; }
                
                body { 
                    margin: 0; 
                    padding: 0; 
                    background: white; 
                    font-size: 10pt;
                }

                .comprobante.boleta-electronica-style {
                    width: 100%;
                    max-width: none;
                    padding: 0;
                    border: none;
                    box-shadow: none;
                }
                
                /* Forzar impresión de bordes y fondos en blanco y negro */
                .boleta-header-documento,
                .boleta-detalle thead th, 
                .boleta-detalle tbody td {
                    background-color: #fff !important; 
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                    border: 1px solid #000 !important;
                }
                
                .boleta-header-empresa {
                    border-bottom: 1px solid #000; 
                    padding-bottom: 5px;
                }

                .boleta-datos-cliente-box h4, 
                .boleta-detalle-box h4 {
                    border-left: 5px solid #000;
                    background-color: #fff;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }

                .boleta-totales {
                    border: 2px solid #000;
                    padding: 5px;
                }
            }
        </style>
    `);
    // =================================================================================
    // FIN DE INYECCIÓN DE ESTILOS
    // =================================================================================

    iframeDoc.write('</head><body>');
    iframeDoc.write(comprobanteContent);
    iframeDoc.write('</body></html>');
    iframeDoc.close(); // Finaliza la escritura

    // --- 3. Imprimir y Limpiar ---
    // Usamos un pequeño retraso para asegurar que el DOM del iframe esté listo.
    iframe.onload = function() {
        try {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
        } catch (e) {
            console.error("Error al imprimir con iframe:", e);
        } finally {
            // Eliminar el iframe del DOM principal después de un tiempo
            setTimeout(() => {
                document.body.removeChild(iframe);
            }, 500);
        }
    };
    
    // Si la función onload no se dispara (algunos navegadores/circunstancias)
    // Se ejecuta la impresión directamente después de un retraso
    setTimeout(() => {
        if (iframe.parentNode) { // Solo si todavía existe
            try {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
            } catch (e) {
                 // Ya se manejó el error en onload, esto es un fallback
            } finally {
                // Eliminar el iframe del DOM principal (segundo intento)
                setTimeout(() => {
                    if (iframe.parentNode) document.body.removeChild(iframe);
                }, 500);
            }
        }
    }, 100); 
}
function reimprimirComprobante(id) {
    const pago = pagos.find(p => p.id === id);
    if (pago) {
        // 1. Cargamos el contenido en el modal
        mostrarComprobante(pago);

        // 2. Usamos un breve retraso para que el contenido se cargue en el DOM antes de intentar imprimirlo
        setTimeout(() => {
            imprimirComprobante();
            // Ocultar el modal después de iniciar la impresión
            cerrarModalComprobante();
        }, 100);
    }
}

// ═══════ RENDER PAGOS ═══════
function renderPagos() {
    const tbody = document.getElementById('tablaPagos');
    if (!tbody) return;

    if (pagos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">Sin pagos registrados</td></tr>';
        return;
    }

    // Ordenar por fecha descendente
    const lista = [...pagos].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    tbody.innerHTML = lista.map((p, i) => `
    <tr>
      <td>${lista.length - i}</td>
      <td>${formatFecha(p.fecha)}</td>
      <td>${p.cliente}</td>
      <td>${PEN(p.total)}</td>
      <td>${PEN(p.mora)}</td>
      <td>${PEN(p.efectivo)}</td>
      <td>${PEN(p.cuenta)}</td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="reimprimirComprobante('${p.id}')">🖨️</button>
      </td>
    </tr>
  `).join('');
}

// ═══════ CUADRE DE CAJA ═══════
function renderCaja() {
    const cajaEfectivo = document.getElementById('cajaEfectivo');
    const cajaCuenta = document.getElementById('cajaCuenta');
    const cajaTotal = document.getElementById('cajaTotal');

    if (cajaEfectivo) cajaEfectivo.textContent = PEN(caja.efectivo);
    if (cajaCuenta) cajaCuenta.textContent = PEN(caja.cuenta);
    if (cajaTotal) cajaTotal.textContent = PEN(caja.efectivo + caja.cuenta);

    // Tabla de movimientos
    const tbody = document.getElementById('tablaCaja');
    if (!tbody) return;

    if (pagos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Sin movimientos</td></tr>';
        return;
    }

    const lista = [...pagos].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    tbody.innerHTML = lista.map(p => `
    <tr>
      <td>${formatFecha(p.fecha)}</td>
      <td>${p.cliente}</td>
      <td>${p.prestamoId}</td>
      <td>${PEN(p.total)}</td>
      <td>${PEN(p.efectivo)}</td>
      <td>${PEN(p.cuenta)}</td>
    </tr>
  `).join('');
}

function abrirModalCierreCaja() {
    const hoy = obtenerHoyLocalISO();
    const cierreHoy = cierresCaja.find(c => c.fecha === hoy);

    if (cierreHoy) {
        alert('⚠️ Ya se realizó el cierre de caja para hoy.\n\nFecha: ' + formatFecha(cierreHoy.fecha) + '\nTotal: ' + PEN(cierreHoy.totalRecaudado));
        return;
    }

    // Calcular totales
    const totalEfectivo = caja.efectivo;
    const totalCuenta = caja.cuenta;
    const totalRecaudado = totalEfectivo + totalCuenta;

    // Pre-llenar formulario
    document.getElementById('cierreFecha').value = hoy;
    document.getElementById('cierreSistemaEfectivo').value = totalEfectivo.toFixed(2);
    document.getElementById('cierreSistemaCuenta').value = totalCuenta.toFixed(2);
    document.getElementById('cierreSistemaTotal').textContent = PEN(totalRecaudado);

    document.getElementById('cierreFisicoEfectivo').value = totalEfectivo.toFixed(2);
    document.getElementById('cierreFisicoCuenta').value = totalCuenta.toFixed(2);

    calcularDiferenciasCierre();

    document.getElementById('modalCierreCaja').classList.add('active');
}

function cerrarModalCierreCaja() {
    document.getElementById('modalCierreCaja').classList.remove('active');
}

function calcularDiferenciasCierre() {
    const sistemaEfectivo = parseFloat(document.getElementById('cierreSistemaEfectivo').value) || 0;
    const sistemaCuenta = parseFloat(document.getElementById('cierreSistemaCuenta').value) || 0;
    const fisicoEfectivo = parseFloat(document.getElementById('cierreFisicoEfectivo').value) || 0;
    const fisicoCuenta = parseFloat(document.getElementById('cierreFisicoCuenta').value) || 0;

    const difEfectivo = fisicoEfectivo - sistemaEfectivo;
    const difCuenta = fisicoCuenta - sistemaCuenta;
    const difTotal = difEfectivo + difCuenta;

    document.getElementById('cierreDifEfectivo').textContent = PEN(difEfectivo);
    document.getElementById('cierreDifCuenta').textContent = PEN(difCuenta);
    document.getElementById('cierreDifTotal').textContent = PEN(difTotal);

    // Colorear diferencias
    const difEfectivoEl = document.getElementById('cierreDifEfectivo');
    const difCuentaEl = document.getElementById('cierreDifCuenta');
    const difTotalEl = document.getElementById('cierreDifTotal');

    difEfectivoEl.style.color = difEfectivo === 0 ? 'var(--success)' : (difEfectivo > 0 ? 'var(--gold)' : 'var(--error)');
    difCuentaEl.style.color = difCuenta === 0 ? 'var(--success)' : (difCuenta > 0 ? 'var(--gold)' : 'var(--error)');
    difTotalEl.style.color = difTotal === 0 ? 'var(--success)' : (difTotal > 0 ? 'var(--gold)' : 'var(--error)');
}

function confirmarCierreCaja() {
    const fecha = document.getElementById('cierreFecha').value;
    const observaciones = document.getElementById('cierreObservaciones').value.trim();

    const sistemaEfectivo = parseFloat(document.getElementById('cierreSistemaEfectivo').value) || 0;
    const sistemaCuenta = parseFloat(document.getElementById('cierreSistemaCuenta').value) || 0;
    const fisicoEfectivo = parseFloat(document.getElementById('cierreFisicoEfectivo').value) || 0;
    const fisicoCuenta = parseFloat(document.getElementById('cierreFisicoCuenta').value) || 0;

    const difEfectivo = fisicoEfectivo - sistemaEfectivo;
    const difCuenta = fisicoCuenta - sistemaCuenta;
    const difTotal = difEfectivo + difCuenta;

    if (!fecha) {
        alert('Seleccione la fecha del cierre');
        return;
    }
    // >>> CAMBIO: Si hay diferencia, NO se permite el cierre.
    if (Math.abs(difTotal) > 0.01) {
        const msg = `❌ Error al cerrar caja: Existe una diferencia total de ${PEN(difTotal)}.`;
        alert(msg + '\n\nPor favor, ajuste el monto en físico o la diferencia en sistema antes de cerrar.');
        return; // Detiene el cierre
    }

    // Crear cierre
     const cierre = {
        id: 'C' + generarId(),
        fecha: fecha,
        fechaHora: new Date().toISOString(),
        usuario: localStorage.getItem('basheUser') || 'Admin',
        sistemaEfectivo: sistemaEfectivo,
        sistemaCuenta: sistemaCuenta,
        fisicoEfectivo: fisicoEfectivo,
        fisicoCuenta: fisicoCuenta,
        difEfectivo: difEfectivo,
        difCuenta: difCuenta,
        difTotal: difTotal,
        totalRecaudado: fisicoEfectivo + fisicoCuenta,
        cantidadPagos: pagos.filter(p => p.fecha === fecha).length,
        observaciones: observaciones || 'Sin observaciones'
    };

    cierresCaja.push(cierre);
    localStorage.setItem('basheCierres', JSON.stringify(cierresCaja));

    // Resetear caja a cero después del cierre
    caja.efectivo = 0;
    caja.cuenta = 0;
    guardarDatos();

    cerrarModalCierreCaja();
    renderCaja();

    alert('✅ Cierre de caja realizado exitosamente.\n\nTotal recaudado: ' + PEN(cierre.totalRecaudado));
}

function verHistorialCierres() {
    cargarCierresCaja();

    if (cierresCaja.length === 0) {
        alert('No hay cierres de caja registrados');
        return;
    }

    const tbody = document.querySelector('#tablaHistorialCierres tbody');
    if (!tbody) return;

    const lista = [...cierresCaja].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    tbody.innerHTML = lista.map((c, i) => `
    <tr>
      <td>${lista.length - i}</td>
      <td>${formatFecha(c.fecha)}</td>
      <td>${c.usuario}</td>
      <td>${PEN(c.totalRecaudado)}</td>
      <td>${PEN(c.fisicoEfectivo)}</td>
      <td>${PEN(c.fisicoCuenta)}</td>
      <td style="color:${c.difTotal === 0 ? 'var(--success)' : (c.difTotal > 0 ? 'var(--gold)' : 'var(--error)')}">${PEN(c.difTotal)}</td>
      <td><button class="btn btn-sm btn-outline" onclick="verDetalleCierre('${c.id}')">👁️ Ver</button></td>
    </tr>
  `).join('');

    document.getElementById('modalHistorialCierres').classList.add('active');
}

function cerrarModalHistorialCierres() {
    document.getElementById('modalHistorialCierres').classList.remove('active');
}

function verDetalleCierre(id) {
    const cierre = cierresCaja.find(c => c.id === id);
    if (!cierre) return;

    cierreEnDetalle = cierre;

    const contenido = document.getElementById('detalleCierreContenido');
    if (!contenido) return;

    contenido.innerHTML = `
    <div class="comprobante">
      <div class="comprobante-header">
        <h4>${CONFIG.EMPRESA}</h4>
        <div>CIERRE DE CAJA</div>
        <div style="margin-top:8px;">Fecha: ${formatFecha(cierre.fecha)}</div>
        <div>Realizado por: ${cierre.usuario}</div>
      </div>
      <div class="comprobante-body">
        <h4 style="color:var(--gold);margin-bottom:var(--space-sm);">💻 Según Sistema</h4>
        <div class="comprobante-row"><span>Efectivo:</span><span>${PEN(cierre.sistemaEfectivo)}</span></div>
        <div class="comprobante-row"><span>Cuenta bancaria:</span><span>${PEN(cierre.sistemaCuenta)}</span></div>
        <div class="comprobante-row"><span><strong>Total sistema:</strong></span><span><strong>${PEN(cierre.sistemaEfectivo + cierre.sistemaCuenta)}</strong></span></div>
        
        <div class="comprobante-divider"></div>
        
        <h4 style="color:var(--gold);margin-bottom:var(--space-sm);">📦 Conteo Físico</h4>
        <div class="comprobante-row"><span>Efectivo contado:</span><span>${PEN(cierre.fisicoEfectivo)}</span></div>
        <div class="comprobante-row"><span>Saldo bancario:</span><span>${PEN(cierre.fisicoCuenta)}</span></div>
        <div class="comprobante-row"><span><strong>Total físico:</strong></span><span><strong>${PEN(cierre.fisicoEfectivo + cierre.fisicoCuenta)}</strong></span></div>
        
        <div class="comprobante-divider"></div>
        
        <h4 style="color:var(--gold);margin-bottom:var(--space-sm);">📊 Diferencias</h4>
        <div class="comprobante-row"><span>Efectivo:</span><span style="color:${cierre.difEfectivo === 0 ? 'var(--success)' : (cierre.difEfectivo > 0 ? 'var(--gold)' : 'var(--error)')}">${PEN(cierre.difEfectivo)}</span></div>
        <div class="comprobante-row"><span>Cuenta:</span><span style="color:${cierre.difCuenta === 0 ? 'var(--success)' : (cierre.difCuenta > 0 ? 'var(--gold)' : 'var(--error)')}">${PEN(cierre.difCuenta)}</span></div>
        <div class="comprobante-row"><span><strong>Total diferencia:</strong></span><span style="color:${cierre.difTotal === 0 ? 'var(--success)' : (cierre.difTotal > 0 ? 'var(--gold)' : 'var(--error)')}"><strong>${PEN(cierre.difTotal)}</strong></span></div>
        
        <div class="comprobante-divider"></div>
        
        <div class="comprobante-row"><span>Pagos procesados:</span><span>${cierre.cantidadPagos}</span></div>
        <div class="comprobante-row"><span>Observaciones:</span><span>${cierre.observaciones}</span></div>
      </div>
    </div>
  `;

    cerrarModalHistorialCierres();
    document.getElementById('modalDetalleCierre').classList.add('active');
}

function cerrarModalDetalleCierre() {
    document.getElementById('modalDetalleCierre').classList.remove('active');
    cierreEnDetalle = null;
}

function cargarCierresCaja() {
    cierresCaja = JSON.parse(localStorage.getItem('basheCierres') || '[]');
}

// ═══════ TÉRMINOS Y CONDICIONES ═══════
function mostrarTerminos() {
    document.getElementById('modalTerminos').classList.add('active');
}

function cerrarModalTerminos() {
    document.getElementById('modalTerminos').classList.remove('active');
}

// ═══════ EXPORTAR FUNCIONES GLOBALES ═══════
window.scrollTo = scrollTo;
window.mostrarLogin = mostrarLogin;
window.volverLanding = volverLanding;
window.hacerLogin = hacerLogin;
window.cerrarSesion = cerrarSesion;
window.switchTab = switchTab;
window.calcularSimulador = calcularSimulador;
window.generarCronogramaSimulador = generarCronogramaSimulador;
window.cambiarTipoConsulta = cambiarTipoConsulta;
window.verificarCliente = verificarCliente;
window.abrirModalManual = abrirModalManual;
window.cerrarModalManual = cerrarModalManual;
window.registrarManual = registrarManual;
window.registrarPrestamo = registrarPrestamo;
window.filtrarPrestamos = filtrarPrestamos;
window.eliminarPrestamo = eliminarPrestamo;
window.verCronograma = verCronograma;
window.cerrarModalCronograma = cerrarModalCronograma;
window.imprimirCronograma = imprimirCronograma;
window.abrirModalPago = abrirModalPago;
window.cerrarModalPago = cerrarModalPago;
window.validarDistribucion = validarDistribucion;
window.confirmarPago = confirmarPago;
window.cerrarModalComprobante = cerrarModalComprobante;
window.imprimirComprobante = imprimirComprobante;
window.reimprimirComprobante = reimprimirComprobante;
window.mostrarTerminos = mostrarTerminos;
window.cerrarModalTerminos = cerrarModalTerminos;
window.abrirModalCierreCaja = abrirModalCierreCaja;
window.cerrarModalCierreCaja = cerrarModalCierreCaja;
window.calcularDiferenciasCierre = calcularDiferenciasCierre;
window.confirmarCierreCaja = confirmarCierreCaja;
window.verHistorialCierres = verHistorialCierres;
window.cerrarModalHistorialCierres = cerrarModalHistorialCierres;
window.verDetalleCierre = verDetalleCierre;
window.cerrarModalDetalleCierre = cerrarModalDetalleCierre;
window.selectPaymentMethodInModal = selectPaymentMethodInModal;
window.createPreferenceAndRedirect = createPreferenceAndRedirect;


console.log('📦 Financiera Bashe v4.0 - Sistema cargado');

// ═══════ MERCADO PAGO INTEGRATION ═══════

// --- CLAVES DE PRODUCCIÓN REALES SOLICITADAS ---
const MP_PUBLIC_KEY = 'APP_USR-90934c1f-0591-4f50-88ec-6dd2df10c1a6';
const MP_ACCESS_TOKEN = 'APP_USR-5092022365185741-120818-758a545978ca23534229b1b36eccd482-1993389282';

let mp;
let cardPaymentBrickController;
let mpInitialized = false;

// Función para seleccionar método de pago en el modal
function selectPaymentMethodInModal(method) {
    document.getElementById('method-efectivo').classList.toggle('active', method === 'efectivo');
    document.getElementById('method-card-modal').classList.toggle('active', method === 'card');

    document.getElementById('efectivo-section').classList.toggle('hidden', method !== 'efectivo');
    document.getElementById('card-section').classList.toggle('hidden', method !== 'card');

    // Si selecciona tarjeta, llamamos a la función de redirección, sin inicializar Bricks
    if (method === 'card') {
        // Reemplazamos el botón del modal por el de iniciar pago MP
        const container = document.getElementById('form-checkout-modal');
        container.innerHTML = `
        <button class="btn btn-primary btn-block btn-lg" onclick="createPreferenceAndRedirect(event)">
            💳 Iniciar Pago Seguro con Mercado Pago
        </button>
    `;
    }
}

/**
 * Función que crea la preferencia de pago y redirige al checkout de Mercado Pago.
 * @param {Event} e - Evento del click.
 */
async function createPreferenceAndRedirect(e) {
    e.preventDefault();

    if (!prestamoEnPago) {
        alert('Error: No hay un préstamo seleccionado para pagar.');
        return;
    }

    const total = parseFloat(document.getElementById('pagoTotal')?.value) || 0;

    if (total <= 0) {
        alert('El monto a pagar debe ser mayor a 0.');
        return;
    }

    const btn = e.target;
    const originalText = btn.textContent;

    btn.textContent = 'Generando enlace...';
    btn.disabled = true;

    // --- Datos necesarios para la preferencia ---
    const externalReference = `PAGO-${prestamoEnPago.id}-${generarId()}`;

    const preferenceData = {
        items: [
            {
                title: `Pago Cuota ${prestamoEnPago.cuotasPagadas + 1} - Préstamo ${prestamoEnPago.id}`,
                description: `Amortización y Mora. Cliente: ${prestamoEnPago.cliente}`,
                unit_price: total,
                currency_id: 'PEN', // Asegurarse que la moneda sea la correcta (PEN en Perú)
                quantity: 1,
            },
        ],
        payer: {
            email: prestamoEnPago.correo || 'default@financierabashe.com',
            name: prestamoEnPago.cliente.split(' ')[0] || 'Cliente',
            surname: prestamoEnPago.cliente.split(' ').slice(-1)[0] || 'Bashe',
            identification: {
                type: prestamoEnPago.documento.length === 8 ? 'DNI' : 'RUC',
                number: prestamoEnPago.documento
            }
        },
        // Parámetros de redirección. Debes tener una URL real para estos.
        // Usamos el external_reference para identificar el pago al volver.
        external_reference: externalReference,
        back_urls: {
            success: window.location.origin + window.location.pathname + `?payment_status=success&ref=${externalReference}`,
            pending: window.location.origin + window.location.pathname + `?payment_status=pending&ref=${externalReference}`,
            failure: window.location.origin + window.location.pathname + `?payment_status=failure&ref=${externalReference}`,
        },
        // SE ELIMINA LA PROPIEDAD 'auto_return' YA QUE PROVOCA EL ERROR
    };

    try {
        const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
            },
            body: JSON.stringify(preferenceData),
        });

        const result = await response.json();

        if (response.ok && result.id) {
            // Redirección a Mercado Pago
            const redirectUrl = result.init_point;

            // Antes de redirigir, registramos un pago temporal en el sistema con el external_reference
            // Clonamos el objeto prestamoEnPago para guardarlo antes de que se pierda la referencia
            localStorage.setItem(`MP_PENDING_PAYMENT_${externalReference}`, JSON.stringify({
                // Guardamos el objeto completo del préstamo para restaurar la referencia
                prestamo: { ...prestamoEnPago }, // Clonar para evitar problemas de referencia
                mora: parseFloat(document.getElementById('pagoMora')?.value) || 0,
                total: total,
                fecha: document.getElementById('pagoFecha')?.value,
                status: 'PENDING_MP_REDIRECT'
            }));

            cerrarModalPago();
            window.location.href = redirectUrl;

        } else {
            alert(`❌ Error al crear preferencia de pago: ${result.message || 'Error desconocido'}`);
            console.error('Error MP Preference:', result);
        }

    } catch (error) {
        console.error('Error al comunicarse con Mercado Pago:', error);
        alert('❌ Error de red o servidor al intentar generar el pago.');
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

// ═══════ Manejo de la URL al regresar de Mercado Pago ═══════
function checkMercadoPagoReturn() {
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('payment_status');
    const externalRef = urlParams.get('ref');

    if (status && externalRef) {
        const pendingPaymentJSON = localStorage.getItem(`MP_PENDING_PAYMENT_${externalRef}`);
        localStorage.removeItem(`MP_PENDING_PAYMENT_${externalRef}`); // Limpiar referencia

        if (pendingPaymentJSON) {
            const data = JSON.parse(pendingPaymentJSON);

            // 1. Buscamos el índice del préstamo en la lista global
            const prestamoGuardado = data.prestamo;
            const prestamoIndex = prestamos.findIndex(p => p.id === prestamoGuardado.id);

            if (prestamoIndex !== -1) {

                // **CORRECCIÓN CLAVE: 1/2** Reemplazamos el objeto actual en el array global
                // con el objeto guardado ANTES de registrar el pago. Esto restaura el estado
                // exacto antes del pago de MP.
                prestamos[prestamoIndex] = prestamoGuardado;

                // 2. Restaurar la referencia global de trabajo (IMPORTANTE)
                prestamoEnPago = prestamos[prestamoIndex];

                const total = data.total;
                const mora = data.mora;
                const fecha = data.fecha;

                let alertMsg = '';

                if (status === 'approved' || status === 'success') {
                    // Si el pago fue aprobado, registramos en el sistema
                    // El pago por MP/transferencia va 100% a 'cuenta'
                    registrarPagoEnSistema(fecha, total, mora, 0, total);
                    alertMsg = `✅ Pago Aprobado. Monto: ${PEN(total)}. El préstamo ha sido actualizado.`;

                } else if (status === 'pending') {
                    // Si el pago está pendiente (ej. pago en efectivo en agente)
                    alertMsg = `⏳ Pago Pendiente. Monto: ${PEN(total)}. El pago se registrará automáticamente al ser confirmado por Mercado Pago.`;
                } else { // failure
                    alertMsg = `❌ Pago Rechazado. Monto: ${PEN(total)}. Por favor, intente con otro medio de pago.`;
                }

                // Mostrar alerta de resultado y navegar al panel
                alert(alertMsg);

                // **CORRECCIÓN CLAVE: 2/2** Forzamos el refresco del panel y la sincronización.
                mostrarPanel();
                guardarDatos(); // Asegurar persistencia

                // Limpiar los parámetros de la URL para evitar recargas
                history.replaceState(null, '', window.location.pathname);
                return true;
            } else {
                alert(`⚠️ Error: No se encontró el préstamo ${prestamoGuardado.id} en el sistema. Revise manualmente el estado del pago.`);
            }
        } else if (status === 'success') {
            // Caso de éxito sin referencia local guardada
            alert('✅ Pago exitoso en Mercado Pago. Si el préstamo no se actualiza, revise el historial de pagos.');
            mostrarPanel();
            history.replaceState(null, '', window.location.pathname);
            return true;
        }
    }
    return false;
}

// ═══════ Fin del manejo de retorno de Mercado Pago ═══════