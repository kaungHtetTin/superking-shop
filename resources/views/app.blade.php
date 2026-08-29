<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        @php($publicSettings = app(\App\Services\AppSettingsService::class)->publicSettings())
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">
        @if(!empty($publicSettings['theme_color']))
            <meta name="theme-color" content="{{ $publicSettings['theme_color'] }}">
        @endif
        @if(!empty($publicSettings['favicon_url']))
            <link rel="icon" href="{{ $publicSettings['favicon_url'] }}">
            <link rel="apple-touch-icon" href="{{ $publicSettings['favicon_url'] }}">
        @endif

        <title>{{ $publicSettings['app_name'] ?? config('app.name', 'Laravel') }}</title>

        <!-- Fonts -->
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Myanmar:wght@400;500;600;700&family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">

        <!-- Scripts -->
        @viteReactRefresh
        @vite(['resources/js/app.jsx'])
    </head>
    <body class="font-sans antialiased">
        <div id="app"></div>
        <script>
            window.__SPA_PAGE__ = @json($page ?? null);
        </script>
    </body>
</html>
