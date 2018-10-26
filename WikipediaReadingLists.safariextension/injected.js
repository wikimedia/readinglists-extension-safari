// XXX: Keep in sync with popup.js
const MESSAGE_KEYS = {
  enableSync: "readinglists-browser-enable-sync-prompt",
  entryLimitExceeded: "readinglists-browser-list-entry-limit-exceeded",
  errorIntro: "readinglists-browser-error-intro",
  infoLinkText: "readinglists-browser-extension-info-link-text",
  loginButtonText: "login",
  loginPrompt: "readinglists-browser-login-prompt",
  success: "readinglists-browser-add-entry-success"
};

const ALLMESSAGES_QUERY = {
  action: "query",
  format: "json",
  formatversion: "2",
  meta: "allmessages|siteinfo",
  amenableparser: ""
};

function objToQueryString(obj) {
  return Object.keys(obj)
    .map(key => `${key}=${obj[key]}`)
    .join("&");
}

function dispatchShow(what, message) {
  return Promise.resolve(
    safari.self.tab.dispatchMessage(
      "wikiExtensionAddPageToReadingList:" + what,
      message
    )
  );
}

function readingListPostEntryUrlForOrigin(origin, listId, token) {
  return `${origin}/api/rest_v1/data/lists/${listId}/entries/?csrf_token=${encodeURIComponent(
    token
  )}`;
}

function csrfFetchUrlForOrigin(origin) {
  return `${origin}/w/api.php?action=query&format=json&formatversion=2&meta=tokens&type=csrf`;
}

function geti18nMessageUrl(origin, keys) {
  return `${origin}/w/api.php?${objToQueryString(
    Object.assign(ALLMESSAGES_QUERY, { ammessages: keys.join("|") })
  )}`;
}

function getCsrfToken(origin) {
  return fetch(csrfFetchUrlForOrigin(origin), { credentials: "same-origin" })
    .then(res => res.json())
    .then(res => res.query.tokens.csrftoken);
}

function fetchBundledMessagesForLang(lang) {
  return fetch(`${safari.extension.baseURI}i18n/${lang}.json`);
}

function getBundledMessages(lang, keys) {
  return fetchBundledMessagesForLang(lang)
    .then(res => res.json())
    .then(res => {
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
  return fetch(geti18nMessageUrl(origin, keys), { credentials: "same-origin" })
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
        result.entryLimit =
          res.query.general &&
          res.query.general["readinglists-config"] &&
          res.query.general["readinglists-config"].maxEntriesPerList &&
          res.query.general["readinglists-config"].maxEntriesPerList.toString();
        return result;
      } else {
        return getBundledMessages("en", keys);
      }
    });
}

function parseTitleFromUrl(href) {
  const url = new URL(href);
  return url.searchParams.has("title")
    ? url.searchParams.get("title")
    : url.pathname.replace("/wiki/", "");
}

function addPageToDefaultList(url, listId, token) {
  return Promise.resolve(
    parseTitleFromUrl(document.querySelector("link[rel=canonical]").href)
  ).then(title =>
    fetch(
      readingListPostEntryUrlForOrigin(url.origin, listId, token),
      getAddToListPostOptions(url, title)
    )
      .then(res => res.json())
      .then(res =>
        geti18nMessages(url.origin, [
          MESSAGE_KEYS.success,
          MESSAGE_KEYS.errorIntro
        ]).then(messages =>
          dispatchShow("showAddPageToListResult", {
            urlString: url.href,
            titleString: title,
            resString: JSON.stringify(res),
            msgString: JSON.stringify(messages)
          })
        )
      )
  );
}

function getReadingListsUrlForOrigin(origin, next) {
  let result = `${origin}/api/rest_v1/data/lists/`;
  if (next) {
    result = result.concat(`?next=${next}`);
  }
  return result;
}

function getDefaultListId(url, next) {
  return fetch(getReadingListsUrlForOrigin(url.origin, next), {
    credentials: "same-origin"
  })
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
  url.hostname = url.hostname.replace(/^m\./, "").replace(".m.", ".");
  return url;
}

function getAddToListPostBody(url, title) {
  return `project=${mobileToCanonicalHost(url).origin}&title=${title}`;
}

function getAddToListPostOptions(url, title) {
  return {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    credentials: "same-origin",
    body: getAddToListPostBody(url, title)
  };
}

function handleTokenResult(url, token) {
  return token === "+\\"
    ? geti18nMessages(url.origin, [
        MESSAGE_KEYS.loginPrompt,
        MESSAGE_KEYS.loginButtonText
      ]).then(messages =>
        dispatchShow("showLoginPrompt", {
          urlString: url.href,
          msgString: JSON.stringify(messages)
        })
      )
    : getDefaultListId(url).then(listId =>
        addPageToDefaultList(url, listId, token)
      );
}

function handleClick(url) {
  return getCsrfToken(url.origin).then(token => handleTokenResult(url, token));
}

function handleError(url, err) {
  if (err.title === "readinglists-db-error-not-set-up") {
    return geti18nMessages(url.origin, [
      MESSAGE_KEYS.enableSync,
      MESSAGE_KEYS.infoLinkText
    ]).then(messages =>
      dispatchShow("showEnableSync", {
        urlString: url.href,
        msgString: JSON.stringify(messages)
      })
    );
  } else if (err.title === "readinglists-db-error-entry-limit") {
    return geti18nMessages(url.origin, [MESSAGE_KEYS.entryLimitExceeded]).then(
      messages => dispatchShow("showEntryLimitExceeded"),
      { msgString: JSON.stringify(messages) }
    );
  } else {
    return geti18nMessages(url.origin, [MESSAGE_KEYS.errorIntro]).then(
      messages => dispatchShow("showGenericErrorMessage"),
      { msgString: JSON.stringify(messages), errString: JSON.stringify(err) }
    );
  }
}

function getPageNamespace() {
  const nodes = document.querySelectorAll("script");
  for (let i = 0; i < nodes.length; i++) {
    const match = /"wgNamespaceNumber":\s*(\d+)/.exec(nodes[i].innerText);
    if (match) {
      return parseInt(match[1], 10);
    }
  }
}

safari.self.addEventListener(
  "message",
  event => {
    if (event.name === "wikiExtensionAddPageToReadingList") {
      const urlString = event.message;
      if (urlString) {
        const url = new URL(urlString);
        handleClick(url).catch(err => handleError(url, err));
      }
    } else if (event.name === "wikiExtensionGetPageNamespace") {
      safari.self.tab.dispatchMessage("wikiExtensionFoundPageNamespace", {
        ns: getPageNamespace()
      });
    }
  },
  false
);
