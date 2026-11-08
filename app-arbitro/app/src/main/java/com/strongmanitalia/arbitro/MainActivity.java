package com.strongmanitalia.arbitro;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.wifi.WifiManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.view.inputmethod.InputMethodManager;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import org.json.JSONObject;

import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.net.SocketTimeoutException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * App dell'arbitro: cerca da sola il PC con "strongmanitalia Gara" sulla rete Wi-Fi
 * (messaggio UDP in broadcast sulla porta 4170) e apre la schermata arbitro senza browser.
 */
public class MainActivity extends Activity {
    private static final int DISCOVERY_PORT = 4170;
    private static final String QUERY = "STRONGMANITALIA_CERCA";
    private static final int LIME = Color.parseColor("#91d900");
    private static final int BG = Color.parseColor("#15171a");
    private static final int PANEL = Color.parseColor("#1f2226");
    private static final int TEXT = Color.parseColor("#f2f4f5");
    private static final int MUTED = Color.parseColor("#a3abb3");

    private final Handler ui = new Handler(Looper.getMainLooper());
    private FrameLayout root;
    private LinearLayout searchScreen;
    private LinearLayout foundList;
    private TextView statusText;
    private Button searchButton;
    private WebView web;
    private SharedPreferences prefs;
    private volatile boolean searching = false;

    /** Gara trovata sulla rete. */
    private static final class Gara {
        final String host; final int port; final String nome;
        Gara(String host, int port, String nome) { this.host = host; this.port = port; this.nome = nome; }
        String url() { return "http://" + host + ":" + port + "/arbitro"; }
        String indirizzo() { return host + ":" + port; }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        prefs = getSharedPreferences("arbitro", MODE_PRIVATE);
        root = new FrameLayout(this);
        root.setBackgroundColor(BG);
        buildSearchScreen();
        buildWebView();
        setContentView(root);
        startSearch();
    }

    // ---------- Schermata di ricerca ----------

    private void buildSearchScreen() {
        ScrollView scroll = new ScrollView(this);
        searchScreen = new LinearLayout(this);
        searchScreen.setOrientation(LinearLayout.VERTICAL);
        int pad = dp(24);
        searchScreen.setPadding(pad, dp(40), pad, pad);
        scroll.addView(searchScreen);

        TextView title = text("Arbitro", 30, TEXT, true);
        title.setTextColor(LIME);
        searchScreen.addView(title);
        searchScreen.addView(text("strongmanitalia Gara", 16, MUTED, false));
        searchScreen.addView(space(24));

        statusText = text("", 17, TEXT, false);
        searchScreen.addView(statusText);
        searchScreen.addView(space(12));

        foundList = new LinearLayout(this);
        foundList.setOrientation(LinearLayout.VERTICAL);
        searchScreen.addView(foundList);
        searchScreen.addView(space(12));

        searchButton = button("Cerca di nuovo", false);
        searchButton.setOnClickListener(v -> startSearch());
        searchScreen.addView(searchButton);
        searchScreen.addView(space(32));

        searchScreen.addView(text("Non la trova? Scrivi l'indirizzo mostrato nel pannello gara sul PC (per esempio 192.168.1.20:4173):", 15, MUTED, false));
        searchScreen.addView(space(8));
        EditText manual = new EditText(this);
        manual.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        manual.setSingleLine(true);
        manual.setTextColor(TEXT);
        manual.setHintTextColor(MUTED);
        manual.setHint("192.168.1.20:4173");
        manual.setText(prefs.getString("ultimo", ""));
        manual.setBackground(rounded(PANEL, dp(10)));
        manual.setPadding(dp(14), dp(12), dp(14), dp(12));
        searchScreen.addView(manual, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        searchScreen.addView(space(8));
        Button go = button("Collegati a questo indirizzo", false);
        go.setOnClickListener(v -> {
            Gara gara = parseManual(manual.getText().toString());
            if (gara == null) { statusText.setText("Indirizzo non valido. Scrivi per esempio 192.168.1.20:4173"); return; }
            hideKeyboard(manual);
            open(gara);
        });
        searchScreen.addView(go);
        searchScreen.addView(space(24));
        searchScreen.addView(text("Il telefono deve essere collegato al Wi-Fi dello stesso router del PC, e sul PC la gara deve essere avviata.", 14, MUTED, false));

        root.addView(scroll, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    }

    private Gara parseManual(String raw) {
        String s = raw.trim().replace("http://", "").replace("https://", "");
        int slash = s.indexOf('/');
        if (slash >= 0) s = s.substring(0, slash);
        if (s.isEmpty()) return null;
        String host = s; int port = 4173;
        int colon = s.lastIndexOf(':');
        if (colon > 0) {
            host = s.substring(0, colon);
            try { port = Integer.parseInt(s.substring(colon + 1)); } catch (NumberFormatException e) { return null; }
        }
        if (!host.matches("[0-9A-Za-z.\\-]+") || port < 1 || port > 65535) return null;
        return new Gara(host, port, "Gara");
    }

    private void startSearch() {
        if (searching) return;
        searching = true;
        foundList.removeAllViews();
        statusText.setText("Cerco il PC della gara sul Wi-Fi…");
        searchButton.setEnabled(false);
        new Thread(() -> {
            List<Gara> found = discover();
            ui.post(() -> {
                searching = false;
                searchButton.setEnabled(true);
                showResults(found);
            });
        }, "ricerca-gara").start();
    }

    private void showResults(List<Gara> found) {
        foundList.removeAllViews();
        if (found.isEmpty()) {
            statusText.setText("Nessuna gara trovata. Controlla che sul PC la gara sia avviata e che il telefono sia sullo stesso Wi-Fi, poi premi \"Cerca di nuovo\".");
            return;
        }
        if (found.size() == 1) {
            statusText.setText("Gara trovata: " + found.get(0).nome);
            open(found.get(0));
            return;
        }
        statusText.setText("Ho trovato più gare. Tocca quella giusta:");
        for (Gara gara : found) {
            Button b = button(gara.nome + "\n" + gara.indirizzo(), true);
            b.setOnClickListener(v -> open(gara));
            foundList.addView(b);
            foundList.addView(space(8));
        }
    }

    /** Manda la richiesta in broadcast e raccoglie le risposte per circa 2,5 secondi. */
    private List<Gara> discover() {
        Map<String, Gara> found = new LinkedHashMap<>();
        WifiManager wifi = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
        WifiManager.MulticastLock lock = null;
        try {
            if (wifi != null) { lock = wifi.createMulticastLock("ricerca-gara"); lock.setReferenceCounted(false); lock.acquire(); }
        } catch (Exception ignored) { lock = null; }
        try (DatagramSocket socket = new DatagramSocket()) {
            socket.setBroadcast(true);
            socket.setSoTimeout(400);
            byte[] query = QUERY.getBytes(StandardCharsets.UTF_8);
            List<InetAddress> targets = broadcastTargets(wifi);
            long end = System.currentTimeMillis() + 2500;
            long nextSend = 0;
            byte[] buffer = new byte[2048];
            while (System.currentTimeMillis() < end) {
                if (System.currentTimeMillis() >= nextSend) {
                    for (InetAddress target : targets) {
                        try { socket.send(new DatagramPacket(query, query.length, target, DISCOVERY_PORT)); } catch (Exception ignored) { }
                    }
                    nextSend = System.currentTimeMillis() + 800;
                }
                try {
                    DatagramPacket packet = new DatagramPacket(buffer, buffer.length);
                    socket.receive(packet);
                    JSONObject json = new JSONObject(new String(packet.getData(), 0, packet.getLength(), StandardCharsets.UTF_8));
                    if (!"strongmanitalia-gara".equals(json.optString("app"))) continue;
                    int port = json.optInt("port", 0);
                    if (port <= 0) continue;
                    String host = packet.getAddress().getHostAddress();
                    Gara gara = new Gara(host, port, json.optString("nome", "Gara"));
                    found.put(gara.indirizzo(), gara);
                } catch (SocketTimeoutException ignored) {
                } catch (Exception ignored) { }
            }
        } catch (Exception ignored) {
        } finally {
            if (lock != null && lock.isHeld()) lock.release();
        }
        return new ArrayList<>(found.values());
    }

    @SuppressWarnings("deprecation")
    private List<InetAddress> broadcastTargets(WifiManager wifi) {
        List<InetAddress> targets = new ArrayList<>();
        try { targets.add(InetAddress.getByName("255.255.255.255")); } catch (Exception ignored) { }
        try {
            if (wifi != null && wifi.getDhcpInfo() != null) {
                int ip = wifi.getDhcpInfo().ipAddress;
                int mask = wifi.getDhcpInfo().netmask;
                if (mask == 0) mask = 0x00ffffff; // /24 (ordine dei byte di Android)
                if (ip != 0) {
                    int broadcast = (ip & mask) | ~mask;
                    byte[] quads = new byte[4];
                    for (int k = 0; k < 4; k++) quads[k] = (byte) ((broadcast >> (k * 8)) & 0xFF);
                    targets.add(InetAddress.getByAddress(quads));
                }
            }
        } catch (Exception ignored) { }
        return targets;
    }

    // ---------- Schermata arbitro ----------

    private void buildWebView() {
        web = new WebView(this);
        web.setBackgroundColor(BG);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        s.setMediaPlaybackRequiresUserGesture(false);
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String scheme = request.getUrl().getScheme();
                return !("http".equals(scheme) || "https".equals(scheme));
            }
            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (!request.isForMainFrame()) return;
                showSearch();
                statusText.setText("Non riesco ad aprire la gara: " + error.getDescription() + ". Controlla il Wi-Fi e che la gara sia avviata sul PC.");
            }
        });
        web.setVisibility(View.GONE);
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    }

    private void open(Gara gara) {
        prefs.edit().putString("ultimo", gara.indirizzo()).apply();
        web.loadUrl(gara.url());
        web.setVisibility(View.VISIBLE);
        ((View) searchScreen.getParent()).setVisibility(View.GONE);
    }

    private void showSearch() {
        web.stopLoading();
        web.loadUrl("about:blank");
        web.setVisibility(View.GONE);
        ((View) searchScreen.getParent()).setVisibility(View.VISIBLE);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (web.getVisibility() == View.VISIBLE) {
            if (web.canGoBack()) { web.goBack(); return; }
            showSearch();
            statusText.setText("Sei uscito dalla gara. Premi \"Cerca di nuovo\" per rientrare.");
            return;
        }
        super.onBackPressed();
    }

    // ---------- Aiuti grafici ----------

    private TextView text(String value, int sp, int color, boolean bold) {
        TextView t = new TextView(this);
        t.setText(value);
        t.setTextSize(sp);
        t.setTextColor(color);
        if (bold) t.setTypeface(Typeface.DEFAULT_BOLD);
        return t;
    }

    private Button button(String label, boolean secondary) {
        Button b = new Button(this);
        b.setText(label);
        b.setAllCaps(false);
        b.setTextSize(17);
        b.setTextColor(secondary ? TEXT : BG);
        b.setTypeface(Typeface.DEFAULT_BOLD);
        b.setBackground(rounded(secondary ? PANEL : LIME, dp(12)));
        b.setPadding(dp(16), dp(14), dp(16), dp(14));
        b.setGravity(Gravity.CENTER);
        b.setLayoutParams(new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        return b;
    }

    private GradientDrawable rounded(int color, int radius) {
        GradientDrawable d = new GradientDrawable();
        d.setColor(color);
        d.setCornerRadius(radius);
        return d;
    }

    private View space(int heightDp) {
        View v = new View(this);
        v.setLayoutParams(new LinearLayout.LayoutParams(1, dp(heightDp)));
        return v;
    }

    private void hideKeyboard(View v) {
        InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
        if (imm != null) imm.hideSoftInputFromWindow(v.getWindowToken(), 0);
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
