import React from 'react';
import { Head, usePage } from '@/spa/router';
import PwaHeadTags from '@/Components/User/PwaHeadTags';
import { usePhraseTranslation } from '@/Utils/i18n';

export default function UserBrandHead({ title }) {
    const { app_settings } = usePage().props;
    const tp = usePhraseTranslation();
    const appName = app_settings?.app_name || 'Harmony House';
    const displayTitle = tp(title);
    const pageTitle = displayTitle ? `${displayTitle} | ${appName}` : appName;

    return (
        <Head title={pageTitle}>
            <PwaHeadTags />
        </Head>
    );
}
