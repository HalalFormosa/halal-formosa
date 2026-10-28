package com.rcreative.halalformosa;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WidgetSyncPlugin.class);
        registerPlugin(RecaptchaNativePlugin.class);
        registerPlugin(LiveTextPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
