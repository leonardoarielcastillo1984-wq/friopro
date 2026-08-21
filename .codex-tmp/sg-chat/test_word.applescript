on run argv
set targetFile to item 1 of argv
tell application "Microsoft Word"
    set visible to false
    set d to open file name targetFile add to recent files false
    set tr to text object of d
    set ep to end of content of tr
    set nr to create range d start (ep - 1) end (ep - 1)
    insert text "\r\nACTUALIZACIÓN DEL SISTEMA DE GESTIÓN — 19/08/2026\r\nLa competencia deberá determinarse, desarrollarse y evaluarse en función de los requisitos del puesto, el desempeño, los riesgos y su impacto sobre la calidad y seguridad del producto. Se conservarán evidencias de evaluación, retroalimentación, acciones de desarrollo y verificación de eficacia. Referencias: ISO 9001:2015 7.2, 7.3 y 9.1; IATF 16949 7.2.1–7.3.2.\r\n" at nr
    save d
    close d saving yes
end tell
end run
