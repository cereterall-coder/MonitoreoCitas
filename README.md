# 📊 Monitoreo de Citas - EsSalud

Sistema de visualización y análisis de datos de citas médicas para el monitoreo de indicadores de ausentismo (deserción) y estados de programación.

---

## 🚀 Funcionalidades Principales

- **Dashboard Interactivo:** Visualización en tiempo real de KPIs (Total, Atendidas, Deserción y Pendientes).
- **Filtrado Multinivel:** Filtra por Establecimiento (Centro), Especialidad (Servicio), Actividad y Subactividad.
- **Monitoreo Temporal:** Selector de **Año**, **Mes** y **Filtro por Calendario (Día)** para un seguimiento diario granular.
- **Top 15 Profesionales:** Identificación de las agendas con mayor índice de inasistencias.
- **Gráficos de Tendencia:** Evolución mensual y diaria de las inasistencias.
- **Detalle de Pacientes:** Grilla detallada con datos del paciente (DNI, Celular, CIE10) y opción de exportación a **Excel**.

---

## 🛠 Arquitectura y Herramientas

El proyecto está dividido en dos capas principales:

1. **Motor de Datos (Node.js):** Procesa archivos `.txt` planos extraídos del sistema de EsSalud y los consolida en archivos `.json` optimizados por mes.
2. **Dashboard (React + Vite):** Interfaz moderna y rápida que consume los JSON generados de forma estática para máxima velocidad.

### Scripts y Herramientas
- `consolidate-monthly.js`: Script principal de procesamiento.
- `actualizar-datos.js`: Servidor puente (puerto 3001) para permitir actualizaciones desde la web.
- `iniciar-app.bat`: Lanza el dashboard y el puente de datos simultáneamente.

---

## 📋 Requisitos e Instalación

1. Tener instalados **Node.js** y **Git**.
2. Clonar el repositorio.
3. El primer inicio instalará las dependencias automáticamente a través de los archivos `.bat`.

---

## ⚡ Uso Diario

Utiliza los archivos de acceso directo (`.bat`) ubicados en la carpeta raíz:

1. **`iniciar-app.bat`**: Ejecuta el Dashboard en el navegador (`localhost:5173`).
2. **`actualizar-mes-actual.bat`**: Procesa los nuevos archivos descargados de este mes.
3. **`actualizar-mes-especifico.bat`**: Si necesitas re-procesar un mes antiguo en particular.
4. **`consolidar-todo.bat`**: Úsalo para una sincronización total desde el inicio de los tiempos.

---

## 🔒 Privacidad y Seguridad

Este repositorio **NO incluye datos de pacientes** cumpliendo con las normas de privacidad. Los archivos JSON del historial y los TXTs originales están en la lista de ignorados (`.gitignore`). Para que la aplicación funcione, debes colocar tus reportes en la carpeta `bot-essalud/` y ejecutar una consolidación.

---

_Desarrollado para el análisis y mejora de la gestión de citas en EsSalud._
