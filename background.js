// Background service worker for AI Page Enhancer
// This handles communication with the Google Gemini Flash 2.0 API

// Configuration for the Gemini API - UPDATED URL to use the correct model name
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent';
// Replace with your actual API key when deploying
// You can get your API key from https://ai.google.dev/ or https://makersuite.google.com/app/apikey
const API_KEY = 'xxxxxxxxxxxxx';

// Current quiz data stored in memory (will be lost on service worker restart)
let currentQuizData = [];

// Helper function to call the Gemini API
async function callGeminiAPI(prompt) {
  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.4,
          topK: 32,
          topP: 0.95,
          maxOutputTokens: 8192,
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API Error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    throw new Error(`Failed to get a response from Gemini: ${error.message}`);
  }
}

// Handle messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Use the async pattern for chrome message handlers
  const handleMessage = async () => {
    try {
      let result;
      
      switch (message.action) {
        case 'summarize':
          result = await summarizeContent(message.data);
          break;
        
        case 'ask':
          result = await answerQuestion(message.data);
          break;
        
        case 'simplify':
          result = await simplifyContent(message.data);
          break;
        
        case 'compare':
          result = await compareProducts(message.data);
          break;
        
        case 'learn':
          result = await generateLearningMaterial(message.data);
          break;
        
        case 'translate':
          result = await translateContent(message.data);
          break;
          
        case 'checkQuizAnswer':
          result = checkQuizAnswer(message.data);
          break;
          
        default:
          throw new Error(`Unknown action: ${message.action}`);
      }
      
      sendResponse({ result });
    } catch (error) {
      console.error(`Error handling ${message.action}:`, error);
      sendResponse({ error: error.message });
    }
  };
  
  // Start async handling and keep the message channel open
  handleMessage();
  return true;
});

// Feature 1: Summarize Content
async function summarizeContent(data) {
  const { title, content } = data;
  
  const prompt = `
Summarize the following content into key takeaways. Focus on the most important information, main ideas, and conclusions.
Format the output as 3-7 bullet points unless the content requires more detail.
You can use Markdown formatting for headers (# ## ###), lists (* item), emphasis (*italic* **bold**) and other formatting.

Title: ${title}

Content:
${content.substring(0, 15000)} ${content.length > 15000 ? '[Content truncated due to length]' : ''}

Summary:
`;

  return await callGeminiAPI(prompt);
}

// Feature 2: Answer questions about the page
async function answerQuestion(data) {
  const { question, content, title } = data;
  
  const prompt = `
I'm going to give you the content of a webpage, and then ask you a question about it.
Please answer the question as accurately as possible based only on the information provided in the content.
You may use Markdown formatting in your response for better readability, including:
- Headings with # for main points and ## for subpoints
- Lists with * for bullet points
- Emphasis with *italic* and **bold**
- Code blocks with \`\`\` if needed for technical content

Title of the webpage: ${title}

Content:
${content.substring(0, 15000)} ${content.length > 15000 ? '[Content truncated due to length]' : ''}

Question: ${question}

Answer:
`;

  return await callGeminiAPI(prompt);
}

// Feature 3: Simplify content
async function simplifyContent(data) {
  const { content, level } = data;
  
  let complexity;
  switch (level) {
    case 'beginner':
      complexity = 'elementary school student, using very simple language and explanations';
      break;
    case 'intermediate':
      complexity = 'high school student, using moderately complex language and concepts';
      break;
    case 'expert':
      complexity = 'knowledgeable person in the field, but prefer clarity over jargon';
      break;
    default:
      complexity = 'general audience, using clear and accessible language';
  }
  
  const prompt = `
Rewrite the following content to make it easier to understand for a ${complexity}.
Simplify complex ideas and technical jargon while maintaining the key information.
Organize the content in a clear, logical manner with appropriate headings when necessary.

IMPORTANT: Include 1-2 ASCII diagrams to help visualize key concepts. For example:
- For processes, use flow diagrams with arrows (→) to show steps
- For comparisons, use simple tables with | and - characters
- For relationships, use simple tree structures or network diagrams
- For data or statistics, use simple ASCII charts if relevant

These diagrams should be appropriate for the ${level} level and help clarify the most important concepts.

Use Markdown formatting for structure, with # for main headers, ## for subheaders, etc.
You can also use *italic* for emphasis, **bold** for important points, and bullet lists (* item).

Content:
${content.substring(0, 15000)} ${content.length > 15000 ? '[Content truncated due to length]' : ''}

Simplified content:
`;

  return await callGeminiAPI(prompt);
}

// Feature 4: Compare products or concepts
async function compareProducts(data) {
  const { content, title, url, productInput } = data;
  
  let focus = productInput;
  if (!focus) {
    // Try to detect what to compare from the title and content
    focus = title;
  }
  
  const prompt = `
I'm going to give you the content of a webpage that discusses a product, service, or concept.
Your task is to identify what's being discussed and create a comparative analysis with similar items.

Title: ${title}
URL: ${url}
User requested comparison for: ${focus || 'Auto-detect from content'}

Analyze the following content and create a comparison with alternatives:
${content.substring(0, 15000)} ${content.length > 15000 ? '[Content truncated due to length]' : ''}

Please perform the following:
1. Identify what's being discussed (product, service, concept, etc.)
2. Identify 2-4 similar/competing alternatives
3. Create a structured comparison covering key aspects like features, pros and cons, pricing (if applicable), and unique selling points
4. Provide a summary recommendation based on different user needs

Format as a clear comparison with Markdown headings (# ## ###) and bullet lists (* item). You can also use *italic* for emphasis and **bold** for important points.
`;

  return await callGeminiAPI(prompt);
}

// Feature 5: Generate learning material
async function generateLearningMaterial(data) {
  const { content, title, mode } = data;
  
  if (mode === 'quiz') {
    const prompt = `
Based on the following content, create a short quiz with 5 multiple-choice questions.
Each question should have 4 options with one correct answer.
The questions should test understanding of the key concepts in the content.

Title: ${title}

Content:
${content.substring(0, 15000)} ${content.length > 15000 ? '[Content truncated due to length]' : ''}

Format your response ONLY as a valid JSON array of objects WITHOUT ANY MARKDOWN FORMATTING, where each object has these properties:
- question: The question text
- options: Array of 4 possible answers
- correctIndex: Index of the correct answer (0-3)
- explanation: Brief explanation of why the answer is correct

Just return the raw JSON array without any code blocks, markdown formatting, or explanatory text.
`;

    const quizData = await callGeminiAPI(prompt);
    
    // Clean up the response to ensure it's valid JSON by removing markdown formatting
    let cleanedQuizData = quizData;
    
    // Remove any markdown code block indicators
    cleanedQuizData = cleanedQuizData.replace(/```json/g, '');
    cleanedQuizData = cleanedQuizData.replace(/```/g, '');
    
    // Trim whitespace
    cleanedQuizData = cleanedQuizData.trim();
    
    // Store the quiz data for checking answers later
    try {
      currentQuizData = JSON.parse(cleanedQuizData);
    } catch (e) {
      console.error('Failed to parse quiz data:', e);
      console.error('Raw data:', quizData);
      console.error('Cleaned data:', cleanedQuizData);
      throw new Error('Failed to generate valid quiz questions. Please try again.');
    }
    
    return cleanedQuizData;
  } else {
    // Flashcard mode
    const prompt = `
Based on the following content, create 5-8 flashcards that capture the key concepts, facts, or definitions.
Each flashcard should have a front (prompt/question) and back (answer/explanation).

Title: ${title}

Content:
${content.substring(0, 15000)} ${content.length > 15000 ? '[Content truncated due to length]' : ''}

Format your response ONLY as a valid JSON array of objects WITHOUT ANY MARKDOWN FORMATTING, where each object has these properties:
- front: The question, term, or prompt
- back: The answer, definition, or explanation

Just return the raw JSON array without any code blocks, markdown formatting, or explanatory text.
`;

    const flashcardsData = await callGeminiAPI(prompt);
    
    // Clean up the response to ensure it's valid JSON
    let cleanedFlashcardsData = flashcardsData;
    
    // Remove any markdown code block indicators
    cleanedFlashcardsData = cleanedFlashcardsData.replace(/```json/g, '');
    cleanedFlashcardsData = cleanedFlashcardsData.replace(/```/g, '');
    
    // Trim whitespace
    cleanedFlashcardsData = cleanedFlashcardsData.trim();
    
    try {
      // Test if JSON is valid
      JSON.parse(cleanedFlashcardsData);
      return cleanedFlashcardsData;
    } catch (e) {
      console.error('Failed to parse flashcards data:', e);
      console.error('Raw data:', flashcardsData);
      console.error('Cleaned data:', cleanedFlashcardsData);
      throw new Error('Failed to generate valid flashcards. Please try again.');
    }
  }
}

// For Feature 5: Check quiz answers
function checkQuizAnswer(data) {
  const { questionIndex, selectedOptionIndex } = data;
  
  // Validate inputs
  if (questionIndex === undefined || selectedOptionIndex === undefined) {
    console.error('Missing questionIndex or selectedOptionIndex in checkQuizAnswer');
    return {
      correct: false,
      explanation: 'Invalid question or answer data.'
    };
  }
  
  // Check if we have valid quiz data
  if (!currentQuizData || !Array.isArray(currentQuizData) || currentQuizData.length === 0) {
    console.error('No quiz data available in checkQuizAnswer');
    return {
      correct: false,
      explanation: 'No quiz data available. Please generate a new quiz.'
    };
  }
  
  // Check if the requested question exists
  if (!currentQuizData[questionIndex]) {
    console.error(`Question index ${questionIndex} out of bounds in checkQuizAnswer`);
    return {
      correct: false,
      explanation: 'Question not found. Please generate a new quiz.'
    };
  }
  
  const question = currentQuizData[questionIndex];
  
  // Validate the question data structure
  if (question.correctIndex === undefined || !Array.isArray(question.options)) {
    console.error('Invalid question data format:', question);
    return {
      correct: false,
      explanation: 'Invalid quiz data format. Please generate a new quiz.'
    };
  }
  
  const isCorrect = selectedOptionIndex === question.correctIndex;
  const explanation = question.explanation || (isCorrect ? 
    'That is the correct answer.' : 
    `The correct answer is: ${question.options[question.correctIndex]}`);
  
  return {
    correct: isCorrect,
    explanation: explanation
  };
}

// Feature 7: Translate content
async function translateContent(data) {
  const { content, title, language } = data;
  
  // Map language codes to names
  const languageNames = {
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'zh': 'Chinese',
    'hi': 'Hindi',
    'ja': 'Japanese',
    'ko': 'Korean',
    'ru': 'Russian'
  };
  
  const targetLanguage = languageNames[language] || language;
  
  const prompt = `
Translate the following content from English to ${targetLanguage}.
Maintain the original meaning, tone, and formatting as much as possible.
If there are culturally specific references that don't translate well, provide brief explanations in parentheses.
Preserve any Markdown formatting in the original content, including headings (#, ##), bullet points (*), emphasis (*text*, **text**), and other formatting elements.

Title: ${title}

Content to translate:
${content.substring(0, 15000)} ${content.length > 15000 ? '[Content truncated due to length]' : ''}

${targetLanguage} translation:
`;

  return await callGeminiAPI(prompt);
} 