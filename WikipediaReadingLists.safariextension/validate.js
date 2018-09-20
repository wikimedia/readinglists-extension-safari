const projectHosts = [
    'wikipedia.org',
    'wikivoyage.org'
];

function isSupportedHost(hostname) {
    for (let i = 0; i < projectHosts.length; i++) {
        const host = projectHosts[i];
        if (hostname.endsWith(host)) {
            return true;
        }
    }
    return false;
}

function isSavablePage(path, params) {
    return path.includes('/wiki/') || (path.includes('index.php') && params.has('title'));
}

safari.application.addEventListener('validate', function (event) {
    event.target.disabled = true;
    if (event.command === 'wikiAddToReadingList'
        && safari.application.activeBrowserWindow
        && safari.application.activeBrowserWindow.activeTab
        && safari.application.activeBrowserWindow.activeTab.url) {
        const url = new URL(safari.application.activeBrowserWindow.activeTab.url);
        event.target.disabled = !(isSupportedHost(url.hostname) && isSavablePage(url.pathname, url.searchParams));
    }
});
