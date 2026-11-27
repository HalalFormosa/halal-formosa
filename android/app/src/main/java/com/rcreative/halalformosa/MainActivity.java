package com.rcreative.halalformosa;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebView;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {
    // Longest we ever hold the native splash if the WebView never reports a first paint.
    private static final long SPLASH_FAILSAFE_MS = 3000;
    // Small grace after the first visible commit so the web logo is on screen before we drop the native one.
    private static final long SPLASH_PAINT_GRACE_MS = 60;

    private volatile boolean webSplashPainted = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Keep the native splash (orange + logo) up until the web splash (same logo, same spot)
        // has painted, then remove it instantly. Without this the system fades the native logo
        // out on the WebView's first blank frame, which looked like a flicker.
        SplashScreen splash = SplashScreen.installSplashScreen(this);
        splash.setKeepOnScreenCondition(() -> !webSplashPainted);
        splash.setOnExitAnimationListener(provider -> provider.remove());

        registerPlugin(WidgetSyncPlugin.class);
        registerPlugin(RecaptchaNativePlugin.class);
        registerPlugin(LiveTextPlugin.class);
        super.onCreate(savedInstanceState);

        Handler main = new Handler(Looper.getMainLooper());
        main.postDelayed(() -> webSplashPainted = true, SPLASH_FAILSAFE_MS);
        if (getBridge() != null) {
            getBridge().addWebViewListener(new WebViewListener() {
                @Override
                public void onPageCommitVisible(WebView view, String url) {
                    super.onPageCommitVisible(view, url);
                    main.postDelayed(() -> webSplashPainted = true, SPLASH_PAINT_GRACE_MS);
                }
            });
        }
    }
}
