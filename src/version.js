// ================= Versión =================
// VERSION es el número que ve el usuario (arriba, junto al nombre, y en los archivos exportados). Se sube
// a mano en package.json cada vez que se publica una mejora, siguiendo GUIA_PUBLICAR.md:
//   1.1.0 → 1.1.1  corrección pequeña     ·   1.1.0 → 1.2.0  funcionalidad nueva
// BUILD cambia solo en cada publicación: es el commit que compiló Cloudflare. Sirve para saber
// exactamente qué código tiene la versión que alguien está usando, aunque no se haya subido el número.
// Los valores los inyecta vite.config.js al compilar; en pruebas sin compilar quedan como "dev".
/* global __VERSION__, __BUILD__, __FECHA_BUILD__ */
export const VERSION = typeof __VERSION__ !== "undefined" ? __VERSION__ : "dev";
export const BUILD = typeof __BUILD__ !== "undefined" ? __BUILD__ : "";
export const FECHA_BUILD = typeof __FECHA_BUILD__ !== "undefined" ? __FECHA_BUILD__ : "";
export const NOMBRE_VERSION = `DarnelCube 3D v${VERSION}`;
export const VERSION_COMPLETA = `v${VERSION}${BUILD ? ` · ${BUILD}` : ""}${FECHA_BUILD ? ` · ${FECHA_BUILD}` : ""}`;

// Novedades que se muestran en Ayuda. Al subir la versión, agrega arriba una entrada con lo que cambió,
// escrito para quien usa la herramienta (no para programadores).
export const NOVEDADES = [
  {
    version: "1.2.2", fecha: "23/09/2026",
    cambios: [
      "Barra de arriba más ligera: el correo, Nueva carga, los ejemplos y Cerrar sesión pasan al menú de tres puntos (···). Ya no se corta en laptops ni con el zoom de Windows al 125% o 150%.",
      "La separación entre la tabla y la vista 3D se puede mover: arrastra la línea del centro. Arranca mitad y mitad y recuerda tu ajuste.",
      "Los indicadores del resumen (utilización, peso, bultos, centro de gravedad) se acomodan al ancho del panel y ya no se amontonan.",
      "Las pestañas de resultados se deslizan de lado cuando no caben, y Excel e Instructivo siempre quedan a la vista.",
    ],
  },
  {
    version: "1.2.1", fecha: "23/09/2026",
    cambios: [
      "El maestro se guarda comprimido en la nube: un maestro de 26 mil productos pasa de 20 MB a poco más de 1 MB. Carga más rápido y cuida el límite gratuito de Supabase. Los maestros ya guardados se siguen abriendo igual.",
    ],
  },
  {
    version: "1.2.0", fecha: "23/09/2026",
    cambios: [
      "Unidades americanas: arriba eliges mm · kg o in · lb. Toda la pantalla, la captura, el Excel de resultados y el instructivo cambian a pulgadas, libras, pies³ y pies. Se recuerda en tu usuario.",
      "Al subir un maestro, dimensiones, Bundle o catálogo de vehículos puedes elegir en qué unidades viene (mm, cm, m o pulgadas y libras), o dejar que la herramienta lo detecte por el encabezado, por ejemplo «Largo (in)».",
      "Los archivos que descargas salen en tu unidad, con la unidad en el encabezado, y se reconocen solos al volver a subirlos.",
      "El cálculo no cambia: por dentro todo se sigue calculando en milímetros y kilogramos.",
    ],
  },
  {
    version: "1.1.2", fecha: "23/09/2026",
    cambios: [
      "El guion en el SKU ahora cuenta: 852-10 y 85210 son productos distintos. Antes el maestro los tomaba como repetidos y se quedaba solo con uno.",
      "Si un pedido trae el código sin guion y en el maestro solo hay uno parecido, lo sigue encontrando.",
    ],
  },
  {
    version: "1.1.1", fecha: "23/09/2026",
    cambios: [
      "Los escenarios guardados antes de la 1.1.0 ya muestran los vehículos nuevos (53FT-DryVan y 48FT-DryVan) sin perder los que tenían.",
      "El nombre de la herramienta ya no se parte en dos líneas en pantallas medianas.",
    ],
  },
  {
    version: "1.1.0", fecha: "23/09/2026",
    cambios: [
      "Bundles (BDL): al cargar un pedido, los SKUs de manufactura propia se dividen solos en Bundles completos y cajas sueltas. Nuevo importador del archivo CS-BDL en Maestro.",
      "Completar espacios: sugiere cuántas cajas más de los SKUs del pedido caben en el espacio que sobra, sin agregar vehículos.",
      "Consolidar: si el último vehículo va casi vacío (menos del 5%), intenta meter todo en uno menos; si no se puede, dice qué cantidades reducir.",
      "Herramientas: capacidad máxima suelta de un SKU, pallets completos que caben y mejor armado de pallet.",
      "Instructivo completo: un solo documento con el paso a paso de todos los vehículos.",
      "Vehículos 53FT-DryVan y 48FT-DryVan (EE.UU.).",
      "«Simular la carga real» reproduce cómo se carga en el piso: bultos de pie, holgura entre SKUs y compresión solo en bolsas.",
    ],
  },
  { version: "1.0.0", fecha: "20/09/2026", cambios: ["Primera versión publicada: maestro, pedido, cubicaje 3D, paletizado, entregas, instructivo y Excel de resultados."] },
];
