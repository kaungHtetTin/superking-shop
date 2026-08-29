const paths = {
    grid: 'M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 0h7v7h-7v-7z',
    box: 'M3 7l9-4 9 4v10l-9 4-9-4V7zm9 2.2L6.5 9.5 12 7.8l5.5 1.7L12 11.2zM5 11.2v6.3l7 3.1v-6.3L5 11.2zm14 0l-7 3.1v6.3l7-3.1v-6.3z',
    bike: 'M5 18a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm14 0a3 3 0 1 1 0-6 3 3 0 0 1 0 6zM7 16h3l2.2-4.4L9 8H7v2h1.5l1.3 2.6L7 16zm5.5-6.5L15 8h3v2h-1.5l-2 4H12l.5-2.5z',
    card: 'M3 6h18v12H3V6zm2 4h14M7 15h4',
    chart: 'M4 19V9m5 10V5m5 14v-8m5 8V11',
    settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm8.5 4a7.5 7.5 0 0 0-.2-1.7l2-1.5-2-3.5-2.3 1a7.6 7.6 0 0 0-2.9-1.7L14.5 2h-5L9.9 4.6a7.6 7.6 0 0 0-2.9 1.7l-2.3-1-2 3.5 2 1.5A7.5 7.5 0 0 0 4.5 12c0 .6.1 1.2.2 1.7l-2 1.5 2 3.5 2.3-1a7.6 7.6 0 0 0 2.9 1.7L9.5 22h5l.6-2.6a7.6 7.6 0 0 0 2.9-1.7l2.3 1 2-3.5-2-1.5c.1-.5.2-1.1.2-1.7z',
    search: 'M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zm8 14-4.2-4.2',
    arrowLeft: 'M19 12H5m0 0 6-6m-6 6 6 6',
    chevronUp: 'M6 15l6-6 6 6',
    chevronDown: 'M6 9l6 6 6-6',
    eye: 'M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6zm9.5 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    desktop: 'M3 4h18v13H3V4zm5 17h8m-4-4v4',
    mobile: 'M8 2h8v20H8V2zm3 17h2',
    bell: 'M12 3a5 5 0 0 1 5 5v3.5l2 3.5H5l2-3.5V8a5 5 0 0 1 5-5zm0 18a2.5 2.5 0 0 0 2.5-2.5h-5A2.5 2.5 0 0 0 12 21z',
    bolt: 'M13 2 4 14h7l-1 8 10-13h-7l1-7z',
    plus: 'M12 5v14M5 12h14',
    close: 'M6 6l12 12M18 6 6 18',
    check: 'M5 12l4 4 10-10',
    navigation: 'M4 20l16-8L4 4v6l10 2-10 2v6z',
    mapPin: 'M12 21s7-4.7 7-11a7 7 0 1 0-14 0c0 6.3 7 11 7 11zm0-9a2 2 0 1 1 0-4 2 2 0 0 1 0 4z',
    wallet: 'M3 7h16a2 2 0 0 1 2 2v2h-4a3 3 0 0 0 0 6h4v2a2 2 0 0 1-2 2H3V7zm14 8h3v-2h-3a1 1 0 0 1 0 2z',
    lock: 'M7 10V8a5 5 0 0 1 10 0v2h2v12H5V10h2zm2 0h6V8a3 3 0 0 0-6 0v2z',
    palette: 'M12 3a9 9 0 0 0 0 18h1.5a1.5 1.5 0 0 0 0-3H12a3 3 0 0 1-3-3 3 3 0 0 1 3-3h.5a1.5 1.5 0 0 0 0-3H12zM7 8.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm10 3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM8.5 14a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z',
    sun: 'M12 4V2m0 20v-2M4 12H2m20 0h-2M5.6 5.6 4.2 4.2m15.6 15.6-1.4-1.4M18.4 5.6 19.8 4.2M4.2 19.8l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
    moon: 'M21 14.5A8.5 8.5 0 0 1 9.5 3 7 7 0 1 0 21 14.5z',
    menu: 'M4 7h16M4 12h16M4 17h16',
    edit: 'M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z',
    trash: 'M4 7h16M9 7V5h6v2m-7 4v7m4-7v7m4-7v7M6 7l1 13h10l1-13',
    external: 'M14 3h7v7M10 14 21 3M21 14v7H3V3h7',
    chat: 'M4 5h16v10H8l-4 4V5z',
    shop: 'M4 7l2-4h12l2 4v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7zm4 0v2m8-2v2',
    tag: 'M3 7l6-4 12 12-4 6-12-12 4-6zM9 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
    barcode: 'M4 5v14m3-14v14m3-14v14m4-14v14m2-14v14m4-14v14',
    user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 9a7 7 0 0 1 14 0',
    users: 'M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm10 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm3 10v-2a3 3 0 0 0-2-2.83',
    receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3zm3 5h6M9 11h6M9 15h4',
    storefront: 'M4 10 6 4h12l2 6v10H4V10zm4 0h8',
    logout: 'M10 17l-5-5 5-5M5 12h14',
    image: 'M4 5h16v14H4V5zm0 9 4-4 4 4 4-5 4 5',
    book: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H7a3 3 0 0 0-3 3V5.5zm0 0V22m4-14h8m-8 4h8',
    upload: 'M12 16V4m0 0L7 9m5-5 5 5M4 16v4h16v-4',
    download: 'M12 4v12m0 0 5-5m-5 5-5-5M4 20h16',
    history: 'M4 12a8 8 0 1 0 2.3-5.7L4 8m0-4v4h4m4-1v5l3 2',
    rotateClockwise: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
    truck: 'M3 7h11v8H3V7zm11 0h3l3 4v4h-6V7zm-12 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm14 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM7 10h6',
    wifiOff: 'M2 8.5a16 16 0 0 1 3.2-2M8.5 4.6A16 16 0 0 1 22 8.5M5 13a10 10 0 0 1 12.5-1.2M8.5 16.5a5 5 0 0 1 7 0M12 20h.01M3 3l18 18',
};

export default function Icon({ name, size = 17, className, style }) {
    const d = paths[name];
    if (!d) return null;

    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            style={style}
            aria-hidden="true"
        >
            <path d={d} />
        </svg>
    );
}
