# Requirements Document

## Introduction

Sistema de reserva de turnos para barbería que permite a los clientes agendar citas a través de una aplicación web y móvil. Los barberos pueden consultar su agenda diaria pero no tienen la capacidad de crear o modificar turnos. El sistema incluye un backend (API) y un frontend (web y móvil).

## Glossary

- **Sistema_de_Reservas**: Aplicación completa (backend + frontend) que gestiona los turnos de la barbería
- **Cliente**: Persona que desea reservar un turno en la barbería
- **Barbero**: Profesional que presta el servicio de corte/arreglo en la barbería
- **Turno**: Cita agendada que asocia un cliente con un barbero en una fecha y hora específica
- **Agenda_Diaria**: Lista de turnos asignados a un barbero para un día específico
- **Panel_del_Barbero**: Interfaz de solo lectura donde el barbero consulta sus turnos del día
- **Portal_del_Cliente**: Interfaz web y móvil donde el cliente gestiona sus reservas
- **API_Backend**: Servicio de backend que procesa las solicitudes y gestiona la lógica de negocio

## Requirements

### Requirement 1: Registro y autenticación de clientes

**User Story:** Como cliente, quiero registrarme e iniciar sesión en la aplicación, para poder reservar turnos en la barbería.

#### Acceptance Criteria

1. WHEN un cliente proporciona un correo electrónico con formato válido (según RFC 5322, máximo 254 caracteres) y una contraseña de al menos 8 caracteres que contenga al menos una letra mayúscula, una minúscula y un número, THE Sistema_de_Reservas SHALL crear una cuenta de cliente y mostrar una confirmación de registro exitoso en pantalla
2. WHEN un cliente registrado ingresa credenciales correctas, THE Sistema_de_Reservas SHALL autenticar al cliente, iniciar una sesión con duración máxima de 60 minutos de inactividad, y otorgar acceso al Portal_del_Cliente
3. IF un cliente ingresa credenciales incorrectas, THEN THE Sistema_de_Reservas SHALL mostrar un mensaje de error indicando que las credenciales son inválidas sin revelar cuál campo es incorrecto
4. IF un cliente intenta registrarse con un correo electrónico ya existente, THEN THE Sistema_de_Reservas SHALL informar que el correo ya está registrado y ofrecer la opción de iniciar sesión
5. IF un cliente ingresa credenciales incorrectas 5 veces consecutivas, THEN THE Sistema_de_Reservas SHALL bloquear temporalmente el acceso a esa cuenta durante 15 minutos y mostrar un mensaje indicando el tiempo de espera restante
6. IF un cliente proporciona un correo electrónico con formato inválido o una contraseña que no cumple los requisitos mínimos durante el registro, THEN THE Sistema_de_Reservas SHALL mostrar un mensaje de error indicando los requisitos no cumplidos y no crear la cuenta

### Requirement 2: Registro y autenticación de barberos

**User Story:** Como barbero, quiero iniciar sesión en la aplicación, para poder ver mi agenda diaria.

#### Acceptance Criteria

1. WHEN un barbero ingresa su correo electrónico y contraseña correctos, THE Sistema_de_Reservas SHALL autenticar al barbero y otorgar acceso al Panel_del_Barbero dentro de 3 segundos
2. IF un barbero ingresa credenciales incorrectas, THEN THE Sistema_de_Reservas SHALL mostrar un mensaje de error indicando que las credenciales son inválidas sin revelar cuál campo es incorrecto
3. IF un barbero ingresa credenciales incorrectas 5 veces consecutivas, THEN THE Sistema_de_Reservas SHALL bloquear temporalmente el acceso a esa cuenta durante 15 minutos
4. THE Sistema_de_Reservas SHALL restringir la creación de cuentas de barbero exclusivamente a un administrador del sistema
5. IF un usuario sin rol de administrador intenta crear una cuenta de barbero, THEN THE Sistema_de_Reservas SHALL rechazar la solicitud y mostrar un mensaje de error indicando permisos insuficientes
6. IF una sesión de barbero permanece inactiva durante más de 30 minutos, THEN THE Sistema_de_Reservas SHALL cerrar la sesión automáticamente y redirigir al barbero a la pantalla de inicio de sesión

### Requirement 3: Reserva de turnos por parte del cliente

**User Story:** Como cliente, quiero reservar un turno seleccionando barbero, fecha y hora, para poder asistir a la barbería en el momento que me convenga.

#### Acceptance Criteria

1. WHEN un cliente autenticado selecciona un barbero, una fecha (entre 1 y 30 días naturales a partir de la fecha actual) y una hora disponible, THE Portal_del_Cliente SHALL crear un Turno con una duración de 30 minutos y mostrar una confirmación que incluya el identificador del turno, el nombre del barbero, la fecha y la hora reservada
2. WHEN un cliente solicita ver disponibilidad, THE Portal_del_Cliente SHALL mostrar únicamente los bloques de 30 minutos que se encuentren dentro del horario laboral del barbero seleccionado para la fecha elegida y que no estén ya reservados por otro Turno
3. IF un cliente intenta reservar un horario que ya no está disponible, THEN THE Sistema_de_Reservas SHALL rechazar la reserva y mostrar un mensaje de error indicando que el horario seleccionado fue ocupado, sin modificar los turnos existentes del cliente
4. IF un cliente intenta reservar un turno que se solapa con otro turno ya reservado por el mismo cliente en la misma fecha y hora, THEN THE Sistema_de_Reservas SHALL rechazar la reserva y mostrar un mensaje de error indicando el conflicto de horario
5. THE Sistema_de_Reservas SHALL permitir que un mismo cliente reserve como máximo 3 turnos activos en total

### Requirement 4: Cancelación de turnos por parte del cliente

**User Story:** Como cliente, quiero cancelar un turno previamente reservado, para poder liberar el horario si no puedo asistir.

#### Acceptance Criteria

1. WHEN un cliente autenticado solicita cancelar un Turno existente con al menos 2 horas de anticipación respecto a la hora programada del Turno, THE Sistema_de_Reservas SHALL cambiar el estado del Turno a cancelado y hacer que el horario correspondiente esté disponible para reserva por otros clientes en un máximo de 5 segundos
2. WHEN un Turno es cancelado exitosamente, THE Sistema_de_Reservas SHALL mostrar un mensaje de confirmación de cancelación en el Portal_del_Cliente y enviar una notificación al cliente mediante su canal de comunicación registrado
3. IF un cliente intenta cancelar un Turno que ya pasó, THEN THE Sistema_de_Reservas SHALL rechazar la cancelación e informar que el turno ya fue completado
4. IF un cliente intenta cancelar un Turno con menos de 2 horas de anticipación respecto a la hora programada, THEN THE Sistema_de_Reservas SHALL rechazar la cancelación e informar al cliente el tiempo mínimo de anticipación requerido
5. IF un cliente intenta cancelar un Turno que ya se encuentra en estado cancelado, THEN THE Sistema_de_Reservas SHALL informar al cliente que el Turno ya fue cancelado previamente
6. IF un cliente intenta cancelar un Turno que no le pertenece o que no existe, THEN THE Sistema_de_Reservas SHALL rechazar la operación e indicar que el Turno no fue encontrado

### Requirement 5: Visualización de agenda diaria del barbero

**User Story:** Como barbero, quiero ver mi agenda del día, para poder saber qué clientes tengo programados y a qué hora.

#### Acceptance Criteria

1. WHEN un barbero autenticado accede al Panel_del_Barbero, THE Panel_del_Barbero SHALL mostrar la lista de turnos confirmados y pendientes asignados al barbero para el día actual, dentro de los 3 segundos posteriores al acceso
2. THE Panel_del_Barbero SHALL mostrar para cada Turno: nombre del cliente, hora de inicio, duración estimada del servicio y servicio solicitado
3. THE Panel_del_Barbero SHALL ordenar los turnos cronológicamente de menor a mayor hora de inicio
4. WHEN no existen turnos confirmados ni pendientes para el día actual, THE Panel_del_Barbero SHALL mostrar un mensaje indicando que no hay turnos agendados
5. WHEN un Turno asignado al barbero es cancelado o modificado mientras el Panel_del_Barbero está visible, THE Panel_del_Barbero SHALL actualizar la lista de turnos dentro de los 30 segundos posteriores al cambio

### Requirement 6: Restricción de acciones del barbero

**User Story:** Como administrador, quiero que los barberos solo puedan ver su agenda sin modificarla, para mantener el control de las reservas desde el lado del cliente.

#### Acceptance Criteria

1. THE Panel_del_Barbero SHALL presentar la agenda del barbero autenticado en modo de solo lectura, mostrando para cada turno la fecha, hora, nombre del cliente y tipo de servicio, sin opciones visibles ni habilitadas para crear, modificar o eliminar turnos
2. IF un barbero intenta acceder a funciones de creación, modificación o eliminación de turnos a través de la API_Backend, THEN THE API_Backend SHALL rechazar la solicitud, retornar un error de autorización indicando permisos insuficientes y no realizar ningún cambio en los datos existentes
3. WHEN el barbero navega entre fechas en el Panel_del_Barbero, THE Panel_del_Barbero SHALL mostrar únicamente los turnos asignados al barbero autenticado para la fecha seleccionada, sin permitir acceso a la agenda de otros barberos

### Requirement 7: Disponibilidad multiplataforma

**User Story:** Como cliente, quiero acceder a la aplicación desde un navegador web o desde mi dispositivo móvil, para poder reservar turnos desde cualquier plataforma.

#### Acceptance Criteria

1. THE Portal_del_Cliente SHALL estar disponible como aplicación web completamente funcional desde las últimas 2 versiones estables de los navegadores Chrome, Safari, Firefox y Edge, tanto en sus versiones de escritorio como móviles
2. THE Portal_del_Cliente SHALL estar disponible como aplicación móvil para dispositivos con iOS 15 o superior y Android 10 o superior
3. WHEN un cliente crea, modifica o cancela un turno desde cualquier plataforma, THE Sistema_de_Reservas SHALL reflejar el cambio en todas las demás plataformas en un máximo de 5 segundos
4. IF la sincronización entre plataformas falla, THEN THE Sistema_de_Reservas SHALL mostrar un mensaje indicando que los datos pueden no estar actualizados y SHALL reintentar la sincronización automáticamente hasta un máximo de 3 intentos

### Requirement 8: API Backend

**User Story:** Como desarrollador, quiero un backend con API REST, para que las aplicaciones web y móvil puedan comunicarse con el servidor de forma estandarizada.

#### Acceptance Criteria

1. THE API_Backend SHALL exponer endpoints REST que permitan crear, leer, actualizar y cancelar turnos, consultar disponibilidad de horarios, y gestionar el registro e inicio de sesión de usuarios
2. WHEN una solicitud llega a un endpoint protegido, THE API_Backend SHALL validar que el token de autenticación esté presente, no haya expirado y corresponda a un usuario registrado antes de procesar la solicitud
3. IF una solicitud llega sin token de autenticación válido a un endpoint protegido, THEN THE API_Backend SHALL rechazar la solicitud con un código de estado 401 y un cuerpo de respuesta indicando el motivo del rechazo
4. IF una solicitud llega con un token válido pero sin permisos suficientes para el recurso solicitado, THEN THE API_Backend SHALL rechazar la solicitud con un código de estado 403 y un cuerpo de respuesta indicando que el acceso está denegado
5. IF una solicitud contiene datos de entrada que no cumplen las reglas de validación del endpoint (campos obligatorios ausentes, tipos de dato incorrectos o valores fuera de rango), THEN THE API_Backend SHALL rechazar la solicitud con un código de estado 400 y un cuerpo de respuesta indicando los campos con error
6. THE API_Backend SHALL responder a cada solicitud en un tiempo máximo de 2 segundos bajo condiciones normales de operación
7. THE API_Backend SHALL retornar todas las respuestas en formato JSON con una estructura consistente que incluya un indicador de éxito o error y los datos solicitados o el detalle del error
