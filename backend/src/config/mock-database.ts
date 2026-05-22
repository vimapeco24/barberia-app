/**
 * Mock database implementation for development without PostgreSQL.
 * Stores data in memory. All data is lost on restart.
 */
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

// In-memory storage
const users: any[] = [];
const barberProfiles: any[] = [];
const bookings: any[] = [];
const loginAttempts: any[] = [];

// Seed an admin user and a barber
async function seedData() {
  const adminHash = await bcrypt.hash('Admin123', 12);
  const barberHash = await bcrypt.hash('Barber123', 12);
  const clientHash = await bcrypt.hash('Client123', 12);

  const adminId = uuidv4();
  const barberId = uuidv4();
  const clientId = uuidv4();
  const barberProfileId = uuidv4();

  users.push(
    { id: adminId, email: 'admin@barbershop.com', password_hash: adminHash, name: 'Administrador', phone: null, role: 'admin', is_active: true, created_at: new Date(), updated_at: new Date() },
    { id: barberId, email: 'carlos@barbershop.com', password_hash: barberHash, name: 'Carlos López', phone: '+573107729651', role: 'barber', is_active: true, created_at: new Date(), updated_at: new Date() },
    { id: clientId, email: 'cliente@test.com', password_hash: clientHash, name: 'Juan Pérez', phone: '+5491155559999', role: 'client', is_active: true, created_at: new Date(), updated_at: new Date() },
  );

  barberProfiles.push({
    id: barberProfileId,
    user_id: barberId,
    specialty: 'Cortes clásicos y modernos',
    working_hours: {
      mon: { start: '09:00', end: '18:00' },
      tue: { start: '09:00', end: '18:00' },
      wed: { start: '09:00', end: '18:00' },
      thu: { start: '09:00', end: '18:00' },
      fri: { start: '09:00', end: '18:00' },
      sat: { start: '09:00', end: '14:00' },
      sun: null,
    },
    is_available: true,
  });

  console.log('📦 Mock database seeded:');
  console.log('   Admin: admin@barbershop.com / Admin123');
  console.log('   Barbero: carlos@barbershop.com / Barber123');
  console.log('   Cliente: cliente@test.com / Client123');
}

// Mock query function that simulates pg Pool.query
function createMockQuery() {
  return async (text: string, params?: any[]): Promise<{ rows: any[]; rowCount: number }> => {
    const sql = text.toLowerCase().trim();

    // SELECT user by email (WHERE email = $1)
    if (sql.includes('from users') && sql.includes('where email')) {
      const email = params?.[0];
      const user = users.find(u => u.email === email);
      return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
    }

    // SELECT user by id (WHERE id = $1)
    if (sql.includes('from users') && sql.includes('where id')) {
      const id = params?.[0];
      const user = users.find(u => u.id === id);
      return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
    }

    // INSERT user
    if (sql.includes('insert into users')) {
      const newUser = {
        id: uuidv4(),
        email: params?.[0],
        password_hash: params?.[1],
        name: params?.[2],
        phone: params?.[3] || null,
        role: params?.[4] || 'client',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      users.push(newUser);
      return { rows: [newUser], rowCount: 1 };
    }

    // INSERT login attempt
    if (sql.includes('insert into login_attempts')) {
      const attempt = { id: uuidv4(), user_id: params?.[0], email: params?.[1], success: params?.[2], ip_address: params?.[3], attempted_at: new Date() };
      loginAttempts.push(attempt);
      return { rows: [attempt], rowCount: 1 };
    }

    // COUNT recent failed login attempts
    if (sql.includes('login_attempts') && sql.includes('count')) {
      const email = params?.[0];
      const windowMinutes = params?.[1] || 15;
      const windowAgo = new Date(Date.now() - windowMinutes * 60 * 1000);
      const count = loginAttempts.filter(a => a.email === email && a.success === false && a.attempted_at > windowAgo).length;
      return { rows: [{ count: count.toString() }], rowCount: 1 };
    }

    // SELECT bookings by client (with barber info) - MUST be before barber_profiles conditions
    if (sql.includes('from bookings') && sql.includes('b.client_id')) {
      const clientId = params?.[0];
      console.log('[MockDB] findByClientWithBarberInfo, clientId:', clientId, 'total bookings:', bookings.length);
      const results = bookings.filter(b => b.client_id === clientId).map(b => {
        const profile = barberProfiles.find(bp => bp.id === b.barber_id);
        const barberUser = users.find(u => u.id === profile?.user_id);
        return { ...b, barber_name: barberUser?.name || 'Barbero', barber_specialty: profile?.specialty };
      });
      console.log('[MockDB] Found', results.length, 'bookings for client');
      return { rows: results, rowCount: results.length };
    }

    // SELECT barber profiles (list barbers)
    if (sql.includes('barber_profiles') && sql.includes('join users') && !sql.includes('where bp.id') && !sql.includes('where bp.user_id') && !sql.includes('from bookings')) {
      console.log('[MockDB] listBarbers query matched');
      const results = barberProfiles.map(bp => {
        const user = users.find(u => u.id === bp.user_id);
        return { ...bp, email: user?.email, name: user?.name, phone: user?.phone };
      }).filter(bp => {
        const user = users.find(u => u.id === bp.user_id);
        return user?.is_active;
      });
      return { rows: results, rowCount: results.length };
    }

    // SELECT barber profile by user_id
    if (sql.includes('from barber_profiles') && sql.includes('where user_id') || (sql.includes('from barber_profiles') && sql.includes('where') && sql.includes('user_id') && !sql.includes('from bookings'))) {
      const userId = params?.[0];
      const profile = barberProfiles.find(bp => bp.user_id === userId);
      return { rows: profile ? [profile] : [], rowCount: profile ? 1 : 0 };
    }

    // SELECT barber profile by id
    if (sql.includes('from barber_profiles') && sql.includes('where') && sql.includes('id')) {
      const id = params?.[0];
      const profile = barberProfiles.find(bp => bp.id === id);
      return { rows: profile ? [profile] : [], rowCount: profile ? 1 : 0 };
    }

    // SELECT bookings by barber and date (for availability and agenda)
    if (sql.includes('from bookings') && sql.includes('barber_id') && sql.includes('booking_date')) {
      const barberId = params?.[0];
      const date = params?.[1];
      const results = bookings.filter(b => b.barber_id === barberId && b.booking_date === date && b.status === 'confirmed');
      // If it's an agenda query (joins users), add client name
      if (sql.includes('join users')) {
        const withNames = results.map(b => {
          const client = users.find(u => u.id === b.client_id);
          return { ...b, client_name: client?.name || 'Cliente' };
        });
        return { rows: withNames, rowCount: withNames.length };
      }
      return { rows: results, rowCount: results.length };
    }

    // SELECT bookings by client (simple - for overlap check)
    if (sql.includes('from bookings') && sql.includes('client_id') && sql.includes('booking_date')) {
      const clientId = params?.[0];
      const date = params?.[1];
      const results = bookings.filter(b => b.client_id === clientId && b.booking_date === date && b.status === 'confirmed');
      return { rows: results, rowCount: results.length };
    }

    // COUNT active bookings by client
    if (sql.includes('bookings') && sql.includes('count') && sql.includes('client_id')) {
      const clientId = params?.[0];
      const count = bookings.filter(b => b.client_id === clientId && b.status === 'confirmed').length;
      return { rows: [{ count: count.toString() }], rowCount: 1 };
    }

    // SELECT booking by id
    if (sql.includes('from bookings') && sql.includes('where') && sql.includes('id') && !sql.includes('client_id') && !sql.includes('barber_id')) {
      const id = params?.[0];
      const booking = bookings.find(b => b.id === id);
      return { rows: booking ? [booking] : [], rowCount: booking ? 1 : 0 };
    }

    // INSERT booking
    if (sql.includes('insert into bookings')) {
      const newBooking = {
        id: uuidv4(),
        client_id: params?.[0],
        barber_id: params?.[1],
        booking_date: params?.[2],
        start_time: params?.[3],
        duration_minutes: params?.[4] || 30,
        service_type: params?.[5],
        status: 'confirmed',
        created_at: new Date(),
        cancelled_at: null,
      };
      bookings.push(newBooking);
      return { rows: [newBooking], rowCount: 1 };
    }

    // UPDATE booking status
    if (sql.includes('update bookings') && sql.includes('status')) {
      const id = params?.[1] || params?.[0];
      const status = params?.[0];
      const booking = bookings.find(b => b.id === id);
      if (booking) {
        booking.status = status;
        if (status === 'cancelled') booking.cancelled_at = new Date();
        return { rows: [booking], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // INSERT barber profile
    if (sql.includes('insert into barber_profiles')) {
      const newProfile = {
        id: uuidv4(),
        user_id: params?.[0],
        specialty: params?.[1],
        working_hours: typeof params?.[2] === 'string' ? JSON.parse(params[2]) : params?.[2],
        is_available: true,
      };
      barberProfiles.push(newProfile);
      return { rows: [newProfile], rowCount: 1 };
    }

    // BEGIN/COMMIT/ROLLBACK (no-op for mock)
    if (sql === 'begin' || sql === 'commit' || sql === 'rollback') {
      return { rows: [], rowCount: 0 };
    }

    // UPDATE users (e.g., updateLastLogin)
    if (sql.includes('update users')) {
      return { rows: [], rowCount: 1 };
    }

    // SELECT FOR UPDATE (same as regular select for mock)
    if (sql.includes('for update')) {
      const barberId = params?.[0];
      const date = params?.[1];
      const results = bookings.filter(b => b.barber_id === barberId && b.booking_date === date && b.status === 'confirmed');
      return { rows: results, rowCount: results.length };
    }

    // Default: return empty
    console.warn('[MockDB] Unhandled query:', sql.substring(0, 80), params);
    return { rows: [], rowCount: 0 };
  };
}

const mockQuery = createMockQuery();

// Mock pool that mimics pg Pool interface
export const mockPool = {
  query: mockQuery,
  connect: async () => ({
    query: mockQuery,
    release: () => {},
  }),
  end: async () => {},
  on: () => {},
};

// Mock Redis client
const redisStore: Map<string, { value: string; expiry?: number }> = new Map();

export const mockRedisClient = {
  get: async (key: string) => {
    const entry = redisStore.get(key);
    if (!entry) return null;
    if (entry.expiry && Date.now() > entry.expiry) {
      redisStore.delete(key);
      return null;
    }
    return entry.value;
  },
  set: async (key: string, value: string, options?: { EX?: number }) => {
    const expiry = options?.EX ? Date.now() + options.EX * 1000 : undefined;
    redisStore.set(key, { value, expiry });
    return 'OK';
  },
  del: async (key: string) => {
    redisStore.delete(key);
    return 1;
  },
  incr: async (key: string) => {
    const entry = redisStore.get(key);
    const val = entry ? parseInt(entry.value, 10) + 1 : 1;
    redisStore.set(key, { value: val.toString(), expiry: entry?.expiry });
    return val;
  },
  expire: async (key: string, seconds: number) => {
    const entry = redisStore.get(key);
    if (entry) {
      entry.expiry = Date.now() + seconds * 1000;
    }
    return 1;
  },
  connect: async () => {},
  quit: async () => {},
  on: () => {},
  isOpen: true,
};

export { seedData };
