# Opiskelijaravintolat

Vanilla JS -web-sovellus, joka näyttää opiskelijaravintolat ja niiden päivä- ja viikkoruokalistat
(Metropolian Restaurant REST API).

## Ominaisuudet
- Ravintolalista, päivän/viikon ruokalista, suomi/englanti
- Suodatus kaupungin ja palveluntarjoajan mukaan sekä tekstihaku
- Rekisteröityminen, kirjautuminen (token säilyy localStoragessa)
- Suosikkiravintola, tietojen päivitys, profiilikuva
- Ravintolat kartalla (Leaflet + OpenStreetMap)
- Lähin ravintola korostettu (selaimen Geolocation)

## Ajaminen
ES-moduulit vaativat palvelimen: `npx serve .` tai `python3 -m http.server`.
