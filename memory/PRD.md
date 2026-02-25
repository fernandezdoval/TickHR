# TickHR - HR Management Application PRD

## Original Problem Statement
Crear aplicación web responsive tipo Factorial para gestión de RRHH con:
- Fichaje de entrada/salida
- Gestión de tickets (vacaciones, ausencias, permisos)
- Hojas de gastos (prioridad) - subida por usuarios, aprobación por admins
- Dashboard con métricas
- Sistema de login dual (JWT + Google Auth)
- Perfiles: administrador y empleados

## User Personas
1. **Empleado**: Necesita fichar entrada/salida, solicitar vacaciones, subir gastos
2. **Administrador**: Gestiona aprobaciones, visualiza datos de equipo, administra usuarios

## Core Requirements (Static)
- Autenticación JWT + Google OAuth (Emergent Auth)
- Persistencia con MongoDB
- Diseño responsive
- Paleta: azul marino, blanco, gris/negro

## What's Been Implemented (Feb 2026)
### Backend (FastAPI)
- [x] Auth: Register, Login, Google OAuth session exchange
- [x] Clock: In/Out, Status, History
- [x] Tickets: Create, List, Admin approval/rejection
- [x] Expenses: Create with receipt upload, List, Admin approval/rejection
- [x] Dashboard: Stats aggregation
- [x] Admin: User management, role updates

### Frontend (React)
- [x] Login page with JWT and Google OAuth
- [x] Registration page
- [x] Dashboard with stats and quick clock action
- [x] Clock page with real-time clock and history
- [x] Tickets page - create and view requests
- [x] Expenses page - create with receipt upload, view status
- [x] Admin pages: Tickets management, Expenses management, Users management
- [x] Responsive sidebar navigation
- [x] Spanish localization throughout

### Testing Results
- Backend: 95% passing
- Frontend: 100% passing
- Integration: 100% passing

## Architecture
```
/app/
├── backend/
│   └── server.py (FastAPI with MongoDB)
├── frontend/
│   ├── src/
│   │   ├── pages/ (Login, Register, Dashboard, Clock, Tickets, Expenses, Admin*)
│   │   ├── components/ (Layout, ProtectedRoute)
│   │   ├── lib/ (api.js)
│   │   └── store/ (authStore.js - Zustand)
│   └── tailwind.config.js
```

## Prioritized Backlog
### P0 (Critical) - DONE
- [x] User registration/login
- [x] Expense management (priority feature)
- [x] Clock in/out
- [x] Ticket management

### P1 (High Priority) - Future
- [ ] Email notifications on approval/rejection
- [ ] Expense reports/exports
- [ ] Calendar view for tickets
- [ ] Team calendar overview (admin)

### P2 (Medium Priority) - Future
- [ ] Nóminas visualization
- [ ] Document upload/storage
- [ ] Department management
- [ ] Performance evaluations

### P3 (Nice to Have)
- [ ] Mobile app (React Native)
- [ ] Integrations (payroll systems)
- [ ] Advanced analytics/reports

## Next Action Items
1. Push to GitHub as "TickHR"
2. Optional: Add email notifications
3. Optional: Add expense PDF export
