#!/bin/sh
rar a -r -hp -x*.env -x*/src/config.js -x*/src/symbols.js -x*state.json -x*.editorconfig -x*.eslintrc.json -x*.gitignore -xna*.log -x*/.vscode -x*/.git -x*/node_modules robot_$(date +%F_%R).rar ./
