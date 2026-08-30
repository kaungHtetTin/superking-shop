#!/usr/bin/env bash

set -Eeuo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_ID="$(date +%Y%m%d-%H%M%S)"
APP_PORT="${APP_PORT:-8765}"
WEBDRIVER_PORT="${WEBDRIVER_PORT:-4444}"
APP_URL="http://127.0.0.1:${APP_PORT}"
WEBDRIVER_URL="http://127.0.0.1:${WEBDRIVER_PORT}"
FRAME_DIR="${PROJECT_DIR}/artifacts/pos-automation-${RUN_ID}"
VIDEO_FILE="${PROJECT_DIR}/artifacts/superking-complete-test-${RUN_ID}.mp4"
LARAVEL_LOG="${PROJECT_DIR}/artifacts/laravel-test-${RUN_ID}.log"
WEBDRIVER_LOG="${PROJECT_DIR}/artifacts/geckodriver-test-${RUN_ID}.log"
LARAVEL_PID=""
WEBDRIVER_PID=""

if ! command -v geckodriver >/dev/null 2>&1 && [[ -x /tmp/geckodriver ]]; then
    PATH="/tmp:${PATH}"
fi

cleanup() {
    if [[ -n "${LARAVEL_PID}" ]] && kill -0 "${LARAVEL_PID}" 2>/dev/null; then
        kill "${LARAVEL_PID}" 2>/dev/null || true
        wait "${LARAVEL_PID}" 2>/dev/null || true
    fi
    if [[ -n "${WEBDRIVER_PID}" ]] && kill -0 "${WEBDRIVER_PID}" 2>/dev/null; then
        kill "${WEBDRIVER_PID}" 2>/dev/null || true
        wait "${WEBDRIVER_PID}" 2>/dev/null || true
    fi
}
trap cleanup EXIT INT TERM

section() {
    printf '\n\033[1;36m[%s]\033[0m\n' "$1"
}

require_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        printf 'Missing required command: %s\n' "$1" >&2
        exit 1
    fi
}

wait_for_url() {
    local url="$1"
    local attempts=40
    while (( attempts > 0 )); do
        if curl --silent --fail --output /dev/null "$url"; then
            return 0
        fi
        sleep 0.5
        attempts=$((attempts - 1))
    done
    return 1
}

cd "${PROJECT_DIR}"
mkdir -p artifacts "${FRAME_DIR}"

section "1/6 Laravel test suite"
php artisan test

section "2/6 Frontend production build"
npm run build

section "3/6 Changed PHP syntax and diff checks"
git diff --check
php -l app/Exceptions/Handler.php
php -l app/Http/Controllers/User/CartController.php
php -l app/Http/Controllers/Admin/PosController.php
php -l app/Services/POS/PosCheckoutService.php
php -l tests/Feature/CheckoutAndCartRegressionTest.php
php -l tests/Feature/ProductUnitArchitectureTest.php

section "4/6 Browser automation prerequisites"
require_command curl
require_command firefox
require_command geckodriver
require_command ffmpeg
require_command python3

section "5/6 Real Firefox POS automation"
APP_ENV=testing \
DB_DATABASE="${BROWSER_DB_DATABASE:-superking_video}" \
DB_USERNAME="${BROWSER_DB_USERNAME:-root}" \
DB_PASSWORD="${BROWSER_DB_PASSWORD:-}" \
php artisan serve --host=127.0.0.1 --port="${APP_PORT}" >"${LARAVEL_LOG}" 2>&1 &
LARAVEL_PID=$!
geckodriver --host 127.0.0.1 --port "${WEBDRIVER_PORT}" >"${WEBDRIVER_LOG}" 2>&1 &
WEBDRIVER_PID=$!

if ! wait_for_url "${APP_URL}/admin/login"; then
    printf 'Laravel did not start. See %s\n' "${LARAVEL_LOG}" >&2
    exit 1
fi
if ! wait_for_url "${WEBDRIVER_URL}/status"; then
    printf 'Firefox WebDriver did not start. See %s\n' "${WEBDRIVER_LOG}" >&2
    exit 1
fi

APP_URL="${APP_URL}" \
WEBDRIVER_URL="${WEBDRIVER_URL}" \
POS_VIDEO_FRAMES="${FRAME_DIR}" \
python3 tests/Browser/record_pos_stage1.py

section "6/6 Export automation video"
ffmpeg -hide_banner -loglevel error -y \
    -framerate 1/4 \
    -pattern_type glob \
    -i "${FRAME_DIR}/*.png" \
    -vf "fps=30,format=yuv420p" \
    -c:v mpeg4 -q:v 3 \
    "${VIDEO_FILE}"

printf '\n\033[1;32mALL TESTS PASSED\033[0m\n'
printf 'Automation video: %s\n' "${VIDEO_FILE}"
printf 'Browser frames:   %s\n' "${FRAME_DIR}"
printf 'Laravel log:      %s\n' "${LARAVEL_LOG}"
printf 'WebDriver log:    %s\n' "${WEBDRIVER_LOG}"
