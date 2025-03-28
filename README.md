# AI-Powered Web Page Enhancer & Explainer

A Chrome extension that helps users understand, summarize, and enhance any web page using Google Gemini Flash 2.0.

## Features

1. **Instant Summarization** – Summarizes long articles, blogs, and research papers into key takeaways.
2. **Ask Anything About the Page** – Ask questions about the content, and get AI-generated explanations.
3. **Simplified Mode** – Converts complex technical jargon into easy-to-understand language.
4. **Comparison Mode** – For product reviews, fetches and compares similar products.
5. **Interactive Learning** – Turns articles into quizzes or key point flashcards for better retention.
7. **Multi-Language Support** – Translates and explains content in different languages.

## Installation

### For Development

1. Clone this repository to your local machine
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the folder containing the extension files
5. Edit the `background.js` file and replace `YOUR_GEMINI_API_KEY` with your actual Gemini API key

### For Users

1. Download the extension from the Chrome Web Store [link coming soon]
2. Click on the extension icon in your browser toolbar to access the features

## Demo Video

Watch a demo of the extension in action: [AI-Powered Web Page Enhancer Demo](https://youtu.be/1PY1OMSGrmo)

## API Key Setup

To use this extension, you'll need a Google Gemini API key:

1. Visit the [Google AI Studio](https://makersuite.google.com/app/apikey) or [Google AI Developer site](https://ai.google.dev/) to create an API key
2. Sign in with your Google account and create a new API key
3. Copy your API key
4. Open `background.js` and replace `YOUR_GEMINI_API_KEY` with your actual API key

**Important Note:** The extension uses the `gemini-2.0-flash` model. Make sure your API key has access to this model.

## Usage

1. Navigate to any webpage you want to analyze
2. Click on the extension icon in your browser toolbar
3. Choose the feature you want to use:
   - **Summarize**: Get a quick summary of the page
   - **Ask**: Ask specific questions about the page content
   - **Simplify**: Simplify complex content to your preferred level
   - **Compare**: Compare products or concepts mentioned on the page
   - **Learn**: Generate quizzes or flashcards from the content
   - **Translate**: Translate the content to another language

## Privacy & Data Usage

- All processing is done through the Gemini API
- Page content is sent to the Gemini API for analysis but is not stored
- No user data is collected or stored by the extension
- The extension only accesses content from the currently active tab when you click on a feature

## Technology Stack

- JavaScript
- Chrome Extension APIs
- Google Gemini Flash 2.0 API
- Bootstrap for UI


## Acknowledgments

- Google Gemini Flash 2.0 for powering the AI features
- Bootstrap for the UI components 