# Prompt para v0.dev — Rediseno Modo Mapa

Copia y pega este prompt en v0.dev para generar los mockups de la alternativa recomendada (Tabs + Feed social).

---

## Prompt

```
Design a mobile-first React app with Material UI (MUI) that uses a bottom tab navigation bar. The app is called "Modo Mapa" — a collaborative map app where users rate, review, and discover local businesses.

### Layout

The app has 4 bottom tabs with icons and labels:
1. **Explorar** (CompassIcon) — default/home tab
2. **Social** (PeopleIcon)
3. **Listas** (BookmarkIcon)
4. **Perfil** (PersonIcon)

The tab bar is always visible at the bottom. Use MUI BottomNavigation component.

### Screen 1: Explorar (default tab)

Top section:
- Rounded search bar at the top: placeholder "Buscar comercios..." with a notification bell icon on the right
- Below: horizontal scrollable row of filter chips (colored tag chips like "Cafe", "Restaurant", "Bar", "Pizza", plus price chips "$", "$$", "$$$", "$$$$")

Main content:
- A Google Maps placeholder area taking about 60% of the screen with scattered dot markers
- Floating action buttons on bottom-right: one for "my location", one for "office location"
- Below the map: a horizontal scrollable card row labeled "Sugeridos para vos" showing 3 business cards (name, rating stars, price level, category tag)

### Screen 2: Social tab

Top: title "Social" with notification bell
Sub-navigation: horizontal scrollable chips/tabs for "Actividad", "Seguidos", "Recomendaciones", "Rankings"

Default view (Actividad):
- Feed of activity cards showing:
  - "@maria rated Bar Central ★★★★★" with timestamp
  - "@pedro created list 'Brunch spots'" with timestamp
  - "@ana checked in at Cafe Roma" with timestamp
- Each card has an avatar on the left, action text, and business name highlighted
- A red badge "(2 nuevas)" on the "Recomendaciones" chip

### Screen 3: Listas tab

Top: title "Mis Listas" with a "+" add button and notification bell
Sub-navigation: chips for "Favoritos", "Listas", "Recientes", "Visitas"

Default view (Favoritos):
- List of saved businesses, each row showing:
  - Business name, rating stars, category tag, distance "1.2 km"
  - A heart icon (filled, red) on the right
- Sort options: "Nombre" | "Distancia" | "Rating"

### Screen 4: Perfil tab

Top section:
- Large avatar circle with user name "Gonzalo" below
- Stats row: "12 calificaciones | 5 comentarios | Nivel: Explorador"

Menu list below:
- Calificaciones (with star icon)
- Comentarios (with chat bubble icon)
- Estadisticas (with bar chart icon)
- Feedback (with feedback icon)
- Configuracion (with settings gear icon)
- Ayuda (with help icon)
- Each row has a chevron ">" on the right

### Design guidelines

- Use a dark theme (dark background, light text) as default
- Primary color: #90caf9 (light blue)
- Secondary color: #ce93d8 (light purple)
- Use rounded corners (border-radius: 12px) on cards
- Mobile viewport: 390x844 (iPhone 14 size)
- MUI components: BottomNavigation, Chip, Card, Paper, Avatar, List, ListItem
- Show all 4 screens side by side if possible, otherwise show the Explorar tab as the main view
- The map area should be a gray placeholder with "Google Maps" text and fake marker dots
- Make it look polished and production-ready
```

---

## Prompt alternativo (solo navegacion, mas simple)

```
Create a mobile app navigation prototype using React and Material UI.

The app "Modo Mapa" has a bottom tab bar with 4 tabs:
1. Explorar (map icon) - Shows a map with search bar and filter chips on top
2. Social (people icon) - Shows an activity feed with sub-tabs: Actividad, Seguidos, Recomendaciones, Rankings
3. Listas (bookmark icon) - Shows saved items with sub-tabs: Favoritos, Listas, Recientes, Visitas
4. Perfil (person icon) - Shows user profile with menu items

Use dark theme. Primary color #90caf9. Mobile viewport 390x844.
Show the 4 screens as a tabbed interface where clicking each tab shows the corresponding content.
Each screen should have realistic placeholder content (Spanish language).
```

---

## Tips para v0.dev

1. **Pega el prompt largo primero** — da mas contexto y mejores resultados
2. **Itera:** podes pedirle "make the Social tab more like Instagram stories" o "add a floating action button"
3. **Exporta:** v0 genera codigo React que podes copiar directo al repo
4. **Si queres probar las 4 alternativas**, cambia el prompt:
   - Alt B (Feed): reemplaza la tab Explorar por un feed scrolleable con mapa mini
   - Alt C (Dashboard): reemplaza Explorar por widgets configurables
   - Alt D (Mapa tool): reemplaza Explorar por acciones rapidas y pon el mapa en la tab Buscar
