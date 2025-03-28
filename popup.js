document.addEventListener('DOMContentLoaded', function() {
  // Tab switching functionality
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.getAttribute('data-tab');
      
      // Update active tab button
      tabButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      
      // Show the selected tab content
      tabContents.forEach(content => {
        if (content.id === `${tabName}-tab`) {
          content.classList.remove('d-none');
        } else {
          content.classList.add('d-none');
        }
      });
    });
  });
  
  // Get the current tab's content for processing
  function getCurrentPageContent() {
    return new Promise((resolve, reject) => {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs.length === 0) {
          reject(new Error('No active tab found'));
          return;
        }
        
        chrome.scripting.executeScript({
          target: {tabId: tabs[0].id},
          function: () => {
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
            
            return {
              title,
              metaDescription,
              bodyText,
              url
            };
          }
        }, (results) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          if (!results || results.length === 0) {
            reject(new Error('Failed to extract content from the page'));
            return;
          }
          
          resolve(results[0].result);
        });
      });
    });
  }
  
  // Function to show loading state
  function showLoading() {
    document.getElementById('loading').classList.remove('d-none');
    document.getElementById('error-message').classList.add('d-none');
  }
  
  // Function to hide loading state
  function hideLoading() {
    document.getElementById('loading').classList.add('d-none');
  }
  
  // Function to show error
  function showError(message) {
    const errorElement = document.getElementById('error-message');
    document.getElementById('error-text').textContent = message;
    errorElement.classList.remove('d-none');
  }
  
  // Helper function to send request to background script
  function sendToGemini(action, data) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: action,
        data: data
      }, response => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (response.error) {
          reject(new Error(response.error));
          return;
        }
        
        resolve(response.result);
      });
    });
  }
  
  // Add a simple markdown to HTML converter function
  function markdownToHtml(markdown) {
    if (!markdown) return '';
    
    // Detect and wrap ASCII diagrams in pre tags
    // Look for patterns typical in ASCII diagrams like multiple consecutive lines with special characters
    let html = markdown;
    
    // Convert ASCII diagram sections (detect patterns of lines with lots of special chars like |, -, +, etc.)
    const diagramRegex = /(?:^|\n)((?:(?:[\|\/\\\+\-\=\*\.\:\;\[\]\(\)\{\}\<\>\~\^\s]){5,}(?:\n|$)){2,})/g;
    html = html.replace(diagramRegex, function(match) {
      return '\n<pre class="ascii-diagram">' + match.trim() + '</pre>\n';
    });
    
    // Convert headings (# Heading)
    html = html
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^#### (.*$)/gm, '<h4>$1</h4>')
      .replace(/^##### (.*$)/gm, '<h5>$1</h5>')
      .replace(/^###### (.*$)/gm, '<h6>$1</h6>');
    
    // Convert bold (**text**)
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Convert italic (*text*)
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Convert tables with simple parsing
    const tableRegex = /((?:\|[^\n]*\|\n)+)/g;
    html = html.replace(tableRegex, function(match) {
      const rows = match.trim().split('\n');
      let table = '<table class="markdown-table">';
      
      rows.forEach((row, index) => {
        // Check if this is a separator row (|---|---|)
        if (row.match(/\|[\-\:]+\|/)) {
          return; // Skip separator rows
        }
        
        const cells = row.split('|').filter(cell => cell.trim() !== '');
        const tag = index === 0 ? 'th' : 'td'; // Use th for header row
        
        table += '<tr>';
        cells.forEach(cell => {
          table += `<${tag}>${cell.trim()}</${tag}>`;
        });
        table += '</tr>';
      });
      
      table += '</table>';
      return table;
    });
    
    // Convert line breaks, but not inside pre tags
    const parts = html.split(/<\/?pre[^>]*>/);
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) { // Not inside pre tags
        parts[i] = parts[i].replace(/\n/g, '<br>');
      }
    }
    html = parts.join('');
    
    // Convert lists
    html = html.replace(/^\s*\* (.*$)/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/g, '<ul>$1</ul>');
    
    // Convert code blocks
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    
    // Convert inline code
    html = html.replace(/`(.*?)`/g, '<code>$1</code>');
    
    return html;
  }
  
  // Feature 1: Summarize Page
  document.getElementById('summarize-btn').addEventListener('click', async () => {
    try {
      showLoading();
      const pageContent = await getCurrentPageContent();
      const summary = await sendToGemini('summarize', {
        title: pageContent.title,
        content: pageContent.bodyText
      });
      
      document.getElementById('summary-content').innerHTML = markdownToHtml(summary);
      document.getElementById('summary-result').classList.remove('d-none');
    } catch (error) {
      showError(`Failed to summarize: ${error.message}`);
    } finally {
      hideLoading();
    }
  });
  
  // Feature 2: Ask Questions About Page
  document.getElementById('ask-btn').addEventListener('click', async () => {
    try {
      const question = document.getElementById('question-input').value.trim();
      if (!question) {
        showError('Please enter a question');
        return;
      }
      
      showLoading();
      const pageContent = await getCurrentPageContent();
      const answer = await sendToGemini('ask', {
        question: question,
        content: pageContent.bodyText,
        title: pageContent.title
      });
      
      document.getElementById('answer-content').innerHTML = markdownToHtml(answer);
      document.getElementById('ask-result').classList.remove('d-none');
    } catch (error) {
      showError(`Failed to get answer: ${error.message}`);
    } finally {
      hideLoading();
    }
  });
  
  // Feature 3: Simplify Content
  document.getElementById('simplify-btn').addEventListener('click', async () => {
    try {
      showLoading();
      const level = document.getElementById('simplify-level').value;
      const pageContent = await getCurrentPageContent();
      
      const simplified = await sendToGemini('simplify', {
        content: pageContent.bodyText,
        level: level
      });
      
      document.getElementById('simplified-content').innerHTML = markdownToHtml(simplified);
      document.getElementById('simplify-result').classList.remove('d-none');
    } catch (error) {
      showError(`Failed to simplify: ${error.message}`);
    } finally {
      hideLoading();
    }
  });
  
  // Feature 4: Compare Mode
  document.getElementById('compare-btn').addEventListener('click', async () => {
    try {
      showLoading();
      const productInput = document.getElementById('product-input').value.trim();
      const pageContent = await getCurrentPageContent();
      
      const comparison = await sendToGemini('compare', {
        content: pageContent.bodyText,
        title: pageContent.title,
        url: pageContent.url,
        productInput: productInput
      });
      
      document.getElementById('comparison-content').innerHTML = markdownToHtml(comparison);
      document.getElementById('compare-result').classList.remove('d-none');
    } catch (error) {
      showError(`Failed to compare: ${error.message}`);
    } finally {
      hideLoading();
    }
  });
  
  // Feature 5: Interactive Learning
  document.getElementById('learn-btn').addEventListener('click', async () => {
    try {
      showLoading();
      const learnMode = document.querySelector('input[name="learnMode"]:checked').value;
      const pageContent = await getCurrentPageContent();
      
      const learningContent = await sendToGemini('learn', {
        content: pageContent.bodyText,
        title: pageContent.title,
        mode: learnMode
      });
      
      const learningElement = document.getElementById('learning-content');
      
      try {
        if (learnMode === 'quiz') {
          // Parse the JSON response
          const quizData = JSON.parse(learningContent);
          // Handle quiz mode
          const quizHTML = createQuizHTML(quizData);
          learningElement.innerHTML = quizHTML;
          setupQuizInteractions();
        } else {
          // Parse the JSON response
          const flashcardsData = JSON.parse(learningContent);
          // Handle flashcard mode
          const flashcardsHTML = createFlashcardsHTML(flashcardsData);
          learningElement.innerHTML = flashcardsHTML;
          setupFlashcardInteractions();
        }
        
        document.getElementById('learn-result').classList.remove('d-none');
      } catch (parseError) {
        console.error('JSON parsing error:', parseError);
        console.error('Raw content:', learningContent);
        showError(`Failed to parse the learning content: ${parseError.message}. Please try again.`);
      }
    } catch (error) {
      showError(`Failed to generate learning material: ${error.message}`);
    } finally {
      hideLoading();
    }
  });
  
  // Helper function to create quiz HTML
  function createQuizHTML(quizData) {
    let html = '';
    
    quizData.forEach((question, index) => {
      html += `
        <div class="quiz-question" data-question-index="${index}">
          <div class="question-text">${index + 1}. ${question.question}</div>
          <div class="quiz-options">
      `;
      
      question.options.forEach((option, optIndex) => {
        html += `
          <div class="quiz-option" data-option-index="${optIndex}">${option}</div>
        `;
      });
      
      html += `
          </div>
          <div class="feedback mt-2 d-none"></div>
        </div>
      `;
    });
    
    return html;
  }
  
  // Helper function to set up quiz interactions
  function setupQuizInteractions() {
    document.querySelectorAll('.quiz-option').forEach(option => {
      option.addEventListener('click', function() {
        const questionElement = this.closest('.quiz-question');
        const questionIndex = parseInt(questionElement.getAttribute('data-question-index'));
        const optionIndex = parseInt(this.getAttribute('data-option-index'));
        
        // Send to background to check answer
        chrome.runtime.sendMessage({
          action: 'checkQuizAnswer',
          data: {
            questionIndex: questionIndex,
            selectedOptionIndex: optionIndex
          }
        }, response => {
          const feedbackElement = questionElement.querySelector('.feedback');
          feedbackElement.classList.remove('d-none');
          
          // Check if we have a valid response with the result property
          if (response && response.result) {
            const result = response.result;
            
            if (result.correct) {
              this.classList.add('correct');
              feedbackElement.innerHTML = 'Correct! ' + (result.explanation || '');
            } else {
              this.classList.add('incorrect');
              feedbackElement.innerHTML = 'Incorrect. ' + (result.explanation || '');
            }
          } else {
            // Handle error case
            this.classList.add('incorrect');
            feedbackElement.innerHTML = 'Error checking answer. Please try again.';
            console.error('Invalid response from checkQuizAnswer:', response);
          }
        });
      });
    });
  }
  
  // Helper function to create flashcards HTML
  function createFlashcardsHTML(flashcardsData) {
    let html = '';
    
    flashcardsData.forEach((card, index) => {
      html += `
        <div class="flashcard" data-card-index="${index}">
          <div class="flashcard-inner">
            <div class="flashcard-front">
              <div class="front-text">${card.front}</div>
            </div>
            <div class="flashcard-back">
              <div class="back-text">${card.back}</div>
            </div>
          </div>
        </div>
      `;
    });
    
    return html;
  }
  
  // Helper function to set up flashcard interactions
  function setupFlashcardInteractions() {
    document.querySelectorAll('.flashcard').forEach(card => {
      card.addEventListener('click', function() {
        this.classList.toggle('flipped');
      });
    });
  }
  
  // Feature 7: Translation
  document.getElementById('translate-btn').addEventListener('click', async () => {
    try {
      showLoading();
      const language = document.getElementById('language-select').value;
      const pageContent = await getCurrentPageContent();
      
      const translation = await sendToGemini('translate', {
        content: pageContent.bodyText,
        title: pageContent.title,
        language: language
      });
      
      document.getElementById('translation-content').innerHTML = markdownToHtml(translation);
      document.getElementById('translate-result').classList.remove('d-none');
    } catch (error) {
      showError(`Failed to translate: ${error.message}`);
    } finally {
      hideLoading();
    }
  });
  
  // Feature 8: Bookmark
  
  // Bookmark data structure in chrome.storage.local:
  // bookmarks: {
  //   folders: {
  //     "folder1": { name: "Folder 1", bookmarks: [] },
  //     "folder2": { name: "Folder 2", bookmarks: [] },
  //     ...
  //   }
  // }
  
  // Initialize bookmarks if not exists
  function initializeBookmarks() {
    return new Promise((resolve) => {
      chrome.storage.local.get('bookmarks', (result) => {
        if (!result.bookmarks) {
          const defaultBookmarks = {
            folders: {
              'general': { name: 'General', bookmarks: [] }
            }
          };
          
          chrome.storage.local.set({ bookmarks: defaultBookmarks }, () => {
            resolve(defaultBookmarks);
          });
        } else {
          resolve(result.bookmarks);
        }
      });
    });
  }
  
  // Load folders into select dropdown
  async function loadFolders() {
    const bookmarks = await initializeBookmarks();
    const folderSelect = document.getElementById('folder-select');
    
    // Clear existing options
    folderSelect.innerHTML = '';
    
    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = 'general';
    defaultOption.textContent = 'General';
    folderSelect.appendChild(defaultOption);
    
    // Add all folders
    Object.keys(bookmarks.folders).forEach(folderId => {
      if (folderId === 'general') return; // Skip the general folder as it's already added
      
      const folder = bookmarks.folders[folderId];
      const option = document.createElement('option');
      option.value = folderId;
      option.textContent = folder.name;
      folderSelect.appendChild(option);
    });
  }
  
  // Display bookmarks in the UI
  async function displayBookmarks() {
    const bookmarks = await initializeBookmarks();
    const container = document.getElementById('bookmarks-container');
    
    if (Object.keys(bookmarks.folders).length === 0) {
      container.innerHTML = '<div class="no-bookmarks">No bookmarks yet. Save a bookmark to get started!</div>';
      return;
    }
    
    let html = '';
    
    // Sort folders alphabetically
    const sortedFolders = Object.keys(bookmarks.folders).sort((a, b) => {
      const nameA = bookmarks.folders[a].name.toLowerCase();
      const nameB = bookmarks.folders[b].name.toLowerCase();
      return nameA.localeCompare(nameB);
    });
    
    sortedFolders.forEach(folderId => {
      const folder = bookmarks.folders[folderId];
      const folderBookmarks = folder.bookmarks;
      
      html += `
        <div class="bookmark-folder" data-folder-id="${folderId}">
          <div class="folder-header">
            <span>${folder.name}</span>
            <div>
              <span class="badge bg-secondary">${folderBookmarks.length}</span>
              <button class="folder-toggle-btn" data-folder-id="${folderId}">
                <i class="bi bi-chevron-down"></i>
              </button>
            </div>
          </div>
          <ul class="folder-items">
      `;
      
      if (folderBookmarks.length === 0) {
        html += '<li class="empty-folder">No bookmarks in this folder</li>';
      } else {
        // Sort bookmarks by date (newest first)
        folderBookmarks.sort((a, b) => b.date - a.date);
        
        folderBookmarks.forEach(bookmark => {
          html += `
            <li class="bookmark-item" data-bookmark-id="${bookmark.id}">
              <span class="bookmark-title" title="${bookmark.title}">${bookmark.title}</span>
              <div class="bookmark-actions">
                <button class="bookmark-visit-btn" data-url="${bookmark.url}" title="Visit">
                  <i class="bi bi-box-arrow-up-right"></i>
                </button>
                <button class="bookmark-delete-btn" data-folder-id="${folderId}" data-bookmark-id="${bookmark.id}" title="Delete">
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </li>
          `;
        });
      }
      
      html += `
          </ul>
        </div>
      `;
    });
    
    container.innerHTML = html;
    
    // Add event listeners for folder toggles
    document.querySelectorAll('.folder-toggle-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const folderId = btn.getAttribute('data-folder-id');
        const folderElement = document.querySelector(`.bookmark-folder[data-folder-id="${folderId}"]`);
        const folderItems = folderElement.querySelector('.folder-items');
        
        if (folderItems.style.display === 'none') {
          folderItems.style.display = '';
          btn.innerHTML = '<i class="bi bi-chevron-down"></i>';
        } else {
          folderItems.style.display = 'none';
          btn.innerHTML = '<i class="bi bi-chevron-right"></i>';
        }
      });
    });
    
    // Add event listeners for bookmark actions
    document.querySelectorAll('.bookmark-visit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const url = btn.getAttribute('data-url');
        chrome.tabs.create({ url });
      });
    });
    
    document.querySelectorAll('.bookmark-delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const folderId = btn.getAttribute('data-folder-id');
        const bookmarkId = btn.getAttribute('data-bookmark-id');
        
        if (confirm('Are you sure you want to delete this bookmark?')) {
          await deleteBookmark(folderId, bookmarkId);
          displayBookmarks(); // Refresh the display
        }
      });
    });
  }
  
  // Add a new bookmark
  async function addBookmark(title, url, folderId) {
    const bookmarks = await initializeBookmarks();
    
    // Make sure the folder exists
    if (!bookmarks.folders[folderId]) {
      folderId = 'general'; // Default to general if folder doesn't exist
    }
    
    const bookmarkId = 'bm_' + Date.now();
    const newBookmark = {
      id: bookmarkId,
      title: title,
      url: url,
      date: Date.now()
    };
    
    bookmarks.folders[folderId].bookmarks.push(newBookmark);
    
    await new Promise((resolve) => {
      chrome.storage.local.set({ bookmarks }, resolve);
    });
    
    return bookmarkId;
  }
  
  // Delete a bookmark
  async function deleteBookmark(folderId, bookmarkId) {
    const bookmarks = await initializeBookmarks();
    
    if (bookmarks.folders[folderId]) {
      const folder = bookmarks.folders[folderId];
      folder.bookmarks = folder.bookmarks.filter(bm => bm.id !== bookmarkId);
      
      await new Promise((resolve) => {
        chrome.storage.local.set({ bookmarks }, resolve);
      });
    }
  }
  
  // Create a new folder
  async function createFolder(folderName) {
    const bookmarks = await initializeBookmarks();
    
    // Generate a folder ID
    const folderId = 'f_' + Date.now();
    
    bookmarks.folders[folderId] = {
      name: folderName,
      bookmarks: []
    };
    
    await new Promise((resolve) => {
      chrome.storage.local.set({ bookmarks }, resolve);
    });
    
    return folderId;
  }
  
  // Initialize bookmark feature
  async function initBookmarkFeature() {
    // Load folders into select
    await loadFolders();
    
    // Display bookmarks
    await displayBookmarks();
    
    // Set up event listeners
    document.getElementById('bookmark-btn').addEventListener('click', async () => {
      try {
        const pageContent = await getCurrentPageContent();
        const titleInput = document.getElementById('bookmark-title');
        const folderSelect = document.getElementById('folder-select');
        
        const title = titleInput.value.trim() || pageContent.title;
        const url = pageContent.url;
        const folderId = folderSelect.value;
        
        if (!url) {
          showError('Cannot bookmark: URL not found');
          return;
        }
        
        await addBookmark(title, url, folderId);
        
        // Reset form and refresh display
        titleInput.value = '';
        await displayBookmarks();
        
        // Show success message
        const errorElement = document.getElementById('error-message');
        errorElement.classList.remove('d-none', 'alert-danger');
        errorElement.classList.add('alert-success');
        document.getElementById('error-text').textContent = 'Bookmark added successfully!';
        
        // Hide success message after 3 seconds
        setTimeout(() => {
          errorElement.classList.add('d-none');
        }, 3000);
      } catch (error) {
        showError(`Failed to add bookmark: ${error.message}`);
      }
    });
    
    // Show new folder form
    document.getElementById('new-folder-btn').addEventListener('click', () => {
      document.getElementById('new-folder-form').classList.remove('d-none');
    });
    
    // Hide new folder form
    document.getElementById('cancel-folder-btn').addEventListener('click', () => {
      document.getElementById('new-folder-form').classList.add('d-none');
      document.getElementById('new-folder-name').value = '';
    });
    
    // Create new folder
    document.getElementById('create-folder-btn').addEventListener('click', async () => {
      const folderNameInput = document.getElementById('new-folder-name');
      const folderName = folderNameInput.value.trim();
      
      if (!folderName) {
        showError('Please enter a folder name');
        return;
      }
      
      try {
        await createFolder(folderName);
        
        // Reset form
        folderNameInput.value = '';
        document.getElementById('new-folder-form').classList.add('d-none');
        
        // Refresh folders and bookmarks
        await loadFolders();
        await displayBookmarks();
        
        // Select the new folder
        const folderSelect = document.getElementById('folder-select');
        const options = Array.from(folderSelect.options);
        const newOption = options.find(option => option.textContent === folderName);
        if (newOption) {
          folderSelect.value = newOption.value;
        }
        
        // Show success message
        const errorElement = document.getElementById('error-message');
        errorElement.classList.remove('d-none', 'alert-danger');
        errorElement.classList.add('alert-success');
        document.getElementById('error-text').textContent = 'Folder created successfully!';
        
        // Hide success message after 3 seconds
        setTimeout(() => {
          errorElement.classList.add('d-none');
        }, 3000);
      } catch (error) {
        showError(`Failed to create folder: ${error.message}`);
      }
    });
    
    // Refresh bookmarks
    document.getElementById('refresh-bookmarks-btn').addEventListener('click', async () => {
      await displayBookmarks();
    });
  }
  
  // Wait for the bookmark tab to be activated
  document.querySelector('.tab-btn[data-tab="bookmark"]').addEventListener('click', () => {
    const container = document.getElementById('bookmarks-container');
    if (container.innerHTML.includes('Loading bookmarks')) {
      initBookmarkFeature();
    }
  });
}); 