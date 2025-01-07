#include <LoRa.h>
#include <SimpleWebSerial.h>

SimpleWebSerial WebSerial;

const int MIN_BW = 7800;
const int MAX_BW = 500000;
const int MIN_SF = 6;
const int MAX_SF = 12;
const int MIN_TX = 2;
const int MAX_TX = 20;

struct AckStatus {
  bool received = true;  // Initialize to true for the initial packet
  unsigned long lastAttemptTime;
  char uniqueId[8];  // Fixed-length array for 8 characters + null terminator
};

AckStatus ackStatus;

struct PingPacket {
  char type = 'i';
  char uniqueId[8];  // Fixed-length array for 8 characters + null terminator
};

PingPacket currentPing;
PingPacket lastPong;

struct Params {
  int BW = 125000;
  int SF = 7;
  int CR = 5;
  int TX = 17;
};

Params currentParams;

void setup() {
  Serial.begin(57600);

  WebSerial.on("ready", respondToReady);
  WebSerial.on("setupParams", setupParams);
  WebSerial.on("sendPing", sendPing);

  if (!LoRa.begin(868E6)) {
    Serial.println("Starting LoRa failed!");
    while (1)
      ;
  }
}

void loop() {
  WebSerial.check();
  onReceive(LoRa.parsePacket());
}

void respondToReady(JSONVar param) {
  WebSerial.sendEvent("ready");
}

void setupParams(JSONVar jsParams) {
  currentParams.BW = jsParams["BW"];
  currentParams.SF = jsParams["SF"];
  currentParams.TX = jsParams["TX"];

  if (!validateParams(currentParams)) {
    WebSerial.error("Parameter error");
    return;
  }

  LoRa.setSignalBandwidth(currentParams.BW);
  LoRa.setSpreadingFactor(currentParams.SF);
  LoRa.setTxPower(currentParams.TX);

  // Set the uniqueId in AckStatus
  strncpy(ackStatus.uniqueId, jsParams["uniqueID"], sizeof(ackStatus.uniqueId) - 1);
  ackStatus.uniqueId[sizeof(ackStatus.uniqueId) - 1] = '\0';  // Ensure null termination

  WebSerial.log(ackStatus.uniqueId);
  WebSerial.send("paramsSet", jsParams);
}

void sendPing(JSONVar param) {
  generatePing(); 
  sendPingLoRa(currentPing);
}

void generatePing() {
  currentPing.type = 'i';
  strncpy(currentPing.uniqueId, ackStatus.uniqueId, sizeof(currentPing.uniqueId) - 1);
  ackStatus.received = false;
  ackStatus.lastAttemptTime = micros();

  // Log to confirm if uniqueId is properly copied
  WebSerial.log("UniqueID");
  WebSerial.log(ackStatus.uniqueId);
}

void sendPingLoRa(const PingPacket &packet) {
  WebSerial.log("Sending packet....");

  LoRa.beginPacket();
  LoRa.write((uint8_t *)&packet, sizeof(packet));  // Send the entire packet structure
  LoRa.endPacket();

  ackStatus.lastAttemptTime = micros();
}

void sendPong(PingPacket pngPacket) {
  LoRa.beginPacket();
  LoRa.write((uint8_t *)&pngPacket, sizeof(pngPacket));
  LoRa.endPacket();
}

void onReceive(int packetSize) {
  if (packetSize == 0) return;  // If there is no packet

  WebSerial.warn("RECEIVED SOMETHING");

  if (packetSize == sizeof(PingPacket)) {
    WebSerial.warn("Correct Size");

    PingPacket aPacket;
    LoRa.readBytes((uint8_t *)&aPacket, packetSize);

    // Ensure the packet matches the current uniqueId
    if (strncmp(aPacket.uniqueId, ackStatus.uniqueId, 9) != 0) {
      WebSerial.warn("Received packet does not match current uniqueId");
      WebSerial.log(ackStatus.uniqueId);  // Log the actual uniqueId (as a string)
      WebSerial.log(aPacket.uniqueId);    // Log the received uniqueId (as a string)
      return;
    }

    if (aPacket.type == 'i') {
      WebSerial.warn("RECEIVED A PING PACKET");
      aPacket.type = 'o';  // Change type to 'o' (pong)
      sendPong(aPacket);
    } else if (aPacket.type == 'o') {
      WebSerial.warn("RECEIVED A PONG PACKET");

      ackStatus.received = true;
      lastPong = aPacket;

      unsigned long packetReceivedAt = micros();
      unsigned long tripTime = packetReceivedAt - ackStatus.lastAttemptTime;

      int RSSI = LoRa.packetRssi();
      float SNR = LoRa.packetSnr();

      JSONVar responseObj;
      responseObj["uniqueId"] = String(ackStatus.uniqueId);
      responseObj["RSSI"] = RSSI;
      responseObj["SNR"] = SNR;
      responseObj["tripTime"] = tripTime;

      WebSerial.send("pongReceived", responseObj);
    }
  }
}

bool validateParams(const Params &params) {
  if (params.BW < MIN_BW || params.BW > MAX_BW) {
    WebSerial.log("Error: bandwidth is outside the range of 7800 to 500000.");
    return false;
  }

  if (params.SF < MIN_SF || params.SF > MAX_SF) {
    WebSerial.log("Error: SF is outside the range of 6 to 12.");
    return false;
  }

  if (params.TX < MIN_TX || params.TX > MAX_TX) {
    WebSerial.log("Error: TXPower is outside the range of 2 to 20.");
    return false;
  }

  return true;
}
