// Re-export semua schema + types per resource.
//
// Side-effect: import setiap file menjalankan `registry.registerPath(...)` yang
// di-define di file itu, sehingga `OpenAPIRegistry` lengkap setelah modul ini
// di-load.

export * from "./common";
export * from "./auth";
export * from "./categories";
export * from "./departments";
export * from "./products";
export * from "./customers";
export * from "./customer-groups";
export * from "./finance";
export * from "./inventory";
export * from "./b2b";
export * from "./commissions";
export * from "./promos";
export * from "./coupons";
export * from "./loyalty";
export * from "./karyawan";
export * from "./keuangan";
export * from "./lainnya";
