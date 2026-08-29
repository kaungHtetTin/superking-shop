import { createTheme } from '@mui/material/styles';

const clamp = (value) => Math.max(0, Math.min(255, value));

const hexToRgb = (hex) => {
    const clean = String(hex || '').replace('#', '');
    if (!/^[0-9a-fA-F]{6}$/.test(clean)) {
        return { r: 233, g: 30, b: 99 };
    }

    return {
        r: parseInt(clean.slice(0, 2), 16),
        g: parseInt(clean.slice(2, 4), 16),
        b: parseInt(clean.slice(4, 6), 16),
    };
};

const rgbToHex = ({ r, g, b }) =>
    `#${[r, g, b].map((part) => clamp(Math.round(part)).toString(16).padStart(2, '0')).join('')}`;

const mix = (hex, target, weight) => {
    const a = hexToRgb(hex);
    const b = hexToRgb(target);

    return rgbToHex({
        r: a.r * (1 - weight) + b.r * weight,
        g: a.g * (1 - weight) + b.g * weight,
        b: a.b * (1 - weight) + b.b * weight,
    });
};

export const createUserTheme = (settings = {}) => {
    const primary = /^#[0-9a-fA-F]{6}$/.test(settings?.theme_color || '')
        ? settings.theme_color
        : '#E91E63';
    const secondary = '#FF5C8A';
    const background = '#FFFDF8';
    const primaryLight = mix(primary, '#ffffff', 0.72);
    const primaryDark = mix(primary, '#000000', 0.22);

    return createTheme({
    storefront: {
        pageGutter: { xs: 12, sm: 20, lg: 24 },
        pageTop: { xs: 16, md: 24 },
        sectionGap: { xs: 24, md: 32 },
        panelPadding: { xs: 16, sm: 20, md: 24 },
        cardPadding: { xs: 12, sm: 14 },
        gridGap: { xs: 10, sm: 12, md: 16 },
        controlHeight: 46,
        contentMaxWidth: 1200,
    },
    palette: {
        primary: {
            main: primary,
            light: primaryLight,
            dark: primaryDark,
            contrastText: '#fff',
        },
        secondary: {
            main: secondary,
            light: mix(secondary, '#ffffff', 0.55),
            dark: mix(secondary, '#000000', 0.22),
            contrastText: '#fff',
        },
        background: {
            default: background,
            paper: '#FFFFFF',
        },
        text: {
            primary: '#2D3436',
            secondary: '#636E72',
        },
    },
    shape: {
        borderRadius: 6,
    },
    // Keep the granular unit for legacy screens. New storefront layout spacing
    // uses the explicit `storefront` tokens above so intent stays obvious.
    spacing: 4,
    typography: {
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans Myanmar", Arial, sans-serif',
        h1: { fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.12 },
        h2: { fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.14 },
        h3: { fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.015em', lineHeight: 1.18 },
        h4: { fontSize: '1.375rem', fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.2 },
        h5: { fontSize: '1.125rem', fontWeight: 600, letterSpacing: '-0.005em', lineHeight: 1.25 },
        h6: { fontSize: '1rem', fontWeight: 600, lineHeight: 1.3 },
        subtitle1: { fontSize: '0.9375rem', fontWeight: 600, lineHeight: 1.4 },
        subtitle2: { fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.4 },
        body1: { fontSize: '0.9375rem', fontWeight: 400, lineHeight: 1.6 },
        body2: { fontSize: '0.8125rem', fontWeight: 400, lineHeight: 1.55 },
        caption: { fontSize: '0.72rem', fontWeight: 400, lineHeight: 1.45 },
        overline: { fontSize: '0.68rem', lineHeight: 1.4, fontWeight: 700, letterSpacing: '0.06em' },
        button: {
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.8125rem',
            lineHeight: 1.2,
        },
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    borderRadius: 8,
                    padding: '10px 16px',
                    minHeight: 44,
                    boxShadow: 'none',
                    '&:hover': {
                        boxShadow: `0px 2px 8px ${mix(primary, '#ffffff', 0.55)}66`,
                    },
                },
                containedPrimary: {
                    background: primary,
                    '&:hover': {
                        background: primaryDark,
                    }
                },
            },
        },
        MuiIconButton: {
            styleOverrides: {
                root: {
                    minWidth: 44,
                    minHeight: 44,
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    borderRadius: 12,
                    boxShadow: '0 12px 34px rgba(36, 27, 24, 0.07)',
                    border: '1px solid rgba(0, 0, 0, 0.08)',
                    overflow: 'hidden',
                },
            },
        },
        MuiContainer: {
            styleOverrides: {
                root: {
                    minWidth: 0,
                },
            },
        },
        MuiTextField: {
            defaultProps: {
                size: 'small',
            },
        },
        MuiOutlinedInput: {
            styleOverrides: {
                root: {
                    minHeight: 46,
                    borderRadius: 8,
                    backgroundColor: '#FFFFFF',
                },
                input: {
                    padding: '11px 14px',
                    fontSize: '0.875rem',
                },
            },
        },
        MuiFormControl: {
            defaultProps: {
                size: 'small',
            },
        },
        MuiSelect: {
            styleOverrides: {
                select: {
                    minHeight: '1.4375em',
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                },
            },
        },
        MuiDialogTitle: {
            styleOverrides: {
                root: {
                    padding: '20px 20px 8px',
                    fontSize: '1rem',
                    fontWeight: 700,
                },
            },
        },
        MuiDialogContent: {
            styleOverrides: {
                root: {
                    padding: '16px 20px',
                },
            },
        },
        MuiDialogActions: {
            styleOverrides: {
                root: {
                    gap: 8,
                    padding: '12px 20px 20px',
                },
            },
        },
        MuiListItemButton: {
            styleOverrides: {
                root: {
                    minHeight: 44,
                },
            },
        },
        MuiChip: {
            styleOverrides: {
                root: {
                    minHeight: 28,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                },
            },
        },
        MuiPaginationItem: {
            styleOverrides: {
                root: {
                    minWidth: 36,
                    height: 36,
                },
            },
        },
    },
    });
};

const theme = createUserTheme();

export default theme;
