# OmniWare wireframe DSL: reference as the code implements it

OmniWare is Omnicore's text wireframe language, rendered by `omniware.js` v1.0.0. That file is identical in the desktop app and the VS Code extension. This reference was derived from the parser and every item was verified by rendering.

**`OMNIWARE_SPEC.md` and the README example are partly wrong:** they use the `wireframe` fence, `title="…"`, `status: draft` as a child line, and `---` as a divider. Trust this file.

## Contents
1. Embedding
2. Core parsing rules
3. Keyword reference
4. Inline markup
5. Enumerations
6. Silent failures
7. Verified example
8. Checking

## 1. Embedding

- Use a fenced block with the info string `omniware` (`wireframe` is an alias). ```` ``` ```` and `~~~` both work, and so do list indentation and extra words after the keyword. An OmniWare example inside another code block stays code.
- `.ow` files are wrapped automatically. Write the raw DSL with **no fence**.
- Several blocks per document are fine.
- `:shortcodes:` in wireframe text become emoji in both viewers. Type Unicode emoji if you want to be explicit.
- The rendered HTML is **not sanitised**. In raw contexts (§4) `<`, `>` and `&` pass through as HTML, so avoid them there.
- Each wireframe has a maximize button that opens a pop-up with PDF export in both viewers. Word export keeps only the text of a wireframe, so export wireframes as PDF.
- These behaviours need extension ≥ 1.2.0 / desktop ≥ 2.3.0. Older viewers only accepted an exact lowercase ```` ```omniware ```` at column 0.

## 2. Core parsing rules

1. **Lines.** One statement per line. Blank lines are ignored and do not end blocks. `//` at line start is a comment; mid-line `//` is text.
2. **Keywords.** `@keyword rest-of-header`, lowercase. Unknown keywords show their header as text, and their children disappear.
3. **Indentation.** 2 spaces = one level; tabs count as 2. Nesting is relative: a line is a child of the nearest previous line with a smaller indent.
   - A line indented deeper than a *content* line is **dropped**.
   - A data line dedented to its block's level leaves the block.
   - Keep all data lines of a block at exactly one level below it.
4. **Header props.** An optional `"quoted title"` comes first, then `key:value` pairs.
   - **No space after the colon.** Quote values that contain spaces: `ref:"A, B"`.
   - An unquoted title loses anything that looks like `x:y` (`Saat 14:00` becomes `Saat`). **Always quote titles.**
   - `title="X"` / `label="X"` is not syntax; it becomes literal title text.
5. **Page frame.** Start with `@page` and indent **everything** under it. A line at indent 0 after `@page` renders outside the frame and leaves the frame empty.
   - Without `@page` you get a plain frame with no ribbon.
   - The `@page` title is **never displayed**. Put visible titles in `@breadcrumb`, `@nav` or `@section`.
   - Inside `@page`, `@nav`, `@breadcrumb` and `@footer` render full-width.
6. **Containers.** Only `@page`, `@section` and `@col` (inside `@columns`) render nested blocks.
   - `@grid`, `@badges`, `@table` and `@locked` render nested blocks *after* themselves.
   - Every other block drops nested blocks silently. Example: `@buttons` inside `@form` vanishes, so put it after the form as a sibling.

## 3. Keyword reference

| Keyword | Header | Children | Notes |
|---|---|---|---|
| `@page` | `"Title" status:draft\|review\|approved` | any | Ribbon "Wireframe — Draft/Review/Approved". The title is hidden. |
| `@nav` | – | one line: `Logo \| Item \| *Active* \| Item` | First item = logo ("◈ Logo"). Only the first line is used. Raw text. |
| `@breadcrumb` | – | one line: `⌂ Ana Sayfa > Şebeke > **Fider F-12**` | Inline markup; `>` is fine. |
| `@section` | `"Title" icon:<name> ref:ID1,ID2` | any | The main panel; nesting works. `ref` values become chips. |
| `@grid` | `cols:1\|2\|3` (default 2) | `Label : value` | Splits on the first `:`. The value has inline markup; the label is raw. A line without `:` is skipped. |
| `@badges` | – | `{green} Text` per line | A space after `}` is allowed here. No colour means gray. |
| `@tabs` | – | one line: `Tab \| *Active* \| Tab` | Visual only; put the tab content after it as siblings. |
| `@table` | `ref:ID` | header line, then `--`, then rows | All cells have inline markup. The separator is exactly `--`. No `\|` inside cells. |
| `@buttons` | – | `[primary\|success\|danger\|default] Label` per line | A bare `[Label]` shows the brackets. The label is raw. |
| `@form` | `cols:1\|2\|3` (default 1) | `type  "Label"  flags` | Parts are separated by **2+ spaces**. Types and flags: §5. |
| `@metric` | – | `"Label" : **value** {color}` per line | KPI cards. Without `**…**`, the whole rest of the line shows. |
| `@note` | `type:info\|warning\|error\|success` | text lines (joined with spaces) | Icon prefix 📌 ⚠ ❌ ✅. Inline markup. |
| `@alert` | `type:… ref:ID` | text lines | Left-border alert. `ref` is not split on commas. |
| `@placeholder` | `height:N` (px, default 80) | text | Rendered as `[ text ]`, for charts or maps. |
| `@formula` | – | text | "Formula:" prefix. Inline markup. |
| `@locked` | `"Overlay text"` | blocks (dimmed) | The renderer adds its own 🔒; don't type one. |
| `@radio` | `"Label"` | one line: `A \| *B* \| C` | – |
| `@textarea` | `"Label" rows:N` | text (read-only box) | Markup shows literally. |
| `@progress` | – | one line: `{done} A \| {active} B \| {pending} C` | Step indicator. |
| `@divider` | – | – | Dashed rule. **`---` is not a divider.** |
| `@footer` | – | line 1 = left, line 2 = right | Inline markup. |
| `@columns` | (number ignored) | only `@col` children | Equal columns that stack below 700 px. |
| `@col` | – | any | A container. |

## 4. Inline markup

Inline markup applies only in these places:
- breadcrumb;
- grid **values**;
- table cells;
- note, alert, formula and footer;
- `@locked` text;
- free text directly under page, section or col.

Everywhere else the text is **raw**: nav, tabs, badges, buttons, form, metric, progress, radio, textarea, placeholder, all titles and grid labels.

| Syntax | Result | Rules |
|---|---|---|
| `**text**` | bold | Stays within one line. |
| `{color}Text` | pill tag (under 30 chars) or coloured bold text | **No space after `}`.** The text runs until 2+ spaces, `\|` or the end of the line, so `{green}OK {red}FAIL` becomes one tag. Put `{color}` last in a cell or line. Write `{green}**x**`, not `**{green}x**`. `{gray}` short tags are unstyled. |
| `(REF-CODE)` | purple reference chip | Any `(` + ASCII capital + 1 or more `[A-Z0-9-_~,.§ ]` + `)`. `(FR-001)` and `(KRL-AI)` become chips, and so does `(PDF)`. Lowercase or Turkish capitals (`(İHALE)`) stay text. Use deliberately. |
| `[text]` | inline button | A Markdown link `[a](url)` becomes a button plus the literal `(url)`. |
| `*item*` | active item | Only in nav, tabs and radio items. There is no italic anywhere. |
| `\|` | separator | In nav, tabs, radio, progress and table rows. There is no escape. |
| emoji | literal | Unicode emoji work everywhere and make good icons: ⚡ 📊 ✓ ⚠ 🔒. |

There are no links, images, lists, headings or escapes (`\` does nothing).

## 5. Enumerations

| Where | Values (default in **bold**) |
|---|---|
| `@page status:` | **draft**, review, approved |
| `@section icon:` | info (i), check ✓, lock 🔒, star ★, currency ₺, play ▶, chart 📊, user 👤, settings ⚙, doc 📄, clock ⏱, warning ⚠. An emoji also works; a plain word looks bad. |
| `{color}` | green, red, yellow, blue, gray |
| `@badges` colour | green, red, yellow, blue, **gray** |
| `@metric` colour | green, red, yellow, gray, **blue** |
| `@buttons` style | primary, success, danger, **default** |
| `@note` / `@alert type:` | **info**, warning, error, success |
| `@progress` state | done, active, **pending** |
| `@form` field type | text, date, number, select, textarea, file, checkbox, radio (anything else: text input) |
| `@form` flags | `required`, `readonly`, `value:"…"`, `options:"a,b,c"`, `rows:N` |
| `@grid` / `@form cols:` | 1, 2, 3 (4+ falls back to one column) |

Form notes:
- `select` shows only the first option.
- `checkbox` is always drawn checked.
- `radio` selects the first option.
- `date` without a value shows `dd/mm/yyyy`.

## 6. Silent failures

The renderer never reports an error. Wrong syntax produces literal text, an empty element or **missing lines**. These are the most common:

| Mistake | What you see |
|---|---|
| Content after `@page` at indent 0 | empty page frame; content below it |
| `@nav brand="X" items=[…]` | nothing |
| second line under `@nav`/`@tabs`/`@radio`/`@progress`/`@breadcrumb` | ignored |
| form line with single spaces | field missing |
| `checkbox "X"` (single space) | field missing |
| `textarea "X"  rows:3` in a form | a field labelled "rows:3" |
| `@buttons` nested in `@form` | buttons missing |
| table row indented deeper than the header | row missing |
| `{green} OK` in a table cell | literal `{green} OK` |
| `---` | the text "---" |
| unknown `@keyword` | header as text, children missing |

`check_md.py --render` renders each block and confirms that every DSL line appears in the output with no leftover markup. Always run it.

## 7. Verified example

This renders cleanly: every line appears, and nothing is left over. Adapt it rather than starting from the spec. The domain content is illustrative; take real fields from the project's docs.

```omniware
@page "Fider F-12 İzleme" status:review
  @nav
    O1 Energy | Panel | *Şebeke* | Sayaçlar | Kesintiler | Raporlar
  @breadcrumb
    ⌂ Şebeke > TM-Merkez > **Fider F-12**
  @metric
    "Aktif Sayaç" : **12.480** {blue}
    "Anlık Yük" : **4,82 MW** {green}
    "Kayıp Oranı" : **%7,4** {yellow}
    "Açık Kesinti" : **2** {red}
  @tabs
    *Genel Bakış* | Okumalar | Olaylar | Kayıp-Kaçak
  @columns
    @col
      @section "Fider Bilgileri" icon:info ref:FR-INV-010
        @grid cols:2
          Fider Kodu : **F-12**
          İstasyon : TM-Merkez
          Gerilim : **34,5 kV**
          Durum : {green}Enerjili
          Trafo Sayısı : **18**
          Son Okuma : 18.09.2026 14:15
        @badges
          {green} HES bağlantısı: OK
          {yellow} 3 sayaç gecikmeli
          {red} 1 trafo aşırı yükte
    @col
      @section "Yük Profili" icon:chart ref:FR-GL-002
        @placeholder height:140
          📈 24 saatlik yük eğrisi — 15 dk continuous aggregate
        @formula
          Kayıp = Fider girişi − Σ sayaç tüketimi
  @section "Dağıtım Trafoları" icon:settings ref:FR-GL-003,FR-LS-001
    @alert type:warning ref:ALR-OVL-01
      DT-0412 trafosu **%112** yükte, 25 dakikadır limit üstünde.
    @table
      Trafo | Güç | Yük | Sayaç | Durum | İşlem
      --
      DT-0407 | 400 kVA | %64 | 212 | {green}Normal | [Detay]
      DT-0412 | 250 kVA | **%112** | 187 | {red}Aşırı Yük | [Detay]  [Röle]
      DT-0415 | 630 kVA | %81 | 340 | {yellow}Uyarı | [Detay]
      DT-0421 | 400 kVA | — | 0 | {blue}Enerjisiz | [Detay]
      @buttons
        [primary] ⟳ Toplu Okuma Başlat
        [default] ⤓ CSV Dışa Aktar
  @section "Okuma İşi Planla" icon:clock ref:FR-HES-004
    @progress
      {done} Hedef | {active} Zamanlama | {pending} Onay | {pending} Gönderim
    @form cols:2
      select    "Hedef"          options:"Fider F-12,Trafo DT-0412,Tek sayaç"  required
      select    "Okuma Tipi"     options:"Yük profili,Anlık değerler,Olay kayıtları"
      date      "Başlangıç"      required
      number    "Zaman Aşımı ms"  value:"30000"
      text      "İş Kodu"        readonly  value:"RJ-01J8Z3"
      checkbox  "Tamamlanınca bildirim gönder"
    @radio "Tekrar"
      Tek sefer | *Her gün* | Her saat
    @textarea "Operatör Notu" rows:3
      Gece tarifesi öncesi yük profili okuması.
    @buttons
      [success] ✓ Planla
      [default] İptal
    @note type:info
      İş, bölge HES Worker'ı tarafından MQTT ile omni-reader'a iletilir.
  @section "Röle Komutları" icon:lock ref:FR-RLY-001
    @locked "Yetki gerekli: Röle Operatörü rolü"
      @buttons
        [danger] ⏻ Enerjiyi Kes
        [default] ⏼ Enerjiyi Ver
  @footer
    🔒 Tüm işlemler denetim izine yazılır (NFR-AUD-01)
    Son güncelleme: **operator01** — 18.09.2026 14:20
```

Known cosmetic issues in the renderer, which are not your fault:
- `select` shows a double ▾;
- the ribbon text is clipped at the corner;
- short `{gray}` tags are unstyled.

## 8. Checking

```bash
python3 ~/.claude/skills/omnicore-markdown/scripts/check_md.py screen.md --render   # or screen.ow
```

- Static rules catch fence, indentation, props, form, button and colour mistakes.
- `--render` catches every dropped line.
