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
let interval = 10000; // value in ms between iterations, sleep time
let candleInterval1 = '5m'; // candle size for first buy check
let candleInterval2 = '15m'; // candle size for second buy check
let candleInterval3 = '1h'; // candle size for second buy check
let calcValues = 2; // how many indications should be calculated
let isTestSellOrder = true; // submit an order using test endpoint
let isTestBuyOrder = true; // submit an order using test endpoint
let buyCoefficient = 1.0002; // green should be higher by 0.02%
let sellCoefficient = 1.0002; // red should be higher by 0.02%
let hodlBought = 600000; // how many ms hodl since buying the bought coin and ignore the sell signal
// too short could cause the buy signal ignoring? VVV
let buySignalIsValid = 10000; // how many ms the buy signal is valid; could be set to 0 to prevent any buy
let stateValidity = 300000; // how many ms the stored state is valid, if not valid the state will be reset ({})
let placeStopLoss = true; // please stop-loss order when bought
let acceptedLoss = 1; // percentage of allowable less when placing the stop-loss order
let limitAcceptedLoss = 2; // calculated from acceptedLoss

let holdCoef = 1.01; // the last close price should be at least 1 percent higher than bought price
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

Timestamps are in GMT

Symbols to be traded are in ./src/symbols.js file
State is saved into ./state.json 

# What's new
## 0.2.1
1. Rolling the log-files (10M).
2. The last close price is used to check if hodl coin could be sold (instead of green price), and also the last close price is used to calculate how many coin could be bought.
3. Added 3rd candleinterval (so bought signal could be confirmed by two additional checks). This check also done applying coefficient hodlCoef to get the minimal return.
4. Balances are checked before starting each iteration.
5. The amount to spent will not be lower than min notional to be able to place the stop loss order.
# 0.2.1.1
1. Fixed bug when locked balance is not checked before taking a buy decission
# 0.2.1.2
1. Check the server time to adjust the time difference between server and client
2. Fixed bug when state is erased in case of exitting almost immediately after start
# 0.2.1.3
1. First version of moveable stop loss order
# 0.2.1.4
1. Using mongo client for saving the state
# 0.2.1.5
1. Small correction in algorithm: moving conditions are checked even in case of sell signal presense (if not sold). 
2. Small bugfixing and adjustments for deployment to Heroku.
# 0.2.2
1. Separate parameters (moveAcceptedLoss and moveLimitAcceptedLoss) for placing the moved stop-loss order.
2. Ingoring the not convertible minor balances when taking a decission to buy, earlier versions didn't buy a coin in such cases.
3. Introducing telegram polite messages.
# Roadmap
## TODO
PREPARATION FOR DEPLOYMENT
## Release 0.3
0) Moveable stop-loss (Denis' zagogulina, crossing the falling candle).
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
14) if there is a balance, robot never buys?
15) DON'T SELL IF NOT BOUGHT - CHECK QUANTITY
16) WSS to learn that cancel order is processed
17) moving order what happens when moved order is partially fillled and doesn't meet MIN_NOTION condition
18) Provide the invalidate procedure when intervals are changed in parameters
