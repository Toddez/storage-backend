import Database from './db';
Database.connect();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

require('dotenv').config();

const app = express();

const port = process.env.HTTP_PORT || 1337;

app.use(cors());

// Bodyparser
app.use(bodyParser.json()); // application/json
app.use(bodyParser.urlencoded({ extended:  true })); // application/x-www-form-urlencoded

// Import routes
import auth from './routes/auth';
import storage from './routes/storage';

// Use routes
app.use('/', auth);
app.use('/storage', storage);

// If no route found
app.use((req, res, next) => {
    let err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// Error handling
app.use((err, req, res, next) => {
    if (res.headersSent) {
        return next(err);
    }

    if (!err.status) {
        err = new Error('Internal server error');
        err.status = 500;
    }

    res.status(err.status || 500).json({
        errors: [
            {
                status: err.status,
                message: err.message
            }
        ]
    });
});

app.listen(port, () => {
    console.log(`API listening on port ${port}`);
});

