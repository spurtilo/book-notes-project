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

let bookDetails = [
    {
        isbn: '1782124209',
        title: 'Nineteen Eighty-Four (1984)',
        author: 'George Orwell',
        description: `Winston Smith toes the Party line, rewriting history to satisfy 
        the demands of the Ministry of Truth. With each lie he writes, 
        Winston grows to hate the Party that seeks power for its own sake 
        and persecutes those who dare to commit thoughtcrimes. But as he starts 
        to think for himself, Winston can't escape the fact that Big Brother is 
        always watching...`,
        review: `Imagine a messed-up world where thinking differently is a crime. 
        '1984' by Orwell shows us just that. Winston tries to rebel against this 
        Big Brother world, and it's gripping to see how he struggles. It's deep, 
        makes you look at our world differently, and kinda scary how it feels relatable 
        in some ways.`,
        rating: 5
    }, 
    {
        isbn: '1943138427',
        title: 'Animal Farm',
        author: 'George Orwell',
        description: `Animal Farm is a brilliant political satire and a powerful and 
        affecting story of revolutions and idealism, power and corruption. 'All animals 
        are equal. But some animals are more equal than others.' Mr Jones of Manor Farm 
        is so lazy and drunken that one day he forgets to feed his livestock. 
        The ensuing rebellion under the leadership of the pigs Napoleon and Snowball 
        leads to the animals taking over the farm. Vowing to eliminate the terrible 
        inequities of the farmyard, the renamed Animal Farm is organised to benefit 
        all who walk on four legs. But as time passes, the ideals of the rebellion are 
        corrupted, then forgotten. And something new and unexpected emerges..`,
        review: `Hey, 'Animal Farm' is like a farmyard story, but it's not all about cute animals. 
        It's more of a sneaky take on politics and power. The animals kick out the humans and run 
        things themselves, but things get pretty crazy. You start to see how power can mess things 
        up real bad. It's short, but it hits hard and makes you think about society and leadership 
        in a whole new way.`,
        rating: 3
    }
];

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

function formatData(data) {

    data.forEach((item) =>{
        if (item.description && !item.description.includes('<br>') && item.description.includes('\n')) {
            item.description = item.description.split('\n').join('<br>');
        }
    
        if (item.review &&! item.review.includes('<br>') && item.review .includes('\n')) {
            item.review  = item.review.split('\n').join('<br>');
        }
    });
    return data;
}

app.get('/', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM books')
        bookDetails = result.rows;
        const formattedDetails = formatData(bookDetails);

        res.render('index.ejs', { data: formattedDetails});
    } catch (error) {
        console.log(error);
    }
});

app.get('/new-entry', async (req, res) => {
    res.render('new.ejs');
});

app.post('/submit', async (req, res) => {
    const newEntry = req.body;
    fetchAndSaveCover(newEntry.isbn);
    const imagePath = `assets/images/covers/${newEntry.isbn}.jpg`;

    try {
        db.query('INSERT INTO books (isbn, title, author, description, review, rating, image_path) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [   newEntry.isbn,
                newEntry.title,
                newEntry.author,
                newEntry.description,
                newEntry.review,
                newEntry.rating,
                imagePath
            ]);
        res.redirect('/')
    } catch (error) {
        console.log(error);
    }
});

app.post('/update', async (req, res) => {
    const updatedReview = req.body.updatedBookReview;
    const updateId = req.body.idToUpdate;
    
    try {
        await db.query('UPDATE books SET review = ($1) WHERE id = $2', [updatedReview, updateId]);
        res.redirect('/');
    } catch (error) {
        console.log(error);
    }
});

app.post('/delete', async (req, res) => {
 const deleteId = req.body.idToDelete;

 try {
    await db.query('DELETE FROM books WHERE id = $1', [deleteId]);
    res.redirect('/')
 } catch (error) {
    console.log(error);
 }
});

app.listen(port, () => {
    console.log('Server running on port 3000');
});