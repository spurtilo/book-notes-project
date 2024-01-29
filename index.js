import express from "express";
import bodyParser from "body-parser";
import axios from 'axios';
import pg from "pg";
import 'dotenv/config';
import fs from 'fs';
import { dirname } from "path";
import { fileURLToPath } from "url";

// Get the current directory path.
const __dirname = dirname(fileURLToPath(import.meta.url));

// Initialize Express and set the port to 3000.
const app = express();
const port = 3000;

// Create a new PostgreSQL client with connection details from .env.
const db = new pg.Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// Connect to the PostgreSQL database
db.connect();

// Set up middleware for parsing URL-encoded bodies and serving static files.
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

// Function to fetch and save book cover image from Open Library Covers API.
async function fetchAndSaveCover(isbn) {
    const url = `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`; // API URL for book cover with ISBN and size parameter (M).
    const fileName = isbn; // Set the filename to the ISBN, creating the image path in the public directory.
    const imagePath = `\\public\\assets\\images\\covers\\${fileName}.jpg`;

    try {
        const response = await axios.get(url, { responseType: 'stream' });
        const fileStream = fs.createWriteStream(__dirname + imagePath);
        
        // Pipe the image data from the API response to the file stream.
        response.data.pipe(fileStream);

        // Log a message for successful image save.
        console.log(`Image saved: ${fileName}.jpg`);
    } catch (error) {
        // Log any errors that occur during the fetch or save process.
        console.log('Error fetching or saving cover image: ', error); 
    }
}

// Function to fetch notes from database.
async function fetchNotes(id) {
    try { 
        // Make a database query selecting relevant columns.
        // Use LEFT JOIN to combine data from the "books" and "notes" tables including notes if available.
        const result = await db.query(
            'SELECT notes.id, notes.book_id, title, author, image_path, date_read, notes.note FROM books LEFT JOIN notes ON books.id = notes.book_id WHERE books.id = $1 ORDER BY id DESC', [id]);
            return result.rows;
    } catch (error) {
        console.error('Error fetching notes:', error);
    }
}

// Function to format data.
function formatData(data) {
    if (data[0].description || data[0].review || data[0].note) {

        data.forEach((item) => {
            // Format description
            if (item.description) {
                item.description = item.description.replace(/<br>/g, ''); // Remove existing <br> tags
                if (item.description.includes('\n')) {
                    item.description = item.description.split('\n').join('<br>'); // Replace newline characters
                }
            }

            // Format review
            if (item.review) {
                item.review = item.review.replace(/<br>/g, '');
                if (item.review.includes('\n')) {
                    item.review = item.review.split('\n').join('<br>');
                }
            }

            // Format note
            if (item.note) {
                item.note = item.note.replace(/<br>/g, '');
                if (item.note.includes('\n')) {
                    item.note = item.note.split('\n').join('<br>');
                }
            }
        });
    }
    return data;
}

// Handle GET request for the root path.
app.get('/', async (req, res) => {
    const currentSortOption = req.query.sort; // Sort option is passed as query parameter.
    let result = null;

    try {
        // Sort the books using ORDER BY according to chosen sort option.
        if (currentSortOption === undefined || currentSortOption === 'title') {
            result = await db.query(
                'SELECT * FROM books ORDER BY title ASC');
        }
        else if (currentSortOption === 'date') {
            result = await db.query(
                'SELECT * FROM books ORDER BY date_read DESC');
        }
        else if (currentSortOption === 'rating') {
            result = await db.query(
                'SELECT * FROM books ORDER BY rating DESC');
        }
        
        const formattedDetails = formatData(result.rows); // Format the book details, replacing newline characters with <br> tags.

        res.render('index.ejs', { data: formattedDetails, sortOption: currentSortOption }); // Render index.ejs and send over required data.
    } catch (error) {
        console.log(error);
    }
});

// Handle GET request for '/new-entry'.
app.get('/new-entry', (req, res) => {
    res.render('new.ejs');
});


// Handle POST request for '/new-entry/add'.
app.post('/new-entry/add', async (req, res) => {
    const newEntry = req.body; // Initialize newEntry and assign data sent over from HTML form.
    fetchAndSaveCover(newEntry.isbn); // Pass ISBN to fetchAndSaveCover().
    const imagePath = `assets/images/covers/${newEntry.isbn}.jpg`; // Create a book cover image path for saving to database.
    const timeStamp = new Date(); // Create timestamp for the log entry.

    try {
        // Save everything to database.
        await db.query('INSERT INTO books (isbn, title, author, description, review, rating, image_path, date_read) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
            [   newEntry.isbn,
                newEntry.title,
                newEntry.author,
                newEntry.description,
                newEntry.review,
                newEntry.rating,
                imagePath,
                timeStamp
            ]);
        res.redirect('/')
    } catch (error) {
        console.log(error);
    }
});

// Handle GET route for '/notes/:bookId' to display notes for a specific book.
app.get('/notes/:bookId', async (req, res) => {
    // Get bookId from URL parameter.
    const bookId = req.params.bookId;

    try {
        const notes = await fetchNotes(bookId); // Fetch notes for the specified book id.
        const formattedNotes = await formatData(notes); // Format notes.

        res.render('notes.ejs', { data: formattedNotes }); // Render notes.ejs and send over required data.
    } catch (error) {
        console.log(error);
    }
});

// Handle POST request for '/notes/:bookId/add' to add new notes.
app.post('/notes/:bookId/add', async (req, res) => {
    const bookId = req.params.bookId; // Get the bookId from URL parameter.
    const note = req.body.newNote;
    // Pass the note string from HTML input to server and save to database using the bookId.

    try {
        await db.query('INSERT INTO notes (note, book_id) VALUES ($1, $2)', [note, bookId]);

        res.redirect(`/notes/${bookId}`); // res.redirect reloads the page by hitting the GET route /notes/:bookId.
    } catch (error) {
        console.log(error);
    }
});

// Handle POST request for '/notes/:noteId/update' to update a note.
app.post('/notes/:noteId/update', async (req, res) => {
    const updatedNote = req.body.noteToUpdate;
    const updateNoteId = req.params.noteId;
    const bookId = req.body.bookId;
    
    // Pass note id, note and book id to server.
    // Make database query to update the note.
    try {
        await db.query('UPDATE notes SET note = ($1) WHERE id = $2', [updatedNote, updateNoteId]);
        res.redirect(`/notes/${bookId}`);
    } catch (error) {
        console.log(error);
    }
});

// Handle POST request for '/notes/:noteId/delete' to delete a note.
app.post('/notes/:noteId/delete', async (req, res) => {
    const deleteNoteId = req.params.noteId;
    const bookId = req.body.bookId;
    // Pass note id and book id to server.
    // Make database query to delete a note using the note id.
    try {
       await db.query('DELETE FROM notes WHERE id = $1', [deleteNoteId]);
       res.redirect(`/notes/${bookId}`);
    } catch (error) {
       console.log(error);
    }
   });

// Handle POST route for '/update/review/:id' to update a book review.
app.post('/reviews/:bookId/update', async (req, res) => {
    const updatedReview = req.body.reviewToUpdate;
    const bookId = req.params.bookId;
    // Pass the review to update and the book id to server.
    // Make a database query to update the review.
    try {
        await db.query('UPDATE books SET review = ($1) WHERE id = $2', [updatedReview, bookId]);
        res.redirect('/');
    } catch (error) {
        console.log(error);
    }
});

// Handle POST route for '/delete/book/:id' to delete a book and its notes.
app.post('/books/:bookId/delete', async (req, res) => {
 const deleteBookId = req.params.bookId;
    // Pass book id to server
    // Make two database queries for deletion.
 try {
    await db.query('DELETE FROM notes WHERE book_id = $1', [deleteBookId]);

    await db.query('DELETE FROM books WHERE id = $1', [deleteBookId]);

    res.redirect('/')
 } catch (error) {
    console.log(error);
 }
});

// Start the server and listen on port 3000.
app.listen(port, () => {
    console.log('Server running on port 3000');
});