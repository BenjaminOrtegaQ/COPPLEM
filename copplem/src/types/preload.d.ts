// src/types/preload.d.ts
export {};

type BackupSummary = {
  id: string;
  slug: string;
  createdAt: string;
  sizeBytes: number;
  productos: number;
  ventas: number;
  appVersion: string | null;
  absPath: string;
};

declare global {
  interface Window {
    api: {

      // --- auth ---
      login(payload: { slug: string; username: string; password: string }): Promise<{ ok: true } | { ok: false; error: string }>;
      logout?(): Promise<void>;

      // --- companies ---
      listCompanies(): Promise<{
        slug: string; name: string;
        avatarUrl?: string | null; color?: string | null;
        createdAt?: string | null; updatedAt?: string | null;
        productCount?: number; todaySalesCount?: number;
        lastAccessAt?: string | null;
      }[]>;
      createCompany(payload: {
        name: string;
        admin: { fullName: string; username: string; password: string };
        color: string | null;
        logoDataUrl: string | null;
      }): Promise<{ ok: true; slug: string } | { ok: false; error: string }>;
      editCompany(payload: {
        oldSlug: string; newName: string; color: string | null;
        newLogoDataUrl: string | null; removeLogo: boolean;
      }): Promise<{ ok: true } | { ok: false; error: string }>;
      deleteCompany(slug: string): Promise<{ ok: true } | { ok: false; error: string }>;
      deleteAllCompanies?(): Promise<{ ok: true } | { ok: false; error: string }>;
      uninstallApp?(): Promise<{ ok: true } | { ok: false; error: string } | void>;

      setCompanyOverlay?: (payload: {
        slug?: string | null;
        hint?: string | null;
      }) => Promise<{ ok: true } | { ok: false; error: string }>;


      // products
      createProduct(payload: { slug: string; product: { nombre: string; precio_venta: number; stock_inicial: number } }):
        Promise<{ ok: true; id: number } | { ok: false; error: string }>;
      updateProduct(payload: { slug: string; id: number; patch: Partial<{
        nombre: string; codigo: string | null; categoria_id: number | null;
        precio_compra: number | null; precio_venta: number;
        stock_minimo: number | null; consumo_diario_estimado: number | null;
        alerta_tiempo_unidad: "dias"|"semanas"|"meses" | null;
        alerta_tiempo_cantidad: number | null;
        sku: string | null; codigo_barras: string | null;
      }> }): Promise<{ ok: true } | { ok: false; error: string }>;
      deleteProduct(payload: { slug: string; id: number }):
        Promise<{ ok: true } | { ok: false; error: string }>;
      adjustProductStock(payload: {
        slug: string; producto_id: number; cantidad: number;
        razon: 'AJUSTE'|'CORRECCION'|'PERDIDA'|'DANIO'|'ROBO'|'INVENTARIO'|'VENCIMIENTO'|'OTRO';
        nota?: string | null; usuario_id?: number | null;
      }): Promise<{ ok: true } | { ok: false; error: string }>;

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


      // categories
      listCategories(payload: { slug: string }): Promise<Array<{ id: number; nombre: string; color_hex: string | null }>>;
      createCategory(payload: { slug: string; data: { nombre: string; color_hex?: string | null } }):
        Promise<{ ok: true; id: number } | { ok: false; error: string }>;
      updateCategory(payload: { slug: string; id: number; patch: { nombre?: string; color_hex?: string | null } }):
        Promise<{ ok: true } | { ok: false; error: string }>;
      deleteCategory(payload: { slug: string; id: number }):
        Promise<{ ok: true } | { ok: false; error: string }>;


      // --- business info ---
      getBusinessInfo(slug: string): Promise<{ ok: true; data: any } | { ok: false; error: string }>;
      updateBusinessInfo(payload: { slug: string; data: any }): Promise<{ ok: true } | { ok: false; error: string }>;

      // --- users ---
      listUsers(payload: { slug: string }): Promise<Array<{
        id: number; fullName: string; username: string;
        email?: string | null; role: "admin" | "vendedor";
        enabled: boolean; createdAt?: string | null; lastAccessAt?: string | null;
      }>>;
      countUsers(payload: { slug: string }): Promise<number>;
      createUser(payload: { slug: string; user: {
        fullName: string; username: string; email?: string | null;
        role: "admin" | "vendedor"; enabled?: boolean; password: string;
      }}): Promise<{ ok: true } | { ok: false; error: string }>;
      updateUser(payload: { slug: string; id: number; patch: Partial<{
        fullName: string; username: string; email?: string | null;
        role: "admin" | "vendedor"; enabled?: boolean; password?: string;
      }>}): Promise<{ ok: true } | { ok: false; error: string }>;
      changeUserPassword(payload: { slug: string; id: number; password: string }): Promise<{ ok: true } | { ok: false; error: string }>;
      deleteUser(payload: { slug: string; id: number }): Promise<{ ok: true } | { ok: false; error: string }>;

      stock_actual?: number;

      listProducts(payload: { slug: string; q?: string }):
        Promise<Array<{ id: number; nombre: string; precio_venta: number; stock_actual: number; sku?: string|null; codigo_barras?: string|null }>>;

      pickXlsx(): Promise<{ ok: true; filePath: string } | { ok: false }>;
      importProductsXlsx(payload: { slug: string; filePath: string; options?: { overwrite?: boolean } }):
        Promise<{ ok: true; added: number; skipped: number; errors: Array<{ row: number; error: string; nombre?: string }> } | { ok: false; error: string }>;
      
      createSale(payload: {
        slug: string;
        data: {
          items: Array<{ product_id: number; qty: number; price_unit?: number }>;
          metodo_cobro: 'EFECTIVO'|'TARJETA'|'TRANSFERENCIA'|'MIXTO'|'OTRO';
          descuento_total?: number;
          observacion?: string;
          usuario_id?: number | null;
        };
      }): Promise<{ ok: true; venta_id: number; correlativo: string } | { ok: false; error: string }>;


      // sales
      listSales(payload: {
        slug: string; from?: string; to?: string; q?: string;
        limit?: number; offset?: number;
      }): Promise<{ rows: Array<{
        id: number; fecha: string; correlativo_interno: string;
        cliente_nombre: string | null; metodo_cobro: string;
        subtotal: number; descuento_total: number; total: number;
        items_count: number;
      }>; total: number }>;

      getSale(payload: { slug: string; id: number }): Promise<{
        ok: true; header: {
          id: number; fecha: string; correlativo_interno: string;
          cliente_nombre: string | null; metodo_cobro: string;
          subtotal: number; descuento_total: number; total: number;
        };
        items: Array<{
          id: number; producto_id: number; nombre: string;
          cantidad: number; precio_unit: number; descuento: number; subtotal: number;
        }>;
      } | { ok: false; error: string }>;

      //dashboard

      getDashboard(slug: string): Promise<{
        todaySalesCount: number;
        todayIncome: number;
        weekIncome: number;
        monthIncome: number;
        lowStockCount: number;
        weekSeries: Array<{ date: string; total: number }>;
        catBreakdown: Array<{ name: string; total: number }>;
        grossMarginPct: number | null;
        topProductName: string | null;
        recent: Array<{ when: string; type: "SALE"|"ADJUST"|"PRODUCT"; title: string; subtitle?: string|null; amount?: number|null; qty?: number|null }>;
        currency: string;
      }>;


            // --- reports ---
      getReports(payload: {
        slug: string;
        mode?: "total" | "week" | "month" | "year";
        from?: string;
        to?: string;
      }): Promise<{
        currency: string;
        period: { from: string; to: string; prevFrom: string; prevTo: string };
        mode?: "total"|"week"|"month"|"year";
        kpis: {
          revenue: number; revenueDeltaPct: number | null;
          grossProfit: number; grossProfitDeltaPct: number | null;
          units: number; unitsDeltaPct: number | null;
          transactions: number; transactionsDeltaPct: number | null;
          avgTicket: number;
        };
        trend: Array<{ key: string; total: number; label?: string }>;
        categories: Array<{ name: string; color: string | null; total: number }>;
        topProducts: Array<{
          id: number; nombre: string; sku: string | null;
          categoria: string; categoria_color: string | null;
          units: number; revenue: number;
        }>;
        payments: Array<{ method: string; total: number }>;
      }>;

      exportReportsXlsx(payload: {
        slug: string;
        from?: string;
        to?: string;
        group?: "day" | "month" | "year";
        allTime?: boolean;
        outDir?: string;
        createSubfolder?: boolean;
      }): Promise<{ ok: true; path: string } | { ok: false; error: string }>;

      exportReportsPdf(payload: {
        slug: string;
        from?: string;
        to?: string;
        group?: "day" | "month" | "year";
        allTime?: boolean;
        outDir?: string;
        createSubfolder?: boolean;
      }): Promise<{ ok: true; path: string } | { ok: false; error: string }>;

      // --- util: carpeta/guardar como ---
      pickDirectory(): Promise<string | null>;
      pickSaveFile: (opts: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) => Promise<string | null>;
      revealInFolder: (path: string) => Promise<{ ok: true }>;
      downloadProductsTemplate: (p?: { destPath?: string }) => Promise<{ ok: boolean; dest?: string; error?: string }>;

      // --- backups ---
      listBackups(payload: { slug: string }): Promise<BackupSummary[]>;
      createBackup(payload: { slug: string }): Promise<BackupSummary>;
      restoreBackup(payload: { slug: string; filename: string }): Promise<{ ok: true } | { ok: false; error: string }>;
      restoreBackupFromPath(payload: { slug: string; absPath: string }): Promise<{ ok: true } | { ok: false; error: string }>;
      ensureAutoBackup(payload: { slug: string; maxAgeDays?: number }): Promise<BackupSummary | null>;
      openBackupsFolder(payload: { slug: string }): Promise<string>;
      deleteBackup(payload: { slug: string; filename: string }): Promise<{ ok: true } | { ok: false; error: string }>;
      deleteAllBackupsForSlug(payload: { slug: string }): Promise<{ ok: true; removedDir: boolean }>;

      // ---accesos directos ---
      createCompanyShortcut(payload: {
        slug: string;
        name: string;
        avatarDataUrl?: string | null;
        colorHex?: string | null; 
      }): Promise<{ ok: true; path: string } | { ok: false; error: string }>;


      onOpenLoginFromMain(cb: (slug: string) => void): (() => void) | void;



    };
  }
}

