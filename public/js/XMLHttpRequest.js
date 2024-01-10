
function makeRequest(searchTerm) {
    const req = new XMLHttpRequest();
    req.responseType = 'json';
    req.open('GET', `https://openlibrary.org/search.json?q=${searchTerm}&limit=10`, true);
    req.onload = function() {
        if (req.status === 200) {
            const searchResults = req.response;
            
            console.log(searchResults);

        } else {
            console.error('Request failed with status:', req.status);
        }
    };
    req.send(null);
}

const searchInput = document.getElementById('book-search');
searchInput.addEventListener('input', function(event) {
    const searchTerm = event.target.value.trim();
    if (searchTerm.length >= 3) {
        makeRequest(searchTerm);
    }
});