const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/foods', require('./routes/foods'));
app.use('/api/transactions', require('./routes/transactions'));

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`🚀 MEAN backend on port ${PORT}`));