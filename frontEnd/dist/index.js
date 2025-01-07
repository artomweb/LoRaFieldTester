if (
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname === "localhost"
) {
  apiURL = "http://localhost:4000";
} else {
  apiURL = "https://api.artomweb.com/lora";
}

function state() {
  return {
    state: {
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
          SF: 12,
          TX: 20,
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
          SF: 7,
          TX: 20,
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
          SF: 12,
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
      ],

      settings: {
        setParamTimeout: 5000,
        responseTimeout: 5000,
        responseTimeoutRepeats: 3,
      },
    },

    socket: null,
    MKRConnection: null,
    MKRConnectionTimout: null,
    MKRTYPE: null,
    paramsCallbackSET: null,
    receivedPongCallbackSET: null,
    currentPendingPacket: null,

    init() {
      this.paramsCallbackSET = new Map();
      this.receivedPongCallbackSET = new Map();

      this.socket = io(apiURL, {
        reconnectionDelay: 5000,
      });

      this.socket.on("connect_error", (err) => {
        // createToast("error", "Failed to connect to server");
        // console.log(`connect_error due to ${err.message}`);
      });

      this.socket.on("connect", () => {
        console.log(this.socket.id);
      });

      this.socket.on("statusUpdate", (data) => {
        console.log("status update: ", data);

        this.state = data;
      });
      this.socket.on("setYourParams", (data, callback) => {
        const uniqueId = data.uniqueID;
        this.currentPendingPacket = uniqueId;
        console.group("New Params: " + uniqueId);
        console.log("Received request to set my params: ", data);

        const params = Object.fromEntries(
          Object.entries(data).map(([key, value]) => [key, value])
        );

        console.log(uniqueId, params);

        this.paramsCallbackSET.set(uniqueId, callback);
        this.MKRConnection.send("setupParams", { ...params, uniqueId });
        console.log("Sent param set command to MKR");
        // callback({ status: "ok" });
      });

      this.socket.on("msg", (data) => {
        createToast(data.type, data.message);
      });

      this.socket.on("sendPing", (callback) => {
        console.log("Request to send a ping packet");

        this.receivedPongCallbackSET.set(this.currentPendingPacket, callback);

        this.MKRConnection.sendEvent("sendPing");
      });

      this.MKRConnection = SimpleWebSerial.setupSerialConnection();

      this.MKRConnection.on("ready", () => {
        createToast("success", "Connected to MKR");
        clearTimeout(this.MKRReadyTimout);
        this.socket.emit("initClient", { device: this.MKRTYPE });
      });

      this.MKRConnection.on("paramsSet", (data) => {
        // Retrieve the callback associated with the "SEND" event
        // console.log("paramsSet", data);
        const callback = this.paramsCallbackSET.get(data.uniqueId);

        if (callback) {
          console.warn(
            "MKR has sucessfully set the params (callback received)"
          );
          // console.log("Received paramsSet from Arduino:", data);
          console.groupEnd();
          // return data to server
          callback({ status: "ok" });
          // Remove the callback from the map
          this.paramsCallbackSET.delete(data.uniqueId);
        }
      });

      this.MKRConnection.on("pongReceived", (data) => {
        // Retrieve the callback associated with the "SEND" event
        console.log("pongReceived", data);
        if (data.uniqueId !== this.currentPendingPacket) {
          return console.log("received packet with wrong id");
        }
        const callback = this.receivedPongCallbackSET.get(data.uniqueId);

        if (callback) {
          console.log("Received pong from Arduino:", data);

          // return data to server
          callback(data);
          // Remove the callback from the map
          this.receivedPongCallbackSET.delete(data.uniqueId);
        }
      });

      this.MKRConnection.on("log", (data) => {
        console.log(data);
      });

      this.MKRConnection.on("error", (data) => {
        console.error(data);
      });

      console.log(this.MKRConnection);

      document.addEventListener("DOMContentLoaded", () => {
        editableTable.addEventListener(
          "paste",
          this.updateTablePaste.bind(this)
        );
      });
    },

    updateSettings() {
      this.socket.emit("updateSettings", { settings: this.state.settings });
      console.log(this.state.settings);
    },

    updateTablePaste(e) {
      e.preventDefault();

      let testData = pasteDataToObject(e);

      console.log(testData);

      this.socket.emit("updateTestData", { testData });
    },

    async connectClient(device) {
      console.log(device);
      this.MKRTYPE = device;

      try {
        await this.MKRConnection.startConnection();
        this.MKRConnection.sendEvent("ready");
        this.MKRReadyTimout = setTimeout(this.showNoMKRConnection, 8000);
      } catch (e) {
        console.log(e);
        createToast("warning", "MKR failed to connect " + e);
      }
      // this.socket.emit("initMKR");
    },

    startTest() {
      console.log("START TEST");
      this.socket.emit("startTest");
    },

    stopTest() {
      console.log("STOP TEST");
      this.socket.emit("stopTest");
    },

    showNoMKRConnection() {
      createToast("error", "MKR no reply, reload to try again");
      // this.MKRConnection = SimpleWebSerial.setupSerialConnection();
    },

    connectGPS() {
      console.log("gps connected");
      this.state.GPS.connected = true;
      this.GPS.myDevice = false;
    },

    copyResults() {
      let output =
        "BW\tSF\tTX\tRSSI\tSNR\tTripTime\tRSSI\tSNR\tTripTime\tRSSI\tSNR\tTripTime\n";
      for (let i = 0; i < this.state.testData.length; i++) {
        let thisExp = this.state.testData[i];
        output += thisExp.BW + "\t" + thisExp.SF + "\t" + thisExp.TX + "\t";
        for (let j = 0; j < thisExp.tests.length; j++) {
          let thisTest = thisExp.tests[j];
          output +=
            thisTest.RSSI +
            "\t" +
            thisTest.SNR +
            "\t" +
            thisTest.tripTime +
            "\t";
        }
        output += "\n";
      }

      console.log(output);
      navigator.clipboard.writeText(output);
      createToast("success", "Results copied to clipboard");
    },
  };
}

function pasteDataToObject(e) {
  // Clear current table content
  console.log("paste event");

  const clipboardData = e.clipboardData;
  const pastedData = clipboardData.getData("text");

  // Remove vertical lines and trim whitespace
  const cleanedData = pastedData.replace(/[\|-]/gm, "").trim();

  // Split data into rows based on newline characters
  const rows = cleanedData.split("\n");

  let testDataTemp = [];
  rows.forEach((row) => {
    // Split row into cells based on tabs
    const cells = row.trim().split(/\s+/);
    if (cells.length < 3) return;

    testDataTemp.push({
      BW: cells[0].trim(),
      SF: cells[1].trim(),
      TX: cells[2].trim(),
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
    });
  });

  return testDataTemp;
}
