# PO AI Frontend

Frontend del sistema PO AI - Interfaz web React para automatización de Product Owners.

## Tecnologías

- **React 18** - Biblioteca de UI
- **TypeScript** - Tipado estático
- **Vite** - Build tool y dev server
- **Tailwind CSS** - Framework de estilos
- **React Query** - Gestión de estado del servidor y cache
- **React Hook Form** - Gestión de formularios
- **Zustand** - Gestión de estado global
- **Vitest** - Framework de testing
- **React Testing Library** - Testing de componentes

## Estructura del Proyecto

```
src/
├── api/              # Cliente API y servicios
├── components/       # Componentes React reutilizables
├── pages/            # Páginas/vistas de la aplicación
├── store/            # Estado global con Zustand
├── hooks/            # Custom React hooks
├── types/            # Definiciones de tipos TypeScript
├── utils/            # Funciones utilitarias
├── test/             # Configuración y utilidades de testing
├── App.tsx           # Componente raíz
├── main.tsx          # Punto de entrada
└── index.css         # Estilos globales

## Scripts Disponibles

```bash
# Desarrollo
npm run dev

# Build de producción
npm run build

# Preview del build
npm run preview

# Tests
npm run test

# Tests unitarios
npm run test:unit

# Limpiar build
npm run clean
```

## Configuración

1. Copiar `.env.example` a `.env`:
   ```bash
   cp .env.example .env
   ```

2. Configurar variables de entorno:
   ```
   VITE_API_URL=http://localhost:3001/api
   ```

## Desarrollo

El servidor de desarrollo se ejecuta en `http://localhost:3000` con hot reload automático.

```bash
npm run dev
```

## Testing

El proyecto usa Vitest y React Testing Library para testing.

```bash
# Ejecutar todos los tests
npm run test

# Ejecutar tests en modo watch
npm run test -- --watch

# Ejecutar tests con coverage
npm run test -- --coverage
```

## Build

```bash
npm run build
```

El build optimizado se genera en el directorio `dist/`.

## Convenciones de Código

- Componentes en PascalCase
- Archivos de componentes con extensión `.tsx`
- Hooks personalizados con prefijo `use`
- Tipos e interfaces en archivos `.ts`
- Tests junto a los archivos que prueban con extensión `.test.tsx`
