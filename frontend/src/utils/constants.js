/**
 * Constantes globales y valores predeterminados de estándares operativos.
 * Centraliza los objetivos de GxH, resolución, cierre, TMO y tramos de bonificación
 * para evitar duplicación entre el Dashboard de usuario y el Panel de Administración.
 */

/** Estándares base del servicio cuando no hay configuración personalizada en Supabase */
export const STANDARDS = {
  // Gestiones por Hora (GxH Working)
  GXH_GREEN: 4.00,
  GXH_YELLOW: 3.50,

  // % Resolución Neta (impacta en bonificación)
  RESOLUTION_GREEN: 84.0,
  RESOLUTION_YELLOW: 81.0,

  // % Cierre (objetivo operativo, no bonifica directamente)
  CLOSED_GREEN: 78.8,
  CLOSED_YELLOW: 76.8,

  // Tiempos objetivo en segundos (TMO)
  TIME_PER_CASE: 950,
  TIME_PER_MANAGED: 950,
};

/** Tramos predeterminados de bonificación por Gestiones por Hora (GxH) */
export const DEFAULT_GXH_TIERS = [
  { min: 4.50, bonus: 2.0 },
  { min: 4.00, bonus: 1.0 },
  { min: 3.50, bonus: 0.0 },
  { min: 3.00, bonus: -1.0 },
  { min: 0.00, bonus: -2.0 }
];

/** Tramos predeterminados de bonificación por % de Resolución Neta */
export const DEFAULT_RESOLUTION_TIERS = [
  { min: 84.50, bonus: 3.0 },
  { min: 83.50, bonus: 2.0 },
  { min: 82.40, bonus: 1.0 },
  { min: 81.30, bonus: 0.0 },
  { min: 80.20, bonus: -1.0 },
  { min: 0.00, bonus: -2.0 }
];

/** Cuentas de Administrador Total protegidas contra eliminación, baneo o degradación */
export const SUPER_ADMIN_EMAILS = new Set([
  'luis.acosta@konecta.com',
  'lacosta161999@gmail.com'
]);
