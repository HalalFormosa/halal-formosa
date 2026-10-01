package com.rcreative.halalformosa;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;
import androidx.core.content.ContextCompat;
import java.util.Calendar;

abstract class QuickActionsWidgetBase extends AppWidgetProvider {

    private static final String SCAN_URI = "myapp://scan/auto";
    private static final String BARCODE_URI = "myapp://scan/barcode";
    private static final String EXPLORE_URI = "myapp://explore";

    // Written by the app via @capacitor/preferences (default SharedPreferences group).
    private static final String PREFS_GROUP = "CapacitorStorage";
    private static final String KEY_LOGGED_IN = "widget_logged_in";
    private static final String KEY_SCANS_REMAINING = "widget_scans_remaining";

    // Prayer times ("HH:mm", 24h) written by the app, in the same order as PRAYER_IDS.
    private static final String[] PRAYER_KEYS = {"fajr", "dhuhr", "asr", "maghrib", "isha"};
    private static final int[] PRAYER_TIME_IDS = {
            R.id.widget_prayer_fajr_time, R.id.widget_prayer_dhuhr_time, R.id.widget_prayer_asr_time,
            R.id.widget_prayer_maghrib_time, R.id.widget_prayer_isha_time
    };
    private static final int[] PRAYER_NAME_IDS = {
            R.id.widget_prayer_fajr_name, R.id.widget_prayer_dhuhr_name, R.id.widget_prayer_asr_name,
            R.id.widget_prayer_maghrib_name, R.id.widget_prayer_isha_name
    };

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
            applyPrayerStrip(context, views);

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

    // No-op on layouts without the prayer strip. The strip stays hidden until the app has synced times.
    private void applyPrayerStrip(Context context, RemoteViews views) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_GROUP, Context.MODE_PRIVATE);
        int[] minutes = new int[PRAYER_KEYS.length];
        String[] labels = new String[PRAYER_KEYS.length];
        for (int i = 0; i < PRAYER_KEYS.length; i++) {
            labels[i] = prefs.getString("widget_prayer_" + PRAYER_KEYS[i], "");
            minutes[i] = parseMinutes(labels[i]);
            if (minutes[i] < 0) {
                views.setViewVisibility(R.id.widget_prayer_strip, View.GONE);
                return;
            }
        }

        Calendar now = Calendar.getInstance();
        int nowMin = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE);
        int next = 0; // after Isha, the next prayer is tomorrow's Fajr
        for (int i = 0; i < minutes.length; i++) {
            if (minutes[i] > nowMin) {
                next = i;
                break;
            }
        }

        boolean dark = isDarkTheme();
        int accent = ContextCompat.getColor(context, dark ? R.color.widget_dark_accent : R.color.widget_light_accent);
        int text = ContextCompat.getColor(context, dark ? R.color.widget_dark_text : R.color.widget_light_text);
        int muted = ContextCompat.getColor(context, dark ? R.color.widget_dark_muted : R.color.widget_light_muted);

        for (int i = 0; i < PRAYER_KEYS.length; i++) {
            views.setTextViewText(PRAYER_TIME_IDS[i], labels[i]);
            views.setTextColor(PRAYER_TIME_IDS[i], i == next ? accent : text);
            views.setTextColor(PRAYER_NAME_IDS[i], i == next ? accent : muted);
        }
        views.setViewVisibility(R.id.widget_prayer_strip, View.VISIBLE);
    }

    private static int parseMinutes(String hhmm) {
        if (hhmm == null) return -1;
        String[] parts = hhmm.split(":");
        if (parts.length != 2) return -1;
        try {
            return Integer.parseInt(parts[0].trim()) * 60 + Integer.parseInt(parts[1].trim());
        } catch (NumberFormatException e) {
            return -1;
        }
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
