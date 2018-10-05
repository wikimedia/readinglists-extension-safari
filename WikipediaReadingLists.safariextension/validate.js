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

let button;

safari.application.addEventListener('validate', function (event) {
    if (event.command === 'wikiAddToReadingList') button = event.target;
});

safari.application.addEventListener('message', function (event) {
    if (button && event.name === 'wikiExtensionFoundPageNamespace') {
        setEnabled(button, supportedNamespaces.includes(event.message.ns));
    }
});

safari.application.addEventListener('beforeNavigate', function (event) {
    if (button) button.disabled = true;
});

safari.application.addEventListener('navigate', function (event) {
    const rawUrl = event.target.url;
    if (!rawUrl) return;
    const url = new URL(rawUrl);
    if (isSupportedHost(url.hostname) && isSavablePage(url.pathname, url.searchParams)) {
        event.target.page.dispatchMessage('wikiExtensionGetPageNamespace');
    }
});
