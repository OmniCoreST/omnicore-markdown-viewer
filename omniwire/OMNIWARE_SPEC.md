# OmniWare — Wireframe DSL Specification & Architecture Plan

## 1. Project Goal

Create a lightweight, pure-JavaScript wireframe renderer with a custom text-based DSL
that can be embedded in markdown code blocks — exactly like Mermaid for flowcharts.

**Design Principles:**
- Zero dependencies (single JS file, all CSS embedded)
- Text-based DSL readable by non-developers (VEDAŞ stakeholders)
- Consistent sketch/blueprint wireframe aesthetic across all screens
- SRS traceability — every component can carry `ref:` codes
- Embeddable in any markdown viewer via ```` ```omniware ```` code blocks (```` ```wireframe ```` is accepted as an alias since viewer 2.3.0 / VS Code extension 1.2.0; `.ow` files contain the raw DSL without a fence)

---

## 2. DSL Syntax Design

### 2.1 Core Rules

| Rule | Description |
|---|---|
| Line-based | Each line is a statement |
| Indentation | 2-space indent = child of the nearest previous line with a smaller indent. Everything after `@page` must be indented under it, otherwise it renders outside the page frame. A line indented under a plain content line is dropped |
| `@keyword` | Block components (section, table, etc.), lowercase |
| `"Title"` | Quoted block title — always quote it (an unquoted title loses any `x:y` part such as `14:00`) |
| `key:value` | Header properties on the `@keyword` line, **no space after the colon**; quote values with spaces: `ref:"A, B"`. `key="value"` is not syntax |
| `**text**` | Bold text |
| `*item*` | Active/selected item in nav, tabs and radio items |
| `(CODE)` | SRS reference chip — any `(` + ASCII uppercase text + `)`, e.g. `(FR-001)` |
| `[Button Text]` | Inline button (in `@buttons` use `[primary] Label`) |
| `{color}Text` | Color tag: `{green}`, `{red}`, `{yellow}`, `{blue}`, `{gray}` — no space after `}`; the tag runs until two spaces, `\|` or end of line, so put it last |
| `@divider` | Horizontal divider (a `---` line is rendered as text) |
| `//` | Comment at line start (not rendered) |
| `\|` | Separator in tables, nav, tabs, radio and progress (grids use `:`) |

### 2.2 Block Components

#### @page — Page Container
```
@page "Page Title" status:draft
  // every other line of the wireframe goes here, indented
```
- `status:` — `draft` (default), `review` or `approved`; shown in the corner ribbon
- The page title is not displayed; show titles with `@nav`, `@breadcrumb` or `@section`

#### @nav — Top Navigation Bar
```
@nav
  Logo Text | Item 1 | *Active Item* | Item 3 | Item 4
```
- `*item*` marks the active tab

#### @breadcrumb — Breadcrumb Navigation
```
@breadcrumb
  Home > Module > Sub > **Current Page**
```

#### @section — Framed Panel with Title
```
@section "Section Title" icon:info ref:FR-IH-001
  // child components here
```
- `icon:` — icon name (info, check, lock, star, currency, play, chart, user, settings, doc, clock, warning) or an emoji
- `ref:` — SRS reference code(s), comma-separated without spaces (`ref:FR-1,FR-2`)

#### @grid — Key-Value Info Display
```
@grid cols:2
  İhale No          : **IH-2027-00142**
  İhale Usulü       : **Açık İhale** (KRL-AI)
  Durum             : {blue}Değerlendirme Aşamasında
  Tahmini Tutar     : **4.250.000,00 ₺**
```
- `cols:` — number of columns (default: 2)

#### @badges — Status Badge Row
```
@badges
  {green} UK-K1 Ön Kontrol: BAŞARILI
  {green} UK-K2 Süreç Kontrol: BAŞARILI
  {yellow} UK-K3 Doküman Kontrol: 1 UYARI
  {gray} UK-K4 Sonuç Kontrol: BEKLİYOR
```

#### @tabs — Tab Navigation
```
@tabs
  *Yeterlik Değerlendirme* | Fiyat Karşılaştırma | Açık Eksiltme | Rapor
```

#### @table — Data Table
```
@table ref:FR-TV-002
  # | İstekli Adı        | İş Deneyim | Ciro    | Sonuç             | İşlem
  --
  1 | **ABC Elektrik**    | {green}✓ %85 | {green}✓ %120 | {green}YETERLİ    | [Detay]
  2 | **XYZ Müh.**        | {green}✓ %62 | {green}✓ %95  | {green}YETERLİ    | [Detay]
  3 | **Mega Enerji**     | {green}✓ %110| {red}✗ %210   | {red}YETERSİZ     | [Detay]
```
- First row = headers (separated by `|`)
- `--` = separator between header and body
- `{color}text` = colored cell content
- `[text]` = button in cell

#### @buttons — Button Group
```
@buttons
  [primary] ✓ Sonuçları Onayla
  [default] ✉ Bildirim Gönder
  [default] 📄 Tutanak Oluştur
  [danger]  ✗ İhaleyi İptal Et
```
- Style: `primary`, `success`, `danger`, `default`

#### @form — Form Layout
```
@form cols:2
  text      "İhale Adı"          required
  text      "İhale No"           readonly  value:"IH-2027-00142"
  select    "İhale Usulü"        options:"Açık İhale,Davetiye,Doğrudan Temin"
  date      "İhale Tarihi"       required
  number    "Tahmini Tutar (₺)"  required
  textarea  "Açıklama"           rows:3
  file      "Teknik Şartname"
  checkbox  "EPDK Uyumluluk Kontrolü yapıldı"
  radio     "Öncelik"            options:"Yüksek,Normal,Düşük"
```
- Separate type, `"Label"` and each flag with **two or more spaces** (a single space drops the field)
- Flags: `required`, `readonly`, `value:"…"`, `options:"a,b,c"`, `rows:N`
- Blocks nested inside `@form` are dropped — put `@buttons` after the form as a sibling

#### @note — Annotation/Note Box
```
@note type:info
  UK-K3 Uyarı: Delta Teknik Ltd. imza sirküleri son geçerlilik tarihi yaklaşıyor
```
- `type:` — info (default), warning, error, success

#### @placeholder — Placeholder Area for Charts/Embeds
```
@placeholder height:100
  📈 Geçmiş Fiyat Trendi Grafiği — Recharts / D3
```

#### @alert — Inline Alert Box
```
@alert type:warning ref:KRL-TEK-002
  Yalnızca YETERLİ isteklilerin fiyat zarfları açılmıştır.
```

#### @radio — Radio Button Group (standalone)
```
@radio "Komisyon Kararı"
  *Kazanan Belirle* | İhaleyi İptal Et | Ek Değerlendirme
```

#### @textarea — Standalone Textarea
```
@textarea "Karar Gerekçesi" rows:4
  En düşük AUTB değerine sahip istekli olarak belirlenmiştir.
```

#### @formula — Formula/Code Box
```
@formula
  AUTB = TB + (YO × YA × TB)  |  YA = %15  (KRL-TEK-006)
```

#### @locked — Locked/Disabled Overlay Area
```
@locked "Fiyat zarfı açılmadı — Yeterlik başarısız (KRL-TEK-002)"
  // child content shown dimmed underneath
  @table
    # | İstekli | Fiyat | AUTB | Sıra | İşlem
    --
    4 | Mega Enerji A.Ş. | — | — | — | —
    5 | Delta Teknik Ltd. | — | — | — | —
```

#### @divider — Horizontal Rule
```
@divider
```

#### @footer — Page Footer
```
@footer
  🔒 Tüm işlemler denetim izi kaydı altındadır (NFR-DNT)
  Son güncelleme: sa_uzman01 — 16.02.2027 15:42
```

#### @columns — Side-by-side Layout
```
@columns
  @col
    // left content
  @col
    // right content
```

#### @progress — Progress/Steps Indicator
```
@progress
  {done} Talep Oluşturma | {done} Onay | {active} İhale Hazırlık | {pending} İlan | {pending} Teklif
```

#### @metric — KPI Metric Card
```
@metric
  "Aktif İhaleler" : **12** {blue}
  "Bekleyen Onay"  : **5** {yellow}
  "Toplam Tutar"   : **42.5M ₺** {green}
  "Tedarikçi"      : **128** {gray}
```

---

## 3. Component Inventory — OmniCore Screen Coverage

| SRS Screen Group | Components Used |
|---|---|
| 1. Login/MFA | @page, @form, @buttons, @alert |
| 2. Dashboard | @page, @nav, @metric, @table, @placeholder, @progress |
| 3. Talep Yönetimi | @page, @nav, @form, @table, @buttons, @grid, @note |
| 4. İhale Yönetimi | @page, @nav, @tabs, @form, @grid, @badges, @progress |
| 5. Teklif Değerlendirme | @page, @nav, @tabs, @table, @badges, @formula, @locked, @buttons |
| 6. Tedarikçi Portalı | @page, @nav, @form, @grid, @table, @metric |
| 7. Sözleşme Yönetimi | @page, @nav, @grid, @table, @progress, @alert |
| 8. Raporlama | @page, @nav, @form, @placeholder, @table, @buttons |
| 9. Sistem Yönetimi | @page, @nav, @form, @table, @tabs, @grid |
| 10. Sanal İhale Odası | @page, @nav, @placeholder, @table, @buttons, @alert |

---

## 4. Architecture

### 4.1 File Structure
```
omniware.js          — Single file: Parser + Renderer + Styles (< 40KB)
```

### 4.2 Internal Architecture
```
┌──────────────────────────────────────────┐
│               omniware.js               │
├──────────────────────────────────────────┤
│  1. STYLES         Embedded CSS string   │
│  2. PARSER         DSL text → AST        │
│  3. RENDERER       AST → HTML string     │
│  4. PUBLIC API     OmniWare.render()    │
└──────────────────────────────────────────┘
```

### 4.3 AST Node Structure
```javascript
{
  type: 'page',
  props: { title: 'Teklif Değerlendirme', status: 'draft' },
  children: [
    {
      type: 'nav',
      props: {},
      children: [
        { type: 'nav-item', props: { text: 'Ana Sayfa', active: false } },
        { type: 'nav-item', props: { text: 'İhale Yönetimi', active: true } },
      ]
    },
    {
      type: 'section',
      props: { title: 'İhale Bilgileri', icon: 'info', ref: 'FR-IH-001' },
      children: [
        {
          type: 'grid',
          props: { cols: 2 },
          children: [
            { type: 'grid-row', props: { label: 'İhale No', value: '**IH-2027-00142**' } }
          ]
        }
      ]
    }
  ]
}
```

### 4.4 Parser Strategy

1. **Tokenizer**: Split input by newlines. For each line:
   - Count leading spaces → `indent` level (÷2)
   - Check if starts with `@` → block component
   - Check if starts with `//` → comment (skip)
   - Otherwise → content line of parent block

2. **Tree Builder**: Use indent-based stack:
   - indent increases → push as child of current
   - indent same → sibling of current
   - indent decreases → pop stack, add as sibling of ancestor

3. **Inline Parser**: Process inline markers in text content:
   - `**text**` → `<b>text</b>`
   - `(CODE)` → `<span class="ow-ref">CODE</span>`
   - `{color}text` → `<span class="ow-color-{color}">text</span>`
   - `[text]` → `<button class="ow-btn">text</button>`

### 4.5 Public API

```javascript
// Option A: Render into a target element
OmniWare.render(dslString, targetElement);

// Option B: Get HTML string (for iframe injection)
const html = OmniWare.toHTML(dslString);

// Option C: Auto-detect wireframe code blocks in document
OmniWare.init();  // Finds all ```wireframe blocks and renders them
```

### 4.6 Markdown Viewer Integration

```javascript
// In your markdown viewer's code block handler:
import OmniWare from './omniware.js';

function renderCodeBlock(language, content, container) {
  if (language === 'mermaid') {
    mermaid.render('id', content, container);
  }
  else if (language === 'omniware' || language === 'wireframe') {
    OmniWare.render(content, container);
  }
}
```

---

## 5. Visual Design System

### 5.1 Wireframe Aesthetic
- Grid paper background (subtle 20px grid)
- Hand-drawn font: Architects Daughter (Google Fonts)
- Sketch-style borders (slightly rough via SVG filter)
- "WIREFRAME" ribbon on top-right corner
- Muted earth-tone palette with color accents for status

### 5.2 Color Tokens
```css
--ow-bg:           #f8f6f1     /* Page background */
--ow-paper:        #ffffff     /* Card/section background */
--ow-border:       #4a4a4a     /* Primary borders */
--ow-border-light: #b0b0b0     /* Secondary borders */
--ow-text:         #333333     /* Primary text */
--ow-text-light:   #777777     /* Secondary text */
--ow-green:        #5a9e6f     /* Success */
--ow-red:          #c0504d     /* Error/danger */
--ow-yellow:       #c09850     /* Warning */
--ow-blue:         #4a7fb5     /* Info/primary */
--ow-purple:       #6b5b95     /* Ref codes / AI */
--ow-gray:         #999999     /* Pending/disabled */
```

### 5.3 Typography
- Headings: Architects Daughter (Google Fonts)
- Body: Patrick Hand (Google Fonts)  
- Code/refs: Courier New (system)

---

## 6. Implementation Plan

| Step | Task | Output |
|---|---|---|
| 1 | Implement CSS styles as embedded string | `STYLES` constant |
| 2 | Implement tokenizer (line → tokens) | `tokenize()` |
| 3 | Implement tree builder (tokens → AST) | `buildTree()` |
| 4 | Implement inline parser (**bold**, {color}, [btn], (ref)) | `parseInline()` |
| 5 | Implement renderers for each component type | `render_*()` functions |
| 6 | Wire up public API | `OmniWare` object |
| 7 | Create demo: Teklif Değerlendirme in DSL | `.html` demo file |
| 8 | Create integration guide for markdown viewer | Documentation |
