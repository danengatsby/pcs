# Trezorerie și grup parlamentar

Ambele module folosesc autentificarea nominală cu MFA, profiluri explicite și mandat național activ. Atribuirea unui profil revocă sesiunile existente; titularul se autentifică din nou. Profilurile se atribuie conform [procedurii administrative](admin-security.md). Migrarea 040 adaugă tabele fără să importe sau să publice înregistrări existente.

## Trezorerie — `/admin/treasury`

Profilul `treasury` poate înregistra încasări și cheltuieli în RON, cu categorie, dată, organizație opțională, descriere și referința documentului justificativ. Suma este transmisă ca text zecimal și păstrată în bani întregi. Documentele originale se gestionează în arhiva organizației; acest registru păstrează referința lor.

1. Creează o ciornă și verifică documentul justificativ. Ciorna poate fi modificată.
2. Confirmă explicit suma și documentul pentru includerea în totaluri.
3. O operațiune confirmată rămâne nemodificabilă. Pentru corectare, anuleaz-o cu motiv și introdu o înregistrare nouă. Anularea nu șterge înregistrarea sau istoricul.

Filtrele caută după descriere/document, an, tip și stare. Totalurile includ toate paginile selecției, exclusiv înregistrările confirmate. Indicatorul din meniu numără ciornele care așteaptă verificarea.

Acesta este un registru operațional intern, fără transferuri bancare sau publicare automată. API-ul public de transparență financiară și aprobările sale rămân separate.

## Grup parlamentar — `/admin/parliamentary`

Profilul `parliamentary` poate înregistra inițiative legislative, amendamente, întrebări/interpelări și activități de comisie. Fiecare element include cameră, titlu, descriere, referință oficială, sursă HTTPS opțională, responsabil și termen.

Responsabilii sunt conturi nominale cu profil parlamentar și mandat național activ. Ciornele pot rămâne fără responsabil, însă înregistrarea depunerii necesită responsabil și referință oficială. Registrul consemnează starea activității; nu depune documente în sistemele Parlamentului.

Etapele permise sunt: pregătire → depusă → comisie → ordinea de zi → adoptată/finalizată sau respinsă. Din depusă se poate merge direct la ordinea de zi; de pe ordinea de zi se poate reveni în comisie. Orice etapă deschisă permite retragerea. Schimbarea etapei cere justificare. Înregistrările închise nu mai pot fi modificate.

Filtrele caută după titlu/referință, cameră, etapă și necesitatea de intervenție. Contorul include elementele deschise fără responsabil sau cu termen depășit.

## Concurență și istoric

Crearea folosește un identificator de cerere: repetarea aceleiași cereri nu dublează înregistrarea. Modificările și confirmările trimit versiunea citită; o versiune depășită primește HTTP 409 și trebuie reîncărcată înainte de o nouă decizie. Toate modificările și auditul lor se salvează în aceeași tranzacție.

Istoricul din fiecare fișă arată ultimele 50 de operații, titularul și momentul efectuării, plus motivul anulării sau schimbării de etapă. Operațiile mai vechi rămân în baza de audit. Accesul la auditul general nu acordă acces indirect la conținutul acestor registre.
