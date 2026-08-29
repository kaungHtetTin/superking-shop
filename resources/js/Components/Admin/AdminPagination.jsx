import { Link } from '@/spa/router';

const cleanLabel = (label = '') =>
    label.includes('&laquo;')
        ? 'Previous'
        : label.includes('&raquo;')
            ? 'Next'
            : label.replace(/&amp;/g, '&');

export default function AdminPagination({ paginator, label = 'records' }) {
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
                            href={link.url}
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
