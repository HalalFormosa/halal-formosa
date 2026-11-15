package com.rcreative.halalformosa;

public class QuickActionsWidgetProviderLight extends QuickActionsWidgetBase {
    @Override
    protected int getLayoutId() {
        return R.layout.widget_quick_actions_light;
    }

    @Override
    protected boolean isDarkTheme() {
        return false;
    }
}
