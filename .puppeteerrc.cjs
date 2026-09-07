const path = require('path');

// Share the browser installation between the CLI and the web-server account.
module.exports = {
    cacheDirectory: path.join(__dirname, 'storage', 'app', 'puppeteer'),
};
