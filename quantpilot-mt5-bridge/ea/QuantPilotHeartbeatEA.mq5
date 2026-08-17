//+------------------------------------------------------------------+
//| QuantPilotHeartbeatEA.mq5                                        |
//| OP-777 Sniper Desk — EA-Heartbeat-Adapter für MT5/Vantage          |
//|                                                                  |
//| Postet periodisch (alle HEARTBEAT_INTERVAL_SEC) einen Heartbeat   |
//| an die QuantPilot MT5 Bridge (/heartbeat).                       |
//|                                                                  |
//| Payload (keine Credentials):                                     |
//|   ea_id, version, account, symbols, timestamp,                   |
//|   server_time, state, last_tick_time                              |
//|                                                                  |
//| Keine Order-Ausführung. Kein order_send(). Reiner Heartbeat-Path. |
//+------------------------------------------------------------------+
#property strict
#property copyright "QuantPilot AI — OP-777 Sniper Desk"
#property version   "1.0.0"
#property description "EA-Heartbeat-Adapter — POST an QuantPilot MT5 Bridge"

//--- Eingabeparameter
input string   BridgeUrl       = "https://mt5.quantpilot.cc/api/v1/mt5/heartbeat";
input string   BridgeApiKey    = "";           // X-API-Key (falls gesetzt)
input string   EaId            = "QP-EA-VANTAGE-01";
input string   EaVersion        = "1.0.0";
input int      HeartbeatIntervalSec = 5;       // alle 5s posten (healthy < 10s)
input string   SymbolFilter     = "XAUUSD";    // komma-separiert

//--- Globals
string  g_symbols[];
datetime g_lastPost = 0;
string  g_lastError = "";
int     g_postCount = 0;

//+------------------------------------------------------------------+
//| Expert initialization                                             |
//+------------------------------------------------------------------+
int OnInit()
{
   // Symbol-Filter parsen
   string parts[];
   StringSplit(SymbolFilter, ',', parts);
   for(int i = 0; i < ArraySize(parts); i++)
   {
      string s = parts[i];
      StringTrimLeft(s);
      StringTrimRight(s);
      if(s != "")
      {
         ArrayResize(g_symbols, ArraySize(g_symbols) + 1);
         g_symbols[ArraySize(g_symbols) - 1] = s;
         SymbolSelect(s, true);  // Symbol sichtbar machen
      }
   }

   Print("[QuantPilot-Heartbeat] EA initialisiert — EaId=", EaId,
         " Interval=", HeartbeatIntervalSec, "s Bridge=", BridgeUrl);
   Print("[QuantPilot-Heartbeat] Symbole: ", ArraySize(g_symbols), " aktiv");
   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Expert deinitialization                                           |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   Print("[QuantPilot-Heartbeat] EA gestoppt — reason=", reason,
         " Posts=", g_postCount);
}

//+------------------------------------------------------------------+
//| Timer-Tick — Heartbeat posten                                     |
//+------------------------------------------------------------------+
void OnTimer()
{
   datetime now = TimeCurrent();
   if(now - g_lastPost < HeartbeatIntervalSec)
      return;

   g_lastPost = now;
   PostHeartbeat();
}

//+------------------------------------------------------------------+
//| Tick-Event — Fallback falls Timer nicht gesetzt                   |
//+------------------------------------------------------------------+
void OnTick()
{
   datetime now = TimeCurrent();
   if(now - g_lastPost >= HeartbeatIntervalSec)
   {
      g_lastPost = now;
      PostHeartbeat();
   }
}

//+------------------------------------------------------------------+
//| Heartbeat-Payload bauen und POSTen                                |
//+------------------------------------------------------------------+
void PostHeartbeat()
{
   // Account-Info (keine Credentials — nur Login-ID als String)
   string account = IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
   string server  = AccountInfoString(ACCOUNT_SERVER);
   string broker  = AccountInfoString(ACCOUNT_COMPANY);

   // Server-Zeit (MT5 Terminal)
   datetime srvTime = TimeCurrent();
   string srvTimeStr = TimeToString(srvTime, TIME_DATE | TIME_SECONDS);

   // Letzter Tick des ersten Symbols
   string lastTickTime = "";
   if(ArraySize(g_symbols) > 0)
   {
      MqlTick tick;
      if(SymbolInfoTick(g_symbols[0], tick))
         lastTickTime = TimeToString(tick.time, TIME_DATE | TIME_SECONDS);
   }

   // State
   string state = "RUNNING";
   if(!TerminalInfoInteger(TERMINAL_CONNECTED))
      state = "TERMINAL_DISCONNECTED";
   if(!MQLInfoInteger(MQL_TRADE_ALLOWED))
      state = "TRADE_NOT_ALLOWED";

   // Symbols-Array als JSON
   string symbolsJson = "[";
   for(int i = 0; i < ArraySize(g_symbols); i++)
   {
      if(i > 0) symbolsJson += ",";
      symbolsJson += "\"" + g_symbols[i] + "\"";
   }
   symbolsJson += "]";

   // JSON-Payload
   string payload = "{";
   payload += "\"ea_id\":\"" + EaId + "\",";
   payload += "\"version\":\"" + EaVersion + "\",";
   payload += "\"account\":\"" + account + "\",";
   payload += "\"symbols\":" + symbolsJson + ",";
   payload += "\"timestamp\":\"" + TimeToString(TimeCurrent(), TIME_DATE | TIME_SECONDS) + "\",";
   payload += "\"server_time\":\"" + srvTimeStr + "\",";
   payload += "\"state\":\"" + state + "\",";
   payload += "\"last_tick_time\":\"" + lastTickTime + "\"";
   payload += "}";

   // HTTP POST
   string headers = "Content-Type: application/json\r\n";
   if(BridgeApiKey != "")
      headers += "X-API-Key: " + BridgeApiKey + "\r\n";

   char post[], result[];
   string resultHeaders;

   StringToCharArray(payload, post, 0, StringLen(payload));
   // Null-Terminator entfernen
   ArrayResize(post, StringLen(payload));

   string url = BridgeUrl;
   int timeout = 5000; // 5s Timeout

   ResetLastError();
   int res = WebRequest("POST", url, headers, timeout, post, result, resultHeaders);

   if(res == 200)
   {
      g_postCount++;
      g_lastError = "";
      // Antwort parsen (optional — nur State extrahieren)
      string response = CharArrayToString(result);
      // Log nur alle 60 Posts (alle ~5min bei 5s Intervall)
      if(g_postCount % 60 == 1)
         Print("[QuantPilot-Heartbeat] POST OK #", g_postCount, " — ", response);
   }
   else
   {
      g_lastError = "HTTP " + IntegerToString(res) + " err=" + IntegerToString(GetLastError());
      Print("[QuantPilot-Heartbeat] POST FAILED — ", g_lastError);
   }
}

//+------------------------------------------------------------------+
//| Chart-Event (Timer setzen beim Start)                            |
//+------------------------------------------------------------------+
int OnInitTimer()
{
   EventSetTimer(1); // Timer jede 1s prüfen
   return INIT_SUCCEEDED;
}