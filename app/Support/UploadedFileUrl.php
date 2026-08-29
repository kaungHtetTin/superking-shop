<?php

namespace App\Support;

class UploadedFileUrl
{
    public static function make(?string $path): ?string
    {
        if (! $path) {
            return null;
        }

        if (str_starts_with($path, 'http://') || str_starts_with($path, 'https://') || str_starts_with($path, '//')) {
            return $path;
        }

        $path = ltrim($path, '/');

        if (str_starts_with($path, 'storage/')) {
            $path = 'uploads/'.substr($path, strlen('storage/'));
        } elseif (! str_starts_with($path, 'uploads/')) {
            $path = 'uploads/'.$path;
        }

        return asset($path);
    }
}
