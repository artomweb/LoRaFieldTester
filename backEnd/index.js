const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { state } = require("./state");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: true, // Allow dynamic origin determination
  },
});

let devices = {
  Ping: null,
  Pong: null,
};

let testRunning = false;

function sendUpdateToAll() {
  io.emit("statusUpdate", state);
}

io.on("connection", (socket) => {
  socket.emit("statusUpdate", state);

  socket.on("initClient", (data) => {
    console.log("init client");
    console.log(data);
    if (data.device === "ping") {
      state.clientPing.socketID = socket.id;
      devices.Ping = socket;
      return sendUpdateToAll();
    } else if (data.device == "pong") {
      state.clientPong.socketID = socket.id;
      devices.Pong = socket;
      return sendUpdateToAll();
    }

    socket.emit("msg", { type: "error", message: "Invalid device type" });
  });

  socket.on("updateSettings", (data) => {
    state.settings = data.settings;
    sendUpdateToAll();
  });
  socket.on("startTest", () => {
    console.log("start test");
    if (!state.clientPing.socketID) {
      return socket.emit("msg", {
        type: "error",
        message: "No ping device connected",
      });
    }
    if (!state.clientPong.socketID) {
      return socket.emit("msg", {
        type: "error",
        message: "No pong device connected",
      });
    }
    testRunning = true;
    runTest();
  });

  socket.on("stopTest", () => {
    console.log("stop test");
    if (!testRunning) {
      return socket.emit("msg", { type: "error", message: "No test running" });
    }
    testRunning = false; // Set flag to false to stop the test
    // Optionally send a message to clients that the test was stopped
    io.emit("msg", { type: "info", message: "Test stopped" });
  });
  socket.on("updateTestData", (data) => {
    state.testData = data.testData;
    sendUpdateToAll();
  });
  socket.on("disconnect", () => {
    if (state.clientPing.socketID == socket.id) {
      state.clientPing.socketID = null;
      sendUpdateToAll();
    } else if (state.clientPong.socketID == socket.id) {
      state.clientPong.socketID = null;
      sendUpdateToAll();
    }
  });
});

function generateUniqueId() {
  return Math.random().toString(36).substring(2, 9);
}

async function runTest() {
  for (let r = 0; r < state.testData[0].tests.length; r++) {
    for (let i = 0; i < state.testData.length; i++) {
      state.testData[i].tests[r] = { RSSI: "-", SNR: "-", tripTime: "-" };
    }
  }
  sendUpdateToAll();

  for (let r = 0; r < state.testData[0].tests.length; r++) {
    for (let i = 0; i < state.testData.length; i++) {
      if (!testRunning) {
        console.log("Test stopped, exiting...");
        return; // Exit if the test was stopped
      }
      let thisExperiment = state.testData[i];
      let aTimeout = false;
      let uniqueID = generateUniqueId();

      thisExperiment.uniqueID = uniqueID;

      let setParamsPromises = Object.entries(devices).map(
        async ([clientName, thisSocket]) => {
          console.log("This key:", thisSocket.id);
          try {
            await new Promise((resolve, reject) => {
              thisSocket.emit(
                "setYourParams",
                thisExperiment,
                withTimeout(
                  () => {
                    console.log("success!");
                    sendUpdateToAll();
                    resolve(); // Resolve the promise on success
                  },
                  () => {
                    console.log("timeout!");
                    aTimeout = true;
                    reject(); // Reject the promise on timeout
                  },
                  state.settings.setParamTimeout
                )
              );
            });
          } catch (error) {
            // Handle errors if needed
            console.error(
              `Error while setting params for socket ${clientName}: ${error}`
            );
            io.emit("msg", {
              type: "error",
              message: `Error while setting params for socket ${clientName}: ${error}`,
            });
          }
        }
      );

      await Promise.allSettled(setParamsPromises);

      if (aTimeout) {
        // Handle timeout for this set of parameters
        console.error("One or more clients had a timeout, oops..");
        // Optionally, you can broadcast an error to all clients
        return;
      }

      // Retry logic for SEND command
      let sendSuccess = false;
      let attempts = 1;
      while (!sendSuccess && attempts < state.settings.responseTimeoutRepeats) {
        if (!testRunning) {
          console.log("Test stopped, exiting...");
          return; // Exit if the test was stopped
        }
        try {
          await new Promise((resolve, reject) => {
            // Assuming that pingDevice is available on PINGPONG
            devices.Ping.emit(
              "sendPing",
              withTimeout(
                (response) => {
                  console.log("SEND command response from pingDevice");
                  console.log(response);
                  state.testData[i].tests[r].RSSI = response.RSSI;
                  state.testData[i].tests[r].SNR = response.SNR;
                  state.testData[i].tests[r].tripTime = response.tripTime;
                  sendUpdateToAll();
                  resolve();
                },
                () => {
                  console.log(
                    "Timeout while waiting for SEND response from pingDevice"
                  );
                  aTimeout = true;
                  reject();
                },
                state.settings.responseTimeout
              )
            );
          });

          sendSuccess = true; // Exit the loop if the send was successful
          console.log(`Test ${i + 1} completed successfully!`);
        } catch (error) {
          attempts++;
          console.log(`Timeout: ${attempts}:`, error);
        }
      }
      if (attempts >= state.settings.responseTimeoutRepeats) {
        // Alert the user if the max number of attempts was reached
        io.emit("msg", {
          type: "warning",
          message: `Max attempts reached for test ${
            r + 1
          }, test not completed!`,
        });
        console.log(`Max attempts reached for test ${r + 1}.`);
      }
    }
  }
}

const withTimeout = (onSuccess, onTimeout, timeout) => {
  let called = false;

  console.log(`Setting timeout for ${timeout}ms`);
  const timer = setTimeout(() => {
    if (called) return;
    console.log("Timeout triggered");
    called = true;
    if (testRunning) {
      onTimeout();
    }
  }, timeout);

  return (...args) => {
    if (called) return;
    console.log("Clearing timeout, success triggered");
    called = true;
    clearTimeout(timer);
    onSuccess.apply(this, args);
  };
};

server.listen(4000, () => {
  console.log("Server is running on http://localhost:4000");
});
