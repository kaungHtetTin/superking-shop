import { Link } from '@/spa/router';

const cleanLabel = (label = '') =>
    label.includes('&laquo;')
        ? 'Previous'
        : label.includes('&raquo;')
            ? 'Next'
            : label.replace(/&amp;/g, '&');

const withQueryParams = (url, queryParams) => {
    if (!url || !queryParams || Object.keys(queryParams).length === 0) return url;

    const [urlWithoutHash, hash] = url.split('#', 2);
    const [path, existingQuery = ''] = urlWithoutHash.split('?', 2);
    const query = new URLSearchParams(existingQuery);
    Object.entries(queryParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') query.set(key, value);
    });

    const mergedQuery = query.toString();
    if (!mergedQuery) return url;

    return `${path}?${mergedQuery}${hash ? `#${hash}` : ''}`;
};

export default function AdminPagination({ paginator, label = 'records', queryParams = {} }) {
    if (!paginator || paginator.last_page <= 1) {
        return null;
    }

    return (
        <div className="ledger-pagination">
            <small>
                Showing {paginator.from || 0}-{paginator.to || 0} of {paginator.total} {label}
            </small>
            <div className="pagination-links">
                {paginator.links.map((link, index) => {
                    const labelText = cleanLabel(link.label);

                    if (!link.url) {
                        return (
                            <span
                                key={`${labelText}-${index}`}
                                className={`pagination-link disabled ${link.active ? 'active' : ''}`}
                            >
                                {labelText}
                            </span>
                        );
                    }

                    return (
                        <Link
                            key={`${labelText}-${index}`}
                            href={withQueryParams(link.url, queryParams)}
                            className={`pagination-link ${link.active ? 'active' : ''}`}
                            preserveScroll
                        >
                            {labelText}
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
