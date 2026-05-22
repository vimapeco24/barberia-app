import 'dotenv/config';
import app from './app';

const PORT = process.env.PORT || 3000;

async function start() {
  // Seed mock data if using mock database
  if (process.env.USE_MOCK_DB === 'true') {
    const { seedData } = await import('./config/mock-database');
    await seedData();
    console.log('🚀 Running in MOCK mode (no PostgreSQL/Redis needed)');
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export default app;
