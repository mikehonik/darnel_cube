// ================= Visor 3D =================
// Dibuja el vehículo o la tarima con sus cajas y pallets en Three.js. Expone por `api` la captura de imágenes por paso.
import { useEffect, useRef } from "react";
import * as THREE from "three";

const GEO = new THREE.BoxGeometry(1, 1, 1);
const EDG = new THREE.EdgesGeometry(GEO);
// Cilindro de radio y alto 1, de pie (eje Y); se escala para barriles y, girado, para tubos
const CIL = new THREE.CylinderGeometry(0.5, 0.5, 1, 20);
const CIL_EDG = new THREE.EdgesGeometry(new THREE.CylinderGeometry(0.5, 0.5, 1, 20, 1, false));
const MADERA = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
const MADERA_BORDE = new THREE.LineBasicMaterial({ color: 0x4e3016 });
const VISTAS = { iso: [-0.85, 1.05], frente: [0, 1.5], lado: [Math.PI / 2, 1.5], arriba: [Math.PI / 2, 0.08] };

export function Visor({ veh, base, cajas, pallets, paso, colores, formas, resaltado, camara, api }) {
  const montaje = useRef(null);
  const ref3 = useRef({});
  useEffect(() => {
    const el = montaje.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0xe7ecf1);
    el.appendChild(renderer.domElement);
    const escena = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(36, 1, 0.05, 500);
    escena.add(new THREE.AmbientLight(0xffffff, 0.72));
    const luz = new THREE.DirectionalLight(0xffffff, 0.5);
    luz.position.set(10, 25, 18);
    escena.add(luz);
    const grupo = new THREE.Group();
    escena.add(grupo);
    const orb = { theta: -0.85, phi: 1.05, r: 18, target: new THREE.Vector3() };
    const ajustar = () => { const w = el.clientWidth, h = el.clientHeight; if (!w || !h) return; renderer.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix(); };
    ajustar();
    const ro = new ResizeObserver(ajustar);
    ro.observe(el);
    let arrastre = null;
    const cv = renderer.domElement;
    cv.style.touchAction = "none";
    cv.addEventListener("pointerdown", (e) => { arrastre = { x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener("pointermove", (e) => {
      if (!arrastre) return;
      orb.theta += (e.clientX - arrastre.x) * 0.008;
      orb.phi = Math.min(1.55, Math.max(0.05, orb.phi - (e.clientY - arrastre.y) * 0.008));
      arrastre = { x: e.clientX, y: e.clientY };
    });
    cv.addEventListener("pointerup", () => { arrastre = null; });
    cv.addEventListener("wheel", (e) => { e.preventDefault(); orb.r = Math.min(90, Math.max(1, orb.r * (1 + Math.sign(e.deltaY) * 0.08))); }, { passive: false });
    let raf;
    const ciclo = () => {
      cam.position.set(orb.target.x + orb.r * Math.sin(orb.phi) * Math.cos(orb.theta), orb.target.y + orb.r * Math.cos(orb.phi), orb.target.z + orb.r * Math.sin(orb.phi) * Math.sin(orb.theta));
      cam.lookAt(orb.target);
      renderer.render(escena, cam);
      raf = requestAnimationFrame(ciclo);
    };
    ciclo();
    const fijarCamara = () => { cam.position.set(orb.target.x + orb.r * Math.sin(orb.phi) * Math.cos(orb.theta), orb.target.y + orb.r * Math.cos(orb.phi), orb.target.z + orb.r * Math.sin(orb.phi) * Math.sin(orb.theta)); cam.lookAt(orb.target); };
    ref3.current = { grupo, orb, renderer, escena, cam, fijarCamara };
    return () => { cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose(); el.removeChild(cv); };
  }, []);

  useEffect(() => {
    const { orb } = ref3.current;
    if (!orb) return;
    orb.target.set(veh.L / 2000, veh.H / 2000, veh.W / 2000);
    orb.r = (Math.max(veh.L, veh.H * 1.4) / 1000) * 1.2 + (veh.L < 3000 ? 1.5 : 3.5);
  }, [veh.L, veh.W, veh.H]);

  useEffect(() => {
    const { orb } = ref3.current;
    if (!orb || !camara) return;
    const [t, p] = VISTAS[camara.tipo];
    orb.theta = t; orb.phi = p;
  }, [camara]);

  useEffect(() => {
    if (!api) return;
    api.current = {
      // Devuelve imágenes (JPEG) de la carga en los pasos indicados, en vista 3D
      capturar: (pasos) => {
        const r = ref3.current; if (!r.dibujar) return [];
        const guard = { theta: r.orb.theta, phi: r.orb.phi }, imgs = [];
        r.orb.theta = VISTAS.iso[0]; r.orb.phi = VISTAS.iso[1];
        pasos.forEach((p) => { r.dibujar(p, true); r.fijarCamara(); r.renderer.render(r.escena, r.cam); imgs.push(r.renderer.domElement.toDataURL("image/jpeg", 0.82)); });
        r.orb.theta = guard.theta; r.orb.phi = guard.phi; r.dibujar(r.pasoActual, false);
        return imgs;
      },
    };
  }, [api]);

  useEffect(() => {
    const { grupo } = ref3.current;
    if (!grupo) return;
    const dibujar = (pasoN, limpio) => {
    while (grupo.children.length) grupo.remove(grupo.children[0]);
    const s = (v) => v / 1000;
    const mats = {};
    const borde = new THREE.LineBasicMaterial({ color: 0x16202c, transparent: true, opacity: 0.32 });
    const tenue = new THREE.MeshLambertMaterial({ color: 0x9aa7b2, transparent: true, opacity: 0.12, depthWrite: false });
    const bloque = (x, y, z, l, w, h, mat, lineas) => {
      const m = new THREE.Mesh(GEO, mat);
      m.scale.set(s(l) * 0.995, s(h) * 0.995, s(w) * 0.995);
      m.position.set(s(x + l / 2), s(z + h / 2), s(y + w / 2));
      grupo.add(m);
      if (lineas) { const e = new THREE.LineSegments(EDG, lineas); e.scale.copy(m.scale); e.position.copy(m.position); grupo.add(e); }
    };
    const tarima = (x, y, z, l, w, esp) => {
      const tabla = Math.min(22, esp * 0.2), n = 7, ancho = w / (n + (n - 1) * 0.45), hueco = ancho * 0.45;
      for (let i = 0; i < n; i++) bloque(x, y + i * (ancho + hueco), z + esp - tabla, l, ancho, tabla, MADERA, MADERA_BORDE);
      const ap = Math.min(120, w * 0.12);
      [0, (w - ap) / 2, w - ap].forEach((py) => bloque(x, y + py, z, l, ap, esp - tabla, MADERA, MADERA_BORDE));
    };
    // Cilindro dentro de su caja envolvente: de pie (barril) o acostado a lo largo (tubo)
    const cilindro = (x, y, z, l, w, h, mat, lineas) => {
      const acostado = l > w && l > h;                 // el eje más largo manda: si es el largo, va acostado
      const d = acostado ? Math.min(w, h) : Math.min(l, w), alto = acostado ? l : h;
      const m = new THREE.Mesh(CIL, mat);
      m.scale.set(s(d) * 0.99, s(alto) * 0.99, s(d) * 0.99);
      m.position.set(s(x + l / 2), s(z + h / 2), s(y + w / 2));
      if (acostado) m.rotation.z = Math.PI / 2;
      grupo.add(m);
      if (lineas) { const e = new THREE.LineSegments(CIL_EDG, lineas); e.scale.copy(m.scale); e.position.copy(m.position); e.rotation.copy(m.rotation); grupo.add(e); }
    };
    const caja = (x, y, z, l, w, h, idx, destacada) => {
      const redonda = formas && (formas[idx] === "barril" || formas[idx] === "tubo");
      const pinta = redonda ? cilindro : bloque;
      if (resaltado !== null && idx !== resaltado) { pinta(x, y, z, l, w, h, tenue, null); return; }
      const key = destacada ? "hl" : idx;
      if (!mats[key]) mats[key] = new THREE.MeshLambertMaterial({ color: destacada ? 0xffffff : new THREE.Color(colores[idx] || "#888") });
      pinta(x, y, z, l, w, h, mats[key], borde);
    };
    const marco = new THREE.LineSegments(EDG, new THREE.LineBasicMaterial({ color: 0x14213d }));
    marco.scale.set(s(veh.L), s(veh.H), s(veh.W));
    marco.position.set(s(veh.L) / 2, s(veh.H) / 2, s(veh.W) / 2);
    grupo.add(marco);
    if (base) {
      tarima(base.x, base.y, -base.esp, base.l, base.w, base.esp);
      if (base.x > 0 || base.y > 0) {
        // Límite de sobresaliente: rectángulo punteado rojo a nivel de la tarima
        const lim = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(1, 1)), new THREE.LineDashedMaterial({ color: 0xb3261e, dashSize: 0.04, gapSize: 0.03 }));
        lim.rotation.x = -Math.PI / 2; lim.scale.set(s(veh.L), s(veh.W), 1); lim.position.set(s(veh.L) / 2, 0.002, s(veh.W) / 2); lim.computeLineDistances(); grupo.add(lim);
      }
    }
    else {
      const piso = new THREE.Mesh(GEO, new THREE.MeshLambertMaterial({ color: 0xc3ccd5 }));
      piso.scale.set(s(veh.L), 0.02, s(veh.W));
      piso.position.set(s(veh.L) / 2, -0.01, s(veh.W) / 2);
      grupo.add(piso);
    }
    cajas.slice(0, pasoN).forEach((c, i) => {
      const ultima = !limpio && i === pasoN - 1 && pasoN < cajas.length;
      if (c.pal >= 0 && pallets[c.pal]) {
        const d = pallets[c.pal];
        if (c.rot) tarima(c.x + d.baseY, c.y + d.L - d.baseX - d.palL, c.z, d.palW, d.palL, d.esp);
        else tarima(c.x + d.baseX, c.y + d.baseY, c.z, d.palL, d.palW, d.esp);
        d.cajas.forEach((k) => {
          let x = k.x, y = k.y, l = k.l, w = k.w;
          if (c.rot) { x = k.y; y = d.L - (k.x + k.l); l = k.w; w = k.l; }
          caja(c.x + x, c.y + y, c.z + d.esp + k.z, l, w, k.h, k.idx, ultima);
        });
      } else caja(c.x, c.y, c.z, c.l, c.w, c.h, c.idx, ultima);
    });
    };
    ref3.current.dibujar = dibujar; ref3.current.pasoActual = paso;
    dibujar(paso, false);
  }, [veh, base, cajas, pallets, paso, colores, formas, resaltado]);

  return <div ref={montaje} className="absolute inset-0" style={{ cursor: "grab" }} />;
}
