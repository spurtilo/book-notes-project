import express from "express";
import bodyParser from "body-parser";
import axios from 'axios';
import pg from "pg";

const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.get('/', (req, res) => {
    res.render('index.ejs')
});

app.listen(port, () => {
    console.log('Server running on port 3000');
});