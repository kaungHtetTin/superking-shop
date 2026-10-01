import { Link } from '@/spa/router';
import { Box, Button } from '@mui/material';
import { ArrowBackRounded } from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';

export default function BackLink({ href, children = 'Back', sx = {} }) {
    const theme = useTheme();

    return (
        <Button
            component={Link}
            href={href}
            startIcon={
                <Box
                    component="span"
                    sx={{
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        color: 'primary.main',
                    }}
                >
                    <ArrowBackRounded sx={{ fontSize: 18 }} />
                </Box>
            }
            sx={{
                alignSelf: 'flex-start',
                justifyContent: 'flex-start',
                gap: 0.75,
                px: '12px',
                py: '8px',
                mb: '16px',
                borderRadius: '8px',
                color: 'text.primary',
                bgcolor: 'rgba(255, 255, 255, 0.82)',
                border: `1px solid ${alpha(theme.palette.primary.main, 0.16)}`,
                boxShadow: 'none',
                textTransform: 'none',
                minHeight: 40,
                fontWeight: 700,
                fontSize: '0.82rem',
                lineHeight: 1.2,
                '& .MuiButton-startIcon': {
                    m: 0,
                },
                '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 0.96)',
                    borderColor: alpha(theme.palette.primary.main, 0.28),
                    boxShadow: 'none',
                },
                ...sx,
            }}
        >
            {children}
        </Button>
    );
}
