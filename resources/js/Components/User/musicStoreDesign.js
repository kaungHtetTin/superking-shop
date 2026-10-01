import { alpha } from '@mui/material/styles';

export const musicStoreColors = {
    ink: '#172033',
    coal: '#102e38',
    brass: '#087f74',
    amber: '#bde7e1',
    rosin: '#087f74',
    stage: '#eef4f4',
    sheet: '#ffffff',
    smoke: '#f2f6f6',
};

export const musicGradient = `linear-gradient(135deg, ${musicStoreColors.coal} 0%, #125e61 55%, ${musicStoreColors.rosin} 100%)`;

export const getMusicStoreColors = (theme) => ({
    ...musicStoreColors,
    brass: theme?.palette?.secondary?.main || musicStoreColors.brass,
    amber: theme?.palette?.secondary?.light || musicStoreColors.amber,
    rosin: theme?.palette?.primary?.main || musicStoreColors.rosin,
    stage: theme?.palette?.background?.default || musicStoreColors.stage,
    sheet: theme?.palette?.background?.paper || musicStoreColors.sheet,
});

export const musicGradientForTheme = (theme) => {
    const colors = getMusicStoreColors(theme);
    return `linear-gradient(125deg, ${musicStoreColors.coal} 0%, #125e61 58%, ${colors.rosin} 100%)`;
};

export const storefrontBackgroundSx = (theme) => {
    const colors = getMusicStoreColors(theme);

    return {
        bgcolor: colors.stage,
        backgroundImage: 'none',
    };
};

export const glassPanelSx = {
    bgcolor: 'rgba(255, 255, 255, 0.92)',
    border: '1px solid rgba(15, 23, 42, 0.1)',
    boxShadow: '0 2px 8px rgba(15, 23, 42, 0.035)',
};

export const sectionShellSx = {
    bgcolor: musicStoreColors.sheet,
    border: '1px solid rgba(15, 23, 42, 0.09)',
    borderRadius: '10px',
    boxShadow: '0 2px 8px rgba(15, 23, 42, 0.035)',
};

export const sectionShellSxForTheme = (theme) => {
    const colors = getMusicStoreColors(theme);

    return {
        bgcolor: colors.sheet,
        border: `1px solid ${alpha(colors.ink, 0.1)}`,
        borderRadius: '10px',
        boxShadow: '0 2px 8px rgba(15, 23, 42, 0.035)',
    };
};

export const eyebrowSx = {
    color: musicStoreColors.rosin,
    fontSize: '0.68rem',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
};

export const eyebrowSxForTheme = (theme) => ({
    ...eyebrowSx,
    color: getMusicStoreColors(theme).rosin,
});

export const softButtonSx = (theme) => ({
    borderRadius: 1.5,
    borderColor: alpha(theme.palette.primary.main, 0.28),
    color: musicStoreColors.ink,
    bgcolor: musicStoreColors.sheet,
    fontWeight: 700,
    '&:hover': {
        borderColor: theme.palette.primary.main,
        bgcolor: alpha(theme.palette.primary.main, 0.08),
    },
});
