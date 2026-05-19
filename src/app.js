const express = require('express');
const path = require('path');
const scoreRoute = require('./routes/score');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.use('/score', scoreRoute);

module.exports = app;