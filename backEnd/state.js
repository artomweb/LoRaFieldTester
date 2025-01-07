let state = {
  clientPing: {
    socketID: null,
  },
  clientPong: {
    socketID: null,
  },
  GPS: {
    socketID: null,
  },
  testData: [
    {
      BW: "7.80E+03",
      SF: 7,
      TX: 2,
      tests: [
        {
          RSSI: "-",
          SNR: "-",
          tripTime: "-",
        },
        {
          RSSI: "-",
          SNR: "-",
          tripTime: "-",
        },
        {
          RSSI: "-",
          SNR: "-",
          tripTime: "-",
        },
      ],
    },
    {
      BW: "7.80E+03",
      SF: 7,
      TX: 11,
      tests: [
        {
          RSSI: "-",
          SNR: "-",
          tripTime: "-",
        },
        {
          RSSI: "-",
          SNR: "-",
          tripTime: "-",
        },
        {
          RSSI: "-",
          SNR: "-",
          tripTime: "-",
        },
      ],
    },
    {
      BW: "5.00E+05",
      SF: 9,
      TX: 2,
      tests: [
        {
          RSSI: "-",
          SNR: "-",
          tripTime: "-",
        },
        {
          RSSI: "-",
          SNR: "-",
          tripTime: "-",
        },
        {
          RSSI: "-",
          SNR: "-",
          tripTime: "-",
        },
      ],
    },
    {
      BW: "5.00E+05",
      SF: 9,
      TX: 11,
      tests: [
        {
          RSSI: "-",
          SNR: "-",
          tripTime: "-",
        },
        {
          RSSI: "-",
          SNR: "-",
          tripTime: "-",
        },
        {
          RSSI: "-",
          SNR: "-",
          tripTime: "-",
        },
      ],
    },
  ],

  settings: {
    setParamTimeout: 5000,
    responseTimeout: 5000,
    responseTimeoutRepeats: 2,
  },
};
exports.state = state;
