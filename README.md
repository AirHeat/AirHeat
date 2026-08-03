# AirHeat v0.4.2 – rikiavimas pagal datą

- Klientai rikiuojami pagal paleidimo datą.
- Galima pasirinkti naujausius arba seniausius viršuje.
- Paleidimo data matoma prie kiekvieno kliento.
- Aptarnavimo datos rodomos lietuvišku formatu.

# AirHeat v0.4.1 – Maps pataisymas

Pataisyta klaida, kai klientams be GPS koordinačių Maps/Waze gaudavo `null,null`.
Dabar, jei GPS nėra, navigacijai naudojamas pilnas adresas.

# AirHeat v0.4 – klientų importas

Importuota iš `Paleidimai.xlsx`, pagrindinio lapo `PALEIDIMAI`.

- Klientų / sumontuotos įrangos įrašų: **1095**
- Aptarnavimo ir paleidimo istorijos įrašų: **3617**
- Aktyvi garantija: **609**
- 2 metų garantija: **152**
- Atsisakė garantijos: **3**
- Garantija pasibaigusi: **331**

## Įkėlimas į GitHub

Išarchyvuok ZIP ir į GitHub įkelk visus failus, pakeisdamas senus.
Svarbus naujas failas: `clients-data.js`.

Pirmą kartą atidarius programą, duomenys bus sujungti su jau naršyklėje esančiais įrašais.
Pakartotinai tie patys Excel įrašai nebus dubliuojami.
