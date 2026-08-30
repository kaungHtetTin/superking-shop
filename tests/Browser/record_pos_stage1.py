#!/usr/bin/env python3
"""Record the Stage 1 POS acceptance flow with Firefox WebDriver.

Uses only Python's standard library so it can run without Selenium.
"""

import base64
import json
import os
import time
import urllib.error
import urllib.request


WEBDRIVER = os.environ.get("WEBDRIVER_URL", "http://127.0.0.1:4444")
APP_URL = os.environ.get("APP_URL", "http://127.0.0.1:8765")
OUTPUT = os.environ.get("POS_VIDEO_FRAMES", "artifacts/pos-automation-frames")
ELEMENT_KEY = "element-6066-11e4-a52e-4f735466cecf"


def request(method, path, payload=None):
    data = None if payload is None else json.dumps(payload).encode()
    req = urllib.request.Request(
        WEBDRIVER + path,
        data=data,
        method=method,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            body = json.loads(response.read().decode() or "{}")
    except urllib.error.HTTPError as error:
        raise RuntimeError(error.read().decode()) from error
    return body.get("value")


session = request("POST", "/session", {
    "capabilities": {
        "alwaysMatch": {
            "browserName": "firefox",
            "acceptInsecureCerts": True,
            "moz:firefoxOptions": {"args": ["-headless", "--width=1440", "--height=900"]},
        }
    }
})
session_id = session["sessionId"]
base = f"/session/{session_id}"
os.makedirs(OUTPUT, exist_ok=True)
frame_number = 0


def find(selector, by="css selector", timeout=15):
    deadline = time.time() + timeout
    last_error = None
    while time.time() < deadline:
        try:
            value = request("POST", base + "/element", {"using": by, "value": selector})
            if value:
                return value[ELEMENT_KEY]
        except RuntimeError as error:
            last_error = error
        time.sleep(0.25)
    raise RuntimeError(f"Element not found: {selector}\n{last_error or ''}")


def click(selector, by="css selector", timeout=15):
    element = find(selector, by, timeout)
    request("POST", base + f"/element/{element}/click", {})
    return element


def type_into(selector, text, by="css selector", clear=True):
    element = find(selector, by)
    if clear:
        request("POST", base + f"/element/{element}/clear", {})
    request("POST", base + f"/element/{element}/value", {"text": str(text), "value": list(str(text))})
    return element


def execute(script, args=None):
    return request("POST", base + "/execute/sync", {"script": script, "args": args or []})


def wait_for_url(fragment, timeout=20):
    deadline = time.time() + timeout
    while time.time() < deadline:
        current = request("GET", base + "/url")
        if fragment in current:
            return current
        time.sleep(0.25)
    raise RuntimeError(f"URL never contained {fragment}")


def wait_until_logged_in(timeout=20):
    deadline = time.time() + timeout
    while time.time() < deadline:
        current = request("GET", base + "/url")
        if "/admin" in current and "/login" not in current:
            return current
        time.sleep(0.25)
    raise RuntimeError("Admin login did not complete")


def shot(label, pause=1.2):
    global frame_number
    time.sleep(pause)
    frame_number += 1
    encoded = request("GET", base + "/screenshot")
    filename = os.path.join(OUTPUT, f"{frame_number:02d}-{label}.png")
    with open(filename, "wb") as image:
        image.write(base64.b64decode(encoded))
    print(filename, flush=True)


try:
    request("POST", base + "/url", {"url": APP_URL + "/admin/login"})
    find("input[name='email']")
    shot("admin-login")
    type_into("input[name='email']", "admin@onlineshop.com")
    type_into("input[name='password']", "password")
    click("button[type='submit']")
    wait_until_logged_in()

    request("POST", base + "/url", {"url": APP_URL + "/admin/pos"})
    find("input[placeholder*='Scan barcode']", timeout=25)
    shot("pos-ready")

    search = type_into("input[placeholder*='Scan barcode']", "Aquila")
    request("POST", base + f"/element/{search}/value", {"text": "\ue007", "value": ["\ue007"]})
    find("//*[contains(text(),'Aquila Classic Acoustic Guitar')]", "xpath", timeout=20)
    shot("product-added")

    click("//div[contains(@class,'pos-console__line-options')]//*[@role='combobox'][1]", "xpath")
    click("//*[@role='option' and contains(.,'Box')]", "xpath")
    shot("box-unit-selected")

    click("//button[contains(.,'Sell')]", "xpath")
    find("//h2[contains(.,'Complete Sale')]", "xpath")
    shot("checkout-requires-shift")

    type_into("//*[contains(@class,'pos-console__payment-window')]//label[contains(.,'Opening cash')]/following::input[1]", "100000", "xpath")
    click("//*[contains(@class,'pos-console__payment-window')]//button[contains(.,'Open shift')]", "xpath")
    find("//*[contains(text(),'Register shift opened') or contains(text(),'Open shift #')]", "xpath", timeout=20)
    shot("shift-opened")

    type_into("//*[contains(@class,'pos-console__payment-window')]//label[contains(.,'Cash received')]/following::input[1]", "100", "xpath")
    shot("underpayment-blocked")

    type_into("//*[contains(@class,'pos-console__payment-window')]//label[contains(.,'Cash received')]/following::input[1]", "1000000", "xpath")
    shot("change-calculated")

    click("//*[contains(@class,'pos-console__payment-window')]//button[contains(.,'Complete Sale')]", "xpath")
    find("//*[contains(text(),'Sale completed')]", "xpath", timeout=25)
    shot("sale-completed", pause=2)
finally:
    request("DELETE", base)

print(f"Captured {frame_number} browser automation frames.")
