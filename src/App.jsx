import { useState, useEffect, useRef, useMemo } from "react";
import { Package, Truck, Layers, SlidersHorizontal, HelpCircle, Play, FilePlus, ClipboardPaste, AlertTriangle, Loader2, Plus, Trash2, X, ChevronDown, Database, FolderOpen, Save, Upload, FileSpreadsheet, Search, RefreshCw, CheckCircle2, Repeat, Calculator, PackagePlus } from "lucide-react";
import { correr, ejecutorWorker, ErrorCorrida } from "./motor/corrida.js";
import MotorWorker from "./motor/motor.worker.js?worker&inline";
import { armarReporte } from "./motor/reporte.js";
import { clave, claveSku, indiceSku, buscarSku, conversionDe, numero } from "./archivos/celdas.js";
import { ARCHIVO_MAESTRO, ARCHIVO_RESPALDO, productoVacio, leerMaestro, libroMaestro, leerCubeMaster, plantillaDimensiones, actualizarDimensiones, leerBundleMaestro } from "./archivos/maestro.js";
import { transformarPedidoBundle } from "./archivos/bundle.js";
import { leerVehiculos, libroVehiculos, plantillaVehiculos, vehiculoVacio } from "./archivos/vehiculos.js";
import { leerPedido, libroPlantilla } from "./archivos/pedido.js";
import { leerConversiones, aCajas, UM_CAJA_DEF, normalizaUM, nombreUM } from "./archivos/conversiones.js";
import { libroResultados, etapasDe, htmlInstructivo, htmlInstructivoCompleto, nombreArchivo, libroSimple, MIME_XLSX } from "./archivos/resultados.js";
import { EJEMPLOS, PALLETS_INICIALES, VEHICULOS, nuevoItem } from "./ui/referencia.js";
import { PALETAS, generarColores } from "./ui/colores.js";
import { T } from "./ui/tema.js";
import { VERSION, VERSION_COMPLETA } from "./version.js";
import { FS_DISPONIBLE, descargarArchivo, idb } from "./ui/navegador.js";
import { guardarProyectoNube, cargarProyectoNube, cerrarSesion, guardarMaestroNube, cargarMaestroNube } from "./nube/nube.js";
import { fleteTotal, tarifaVacia, METODOS_FLETE } from "./archivos/flete.js";
import { Escenarios } from "./nube/Escenarios.jsx";
import { Visor } from "./visor/Visor.jsx";
import { Confirmacion, Tarjeta, Nota, estInp, inp } from "./ui/controles.jsx";
import { SeccionVehiculo } from "./ui/secciones/SeccionVehiculo.jsx";
import { RevisionPedido } from "./ui/secciones/RevisionPedido.jsx";
import { SeccionPaletizado } from "./ui/secciones/SeccionPaletizado.jsx";
import { SeccionAyuda } from "./ui/secciones/SeccionAyuda.jsx";
import { SeccionReglas } from "./ui/secciones/SeccionReglas.jsx";
import { SeccionHerramientas } from "./ui/secciones/SeccionHerramientas.jsx";
import { PanelResultados } from "./ui/secciones/PanelResultados.jsx";
import { FilaItem, FilaMaestro } from "./ui/filas.jsx";

// Un vehículo que termina usándose por debajo de este % es la señal de "casi no hacía falta":
// ahí vale la pena ofrecer intentar consolidar todo en un vehículo menos.
const UMBRAL_CONSOLIDAR = 0.05;

// ================= Motor (Web Worker) =================
// Cada corrida crea un Worker nuevo. El worker va incrustado (?worker&inline) para que el build de un solo archivo HTML funcione sin servidor.
const ejecutor = ejecutorWorker(() => new MotorWorker());

// ================= Aplicación =================
export default function Estiba3D({ usuario }) {
  const [proyecto, setProyecto] = useState("Carga sin título");
  const [seccion, setSeccion] = useState("mercancia");
  const [verMedidas, setVerMedidas] = useState(true); // columnas Largo/Ancho/Alto/Kg; se ocultan cuando el pedido viene del maestro
  const [vehId, setVehId] = useState("53CS");
  const [veh, setVeh] = useState({ ...VEHICULOS[3], maxVolPct: 0, maxSkus: 0, maxPiezas: 0 });
  const [pallets, setPallets] = useState(PALLETS_INICIALES);
  const [reglas, setReglas] = useState({ nivel: 4, limitarPeso: true, soporteMin: 75, usarOrden: true, agrupar: false, juntos: true, rigor: "estricto", separarGrupos: false, usarLista: false, compresionAuto: true, apilamiento: "ninguna" });
  const [items, setItems] = useState(EJEMPLOS.pallets.items);
  const [abierto, setAbierto] = useState(null);
  const [pegar, setPegar] = useState(false);
  const [textoPegado, setTextoPegado] = useState("");
  const [menuEj, setMenuEj] = useState(false);
  const [res, setRes] = useState(null);
  const [sel, setSel] = useState(0);
  const [vista, setVista] = useState(null);
  const [paso, setPaso] = useState(0);
  const [progreso, setProgreso] = useState(null);
  const [corrida, setCorrida] = useState(null); // { resultado, carga } de la última corrida
  const [espacios, setEspacios] = useState(null); // alternativas para completar espacios vacíos
  const [calculandoEspacios, setCalculandoEspacios] = useState(false);
  const [consolidar, setConsolidar] = useState(null); // intento de meter todo en un solo vehículo
  const [error, setError] = useState("");
  const [resaltado, setResaltado] = useState(null);
  const [pestana, setPestana] = useState("resumen");
  const [camara, setCamara] = useState(null);
  const [paleta, setPaleta] = useState("vivos");
  const [maestro, setMaestro] = useState({ productos: [], origen: null, sucio: false, guardado: null, errores: [], conversiones: null });
  const [reconectar, setReconectar] = useState(null);
  const [aviso, setAviso] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [abiertoP, setAbiertoP] = useState(null);
  const [skuNuevo, setSkuNuevo] = useState("");
  const dirRef = useRef(null);
  useEffect(() => {
    const ro = new ResizeObserver((ents) => ents.forEach((e) => e.target.style.setProperty("--anchoPanel", `${Math.max(280, e.target.clientWidth - 2)}px`)));
    const observar = () => document.querySelectorAll(".tabla-ancho").forEach((el) => ro.observe(el));
    observar(); const mo = new MutationObserver(observar); mo.observe(document.body, { childList: true, subtree: true });
    return () => { ro.disconnect(); mo.disconnect(); };
  }, []);
  const apiVisor = useRef(null);
  const inputCube = useRef(null);
  const inputConv = useRef(null);
  const inputDims = useRef(null);
  const inputBundle = useRef(null);
  const inputVehiculos = useRef(null);
  const [confirmar, setConfirmar] = useState(null);
  const [generando, setGenerando] = useState(false);
  const [leyendo, setLeyendo] = useState("");
  const [revision, setRevision] = useState(null);
  const [panelOculto, setPanelOculto] = useState(false);
  const [recomendacion, setRecomendacion] = useState(null);
  const calcularRef = useRef(null);   // resultado de la última carga de pedido, línea por línea
  const [vehiculos, setVehiculos] = useState(VEHICULOS);   // los de fábrica más los que cree el usuario en esta sesión
  const [guardandoNube, setGuardandoNube] = useState(false);
  const [ultimoGuardado, setUltimoGuardado] = useState(null);
  const [verEscenarios, setVerEscenarios] = useState(false);
  const [tarifas, setTarifas] = useState([]);   // tarifario de flete; vacío = la recomendación decide solo por espacio
  const [anchoSku, setAnchoSku] = useState(200); // la columna SKU se ensancha arrastrando su borde
  const inputMaestro = useRef(null);
  const inputPedido = useRef(null);
  const [menuColor, setMenuColor] = useState(false);

  const modoPallet = vehId.startsWith("PAL:");
  const palIdx = modoPallet ? Number(vehId.slice(4)) : -1;
  const palSel = modoPallet ? pallets[palIdx] : null;
  const vehCalc = useMemo(() => (!palSel ? veh : { L: palSel.L + 2 * palSel.ovL, W: palSel.W + 2 * palSel.ovW, H: Math.max(1, palSel.altMax - palSel.esp), tara: 0, maxKg: palSel.maxKg, maxVolPct: 0, maxSkus: 0, maxPiezas: 0, esPallet: true }), [veh, palSel]);
  const nombreVeh = modoPallet ? palSel?.nombre : vehiculos.find((v) => v.id === vehId)?.nombre || veh.nombre;
  const totales = useMemo(() => {
    let m3 = 0, kg = 0, cajas = 0;
    items.forEach((it) => { cajas += it.qty; m3 += (it.L * it.W * it.H * it.qty) / 1e9; kg += it.peso * it.qty; });
    return { m3, kg, cajas };
  }, [items]);
  const formas = useMemo(() => items.map((it) => it.forma || "caja"), [items]);
  const coloresBase = useMemo(() => generarColores(items.length, paleta), [items.length, paleta]);
  // Los pedidos y transferencias a veces traen el ID del ERP en vez del SKU: se busca por los dos.
  // El guion cuenta ("852-10" ≠ "85210"), pero si un pedido trae el código sin guion y solo hay un
  // producto parecido, también lo encuentra (ver indiceSku). Buscar siempre con buscarSku(mapaMaestro, texto).
  const mapaMaestro = useMemo(() => indiceSku(maestro.productos), [maestro.productos]);
  const colores = useMemo(() => items.map((it, i) => it.color || coloresBase[i]), [items, coloresBase]);
  const hayPersonalizados = items.some((i) => i.color);

  // Cualquier cambio a la carga deja viejas las sugerencias (completar espacios, consolidar): se borran,
  // y si alguna todavía está calculando, su resultado se descarta al llegar (ver intentoRef).
  const intentoRef = useRef(0);
  const invalidar = () => {
    setRecomendacion(null); setRes(null); setCorrida(null); setResaltado(null); setVista(null);
    setEspacios(null); setConsolidar(null); setCalculandoEspacios(false); intentoRef.current++; };
  // La carga tal como la recibe el motor en una corrida normal. Con «orden de la lista», la posición de la
  // fila manda (la de arriba entra primero, al fondo); si además hay entregas, la parada sigue mandando y
  // la lista solo desempata dentro de cada parada.
  const cargaPara = (lista, r) => ({
    items: r.usarLista ? lista.map((it, i) => ({ ...it, entrega: it.orden, orden: (it.orden > 0 ? it.orden : 9999) * 10000 + (lista.length - i) })) : lista,
    vehiculo: vehCalc, tarimas: pallets, reglas: r.usarLista ? { ...r, usarOrden: true } : r,
  });

  // ---------- Guardar y cargar en la nube (un proyecto por usuario) ----------
  const estadoParaGuardar = () => ({
    v: 2, proyecto, items, vehId, veh, vehiculos, pallets, reglas, tarifas,
  });
  const guardarEnNube = async () => {
    setGuardandoNube(true); setError("");
    try {
      await guardarProyectoNube(estadoParaGuardar());
      setUltimoGuardado(new Date());
      setAviso("Guardado en tu cuenta.");
    } catch (err) { setError("No se pudo guardar: " + err.message); }
    setGuardandoNube(false);
  };
  // Un escenario guardado trae su propio catálogo de vehículos. Se le suman los de fábrica que no tenga
  // (por ejemplo, los que se agregaron en una versión posterior), sin tocar los que el usuario ya tenía.
  const conDeFabrica = (lista) => {
    if (!lista?.length) return VEHICULOS;
    const ids = new Set(lista.map((v) => v.id));
    return [...lista, ...VEHICULOS.filter((v) => !ids.has(v.id))];
  };
  // Vuelca en pantalla un escenario guardado (el mismo formato que estadoParaGuardar).
  const aplicarEstado = (e) => {
    setProyecto(e.proyecto ?? "Carga sin título");
    setItems(e.items ?? []);
    setVehiculos(conDeFabrica(e.vehiculos));
    setVehId(e.vehId ?? "53CS");
    if (e.veh) setVeh(e.veh);
    if (e.pallets) setPallets(e.pallets);
    if (e.reglas) setReglas(e.reglas);
    setTarifas(e.tarifas ?? []);
    // Los escenarios viejos (v1) traían una copia del maestro adentro. Ya no se usa: el maestro
    // permanente del usuario manda siempre. Solo se toma esa copia si todavía no hay maestro
    // cargado, para no perder datos de alguien que solo tenga escenarios viejos.
    if (e.maestro) setMaestro((m) => (m.productos.length ? m : { ...m, ...e.maestro, sucio: false, origen: { tipo: "nube" } }));
    invalidar();
  };
  const cargarDeNube = async (silencioso = false) => {
    setGuardandoNube(true); setError("");
    try {
      const r = await cargarProyectoNube();
      if (!r) { if (!silencioso) setAviso("Todavía no tienes nada guardado en tu cuenta."); setGuardandoNube(false); return; }
      const e = r.estado;
      setProyecto(e.proyecto ?? "Carga sin título");
      setItems(e.items ?? []);
      setVehiculos(conDeFabrica(e.vehiculos));
      setVehId(e.vehId ?? "53CS");
      if (e.veh) setVeh(e.veh);
      if (e.pallets) setPallets(e.pallets);
      if (e.reglas) setReglas(e.reglas);
      if (e.maestro) setMaestro((m) => (m.productos.length ? m : { ...m, ...e.maestro, sucio: false, origen: { tipo: "nube" } }));
      setUltimoGuardado(new Date(r.actualizado));
      invalidar();
      if (!silencioso) setAviso("Se cargó tu progreso guardado.");
    } catch (err) { if (!silencioso) setError("No se pudo cargar: " + err.message); }
    setGuardandoNube(false);
  };
  // Al entrar: primero el maestro permanente del usuario, luego lo último que estaba trabajando.
  useEffect(() => {
    (async () => {
      try {
        const r = await cargarMaestroNube();
        if (r?.maestro) setMaestro((m) => ({ ...m, ...r.maestro, sucio: false, origen: { tipo: "nube" } }));
      } catch { /* si falla, se sigue sin maestro; la persona lo puede cargar a mano */ }
      cargarDeNube(true);
    })();
  }, []);

  const elegirVehiculo = (id, extra = {}) => { setVehId(id); if (!id.startsWith("PAL:")) setVeh((p) => ({ ...p, ...vehiculos.find((v) => v.id === id), ...extra })); invalidar(); };
  const editarVeh = (k, v) => {
    setVeh((p) => ({ ...p, [k]: v }));
    setVehiculos((a) => a.map((x) => (x.id === vehId ? { ...x, [k]: v } : x)));
    invalidar();
  };
  let sigVeh = 1;
  const nuevoIdVeh = () => { let id; do { id = "PROP" + sigVeh++; } while (vehiculos.some((v) => v.id === id)); return id; };
  const altaVehiculo = (base, nombre) => {
    const v = { ...base, id: nuevoIdVeh(), nombre, propio: true };
    setVehiculos((a) => [...a, v]); setVehId(v.id); setVeh(v); invalidar();
    setAviso(`${nombre} agregado. Ajusta sus medidas abajo; se guarda mientras la herramienta esté abierta.`);
  };
  const agregarVehiculo = () => altaVehiculo({ L: 12000, W: 2400, H: 2600, tara: 0, maxKg: 0, maxVolPct: 0, maxSkus: 0, maxPiezas: 0 }, `Vehículo ${vehiculos.filter((v) => v.propio).length + 1}`);
  const duplicarVehiculo = () => altaVehiculo({ ...veh }, `${veh.nombre || nombreVeh} (copia)`);
  const quitarVehiculo = (id) => {
    setVehiculos((a) => a.filter((v) => v.id !== id));
    if (vehId === id) elegirVehiculo(vehiculos.find((v) => v.id !== id)?.id || VEHICULOS[0].id);
  };
  const editarPallet = (i, k, v) => { setPallets((a) => a.map((p, j) => (j === i ? { ...p, [k]: v } : p))); invalidar(); };
  const editarRegla = (k, v) => { setReglas((p) => ({ ...p, [k]: v })); invalidar(); };
  // Mover una línea en la lista: con la regla "Cargar en el orden de la lista" cambia el acomodo
  const moverItem = (id, paso) => {
    setItems((a) => {
      const i = a.findIndex((x) => x.id === id), j = i + paso;
      if (i < 0 || j < 0 || j >= a.length) return a;
      const b = a.slice(); [b[i], b[j]] = [b[j], b[i]]; return b;
    });
    invalidar();
    if (reglas.usarLista) setTimeout(() => calcularRef.current?.(), 40);   // recalcula solo para ver el cambio en el visor
  };
  // Desde la lista de carga: prender o apagar una orientación de ese SKU y recalcular
  const editarOrisDeLinea = (idx, k) => {
    const it = items[idx]; if (!it) return;
    const nuevas = it.oris.map((v, i) => (i === k ? !v : v));
    if (!nuevas.some(Boolean)) { setError(`${it.nombre} necesita al menos una orientación permitida.`); return; }
    setItems((a) => a.map((x) => (x.id === it.id ? { ...x, oris: nuevas } : x)));
    invalidar();
    setTimeout(() => calcularRef.current?.(), 40);
  };
  const editarItem = (id, k, v) => {
    setItems((a) => a.map((it) => {
      if (it.id !== id) return it;
      // Al escribir un SKU que existe en el maestro, se traen sus medidas y reglas (se conservan cantidad, entrega y pedido)
      if (k === "nombre") {
        const p = buscarSku(mapaMaestro, v);
        if (p && claveSku(v) !== claveSku(it.nombre)) return { ...itemDeProducto(p, { qty: it.qty, orden: it.orden, grupo: it.grupo, destino: it.destino }), id: it.id, color: it.color };
      }
      return { ...it, [k]: v };
    }));
    if (k !== "color") invalidar();
  };

  const cargarEjemplo = (k) => {
    const e = EJEMPLOS[k];
    setItems(e.items()); setProyecto(e.nombre);
    setReglas((r) => ({ ...r, usarOrden: true, agrupar: false, juntos: true, rigor: "estricto", separarGrupos: false, compresionAuto: true, apilamiento: "ninguna", ...(e.reglas || {}) }));
    elegirVehiculo(e.veh, e.vehExtra || {});
    setMenuEj(false); setVerMedidas(true); setSeccion("mercancia");
  };
  const nuevo = () => { setItems([nuevoItem({ nombre: "SKU 1" })]); setProyecto("Carga sin título"); setRevision(null); invalidar(); setVerMedidas(true); setSeccion("mercancia"); };

  const importar = () => {
    const filas = textoPegado.split(/\r?\n/).map((l) => l.split(/\t|;|,/).map((c) => c.trim())).filter((f) => f.length >= 6 && f[0]);
    const nuevos = filas.filter((f) => !isNaN(parseFloat(f[1]))).map((f) =>
      nuevoItem({ nombre: f[0], L: +f[1] || 0, W: +f[2] || 0, H: +f[3] || 0, peso: +f[4] || 0, qty: Math.round(+f[5] || 0), grupo: f[6] || "", orden: Math.round(+f[7] || 0), porPallet: Math.round(+f[8] || 0), paletizar: +f[8] > 0 }));
    if (!nuevos.length) { setError("No se reconocieron filas. Columnas: Nombre, Largo, Ancho, Alto, Peso, Cantidad, Pedido, Entrega, Cajas por pallet."); return; }
    setItems(nuevos); setPegar(false); setTextoPegado(""); setError(""); setVerMedidas(true); invalidar();
  };

  // ----- Maestro -----
  const aplicarMaestro = ({ productos, tarimas, errores, conversiones }, origen) => {
    setMaestro((m) => ({ productos, origen, sucio: false, guardado: null, errores, conversiones: conversiones || m.conversiones }));
    if (tarimas && tarimas.length) setPallets(tarimas);
    const nConv = conversiones ? Object.keys(conversiones).length : 0;
    setAviso(`Maestro cargado: ${productos.length} productos${tarimas?.length ? `, ${tarimas.length} tarimas` : ""}${nConv ? ` y conversiones de ${nConv} SKUs` : ""}.`);
  };
  const cargarDeCarpeta = async (dir) => {
    try {
      const fh = await dir.getFileHandle(ARCHIVO_MAESTRO);
      aplicarMaestro(leerMaestro(await (await fh.getFile()).arrayBuffer()), { tipo: "carpeta", nombre: dir.name });
    } catch (e) {
      if (e.name === "NotFoundError") {
        setMaestro((m) => ({ ...m, origen: { tipo: "carpeta", nombre: dir.name }, sucio: m.productos.length > 0 }));
        setAviso(`La carpeta «${dir.name}» no tiene ${ARCHIVO_MAESTRO}. Se creará al guardar.`);
      } else setError("No se pudo leer el maestro: " + e.message);
    }
    setReconectar(null);
  };
  useEffect(() => {
    if (!FS_DISPONIBLE) return;
    idb.get("carpeta").then(async (dir) => {
      if (!dir) return;
      dirRef.current = dir;
      if ((await dir.queryPermission({ mode: "readwrite" })) === "granted") cargarDeCarpeta(dir);
      else setReconectar(dir.name);
    }).catch(() => {});
  }, []);
  const conectarCarpeta = async () => {
    setError("");
    try {
      const dir = await window.showDirectoryPicker({ id: "estiba3d", mode: "readwrite" });
      dirRef.current = dir;
      idb.set("carpeta", dir).catch(() => {});
      await cargarDeCarpeta(dir);
    } catch (e) {
      if (e.name === "AbortError") return;
      setError("Este navegador o esta vista no permiten conectar carpetas. Usa «Abrir archivo» y «Guardar» descargará el maestro.");
    }
  };
  const volverAConectar = async () => {
    const dir = dirRef.current;
    if (dir && (await dir.requestPermission({ mode: "readwrite" })) === "granted") cargarDeCarpeta(dir);
  };
  const abrirArchivoMaestro = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try { dirRef.current = null; aplicarMaestro(leerMaestro(await f.arrayBuffer()), { tipo: "archivo", nombre: f.name }); }
    catch (err) { setError("No se pudo leer el archivo: " + err.message); }
  };
  // Guardar = a la cuenta del usuario, y nada más. Es lo que usa todo el mundo.
  const guardarMaestro = async () => {
    setError("");
    try {
      await guardarMaestroNube({ productos: maestro.productos, tarimas: pallets, conversiones: maestro.conversiones });
      setMaestro((m) => ({ ...m, sucio: false, guardado: new Date() }));
      setAviso("Maestro guardado en tu cuenta. Está disponible cada vez que entres, en cualquier computadora.");
    } catch (e) { setError("No se pudo guardar el maestro en tu cuenta: " + e.message); }
  };

  // Aparte y a propósito: bajar el maestro como Excel, o escribirlo en la carpeta conectada.
  // Es para quien quiera una copia fuera de la nube; no se dispara al guardar.
  const exportarMaestro = async () => {
    setError("");
    const buf = libroMaestro(maestro.productos, pallets, maestro.conversiones);
    const dir = dirRef.current;
    if (dir && maestro.origen?.tipo === "carpeta") {
      try {
        if ((await dir.queryPermission({ mode: "readwrite" })) !== "granted" && (await dir.requestPermission({ mode: "readwrite" })) !== "granted") throw new Error("permiso denegado");
        try {
          const anterior = await (await dir.getFileHandle(ARCHIVO_MAESTRO)).getFile();
          const w0 = await (await dir.getFileHandle(ARCHIVO_RESPALDO, { create: true })).createWritable();
          await w0.write(await anterior.arrayBuffer()); await w0.close();
        } catch (e) { /* no había archivo anterior */ }
        const w = await (await dir.getFileHandle(ARCHIVO_MAESTRO, { create: true })).createWritable();
        await w.write(buf); await w.close();
        setAviso(`Copia escrita en «${dir.name}/${ARCHIVO_MAESTRO}».`);
      } catch (e) { setError("No se pudo escribir en la carpeta: " + e.message); }
    } else {
      descargarArchivo(buf, ARCHIVO_MAESTRO, MIME_XLSX);
      setAviso(`Se descargó ${ARCHIVO_MAESTRO} como copia. Tu maestro en la cuenta no cambia por esto.`);
    }
  };
  const editarProducto = (pid, k, v) => setMaestro((m) => ({ ...m, sucio: true, productos: m.productos.map((p) => (p.pid === pid ? { ...p, [k]: v } : p)) }));
  const agregarProducto = () => {
    const p = productoVacio({ sku: `NUEVO-${maestro.productos.length + 1}`, tarima: pallets[0]?.nombre || "" });
    setMaestro((m) => ({ ...m, sucio: true, productos: [p, ...m.productos] }));
    setAbiertoP(p.pid); setBusqueda("");
  };
  const quitarProducto = (pid) => setMaestro((m) => ({ ...m, sucio: true, productos: m.productos.filter((p) => p.pid !== pid) }));
  const itemDeProducto = (p, extra, lista = pallets) => {
    const pi = lista.findIndex((t) => clave(t.nombre) === clave(p.tarima));
    const { pid, sku, desc, tarima, ...reglasP } = p;
    return nuevoItem({ ...reglasP, nombre: sku, desc, palletId: pi < 0 ? 0 : pi, ...extra });
  };
  const agregarACarga = (p) => { setItems((a) => [...a, itemDeProducto(p, { qty: 1 })]); invalidar(); setAviso(`${p.sku} agregado a la carga con 1 caja. Ajusta la cantidad en Mercancía.`); };
  const agregarSkuDelMaestro = () => {
    const p = buscarSku(mapaMaestro, skuNuevo);
    if (!p) { setError(`${skuNuevo} no está en el maestro.`); return; }
    setItems((a) => [...a, itemDeProducto(p, { qty: 1 })]); setSkuNuevo(""); setError(""); invalidar();
  };
  const pasarCargaAlMaestro = () => {
    const existentes = new Set(maestro.productos.map((p) => claveSku(p.sku)));
    const nuevos = items.filter((it) => it.nombre && !existentes.has(claveSku(it.nombre))).map((it) => {
      const { id, nombre, qty, orden, grupo, palletId, desc, ...r } = it;
      return productoVacio({ ...r, sku: nombre, desc: desc || "", tarima: pallets[palletId]?.nombre || "" });
    });
    setMaestro((m) => ({ ...m, sucio: nuevos.length > 0 || m.sucio, productos: [...m.productos, ...nuevos] }));
    setAviso(nuevos.length ? `${nuevos.length} SKUs de la carga se agregaron al maestro. Falta guardar.` : "Todos los SKUs de la carga ya están en el maestro.");
  };
  const aplicarCubeMaster = ({ productos, tarimas, lineas }, nombre) => {
    const nuevasT = [...pallets];
    tarimas.forEach((t) => { if (!nuevasT.some((x) => clave(x.nombre) === clave(t.nombre))) nuevasT.push(t); });
    setPallets(nuevasT);
    // Mapa nuevo por SKU exacto (antes se escribía sobre mapaMaestro, que es del render y tiene llaves de respaldo)
    const porSku = new Map(maestro.productos.filter((p) => p.sku).map((p) => [claveSku(p.sku), p]));
    productos.forEach((p) => porSku.set(claveSku(p.sku), { ...p, pid: porSku.get(claveSku(p.sku))?.pid ?? p.pid }));
    const todos = [...porSku.values()], indice = indiceSku(todos);
    setMaestro((m) => ({ ...m, productos: todos, sucio: true, origen: m.origen || { tipo: "archivo", nombre: ARCHIVO_MAESTRO } }));
    if (lineas.length) {
      const nuevos = lineas.map((l) => itemDeProducto(buscarSku(indice, l.sku), { qty: l.qty, orden: l.orden, grupo: l.grupo, destino: l.destino }, nuevasT));
      setItems(nuevos); setProyecto(nombre.replace(/\.[^.]+$/, "")); invalidar();
    }
    setAviso(`Plantilla de CubeMaster importada: ${productos.length} productos al maestro${tarimas.length ? `, ${tarimas.length} tarimas` : ""}${lineas.length ? ` y un pedido de ${lineas.reduce((a, l) => a + l.qty, 0).toLocaleString("es-MX")} cajas` : ""}. Presiona Guardar en Maestro para conservar los productos.`);
    if (lineas.length) setVerMedidas(false);
    setSeccion(lineas.length ? "mercancia" : "maestro");
  };
  const importarConversiones = async (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    setError(""); setLeyendo(`Leyendo ${f.name}… los archivos del ERP pueden tardar unos segundos.`);
    try {
      const buf = await f.arrayBuffer();
      await new Promise((r) => setTimeout(r, 30));  // deja pintar el aviso antes de bloquear con la lectura
      const skus = new Set(maestro.productos.map((p) => claveSku(p.sku)));
      const r = leerConversiones(buf, skus);
      if (!r.skus) { setError(`El archivo tiene ${r.filas.toLocaleString("es-MX")} equivalencias, pero ninguna es de un SKU del maestro. Carga primero el maestro.`); setLeyendo(""); return; }
      setMaestro((m) => ({ ...m, sucio: true, conversiones: { ...(m.conversiones || {}), ...r.porSku } }));
      setAviso(`Conversiones importadas: ${r.skus.toLocaleString("es-MX")} SKUs del maestro (${r.ums.join(", ")}). Se descartaron ${r.sinUsar.toLocaleString("es-MX")} equivalencias de SKUs que no están en el maestro. Falta presionar Guardar.`);
    } catch (err) { setError("No se pudo leer el archivo de conversiones: " + err.message); }
    setLeyendo("");
  };
  const importarCube = async (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    try { aplicarCubeMaster(leerCubeMaster(await f.arrayBuffer()), f.name); } catch (err) { setError("No se pudo leer la plantilla de CubeMaster: " + err.message); }
  };
  // Refresca identidad y medidas desde un archivo de solo dimensiones (lo que en el futuro podría
  // venir del ERP), sin tocar las reglas de estiba y paletizado que ya se configuraron por SKU.
  const importarDimensiones = async (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    setError("");
    try {
      const r = actualizarDimensiones(maestro.productos, await f.arrayBuffer());
      if (r.errores.length && !r.actualizados && !r.creados) { setError(r.errores.join(" ")); return; }
      setMaestro((m) => ({ ...m, productos: r.productos, sucio: true }));
      setAviso(`Dimensiones actualizadas: ${r.actualizados} producto${r.actualizados === 1 ? "" : "s"} existente${r.actualizados === 1 ? "" : "s"}`
        + (r.creados ? `, ${r.creados} nuevo${r.creados === 1 ? "" : "s"} (con parámetros por configurar)` : "") + ". Falta presionar Guardar."
        + (r.errores.length ? ` ${r.errores.length} línea${r.errores.length === 1 ? "" : "s"} con problemas: ${r.errores.join(" ")}` : ""));
    } catch (err) { setError("No se pudo leer el archivo de dimensiones: " + err.message); }
  };
  // Enciende y configura el Bundle (BDL) de los SKUs que ya existen en el maestro, a partir del Excel
  // de referencia (ID Artículo, UM, Rel, Factor, CS/BDL, medidas). El % máximo de Bundle se ajusta
  // después, a mano, por SKU: es una decisión operativa y no viene en ese archivo.
  const importarBundle = async (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    setError("");
    try {
      const r = leerBundleMaestro(maestro.productos, await f.arrayBuffer());
      if (!r.actualizados) { setError(`No se importó ningún SKU. ${r.errores.join(" ")}`); return; }
      setMaestro((m) => ({ ...m, productos: r.productos, sucio: true }));
      setAviso(`Bundle importado: ${r.actualizados} SKU${r.actualizados === 1 ? "" : "s"} con Bundle activado. Falta capturar el % máximo de Bundle por SKU y presionar Guardar.`
        + (r.errores.length ? ` ${r.errores.length} línea${r.errores.length === 1 ? "" : "s"} con problemas: ${r.errores.join(" ")}` : ""));
    } catch (err) { setError("No se pudo leer el archivo de Bundle: " + err.message); }
  };
  // Reemplaza el catálogo de vehículos con lo que traiga el archivo (conserva el vehículo elegido si sigue en la lista).
  const importarVehiculos = async (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    setError("");
    try {
      const r = leerVehiculos(await f.arrayBuffer());
      if (!r.vehiculos.length) { setError("El archivo no tiene ningún vehículo con medidas completas."); return; }
      setVehiculos(r.vehiculos);
      const actual = r.vehiculos.find((v) => v.nombre === veh.nombre) || r.vehiculos[0];
      elegirVehiculo(actual.id);
      setAviso(`Catálogo de vehículos importado: ${r.vehiculos.length} vehículo${r.vehiculos.length === 1 ? "" : "s"}.` + (r.errores.length ? ` ${r.errores.join(" ")}` : ""));
    } catch (err) { setError("No se pudo leer el catálogo de vehículos: " + err.message); }
  };
  const cargarPedido = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      const leido = leerPedido(await f.arrayBuffer());
      if (leido.cubemaster) { aplicarCubeMaster(leido.cubemaster, f.name); return; }
      const { lineas, datos } = leido;
      if (!lineas.length) { setError("El archivo no tiene líneas con SKU y cantidad. Usa la plantilla de carga."); return; }
      const porSku = mapaMaestro;
      const nuevos = [], filas = [];
      lineas.forEach((l) => {
        const p = buscarSku(porSku, l.sku), extra = { qty: l.qty, orden: l.orden, grupo: l.grupo, destino: l.destino };
        const umCaja = p?.umCaja || UM_CAJA_DEF;
        const fila = { sku: l.sku, desc: p?.desc || "", capturado: l.qty, um: l.um || "", umCaja, cajas: l.qty, estado: "ok", detalle: "" };
        const c = aCajas(l.qty, l.um, umCaja, conversionDe(maestro.conversiones, p?.sku ?? l.sku), p?.piezas);
        extra.qty = fila.cajas = c.cajas;
        if (l.um && normalizaUM(l.um) !== normalizaUM(umCaja)) { extra.qtyPedido = l.qty; extra.umPedido = l.um; }
        if (c.motivo) { fila.estado = "sin conversión"; fila.detalle = c.motivo + "; se tomó la cantidad tal cual"; }
        else if (c.cambioDeUM) { fila.estado = "otra unidad"; fila.umCaja = c.destino; fila.detalle = `el maestro dice ${umCaja}, pero este SKU solo tiene ${c.destino}`; }
        if (!c.exacto && !c.motivo) {
          fila.estado = fila.estado === "ok" ? "redondeado" : fila.estado;
          fila.detalle = `${c.exactas.toLocaleString("es-MX", { maximumFractionDigits: 3 })} ${fila.umCaja} → ${c.cajas}` + (fila.detalle ? `; ${fila.detalle}` : "");
        }
        if (l.pal !== undefined) extra.paletizar = l.pal;
        if (l.porPallet !== undefined) extra.porPallet = l.porPallet;
        if (p) nuevos.push(itemDeProducto(p, extra));
        else if (numero(l.crudo.largo) > 0 && numero(l.crudo.ancho) > 0 && numero(l.crudo.alto) > 0) {
          nuevos.push(nuevoItem({ nombre: l.sku, L: numero(l.crudo.largo), W: numero(l.crudo.ancho), H: numero(l.crudo.alto), peso: numero(l.crudo.peso), ...extra }));
          fila.estado = "medidas del pedido"; fila.detalle = "no está en el maestro; se usaron las medidas capturadas en el archivo";
        } else { fila.estado = "sin medidas"; fila.detalle = "no está en el maestro y el archivo no trae medidas; la línea no se cargó"; fila.cajas = 0; }
        filas.push(fila);
      });
      if (!nuevos.length) { setError(`Ningún SKU del pedido está en el maestro${maestro.productos.length ? "" : " (conecta o abre el maestro primero)"}.`); setRevision({ filas, archivo: f.name }); return; }
      // Bundle (BDL): antes de cargar la mercancía, cada SKU con Bundle activado se divide en su
      // parte de Bundles completos y su parte suelta (ver archivos/bundle.js). Se hace aquí, sobre
      // las cantidades ya convertidas a cajas, y no dentro del motor de cubicaje.
      const { items: itemsFinal, avisos: avisosBundle } = transformarPedidoBundle(nuevos, porSku, claveSku);
      const bundlesFormados = itemsFinal.filter((it) => it.esBundle).length;
      setItems(itemsFinal);
      setProyecto(datos.nombre || f.name.replace(/\.[^.]+$/, ""));
      const v = datos.vehiculo && vehiculos.find((x) => clave(x.nombre) === clave(datos.vehiculo) || clave(x.id) === clave(datos.vehiculo));
      if (v) elegirVehiculo(v.id); else invalidar();
      const revisar = filas.filter((x) => x.estado !== "ok").length;
      setRevision({ filas, archivo: f.name });
      setError("");
      setAviso(`Pedido cargado: ${nuevos.length} de ${filas.length} líneas, ${nuevos.reduce((a, x) => a + x.qty, 0).toLocaleString("es-MX")} cajas${v ? `, vehículo ${v.nombre}` : ""}.`
        + (bundlesFormados ? ` ${bundlesFormados} línea${bundlesFormados === 1 ? "" : "s"} de Bundle formada${bundlesFormados === 1 ? "" : "s"}.` : "")
        + (revisar ? ` ${revisar} ${revisar === 1 ? "línea necesita" : "líneas necesitan"} revisión: abajo está el detalle.` : " Todas las cantidades cuadraron exactas.")
        + (avisosBundle.length ? ` Bundle: ${avisosBundle.join(" ")}` : ""));
      setVerMedidas(false); setSeccion("mercancia");
    } catch (err) { setError("No se pudo leer el pedido: " + err.message); }
  };
  const CAMPOS_MAESTRO = ["L", "W", "H", "peso", "piezas", "umCaja", "volteoPiso", "compresion", "maxNiveles", "valorApilar", "pesoMaxEncima", "piso", "soportaEncima", "paletizar", "porPallet", "porCapa", "capasPallet", "resto", "aceptaCajas", "aceptaPallet"];

  const difiereDeMaestro = (it) => {
    const p = buscarSku(mapaMaestro, it.nombre); if (!p) return false;
    if (CAMPOS_MAESTRO.some((k) => it[k] !== p[k])) return true;
    if (it.oris.some((v, i) => v !== p.oris[i])) return true;
    return clave(pallets[it.palletId]?.nombre) !== clave(p.tarima) && (it.paletizar || p.paletizar);
  };
  const guardarEnMaestro = (it) => {
    setMaestro((m) => ({ ...m, sucio: true, productos: m.productos.map((p) => (claveSku(p.sku) === claveSku(it.nombre) ? { ...p, ...Object.fromEntries(CAMPOS_MAESTRO.map((k) => [k, it[k]])), oris: [...it.oris], tarima: pallets[it.palletId]?.nombre || p.tarima } : p)) }));
    setAviso(`${it.nombre} actualizado en el maestro. Falta presionar Guardar en Maestro.`);
  };
  const volverAlMaestro = (it) => {
    const p = buscarSku(mapaMaestro, it.nombre); if (!p) return;
    const base = itemDeProducto(p, { qty: it.qty, orden: it.orden, grupo: it.grupo, destino: it.destino });
    setItems((a) => a.map((x) => (x.id === it.id ? { ...base, id: it.id, color: it.color } : x))); invalidar();
  };
  const productosFiltrados = useMemo(() => {
    const q = clave(busqueda);
    return q ? maestro.productos.filter((p) => clave(p.sku).includes(q) || clave(p.idProducto).includes(q) || clave(p.desc).includes(q)) : maestro.productos;
  }, [maestro.productos, busqueda]);

  // Una corrida a la vez. El AbortController permite cancelarla desde el botón o al desmontar.
  const corridaRef = useRef(null);
  // Recomendación: corre el mismo pedido contra cada vehículo de la lista y compara
  const recomendar = async () => {
    setError(""); setRecomendacion(null); setResaltado(null); setVista(null);
    const candidatos = vehiculos.filter((v) => v.L > 0 && v.W > 0 && v.H > 0);
    setProgreso({ i: 0, n: candidatos.length });
    const ctrl = new AbortController(); corridaRef.current = ctrl;
    const filas = [];
    try {
      for (let i = 0; i < candidatos.length; i++) {
        const v = { ...candidatos[i], maxVolPct: veh.maxVolPct, maxSkus: veh.maxSkus, maxPiezas: veh.maxPiezas };
        setProgreso({ i, n: candidatos.length });
        try {
          const c = await correr({ items, vehiculo: v, tarimas: pallets, reglas: { ...reglas, nivel: 1 } }, { ejecutor, signal: ctrl.signal });
          const r = c.resultado, volV = v.L * v.W * v.H;
          const usados = r.contenedores.length, ocup = usados ? (r.contenedores.reduce((a, x) => a + x.vol, 0) / (volV * usados)) * 100 : 0;
          // Flete de toda la corrida con ese vehículo: es lo que de verdad decide cuando dos opciones caben.
          const destino = items.find((it) => it.destino)?.destino || "";
          const f = tarifas.length ? fleteTotal(tarifas, v.id, destino, r.contenedores.map((x) => ({
            ocupacion: (x.vol / volV) * 100, peso: x.peso, m3: x.vol / 1e9,
          }))) : null;
          filas.push({ id: v.id, nombre: v.nombre, vehiculos: usados, sinCargar: r.sinCargar, ocupacion: ocup, m3: volV / 1e9,
            pesoMax: v.maxKg ? v.maxKg - (v.tara || 0) : 0, peso: r.contenedores.reduce((a, x) => a + x.peso, 0),
            flete: f?.total ?? null, moneda: f?.moneda ?? "MXN" });
        } catch (e) {
          if (e instanceof ErrorCorrida && e.tipo === "cancelada") throw e;
          filas.push({ id: v.id, nombre: v.nombre, error: true });
        }
      }
      // Primero que quepa todo. Después, si hay tarifas configuradas, manda el flete más barato;
      // si no hay tarifas (o falta la de algún vehículo), se decide como antes: menos unidades y más lleno.
      filas.sort((a, b) =>
        (a.error ? 1 : 0) - (b.error ? 1 : 0)
        || a.sinCargar - b.sinCargar
        || (a.flete != null && b.flete != null ? a.flete - b.flete : 0)
        || (a.flete != null ? -1 : 0) - (b.flete != null ? -1 : 0)
        || a.vehiculos - b.vehiculos
        || b.ocupacion - a.ocupacion);
      setRecomendacion(filas);
      setSeccion("vehiculo");   // el cuadro comparativo vive en esa sección; sin esto el botón parecía no hacer nada
      const g = filas[0];
      setAviso(g && !g.error
        ? `Mejor opción: ${g.vehiculos} × ${g.nombre} al ${g.ocupacion.toFixed(0)}%` + (g.flete != null ? ` · flete ${g.flete.toLocaleString("es-MX", { style: "currency", currency: g.moneda, maximumFractionDigits: 0 })}` : "") + "."
        : "Ningún vehículo de la lista acomodó esta carga.");
    } catch (e) {
      if (!(e instanceof ErrorCorrida && e.tipo === "cancelada")) setError("La recomendación falló: " + (e.detalle?.original || e.message));
    }
    corridaRef.current = null; setProgreso(null);
  };

  const calcular = async () => {
    setError(""); setProgreso({ i: 0, n: 1 }); setResaltado(null); setVista(null); setConsolidar(null); setEspacios(null); setCalculandoEspacios(false); intentoRef.current++;
    const ctrl = new AbortController(); corridaRef.current = ctrl;
    try {
      const c = await correr(cargaPara(items, reglas), { ejecutor, signal: ctrl.signal, onProgreso: (i, n) => setProgreso({ i, n }) });
      const r = c.resultado; setCorrida(c); setRes(r); setSel(0); setPaso(r.contenedores[0]?.cajas.length || 0);
      setPestana(r.avisos.length || r.sinCargar || r.noCaben.length ? "avisos" : "resumen");
    } catch (e) {
      if (e instanceof ErrorCorrida && e.tipo === "cancelada") { /* el usuario canceló: sin mensaje */ }
      else if (e instanceof ErrorCorrida && e.tipo === "entrada_invalida") setError("Revisa estos datos: " + e.detalle.problemas.map((p) => p.mensaje).join(" "));
      else setError("El cálculo falló: " + (e.detalle?.original || e.message));
    }
    corridaRef.current = null; setProgreso(null);
  };
  calcularRef.current = calcular;
  const cancelarCorrida = () => corridaRef.current?.abort();
  useEffect(() => () => corridaRef.current?.abort(), []);

  // Completar espacios vacíos: sobre la carga ya calculada, prueba meter más unidades de los SKUs
  // que ya están en el pedido (nunca uno externo) en lo que sobró de espacio. Se corre con la MISMA carga
  // y reglas que la corrida mostrada (corrida.carga): una vez con cada SKU solo (alternativas individuales,
  // en nivel rápido) y una con todos juntos (la combinación, en el nivel de la corrida). El relleno nunca
  // desplaza la demanda real: ver esRelleno en motor/motor.js (siempre se coloca al final y nunca abre
  // un vehículo nuevo). Una alternativa solo cuenta si la demanda real quedó igual que en la corrida.
  const completarEspacios = async () => {
    if (!res || !corrida || !res.contenedores.length) return;
    const token = ++intentoRef.current;
    setError(""); setCalculandoEspacios(true); setEspacios(null);
    const base = corrida.carga, vb = base.vehiculo, volV = vb.L * vb.W * vb.H, nBase = res.contenedores.length;
    const ocupacion = (r) => (volV && r.contenedores.length ? (r.contenedores.reduce((a, c) => a + c.vol, 0) / (volV * r.contenedores.length)) * 100 : 0);
    const comparable = (r) => r.contenedores.length === nBase && r.sinCargar <= res.sinCargar;
    const candidatos = new Map();
    base.items.forEach((it) => { if (!it.esBundle && it.qty > 0 && !candidatos.has(it.id)) candidatos.set(it.id, it); });
    const lista = [...candidatos.values()];
    const filler = (it) => ({ ...it, id: `rel-${it.id}`, qty: 500000, esRelleno: true, paletizar: false });
    const correrCon = (fillers, nivel) => correr({ ...base, items: [...base.items, ...fillers], reglas: { ...base.reglas, nivel } }, { ejecutor }).then((c) => c.resultado);
    // origen[i] es el SKU del que salió el relleno i (va después de las líneas reales de la carga)
    const contar = (r, origen) => {
      const cuenta = new Map();
      r.contenedores.forEach((c) => c.cajas.forEach((k) => {
        const it = k.relleno ? origen[k.idx - base.items.length] : null; if (!it) return;
        const e = cuenta.get(it.id) || { id: it.id, nombre: it.nombre, umCaja: it.umCaja, paletizado: !!it.paletizar, cantidad: 0 };
        e.cantidad++; cuenta.set(it.id, e);
      }));
      return [...cuenta.values()].sort((a, b) => b.cantidad - a.cantidad);
    };
    try {
      const ocupacionActual = ocupacion(res);
      let descartadas = 0;
      const individuales = [];
      for (const it of lista) {
        // Primero en nivel rápido; si así la demanda real ya no queda igual, se repite en el nivel de la corrida
        let r = await correrCon([filler(it)], 1);
        if (token !== intentoRef.current) return;
        if (!comparable(r) && base.reglas.nivel > 1) { r = await correrCon([filler(it)], base.reglas.nivel); if (token !== intentoRef.current) return; }
        if (!comparable(r)) { descartadas++; continue; }
        const [f] = contar(r, [it]);
        if (f) individuales.push({ ...f, ocupacionAntes: ocupacionActual, ocupacionDespues: ocupacion(r) });
      }
      individuales.sort((a, b) => b.cantidad - a.cantidad);
      let combinacion = [], ocupacionCombinacion = ocupacionActual;
      if (lista.length > 1) {
        const r = await correrCon(lista.map(filler), base.reglas.nivel);
        if (token !== intentoRef.current) return;
        if (comparable(r)) { combinacion = contar(r, lista); ocupacionCombinacion = ocupacion(r); } else descartadas++;
      }
      setEspacios({ ocupacionActual, individuales, combinacion, ocupacionCombinacion, descartadas });
    } catch (e) {
      if (token === intentoRef.current) setError("No se pudo calcular el relleno de espacios: " + (e.detalle?.original || e.message));
    }
    if (token === intentoRef.current) setCalculandoEspacios(false);
  };
  // Aplica una o varias alternativas: suma la cantidad sugerida a cada SKU en la carga actual. El relleno
  // se calculó suelto: si el SKU va paletizado, lo extra entra como una línea suelta aparte (si se sumara a
  // la línea paletizada, el motor lo armaría en pallet y ya no cabría igual). Falta recalcular para verlo.
  const aplicarRelleno = (sugeridas) => {
    setItems((a) => {
      let nueva = [...a];
      sugeridas.forEach(({ id, cantidad }) => {
        const it = nueva.find((x) => x.id === id);
        if (!it) return;
        if (it.paletizar) { const { id: _id, ...resto } = it; nueva.push(nuevoItem({ ...resto, qty: cantidad, paletizar: false })); }
        else nueva = nueva.map((x) => (x.id === id ? { ...x, qty: x.qty + cantidad } : x));
      });
      return nueva;
    });
    invalidar();
    const total = sugeridas.reduce((s, f) => s + f.cantidad, 0);
    setAviso(`Se agregaron ${total.toLocaleString("es-MX")} unidades más (${sugeridas.map((f) => f.nombre).join(", ")}) para aprovechar el espacio libre. Presiona Calcular para verlas acomodadas.`);
  };

  // Cuando el último vehículo casi no se usa (menos del 5%), vale la pena preguntarse si todo cabía en uno
  // menos. Se prueba, de la menos a la más invasiva: más nivel de esfuerzo; relajar las reglas que estén
  // activas (orden de entrega, lista, pedidos juntos o separados, apilamiento, cajas juntas); cambiar
  // «simular la carga real»; y permitir girar las cajas en cualquier orientación. Si nada de eso lo logra,
  // se sugiere qué reducir a partir de lo que de verdad terminó en el último vehículo, y se comprueba.
  const intentarConsolidar = async () => {
    if (!res || !corrida || res.contenedores.length < 2) return;
    const token = ++intentoRef.current;
    const nBase = res.contenedores.length, objetivo = nBase - 1;
    const vb = corrida.carga.vehiculo, volV = vb.L * vb.W * vb.H;
    setError(""); setConsolidar({ intentando: true, objetivo });
    const hayEntregas = items.some((it) => it.orden > 0), hayPedidos = items.some((it) => it.grupo);
    const relajadas = [];
    if (reglas.usarOrden && hayEntregas) relajadas.push("sin respetar el orden de entrega (cambia el orden de descarga)");
    if (reglas.usarLista) relajadas.push("sin el orden de la lista");
    if (reglas.agrupar && hayPedidos) relajadas.push("sin mantener juntos los pedidos");
    if (reglas.separarGrupos && hayPedidos) relajadas.push("mezclando pedidos en el mismo vehículo");
    if (reglas.apilamiento !== "ninguna") relajadas.push("sin regla de apilamiento");
    if (reglas.juntos) relajadas.push("permitiendo separar cajas del mismo SKU");
    const relajar = { usarOrden: false, usarLista: false, agrupar: false, separarGrupos: false, apilamiento: "ninguna", juntos: false };
    const nivelPrueba = Math.max(2, Math.min(3, reglas.nivel));
    const simular = reglas.compresionAuto !== false;
    const girables = (lista) => lista.map((it) => (it.paletizar || (it.forma && it.forma !== "caja") ? it : { ...it, oris: [true, true, true, true, true, true], volteoPiso: true }));
    const variaciones = [];
    if (reglas.nivel < 4) variaciones.push({ descripcion: `con más nivel de esfuerzo de cálculo (nivel ${reglas.nivel + 1})`, cambios: { nivel: reglas.nivel + 1 } });
    if (relajadas.length) variaciones.push({ descripcion: relajadas.join(", "), cambios: { nivel: nivelPrueba, ...relajar } });
    // Cada variación acumula las reglas relajadas; la descripción dice exactamente qué cambió
    // «Simular la carga real» reproduce cómo se carga en el piso (bultos de pie, holgura entre SKUs), así
    // que apagarlo da el óptimo geométrico: más apretado, pero hay que confirmar que el andén lo logre.
    // Encenderlo nunca ayuda a consolidar, por eso solo se prueba apagarlo, y la rotación libre va encima.
    const pasos = [...relajadas];
    if (simular) {
      pasos.push("desactivando «simular la carga real» (acomodo geométrico óptimo; confirma que el andén lo pueda replicar)");
      variaciones.push({ descripcion: pasos.join(", "), cambios: { nivel: nivelPrueba, ...relajar, compresionAuto: false } });
    }
    pasos.push("permitiendo girar o acostar las cajas en cualquier orientación (confirma que el producto lo aguante)");
    variaciones.push({ descripcion: pasos.join(", "), cambios: { nivel: nivelPrueba, ...relajar, compresionAuto: false }, items: girables });
    const cabe = (r) => r.contenedores.length <= objetivo && r.sinCargar <= res.sinCargar && r.noCaben.length <= res.noCaben.length;
    try {
      for (const v of variaciones) {
        const reglasProbar = { ...reglas, ...v.cambios };
        const itemsProbar = v.items ? v.items(items) : items;
        const c = await correr(cargaPara(itemsProbar, reglasProbar), { ejecutor });
        if (token !== intentoRef.current) return;
        if (cabe(c.resultado)) {
          const ocupacion = c.resultado.contenedores.reduce((a, k) => a + k.vol, 0) / (volV * c.resultado.contenedores.length) * 100;
          setConsolidar({ intentando: false, objetivo, exito: { descripcion: v.descripcion, reglas: reglasProbar, items: v.items ? itemsProbar : null, corrida: c }, ocupacion });
          return;
        }
      }
      // Ninguna variación lo logró: se sugiere quitar lo que de verdad terminó en el último vehículo (sueltas
      // y el contenido de sus pallets, incluidos los mixtos), contado por línea de la carga.
      const cargaItems = corrida.carga.items, ultimo = res.contenedores[nBase - 1], cuenta = new Map();
      const sumar = (idx) => {
        const it = cargaItems[idx]; if (!it) return;
        const e = cuenta.get(it.id) || { id: it.id, nombre: it.nombre, umCaja: it.umCaja, cantidad: 0 };
        e.cantidad++; cuenta.set(it.id, e);
      };
      ultimo.cajas.forEach((k) => { if (k.pal >= 0) (res.pallets[k.pal]?.cajas || []).forEach((kk) => sumar(kk.idx)); else sumar(k.idx); });
      const reduccion = [...cuenta.values()].sort((a, b) => b.cantidad - a.cantidad);
      // Se comprueba corriendo la carga ya reducida con las reglas actuales: el motor es heurístico y no
      // siempre reproduce el mismo acomodo, así que se avisa si la reducción no alcanzó por sí sola.
      const porId = new Map(reduccion.map((r) => [r.id, r.cantidad]));
      const reducidos = items.map((it) => (porId.has(it.id) ? { ...it, qty: it.qty - porId.get(it.id) } : it)).filter((it) => it.qty > 0);
      let verificada = false;
      if (reducidos.length) {
        const c = await correr(cargaPara(reducidos, reglas), { ejecutor });
        if (token !== intentoRef.current) return;
        verificada = c.resultado.contenedores.length <= objetivo;
      }
      setConsolidar({ intentando: false, objetivo, exito: null, reduccion, verificada, ultimoPct: (ultimo.vol / volV) * 100 });
    } catch (e) {
      if (token !== intentoRef.current) return;
      setError("No se pudo intentar la consolidación: " + (e.detalle?.original || e.message));
      setConsolidar(null);
    }
  };
  // Aplica la variación que sí logró usar un vehículo menos, y deja ya puesto ese resultado.
  const aplicarConsolidacion = () => {
    if (!consolidar?.exito) return;
    const { reglas: r, items: its, corrida: c, descripcion } = consolidar.exito;
    intentoRef.current++;
    setReglas(r); if (its) setItems(its);
    setCorrida(c); setRes(c.resultado); setSel(0); setPaso(c.resultado.contenedores[0]?.cajas.length || 0); setEspacios(null);
    setPestana(c.resultado.avisos.length ? "avisos" : "resumen");
    setConsolidar(null);
    setAviso(`Con ${descripcion}, la carga quedó en ${c.resultado.contenedores.length} ${c.resultado.contenedores.length === 1 ? "vehículo" : "vehículos"} al ${consolidar.ocupacion.toFixed(0)}%. Las reglas${its ? " y orientaciones" : ""} quedaron cambiadas para esta carga.`);
  };
  // Aplica la reducción sugerida cuando ninguna variación alcanzó: baja esas cantidades de cada línea.
  const aplicarReduccionConsolidar = () => {
    if (!consolidar?.reduccion) return;
    const porId = new Map(consolidar.reduccion.map((r) => [r.id, r.cantidad]));
    setItems((a) => a.map((it) => (porId.has(it.id) ? { ...it, qty: Math.max(0, it.qty - porId.get(it.id)) } : it)).filter((it) => it.qty > 0));
    invalidar();
    setAviso("Se redujeron las cantidades sugeridas. Presiona Calcular para ver el resultado con un vehículo menos.");
  };

  const cont = res?.contenedores[sel];
  // El reporte se arma una sola vez por corrida, con la carga exacta que usó el motor.
  const reporte = useMemo(() => (corrida ? armarReporte(corrida) : null), [corrida]);
  const stats = reporte?.contenedores[sel] ?? null;
  // El último vehículo casi vacío (menos del 5%) es la señal de que tal vez todo cabía en uno solo.
  const ultimoCasiVacio = useMemo(() => {
    const vb = corrida?.carga.vehiculo;
    if (!res || res.contenedores.length < 2 || !vb?.L) return null;
    const volV = vb.L * vb.W * vb.H, ultimo = res.contenedores[res.contenedores.length - 1];
    const pct = ultimo.vol / volV;
    return pct < UMBRAL_CONSOLIDAR ? pct * 100 : null;
  }, [res, corrida]);

  const descargarRevision = () => {
    const filas = [["SKU", "Descripción", "Capturado", "UM capturada", "UM de la caja", "Cajas", "Estado", "Detalle"],
      ...revision.filas.map((f) => [f.sku, f.desc, f.capturado, f.um || "", f.umCaja, f.cajas, f.estado, f.detalle])];
    descargarArchivo(libroSimple(filas, "Revisión", [18, 32, 12, 14, 14, 10, 18, 60]), `revision_pedido_${nombreArchivo(proyecto)}.xlsx`, MIME_XLSX);
  };

  const descargarResultados = () =>
    descargarArchivo(libroResultados({ reporte, proyecto, nombreVeh, nivel: reglas.nivel }), `resultados_${nombreArchivo(proyecto)}.xlsx`, MIME_XLSX);

  const descargarInstructivo = async () => {
    if (!cont || !apiVisor.current) return;
    setGenerando(true); setVista(null);
    await new Promise((r) => setTimeout(r, 60));
    const etapas = etapasDe(stats.pasos, stats.nBultos);
    const imagenes = apiVisor.current.capturar(etapas.map((e) => e[e.length - 1].fin));
    const html = htmlInstructivo({ reporte, sel, modoPallet, proyecto, nombreVeh, etapas, imagenes });
    descargarArchivo(html, `instructivo_carga_${nombreArchivo(proyecto)}_${modoPallet ? "pallet" : "vehiculo"}_${sel + 1}.html`, "text/html;charset=utf-8");
    setGenerando(false);
    setAviso("Instructivo descargado. Ábrelo en el navegador y usa Imprimir → Guardar como PDF si lo quieres en PDF.");
  };

  // Instructivo con el diagrama de pasos de TODOS los vehículos (o pallets) en un solo documento,
  // cada uno con su propia numeración de pasos e imágenes del visor.
  const descargarInstructivoCompleto = async () => {
    if (!res || !apiVisor.current || !reporte) return;
    setGenerando(true); setVista(null);
    const selOriginal = sel;
    try {
      const secciones = [];
      for (let i = 0; i < res.contenedores.length; i++) {
        setSel(i); setPaso(res.contenedores[i].cajas.length);
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 120)); // dejar que el visor redibuje este vehículo antes de capturarlo
        const statsI = reporte.contenedores[i];
        const etapas = etapasDe(statsI.pasos, statsI.nBultos);
        const imagenes = apiVisor.current.capturar(etapas.map((e) => e[e.length - 1].fin));
        secciones.push({ sel: i, etapas, imagenes });
      }
      const html = htmlInstructivoCompleto({ reporte, secciones, modoPallet, proyecto, nombreVeh });
      descargarArchivo(html, `instructivo_carga_${nombreArchivo(proyecto)}_completo.html`, "text/html;charset=utf-8");
      setAviso(`Instructivo completo descargado (${res.contenedores.length} ${modoPallet ? "pallets" : "vehículos"}, uno por página).`);
    } finally {
      setSel(selOriginal); setPaso(res.contenedores[selOriginal]?.cajas.length || 0);
      setGenerando(false);
    }
  };

  const verPallet = (i) => { setVista(i); setPaso(res.pallets[i].cajas.length); setResaltado(null); };
  const verVehiculo = (i) => { setVista(null); setSel(i); setPaso(res.contenedores[i].cajas.length); };
  const palVista = vista !== null && res ? res.pallets[vista] : null;
  const visor = palVista
    ? { veh: { L: palVista.palL + 2 * palVista.ovL, W: palVista.palW + 2 * palVista.ovW, H: palVista.alto - palVista.esp + 50 },
        base: { esp: palVista.esp, x: palVista.ovL, y: palVista.ovW, l: palVista.palL, w: palVista.palW },
        cajas: palVista.cajas.map((k) => ({ ...k, x: k.x + palVista.ovL - palVista.baseX, y: k.y + palVista.ovW - palVista.baseY, pal: -1 })), total: palVista.cajas.length }
    : { veh: vehCalc, base: palSel ? { esp: palSel.esp, x: palSel.ovL, y: palSel.ovW, l: palSel.L, w: palSel.W } : null, cajas: cont?.cajas || [], total: cont?.cajas.length || 0 };

  const calculando = progreso !== null;
  const nPalletizados = items.filter((i) => i.paletizar).length;
  const reglasActivas = [reglas.usarOrden && items.some((i) => i.orden > 0), reglas.agrupar, reglas.juntos, reglas.apilamiento !== "ninguna"].filter(Boolean).length;

  const NAV = [
    { id: "maestro", icono: Database, t: "Maestro", d: maestro.productos.length ? `${maestro.productos.length} productos${maestro.sucio ? " · sin guardar" : ""}` : "Vacío" },
    { id: "mercancia", icono: Package, t: "Mercancía", d: `${items.length} SKUs` },
    { id: "vehiculo", icono: Truck, t: modoPallet ? "Pallet" : "Vehículo", d: nombreVeh },
    { id: "pallets", icono: Layers, t: "Paletizado", d: nPalletizados ? `${nPalletizados} SKUs paletizados` : "Catálogo de tarimas" },
    { id: "reglas", icono: SlidersHorizontal, t: "Reglas", d: `Nivel ${reglas.nivel}${reglasActivas ? ` · ${reglasActivas} activas` : ""}` },
    { id: "herramientas", icono: Calculator, t: "Herramientas", d: "Capacidad de un SKU" },
    { id: "ayuda", icono: HelpCircle, t: "Ayuda", d: "Qué significa cada campo" },
  ];

  return (
    <div className="flex flex-col lg:h-screen" style={{ background: T.shell, color: T.tinta, fontFamily: "'Barlow', 'Segoe UI', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@600;700&display=swap');
        input:focus, select:focus, textarea:focus { border-color: ${T.nav} !important; box-shadow: 0 0 0 2px ${T.acento}55; }
        button:focus-visible { outline: 2px solid ${T.acento}; outline-offset: 2px; }
        .fila:hover td { background: #F7F9FB; }
        .celda { border: 1px solid transparent; background: transparent; }
        .celda:hover { border-color: ${T.linea}; }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }`}</style>

      {/* ============ Barra superior ============ */}
      <header className="flex items-center gap-3 px-4 flex-none" style={{ height: 56, background: T.nav, color: "#fff" }}>
        <div className="flex items-center gap-2 mr-2">
          <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true"><path d="M13 2 L24 8 L24 19 L13 25 L2 19 L2 8 Z" fill="none" stroke={T.acento} strokeWidth="2" /><path d="M2 8 L13 14 L24 8 M13 14 L13 25" fill="none" stroke={T.acento} strokeWidth="2" /></svg>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, letterSpacing: "0.01em", whiteSpace: "nowrap" }}>DarnelCube 3D</span>
          <button onClick={() => setSeccion("ayuda")} className="text-xs px-1.5 py-0.5 rounded" style={{ color: T.acento, border: `1px solid ${T.acento}66` }} title={`Versión ${VERSION_COMPLETA}. Clic para ver las novedades.`}>v{VERSION}</button>
        </div>
        <input value={proyecto} onChange={(e) => setProyecto(e.target.value)} aria-label="Nombre del proyecto"
          className="hidden md:block bg-transparent text-sm px-2 py-1 rounded-md outline-none" style={{ color: "#fff", border: "1px solid rgba(255,255,255,.15)", width: 240 }} />
        <div className="flex-1" />
        <span className="hidden lg:block text-xs" style={{ color: "rgba(255,255,255,.55)" }}>{usuario?.email}</span>
        <button onClick={() => setVerEscenarios(true)} className="hidden sm:flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-md" style={{ color: T.navTexto }} title="Guardar este escenario con un nombre, o abrir uno anterior">
          <FolderOpen size={15} />Escenarios
        </button>
        <button onClick={cerrarSesion} className="hidden sm:flex items-center text-sm px-2.5 py-1.5 rounded-md" style={{ color: "rgba(255,255,255,.6)" }} title="Cerrar sesión">Salir</button>
        <button onClick={nuevo} className="hidden sm:flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md" style={{ color: T.navTexto }}><FilePlus size={16} />Nuevo</button>
        <div className="relative">
          <button onClick={() => setMenuEj(!menuEj)} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-md" style={{ color: T.navTexto }} aria-expanded={menuEj}>Ejemplos<ChevronDown size={14} /></button>
          {menuEj && (
            <div className="absolute right-0 mt-1 rounded-lg py-1 z-20 shadow-lg" style={{ background: T.sup, border: `1px solid ${T.linea}`, width: 260 }}>
              {Object.entries(EJEMPLOS).map(([k, e]) => (
                <button key={k} onClick={() => cargarEjemplo(k)} className="block w-full text-left text-sm px-3 py-2 hover:bg-gray-100" style={{ color: T.tinta }}>{e.nombre}</button>
              ))}
            </div>
          )}
        </div>
        <button onClick={recomendar} disabled={calculando || !items.length} className="hidden sm:flex items-center gap-1.5 text-sm px-3 py-2 rounded-md" style={{ border: "1px solid rgba(255,255,255,.2)", color: T.navTexto }} title="Corre el pedido contra cada vehículo de la lista y compara">
            <Truck size={15} />Recomendar vehículo
          </button>
          <button onClick={calcular} disabled={calculando || !items.length} className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-md"
          style={{ background: T.acento, color: T.nav, opacity: calculando ? 0.8 : 1, minWidth: 150, justifyContent: "center" }}>
          {calculando ? <><Loader2 size={16} className="animate-spin" />Estrategia {progreso.i}/{progreso.n}</> : <><Play size={16} />{modoPallet ? "Armar pallet" : "Calcular carga"}</>}
        </button>
        {calculando && (
          <button onClick={cancelarCorrida} aria-label="Cancelar cálculo" title="Cancelar cálculo" className="flex items-center justify-center rounded-md"
            style={{ width: 36, height: 36, color: "#fff", border: "1px solid rgba(255,255,255,.3)", background: "transparent" }}><X size={16} /></button>
        )}
      </header>
      {verEscenarios && (
        <Escenarios
          nombreActual={proyecto}
          estadoParaGuardar={estadoParaGuardar}
          onAbrir={(r) => { aplicarEstado(r.estado); setProyecto(r.nombre); setUltimoGuardado(new Date(r.actualizado)); setAviso(`Se abrió «${r.nombre}».`); }}
          onCerrar={() => setVerEscenarios(false)}
          onAviso={setAviso}
          onError={setError}
        />
      )}

      {/* ============ Navegación: pestañas arriba, para dejarle todo el ancho al contenido ============ */}
      <nav className="flex-none flex items-stretch overflow-x-auto" style={{ background: T.nav, borderTop: "1px solid rgba(255,255,255,.08)" }} aria-label="Secciones">
        {NAV.map(({ id, icono: Icono, t, d }) => {
          const act = seccion === id;
          return (
            <button key={id} onClick={() => setSeccion(id)} aria-current={act ? "page" : undefined}
              className="flex items-center gap-2 px-4 py-2.5 relative flex-none whitespace-nowrap" title={d}
              style={{ color: act ? "#fff" : T.navTexto, background: act ? "rgba(255,255,255,.07)" : "transparent" }}>
              <span className="absolute left-0 right-0 bottom-0" style={{ height: 3, background: act ? T.acento : "transparent" }} />
              <Icono size={16} color={act ? T.acento : T.navTexto} />
              <span className="text-sm font-medium">{t}</span>
              <span className="hidden xl:inline text-xs" style={{ color: act ? "#C9D3E0" : "#7F8EA3" }}>{d}</span>
            </button>
          );
        })}
      </nav>

      <div className="flex flex-col lg:flex-row flex-1 min-h-0">
        {/* ============ Panel de edición ============ */}
        <section className="flex-none lg:w-1/2 xl:w-2/5 lg:overflow-y-auto p-4" style={{ borderRight: `1px solid ${T.linea}` }}>
          <datalist id="categorias-existentes">{[...new Set(maestro.productos.map((p) => p.categoria).filter(Boolean))].map((c) => <option key={c} value={c} />)}</datalist>
          <input ref={inputMaestro} type="file" accept=".xlsx,.xls" className="hidden" onChange={abrirArchivoMaestro} />
          <input ref={inputPedido} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={cargarPedido} />
          <input ref={inputCube} type="file" accept=".xlsx,.xls" className="hidden" onChange={importarCube} />
          <input ref={inputDims} type="file" accept=".xlsx,.xls" className="hidden" onChange={importarDimensiones} />
          <input ref={inputBundle} type="file" accept=".xlsx,.xls" className="hidden" onChange={importarBundle} />
          <input ref={inputVehiculos} type="file" accept=".xlsx,.xls" className="hidden" onChange={importarVehiculos} />
          <input ref={inputConv} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={importarConversiones} />
          {aviso && (
            <div className="flex items-start gap-2 text-sm mb-3 rounded-lg px-3 py-2" style={{ background: "#EAF3EC", color: T.ok }}>
              <CheckCircle2 size={16} className="flex-none mt-0.5" /><span className="flex-1">{aviso}</span>
              <button onClick={() => setAviso("")} aria-label="Cerrar aviso"><X size={14} /></button>
            </div>
          )}

          {seccion === "maestro" && (
            <>
              <h2 className="text-lg font-semibold leading-tight">Maestro de productos</h2>
              <p className="text-xs mb-3" style={{ color: T.suave }}>Un solo archivo con las medidas y reglas de cada SKU. Las cargas se arman con pedidos que solo traen SKU y cantidad.</p>
              <Tarjeta titulo="Archivo maestro">
                <div className="flex items-start gap-2 mb-3 text-sm">
                  <FileSpreadsheet size={18} className="flex-none mt-0.5" color={maestro.origen ? T.ok : T.suave} />
                  <div className="flex-1 min-w-0">
                    {maestro.origen ? (
                      <>
                        <div className="font-medium truncate">{maestro.origen.tipo === "nube" ? "Tu maestro guardado" : maestro.origen.tipo === "carpeta" ? `${maestro.origen.nombre} / ${ARCHIVO_MAESTRO}` : maestro.origen.nombre}</div>
                        <div className="text-xs" style={{ color: maestro.sucio ? T.aviso : T.suave }}>
                          {maestro.sucio ? "Cambios sin guardar" : maestro.guardado ? `Guardado a las ${maestro.guardado.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}` : "Sin cambios"}
                        </div>
                      </>
                    ) : <div style={{ color: T.suave }}>Sin maestro todavía.</div>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => inputMaestro.current?.click()} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md" style={{ border: `1px solid ${T.linea}`, background: T.sup }}><Upload size={15} />Abrir archivo</button>
                  <button onClick={guardarMaestro} disabled={!maestro.productos.length} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md font-semibold"
                    style={{ background: maestro.sucio ? T.acento : T.sup, color: T.nav, border: `1px solid ${maestro.sucio ? T.acento : T.linea}`, opacity: maestro.productos.length ? 1 : 0.5 }}><Save size={15} />Guardar</button>
                </div>
                <Nota titulo="Cómo se guarda">Guardar deja tu maestro en tu cuenta: lo tienes cada vez que entres, desde cualquier computadora. «Descargar copia en Excel», abajo, baja una copia sin cambiar lo guardado.</Nota>
                {maestro.errores?.length > 0 && <p className="text-xs mt-2" style={{ color: T.aviso }}>Revisar: {maestro.errores.slice(0, 4).join(" ")}{maestro.errores.length > 4 ? ` y ${maestro.errores.length - 4} más.` : ""}</p>}
              </Tarjeta>

              {confirmar === "maestro" && (
                <Confirmacion texto={`¿Borrar los ${maestro.productos.length} productos del maestro? El archivo no cambia hasta que presiones Guardar; si no guardas, puedes volver a abrirlo.`} accion="Borrar maestro"
                  onSi={() => { setMaestro((m) => ({ ...m, productos: [], sucio: true })); setConfirmar(null); }} onNo={() => setConfirmar(null)} />
              )}
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 flex items-center gap-1.5 rounded-md px-2" style={{ border: `1px solid ${T.linea}`, background: T.sup }}>
                  <Search size={15} color={T.suave} />
                  <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar SKU o descripción" className="flex-1 py-1.5 text-sm outline-none bg-transparent" />
                </div>
                <button onClick={agregarProducto} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-md" style={{ background: T.nav, color: "#fff" }}><Plus size={15} />Producto</button>
                <button onClick={() => setConfirmar("maestro")} disabled={!maestro.productos.length} className="p-1.5 rounded-md" style={{ border: `1px solid ${T.linea}`, background: T.sup, color: T.error, opacity: maestro.productos.length ? 1 : 0.4 }} aria-label="Borrar todo el maestro" title="Borrar todo el maestro"><Trash2 size={16} /></button>
              </div>
              <div className="rounded-lg overflow-hidden mb-2" style={{ background: T.sup, border: `1px solid ${T.linea}` }}>
                <div className="overflow-auto tabla-ancho" style={{ maxHeight: "calc(100vh - 430px)", minHeight: 160 }}>
                  <table className="w-full text-sm" style={{ minWidth: 640, borderCollapse: "separate", borderSpacing: 0 }}>
                    <thead className="sticky top-0 z-10" style={{ background: "#F3F5F8" }}>
                      <tr className="text-left text-xs" style={{ color: T.suave }}>
                        {["SKU", "Descripción", "Largo", "Ancho", "Alto", "Kg", "Pallet", ""].map((h, i) => <th key={i} className="font-medium px-2 py-2" style={{ borderBottom: `1px solid ${T.linea}` }}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {productosFiltrados.slice(0, 300).map((p) => (
                        <FilaMaestro key={p.pid} p={p} pallets={pallets} abierto={abiertoP === p.pid} onToggle={() => setAbiertoP(abiertoP === p.pid ? null : p.pid)}
                          editar={(k, v) => editarProducto(p.pid, k, v)} quitar={() => quitarProducto(p.pid)} aCarga={() => agregarACarga(p)} />
                      ))}
                    </tbody>
                  </table>
                  {maestro.productos.length === 0 && <p className="text-sm p-4" style={{ color: T.suave }}>Conecta la carpeta o abre un maestro existente. También puedes crear productos aquí y guardar para generar el archivo.</p>}
                  {productosFiltrados.length > 300 && <p className="text-xs p-2" style={{ color: T.suave }}>Mostrando 300 de {productosFiltrados.length}. Usa la búsqueda para encontrar el resto.</p>}
                </div>
              </div>
              <div className="rounded-lg px-3 py-2 mb-2 text-xs flex items-start gap-2" style={{ background: T.sup, border: `1px solid ${T.linea}` }}>
                {leyendo ? <Loader2 size={15} className="flex-none mt-0.5 animate-spin" color={T.suave} /> : <Repeat size={15} className="flex-none mt-0.5" color={maestro.conversiones ? T.ok : T.suave} />}
                <div className="flex-1">
                  <span className="block" style={{ color: T.tinta }}>
                    {leyendo ? leyendo : maestro.conversiones
                      ? `Conversiones de unidad: ${Object.keys(maestro.conversiones).length.toLocaleString("es-MX")} SKUs. Un pedido en otra unidad (ML, PLT, KG…) se convierte a cajas.`
                      : "Sin conversiones de unidad. Impórtalas si algún pedido llega en millares, tarimas o kilos."}
                  </span>
                  <button className="underline" style={{ color: T.suave }} onClick={() => inputConv.current?.click()}>Importar archivo de conversiones</button>
                  {maestro.conversiones && <button className="underline ml-3" style={{ color: T.suave }} onClick={() => { setMaestro((m) => ({ ...m, conversiones: null, sucio: true })); setAviso("Conversiones borradas. Falta presionar Guardar."); }}>Borrar</button>}
                </div>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: T.suave }}>
                <button className="underline" onClick={pasarCargaAlMaestro}>Pasar SKUs de la carga actual al maestro</button>
                <button className="underline" onClick={() => descargarArchivo(libroPlantilla(maestro.productos, vehiculos), "plantilla_carga.xlsx", MIME_XLSX)}>Descargar plantilla de carga</button>
                <button className="underline" onClick={exportarMaestro} disabled={!maestro.productos.length} title="Baja una copia en Excel. Tu maestro en la cuenta no cambia">Descargar copia en Excel</button>
                <button className="underline" onClick={() => descargarArchivo(plantillaDimensiones(maestro.productos), "plantilla_dimensiones.xlsx", MIME_XLSX)} title="Solo SKU, ID producto, descripción y medidas: lo que en el futuro podría venir del ERP">Descargar plantilla de dimensiones</button>
                <button className="underline" onClick={() => inputDims.current?.click()} title="Actualiza SKU, descripción y medidas sin tocar las reglas de estiba ya configuradas">Actualizar dimensiones</button>
                <button className="underline" onClick={() => inputCube.current?.click()}>Importar plantilla de CubeMaster</button>
                <button className="underline" onClick={() => inputBundle.current?.click()} title="Excel con ID Artículo, UM, Rel, Factor, CS/BDL y medidas: enciende y configura el Bundle de los SKUs que ya existen">Importar Bundle (BDL)</button>
                <button className="underline" onClick={() => inputConv.current?.click()}>Importar conversiones de unidad</button>
              </div>
            </>
          )}

          {seccion === "mercancia" && (
            <>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-lg font-semibold leading-tight">Mercancía</h2>
                  <p className="text-xs" style={{ color: T.suave }}>{items.length} SKUs · {totales.cajas.toLocaleString("es-MX")} cajas · <b style={{ color: T.tinta }}>{totales.m3.toLocaleString("es-MX", { maximumFractionDigits: 1 })} m³</b> · {Math.round(totales.kg).toLocaleString("es-MX")} kg</p>
                  {!modoPallet && vehCalc.L > 0 && <p className="text-xs" style={{ color: T.suave }}>Equivale a {(totales.m3 / (vehCalc.L * vehCalc.W * vehCalc.H / 1e9)).toLocaleString("es-MX", { maximumFractionDigits: 2 })} {nombreVeh} llenos al 100%</p>}
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => inputPedido.current?.click()} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md font-medium whitespace-nowrap" style={{ background: T.nav, color: "#fff" }} title="Excel con SKU y cantidad; las medidas salen del maestro"><Upload size={15} />Cargar pedido</button>
                  <button onClick={() => setPegar(!pegar)} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md" style={{ border: `1px solid ${T.linea}`, background: T.sup }} aria-label="Pegar de Excel" title="Pegar de Excel con medidas"><ClipboardPaste size={15} /></button>
                  <button onClick={() => setConfirmar("pedido")} disabled={!items.length} className="flex items-center text-sm px-2 py-1.5 rounded-md" style={{ border: `1px solid ${T.linea}`, background: T.sup, color: T.error, opacity: items.length ? 1 : 0.4 }} aria-label="Vaciar el pedido" title="Vaciar el pedido"><Trash2 size={15} /></button>
                </div>
              </div>
              {confirmar === "pedido" && (
                <Confirmacion texto={`¿Quitar los ${items.length} SKUs de esta carga? El maestro de productos no cambia.`} accion="Vaciar pedido"
                  onSi={() => { setItems([]); setRevision(null); invalidar(); setConfirmar(null); }} onNo={() => setConfirmar(null)} />
              )}
              <RevisionPedido revision={revision} onCerrar={() => setRevision(null)} descargar={descargarRevision} />
              {maestro.productos.length > 0 && (
                <div className="flex gap-2 mb-3">
                  <input list="skus-maestro" value={skuNuevo} onChange={(e) => setSkuNuevo(e.target.value)} onKeyDown={(e) => e.key === "Enter" && skuNuevo && agregarSkuDelMaestro()}
                    placeholder="Agregar SKU del maestro…" className={inp} style={estInp} />
                  <datalist id="skus-maestro">{maestro.productos.slice(0, 2000).map((p) => <option key={p.pid} value={p.sku}>{p.desc}</option>)}</datalist>
                  <button onClick={agregarSkuDelMaestro} disabled={!skuNuevo} className="flex-none text-sm px-3 rounded-md" style={{ border: `1px solid ${T.linea}`, background: T.sup, opacity: skuNuevo ? 1 : 0.5 }}>Agregar</button>
                </div>
              )}
              {pegar && (
                <Tarjeta titulo="Pegar desde Excel" accion={<button onClick={() => setPegar(false)} aria-label="Cerrar"><X size={16} /></button>}>
                  <p className="text-xs mb-2" style={{ color: T.suave }}>Columnas: Nombre, Largo, Ancho, Alto, Peso, Cantidad y, opcionales, Pedido, Entrega y Cajas por pallet. Reemplaza la lista actual.</p>
                  <textarea value={textoPegado} onChange={(e) => setTextoPegado(e.target.value)} rows={5} className={inp} style={estInp} placeholder={"Jeans\t600\t400\t400\t14\t80\tTienda 1\t1\t16"} />
                  <button onClick={importar} className="text-sm mt-2 px-3 py-1.5 rounded-md font-medium" style={{ background: T.nav, color: "#fff" }}>Importar filas</button>
                </Tarjeta>
              )}
              <div className="rounded-lg overflow-hidden" style={{ background: T.sup, border: `1px solid ${T.linea}` }}>
                <div className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs" style={{ color: T.suave, borderBottom: `1px solid ${T.linea}` }}>
                  <span>Toca el nombre de una fila para ver sus reglas de estiba y paletizado.</span>
                  <button onClick={() => setVerMedidas(!verMedidas)} aria-pressed={verMedidas} className="flex-none underline">{verMedidas ? "Ocultar medidas" : "Ver medidas"}</button>
                </div>
                <div className="overflow-auto tabla-ancho" style={{ maxHeight: "calc(100vh - 260px)", minHeight: 200 }}>
                  <table className="w-full text-sm" style={{ minWidth: (verMedidas ? 640 : 400) + (reglas.usarLista ? 60 : 0), borderCollapse: "separate", borderSpacing: 0 }}>
                    <thead className="sticky top-0 z-10" style={{ background: "#F3F5F8" }}>
                      <tr className="text-left text-xs" style={{ color: T.suave }}>
                        {["SKU", ...(verMedidas ? ["Largo", "Ancho", "Alto", "Kg"] : []), "Cajas", "m³", "Entrega", "Pedido", "Destino", ...(reglas.usarLista ? ["Orden"] : []), ""].map((h, i) => (
                          <th key={h || "x"} className="font-medium px-2 py-2 whitespace-nowrap" style={{ borderBottom: `1px solid ${T.linea}`, textAlign: h === "m³" ? "center" : "left", position: "relative", ...(i === 0 ? { position: "sticky", left: 0, background: "#F3F5F8", zIndex: 2, width: anchoSku, minWidth: anchoSku } : {}) }}>
                            {h}
                            {i === 0 && (
                              <span onMouseDown={(e) => {
                                e.preventDefault();
                                const x0 = e.clientX, w0 = anchoSku;
                                const mover = (ev) => setAnchoSku(Math.max(120, Math.min(480, w0 + ev.clientX - x0)));
                                const soltar = () => { window.removeEventListener("mousemove", mover); window.removeEventListener("mouseup", soltar); };
                                window.addEventListener("mousemove", mover); window.addEventListener("mouseup", soltar);
                              }} title="Arrastra para ensanchar la columna"
                                style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 6, cursor: "col-resize" }} />
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, i) => (
                        <FilaItem key={it.id} it={it} color={colores[i]} abierto={abierto === it.id} pallets={pallets} modoPallet={modoPallet} verMedidas={verMedidas}
                          anchoSku={anchoSku}
                          difiere={!it.esBundle && difiereDeMaestro(it)} enMaestro={!it.esBundle && !!buscarSku(mapaMaestro, it.nombre)} aMaestro={() => guardarEnMaestro(it)} deMaestro={() => volverAlMaestro(it)}
                          mover={reglas.usarLista ? (paso) => moverItem(it.id, paso) : null} primera={i === 0} ultima={i === items.length - 1}
                          onToggle={() => setAbierto(abierto === it.id ? null : it.id)} editar={(k, v) => editarItem(it.id, k, v)}
                          quitar={() => { setItems((a) => a.filter((x) => x.id !== it.id)); invalidar(); }} />
                      ))}
                    </tbody>
                  </table>
                </div>
                <button onClick={() => { setItems((a) => [...a, nuevoItem({ nombre: `SKU ${a.length + 1}` })]); invalidar(); }} className="flex items-center gap-1.5 w-full text-sm px-3 py-2" style={{ color: T.suave, borderTop: `1px solid ${T.linea}` }}><Plus size={15} />Agregar SKU</button>
              </div>
            </>
          )}

          {seccion === "vehiculo" && recomendacion && (
            <div className="rounded-lg mb-3" style={{ background: T.sup, border: `1px solid ${T.linea}` }}>
              <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: `1px solid ${T.linea}` }}>
                <p className="flex-1 text-sm font-medium">Qué vehículo conviene</p>
                <button onClick={() => setRecomendacion(null)} aria-label="Cerrar la recomendación"><X size={15} /></button>
              </div>
              <div className="overflow-auto" style={{ maxHeight: 240 }}>
                <table className="w-full text-sm">
                  <thead className="sticky top-0" style={{ background: "#F3F5F8" }}>
                    <tr className="text-left text-xs" style={{ color: T.suave }}>
                      {["Vehículo", "Cuántos", "Ocupación", ...(recomendacion.some((f) => f.flete != null) ? ["Flete"] : []), "Capacidad", ""].map((h) => <th key={h} className="font-medium px-2 py-1.5 whitespace-nowrap">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {recomendacion.map((f, i) => (
                      <tr key={f.id} style={{ borderTop: `1px solid ${T.linea}`, background: vehId === f.id ? T.shell : "transparent" }}>
                        <td className="px-2 py-1.5">{i === 0 && !f.error && <span className="mr-1" style={{ color: T.ok }}>★</span>}{f.nombre}</td>
                        <td className="px-2">{f.error ? "—" : f.vehiculos}{f.sinCargar > 0 && <span style={{ color: T.error }}> +{f.sinCargar} sin acomodar</span>}</td>
                        <td className="px-2">{f.error ? "—" : `${f.ocupacion.toFixed(0)}%`}</td>
                        {recomendacion.some((x) => x.flete != null) && (
                          <td className="px-2 whitespace-nowrap" style={{ fontWeight: i === 0 && f.flete != null ? 600 : 400 }}>
                            {f.flete != null ? f.flete.toLocaleString("es-MX", { style: "currency", currency: f.moneda, maximumFractionDigits: 0 }) : <span style={{ color: T.suave }}>sin tarifa</span>}
                          </td>
                        )}
                        <td className="px-2 text-xs" style={{ color: T.suave }}>{f.error ? "no se pudo calcular" : `${f.m3.toFixed(1)} m³${f.pesoMax ? ` · ${(f.pesoMax / 1000).toFixed(1)} t` : ""}`}</td>
                        <td className="px-2 text-right">{!f.error && <button onClick={() => elegirVehiculo(f.id)} className="text-xs px-2 py-0.5 rounded" style={{ border: `1px solid ${T.linea}` }}>Usar</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-3 pb-2">
                <Nota titulo="Cómo se ordena">
                  {recomendacion.some((f) => f.flete != null)
                    ? "Por el flete más barato entre los que acomodan toda la carga. Se calcula en nivel 1 para que sea rápido; el que elijas se recalcula con tu nivel."
                    : "Por menos unidades y mejor aprovechamiento. Si cargas tarifas de flete abajo, se ordena por costo. Se calcula en nivel 1 para que sea rápido."}
                </Nota>
              </div>
            </div>
          )}
          {seccion === "vehiculo" && <SeccionVehiculo vehiculos={vehiculos} agregarVehiculo={agregarVehiculo} duplicarVehiculo={duplicarVehiculo} quitarVehiculo={quitarVehiculo} editarPallet={editarPallet} editarVeh={editarVeh} elegirVehiculo={elegirVehiculo} modoPallet={modoPallet} palIdx={palIdx} palSel={palSel} pallets={pallets} veh={veh} vehId={vehId}
            onImportarCatalogo={() => inputVehiculos.current?.click()} onDescargarCatalogo={() => descargarArchivo(libroVehiculos(vehiculos), "maestro_vehiculos.xlsx", MIME_XLSX)} onDescargarPlantillaCatalogo={() => descargarArchivo(plantillaVehiculos(), "plantilla_vehiculos.xlsx", MIME_XLSX)} />}

          {seccion === "vehiculo" && !modoPallet && (
            <Tarjeta titulo="Tarifas de flete (opcional)">
              <Nota titulo="Para qué sirven">Si las cargas, «Recomendar vehículo» elige el más barato entre los que acomodan toda la carga, en vez de solo el más lleno. Déjalo vacío y todo sigue igual. El destino se compara con el de las líneas del pedido; vacío = aplica a cualquiera.</Nota>
              {tarifas.map((t, i) => (
                <div key={t.id} className="flex flex-wrap items-end gap-2 mb-2 pb-2" style={{ borderBottom: `1px solid ${T.linea}` }}>
                  <label className="block text-xs" style={{ color: T.suave, width: 150 }}>
                    <span className="block mb-1">Vehículo</span>
                    <select value={t.vehiculo} onChange={(e) => setTarifas((a) => a.map((x, j) => (j === i ? { ...x, vehiculo: e.target.value } : x)))} className={inp} style={estInp}>
                      <option value="">Elige…</option>
                      {vehiculos.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
                    </select>
                  </label>
                  <label className="block text-xs" style={{ color: T.suave, width: 120 }}>
                    <span className="block mb-1">Destino</span>
                    <input value={t.destino} onChange={(e) => setTarifas((a) => a.map((x, j) => (j === i ? { ...x, destino: e.target.value } : x)))} placeholder="Cualquiera" className={inp} style={estInp} />
                  </label>
                  <label className="block text-xs" style={{ color: T.suave, width: 160 }}>
                    <span className="block mb-1">Cómo se cobra</span>
                    <select value={t.metodo} onChange={(e) => setTarifas((a) => a.map((x, j) => (j === i ? { ...x, metodo: e.target.value } : x)))} className={inp} style={estInp}>
                      {METODOS_FLETE.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
                    </select>
                  </label>
                  <label className="block text-xs" style={{ color: T.suave, width: 110 }}>
                    <span className="block mb-1">Tarifa</span>
                    <input type="number" value={t.tarifa} onChange={(e) => setTarifas((a) => a.map((x, j) => (j === i ? { ...x, tarifa: Number(e.target.value) || 0 } : x)))} className={inp} style={estInp} />
                  </label>
                  <button onClick={() => setTarifas((a) => a.filter((_, j) => j !== i))} aria-label="Quitar esta tarifa" style={{ color: T.suave, paddingBottom: 6 }}><Trash2 size={15} /></button>
                </div>
              ))}
              <button onClick={() => setTarifas((a) => [...a, tarifaVacia({ vehiculo: vehId })])} className="flex items-center gap-1 text-xs underline" style={{ color: T.suave }}>
                <Plus size={13} />Agregar tarifa
              </button>

            </Tarjeta>
          )}

          {seccion === "pallets" && <SeccionPaletizado colores={colores} editarItem={editarItem} editarPallet={editarPallet} items={items} nPalletizados={nPalletizados} pallets={pallets} setPallets={setPallets} />}

          {seccion === "herramientas" && <SeccionHerramientas maestro={maestro} vehiculos={vehiculos} pallets={pallets} reglas={reglas} />}

          {seccion === "ayuda" && <SeccionAyuda />}

          {seccion === "reglas" && <SeccionReglas editarRegla={editarRegla} reglas={reglas} />}

          {error && <p className="text-sm mt-2 flex gap-1" style={{ color: T.error }}><AlertTriangle size={16} className="flex-none mt-0.5" />{error}</p>}
        </section>

        {/* ============ Área de trabajo: visor + resultados ============ */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0">
          <div className="relative flex-1" style={{ minHeight: 360, background: T.visor }}>
            <Visor veh={visor.veh} base={visor.base} cajas={visor.cajas} pallets={res?.pallets || []} paso={res ? paso : 0} colores={colores} formas={formas} resaltado={resaltado} camara={camara} api={apiVisor} />
            <div className="absolute top-3 left-3 right-3 flex flex-wrap items-center gap-2 pointer-events-none">
              {res && !palVista && res.contenedores.map((c, i) => (
                <button key={i} onClick={() => verVehiculo(i)} className="pointer-events-auto text-xs px-2.5 py-1 rounded-full font-medium shadow-sm"
                  style={{ background: i === sel ? T.nav : "rgba(255,255,255,.92)", color: i === sel ? "#fff" : T.tinta }}>
                  {modoPallet ? "Pallet" : "Vehículo"} {i + 1} · {reporte.contenedores[i].ocupacion.toFixed(0)}% vol{reporte.contenedores[i].utilPeso != null ? ` · ${reporte.contenedores[i].utilPeso.toFixed(0)}% peso` : ""}
                </button>
              ))}
              {palVista && <>
                <button onClick={() => verVehiculo(sel)} className="pointer-events-auto text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: T.nav, color: "#fff" }}>← Vehículo {sel + 1}</button>
                <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: "rgba(255,255,255,.92)" }}>Armado de: {palVista.nombre}</span>
              </>}
              <div className="flex-1" />
              <div className="relative pointer-events-auto">
                <button onClick={() => setMenuColor(!menuColor)} aria-expanded={menuColor} className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full shadow-sm" style={{ background: "rgba(255,255,255,.92)" }}>
                  <span className="flex">{colores.slice(0, 5).map((c, i) => <span key={i} style={{ width: 8, height: 8, background: c, borderRadius: 99, marginLeft: i ? -2 : 0, border: "1px solid #fff" }} />)}</span>
                  Colores<ChevronDown size={12} />
                </button>
                {menuColor && (
                  <div className="absolute right-0 mt-1 rounded-lg p-2 z-20 shadow-lg" style={{ background: T.sup, border: `1px solid ${T.linea}`, width: 270 }}>
                    {Object.entries(PALETAS).map(([k, p]) => {
                      const muestra = generarColores(10, k);
                      return (
                        <button key={k} onClick={() => { setPaleta(k); setMenuColor(false); }} aria-pressed={paleta === k} className="w-full text-left rounded-md px-2 py-1.5 mb-0.5"
                          style={{ background: paleta === k ? T.shell : "transparent", border: `1px solid ${paleta === k ? T.linea : "transparent"}` }}>
                          <span className="block text-xs font-medium mb-1" style={{ color: T.tinta }}>{p.nombre}</span>
                          <span className="flex gap-0.5">{muestra.map((c, i) => <span key={i} style={{ flex: 1, height: 10, background: c, borderRadius: 2 }} />)}</span>
                        </button>
                      );
                    })}
                    <div className="flex items-center gap-2 px-2 pt-2 mt-1 text-xs" style={{ borderTop: `1px solid ${T.linea}`, color: T.suave }}>
                      <span style={{ width: 14, height: 10, background: "#8B5A2B", borderRadius: 2 }} />Las tarimas siempre son café
                    </div>
                    {hayPersonalizados && (
                      <button onClick={() => { setItems((a) => a.map((it) => ({ ...it, color: null }))); setMenuColor(false); }} className="w-full text-left text-xs px-2 py-1.5 mt-1 underline" style={{ color: T.suave }}>
                        Quitar colores personalizados
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="pointer-events-auto flex rounded-full overflow-hidden shadow-sm" style={{ background: "rgba(255,255,255,.92)" }}>
                {[["iso", "3D"], ["frente", "Puerta"], ["lado", "Lado"], ["arriba", "Planta"]].map(([k, t]) => (
                  <button key={k} onClick={() => setCamara({ tipo: k, n: Date.now() })} className="text-xs px-2.5 py-1">{t}</button>
                ))}
              </div>
            </div>
            {!res && !calculando && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-sm px-4 py-2 rounded-lg" style={{ background: "rgba(255,255,255,.9)", color: T.suave }}>Configura la carga y presiona {modoPallet ? "Armar pallet" : "Calcular carga"}</p>
              </div>
            )}
            {res && visor.total > 0 && (
              <div className="absolute bottom-3 left-3 right-3 flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,.92)" }}>
                <span className="text-xs whitespace-nowrap" style={{ color: T.suave }}>{palVista ? "Armado" : "Carga"} {paso}/{visor.total}</span>
                <input type="range" min={0} max={visor.total} value={paso} onChange={(e) => setPaso(Number(e.target.value))} className="flex-1" aria-label="Secuencia" style={{ accentColor: T.nav }} />
              </div>
            )}
          </div>

          <PanelResultados oculto={panelOculto} setOculto={setPanelOculto} editarOris={editarOrisDeLinea} colores={colores} descargarInstructivo={descargarInstructivo} descargarInstructivoCompleto={descargarInstructivoCompleto} descargarResultados={descargarResultados} generando={generando} modoPallet={modoPallet} palVista={palVista} pestana={pestana} reporte={reporte} res={res} resaltado={resaltado} sel={sel} setPestana={setPestana} setResaltado={setResaltado} stats={stats} verPallet={verPallet} vista={vista}
            espacios={espacios} calculandoEspacios={calculandoEspacios} completarEspacios={completarEspacios} aplicarRelleno={aplicarRelleno}
            ultimoCasiVacio={ultimoCasiVacio} consolidar={consolidar} intentarConsolidar={intentarConsolidar} aplicarConsolidacion={aplicarConsolidacion} aplicarReduccionConsolidar={aplicarReduccionConsolidar} />
        </main>
      </div>
    </div>
  );
}
