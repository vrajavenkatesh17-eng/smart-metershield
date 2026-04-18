// Cost estimator — tariff stored in localStorage, defaults to ₹6.50/kWh (India avg).
const KEY = "voltguard.tariff";
const DEFAULT = 6.5;

export const getTariff = (): number => {
  const v = typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
  const n = v ? Number(v) : DEFAULT;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT;
};

export const setTariff = (v: number) => {
  if (typeof window !== "undefined") localStorage.setItem(KEY, String(v));
};

export const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
