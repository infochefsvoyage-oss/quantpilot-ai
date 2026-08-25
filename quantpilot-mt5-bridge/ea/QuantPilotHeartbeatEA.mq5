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
input int      MaxRetries       = 4;           // max. Versuche pro Heartbeat
input int      RetryBackoffMs1  = 250;          // Backoff nach Versuch 1 (ms)
input int      RetryBackoffMs2  = 500;          // Backoff nach Versuch 2 (ms)
input int      RetryBackoffMs3  = 1000;         // Backoff nach Versuch 3 (ms)
input int      RequestTimeoutMs = 1000;         // Timeout pro WebRequest (ms) — 1000ms ensures 20s gap safe at 2 consecutive all-timeout cycles

//--- Globals
string  g_symbols[];
datetime g_lastPost = 0;
string  g_lastError = "";
int     g_postCount = 0;
int     g_retrySuccessCount = 0;  // nach Retry erfolgreich wiederhergestellte Heartbeats

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

   // Timer aktivieren — prüft jede 1s ob Heartbeat-Intervall erreicht
   EventSetTimer(1);

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

   // --- HTTP POST mit Retry-Logik (max. 4 Versuche, Backoff 250/500/1000ms + Jitter) ---
   string headers = "Content-Type: application/json\r\n";
   if(BridgeApiKey != "")
      headers += "X-API-Key: " + BridgeApiKey + "\r\n";

   char post[], result[];
   string resultHeaders;

   StringToCharArray(payload, post, 0, StringLen(payload));
   ArrayResize(post, StringLen(payload));

   string url = BridgeUrl;
   bool success = false;
   uint startTimeMs = GetTickCount();

   for(int attempt = 1; attempt <= MaxRetries; attempt++)
   {
      ArrayResize(result, 0);
      resultHeaders = "";
      ResetLastError();
      int res = WebRequest("POST", url, headers, RequestTimeoutMs, post, result, resultHeaders);
      int errCode = GetLastError();

      if(res == 200)
      {
         success = true;
         g_postCount++;
         g_lastError = "";
         if(attempt > 1)
         {
            g_retrySuccessCount++;
            Print("[QuantPilot-Heartbeat] POST OK #", g_postCount,
                  " attempt=", attempt, "/", MaxRetries, " (recovered after retry)");
         }
         else
         {
            if(g_postCount % 60 == 1)
            {
               string response = CharArrayToString(result);
               Print("[QuantPilot-Heartbeat] POST OK #", g_postCount, " — ", response);
            }
         }
         break;
      }

      string reason = ClassifyError(res, errCode);
      bool retryable = IsRetryableError(res, errCode);

      // Auth-Fehler (401/403) — explizit loggen, kein Retry
      if(res == 401 || res == 403)
      {
         g_lastError = "AUTH_FAILURE http=" + IntegerToString(res) + " reason=" + reason;
         Print("[QuantPilot-Heartbeat] AUTH FAILURE http=", res, " attempt=", attempt, "/", MaxRetries);
         break;
      }

      if(!retryable)
      {
         g_lastError = "http=" + IntegerToString(res) + " err=" + IntegerToString(errCode) + " reason=" + reason;
         Print("[QuantPilot-Heartbeat] POST FAILED http=", res, " attempt=", attempt, "/", MaxRetries,
               " reason=", reason, " (permanent — no retry)");
         break;
      }

      if(attempt >= MaxRetries)
      {
         uint elapsedMs = GetTickCount() - startTimeMs;
         g_lastError = "http=" + IntegerToString(res) + " err=" + IntegerToString(errCode) + " reason=" + reason;
         Print("[QuantPilot-Heartbeat] POST FAILED http=", res, " attempts=", attempt, "/", MaxRetries,
               " elapsed_ms=", elapsedMs, " reason=", reason);
         break;
      }

      // Backoff mit Jitter (0-99ms)
      int baseBackoff = RetryBackoffMs1;
      if(attempt == 2) baseBackoff = RetryBackoffMs2;
      else if(attempt == 3) baseBackoff = RetryBackoffMs3;
      int jitter = MathRand() % 100;
      int delayMs = baseBackoff + jitter;

      Print("[QuantPilot-Heartbeat] POST RETRY attempt=", attempt + 1, "/", MaxRetries,
            " http=", res, " delay_ms=", delayMs, " reason=", reason);
      Sleep(delayMs);
   }
   }

   //+------------------------------------------------------------------+
   //| Fehler klassifizieren — HTTP-Code + MQL5 GetLastError()           |
   //+------------------------------------------------------------------+
   string ClassifyError(int httpCode, int errCode)
   {
      if(httpCode == -1)
      {
         if(errCode == 4060) return "ERR_REQUEST_NOT_ALLOWED (4060)";
         if(errCode == 4014) return "ERR_URL_NOT_ALLOWLISTED (4014)";
         if(errCode == 4061) return "ERR_REQUEST_SEND_FAILED (4061)";
         return "TRANSPORT_ERROR err=" + IntegerToString(errCode);
      }
      if(httpCode == 502) return "HTTP_502_BAD_GATEWAY";
      if(httpCode == 503) return "HTTP_503_SERVICE_UNAVAILABLE";
      if(httpCode == 504) return "HTTP_504_GATEWAY_TIMEOUT";
      if(httpCode == 400) return "HTTP_400_BAD_REQUEST";
      if(httpCode == 401) return "HTTP_401_UNAUTHORIZED";
      if(httpCode == 403) return "HTTP_403_FORBIDDEN";
      if(httpCode == 404) return "HTTP_404_NOT_FOUND";
      if(httpCode == 500) return "HTTP_500_INTERNAL_SERVER_ERROR";
      return "HTTP_" + IntegerToString(httpCode);
   }

   //+------------------------------------------------------------------+
   //| Retrybar: 502/503/504, res==-1 außer 4060/4014                    |
   //| Nicht retrybar: 400/401/403/404/500                               |
   //+------------------------------------------------------------------+
   bool IsRetryableError(int httpCode, int errCode)
   {
      if(httpCode == 502 || httpCode == 503 || httpCode == 504)
         return true;
      if(httpCode == -1)
      {
         if(errCode == 4060) return false;  // WebRequest nicht erlaubt
         if(errCode == 4014) return false;  // URL/Allowlist-Problem
         return true;                       // sonstiger Transportfehler → retry
      }
      // 400/401/403/404/500 → permanent → kein Retry
      return false;
   }

//+------------------------------------------------------------------+
//| Timer deinitialisieren                                            |
//+------------------------------------------------------------------+
void OnDeinitTimer()
{
   EventKillTimer();
}