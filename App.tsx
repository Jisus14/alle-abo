import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth } from './src/firebase';
import { configureNotificationHandler } from './src/services/notifications';
import { AuthScreen } from './src/screens/AuthScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { PrivacyModal } from './src/components/PrivacyModal';
import { ActiveAlert, FullScreenAlertModal } from './src/components/FullScreenAlertModal';

configureNotificationHandler();

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [privacyVisible, setPrivacyVisible] = useState(false);
  const [activeAlert, setActiveAlert] = useState<ActiveAlert | null>(null);
  const lastHandledNotificationId = useRef<string | null>(null);
  const lastResponse = Notifications.useLastNotificationResponse();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      lastHandledNotificationId.current = notification.request.identifier;
      setActiveAlert({
        title: notification.request.content.title ?? 'Subscription Reminder',
        body: notification.request.content.body ?? '',
      });
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const id = response.notification.request.identifier;
      if (lastHandledNotificationId.current === id) return;
      lastHandledNotificationId.current = id;
      setActiveAlert({
        title: response.notification.request.content.title ?? 'Subscription Reminder',
        body: response.notification.request.content.body ?? '',
      });
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!lastResponse) return;
    const id = lastResponse.notification.request.identifier;
    if (lastHandledNotificationId.current === id) return;
    lastHandledNotificationId.current = id;
    setActiveAlert({
      title: lastResponse.notification.request.content.title ?? 'Subscription Reminder',
      body: lastResponse.notification.request.content.body ?? '',
    });
  }, [lastResponse]);

  return (
    <SafeAreaProvider>
      {authLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#38bdf8" />
        </View>
      ) : user ? (
        <DashboardScreen user={user} onOpenPrivacy={() => setPrivacyVisible(true)} />
      ) : (
        <AuthScreen onOpenPrivacy={() => setPrivacyVisible(true)} />
      )}
      <PrivacyModal visible={privacyVisible} onClose={() => setPrivacyVisible(false)} />
      <FullScreenAlertModal
        alert={activeAlert}
        onDismiss={() => {
          if (lastHandledNotificationId.current) {
            Notifications.dismissNotificationAsync(lastHandledNotificationId.current);
          }
          setActiveAlert(null);
        }}
      />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' },
});