package com.smartschoolbell.app;

import android.content.Intent;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onTaskRemoved(Intent rootIntent) {
        super.onTaskRemoved(rootIntent);
        // This helps the OS understand the app intends to keep running 
        // even if the task is removed from the recent apps list.
    }
}
