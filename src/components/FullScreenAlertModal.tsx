import React, { useEffect } from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, Vibration, View } from 'react-native';

export interface ActiveAlert {
  title: string;
  body: string;
}

interface Props {
  alert: ActiveAlert | null;
  onDismiss: () => void;
}

export function FullScreenAlertModal({ alert, onDismiss }: Props) {
  useEffect(() => {
    if (alert) {
      if (Platform.OS === 'android') {
        Vibration.vibrate([0, 500, 300, 500, 300], true);
      } else {
        Vibration.vibrate([500, 500, 500]);
      }
    } else {
      Vibration.cancel();
    }
    return () => {
      Vibration.cancel();
    };
  }, [alert]);

  return (
    <Modal visible={!!alert} animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <View style={styles.screen}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>SUBSCRIPTION REMINDER</Text>
        </View>
        <Text style={styles.title}>{alert?.title ?? 'Deadline Alert'}</Text>
        <Text style={styles.body}>{alert?.body ?? ''}</Text>
        <TouchableOpacity
          style={styles.dismissBtn}
          onPress={() => {
            Vibration.cancel();
            onDismiss();
          }}
        >
          <Text style={styles.dismissBtnText}>Got It — Review Subscription</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#7f1d1d',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
    gap: 20,
  },
  badge: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  badgeText: { color: '#fff', fontWeight: '800', fontSize: 12, letterSpacing: 1.2 },
  title: { color: '#fff', fontSize: 30, fontWeight: '800', textAlign: 'center' },
  body: { color: '#fee2e2', fontSize: 17, textAlign: 'center', lineHeight: 24 },
  dismissBtn: {
    marginTop: 24,
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  dismissBtnText: { color: '#7f1d1d', fontSize: 16, fontWeight: '800' },
});