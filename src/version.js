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
    version: "1.5.0", fecha: "24/09/2026",
    cambios: [
      "Bundles desde el maestro: nueva hoja «Bundles» (SKU, cajas por Bundle, medidas y peso). En cada línea del pedido se elige cómo se carga: suelta, pallet de un SKU, pallet mixto o Bundle (solo para los SKUs de esa hoja).",
      "El Bundle se calcula como en el andén: primero todos los Bundles completos y, solo si así se ocupa un vehículo más, se abren los menos posibles para llenar los huecos con cajas sueltas. El resumen muestra el mix Bundle / suelto que resultó; ya no se captura un porcentaje.",
      "En el 3D, al terminar el cálculo: «Llenar con pedido sugerido» (agranda el pedido en la misma proporción y llena los huecos) y «Sugerir disminución del pedido» (primero intenta reacomodar sin cambiar cantidades). Calculan en nivel 4, muestran una vista previa, una línea se puede fijar con el candado y se puede deshacer. Reemplazan «¿Qué más cabe?» e «Intentar consolidar».",
      "Herramientas de capacidad: el cálculo completo tardaba hasta 40 segundos y ahora tarda unos pocos. En pallets completos se puede ver el vehículo lleno o el pallet armado.",
      "Botón ES | EN arriba (y en la pantalla de entrada): toda la herramienta en inglés, también el Excel de resultados, el instructivo y el PDF. Las plantillas de intercambio (maestro, carga y vehículos) siguen en español para que se puedan volver a subir.",
      "Primeros pasos en el 3D vacío: una lista con lo que falta (maestro, pedido y vehículo) y el botón Calcular. Ctrl+Enter calcula desde cualquier lugar.",
      "Las columnas Entrega, Pedido y Destino solo aparecen si se usan (o con «Entrega y pedido»), para que la tabla del pedido no se salga de la pantalla.",
      "En Maestro, los ocho enlaces se juntaron en dos menús: «Importar» y «Descargar».",
      "Los mensajes flotan abajo a la izquierda y se ocultan solos; ya no empujan la pantalla.",
      "Ayuda empieza con «Cómo se usa» en 4 pasos; el significado de cada campo va plegado por tema y las novedades quedan al final.",
      "Herramientas nuevas: Calidad del maestro (medidas en cero o de relleno, pesos que no cuadran con el tamaño, SKUs que no caben en ningún vehículo, repetidos), Comparar pallets, Vehículos necesarios (con flete total y por caja si hay tarifas) y Convertidor de unidades.",
      "El semáforo de paletizado lleva además un símbolo (✓ ! ✕) para quien no distingue bien los colores, y en modo pallet las acciones sugeridas dicen «pallet» en lugar de «vehículo».",
    ],
  },
  {
    version: "1.4.0", fecha: "23/09/2026",
    cambios: [
      "«Mercancía» ahora se llama «Pedido», y en toda la herramienta se dice «pallet» en lugar de «tarima». Los maestros viejos (con la columna «Tarima») se siguen leyendo.",
      "Paletizado queda solo como catálogo de pallets: se crean, duplican y quitan ahí, y se eligen en cada línea del pedido. El Maestro ya no tiene el botón «+ carga»: al pedido se agrega desde Pedido.",
      "Con más de 3 vehículos, arriba del 3D aparece un selector con flechas para pasar de uno en uno, en vez de muchos botones amontonados.",
      "Herramientas por secciones plegables. En capacidad suelta y en pallets completos, «Calcular carga» corre el cálculo completo (con el nivel y las reglas activas) y lo muestra en el 3D; «Volver a mi carga» regresa al pedido. En suelta se eligen las rotaciones (todas por omisión); en pallets completos, el pallet y la configuración (estándar del SKU, óptima o a mano).",
      "Nueva herramienta «Pallet óptimo y paletizado para fabricación»: para una altura objetivo compara entrelazado, columnas e híbrido, con semáforo de estabilidad, centro de gravedad y compresión (con el BCT de la caja, la humedad y el tiempo en almacén, o con el peso máximo encima). Si ninguno aguanta, sugiere cuántos niveles sí. Cada patrón se ve en el 3D con las capas en dos tonos.",
      "Listado de SKUs en Excel (con BCT opcional por SKU) para calcular el paletizado de todos, verlos uno por uno en el 3D, bajar el resultado en Excel y generar un PDF con una hoja por SKU, al estilo del reporte de CubeMaster.",
      "Edición a mano en el 3D: «Editar a mano» permite elegir una caja o pallet con clic y girarla, moverla (cae sola hasta donde tenga apoyo), recorrerla hasta topar, quitarla y volverla a colocar, con deshacer. Cada cambio se valida en vivo: se marca en rojo lo que quede flotando, encimado, fuera del vehículo, en una orientación no permitida, sobre algo que no aguanta o arriba del peso máximo. Lo editado sale en el Excel y el instructivo.",
    ],
  },
  {
    version: "1.3.0", fecha: "23/09/2026",
    cambios: [
      "Acciones sugeridas arriba de los resultados, en cuanto termina el cálculo: en rojo lo que no se cargó, en verde si sobra espacio (con un botón «¿Qué más cabe?» que busca con qué completar el vehículo usando SKUs del mismo pedido) y en amarillo los avisos del armado. Antes estaba escondido en las últimas pestañas.",
      "«Acepta otro pallet encima» ahora explica cuando no se puede: por ejemplo, si el pallet termina con un nivel incompleto (20 cajas con 9 por nivel) no queda plano arriba, y te dice con cuántas cajas sí se apila (18 o 27). También avisa si dos pallets no caben en la altura del vehículo.",
      "La pestaña «Completar espacios» ahora se llama «¿Qué más cabe?».",
    ],
  },
  {
    version: "1.2.5", fecha: "23/09/2026",
    cambios: [
      "Herramientas ya no se traba. Con SKU muy chicos (por ejemplo los que traen 10 × 10 × 10 mm de relleno) la página intentaba acomodar cientos de miles de piezas una por una y dejaba de responder. Ahora responde al instante y, en esos casos, da un aproximado en rejilla.",
      "El SKU se busca escribiendo el código o parte de la descripción, en vez de una lista con los 26 mil productos. Debajo se ven sus medidas y peso.",
      "Si el SKU tiene medidas diminutas, avisa que pueden ser datos de relleno en el maestro. Un SKU con alguna medida en cero ya no deja la página pensando: dice que no cabe.",
    ],
  },
  {
    version: "1.2.4", fecha: "23/09/2026",
    cambios: [
      "«Nueva carga» vuelve a estar a la vista, junto al nombre de la carga. Si ya hay un pedido capturado, pregunta antes de borrarlo.",
    ],
  },
  {
    version: "1.2.3", fecha: "23/09/2026",
    cambios: [
      "Los Excel que descarga la herramienta pesan como los de Excel: el maestro completo pasa de 45 MB a unos 5 MB. Aplica al maestro, las plantillas, los vehículos y los resultados; el contenido es el mismo.",
    ],
  },
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
