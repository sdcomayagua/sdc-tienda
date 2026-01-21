# SDComayagua – Tienda (GitHub Pages + Google Sheets)

## Qué hay nuevo en esta versión
- **Panel de administración profesional** en `/admin/` (CRUD completo: agregar/editar/eliminar).
- **Sin base de datos**: Google Sheets es el backend (Apps Script).
- **`catalog.json`** en el repo para que la tienda cargue rápido (se actualiza con **GitHub Actions** desde Sheets).
- La tienda ahora intenta cargar primero `catalog.json` y si falla, usa el Apps Script en vivo.

---

## 1) Panel de administración
URL:
- `https://TU_USUARIO.github.io/TU_REPO/admin/`

Funciones:
- Agregar, editar, eliminar productos
- ID automático
- Campos: categoría, subcategoría, sub‑subcategoría, variante, stock, precios, imágenes (URL), galería, video

**Seguridad**
- GitHub Pages es público, por eso el panel **valida un token** contra Apps Script (no usa BD).
- El token NO debe estar hardcodeado en el frontend. Se pega al entrar y se guarda en el navegador (localStorage).

---

## 2) Apps Script (backend)
En esta carpeta: `apps_script/Code.gs`

Configura en **Script Properties**:
- `ADMIN_TOKEN` = tu token secreto
- `SPREADSHEET_ID` = ID de tu Google Sheets

Hojas recomendadas:
- `productos`, `envios`, `cupones`, `municipios_hn`, `zonas_comayagua_ciudad`

Publica como Web App y copia tu URL. Esa URL es tu **API_URL**.

---

## 3) GitHub Actions (auto‑update del catálogo)
Workflow: `.github/workflows/update-catalog.yml`

Crea este **Secret** en tu repo:
- `SDC_API_URL` = URL de tu Apps Script Web App

El workflow:
- Se ejecuta cada 2 horas (y manual).
- Descarga el catálogo y actualiza `catalog.json` automáticamente.

---

## 4) Tienda
- `index.html` + `assets/js/app.js`
- Carga `catalog.json` (rápido) y si no existe / falla, usa Apps Script.

