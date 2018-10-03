const projectHosts = [
    'wikipedia.org',
    'wikivoyage.org'
];

const supportedNamespaces = [
    0 // NS_MAIN
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

function setEnabled(target, cond) {
    target.disabled = !cond;
}

safari.application.addEventListener('validate', function (event) {
    if (event.command === 'wikiAddToReadingList') {
        const button = event.target;
        button.disabled = true;
        if (!(safari.application.activeBrowserWindow
            && safari.application.activeBrowserWindow.activeTab
            && safari.application.activeBrowserWindow.activeTab.url)) {
            return;
        }
        const url = new URL(safari.application.activeBrowserWindow.activeTab.url);
        setEnabled(button, isSupportedHost(url.hostname) && isSavablePage(url.pathname, url.searchParams));
        safari.application.addEventListener('message', function (event) {
            if (event.name === 'wikiExtensionFoundPageNamespace') {
                console.log('foo');
                console.log(event.message);
                setEnabled(button, supportedNamespaces.includes(event.message.ns));
            }
        });
        safari.application.activeBrowserWindow.activeTab.page.dispatchMessage('wikiExtensionGetPageNamespace');
    }
});
