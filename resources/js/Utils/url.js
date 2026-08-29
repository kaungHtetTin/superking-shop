/**
 * Prepend the application base path to a given URL.
 * 
 * @param {string} path 
 * @param {string} base 
 * @returns {string}
 */
/**
 * Build `/api/...` URL respecting an app subdirectory base (e.g. `/larlarpick/public`).
 *
 * @param {string} path
 * @param {string} base
 * @returns {string}
 */
export const apiUrl = (path, base = '') => {
    if (!path) {
        return `${(base || '').replace(/\/+$/, '')}/api`;
    }
    if (path.startsWith('http') || path.startsWith('//')) return path;

    const cleanBase = (base || '').replace(/\/+$/, '');
    const cleanPath = path.startsWith('/') ? path : `/${path}`;

    return `${cleanBase}/api${cleanPath}`;
};

export const routeWithBase = (path, base = '') => {
    if (!path) return base || '/';
    if (path.startsWith('http') || path.startsWith('//')) return path;
    
    const cleanBase = base.replace(/\/+$/, '');
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    
    return `${cleanBase}${cleanPath}`;
};

/**
 * Get the full URL for an uploaded public file using the request-derived app URL.
 * 
 * @param {string} path 
 * @param {string} appUrl 
 * @returns {string}
 */
export const storageUrl = (path, appUrl = '') => {
    if (!path) return '';
    if (path.startsWith('http') || path.startsWith('//') || path.startsWith('blob:')) return path;
    
    const cleanAppUrl = (appUrl || '').replace(/\/+$/, '');
    const cleanPath = path.replace(/^\/+/, '');

    if (cleanPath.startsWith('uploads/')) {
        return `${cleanAppUrl}/${cleanPath}`;
    }

    // Legacy records store paths such as "products/example.jpg".
    const uploadPath = cleanPath.startsWith('storage/')
        ? cleanPath.replace(/^storage\//, 'uploads/')
        : `uploads/${cleanPath}`;
    
    return `${cleanAppUrl}/${uploadPath}`;
};
