const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const medicamentosRoutes = require('./routes/medicamentos');
app.use('/api/medicamentos', medicamentosRoutes);
app.listen(3000, () => console.log('Servidor rodando na porta 3000'));