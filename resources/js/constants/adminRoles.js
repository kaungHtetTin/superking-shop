export const adminRoleLabels = {
    super_admin: 'Super Admin',
    manager: 'Manager',
    staff: 'Staff',
};

export function roleStatusClass(role) {
    if (role === 'super_admin') return 'status-info';
    if (role === 'manager') return 'status-success';
    if (role === 'staff') return 'status-neutral';
    return 'status-neutral';
}
