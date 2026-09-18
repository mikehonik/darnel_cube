import { describe, it, expect } from "vitest";
import { clave, siNo, numero } from "./celdas.js";

describe("clave", () => {
  it("iguala mayúsculas, acentos, espacios y guiones", () => {
    expect(clave("Café  Sol")).toBe(clave("cafe-sol"));
    expect(clave("DC-0715-6400")).toBe(clave("dc07156400"));
  });

  it("iguala un código numérico guardado como texto y como número en archivos distintos", () => {
    // Caso real: el mismo SKU llega "0500123" (texto, con ceros) en un archivo y 500123
    // (número, sin ceros) en otro, porque Excel se los quita a las celdas numéricas.
    // Antes esto hacía que un SKU real se reportara como "no encontrado".
    expect(clave("0500123")).toBe(clave(500123));
    expect(clave("00085000")).toBe(clave(85000));
    expect(clave("0007156400")).toBe(clave(7156400));
  });

  it("no fusiona un código con punto decimal en dígitos de más", () => {
    // "500123.0" (típico de una celda numérica) no debe volverse "5001230" al quitar el punto.
    expect(clave("500123.0")).toBe(clave(500123));
    expect(clave("500123.0")).not.toBe("5001230");
  });

  it("no toca los ceros de un código alfanumérico", () => {
    // Aquí el 0 es parte del código, no un artefacto de Excel: A0057 no es lo mismo que A57.
    expect(clave("A0057")).toBe("a0057");
    expect(clave("A0057")).not.toBe(clave("A57"));
  });

  it("no rompe con vacío, null o undefined", () => {
    expect(clave("")).toBe("");
    expect(clave(null)).toBe("");
    expect(clave(undefined)).toBe("");
  });

  it("quita el contenido entre paréntesis, como en los nombres de hoja", () => {
    expect(clave("Productos (activos)")).toBe("productos");
  });
});

describe("siNo", () => {
  it("reconoce las formas comunes de sí y no, en cualquier acentuación", () => {
    expect(siNo("Sí", false)).toBe(true);
    expect(siNo("X", false)).toBe(true);
    expect(siNo("No", true)).toBe(false);
  });

  it("usa el valor por omisión cuando la celda viene vacía", () => {
    expect(siNo("", true)).toBe(true);
    expect(siNo(undefined, false)).toBe(false);
  });
});

describe("numero", () => {
  it("acepta coma decimal", () => {
    expect(numero("12,5")).toBe(12.5);
  });

  it("usa el valor por omisión cuando no es un número", () => {
    expect(numero("", 3)).toBe(3);
    expect(numero("abc")).toBe(0);
  });
});
