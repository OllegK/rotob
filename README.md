# Installation

## Install node.js
Download and install node.js - [https://nodejs.org/en/download/]

## check npm is running
Type npm at command prompt to ensure that paths are updated (No issue with that on Linux, not sure about Windows - maybe PATH should be updated manually or restart will be needed?)

## unpack archive file
Unpack the archive to some folder and navigate to desination folder

## update .env file
Update .env file
1) You can keep the same bot id, or create your own bot
2) Update the CHAT_ID value. 

To find your own CHAT_ID, send a message to Traduzir_bot, and navigate to [https://api.telegram.org/bot437516306:AAEusnPwYEWnBWPmHyhiSN3tuOcuThG_4fQ/getUpdates]

Current value of chat id is my contact, so don't run it with that value.

Our chat id  -314588186
My contact    384438001

3) API_KEY and API_SECRET_KEY - should be changed, current values are mine, don't run with them; otherwise you can destroy my balance :)

## Download the needed modules
Execute at command prompt
npm install --only=production

## Change the settings if needed
Change the settings in robot.js if needed
``` javascript
let interval = 60000; // value in ms between iterations, sleep time
let candleInterval1 = '1h'; // candle size for first buy check
let candleInterval2 = '1h'; // candle size for second buy check
let calcValues = 2; // how many indications should be calculated
let isTestSellOrder = false; // submit an order using test endpoint
let isTestBuyOrder = false; // submit an order using test endpoint
let buyCoefficient = 1.0002; // green should be higher by 0.02%
let sellCoefficient = 1.0002; // red should be higher by 0.02%
let hodlBought = 600000; // how many ms hodl since buying the bought coin and ignore the sell signal
let buySignalIsValid = 10000; // how many ms the buy signal is valid; could be set to 0 to prevent any buy
let stateValidity = 300000; // how many ms the stored state is valid, if not valid the state will be reset ({})
let placeStopLoss = true; // please stop-loss order when bought
let acceptedLoss = 2; // percentage of allowable less when placing the stop-loss order
let limitAcceptedLoss = 5; // calculated from acceptedLoss
```

There are also hardcoded coefficient in calcIndicators.js, check that there is 5% difference between values (in future versions will be parametrized)
``` javascript
var isBuy = function (red, green) {
  return (

    (red[red.length - 1] > green[green.length - 1])
    && (red[0] < green[0])
    && (green[0] / red[0] > 1.005)
  );
};

var isSell = function (red, green) {
  return (
    (red[0] > green[0])
    && (red[0] / green[0] > 1.005)
  );
};
```

## Run robot
Execute at command prompt
npm start

Robot is fully functional, so if you have BTC balance, it will try to place the orders or sell your coins if sell indicator is met. Honestly I don't test with the positive balance yet. For now you can run it with zero balance, in this case you will be annoyed with repeating signals. 

Timestamps are in GMT

Symbols to be traded are in ./src/symbols.js file
State is saved into ./state.json 

# Error handling
In case of error, the robot terminates its execution. This behavior will be changed in future versions.

# Known issues
Sometime trying to create the order, binance responds with error "Timestamp for this request is outside of the recvWindow". Seems this window is 5 seconds by default, and not sure why does it happen. Possible workaround: increase the window in input parameters, if this issue is annoying (planned for release 0.2) 

# Roadmap
## Current release is 0.2
PREPARATION FOR DEPLOYMENT
## Release 0.3
0) Error handling continious improvement, save state.
1) Moveable stop-loss (Denis' zagogulina).
## Future possible improvements
0) Analyze the amount of signals during the period (24h), and don't buy if it is гармошка.
1) Diversification and full investment of the available deposit (find all possible pairs and split deposit between them).
2) Bot asks if coin should be sold/bought.
3) (можно позже прикрутить) чтобы если он на одной паре делает покупки продажи часто, например каждый час, если мы на часовике, то покупки по этой паре на какое-то время игнорирует
4) Notification flag on the pair
5) Sell indicator not by just the values, but by crossing the values as it is done for buy signal (??)
6) {code: -2010, msg: "Account has insufficient balance for request action"} - now it is just applied 0.95 to balance
7) Take into the account the exchange fee calculating the price of stop loss
8) crossing could happen when both indicators are in down trend (rarely)
9) https://api.binance.com/wapi/v3/systemStatus.html
10) Have the acceptable errors for REST calling
11) Write LOG file for each pair
12) Check the status of pair in getExchangeInfo - TRADING OR NOT? Invalidate Exchange Info
13) no trades on weekend?
14) Check 3 intervals
