export const youtubeThumbnailUrl = (videoId) => (
    videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null
);

export const appIconUrl = (settings = {}) => (
    settings.logo_url || settings.favicon_url || null
);

export const blogThumbnailSource = (post = {}, settings = {}) => {
    if (post.cover_image_url) {
        return { type: 'image', url: post.cover_image_url };
    }

    if (post.youtube_video_id) {
        return { type: 'youtube', url: youtubeThumbnailUrl(post.youtube_video_id) };
    }

    const icon = appIconUrl(settings);
    if (icon) {
        return { type: 'app-icon', url: icon };
    }

    return { type: 'placeholder', url: null };
};
