# Format formularza (JSON) i algorytm walidacji

**Źródło prawdy** dla silnika formularzy po obu stronach: `pl.medforms.form.engine` (Java) i `frontend/src/form-engine` (TypeScript). Zmiana formatu wymaga w jednym commicie aktualizacji tego pliku, obu silników i przypadków testowych w `docs/form-engine-cases.json`.

Format dotyczy dwóch kolumn JSONB:

- `form_versions.definition`: definicja formularza (§1–§5),
- `submissions.answers`: odpowiedzi `{ "id_pytania": wartość }` (§6–§7).

Nazwa, opis i kategoria formularza są w tabeli `form_templates`, nie w definicji. Dane pacjenta nie są częścią formularza (§12).

---

## 1. Struktura definicji

```
FormDefinition
├── respondent: "patient" | "staff"
└── sections: Section[]
    ├── visibleIf?: Condition
    └── questions: Question[]
        ├── visibleIf?: Condition
        └── options?: Option[]        (tylko single i multiple)
```

Wszystkie teksty (`title`, `description`, `label`, `help`) to **zwykły tekst**, bez HTML i Markdown. Frontend i szablon PDF wyświetlają je jako tekst (bez interpretowania znaczników).

Pola nieopisane w tym pliku są ignorowane i nie trafiają do zapisanej definicji.

### FormDefinition

| Pole | Typ | Wymagane | Opis |
|---|---|:-:|---|
| `respondent` | string | ✔ | Kto wypełnia: `patient` albo `staff` (§12.1) |
| `sections` | `Section[]` | ✔ | 1–50 sekcji |

### Section

| Pole | Typ | Wymagane | Opis |
|---|---|:-:|---|
| `id` | string | ✔ | Identyfikator (§1.1), unikalny wśród sekcji |
| `title` | string | ✔ | 1–200 znaków |
| `description` | string | | Do 2000 znaków, np. instrukcja dla wypełniającego |
| `visibleIf` | `Condition` | | Brak = sekcja zawsze widoczna (§4) |
| `questions` | `Question[]` | ✔ | 1–100 pytań |

### Question: pola wspólne

| Pole | Typ | Wymagane | Opis |
|---|---|:-:|---|
| `id` | string | ✔ | Identyfikator (§1.1), unikalny **w całym formularzu**, nie tylko w sekcji |
| `type` | string | ✔ | `text`, `textarea`, `number`, `date`, `single`, `multiple` |
| `label` | string | ✔ | Treść pytania, 1–500 znaków |
| `help` | string | | Tekst pomocniczy pod pytaniem, do 1000 znaków |
| `required` | boolean | | Domyślnie `false`. Dotyczy tylko pytania widocznego |
| `visibleIf` | `Condition` | | Brak = pytanie widoczne, gdy widoczna jest jego sekcja |

### Question: pola zależne od typu

Pole użyte przy innym typie niż podany w tabeli to błąd definicji.

| Pole | Typy | Typ wartości | Opis |
|---|---|---|---|
| `minLength` | `text`, `textarea` | int ≥ 0 | Domyślnie brak ograniczenia |
| `maxLength` | `text`, `textarea` | int ≥ 1 | Domyślnie **200** (`text`) i **2000** (`textarea`). Najwyżej 500 i 5000 |
| `min`, `max` | `number` | liczba | Zakres włącznie z granicami |
| `min`, `max` | `date` | string | `"RRRR-MM-DD"` albo `"today"` (dzisiejsza data, §8) |
| `decimals` | `number` | int 0–4 | Dozwolona liczba miejsc po przecinku. Domyślnie `0`, czyli liczby całkowite |
| `unit` | `number` | string | Jednostka do wyświetlenia, np. `"kg"`, `"mmHg"`; do 20 znaków |
| `options` | `single`, `multiple` | `Option[]` | `single`: 2–100 opcji, `multiple`: 1–100 (jedna opcja daje pole typu „Wyrażam zgodę”) |

W Javie `min` i `max` mapujemy jako `JsonNode`, bo dla `number` są liczbą, a dla `date` tekstem.

### Option

| Pole | Typ | Wymagane | Opis |
|---|---|:-:|---|
| `value` | string | ✔ | Identyfikator (§1.1), unikalny w pytaniu. Trafia do odpowiedzi, CSV i statystyk |
| `label` | string | ✔ | 1–200 znaków |
| `exclusive` | boolean | | Tylko w `multiple`. Opcja wykluczająca, np. „Brak”: nie może być zaznaczona razem z inną |

### 1.1 Identyfikatory

`id` sekcji, `id` pytania i `value` opcji muszą pasować do wzorca `^[a-z0-9_]{1,50}$`: małe litery łacińskie (bez polskich znaków), cyfry i `_`. Przykłady: `nasilenie_bolu`, `choroby_przewlekle`, `tak`.

---

## 2. Typy pytań

| Typ | Odpowiedź (JSON) | Widok we frontendzie | Statystyki |
|---|---|---|---|
| `text` | string | jedno pole tekstowe | nie (§10 PROJECT_CONTEXT) |
| `textarea` | string | pole wielowierszowe | nie |
| `number` | liczba (JSON number, nie tekst) | pole liczbowe z jednostką; mała skala jako rząd przycisków (§9) | min, max, średnia |
| `date` | string `"RRRR-MM-DD"` | pole daty | nie |
| `single` | string (`value` opcji) | przyciski opcji (radio) albo lista rozwijana (§9) | rozkład `{ value: count }` |
| `multiple` | tablica stringów (`value` opcji) | pola wyboru (checkbox) | rozkład `{ value: count }` |

Typowe przypadki bez osobnego typu:

- **Tak/Nie:** `single` z opcjami `tak` i `nie`.
- **Skala, np. ból 0–10:** `number` z `min: 0`, `max: 10`.
- **„Inne, jakie?”:** opcja `inne` oraz osobne pytanie `text` z `visibleIf` `{ "op": "contains", "value": "inne" }`.
- **Zgoda:** `multiple` z jedną opcją i `required: true`.

---

## 3. Warunki widoczności (`Condition`)

`Condition` ma **dokładnie jedną** z trzech postaci:

```json
{ "question": "bol", "op": "eq", "value": "tak" }
{ "all": [ <Condition>, <Condition> ] }
{ "any": [ <Condition>, <Condition> ] }
```

- `all` jest spełniony, gdy spełnione są wszystkie elementy, a `any`, gdy spełniony jest co najmniej jeden.
- Tablice `all` i `any` mają 1–20 elementów. Zagnieżdżenie `all`/`any` sięga najwyżej 3 poziomów.

### Operatory

| `op` | Typ pytania, do którego odwołuje się warunek | `value` | Prawda, gdy |
|---|---|---|---|
| `answered` | każdy | brak pola | pytanie ma odpowiedź |
| `eq`, `ne` | `single` | `value` istniejącej opcji | wybrana opcja jest równa / różna od `value` |
| `in` | `single` | niepusta tablica `value` istniejących opcji | wybrana opcja jest w tablicy |
| `contains` | `multiple` | `value` istniejącej opcji | opcja jest wśród zaznaczonych |
| `eq`, `ne`, `gt`, `gte`, `lt`, `lte` | `number` | liczba | porównanie liczbowe `odpowiedź <op> value` |

Do pytań `text`, `textarea` i `date` warunek może odwołać się wyłącznie przez `answered`.

### Zasady

1. Warunek odwołuje się tylko do pytania, które występuje w formularzu **wcześniej**: w poprzedniej sekcji albo wyżej w tej samej sekcji. Warunek sekcji odwołuje się tylko do pytań z poprzednich sekcji. Dzięki temu nie ma cykli, a widoczność liczymy w jednym przejściu.
2. Jeśli wskazane pytanie **nie ma odpowiedzi albo jest ukryte**, każdy operator daje `false`, także `ne`. Dzięki temu ukrycie pytania ukrywa też pytania od niego zależne.
3. Jeśli odpowiedź ma zły typ JSON (np. tekst zamiast liczby), operator daje `false`. Sam błąd zgłasza walidacja (§7).

---

## 4. Widoczność

Pytanie jest widoczne, gdy jego sekcja jest widoczna i jego `visibleIf` jest spełnione (albo go nie ma). Sekcja jest widoczna, gdy jej `visibleIf` jest spełnione (albo go nie ma).

Algorytm (identyczny w Javie i TypeScripcie):

```
widoczneOdpowiedzi = {}
dla każdej sekcji S po kolei:
    sekcjaWidoczna = S.visibleIf brak  LUB  oceń(S.visibleIf, widoczneOdpowiedzi)
    dla każdego pytania P w S po kolei:
        P widoczne = sekcjaWidoczna  ORAZ  (P.visibleIf brak  LUB  oceń(P.visibleIf, widoczneOdpowiedzi))
        jeśli P widoczne i ma odpowiedź (po normalizacji, §6.1):
            widoczneOdpowiedzi[P.id] = odpowiedź
```

Odpowiedzi na pytania ukryte nie trafiają do `widoczneOdpowiedzi`, więc warunki widzą je jako brak odpowiedzi.

---

## 5. Walidacja definicji

Definicję sprawdzamy przy zapisie szkicu i ponownie przy publikacji. Błędy zwracamy jako 400 w `errors`. Kluczem jest ścieżka do pola, wartością komunikat po polsku:

```json
{ "status": 400, "title": "Bad Request", "detail": "Niepoprawna definicja formularza",
  "errors": { "sections[1].questions[2].visibleIf": "Warunek może odwoływać się tylko do wcześniejszych pytań." } }
```

| Element | Reguły |
|---|---|
| Formularz | `respondent` to `patient` albo `staff`; 1–50 sekcji, łącznie najwyżej 300 pytań |
| Sekcja | `id` zgodne z §1.1 i unikalne; `title` 1–200; `description` ≤ 2000; 1–100 pytań |
| Pytanie | `id` zgodne z §1.1 i unikalne w formularzu; znany `type`; `label` 1–500; `help` ≤ 1000; tylko pola dozwolone dla typu |
| `text`, `textarea` | `0 ≤ minLength ≤ maxLength`; `maxLength` ≤ 500 / 5000 |
| `number` | `decimals` 0–4; `min ≤ max`, jeśli podane oba; `unit` ≤ 20 |
| `date` | `min`/`max` to poprawna data `RRRR-MM-DD` albo `"today"`; `min ≤ max`, jeśli oba są datami |
| `single`, `multiple` | liczba opcji jak w §1; `value` zgodne z §1.1 i unikalne w pytaniu; `label` 1–200; `exclusive` tylko w `multiple` |
| `Condition` | dokładnie jedna postać; pytanie istnieje i jest wcześniej (§3); operator dozwolony dla typu; `value` zgodne z tabelą operatorów; limity `all`/`any` |
| Zgodność z wersjami | Pytanie o tym samym `id` co w ostatniej opublikowanej wersji musi mieć ten sam `type` (CSV i statystyki łączą pytania po `id`) |

**Zmiana znaczenia pytania lub opcji = nowe `id` / nowe `value`.** Silnik tego nie wykryje, ale bez tego eksport i statystyki pomieszają stare i nowe odpowiedzi. Usuwanie pytań i opcji w nowej wersji jest dozwolone, a stare ankiety je zachowują.

---

## 6. Odpowiedzi (`answers`)

Obiekt JSON: kluczem jest `id` pytania, wartością odpowiedź w typie z §2. Brak klucza oznacza brak odpowiedzi.

### 6.1 Normalizacja (przed walidacją)

| Wejście | Wynik |
|---|---|
| `null`, `""`, tekst z samych białych znaków, `[]` | brak odpowiedzi (klucz usunięty) |
| tekst (`text`, `textarea`) | obcięte białe znaki z początku i końca |
| tablica (`multiple`) | usunięte duplikaty, kolejność jak w definicji |

Długość tekstu liczymy jak `String.length()` w Javie i `.length` w JS (jednostki UTF-16), tak samo jak atrybut HTML `maxLength`.

---

## 7. Walidacja odpowiedzi

`FormEngine.validateAnswers(definition, answers, today)` zwraca mapę błędów i oczyszczone odpowiedzi. Serwer waliduje **zawsze**, także gdy frontend już to zrobił.

1. `answers` musi być obiektem JSON. W przeciwnym razie 400.
2. **Nieznany klucz** (brak takiego `id` w tej wersji formularza) odrzuca całe zgłoszenie: 400 z błędami tylko dla nieznanych kluczy, bez dalszej walidacji.
3. Normalizacja (§6.1).
4. Widoczność (§4).
5. Odpowiedzi na pytania ukryte są **usuwane bez błędu**.
6. Każde widoczne pytanie sprawdzamy według tabeli niżej.
7. Jeśli są błędy, zwracamy 400 i nic nie zapisujemy. W przeciwnym razie zapisujemy `widoczneOdpowiedzi` z §4.

| Sprawdzenie | Komunikat |
|---|---|
| nieznany klucz | `Nieznane pytanie.` |
| `required`, a brak odpowiedzi | `To pole jest wymagane.` |
| zły typ JSON | `Niepoprawny typ odpowiedzi.` |
| `text`/`textarea`: za krótki | `Odpowiedź musi mieć co najmniej {minLength} znaków.` |
| `text`/`textarea`: za długi (także domyślny `maxLength`) | `Odpowiedź może mieć najwyżej {maxLength} znaków.` |
| `number`: za dużo miejsc po przecinku | `decimals = 0`: `Wartość musi być liczbą całkowitą.`, inaczej `Dozwolona liczba miejsc po przecinku: {decimals}.` |
| `number`: poza zakresem | `Wartość musi być między {min} a {max}.` / `Wartość musi wynosić co najmniej {min}.` / `Wartość może wynosić najwyżej {max}.` |
| `date`: zły format lub nieistniejąca data | `Niepoprawna data.` |
| `date`: poza zakresem | `Data musi być między {min} a {max}.` / `Data nie może być wcześniejsza niż {min}.` / `Data nie może być późniejsza niż {max}.` |
| `single`: wartość spoza opcji | `Wybierz jedną z dostępnych opcji.` |
| `multiple`: wartość spoza opcji | `Niepoprawna opcja.` |
| `multiple`: opcja `exclusive` z inną | `Opcji „{label}” nie można łączyć z innymi.` |

- Liczby w komunikatach zapisujemy z przecinkiem dziesiętnym (`0,5`), a daty jako `DD.MM.RRRR`. `"today"` zamieniamy na dzisiejszą datę.
- Liczbę miejsc po przecinku liczymy po usunięciu końcowych zer, więc `72.50` ma jedno miejsce. Java używa `BigDecimal`.

---

## 8. Czas

`today` to `LocalDate` w strefie `Europe/Warsaw`, liczona z wstrzykniętego `Clock` (PROJECT_CONTEXT §8). `"today"` w `min`/`max` pytania `date` oznacza tę datę. Frontend używa daty z przeglądarki tylko do podpowiedzi w polu; rozstrzyga serwer.

---

## 9. Frontend: renderowanie

| Typ | Komponent (Mantine) | Atrybuty HTML z definicji |
|---|---|---|
| `text` | `TextInput` | `required`, `minLength`, `maxLength` (domyślnie 200) |
| `textarea` | `Textarea` | `required`, `minLength`, `maxLength` (domyślnie 2000) |
| `number` | `NumberInput`, `unit` jako sufiks | `required`, `min`, `max`, `step = 10^-decimals` |
| `number` (skala) | rząd przycisków, gdy `decimals = 0`, podane `min` i `max`, a `max − min ≤ 10` | jak wyżej |
| `date` | `TextInput type="date"` | `required`, `min`, `max` (`"today"` zamienione na datę) |
| `single` | `Radio.Group`, gdy opcji jest ≤ 6; `Select`, gdy więcej | `required` |
| `multiple` | `Checkbox.Group` | `required` = co najmniej jedno zaznaczenie |

- Pytania i sekcje ukryte nie są renderowane. Frontend wysyła tylko odpowiedzi widocznych pytań (serwer i tak usuwa pozostałe).
- Zaznaczenie opcji `exclusive` odznacza pozostałe, a zaznaczenie zwykłej opcji odznacza opcję `exclusive`.
- Błędy z `errors` serwera wyświetlamy przy polach o tym samym `id`.
- W podglądzie, PDF i CSV wartości opcji zamieniamy na etykiety z **tej wersji**, do której należy ankieta.

---

## 10. Przykład: „Wywiad wstępny”

### Definicja

```json
{
  "respondent": "patient",
  "sections": [
    {
      "id": "pomiary",
      "title": "Pomiary",
      "questions": [
        { "id": "masa_ciala", "type": "number", "label": "Masa ciała", "required": true,
          "min": 1, "max": 400, "decimals": 1, "unit": "kg" },
        { "id": "wzrost", "type": "number", "label": "Wzrost", "required": true,
          "min": 30, "max": 250, "unit": "cm" }
      ]
    },
    {
      "id": "dolegliwosci",
      "title": "Dolegliwości",
      "questions": [
        { "id": "powod_wizyty", "type": "textarea", "label": "Powód zgłoszenia", "required": true,
          "maxLength": 1000 },
        { "id": "bol", "type": "single", "label": "Czy odczuwa Pan/Pani ból?", "required": true,
          "options": [
            { "value": "tak", "label": "Tak" },
            { "value": "nie", "label": "Nie" }
          ] },
        { "id": "nasilenie_bolu", "type": "number", "label": "Nasilenie bólu", "required": true,
          "help": "0 oznacza brak bólu, 10 najsilniejszy ból, jaki można sobie wyobrazić.",
          "min": 0, "max": 10,
          "visibleIf": { "question": "bol", "op": "eq", "value": "tak" } },
        { "id": "konsultacja_bolu", "type": "single", "label": "Czy ból był już konsultowany z lekarzem?",
          "visibleIf": { "all": [
            { "question": "bol", "op": "eq", "value": "tak" },
            { "question": "nasilenie_bolu", "op": "gte", "value": 7 }
          ] },
          "options": [
            { "value": "tak", "label": "Tak" },
            { "value": "nie", "label": "Nie" }
          ] },
        { "id": "poczatek_dolegliwosci", "type": "date", "label": "Od kiedy występują dolegliwości?",
          "max": "today" }
      ]
    },
    {
      "id": "wywiad",
      "title": "Choroby i używki",
      "questions": [
        { "id": "choroby_przewlekle", "type": "multiple", "label": "Choroby przewlekłe", "required": true,
          "options": [
            { "value": "cukrzyca", "label": "Cukrzyca" },
            { "value": "nadcisnienie", "label": "Nadciśnienie tętnicze" },
            { "value": "astma", "label": "Astma" },
            { "value": "inne", "label": "Inne" },
            { "value": "brak", "label": "Brak", "exclusive": true }
          ] },
        { "id": "choroby_inne", "type": "text", "label": "Jakie inne choroby?", "required": true,
          "visibleIf": { "question": "choroby_przewlekle", "op": "contains", "value": "inne" } },
        { "id": "palenie", "type": "single", "label": "Palenie tytoniu", "required": true,
          "options": [
            { "value": "nigdy", "label": "Nigdy nie palił(a)" },
            { "value": "byly", "label": "Były palacz" },
            { "value": "obecnie", "label": "Pali obecnie" }
          ] }
      ]
    },
    {
      "id": "palenie_szczegoly",
      "title": "Palenie: szczegóły",
      "visibleIf": { "question": "palenie", "op": "in", "value": ["byly", "obecnie"] },
      "questions": [
        { "id": "papierosy_dziennie", "type": "number", "label": "Liczba papierosów dziennie",
          "min": 0, "max": 100 }
      ]
    }
  ]
}
```

### Poprawne odpowiedzi i wynik po oczyszczeniu

Wysłane:

```json
{
  "masa_ciala": 72.5,
  "wzrost": 178,
  "powod_wizyty": "  Ból głowy od tygodnia  ",
  "bol": "nie",
  "nasilenie_bolu": 6,
  "poczatek_dolegliwosci": "",
  "choroby_przewlekle": ["nadcisnienie", "cukrzyca", "cukrzyca"],
  "palenie": "nigdy",
  "papierosy_dziennie": 5
}
```

Zapisane w `submissions.answers`:

```json
{
  "masa_ciala": 72.5,
  "wzrost": 178,
  "powod_wizyty": "Ból głowy od tygodnia",
  "bol": "nie",
  "choroby_przewlekle": ["cukrzyca", "nadcisnienie"],
  "palenie": "nigdy"
}
```

- `nasilenie_bolu` usunięte: pytanie ukryte, bo `bol` = `nie`.
- `papierosy_dziennie` usunięte: sekcja `palenie_szczegoly` ukryta, bo `palenie` = `nigdy`.
- `poczatek_dolegliwosci` usunięte: pusty tekst to brak odpowiedzi, a pytanie nie jest wymagane.
- `powod_wizyty` obcięte; `choroby_przewlekle` bez duplikatu i w kolejności z definicji.

### Odpowiedzi z błędami

```json
{
  "masa_ciala": 72.55,
  "wzrost": "178",
  "powod_wizyty": "   ",
  "bol": "tak",
  "choroby_przewlekle": ["brak", "astma"],
  "palenie": "obecnie"
}
```

```json
{ "status": 400, "title": "Bad Request", "detail": "Niepoprawne odpowiedzi",
  "errors": {
    "masa_ciala": "Dozwolona liczba miejsc po przecinku: 1.",
    "wzrost": "Niepoprawny typ odpowiedzi.",
    "powod_wizyty": "To pole jest wymagane.",
    "nasilenie_bolu": "To pole jest wymagane.",
    "choroby_przewlekle": "Opcji „Brak” nie można łączyć z innymi."
  } }
```

- `nasilenie_bolu` jest wymagane, bo `bol` = `tak`.
- `konsultacja_bolu` jest ukryte, bo `nasilenie_bolu` nie ma odpowiedzi (§3, zasada 2).
- Sekcja `palenie_szczegoly` jest widoczna, ale `papierosy_dziennie` nie jest wymagane.

Nieznany klucz, np. `{ "masa_ciala": 70, "waga": 70 }`, daje wyłącznie `"errors": { "waga": "Nieznane pytanie." }`.

---

## 11. Przypadki testowe

`docs/form-engine-cases.json` to lista przypadków `{ name, definition, answers, today, expectedVisible, expectedAnswers, expectedErrors }`. Te same przypadki uruchamiają testy JUnit i Vitest. Widoczność (`expectedVisible`) musi być identyczna w obu silnikach. Komunikaty błędów sprawdza tylko silnik w Javie.

---

## 12. Kto wypełnia i dane pacjenta

### 12.1 Tryb wypełniania (`respondent`)

| Wartość | Kto wypełnia | Kod QR | Przykłady |
|---|---|:-:|---|
| `patient` | Pacjent sam na telefonie (QR) albo personel razem z pacjentem | ✔ | wywiad wstępny, ankieta przed wizytą w prywatnej klinice |
| `staff` | Tylko personel, bez udziału pacjenta | ✘ (409) | ocena noworodka, karta obserwacji, ocena stanu przez pielęgniarkę |

- Pytania w formularzu `patient` piszemy do pacjenta („Czy odczuwa Pan/Pani ból?”), w formularzu `staff` do personelu („Czy pacjent zgłasza ból?”).
- **Jedna ankieta ma jeden tryb.** Wzór, który łączy wywiad z pacjentem i ocenę personelu (np. karta porady w POZ), dzielimy na dwa formularze: wywiad (`patient`) i ocenę (`staff`). Ankiet się nie edytuje, więc nie ma „uzupełniania” ankiety pacjenta przez personel.
- Tryb należy do wersji formularza. Kod QR można wygenerować tylko dla aktualnej opublikowanej wersji z `respondent: "patient"`.

### 12.2 Dane pacjenta

- Formularz **nie zawiera pytań o imię, nazwisko, PESEL, datę urodzenia ani wiek.** Te dane są w kartotece pacjenta (`patients`). Personel wprowadza lub wyszukuje pacjenta, zanim wypełni ankietę albo wygeneruje kod QR.
- Kod QR jest generowany dla **konkretnego pacjenta i wersji formularza**. Pacjent niczego o sobie nie wpisuje. Strona ankiety pokazuje tylko inicjały („Ankieta dla: J. K.”), żeby pacjent zauważył, że kod jest dla kogoś innego. Link nie zawiera danych pacjenta.
- Podgląd ankiety, PDF i CSV dołączają dane pacjenta z kartoteki. Wiek (np. „Wiek” ze wzoru karty pacjentki) liczymy z PESEL-u na dzień wypełnienia ankiety.
- **Noworodek** zwykle nie ma jeszcze PESEL-u, dlatego ankiety noworodka wypełniamy **w karcie matki**. Dane noworodka (np. data urodzenia, płeć, masa urodzeniowa) są pytaniami formularza.
- **Powtarzane obserwacje** (np. karta obserwacji co dobę) to osobne ankiety tego samego formularza. Historia pacjenta pokazuje je chronologicznie. Jeśli obserwację wpisujemy później, jej datę zapisujemy pytaniem `date` z `"max": "today"`.

---

## 13. Wzory papierowe w tym formacie

Sprawdzone na wzorach: karta porady edukacyjnej POZ, karta obserwacji pacjentki (ginekologia) i karta „Wywiad i stan ogólny” (położnictwo).

| Element wzoru | Zapis |
|---|---|
| RR …/… mmHg | dwa pytania `number`: `rr_skurczowe`, `rr_rozkurczowe`, `unit: "mmHg"` |
| Temperatura ciała | `number`, `decimals: 1`, `unit: "°C"` |
| Tętno, saturacja, obwód talii | `number` z `unit` (`"/min"`, `"%"`, `"cm"`) i zakresem `min`/`max` |
| „ocena: prawidłowe / nieprawidłowe” przy pomiarze | osobne pytanie `single` zaraz po pomiarze |
| ŚWIADOMOŚĆ: pełna / senność / apatia | `single` |
| KASZEL: suchy … skąpy / brak | `multiple`, opcja `brak` z `exclusive` |
| OBAWY/LĘKI: niemożliwe do oceny … brak, inne …… | `multiple`, `niemozliwe_do_oceny` i `brak` z `exclusive`, do tego pytanie `text` z `visibleIf` `contains` `inne` |
| PLWOCINA: brak / obecna (jaka?) | `single` + `text` z `visibleIf` `eq` `obecna` |
| Grupa krwi, Rh | dwa pytania `single`: A / B / AB / 0 oraz Rh+ / Rh− |
| Leczenie krwią tak / nie, kiedy | `single` + `date` z `visibleIf` `eq` `tak` |
| OM (ostatnia miesiączka) | `date` z `"max": "today"` |
| Liczba ciąż, porodów, poronień | `number` z `"min": 0` |
| Glikemia: średnia lub TIR lub HbA1c | trzy niewymagane pytania `number` |
| BMI, suma punktów (np. Apgar) | `number` wpisywany przez personel (bez pól wyliczanych) |
| Zlecone leki: rano / popołudnie / wieczór / noc | cztery pytania `text` |
| Rozpoznanie, diagnoza pielęgniarska, uwagi | `textarea` |
| Inicjały, wiek | nie są pytaniami, pochodzą z kartoteki (§12.2) |

**Czego format celowo nie obsługuje:**
- pól wyliczanych (BMI, sumy punktów),
- układu tabeli i pól obok siebie (RR wyświetla się jako dwa pola jedno pod drugim),
- reguł między polami (np. porody ≤ ciąże, „podaj co najmniej jedną z trzech wartości”),
- typu „godzina”.
