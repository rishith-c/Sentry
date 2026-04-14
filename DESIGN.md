# SENTRY Design System

## Color Tokens

| Token Name         | Value     | Usage                        |
|--------------------|-----------|------------------------------|
| color-bg           | #020617   | App background               |
| color-surface      | #0e1223   | Panels, cards, top bar       |
| color-border       | #1e2d40   | Panel borders, dividers      |
| color-text-primary | #f0f4f8   | Primary labels, headings     |
| color-text-muted   | #64748b   | Placeholder, secondary text  |
| color-text-data    | #e2e8f0   | Data values, counters        |
| color-threat-green | #10b981   | Safe / nominal               |
| color-threat-amber | #f59e0b   | Advisory / watch             |
| color-threat-orange| #f97316   | Warning / elevated           |
| color-threat-red   | #ef4444   | Critical / emergency         |
| color-threat-purple| #a855f7   | Extreme / catastrophic       |
| color-accent       | #3b82f6   | Interactive elements, focus  |

## Typography

| Token Name       | Value           | Usage                        |
|------------------|-----------------|------------------------------|
| font-ui          | Fira Sans       | Body text, rationale copy    |
| font-label       | Lato            | Labels, headings, uppercase  |
| font-brand       | Raleway         | SENTRY wordmark only         |
| font-data        | Fira Code       | Counters, numeric values     |
| text-xs          | 11px            | Dense data labels            |
| text-sm          | 13px            | Secondary labels             |
| text-base        | 15px            | Body, card content           |
| text-lg          | 18px            | Section headings             |
| text-xl          | 22px            | Top bar title                |

## Spacing

| Token Name  | Value  |
|-------------|--------|
| space-1     | 4px    |
| space-2     | 8px    |
| space-3     | 12px   |
| space-4     | 16px   |
| space-6     | 24px   |

## Layout

| Token Name          | Value  |
|---------------------|--------|
| layout-topbar-h     | 48px   |
| layout-right-panel  | 300px  |
| layout-map-flex     | 1      |

## Component Rules
- No light mode. Dark theme only.
- No hardcoded hex values in components — always reference token names via Tailwind CSS variables or className mappings.
- All numeric/data values rendered in font-data (JetBrains Mono).
- All UI text rendered in font-ui (Inter).
- Threat colors used ONLY for status indicators, badges, and severity rings — never for backgrounds.
