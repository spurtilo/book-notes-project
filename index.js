import express from "express";
import bodyParser from "body-parser";
import axios from 'axios';
import pg from "pg";
import 'dotenv/config';

const app = express();
const port = 3000;

const db = new pg.Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.get('/', async (req, res) => {
    // const result = await db.query('SELECT * FROM books')
    // console.log(result.rows);
    res.render('index.ejs')
});

app.listen(port, () => {
    console.log('Server running on port 3000');
});