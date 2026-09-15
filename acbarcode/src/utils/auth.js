/**
 * Shared Authentication Constants & Helpers
 */

export const ADMIN_PASSWORD = 'SUTOadmin1234';
export const USER_PASSWORD = 'SUTOuser1234';

export function verifyAdminPassword(pwd) {
  return pwd === ADMIN_PASSWORD;
}

export function isAdmin() {
  return sessionStorage.getItem('acbarcode_role') === 'admin';
}

export function getAdminPassword() {
  return isAdmin() ? ADMIN_PASSWORD : '';
}
