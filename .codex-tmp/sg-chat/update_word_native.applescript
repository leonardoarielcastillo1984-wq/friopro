on run argv
set targetFile to item 1 of argv
set updateText to item 2 of argv
tell application "Microsoft Word"
    set visible to false
    set d to open file name targetFile add to recent files false
    set tr to text object of d
    set ep to end of content of tr
    set nr to create range d start (ep - 1) end (ep - 1)
    insert text ("\r\nACTUALIZACIÓN DEL SISTEMA DE GESTIÓN — 19/08/2026\r\n" & updateText & "\r\n") at nr
    save d
    close d saving yes
end tell
end run
