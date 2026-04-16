# PO AI Backend

Backend del sistema PO AI - API REST y lógica de negocio para automatización de Product Owners.

## Estructura de Directorios

```
src/
├── core/           # Lógica de negocio principal
│   ├── StoryGenerator
│   ├── FigmaAnalyzer
│   ├── INVESTValidator
│   └── EpicAssembler
├── integration/    # Conectores externos
│   ├── JiraConnector
│   ├── ProjectAnalyzer
│   └── MCPClient
├── storage/        # Capa de persistencia
│   ├── CredentialStore
│   ├── WorkspaceStore
│   └── ChangeHistory
├── api/            # REST API
│   ├── routes/
│   └── controllers/
└── index.ts        # Punto de entrada

tests/
├── unit/           # Pruebas unitarias
├── property/       # Pruebas basadas en propiedades
└── integration/    # Pruebas de integración
```

## Configuración

1. Copiar `.env.example` a `.env` y configurar variables de entorno
2. Instalar dependencias: `npm install`
3. Compilar TypeScript: `npm run build`

## Scripts Disponibles

- `npm run dev` - Ejecutar en modo desarrollo con hot reload
- `npm run build` - Compilar TypeScript a JavaScript
- `npm run start` - Ejecutar servidor en producción
- `npm test` - Ejecutar todas las pruebas
- `npm run test:unit` - Ejecutar solo pruebas unitarias
- `npm run test:property` - Ejecutar solo pruebas basadas en propiedades
- `npm run test:integration` - Ejecutar solo pruebas de integración
- `npm run clean` - Limpiar archivos compilados

## Dependencias Principales

- **express**: Framework web para API REST
- **zod**: Validación de schemas y tipos
- **dotenv**: Gestión de variables de entorno
- **fast-check**: Property-based testing
- **jest**: Framework de testing
- **typescript**: Lenguaje tipado

## Testing

El proyecto utiliza un enfoque dual de testing:

### Pruebas Unitarias
Verifican ejemplos específicos y casos borde:
```bash
npm run test:unit
```

### Pruebas Basadas en Propiedades
Verifican propiedades universales con múltiples entradas generadas:
```bash
npm run test:property
```

### Pruebas de Integración
Verifican flujos end-to-end con servicios externos:
```bash
npm run test:integration
```

## Cobertura de Código

Objetivo mínimo: 80% de cobertura en líneas, funciones, branches y statements.

Ver reporte de cobertura:
```bash
npm test -- --coverage
```

## Desarrollo

Para iniciar el servidor en modo desarrollo:
```bash
npm run dev
```

El servidor estará disponible en `http://localhost:3000`

Endpoint de health check: `GET /health`
