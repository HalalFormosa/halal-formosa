package com.rcreative.halalformosa;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "WidgetSync")
public class WidgetSyncPlugin extends Plugin {

    private static final Class<?>[] WIDGET_PROVIDERS = new Class<?>[] {
            QuickActionsWidgetProviderLight.class,
            QuickActionsWidgetProviderDark.class,
            QuickActionsWidgetProviderLight2x.class,
            QuickActionsWidgetProviderDark2x.class,
            QuickActionsWidgetProviderLight3x.class,
            QuickActionsWidgetProviderDark3x.class,
    };

    @PluginMethod
    public void refresh(PluginCall call) {
        Context context = getContext();
        AppWidgetManager manager = AppWidgetManager.getInstance(context);

        for (Class<?> providerClass : WIDGET_PROVIDERS) {
            ComponentName component = new ComponentName(context, providerClass);
            int[] ids = manager.getAppWidgetIds(component);
            if (ids.length == 0) continue;

            Intent intent = new Intent(context, providerClass);
            intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
            intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
            context.sendBroadcast(intent);
        }

        call.resolve();
    }
}
