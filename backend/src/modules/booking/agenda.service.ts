import { pool } from '../../config/database';

/**
 * Entrada de la agenda del barbero.
 * Contiene la información necesaria para que el barbero vea sus turnos del día.
 * Requisitos: 5.2
 */
export interface AgendaEntry {
  bookingId: string;
  clientName: string;
  startTime: string;
  duration: number;
  serviceType: string;
  status: 'confirmed' | 'cancelled' | 'completed';
}

/**
 * Servicio de agenda del barbero.
 * Proporciona acceso de solo lectura a los turnos confirmados del barbero autenticado.
 * Requisitos: 5.1, 5.2, 5.3, 6.3
 */
export const agendaService = {
  /**
   * Obtiene la agenda de un barbero para una fecha específica.
   *
   * - Retorna solo turnos confirmados del barbero autenticado (Req 5.1, 6.3)
   * - Incluye: nombre del cliente, hora de inicio, duración, tipo de servicio, estado (Req 5.2)
   * - Ordenados cronológicamente por hora de inicio ascendente (Req 5.3)
   *
   * @param barberId - ID del perfil de barbero (barber_profiles.id)
   * @param date - Fecha en formato ISO 8601 (YYYY-MM-DD)
   * @returns Lista de entradas de agenda ordenadas por hora de inicio
   */
  async getBarberAgenda(barberId: string, date: string): Promise<AgendaEntry[]> {
    const result = await pool.query<{
      id: string;
      client_name: string;
      start_time: string;
      duration_minutes: number;
      service_type: string;
      status: 'confirmed' | 'cancelled' | 'completed';
    }>(
      `SELECT b.id, u.name AS client_name, b.start_time, b.duration_minutes, b.service_type, b.status
       FROM bookings b
       JOIN users u ON u.id = b.client_id
       WHERE b.barber_id = $1
         AND b.booking_date = $2
         AND b.status = 'confirmed'
       ORDER BY b.start_time ASC`,
      [barberId, date]
    );

    return result.rows.map((row) => ({
      bookingId: row.id,
      clientName: row.client_name,
      startTime: row.start_time,
      duration: row.duration_minutes,
      serviceType: row.service_type,
      status: row.status,
    }));
  },
};
