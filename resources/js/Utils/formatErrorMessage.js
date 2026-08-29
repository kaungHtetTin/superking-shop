export const formatErrorMessage = (error) => {
    if (error === null || error === undefined) return '';

    if (Array.isArray(error)) {
        return error.map(formatErrorMessage).filter(Boolean).join(', ');
    }

    if (typeof error === 'object') {
        const values = Object.values(error).map(formatErrorMessage).filter(Boolean);
        return values.length > 0 ? values.join(', ') : JSON.stringify(error);
    }

    return String(error);
};
