// XXX: Keep in sync with injected.js
const MESSAGE_KEYS = {
    enableSync: 'readinglists-browser-enable-sync-prompt',
    entryLimitExceeded: 'readinglists-browser-list-entry-limit-exceeded',
    errorIntro: 'readinglists-browser-error-intro',
    infoLinkText: 'readinglists-browser-extension-info-link-text',
    loginButtonText: 'login',
    loginPrompt: 'readinglists-browser-login-prompt',
    success: 'readinglists-browser-add-entry-success'
};

function getPopover() {
    return safari.extension.toolbarItems.find(item => item.identifier === 'wikiAddToReadingList').popover;
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

function showAddToListSuccessMessage(popover, tab, url, title, messages) {
    const placeholder = '$1';
    const doc = popover.contentWindow.document;
    const successTextContainer = doc.getElementById('successText');
    const titleElem = document.createElement('b');
    titleElem.textContent = decodeURIComponent(title).replace(/_/g, ' ');
    const message = messages[MESSAGE_KEYS.success];
    successTextContainer.textContent = message;
    const newTextNode = successTextContainer.firstChild.splitText(message.indexOf(placeholder));
    newTextNode.deleteData(0, placeholder.length);
    successTextContainer.insertBefore(titleElem, newTextNode);
    show(popover, 'addToListSuccessContainer');
}

function showLoginPrompt(popover, tab, url, messages) {
    const doc = popover.contentWindow.document;
    doc.getElementById('loginPromptText').textContent = messages[MESSAGE_KEYS.loginPrompt];
    doc.getElementById('loginButton').textContent = messages[MESSAGE_KEYS.loginButtonText];
    doc.getElementById('loginButton').onclick = () => showLoginPage(url, tab);
    show(popover, 'loginPromptContainer');
}

function showEnableSync(popover, tab, url, messages) {
    const doc = popover.contentWindow.document;
    const learnMoreLink = doc.getElementById('learnMoreLink');
    doc.getElementById('failureReason').textContent = messages[MESSAGE_KEYS.enableSync];
    learnMoreLink.textContent = messages[MESSAGE_KEYS.infoLinkText];
    learnMoreLink.onclick = () => safari.application.activeBrowserWindow.openTab().url = learnMoreLink.href;
    doc.getElementById('learnMoreLinkContainer').style.display = 'block';
    show(popover, 'addToListFailedContainer');
}

function showEntryLimitExceeded(popover, tab, messages) {
    const doc = popover.contentWindow.document;
    doc.getElementById('failureReason').textContent = messages[MESSAGE_KEYS.entryLimitExceeded].replace('$1', messages.entryLimit);
    show(popover, 'addToListFailedContainer');
}

function showGenericErrorMessage(popover, tab, err, messages) {
    const doc = popover.contentWindow.document;
    const detail = err.detail ? err.detail : err.title ? err.title : err.type ? err.type : typeof err === 'object' ? JSON.stringify(err) : err;
    doc.getElementById('failureReason').textContent = messages[MESSAGE_KEYS.errorIntro].replace('$1', detail);
    show(popover, 'addToListFailedContainer');
}

function showAddPageToListResult(popover, tab, url, title, res, messages) {
    if (res.id) {
        showAddToListSuccessMessage(popover, tab, url, title, messages);
    } else {
        showGenericErrorMessage(popover, tab, res, messages);
    }
}

safari.application.addEventListener('message', (event) => {
    const popover = getPopover();
    const tab = safari.application.activeBrowserWindow.activeTab;
    const prefix = 'wikiExtensionAddPageToReadingList';
    switch (event.name) {
        case `${prefix}:showAddPageToListResult`: {
            const {urlString, titleString, resString, msgString} = event.message;
            showAddPageToListResult(popover, tab, new URL(urlString), titleString, JSON.parse(resString), JSON.parse(msgString));
            break;
        }
        case `${prefix}:showLoginPrompt`: {
            const {urlString, msgString} = event.message;
            showLoginPrompt(popover, tab, new URL(urlString), JSON.parse(msgString));
            break;
        }
        case `${prefix}:showEnableSync`: {
            const {urlString, msgString} = event.message;
            showEnableSync(popover, tab, new URL(urlString), JSON.parse(msgString));
            break;
        }
        case `${prefix}:showEntryLimitExceeded`: {
            const {msgString} = event.message;
            showEntryLimitExceeded(popover, tab, JSON.parse(msgString));
            break;
        }
        case `${prefix}:showGenericErrorMessage`: {
            const {msgString, errString} = event.message;
            showGenericErrorMessage(popover, tab, JSON.parse(msgString), JSON.parse(errString));
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
