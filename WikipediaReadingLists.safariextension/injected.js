function dispatchShow(what, message) {
    return Promise.resolve(safari.self.tab.dispatchMessage('wikiExtensionAddPageToReadingList:' + what, message));
}

function readingListPostEntryUrlForOrigin(origin, listId, token) {
    return `${origin}/api/rest_v1/data/lists/${listId}/entries/?csrf_token=${encodeURIComponent(token)}`;
}

function csrfFetchUrlForOrigin(origin) {
    return `${origin}/w/api.php?action=query&format=json&formatversion=2&meta=tokens&type=csrf`;
}

function getCsrfToken(origin) {
    return fetch(csrfFetchUrlForOrigin(origin), { credentials: 'same-origin' })
    .then(res => res.json())
    .then(res => res.query.tokens.csrftoken);
}

function parseTitleFromUrl(href) {
    const url = new URL(href);
    return url.searchParams.has('title') ? url.searchParams.get('title') : url.pathname.replace('/wiki/', '');
}

function addPageToDefaultList(url, listId, token) {
    return Promise.resolve(parseTitleFromUrl(document.querySelector('link[rel=canonical]').href))
    .then(title => fetch(readingListPostEntryUrlForOrigin(url.origin, listId, token), getAddToListPostOptions(url, title)))
    .then(res => res.json())
    .then(res => dispatchShow('showResult', {urlString: url.href, resString: JSON.stringify(res)}));
}

function getReadingListsUrlForOrigin(origin, next) {
    let result = `${origin}/api/rest_v1/data/lists/`;
    if (next) {
        result = result.concat(`?next=${next}`);
    }
    return result;
}

function getDefaultListId(url, next) {
    return fetch(getReadingListsUrlForOrigin(url.origin, next), { credentials: 'same-origin' })
    .then(res => {
        if (res.status < 200 || res.status > 399) {
            return res.json().then(res => {
                throw res;
            });
        } else {
            return res.json();
        }
    })
    .then(res => {
        const defaultList = res.lists.filter(list => list.default)[0];
        if (defaultList) {
            return defaultList.id;
        } else if (res.next) {
            return getDefaultListId(url, res.next);
        } else {
            throw new Error("no default list");
        }
    });
}

function mobileToCanonicalHost(url) {
    url.hostname = url.hostname.replace(/^m\./, '').replace('.m.', '.');
    return url;
}

function getAddToListPostBody(url, title) {
    return `project=${mobileToCanonicalHost(url).origin}&title=${encodeURIComponent(title)}`;
}

function getAddToListPostOptions(url, title) {
    return {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        credentials: 'same-origin',
        body: getAddToListPostBody(url, title)
    }
}

function handleTokenResult(url, token) {
    return token === '+\\'
        ? dispatchShow('showLoginPrompt', {urlString: url.href})
        : getDefaultListId(url).then(listId => addPageToDefaultList(url, listId, token));
}

function handleClick(url) {
    return getCsrfToken(url.origin).then(token => handleTokenResult(url, token));
}

safari.self.addEventListener('message', (event) => {
    if (event.name === 'wikiExtensionAddPageToReadingList') {
        const urlString = event.message;
        if (urlString) {
            const url = new URL(urlString);
            handleClick(url).catch(err => dispatchShow('showError', {urlString: url.href, errString: err.toString()}));
        }
    }
}, false);
