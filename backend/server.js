const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Import routes
const hubsRouter = require('./routes/hubs');
const workspacesRouter = require('./routes/workspaces');
const resourcesRouter = require('./routes/resources');
const bookingsRouter = require('./routes/bookings');
const pricingRouter = require('./routes/pricing');
const qrRouter = require('./routes/qr');
const ratingsRouter = require('./routes/ratings');
const usersRouter = require('./routes/users');
const transactionsRouter = require('./routes/transactions');

// Routes
app.use('/api/hubs', hubsRouter);
app.use('/api/workspaces', workspacesRouter);
app.use('/api/resources', resourcesRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/pricing', pricingRouter);
app.use('/api/qr', qrRouter);
app.use('/api/ratings', ratingsRouter);
app.use('/api/users', usersRouter);
app.use('/api/transactions', transactionsRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Co-Working Space API is running' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
