import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.smartschoolbell.app',
    appName: 'Smart School Bell',
    webDir: 'dist',
    server: {
        androidScheme: 'https'
    },
    plugins: {
        SplashScreen: {
            launchShowDuration: 2000,
            backgroundColor: "#4f46e5",
            showSpinner: false
        },
        LocalNotifications: {
            smallIcon: "ic_stat_icon_config_sample",
            iconColor: "#4f46e5",
            sound: "beep.wav"
        }
    }
};

export default config;
