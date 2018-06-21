# readinglists-extension-safari
A Safari extension for users of synchronized reading lists to add a Wikimedia wiki page from the browser.

Adds a toolbar button that can be clicked to add the current page to the default reading list for the logged in user.

See [debug installation instructions](https://developer.apple.com/library/content/documentation/Tools/Conceptual/SafariExtensionGuide/UsingExtensionBuilder/UsingExtensionBuilder.html).

## i18n message fetching
This extension bundles message translations provided by the volunteer translators at [TranslateWiki.net](https://translatewiki.net) as part of MediaWiki's [ReadingLists extension](https://www.mediawiki.org/wiki/Extension:ReadingLists).  These can be updated from the MediaWiki API at www.mediawiki.org using the `getMessages.js` script.

```
npm install
node getMessages.js
```

Note: Requires Node.js 7.6.0 or later.

## issues

Please file bugs or feature requests on Phabricator, Wikimedia's issue tracking software. ([link](https://phabricator.wikimedia.org/maniphest/task/edit/form/10/?title=&projects=reading-infrastructure-team-backlog))
