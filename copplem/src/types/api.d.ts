// src/types/api.d.ts
export type Company = {
  slug: string;
  name: string;
  avatarUrl?: string | null;
  color?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  productCount?: number;
  todaySalesCount?: number;
  lastAccessAt?: string | null;
};

export type ApiOk  = { ok: true };
export type ApiErr = { ok: false; error: string };
export type ApiRes = ApiOk | ApiErr;

export type ApiData<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };


/* ===== Reportes (para Reports.tsx) ===== */
export type TrendPoint = { key: string; total: number; label?: string }; // YYYY-MM-DD | YYYY-MM | YYYY
export type Category   = { name: string; color: string | null; total: number };
export type TopProduct = {
  id: number; nombre: string; sku: string | null;
  categoria: string; categoria_color: string | null;
  units: number; revenue: number;
};
export type Pay = { method: string; total: number };

export type ReportsData = {
  currency: string;
  period: { from: string; to: string; prevFrom: string; prevTo: string };
  mode?: "total"|"week"|"month"|"year";
  kpis: {
    revenue: number; revenueDeltaPct: number;
    grossProfit: number; grossProfitDeltaPct: number;
    units: number; unitsDeltaPct: number;
    transactions: number; transactionsDeltaPct: number;
    avgTicket: number;
  };
  trend: TrendPoint[];
  categories: Category[];
  topProducts: TopProduct[];
  payments: Pay[];
};


declare global {
  interface Window {
    api: {
      // --- auth ---
      login(payload: { slug: string; username: string; password: string }): Promise<ApiRes>;
      logout?(): Promise<void>;

      // --- companies ---
      listCompanies(): Promise<Company[]>;
      createCompany(payload: {
        name: string;
        admin: { fullName: string; username: string; password: string };
        color: string | null;
        logoDataUrl: string | null;
      }): Promise<{ ok: true; slug: string } | { ok: false; error: string }>;
      editCompany(payload: {
        oldSlug: string;
        newName: string;
        color: string | null;
        newLogoDataUrl: string | null;
        removeLogo: boolean;
      }): Promise<ApiRes>;
      deleteCompany(slug: string): Promise<ApiRes>;
      deleteAllCompanies?(): Promise<ApiRes>;
      uninstallApp?(): Promise<ApiRes | void>;

      // --- products ---
      listProducts(payload: { slug: string; q?: string }): Promise<any>;
      createProduct(payload: { slug: string; product: { nombre: string; precio_venta: number; stock_inicial: number } }): Promise<ApiRes>;

      // --- business info ---
      getBusinessInfo(slug: string): Promise<ApiData<any>>; 
      updateBusinessInfo(payload: { slug: string; data: any }): Promise<ApiRes>;

      // --- users ---
      listUsers(payload: { slug: string }): Promise<Array<{
        id: number;
        fullName: string;
        username: string;
        email?: string | null;
        role: "admin" | "vendedor";
        enabled: boolean;
        createdAt?: string | null;
        lastAccessAt?: string | null;
      }>>;
      countUsers(payload: { slug: string }): Promise<number>;
      createUser(payload: { slug: string; user: {
        fullName: string; username: string; email?: string | null;
        role: "admin" | "vendedor"; enabled?: boolean; password: string;
      }}): Promise<ApiRes>;
      updateUser(payload: { slug: string; id: number; patch: Partial<{
        fullName: string; username: string; email?: string | null;
        role: "admin" | "vendedor"; enabled?: boolean; password?: string;
      }>}): Promise<ApiRes>;
      changeUserPassword(payload: { slug: string; id: number; password: string }): Promise<ApiRes>;
      deleteUser(payload: { slug: string; id: number }): Promise<ApiRes>;



      // --- reports ---
      getReports(payload: {
        slug: string;
        mode?: "total" | "week" | "month" | "year";
        from?: string;
        to?: string;
      }): Promise<ReportsData>;

      exportReportsXlsx(payload: {
        slug: string;
        from?: string;
        to?: string;
        group?: "day" | "month" | "year";
        allTime?: boolean;
      }): Promise<{ ok: true; path: string } | { ok: false; error: string }>;

      autoAlertsSuggest(payload: {
        slug: string;
        producto_id: number;
        windowDays?: number;
        targetCoverageDays?: number;
      }): Promise<{
        ok: true;
        windowDays: number;
        desde: string;
        hasta: string;
        consumo_diario_estimado: number;
        cobertura_dias: number;
        stock_minimo: number | null;
      } | { ok: false; error: string }>;


    };
  }
}

export {};

