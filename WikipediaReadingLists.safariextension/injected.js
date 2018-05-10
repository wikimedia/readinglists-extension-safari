safari.self.addEventListener('message', (event) => {
    if (event.name === 'wikiExtensionGetPageTitle') {
        safari.self.tab.dispatchMessage('wikiExtensionSetPageTitle', document.querySelector('link[rel=canonical]').href);
    }
});
