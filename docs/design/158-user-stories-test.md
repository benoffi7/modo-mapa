# Historias de Usuario — Test Plan v2 (#158)

Checklist de test manual para verificar que todas las funcionalidades de la app funcionan correctamente con la nueva navegacion por tabs.

---

## Tab: Inicio

### HU-1: Usuario abre la app y ve el saludo personalizado
- [ ] Abrir la app
- [ ] Verificar saludo segun hora ("Buenos dias/tardes/noches") + nombre del usuario
- [ ] Verificar localidad debajo del saludo

### HU-2: Usuario usa acciones rapidas para buscar por categoria
- [ ] Tocar "Restaurante" en la grilla
- [ ] Verificar que cambia a tab Buscar
- [ ] Verificar que el campo de busqueda tiene "restaurant" como filtro

### HU-3: Usuario edita las acciones rapidas
- [ ] Tocar el icono de edicion (lapiz)
- [ ] Deseleccionar "Heladeria", seleccionar "Favoritos"
- [ ] Guardar
- [ ] Verificar que la grilla muestra la nueva configuracion
- [ ] Cerrar y reabrir la app — la configuracion persiste

### HU-4: Usuario toca "Sorprendeme"
- [ ] Tocar Sorpresa en la grilla
- [ ] Verificar que cambia a tab Buscar con un comercio aleatorio seleccionado
- [ ] Verificar que el bottom sheet se abre

### HU-5: Usuario ve busquedas recientes
- [ ] Visitar 2+ comercios primero
- [ ] Ir a tab Inicio
- [ ] Verificar chips con nombres de comercios visitados
- [ ] Tocar un chip — verifica que va a Buscar con ese nombre

### HU-6: Usuario ve sugerencias "Para ti"
- [ ] Scroll horizontal de cards
- [ ] Tocar una card — verifica que va a Buscar + mapa centrado + sheet abierto

---

## Tab: Social

### HU-7: Usuario ve actividad de seguidos
- [ ] Ir a tab Social > Actividad
- [ ] Verificar feed con acciones de usuarios seguidos (calificaciones, check-ins, etc.)
- [ ] Verificar infinite scroll

### HU-8: Usuario busca y sigue a otro usuario
- [ ] Ir a Social > Seguidos
- [ ] Usar el buscador para encontrar un usuario
- [ ] Tocar para ver perfil (bottom sheet)
- [ ] Seguir al usuario
- [ ] Verificar que aparece en la lista de seguidos

### HU-9: Usuario ve recomendaciones recibidas
- [ ] Ir a Social > Recomendaciones
- [ ] Verificar badge de no leidas en la sub-tab
- [ ] Tocar una recomendacion — verifica que va a Buscar + mapa + sheet
- [ ] Verificar que el badge se actualiza

### HU-10: Usuario consulta rankings
- [ ] Ir a Social > Rankings
- [ ] Verificar rankings semanales/mensuales/anuales/historicos
- [ ] Tocar un usuario — ver perfil publico

---

## Tab: Buscar

### HU-11: Usuario busca un comercio por nombre
- [ ] Ir a tab Buscar
- [ ] Escribir "cafe" en la barra de busqueda
- [ ] Verificar que los markers se filtran en el mapa
- [ ] Verificar que los filtros de tags funcionan

### HU-12: Usuario alterna entre vista mapa y lista
- [ ] Tocar el toggle "lista" (icono)
- [ ] Verificar que se muestra lista de comercios ordenados por distancia
- [ ] Tocar un comercio en la lista — verifica que abre el bottom sheet
- [ ] Volver a vista mapa

### HU-13: Usuario califica un comercio
- [ ] Tocar un marker en el mapa
- [ ] En el bottom sheet, dar una calificacion (estrellas)
- [ ] Verificar confirmacion
- [ ] Expandir multi-criterio y calificar

### HU-14: Usuario comenta en un comercio
- [ ] En el bottom sheet, escribir un comentario
- [ ] Enviar
- [ ] Verificar que aparece en la lista de comentarios
- [ ] Editar el comentario
- [ ] Eliminar el comentario (verificar undo de 5s)

### HU-15: Usuario agrega comercio a favoritos
- [ ] Tocar el corazon en el bottom sheet
- [ ] Verificar que se marca como favorito
- [ ] Ir a tab Listas > Favoritos — verificar que aparece

### HU-16: Usuario hace check-in
- [ ] En el bottom sheet, tocar "Check-in"
- [ ] Verificar confirmacion
- [ ] Ir a tab Listas > Recientes — verificar que aparece con icono de check-in

### HU-17: Usuario comparte un comercio
- [ ] Tocar "Compartir" en el bottom sheet
- [ ] Verificar que se copia el deep link o se abre Web Share

### HU-18: Usuario recomienda un comercio
- [ ] Tocar "Recomendar" en el bottom sheet
- [ ] Buscar un usuario
- [ ] Enviar recomendacion con mensaje opcional
- [ ] Verificar confirmacion

---

## Tab: Listas

### HU-19: Usuario ve sus favoritos con filtros
- [ ] Ir a tab Listas > Favoritos
- [ ] Verificar lista de favoritos con distancia
- [ ] Cambiar sort (nombre/distancia/rating)
- [ ] Tocar un favorito — verifica comportamiento estandar

### HU-20: Usuario crea una lista
- [ ] Ir a Listas > Listas
- [ ] Tocar "Crear nueva lista"
- [ ] Poner nombre y descripcion
- [ ] Verificar que aparece en la grilla

### HU-21: Usuario agrega comercio a una lista
- [ ] En tab Buscar, abrir un comercio
- [ ] Tocar "Agregar a lista"
- [ ] Seleccionar la lista creada
- [ ] Ir a Listas > Listas — abrir la lista y verificar el comercio

### HU-22: Usuario ve recientes (visitas + check-ins unificados)
- [ ] Ir a Listas > Recientes
- [ ] Verificar que muestra visitas (icono reloj) y check-ins (icono pin) mezclados
- [ ] Verificar orden por fecha descendente
- [ ] Tocar uno — verifica comportamiento estandar

### HU-23: Usuario ve listas colaborativas
- [ ] Ir a Listas > Colaborativas
- [ ] Verificar listas donde el usuario es editor invitado
- [ ] (si no hay, verificar mensaje vacio)

---

## Tab: Perfil

### HU-24: Usuario cambia su avatar
- [ ] Ir a tab Perfil
- [ ] Tocar el avatar
- [ ] Seleccionar un emoji animal
- [ ] Verificar que el avatar cambia

### HU-25: Usuario ve sus estadisticas
- [ ] Verificar 4 cards: Lugares, Resenas, Seguidores, Favoritos
- [ ] Tocar "Lugares" — verifica que navega a Estadisticas
- [ ] Tocar "Favoritos" — verifica que va a tab Listas > Favoritos

### HU-26: Usuario ve sus logros
- [ ] Verificar cards de logros con barra de progreso
- [ ] Tocar "Ver todos"
- [ ] En la grilla, tocar un logro — verificar dialog con descripcion

### HU-27: Usuario ve sus notificaciones
- [ ] Ir a Perfil > Ajustes > Notificaciones
- [ ] Verificar badge con numero de no leidas
- [ ] Verificar lista de notificaciones
- [ ] Tocar "Marcar todas como leidas"
- [ ] Tocar una notificacion — verifica que navega al comercio

### HU-28: Usuario cambia la contrasena
- [ ] Ir a Perfil > Configuracion
- [ ] Tocar "Cambiar contrasena"
- [ ] Ingresar contrasena actual + nueva
- [ ] Verificar confirmacion

### HU-29: Usuario cambia la localidad
- [ ] Ir a Perfil > Configuracion
- [ ] Cambiar localidad
- [ ] Verificar que el saludo en Inicio muestra la nueva localidad

### HU-30: Usuario activa/desactiva dark mode
- [ ] Ir a Perfil > Privacidad y ajuste
- [ ] Toggle dark mode
- [ ] Verificar que toda la app cambia de tema

### HU-31: Usuario envia feedback
- [ ] Ir a Perfil > Ayuda y soporte
- [ ] Llenar formulario de feedback
- [ ] Enviar
- [ ] Verificar en "Mis envios" que aparece con estado "pendiente"

### HU-32: Usuario consulta la ayuda
- [ ] Ir a Perfil > Ayuda y soporte
- [ ] Verificar que la seccion de ayuda tiene 12 temas
- [ ] Expandir cada uno — verificar que describe la nueva navegacion por tabs

---

## Comportamiento estandar (cross-tab)

### HU-33: Tocar comercio desde cualquier tab navega a Buscar
- [ ] Desde Social > Recomendaciones, tocar un comercio
- [ ] Verificar: cambia a tab Buscar + mapa centrado + sheet abierto
- [ ] Repetir desde Listas > Favoritos
- [ ] Repetir desde Inicio > Para ti
- [ ] En todos los casos, el usuario queda en tab Buscar

### HU-34: Deep link ?business=biz_001
- [ ] Abrir la app con ?business=biz_001 en la URL
- [ ] Verificar que abre en tab Buscar con el comercio seleccionado

### HU-35: Deep link ?tab=social
- [ ] Abrir la app con ?tab=social en la URL
- [ ] Verificar que abre en tab Social

---

## Offline

### HU-36: Acciones offline se sincronizan
- [ ] Desconectar internet
- [ ] Calificar un comercio
- [ ] Verificar OfflineIndicator visible
- [ ] Ir a Perfil > Pendientes — verificar accion pendiente
- [ ] Reconectar — verificar sincronizacion automatica
