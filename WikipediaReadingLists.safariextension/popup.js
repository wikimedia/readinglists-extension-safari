function getPopover() {
    return safari.extension.toolbarItems.find(item => item.identifier === 'wikiAddToReadingList').popover;
}

const MESSAGE_KEYS = {
    enableSync: 'readinglists-browser-enable-sync-prompt',
    entryLimitExceeded: 'readinglists-browser-list-entry-limit-exceeded',
    errorIntro: 'readinglists-browser-error-intro',
    infoLinkText: 'readinglists-browser-extension-info-link-text',
    loginButtonText: 'login',
    loginPrompt: 'readinglists-browser-login-prompt',
    success: 'readinglists-browser-add-entry-success'
};

const ALLMESSAGES_QUERY = {
    action: 'query',
    format: 'json',
    formatversion: '2',
    meta: 'allmessages',
    amenableparser: ''
};

function objToQueryString(obj) {
    return Object.keys(obj).map(key => `${key}=${obj[key]}`).join('&');
}

function geti18nMessageUrl(origin, keys) {
    return `${origin}/w/api.php?${objToQueryString(Object.assign(ALLMESSAGES_QUERY, { ammessages: keys.join('|') }))}`;
}

function fetchBundledMessagesForLang(lang) {
    return fetch(`${safari.extension.baseURI}i18n/${lang}.json`);
}

function getBundledMessage(lang, keys) {
    return fetchBundledMessagesForLang(lang).then(res => res.json()).then(res => {
        const result = {};
        keys.forEach(key => {
            result[key] = res[key];
        });
        return result;
    });
}

/**
 * Get UI messages from the MediaWiki API (in the user's preferred UI lang), falling back to bundled
 * English strings if this fails.
 * @param {string} origin the origin of the site URL
 * @param {Array<string>} keys message keys to request
 */
function geti18nMessages(origin, keys) {
    return fetch(geti18nMessageUrl(origin, keys), { credentials: 'same-origin' })
    .then(res => {
        if (!res.ok) {
            throw res;
        } else {
            return res.json();
        }
    })
    .then(res => {
        if (res.query && res.query.allmessages && res.query.allmessages.length) {
            const result = {};
            res.query.allmessages.forEach(messageObj => {
                result[messageObj.name] = messageObj.content;
            });
            return result;
        } else {
           return getBundledMessage('en', keys);
        }
    });
}

function resetContentDivs(doc) {
    doc.querySelectorAll('.container').forEach(div => div.style.display = 'none');
}

function parseTitleFromUrl(href) {
    const url = new URL(href);
    return url.searchParams.has('title') ? url.searchParams.get('title') : url.pathname.replace('/wiki/', '');
}

function show(popover, id) {
    const doc = popover.contentWindow.document;
    doc.getElementById(id).style.display = 'block';
    popover.height = doc.body.clientHeight + 35;
    popover.width = doc.body.clientWidth + 35;
}

function showLoginPage(url, tab) {
    const title = parseTitleFromUrl(url.href);
    let loginUrl = `${url.origin}/wiki/Special:UserLogin?returnto=${encodeURIComponent(title)}`;
    if (url.search) {
        loginUrl = loginUrl.concat(`&returntoquery=${encodeURIComponent(url.search.slice(1))}`);
    }
    tab.url = loginUrl;
}

function showLoginPrompt(popover, tab, url) {
    return geti18nMessages(url.origin, [ MESSAGE_KEYS.loginPrompt, MESSAGE_KEYS.loginButtonText ])
    .then(messages => {
        const doc = popover.contentWindow.document;
        doc.getElementById('loginPromptText').textContent = messages[MESSAGE_KEYS.loginPrompt];
        doc.getElementById('loginButton').textContent = messages[MESSAGE_KEYS.loginButtonText];
        doc.getElementById('loginButton').onclick = () => showLoginPage(url, tab);
        show(popover, 'loginPromptContainer');
    });
}

function showAddToListSuccessMessage(popover, tab, url) {
    return geti18nMessages(url.origin, [ MESSAGE_KEYS.success ])
    .then(messages => {
        const title = parseTitleFromUrl(url.href);
        const message = messages[MESSAGE_KEYS.success].replace('$1', title.replace(/_/g, ' '));
        const doc = popover.contentWindow.document;
        doc.getElementById('successText').textContent = message;
        show(popover, 'addToListSuccessContainer');
    });
}

function showAddToListFailureMessage(popover, tab, url, res) {
    const doc = popover.contentWindow.document;
    return geti18nMessages(url.origin, [
        MESSAGE_KEYS.enableSync,
        MESSAGE_KEYS.infoLinkText,
        MESSAGE_KEYS.entryLimitExceeded,
        MESSAGE_KEYS.errorIntro
    ])
    .then(messages => {
        let message;
        if (res.title === 'readinglists-db-error-not-set-up') {
            message = messages[MESSAGE_KEYS.enableSync];
            const learnMoreLink = doc.getElementById('learnMoreLink');
            learnMoreLink.textContent = messages[MESSAGE_KEYS.infoLinkText];
            learnMoreLink.onclick = () => safari.application.activeBrowserWindow.openTab().url = learnMoreLink.href;
            doc.getElementById('learnMoreLinkContainer').style.display = 'block';
        } else if (res.title === 'readinglists-db-error-entry-limit') {
            const maxEntries = si.query.general['readinglists-config'].maxEntriesPerList;
            message = messages[MESSAGE_KEYS.entryLimitExceeded].replace('$1', maxEntries.toString());
        } else {
            const detail = res.detail ? res.detail : res.title ? res.title : res.type ? res.type : typeof res === 'object' ? JSON.stringify(res) : res;
            message = messages[MESSAGE_KEYS.errorIntro].replace('$1', detail);
        }
        doc.getElementById('failureReason').textContent = message;
        show(popover, 'addToListFailedContainer');
    });
}

function showAddPageToListResult(popover, tab, url, res) {
    if (res.id) {
        showAddToListSuccessMessage(popover, tab, url);
    } else {
        showAddToListFailureMessage(popover, tab, url, res);
    }
}

safari.application.addEventListener('message', (event) => {
    const popover = getPopover();
    const tab = safari.application.activeBrowserWindow.activeTab;
    switch (event.name) {
        case 'wikiExtensionAddPageToReadingList:showLoginPrompt': {
            const {urlString} = event.message;
            showLoginPrompt(popover, tab, new URL(urlString));
            break;
        }
        case 'wikiExtensionAddPageToReadingList:showResult': {
            const {urlString, resString} = event.message;
            showAddPageToListResult(popover, tab, new URL(urlString), JSON.parse(resString));
            break;
        }
        case 'wikiExtensionAddPageToReadingList:showError': {
            const {urlString, errString} = event.message;
            showAddToListFailureMessage(popover, tab, new URL(urlString), JSON.parse(errString));
            break;
        }
    }
});

safari.application.addEventListener('popover', (event) => {
    const tab = safari.application.activeBrowserWindow.activeTab;
    const popover = event.target;
    const doc = popover.contentWindow.document;
    resetContentDivs(doc);
    popover.height = 35;
    popover.width = 35;
    tab.page.dispatchMessage('wikiExtensionAddPageToReadingList', tab.url);
}, true);
