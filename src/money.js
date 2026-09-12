// El dinero vive en columnas REAL, así que todo cálculo se redondea a 2
// decimales en el mismo punto. Si no, 3 × 25.5 acaba siendo 76.50000000000001
// y el corte de caja no cuadra por centavos.
export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100
