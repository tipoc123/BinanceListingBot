# binance_listing

Bot for detecting new coins in the binance exchange and fast taking profit (buy and then sell more expensive). Also it supports email notification.

You must change next lines in the index.js file:
```
const APIKEY = '[YOUR APIKEY]';
const APISECRET = '[YOUR APISECRET]';

var transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: '[your mail]@gmail.com',
    pass: '[password for email]'
  }
});

var mailOptions = {
  from: '[your mail]@gmail.com',
  to: 'email1, email2',
  subject: 'Binance NEW COIN',
  text: 'Added new coin'
};

```

Also you may change to suit your needs:
```
const priceLimit = 0.0001; //in BTC
const deposit = 0.01; //in BTC
...
const sellPrice = price * 1.5;
```
