import express from "express";
import bodyParser from "body-parser";
import axios from 'axios';
import pg from "pg";
import 'dotenv/config';
import fs from 'fs';
import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const port = 3000;

const db = new pg.Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

let bookDetails = [];
let currentSortOption = 'title';
let currentBookId = null;

async function fetchAndSaveCover(isbn) {
    const url = `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`;
    const fileName = isbn;
    const imagePath = `\\public\\assets\\images\\covers\\${fileName}.jpg`;

    try {
        const response = await axios.get(url, { responseType: 'stream' });
        const fileStream = fs.createWriteStream(__dirname + imagePath);
    
        response.data.pipe(fileStream);
        console.log(`Image saved: ${fileName}.jpg`);
    } catch (error) {
        console.error(error);
    }
}

async function fetchNotes(id) {
    const result = await db.query(
        'SELECT notes.id, title, author, image_path, date_read, notes.note FROM books LEFT JOIN notes ON books.id = notes.book_id WHERE books.id = $1 ORDER BY id DESC', [id]);
        return result.rows;
}

async function formatData(data) {
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

app.get('/', async (req, res) => {
    try {
        let result = null;

        if (currentSortOption === 'title') {
            result = await db.query(
                'SELECT * FROM books ORDER BY title ASC');
        }

        if (currentSortOption === 'date') {
            result = await db.query(
                'SELECT * FROM books ORDER BY date_read DESC');
        }

        if (currentSortOption === 'rating') {
            result = await db.query(
                'SELECT * FROM books ORDER BY rating DESC');
        }
        
        bookDetails = result.rows;
        const formattedDetails = await formatData(bookDetails);

        res.render('index.ejs', { data: formattedDetails, sortOption: currentSortOption });
    } catch (error) {
        console.log(error);
    }
});

app.get('/new-entry', (req, res) => {
    res.render('new.ejs');
});



app.post('/new-entry/submit', async (req, res) => {
    const newEntry = req.body;
    fetchAndSaveCover(newEntry.isbn);
    const imagePath = `assets/images/covers/${newEntry.isbn}.jpg`;
    const timeStamp = new Date();

    try {
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

app.post('/sort', (req, res) => {
    const sortingChoice = req.body.sortBy;
    currentSortOption = sortingChoice;
    res.redirect('/')
});

app.post('/notes', async (req, res) => {
    currentBookId = req.body.idForNotes;
    try {
        const notes = await fetchNotes(currentBookId);
        const formattedNotes = await formatData(notes);

        res.render('notes.ejs', { data: formattedNotes });
    } catch (error) {
        console.log(error);
    }
});

app.post('/notes/submit', async (req, res) => {
    const note = req.body.newNote;
    
    try {
        await db.query('INSERT INTO notes (note, book_id) VALUES ($1, $2)', [note, currentBookId]);

        res.redirect('/notes');
    } catch (error) {
        console.log(error);
    }
});

app.get('/notes', async (req, res) => {
    try {
        const notes = await fetchNotes(currentBookId);
        const formattedNotes = await formatData(notes);
        res.render('notes.ejs', { data: formattedNotes });
    } catch (error) {
        console.log(error);
    }
});


app.post('/update/note', async (req, res) => {
    const updatedNote = req.body.noteToUpdate;
    const updateNoteId = req.body.noteIdToUpdate;
    
    try {
        await db.query('UPDATE notes SET note = ($1) WHERE id = $2', [updatedNote, updateNoteId]);
        res.redirect('/notes');
    } catch (error) {
        console.log(error);
    }
});

app.post('/delete/note', async (req, res) => {
    const deleteNoteId = req.body.noteIdToDelete;

    try {
       await db.query('DELETE FROM notes WHERE id = $1', [deleteNoteId]);
       res.redirect('/notes');
    } catch (error) {
       console.log(error);
    }
   });

app.post('/update/review', async (req, res) => {
    const updatedReview = req.body.reviewToUpdate;
    currentBookId = req.body.reviewIdToUpdate;
    
    try {
        await db.query('UPDATE books SET review = ($1) WHERE id = $2', [updatedReview, currentBookId]);
        res.redirect('/');
    } catch (error) {
        console.log(error);
    }
});

app.post('/delete/book', async (req, res) => {
 const deleteBookId = req.body.bookToDelete;

 try {
    await db.query('DELETE FROM books WHERE id = $1', [deleteBookId]);
    res.redirect('/')
 } catch (error) {
    console.log(error);
 }
});

app.listen(port, () => {
    console.log('Server running on port 3000');
});