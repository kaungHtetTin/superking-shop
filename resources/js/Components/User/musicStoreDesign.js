import { alpha } from '@mui/material/styles';

export const musicStoreColors = {
    ink: '#171312',
    coal: '#241b18',
    brass: '#c28a2e',
    amber: '#f4c267',
    rosin: '#9c3f2c',
    stage: '#fffaf1',
    sheet: '#fffdf8',
    smoke: '#f2eee5',
};

export const musicGradient = `linear-gradient(135deg, ${musicStoreColors.coal} 0%, #3a211b 44%, ${musicStoreColors.rosin} 100%)`;

export const getMusicStoreColors = (theme) => ({
    ...musicStoreColors,
    brass: theme?.palette?.primary?.dark || musicStoreColors.brass,
    amber: theme?.palette?.primary?.light || musicStoreColors.amber,
    rosin: theme?.palette?.primary?.main || musicStoreColors.rosin,
    stage: theme?.palette?.primary?.main ? alpha(theme.palette.primary.main, 0.06) : musicStoreColors.stage,
    sheet: theme?.palette?.background?.paper || musicStoreColors.sheet,
});

export const musicGradientForTheme = (theme) => {
    const colors = getMusicStoreColors(theme);
    return `linear-gradient(135deg, ${musicStoreColors.coal} 0%, ${colors.brass} 48%, ${colors.rosin} 100%)`;
};

export const storefrontBackgroundSx = (theme) => {
    const colors = getMusicStoreColors(theme);

    return {
        bgcolor: colors.stage,
        backgroundImage: `linear-gradient(180deg, ${alpha(colors.rosin, 0.12)} 0%, ${alpha(colors.amber, 0.2)} 48%, ${colors.sheet} 100%)`,
    };
};

export const glassPanelSx = {
    bgcolor: 'rgba(255, 253, 248, 0.9)',
    border: '1px solid rgba(36, 27, 24, 0.1)',
    boxShadow: '0 18px 48px rgba(36, 27, 24, 0.08)',
    backdropFilter: 'blur(14px)',
};

export const sectionShellSx = {
    bgcolor: musicStoreColors.sheet,
    border: '1px solid rgba(36, 27, 24, 0.08)',
    borderRadius: 2,
    boxShadow: '0 14px 38px rgba(36, 27, 24, 0.065)',
};

export const sectionShellSxForTheme = (theme) => {
    const colors = getMusicStoreColors(theme);

    return {
        bgcolor: colors.sheet,
        border: `1px solid ${alpha(colors.rosin, 0.12)}`,
        borderRadius: 2,
        boxShadow: `0 14px 38px ${alpha(colors.rosin, 0.07)}`,
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
