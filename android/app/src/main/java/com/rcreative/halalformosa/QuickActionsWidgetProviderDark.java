package com.rcreative.halalformosa;

public class QuickActionsWidgetProviderDark extends QuickActionsWidgetBase {
    @Override
    protected int getLayoutId() {
        return R.layout.widget_quick_actions_dark;
    }

    @Override
    protected boolean isDarkTheme() {
        return true;
    }
}
