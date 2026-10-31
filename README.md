# medical-forms-management

Aplikacja webowa do zarządzania formularzami medycznymi. Projekt inżynierski na kierunku Informatyka.

Personel medyczny wypełnia wywiady i ankiety bezpośrednio w systemie. Pacjent może wypełnić ankietę na swoim telefonie po zeskanowaniu jednorazowego kodu QR. Personel zarządzający tworzy formularze w kreatorze, bez zmian w kodzie. System przechowuje wyniki, pokazuje historię ankiet pacjenta, eksportuje dane do PDF i CSV, prowadzi rejestr operacji i generuje anonimowe statystyki.

> W projekcie używamy wyłącznie **fikcyjnych** danych pacjentów.

## Technologie

| Warstwa | Technologie |
|---|---|
| Backend | Java 21, Spring Boot 3.5, Spring Data JPA, Flyway, Bean Validation, Maven |
| Baza danych | PostgreSQL 17 |
| Frontend | React 19, TypeScript, Vite, Mantine, React Router |
| Testy | JUnit 5, Testcontainers (backend), Vitest (frontend) |

## Wymagania

- JDK 21
- Node.js w wersji LTS (22 lub 24)
- Docker

## Struktura repozytorium

```
backend/    Spring Boot, pakiet bazowy pl.medforms
frontend/   React + Vite
```

## Uruchamianie

Na Windows zamiast `./mvnw` użyj `.\mvnw.cmd`.

**Backend**, z katalogu `backend/`:

```bash
./mvnw test     # testy; wymagają uruchomionego Dockera
```

Uruchomienie samej aplikacji (`./mvnw spring-boot:run`) wymaga bazy PostgreSQL. Plik `docker-compose.yml` z bazą dodamy w etapie 1.

**Frontend**, z katalogu `frontend/`:

```bash
npm install     # jednorazowo
npm run dev     # serwer deweloperski: http://localhost:5173, /api przekierowane na http://localhost:8080
npm run build   # sprawdzenie typów i build produkcyjny
npm test        # testy (Vitest)
```

## Stan projektu

| # | Etap | Stan |
|---|---|---|
| 0 | Analiza: przypadki użycia, ERD, założenia | ukończony |
| 1 | Szkielet: Docker Compose, Spring Boot + React, Flyway, Security, role, rejestr operacji, pierwszy administrator | w toku |
| 2 | Silnik formularzy: definicje, widoczność pytań, walidacja | |
| 3 | Pacjenci: kartoteka, PESEL, wypełnianie ankiet przez personel, historia | |
| 4 | Kod QR: jednorazowe tokeny, publiczna ankieta mobilna | |
| 5 | Panel administratora: użytkownicy, role, rejestr operacji | |
| 6 | Kreator formularzy: szkic, publikacja, archiwizacja | |
| 7 | Eksport PDF i CSV | |
| 8 | Statystyki z wykresami | |
| 9 | Domknięcie: testy całej ścieżki, wdrożenie | |
