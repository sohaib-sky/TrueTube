================================================================
  TrueTube
================================================================

A video downloader that runs entirely on this computer.


HOW TO START
----------------------------------------------------------------
1. Double-click  "Start TrueTube.bat"
2. Wait a few seconds - your browser opens automatically
3. Read the address at  http://localhost:5000


HOW TO STOP
----------------------------------------------------------------
Press any key in the small black TrueTube window.

The server keeps running in the background, so this window has to stay
open while you are using the site. Closing it stops the server.


WHAT IS IN THIS FOLDER
----------------------------------------------------------------
  Start TrueTube.bat   Double-click this to run the site
  README.txt           This file
  .env                 Settings
  logs\                server.log - read this if something goes wrong
  .tools\              yt-dlp.exe and ffmpeg.exe - do not delete or move
  server\              The program itself - do not edit

  IMPORTANT: keep the .tools folder next to Start TrueTube.bat.
  Those two .exe files are what actually fetch and process video.
  If they are moved away, the site will show "the yt-dlp binary could
  not be found".


WHAT IT NEEDS
----------------------------------------------------------------
  Node.js   Free, from https://nodejs.org  (the LTS version)

  Nothing else. No internet account, no registration, no key.


TROUBLESHOOTING
----------------------------------------------------------------
  "Node.js is not installed"
      Install it from https://nodejs.org, then run Start TrueTube.bat
      again.

  "The server did not start"
      Open  logs\server.log  - the actual reason is on the last lines.
      The usual cause is another program already using port 5000.

  "the yt-dlp binary could not be found"
      The .tools folder was moved or renamed. Put it back.

  A video will not download, and the page says the platform is
  blocking this server
      That is the website refusing requests from your internet
      connection, not a fault in this program. Some platforms block
      home and datacenter networks. It is intermittent, and it is
      not something this program can or should work around.


A NOTE ON WHAT THIS DOES
----------------------------------------------------------------
It downloads media using yt-dlp. Only download content you own or
have permission to download. That is the user's responsibility, not
the tool's - TrueTube does not check and cannot check for you.
