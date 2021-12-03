cd ..
bash scripts/StartTurn.sh &
node http-server test/ &
node signal.js