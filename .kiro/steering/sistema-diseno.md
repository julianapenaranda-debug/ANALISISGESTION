---
inclusion: manual
---

# Sistema de Diseño - Seguros Bolívar (Extraído de Figma)

Este documento contiene las especificaciones del sistema de diseño oficial de Seguros Bolívar, extraído directamente desde Figma.

## Variables de Color

### Primary (Verde Corporativo)

| Variable | Valor HEX | Uso |
|----------|-----------|-----|
| `Primary/Base` | `#009056` | Color principal del sistema |
| `Primary/+100` | `#038450` | Variante más oscura del verde principal |
| `Primary/-100` | `#66BC9A` | Variante más clara del verde principal |

### Greyscale (Escala de Grises)

| Variable | Valor HEX | Uso |
|----------|-----------|-----|
| `Greyscale/Black` | `#1B1B1B` | Negro - Texto principal |
| `Greyscale/+400` | `#282828` | Gris muy oscuro |
| `Greyscale/+300` | `#414141` | Gris oscuro |
| `Greyscale/+200` | `#5B5B5B` | Gris medio oscuro |
| `Greyscale/+100` | `#757575` | Gris medio |
| `Greyscale/Base` | `#9B9B9B` | Gris base |
| `Greyscale/-100` | `#B9B9B9` | Gris claro |
| `Greyscale/-200` | `#E1E1E1` | Gris muy claro |
| `Greyscale/-300` | `#F5F5F5` | Gris ultra claro |
| `Greyscale/White` | `#FFFFFF` | Blanco |

### Alerts (Alertas)

| Variable | Valor HEX | Uso |
|----------|-----------|-----|
| `Alerts/Success/Base` | `#28A745` | Color de éxito |
| `Alerts/Error/Base` | `#DC3545` | Color de error |
| `Alerts/Warning/Base` | `#FFC107` | Color de advertencia |
| `Alerts/Info/Base` | `#17A2B8` | Color de información |

### Secondary (Amarillo)

| Variable | Valor HEX | Uso |
|----------|-----------|-----|
| `Secondary/Base` | `#FFE16F` | Color secundario amarillo |

### Background

| Variable | Valor HEX | Uso |
|----------|-----------|-----|
| `Background/Greyscale/-400` | `#FAFAFA` | Fondo gris muy claro |

## Tipografía

### Fuentes
- **Roboto**: Fuente para Body y Labels
- **Bolivar**: Fuente corporativa para Headings y Buttons

### Headings Desktop

| Estilo | Fuente | Peso | Tamaño | Line Height | Uso |
|--------|--------|------|--------|-------------|-----|
| `H1/Bold` | Bolivar | 700 | 36px | 1.4 (50.4px) | Títulos principales en negrita |
| `H2/Bold` | Bolivar | 700 | 32px | 1.4 (44.8px) | Subtítulos en negrita |
| `H3/Bold` | Bolivar | 700 | 28px | 1.4 (39.2px) | Encabezados nivel 3 en negrita |
| `H4/Bold` | Bolivar | 700 | 24px | 1.4 (33.6px) | Encabezados nivel 4 en negrita |
| `H5/Bold` | Bolivar | 700 | 20px | 1.4 (28px) | Encabezados nivel 5 en negrita |
| `H6/Bold` | Bolivar | 700 | 16px | 1.4 (22.4px) | Encabezados nivel 6 en negrita |

### Body Text

| Estilo | Fuente | Peso | Tamaño | Line Height | Uso |
|--------|--------|------|--------|-------------|-----|
| `Body/Regular` | Roboto | 400 | 16px | 1.4 (22px) | Texto de cuerpo regular |
| `Body/Bold` | Roboto | 700 | 16px | 1.4 (22px) | Texto de cuerpo en negrita |

### Labels

| Estilo | Fuente | Peso | Tamaño | Line Height | Uso |
|--------|--------|------|--------|-------------|-----|
| `Label/Regular` | Roboto | 400 | 14px | 1.4 (20px) | Labels regulares |
| `Label/Bold` | Roboto | 700 | 14px | 1.4 (20px) | Labels en negrita |

### Captions

| Estilo | Fuente | Peso | Tamaño | Line Height | Uso |
|--------|--------|------|--------|-------------|-----|
| `Caption/Regular` | Roboto | 400 | 12px | 1.4 (16.8px) | Texto pequeño regular |
| `Caption/Bold` | Roboto | 700 | 12px | 1.4 (16.8px) | Texto pequeño en negrita |

## Sombras

### Shadow M (Sombra Media)
```css
box-shadow: 2px 2px 16px rgba(115, 115, 115, 0.16),
            2px 8px 8px rgba(115, 115, 115, 0.04);
```

## Implementación en HTML

### CSS Variables
```css
:root {
  /* Primary Colors */
  --color-primary: #009056;
  --color-primary-dark: #038450;
  --color-primary-light: #66BC9A;
  
  /* Greyscale */
  --color-black: #1B1B1B;
  --color-grey-900: #282828;
  --color-grey-800: #414141;
  --color-grey-700: #5B5B5B;
  --color-grey-600: #757575;
  --color-grey-500: #9B9B9B;
  --color-grey-400: #B9B9B9;
  --color-grey-300: #E1E1E1;
  --color-grey-200: #F5F5F5;
  --color-white: #FFFFFF;
  
  /* Alerts */
  --color-success: #28A745;
  --color-error: #DC3545;
  --color-warning: #FFC107;
  --color-info: #17A2B8;
  
  /* Secondary */
  --color-secondary: #FFE16F;
  
  /* Background */
  --color-bg-light: #FAFAFA;
  
  /* Typography */
  --font-primary: 'Roboto', sans-serif;
  --font-heading: 'Bolivar', 'Roboto', sans-serif;
  
  /* Shadows */
  --shadow-m: 2px 2px 16px rgba(115, 115, 115, 0.16), 2px 8px 8px rgba(115, 115, 115, 0.04);
}
```

## Notas Importantes

1. **Consistencia**: Siempre usar las variables de color definidas, no crear colores intermedios
2. **Accesibilidad**: Verificar contraste WCAG AA en todas las combinaciones
3. **Tipografía**: Usar Bolivar para headings y Roboto para cuerpo de texto
4. **Espaciado**: Seguir el sistema de espaciado de 4px (4, 8, 12, 16, 20, 24, etc.)
5. **Sombras**: Usar Shadow M para elevación de componentes

## Fuente del Diseño
- **Archivo Figma**: RELUX-DSV2-143-SEGUROS-BOLÍVAR-WEB
- **Node ID**: 21720-36266
- **Última actualización**: Extraído el 28 de enero de 2026
