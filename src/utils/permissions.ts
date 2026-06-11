import { Role } from '@prisma/client';

/**
 * Explicit application capabilities mapped out for fine-grained 
 * access control verification checks.
 */
export const PERMISSIONS = {
  // Global Management Insights
  VIEW_ENTERPRISE_ANALYTICS: 'view:enterprise_analytics',
  MANAGE_SYSTEM_BRANCHES: 'manage:branches',

  // Local Branch Logistics
  MANAGE_LOCAL_INVENTORY: 'manage:local_inventory',
  VIEW_LOCAL_INVENTORY: 'view:local_inventory',

  // Order Lifecycles
  PLACE_ORDER: 'create:order',
  UPDATE_ORDER_STATUS: 'update:order_status',
  VIEW_ORDERS: 'view:orders',

  // Reservation Lifecycles
  BOOK_TABLE: 'create:reservation',
  VIEW_RESERVATIONS: 'view:reservations',
  CONFIRM_RESERVATIONS: 'update:reservation_status',

  // User Management
  MANAGE_USERS: 'manage:users',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

/**
 * Role-Based Capability Matrix defining exactly what operations
 * each database user level is authenticated to perform.
 */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: Object.values(PERMISSIONS), // Admins inherit every single capability
  
  HQ_MANAGER: [
    PERMISSIONS.VIEW_ENTERPRISE_ANALYTICS,
    PERMISSIONS.VIEW_LOCAL_INVENTORY,
    PERMISSIONS.VIEW_ORDERS,
    PERMISSIONS.VIEW_RESERVATIONS,
    PERMISSIONS.CONFIRM_RESERVATIONS,
    PERMISSIONS.MANAGE_USERS,
  ],
  
  BRANCH_MANAGER: [
    PERMISSIONS.MANAGE_LOCAL_INVENTORY,
    PERMISSIONS.VIEW_LOCAL_INVENTORY,
    PERMISSIONS.UPDATE_ORDER_STATUS,
    PERMISSIONS.VIEW_ORDERS,
    PERMISSIONS.VIEW_RESERVATIONS,
    PERMISSIONS.CONFIRM_RESERVATIONS,
  ],
  
  CHIEF: [ // (Chef)
    PERMISSIONS.VIEW_LOCAL_INVENTORY,
    PERMISSIONS.UPDATE_ORDER_STATUS,
    PERMISSIONS.VIEW_ORDERS,
  ],
  
  CHEF: [ // (Chef)
    PERMISSIONS.VIEW_LOCAL_INVENTORY,
    PERMISSIONS.UPDATE_ORDER_STATUS,
    PERMISSIONS.VIEW_ORDERS,
  ],
  
  CASHIER: [
    PERMISSIONS.UPDATE_ORDER_STATUS,
    PERMISSIONS.VIEW_ORDERS,
  ],
  
  WAITER: [
    PERMISSIONS.PLACE_ORDER,
    PERMISSIONS.VIEW_ORDERS,
  ],
  
  DELIVERY_GUY: [
    PERMISSIONS.UPDATE_ORDER_STATUS,
    PERMISSIONS.VIEW_ORDERS,
  ],
  
  CUSTOMER: [
    PERMISSIONS.PLACE_ORDER,
    PERMISSIONS.VIEW_ORDERS,
    PERMISSIONS.BOOK_TABLE,
    PERMISSIONS.VIEW_RESERVATIONS,
  ],
  
  HOST: [
    PERMISSIONS.VIEW_RESERVATIONS,
    PERMISSIONS.BOOK_TABLE,
  ],
  
  OPEN_AREA: [] // Baseline public/unauthenticated tier
};

/**
 * Helper utility to cleanly validate if a specific role possesses a target capability
 */
export const hasPermission = (role: Role, permission: Permission): boolean => {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
};
