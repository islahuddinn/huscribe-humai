// This script will fetch the API key from the server
(function() {
  // Fetch the API key from your server endpoint
  fetch('/api/trello/api-key')
    .then(response => response.json())
    .then(data => {
      // Store the API key in localStorage
      localStorage.setItem('trelloApiKey', data.key);
      console.log('API key loaded successfully');
    })
    .catch(error => {
      console.error('Error loading API key:', error);
    });
})(); 