import React from 'react';
import { Head, Link, usePage } from '@/spa/router';
import { routeWithBase } from '@/Utils/url';
import {
    Box,
    Button,
    Chip,
    Container,
    Stack,
    Typography,
} from '@mui/material';
import { ArticleOutlined, ArrowBack, ArrowForward } from '@mui/icons-material';
import Navbar from '@/Components/User/Navbar';
import MobileBottomNav, { MobileBottomNavSpacer } from '@/Components/User/MobileBottomNav';
import Footer from '@/Components/User/Footer';
import UserBrandHead from '@/Components/User/UserBrandHead';
import { blogThumbnailSource } from '@/Utils/blogMedia';
import { usePhraseTranslation } from '@/Utils/i18n';
import { useTheme } from '@mui/material/styles';
import { storefrontBackgroundSx } from '@/Components/User/musicStoreDesign';

const formatDate = (value) => {
    if (!value) return '';
    return new Date(value).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
};

function RelatedCard({ post }) {
    const { app_base, app_settings } = usePage().props;
    const thumbnail = blogThumbnailSource(post, app_settings);

    return (
        <Box
            component={Link}
            href={routeWithBase(`/blogs/${post.slug}`, app_base)}
            sx={{
                display: 'grid',
                gridTemplateColumns: '96px 1fr',
                gap: 1.5,
                color: 'inherit',
                textDecoration: 'none',
                alignItems: 'center',
            }}
        >
            <Box sx={{ aspectRatio: '16 / 9', borderRadius: 1, bgcolor: 'primary.light', overflow: 'hidden', display: 'grid', placeItems: 'center' }}>
                {thumbnail.url ? (
                    <Box
                        component="img"
                        src={thumbnail.url}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        sx={{
                            width: thumbnail.type === 'app-icon' ? '52%' : '100%',
                            height: thumbnail.type === 'app-icon' ? '52%' : '100%',
                            objectFit: thumbnail.type === 'app-icon' ? 'contain' : 'cover',
                        }}
                    />
                ) : (
                    <ArticleOutlined sx={{ color: 'primary.main' }} />
                )}
            </Box>
            <Box>
                <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.25 }}>{post.title}</Typography>
                <Typography variant="caption" color="text.secondary">{post.category?.name || 'Blog'}</Typography>
            </Box>
        </Box>
    );
}

export default function BlogShow({ post, related = [] }) {
    const theme = useTheme();
    const { app_base } = usePage().props;
    const t = usePhraseTranslation();

    return (
        <Box className="user-storefront" sx={{ ...storefrontBackgroundSx(theme), minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
            <UserBrandHead title={post.title} />
            <Head title={post.title} />
            <Navbar />

            <Container maxWidth="md" sx={{ py: { xs: '24px', md: '32px' } }}>
                <Button component={Link} href={routeWithBase('/blogs', app_base)} startIcon={<ArrowBack />} sx={{ mb: 2 }}>
                    Blog
                </Button>

                <Stack spacing="8px" sx={{ mb: '20px' }}>
                    <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
                        {post.category && (
                            <Chip
                                label={post.category.name}
                                color="primary"
                                variant="outlined"
                                component={Link}
                                href={routeWithBase(`/blogs?category=${post.category.slug}`, app_base)}
                                clickable
                            />
                        )}
                        <Typography variant="caption" color="text.secondary">{formatDate(post.published_at)}</Typography>
                        {post.author?.name && <Typography variant="caption" color="text.secondary">By {post.author.name}</Typography>}
                    </Stack>
                    <Typography variant="h3" sx={{ fontWeight: 700, fontSize: { xs: '1.5rem', md: '2rem' }, lineHeight: 1.15 }}>
                        {post.title}
                    </Typography>
                    {post.excerpt && <Typography variant="body1" color="text.secondary">{post.excerpt}</Typography>}
                </Stack>

                {post.cover_image_url && (
                    <Box sx={{ aspectRatio: '16 / 9', borderRadius: 1, overflow: 'hidden', mb: 3 }}>
                        <Box component="img" src={post.cover_image_url} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </Box>
                )}

                {post.youtube_embed_url && (
                    <Box sx={{ aspectRatio: '16 / 9', borderRadius: 1, overflow: 'hidden', bgcolor: '#111827', mb: 3 }}>
                        <Box
                            component="iframe"
                            title={post.title}
                            src={post.youtube_embed_url}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                            sx={{ width: '100%', height: '100%', border: 0 }}
                        />
                    </Box>
                )}

                <Box
                    className="blog-content"
                    sx={{
                        bgcolor: 'white',
                        borderRadius: 2,
                        p: { xs: '16px', md: '28px' },
                        border: '1px solid rgba(0,0,0,0.06)',
                        fontSize: { xs: '1rem', md: '1.0625rem' },
                        lineHeight: 1.75,
                        '& p': { lineHeight: 1.75, mb: '16px' },
                        '& h2, & h3, & h4': { mt: 3, mb: 1, lineHeight: 1.2 },
                        '& ul, & ol': { pl: '24px', mb: '16px' },
                        '& li + li': { mt: '8px' },
                        '& img': { maxWidth: '100%', height: 'auto', borderRadius: 2, my: '16px' },
                        '& a': { color: 'primary.main', textUnderlineOffset: '3px' },
                        '& blockquote': { borderLeft: '4px solid', borderColor: 'primary.main', m: 0, my: '20px', p: '16px', bgcolor: 'primary.light', borderRadius: '0 8px 8px 0' },
                    }}
                    dangerouslySetInnerHTML={{ __html: post.content || '' }}
                />

                {(post.tags || []).length > 0 && (
                    <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1, mt: 3 }}>
                        {post.tags.map((tag) => (
                            <Chip
                                key={tag.id}
                                label={`#${tag.name}`}
                                component={Link}
                                href={routeWithBase(`/blogs?tag=${tag.slug}`, app_base)}
                                clickable
                                variant="outlined"
                            />
                        ))}
                    </Stack>
                )}

                {related.length > 0 && (
                    <Box sx={{ mt: '32px', p: { xs: '16px', md: '20px' }, bgcolor: 'white', borderRadius: 2, border: '1px solid rgba(0,0,0,0.06)' }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{t('Related posts')}</Typography>
                            <Button component={Link} href={routeWithBase('/blogs', app_base)} size="small" endIcon={<ArrowForward />}>
                                All posts
                            </Button>
                        </Stack>
                        <Stack spacing={2}>
                            {related.map((item) => <RelatedCard key={item.id} post={item} />)}
                        </Stack>
                    </Box>
                )}
            </Container>

            <Footer />
            <MobileBottomNavSpacer />
            <MobileBottomNav />
        </Box>
    );
}
