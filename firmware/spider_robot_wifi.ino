// ═══════════════════════════════════════════════════════════════════════
// Spider Robot — ESP32 WiFi Live Controller
// 12-Servo Quadruped • Access Point • HTTP API • Live Calibration
//
// Libraries: Servo (built-in), ArduinoJson, Preferences (built-in)
//
// Open http://192.168.4.1 after connecting to WiFi "SpiderRobot"
// Calibration (reverse + trim) is saved to flash — survives reboots.
// ═══════════════════════════════════════════════════════════════════════

#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include <Servo.h>
#include <Preferences.h>

const char* AP_SSID     = "SpiderRobot";
const char* AP_PASSWORD = "12345678";

const int SERVO_PINS[12] = {
    23, 22, 21,   // FL: hip, shoulder, knee
    19, 18,  5,   // FR: hip, shoulder, knee
    17, 16,  4,   // BL: hip, shoulder, knee
     2, 15,  0    // BR: hip, shoulder, knee
};

const char* LEG_NAMES[4]   = { "FL", "FR", "BL", "BR" };
const char* JOINT_NAMES[3] = { "hip", "shoulder", "knee" };

// ── Globals ────────────────────────────────────────────────────────────
Servo servos[12];
int currentAngles[12];       // logical angle (what the app/user set)
int servoReverse[12];        // 0 = normal, 1 = reversed
int servoTrim[12];           // offset -45 to +45 degrees
Preferences prefs;
WebServer server(80);

// ── Calibration persistence ────────────────────────────────────────────

void loadCalibration() {
    prefs.begin("cal", true);  // read-only
    for (int i = 0; i < 12; i++) {
        char keyR[8], keyT[8];
        sprintf(keyR, "r%d", i);
        sprintf(keyT, "t%d", i);
        servoReverse[i] = prefs.getInt(keyR, 0);
        servoTrim[i]    = prefs.getInt(keyT, 0);
    }
    prefs.end();
    Serial.println("Calibration loaded from flash");
}

void saveCalibration() {
    prefs.begin("cal", false);  // read-write
    for (int i = 0; i < 12; i++) {
        char keyR[8], keyT[8];
        sprintf(keyR, "r%d", i);
        sprintf(keyT, "t%d", i);
        prefs.putInt(keyR, servoReverse[i]);
        prefs.putInt(keyT, servoTrim[i]);
    }
    prefs.end();
    Serial.println("Calibration saved to flash");
}

// ── Servo write with calibration ───────────────────────────────────────

void servoWrite(int index, int angle) {
    angle = constrain(angle, 0, 180);
    currentAngles[index] = angle;  // store logical angle

    // Apply calibration: reverse then trim
    int actual = servoReverse[index] ? (180 - angle) : angle;
    actual = constrain(actual + servoTrim[index], 0, 180);
    servos[index].write(actual);
}

void writeAll(int angle) {
    for (int i = 0; i < 12; i++) servoWrite(i, angle);
}

// Re-apply current logical angles with updated calibration
void reapplyAll() {
    for (int i = 0; i < 12; i++) servoWrite(i, currentAngles[i]);
}

int servoIndex(int leg, int joint) { return leg * 3 + joint; }

int findLeg(const char* n) {
    for (int i = 0; i < 4; i++) if (strcmp(LEG_NAMES[i], n) == 0) return i;
    return -1;
}
int findJoint(const char* n) {
    for (int i = 0; i < 3; i++) if (strcmp(JOINT_NAMES[i], n) == 0) return i;
    return -1;
}

void sendCors() {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
}

// ═══════════════════════════════════════════════════════════════════════
// HTML Page — full control + live calibration
// ═══════════════════════════════════════════════════════════════════════

const char HTML_PAGE[] PROGMEM = R"rawliteral(
<!DOCTYPE html><html><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Spider Robot</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,sans-serif;background:#0f0f1a;color:#e0e0e0;padding:10px;font-size:13px}
h1{font-size:18px;color:#3498db;margin-bottom:2px}
h2{font-size:14px;color:#e67e22;margin:14px 0 6px}
.sub{font-size:11px;color:#888;margin-bottom:10px}
.st{padding:6px 10px;border-radius:6px;margin-bottom:10px;font-size:12px;background:#1a1a2e;border:1px solid #2a2a4a}
.st.ok{border-color:#2ecc71}.st.err{border-color:#e74c3c}
.d{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px}
.d.g{background:#2ecc71}.d.r{background:#e74c3c}

.qk{display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap}
.b{padding:7px 12px;border:1px solid #2a2a4a;border-radius:6px;background:#1a1a2e;
  color:#e0e0e0;font-size:12px;font-weight:600;cursor:pointer;text-align:center}
.b:active{opacity:0.7}
.b.bl{background:#3498db;border-color:#3498db;color:#fff}
.b.gn{background:#2ecc71;border-color:#2ecc71;color:#fff}
.b.rd{background:#e74c3c;border-color:#e74c3c;color:#fff}
.b.on{background:#e67e22;border-color:#e67e22;color:#fff}

.tabs{display:flex;gap:4px;margin-bottom:10px}
.tab{padding:6px 14px;border:1px solid #2a2a4a;border-radius:6px 6px 0 0;background:#1a1a2e;
  color:#888;cursor:pointer;font-size:12px;font-weight:600}
.tab.act{background:#16213e;color:#3498db;border-bottom-color:#16213e}
.page{display:none;background:#16213e;border:1px solid #2a2a4a;border-radius:0 6px 6px 6px;padding:10px}
.page.act{display:block}

.legs{display:grid;grid-template-columns:1fr 1fr;gap:8px}
@media(max-width:500px){.legs{grid-template-columns:1fr}}
.leg{background:#1a1a2e;border:1px solid #2a2a4a;border-radius:6px;padding:8px}
.leg h3{font-size:12px;margin-bottom:6px}
.sr{display:flex;align-items:center;gap:4px;margin-bottom:4px}
.sr label{font-size:11px;width:50px;color:#aaa}
.sr input[type=range]{flex:1;height:5px;-webkit-appearance:none;background:#0f3460;border-radius:3px;outline:none}
.sr input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;
  border-radius:50%;background:#3498db;cursor:pointer;border:2px solid #fff}
.sr .v{font-size:11px;font-family:monospace;color:#3498db;width:30px;text-align:right}
.sr .p{font-size:9px;color:#555;width:28px}

.cal-row{display:flex;align-items:center;gap:6px;margin-bottom:4px;padding:3px 0;
  border-bottom:1px solid #1a1a2e}
.cal-row .nm{font-size:11px;width:70px;font-weight:600}
.cal-row .rv{padding:3px 8px;font-size:10px;border-radius:4px;cursor:pointer;
  border:1px solid #2a2a4a;background:#1a1a2e;color:#aaa}
.cal-row .rv.on{background:#e67e22;border-color:#e67e22;color:#fff}
.cal-row input[type=range]{width:100px;height:4px}
.cal-row .tv{font-size:10px;font-family:monospace;color:#e67e22;width:30px;text-align:right}

#log{margin-top:10px;background:#0a0a12;border:1px solid #2a2a4a;border-radius:6px;
  padding:6px;font-size:10px;font-family:monospace;max-height:80px;overflow-y:auto;color:#666}
</style>
</head><body>

<h1>Spider Robot Control</h1>
<p class="sub">ESP32 &middot; 12 Servos &middot; Live Calibration</p>
<div id="st" class="st">Connecting...</div>

<div class="qk">
  <div class="b bl" onclick="cmdAll(90)">All 90&deg;</div>
  <div class="b" onclick="cmdAll(0)">All 0&deg;</div>
  <div class="b" onclick="cmdAll(180)">All 180&deg;</div>
  <div class="b gn" onclick="refresh()">Refresh</div>
</div>

<div class="tabs">
  <div class="tab act" onclick="showTab(0)">Control</div>
  <div class="tab" onclick="showTab(1)">Calibrate</div>
</div>

<div id="p0" class="page act">
  <div class="legs" id="legs"></div>
</div>

<div id="p1" class="page">
  <p style="font-size:11px;color:#888;margin-bottom:8px">
    <b>Reverse:</b> flips 0&harr;180 for backwards-mounted servos.<br>
    <b>Trim:</b> offsets the angle &plusmn;45&deg; to fine-tune alignment.<br>
    Changes apply instantly. Click <b>Save</b> to persist across reboots.
  </p>
  <div class="qk">
    <div class="b gn" onclick="saveCal()">Save to Flash</div>
    <div class="b rd" onclick="resetCal()">Reset All</div>
  </div>
  <div id="calRows"></div>
</div>

<div id="log"></div>

<script>
const L=['FL','FR','BL','BR'],J=['hip','shoulder','knee'];
const C=['#e74c3c','#3498db','#2ecc71','#e67e22'];
const P=[[23,22,21],[19,18,5],[17,16,4],[2,15,0]];
let cal={rev:new Array(12).fill(0),trim:new Array(12).fill(0)};

function $(id){return document.getElementById(id)}
function log(m){let e=$('log');e.textContent=m+'\n'+e.textContent;e.textContent=e.textContent.slice(0,400)}

function showTab(n){
  document.querySelectorAll('.tab').forEach((t,i)=>t.classList.toggle('act',i===n));
  document.querySelectorAll('.page').forEach((p,i)=>p.classList.toggle('act',i===n));
}

// ── Control tab ────────────────────────────────────────────────
function buildControl(){
  let h='';
  for(let l=0;l<4;l++){
    h+='<div class="leg"><h3 style="color:'+C[l]+'">'+L[l]+'</h3>';
    for(let j=0;j<3;j++){
      let id=L[l]+'_'+J[j];
      h+='<div class="sr">';
      h+='<label>'+J[j]+'</label>';
      h+='<input type="range" id="s_'+id+'" min="0" max="180" value="90" oninput="slide(\''+L[l]+'\',\''+J[j]+'\',this.value)">';
      h+='<span class="v" id="v_'+id+'">90</span>';
      h+='<span class="p">p'+P[l][j]+'</span>';
      h+='</div>';
    }
    h+='</div>';
  }
  $('legs').innerHTML=h;
}

function slide(leg,joint,val){
  val=parseInt(val);
  $('v_'+leg+'_'+joint).textContent=val;
  fetch('/set-servo',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({leg,joint,angle:val})})
  .then(r=>r.json()).then(d=>{if(d.ok)log(leg+' '+joint+' -> '+val)})
  .catch(e=>log('ERR: '+e.message));
}

function cmdAll(a){
  for(let l=0;l<4;l++)for(let j=0;j<3;j++){
    let id=L[l]+'_'+J[j];$('s_'+id).value=a;$('v_'+id).textContent=a;
  }
  let o={};L.forEach(l=>o[l]={hip:a,shoulder:a,knee:a});
  fetch('/set-angles',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(o)}).then(r=>r.json()).then(()=>log('All -> '+a)).catch(e=>log('ERR: '+e.message));
}

// ── Calibration tab ────────────────────────────────────────────
function buildCalibration(){
  let h='';
  for(let i=0;i<12;i++){
    let l=L[Math.floor(i/3)], j=J[i%3];
    h+='<div class="cal-row">';
    h+='<span class="nm" style="color:'+C[Math.floor(i/3)]+'">'+l+' '+j+'</span>';
    h+='<span class="rv" id="rv_'+i+'" onclick="toggleRev('+i+')">REV</span>';
    h+='<input type="range" id="tr_'+i+'" min="-45" max="45" value="0" oninput="setTrim('+i+',this.value)">';
    h+='<span class="tv" id="tv_'+i+'">0</span>';
    h+='</div>';
  }
  $('calRows').innerHTML=h;
}

function toggleRev(i){
  cal.rev[i]=cal.rev[i]?0:1;
  $('rv_'+i).classList.toggle('on',cal.rev[i]);
  sendCal(i);
}

function setTrim(i,val){
  cal.trim[i]=parseInt(val);
  $('tv_'+i).textContent=val;
  sendCal(i);
}

function sendCal(i){
  fetch('/calibrate',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({index:i,reverse:cal.rev[i],trim:cal.trim[i]})})
  .then(r=>r.json()).then(d=>{if(d.ok)log('Cal servo '+i+': rev='+cal.rev[i]+' trim='+cal.trim[i])})
  .catch(e=>log('ERR: '+e.message));
}

function saveCal(){
  fetch('/save-calibration',{method:'POST'})
  .then(r=>r.json()).then(d=>{if(d.ok)log('Calibration saved to flash!')})
  .catch(e=>log('ERR: '+e.message));
}

function resetCal(){
  for(let i=0;i<12;i++){cal.rev[i]=0;cal.trim[i]=0;}
  fetch('/reset-calibration',{method:'POST'})
  .then(r=>r.json()).then(d=>{if(d.ok){log('Calibration reset');loadCalUI();}})
  .catch(e=>log('ERR: '+e.message));
}

function loadCalUI(){
  fetch('/get-calibration').then(r=>r.json()).then(d=>{
    if(!d.ok)return;
    for(let i=0;i<12;i++){
      cal.rev[i]=d.cal[i].rev;
      cal.trim[i]=d.cal[i].trim;
      $('rv_'+i).classList.toggle('on',cal.rev[i]);
      $('tr_'+i).value=cal.trim[i];
      $('tv_'+i).textContent=cal.trim[i];
    }
    log('Calibration loaded');
  }).catch(e=>log('ERR: '+e.message));
}

// ── Status ─────────────────────────────────────────────────────
function refresh(){
  fetch('/status').then(r=>r.json()).then(d=>{
    if(d.ok){
      $('st').className='st ok';
      $('st').innerHTML='<span class="d g"></span>Connected';
      let a=d.angles;
      for(let l=0;l<4;l++)for(let j=0;j<3;j++){
        let id=L[l]+'_'+J[j], v=a[L[l]][J[j]];
        $('s_'+id).value=v;$('v_'+id).textContent=v;
      }
    }
  }).catch(e=>{
    $('st').className='st err';
    $('st').innerHTML='<span class="d r"></span>'+e.message;
  });
}

buildControl();
buildCalibration();
refresh();
loadCalUI();
</script>
</body></html>
)rawliteral";

// ═══════════════════════════════════════════════════════════════════════
// HTTP Handlers
// ═══════════════════════════════════════════════════════════════════════

void handleRoot() {
    sendCors();
    if (server.method() == HTTP_OPTIONS) { server.send(204); return; }
    server.send_P(200, "text/html", HTML_PAGE);
}

void handleStatus() {
    sendCors();
    if (server.method() == HTTP_OPTIONS) { server.send(204); return; }
    JsonDocument doc;
    doc["ok"] = true;
    JsonObject angles = doc["angles"].to<JsonObject>();
    for (int l = 0; l < 4; l++) {
        JsonObject leg = angles[LEG_NAMES[l]].to<JsonObject>();
        leg["hip"]      = currentAngles[servoIndex(l, 0)];
        leg["shoulder"] = currentAngles[servoIndex(l, 1)];
        leg["knee"]     = currentAngles[servoIndex(l, 2)];
    }
    String json;
    serializeJson(doc, json);
    server.send(200, "application/json", json);
}

void handleSetAll90() {
    sendCors();
    if (server.method() == HTTP_OPTIONS) { server.send(204); return; }
    writeAll(90);
    server.send(200, "application/json", "{\"ok\":true}");
}

void handleSetAll0() {
    sendCors();
    if (server.method() == HTTP_OPTIONS) { server.send(204); return; }
    writeAll(0);
    server.send(200, "application/json", "{\"ok\":true}");
}

void handleSetServo() {
    sendCors();
    if (server.method() == HTTP_OPTIONS) { server.send(204); return; }
    if (!server.hasArg("plain")) { server.send(400, "application/json", "{\"ok\":false}"); return; }
    JsonDocument doc;
    if (deserializeJson(doc, server.arg("plain"))) { server.send(400, "application/json", "{\"ok\":false}"); return; }
    int li = findLeg(doc["leg"]);
    int ji = findJoint(doc["joint"]);
    int angle = doc["angle"] | -1;
    if (li < 0 || ji < 0 || angle < 0 || angle > 180) { server.send(400, "application/json", "{\"ok\":false}"); return; }
    servoWrite(servoIndex(li, ji), angle);
    server.send(200, "application/json", "{\"ok\":true}");
}

void handleSetAngles() {
    sendCors();
    if (server.method() == HTTP_OPTIONS) { server.send(204); return; }
    if (!server.hasArg("plain")) { server.send(400, "application/json", "{\"ok\":false}"); return; }
    JsonDocument doc;
    if (deserializeJson(doc, server.arg("plain"))) { server.send(400, "application/json", "{\"ok\":false}"); return; }
    for (int l = 0; l < 4; l++) {
        JsonObject leg = doc[LEG_NAMES[l]];
        if (leg.isNull()) continue;
        for (int j = 0; j < 3; j++) {
            if (leg.containsKey(JOINT_NAMES[j])) {
                int a = leg[JOINT_NAMES[j]] | -1;
                if (a >= 0 && a <= 180) servoWrite(servoIndex(l, j), a);
            }
        }
    }
    server.send(200, "application/json", "{\"ok\":true}");
}

// ── Calibration endpoints ──────────────────────────────────────────────

// POST /calibrate — set reverse + trim for one servo, applies instantly
// Body: {"index":0,"reverse":1,"trim":-5}
void handleCalibrate() {
    sendCors();
    if (server.method() == HTTP_OPTIONS) { server.send(204); return; }
    if (!server.hasArg("plain")) { server.send(400, "application/json", "{\"ok\":false}"); return; }
    JsonDocument doc;
    if (deserializeJson(doc, server.arg("plain"))) { server.send(400, "application/json", "{\"ok\":false}"); return; }

    int idx   = doc["index"] | -1;
    int rev   = doc["reverse"] | 0;
    int trim  = doc["trim"] | 0;

    if (idx < 0 || idx > 11) { server.send(400, "application/json", "{\"ok\":false}"); return; }

    servoReverse[idx] = rev ? 1 : 0;
    servoTrim[idx]    = constrain(trim, -45, 45);

    // Re-apply current angle with new calibration
    servoWrite(idx, currentAngles[idx]);

    server.send(200, "application/json", "{\"ok\":true}");
    Serial.printf("Cal %d: rev=%d trim=%d\n", idx, servoReverse[idx], servoTrim[idx]);
}

// GET /get-calibration — return all calibration values
void handleGetCalibration() {
    sendCors();
    if (server.method() == HTTP_OPTIONS) { server.send(204); return; }
    JsonDocument doc;
    doc["ok"] = true;
    JsonArray arr = doc["cal"].to<JsonArray>();
    for (int i = 0; i < 12; i++) {
        JsonObject o = arr.add<JsonObject>();
        o["rev"]  = servoReverse[i];
        o["trim"] = servoTrim[i];
    }
    String json;
    serializeJson(doc, json);
    server.send(200, "application/json", json);
}

// POST /save-calibration — persist to flash
void handleSaveCalibration() {
    sendCors();
    if (server.method() == HTTP_OPTIONS) { server.send(204); return; }
    saveCalibration();
    server.send(200, "application/json", "{\"ok\":true}");
}

// POST /reset-calibration — clear all calibration
void handleResetCalibration() {
    sendCors();
    if (server.method() == HTTP_OPTIONS) { server.send(204); return; }
    for (int i = 0; i < 12; i++) { servoReverse[i] = 0; servoTrim[i] = 0; }
    saveCalibration();
    reapplyAll();
    server.send(200, "application/json", "{\"ok\":true}");
    Serial.println("Calibration reset");
}

void handleNotFound() {
    sendCors();
    if (server.method() == HTTP_OPTIONS) { server.send(204); return; }
    Serial.printf("404: %s\n", server.uri().c_str());
    server.send(404, "application/json", "{\"ok\":false,\"error\":\"not found\"}");
}

// ═══════════════════════════════════════════════════════════════════════
// Setup & Loop
// ═══════════════════════════════════════════════════════════════════════

void setup() {
    Serial.begin(115200);
    delay(1000);
    Serial.println("\n=== Spider Robot WiFi Controller ===");

    // ── Load calibration from flash ────────────────────────────────────
    loadCalibration();

    // ── WiFi AP ────────────────────────────────────────────────────────
    WiFi.disconnect(true);
    WiFi.mode(WIFI_AP);
    delay(100);
    bool apOk = WiFi.softAP(AP_SSID, AP_PASSWORD);
    delay(500);
    if (apOk) {
        Serial.printf("AP: %s  Pass: %s\n", AP_SSID, AP_PASSWORD);
        Serial.printf("Open http://%s\n", WiFi.softAPIP().toString().c_str());
    } else {
        Serial.println("ERROR: AP failed!");
    }

    // ── Servos ─────────────────────────────────────────────────────────
    for (int i = 0; i < 12; i++) {
        servos[i].attach(SERVO_PINS[i]);
        servoWrite(i, 90);
    }
    Serial.println("12 servos ready");

    // ── HTTP routes ────────────────────────────────────────────────────
    server.on("/",                 handleRoot);
    server.on("/status",           handleStatus);
    server.on("/set-all-90",       handleSetAll90);
    server.on("/set-all-0",        handleSetAll0);
    server.on("/set-servo",        handleSetServo);
    server.on("/set-angles",       handleSetAngles);
    server.on("/calibrate",        handleCalibrate);
    server.on("/get-calibration",  handleGetCalibration);
    server.on("/save-calibration", handleSaveCalibration);
    server.on("/reset-calibration",handleResetCalibration);
    server.onNotFound(handleNotFound);
    server.begin();
    Serial.println("HTTP server ready");
}

void loop() {
    server.handleClient();
}
