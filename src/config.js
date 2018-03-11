'use strict';

let config = {};

config.interval = 10000; // value in ms between iterations, sleep time
config.candleInterval1 = '1h'; // candle size for first buy check
config.candleInterval2 = '30m'; // candle size for second buy check
config.candleInterval3 = '15m'; // candle size for third buy check
config.candleInterval4 = '2h'; // candle size for 4th buy check
config.calcValues = 3; // how many indications should be calculated
config.isTestSellOrder = false; // submit an order using test endpoint
config.isTestBuyOrder = false; // submit an order using test endpoint
config.buyCoefficient = 1.0002; // green should be higher by 0.02%
config.sellCoefficient = 1.0002; // red should be higher by 0.02%
// config.hodlBought = 600000; // how many ms hodl since buying the bought coin and ignore the sell signal
config.buySignalIsValid = 10000; // how many ms the buy signal is valid; could be set to 0 to prevent any buy
config.stateValidity = 300000; // how many ms the stored state is valid, if not valid the state will be reset ({})
config.acceptedLoss = 2; // percentage of allowable less when placing the stop-loss order
config.limitAcceptedLoss = 0.1; // calculated from acceptedLoss
config.hodlCoef = 1.009; // the last close price should be at least 1 percent higher than bought price
config.moveCandleInterval = '15m';
config.moveAcceptedLoss = 0.8; // percentage of allowable less when moving the stop-loss order
config.moveLimitAcceptedLoss = 0.2; // calculated from moveAcceptedLoss

module.exports = config;
