import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

export default function NotificationsScreen() {
  const router = useRouter();

  // State for toggles
  const [orderUpdates, setOrderUpdates] = useState(true);
  const [promotions, setPromotions] = useState(false);
  const [deliveryAlerts, setDeliveryAlerts] = useState(true);
  const [newsletter, setNewsletter] = useState(false);

  const NotificationSetting = ({ 
    title, 
    subtitle, 
    value, 
    onValueChange, 
    icon 
  }: any) => (
    <View style={styles.settingRow}>
      <View style={styles.iconContainer}>
        <Ionicons name={icon} size={22} color="#FFD700" />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingSubtitle}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#1a1a1a', true: '#FFD700' }}
        thumbColor={value ? '#fff' : '#444'}
        ios_backgroundColor="#1a1a1a"
      />
    </View>
  );

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color="#666" />
          <Text style={styles.infoText}>
            Control how you receive updates about your bespoke orders and luxury collections.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Order Activity</Text>
          <NotificationSetting
            icon="receipt-outline"
            title="Order Status"
            subtitle="Get notified when your cake is being baked or ready."
            value={orderUpdates}
            onValueChange={setOrderUpdates}
          />
          <NotificationSetting
            icon="bicycle-outline"
            title="Delivery Tracking"
            subtitle="Real-time alerts when your order is out for delivery."
            value={deliveryAlerts}
            onValueChange={setDeliveryAlerts}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Marketing & Discovery</Text>
          <NotificationSetting
            icon="sparkles-outline"
            title="Exclusive Offers"
            subtitle="Be the first to know about new seasonal perfumes."
            value={promotions}
            onValueChange={setNewsletter}
          />
          <NotificationSetting
            icon="mail-unread-outline"
            title="Newsletter"
            subtitle="Weekly curation of luxury lifestyle and scents."
            value={newsletter}
            onValueChange={setNewsletter}
          />
        </View>

        <TouchableOpacity 
          style={styles.systemBtn}
          onPress={() => alert("Redirecting to System Settings...")}
        >
          <Text style={styles.systemBtnText}>Advanced System Settings</Text>
          <Ionicons name="open-outline" size={16} color="#444" />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingTop: 60, 
    paddingHorizontal: 20, 
    paddingBottom: 20 
  },
  backBtn: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: '#111', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  headerTitle: { 
    color: '#fff', 
    fontSize: 18, 
    fontWeight: 'bold', 
    marginLeft: 15 
  },
  scrollContent: { padding: 20 },
  infoBox: { 
    flexDirection: 'row', 
    backgroundColor: '#0a0a0a', 
    padding: 15, 
    borderRadius: 15, 
    marginBottom: 30,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    alignItems: 'center'
  },
  infoText: { color: '#666', fontSize: 13, marginLeft: 10, flex: 1, lineHeight: 18 },
  section: { marginBottom: 35 },
  sectionLabel: { 
    color: '#444', 
    fontSize: 12, 
    fontWeight: 'bold', 
    textTransform: 'uppercase', 
    letterSpacing: 1.5,
    marginBottom: 20,
    marginLeft: 5
  },
  settingRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 25 
  },
  iconContainer: { 
    width: 45, 
    height: 45, 
    backgroundColor: '#111', 
    borderRadius: 12, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  textContainer: { flex: 1, marginLeft: 15, paddingRight: 10 },
  settingTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  settingSubtitle: { color: '#666', fontSize: 12, marginTop: 4, lineHeight: 16 },
  systemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#111'
  },
  systemBtnText: { color: '#444', fontSize: 14, marginRight: 8 }
});