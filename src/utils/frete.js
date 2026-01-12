export const calcularFrete = (km) => {
  if (km <= 2.0) return 0;
  if (km <= 3.0) return 4.10;
  if (km <= 4.0) return 6.20;
  if (km <= 5.0) return 8.30;
  if (km <= 6.0) return 10.40;
  if (km <= 7.0) return 12.50;
  if (km <= 8.0) return 14.60;
  return 15.00; // Máximo
};