// ================= Controles =================
// Piezas chicas de formulario y tarjetas que usa toda la interfaz.
import { T } from "./tema.js";

export const inp = "w-full rounded-md px-2 py-1.5 text-sm border outline-none";
export const estInp = { borderColor: T.linea, background: T.sup, color: T.tinta };
export function Num({ etiqueta, valor, onChange, ayuda }) {
  return (
    <label className="block text-xs" style={{ color: T.suave }} title={ayuda}>
      <span className="block mb-1">{etiqueta}</span>
      <input type="number" value={valor} onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))} className={inp} style={estInp} />
    </label>
  );
}
export function Sel({ etiqueta, valor, onChange, opciones }) {
  return (
    <label className="block text-xs" style={{ color: T.suave }}>
      <span className="block mb-1">{etiqueta}</span>
      <select value={valor} onChange={(e) => onChange(e.target.value)} className={inp} style={estInp}>
        {opciones.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
    </label>
  );
}
export function Interruptor({ etiqueta, detalle, valor, onChange }) {
  return (
    <button type="button" role="switch" aria-checked={valor} onClick={() => onChange(!valor)} className="w-full flex items-start justify-between gap-3 py-2 text-left">
      <span>
        <span className="block text-sm" style={{ color: T.tinta }}>{etiqueta}</span>
        {detalle && <span className="block text-xs" style={{ color: T.suave }}>{detalle}</span>}
      </span>
      <span className="relative flex-none mt-0.5 rounded-full" style={{ width: 34, height: 20, background: valor ? T.nav : T.linea, transition: "background .15s" }}>
        <span className="absolute rounded-full" style={{ width: 16, height: 16, top: 2, left: valor ? 16 : 2, background: valor ? T.acento : "#fff", transition: "left .15s" }} />
      </span>
    </button>
  );
}
export function Tarjeta({ titulo, children, accion }) {
  return (
    <div className="rounded-lg p-4 mb-3" style={{ background: T.sup, border: `1px solid ${T.linea}` }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">{titulo}</h3>
        {accion}
      </div>
      {children}
    </div>
  );
}
export function Dato({ t, v, s }) {
  return (
    <div className="rounded-lg px-3 py-2" style={{ background: T.shell }}>
      <div className="text-xs" style={{ color: T.suave }}>{t}</div>
      <div className="text-lg font-semibold leading-tight">{v}</div>
      {s && <div className="text-xs" style={{ color: T.suave }}>{s}</div>}
    </div>
  );
}

export function Confirmacion({ texto, accion, onSi, onNo }) {
  return (
    <div className="rounded-lg p-3 mb-3 text-sm" style={{ background: "#FDECEA", border: `1px solid #F3C4BE` }} role="alertdialog">
      <p className="mb-2">{texto}</p>
      <div className="flex gap-2">
        <button onClick={onSi} className="px-3 py-1 rounded-md font-medium" style={{ background: T.error, color: "#fff" }}>{accion}</button>
        <button onClick={onNo} className="px-3 py-1 rounded-md" style={{ border: `1px solid ${T.linea}`, background: "#fff" }}>Cancelar</button>
      </div>
    </div>
  );
}
