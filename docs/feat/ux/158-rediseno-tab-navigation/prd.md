# PRD #158 — Rediseno: navegacion por tabs con 5 pestanas

## Contexto

La app crecio a 19 secciones dentro de un drawer lateral oculto. La descubribilidad de features es baja (todo requiere 2+ toques), no hay jerarquia visual entre secciones, y features sociales quedan enterradas. El rediseno migra a un sistema de 5 tabs inferior con el boton central de busqueda destacado, reorganizando todas las secciones existentes sin eliminar funcionalidad.

## Estructura general

```
[ Inicio ] [ Social ] [ (Buscar) ] [ Listas ] [ Perfil ]
```

- Buscar tiene el boton elevado/destacado (estilo Instagram/TikTok)
- El SideMenu (drawer lateral) se elimina por completo
- La campana de notificaciones se elimina; las notificaciones pasan a Perfil > Ajustes con badge

---

## Tab 1: Inicio

Pantalla default al abrir la app.

### Header
- Saludo dinamico por hora del dia: "Buenos dias", "Buenas tardes", "Buenas noches" + nombre del usuario
- Debajo: localidad seleccionada u "Oficina"

### Acciones rapidas (titulo divisor)
- Grilla 2x4 (8 slots) con icono + nombre
- **Editable por el usuario**: puede reordenar y cambiar slots
- Defaults: 7 categorias de comercios + Sorprendeme
- Opciones adicionales: Favoritos, Recientes, Visitas
- **Tap**: navega a tab Buscar en modo lista con el filtro aplicado

### Especiales (titulo divisor)
- 3 items visibles, no editables por el usuario
- Cada fila: icono + titulo + subtitulo + flecha derecha
- Contenido: listas destacadas y/o trending de comercios
- **Controlado desde admin** (Firestore)
- Se refresca cada vez que el usuario abre la app

### Busquedas recientes (titulo divisor)
- Chips con icono, 2 filas de 2 (4 chips max)
- Incluye busquedas de texto y comercios visitados
- **Tap**: navega a tab Buscar con esa query

### Para ti (titulo divisor)
- Cards en scroll horizontal
- Cada card: nombre, categoria, cantidad de comentarios, cantidad de likes (estilo post)
- Fuente: motor de sugeridos existente
- **Tap comercio**: comportamiento estandar (ver abajo)

---

## Tab 2: Social

### Sub-tabs superiores (4)

#### Actividad
- Feed de actividad de los usuarios que el usuario sigue
- Acciones trackeadas: calificaciones, check-ins, comentarios, listas creadas, badges ganados
- Sin interaccion (no like/comment en el feed)
- Infinite scroll

#### Seguidos
- Lista de usuarios seguidos (igual que hoy)
- Buscador de usuarios para seguir gente nueva
- Tap usuario: abre perfil en bottom sheet

#### Recomendaciones
- Recomendaciones recibidas de otros usuarios
- Badge de nuevas sin leer en la sub-tab
- Tap comercio: comportamiento estandar

#### Rankings
- Rankings semanales/mensuales/anuales/all-time (migrado desde SideMenu)
- Tiers, badges, streaks, sparklines (todo lo existente)

---

## Tab 3: Buscar (boton central destacado)

Equivale al home actual de la app. Todo se mantiene igual con un agregado.

### Elementos existentes (sin cambios)
- Barra de busqueda fija arriba con placeholder "Buscar comercios..."
- Chips de filtros horizontales (tags + precio)
- Google Maps con markers de comercios
- FABs: ubicacion del usuario + oficina
- Bottom sheet de comercio completo: rating, tags, precio, comentarios/preguntas, check-in, compartir, agregar a lista, recomendar, fotos de menu

### Nuevo: toggle mapa/lista
- Switch para alternar entre vista mapa y vista lista de resultados
- Mapa es la vista default
- Vista lista muestra los mismos resultados filtrados en formato vertical scrolleable

---

## Tab 4: Listas

Titulo de pantalla: "Mis Listas"

### Sub-tabs superiores con icono (4)

#### Favoritos
- Lista plana de comercios favoritos (igual que hoy)
- Sort por nombre, distancia, rating
- Tap comercio: comportamiento estandar

#### Listas
- Grilla de 2 columnas con cards verticales
- Cada card: icono (elegible por usuario de una biblioteca de iconos) + titulo + subtitulo + icono de candado/mundo segun privacidad
- Tap card: entra al detalle de la lista. Puede editar comercios, cambiar visibilidad, gestionar editores
- **Boton sticky full-width abajo**: icono + "Crear nueva lista"

#### Recientes
- Unifica "Recientes" (comercios vistos) y "Mis visitas" (check-ins) que hoy son secciones separadas
- Infinite scroll
- Tap comercio: comportamiento estandar

#### Colaborativas
- Listas donde el usuario es editor invitado (no propietario)
- Misma card visual que la sub-tab Listas
- Tap: entra al detalle de la lista

---

## Tab 5: Perfil

### Header
- Avatar del usuario (nuevo: biblioteca de avatares genericos tipo animales/personajes)
- Nombre del usuario debajo

### Onboarding
- Checklist de pasos (migrado del drawer actual)
- Aparece debajo del header
- Desaparece una vez completado todos los pasos

### Estadisticas
- 4 cards horizontales, todas visibles sin scroll
- Cada card: icono + numero + label
- Cards: Lugares (check-ins), Resenas (calificaciones + comentarios), Seguidores, Favoritos
- **Tocables**: tap navega al detalle correspondiente

### Logros (nueva seccion)
- Cards horizontales, todas visibles sin scroll, ordenadas por completitud
- Formato vertical: icono + label + barra de progreso + porcentaje
- Logros default: Explorador (check-ins), Social (seguidos + recomendaciones), Critico (calificaciones + comentarios), Viajero (localidades visitadas)
- **Tap**: navega a grilla completa de logros (pantalla nueva con flecha atras)
- En la grilla completa: tap en cada logro abre dialog con explicacion de como completarlo
- **Motor de logros desde admin**: condiciones definidas en Firestore, se pueden agregar nuevos logros sin deploy

### Ajustes (titulo divisor)
- Lista vertical con cards horizontales: icono + nombre + flecha (>)
- Items:

| Item | Contenido |
|------|-----------|
| **Notificaciones** | Badge rojo con numero de no leidas. Entra a lista de notificaciones (migrada de la campana actual) + configuracion de toggles |
| **Pendientes** | Solo visible si hay acciones offline pendientes. Muestra la cola de sync |
| **Privacidad y ajuste** | Dark mode toggle, politica de privacidad, perfil publico toggle, analytics toggle |
| **Configuracion** | Localidad picker, verificacion email, cambio password, agregar comercio (link externo), version de la app |
| **Ayuda y soporte** | Seccion de ayuda (9 temas) + formulario de feedback + mis envios de feedback |

---

## Comportamiento estandar al tocar un comercio

Desde cualquier tab de la app, al tocar un comercio:
1. Navega a tab Buscar
2. Centra el mapa en la ubicacion del comercio
3. Abre el bottom sheet del comercio
4. El usuario queda en la tab Buscar (no vuelve automaticamente)

---

## Migracion de secciones existentes

| Seccion actual (drawer) | Destino en rediseno |
|-------------------------|---------------------|
| Mapa + Search + Filtros | Tab Buscar |
| Favoritos | Tab Listas > Favoritos |
| Mis Listas | Tab Listas > Listas |
| Recientes | Tab Listas > Recientes (unificado con Visitas) |
| Mis visitas (check-ins) | Tab Listas > Recientes (unificado) |
| Listas colaborativas | Tab Listas > Colaborativas |
| Sugeridos | Tab Inicio > Para ti |
| Sorprendeme | Tab Inicio > Acciones rapidas (slot default) |
| Actividad (feed seguidos) | Tab Social > Actividad |
| Seguidos + buscador | Tab Social > Seguidos |
| Recomendaciones recibidas | Tab Social > Recomendaciones |
| Rankings | Tab Social > Rankings |
| Comentarios propios | Tab Perfil > tap Resenas |
| Calificaciones propias | Tab Perfil > tap Resenas |
| Estadisticas publicas | Tab Perfil > Estadisticas (tocable) |
| Feedback | Tab Perfil > Ayuda y soporte |
| Configuracion | Tab Perfil > Configuracion |
| Ayuda | Tab Perfil > Ayuda y soporte |
| Pendientes (offline sync) | Tab Perfil > Pendientes (condicional) |
| Agregar comercio | Tab Perfil > Configuracion |
| Onboarding checklist | Tab Perfil > Onboarding |
| Dark mode toggle | Tab Perfil > Privacidad y ajuste |
| Politica de privacidad | Tab Perfil > Privacidad y ajuste |
| Campana de notificaciones | Tab Perfil > Notificaciones (con badge) |
| Version de la app | Tab Perfil > Configuracion |

---

## Funcionalidad nueva

| Feature | Descripcion |
|---------|-------------|
| Tab bar con 5 pestanas | MUI BottomNavigation con boton central destacado |
| Pantalla Inicio | Nueva pantalla home con header, acciones rapidas, especiales, busquedas recientes, para ti |
| Acciones rapidas editables | Grilla 2x4 con persistencia de configuracion por usuario |
| Seccion Especiales | Contenido curado desde admin con refresh al abrir app |
| Toggle mapa/lista en Buscar | Vista alternativa de resultados en formato lista |
| Biblioteca de avatares | Set de avatares genericos (animales/personajes) para perfil |
| Biblioteca de iconos para listas | Set de iconos seleccionables al crear/editar lista |
| Motor de logros | Sistema de achievements con condiciones desde admin, barra de progreso, grilla completa |
| Unificacion Recientes + Visitas | Una sola vista con ambos tipos |
| Cards estilo post en Para Ti | Nombre, categoria, comentarios, likes |

## Funcionalidad eliminada

| Feature | Razon |
|---------|-------|
| SideMenu (drawer lateral) | Reemplazado por tabs |
| Campana de notificaciones (icono) | Reemplazado por item en Perfil > Ajustes con badge |
| Dialog de nombre en onboarding | Se oculta; el onboarding pasa a Perfil |

---

## Archivos a crear

| Archivo | Descripcion |
|---------|-------------|
| `src/components/layout/TabBar.tsx` | BottomNavigation con 5 tabs y boton central destacado |
| `src/components/layout/TabShell.tsx` | Shell principal que renderiza tabs y contenido |
| `src/components/home/HomeScreen.tsx` | Pantalla de Inicio completa |
| `src/components/home/QuickActions.tsx` | Grilla editable de acciones rapidas |
| `src/components/home/SpecialsSection.tsx` | Seccion de especiales desde admin |
| `src/components/home/RecentSearches.tsx` | Chips de busquedas recientes |
| `src/components/home/ForYouSection.tsx` | Cards horizontales de sugeridos |
| `src/components/social/SocialScreen.tsx` | Pantalla Social con 4 sub-tabs |
| `src/components/search/SearchScreen.tsx` | Wrapper del mapa actual con toggle lista |
| `src/components/search/SearchListView.tsx` | Vista lista de resultados de busqueda |
| `src/components/lists/ListsScreen.tsx` | Pantalla Listas con 4 sub-tabs |
| `src/components/lists/CollaborativeTab.tsx` | Sub-tab de listas colaborativas |
| `src/components/profile/ProfileScreen.tsx` | Pantalla Perfil completa |
| `src/components/profile/AvatarPicker.tsx` | Selector de avatares |
| `src/components/profile/StatsCards.tsx` | Cards de estadisticas |
| `src/components/profile/AchievementsSection.tsx` | Seccion de logros con preview |
| `src/components/profile/AchievementsGrid.tsx` | Grilla completa de logros |
| `src/components/profile/SettingsMenu.tsx` | Menu de ajustes |
| `src/components/lists/IconPicker.tsx` | Selector de iconos para listas |
| `src/contexts/TabContext.tsx` | Contexto para navegacion entre tabs y comportamiento estandar |

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/layout/AppShell.tsx` | Reemplazar layout actual por TabShell |
| `src/components/layout/MapAppShell.tsx` | Adaptar para funcionar dentro de tab Buscar |
| `src/components/menu/SideMenu.tsx` | Eliminar (funcionalidad migrada a tabs) |
| `src/components/menu/SideMenuNav.tsx` | Eliminar |
| `src/components/search/SearchBar.tsx` | Remover icono hamburguesa y campana |
| `src/components/notifications/NotificationBell.tsx` | Migrar logica a Perfil > Notificaciones |
| `src/contexts/MapContext.tsx` | Agregar metodo para navegacion estandar (centrar mapa + abrir sheet desde otra tab) |

---

## Patron a seguir

- TabBar: usar MUI `BottomNavigation` + `BottomNavigationAction` con estilos custom para boton central
- Sub-tabs: usar MUI `Tabs` + `Tab` dentro de cada pantalla
- Lazy loading: mantener `React.lazy()` para cada pantalla de tab (como se hace hoy con las secciones del drawer)
- Cards de estadisticas/logros: usar MUI `Card` con layout flex
- Grilla editable: usar `react-beautiful-dnd` o similar para drag-and-drop, persistir en Firestore doc del usuario
- Motor de logros: coleccion `achievements` en Firestore con condiciones, Cloud Function para evaluar progreso

---

## Tests

- TabBar renderiza 5 tabs con iconos y labels correctos
- Boton central de Buscar tiene estilo destacado
- Navegacion entre tabs muestra contenido correcto
- Comportamiento estandar: tap comercio en cualquier tab navega a Buscar + centra mapa + abre sheet
- Acciones rapidas: grilla renderiza 8 slots, drag-and-drop reordena, tap navega a Buscar con filtro
- Especiales: renderiza items de Firestore, refresh al abrir app
- Toggle mapa/lista en Buscar: alterna entre vistas
- Logros: barra de progreso refleja datos reales, tap abre grilla, tap logro abre dialog
- Perfil: estadisticas muestran numeros correctos, son tocables
- Migracion: todas las secciones del drawer son accesibles desde su nueva ubicacion
- SideMenu eliminado: no se renderiza hamburguesa ni drawer

## Seguridad

- Acciones rapidas: validar configuracion del usuario server-side (no confiar en payload del cliente)
- Motor de logros: condiciones evaluadas en Cloud Functions, no en cliente
- Especiales: solo admin puede crear/editar contenido curado
- Avatares: usar set cerrado de assets locales, no permitir upload de imagen propia (por ahora)

## Fuera de scope

- Avatares custom (upload de foto propia)
- Animaciones de transicion entre tabs
- Deep links a tabs especificas (se puede agregar despues)
- Notificaciones push (las in-app migran, push es otro issue)
- Actividad propia en el feed Social (solo de seguidos)
- Interaccion en el feed (like/comment en items del feed)
- Busquedas recientes: sugerencias predictivas
- Internacionalizacion del saludo
