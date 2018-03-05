var request = require('request');
const crypto = require('crypto');
var nodemailer = require('nodemailer');

const APIKEY = '[YOUR APIKEY]';
const APISECRET = '[YOUR APISECRET]';

var transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: '[your mail]@gmail.com',
    pass: '[pass to email]'
  }
});

var mailOptions = {
  from: '[your mail]@gmail.com',
  to: 'email1, email2',
  subject: 'Binance NEW COIN',
  text: 'Added new coin'
};

var oldTradingPairs = [];
const priceLimit = 0.0001; //in BTC
const deposit = 0.01; //in BTC

function sendEmail(symbol) {
  mailOptions.subject = 'Binance NEW COIN ' + symbol;
  transporter.sendMail(mailOptions, function(error, info){
    if (error) {
      console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });
}

const signedRequest = function(url, data, callback, method = 'POST') {
  let query = Object.keys(data).reduce(function(a,k){
    a.push(k+'='+encodeURIComponent(data[k]));
    return a
  },[]).join('&');

  let signature = crypto.createHmac('sha256', APISECRET).update(query).digest('hex'); // set the HMAC hash header
  console.log(url+'?'+query+'&signature='+signature);
  let opt = {
    url: url+'?'+query+'&signature='+signature,
    method: method,
    headers: {
      'Content-type': 'application/x-www-form-urlencoded',
      'X-MBX-APIKEY': APIKEY
    }
  };
  request(opt, function(error, response, body) {
    callback(error, response, body);
  });
};

function getTradingPairs() {
  console.log("\nREQUEST exchangeInfo...");
  request('https://api.binance.com/api/v1/exchangeInfo', function (error, response, body) {
    console.log("REQUEST exchangeInfo OK");
    console.log('error:', error);
    console.log('statusCode:', response && response.statusCode);

    var parsedBody = {};
    try {
      parsedBody = JSON.parse(body);
    } catch (err) {
      console.log(err);
      setTimeout(getTradingPairs, 1000);
      return;
    }
    const symbols = parsedBody.symbols;

    console.log("symbols.length="+symbols.length);
    var tradingPairs = [];
    for (var i = 0; i < symbols.length; i++) {
      const symbolObject = symbols[i];

      if (symbolObject.status == 'TRADING') {
        tradingPairs.push(symbolObject);
      }
    }
    console.log("tradingPairs.length="+tradingPairs.length);

    if (oldTradingPairs.length == 0) {
      oldTradingPairs = tradingPairs;
      console.log("oldTradingPairs.length="+oldTradingPairs.length+" before");
      //oldTradingPairs.pop(); //todo: only for test
      //oldTradingPairs.pop(); //todo: only for test
      console.log("oldTradingPairs.length="+oldTradingPairs.length+" after");

      setTimeout(getTradingPairs, 1000);
    } else {
      var newPairs = [];
      for (var k = 0; k < tradingPairs.length; k++) {
        const tradingPair = tradingPairs[k];

        var found = false;
        for (var j = 0; j < oldTradingPairs.length; j++) {
          if (oldTradingPairs[j].symbol == tradingPair.symbol) {
            found = true;
            break;
          }
        }

        if (!found) {
          newPairs.push(tradingPair);
        }
      }

      oldTradingPairs = tradingPairs;

      if (newPairs.length == 0) {
        setTimeout(getTradingPairs, 1000);
      } else {
        var map = [];
        for (var i = 0; i < newPairs.length; i++) {
          var newPair = newPairs[i];

          var quotes = map[newPair.baseAsset];
          if (quotes === undefined) {
            quotes = [];
            map[newPair.baseAsset] = quotes;
          }
          quotes.push(newPair.quoteAsset);
        }

        console.log("newPairs.length="+newPairs.length);
        console.log(map);

        for (var key in map) {
          var quotes = map[key];

          if (quotes.indexOf('BTC') >= 0/* && quotes.indexOf('ETH') >= 0*/) {
            console.log('detected for ' + key);
            getAsks(key + 'BTC');
            //getAsks('TRXETH');
            //sendEmail(key + 'ETH');
            break;
          }
        }
      }
    }
  });
}

getTradingPairs();

function getAsks(symbol) {
  console.log("\nREQUEST depth...");
  request('https://api.binance.com/api/v1/depth?symbol='+symbol, function (error, response, body) {
    console.log("REQUEST depth OK");
    console.log('error:', error);
    console.log('statusCode:', response && response.statusCode);

    const parsedBody = JSON.parse(body);
    const asks = parsedBody.asks;
    if (asks.length == 0) {
      console.log("asks.length = 0");
      return;
    }
    if (asks[0][0] > priceLimit) {
      console.log(asks[0][0] + " BTC > " + priceLimit + " BTC");
      return;
    }

    var totalSum = 0;
    var totalQuantity = 0;
    for (var i = 0; i < asks.length; i++) {
      const ask = asks[i];
      console.log(ask);

      const price = ask[0];    //in BTC
      const quantity = ask[1]; //in coins

      //console.log("sum="+sum+" deposit="+deposit);
      if ((totalSum + price * quantity) >= deposit) {
        const currentQuantity = (deposit - totalSum) / price;
        buyMarket(symbol, parseInt(totalQuantity + currentQuantity), price);
        break;
      }

      totalSum += price * quantity;
      totalQuantity += quantity;
    }
  });
}

function buyMarket(symbol, quantity, price) {
  console.log("\nREQUEST buy market...");
  const timestamp = new Date().getTime();
  signedRequest('https://api.binance.com/api/v3/order',
    {'symbol':symbol, 'side': 'BUY', 'type': 'MARKET', 'quantity': quantity, 'timestamp': timestamp},
    function (error, response, body) {
      console.log("REQUEST buy market OK");
      console.log('error:', error);
      console.log('statusCode:', response && response.statusCode);
      console.log(body);

      const parsedBody = JSON.parse(body);
      sellLimit(symbol, parsedBody.executedQty, price);
  });
}

function sellLimit(symbol, quantity, price) {
  console.log("\nREQUEST sell limit...");
  const timestamp = new Date().getTime();
  const sellPrice = price * 1.5;
  signedRequest('https://api.binance.com/api/v3/order',
    {'symbol':symbol, 'side': 'SELL', 'type': 'LIMIT', 'quantity': quantity, 'timestamp': timestamp, 'price': sellPrice, 'timeInForce': 'GTC'},
    function (error, response, body) {
      console.log("REQUEST sell limit OK");
      console.log('error:', error);
      console.log('statusCode:', response && response.statusCode);
      console.log(body);

      sendEmail(symbol);
    }
  );
}
