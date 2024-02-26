const express = require('express');
const dotenv = require('dotenv').config;
const app = express();
const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || 'localhost';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// app.use(express.static("upload"));

const cors = require('cors');
app.use(cors());

const auth = require('./routes/Auth');
const items = require('./routes/item');
const categories = require('./routes/categories');
const subCategories = require('./routes/subCategories');

app.listen(PORT, HOST, () => {
  console.log('server is running');
});

app.use('/auth', auth);
app.use('/items', items);
app.use('/categories', categories);
app.use('/subCategories', subCategories);

module.exports = app;
