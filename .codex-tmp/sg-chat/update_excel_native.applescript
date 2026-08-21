on run argv
set targetFile to item 1 of argv
set updateText to item 2 of argv
tell application "Microsoft Excel"
    set display alerts to false
    set wb to open workbook workbook file name targetFile update links do not update links read only false ignore read only recommended true add to mru false
    set workbook comments of wb to updateText
    save wb
    close wb saving yes
end tell
end run
