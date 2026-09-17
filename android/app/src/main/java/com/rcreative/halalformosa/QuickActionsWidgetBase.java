package com.rcreative.halalformosa;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.widget.RemoteViews;
import androidx.core.content.ContextCompat;

abstract class QuickActionsWidgetBase extends AppWidgetProvider {

    private static final String SCAN_URI = "myapp://scan/auto";
    private static final String BARCODE_URI = "myapp://scan/barcode";
    private static final String EXPLORE_URI = "myapp://explore";

    // Written by the app via @capacitor/preferences (default SharedPreferences group).
    private static final String PREFS_GROUP = "CapacitorStorage";
    private static final String KEY_LOGGED_IN = "widget_logged_in";
    private static final String KEY_SCANS_REMAINING = "widget_scans_remaining";

    protected abstract int getLayoutId();

    protected abstract boolean isDarkTheme();

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), getLayoutId());

            views.setOnClickPendingIntent(R.id.widget_btn_scan, buildPendingIntent(context, SCAN_URI, 1));
            views.setOnClickPendingIntent(R.id.widget_btn_barcode, buildPendingIntent(context, BARCODE_URI, 2));
            views.setOnClickPendingIntent(R.id.widget_btn_explore, buildPendingIntent(context, EXPLORE_URI, 3));

            applyQuotaText(context, views);

            appWidgetManager.updateAppWidget(appWidgetId, views);
        }
    }

    // No-op if the inflated layout has no widget_quota_text view (e.g. the compact size).
    private void applyQuotaText(Context context, RemoteViews views) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_GROUP, Context.MODE_PRIVATE);
        boolean loggedIn = "1".equals(prefs.getString(KEY_LOGGED_IN, "0"));
        String remaining = prefs.getString(KEY_SCANS_REMAINING, "");

        String text;
        int colorRes;

        if (!loggedIn) {
            text = context.getString(R.string.widget_quota_logged_out);
            colorRes = isDarkTheme() ? R.color.widget_dark_muted : R.color.widget_light_muted;
        } else if ("∞".equals(remaining)) {
            text = context.getString(R.string.widget_quota_unlimited);
            colorRes = isDarkTheme() ? R.color.widget_dark_accent : R.color.widget_light_accent;
        } else if (remaining != null && !remaining.isEmpty()) {
            text = context.getString(R.string.widget_quota_remaining, remaining);
            colorRes = isDarkTheme() ? R.color.widget_dark_accent : R.color.widget_light_accent;
        } else {
            text = context.getString(R.string.widget_quota_unknown);
            colorRes = isDarkTheme() ? R.color.widget_dark_muted : R.color.widget_light_muted;
        }

        views.setTextViewText(R.id.widget_quota_text, text);
        views.setTextColor(R.id.widget_quota_text, ContextCompat.getColor(context, colorRes));
    }

    private PendingIntent buildPendingIntent(Context context, String uri, int requestCode) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(uri));
        intent.setPackage(context.getPackageName());
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(
                context,
                requestCode,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }
}
