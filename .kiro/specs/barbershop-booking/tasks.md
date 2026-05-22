# Implementation Plan: Barbershop Booking

## Overview

Este plan descompone el sistema de reservas para barbería en tareas incrementales de codificación. Cada tarea construye sobre las anteriores, comenzando por la estructura del proyecto y las interfaces base, pasando por la capa de datos, autenticación, reservas, agenda del barbero, y finalizando con la integración de todos los componentes. Se utiliza Node.js + Express con TypeScript para el backend, PostgreSQL para persistencia, Redis para sesiones/cache, y React + TypeScript para el frontend web.

## Tasks

- [x] 1. Configurar estructura del proyecto e interfaces base
  - [x] 1.1 Inicializar proyecto backend con Node.js, Express y TypeScript
    - Crear `package.json` con dependencias: express, pg, redis, jsonwebtoken, bcrypt, zod, uuid
    - Configurar `tsconfig.json` con strict mode
    - Crear estructura de carpetas: `src/modules/auth`, `src/modules/booking`, `src/modules/notification`, `src/middleware`, `src/config`, `src/shared`
    - Configurar scripts de build y desarrollo
    - _Requisitos: 8.1_

  - [x] 1.2 Definir interfaces y tipos compartidos del sistema
    - Crear `src/shared/types.ts` con interfaces: `SuccessResponse<T>`, `ErrorResponse`, `UserProfile`, `Role`
    - Crear `src/shared/errors.ts` con códigos de error definidos en el diseño (VALIDATION_ERROR, TOKEN_MISSING, etc.)
    - Crear `src/shared/constants.ts` con constantes del sistema (duración de turno: 30 min, máximo turnos activos: 3, tiempo mínimo cancelación: 2 horas)
    - _Requisitos: 8.7_

  - [x] 1.3 Crear esquemas de validación con Zod
    - Crear `src/modules/auth/auth.schemas.ts` con esquemas: `RegisterDTO`, `LoginDTO`
    - Crear `src/modules/booking/booking.schemas.ts` con esquemas: `CreateBookingDTO`, parámetros de disponibilidad
    - Validar email según RFC 5322 (max 254 chars), contraseña (min 8 chars, 1 mayúscula, 1 minúscula, 1 número)
    - _Requisitos: 1.1, 1.6, 8.5_

  - [ ]* 1.4 Escribir test de propiedad para validación de email y contraseña
    - **Propiedad 1: Validación de email y contraseña**
    - Usar fast-check para generar emails y contraseñas aleatorios
    - Verificar que la función de validación acepta si y solo si cumple RFC 5322 y requisitos de contraseña
    - **Valida: Requisitos 1.1, 1.6**

- [x] 2. Implementar capa de datos y migraciones
  - [x] 2.1 Configurar conexión a PostgreSQL y Redis
    - Crear `src/config/database.ts` con pool de conexiones PostgreSQL (reintentos automáticos, máximo 3 intentos, backoff exponencial)
    - Crear `src/config/redis.ts` con cliente Redis para sesiones y cache
    - Crear `src/config/env.ts` con variables de entorno validadas con Zod
    - _Requisitos: 8.6_

  - [x] 2.2 Crear migraciones de base de datos
    - Crear migración para tipos ENUM: `user_role`, `booking_status`
    - Crear migración para tabla `users` con campos: id, email, password_hash, name, phone, role, is_active, created_at, updated_at
    - Crear migración para tabla `barber_profiles` con campos: id, user_id, specialty, working_hours (JSONB), is_available
    - Crear migración para tabla `bookings` con constraints: valid_duration, future_booking
    - Crear migración para tabla `login_attempts`
    - Crear índices: `idx_bookings_barber_date`, `idx_bookings_client`, `idx_login_attempts_user`, `idx_users_email`
    - Crear constraint UNIQUE parcial: `idx_no_overlap_barber` para evitar solapamiento
    - _Requisitos: 3.3, 8.1_

  - [x] 2.3 Implementar repositorios de acceso a datos
    - Crear `src/modules/auth/user.repository.ts` con métodos: findByEmail, create, updateLastLogin
    - Crear `src/modules/auth/login-attempt.repository.ts` con métodos: create, countRecentFailed, getLastSuccessful
    - Crear `src/modules/booking/booking.repository.ts` con métodos: create, findById, findByClient, findByBarberAndDate, updateStatus, countActiveByClient
    - Crear `src/modules/booking/barber.repository.ts` con métodos: findById, findAll, getWorkingHours
    - _Requisitos: 8.1_

- [x] 3. Checkpoint - Verificar estructura base
  - Asegurar que todas las migraciones se ejecutan correctamente, que los repositorios compilan sin errores. Preguntar al usuario si surgen dudas.

- [x] 4. Implementar módulo de autenticación
  - [x] 4.1 Implementar servicio de registro de clientes
    - Crear `src/modules/auth/auth.service.ts` con método `register()`
    - Hashear contraseña con bcrypt (salt rounds: 12)
    - Verificar que el email no exista previamente (retornar error si duplicado)
    - Generar JWT access token (15 min) y refresh token (7 días)
    - _Requisitos: 1.1, 1.4, 1.6_

  - [x] 4.2 Implementar servicio de login con bloqueo de cuenta
    - Implementar método `login()` en auth.service.ts
    - Verificar bloqueo de cuenta en Redis antes de autenticar (5 intentos fallidos → bloqueo 15 min)
    - Registrar cada intento en tabla `login_attempts`
    - Reiniciar contador de fallos tras login exitoso
    - Retornar mensaje genérico sin revelar cuál campo es incorrecto
    - _Requisitos: 1.2, 1.3, 1.5, 2.1, 2.2, 2.3_

  - [ ]* 4.3 Escribir test de propiedad para bloqueo de cuenta
    - **Propiedad 2: Bloqueo de cuenta por intentos fallidos consecutivos**
    - Generar secuencias aleatorias de intentos exitosos/fallidos
    - Verificar que la cuenta se bloquea si y solo si hay 5+ intentos fallidos consecutivos
    - Verificar que un intento exitoso reinicia el contador
    - **Valida: Requisitos 1.5, 2.3**

  - [x] 4.4 Implementar middleware de autenticación JWT
    - Crear `src/middleware/auth.middleware.ts`
    - Extraer y verificar token del header Authorization (Bearer)
    - Validar firma, expiración y que el usuario exista y esté activo
    - Retornar 401 con código apropiado (TOKEN_MISSING, TOKEN_EXPIRED, TOKEN_INVALID)
    - _Requisitos: 8.2, 8.3_

  - [x] 4.5 Implementar middleware de autorización por roles
    - Crear `src/middleware/role.middleware.ts`
    - Verificar que el rol del usuario autenticado tenga permiso para el endpoint
    - Retornar 403 con código INSUFFICIENT_PERMISSIONS si no tiene acceso
    - _Requisitos: 2.4, 2.5, 8.4_

  - [ ]* 4.6 Escribir test de propiedad para validación de token
    - **Propiedad 13: Validación de token de autenticación**
    - Generar tokens válidos e inválidos (firma incorrecta, expirados, usuario inexistente)
    - Verificar que solo tokens válidos permiten acceso
    - **Valida: Requisitos 8.2, 8.3**

  - [ ]* 4.7 Escribir test de propiedad para autorización basada en roles
    - **Propiedad 14: Autorización basada en roles**
    - Generar combinaciones aleatorias de (rol, endpoint, método HTTP)
    - Verificar que roles sin permiso reciben 403 independientemente de los datos
    - **Valida: Requisitos 8.4**

  - [x] 4.8 Implementar refresh token y logout
    - Implementar método `refreshToken()` para renovar access token
    - Implementar método `logout()` que invalida el refresh token en Redis
    - Manejar expiración de sesión por inactividad (60 min clientes, 30 min barberos)
    - _Requisitos: 1.2, 2.6_

  - [x] 4.9 Crear rutas de autenticación
    - Crear `src/modules/auth/auth.routes.ts`
    - POST /auth/register (público)
    - POST /auth/login (público)
    - POST /auth/refresh (autenticado)
    - POST /auth/logout (autenticado)
    - Aplicar validación Zod en cada ruta
    - _Requisitos: 8.1, 8.5_

- [x] 5. Implementar módulo de reservas
  - [x] 5.1 Implementar cálculo de disponibilidad
    - Crear `src/modules/booking/availability.service.ts`
    - Obtener horario laboral del barbero para el día de la semana solicitado
    - Generar todos los bloques de 30 minutos dentro del horario laboral
    - Filtrar bloques que se solapan con turnos confirmados existentes
    - Retornar solo bloques disponibles
    - _Requisitos: 3.2_

  - [ ]* 5.2 Escribir test de propiedad para cálculo de disponibilidad
    - **Propiedad 3: Cálculo de disponibilidad**
    - Generar horarios laborales y conjuntos de turnos aleatorios
    - Verificar: (a) bloques dentro del horario, (b) exactamente 30 min, (c) sin solapamiento con turnos existentes, (d) cobertura completa
    - **Valida: Requisitos 3.2**

  - [x] 5.3 Implementar creación de turnos con validaciones
    - Crear `src/modules/booking/booking.service.ts` con método `createBooking()`
    - Validar que la fecha esté entre 1 y 30 días a futuro
    - Validar que el horario esté dentro del horario laboral del barbero
    - Verificar no solapamiento con turnos del barbero (usar SELECT FOR UPDATE)
    - Verificar no solapamiento con turnos del cliente en la misma fecha/hora
    - Verificar que el cliente no exceda 3 turnos activos
    - Retornar error apropiado: SLOT_UNAVAILABLE, CLIENT_OVERLAP, MAX_BOOKINGS_REACHED
    - _Requisitos: 3.1, 3.3, 3.4, 3.5_

  - [ ]* 5.4 Escribir test de propiedad para no solapamiento de turnos por barbero
    - **Propiedad 4: No solapamiento de turnos por barbero**
    - Generar secuencias de reservas para un mismo barbero y fecha
    - Verificar que nunca existen dos turnos confirmados con rangos de tiempo solapados
    - **Valida: Requisitos 3.3**

  - [ ]* 5.5 Escribir test de propiedad para no solapamiento de turnos por cliente
    - **Propiedad 5: No solapamiento de turnos por cliente**
    - Generar secuencias de reservas para un mismo cliente
    - Verificar que se rechaza cualquier turno que se solape con otro del mismo cliente
    - **Valida: Requisitos 3.4**

  - [ ]* 5.6 Escribir test de propiedad para máximo de turnos activos
    - **Propiedad 6: Máximo de turnos activos por cliente**
    - Generar secuencias de creación de turnos para un cliente
    - Verificar que nunca se exceden 3 turnos confirmados simultáneamente
    - **Valida: Requisitos 3.5**

  - [x] 5.7 Implementar cancelación de turnos
    - Implementar método `cancelBooking()` en booking.service.ts
    - Verificar que el turno pertenece al cliente solicitante
    - Verificar que faltan al menos 2 horas para la hora programada
    - Verificar que el turno no esté ya cancelado o completado
    - Cambiar estado a 'cancelled' y registrar timestamp de cancelación
    - Retornar error apropiado: BOOKING_NOT_FOUND, CANCELLATION_TOO_LATE, BOOKING_ALREADY_CANCELLED, BOOKING_ALREADY_COMPLETED
    - _Requisitos: 4.1, 4.3, 4.4, 4.5, 4.6_

  - [ ]* 5.8 Escribir test de propiedad para regla de tiempo de cancelación
    - **Propiedad 7: Regla de tiempo para cancelación**
    - Generar turnos con diferentes tiempos restantes antes de la hora programada
    - Verificar que la cancelación es exitosa si y solo si faltan al menos 2 horas
    - **Valida: Requisitos 4.1, 4.4**

  - [ ]* 5.9 Escribir test de propiedad para cancelación restringida al propietario
    - **Propiedad 8: Cancelación restringida al propietario**
    - Generar pares (cliente, turno) donde el turno no pertenece al cliente
    - Verificar que el intento de cancelación es rechazado sin modificar el turno
    - **Valida: Requisitos 4.6**

  - [x] 5.10 Implementar consulta de turnos del cliente
    - Implementar método `getClientBookings()` en booking.service.ts
    - Retornar turnos del cliente autenticado con información del barbero
    - _Requisitos: 3.1_

  - [x] 5.11 Crear rutas de reservas
    - Crear `src/modules/booking/booking.routes.ts`
    - GET /bookings (cliente - listar sus turnos)
    - POST /bookings (cliente - crear turno)
    - DELETE /bookings/:id (cliente - cancelar turno)
    - GET /availability/:barberId (cliente - consultar disponibilidad)
    - Aplicar middleware de autenticación y autorización
    - Aplicar validación Zod en cada ruta
    - _Requisitos: 8.1, 8.4, 8.5_

- [x] 6. Checkpoint - Verificar módulos de autenticación y reservas
  - Asegurar que todos los tests pasan, que las rutas responden correctamente. Preguntar al usuario si surgen dudas.

- [x] 7. Implementar módulo de agenda del barbero
  - [x] 7.1 Implementar servicio de agenda
    - Crear `src/modules/booking/agenda.service.ts`
    - Implementar método `getBarberAgenda(barberId, date)`
    - Retornar solo turnos confirmados del barbero autenticado para la fecha solicitada
    - Incluir: nombre del cliente, hora de inicio, duración, tipo de servicio, estado
    - Ordenar cronológicamente por hora de inicio (ascendente)
    - _Requisitos: 5.1, 5.2, 5.3, 6.3_

  - [ ]* 7.2 Escribir test de propiedad para completitud de datos en la agenda
    - **Propiedad 9: Completitud de datos en la agenda**
    - Generar turnos confirmados con datos variados
    - Verificar que cada entrada incluye: nombre del cliente, hora de inicio, duración y tipo de servicio
    - **Valida: Requisitos 5.2**

  - [ ]* 7.3 Escribir test de propiedad para ordenamiento cronológico
    - **Propiedad 10: Ordenamiento cronológico de la agenda**
    - Generar conjuntos de turnos con horas de inicio aleatorias
    - Verificar que la respuesta está ordenada ascendentemente por start_time
    - **Valida: Requisitos 5.3**

  - [ ]* 7.4 Escribir test de propiedad para aislamiento de datos del barbero
    - **Propiedad 12: Aislamiento de datos del barbero**
    - Generar turnos para múltiples barberos
    - Verificar que al consultar la agenda de un barbero, solo aparecen sus propios turnos
    - **Valida: Requisitos 6.3**

  - [ ]* 7.5 Escribir test de propiedad para restricción de solo lectura del barbero
    - **Propiedad 11: Barbero restringido a solo lectura**
    - Generar solicitudes de creación/modificación/eliminación con rol barbero
    - Verificar que todas son rechazadas con 403
    - **Valida: Requisitos 2.4, 6.2**

  - [x] 7.6 Crear rutas de agenda del barbero
    - Crear rutas en `src/modules/booking/agenda.routes.ts`
    - GET /barber/agenda (barbero - agenda del día actual)
    - GET /barber/agenda/:date (barbero - agenda por fecha)
    - Aplicar middleware de autenticación y autorización (solo rol barbero)
    - _Requisitos: 5.1, 6.1, 8.1_

- [x] 8. Implementar módulo de administración
  - [x] 8.1 Implementar gestión de barberos por administrador
    - Crear `src/modules/admin/admin.service.ts`
    - Implementar método `createBarber()` para crear cuenta de barbero con perfil
    - Implementar método `listBarbers()` para listar todos los barberos
    - Solo accesible por usuarios con rol 'admin'
    - _Requisitos: 2.4, 2.5_

  - [x] 8.2 Crear rutas de administración
    - Crear `src/modules/admin/admin.routes.ts`
    - POST /admin/barbers (admin - crear barbero)
    - GET /admin/barbers (admin - listar barberos)
    - Aplicar middleware de autenticación y autorización (solo rol admin)
    - _Requisitos: 2.4, 8.1_

- [x] 9. Implementar módulo de notificaciones y capa API
  - [x] 9.1 Implementar servicio de notificaciones
    - Crear `src/modules/notification/notification.service.ts`
    - Implementar `notifyBookingConfirmation()` para enviar confirmación al crear turno
    - Implementar `notifyBookingCancellation()` para notificar cancelación
    - Integrar con cola de reintentos (máximo 3 intentos, intervalo 2 segundos)
    - _Requisitos: 4.2_

  - [x] 9.2 Implementar middleware de manejo de errores global
    - Crear `src/middleware/error.middleware.ts`
    - Transformar errores de Zod en respuesta estructurada con detalle por campo
    - Mapear errores de negocio a códigos HTTP apropiados
    - Asegurar estructura consistente: `{ success, data/error }`
    - Nunca exponer stack traces en producción
    - _Requisitos: 8.5, 8.7_

  - [ ]* 9.3 Escribir test de propiedad para validación de entrada retorna 400
    - **Propiedad 15: Validación de entrada retorna 400**
    - Generar solicitudes con datos inválidos (campos ausentes, tipos incorrectos, valores fuera de rango)
    - Verificar que la API retorna 400 con indicación de campos con error
    - **Valida: Requisitos 8.5**

  - [ ]* 9.4 Escribir test de propiedad para estructura consistente de respuesta JSON
    - **Propiedad 16: Estructura consistente de respuesta JSON**
    - Generar solicitudes variadas (exitosas y fallidas)
    - Verificar que toda respuesta tiene campo `success` y `data` o `error` según corresponda
    - **Valida: Requisitos 8.7**

  - [x] 9.5 Configurar servidor Express y wiring de rutas
    - Crear `src/app.ts` con configuración de Express
    - Registrar todas las rutas: auth, bookings, barber/agenda, admin
    - Aplicar middlewares globales: CORS, JSON parser, rate limiting, error handler
    - Crear `src/server.ts` como punto de entrada
    - _Requisitos: 8.1, 8.6_

- [x] 10. Checkpoint - Verificar backend completo
  - Asegurar que todos los tests pasan, que todos los endpoints responden correctamente con la estructura JSON definida. Preguntar al usuario si surgen dudas.

- [x] 11. Implementar frontend web (React + TypeScript)
  - [x] 11.1 Configurar proyecto frontend web
    - Inicializar proyecto React + TypeScript con Vite
    - Configurar estructura de carpetas: `src/pages`, `src/components`, `src/services`, `src/hooks`, `src/types`
    - Instalar dependencias: react-router-dom, axios, zustand (estado global)
    - Configurar cliente HTTP con interceptor para JWT (auto-refresh)
    - _Requisitos: 7.1_

  - [x] 11.2 Implementar páginas de autenticación
    - Crear página de registro con formulario: email, contraseña, nombre, teléfono (opcional)
    - Crear página de login con formulario: email, contraseña
    - Implementar validación de formularios en cliente (mismas reglas que backend)
    - Mostrar mensajes de error genéricos sin revelar campo incorrecto
    - Manejar bloqueo de cuenta (mostrar tiempo de espera)
    - _Requisitos: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 11.3 Implementar Portal del Cliente - Reserva de turnos
    - Crear página de selección de barbero con lista de barberos disponibles
    - Crear componente de calendario para selección de fecha (1-30 días a futuro)
    - Crear componente de slots de tiempo mostrando disponibilidad
    - Implementar flujo de creación de turno con confirmación
    - Mostrar confirmación con: ID del turno, nombre del barbero, fecha y hora
    - _Requisitos: 3.1, 3.2_

  - [x] 11.4 Implementar Portal del Cliente - Gestión de turnos
    - Crear página "Mis Turnos" con lista de turnos activos del cliente
    - Implementar botón de cancelación con confirmación
    - Mostrar mensajes de error apropiados (horario ocupado, máximo alcanzado, cancelación tardía)
    - Mostrar indicador de máximo de turnos activos (X/3)
    - _Requisitos: 3.3, 3.4, 3.5, 4.1, 4.2, 4.4, 4.5_

  - [x] 11.5 Implementar Panel del Barbero
    - Crear página de agenda diaria en modo solo lectura
    - Mostrar lista de turnos: nombre del cliente, hora, duración, servicio
    - Implementar navegación entre fechas
    - Mostrar mensaje cuando no hay turnos agendados
    - No incluir botones ni opciones de crear/modificar/eliminar
    - Implementar actualización automática cada 30 segundos
    - _Requisitos: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.3_

  - [x] 11.6 Implementar enrutamiento y protección de rutas
    - Configurar React Router con rutas protegidas por rol
    - Redirigir a login si no autenticado
    - Redirigir según rol: cliente → Portal del Cliente, barbero → Panel del Barbero
    - Manejar expiración de sesión con redirección a login
    - _Requisitos: 1.2, 2.6_

- [x] 12. Implementar aplicación móvil (React Native)
  - [x] 12.1 Configurar proyecto React Native
    - Inicializar proyecto React Native con TypeScript
    - Configurar navegación con React Navigation
    - Reutilizar servicios HTTP y tipos del frontend web
    - Configurar almacenamiento seguro para tokens (SecureStore)
    - _Requisitos: 7.2_

  - [x] 12.2 Implementar pantallas de autenticación móvil
    - Crear pantalla de registro con formulario nativo
    - Crear pantalla de login con formulario nativo
    - Implementar validación de formularios
    - Manejar estados de error y bloqueo de cuenta
    - _Requisitos: 1.1, 1.2, 1.3, 1.5, 7.2_

  - [x] 12.3 Implementar pantallas de reserva y gestión de turnos móvil
    - Crear pantalla de selección de barbero
    - Crear pantalla de selección de fecha y hora con componentes nativos
    - Crear pantalla de confirmación de turno
    - Crear pantalla "Mis Turnos" con opción de cancelación
    - _Requisitos: 3.1, 3.2, 4.1, 7.2_

  - [x] 12.4 Implementar sincronización cross-platform
    - Implementar polling o WebSocket para detectar cambios en tiempo real
    - Mostrar mensaje si la sincronización falla
    - Implementar reintento automático (máximo 3 intentos, intervalo 2 segundos)
    - Asegurar que cambios se reflejan en todas las plataformas en máximo 5 segundos
    - _Requisitos: 7.3, 7.4_

- [x] 13. Checkpoint final - Verificar sistema completo
  - Asegurar que todos los tests pasan, que el frontend web y móvil se comunican correctamente con el backend. Preguntar al usuario si surgen dudas.

## Notes

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia requisitos específicos para trazabilidad
- Los checkpoints aseguran validación incremental
- Los tests de propiedad validan propiedades universales de correctitud definidas en el diseño
- Los tests unitarios validan ejemplos específicos y casos borde
- Se usa fast-check como librería de property-based testing
- El backend debe responder en menos de 2 segundos bajo condiciones normales (Requisito 8.6)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "2.1"] },
    { "id": 2, "tasks": ["1.4", "2.2"] },
    { "id": 3, "tasks": ["2.3"] },
    { "id": 4, "tasks": ["4.1", "4.4"] },
    { "id": 5, "tasks": ["4.2", "4.5", "4.8"] },
    { "id": 6, "tasks": ["4.3", "4.6", "4.7", "4.9"] },
    { "id": 7, "tasks": ["5.1", "5.3", "8.1"] },
    { "id": 8, "tasks": ["5.2", "5.4", "5.5", "5.6", "5.7", "5.10", "8.2"] },
    { "id": 9, "tasks": ["5.8", "5.9", "5.11"] },
    { "id": 10, "tasks": ["7.1"] },
    { "id": 11, "tasks": ["7.2", "7.3", "7.4", "7.5", "7.6"] },
    { "id": 12, "tasks": ["9.1", "9.2"] },
    { "id": 13, "tasks": ["9.3", "9.4", "9.5"] },
    { "id": 14, "tasks": ["11.1"] },
    { "id": 15, "tasks": ["11.2", "11.5"] },
    { "id": 16, "tasks": ["11.3", "11.4", "11.6"] },
    { "id": 17, "tasks": ["12.1"] },
    { "id": 18, "tasks": ["12.2"] },
    { "id": 19, "tasks": ["12.3", "12.4"] }
  ]
}
```
