// This script runs in the context of the web page

// Listen for messages from the popup or background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getPageContent') {
    // Extract text content from the page
    const title = document.title || '';
    const metaDescription = document.querySelector('meta[name="description"]')?.content || '';
    
    // Get visible text from body, ignoring scripts, styles, etc.
    const bodyText = Array.from(document.body.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, span, div'))
      .filter(element => {
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && 
               style.visibility !== 'hidden' && 
               element.offsetWidth > 0 && 
               element.offsetHeight > 0;
      })
      .map(element => element.textContent)
      .filter(text => text.trim().length > 0)
      .join('\n');
      
    // Get the URL of the current page
    const url = window.location.href;
    
    sendResponse({
      title,
      metaDescription,
      bodyText,
      url
    });
    return true;
  }
}); 