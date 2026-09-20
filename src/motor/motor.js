// ===== Motor Estiba 3D v0.8 · construcción por bloques sobre espacios libres máximos + GRASP =====
var ORI = [
  function (L, W, H) { return [L, W, H]; }, function (L, W, H) { return [W, L, H]; },
  function (L, W, H) { return [L, H, W]; }, function (L, W, H) { return [H, L, W]; },
  function (L, W, H) { return [W, H, L]; }, function (L, W, H) { return [H, W, L]; }
];
function orientacionesDe(it) {
  var r = [], vistos = {};
  for (var k = 0; k < 6; k++) {
    if (!it.oris[k]) continue;
    var d = ORI[k](it.L, it.W, it.H), key = d.join("x");
    if (vistos[key] !== undefined) continue;
    vistos[key] = 1;
    r.push({ d: d, k: k, volteo: k >= 2 });
  }
  return r;
}
function rng(seed) { var s = seed >>> 0; return function () { s += 0x6D2B79F5; var t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------- Llenado de UN contenedor ----------
// tipos: [{k, idx, it, oris, g, fase, rem, pal}] (rem se descuenta)
// Compresión bajo carga: una caja con otra encima se aplasta un porcentaje. La de hasta arriba conserva su altura.
var altoComprimido = function (it, h) { return it.compresion > 0 ? Math.max(1, h * (1 - it.compresion / 100)) : h; };
// Incremento real de una pila por cada pieza extra. Con anidado (barriles que entran uno dentro de otro,
// tejas con cresta) la pieza de arriba solo asoma unos milímetros; el anidado solo aplica de pie.
var incrPila = function (it, h) {
  if (it.anidado > 0 && Math.abs(h - it.H) < 0.01) return Math.max(1, Math.min(it.anidado, h));
  return altoComprimido(it, h);
};
// Alturas de cada pieza de una pila, de abajo hacia arriba. La compresión es escalonada: una caja
// se aplasta según lo que lleva encima, no todas por igual. La de hasta arriba conserva su altura
// completa y la de abajo aguanta toda la carga, así que es la que más cede. Con anidado no aplica:
// ahí la altura la manda la geometría de las piezas, no el peso.
var alturasPila = function (it, h, n) {
  var anidado = it.anidado > 0 && Math.abs(h - it.H) < 0.01;
  var alturas = [];
  for (var i = 0; i < n; i++) {
    if (anidado) { alturas.push(i === n - 1 ? h : Math.max(1, Math.min(it.anidado, h))); continue; }
    if (!(it.compresion > 0) || n < 2) { alturas.push(h); continue; }
    var encima = (n - 1 - i) / (n - 1);                 // 1 abajo del todo, 0 la de hasta arriba
    alturas.push(Math.max(1, h * (1 - (it.compresion / 100) * encima)));
  }
  return alturas;
};
var altoPila = function (it, h, n) {
  var a = alturasPila(it, h, n), t = 0;
  for (var i = 0; i < a.length; i++) t += a[i];
  return t;
};
// Cuántas piezas caben en una altura disponible, con la compresión escalonada ya considerada.
var cabenEnAlto = function (it, h, sz) {
  if (h > sz) return 0;
  var n = 1;
  while (n < 400 && altoPila(it, h, n + 1) <= sz + 1e-9) n++;
  return n;
};
var tope = function (it, h) { return it.anidado > 0 && Math.abs(h - it.H) < 0.01 && it.maxAnidado > 0 ? it.maxAnidado : 0; };

function llenarContenedor(tipos, veh, reglas, op) {
  var L = veh.L, W = veh.W, H = veh.H, volV = L * W * H;
  var cajas = [], B = Math.max(200, Math.ceil(L / 60)), NB = Math.ceil(L / B) + 2, buckets = [], sello = 0, marca = [];
  for (var i = 0; i < NB; i++) buckets.push([]);
  var peso = 0, vol = 0, skus = {}, nSkus = 0;
  var cargaMax = veh.maxKg > 0 && reglas.limitarPeso ? veh.maxKg - (veh.tara || 0) : Infinity;
  var espacios = [{ x: 0, y: 0, z: 0, X: L, Y: W, Z: H }];
  var fases = [], vistasF = {};
  tipos.forEach(function (t) { if (t.rem > 0 && vistasF[t.fase] === undefined) { vistasF[t.fase] = 1; fases.push(t.fase); } });
  fases.sort(function (a, b) { return a - b; });
  var usaFrontera = reglas.usarOrden || reglas.agrupar;
  var frontera = 0, ultimoTipo = null, rand = op.rand;

  var cercanas = function (x0, x1) {
    var r = [], b0 = Math.max(0, Math.floor(x0 / B)), b1 = Math.min(NB - 1, Math.floor((x1 - 1) / B));
    sello++;
    for (var b = b0; b <= b1; b++) { var ls = buckets[b]; for (var j = 0; j < ls.length; j++) { var q = ls[j]; if (marca[q] !== sello) { marca[q] = sello; r.push(q); } } }
    return r;
  };
  var agregarCaja = function (c) {
    var n = cajas.length; cajas.push(c);
    var b0 = Math.max(0, Math.floor(c.x / B)), b1 = Math.min(NB - 1, Math.floor((c.x + c.l - 1) / B));
    for (var b = b0; b <= b1; b++) buckets[b].push(n);
  };
  // Apoyo de un rectángulo a altura z: devuelve null si viola reglas, o {frac, apoyos:[{j,a}], nivel}
  var apoyoDe = function (x, y, z, l, w, it, k) {
    if (z < 0.5) {
      if (!veh.deck) return { frac: 1, apoyos: [], nivel: 1 };
      var dx = Math.min(x + l, veh.deck.X) - Math.max(x, veh.deck.x), dy = Math.min(y + w, veh.deck.Y) - Math.max(y, veh.deck.y);
      return { frac: dx > 0 && dy > 0 ? dx * dy / (l * w) : 0, apoyos: [], nivel: 1 };
    }
    var cs = cercanas(x, x + l), area = 0, apoyos = [], nivel = 1;
    for (var i = 0; i < cs.length; i++) {
      var s = cajas[cs[i]];
      if (Math.abs(s.z + s.h - z) > 0.5) continue;
      var ox = Math.min(x + l, s.x + s.l) - Math.max(x, s.x), oy = Math.min(y + w, s.y + s.w) - Math.max(y, s.y);
      if (ox <= 0 || oy <= 0) continue;
      var sit = s.it;
      if (sit.esPallet) { if (it.esPallet ? !sit.aceptaPallet : !sit.aceptaCajas) return null; }
      else { if (it.esPallet || !sit.soportaEncima) return null; }
      if (reglas.apilamiento === "valorMayorAbajo" && sit.valorApilar < it.valorApilar) return null;
      if (reglas.apilamiento === "mismoValor" && sit.valorApilar !== it.valorApilar) return null;
      if (reglas.apilamiento === "masPesadoAbajo" && sit.peso < it.peso) return null;
      if (reglas.apilamiento === "mismaHuella" && (s.l !== l || s.w !== w || s.x !== x || s.y !== y)) return null;
      // Categoría: solo se apila sobre productos de la misma categoría (por ejemplo, tejas sobre tejas).
      // Sin categoría en alguno de los dos, no se permite: evita que algo sin clasificar reciba carga por accidente.
      // La misma pieza siempre puede apoyarse sobre otra igual (torre del mismo SKU), igual que las
      // demás reglas de apilamiento. La categoría solo restringe el apoyo entre SKUs distintos.
      if (reglas.apilamiento === "mismaCategoria" && s.k !== k && (!sit.categoria || !it.categoria || String(sit.categoria).trim().toLowerCase() !== String(it.categoria).trim().toLowerCase())) return null;
      area += ox * oy; apoyos.push({ j: cs[i], a: ox * oy });
      if (s.k === k && s.nivel + 1 > nivel) nivel = s.nivel + 1;
    }
    return { frac: area / (l * w), apoyos: apoyos, nivel: nivel, area: area };
  };
  // Verifica resistencia (peso máx. encima) al agregar 'carga' sobre los apoyos; devuelve mapa de cargas o null
  var cargasOk = function (apoyos, area, carga, extra) {
    var cola = [];
    for (var i = 0; i < apoyos.length; i++) cola.push([apoyos[i].j, carga * apoyos[i].a / area]);
    while (cola.length) {
      var e = cola.pop(), bj = cajas[e[0]];
      extra[e[0]] = (extra[e[0]] || 0) + e[1];
      if (bj.it.pesoMaxEncima > 0 && bj.carga + extra[e[0]] > bj.it.pesoMaxEncima + 1e-9) return false;
      for (var q = 0; q < bj.apoyos.length; q++) cola.push([bj.apoyos[q].j, e[1] * bj.apoyos[q].f]);
    }
    return true;
  };

  var intentarBloque = function (bl, ax, ay, az) {
    var t = bl.t, it = t.it, o = bl.o, l = o.d[0], w = o.d[1], h = o.d[2], alturas = alturasPila(it, h, bl.nz);
    var extra = {}, bases = [];
    for (var ix = 0; ix < bl.nx; ix++) for (var iy = 0; iy < bl.ny; iy++) {
      var x = ax + ix * l, y = ay + iy * w, a = apoyoDe(x, y, az, l, w, it, t.k);
      if (!a || a.frac < (it.esPallet ? Math.max(reglas.soporteMin, 0.9) : reglas.soporteMin) - 1e-9) return false;
      if (it.maxNiveles > 0 && a.nivel - 1 + bl.nz > it.maxNiveles) return false;
      if (a.apoyos.length && !cargasOk(a.apoyos, a.area, it.peso * bl.nz, extra)) return false;
      bases.push({ x: x, y: y, a: a });
    }
    for (var kx in extra) cajas[kx].carga += extra[kx];
    for (var bi = 0; bi < bases.length; bi++) {
      var bs = bases[bi], abajo = -1;
      var zz = az;
      for (var iz = 0; iz < bl.nz; iz++) {
        var c = { x: bs.x, y: bs.y, z: zz, l: l, w: w, h: alturas[iz], idx: t.idx, k: t.k, pal: t.pal, it: it, ori: o.k + 1,
          nivel: bs.a.nivel + iz, carga: it.peso * (bl.nz - 1 - iz),
          apoyos: iz === 0 ? bs.a.apoyos.map(function (s) { return { j: s.j, f: s.a / bs.a.area }; }) : [{ j: abajo, f: 1 }] };
        zz += alturas[iz];
        abajo = cajas.length; agregarCaja(c);
      }
    }
    return true;
  };

  var actualizarEspacios = function (bx, by, bz, BX, BY, BZ, minDim) {
    var nuevos = [];
    for (var i = 0; i < espacios.length; i++) {
      var s = espacios[i];
      if (s.X <= bx || BX <= s.x || s.Y <= by || BY <= s.y || s.Z <= bz || BZ <= s.z) { nuevos.push(s); continue; }
      if (bx > s.x) nuevos.push({ x: s.x, y: s.y, z: s.z, X: bx, Y: s.Y, Z: s.Z });
      if (BX < s.X) nuevos.push({ x: BX, y: s.y, z: s.z, X: s.X, Y: s.Y, Z: s.Z });
      if (by > s.y) nuevos.push({ x: s.x, y: s.y, z: s.z, X: s.X, Y: by, Z: s.Z });
      if (BY < s.Y) nuevos.push({ x: s.x, y: BY, z: s.z, X: s.X, Y: s.Y, Z: s.Z });
      if (bz > s.z) nuevos.push({ x: s.x, y: s.y, z: s.z, X: s.X, Y: s.Y, Z: bz });
      if (BZ < s.Z) nuevos.push({ x: s.x, y: s.y, z: BZ, X: s.X, Y: s.Y, Z: s.Z });
    }
    // descartar pequeños y contenidos en otros
    nuevos = nuevos.filter(function (s) { return s.X - s.x >= minDim && s.Y - s.y >= minDim && s.Z - s.z >= minDim; });
    nuevos.sort(function (a, b) { return (b.X - b.x) * (b.Y - b.y) * (b.Z - b.z) - (a.X - a.x) * (a.Y - a.y) * (a.Z - a.z); });
    var res = [];
    for (var p = 0; p < nuevos.length; p++) {
      var s2 = nuevos[p], dentro = false;
      for (var q = 0; q < res.length; q++) { var r = res[q]; if (s2.x >= r.x && s2.y >= r.y && s2.z >= r.z && s2.X <= r.X && s2.Y <= r.Y && s2.Z <= r.Z) { dentro = true; break; } }
      if (!dentro) res.push(s2);
    }
    espacios = res;
  };

  var ordenEsp = op.ordenEsp;
  for (var fi = 0; fi < fases.length; fi++) {
    var fase = fases[fi];
    if (usaFrontera && fi > 0) {
      var maxX = 0;
      for (var cf = 0; cf < cajas.length; cf++) if (cajas[cf].x > maxX) maxX = cajas[cf].x;
      // Flexible: deja que la siguiente entrega se meta un poco en la zona anterior para no desperdiciar el escalón
      frontera = Math.max(0, maxX - (reglas.rigor === "flexible" ? veh.L * 0.12 : 0));
    }
    var muertos = {};
    var guard = 0;
    while (guard++ < 20000) {
      var eleg = tipos.filter(function (t) { return t.rem > 0 && t.fase === fase; });
      if (!eleg.length) break;
      var minDim = Infinity;
      tipos.forEach(function (t) { if (t.rem > 0) t.oris.forEach(function (o) { var m = Math.min(o.d[0], o.d[1], o.d[2]); if (m < minDim) minDim = m; }); });
      // espacios candidatos ordenados
      var cand = [];
      for (var e = 0; e < espacios.length; e++) {
        var s = espacios[e], x0 = usaFrontera ? Math.max(s.x, frontera) : s.x;
        if (s.X - x0 < minDim || muertos[s.x + "," + s.y + "," + s.z + "," + s.X + "," + s.Y + "," + s.Z]) continue;
        cand.push({ s: s, x: x0 });
      }
      if (!cand.length) break;
      cand.sort(ordenEsp);
      var colocado = false;
      for (var ci = 0; ci < cand.length && !colocado; ci++) {
        var sp = cand[ci], s = sp.s, sx = s.X - sp.x, sy = s.Y - s.y, sz = s.Z - s.z;
        var bloques = [];
        for (var ti = 0; ti < eleg.length; ti++) {
          var t = eleg[ti], it = t.it;
          if (it.piso === "soloPiso" && s.z > 0) continue;
          if (it.piso === "noPiso" && s.z === 0) continue;
          var capPeso = it.peso > 0 ? Math.floor((cargaMax - peso) / it.peso + 1e-9) : Infinity;
          var cap = Math.min(t.rem, capPeso);
          if (veh.maxPiezas > 0) cap = Math.min(cap, veh.maxPiezas - cajas.length);
          if (veh.maxVolPct > 0) cap = Math.min(cap, Math.floor((volV * veh.maxVolPct / 100 - vol) / (it.L * it.W * it.H) + 1e-9));
          if (cap <= 0) continue;
          if (veh.maxSkus > 0 && !skus[t.k] && nSkus >= veh.maxSkus) continue;
          for (var oi = 0; oi < t.oris.length; oi++) {
            var o = t.oris[oi], l = o.d[0], w = o.d[1], h = o.d[2];
            if (l > sx || w > sy || h > sz) continue;
            if (s.z === 0 && o.volteo && !it.volteoPiso) continue;
            var ex0 = sp.x, ey0 = s.y, esx = sx, esy = sy;
            if (veh.deck && s.z === 0) {
              // sobre la tarima: el bloque se limita a la cubierta más el sobresaliente que permite el apoyo mínimo
              var fo2 = 1 - Math.sqrt(Math.max(0, reglas.soporteMin)), dxm = Math.min(veh.deck.x, fo2 * l), dym = Math.min(veh.deck.y, fo2 * w);
              ex0 = Math.max(sp.x, veh.deck.x - dxm); ey0 = Math.max(s.y, veh.deck.y - dym);
              esx = Math.min(s.X, veh.deck.X + dxm) - ex0; esy = Math.min(s.Y, veh.deck.Y + dym) - ey0;
              if (l > esx || w > esy) continue;
            }
            var tp = tope(it, h);
            var mx = Math.floor(esx / l), my = Math.floor(esy / w), mz = cabenEnAlto(it, h, sz);
            if (tp > 0) mz = Math.min(mz, tp);
            if (!it.soportaEncima || it.piso === "soloPiso") mz = 1;
            if (it.esPallet && !it.aceptaPallet) mz = 1;
            if (it.maxNiveles > 0) mz = Math.min(mz, it.maxNiveles);
            if (it.pesoMaxEncima > 0 && it.peso > 0) mz = Math.min(mz, 1 + Math.floor(it.pesoMaxEncima / it.peso));
            var formas = op.formas;
            for (var fo = 0; fo < formas.length; fo++) {
              var nx, ny, nz;
              if (formas[fo] === 0) { nz = Math.min(mz, cap); ny = Math.min(my, Math.floor(cap / nz)); nx = Math.min(mx, Math.floor(cap / (ny * nz))); }
              else if (formas[fo] === 1) { ny = Math.min(my, cap); nz = Math.min(mz, Math.floor(cap / ny)); nx = Math.min(mx, Math.floor(cap / (ny * nz))); }
              else { nx = 1; nz = Math.min(mz, cap); ny = Math.min(my, Math.floor(cap / nz)); }
              if (!(nx >= 1 && ny >= 1 && nz >= 1)) continue;
              var bl = { t: t, o: o, nx: nx, ny: ny, nz: nz, n: nx * ny * nz, anc: veh.deck && s.z === 0 ? [ex0, ey0] : null, alto: altoPila(it, h, nz) };
              var bv = bl.n * l * w * h;
              var ajusteY = (ny * w) / sy, ajusteZ = bl.alto / sz;
              var fit = op.fitness === 0 ? bv : op.fitness === 1 ? bv * (0.6 + 0.4 * ajusteY * ajusteZ) : bv / Math.max(1, nx * l) * (0.5 + 0.5 * ajusteZ);
              if (reglas.juntos && ultimoTipo === t.k) fit *= 1.25;
              bl.fit = fit; bloques.push(bl);
            }
          }
        }
        if (!bloques.length) { muertos[s.x + "," + s.y + "," + s.z + "," + s.X + "," + s.Y + "," + s.Z] = 1; continue; }
        bloques.sort(function (a, b) { return b.fit - a.fit; });
        // GRASP: elegir al azar entre los mejores
        if (rand && op.rcl > 1 && bloques.length > 1) {
          var top = Math.min(op.rcl, bloques.length), pick = Math.floor(rand() * rand() * top);
          var tmp = bloques[0]; bloques[0] = bloques[pick]; bloques[pick] = tmp;
        }
        for (var bi2 = 0; bi2 < bloques.length && bi2 < 40 && !colocado; bi2++) {
          var b = bloques[bi2], bl2 = b.nx * b.o.d[0], bw = b.ny * b.o.d[1], bh = b.alto;
          var anclas = [[sp.x, s.y], [sp.x, s.Y - bw]];
          if (b.anc) anclas.unshift(b.anc);
          anclas = anclas.filter(function (a) { return a[1] >= s.y - 0.01 && a[1] + bw <= s.Y + 0.01 && a[0] >= sp.x - 0.01 && a[0] + bl2 <= s.X + 0.01; });
          for (var an = 0; an < anclas.length && !colocado; an++) {
            if (an > 0 && anclas[an][0] === anclas[an - 1][0] && anclas[an][1] === anclas[an - 1][1]) continue;
            if (intentarBloque(b, anclas[an][0], anclas[an][1], s.z)) {
              colocado = true;
              b.t.rem -= b.n; peso += b.n * b.t.it.peso; vol += b.nx * b.ny * b.o.d[0] * b.o.d[1] * altoPila(b.t.it, b.o.d[2], b.nz);
              if (!skus[b.t.k]) { skus[b.t.k] = 1; nSkus++; }
              ultimoTipo = b.t.k;
              actualizarEspacios(anclas[an][0], anclas[an][1], s.z, anclas[an][0] + bl2, anclas[an][1] + bw, s.z + bh, minDim);
            }
          }
          // si no cabe entero, intentar una sola columna/caja del mismo tipo
          if (!colocado && (b.nx > 1 || b.ny > 1)) {
            var b1 = { t: b.t, o: b.o, nx: 1, ny: 1, nz: b.nz, n: b.nz, alto: b.alto };
            var a1 = b.anc || [sp.x, s.y];
            if (intentarBloque(b1, a1[0], a1[1], s.z)) {
              colocado = true;
              b.t.rem -= b1.n; peso += b1.n * b.t.it.peso; vol += b.o.d[0] * b.o.d[1] * altoPila(b.t.it, b.o.d[2], b1.nz);
              if (!skus[b.t.k]) { skus[b.t.k] = 1; nSkus++; }
              ultimoTipo = b.t.k;
              actualizarEspacios(a1[0], a1[1], s.z, a1[0] + b.o.d[0], a1[1] + b.o.d[1], s.z + altoPila(b.t.it, b.o.d[2], b.nz), minDim);
            }
          }
        }
        if (!colocado) muertos[s.x + "," + s.y + "," + s.z + "," + s.X + "," + s.Y + "," + s.Z] = 1;
      }
      if (!colocado) break;
    }
  }

  // ---- Relleno final: caja por caja en lo que quedó ----
  // La construcción por bloques deja huecos irregulares al final, y descarta un bloque completo
  // aunque ahí quepan unidades sueltas. Esto es lo que hace un estibador al terminar: dejar de
  // pensar en bloques e ir metiendo piezas donde quepan, en cualquier orientación y arrimadas a
  // cualquier esquina del hueco. Solo agrega carga; nunca mueve lo ya colocado.
  var huecoMasChico = Infinity;
  tipos.forEach(function (t) {
    if (t.rem > 0) t.oris.forEach(function (o) { var v = o.d[0] * o.d[1] * o.d[2]; if (v < huecoMasChico) huecoMasChico = v; });
  });
  var rondas = 0;
  while (tipos.some(function (t) { return t.rem > 0; }) && rondas++ < 400) {
    var metida = false;
    var libres = espacios.slice().sort(function (a, b) { return (a.X - a.x) * (a.Y - a.y) * (a.Z - a.z) - (b.X - b.x) * (b.Y - b.y) * (b.Z - b.z); });
    for (var li = 0; li < libres.length && !metida; li++) {
      var h = libres[li], hx = h.X - h.x, hy = h.Y - h.y, hz = h.Z - h.z;
      if (hx * hy * hz < huecoMasChico) continue;
      for (var ti2 = 0; ti2 < tipos.length && !metida; ti2++) {
        var t2 = tipos[ti2];
        if (t2.rem <= 0) continue;
        var it2 = t2.it;
        if (it2.piso === "soloPiso" && h.z > 0) continue;
        if (it2.piso === "noPiso" && h.z === 0) continue;
        if (it2.peso > 0 && peso + it2.peso > cargaMax + 1e-9) continue;
        if (veh.maxPiezas > 0 && cajas.length >= veh.maxPiezas) continue;
        if (veh.maxSkus > 0 && !skus[t2.k] && nSkus >= veh.maxSkus) continue;
        for (var oi2 = 0; oi2 < t2.oris.length && !metida; oi2++) {
          var o2 = t2.oris[oi2], l2 = o2.d[0], w2 = o2.d[1], h2 = o2.d[2];
          if (l2 > hx || w2 > hy || h2 > hz) continue;
          if (h.z === 0 && o2.volteo && !it2.volteoPiso) continue;
          // Las cuatro esquinas del hueco: arrimar a cualquiera puede ser lo que dé el apoyo necesario.
          var esquinas = [[h.x, h.y], [h.X - l2, h.y], [h.x, h.Y - w2], [h.X - l2, h.Y - w2]];
          for (var ei = 0; ei < esquinas.length && !metida; ei++) {
            var bl1 = { t: t2, o: o2, nx: 1, ny: 1, nz: 1, n: 1, alto: h2 };
            if (intentarBloque(bl1, esquinas[ei][0], esquinas[ei][1], h.z)) {
              t2.rem -= 1; peso += it2.peso; vol += l2 * w2 * h2;
              if (!skus[t2.k]) { skus[t2.k] = 1; nSkus++; }
              actualizarEspacios(esquinas[ei][0], esquinas[ei][1], h.z, esquinas[ei][0] + l2, esquinas[ei][1] + w2, h.z + h2, 1);
              metida = true;
            }
          }
        }
      }
    }
    if (!metida) break;
  }

  return { cajas: cajas, peso: peso, vol: vol };
}

function llenarVarios(tipos, veh, reglas, op) {
  var contenedores = [];
  while (contenedores.length < 60 && tipos.some(function (t) { return t.rem > 0; })) {
    // Un vehículo por pedido: se ofrece al contenedor solo el primer pedido que quede pendiente
    var lote = tipos;
    if (reglas.separarGrupos) {
      var g = null;
      tipos.forEach(function (t) { if (t.rem > 0 && (g === null || t.g < g)) g = t.g; });
      lote = tipos.filter(function (t) { return t.g === g; });
    }
    var c = llenarContenedor(lote, veh, reglas, op);
    if (!c.cajas.length) break;
    contenedores.push(c);
  }
  var sin = 0; tipos.forEach(function (t) { sin += t.rem; });
  return { contenedores: contenedores, sinCargar: sin };
}

var ORDENES_ESP = [
  function (a, b) { return a.x - b.x || a.s.z - b.s.z || a.s.y - b.s.y; },          // de adelante hacia atrás, apilando alto
  function (a, b) { return a.x - b.x || a.s.y - b.s.y || a.s.z - b.s.z; },          // de adelante hacia atrás, a lo ancho
  function (a, b) { return a.s.z - b.s.z || a.x - b.x || a.s.y - b.s.y; },          // de abajo hacia arriba (pallets)
  function (a, b) { return (a.x + a.s.y * 0.5 + a.s.z * 0.5) - (b.x + b.s.y * 0.5 + b.s.z * 0.5); } // esquina más cercana
];
// Qué tan compacta quedó la carga desde el frente: volumen ocupado contra el volumen del "bloque"
// que va del frente hasta donde llega la caja más lejana. Baja si hay huecos grandes dentro de ese
// tramo (por ejemplo, un acomodo que llena de más un lado y dejó un hueco tipo puerta en el otro),
// aunque el total ocupado sea el mismo. Se usa solo para desempatar entre soluciones parecidas.
function compacidad(c, veh) {
  var largo = 0;
  for (var i = 0; i < c.cajas.length; i++) { var k = c.cajas[i]; if (k.x + k.l > largo) largo = k.x + k.l; }
  if (largo <= 0) return 1;
  return Math.min(1, c.vol / (largo * veh.W * veh.H));
}
function puntaje(r, volV, veh) {
  // Con el mismo número de vehículos y sin bultos sin cargar, se prefiere la solución que deja
  // el primer vehículo más lleno, luego el segundo, etc. (orden lexicográfico descendente).
  // Cada vehículo pesa por su ocupación, afinada por qué tan compacto (sin huecos) quedó el frente.
  var us = r.contenedores.map(function (c) { return (c.vol / volV) * (0.8 + 0.2 * compacidad(c, veh)); }).sort(function (a, b) { return b - a; });
  return [r.sinCargar, r.contenedores.length].concat(us.map(function (u) { return -u; }));
}
function mejorQue(a, b) { for (var i = 0; i < a.length; i++) { if (a[i] < b[i] - 1e-9) return true; if (a[i] > b[i] + 1e-9) return false; } return false; }
function clonarTipos(tipos) { return tipos.map(function (t) { return Object.assign({}, t); }); }

// Busca la mejor solución: variantes deterministas + iteraciones GRASP dentro de un tiempo límite
function buscar(tiposBase, veh, reglas, nivel, esPallet, alProgreso) {
  var volV = veh.L * veh.W * veh.H;
  var ordenes = esPallet ? [2, 3] : [0, 1, 3];
  var det = [];
  ordenes.forEach(function (oe) { [0, 1, 2].forEach(function (fit) { det.push({ ordenEsp: ORDENES_ESP[oe], formas: [0, 1], fitness: fit, rcl: 1, nombre: ["alto", "ancho", "capas", "esquina"][oe] + "/" + ["volumen", "ajuste", "muro"][fit] }); }); });
  if (nivel <= 1) det = det.filter(function (d, i) { return i % 3 !== 2 || i < 3; });
  var tiempo = [0, 1500, 5000, 12000, 25000][Math.min(4, Math.max(1, nivel))];
  var iterGrasp = [0, 0, 25, 80, 250][Math.min(4, Math.max(1, nivel))];
  var total = det.length + iterGrasp, t0 = Date.now(), mejor = null, mejorP = null, nombre = "", hechos = 0;
  var probar = function (op) {
    var r = llenarVarios(clonarTipos(tiposBase), veh, reglas, op), p = puntaje(r, volV, veh);
    if (!mejor || mejorQue(p, mejorP)) { mejor = r; mejorP = p; nombre = op.nombre; }
    hechos++; if (alProgreso) alProgreso(Math.min(hechos, total), total);
  };
  for (var i = 0; i < det.length; i++) { probar(det[i]); if (i > 2 && Date.now() - t0 > tiempo) break; }
  var semilla = 7;
  for (var g = 0; g < iterGrasp && Date.now() - t0 < tiempo; g++) {
    var base = det[g % det.length];
    probar({ ordenEsp: base.ordenEsp, formas: [0, 1, 2], fitness: base.fitness, rcl: 3 + (g % 4), rand: rng(semilla + g * 101), nombre: base.nombre + " + búsqueda" });
  }
  if (alProgreso) alProgreso(total, total);
  mejor.estrategia = nombre; mejor.estrategiasProbadas = hechos;
  return mejor;
}

// ---------- Pallets de un solo SKU: patrón por capas (guillotina) con giros mezclados ----------
function patronCapa(X, Y, a, b, rot) {
  // Máximo de cajas a×b (y b×a si rot) en un rectángulo X×Y con cortes de guillotina
  var raster = function (M, p, q) {
    var s = {}; for (var i = 0; i * p <= M; i++) for (var j = 0; i * p + j * q <= M; j++) s[i * p + j * q] = 1;
    return Object.keys(s).map(Number).sort(function (u, v) { return u - v; });
  };
  var RX = raster(X, a, rot ? b : a), RY = raster(Y, b, rot ? a : b);
  var piso = function (R, v) { var lo = 0, hi = R.length - 1, r = 0; while (lo <= hi) { var m = (lo + hi) >> 1; if (R[m] <= v) { r = R[m]; lo = m + 1; } else hi = m - 1; } return r; };
  var memo = {};
  var f = function (x, y) {
    var key = x + "," + y; if (memo[key]) return memo[key];
    var best = { n: Math.floor(x / a) * Math.floor(y / b), tipo: "g", o: 0 };
    if (rot) { var n2 = Math.floor(x / b) * Math.floor(y / a); if (n2 > best.n) best = { n: n2, tipo: "g", o: 1 }; }
    for (var i = 0; i < RX.length && RX[i] <= x / 2; i++) { var x1 = RX[i]; if (!x1) continue; var r = f(x1, y).n + f(piso(RX, x - x1), y).n; if (r > best.n) best = { n: r, tipo: "x", c: x1 }; }
    for (var j = 0; j < RY.length && RY[j] <= y / 2; j++) { var y1 = RY[j]; if (!y1) continue; var r2 = f(x, y1).n + f(x, piso(RY, y - y1)).n; if (r2 > best.n) best = { n: r2, tipo: "y", c: y1 }; }
    memo[key] = best; return best;
  };
  var pos = [];
  var armar = function (x0, y0, x, y) {
    var s = f(x, y);
    if (s.tipo === "g") { var l = s.o ? b : a, w = s.o ? a : b; for (var i = 0; i < Math.floor(x / l); i++) for (var j = 0; j < Math.floor(y / w); j++) pos.push({ x: x0 + i * l, y: y0 + j * w, l: l, w: w, o: s.o }); }
    else if (s.tipo === "x") { armar(x0, y0, s.c, y); armar(x0 + s.c, y0, piso(RX, x - s.c), y); }
    else { armar(x0, y0, x, s.c); armar(x0, y0 + s.c, x, piso(RY, y - s.c)); }
  };
  var X0 = piso(RX, X), Y0 = piso(RY, Y);
  armar(0, 0, X0, Y0);
  return pos;
}
function armarPalletUniforme(it, pal, objetivo, reglas) {
  var ovL = pal.ovL || 0, ovW = pal.ovW || 0, CX = pal.L + 2 * ovL, CY = pal.W + 2 * ovW, CZ = Math.max(1, pal.altMax - pal.esp);
  var oris = orientacionesDe(it), porAltura = {};
  oris.forEach(function (o) { var h = o.d[2], key = String(h); if (!porAltura[key]) porAltura[key] = []; porAltura[key].push(o); });
  var capKg = pal.maxKg > 0 && it.peso > 0 ? Math.floor(pal.maxKg / it.peso) : Infinity, mejor = null;
  Object.keys(porAltura).forEach(function (key) {
    var os = porAltura[key], h = Number(key), o0 = os[0], a = o0.d[0], b = o0.d[1], rot = os.length > 1 || a === b;
    if (!rot && a !== b) { /* solo un sentido */ }
    var capas = cabenEnAlto(it, h, CZ);
    if (it.maxNiveles > 0) capas = Math.min(capas, it.maxNiveles);
    if (it.capasPallet > 0) capas = Math.min(capas, it.capasPallet);   // niveles pedidos por el usuario
    if (tope(it, h) > 0) capas = Math.min(capas, tope(it, h));         // tope de piezas anidadas
    if (!it.soportaEncima) capas = Math.min(capas, 1);
    if (it.pesoMaxEncima > 0 && it.peso > 0) capas = Math.min(capas, 1 + Math.floor(it.pesoMaxEncima / it.peso));
    if (capas < 1) return;
    // candidatos: patrón con giros mezclados y rejillas simples en cada sentido
    var grid = function (l, w, o) { var r = []; for (var i = 0; i < Math.floor(CX / l); i++) for (var j = 0; j < Math.floor(CY / w); j++) r.push({ x: i * l, y: j * w, l: l, w: w, o: o }); return r; };
    var pats = [];
    [[CX, CY], [pal.L + ovL, pal.W + ovW], [pal.L, pal.W]].forEach(function (d) {
      var gx = function (l, w, o) { var r = []; for (var i = 0; i < Math.floor(d[0] / l); i++) for (var j = 0; j < Math.floor(d[1] / w); j++) r.push({ x: i * l, y: j * w, l: l, w: w, o: o }); return r; };
      pats.push(patronCapa(d[0], d[1], a, b, rot), gx(a, b, 0));
      if (rot) pats.push(gx(b, a, 1));
    });
    var apoyaEnTarima = function (pos) {
      var bx = 0, by = 0; pos.forEach(function (p) { bx = Math.max(bx, p.x + p.l); by = Math.max(by, p.y + p.w); });
      var ox0 = (CX - bx) / 2, oy0 = (CY - by) / 2;
      return pos.every(function (p) {
        var dx = Math.min(ox0 + p.x + p.l, ovL + pal.L) - Math.max(ox0 + p.x, ovL), dy = Math.min(oy0 + p.y + p.w, ovW + pal.W) - Math.max(oy0 + p.y, ovW);
        return dx > 0 && dy > 0 && dx * dy / (p.l * p.w) >= Math.max(reglas.soporteMin, 0.5) - 1e-9;
      });
    };
    pats.forEach(function (pos0) {
      if (!pos0.length || !apoyaEnTarima(pos0)) return;
      // Cajas por nivel pedidas por el usuario: se recorta el patrón a esa cantidad, desde el centro hacia afuera
      var pos = pos0;
      if (it.porCapa > 0 && it.porCapa < pos0.length) {
        var bx0 = 0, by0 = 0;
        pos0.forEach(function (q) { bx0 = Math.max(bx0, q.x + q.l); by0 = Math.max(by0, q.y + q.w); });
        pos = pos0.slice().sort(function (u, v) {
          return (Math.abs(u.x + u.l / 2 - bx0 / 2) + Math.abs(u.y + u.w / 2 - by0 / 2)) - (Math.abs(v.x + v.l / 2 - bx0 / 2) + Math.abs(v.y + v.w / 2 - by0 / 2));
        }).slice(0, it.porCapa);
      }
      var maxN = Math.min(pos.length * capas, capKg), n = Math.min(objetivo, maxN), nCapas = Math.ceil(n / pos.length);
      // menos cajas no; luego menor altura; luego tope plano (capas completas); luego más cajas por capa
      var bxp = 0, byp = 0; pos.forEach(function (p) { bxp = Math.max(bxp, p.x + p.l); byp = Math.max(byp, p.y + p.w); });
      var sc = [-n, altoPila(it, h, nCapas), n % pos.length ? 1 : 0, -pos.length, bxp * byp];
      if (!mejor || mejorQue(sc, mejor.sc)) mejor = { sc: sc, pos: pos, h: h, n: n, nCapas: nCapas, os: os, a: a, b: b };
    });
  });
  if (!mejor) return null;
  var pos = mejor.pos, bx = 0, by = 0;
  pos.forEach(function (p) { bx = Math.max(bx, p.x + p.l); by = Math.max(by, p.y + p.w); });
  var offX = (CX - bx) / 2, offY = (CY - by) / 2;
  // capas alternadas (entrelazado): se prueba espejo a lo largo, a lo ancho y giro de 180°; se usa el primero distinto con buen apoyo
  var firma = function (arr) { return arr.map(function (p) { return Math.round(p.x) + "," + Math.round(p.y) + "," + p.l; }).sort().join("|"); };
  var apoyoMinDe = function (arriba) {
    var m = 1;
    arriba.forEach(function (e) { var ar = 0; pos.forEach(function (p) { var ox = Math.min(e.x + e.l, p.x + p.l) - Math.max(e.x, p.x), oy = Math.min(e.y + e.w, p.y + p.w) - Math.max(e.y, p.y); if (ox > 0 && oy > 0) ar += ox * oy; }); m = Math.min(m, ar / (e.l * e.w)); });
    return m;
  };
  var variantes = [
    pos.map(function (p) { return { x: bx - p.x - p.l, y: p.y, l: p.l, w: p.w, o: p.o }; }),
    pos.map(function (p) { return { x: p.x, y: by - p.y - p.w, l: p.l, w: p.w, o: p.o }; }),
    pos.map(function (p) { return { x: bx - p.x - p.l, y: by - p.y - p.w, l: p.l, w: p.w, o: p.o }; })
  ];
  var espejo = null, fPos = firma(pos);
  for (var vi = 0; vi < variantes.length && !espejo; vi++) if (firma(variantes[vi]) !== fPos && apoyoMinDe(variantes[vi]) >= Math.max(reglas.soporteMin, 0.75)) espejo = variantes[vi];
  var alternar = !!espejo;
  var cajas = [], quedan = mejor.n;
  var oriDe = function (o) { var hit = mejor.os.filter(function (q) { return (o ? q.d[0] === mejor.b : q.d[0] === mejor.a); })[0] || mejor.os[0]; return hit.k + 1; };
  // Alturas escalonadas de las capas del pallet: la de abajo carga todas las de arriba.
  var altCapa = alturasPila(it, mejor.h, mejor.nCapas), zCapa = [], zAcum = 0;
  for (var ci = 0; ci < altCapa.length; ci++) { zCapa.push(zAcum); zAcum += altCapa[ci]; }
  for (var c = 0; c < mejor.nCapas && quedan > 0; c++) {
    var capa = alternar && c % 2 ? espejo : pos;
    // capa incompleta: primero las posiciones más cercanas al centro para no desbalancear
    var orden = capa.map(function (p, i) { return i; });
    if (quedan < capa.length) orden.sort(function (i, j) { var pi = capa[i], pj = capa[j]; return (Math.abs(pi.x + pi.l / 2 - bx / 2) + Math.abs(pi.y + pi.w / 2 - by / 2)) - (Math.abs(pj.x + pj.l / 2 - bx / 2) + Math.abs(pj.y + pj.w / 2 - by / 2)); });
    for (var q = 0; q < orden.length && quedan > 0; q++, quedan--) {
      var p = capa[orden[q]];
      cajas.push({ x: offX + p.x, y: offY + p.y, z: zCapa[c], l: p.l, w: p.w, h: altCapa[c], it: it, idx: it._idx, ori: oriDe(p.o) });
    }
  }
  return { cajas: cajas, alternado: alternar, capas: mejor.nCapas, porCapa: pos.length };
}

function definirPallet(cajas, pal, info) {
  // Volumen real ocupado: la huella de cada columna por su altura (las piezas anidadas se traslapan)
  var cols = {}, volPallet = 0;
  cajas.forEach(function (k) {
    var key = Math.round(k.x) + "," + Math.round(k.y) + "," + Math.round(k.l) + "," + Math.round(k.w);
    var c = cols[key] = cols[key] || { l: k.l, w: k.w, z0: Infinity, z1: 0 };
    c.z0 = Math.min(c.z0, k.z); c.z1 = Math.max(c.z1, k.z + k.h);
  });
  Object.keys(cols).forEach(function (key) { var c = cols[key]; volPallet += c.l * c.w * (c.z1 - c.z0); });
  var ovL = pal.ovL || 0, ovW = pal.ovW || 0;
  var minX = ovL, minY = ovW, maxX = ovL + pal.L, maxY = ovW + pal.W, alto = 0, peso = pal.peso || 0, piezas = 0, valor = 0, areaTop = 0, areaBase = 0;
  cajas.forEach(function (k) {
    minX = Math.min(minX, k.x); minY = Math.min(minY, k.y); maxX = Math.max(maxX, k.x + k.l); maxY = Math.max(maxY, k.y + k.w);
    if (k.z + k.h > alto) alto = k.z + k.h;
    peso += k.it.peso; piezas += k.it.piezas || 1; if (k.it.valorApilar > valor) valor = k.it.valorApilar;
  });
  cajas.forEach(function (k) { if (Math.abs(k.z + k.h - alto) < 1) areaTop += k.l * k.w; if (k.z < 0.5) areaBase += k.l * k.w; });
  return {
    nombre: info.nombre, mixto: info.mixto, tipoPallet: pal.nombre, alternado: !!info.alternado,
    L: maxX - minX, W: maxY - minY, esp: pal.esp, baseX: ovL - minX, baseY: ovW - minY, palL: pal.L, palW: pal.W,
    ovL: ovL, ovW: ovW, alto: pal.esp + alto, peso: peso, piezas: piezas, n: cajas.length,
    volCarga: volPallet, utilVol: volPallet / ((pal.L + 2 * ovL) * (pal.W + 2 * ovW) * Math.max(1, pal.altMax - pal.esp)),
    sobraL: Math.max(0, ovL - minX, maxX - ovL - pal.L), sobraW: Math.max(0, ovW - minY, maxY - ovW - pal.W),
    capas: info.capas || 0, porCapa: info.porCapa || 0,
    techoPlano: areaTop >= 0.95 * areaBase && areaTop >= 0.6 * pal.L * pal.W, valor: valor,
    cajas: cajas.map(function (k) { return { x: k.x - minX, y: k.y - minY, z: k.z, l: k.l, w: k.w, h: k.h, idx: k.idx, ori: k.ori }; })
  };
}
function contenedorDePallet(pal) {
  var ovL = pal.ovL || 0, ovW = pal.ovW || 0;
  return { L: pal.L + 2 * ovL, W: pal.W + 2 * ovW, H: Math.max(1, pal.altMax - pal.esp), tara: 0, maxKg: pal.maxKg > 0 ? pal.maxKg : 0, maxVolPct: 0, maxSkus: 0, maxPiezas: 0,
    deck: { x: ovL, y: ovW, X: ovL + pal.L, Y: ovW + pal.W } };
}

// ---------- Entrada principal ----------
// Zonas por entrega y bultos que estorban: los que quedan entre las puertas (x alto) y algo que se entrega antes,
// en el mismo pasillo y no por encima. ordenDe[idx] es la parada de cada caja (0 = sin parada).
function marcarEntregas(c, ordenDe) {
  var zonas = {}, estorban = 0, detalle = {};
  c.cajas.forEach(function (a) {
    var oa = ordenDe[a.idx] || 0; if (!oa) return;
    var z = zonas[oa] = zonas[oa] || { x0: Infinity, x1: 0, n: 0, vol: 0 };
    z.x0 = Math.min(z.x0, a.x); z.x1 = Math.max(z.x1, a.x + a.l); z.n++; z.vol += a.l * a.w * a.h;
  });
  c.cajas.forEach(function (a) {
    var oa = ordenDe[a.idx] || 0; if (!oa) return;
    for (var j = 0; j < c.cajas.length; j++) {
      var b = c.cajas[j], ob = ordenDe[b.idx] || 0;
      if (!ob || ob >= oa) continue;
      if (a.x + a.l <= b.x + b.l + 1) continue;                       // a no está más cerca de las puertas
      if (Math.min(a.y + a.w, b.y + b.w) - Math.max(a.y, b.y) <= 0) continue; // distinto pasillo
      if (a.z >= b.z + b.h - 1) continue;                             // va por encima, no tapa
      estorban++; detalle[ob] = (detalle[ob] || 0) + 1; break;
    }
  });
  c.entregas = Object.keys(zonas).map(function (k) { return { orden: +k, x0: zonas[k].x0, x1: zonas[k].x1, n: zonas[k].n, vol: zonas[k].vol, estorban: detalle[k] || 0 }; }).sort(function (a, b) { return a.orden - b.orden; });
  c.estorban = estorban;
  return c;
}

function optimizar(items, veh, reglas, alProgreso, pallets) {
  pallets = (pallets || []).map(function (p) { return Object.assign({ ovL: p.ov || 0, ovW: p.ov || 0 }, p); });
  var tipos = [], noCaben = [], avisos = [], defs = [], gruposOrden = {}, ng = 0;
  var cargaMax = veh.maxKg > 0 ? veh.maxKg - (veh.tara || 0) : Infinity;
  var grupoDe = function (g) { g = g || ""; if (gruposOrden[g] === undefined) gruposOrden[g] = ng++; return gruposOrden[g]; };
  var MAXP = 99999999;
  var faseDe = function (it) {
    var f = 0;
    // Se carga de atrás (fondo) hacia las puertas: primero las entregas altas, al final la parada 1.
    if (reglas.usarOrden) f += (it.orden > 0 ? MAXP - Math.min(it.orden, MAXP) : 0) * 100000;
    if (reglas.agrupar) f += grupoDe(it.grupo);
    return f;
  };
  var cabeEn = function (it, v) { return orientacionesDe(it).some(function (o) { return o.d[0] <= v.L && o.d[1] <= v.W && o.d[2] <= v.H; }); };
  var sueltas = function (it, idx, n) { if (n > 0) tipos.push({ k: "s" + idx, idx: idx, it: it, oris: orientacionesDe(it), fase: faseDe(it), g: grupoDe(it.grupo), rem: n, pal: -1 }); };
  var agregarPallet = function (def, n, it, idx, info) {
    var d = defs.length; defs.push(def);
    var pit = { nombre: def.nombre, L: def.L, W: def.W, H: def.alto, peso: def.peso, oris: [true, true, false, false, false, false], volteoPiso: false, maxNiveles: 0,
      valorApilar: def.valor, pesoMaxEncima: 0, piso: "libre", soportaEncima: true, esPallet: true, aceptaCajas: info.aceptaCajas && def.techoPlano,
      aceptaPallet: info.aceptaPallet && def.techoPlano, grupo: it.grupo, orden: it.orden, piezas: def.piezas };
    if (!cabeEn(pit, veh) || (reglas.limitarPeso && pit.peso > cargaMax)) { avisos.push("El pallet de " + def.nombre + " no cabe en el vehículo."); noCaben.push(def.nombre); return; }
    tipos.push({ k: "p" + d, idx: idx, it: pit, oris: orientacionesDe(pit), fase: faseDe(pit), g: grupoDe(it.grupo), rem: n, pal: d });
  };
  var poolMixto = {};
  var alPool = function (it, idx, pal, n, info) {
    var key = (it.palletId || 0) + "|" + (reglas.agrupar ? it.grupo || "" : "") + "|" + (reglas.usarOrden ? it.orden : "");
    if (!poolMixto[key]) poolMixto[key] = { pal: pal, it: it, idx: idx, tipos: [], aceptaCajas: true, aceptaPallet: true };
    var pm = poolMixto[key];
    pm.tipos.push({ k: "s" + idx, idx: idx, it: it, oris: orientacionesDe(it), fase: 0, rem: n, pal: -1 });
    pm.aceptaCajas = pm.aceptaCajas && info.aceptaCajas; pm.aceptaPallet = pm.aceptaPallet && info.aceptaPallet;
  };
  items.forEach(function (it0, idx) {
    if (!(it0.qty > 0)) return;
    var it = Object.assign({}, it0, { _idx: idx });
    var pal = it.paletizar && !veh.esPallet ? pallets[it.palletId || 0] : null;
    if (!pal) {
      if (!((!reglas.limitarPeso || it.peso <= cargaMax) && cabeEn(it, veh))) { noCaben.push(it.nombre); return; }
      sueltas(it, idx, it.qty); return;
    }
    var contP = contenedorDePallet(pal);
    if (!cabeEn(it, contP)) { avisos.push(it.nombre + " no cabe en el pallet " + pal.nombre + "; se carga suelto."); sueltas(it, idx, it.qty); return; }
    if (it.paletizar === "mixto") { alPool(it, idx, pal, it.qty, { aceptaCajas: !!it.aceptaCajas, aceptaPallet: !!it.aceptaPallet }); return; }
    var objetivo = it.porPallet > 0 ? Math.min(it.porPallet, it.qty) : it.qty;
    var arm = armarPalletUniforme(it, pal, objetivo, reglas);
    if (!arm) { sueltas(it, idx, it.qty); return; }
    var porPal = arm.cajas.length;
    if (it.porPallet > 0 && porPal < Math.min(it.porPallet, it.qty)) avisos.push("En " + pal.nombre + " solo caben " + porPal + " cajas de " + it.nombre + " (pediste " + it.porPallet + "). Se usan pallets de " + porPal + ".");
    if (it.porCapa > 0 && arm.porCapa < it.porCapa) avisos.push("En " + pal.nombre + " solo caben " + arm.porCapa + " cajas de " + it.nombre + " por nivel (pediste " + it.porCapa + ").");
    if (it.capasPallet > 0 && arm.capas < it.capasPallet) avisos.push("Solo caben " + arm.capas + " niveles de " + it.nombre + " en " + pal.nombre + " (pediste " + it.capasPallet + "); revisa la altura máxima de la tarima.");
    var llenos = Math.floor(it.qty / porPal), resto = it.qty - llenos * porPal, info = { aceptaCajas: !!it.aceptaCajas, aceptaPallet: !!it.aceptaPallet };
    if (llenos > 0) agregarPallet(definirPallet(arm.cajas, pal, { nombre: it.nombre, mixto: false, alternado: arm.alternado, capas: arm.capas, porCapa: arm.porCapa }), llenos, it, idx, info);
    if (resto > 0) {
      if (it.resto === "sueltas") sueltas(it, idx, resto);
      else if (it.resto === "mixto") alPool(it, idx, pal, resto, info);
      else {
        var ar2 = armarPalletUniforme(it, pal, resto, reglas);
        agregarPallet(definirPallet(ar2.cajas, pal, { nombre: it.nombre + " (incompleto)", mixto: false, alternado: ar2.alternado, capas: ar2.capas, porCapa: ar2.porCapa }), 1, it, idx, info);
      }
    }
  });
  Object.keys(poolMixto).forEach(function (key) {
    var pm = poolMixto[key], cont = contenedorDePallet(pm.pal);
    var rp = { nivel: 2, limitarPeso: pm.pal.maxKg > 0, soporteMin: reglas.soporteMin, usarOrden: false, agrupar: false, juntos: true, apilamiento: reglas.apilamiento === "ninguna" ? "masPesadoAbajo" : reglas.apilamiento };
    var r = buscar(pm.tipos, cont, rp, 2, true, null);
    r.contenedores.forEach(function (c, i) {
      agregarPallet(definirPallet(c.cajas, pm.pal, { nombre: "Mixto " + (pm.it.grupo ? pm.it.grupo + " " : "") + (i + 1), mixto: true }), 1, pm.it, pm.idx, pm);
    });
  });

  var mejor = buscar(tipos, veh, reglas, reglas.nivel, !!veh.esPallet, alProgreso);
  mejor.contenedores.forEach(function (c) {
    c.cajas = c.cajas.map(function (k) {
      return { x: k.x, y: k.y, z: k.z, l: k.l, w: k.w, h: k.h, idx: k.idx, ori: k.ori, peso: k.it.peso, carga: Math.round(k.carga), pal: k.pal, rot: k.pal >= 0 && k.ori === 2 };
    });
    c.peso = c.peso; // peso de la carga (sin tara)
  });
  var ordenDe = {};
  // "entrega" es la parada que ve el usuario; "orden" puede traer además el desempate de la lista
  items.forEach(function (it, i) { ordenDe[i] = it.entrega > 0 ? it.entrega : it.orden > 0 ? it.orden : 0; });
  mejor.contenedores.forEach(function (c) { marcarEntregas(c, ordenDe); });
  mejor.pallets = defs; mejor.noCaben = noCaben; mejor.avisos = avisos;
  return mejor;
}

export { optimizar, marcarEntregas };
