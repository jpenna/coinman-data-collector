# Coinman

## Account information (USER_DATA)

```json
  {
    "makerCommission": 15,
    "takerCommission": 15,
    "buyerCommission": 0,
    "sellerCommission": 0,
    "canTrade": true,
    "canWithdraw": true,
    "canDeposit": true,
    "updateTime": 123456789,
    "balances": [
      {
        "asset": "BTC",
        "free": "4723846.89208129",
        "locked": "0.00000000"
      },
      {
        "asset": "LTC",
        "free": "4763368.68006011",
        "locked": "0.00000000"
      }
    ]
  }
```

## Kline streams

```json
{
  "e": "kline",           // Event type
  "E": 1530980888131,     // Event time
  "s": "ETHBTC",          // Symbol
  "k": {
    "t": 1530979200000,   // Kline start time
    "T": 1530980999999,   // Kline close time
    "s": "ETHBTC",        // Symbol
    "i": "30m",           // Interval
    "f": 72153943,        // First trade ID
    "L": 72156485,        // Last trade ID
    "o": "0.07121900",    // Open price
    "c": "0.07109600",    // Close price
    "h": "0.07146300",    // High price
    "l": "0.07108000",    // Low price
    "v": "2281.54400000", // Base asset volume
    "n": 2543,            // Number of trades
    "x": false,           // Is this kline the last?
    "q": "162.63694544",  // Quote asset volume
    "V": "995.92300000",  // Taker buy base asset volume
    "Q": "71.03640917",   // Taker buy quote asset volume
    "B": "0"              // Ignore
  }
}
```

## Kline REST

Oldest first, newest last

```json
[
  [
    1499040000000,      // 0 Open time
    "0.01634790",       // 1 Open
    "0.80000000",       // 2 High
    "0.01575800",       // 3 Low
    "0.01577100",       // 4 Close
    "148976.11427815",  // 5 Volume
    1499644799999,      // 6 Close time
    "2434.19055334",    // 7 Quote asset volume
    308,                // 8 Number of trades
    "1756.87402397",    // 9 Taker buy base asset volume
    "28.46694368",      // 10 Taker buy quote asset volume
    "17928899.62484339" // 11 Ignore
  ] 
]
```

# Collector Websoket API

```ts
{
  t <Number // Type
    0: initial,
    1: periodic segment,
  >,
  e <Number
    0: Binance,
  >, // Exchange
  d <Object>, // Data
  err <Error>,
  // ... more info
}
```
