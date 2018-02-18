#!/bin/sh
rar a -r -hp -x*.env -x*state.json -x*state.json -x*.editorconfig -x*.eslintrc.json -x*.gitignore -x*.log -x*/.vscode -x*/.git -x*/node_modules -x*/src/symbols.js robot_$(date +%F_%R).rar ./
