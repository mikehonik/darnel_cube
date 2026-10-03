// ================= Tema =================
// Colores de la interfaz. Los del visor 3D viven en src/visor/Visor.jsx.
//
// La identidad es la de Darnel: el logo va de #034F8B (azul oscuro) a #0087CD (azul claro).
//   · `nav` usa el extremo OSCURO, no el claro. Blanco sobre #034F8B da contraste 8.4:1 y sobre #0087CD
//     solo 3.9:1, que reprueba para texto chico. Es una barra que la gente mira una hora seguida.
//   · `marca` es el azul claro del logo, para lo que es interactivo y no es la acción principal.
//   · `acento` sigue siendo ámbar, a propósito: es el color de «Calcular carga» y de la pestaña activa.
//     En azul se perdería dentro de la barra azul, y ese botón tiene que gritar. Azul y ámbar es un par
//     que funciona y deja una sola cosa llamando la atención.
//   · `visor` se queda gris neutro. Los colores de las cajas son una paleta por SKU; con el fondo azul,
//     los SKUs azules dejarían de distinguirse. Esto no es estética, es legibilidad del dibujo.
export const T = {
  nav: "#034F8B", navTexto: "#BBD6EA", marca: "#0087CD", shell: "#EEF1F5", sup: "#FFFFFF", tinta: "#16202C", suave: "#5B6B7B",
  linea: "#DCE2E8", acento: "#F2B705", visor: "#E7ECF1", error: "#B3261E", aviso: "#8A5A00", ok: "#2F6B3A",
};
