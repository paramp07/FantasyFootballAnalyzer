- make the timer in the draft start whatever the first clock seconds is and count down and repeatidly check the clock seconds to make sure it is synced. 
- update the team draft pick in the database and update the draft order in the database and update the draft picks table in the database if this isnt already a thing.
- also if the draft data is not coming in for 2 mins and the last pick is at team 12, the draft is most likely over and that the user forgot to input the correct number of rounds in the draft. if this happens, open a modal and ask if the user wants to end the draft. if they do, update the database to end the draft and update nubmer of rounds and then close the modal. 
- set the defualt format of all drafts as 1qb 2rb 2wr 1flex 1te 1def 1kicker 6 bench ppr
- remove the " ESPN Live Draft Sync ReadyLaunch the live draft room to sync picks automatically via your extension.
Open Live Draft →" message
- remove the "Drafting Right Now?
Launch the Live Draft Board directly to auto-sync picks from ESPN, Yahoo, or Sleeper." message too
- move the "saved draft found" message below presets and above start mock draft
- make the defualt option in the draft room mode be live draft analysis
- for this message: "Live sync stopped: No Sleeper draft found for this league yet." this is bad cause there could also be a espn draft but you are only talking about sleepr. be like no draft found dont be specific to a platform. adn if this msg does pop up, do a play error sound
- for the start mock draft button, if the option selected was "draft analysis" make the button say "start analysis"
- for the extension, name it "FFA - Helper" and make the icon same as the app icon. also make it follow the design md. and instead of open war room, do open draft anaylsis. also get rid of the "Backend localhost Sign-in not needed" stuff. and instead add a status line saying if its communicating to the web socket. and get rid of the spn + yahoo sync stuff. redesign the ui as a whole as you see fit following the design md. also for the button that the extension injects onto the espn page, make it follow design md as well and make it say "open ffa" in all caps. and also make it so if i hover over it, im able to see the same tooltip as the popup for websocket connection.
- in the draft board  in the boardp layer selection or viewer, if a player on that same team has the same bye week as the player whose been selected, add a yellow box next to their name with the letter B. kind of like the questionable injruy status some players have. the questionable injruy status box should always have priority and always closest to the name and then the bye week indicator should be next to it if there is one.




newer
- in the rankings page make it so users cant do duplicate presets meaning duplciate rankings. if that happens, play error message and thats it. also fix the thing where whn i clikc anotehr rankings preset, the selection still says consesns default and doesnt change to the correct name preset. fix that. and also fix the naming scheme for custom presets so instead of a date it does preset #1, preset #2, etc. and also add a colorless edit icon next to the name of the preset if the user hovers over it so the user can delete or rename. basically when the user clicks edit, the edit icon turns into a save icon and a delete icon is next to it. and the user while in the edit phase can click the presrt name text and rename it. and if they click delete, it deletes the preset. and if they click the save icon, it saves the changes and turns the edit icon back into a normal icon. for the icons use white colorless simple lucide react icons.
- make it so the user can download the current preset. make the download rankings button be next to save current.
- and instead of fp rank make it ffa rank since that is our own app rankigns and fp stands for fantasypros which we sdont care about and is useless if we edit their own rankigns.

